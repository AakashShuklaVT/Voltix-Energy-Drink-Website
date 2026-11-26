import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CAN_HEIGHT,
  LID_Y,
  RIM_R,
  RIM_TUBE,
  RIM_Y,
  createBaseGeometry,
  createBodyGeometry,
  createLidGeometry,
  createScoreCurve,
  createTabGeometry,
} from './profile'
import { createLabelTextures } from './label'
import { FLAVORS } from '../../lib/flavors'
import { motion } from '../../lib/store'

/**
 * Fully procedural 250 ml slim can.
 *   body  → lathe with arc-length UVs + printed label (albedo / ORM / condensation)
 *   base  → domed bottom with standing ring
 *   top   → rolled rim bead, countersunk lid, stay-on tab, rivet and score line
 * The model is centred on its own origin (height ≈ 2.58, radius 0.5).
 */
export const CanModel = forwardRef(function CanModel({ flavor = 'citrus', quality = 1, segments = 128 }, ref) {
  const gl = useThree((state) => state.gl)

  const geo = useMemo(
    () => ({
      body: createBodyGeometry(segments),
      base: createBaseGeometry(Math.round(segments * 0.75)),
      lid: createLidGeometry(Math.round(segments * 0.75)),
      rim: new THREE.TorusGeometry(RIM_R, RIM_TUBE, 20, segments),
      tab: createTabGeometry(),
      score: new THREE.TubeGeometry(createScoreCurve(), 96, 0.0042, 6, true),
      rivet: new THREE.CylinderGeometry(0.024, 0.027, 0.014, 24),
      rivetCap: new THREE.SphereGeometry(0.024, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    }),
    [segments],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const label = useMemo(() => {
    const textures = createLabelTextures(FLAVORS[flavor], quality)
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    Object.values(textures).forEach((texture) => (texture.anisotropy = anisotropy))
    return textures
  }, [flavor, quality, gl])

  // Pre-build + upload the other flavours' labels while the page is idle, so
  // the first flavour switch (which swaps the label mid-spin) doesn't drop
  // frames drawing canvases and pushing textures to the GPU.
  useEffect(() => {
    // fallback for browsers without requestIdleCallback
    const whenIdle = window.requestIdleCallback || ((callback) => setTimeout(callback, 200))
    const cancelIdle = window.cancelIdleCallback || clearTimeout
    const queue = Object.keys(FLAVORS)
    let handle
    // one flavour per idle slot, so the main thread is never blocked for long
    const warmNextFlavor = () => {
      const flavorId = queue.shift()
      if (!flavorId) return
      const textures = createLabelTextures(FLAVORS[flavorId], quality)
      Object.values(textures).forEach((texture) => gl.initTexture(texture))
      handle = whenIdle(warmNextFlavor, { timeout: 2000 })
    }
    handle = whenIdle(warmNextFlavor, { timeout: 2000 })
    return () => cancelIdle(handle)
  }, [quality, gl])

  const bodyMat = useRef()
  // bare metal for the rim, base, tab and rivet; a duller finish for the lid
  const aluminium = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d4d9e1',
        metalness: 1,
        roughness: 0.24,
        envMapIntensity: 1.15,
      }),
    [],
  )
  const brushed = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#9aa2ad',
        metalness: 1,
        roughness: 0.3,
        envMapIntensity: 1.0,
        side: THREE.DoubleSide,
      }),
    [],
  )

  const tabPivot = useRef()
  useFrame(() => {
    const material = bodyMat.current
    if (material) {
      // condensation fades in/out with the "chilled" toggle
      const wetness = motion.condensation
      material.normalScale.setScalar(0.32 * wetness)
      material.clearcoatNormalScale.setScalar(1.1 * wetness)
      material.clearcoatRoughness = 0.06 + (1 - wetness) * 0.12
    }
    if (tabPivot.current) tabPivot.current.rotation.x = -motion.tabLift * 0.95
  })

  return (
    <group ref={ref} position={[0, -CAN_HEIGHT / 2, 0]}>
      {/* printed body */}
      <mesh geometry={geo.body} castShadow receiveShadow>
        <meshPhysicalMaterial
          ref={bodyMat}
          map={label.map}
          roughnessMap={label.orm}
          metalnessMap={label.orm}
          roughness={1}
          metalness={1}
          normalMap={label.normal}
          normalScale={[0.32, 0.32]}
          clearcoat={1}
          clearcoatRoughness={0.06}
          clearcoatNormalMap={label.normal}
          clearcoatNormalScale={[1.1, 1.1]}
          envMapIntensity={1.25}
        />
      </mesh>

      {/* domed base */}
      <mesh geometry={geo.base} material={aluminium} />

      {/* rolled rim bead */}
      <mesh geometry={geo.rim} material={aluminium} position={[0, RIM_Y, 0]} rotation={[Math.PI / 2, 0, 0]} />

      {/* lid */}
      <mesh geometry={geo.lid} material={brushed} />

      <group position={[0, LID_Y + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* opening score line (sits behind the rivet) */}
        <mesh geometry={geo.score} material={aluminium} position={[0, 0, 0.001]} />
        {/* rivet */}
        <mesh geometry={geo.rivet} material={aluminium} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.006]} />
        <mesh geometry={geo.rivetCap} material={aluminium} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]} scale={[1, 0.35, 1]} />
        {/* pull tab — pivots around the rivet when it lifts */}
        <group ref={tabPivot} position={[0, 0.03, 0.01]}>
          <mesh geometry={geo.tab} material={aluminium} position={[0, -0.03, 0]} />
        </group>
      </group>
    </group>
  )
})
