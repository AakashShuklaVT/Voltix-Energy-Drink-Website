import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './gsap'
import { motion, prefersReducedMotion } from './store'

let lenis = null

/** Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync. */
export function initSmoothScroll() {
  if (lenis) return lenis
  lenis = new Lenis({
    lerp: prefersReducedMotion ? 1 : 0.095,
    smoothWheel: !prefersReducedMotion,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
  })
  lenis.on('scroll', (event) => {
    // Lenis reports px per frame; the scene expects roughly px per second
    motion.scrollVelocity = event.velocity * 60
    ScrollTrigger.update()
  })
  // GSAP's ticker hands us seconds, Lenis wants milliseconds
  const driveLenis = (time) => lenis.raf(time * 1000)
  gsap.ticker.add(driveLenis)
  gsap.ticker.lagSmoothing(0)
  lenis.stop() // released when the intro finishes
  window.__lenis = lenis
  return lenis
}

export const getLenis = () => lenis

export function scrollToTarget(target, options = {}) {
  // easeOutQuart; falls back to native smooth scrolling if Lenis isn't up yet
  if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...options })
  else document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
}
