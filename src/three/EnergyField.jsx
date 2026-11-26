import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { motion, isSmallScreen, useUI } from '../lib/store'
import { FLAVORS } from '../lib/flavors'
import { CAN_HEIGHT } from './can/profile'

/**
 * Brand Experience particle system.
 * One GPU point cloud carries four target shapes as attributes and the vertex
 * shader morphs between them (driven by `motion.energy.morph`, scrubbed by
 * ScrollTrigger):
 *
 *   0 can surface  →  1 electric storm  →  2 lightning bolt  →  3 VOLTIX wordmark
 *
 * Particles are pushed away from the pointer and stagger per-particle so the
 * transitions feel like a charge discharging rather than a linear tween.
 */

const vertexShader = /* glsl */ `
  uniform float uMorph;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform vec3 uMouse;
  attribute vec3 aP1;
  attribute vec3 aP2;
  attribute vec3 aP3;
  attribute vec4 aRand;
  varying float vTone;
  varying float vFlash;

  vec3 rotY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    float m = clamp(uMorph, 0.0, 3.0);
    float seg = floor(min(m, 2.999));
    float f = m - seg;
    float delay = aRand.x * 0.4;
    float t = smoothstep(delay, delay + 0.6, f);

    vec3 p0 = position;
    vec3 p1 = rotY(aP1, uTime * 0.25 + aRand.y);
    vec3 a = seg < 0.5 ? p0 : (seg < 1.5 ? p1 : aP2);
    vec3 b = seg < 0.5 ? p1 : (seg < 1.5 ? aP2 : aP3);
    vec3 p = mix(a, b, t);

    // turbulence: always a little, a lot mid-transition
    float chaos = sin(t * 3.14159);
    vec3 n = vec3(
      sin(uTime * 1.7 + aRand.y * 31.0 + p.y * 2.0),
      cos(uTime * 1.3 + aRand.z * 27.0 + p.x * 2.0),
      sin(uTime * 1.1 + aRand.w * 19.0)
    );
    p += n * uScale * (0.006 + chaos * 0.09);

    // pointer repulsion
    vec2 d = p.xy - uMouse.xy;
    float dist = length(d);
    float radius = uScale * 0.14;
    p.xy += (d / max(dist, 0.0001)) * smoothstep(radius, 0.0, dist) * radius * 0.6;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float flicker = 0.75 + 0.25 * sin(uTime * 6.0 + aRand.w * 40.0);
    gl_PointSize = uSize * (0.35 + aRand.y * 0.9) * flicker * uPixelRatio / -mv.z;
    vTone = aRand.z;
    vFlash = chaos;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTone;
  varying float vFlash;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    vec3 col = mix(uColor, vec3(1.0), step(0.82, vTone) * 0.85 + vFlash * 0.25);
    gl_FragColor = vec4(col * a, a * uOpacity);
  }
`

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Sample N points from filled 2D drawing (canvas) → returns [x,y] in -0.5..0.5 * aspect */
function sampleCanvas(draw, w, h, n) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  draw(ctx, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  // collect filled pixels on a 2px grid, then pick random ones (jittered to fill the gaps)
  const filled = []
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 128) filled.push([x, y])
  const samples = []
  for (let i = 0; i < n; i++) {
    const pixel = filled[Math.floor(Math.random() * filled.length)] || [w / 2, h / 2]
    samples.push([(pixel[0] + Math.random() * 2) / w - 0.5, -((pixel[1] + Math.random() * 2) / h - 0.5)])
  }
  return samples
}

// Target positions for each morph stage (P0 → P3) plus per-particle randoms (R).
// vw / vh are the viewport size in world units.
function buildShapes(count, vw, vh) {
  const rand = Math.random
  const P0 = new Float32Array(count * 3)
  const P1 = new Float32Array(count * 3)
  const P2 = new Float32Array(count * 3)
  const P3 = new Float32Array(count * 3)
  const R = new Float32Array(count * 4)

  // 0 — can surface (matches the can at h = 0.55 of the viewport)
  const canHeight = 0.55 * vh
  const canRadius = (0.5 * canHeight) / CAN_HEIGHT
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2
    const y = (rand() - 0.5) * canHeight * 0.98
    P0.set([Math.sin(angle) * canRadius, y, Math.cos(angle) * canRadius], i * 3)
  }

  // 1 — storm: twisted torus (every third particle) + spherical shell
  const stormSize = Math.min(vw, vh) * 0.42
  for (let i = 0; i < count; i++) {
    if (i % 3 === 0) {
      const around = rand() * Math.PI * 2, tubeAngle = rand() * Math.PI * 2
      const tubeRadius = stormSize * (0.15 + rand() * 0.06)
      const ringRadius = stormSize * 0.75
      P1.set([(ringRadius + tubeRadius * Math.cos(tubeAngle)) * Math.cos(around), tubeRadius * Math.sin(tubeAngle) + Math.sin(around * 3) * stormSize * 0.12, (ringRadius + tubeRadius * Math.cos(tubeAngle)) * Math.sin(around)], i * 3)
    } else {
      // uniform direction on a sphere, radius biased towards the inner shell
      const cosPolar = rand() * 2 - 1, azimuth = rand() * Math.PI * 2
      const radius = stormSize * (0.45 + Math.pow(rand(), 3) * 0.7)
      const sinPolar = Math.sqrt(1 - cosPolar * cosPolar)
      P1.set([radius * sinPolar * Math.cos(azimuth), radius * cosPolar, radius * sinPolar * Math.sin(azimuth)], i * 3)
    }
  }

  // 2 — lightning bolt
  const boltH = vh * 0.78
  const boltSamples = sampleCanvas(
    (ctx, w, h) => {
      ctx.beginPath()
      ctx.moveTo(w * 0.62, h * 0.02)
      ctx.lineTo(w * 0.18, h * 0.56)
      ctx.lineTo(w * 0.47, h * 0.56)
      ctx.lineTo(w * 0.34, h * 0.98)
      ctx.lineTo(w * 0.84, h * 0.4)
      ctx.lineTo(w * 0.54, h * 0.4)
      ctx.closePath()
      ctx.fill()
    },
    200,
    320,
    count,
  )
  // 0.625 = the 200 × 320 canvas aspect
  boltSamples.forEach(([x, y], i) => P2.set([x * boltH * 0.625, y * boltH, (rand() - 0.5) * vh * 0.06], i * 3))

  // 3 — VOLTIX wordmark
  const textW = Math.min(vw * 0.86, vh * 1.9)
  const wordSamples = sampleCanvas(
    (ctx, w, h) => {
      ctx.font = `italic 900 ${h * 0.78}px 'Archivo Variable', 'Arial Black', sans-serif`
      if ('fontStretch' in ctx) ctx.fontStretch = 'expanded'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // squeeze horizontally if the wide font overflows the canvas
      const measuredWidth = ctx.measureText('VOLTIX').width
      const fitScale = Math.min(1, (w * 0.96) / measuredWidth)
      ctx.translate(w / 2, h / 2)
      ctx.scale(fitScale, 1)
      ctx.fillText('VOLTIX', 0, 0)
    },
    900,
    200,
    count,
  )
  shuffle(wordSamples, rand)
  wordSamples.forEach(([x, y], i) => P3.set([x * textW, y * textW * (200 / 900), (rand() - 0.5) * vh * 0.04], i * 3))

  for (let i = 0; i < count; i++) R.set([rand(), rand(), rand(), rand()], i * 4)
  return { P0, P1, P2, P3, R, scale: vh }
}

export function EnergyField() {
  const flavor = useUI((state) => state.flavor)
  const size = useThree((state) => state.size)
  const camera = useThree((state) => state.camera)
  const viewport = useThree((state) => state.viewport)
  const pointsRef = useRef()
  const count = isSmallScreen() ? 7000 : 16000

  // rebuild targets when the viewport aspect changes noticeably
  const sizeKey = `${Math.round(size.width / 40)}x${Math.round(size.height / 40)}`
  const shapes = useMemo(() => {
    const view = viewport.getCurrentViewport(camera, [0, 0, 0])
    return buildShapes(count, view.width, view.height)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeKey, count])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(shapes.P0, 3))
    geo.setAttribute('aP1', new THREE.BufferAttribute(shapes.P1, 3))
    geo.setAttribute('aP2', new THREE.BufferAttribute(shapes.P2, 3))
    geo.setAttribute('aP3', new THREE.BufferAttribute(shapes.P3, 3))
    geo.setAttribute('aRand', new THREE.BufferAttribute(shapes.R, 4))
    // the shader moves points far from their base positions, so use a generous fixed bound
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100)
    return geo
  }, [shapes])
  useEffect(() => () => geometry.dispose(), [geometry])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uMorph: { value: 0 },
          uTime: { value: 0 },
          uSize: { value: isSmallScreen() ? 60 : 85 },
          uPixelRatio: { value: 1 },
          uScale: { value: 1 },
          uMouse: { value: new THREE.Vector3(99, 99, 0) },
          uColor: { value: new THREE.Color(FLAVORS.citrus.accent) },
          uOpacity: { value: 0 },
        },
      }),
    [],
  )

  useEffect(() => {
    material.uniforms.uColor.value.set(FLAVORS[flavor].accent)
  }, [flavor, material])

  useFrame((state, dt) => {
    const energy = motion.energy
    const uniforms = material.uniforms
    // skip all per-frame work while the field is hidden (most of the page)
    pointsRef.current.visible = energy.opacity > 0.001
    if (!pointsRef.current.visible) return
    const view = state.viewport.getCurrentViewport(state.camera, [0, 0, 0])
    uniforms.uTime.value += dt
    uniforms.uMorph.value = energy.morph
    uniforms.uOpacity.value = energy.opacity
    uniforms.uPixelRatio.value = state.gl.getPixelRatio()
    uniforms.uScale.value = shapes.scale
    // damp pointer in world units (parked far away when there's no mouse)
    const pointer = motion.pointer
    const targetX = pointer.active ? (pointer.x * view.width) / 2 : view.width * 2
    const targetY = pointer.active ? (pointer.y * view.height) / 2 : view.height * 2
    uniforms.uMouse.value.x = THREE.MathUtils.damp(uniforms.uMouse.value.x, targetX, 6, dt)
    uniforms.uMouse.value.y = THREE.MathUtils.damp(uniforms.uMouse.value.y, targetY, 6, dt)
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
