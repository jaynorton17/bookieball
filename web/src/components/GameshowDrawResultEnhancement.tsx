import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';
import { TeamBadge } from './TeamBadge';

type DrawResult = Awaited<ReturnType<typeof api.drawTeam>>;
type Team = Awaited<ReturnType<typeof api.teams>>[number];
type LeagueFixture = Awaited<ReturnType<typeof api.leagueFixtures>>[number];
type LeagueTable = Awaited<ReturnType<typeof api.leagueTable>>;
type HeadToHead = Awaited<ReturnType<typeof api.headToHeadAllTime>>;

type SelectedTeam = {
  teamId: number;
  teamName: string;
  division: string;
  leagueOpponent?: string;
};

type MatchupRow = {
  id: string;
  fixture: Pick<LeagueFixture, 'homeTeam' | 'awayTeam' | 'homeProfit' | 'awayProfit' | 'result'>;
  home: Team | null;
  away: Team | null;
  homeRank: number | null;
  awayRank: number | null;
  homePoints: number | null;
  awayPoints: number | null;
  h2h: HeadToHead | null;
  highlighted: boolean;
};

type ResultData = {
  season: string;
  gw: string;
  division: string;
  matchups: MatchupRow[];
};

function signed(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : ''}${safe.toFixed(2)}`;
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function outcomeLabel(fixture: MatchupRow['fixture']): string {
  if (fixture.result === 'pending') return 'TO PLAY';
  if (fixture.result === 'draw') return 'DRAW';
  return fixture.result === 'home' ? `${fixture.homeTeam} WIN` : `${fixture.awayTeam} WIN`;
}

function previousMeetingLabel(h2h: HeadToHead | null): string {
  const meeting = h2h?.lastMeeting ?? null;
  if (!meeting) return 'No previous meeting recorded';
  const result = meeting.result === 'draw'
    ? 'Draw'
    : meeting.result === 'home'
      ? `${meeting.homeTeam} won`
      : meeting.result === 'away'
        ? `${meeting.awayTeam} won`
        : 'Pending';
  return `${meeting.season} ${meeting.gw} · ${meeting.homeTeam} ${signed(meeting.homeProfit)} — ${signed(meeting.awayProfit)} ${meeting.awayTeam} · ${result}`;
}

function streakLabel(h2h: HeadToHead | null): string {
  if (!h2h?.currentStreak?.side || h2h.currentStreak.count <= 0) return 'No active win streak';
  const team = h2h.currentStreak.side === 'A' ? h2h.teamA.name : h2h.teamB.name;
  return `${team} · ${h2h.currentStreak.count} straight win${h2h.currentStreak.count === 1 ? '' : 's'}`;
}

function MatchupCard({ row, selectedTeamName, gw }: { row: MatchupRow; selectedTeamName: string; gw: string }) {
  const score = row.fixture.result === 'pending'
    ? 'VS'
    : `${signed(row.fixture.homeProfit)}  —  ${signed(row.fixture.awayProfit)}`;
  const h2h = row.h2h;

  return (
    <article className={`gameshow-division-matchup${row.highlighted ? ' is-selected-fixture' : ''}`}>
      <div className="gameshow-division-matchup-top">
        <span>{row.highlighted ? 'SELECTED TEAM FIXTURE' : 'DIVISION FIXTURE'}</span>
        <b>{gw}</b>
      </div>

      <div className="gameshow-division-matchup-main">
        <div className={`gameshow-result-team${sameName(row.fixture.homeTeam, selectedTeamName) ? ' is-selected-team' : ''}`}>
          {row.home ? <TeamBadge name={row.home.name} ballColor={row.home.ballColor} ringColor={row.home.ringColor} textColor={row.home.textColor} size={64} /> : null}
          <strong>{row.fixture.homeTeam}</strong>
          <span>{row.homeRank ? `#${row.homeRank}` : '—'}{row.homePoints !== null ? ` · ${row.homePoints} pts` : ''}</span>
        </div>

        <div className="gameshow-result-score">
          <small>{outcomeLabel(row.fixture)}</small>
          <b className={row.fixture.result === 'pending' ? 'is-vs' : ''}>{score}</b>
        </div>

        <div className={`gameshow-result-team is-away${sameName(row.fixture.awayTeam, selectedTeamName) ? ' is-selected-team' : ''}`}>
          {row.away ? <TeamBadge name={row.away.name} ballColor={row.away.ballColor} ringColor={row.away.ringColor} textColor={row.away.textColor} size={64} /> : null}
          <strong>{row.fixture.awayTeam}</strong>
          <span>{row.awayRank ? `#${row.awayRank}` : '—'}{row.awayPoints !== null ? ` · ${row.awayPoints} pts` : ''}</span>
        </div>
      </div>

      <div className="gameshow-result-h2h">
        <div className="gameshow-result-h2h-head">
          <span>ALL-TIME HEAD TO HEAD</span>
          <small>{h2h ? `${h2h.played} meetings` : 'Loading history'}</small>
        </div>
        {h2h ? (
          <>
            <div className="gameshow-result-h2h-score">
              <div><strong>{h2h.teamAWins}</strong><span>{h2h.teamA.name} wins</span></div>
              <div className="is-draw"><strong>{h2h.draws}</strong><span>Draws</span></div>
              <div><strong>{h2h.teamBWins}</strong><span>{h2h.teamB.name} wins</span></div>
            </div>
            <div className="gameshow-result-history-strip">
              <div><small>CURRENT STREAK</small><strong>{streakLabel(h2h)}</strong></div>
              <div><small>PREVIOUS MEETING</small><strong>{previousMeetingLabel(h2h)}</strong></div>
            </div>
          </>
        ) : <div className="gameshow-result-h2h-empty">Head-to-head history unavailable for this matchup.</div>}
      </div>
    </article>
  );
}

function ResultBoard({ selected, data, loading, error }: { selected: SelectedTeam; data: ResultData | null; loading: boolean; error: string }) {
  return (
    <div className="gameshow-matchup-result-root" aria-live="polite">
      <header className="gameshow-matchup-result-head">
        <div>
          <span>DRAW RESULT · DIVISION MATCHUPS</span>
          <h2>{displayDivisionName(data?.division ?? selected.division)}</h2>
          <p>{data ? `${data.season} ${data.gw}` : 'Loading current gameweek'} · {selected.teamName} has been selected — here are the actual division fixtures and their history.</p>
        </div>
        <div className="gameshow-matchup-selected-pill"><small>SELECTED</small><strong>{selected.teamName}</strong></div>
      </header>

      {loading ? <div className="gameshow-matchup-result-state">Building division matchups and all-time H2H…</div> : null}
      {!loading && error ? <div className="gameshow-matchup-result-state is-error">{error}</div> : null}
      {!loading && !error && data ? (
        <div className={`gameshow-matchup-grid${data.matchups.length === 1 ? ' is-single' : ''}`}>
          {data.matchups.map((row) => <MatchupCard key={row.id} row={row} selectedTeamName={selected.teamName} gw={data.gw} />)}
        </div>
      ) : null}
    </div>
  );
}

export function GameshowDrawResultEnhancement() {
  const location = useLocation();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<SelectedTeam | null>(null);
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    if (location.pathname !== '/gameshow') {
      setTarget(null);
      setSelected(null);
      return undefined;
    }
    const syncTarget = () => {
      const next = document.querySelector<HTMLElement>('.kickoff-simple-shell');
      setTarget((current) => current === next ? current : next);
    };
    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/gameshow') return undefined;
    const onSelected = (event: Event) => {
      const picked = (event as CustomEvent<DrawResult>).detail;
      if (!picked?.teamId || !picked.teamName || !picked.division) return;
      setSelected({ teamId: picked.teamId, teamName: picked.teamName, division: picked.division, leagueOpponent: picked.leagueOpponent });
    };
    window.addEventListener('bookieball:gameshow-team-selected', onSelected);
    return () => window.removeEventListener('bookieball:gameshow-team-selected', onSelected);
  }, [location.pathname]);

  useEffect(() => {
    if (!target || selected || location.pathname !== '/gameshow') return undefined;
    let cancelled = false;
    let inFlight = false;
    const recoverFromLegacy = () => {
      if (inFlight) return;
      const teamName = target.querySelector<HTMLElement>('.kickoff-simple-team-card h2')?.textContent?.trim();
      if (!teamName || /press start/i.test(teamName)) return;
      inFlight = true;
      void api.teams().then((teams) => {
        if (cancelled) return;
        const team = teams.find((candidate) => sameName(candidate.name, teamName));
        if (team) setSelected({ teamId: team.id, teamName: team.name, division: team.division });
      }).finally(() => { inFlight = false; });
    };
    recoverFromLegacy();
    const observer = new MutationObserver(recoverFromLegacy);
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    return () => { cancelled = true; observer.disconnect(); };
  }, [location.pathname, selected, target]);

  useEffect(() => {
    if (!selected || location.pathname !== '/gameshow') {
      setData(null);
      setError('');
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');

    void Promise.all([
      api.state(),
      api.teams(),
      api.leagueTable(),
    ]).then(async ([state, teams, table]) => {
      const fixtures = await api.leagueFixtures(state.currentGw, false).catch(() => [] as LeagueFixture[]);
      if (!active) return;

      const teamByName = new Map(teams.map((team) => [team.name.trim().toLowerCase(), team]));
      const divisionRows = (table[selected.division] ?? Object.values(table).flat().filter((row) => row.division === selected.division));
      const tableByName = new Map(divisionRows.map((row) => [row.teamName.trim().toLowerCase(), row]));

      let divisionFixtures = fixtures.filter((fixture) => fixture.division === selected.division);
      if (divisionFixtures.length === 0) {
        divisionFixtures = fixtures.filter((fixture) => sameName(fixture.homeTeam, selected.teamName) || sameName(fixture.awayTeam, selected.teamName));
      }

      const fallbackOpponent = selected.leagueOpponent && !/no fixture/i.test(selected.leagueOpponent) ? selected.leagueOpponent : null;
      const rows: MatchupRow[] = await Promise.all(
        (divisionFixtures.length > 0
          ? divisionFixtures.map((fixture) => ({
              id: `league-${fixture.id}`,
              fixture: { homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit, result: fixture.result },
            }))
          : fallbackOpponent
            ? [{ id: `fallback-${selected.teamId}`, fixture: { homeTeam: selected.teamName, awayTeam: fallbackOpponent, homeProfit: 0, awayProfit: 0, result: 'pending' as const } }]
            : []
        ).map(async ({ id, fixture }) => {
          const home = teamByName.get(fixture.homeTeam.trim().toLowerCase()) ?? null;
          const away = teamByName.get(fixture.awayTeam.trim().toLowerCase()) ?? null;
          const homeTable = tableByName.get(fixture.homeTeam.trim().toLowerCase()) ?? null;
          const awayTable = tableByName.get(fixture.awayTeam.trim().toLowerCase()) ?? null;
          const h2h = home && away
            ? await api.headToHeadAllTime(home.id, away.id).catch(() => null)
            : null;
          return {
            id,
            fixture,
            home,
            away,
            homeRank: homeTable?.rank ?? null,
            awayRank: awayTable?.rank ?? null,
            homePoints: homeTable?.points ?? null,
            awayPoints: awayTable?.points ?? null,
            h2h,
            highlighted: sameName(fixture.homeTeam, selected.teamName) || sameName(fixture.awayTeam, selected.teamName),
          } satisfies MatchupRow;
        }),
      );

      if (!active) return;
      setData({ season: state.currentSeason, gw: state.currentGw, division: selected.division, matchups: rows });
      if (rows.length === 0) setError(`No ${state.currentGw} league fixtures are loaded for ${displayDivisionName(selected.division)}.`);
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load division head-to-head details.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [location.pathname, selected]);

  const active = Boolean(target && selected);
  useLayoutEffect(() => {
    if (!target || !active) return undefined;
    target.classList.add('gameshow-matchup-result-active');
    return () => target.classList.remove('gameshow-matchup-result-active');
  }, [active, target]);

  const portal = useMemo(() => {
    if (!target || !selected) return null;
    return createPortal(<ResultBoard selected={selected} data={data} loading={loading} error={error} />, target);
  }, [data, error, loading, selected, target]);

  return portal;
}
