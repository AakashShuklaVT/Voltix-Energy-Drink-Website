import { Environment, Lightformer } from '@react-three/drei'
import { useUI } from '../lib/store'
import { FLAVORS } from '../lib/flavors'

/**
 * Studio lighting built from Lightformers (no HDR download).
 * Tall strip-lights produce the long vertical speculars you see on real
 * product shots of aluminium cans; a tinted rim light picks up the brand colour.
 */
export function Lighting() {
  const flavor = useUI((s) => s.flavor)
  const accent = FLAVORS[flavor].accent
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[-4, 6, 5]} intensity={1.6} color="#ffffff" />
      <spotLight position={[6, 2, -4]} angle={0.6} penumbra={1} intensity={60} distance={20} color={accent} />
      <Environment key={flavor} resolution={256} frames={1}>
        <color attach="background" args={['#0c1526']} />
        {/* overhead softbox */}
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
        {/* key strip — left */}
        <Lightformer form="rect" intensity={4} position={[-4, 0.5, 3]} rotation-y={Math.PI / 3.2} scale={[0.6, 9, 1]} />
        {/* fill strip — right */}
        <Lightformer form="rect" intensity={1.6} position={[4.5, 0, 2]} rotation-y={-Math.PI / 2.6} scale={[0.35, 9, 1]} />
        {/* front card for logo readability */}
        <Lightformer form="rect" intensity={0.55} position={[0, 0, 6]} scale={[6, 6, 1]} />
        {/* brand-tinted rim from behind */}
        <Lightformer form="rect" intensity={2.4} color={accent} position={[3, 1, -5]} rotation-y={Math.PI * 0.85} scale={[1.2, 8, 1]} />
        <Lightformer form="rect" intensity={1.2} color={accent} position={[-3.5, -1, -4]} rotation-y={Math.PI * 0.2} scale={[0.6, 6, 1]} />
        {/* floor bounce */}
        <Lightformer form="rect" intensity={0.5} position={[0, -5, 1]} rotation-x={-Math.PI / 2} scale={[8, 4, 1]} />
      </Environment>
    </>
  )
}
