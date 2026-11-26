import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap'
import { isTouch } from '../lib/store'

const Arrow = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M1 11 11 1M11 1H3.5M11 1v7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Button that is pulled toward the pointer (desktop only). */
export default function MagneticButton({ children, variant = 'primary', strength = 0.35, className = '', onEnter, onLeave, ...props }) {
  const buttonRef = useRef()

  useEffect(() => {
    if (isTouch) return
    const el = buttonRef.current
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
    // offset from the button's centre, scaled down by `strength`
    const handlePointerMove = (event) => {
      const rect = el.getBoundingClientRect()
      xTo((event.clientX - (rect.left + rect.width / 2)) * strength)
      yTo((event.clientY - (rect.top + rect.height / 2)) * strength)
    }
    const handlePointerLeave = () => {
      xTo(0)
      yTo(0)
    }
    el.addEventListener('pointermove', handlePointerMove)
    el.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      el.removeEventListener('pointermove', handlePointerMove)
      el.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [strength])

  return (
    <a ref={buttonRef} className={`btn btn--${variant} ${className}`} onPointerEnter={onEnter} onPointerLeave={onLeave} {...props}>
      <span>{children}</span>
      <span className="btn__icon">
        <Arrow />
      </span>
    </a>
  )
}
