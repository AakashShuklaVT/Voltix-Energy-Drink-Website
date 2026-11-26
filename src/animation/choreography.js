import { gsap, ScrollTrigger, SplitText } from '../lib/gsap'
import { motion } from '../lib/store'
import { getLenis } from '../lib/smoothScroll'

/**
 * Scroll choreography for the whole page.
 *
 * The can lives in one fixed WebGL canvas. Each section declares a *keyframe*
 * for it (viewport-relative position, size and rotation) and the can glides
 * between keyframes while the next section scrolls in.
 *
 * Everything that is scrubbed lives in ONE master timeline whose time axis is
 * the page's scroll progress (0 → 1). Section offsets are measured from the
 * DOM and converted to timeline positions. Because a single timeline owns
 * every shared value (can transform, ingredients, particles, panels), any
 * scroll position — even after a jump from the nav — resolves to exactly one
 * deterministic state. No competing ScrollTriggers, no race conditions.
 *
 * "Pinned" sections use CSS `position: sticky` inside tall sections, so the
 * DOM always has its real height and nothing is re-parented.
 */

const TAU = Math.PI * 2

// Feature step rotations: front → back (nutrition panel) → side → front
const FEATURE_ROTATIONS = [0.4, Math.PI, Math.PI + 1.9, TAU + 0.35]

// Same units as `motion.can` in lib/store.js
const KEYFRAMES = {
  desktop: {
    intro: { x: 0.2, y: 1.15, h: 0.8, rotX: 0.5, rotY: -TAU * 1.25, rotZ: 0.6, tilt: 1, visible: 1 },
    hero: { x: 0.2, y: -0.02, h: 0.8, rotX: 0.06, rotY: -0.5, rotZ: 0.17, tilt: 1, visible: 1 },
    showcase: { x: 0, y: -0.015, h: 0.64, rotX: 0, rotY: 0, rotZ: 0, tilt: 0.35, visible: 1 },
    features: { x: -0.2, y: -0.01, h: 0.62, rotX: 0.04, rotY: FEATURE_ROTATIONS[0], rotZ: -0.08, tilt: 0.5, visible: 1 },
    brand: { x: 0, y: 0, h: 0.55, rotX: 0, rotY: TAU + 1.4, rotZ: 0, tilt: 0.2, visible: 1 },
    brandEnd: { x: 0, y: 0, h: 0.55, rotX: 0.2, rotY: TAU * 2.5, rotZ: 0.3, tilt: 0.2, visible: 0 },
    cta: { x: 0, y: 0.05, h: 0.54, rotX: 0.36, rotY: TAU * 3 - 0.35, rotZ: 0.06, tilt: 0.8, visible: 1 },
  },
  mobile: {
    intro: { x: 0, y: -1.1, h: 0.5, rotX: 0.5, rotY: -TAU * 1.25, rotZ: 0.6, tilt: 0.4, visible: 1 },
    hero: { x: 0, y: -0.16, h: 0.5, rotX: 0.05, rotY: -0.5, rotZ: 0.14, tilt: 0.4, visible: 1 },
    showcase: { x: 0, y: 0.0, h: 0.46, rotX: 0, rotY: 0, rotZ: 0, tilt: 0.2, visible: 1 },
    features: { x: 0, y: 0.16, h: 0.4, rotX: 0.04, rotY: FEATURE_ROTATIONS[0], rotZ: -0.06, tilt: 0.2, visible: 1 },
    brand: { x: 0, y: 0, h: 0.55, rotX: 0, rotY: TAU + 1.4, rotZ: 0, tilt: 0.1, visible: 1 },
    brandEnd: { x: 0, y: 0, h: 0.55, rotX: 0.2, rotY: TAU * 2.5, rotZ: 0.3, tilt: 0.1, visible: 0 },
    cta: { x: 0, y: 0.22, h: 0.3, rotX: 0.36, rotY: TAU * 3 - 0.35, rotZ: 0.06, tilt: 0.3, visible: 1 },
  },
}

// Layout modes — keep in sync with the media queries in sections.css.
//  mobile  → portrait phones / narrow windows: single column
//  desktop → everything else; landscape phones get the two-column layout
//  compact → short landscape screens (phones on their side): tighter desktop
export const MOBILE_MQ = '(max-width: 819px) and (orientation: portrait), (max-width: 559px)'
export const DESKTOP_MQ = '(min-width: 820px), (min-width: 560px) and (orientation: landscape)'
export const COMPACT_MQ = '(orientation: landscape) and (max-height: 540px)'

// Short landscape screens: shrink the can where it shares space with UI.
const COMPACT_OVERRIDES = {
  intro: { h: 0.66 },
  hero: { y: -0.07, h: 0.66 },
  showcase: { y: 0.04, h: 0.54 },
  cta: { y: 0.2, h: 0.4 },
}

/** Height of the fixed WebGL canvas (100lvh — it doesn't resize with mobile URL bars). */
function canvasHeight() {
  // lvh can't be read from JS directly, so measure a throwaway element
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;height:100vh;height:100lvh;width:0;visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const height = probe.offsetHeight || window.innerHeight
  probe.remove()
  return height
}

/**
 * Portrait phones vary wildly in aspect ratio, so fixed fractions can't keep the
 * can clear of the copy. Instead, measure the free band each section leaves
 * between its text blocks and fit the can inside it.
 */
function fitMobileKeyframes(baseKeyframes) {
  const canvasH = canvasHeight()
  const keyframes = Object.fromEntries(Object.entries(baseKeyframes).map(([name, frame]) => [name, { ...frame }]))
  const topOf = (el) => el.getBoundingClientRect().top
  const bottomOf = (el) => el.getBoundingClientRect().bottom

  // Band edges are px relative to the frame's top, which is the viewport top
  // when the keyframe is shown (for sticky sections the frame is the pin).
  // Returns the band in px: { center, h, a: top edge, b: bottom edge }.
  const fitInBand = (name, frameSelector, getBandTop, getBandBottom, { minH, maxH, padTop = 0.025, padBottom = 0.025 }) => {
    const frame = document.querySelector(frameSelector)
    if (!frame) return null
    const frameTop = topOf(frame)
    const bandTop = getBandTop(frameTop) - frameTop + padTop * canvasH
    const bandBottom = getBandBottom(frameTop) - frameTop - padBottom * canvasH
    const height = gsap.utils.clamp(minH, maxH, (bandBottom - bandTop) / canvasH)
    const center = (bandTop + bandBottom) / 2
    keyframes[name].h = height
    keyframes[name].y = 0.5 - center / canvasH // y is measured from the canvas centre, upwards
    return { center, h: height * canvasH, a: bandTop, b: bandBottom }
  }
  const query = (selector) => document.querySelector(selector)

  const heroBand = fitInBand('hero', '#top', () => bottomOf(query('.hero__intro')), () => topOf(query('.hero__ctas')), { minH: 0.3, maxH: 0.52, padBottom: 0.035 })
  if (heroBand) {
    // centre the giant background wordmark on the can
    const wordmark = query('.hero__word > span')
    const wordmarkHeight = wordmark ? wordmark.offsetHeight : 0
    query('.hero').style.setProperty('--hero-word-top', `${Math.round(heroBand.center - wordmarkHeight / 2)}px`)
    keyframes.intro.h = keyframes.hero.h
  }
  // ring + glow sit under the can → extra room at the bottom
  fitInBand('showcase', '#product', () => bottomOf(query('.showcase__head')), () => topOf(query('.showcase__angles')), { minH: 0.28, maxH: 0.5, padBottom: 0.06 })
  // ingredients orbit slightly above the can's lid
  fitInBand('features', '.features__pin', () => bottomOf(query('.features__head')), () => topOf(query('.features__panels')), { minH: 0.26, maxH: 0.44, padTop: 0.05 })
  const nav = query('.nav')
  const ctaBand = fitInBand('cta', '#buy', (frameTop) => frameTop + (nav ? nav.offsetHeight : 64), () => topOf(query('.cta__inner')), { minH: 0.26, maxH: 0.42, padBottom: 0.04 })
  if (ctaBand) {
    // CSS uses the band to position the background "Experience the energy" type
    const ctaSection = query('.cta')
    ctaSection.style.setProperty('--cta-band-top', `${Math.round(ctaBand.a)}px`)
    ctaSection.style.setProperty('--cta-band-h', `${Math.round(ctaBand.b - ctaBand.a)}px`)
  }
  return keyframes
}

function resolveKeyframes(conditions) {
  if (conditions.mobile) return fitMobileKeyframes(KEYFRAMES.mobile)
  if (!conditions.compact) return KEYFRAMES.desktop
  const keyframes = Object.fromEntries(Object.entries(KEYFRAMES.desktop).map(([name, frame]) => [name, { ...frame, ...COMPACT_OVERRIDES[name] }]))
  return keyframes
}

let activeKeyframes = null
export const currentKeyframes = () =>
  activeKeyframes ||
  resolveKeyframes({ mobile: window.matchMedia(MOBILE_MQ).matches, compact: window.matchMedia(COMPACT_MQ).matches })

// Spin back to the nearest whole turn so the label faces front again
const resetDrag = () => {
  const nearestTurn = TAU * Math.round(motion.drag.rot / TAU)
  motion.drag.vel = 0
  gsap.to(motion.drag, { rot: nearestTurn, tiltX: 0, duration: 1, ease: 'power3.inOut', overwrite: true })
}

/* ------------------------------------------------------------------ */

/** Page-space offsets (px) of every section, plus the scrollable range. */
function measureLayout() {
  const viewportH = window.innerHeight
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - viewportH)
  const sectionBox = (id) => {
    const el = document.getElementById(id)
    const top = el.getBoundingClientRect().top + window.scrollY
    return { top, h: el.offsetHeight }
  }
  return { H: viewportH, max: maxScroll, hero: sectionBox('top'), showcase: sectionBox('product'), features: sectionBox('ingredients'), brand: sectionBox('energy'), cta: sectionBox('buy') }
}

function buildMasterTimeline(keyframes, scrub) {
  const layout = measureLayout()
  const { H: vh } = layout // one viewport height in px
  const canvasH = canvasHeight()
  const toTime = (px) => Math.max(0, px) / layout.max // scroll px → timeline time

  const master = gsap.timeline({ defaults: { ease: 'none', immediateRender: false } })
  // Adds a fromTo that plays while the page scrolls from startPx to startPx + lengthPx
  const scrubFromTo = (targets, from, to, startPx, lengthPx) => master.fromTo(targets, from, { ...to, duration: toTime(lengthPx) }, toTime(startPx))

  /* 01 Hero → 02 Showcase */
  scrubFromTo('.hero__word', { yPercent: 0, scale: 1, opacity: 1 }, { yPercent: -35, scale: 0.92, opacity: 0.2 }, 0, layout.hero.h)
  scrubFromTo('.hero__grid', { yPercent: 0, opacity: 1 }, { yPercent: -12, opacity: 0 }, 0.3 * vh, 0.55 * vh)
  scrubFromTo(motion.can, { ...keyframes.hero }, { ...keyframes.showcase, ease: 'power1.inOut' }, layout.showcase.top - vh + 2, vh - 2)
  scrubFromTo(motion, { ring: 0 }, { ring: 1 }, layout.showcase.top - 0.4 * vh, 0.4 * vh)

  /* 02 Showcase → 03 Features */
  const featuresEnter = layout.features.top - vh // the moment the section's top enters the viewport
  const firstPanel = '.feature[data-index="0"]'
  scrubFromTo(motion.can, { ...keyframes.showcase }, { ...keyframes.features, ease: 'power1.inOut' }, featuresEnter, vh)
  scrubFromTo(motion, { ring: 1 }, { ring: 0 }, featuresEnter, 0.3 * vh)
  scrubFromTo(motion.ingredients, { 0: 0 }, { 0: 1 }, featuresEnter + 0.6 * vh, 0.4 * vh)
  scrubFromTo(`${firstPanel} .feature__line`, { yPercent: 110 }, { yPercent: 0, ease: 'power3.out', stagger: toTime(0.06 * vh) }, featuresEnter + 0.62 * vh, 0.3 * vh)
  scrubFromTo(`${firstPanel} .feature__kicker, ${firstPanel} .feature__body, ${firstPanel} .feature__stat`, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: toTime(0.05 * vh) }, featuresEnter + 0.7 * vh, 0.3 * vh)

  /* 03 Features — 4 sticky steps */
  const panels = gsap.utils.toArray('.feature')
  const bars = gsap.utils.toArray('.features__bar')
  const featureStepPx = (layout.features.h - vh) / (panels.length + 0.3) // px per step
  const featureStepAt = (step) => layout.features.top + step * featureStepPx
  panels.forEach((panel, i) => {
    scrubFromTo(bars[i], { scaleX: 0 }, { scaleX: 1 }, featureStepAt(i), featureStepPx)
    // count the stat up from 0 as its panel arrives
    const statValue = panel.querySelector('.feature__stat-value')
    const counter = { v: 0 }
    scrubFromTo(counter, { v: 0 }, { v: Number(statValue.dataset.value), ease: 'power2.out', onUpdate: () => (statValue.textContent = Math.round(counter.v)) }, featureStepAt(i === 0 ? -0.3 : i - 0.05), featureStepPx * 0.5)
    if (i === 0) return // the first panel's entrance is handled above
    const prevPanel = panels[i - 1]
    const step = i
    // previous panel + ingredient out, can turns, next panel + ingredient in
    scrubFromTo(prevPanel.querySelectorAll('.feature__line'), { yPercent: 0 }, { yPercent: -110, ease: 'power2.in', stagger: toTime(0.04 * featureStepPx) }, featureStepAt(step - 0.15), 0.3 * featureStepPx)
    scrubFromTo(prevPanel.querySelectorAll('.feature__kicker, .feature__body, .feature__stat'), { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -20 }, featureStepAt(step - 0.15), 0.25 * featureStepPx)
    scrubFromTo(motion.ingredients, { [i - 1]: 1 }, { [i - 1]: 0 }, featureStepAt(step - 0.15), 0.3 * featureStepPx)
    scrubFromTo(motion.can, { rotY: FEATURE_ROTATIONS[i - 1] }, { rotY: FEATURE_ROTATIONS[i], ease: 'power2.inOut' }, featureStepAt(step - 0.2), 0.8 * featureStepPx)
    scrubFromTo(panel.querySelectorAll('.feature__line'), { yPercent: 110 }, { yPercent: 0, ease: 'power3.out', stagger: toTime(0.05 * featureStepPx) }, featureStepAt(step + 0.15), 0.35 * featureStepPx)
    scrubFromTo(panel.querySelectorAll('.feature__kicker, .feature__body, .feature__stat'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: toTime(0.05 * featureStepPx) }, featureStepAt(step + 0.2), 0.3 * featureStepPx)
    scrubFromTo(motion.ingredients, { [i]: 0 }, { [i]: 1 }, featureStepAt(step + 0.15), 0.4 * featureStepPx)
  })

  /* 03 Features → 04 Brand */
  const brandEnter = layout.brand.top - vh
  scrubFromTo(motion.can, { ...keyframes.features, rotY: FEATURE_ROTATIONS[3] }, { ...keyframes.brand, ease: 'power1.inOut' }, brandEnter, vh)
  scrubFromTo(motion.ingredients, { 3: 1 }, { 3: 0 }, brandEnter, 0.4 * vh)

  /* 04 Brand — can bursts into particles: can → storm → bolt → wordmark */
  const brandStepPx = (layout.brand.h - vh) / 4.6
  const brandStepAt = (step) => layout.brand.top + step * brandStepPx
  scrubFromTo(motion.can, { ...keyframes.brand }, { ...keyframes.brandEnd, ease: 'power2.in' }, brandStepAt(0), 0.7 * brandStepPx)
  scrubFromTo(motion.energy, { opacity: 0 }, { opacity: 1 }, brandStepAt(0.15), 0.3 * brandStepPx)
  scrubFromTo(motion.energy, { morph: 0 }, { morph: 1, ease: 'power1.inOut' }, brandStepAt(0.5), 1.1 * brandStepPx)
  scrubFromTo(motion.energy, { morph: 1 }, { morph: 2, ease: 'power1.inOut' }, brandStepAt(1.9), 1.0 * brandStepPx)
  scrubFromTo(motion.energy, { morph: 2 }, { morph: 3, ease: 'power1.inOut' }, brandStepAt(3.1), 1.0 * brandStepPx)
  // [in, out] step for each headline; the last one stays on screen
  const headlineWindows = [
    [0.55, 1.75],
    [2.0, 2.95],
    [3.25, null],
  ]
  gsap.utils.toArray('.brand__line').forEach((line, i) => {
    const words = line.querySelectorAll('.brand__word')
    const [inAt, outAt] = headlineWindows[i]
    scrubFromTo(words, { yPercent: 110 }, { yPercent: 0, ease: 'power3.out', stagger: toTime(0.08 * brandStepPx) }, brandStepAt(inAt), 0.35 * brandStepPx)
    if (outAt) scrubFromTo(words, { yPercent: 0 }, { yPercent: -110, ease: 'power2.in', stagger: toTime(0.05 * brandStepPx) }, brandStepAt(outAt), 0.3 * brandStepPx)
  })

  /* 04 Brand → 05 CTA — the can re-materialises */
  const ctaEnter = layout.cta.top - vh
  scrubFromTo(motion.energy, { opacity: 1 }, { opacity: 0 }, ctaEnter, 0.45 * vh)
  scrubFromTo(motion.can, { ...keyframes.brandEnd }, { ...keyframes.cta, ease: 'power2.out' }, ctaEnter + 0.12 * vh, 0.78 * vh)
  scrubFromTo(motion, { ring: 0 }, { ring: 0.7 }, ctaEnter + 0.6 * vh, 0.3 * vh)
  scrubFromTo('.cta__word span', { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'power2.out', stagger: toTime(0.08 * vh) }, ctaEnter + 0.25 * vh, 0.5 * vh)

  // Any scroll left after the CTA reaches the top (e.g. the footer on phones)
  // carries the can up with the content, so it reads as part of the page.
  const scrollTail = layout.max - layout.cta.top
  if (scrollTail > 4) scrubFromTo(motion.can, { y: keyframes.cta.y }, { y: keyframes.cta.y + scrollTail / canvasH }, layout.cta.top, scrollTail)

  // pad the timeline so its duration is exactly 1 (= full scroll range)
  master.set({}, {}, 1)

  ScrollTrigger.create({
    animation: master,
    start: 0,
    end: 'max',
    scrub,
  })
}

// Hide everything the master timeline reveals, so nothing flashes before it scrubs in
function setInitialStates() {
  gsap.set('.feature__line, .brand__word', { yPercent: 110 })
  gsap.set('.feature__kicker, .feature__body, .feature__stat', { autoAlpha: 0, y: 24 })
  gsap.set('.features__bar', { scaleX: 0, transformOrigin: 'left center' })
}

function createSectionTriggers() {
  // drag rotation snaps home whenever the can leaves the showcase
  ScrollTrigger.create({ trigger: '#product', start: 'top bottom', end: 'bottom top', onLeave: resetDrag, onLeaveBack: resetDrag })

  // step counter (01 / 04)
  const stepCounter = document.querySelector('.features__counter-current')
  ScrollTrigger.create({
    trigger: '#ingredients',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      // 4.3 matches the (panels + 0.3) step spacing in the master timeline
      const step = Math.min(3, Math.floor(self.progress * 4.3))
      if (stepCounter) stepCounter.textContent = String(step + 1).padStart(2, '0')
    },
  })

  // charge meter
  const meter = document.querySelector('.brand__meter-value')
  ScrollTrigger.create({
    trigger: '#energy',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => meter && (meter.textContent = String(Math.round(self.progress * 100)).padStart(3, '0')),
  })
}

/**
 * Endless marquee. Scroll velocity pushes it faster (and in the scroll
 * direction). Driven from the ticker with frame-rate independent damping —
 * firing a pair of tweens on every scroll update made the speed stutter.
 * Returns a cleanup function.
 */
function startMarquee() {
  const track = document.querySelector('.brand__marquee-track')
  if (!track) return () => {}
  const setX = gsap.quickSetter(track, 'xPercent')
  const PERIOD = 28 // seconds per loop at rest
  let loopProgress = 0 // 0..1 through one loop
  let speed = 1 // current multiplier
  let boost = 0 // target extra speed from scrolling
  let isActive = false

  const trigger = ScrollTrigger.create({
    trigger: '#energy',
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (isActive = self.isActive),
    onUpdate: (self) => (boost = gsap.utils.clamp(-6, 6, self.getVelocity() / 260)),
  })
  const tick = (_, deltaMs) => {
    if (!isActive) return
    const deltaSeconds = Math.min(deltaMs, 100) / 1000
    boost *= Math.exp(-2.5 * deltaSeconds) // velocity bursts fade out
    speed += (1 + boost - speed) * (1 - Math.exp(-6 * deltaSeconds))
    // wrap into 0..1 (also when scrolling up drives the speed negative)
    loopProgress = (((loopProgress + (speed * deltaSeconds) / PERIOD) % 1) + 1) % 1
    // the track holds two copies of the words, so half its width is one loop
    setX(-50 * loopProgress)
  }
  gsap.ticker.add(tick)
  return () => {
    gsap.ticker.remove(tick)
    trigger.kill()
  }
}

function setupReveals() {
  // generic fade-up reveals (fire once)
  gsap.set('[data-reveal]', { autoAlpha: 0 })
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 98%', // controls can sit at the very bottom of a 100svh section
    once: true,
    onEnter: (elements) => gsap.fromTo(elements, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power4.out', stagger: 0.07 }),
  })

  // masked line reveals for headings
  gsap.utils.toArray('[data-split]').forEach((heading) => {
    const split = SplitText.create(heading, { type: 'lines', mask: 'lines' })
    gsap.from(split.lines, {
      yPercent: 110,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.09,
      scrollTrigger: { trigger: heading, start: 'top 85%', once: true },
    })
  })
}

/** Builds every scroll animation. Returns the gsap.matchMedia so callers can revert. */
export function buildChoreography() {
  const media = gsap.matchMedia()
  media.add({ mobile: MOBILE_MQ, desktop: DESKTOP_MQ, compact: COMPACT_MQ, touch: '(pointer: coarse)' }, (context) => {
    const keyframes = resolveKeyframes(context.conditions)
    activeKeyframes = keyframes
    setInitialStates()
    // Desktop already gets Lenis smoothing, so the scrub only needs to soften
    // a little. Touch scrolls natively, so the scrub does more of the work.
    buildMasterTimeline(keyframes, context.conditions.touch ? 1.1 : 0.75)
    createSectionTriggers()
    const stopMarquee = startMarquee()
    setupReveals()
    return () => {
      stopMarquee()
      activeKeyframes = null
    }
  })
  return media
}

/** Hero entrance — plays once the loader lifts. */
export function playIntro() {
  const keyframes = currentKeyframes()
  const lenis = getLenis()
  const wordmark = SplitText.create('.hero__word-fill, .hero__word-outline', { type: 'chars' })

  return gsap
    .timeline({ defaults: { ease: 'power4.out' } })
    .fromTo(motion.can, { ...keyframes.intro }, { ...keyframes.hero, duration: 2.4, ease: 'expo.out' }, 0)
    .from(wordmark.chars, { yPercent: 105, opacity: 0, duration: 1.4, stagger: { each: 0.045, from: 'center' } }, 0.15)
    .from('.hero__line', { yPercent: 110, duration: 1.2, stagger: 0.1 }, 0.45)
    .from('[data-intro]', { autoAlpha: 0, y: 26, duration: 1, stagger: 0.07 }, 0.75)
    .from('.nav > *', { y: -30, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.8)
    // scrolling stays locked until the hero has mostly settled
    .add(() => lenis?.start(), 1.1)
}
