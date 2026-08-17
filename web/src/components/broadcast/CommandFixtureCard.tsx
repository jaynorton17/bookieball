export type FixtureH2H = {
  teamAWins: number;
  teamBWins: number;
  draws: number;
};

export type FixtureMarket = {
  home: number;
  draw: number;
  away: number;
};

export type CommandFixture = {
  key: string;
  id: number;
  competition: 'league' | 'master' | 'trio' | 'tier';
  division?: string;
  gw?: string;
  band?: 'current' | 'next';
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  result: 'home' | 'away' | 'draw' | 'pending';
  h2h: FixtureH2H | null;
  market?: FixtureMarket | null;
};

function signed(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : ''}${safe.toFixed(2)}`;
}

function statusLabel(fixture: CommandFixture): string {
  if (fixture.band === 'next') return fixture.gw ? `${fixture.gw} · NEXT` : 'NEXT';
  if (fixture.result === 'pending') return 'TO PLAY';
  if (fixture.result === 'draw') return 'DRAW';
  return fixture.result === 'home' ? `${fixture.homeTeam} WIN` : `${fixture.awayTeam} WIN`;
}

function marketPct(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

export function CommandFixtureCard({ fixture, color }: { fixture: CommandFixture; color: string }) {
  const h2h = fixture.h2h;
  const market = fixture.market;
  const homePct = market ? marketPct(market.home) : 0;
  const drawPct = market ? marketPct(market.draw) : 0;
  const awayPct = market ? Math.max(0, 100 - homePct - drawPct) : 0;

  return (
    <article className={`command-fixture${fixture.result === 'pending' ? ' is-pending' : ''}${fixture.band === 'next' ? ' is-next' : ''}`} style={{ borderLeftColor: color }}>
      <div className="command-fixture-topline"><span>{statusLabel(fixture)}</span></div>
      <div className="command-fixture-matchup">
        <strong>{fixture.homeTeam}</strong>
        <span className="command-fixture-scoreline">{fixture.band === 'next' ? '—' : signed(fixture.homeProfit)} <b>VS</b> {fixture.band === 'next' ? '—' : signed(fixture.awayProfit)}</span>
        <strong>{fixture.awayTeam}</strong>
      </div>

      {market ? (
        <div className="command-market-graphic" aria-label={`Prediction: home ${homePct}%, draw ${drawPct}%, away ${awayPct}%`}>
          <div className="command-market-labels">
            <span><b>{homePct}%</b> HOME</span>
            <span><b>{drawPct}%</b> DRAW</span>
            <span><b>{awayPct}%</b> AWAY</span>
          </div>
          <div className="command-market-bar" aria-hidden="true">
            <i className="home" style={{ width: `${homePct}%` }} />
            <i className="draw" style={{ width: `${drawPct}%` }} />
            <i className="away" style={{ width: `${awayPct}%` }} />
          </div>
        </div>
      ) : null}

      <div className="command-h2h-strip">
        <span>H2H</span>
        {h2h ? <strong>{h2h.teamAWins} <em>—</em> {h2h.draws} <em>—</em> {h2h.teamBWins}</strong> : <strong>— · — · —</strong>}
        <small>W · D · W</small>
      </div>
    </article>
  );
}
