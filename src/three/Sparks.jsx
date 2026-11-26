import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { motion, useUI } from '../lib/store'
import { FLAVORS } from '../lib/flavors'

/**
 * Ambient electric dust floating behind everything. Reacts to scroll velocity:
 * scrolling fast stretches the field vertically like a speed-warp.
 */
export function Sparks({ count = 240 }) {
  const flavor = useUI((state) => state.flavor)
  const pointsRef = useRef()
  const viewport = useThree((state) => state.viewport)
  const camera = useThree((state) => state.camera)

  // x / y are -1..1 and stretched to the viewport in the shader; z sits behind the can
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const randoms = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2
      positions[i * 3 + 2] = -1 - Math.random() * 5
      randoms[i] = Math.random()
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aRand', new THREE.BufferAttribute(randoms, 1))
    return geo
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSpan: { value: new THREE.Vector2(10, 6) },
          uStretch: { value: 0 },
          uColor: { value: new THREE.Color(FLAVORS.citrus.accent) },
          uPixelRatio: { value: 1 },
        },
        vertexShader: /* glsl */ `
          uniform float uTime; uniform vec2 uSpan; uniform float uStretch; uniform float uPixelRatio;
          attribute float aRand;
          varying float vA;
          void main() {
            vec3 p = position;
            p.y = fract(p.y * 0.5 + 0.5 + uTime * (0.01 + aRand * 0.02)) * 2.0 - 1.0;
            p.x += sin(uTime * 0.3 + aRand * 20.0) * 0.03;
            p.xy *= uSpan * 0.5 * (1.0 - p.z * 0.25);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (2.0 + aRand * 5.0) * uPixelRatio * (1.0 + uStretch * 0.5);
            vA = (0.25 + 0.75 * aRand) * (0.6 + 0.4 * sin(uTime * 2.0 + aRand * 30.0));
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * vA;
            gl_FragColor = vec4(uColor * a, a);
          }
        `,
      }),
    [],
  )

  useFrame((state, dt) => {
    const uniforms = material.uniforms
    uniforms.uTime.value += dt
    uniforms.uColor.value.set(FLAVORS[flavor].accent)
    uniforms.uPixelRatio.value = state.gl.getPixelRatio()
    const view = viewport.getCurrentViewport(camera, [0, 0, 0])
    uniforms.uSpan.value.set(view.width, view.height)
    // fast scrolling stretches the field, then it eases back
    uniforms.uStretch.value = THREE.MathUtils.damp(uniforms.uStretch.value, Math.min(3, Math.abs(motion.scrollVelocity) / 800), 4, dt)
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
