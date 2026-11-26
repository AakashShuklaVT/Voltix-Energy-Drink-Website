import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '../lib/gsap'
import { useUI } from '../lib/store'

/**
 * Charge-up loader. Counts to ~86% on a timer, waits for the WebGL scene to
 * compile (label textures + shaders), then completes and lifts like a shutter.
 */
export default function Loader({ onReveal }) {
  const rootRef = useRef()
  const countRef = useRef()
  const sceneReady = useUI((state) => state.sceneReady)
  const [countUpDone, setCountUpDone] = useState(false)
  const progressRef = useRef({ v: 0 }) // tweened by GSAP, written straight to the DOM
  const [isGone, setIsGone] = useState(false)

  const renderCount = () => {
    if (countRef.current) countRef.current.textContent = String(Math.round(progressRef.current.v)).padStart(2, '0')
  }

  // Phase 1: fake progress up to 86% while the scene loads in the background
  useGSAP(
    () => {
      gsap.from('.loader__brand span', { yPercent: 110, duration: 1, stagger: 0.06, ease: 'power4.out' })
      gsap.to(progressRef.current, { v: 86, duration: 1.6, ease: 'power2.inOut', onUpdate: renderCount, onComplete: () => setCountUpDone(true) })
      gsap.to('.loader__bar', { scaleX: 0.86, duration: 1.6, ease: 'power2.inOut' })
    },
    { scope: rootRef },
  )

  // Phase 2: only once both the count-up and the scene are done, finish and lift
  useEffect(() => {
    if (!countUpDone || !sceneReady) return
    const outro = gsap.timeline({ onComplete: () => setIsGone(true) })
    outro.to(progressRef.current, { v: 100, duration: 0.5, ease: 'power2.out', onUpdate: renderCount })
      .to('.loader__bar', { scaleX: 1, duration: 0.5, ease: 'power2.out' }, '<')
      .to('.loader__brand span', { yPercent: -110, duration: 0.6, stagger: 0.04, ease: 'power3.in' }, '+=0.1')
      .add(() => onReveal?.(), '-=0.15')
      .to(rootRef.current, { clipPath: 'inset(0 0 100% 0)', duration: 1.05, ease: 'power4.inOut' }, '-=0.25')
    return () => outro.kill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countUpDone, sceneReady])

  if (isGone) return null
  return (
    <div className="loader" ref={rootRef} style={{ clipPath: 'inset(0 0 0% 0)' }} role="status" aria-label="Loading VOLTIX experience">
      <div className="loader__brand display" aria-hidden="true">
        {'VOLTIX'.split('').map((letter, index) => (
          <span key={index}>{letter}</span>
        ))}
      </div>
      <div className="loader__foot">
        <p className="label">
          Charging
          <br />
          Electric Citrus — 250 ml
        </p>
        <span className="loader__count">
          <span ref={countRef}>00</span>
          <span className="accent">%</span>
        </span>
      </div>
      <div className="loader__bar" />
    </div>
  )
}
