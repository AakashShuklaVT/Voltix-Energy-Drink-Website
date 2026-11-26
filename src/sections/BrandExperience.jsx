// k = React key, t = the two lines of each headline (revealed by the choreography)
const HEADLINES = [
  { k: 'Discharge', t: ['Not a drink.', 'A discharge.'] },
  { k: 'Surge', t: ['Ride the', 'bolt.'] },
  { k: 'Charged', t: ['Stay', 'charged.'] },
]

const MARQUEE_WORDS = ['Energy', 'Focus', 'Performance', 'Electric Citrus', 'Sparkling', 'Ice cold']

export default function BrandExperience() {
  return (
    <section id="energy" className="brand" aria-labelledby="brand-title">
      <div className="brand__pin">
        <header className="brand__head layer-front">
          <p className="label label--accent">04 — The charge</p>
          <h2 id="brand-title" className="sr-only">
            The VOLTIX brand experience
          </h2>
          <p className="brand__meter label" aria-hidden="true">
            Charge <span className="brand__meter-value">000</span>%
          </p>
        </header>

        <div className="brand__lines layer-front">
          {HEADLINES.map((headline, index) => (
            <p key={headline.k} className="brand__line" data-index={index}>
              {headline.t.map((text) => (
                <span key={text} className="split-line">
                  <span className="brand__word">{text}</span>
                </span>
              ))}
            </p>
          ))}
        </div>

        <p className="brand__hint label layer-front" aria-hidden="true">
          Move your cursor through the field
        </p>

        <div className="brand__marquee layer-front" aria-hidden="true">
          {/* two identical copies, so scrolling the track by -50% loops seamlessly */}
          <div className="brand__marquee-track">
            {[0, 1].map((copy) => (
              <span key={copy} className="brand__marquee-group">
                {MARQUEE_WORDS.map((word) => (
                  <span key={word + copy}>
                    {word}
                    <svg viewBox="0 0 16 24" fill="currentColor">
                      <path d="M10 0 1 13.5h5.5L4.5 24 15 9.5H9.4L10 0Z" />
                    </svg>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
