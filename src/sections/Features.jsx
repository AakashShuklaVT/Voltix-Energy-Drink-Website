export const FEATURES = [
  {
    id: 'caffeine',
    kicker: 'Clean caffeine',
    title: ['32 mg.', 'Zero crash.'],
    body: 'A measured lift from natural caffeine — enough to sharpen focus for the long haul, never enough to rattle you.',
    stat: '32',
    unit: 'mg / can',
  },
  {
    id: 'vitamins',
    kicker: 'B-vitamin complex',
    title: ['B3 · B6 · B12', 'at 100% RDA.'],
    body: 'The vitamins your body uses to turn food into usable energy. Turn the can — every number is printed on the back.',
    stat: '100',
    unit: '% daily value',
  },
  {
    id: 'citrus',
    kicker: 'Real citrus',
    title: ['Lime. Yuzu.', 'Lemon zest.'],
    body: 'Sharp, bright and genuinely citrus — natural flavours with zero artificial colours. Tastes like a voltage spike feels.',
    stat: '0',
    unit: 'artificial colours',
  },
  {
    id: 'sparkle',
    kicker: 'Fine-bead carbonation',
    title: ['Ice-cold', 'micro-bubbles.'],
    body: 'Tight, persistent bubbles that hit crisp and finish clean. Best served at 4 °C, straight from the can.',
    stat: '110',
    unit: 'kcal / 250 ml',
  },
]

export default function Features() {
  return (
    <section id="ingredients" className="features" aria-labelledby="features-title">
      <div className="features__pin">
        <header className="features__head layer-front">
          <p className="label label--accent">03 — Inside the can</p>
          <h2 id="features-title" className="sr-only">
            Ingredients and features
          </h2>
          <p className="features__counter label" aria-hidden="true">
            <span className="features__counter-current">01</span> / 04
          </p>
        </header>

        <div className="features__panels layer-front">
          {FEATURES.map((feature, index) => (
            <article key={feature.id} className="feature" data-index={index} aria-label={feature.kicker}>
              <p className="feature__kicker label">
                <span className="accent">0{index + 1}</span> {feature.kicker}
              </p>
              <h3 className="feature__title">
                {feature.title.map((line) => (
                  <span key={line} className="split-line">
                    <span className="feature__line">{line}</span>
                  </span>
                ))}
              </h3>
              <p className="feature__body">{feature.body}</p>
              <p className="feature__stat">
                {/* data-value is the count-up target used by the scroll choreography */}
                <span className="feature__stat-value" data-value={feature.stat}>
                  {feature.stat}
                </span>
                <span className="label">{feature.unit}</span>
              </p>
            </article>
          ))}
        </div>

        <ol className="features__progress layer-front" aria-hidden="true">
          {FEATURES.map((feature) => (
            <li key={feature.id}>
              <span className="features__bar" />
              <span className="label">{feature.kicker}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
