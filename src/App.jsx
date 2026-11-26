import { lazy, Suspense, useCallback, useEffect } from 'react'
import { ScrollTrigger, useGSAP } from './lib/gsap'
import { initSmoothScroll } from './lib/smoothScroll'
import { isTouch, motion } from './lib/store'
import { buildChoreography, playIntro } from './animation/choreography'

import Loader from './components/Loader'
import Cursor from './components/Cursor'
import Nav from './components/Nav'
import Hero from './sections/Hero'
import Showcase from './sections/Showcase'
import Features from './sections/Features'
import BrandExperience from './sections/BrandExperience'
import FinalCTA from './sections/FinalCTA'

// three.js + R3F are split into their own chunk so the DOM paints immediately
const Experience = lazy(() => import('./three/Experience'))

export default function App() {
  useEffect(() => {
    // always start the intro from the top, even after a reload mid-page
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    initSmoothScroll()

    // pointer in normalised device coords (-1..1, y up) for the 3D scene
    const handlePointerMove = (event) => {
      motion.pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      motion.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
      motion.pointer.active = event.pointerType === 'mouse'
    }
    const handlePointerLeave = () => (motion.pointer.active = false)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [])

  // All scroll-driven animation is built once the DOM exists. The master
  // timeline maps measured section offsets (and, on phones, measured gaps
  // between text blocks) → scroll progress, so rebuild it when the layout
  // changes. On touch devices height-only changes are the URL bar showing /
  // hiding — sections are sized in svh and the canvas in lvh, so those are
  // ignored to avoid a mid-scroll jump.
  useGSAP(() => {
    let choreography = buildChoreography()
    let isMounted = true
    let lastWidth = window.innerWidth
    let lastHeight = window.innerHeight
    let resizeTimer
    const rebuild = () => {
      lastWidth = window.innerWidth
      lastHeight = window.innerHeight
      choreography.revert()
      choreography = buildChoreography()
      ScrollTrigger.refresh()
    }
    // web fonts change line heights → re-measure once they're in
    document.fonts?.ready.then(() => isMounted && rebuild())
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const widthChange = Math.abs(window.innerWidth - lastWidth)
        const heightChange = Math.abs(window.innerHeight - lastHeight)
        if (widthChange >= 2 || (!isTouch && heightChange >= 2)) rebuild()
      }, 250)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      isMounted = false
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
      choreography.revert()
    }
  }, [])

  const handleReveal = useCallback(() => {
    ScrollTrigger.refresh()
    playIntro()
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
      <Loader onReveal={handleReveal} />
      <Cursor />
      <Nav />
      <main>
        <Hero />
        <Showcase />
        <Features />
        <BrandExperience />
        <FinalCTA />
      </main>
    </>
  )
}
