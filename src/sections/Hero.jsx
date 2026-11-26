import { scrollToTarget } from '../lib/smoothScroll'
import MagneticButton from '../components/MagneticButton'
import { Bolt } from '../components/Nav'

// [value, unit, label]
const STATS = [
  ['32', 'mg', 'Natural caffeine'],
  ['110', 'kcal', 'Per 250 ml can'],
  ['B3·B6·B12', '', '100% RDA vitamins'],
]

export default function Hero() {
  const scrollOnClick = (target) => (event) => {
    event.preventDefault()
    scrollToTarget(target)
  }

  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      {/* Giant wordmark rendered BEHIND the WebGL canvas */}
      <div className="hero__word layer-back" aria-hidden="true">
        <span className="hero__word-fill display">VOLTIX</span>
        <span className="hero__word-outline display">VOLTIX</span>
      </div>

      <div className="hero__grid layer-front">
        <p className="hero__eyebrow label label--accent" data-intro>
          <Bolt width="9" /> Sparkling energy · Electric Citrus
        </p>

        <h1 id="hero-title" className="hero__title display">
          <span className="split-line"><span className="hero__line">Bottled</span></span>
          <span className="split-line"><span className="hero__line accent">lightning.</span></span>
        </h1>

        <div className="hero__intro">
          <p className="lede" data-intro>
            32&nbsp;mg of clean caffeine, B‑vitamins and real citrus — sealed in ice‑cold aluminium and charged with fine‑bead carbonation.
          </p>
          <div className="hero__ctas" data-intro>
            <MagneticButton href="#buy" onClick={scrollOnClick('#buy')}>Get charged</MagneticButton>
            <MagneticButton href="#product" variant="ghost" onClick={scrollOnClick('#product')}>
              Explore the can
            </MagneticButton>
          </div>
        </div>

        <ul className="hero__stats" aria-label="Key facts">
          {STATS.map(([value, unit, label]) => (
            <li key={label} data-intro>
              <span className="hero__stat-value">
                {value}
                {unit && <small>{unit}</small>}
              </span>
              <span className="label">{label}</span>
            </li>
          ))}
        </ul>

        <div className="hero__scroll label" data-intro aria-hidden="true">
          <span className="hero__scroll-line" />
          Scroll to charge
        </div>
      </div>
    </section>
  )
}
