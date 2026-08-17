import { useEffect, useMemo, useState } from 'react';
import { LeagueTabs } from '../components/CompetitionTabs';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';
import { api } from '../lib/api';
import { TeamBadge } from '../components/TeamBadge';
import { HeadToHeadModal, type H2HTeam } from '../components/HeadToHeadModal';
import { displayDivisionName, getDivisionOrderForSeason, sortDivisionNames } from '../lib/divisionLabels';
import { isOfficialDivisionFixture, recentForm } from '../lib/formUtils';

const DIVISION_GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7'];

type DivisionRow = { teamId: number; teamName: string; division: string; played: number; wins: number; draws: number; losses: number; points: number; profit: number; spins: number; rank: number };

export function LeaguePage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [teams, setTeams] = useState<Array<{ id: number; teamId: string | null; name: string; url: string; division: string; ballColor: string | null; ringColor: string | null; textColor: string | null }>>([]);
  const [table, setTable] = useState<Record<string, DivisionRow[]>>({});
  const [leagueFixtures, setLeagueFixtures] = useState<Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; result: 'home' | 'away' | 'draw' | 'pending' }>>([]);
  const [movement, setMovement] = useState<{ baselineGw: string | null; baselineLabel: string | null; movement: Record<string, Record<number, number>> }>({ baselineGw: null, baselineLabel: null, movement: {} });
  const [divisionFixtureGw, setDivisionFixtureGw] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'tables' | 'playoffs'>('tables');
  const [h2h, setH2h] = useState<{ teamA: H2HTeam; teamB: H2HTeam; context: string } | null>(null);

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);
  const divisionOrder = useMemo(() => getDivisionOrderForSeason(state?.currentSeason ?? null), [state?.currentSeason]);

  const openH2h = (homeName: string, awayName: string, division: string, gw: string) => {
    const home = teamByName.get(homeName); const away = teamByName.get(awayName);
    if (!home || !away) return;
    setH2h({ teamA: home, teamB: away, context: `${displayDivisionName(division)} • ${gw}` });
  };

  const formForTeam = (teamName: string, division: string) => recentForm({
    fixtures: leagueFixtures,
    include: (fixture) => fixture.result !== 'pending' && isOfficialDivisionFixture(fixture.division, fixture.gw) && fixture.division === division && (fixture.homeTeam === teamName || fixture.awayTeam === teamName),
    resultOf: (fixture) => {
      if (fixture.result === 'draw') return 'D';
      const win = (fixture.result === 'home' && fixture.homeTeam === teamName) || (fixture.result === 'away' && fixture.awayTeam === teamName);
      return win ? 'W' : 'L';
    },
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });

  const racePicture = (division: string) => {
    const rows = table[division] ?? [];
    if (!rows.length) return null;
    const top = rows[0]; const second = rows[1] ?? null; const bottom = rows[rows.length - 1]; const aboveBottom = rows[rows.length - 2] ?? null;
    return {
      top, second, bottom, aboveBottom,
      topGap: second ? Math.max(0, top.points - second.points) : 0,
      dropGap: aboveBottom ? Math.max(0, aboveBottom.points - bottom.points) : 0,
    };
  };

  const movementBadge = (division: string, teamId: number): { label: string; className: string } => {
    const delta = movement.movement?.[division]?.[teamId] ?? 0;
    if (delta > 0) return { label: `▲${delta}`, className: 'rank-up' };
    if (delta < 0) return { label: `▼${Math.abs(delta)}`, className: 'rank-down' };
    return { label: '•', className: 'rank-flat' };
  };

  const orderedDivisionEntries = useMemo(() => sortDivisionNames(Object.keys(table), state?.currentSeason ?? null).map((division) => [division, table[division] ?? []] as const), [state?.currentSeason, table]);
  const gw8Fixtures = useMemo(() => leagueFixtures.filter((fixture) => fixture.gw === 'GW8'), [leagueFixtures]);
  const gw8Locked = gw8Fixtures.length > 0;
  const playoffFixtures = useMemo(() => gw8Fixtures.filter((fixture) => fixture.division === 'Playoff'), [gw8Fixtures]);
  const friendlyFixtures = useMemo(() => gw8Fixtures.filter((fixture) => fixture.division === 'Friendly'), [gw8Fixtures]);

  const projectedPlayoffs = useMemo(() => {
    const pairs: Array<{ upperDivision: string; lowerDivision: string; upperTeam?: string; lowerTeam?: string }> = [];
    for (let i = 0; i < divisionOrder.length - 1; i += 1) {
      const upper = divisionOrder[i]; const lower = divisionOrder[i + 1]; const upperRows = table[upper] ?? []; const lowerRows = table[lower] ?? [];
      pairs.push({ upperDivision: upper, lowerDivision: lower, upperTeam: upperRows[2]?.teamName, lowerTeam: lowerRows[1]?.teamName });
    }
    return pairs;
  }, [divisionOrder, table]);

  const reload = async () => {
    const nextState = await api.state();
    const [nextTeams, nextTable, nextLeagueFixtures, nextMovement] = await Promise.all([api.teams(), api.leagueTable(), api.leagueFixtures(undefined, true), api.leagueMovement().catch(() => ({ baselineGw: null, baselineLabel: null, movement: {} }))]);
    setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw }); setTeams(nextTeams); setTable(nextTable); setLeagueFixtures(nextLeagueFixtures); setMovement(nextMovement);
  };

  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    if (!state) return;
    setDivisionFixtureGw((prev) => {
      const next = { ...prev };
      Object.keys(table).forEach((division) => { if (!next[division]) next[division] = state.currentGw === 'GW8' ? 'GW7' : (state.currentGw ?? DIVISION_GAMEWEEKS[0]); });
      return next;
    });
  }, [state, table]);

  return (
    <section className="page page-wide competition-page competition-page-league">
      <div className="competition-page-shell">
        <header className="competition-page-hero competition-page-hero-league">
          <div className="competition-page-hero-head"><div className="competition-page-hero-copy"><span className="competition-page-kicker">Core Ladder</span><h1>Division Tables</h1><p>Division tables, form, movement, and playoff context for the official league structure.</p></div><div className="competition-hero-art" aria-hidden="true"><CompetitionTrophyMark variant="cup" className="competition-hero-trophy trophy-cup" /></div></div>
          <div className="competition-metric-row"><article className="competition-metric-card"><span>Divisions</span><strong>{divisionOrder.length}</strong><p>Current league structure</p></article><article className="competition-metric-card"><span>Season</span><strong>{state ? state.currentSeason : '—'}</strong><p>{state ? state.currentGw : 'Loading...'}</p></article><article className="competition-metric-card"><span>Fixtures</span><strong>{leagueFixtures.length}</strong><p>Division fixtures</p></article></div>
        </header>

        <LeagueTabs activeId="divisions" />
        <div className="tab-row"><button type="button" className={`tab-button ${activeTab === 'tables' ? 'active' : ''}`} onClick={() => setActiveTab('tables')}>Tables</button><button type="button" className={`tab-button ${activeTab === 'playoffs' ? 'active' : ''}`} onClick={() => setActiveTab('playoffs')}>Playoffs</button></div>

        {activeTab === 'tables' ? <>{orderedDivisionEntries.map(([division, rows]) => {
          const race = racePicture(division);
          const gwForDivision = divisionFixtureGw[division] ?? (state?.currentGw === 'GW8' ? 'GW7' : state?.currentGw) ?? DIVISION_GAMEWEEKS[0];
          const gwFixtures = leagueFixtures.filter((fixture) => fixture.division === division && fixture.gw === gwForDivision);
          return <div key={division} className="panel division-scoreboard-panel">
            <h3>{displayDivisionName(division)}</h3>
            {race ? <div className="division-race-row">
              <article className="division-race-card"><span>TITLE RACE</span><div className="division-race-match"><strong>{race.top.teamName}</strong><b>{race.top.points}</b><em>{race.topGap} PT GAP</em><b>{race.second?.points ?? '—'}</b><strong>{race.second?.teamName ?? 'No chaser'}</strong></div></article>
              <article className="division-race-card is-drop"><span>RELEGATION FIGHT</span><div className="division-race-match"><strong>{race.aboveBottom?.teamName ?? '—'}</strong><b>{race.aboveBottom?.points ?? '—'}</b><em>{race.dropGap} PT GAP</em><b>{race.bottom.points}</b><strong>{race.bottom.teamName}</strong></div></article>
            </div> : null}

            <div className="table-scroll"><table><thead><tr><th>Rank</th><th>Team</th><th>PLD</th><th>W</th><th>L</th><th>D</th><th>Pts</th><th>Spins</th><th>Profit</th><th>Form (Last 5)</th></tr></thead><tbody>{rows.map((row) => {
              const divisionIndex = divisionOrder.indexOf(division); const isPromotionSlot = divisionIndex > 0 && row.rank === 1; const isRelegationSlot = divisionIndex >= 0 && divisionIndex < divisionOrder.length - 1 && row.rank === rows.length; const isPlayoffChaser = divisionIndex > 0 && row.rank === 2; const isPlayoffDefender = divisionIndex >= 0 && divisionIndex < divisionOrder.length - 1 && row.rank === 3; const move = movementBadge(division, row.teamId);
              return <tr key={row.teamId} className={`${isPromotionSlot ? 'promotion-slot' : ''} ${isRelegationSlot ? 'relegation-slot' : ''} ${isPlayoffChaser ? 'playoff-chaser' : ''} ${isPlayoffDefender ? 'playoff-defender' : ''}`.trim()}><td><div className="rank-cell"><span>{row.rank}</span><span className={`rank-move ${move.className}`}>{move.label}</span></div></td><td><span className="team-name"><TeamBadge name={row.teamName} ballColor={teamByName.get(row.teamName)?.ballColor ?? null} ringColor={teamByName.get(row.teamName)?.ringColor ?? null} textColor={teamByName.get(row.teamName)?.textColor ?? null} size={24} /><span>{row.teamName}</span></span></td><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.draws}</td><td>{row.points}</td><td>{row.spins}</td><td>{row.profit}</td><td><div className="form-mini-row">{formForTeam(row.teamName, division).map((r, idx) => <span key={`${row.teamId}-${idx}-${r}`} className={`form-badge ${r === 'W' ? 'form-win' : r === 'D' ? 'form-draw' : 'form-loss'}`}>{r}</span>)}</div></td></tr>;
            })}</tbody></table></div>

            <div className="division-fixtures"><div className="division-fixtures-header"><h5>Fixtures</h5><label className="inline-select">GW<select value={gwForDivision} onChange={(e) => setDivisionFixtureGw((prev) => ({ ...prev, [division]: e.target.value }))}>{DIVISION_GAMEWEEKS.map((gw) => <option key={`division-${division}-${gw}`} value={gw}>{gw}</option>)}</select></label></div>{gwFixtures.length === 0 ? <p className="muted">No fixtures loaded for {gwForDivision}.</p> : <div className="division-fixture-cards">{gwFixtures.map((fixture) => {
              const home = teamByName.get(fixture.homeTeam); const away = teamByName.get(fixture.awayTeam);
              return <article key={fixture.id} className="division-fixture-card"><div className="division-fixture-team"><TeamBadge name={fixture.homeTeam} ballColor={home?.ballColor ?? null} ringColor={home?.ringColor ?? null} textColor={home?.textColor ?? null} size={24} /><strong>{fixture.homeTeam}</strong></div><div className="division-fixture-result"><span>{fixture.result === 'pending' ? 'TO PLAY' : fixture.result === 'draw' ? 'DRAW' : fixture.result === 'home' ? `${fixture.homeTeam} WIN` : `${fixture.awayTeam} WIN`}</span><b>{fixture.result === 'pending' ? 'VS' : `${fixture.homeProfit.toFixed(2)} — ${fixture.awayProfit.toFixed(2)}`}</b></div><div className="division-fixture-team right"><strong>{fixture.awayTeam}</strong><TeamBadge name={fixture.awayTeam} ballColor={away?.ballColor ?? null} ringColor={away?.ringColor ?? null} textColor={away?.textColor ?? null} size={24} /></div><button type="button" className="h2h-trigger" onClick={() => openH2h(fixture.homeTeam, fixture.awayTeam, fixture.division, fixture.gw)}>H2H</button></article>;
            })}</div>}</div>
          </div>;
        })}</> : <div className="panel"><h3>GW8 Playoffs &amp; Friendlies</h3>{!gw8Locked ? <><p className="muted">Playoff matchups update live until GW7 is completed.</p><div className="fixture-list">{projectedPlayoffs.map((pair) => <div key={`${pair.upperDivision}-${pair.lowerDivision}`} className="fixture-row"><strong>{displayDivisionName(pair.upperDivision)} 3rd</strong> {pair.upperTeam ?? 'TBD'} vs <strong>{displayDivisionName(pair.lowerDivision)} 2nd</strong> {pair.lowerTeam ?? 'TBD'}</div>)}</div><p className="muted">Friendlies will be drawn once GW7 is completed.</p></> : <><div className="panel"><h4>Playoffs</h4>{playoffFixtures.length === 0 ? <p className="muted">No playoff fixtures found.</p> : <div className="fixture-list">{playoffFixtures.map((fixture) => <div key={`playoff-${fixture.id}`} className="fixture-row"><strong>{fixture.homeTeam}</strong> ({fixture.homeProfit}) vs <strong>{fixture.awayTeam}</strong> ({fixture.awayProfit}) - {fixture.result}</div>)}</div>}</div><div className="panel"><h4>Friendlies</h4>{friendlyFixtures.length === 0 ? <p className="muted">No friendly fixtures found.</p> : <div className="fixture-list">{friendlyFixtures.map((fixture) => <div key={`friendly-${fixture.id}`} className="fixture-row"><strong>{fixture.homeTeam}</strong> ({fixture.homeProfit}) vs <strong>{fixture.awayTeam}</strong> ({fixture.awayProfit}) - {fixture.result}</div>)}</div>}</div></>}</div>}
      </div>
      {h2h && <HeadToHeadModal teamA={h2h.teamA} teamB={h2h.teamB} context={h2h.context} onClose={() => setH2h(null)} />}
    </section>
  );
}
