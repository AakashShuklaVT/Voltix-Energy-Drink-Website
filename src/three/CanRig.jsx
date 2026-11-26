import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CanModel } from './can/CanModel'
import { Ingredients } from './Ingredients'
import { CAN_HEIGHT } from './can/profile'
import { motion, useUI } from '../lib/store'
import { FLAVORS } from '../lib/flavors'

const damp = THREE.MathUtils.damp

/**
 * Places the can on screen. GSAP tweens `motion.can` (viewport-relative units),
 * this component converts it to world space every frame and layers the
 * interactive offsets on top: mouse tilt, drag-to-rotate with inertia and an
 * idle float.
 */
export function CanRig({ quality }) {
  const flavor = useUI((state) => state.flavor)
  const outerRef = useRef()
  const spinnerRef = useRef()
  const ringRef = useRef()
  const glow = useRef()
  // smoothed copies of the pointer (px / py) and drag values
  const smoothRef = useRef({ px: 0, py: 0, rot: motion.drag.rot, tiltX: 0 })
  const viewport = useThree((state) => state.viewport)
  const camera = useThree((state) => state.camera)

  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: FLAVORS.citrus.accent, transparent: true, opacity: 0, toneMapped: false }),
    [],
  )
  // soft radial glow, drawn once into a small canvas and tinted by the material colour
  const glowMat = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
    return new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      color: FLAVORS.citrus.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  }, [])

  useFrame((state, dt) => {
    const can = motion.can
    const view = viewport.getCurrentViewport(camera, [0, 0, 0])
    const time = state.clock.elapsedTime
    const smooth = smoothRef.current

    // pointer smoothing (normalised -1..1)
    smooth.px = damp(smooth.px, motion.pointer.x, 4, dt)
    smooth.py = damp(smooth.py, motion.pointer.y, 4, dt)

    // drag inertia — velocity is in rad/s so the coast feels identical at 60/120 Hz
    const drag = motion.drag
    if (!drag.active && drag.vel !== 0) {
      drag.rot += drag.vel * dt
      drag.vel *= Math.exp(-4.2 * dt)
      if (Math.abs(drag.vel) < 0.01) drag.vel = 0
    }
    // a light follow on top of the raw drag value irons out uneven pointer events
    smooth.rot = damp(smooth.rot, drag.rot, 16, dt)
    smooth.tiltX = damp(smooth.tiltX, drag.tiltX, 12, dt)

    // viewport-relative units → world units, plus a gentle idle bob
    const scale = (can.h * view.height) / CAN_HEIGHT
    const outer = outerRef.current
    outer.position.set(can.x * view.width, can.y * view.height + Math.sin(time * 1.1) * 0.035 * scale, 0)
    outer.scale.setScalar(Math.max(0.0001, scale * can.visible))

    // keyframe rotation + user drag + pointer tilt (scaled by `tilt`) + idle sway
    const spinner = spinnerRef.current
    spinner.rotation.y = can.rotY + smooth.rot + can.spin * time + smooth.px * 0.45 * can.tilt
    spinner.rotation.x = can.rotX + smooth.tiltX - smooth.py * 0.16 * can.tilt + Math.sin(time * 0.8) * 0.02
    spinner.rotation.z = can.rotZ + Math.sin(time * 0.6) * 0.015 - smooth.px * 0.05 * can.tilt

    // pedestal ring + glow
    const accent = FLAVORS[flavor].accent
    ringMat.color.set(accent)
    glowMat.color.set(accent)
    ringMat.opacity = motion.ring * 0.9
    glowMat.opacity = motion.ring * 0.55
    ringRef.current.visible = motion.ring > 0.001
    ringRef.current.rotation.z = time * 0.4
  })

  return (
    <group ref={outerRef}>
      <group ref={spinnerRef}>
        <CanModel flavor={flavor} quality={quality} segments={quality < 1 ? 96 : 144} />
      </group>
      {/* outside the spinner, so the ingredients don't turn with the drag */}
      <Ingredients />
      <group ref={ringRef} position={[0, -CAN_HEIGHT / 2 - 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh material={ringMat}>
          <ringGeometry args={[0.78, 0.8, 128]} />
        </mesh>
        <mesh material={ringMat} scale={1.28}>
          <ringGeometry args={[0.78, 0.785, 128, 1, 0, Math.PI * 1.4]} />
        </mesh>
        <mesh material={glowMat} position={[0, 0, -0.01]}>
          <planeGeometry args={[3.2, 3.2]} />
        </mesh>
      </group>
    </group>
  )
}
