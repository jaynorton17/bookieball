import type { api } from '../../lib/api';

type H2H = Awaited<ReturnType<typeof api.headToHeadAllTime>>;

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
  h2h: H2H | null;
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

function pct(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function CommandFixtureCard({ fixture, color }: { fixture: CommandFixture; color: string }) {
  const h2h = fixture.h2h;
  const market = fixture.market;
  return (
    <article className={`command-fixture${fixture.result === 'pending' ? ' is-pending' : ''}${fixture.band === 'next' ? ' is-next' : ''}`} style={{ borderLeftColor: color }}>
      <div className="command-fixture-topline"><span>{statusLabel(fixture)}</span></div>
      <div className="command-fixture-matchup">
        <strong>{fixture.homeTeam}</strong>
        <span className="command-fixture-scoreline">{fixture.band === 'next' ? '—' : signed(fixture.homeProfit)} <b>VS</b> {fixture.band === 'next' ? '—' : signed(fixture.awayProfit)}</span>
        <strong>{fixture.awayTeam}</strong>
      </div>
      {market ? (
        <div className="command-fixture-market">
          <span><b>{pct(market.home)}</b> HOME</span>
          <span><b>{pct(market.draw)}</b> DRAW</span>
          <span><b>{pct(market.away)}</b> AWAY</span>
        </div>
      ) : null}
      <div className="command-fixture-h2h">
        {h2h
          ? `ALL-TIME H2H · ${fixture.homeTeam} ${h2h.teamAWins}W ${h2h.teamBWins}L ${h2h.draws}D · ${fixture.awayTeam} ${h2h.teamBWins}W ${h2h.teamAWins}L ${h2h.draws}D`
          : 'ALL-TIME H2H · No previous league meetings recorded'}
      </div>
    </article>
  );
}
