import { useEffect, useRef, useState } from 'react'
import { gsap } from '../lib/gsap'
import { motion, useUI } from '../lib/store'
import { FLAVOR_LIST, FLAVORS } from '../lib/flavors'

// Reference product shots (from /design/reference → optimised WebP) used as
// angle presets. Clicking one rotates the live 3D can to the same view.
// rot / tilt are radians around Y / X.
const ANGLES = [
  { id: 'front', label: 'Front', rot: 0, tilt: 0 },
  { id: 'three-quarter', label: '¾ View', rot: -0.62, tilt: 0.12 },
  { id: 'side', label: 'Side', rot: -Math.PI / 2, tilt: 0 },
  { id: 'back', label: 'Back', rot: Math.PI, tilt: 0 },
  { id: 'top', label: 'Top', rot: -0.35, tilt: 0.78 },
]

const SPECS = [
  ['Volume', '250 ml'],
  ['Diameter', '53 mm'],
  ['Height', '134 mm'],
  ['Recyclable', '100% Al'],
]

const TAU = Math.PI * 2

export default function Showcase() {
  const stageRef = useRef()
  const [activeAngle, setActiveAngle] = useState('front')
  const flavor = useUI((state) => state.flavor)
  const setFlavor = useUI((state) => state.setFlavor)
  const chilled = useUI((state) => state.chilled)
  const setChilled = useUI((state) => state.setChilled)

  // drag-to-rotate with inertia (horizontal only so vertical touch still scrolls)
  useEffect(() => {
    const stage = stageRef.current
    let lastX = 0
    let lastY = 0
    let lastTime = 0
    let isDragging = false
    const handlePointerDown = (event) => {
      isDragging = true
      lastX = event.clientX
      lastY = event.clientY
      lastTime = event.timeStamp
      motion.drag.active = true
      motion.drag.vel = 0
      gsap.killTweensOf(motion.drag)
      stage.setPointerCapture?.(event.pointerId)
    }
    const handlePointerMove = (event) => {
      if (!isDragging) return
      const deltaX = event.clientX - lastX
      const deltaY = event.clientY - lastY
      const deltaSeconds = Math.max(1, event.timeStamp - lastTime) / 1000
      lastX = event.clientX
      lastY = event.clientY
      lastTime = event.timeStamp
      const rotationDelta = deltaX * 0.0085 // px → radians
      motion.drag.rot += rotationDelta
      // release velocity in rad/s, smoothed so one jittery event can't fling the can
      const velocity = gsap.utils.clamp(-18, 18, rotationDelta / deltaSeconds)
      motion.drag.vel += (velocity - motion.drag.vel) * 0.5
      motion.drag.tiltX = gsap.utils.clamp(-0.25, 0.9, motion.drag.tiltX + deltaY * 0.004)
    }
    const handlePointerUp = (event) => {
      if (!isDragging) return
      isDragging = false
      // finger/mouse held still before letting go → no fling
      if (event.timeStamp - lastTime > 90) motion.drag.vel = 0
      motion.drag.active = false
      setActiveAngle('')
    }
    stage.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      stage.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [])

  const goToAngle = (preset) => {
    setActiveAngle(preset.id)
    const currentRot = motion.drag.rot
    // shortest way round to the target angle
    const targetRot = preset.rot + TAU * Math.round((currentRot - preset.rot) / TAU)
    motion.drag.vel = 0
    gsap.to(motion.drag, { rot: targetRot, tiltX: preset.tilt, duration: 1.4, ease: 'power3.inOut', overwrite: true })
  }

  const changeFlavor = (id) => {
    if (id === flavor) return
    const nextFlavor = FLAVORS[id]
    motion.drag.vel = 0
    // spin the can a full turn and swap the label at the fastest point
    gsap.to(motion.drag, { rot: `+=${TAU}`, duration: 1.2, ease: 'power3.inOut', overwrite: true })
    gsap.delayedCall(0.5, () => setFlavor(id))
    // the page accent colour follows the flavour
    gsap.to(document.documentElement, {
      '--accent': nextFlavor.accent,
      '--accent-deep': nextFlavor.accentDeep,
      duration: 0.9,
      ease: 'power2.inOut',
    })
  }

  const toggleChill = () => {
    const nextChilled = !chilled
    setChilled(nextChilled)
    gsap.to(motion, { condensation: nextChilled ? 1 : 0, duration: 1.2, ease: 'power2.inOut' })
  }

  return (
    <section id="product" className="showcase" aria-labelledby="showcase-title">
      <div className="showcase__stage" ref={stageRef} data-cursor="drag" aria-hidden="true" />

      <header className="showcase__head layer-front">
        <p className="label label--accent" data-reveal>02 — Product</p>
        <h2 id="showcase-title" className="h2" data-split>
          Every angle,
          <br />
          engineered.
        </h2>
        <p className="showcase__copy" data-reveal>
          A slim 250&nbsp;ml can with a satin-metallic finish, wet with condensation. Drag it, spin it, flip it — it’s all real-time 3D.
        </p>
      </header>

      <dl className="showcase__specs layer-front">
        {SPECS.map(([label, value]) => (
          <div key={label} data-reveal>
            <dt className="label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="showcase__angles layer-front" role="group" aria-label="View the can from a preset angle">
        <p className="label" data-reveal>Reference angles</p>
        <ul>
          {ANGLES.map((preset) => (
            <li key={preset.id} data-reveal>
              <button
                type="button"
                className={`angle ${activeAngle === preset.id ? 'is-active' : ''}`}
                onClick={() => goToAngle(preset)}
                aria-pressed={activeAngle === preset.id}
              >
                <img src={`/images/angles/${preset.id}.webp`} alt="" width="72" height="180" loading="lazy" decoding="async" />
                <span>{preset.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="showcase__controls layer-front">
        <div className="flavors" role="radiogroup" aria-label="Flavour" data-reveal>
          {FLAVOR_LIST.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={flavor === option.id}
              className={`flavor ${flavor === option.id ? 'is-active' : ''}`}
              style={{ '--swatch': option.accent, '--swatch-base': option.base }}
              onClick={() => changeFlavor(option.id)}
            >
              <span className="flavor__dot" />
              <span className="flavor__name">{option.name}</span>
            </button>
          ))}
        </div>
        <button type="button" className={`chill ${chilled ? 'is-on' : ''}`} onClick={toggleChill} aria-pressed={chilled} data-reveal>
          <span className="chill__track">
            <span className="chill__thumb" />
          </span>
          Ice-cold condensation
        </button>
      </div>

      <p className="showcase__hint label layer-front" aria-hidden="true">
        <span>←</span> Drag to rotate 360° <span>→</span>
      </p>
    </section>
  )
}
