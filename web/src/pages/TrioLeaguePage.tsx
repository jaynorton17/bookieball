import { useEffect, useMemo, useState } from 'react';
import { LeagueTabs } from '../components/CompetitionTabs';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { recentForm } from '../lib/formUtils';

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];
const TRIO_DIVISION_ORDER = ['Premier League', 'Ligue 1', 'Bundesliga'] as const;

type TrioTableRow = Awaited<ReturnType<typeof api.trioLeagueTable>>['table'][number];
type TrioFixture = Awaited<ReturnType<typeof api.trioLeagueFixtures>>[number];

function gwNumber(gw: string): number { return Number(gw.replace('GW', '')) || 99; }
function formatProfit(value: number): string { return `${value > 0 ? '+' : ''}${value.toFixed(2)}`; }
function stageLabel(fixture: TrioFixture): string {
  if (fixture.stage === 'playoff_semi') return 'Playoff Semi';
  if (fixture.stage === 'playoff_final') return 'Promotion Final';
  return 'League';
}

export function TrioLeaguePage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [table, setTable] = useState<TrioTableRow[]>([]);
  const [fixtures, setFixtures] = useState<TrioFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const nextState = await api.state();
        if (!active) return;
        setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
        const seasonNumber = Number(nextState.currentSeason.replace('S', ''));
        if (!Number.isFinite(seasonNumber) || seasonNumber < 5) {
          setEnabled(false); setTable([]); setFixtures([]); setMessage('Trio League starts in Season 5.');
          return;
        }
        const [tableResponse, fixtureResponse] = await Promise.all([
          api.trioLeagueTable(nextState.currentGw),
          api.trioLeagueFixtures(undefined, true),
        ]);
        if (!active) return;
        setEnabled(tableResponse.enabled); setTable(tableResponse.table); setFixtures(fixtureResponse);
        setMessage(tableResponse.enabled ? '' : 'Trio League is not enabled for this season.');
      } catch (error) {
        if (!active) return;
        setEnabled(false); setTable([]); setFixtures([]);
        setMessage(error instanceof Error ? `Trio League API unavailable: ${error.message}` : 'Trio League API unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const tableByDivision = useMemo(() => TRIO_DIVISION_ORDER.map((division) => ({
    division,
    rows: table.filter((row) => row.division === division).slice().sort((a, b) => a.rank - b.rank),
  })).filter((group) => group.rows.length > 0), [table]);
  const currentFixtures = useMemo(() => state ? fixtures.filter((fixture) => fixture.gw === state.currentGw) : [], [fixtures, state]);
  const playoffFixtures = useMemo(() => fixtures.filter((fixture) => fixture.stage !== 'regular'), [fixtures]);
  const fixturesByGw = useMemo(() => GAMEWEEKS.map((gw) => ({ gw, rows: fixtures.filter((fixture) => fixture.gw === gw).slice().sort((a, b) => gwNumber(a.gw) - gwNumber(b.gw) || a.groupSlot - b.groupSlot) })).filter((group) => group.rows.length > 0), [fixtures]);

  const formForTeam = (teamId: number, division: string) => recentForm({
    fixtures,
    include: (fixture) => fixture.result !== 'pending' && fixture.stage === 'regular' && fixture.division === division && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
    resultOf: (fixture) => fixture.result === 'draw' ? 'D' : ((fixture.result === 'home' && fixture.homeTeamId === teamId) || (fixture.result === 'away' && fixture.awayTeamId === teamId)) ? 'W' : 'L',
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });

  return (
    <section className="page page-wide competition-page competition-page-trio">
      <div className="competition-page-shell">
        <header className="trio-identity-head">
          <div><span className="competition-page-kicker">Three-Tier Ladder</span><h1>Trio League</h1><p className="muted">{state ? `${state.currentSeason} ${state.currentGw}` : 'Loading…'} · league phase to GW6 · playoffs GW7–GW8</p></div>
          <div className="trio-identity-key"><span>1st · auto promotion</span><span>2nd–5th · playoffs</span><span>GW8 · promotion final</span></div>
        </header>

        <LeagueTabs activeId="trio" />
        {message && <div className="panel"><p className="muted">{message}</p></div>}

        <section className="trio-groups-visual" aria-label="Trio League groups">
          {TRIO_DIVISION_ORDER.map((division) => {
            const group = tableByDivision.find((entry) => entry.division === division);
            const leaders = (group?.rows ?? []).slice(0, 3);
            return (
              <article key={division} className="trio-group-visual">
                <h3>{division}</h3>
                <div className="trio-triangle">
                  {leaders.map((row) => <div key={row.teamId} className="trio-triangle-team"><TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={22} /><span>{row.teamName}</span><b>#{row.rank}</b></div>)}
                  {leaders.length === 0 && <span className="muted">Standings will appear here</span>}
                </div>
              </article>
            );
          })}
        </section>

        <div className="panel">
          <div className="panel-header"><div><h3>{state?.currentGw ?? 'Current'} Fixtures</h3><p className="muted">League and playoff picture</p></div><span className="news-chip">{currentFixtures.length} games</span></div>
          {!enabled ? <p className="muted">Trio fixtures are not available yet.</p> : currentFixtures.length === 0 ? <p className="muted">No fixtures generated for this gameweek.</p> : (
            <div className="tier-current-fixtures">
              {currentFixtures.map((fixture) => <article key={fixture.id} className={`tier-fixture-card ${fixture.stage !== 'regular' ? 'is-cross' : ''}`}><span>{fixture.division} · {stageLabel(fixture)}</span><strong>{fixture.homeTeam}</strong><b>{fixture.result === 'pending' ? 'VS' : `${formatProfit(fixture.homeProfit)} · ${formatProfit(fixture.awayProfit)}`}</b><strong>{fixture.awayTeam}</strong></article>)}
            </div>
          )}
        </div>

        {playoffFixtures.length > 0 && (
          <section className="panel">
            <div className="panel-header"><div><h3>Promotion Playoffs</h3><p className="muted">2nd v 5th and 3rd v 4th feed the GW8 final</p></div><span className="news-chip">{playoffFixtures.length} ties</span></div>
            <div className="tier-current-fixtures">{playoffFixtures.map((fixture) => <article key={`playoff-${fixture.id}`} className="tier-fixture-card is-cross"><span>{fixture.gw} · {fixture.division} · {stageLabel(fixture)}</span><strong>{fixture.homeTeam}</strong><b>{fixture.result === 'pending' ? 'VS' : `${formatProfit(fixture.homeProfit)} · ${formatProfit(fixture.awayProfit)}`}</b><strong>{fixture.awayTeam}</strong></article>)}</div>
          </section>
        )}

        <div className="trio-groups-visual">
          {loading ? <div className="panel"><p className="muted">Loading standings…</p></div> : tableByDivision.map((group) => (
            <section key={`table-${group.division}`} className="panel tier-table-card">
              <h3>{group.division}</h3>
              {group.rows.map((row) => <div key={row.teamId} className="tier-table-row"><b>#{row.rank}</b><TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={18} /><strong>{row.teamName}</strong><span>{row.points} pts</span><span>{formatProfit(row.profit)}</span><div className="form-mini-row">{formForTeam(row.teamId, group.division).map((result, i) => <i key={`${row.teamId}-${i}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>{result}</i>)}</div></div>)}
            </section>
          ))}
        </div>

        <details className="panel"><summary><strong>Season Fixture Board</strong> <span className="muted">· {fixtures.length} fixtures</span></summary><div className="tier-season-board">{fixturesByGw.map((group) => <div key={group.gw}><h4>{group.gw}</h4>{group.rows.map((fixture) => <div key={fixture.id} className="master-fixture-row"><span>{fixture.homeTeam}</span><b>{fixture.result === 'pending' ? 'vs' : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`}</b><span>{fixture.awayTeam}</span></div>)}</div>)}</div></details>
      </div>
    </section>
  );
}