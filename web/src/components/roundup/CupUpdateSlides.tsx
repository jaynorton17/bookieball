import type { CupSegmentModel } from './roundupTypes';

export function CupUpdateIntro({ title }: { title: string }) {
  return (
    <section className="roundup-transition-slide roundup-cup-intro" aria-live="polite">
      <p className="roundup-kicker">CUP UPDATE</p>
      <h2>{title}</h2>
      <p>Knockout status and pending ties.</p>
    </section>
  );
}

export function CupUpdateBoard({ model }: { model: CupSegmentModel }) {
  return (
    <section className="roundup-runner roundup-cup-board">
      <header className="roundup-slide-head">
        <p className="roundup-kicker">CUP UPDATE</p>
        <h2>{model.roundLabel}</h2>
      </header>

      <div className="roundup-results-slide roundup-cup-columns">
        <section className="roundup-results-column">
          <h3>Latest Results</h3>
          {model.results.length > 0 ? (
            <ul className="roundup-results-list">
              {model.results.map((row) => (
                <li key={row.id}>
                  <strong>{row.fixture}</strong>
                  <em>{row.status}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="roundup-empty-copy">No confirmed winners yet.</p>
          )}
        </section>

        <section className="roundup-results-column">
          <h3>Upcoming Ties</h3>
          {model.upcoming.length > 0 ? (
            <ul className="roundup-results-list">
              {model.upcoming.map((row) => (
                <li key={row.id}>
                  <strong>{row.fixture}</strong>
                  <em>{row.status}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="roundup-empty-copy">All ties complete in this round.</p>
          )}
        </section>
      </div>
    </section>
  );
}
