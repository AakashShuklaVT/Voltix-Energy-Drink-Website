import { gsap } from '../lib/gsap'
import { motion } from '../lib/store'
import { scrollToTarget } from '../lib/smoothScroll'
import MagneticButton from '../components/MagneticButton'
import { Bolt } from '../components/Nav'

export default function FinalCTA() {
  // Hovering the CTA cracks the can's pull-tab open and releases bubbles
  // (ingredient 3 is the carbonation bubbles)
  const openTab = () => {
    gsap.to(motion, { tabLift: 1, duration: 0.6, ease: 'back.out(2.2)', overwrite: 'auto' })
    gsap.to(motion.ingredients, { 3: 1, duration: 0.6, ease: 'power2.out' })
  }
  const closeTab = () => {
    gsap.to(motion, { tabLift: 0, duration: 0.5, ease: 'power3.inOut', overwrite: 'auto' })
    gsap.to(motion.ingredients, { 3: 0, duration: 0.8, ease: 'power2.inOut' })
  }

  return (
    <section id="buy" className="cta" aria-labelledby="cta-title">
      <div className="cta__word layer-back" aria-hidden="true">
        <span className="display">Experience</span>
        <span className="display cta__word-accent">the energy</span>
      </div>

      <div className="cta__inner layer-front">
        <p className="label label--accent" data-reveal>
          05 — Get charged
        </p>
        <h2 id="cta-title" className="sr-only">
          Experience the energy.
        </h2>
        <p className="cta__copy" data-reveal>
          Electric Citrus is landing in chillers now. Crack one open and feel the difference a clean charge makes.
        </p>
        <div className="cta__actions" data-reveal>
          <MagneticButton href="#buy" onEnter={openTab} onLeave={closeTab} onFocus={openTab} onBlur={closeTab} onClick={(event) => event.preventDefault()}>
            Discover VOLTIX
          </MagneticButton>
          <MagneticButton href="#buy" variant="ghost" onClick={(event) => event.preventDefault()}>
            Find a chiller near you
          </MagneticButton>
        </div>
      </div>

      <footer className="footer layer-front">
        <a
          href="#top"
          className="footer__logo"
          onClick={(event) => {
            event.preventDefault()
            scrollToTarget(0)
          }}
        >
          <Bolt width="12" /> VOLTIX
        </a>
        <p className="label">Sparkling energy · Electric Citrus · 250 ml</p>
        <p className="label footer__fine">
          High caffeine content (32 mg / 250 ml). Not recommended for children, pregnant or lactating women. A concept brand — © 2026.
        </p>
      </footer>
    </section>
  )
}
