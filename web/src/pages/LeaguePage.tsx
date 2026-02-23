import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { TeamBadge } from '../components/TeamBadge';
import { TeamSeasonStory, type TeamSeasonHistory } from '../components/TeamSeasonStory';
import { displayDivisionName } from '../lib/divisionLabels';
import { classifyUpset, pickRivalryFixtures, type TeamRating } from '../lib/leagueUtils';

const GWS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];
const DIVISION_ORDER = ['Champions Bookies', 'Premier Bookies', 'Average Bookies', 'Struggling Bookies', 'Awful Bookies'];

export function LeaguePage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string; cupDrawStarted: boolean; gwLocked: boolean } | null>(null);
  const [teams, setTeams] = useState<
    Array<{ id: number; teamId: string | null; name: string; url: string; division: string; ballColor: string | null; ringColor: string | null; textColor: string | null }>
  >([]);
  const [table, setTable] = useState<
    Record<
      string,
      Array<{ teamId: number; teamName: string; division: string; played: number; wins: number; draws: number; losses: number; points: number; profit: number; spins: number; rank: number }>
    >
  >({});
  const [leagueFixtures, setLeagueFixtures] = useState<
    Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; result: 'home' | 'away' | 'draw' | 'pending' }>
  >([]);
  const [cup, setCup] = useState<
    Array<{ id: number; matchNumber: number; gw: string; roundName: string; homeTeam: string | null; homeDivision: string | null; awayTeam: string | null; awayDivision: string | null; winnerTeam: string | null }>
  >([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamStats, setTeamStats] = useState<{ season: { profit: number; wins: number; entries: number }; allTime: { profit: number; wins: number; entries: number }; cupWins: number; leagueTitles: number } | null>(null);
  const [teamSeasonHistory, setTeamSeasonHistory] = useState<TeamSeasonHistory[] | null>(null);
  const [teamSeasonLoading, setTeamSeasonLoading] = useState(false);
  const [trophyRoom, setTrophyRoom] = useState<{
    cup: Array<{ season: string; teamName: string }>;
    divisions: Record<string, Array<{ season: string; teamName: string }>>;
    goalsOfSeason: Record<string, Array<{ season: string; teamName: string }>>;
    bookieDor: Array<{ season: string; teamName: string }>;
  }>({
    cup: [],
    divisions: {},
    goalsOfSeason: {},
    bookieDor: [],
  });
  const [ratings, setRatings] = useState<TeamRating[]>([]);
  const [movement, setMovement] = useState<{ baselineGw: string | null; baselineLabel: string | null; movement: Record<string, Record<number, number>> }>({
    baselineGw: null,
    baselineLabel: null,
    movement: {},
  });
  const [divisionFixtureGw, setDivisionFixtureGw] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'tables' | 'playoffs'>('tables');


  const formForTeam = (teamName: string) => {
    const played = leagueFixtures
      .filter((fixture) => fixture.result !== 'pending' && (fixture.homeTeam === teamName || fixture.awayTeam === teamName))
      .sort((a, b) => Number(a.gw.replace('GW', '')) - Number(b.gw.replace('GW', '')))
      .slice(-5);

    return played.map((fixture) => {
      if (fixture.result === 'draw') {
        return 'D';
      }
      const win = (fixture.result === 'home' && fixture.homeTeam === teamName) || (fixture.result === 'away' && fixture.awayTeam === teamName);
      return win ? 'W' : 'L';
    });
  };

  const difficultyClass = (division: string, opponentName: string): string => {
    const rows = table[division] ?? [];
    if (rows.length === 0) {
      return 'difficulty-neutral';
    }
    const opponent = rows.find((row) => row.teamName === opponentName);
    if (!opponent) {
      return 'difficulty-neutral';
    }
    const band = opponent.rank / rows.length;
    if (band <= 0.34) {
      return 'difficulty-hard';
    }
    if (band <= 0.67) {
      return 'difficulty-mid';
    }
    return 'difficulty-easy';
  };

  const raceMeter = (division: string) => {
    const rows = table[division] ?? [];
    if (rows.length === 0) {
      return null;
    }
    const top = rows[0];
    const second = rows[1];
    const bottom = rows[rows.length - 1];
    const aboveBottom = rows[rows.length - 2];
    const topGap = second ? Math.max(0, top.points - second.points) : 0;
    const dropGap = aboveBottom ? Math.max(0, aboveBottom.points - bottom.points) : 0;
    const topPct = Math.min(100, topGap * 20);
    const dropPct = Math.min(100, dropGap * 20);
    return { topGap, dropGap, topPct, dropPct };
  };

  const movementBadge = (division: string, teamId: number): { label: string; className: string } => {
    const delta = movement.movement?.[division]?.[teamId] ?? 0;
    if (delta > 0) {
      return { label: `▲${delta}`, className: 'rank-up' };
    }
    if (delta < 0) {
      return { label: `▼${Math.abs(delta)}`, className: 'rank-down' };
    }
    return { label: '•', className: 'rank-flat' };
  };

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);

  const rivalryFixtures = useMemo(() => {
    if (!state) {
      return [];
    }
    return pickRivalryFixtures(leagueFixtures, state.currentSeason, state.currentGw);
  }, [leagueFixtures, state]);

  const rivalryIds = useMemo(() => new Set(rivalryFixtures.map((fixture) => fixture.id)), [rivalryFixtures]);

  const gw8Fixtures = useMemo(() => leagueFixtures.filter((fixture) => fixture.gw === 'GW8'), [leagueFixtures]);
  const gw8Locked = gw8Fixtures.length > 0;
  const playoffFixtures = useMemo(() => gw8Fixtures.filter((fixture) => fixture.division === 'Playoff'), [gw8Fixtures]);
  const friendlyFixtures = useMemo(() => gw8Fixtures.filter((fixture) => fixture.division === 'Friendly'), [gw8Fixtures]);

  const projectedPlayoffs = useMemo(() => {
    const pairs: Array<{ upperDivision: string; lowerDivision: string; upperTeam?: string; lowerTeam?: string }> = [];
    for (let i = 0; i < DIVISION_ORDER.length - 1; i += 1) {
      const upper = DIVISION_ORDER[i];
      const lower = DIVISION_ORDER[i + 1];
      const upperRows = table[upper] ?? [];
      const lowerRows = table[lower] ?? [];
      pairs.push({
        upperDivision: upper,
        lowerDivision: lower,
        upperTeam: upperRows[2]?.teamName,
        lowerTeam: lowerRows[1]?.teamName,
      });
    }
    return pairs;
  }, [table]);

  const todaysWinners = useMemo(() => {
    if (!state) {
      return [];
    }
    const winners = leagueFixtures
      .filter((fixture) => fixture.gw === state.currentGw && fixture.result !== 'pending' && fixture.result !== 'draw')
      .map((fixture) => (fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam));
    return Array.from(new Set(winners));
  }, [leagueFixtures, state]);

  const selectedTeamRow = useMemo(() => {
    if (!selectedTeamId) {
      return null;
    }
    return Object.values(table)
      .flat()
      .find((row) => row.teamId === selectedTeamId) ?? null;
  }, [selectedTeamId, table]);

  const reload = async () => {
    const nextState = await api.state();
    const [nextTeams, nextTable, nextCup, nextLeagueFixtures, nextTrophyRoom, nextMovement, nextRatings] = await Promise.all([
      api.teams(),
      api.leagueTable(),
      api.cup(),
      api.leagueFixtures(undefined, true),
      api.trophyRoom(),
      api.leagueMovement().catch(() => ({ baselineGw: null, baselineLabel: null, movement: {} })),
      api.teamRatings().catch(() => []),
    ]);
    setState(nextState);
    setTeams(nextTeams);
    setTable(nextTable);
    setCup(nextCup);
    setLeagueFixtures(nextLeagueFixtures);
    setTrophyRoom(nextTrophyRoom);
    setMovement(nextMovement);
    setRatings(nextRatings);
  };

  useEffect(() => {
    void reload();
  }, []);


  useEffect(() => {
    if (!selectedTeamId) {
      setTeamStats(null);
      return;
    }
    api.teamStats(selectedTeamId).then(setTeamStats);
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedTeamId) {
      setTeamSeasonHistory(null);
      return;
    }
    setTeamSeasonLoading(true);
    api.teamSeasonHistory(selectedTeamId)
      .then((response) => setTeamSeasonHistory(response.seasons))
      .catch(() => setTeamSeasonHistory([]))
      .finally(() => setTeamSeasonLoading(false));
  }, [selectedTeamId]);

  useEffect(() => {
    if (!state) {
      return;
    }
    setDivisionFixtureGw((prev) => {
      const next = { ...prev };
      Object.keys(table).forEach((division) => {
        if (!next[division]) {
          next[division] = state.currentGw ?? GWS[0];
        }
      });
      return next;
    });
  }, [state, table]);


  return (
    <section className="page">
      <h1>League Table &amp; More</h1>
      <p className="muted">Current: {state ? `${state.currentSeason} ${state.currentGw}` : 'Loading...'}</p>

      <div className="tab-row">
        <button
          type="button"
          className={`tab-button ${activeTab === 'tables' ? 'active' : ''}`}
          onClick={() => setActiveTab('tables')}
        >
          Tables
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'playoffs' ? 'active' : ''}`}
          onClick={() => setActiveTab('playoffs')}
        >
          Playoffs
        </button>
      </div>

      {activeTab === 'tables' ? (
        <>
      {Object.entries(table).map(([division, rows]) => {
        const race = raceMeter(division);
        const gwForDivision = divisionFixtureGw[division] ?? state?.currentGw ?? GWS[0];
        const gwFixtures = leagueFixtures.filter((fixture) => fixture.division === division && fixture.gw === gwForDivision);
        return (
          <div key={division} className="panel">
            <h3>{displayDivisionName(division)}</h3>
            {race && (
              <div className="race-meter-row">
                <div className="race-meter-card">
                  <span className="race-meter-title">Title Race Gap: {race.topGap} pts</span>
                  <div className="race-meter-track"><span className="race-meter-fill race-meter-top" style={{ width: `${race.topPct}%` }} /></div>
                </div>
                <div className="race-meter-card">
                  <span className="race-meter-title">Relegation Gap: {race.dropGap} pts</span>
                  <div className="race-meter-track"><span className="race-meter-fill race-meter-drop" style={{ width: `${race.dropPct}%` }} /></div>
                </div>
              </div>
            )}
            <table>
              <thead>
                <tr><th>Rank</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th><th>Profit</th><th>Spins</th><th>Form (Last 5)</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const divisionIndex = DIVISION_ORDER.indexOf(division);
                  const isPromotionSlot = divisionIndex > 0 && row.rank === 1;
                  const isRelegationSlot = divisionIndex >= 0 && divisionIndex < DIVISION_ORDER.length - 1 && row.rank === rows.length;
                  const isPlayoffChaser = divisionIndex > 0 && row.rank === 2;
                  const isPlayoffDefender = divisionIndex >= 0 && divisionIndex < DIVISION_ORDER.length - 1 && row.rank === 3;
                  const move = movementBadge(division, row.teamId);
                  return (
                    <tr
                      key={row.teamId}
                      className={`${isPromotionSlot ? 'promotion-slot' : ''} ${isRelegationSlot ? 'relegation-slot' : ''} ${isPlayoffChaser ? 'playoff-chaser' : ''} ${isPlayoffDefender ? 'playoff-defender' : ''}`.trim()}
                    >
                      <td>
                        <div className="rank-cell">
                          <span>{row.rank}</span>
                          <span className={`rank-move ${move.className}`}>{move.label}</span>
                        </div>
                      </td>
                      <td>
                        <span className="team-name">
                          <TeamBadge
                            name={row.teamName}
                            ballColor={teamByName.get(row.teamName)?.ballColor ?? null}
                            ringColor={teamByName.get(row.teamName)?.ringColor ?? null}
                            textColor={teamByName.get(row.teamName)?.textColor ?? null}
                            size={24}
                          />
                          {row.teamName}
                        </span>
                      </td>
                      <td>{row.played}</td>
                      <td>{row.wins}</td>
                      <td>{row.draws}</td>
                      <td>{row.losses}</td>
                      <td>{row.points}</td>
                      <td>{row.profit}</td>
                      <td>{row.spins}</td>
                      <td>
                        <div className="form-mini-row">
                          {formForTeam(row.teamName).map((r, idx) => (
                            <span
                              key={`${row.teamId}-${idx}-${r}`}
                              className={`form-badge ${r === 'W' ? 'form-win' : r === 'D' ? 'form-draw' : 'form-loss'}`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="division-fixtures">
              <div className="division-fixtures-header">
                <h5>Fixtures</h5>
                <label className="inline-select">
                  GW
                  <select
                    value={gwForDivision}
                    onChange={(e) => setDivisionFixtureGw((prev) => ({ ...prev, [division]: e.target.value }))}
                  >
                    {GWS.map((gw) => <option key={`division-${division}-${gw}`} value={gw}>{gw}</option>)}
                  </select>
                </label>
              </div>
              {gwFixtures.length === 0 ? (
                <p className="muted">No fixtures loaded for {gwForDivision}.</p>
              ) : (
                <div className="division-fixture-list">
                  {gwFixtures.map((fixture) => (
                    <div key={fixture.id} className="division-fixture-row">
                      <div className="fixture-row">
                        <strong>{fixture.homeTeam}</strong> ({fixture.homeProfit}) vs <strong>{fixture.awayTeam}</strong> ({fixture.awayProfit}) - {fixture.result}
                        {rivalryIds.has(fixture.id) && <span className="rivalry-chip">Rivalry</span>}
                        <span className={`difficulty-chip ${difficultyClass(fixture.division, fixture.awayTeam)}`}>Home Difficulty</span>
                        <span className={`difficulty-chip ${difficultyClass(fixture.division, fixture.homeTeam)}`}>Away Difficulty</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="panel">
        <h3>Rivalry Week</h3>
        {!state ? (
          <p className="muted">Loading...</p>
        ) : rivalryFixtures.length === 0 ? (
          <p className="muted">No rivalry fixtures available for {state.currentGw}.</p>
        ) : (
          rivalryFixtures.map((fixture) => (
            <div key={`rivalry-${fixture.id}`} className="fixture-row">
              <strong>{displayDivisionName(fixture.division)}</strong>: {fixture.homeTeam} vs {fixture.awayTeam}
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h3>Cup Bracket (GW2-GW6)</h3>
        {cup.map((fixture) => {
          const upset = classifyUpset(fixture.homeTeam, fixture.awayTeam, ratings);
          return (
            <div key={fixture.id} className="fixture-row">
              <strong>{fixture.gw}</strong> {fixture.roundName}: {fixture.homeTeam ?? 'BYE'} vs {fixture.awayTeam ?? 'BYE'} - Winner: {fixture.winnerTeam ?? 'TBD'}
              {upset && (
                <span className={`upset-chip ${upset.level === 'huge' ? 'upset-huge' : 'upset-watch'}`}>
                  {upset.level === 'huge' ? 'Huge upset' : 'Upset watch'}: {upset.underdog} over {upset.favorite}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h3>Trophy Room</h3>
        <div className="grid-row">
          <div>
            <h4>Cup Trophy</h4>
            {trophyRoom.cup.length === 0 ? (
              <p className="muted">No winners yet.</p>
            ) : (
              trophyRoom.cup.map((item, idx) => <div key={`${item.season}-${item.teamName}-${idx}`}>{item.season}: {item.teamName}</div>)
            )}
          </div>
          <div>
            <h4>Bookie d&apos;Or</h4>
            {trophyRoom.bookieDor.length === 0 ? (
              <p className="muted">No winners yet.</p>
            ) : (
              trophyRoom.bookieDor.map((item, idx) => <div key={`dor-${item.season}-${item.teamName}-${idx}`}>{item.season}: {item.teamName}</div>)
            )}
          </div>
          {Object.entries(trophyRoom.divisions).map(([division, winners]) => (
            <div key={division}>
              <h4>{displayDivisionName(division)} Trophy</h4>
              {winners.length === 0 ? (
                <p className="muted">No winners yet.</p>
              ) : (
                winners.map((item, idx) => <div key={`${division}-${item.season}-${item.teamName}-${idx}`}>{item.season}: {item.teamName}</div>)
              )}
            </div>
          ))}
          {Object.entries(trophyRoom.goalsOfSeason).map(([division, winners]) => (
            <div key={`goal-${division}`}>
              <h4>{displayDivisionName(division)} Goal of the Season</h4>
              {winners.length === 0 ? (
                <p className="muted">No winners yet.</p>
              ) : (
                winners.map((item, idx) => <div key={`goal-${division}-${item.season}-${item.teamName}-${idx}`}>{item.season}: {item.teamName}</div>)
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Team Drill-down</h3>
        <select value={selectedTeamId ?? ''} onChange={(e) => setSelectedTeamId(Number(e.target.value))}>
          <option value="">Select team</option>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        {teamStats && (
          <div>
            <p>Season Stats: Profit {teamStats.season.profit} | Wins {teamStats.season.wins} | Entries {teamStats.season.entries}</p>
            <p>All-Time Stats: Profit {teamStats.allTime.profit} | Wins {teamStats.allTime.wins} | Entries {teamStats.allTime.entries}</p>
            <p>Cup Wins: {teamStats.cupWins} | League Titles: {teamStats.leagueTitles}</p>
            {selectedTeamRow && (
              <p>Season Spins: {selectedTeamRow.spins}</p>
            )}
          </div>
        )}
        {selectedTeamId && (
          <div className="team-story-wrap">
            {teamSeasonLoading ? (
              <p className="muted">Loading season history…</p>
            ) : teamSeasonHistory && teamSeasonHistory.length > 0 ? (
              <TeamSeasonStory history={teamSeasonHistory} />
            ) : (
              <p className="muted">No season history available yet.</p>
            )}
          </div>
        )}
      </div>
        </>
      ) : (
        <div className="panel">
          <h3>GW8 Playoffs &amp; Friendlies</h3>
          {!gw8Locked ? (
            <>
              <p className="muted">Playoff matchups update live until GW7 is completed.</p>
              <div className="fixture-list">
                {projectedPlayoffs.map((pair) => (
                  <div key={`${pair.upperDivision}-${pair.lowerDivision}`} className="fixture-row">
                    <strong>{displayDivisionName(pair.upperDivision)} 3rd</strong> {pair.upperTeam ?? 'TBD'} vs{' '}
                    <strong>{displayDivisionName(pair.lowerDivision)} 2nd</strong> {pair.lowerTeam ?? 'TBD'}
                  </div>
                ))}
              </div>
              <p className="muted">Friendlies will be drawn once GW7 is completed.</p>
            </>
          ) : (
            <>
              <div className="panel">
                <h4>Playoffs</h4>
                {playoffFixtures.length === 0 ? (
                  <p className="muted">No playoff fixtures found.</p>
                ) : (
                  <div className="fixture-list">
                    {playoffFixtures.map((fixture) => (
                      <div key={`playoff-${fixture.id}`} className="fixture-row">
                        <strong>{fixture.homeTeam}</strong> ({fixture.homeProfit}) vs <strong>{fixture.awayTeam}</strong> ({fixture.awayProfit}) - {fixture.result}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="panel">
                <h4>Friendlies</h4>
                {friendlyFixtures.length === 0 ? (
                  <p className="muted">No friendly fixtures found.</p>
                ) : (
                  <div className="fixture-list">
                    {friendlyFixtures.map((fixture) => (
                      <div key={`friendly-${fixture.id}`} className="fixture-row">
                        <strong>{fixture.homeTeam}</strong> ({fixture.homeProfit}) vs <strong>{fixture.awayTeam}</strong> ({fixture.awayProfit}) - {fixture.result}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
