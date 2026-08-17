import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
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

type H2HRecord = Awaited<ReturnType<typeof api.headToHeadAllTime>>;

function sortValue(season: string, gw: string): number {
  return (Number(season.replace('S', '')) || 0) * 100 + (Number(gw.replace('GW', '')) || 0);
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function latestMeeting(record: H2HRecord | undefined) {
  if (!record?.meetings?.length) return null;
  return record.meetings.slice().sort((a, b) => sortValue(b.season, b.gw) - sortValue(a.season, a.gw))[0] ?? null;
}

function averageMargin(record: H2HRecord | undefined): number {
  if (!record?.meetings?.length) return 0;
  return record.meetings.reduce((sum, meeting) => sum + Math.abs(meeting.homeProfit - meeting.awayProfit), 0) / record.meetings.length;
}

export function HeadToHeadPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [teams, setTeams] = useState<Array<{ id: number; name: string; ballColor: string | null; ringColor: string | null; textColor: string | null }>>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [recordsByFixtureId, setRecordsByFixtureId] = useState<Record<number, H2HRecord>>({});
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
    return () => { active = false; };
  }, []);

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);
  const currentFixtures = useMemo(() => fixtures.filter((fixture) => fixture.gw === (state?.currentGw ?? 'GW1')), [fixtures, state?.currentGw]);
  const divisionOrder = useMemo(() => getDivisionOrderForSeason(state?.currentSeason ?? null), [state?.currentSeason]);

  const groups = useMemo(() => {
    const order = divisionOrder.length > 0 ? divisionOrder : [...new Set(currentFixtures.map((fixture) => fixture.division))];
    return order
      .map((division) => [division, currentFixtures.filter((fixture) => fixture.division === division)] as const)
      .filter(([, rows]) => rows.length > 0);
  }, [currentFixtures, divisionOrder]);

  useEffect(() => {
    if (currentFixtures.length === 0) return;
    let active = true;
    Promise.all(currentFixtures.map(async (fixture) => {
      const home = teamByName.get(fixture.homeTeam);
      const away = teamByName.get(fixture.awayTeam);
      if (!home || !away) return null;
      try {
        return { fixtureId: fixture.id, record: await api.headToHeadAllTime(home.id, away.id) };
      } catch {
        return null;
      }
    })).then((results) => {
      if (!active) return;
      const next: Record<number, H2HRecord> = {};
      results.forEach((result) => { if (result) next[result.fixtureId] = result.record; });
      setRecordsByFixtureId(next);
    });
    return () => { active = false; };
  }, [currentFixtures, teamByName]);

  const openH2h = (fixture: Fixture) => {
    const home = teamByName.get(fixture.homeTeam);
    const away = teamByName.get(fixture.awayTeam);
    if (!home || !away) return;
    setH2h({ teamA: home, teamB: away, context: `${displayDivisionName(fixture.division)} • ${fixture.gw}` });
  };

  return (
    <section className="page page-wide">
      <div className="h2h-page-head">
        <div>
          <h1>Head to Head</h1>
          <p className="muted">{state ? `${state.currentSeason} ${state.currentGw}` : 'Current gameweek'} · all-time rivalry records since S1</p>
        </div>
        <span className="news-chip">{currentFixtures.length} live matchups</span>
      </div>

      {currentFixtures.length === 0 && <p className="muted">No fixtures loaded for this gameweek.</p>}

      {groups.map(([division, divisionFixtures]) => (
        <section key={division} className="h2h-division-block">
          <div className="h2h-division-head">
            <h2>{displayDivisionName(division)}</h2>
            <span className="muted">{divisionFixtures.length} fixture{divisionFixtures.length === 1 ? '' : 's'}</span>
          </div>
          <div className="h2h-fight-grid">
            {divisionFixtures.map((fixture) => {
              const record = recordsByFixtureId[fixture.id];
              const latest = latestMeeting(record);
              const margin = averageMargin(record);
              const home = teamByName.get(fixture.homeTeam);
              const away = teamByName.get(fixture.awayTeam);
              return (
                <article key={fixture.id} className="h2h-fight-card" onClick={() => openH2h(fixture)}>
                  <div className="h2h-fight-top">
                    <span>{fixture.gw} · {fixture.result === 'pending' ? 'To Play' : 'Resolved'}</span>
                    <span>{record ? `${record.played} meetings` : 'Loading rivalry…'}</span>
                  </div>
                  <div className="h2h-fight-main">
                    <div className="h2h-fight-team">
                      <TeamBadge name={fixture.homeTeam} ballColor={home?.ballColor ?? null} ringColor={home?.ringColor ?? null} textColor={home?.textColor ?? null} size={28} />
                      <span>{fixture.homeTeam}</span>
                    </div>
                    <div className="h2h-fight-score">
                      <strong>{record ? `${record.teamAWins} — ${record.draws} — ${record.teamBWins}` : '— VS —'}</strong>
                      <span>ALL-TIME W · D · W</span>
                    </div>
                    <div className="h2h-fight-team">
                      <span>{fixture.awayTeam}</span>
                      <TeamBadge name={fixture.awayTeam} ballColor={away?.ballColor ?? null} ringColor={away?.ringColor ?? null} textColor={away?.textColor ?? null} size={28} />
                    </div>
                  </div>
                  <div className="h2h-fight-foot">
                    <span>{latest ? `Last: ${latest.season} ${latest.gw} · ${signed(latest.homeProfit)}–${signed(latest.awayProfit)}` : 'No previous meeting'}</span>
                    <span>{record?.played ? `Avg margin ${margin.toFixed(2)}` : 'Click for full series'}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {h2h && <HeadToHeadModal teamA={h2h.teamA} teamB={h2h.teamB} context={h2h.context} onClose={() => setH2h(null)} />}
    </section>
  );
}