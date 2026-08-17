import { useEffect, useMemo, useState } from 'react';
import { LeagueTabs } from '../components/CompetitionTabs';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';
import { api } from '../lib/api';
import { TeamBadge } from '../components/TeamBadge';
import { recentForm } from '../lib/formUtils';

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];

type MasterTableRow = {
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

type MasterFixture = {
  id: number;
  gw: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
};

function gwNumber(gw: string): number { return Number(gw.replace('GW', '')) || 99; }
function formatProfit(value: number): string { return `${value > 0 ? '+' : ''}${value.toFixed(2)}`; }

export function MasterLeaguePage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [table, setTable] = useState<MasterTableRow[]>([]);
  const [fixtures, setFixtures] = useState<MasterFixture[]>([]);
  const [movement, setMovement] = useState<Record<number, number>>({});
  const [baselineGw, setBaselineGw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [rangeFrom, setRangeFrom] = useState<string>('GW1');
  const [rangeTo, setRangeTo] = useState<string>('GW8');
  const [fixtureToolsOpen, setFixtureToolsOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const nextState = await api.state();
      const [tableResponse, fixtureResponse] = await Promise.all([
        api.masterLeagueTable(nextState.currentGw),
        api.masterLeagueFixtures(undefined, true),
      ]);
      setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
      setTable(tableResponse.table);
      setMovement(tableResponse.movement ?? {});
      setBaselineGw(tableResponse.baselineGw ?? null);
      setFixtures(fixtureResponse);
      setMessage('');
    } catch (error) {
      setTable([]); setFixtures([]); setMovement({}); setBaselineGw(null);
      setMessage(error instanceof Error ? `Master League API unavailable: ${error.message}` : 'Master League API unavailable. Restart the backend and try again.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const currentGwFixtures = useMemo(() => (state ? fixtures.filter((fixture) => fixture.gw === state.currentGw) : []), [fixtures, state]);
  const topFive = useMemo(() => table.slice().sort((a, b) => a.rank - b.rank).slice(0, 5), [table]);
  const leaderPoints = topFive[0]?.points ?? 0;
  const fifthPoints = topFive[topFive.length - 1]?.points ?? 0;
  const raceSpan = Math.max(1, leaderPoints - fifthPoints + 3);

  const masterChampionTeamId = useMemo(() => {
    if (table.length === 0) return null;
    const fixturesByTeam = new Map<number, number>();
    fixtures.forEach((fixture) => {
      fixturesByTeam.set(fixture.homeTeamId, (fixturesByTeam.get(fixture.homeTeamId) ?? 0) + 1);
      fixturesByTeam.set(fixture.awayTeamId, (fixturesByTeam.get(fixture.awayTeamId) ?? 0) + 1);
    });
    const maxScheduledGames = Math.max(8, ...Array.from(fixturesByTeam.values()), ...table.map((row) => row.played));
    const leader = table[0];
    const maxOtherPoints = table.slice(1).reduce((best, row) => Math.max(best, row.points + Math.max(0, maxScheduledGames - row.played) * 3), -Infinity);
    if (maxOtherPoints === -Infinity) return leader.teamId;
    return leader.points > maxOtherPoints ? leader.teamId : null;
  }, [fixtures, table]);

  const fixturesByGw = useMemo(() => {
    const groups = new Map<string, MasterFixture[]>();
    fixtures.slice().sort((a, b) => gwNumber(a.gw) - gwNumber(b.gw) || a.id - b.id).forEach((fixture) => {
      const list = groups.get(fixture.gw) ?? []; list.push(fixture); groups.set(fixture.gw, list);
    });
    return GAMEWEEKS.filter((gw) => groups.has(gw)).map((gw) => ({ gw, fixtures: groups.get(gw) ?? [] }));
  }, [fixtures]);

  const currentGwIndex = useMemo(() => state ? GAMEWEEKS.indexOf(state.currentGw) : -1, [state]);
  const nextGw = currentGwIndex >= 0 && currentGwIndex < GAMEWEEKS.length - 1 ? GAMEWEEKS[currentGwIndex + 1] : null;

  useEffect(() => {
    if (!state) return;
    setRangeFrom((prev) => (GAMEWEEKS.includes(prev) ? prev : (nextGw ?? state.currentGw)));
    setRangeTo((prev) => (GAMEWEEKS.includes(prev) ? prev : 'GW8'));
  }, [nextGw, state]);

  const runGenerate = async (fromGw: string, toGw: string) => {
    setGenerating(true); setMessage('');
    try {
      const result = await api.generateMasterLeagueFixtures(fromGw, toGw);
      await reload();
      setMessage(`Generated ${result.created} Master League fixtures (${result.fromGw} to ${result.toGw}).`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to generate Master League fixtures.'); }
    finally { setGenerating(false); }
  };

  const generateUpcoming = async () => {
    if (!nextGw) { setMessage('No upcoming gameweeks left to generate.'); return; }
    await runGenerate(nextGw, 'GW8');
  };

  const rangeFromIdx = GAMEWEEKS.indexOf(rangeFrom);
  const rangeToIdx = GAMEWEEKS.indexOf(rangeTo);
  const rangeValid = rangeFromIdx >= 0 && rangeToIdx >= 0 && rangeFromIdx <= rangeToIdx;
  const generateSelectedRange = async () => {
    if (!rangeValid) { setMessage('Choose a valid gameweek range (From must be before or equal to To).'); return; }
    await runGenerate(rangeFrom, rangeTo);
  };

  const movementBadge = (teamId: number): { label: string; className: string } => {
    const delta = movement[teamId] ?? 0;
    if (delta > 0) return { label: `▲${delta}`, className: 'rank-up' };
    if (delta < 0) return { label: `▼${Math.abs(delta)}`, className: 'rank-down' };
    return { label: '•', className: 'rank-flat' };
  };

  const formForTeam = (teamId: number) => recentForm({
    fixtures,
    include: (fixture) => fixture.result !== 'pending' && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
    resultOf: (fixture) => {
      if (fixture.result === 'draw') return 'D';
      const win = (fixture.result === 'home' && fixture.homeTeamId === teamId) || (fixture.result === 'away' && fixture.awayTeamId === teamId);
      return win ? 'W' : 'L';
    },
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });

  return (
    <section className="page page-wide competition-page competition-page-master">
      <div className="competition-page-shell">
        <header className="competition-page-hero competition-page-hero-master">
          <div className="competition-page-hero-head">
            <div className="competition-page-hero-copy"><span className="competition-page-kicker">Full Field</span><h1>Master League</h1><p>All teams in one cross-division race.</p></div>
            <div className="competition-hero-art" aria-hidden="true"><CompetitionTrophyMark variant="master" className="competition-hero-trophy trophy-master" /></div>
          </div>
          <div className="competition-metric-row">
            <article className="competition-metric-card"><span>Teams</span><strong>{table.length}</strong><p>Full field</p></article>
            <article className="competition-metric-card"><span>Live</span><strong>{state ? `${state.currentSeason} ${state.currentGw}` : '—'}</strong><p>Current round</p></article>
            <article className="competition-metric-card"><span>Fixtures</span><strong>{fixtures.length}</strong><p>Scheduled</p></article>
          </div>
        </header>

        <LeagueTabs activeId="master" />

        {topFive.length > 0 ? <section className="master-race-strip panel">
          <div className="panel-header"><div><h3>Top 5 Championship Race</h3><p className="muted">Actual Master League points</p></div><span className="news-chip">{leaderPoints} pts leads</span></div>
          <div className="master-race-lanes">{topFive.map((row) => {
            const gap = leaderPoints - row.points;
            const progress = Math.max(16, 100 - (gap / raceSpan) * 72);
            return <div key={`race-${row.teamId}`} className="master-race-lane"><span>#{row.rank}</span><TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={25} /><strong>{row.teamName}</strong><div className="master-race-track"><i style={{ width: `${progress}%` }}><b /></i></div><em>{row.points} pts{gap ? ` · ${gap} behind` : ' · leader'}</em></div>;
          })}</div>
        </section> : null}

        <div className="panel">
          <div className="master-tools-toggle"><div><strong>Fixture Tools</strong><p className="muted">Administrative fixture generation stays hidden until needed.</p></div><button className="secondary" type="button" onClick={() => setFixtureToolsOpen((open) => !open)} aria-expanded={fixtureToolsOpen}>{fixtureToolsOpen ? 'Close Tools' : '⚙ Fixture Tools'}</button></div>
          {fixtureToolsOpen && <div className="master-league-actions" style={{ marginTop: 10 }}><div className="master-generate-controls"><label>From<select value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} disabled={generating}>{GAMEWEEKS.map((gw) => <option key={`from-${gw}`} value={gw}>{gw}</option>)}</select></label><label>To<select value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} disabled={generating}>{GAMEWEEKS.map((gw) => <option key={`to-${gw}`} value={gw}>{gw}</option>)}</select></label><button className="secondary" type="button" onClick={generateSelectedRange} disabled={generating || !rangeValid}>{generating ? 'Generating...' : `Generate ${rangeFrom}-${rangeTo}`}</button><button className="action" type="button" onClick={generateUpcoming} disabled={generating || !nextGw}>{nextGw ? `Quick: ${nextGw}-GW8` : 'No Upcoming Fixtures'}</button></div></div>}
          {message && <p className="muted">{message}</p>}
          {baselineGw && fixtureToolsOpen && <p className="muted">Movement baseline: {baselineGw}</p>}
        </div>

        <div className="panel">
          <h3>Master League Table</h3>
          {loading ? <p className="muted">Loading table...</p> : table.length === 0 ? <p className="muted">No table rows yet.</p> : <div className="table-scroll"><table className="scoreboard-table master-league-table"><thead><tr><th>#</th><th>Team</th><th>PLD</th><th>W</th><th>L</th><th>D</th><th>Pts</th><th>Spins</th><th>Profit</th><th>Form</th><th>Move</th></tr></thead><tbody>{table.map((row) => { const badge = movementBadge(row.teamId); return <tr key={`master-row-${row.teamId}`}><td>{row.rank}</td><td><span className="master-team-cell">{masterChampionTeamId === row.teamId && <span className="champion-c-badge" title="Mathematical champion">C</span>}<TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={18} /><span>{row.teamName}</span></span></td><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.draws}</td><td>{row.points}</td><td>{row.spins}</td><td>{formatProfit(row.profit)}</td><td><div className="form-mini-row">{formForTeam(row.teamId).map((result, index) => <span key={`master-form-${row.teamId}-${index}-${result}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>{result}</span>)}</div></td><td><span className={badge.className}>{badge.label}</span></td></tr>; })}</tbody></table></div>}
        </div>

        <div className="panel"><h3>{state?.currentGw ?? 'Current'} Fixtures</h3>{currentGwFixtures.length === 0 ? <p className="muted">No fixtures generated for this gameweek yet.</p> : <div className="master-fixture-list">{currentGwFixtures.map((fixture) => <div key={`master-current-${fixture.id}`} className="master-fixture-row"><strong>{fixture.homeTeam}</strong><span>{fixture.result === 'pending' ? 'vs' : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`}</span><strong>{fixture.awayTeam}</strong></div>)}</div>}</div>

        <details className="panel"><summary><strong>Season Fixture Board</strong> <span className="muted">· {fixtures.length} fixtures</span></summary>{fixturesByGw.length === 0 ? <p className="muted">No fixtures available yet.</p> : <div className="master-fixture-groups" style={{ marginTop: 10 }}>{fixturesByGw.map((group) => <div key={`master-group-${group.gw}`} className="master-fixture-group"><h4>{group.gw}</h4>{group.fixtures.map((fixture) => <div key={`master-group-row-${fixture.id}`} className="master-fixture-row"><span>{fixture.homeTeam}</span><span>{fixture.result === 'pending' ? 'vs' : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`}</span><span>{fixture.awayTeam}</span></div>)}</div>)}</div>}</details>
      </div>
    </section>
  );
}
