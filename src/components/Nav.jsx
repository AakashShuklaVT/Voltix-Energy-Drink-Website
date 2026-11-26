import { useEffect, useRef, useState } from 'react'
import { ScrollTrigger } from '../lib/gsap'
import { scrollToTarget } from '../lib/smoothScroll'
import MagneticButton from './MagneticButton'

// [section selector, label]
const NAV_LINKS = [
  ['#product', 'Product'],
  ['#ingredients', 'Ingredients'],
  ['#energy', 'Energy'],
  ['#buy', 'Buy'],
]

export const Bolt = (props) => (
  <svg viewBox="0 0 16 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M10 0 1 13.5h5.5L4.5 24 15 9.5H9.4L10 0Z" />
  </svg>
)

export default function Nav() {
  const headerRef = useRef()
  const [activeLink, setActiveLink] = useState('')

  useEffect(() => {
    // hide on scroll down, show on scroll up
    const autoHide = ScrollTrigger.create({
      start: 120,
      end: 'max',
      onUpdate: (self) => headerRef.current?.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 200),
    })
    // highlight the link for whichever section crosses the middle of the screen
    const sectionTriggers = NAV_LINKS.map(([selector]) =>
      ScrollTrigger.create({
        trigger: selector,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => self.isActive && setActiveLink(selector),
        onLeaveBack: () => selector === '#product' && setActiveLink(''),
      }),
    )
    return () => [autoHide, ...sectionTriggers].forEach((trigger) => trigger.kill())
  }, [])

  const handleNavClick = (event, target) => {
    event.preventDefault()
    scrollToTarget(target)
  }

  return (
    <header className="nav" ref={headerRef}>
      <a href="#top" className="nav__logo" onClick={(event) => handleNavClick(event, 0)} aria-label="VOLTIX — back to top">
        <Bolt />
        VOLTIX
      </a>
      <nav className="nav__links" aria-label="Sections">
        {NAV_LINKS.map(([selector, label]) => (
          <a key={selector} href={selector} className={activeLink === selector ? 'is-active' : ''} onClick={(event) => handleNavClick(event, selector)}>
            {label}
          </a>
        ))}
      </nav>
      <MagneticButton href="#buy" onClick={(event) => handleNavClick(event, '#buy')} strength={0.2}>
        Get charged
      </MagneticButton>
    </header>
  )
}
