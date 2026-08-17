import { useEffect, useMemo, useState } from 'react';
import { LeagueTabs } from '../components/CompetitionTabs';
import { TeamBadge } from '../components/TeamBadge';
import { TablePositionJourney, type TableJourneySnapshot } from '../components/TablePositionJourney';
import { api } from '../lib/api';
import { loadTierTableJourney } from '../lib/tableJourneys';
import { recentForm } from '../lib/formUtils';

const INTRO_GAMEWEEKS = ['GW4', 'GW5', 'GW6', 'GW7', 'GW8'] as const;
const FULL_GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'] as const;
const TIER_DIVISION_ORDER = ['Legendary', 'Masters', 'Elite', 'Superior', 'Standard', 'Average', 'Poor', 'Awful'] as const;

type TierTableRow = Awaited<ReturnType<typeof api.tierLeagueTable>>['table'][number];
type TierFixture = Awaited<ReturnType<typeof api.tierLeagueFixtures>>[number];

function formatProfit(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function tierLeagueStartsFromGw1(season: string | null): boolean {
  const value = Number((season ?? '').replace('S', ''));
  return Number.isFinite(value) && value >= 7;
}

export function TierLeaguePage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [started, setStarted] = useState(false);
  const [table, setTable] = useState<TierTableRow[]>([]);
  const [fixtures, setFixtures] = useState<TierFixture[]>([]);
  const [journey, setJourney] = useState<TableJourneySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const tierStartsGw1 = tierLeagueStartsFromGw1(state?.currentSeason ?? null);
  const tierStartGw = tierStartsGw1 ? 'GW1' : 'GW4';
  const tierGameweeks = tierStartsGw1 ? FULL_GAMEWEEKS : INTRO_GAMEWEEKS;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const nextState = await api.state();
        if (!active) return;
        setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
        const seasonNumber = Number(nextState.currentSeason.replace('S', ''));
        if (!Number.isFinite(seasonNumber) || seasonNumber < 6) {
          setEnabled(false); setStarted(false); setTable([]); setFixtures([]); setJourney([]); setMessage('Tier League starts in Season 6.');
          return;
        }
        const startGw = tierLeagueStartsFromGw1(nextState.currentSeason) ? 'GW1' : 'GW4';
        const [tableResponse, fixtureResponse] = await Promise.all([
          api.tierLeagueTable(nextState.currentGw),
          api.tierLeagueFixtures(undefined, true),
        ]);
        if (!active) return;
        setEnabled(tableResponse.enabled); setStarted(tableResponse.started); setTable(tableResponse.table); setFixtures(fixtureResponse);
        setMessage(tableResponse.started ? '' : `Tier League goes live in ${startGw}.`);
        void loadTierTableJourney(nextState.currentGw, startGw).then((rows) => { if (active) setJourney(rows); }).catch(() => { if (active) setJourney([]); });
      } catch (error) {
        if (!active) return;
        setEnabled(false); setStarted(false); setTable([]); setFixtures([]); setJourney([]);
        setMessage(error instanceof Error ? `Tier League API unavailable: ${error.message}` : 'Tier League API unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const tableByDivision = useMemo(() => TIER_DIVISION_ORDER.map((division) => ({
    division,
    rows: table.filter((row) => row.division === division).slice().sort((a, b) => a.rank - b.rank),
  })).filter((group) => group.rows.length > 0), [table]);

  const currentFixtures = useMemo(() => state ? fixtures.filter((fixture) => fixture.gw === state.currentGw) : [], [fixtures, state]);
  const fixturesByGw = useMemo(() => tierGameweeks.map((gw) => ({ gw, rows: fixtures.filter((fixture) => fixture.gw === gw) })).filter((group) => group.rows.length > 0), [fixtures, tierGameweeks]);

  const formForTeam = (teamId: number) => recentForm({
    fixtures,
    include: (fixture) => fixture.result !== 'pending' && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
    resultOf: (fixture) => fixture.result === 'draw' ? 'D' : ((fixture.result === 'home' && fixture.homeTeamId === teamId) || (fixture.result === 'away' && fixture.awayTeamId === teamId)) ? 'W' : 'L',
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });

  return (
    <section className="page page-wide competition-page competition-page-tier">
      <div className="competition-page-shell">
        <header className="tier-identity-head">
          <div><span className="competition-page-kicker">Promotion Pyramid</span><h1>Tier League</h1><p className="muted">{state ? `${state.currentSeason} ${state.currentGw}` : 'Loading…'} · 24 clubs · {tierStartGw}–GW8</p></div>
          <div className="tier-identity-key"><span>↑ Promotion</span><span>↓ Relegation</span><span>✦ Cross-tier clash</span></div>
        </header>

        <LeagueTabs activeId="tier" />
        {message && <div className="panel"><p className="muted">{message}</p></div>}

        <section className="tier-pyramid tier-pyramid-primary" aria-label="Tier League pyramid">
          {TIER_DIVISION_ORDER.map((division, index) => {
            const group = tableByDivision.find((entry) => entry.division === division);
            return (
              <div key={division} className="tier-pyramid-level-wrap">
                <div className="tier-pyramid-level" style={{ '--tier-index': index } as React.CSSProperties}>
                  <strong className="tier-pyramid-name">{division}</strong>
                  <div className="tier-pyramid-teams">
                    {(group?.rows ?? []).map((row) => <div key={row.teamId} className="tier-pyramid-team" title={`${row.points} pts · ${formatProfit(row.profit)}`}><TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={24} /><span>{row.teamName}</span><b>{row.points} pts</b></div>)}
                    {!group?.rows.length && <span className="muted">{started ? 'Waiting for standings' : 'Seeds appear when competition starts'}</span>}
                  </div>
                </div>
                {index < TIER_DIVISION_ORDER.length - 1 ? <div className="tier-pyramid-flow" aria-hidden="true"><span>↑ PROMOTION</span><i>↕</i><span>RELEGATION ↓</span></div> : null}
              </div>
            );
          })}
        </section>

        <div className="panel">
          <div className="panel-header"><div><h3>{state?.currentGw ?? 'Current'} Fixtures</h3><p className="muted">Division games and cross-tier clashes</p></div><span className="news-chip">{currentFixtures.length} games</span></div>
          {!enabled ? <p className="muted">Tier League is not available yet.</p> : !started ? <p className="muted">Fixtures begin in {tierStartGw}.</p> : currentFixtures.length === 0 ? <p className="muted">No fixtures generated for this gameweek.</p> : (
            <div className="tier-current-fixtures">
              {currentFixtures.map((fixture) => <article key={fixture.id} className={`tier-fixture-card ${fixture.fixtureType === 'cross' ? 'is-cross' : ''}`}><span>{fixture.fixtureType === 'cross' ? 'CROSS-TIER' : fixture.division}</span><strong>{fixture.homeTeam}</strong><b>{fixture.result === 'pending' ? 'VS' : `${formatProfit(fixture.homeProfit)} · ${formatProfit(fixture.awayProfit)}`}</b><strong>{fixture.awayTeam}</strong></article>)}
            </div>
          )}
        </div>

        <details className="panel tier-detail-tables">
          <summary><strong>Detailed Tier Tables</strong> <span className="muted">· points, profit, form and position replay</span></summary>
          <div className="tier-table-grid" style={{ marginTop: 8 }}>
            {loading ? <div className="panel"><p className="muted">Loading standings…</p></div> : tableByDivision.map((group) => (
              <section key={`tier-table-${group.division}`} className="panel tier-table-card">
                <h3>{group.division}</h3>
                <TablePositionJourney snapshots={journey} division={group.division} title={`${group.division} · ${tierStartGw} to current`} />
                {group.rows.map((row) => <div key={row.teamId} className="tier-table-row"><b>#{row.rank}</b><TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={18} /><strong>{row.teamName}</strong><span>{row.points} pts</span><span>{formatProfit(row.profit)}</span><div className="form-mini-row">{formForTeam(row.teamId).map((result, i) => <i key={`${row.teamId}-${i}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>{result}</i>)}</div></div>)}
              </section>
            ))}
          </div>
        </details>

        <details className="panel"><summary><strong>Season Fixture Board</strong> <span className="muted">· {fixtures.length} fixtures</span></summary><div className="tier-season-board">{fixturesByGw.map((group) => <div key={group.gw}><h4>{group.gw}</h4>{group.rows.map((fixture) => <div key={fixture.id} className="master-fixture-row"><span>{fixture.homeTeam}</span><b>{fixture.result === 'pending' ? 'vs' : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`}</b><span>{fixture.awayTeam}</span></div>)}</div>)}</div></details>
      </div>
    </section>
  );
}
