import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { TeamBadge } from '../components/TeamBadge';
import { buildTeamResults, classifyUpset, computeMomentumIndex, computeShockOfWeek, type LeagueTable, type TeamRating } from '../lib/leagueUtils';
import { displayDivisionName } from '../lib/divisionLabels';

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

type SuperCupFixture = Awaited<ReturnType<typeof api.superCup>>[number];

export function MatchdayPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [teams, setTeams] = useState<
    Array<{ id: number; name: string; ballColor: string | null; ringColor: string | null; textColor: string | null }>
  >([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [superCupFixtures, setSuperCupFixtures] = useState<SuperCupFixture[]>([]);
  const [table, setTable] = useState<LeagueTable>({});
  const [ratings, setRatings] = useState<TeamRating[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  useEffect(() => {
    Promise.all([
      api.state(),
      api.teams(),
      api.leagueFixtures(undefined, true),
      api.superCup().catch(() => [] as SuperCupFixture[]),
      api.teamRatings().catch(() => []),
      api.leagueTable(),
    ]).then(
      ([nextState, nextTeams, nextFixtures, nextSuperCupFixtures, nextRatings, nextTable]) => {
        setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
        setTeams(nextTeams);
        setFixtures(nextFixtures);
        setSuperCupFixtures(nextSuperCupFixtures);
        setRatings(nextRatings);
        setTable(nextTable);
      },
    );
  }, []);

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);
  const currentFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.gw === (state?.currentGw ?? 'GW1')),
    [fixtures, state?.currentGw],
  );
  const currentSuperCup = useMemo(
    () => superCupFixtures.find((fixture) => fixture.gw === (state?.currentGw ?? 'GW1')) ?? null,
    [superCupFixtures, state?.currentGw],
  );

  useEffect(() => {
    if (currentFixtures.length === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % currentFixtures.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [currentFixtures.length]);

  const spotlight = currentFixtures[spotlightIndex] ?? null;
  const resolvedCount = currentFixtures.filter((fixture) => fixture.result !== 'pending').length;
  const shock = useMemo(() => {
    if (!state) {
      return null;
    }
    return computeShockOfWeek(fixtures, table, state.currentGw);
  }, [fixtures, state, table]);
  const momentumIndex = useMemo(() => computeMomentumIndex(fixtures, 5), [fixtures]);
  const formMap = useMemo(() => buildTeamResults(fixtures), [fixtures]);

  const hotTeams = useMemo(() => {
    return [...momentumIndex.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [momentumIndex]);

  const coldTeams = useMemo(() => {
    return [...momentumIndex.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
  }, [momentumIndex]);

  const highlightReel = useMemo(() => {
    if (currentFixtures.length === 0) {
      return [];
    }
    const resolvedFixtures = currentFixtures.filter((fixture) => fixture.result !== 'pending');
    const reel: string[] = [];
    const biggestWin = resolvedFixtures
      .map((fixture) => ({
        fixture,
        margin: Math.abs(fixture.homeProfit - fixture.awayProfit),
      }))
      .sort((a, b) => b.margin - a.margin)[0];
    if (biggestWin && biggestWin.margin > 0) {
      const winner = biggestWin.fixture.result === 'home' ? biggestWin.fixture.homeTeam : biggestWin.fixture.awayTeam;
      const loser = biggestWin.fixture.result === 'home' ? biggestWin.fixture.awayTeam : biggestWin.fixture.homeTeam;
      reel.push(`Biggest win: ${winner} over ${loser} by ${biggestWin.margin.toFixed(2)} profit.`);
    }
    const spinsLeader = resolvedFixtures
      .flatMap((fixture) => [
        { team: fixture.homeTeam, spins: fixture.homeSpins },
        { team: fixture.awayTeam, spins: fixture.awaySpins },
      ])
      .sort((a, b) => b.spins - a.spins)[0];
    if (spinsLeader && spinsLeader.spins > 0) {
      reel.push(`Most spins: ${spinsLeader.team} with ${spinsLeader.spins} spins.`);
    }
    if (shock) {
      reel.push(`Shock of the week: ${shock.winner} stunned ${shock.loser} (rank gap ${shock.rankGap}).`);
    }
    return reel;
  }, [currentFixtures, shock]);

  return (
    <section className="page page-wide">
      <h1>Matchday Wall</h1>
      <p className="muted">Live overview of the current gameweek.</p>

      <div className="dash-metrics">
        <div className="metric-card">
          <span className="metric-label">Current</span>
          <strong>{state ? `${state.currentSeason} ${state.currentGw}` : 'Loading...'}</strong>
          <span className="muted">Matchday view</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Fixtures</span>
          <strong>{currentFixtures.length}</strong>
          <span className="muted">{resolvedCount} resolved</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Live Spotlight</span>
          <strong>{spotlight ? `${spotlight.homeTeam} vs ${spotlight.awayTeam}` : 'Waiting...'}</strong>
          <span className="muted">{spotlight ? displayDivisionName(spotlight.division) : ''}</span>
        </div>
      </div>

      {shock && (
        <div className="panel shock-banner">
          <div>
            <div className="shock-title">Shock of the Week</div>
            <strong>{shock.winner}</strong> over {shock.loser} • {displayDivisionName(shock.division)} • Rank gap {shock.rankGap}
          </div>
          <div className="shock-meta">Margin {shock.profitMargin.toFixed(2)}</div>
        </div>
      )}

      <div className="streak-grid">
        <div className="streak-card">
          <span className="streak-label">Hot Streaks (last 5)</span>
          {hotTeams.length === 0 ? (
            <p className="muted">No form yet.</p>
          ) : (
            hotTeams.map(([team]) => {
              const form = (formMap.get(team) ?? []).slice(-5);
              return (
                <div key={`hot-${team}`} className="streak-row">
                  <strong>{team}</strong>
                  <div className="form-mini-row">
                    {form.map((result, idx) => (
                      <span key={`${team}-form-${idx}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>
                        {result}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="streak-card">
          <span className="streak-label">Cold Streaks (last 5)</span>
          {coldTeams.length === 0 ? (
            <p className="muted">No form yet.</p>
          ) : (
            coldTeams.map(([team]) => {
              const form = (formMap.get(team) ?? []).slice(-5);
              return (
                <div key={`cold-${team}`} className="streak-row">
                  <strong>{team}</strong>
                  <div className="form-mini-row">
                    {form.map((result, idx) => (
                      <span key={`${team}-cold-${idx}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>
                        {result}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {currentFixtures.length > 0 && resolvedCount === currentFixtures.length && (
        <div className="panel gw-complete-panel">
          <div className="gw-complete-header">
            <div className="trophy-pulse">TROPHY</div>
            <div>
              <strong>{state?.currentGw} Complete</strong>
              <p className="muted">Highlight reel from the day.</p>
            </div>
          </div>
          <div className="highlight-reel">
            {highlightReel.length > 0 ? (
              highlightReel.map((line, idx) => (
                <div key={`highlight-${idx}`} className="highlight-item">{line}</div>
              ))
            ) : (
              <p className="muted">Results are in. Awaiting highlight stats.</p>
            )}
          </div>
        </div>
      )}

      {spotlight && (
        <div className="panel spotlight-card">
          <div className="spotlight-header">
            <span className="muted">Spotlight Fixture</span>
            <span className="muted">{spotlight.gw}</span>
          </div>
          <div className="spotlight-body">
            <div className="spotlight-team">
              <TeamBadge
                name={spotlight.homeTeam}
                ballColor={teamByName.get(spotlight.homeTeam)?.ballColor ?? null}
                ringColor={teamByName.get(spotlight.homeTeam)?.ringColor ?? null}
                textColor={teamByName.get(spotlight.homeTeam)?.textColor ?? null}
                size={34}
              />
              <strong>{spotlight.homeTeam}</strong>
              <span className="muted">Profit {spotlight.homeProfit} | Spins {spotlight.homeSpins}</span>
            </div>
            <div className="spotlight-vs">VS</div>
            <div className="spotlight-team">
              <TeamBadge
                name={spotlight.awayTeam}
                ballColor={teamByName.get(spotlight.awayTeam)?.ballColor ?? null}
                ringColor={teamByName.get(spotlight.awayTeam)?.ringColor ?? null}
                textColor={teamByName.get(spotlight.awayTeam)?.textColor ?? null}
                size={34}
              />
              <strong>{spotlight.awayTeam}</strong>
              <span className="muted">Profit {spotlight.awayProfit} | Spins {spotlight.awaySpins}</span>
            </div>
          </div>
        </div>
      )}

      {currentSuperCup && (
        <div className="panel spotlight-card">
          <div className="spotlight-header">
            <span className="muted">Super Cup</span>
            <span className="muted">{currentSuperCup.sourceSeason} winners feed GW1</span>
          </div>
          <div className="spotlight-body">
            <div className="spotlight-team">
              <TeamBadge
                name={currentSuperCup.homeTeam}
                ballColor={teamByName.get(currentSuperCup.homeTeam)?.ballColor ?? null}
                ringColor={teamByName.get(currentSuperCup.homeTeam)?.ringColor ?? null}
                textColor={teamByName.get(currentSuperCup.homeTeam)?.textColor ?? null}
                size={34}
              />
              <strong>{currentSuperCup.homeTeam}</strong>
              <span className="muted">Profit {currentSuperCup.homeProfit} | Spins {currentSuperCup.homeSpins}</span>
            </div>
            <div className="spotlight-vs">VS</div>
            <div className="spotlight-team">
              <TeamBadge
                name={currentSuperCup.awayTeam}
                ballColor={teamByName.get(currentSuperCup.awayTeam)?.ballColor ?? null}
                ringColor={teamByName.get(currentSuperCup.awayTeam)?.ringColor ?? null}
                textColor={teamByName.get(currentSuperCup.awayTeam)?.textColor ?? null}
                size={34}
              />
              <strong>{currentSuperCup.awayTeam}</strong>
              <span className="muted">Profit {currentSuperCup.awayProfit} | Spins {currentSuperCup.awaySpins}</span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            {currentSuperCup.winnerTeam
              ? `${currentSuperCup.winnerTeam} won the standalone curtain-raiser on ${currentSuperCup.decidedBy.replace('_', ' ')}.`
              : `${currentSuperCup.pairingExplanation} It sits outside both cup brackets and carries no Bookie d'Or weight.`}
          </p>
        </div>
      )}

      <div className="matchday-grid">
        {currentFixtures.map((fixture) => {
          const upset = classifyUpset(fixture.homeTeam, fixture.awayTeam, ratings);
          return (
            <div key={fixture.id} className="fixture-card">
              <div className="fixture-meta">
                <span>{displayDivisionName(fixture.division)}</span>
                {upset && (
                  <span className={`upset-chip ${upset.level === 'huge' ? 'upset-huge' : 'upset-watch'}`}>
                    {upset.level === 'huge' ? 'Huge upset' : 'Upset watch'}
                  </span>
                )}
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
                <div className="fixture-result">{fixture.result === 'pending' ? 'TBD' : fixture.result.toUpperCase()}</div>
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
            </div>
          );
        })}
        {currentFixtures.length === 0 && <p className="muted">No fixtures loaded for this gameweek.</p>}
      </div>
    </section>
  );
}
