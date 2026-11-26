import { create } from 'zustand'

/**
 * Two kinds of state live here:
 *
 * 1. `motion` — a plain mutable object. GSAP tweens it and the R3F render loop
 *    reads it every frame. Nothing here triggers React renders, which keeps the
 *    scroll choreography at 60fps.
 *
 * 2. `useUI` — a tiny zustand store for state the React tree must react to
 *    (selected flavour, loader status, chilled toggle…).
 */
export const motion = {
  // Can transform in *viewport-relative* units:
  //  x, y  → fraction of the viewport width / height (0 = centre)
  //  h     → can height as a fraction of the viewport height
  can: { x: 0.2, y: 1.2, h: 0.78, rotX: 0, rotY: -6, rotZ: 0.14, spin: 0, visible: 1, tilt: 1 },
  pointer: { x: 0, y: 0, active: false }, // active = a real mouse is over the page
  // User drag rotation (showcase section)
  drag: { rot: 0, vel: 0, tiltX: 0, active: false },
  condensation: 1,
  tabLift: 0,
  ring: 0, // glowing pedestal under the can
  energy: { morph: 0, opacity: 0 }, // particle field in the brand section
  ingredients: { 0: 0, 1: 0, 2: 0, 3: 0 }, // per ingredient: 0 → hidden, 1 → shown (object, not array: GSAP treats arrays as target lists)
  scrollVelocity: 0,
}

export const useUI = create((set) => ({
  flavor: 'citrus',
  setFlavor: (flavor) => set({ flavor }),
  chilled: true,
  setChilled: (chilled) => set({ chilled }),
  sceneReady: false,
  setSceneReady: () => set({ sceneReady: true }),
}))

export const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
export const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const isSmallScreen = () => typeof window !== 'undefined' && window.innerWidth < 820
// handy for debugging in dev tools
if (import.meta.env.DEV) window.__motion = motion
