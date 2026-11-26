import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap'
import { isTouch } from '../lib/store'

/**
 * Two-part cursor: a precise dot and a lagging ring. Elements can request a
 * state with `data-cursor="drag" | "link"`.
 */
export default function Cursor() {
  const rootRef = useRef()
  const dotRef = useRef()
  const ringRef = useRef()

  useEffect(() => {
    if (isTouch) return
    // the dot follows almost instantly, the ring trails behind it
    const moveDotX = gsap.quickTo(dotRef.current, 'x', { duration: 0.08, ease: 'power3' })
    const moveDotY = gsap.quickTo(dotRef.current, 'y', { duration: 0.08, ease: 'power3' })
    const moveRingX = gsap.quickTo(ringRef.current, 'x', { duration: 0.45, ease: 'power3' })
    const moveRingY = gsap.quickTo(ringRef.current, 'y', { duration: 0.45, ease: 'power3' })

    const handlePointerMove = (event) => {
      moveDotX(event.clientX); moveDotY(event.clientY); moveRingX(event.clientX); moveRingY(event.clientY)
      // anything clickable gets the "link" state unless it asks for something else
      const hoverTarget = event.target.closest?.('[data-cursor], a, button')
      const cursorMode = hoverTarget?.dataset.cursor || (hoverTarget ? 'link' : '')
      rootRef.current.classList.toggle('is-drag', cursorMode === 'drag')
      rootRef.current.classList.toggle('is-link', cursorMode === 'link')
    }
    const hide = () => gsap.to(rootRef.current, { autoAlpha: 0, duration: 0.3 })
    const show = () => gsap.to(rootRef.current, { autoAlpha: 1, duration: 0.3 })
    window.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('mouseleave', hide)
    document.addEventListener('mouseenter', show)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('mouseleave', hide)
      document.removeEventListener('mouseenter', show)
    }
  }, [])

  if (isTouch) return null
  return (
    <div className="cursor" ref={rootRef} aria-hidden="true">
      <div className="cursor__ring" ref={ringRef}>
        <span className="cursor__label">DRAG</span>
      </div>
      <div className="cursor__dot" ref={dotRef} />
    </div>
  )
}
