import { TeamBadge } from '../TeamBadge';
import type { ChampionsSpotlightEntry, ChampionsSpotlightModel } from './roundupTypes';

export const CHAMPIONS_SPOTLIGHT_CARD_DURATIONS_MS = [5000, 5000, 5000, 5000, 5000] as const;

type ChampionsSpotlightIntroProps = {
  title: string;
};

type ChampionsTeamSpotlightSlideProps = {
  model: ChampionsSpotlightModel;
  teamIndex: number;
  cardIndex: number;
};

function movementGlyph(value: ChampionsSpotlightEntry['movement']): string {
  if (value === 'up') {
    return '↑';
  }
  if (value === 'down') {
    return '↓';
  }
  return '→';
}

function perspectiveLine(entry: ChampionsSpotlightEntry): string {
  if (entry.perspective === 'leader') {
    return 'In command at the summit, but pressure is rising every week.';
  }
  if (entry.perspective === 'chaser') {
    return 'Within striking distance and waiting for one slip above them.';
  }
  if (entry.perspective === 'bottom') {
    return 'Running out of runway, but still mathematically alive.';
  }
  return 'Dangerous on their day with momentum still undecided.';
}

function formLabel(form: ChampionsSpotlightEntry['formLast3']): string {
  if (form.length === 0) {
    return 'N/A';
  }
  return form.join('-');
}

function valueWithFallback(value: number | null, fallback = 'N/A'): string {
  if (value === null || !Number.isFinite(value)) {
    return fallback;
  }
  return value.toFixed(2);
}

export function ChampionsSpotlightIntro({ title }: ChampionsSpotlightIntroProps) {
  return (
    <section className="roundup-transition-slide roundup-spotlight-intro" aria-live="polite">
      <p className="roundup-kicker">CHAMPIONS LEAGUE SPOTLIGHT</p>
      <h2>{title}</h2>
      <p>Analytical. Context-aware. Forward-looking.</p>
    </section>
  );
}

export function ChampionsTeamSpotlightSlide({ model, teamIndex, cardIndex }: ChampionsTeamSpotlightSlideProps) {
  const activeEntry = model.entries[Math.max(0, Math.min(model.entries.length - 1, teamIndex))];
  if (!activeEntry) {
    return (
      <section className="roundup-empty-state">
        <h2>Champions League Spotlight</h2>
        <p>No Champions spotlight entries available.</p>
      </section>
    );
  }

  const totalTeams = model.entries.length;

  return (
    <section className="roundup-runner roundup-spotlight-runner">
      <div className="roundup-spotlight-layout">
        <div className="roundup-spotlight-main">
          <header className="roundup-slide-head">
            <p className="roundup-kicker">CHAMPIONS LEAGUE SPOTLIGHT</p>
            <h2>{activeEntry.teamName}</h2>
            <p className="roundup-spotlight-team-index">Spotlight {teamIndex + 1} of {totalTeams} • Card {cardIndex + 1} of 5</p>
          </header>

          {cardIndex === 0 ? (
            <section className="roundup-spotlight-card">
              <div className="roundup-spotlight-intro-row">
                <TeamBadge
                  name={activeEntry.teamName}
                  ballColor={activeEntry.ballColor}
                  ringColor={activeEntry.ringColor}
                  textColor={activeEntry.textColor}
                  size={60}
                />
                <div>
                  <h3>{activeEntry.teamName}</h3>
                  <p>{activeEntry.tagLine}</p>
                </div>
              </div>
              <dl className="roundup-spotlight-metrics">
                <div><dt>Position</dt><dd>{activeEntry.rank}</dd></div>
                <div><dt>Points</dt><dd>{activeEntry.points}</dd></div>
                <div><dt>Profit</dt><dd>{activeEntry.profit.toFixed(2)}</dd></div>
                <div><dt>Form (L3)</dt><dd>{formLabel(activeEntry.formLast3)}</dd></div>
              </dl>
              <p className="roundup-spotlight-note">{perspectiveLine(activeEntry)}</p>
            </section>
          ) : null}

          {cardIndex === 1 ? (
            <section className="roundup-spotlight-card">
              <h3>Current Season Snapshot</h3>
              <dl className="roundup-spotlight-metrics">
                <div><dt>Current Position</dt><dd>{activeEntry.rank}</dd></div>
                <div><dt>Gap Above</dt><dd>{activeEntry.gapAbove === null ? 'N/A' : activeEntry.gapAbove}</dd></div>
                <div><dt>Gap Below</dt><dd>{activeEntry.gapBelow === null ? 'N/A' : activeEntry.gapBelow}</dd></div>
                <div><dt>Total Profit</dt><dd>{activeEntry.profit.toFixed(2)}</dd></div>
                <div><dt>Biggest Win</dt><dd>{activeEntry.biggestWin}</dd></div>
                <div><dt>Biggest Loss</dt><dd>{activeEntry.biggestLoss}</dd></div>
                {activeEntry.rank === 1 ? <div><dt>Control Index</dt><dd>{valueWithFallback(activeEntry.controlIndex)}</dd></div> : null}
                {activeEntry.perspective === 'bottom' ? <div><dt>Losing Streak</dt><dd>{activeEntry.losingStreak}</dd></div> : null}
              </dl>
            </section>
          ) : null}

          {cardIndex === 2 ? (
            <section className="roundup-spotlight-card">
              <h3>Trajectory</h3>
              <dl className="roundup-spotlight-metrics">
                <div><dt>Starting Position</dt><dd>{activeEntry.startPosition}</dd></div>
                <div><dt>Highest Position</dt><dd>{activeEntry.highestPosition}</dd></div>
                <div><dt>Current Position</dt><dd>{activeEntry.currentPosition}</dd></div>
                <div><dt>Movement</dt><dd>{movementGlyph(activeEntry.movement)}</dd></div>
                <div><dt>Trend</dt><dd>{activeEntry.movementLabel}</dd></div>
              </dl>
            </section>
          ) : null}

          {cardIndex === 3 ? (
            <section className="roundup-spotlight-card">
              <h3>Historical Context</h3>
              <dl className="roundup-spotlight-metrics">
                <div><dt>All-Time League Titles</dt><dd>{activeEntry.allTimeLeagueTitles}</dd></div>
                <div><dt>Champions Titles</dt><dd>{activeEntry.championsLeagueTitles}</dd></div>
                <div><dt>Cup Wins</dt><dd>{activeEntry.cupWins}</dd></div>
                <div><dt>Average Finish</dt><dd>{activeEntry.averageFinish === null ? 'N/A' : activeEntry.averageFinish.toFixed(2)}</dd></div>
                <div><dt>Historical Profit Record</dt><dd>{activeEntry.historicalProfitRecord.toFixed(2)}</dd></div>
              </dl>
              <p className="roundup-spotlight-note">{activeEntry.legacyLine}</p>
            </section>
          ) : null}

          {cardIndex === 4 ? (
            <section className="roundup-spotlight-card">
              <h3>Forward Projection</h3>
              <dl className="roundup-spotlight-metrics">
                <div><dt>Fixture Difficulty</dt><dd>{activeEntry.difficulty.toUpperCase()}</dd></div>
                <div><dt>Difficulty Score</dt><dd>{valueWithFallback(activeEntry.difficultyScore)}</dd></div>
                <div><dt>Profit Volatility</dt><dd>{activeEntry.volatility}</dd></div>
                {activeEntry.titleProbability !== null ? <div><dt>Title Probability</dt><dd>{activeEntry.titleProbability.toFixed(1)}%</dd></div> : null}
              </dl>
            </section>
          ) : null}
        </div>

        <aside className="roundup-live-table roundup-spotlight-table" aria-label="Champions mini table">
          <header>
            <p className="roundup-kicker">Champions Mini Table</p>
            <h3>Live Standings</h3>
          </header>
          <table>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Team</th>
                <th>PLD</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>Pts</th>
                <th>Spins</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {model.miniTable.map((row) => (
                <tr key={`champions-mini-${row.teamId}`} className={row.teamId === activeEntry.teamId ? 'is-spotlight-team' : undefined}>
                  <td>{row.rank}</td>
                  <td>{row.teamName}</td>
                  <td>{row.played}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{row.draws}</td>
                  <td>{row.points}</td>
                  <td>{row.spins}</td>
                  <td>{row.profit.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </aside>
      </div>

      <footer className="roundup-spotlight-ticker" aria-live="polite">
        <span>Projection:</span>
        <strong>{activeEntry.projectionLine}</strong>
      </footer>
    </section>
  );
}
