import { Suspense, useEffect, useState } from 'react'
import { Canvas, advance, useThree } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { gsap } from '../lib/gsap'
import { CanRig } from './CanRig'
import { Lighting } from './Lighting'
import { EnergyField } from './EnergyField'
import { Sparks } from './Sparks'
import { isSmallScreen, isTouch, useUI } from '../lib/store'
import { ensureLabelFonts } from './can/label'

function ReadySignal() {
  const gl = useThree((state) => state.gl)
  const setSceneReady = useUI((state) => state.setSceneReady)
  useEffect(() => {
    // wait two frames so shaders are compiled before the loader leaves
    let frameId = requestAnimationFrame(() => (frameId = requestAnimationFrame(() => setSceneReady())))
    return () => cancelAnimationFrame(frameId)
  }, [gl, setSceneReady])
  return null
}

/**
 * Renders the scene from GSAP's ticker instead of R3F's own rAF loop. Lenis,
 * ScrollTrigger's scrub and every tween update first, then the frame is drawn
 * in the same tick — so the can never lags a frame behind the DOM (the
 * source of micro-jitter while scrolling). The clock advances by a clamped
 * delta so returning to a background tab doesn't teleport anything.
 */
function GsapFrameloop() {
  useEffect(() => {
    let elapsed = 0
    const tick = (_, deltaMs) => {
      elapsed += Math.min(deltaMs, 100) / 1000
      advance(elapsed)
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])
  return null
}

/**
 * One fixed, full-screen WebGL canvas sits behind the DOM. Every section
 * drives it through the shared `motion` store, so the can travels seamlessly
 * between sections instead of being re-mounted.
 */
export default function Experience() {
  const [fontsReady, setFontsReady] = useState(false)
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio, isTouch ? 1.5 : 1.75))
  const quality = isSmallScreen() ? 0.66 : 1 // label texture resolution

  useEffect(() => {
    // label artwork uses the web fonts → wait for them before drawing textures
    ensureLabelFonts().then(() => setFontsReady(true))
  }, [])

  return (
    <div className="webgl" aria-hidden="true">
      <Canvas
        frameloop="never"
        resize={{ debounce: { scroll: 50, resize: 150 } }}
        dpr={dpr}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 30, position: [0, 0, 10], near: 0.1, far: 60 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
          gl.setClearColor(0x000000, 0)
        }}
      >
        <GsapFrameloop />
        {/* flipflops caps how often DPR can bounce — each change resizes the canvas */}
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => {
            setDpr((current) => Math.max(1, current - 0.25))
          }}
        />
        <AdaptiveDpr pixelated={false} />
        <Lighting />
        {fontsReady && (
          <Suspense fallback={null}>
            <CanRig quality={quality} />
            <EnergyField />
            <Sparks count={isSmallScreen() ? 120 : 260} />
            <ReadySignal />
          </Suspense>
        )}
      </Canvas>
    </div>
  )
}
