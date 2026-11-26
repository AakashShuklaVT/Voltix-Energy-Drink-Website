import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { motion, useUI } from '../lib/store'
import { FLAVORS } from '../lib/flavors'

/**
 * 3D "ingredients" that orbit the can in the Features section.
 * Rendered inside the can's outer group, so they follow the can wherever the
 * scroll choreography moves it. Units are can-units (can radius = 0.5).
 *
 *   0 → caffeine molecule      2 → citrus slices
 *   1 → B-vitamin capsules     3 → carbonation bubbles
 */

// overshoots slightly before settling, so each ingredient "pops" in
const easeOutBack = (x) => {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

// Scales a group in and out from motion.ingredients[index] (0 = hidden, 1 = shown)
function useReveal(index, ref, base = 1) {
  useFrame(() => {
    const progress = motion.ingredients[index]
    const group = ref.current
    if (!group) return
    group.visible = progress > 0.002
    group.scale.setScalar(Math.max(0.0001, easeOutBack(Math.min(1, progress)) * base))
  })
}

/* ---------------- Caffeine (C8H10N4O2) ---------------- */
function Caffeine({ accent }) {
  const groupRef = useRef()
  const spinRef = useRef()
  useReveal(0, groupRef, 1)
  useFrame((_, dt) => {
    spinRef.current.rotation.y += dt * 0.5
    spinRef.current.rotation.x += dt * 0.15
  })

  const { atoms, bonds } = useMemo(() => {
    // Flattened 2D layout of the purine skeleton + substituents (bond length ≈ 0.28)
    const bondLength = 0.28
    const hex = []
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 6 + (i * Math.PI) / 3
      hex.push([Math.cos(angle) * bondLength - 0.24, Math.sin(angle) * bondLength])
    }
    // five-membered ring fused on the hex's right edge (atoms 0 & 5)
    const p0 = hex[0], p5 = hex[5]
    const mid = [(p0[0] + p5[0]) / 2 + 0.36, (p0[1] + p5[1]) / 2]
    const pentagon = [
      [p0[0] + 0.25, p0[1] + 0.12],
      [mid[0], mid[1]],
      [p5[0] + 0.25, p5[1] - 0.12],
    ]
    // p = 2D position, t = atom type (C / N / O, or M for a methyl group)
    const atomList = [
      ...hex.map((p, i) => ({ p, t: i === 1 || i === 3 ? 'N' : 'C' })),
      ...pentagon.map((p, i) => ({ p, t: i === 1 ? 'C' : 'N' })),
      { p: [hex[2][0] - 0.05, hex[2][1] + 0.26], t: 'O' }, // carbonyl
      { p: [hex[4][0] - 0.05, hex[4][1] - 0.26], t: 'O' },
      { p: [hex[1][0] + 0.06, hex[1][1] + 0.27], t: 'M' }, // methyl
      { p: [hex[3][0] - 0.27, hex[3][1]], t: 'M' },
      { p: [pentagon[0][0] + 0.12, pentagon[0][1] + 0.24], t: 'M' },
    ]
    const positionOf = (i) => atomList[i].p
    // bonds as pairs of indices into atomList
    const bondPairs = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
      [0, 6], [6, 7], [7, 8], [8, 5],
      [2, 9], [4, 10], [1, 11], [3, 12], [6, 13],
    ]
    return {
      // a tiny z offset per atom so the flat molecule doesn't look paper-thin
      atoms: atomList.map((atom, i) => ({ ...atom, z: Math.sin(i * 1.7) * 0.03 })),
      bonds: bondPairs.map(([from, to]) => [positionOf(from), positionOf(to)]),
    }
  }, [])

  const mats = useMemo(
    () => ({
      C: new THREE.MeshPhysicalMaterial({ color: '#202734', roughness: 0.25, metalness: 0.3, clearcoat: 1 }),
      N: new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.2, metalness: 0.1, clearcoat: 1, emissive: accent, emissiveIntensity: 0.25 }),
      O: new THREE.MeshPhysicalMaterial({ color: '#f2f5f8', roughness: 0.15, clearcoat: 1 }),
      M: new THREE.MeshPhysicalMaterial({ color: '#6b7587', roughness: 0.3, clearcoat: 1 }),
      bond: new THREE.MeshStandardMaterial({ color: '#c7ced8', roughness: 0.3, metalness: 0.8 }),
    }),
    [accent],
  )
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 28, 20), [])
  const bondCylinder = useMemo(() => new THREE.CylinderGeometry(0.022, 0.022, 1, 10), [])

  return (
    <group ref={groupRef} position={[1.25, 0.55, 0.3]}>
      <group ref={spinRef}>
        {atoms.map((atom, i) => (
          <mesh key={i} geometry={sphere} material={mats[atom.t]} position={[atom.p[0], atom.p[1], atom.z]} scale={atom.t === 'M' ? 0.075 : atom.t === 'O' ? 0.085 : 0.1} />
        ))}
        {bonds.map(([from, to], i) => {
          // unit cylinder stretched between the two atoms (cylinders stand along Y, hence the -90°)
          const start = new THREE.Vector3(from[0], from[1], 0)
          const end = new THREE.Vector3(to[0], to[1], 0)
          const length = start.distanceTo(end)
          const mid = start.clone().add(end).multiplyScalar(0.5)
          const angle = Math.atan2(end.y - start.y, end.x - start.x) - Math.PI / 2
          return <mesh key={i} geometry={bondCylinder} material={mats.bond} position={mid} rotation={[0, 0, angle]} scale={[1, length, 1]} />
        })}
      </group>
    </group>
  )
}

/* ---------------- B-vitamin capsules ---------------- */
function Capsules({ accent }) {
  const groupRef = useRef()
  const itemsRef = useRef([])
  useReveal(1, groupRef, 1)
  // p = position, r = base rotation, s = scale
  const layout = useMemo(
    () => [
      { p: [1.2, 0.8, 0.2], r: [0.4, 0.2, 0.9], s: 1 },
      { p: [-1.05, 0.35, 0.5], r: [1.2, 0.5, -0.6], s: 0.8 },
      { p: [1.0, -0.55, 0.6], r: [0.2, 1.1, 0.3], s: 0.9 },
      { p: [-0.9, -0.85, -0.2], r: [0.8, 0.3, 1.4], s: 0.7 },
      { p: [0.15, 1.45, -0.4], r: [1.4, 0.2, 0.4], s: 0.65 },
    ],
    [],
  )
  const accentShell = useMemo(() => new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.18, clearcoat: 1 }), [accent])
  const whiteShell = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#f4f6fa', roughness: 0.2, clearcoat: 1 }), [])
  // Split one capsule into two shells (y ≥ 0 / y < 0) for the two-tone look
  const halves = useMemo(() => {
    const capsule = new THREE.CapsuleGeometry(0.09, 0.16, 8, 20)
    const positions = capsule.attributes.position
    const top = [], bottom = []
    const indices = capsule.index.array
    // sort each triangle by the height of its centre
    for (let i = 0; i < indices.length; i += 3) {
      const y = (positions.getY(indices[i]) + positions.getY(indices[i + 1]) + positions.getY(indices[i + 2])) / 3
      ;(y >= 0 ? top : bottom).push(indices[i], indices[i + 1], indices[i + 2])
    }
    const topHalf = capsule.clone(); topHalf.setIndex(top)
    const bottomHalf = capsule.clone(); bottomHalf.setIndex(bottom)
    return [topHalf, bottomHalf]
  }, [])

  useFrame((state) => {
    const time = state.clock.elapsedTime
    itemsRef.current.forEach((item, i) => {
      if (!item) return
      item.rotation.x = layout[i].r[0] + time * 0.4 * (i % 2 ? 1 : -1)
      item.rotation.z = layout[i].r[2] + time * 0.25
      item.position.y = layout[i].p[1] + Math.sin(time * 0.9 + i) * 0.06
    })
  })

  return (
    <group ref={groupRef}>
      {layout.map((capsule, i) => (
        <group key={i} ref={(el) => (itemsRef.current[i] = el)} position={capsule.p} scale={capsule.s * 1.6}>
          <mesh geometry={halves[0]} material={accentShell} />
          <mesh geometry={halves[1]} material={whiteShell} />
        </group>
      ))}
    </group>
  )
}

/* ---------------- Citrus slices ---------------- */
const citrusCache = new Map()
function citrusTexture(flavor) {
  if (!citrusCache.has(flavor.id)) citrusCache.set(flavor.id, drawCitrusTexture(flavor))
  return citrusCache.get(flavor.id)
}
// Cross-section of a citrus slice: rind, pith ring, then the juicy segments
function drawCitrusTexture(flavor) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')
  const center = 256
  ctx.fillStyle = flavor.accentDeep
  ctx.beginPath(); ctx.arc(center, center, 256, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#f6fbe8'
  ctx.beginPath(); ctx.arc(center, center, 236, 0, Math.PI * 2); ctx.fill()
  const segmentCount = 10
  for (let i = 0; i < segmentCount; i++) {
    // small angular gap on each side leaves the white membrane between segments
    const startAngle = (i / segmentCount) * Math.PI * 2 + 0.05
    const endAngle = ((i + 1) / segmentCount) * Math.PI * 2 - 0.05
    const gradient = ctx.createRadialGradient(center, center, 20, center, center, 220)
    gradient.addColorStop(0, flavor.accentSoft)
    gradient.addColorStop(1, flavor.accent)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(center + Math.cos((startAngle + endAngle) / 2) * 24, center + Math.sin((startAngle + endAngle) / 2) * 24)
    ctx.arc(center, center, 218, startAngle, endAngle)
    ctx.closePath()
    ctx.fill()
    // pulp vesicles
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    for (let k = 0; k < 26; k++) {
      const angle = startAngle + Math.random() * (endAngle - startAngle)
      const distance = 50 + Math.random() * 160
      ctx.beginPath()
      ctx.ellipse(center + Math.cos(angle) * distance, center + Math.sin(angle) * distance, 3 + Math.random() * 5, 1.5 + Math.random() * 2, angle, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.fillStyle = '#f6fbe8'
  ctx.beginPath(); ctx.arc(center, center, 18, 0, Math.PI * 2); ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function Slices({ flavor }) {
  const groupRef = useRef()
  const itemsRef = useRef([])
  useReveal(2, groupRef, 1)
  const texture = useMemo(() => citrusTexture(flavor), [flavor])
  // cylinder material groups are [side, top cap, bottom cap]
  const materials = useMemo(() => {
    const face = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.5 })
    const rind = new THREE.MeshPhysicalMaterial({ color: flavor.accentDeep, roughness: 0.45, clearcoat: 0.6 })
    return [rind, face, face]
  }, [texture, flavor])
  const geo = useMemo(() => new THREE.CylinderGeometry(0.34, 0.34, 0.07, 48), [])
  // p = position, r = base rotation, s = scale
  const layout = useMemo(
    () => [
      { p: [1.25, 0.7, 0.1], r: [1.2, 0.3, 0.2], s: 1 },
      { p: [-1.15, 0.1, 0.4], r: [0.9, -0.6, 0.5], s: 0.75 },
      { p: [1.05, -0.75, 0.5], r: [1.5, 0.8, -0.3], s: 0.6 },
      { p: [-0.75, 1.15, -0.3], r: [0.6, 0.2, 0.9], s: 0.55 },
    ],
    [],
  )
  useFrame((state) => {
    const time = state.clock.elapsedTime
    itemsRef.current.forEach((item, i) => {
      if (!item) return
      item.rotation.x = layout[i].r[0] + Math.sin(time * 0.6 + i) * 0.3
      item.rotation.y = layout[i].r[1] + time * 0.3
      item.position.y = layout[i].p[1] + Math.sin(time * 0.8 + i * 2) * 0.05
    })
  })
  return (
    <group ref={groupRef}>
      {layout.map((slice, i) => (
        <mesh key={i} ref={(el) => (itemsRef.current[i] = el)} geometry={geo} material={materials} position={slice.p} scale={slice.s} />
      ))}
    </group>
  )
}

/* ---------------- Carbonation bubbles ---------------- */
function Bubbles({ count = 70 }) {
  const groupRef = useRef()
  const meshRef = useRef()
  useReveal(3, groupRef, 1)
  const dummy = useMemo(() => new THREE.Object3D(), []) // reused to build each instance matrix
  // a = angle around the can, r = distance from its axis, y = height, s = size, v = rise speed
  const bubbles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        a: Math.random() * Math.PI * 2,
        r: 0.7 + Math.random() * 0.9,
        y: Math.random() * 3 - 1.5,
        s: 0.02 + Math.pow(Math.random(), 2) * 0.09,
        v: 0.25 + Math.random() * 0.5,
      })),
    [count],
  )
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: 0.35,
        iridescence: 1,
        iridescenceIOR: 1.3,
        clearcoat: 1,
        envMapIntensity: 2.5,
        depthWrite: false,
      }),
    [],
  )
  useFrame((state, dt) => {
    if (!groupRef.current.visible) return
    const time = state.clock.elapsedTime
    bubbles.forEach((bubble, i) => {
      // rise, then wrap back to the bottom
      bubble.y += bubble.v * dt
      if (bubble.y > 1.7) bubble.y = -1.7
      const wobble = Math.sin(time * 3 + i) * 0.03
      dummy.position.set(Math.cos(bubble.a) * bubble.r + wobble, bubble.y, Math.sin(bubble.a) * bubble.r)
      dummy.scale.setScalar(bubble.s)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[null, null, count]} material={material} frustumCulled={false}>
        <sphereGeometry args={[1, 20, 14]} />
      </instancedMesh>
    </group>
  )
}

export function Ingredients() {
  const flavorId = useUI((state) => state.flavor)
  const flavor = FLAVORS[flavorId]
  return (
    <group>
      <Caffeine accent={flavor.accent} />
      <Capsules accent={flavor.accent} />
      <Slices flavor={flavor} />
      <Bubbles />
    </group>
  )
}
