import type { DivisionRoundupData } from './roundupTypes';

type DivisionResultsFixturesSlideProps = {
  division: DivisionRoundupData;
};

export function DivisionResultsFixturesSlide({ division }: DivisionResultsFixturesSlideProps) {
  return (
    <section className="roundup-results-slide" aria-label={`${division.title} results and fixtures`}>
      <div className="roundup-results-column">
        <h3>{division.isNewSeason ? 'Yesterday\'s Results' : division.resultsTitle}</h3>
        {division.isNewSeason ? (
          <p className="roundup-empty-copy">New Season</p>
        ) : division.resultsRows.length > 0 ? (
          <ul className="roundup-results-list">
            {division.resultsRows.map((row) => (
              <li key={`result-${row.id}`}>
                <strong>{row.fixture}</strong>
                <span>{row.score}</span>
                <em>{row.status}</em>
              </li>
            ))}
          </ul>
        ) : (
          <p className="roundup-empty-copy">No previous gameweek results available.</p>
        )}
      </div>

      <div className="roundup-results-column">
        <h3>{division.fixturesTitle}</h3>
        {division.isSeasonComplete ? (
          <p className="roundup-empty-copy">SEASON COMPLETE</p>
        ) : division.fixtureRows.length > 0 ? (
          <ul className="roundup-results-list">
            {division.fixtureRows.map((row) => (
              <li key={`fixture-${row.id}`}>
                <strong>{row.fixture}</strong>
                <span>{row.score}</span>
                <em>{row.status}</em>
              </li>
            ))}
          </ul>
        ) : (
          <p className="roundup-empty-copy">No fixtures scheduled.</p>
        )}
      </div>
    </section>
  );
}
