import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)
gsap.defaults({ ease: 'power3.out', duration: 0.8 })
// Mobile URL bars resize the viewport while scrolling; re-measuring every
// trigger then causes a visible jump. Layout uses svh/lvh, so skip it.
ScrollTrigger.config({ ignoreMobileResize: true })
// handy for debugging in dev tools
if (import.meta.env.DEV) Object.assign(window, { __ST: ScrollTrigger, __gsap: gsap })

export { gsap, ScrollTrigger, SplitText, useGSAP }
