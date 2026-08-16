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

type Series = { played: number; teamAWins: number; draws: number; teamBWins: number };

export function HeadToHeadPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [teams, setTeams] = useState<
    Array<{ id: number; name: string; ballColor: string | null; ringColor: string | null; textColor: string | null }>
  >([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [seriesByFixtureId, setSeriesByFixtureId] = useState<Record<number, Series>>({});
  const [h2h, setH2h] = useState<{ teamA: H2HTeam; teamB: H2HTeam; context: string } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.state(), api.teams(), api.leagueFixtures(undefined, true)])
      .then(([nextState, nextTeams, nextFixtures]) => {
        if (!active) {
          return;
        }
        setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
        setTeams(nextTeams);
        setFixtures(nextFixtures);
      })
      .catch(() => {
        if (active) {
          setFixtures([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);

  const currentFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.gw === (state?.currentGw ?? 'GW1')),
    [fixtures, state?.currentGw],
  );

  const divisionOrder = useMemo(() => getDivisionOrderForSeason(state?.currentSeason ?? null), [state?.currentSeason]);

  const groups = useMemo(() => {
    const order = divisionOrder.length > 0
      ? divisionOrder
      : [...new Set(currentFixtures.map((fixture) => fixture.division))];
    return order
      .map((division) => [division, currentFixtures.filter((fixture) => fixture.division === division)] as const)
      .filter(([, divisionFixtures]) => divisionFixtures.length > 0);
  }, [currentFixtures, divisionOrder]);

  useEffect(() => {
    if (currentFixtures.length === 0) {
      return;
    }
    let active = true;
    Promise.all(
      currentFixtures.map(async (fixture) => {
        const home = teamByName.get(fixture.homeTeam);
        const away = teamByName.get(fixture.awayTeam);
        if (!home || !away) {
          return null;
        }
        try {
          const record = await api.headToHeadAllTime(home.id, away.id);
          return { fixtureId: fixture.id, series: { played: record.played, teamAWins: record.teamAWins, draws: record.draws, teamBWins: record.teamBWins } as Series };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (!active) {
        return;
      }
      const next: Record<number, Series> = {};
      results.forEach((result) => {
        if (result) {
          next[result.fixtureId] = result.series;
        }
      });
      setSeriesByFixtureId(next);
    });
    return () => {
      active = false;
    };
  }, [currentFixtures, teamByName]);

  const openH2h = (fixture: Fixture) => {
    const home = teamByName.get(fixture.homeTeam);
    const away = teamByName.get(fixture.awayTeam);
    if (!home || !away) {
      return;
    }
    setH2h({ teamA: home, teamB: away, context: `${displayDivisionName(fixture.division)} • ${fixture.gw}` });
  };

  return (
    <section className="page page-wide">
      <h1>Head to Head</h1>
      <p className="muted">
        Every division fixture in {state?.currentSeason ?? ''} {state?.currentGw ?? ''} — click a game for the all-time record
        since season 1.
      </p>

      {currentFixtures.length === 0 && <p className="muted">No fixtures loaded for this gameweek.</p>}

      {groups.map(([division, divisionFixtures]) => (
        <section key={division} className="h2h-division-block">
          <div className="h2h-division-head">
            <h2>{displayDivisionName(division)}</h2>
            <span className="muted">{divisionFixtures.length} fixture{divisionFixtures.length === 1 ? '' : 's'}</span>
          </div>
          <div className="matchday-grid">
            {divisionFixtures.map((fixture) => {
              const series = seriesByFixtureId[fixture.id];
              return (
                <div key={fixture.id} className="fixture-card is-clickable" onClick={() => openH2h(fixture)}>
                  <div className="fixture-meta">
                    <span>{fixture.gw}</span>
                    <span className={`fixture-result ${fixture.result === 'pending' ? '' : 'is-resolved'}`}>
                      {fixture.result === 'pending' ? 'TBD' : fixture.result.toUpperCase()}
                    </span>
                  </div>
                  <div className="fixture-row-grid">
                    <div className="fixture-team">
                      <TeamBadge
                        name={fixture.homeTeam}
                        ballColor={teamByName.get(fixture.homeTeam)?.ballColor ?? null}
                        ringColor={teamByName.get(fixture.homeTeam)?.ringColor ?? null}
                        textColor={teamByName.get(fixture.homeTeam)?.textColor ?? null}
                      />
                      <div>
                        <strong>{fixture.homeTeam}</strong>
                        <div className="muted">Profit {fixture.homeProfit} | Spins {fixture.homeSpins}</div>
                      </div>
                    </div>
                    <div className="fixture-result">{fixture.result === 'pending' ? 'vs' : fixture.result.toUpperCase()}</div>
                    <div className="fixture-team">
                      <TeamBadge
                        name={fixture.awayTeam}
                        ballColor={teamByName.get(fixture.awayTeam)?.ballColor ?? null}
                        ringColor={teamByName.get(fixture.awayTeam)?.ringColor ?? null}
                        textColor={teamByName.get(fixture.awayTeam)?.textColor ?? null}
                      />
                      <div>
                        <strong>{fixture.awayTeam}</strong>
                        <div className="muted">Profit {fixture.awayProfit} | Spins {fixture.awaySpins}</div>
                      </div>
                    </div>
                  </div>
                  <div className="h2h-series">
                    {series ? (
                      <>
                        <span className="h2h-series-label">All-time</span>
                        <strong>{fixture.homeTeam}</strong>
                        <span>{series.teamAWins} – {series.draws} – {series.teamBWins}</span>
                        <strong>{fixture.awayTeam}</strong>
                        <span className="muted">{series.played} meeting{series.played === 1 ? '' : 's'}</span>
                      </>
                    ) : (
                      <span className="muted">Loading the series...</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {h2h && <HeadToHeadModal teamA={h2h.teamA} teamB={h2h.teamB} context={h2h.context} onClose={() => setH2h(null)} />}
    </section>
  );
}
