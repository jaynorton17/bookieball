import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { loadAllTimeAnalytics, type RivalryAnalytics } from '../lib/allTimeAnalytics';
import { TeamBadge } from '../components/TeamBadge';
import { HeadToHeadModal, type H2HTeam } from '../components/HeadToHeadModal';
import { displayDivisionName, getDivisionOrderForSeason } from '../lib/divisionLabels';

type Fixture = {
  id: number;
  gw: string;
  division: string;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
};

type CardRecord = {
  played: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  lastMeeting: RivalryAnalytics['lastMeeting'];
  recentMeetings: RivalryAnalytics['recentMeetings'];
  currentStreak: string;
};

function signed(value: number): string { return `${value > 0 ? '+' : ''}${value.toFixed(2)}`; }
function norm(name: string): string { return name.trim().toLowerCase(); }
function pairKey(home: string, away: string): string { return `${norm(home)}|${norm(away)}`; }
function recentResult(meeting: RivalryAnalytics['recentMeetings'][number], teamName: string): 'W' | 'D' | 'L' {
  if (meeting.result === 'draw') return 'D';
  const winner = meeting.result === 'home' ? meeting.homeTeam : meeting.awayTeam;
  return norm(winner) === norm(teamName) ? 'W' : 'L';
}

export function HeadToHeadPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [teams, setTeams] = useState<Array<{ id: number; name: string; ballColor: string | null; ringColor: string | null; textColor: string | null }>>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [rivalries, setRivalries] = useState<RivalryAnalytics[]>([]);
  const [h2h, setH2h] = useState<{ teamA: H2HTeam; teamB: H2HTeam; context: string } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.state(), api.teams(), api.leagueFixtures(undefined, true)])
      .then(([nextState, nextTeams, nextFixtures]) => {
        if (!active) return;
        setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
        setTeams(nextTeams);
        setFixtures(nextFixtures);
      })
      .catch(() => { if (active) setFixtures([]); });

    void loadAllTimeAnalytics()
      .then((archive) => { if (active) setRivalries(archive.rivalries); })
      .catch(() => { if (active) setRivalries([]); });
    return () => { active = false; };
  }, []);

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);
  const divisionOrder = useMemo(() => getDivisionOrderForSeason(state?.currentSeason ?? null), [state?.currentSeason]);
  const currentFixtures = useMemo(() => {
    const order = new Map(divisionOrder.map((division, index) => [division, index]));
    return fixtures
      .filter((fixture) => fixture.gw === (state?.currentGw ?? 'GW1'))
      .slice()
      .sort((a, b) => (order.get(a.division) ?? 99) - (order.get(b.division) ?? 99) || a.id - b.id);
  }, [fixtures, state?.currentGw, divisionOrder]);

  const recordsByPair = useMemo(() => {
    const map = new Map<string, CardRecord>();
    rivalries.forEach((row) => {
      map.set(pairKey(row.teamAName, row.teamBName), {
        played: row.meetings,
        teamAWins: row.teamAWins,
        teamBWins: row.teamBWins,
        draws: row.draws,
        lastMeeting: row.lastMeeting,
        recentMeetings: row.recentMeetings,
        currentStreak: row.currentStreak,
      });
      map.set(pairKey(row.teamBName, row.teamAName), {
        played: row.meetings,
        teamAWins: row.teamBWins,
        teamBWins: row.teamAWins,
        draws: row.draws,
        lastMeeting: row.lastMeeting,
        recentMeetings: row.recentMeetings,
        currentStreak: row.currentStreak,
      });
    });
    return map;
  }, [rivalries]);

  const openH2h = (fixture: Fixture) => {
    const home = teamByName.get(fixture.homeTeam);
    const away = teamByName.get(fixture.awayTeam);
    if (!home || !away) return;
    setH2h({ teamA: home, teamB: away, context: `${displayDivisionName(fixture.division)} • ${fixture.gw}` });
  };

  return (
    <section className="page page-wide h2h-board-page">
      <div className="h2h-page-head">
        <div>
          <h1>Head to Head</h1>
          <p className="muted">{state ? `${state.currentSeason} ${state.currentGw}` : 'Current gameweek'} · division rivalry records since S1</p>
        </div>
        <span className="news-chip">{currentFixtures.length} live matchups</span>
      </div>

      {currentFixtures.length === 0 ? <p className="muted">No fixtures loaded for this gameweek.</p> : (
        <div className="h2h-fight-grid h2h-fight-grid-flat">
          {currentFixtures.map((fixture) => {
            const record = recordsByPair.get(pairKey(fixture.homeTeam, fixture.awayTeam));
            const latest = record?.lastMeeting;
            const home = teamByName.get(fixture.homeTeam);
            const away = teamByName.get(fixture.awayTeam);
            return (
              <article key={fixture.id} className="h2h-fight-card" onClick={() => openH2h(fixture)}>
                <div className="h2h-fight-top">
                  <span>{displayDivisionName(fixture.division)} · {fixture.gw}</span>
                  <span>{record ? `${record.played} meetings` : 'Loading rivalry…'}</span>
                </div>
                <div className="h2h-fight-main">
                  <div className="h2h-fight-team">
                    <TeamBadge name={fixture.homeTeam} ballColor={home?.ballColor ?? null} ringColor={home?.ringColor ?? null} textColor={home?.textColor ?? null} size={32} />
                    <span>{fixture.homeTeam}</span>
                  </div>
                  <div className="h2h-fight-score">
                    <strong>{record ? `${record.teamAWins} — ${record.draws} — ${record.teamBWins}` : '— VS —'}</strong>
                    <span>W · D · W</span>
                  </div>
                  <div className="h2h-fight-team">
                    <span>{fixture.awayTeam}</span>
                    <TeamBadge name={fixture.awayTeam} ballColor={away?.ballColor ?? null} ringColor={away?.ringColor ?? null} textColor={away?.textColor ?? null} size={32} />
                  </div>
                </div>
                {record?.recentMeetings.length ? <div className="h2h-last-five"><span>LAST 5</span><div>{record.recentMeetings.map((meeting, index) => { const result = recentResult(meeting, fixture.homeTeam); return <i key={`${meeting.season}-${meeting.gw}-${index}`} className={`is-${result.toLowerCase()}`} title={`${meeting.season} ${meeting.gw}`}>{result}</i>; })}</div><strong>{record.currentStreak}</strong></div> : null}
                <div className="h2h-fight-foot">
                  <span>{latest ? `Previous: ${latest.season} ${latest.gw} · ${latest.homeTeam} ${signed(latest.homeProfit)} vs ${signed(latest.awayProfit)} ${latest.awayTeam}` : 'No previous meeting'}</span>
                  <span>Open series</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {h2h && <HeadToHeadModal teamA={h2h.teamA} teamB={h2h.teamB} context={h2h.context} onClose={() => setH2h(null)} />}
    </section>
  );
}
