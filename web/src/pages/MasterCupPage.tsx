import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CompetitionBracketTree, type CompetitionBracketRound, type CompetitionBracketTie } from '../components/StudioLiveWidgets';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';
import { CupTabs } from '../components/CompetitionTabs';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';

type TeamMeta = Awaited<ReturnType<typeof api.teams>>[number];
type MasterCupFixture = Awaited<ReturnType<typeof api.masterCupFixtures>>[number];

function gwNumber(gw: string): number {
  return Number(gw.replace('GW', '')) || 99;
}

function masterCupTeamLabel(fixture: MasterCupFixture, side: 'home' | 'away'): string {
  const teamName = side === 'home' ? fixture.homeTeam : fixture.awayTeam;
  const seed = side === 'home' ? fixture.homeSeed : fixture.awaySeed;
  if (!teamName) {
    return 'TBD';
  }
  return seed ? `#${seed} ${teamName}` : teamName;
}

function masterCupScoreLabel(fixture: MasterCupFixture): string {
  if (!fixture.played) {
    return fixture.roundName;
  }
  const base = `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`;
  if (
    fixture.stage === 'semi_final'
    && fixture.legNumber === 2
    && fixture.aggregateHomeProfit !== null
    && fixture.aggregateAwayProfit !== null
  ) {
    return `Agg ${fixture.aggregateHomeProfit.toFixed(2)} - ${fixture.aggregateAwayProfit.toFixed(2)}`;
  }
  return base;
}

function decidedByLabel(value: MasterCupFixture['decidedBy']): string {
  if (value === 'aggregate_penalties') return 'Agg pens';
  if (value === 'aggregate_profit') return 'Agg profit';
  if (value === 'aggregate_spins') return 'Agg spins';
  if (value === 'penalties') return 'Pens';
  if (value === 'profit') return 'Profit';
  if (value === 'spins') return 'Spins';
  if (value === 'walkover') return 'Walkover';
  return 'Pending';
}

function teamVars(team?: TeamMeta | null): CSSProperties {
  return {
    ['--team-ball' as string]: team?.ballColor ?? '#dbe7ff',
    ['--team-ring' as string]: team?.ringColor ?? '#8fb7ff',
    ['--team-text' as string]: team?.textColor ?? '#08111f',
  };
}

function fixtureToTie(fixture: MasterCupFixture, teamById: Map<number, TeamMeta>, currentGw: string | null): CompetitionBracketTie {
  const homeMeta = fixture.homeTeamId ? teamById.get(fixture.homeTeamId) : null;
  const awayMeta = fixture.awayTeamId ? teamById.get(fixture.awayTeamId) : null;
  return {
    id: `master-cup-${fixture.id}`,
    title: fixture.roundName,
    detail: fixture.played ? masterCupScoreLabel(fixture) : `${fixture.roundName} pending`,
    statusLabel: decidedByLabel(fixture.decidedBy),
    active: currentGw === fixture.gw,
    resolved: fixture.winnerTeamId !== null,
    winnerPath: fixture.winnerTeamId !== null,
    home: {
      teamName: masterCupTeamLabel(fixture, 'home'),
      score: fixture.played ? fixture.homeProfit.toFixed(2) : null,
      winner: fixture.winnerTeamId !== null && fixture.winnerTeamId === fixture.homeTeamId,
      ballColor: homeMeta?.ballColor ?? null,
      ringColor: homeMeta?.ringColor ?? null,
      textColor: homeMeta?.textColor ?? null,
    },
    away: {
      teamName: masterCupTeamLabel(fixture, 'away'),
      score: fixture.played ? fixture.awayProfit.toFixed(2) : null,
      winner: fixture.winnerTeamId !== null && fixture.winnerTeamId === fixture.awayTeamId,
      ballColor: awayMeta?.ballColor ?? null,
      ringColor: awayMeta?.ringColor ?? null,
      textColor: awayMeta?.textColor ?? null,
    },
  };
}

export function MasterCupPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [teams, setTeams] = useState<TeamMeta[]>([]);
  const [fixtures, setFixtures] = useState<MasterCupFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const reload = async () => {
      setLoading(true);
      try {
        const nextState = await api.state();
        const seasonNumber = Number(nextState.currentSeason.replace('S', '')) || 0;
        const [teamRows, nextFixtures] = await Promise.all([
          api.teams().catch(() => [] as TeamMeta[]),
          seasonNumber >= 5 ? api.masterCupFixtures(undefined, true) : Promise.resolve([] as MasterCupFixture[]),
        ]);
        if (!active) {
          return;
        }
        setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
        setTeams(teamRows);
        setFixtures(nextFixtures);
        setMessage('');
      } catch (error) {
        if (!active) {
          return;
        }
        setFixtures([]);
        setMessage(
          error instanceof Error
            ? `Master Cup API unavailable: ${error.message}`
            : 'Master Cup API unavailable. Restart the backend and try again.',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void reload();
    return () => {
      active = false;
    };
  }, []);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const currentGwFixtures = useMemo(
    () => (state ? fixtures.filter((fixture) => fixture.gw === state.currentGw) : []),
    [fixtures, state],
  );

  const sortedFixtures = useMemo(
    () => fixtures.slice().sort((a, b) => gwNumber(a.gw) - gwNumber(b.gw) || a.tieSlot - b.tieSlot || a.legNumber - b.legNumber || a.id - b.id),
    [fixtures],
  );

  const bracketRounds = useMemo<CompetitionBracketRound[]>(() => {
    if (sortedFixtures.length === 0) return [];

    const currentGw = state?.currentGw ?? null;

    const roundOf16 = sortedFixtures.filter((f) => f.stage === 'round_of_16');
    const quarterFinals = sortedFixtures.filter((f) => f.stage === 'quarter_final');
    const semiFinals = sortedFixtures.filter((f) => f.stage === 'semi_final');
    const final_ = sortedFixtures.filter((f) => f.stage === 'final');
    const thirdPlace = sortedFixtures.filter((f) => f.stage === 'third_place_playoff');

    const rounds: CompetitionBracketRound[] = [];

    if (roundOf16.length > 0) {
      rounds.push({
        key: 'r16',
        label: 'Round of 16',
        ties: roundOf16.map((f) => fixtureToTie(f, teamById, currentGw)),
      });
    }

    if (quarterFinals.length > 0) {
      rounds.push({
        key: 'qf',
        label: 'Quarter-Finals',
        ties: quarterFinals.map((f) => fixtureToTie(f, teamById, currentGw)),
      });
    }

    if (semiFinals.length > 0) {
      const leg1BySlot = new Map<number, MasterCupFixture>();
      const leg2BySlot = new Map<number, MasterCupFixture>();
      semiFinals.forEach((f) => {
        if (f.legNumber === 1) leg1BySlot.set(f.tieSlot, f);
        else leg2BySlot.set(f.tieSlot, f);
      });

      const semiTies: CompetitionBracketTie[] = [];
      const allSlots = [...new Set(semiFinals.map((f) => f.tieSlot))].sort((a, b) => a - b);
      allSlots.forEach((slot) => {
        const leg1 = leg1BySlot.get(slot);
        const leg2 = leg2BySlot.get(slot);
        const anchor = leg2 ?? leg1;
        if (!anchor) return;

        const homeMeta = anchor.homeTeamId ? teamById.get(anchor.homeTeamId) : null;
        const awayMeta = anchor.awayTeamId ? teamById.get(anchor.awayTeamId) : null;

        const bothPlayed = leg1?.played && leg2?.played;
        const aggHome = bothPlayed && leg2!.aggregateHomeProfit !== null ? leg2!.aggregateHomeProfit : null;
        const aggAway = bothPlayed && leg2!.aggregateAwayProfit !== null ? leg2!.aggregateAwayProfit : null;
        const resolved = anchor.winnerTeamId !== null;

        let detailText: string | null = null;
        let homeScore: string | null = null;
        let awayScore: string | null = null;

        if (aggHome !== null && aggAway !== null) {
          detailText = `Agg ${aggHome.toFixed(2)} - ${aggAway.toFixed(2)}`;
          homeScore = aggHome.toFixed(2);
          awayScore = aggAway.toFixed(2);
        } else if (leg1?.played) {
          detailText = `Leg 1: ${leg1.homeProfit.toFixed(2)} - ${leg1.awayProfit.toFixed(2)}`;
          homeScore = leg1.homeProfit.toFixed(2);
          awayScore = leg1.awayProfit.toFixed(2);
        }

        semiTies.push({
          id: `master-cup-semi-${slot}`,
          title: 'Semi-Final',
          detail: detailText ?? 'Semi-Final pending',
          statusLabel: resolved ? decidedByLabel(anchor.decidedBy) : bothPlayed ? 'Awaiting result' : 'Two-leg tie',
          active: currentGw === anchor.gw,
          resolved,
          winnerPath: resolved,
          home: {
            teamName: masterCupTeamLabel(anchor, 'home'),
            score: homeScore,
            winner: resolved && anchor.winnerTeamId === anchor.homeTeamId,
            ballColor: homeMeta?.ballColor ?? null,
            ringColor: homeMeta?.ringColor ?? null,
            textColor: homeMeta?.textColor ?? null,
          },
          away: {
            teamName: masterCupTeamLabel(anchor, 'away'),
            score: awayScore,
            winner: resolved && anchor.winnerTeamId === anchor.awayTeamId,
            ballColor: awayMeta?.ballColor ?? null,
            ringColor: awayMeta?.ringColor ?? null,
            textColor: awayMeta?.textColor ?? null,
          },
        });
      });

      rounds.push({
        key: 'sf',
        label: 'Semi-Finals',
        ties: semiTies,
      });
    }

    if (final_.length > 0) {
      rounds.push({
        key: 'final',
        label: 'Final',
        ties: final_.map((f) => fixtureToTie(f, teamById, currentGw)),
      });
    }

    return rounds;
  }, [sortedFixtures, state, teamById]);

  const sideMatch = useMemo<CompetitionBracketTie | null>(() => {
    const thirdPlaceFixtures = sortedFixtures.filter((f) => f.stage === 'third_place_playoff');
    if (thirdPlaceFixtures.length === 0) return null;
    const f = thirdPlaceFixtures[0];
    const currentGw = state?.currentGw ?? null;
    return fixtureToTie(f, teamById, currentGw);
  }, [sortedFixtures, state, teamById]);

  const seasonNumber = state ? Number(state.currentSeason.replace('S', '')) || 0 : 0;
  const resolvedCount = fixtures.filter((fixture) => fixture.winnerTeamId !== null).length;
  const [zoomPct, setZoomPct] = useState(100);
  const bracketScaleStyle: CSSProperties = {
    ['--bracket-scale' as string]: `${zoomPct / 100}`,
  };

  return (
    <section className="page page-wide competition-page competition-page-master">
      <div className="competition-page-shell">
        <header className="competition-page-hero competition-page-hero-master">
          <div className="competition-page-hero-head">
            <div className="competition-page-hero-copy">
              <span className="competition-page-kicker">Seeded Knockout</span>
              <h1>Master Cup</h1>
            </div>
            <div className="competition-hero-art" aria-hidden="true">
              <CompetitionTrophyMark variant="master" className="competition-hero-trophy trophy-master" />
            </div>
          </div>

          <div className="competition-metric-row">
            <article className="competition-metric-card">
              <span>Field</span>
              <strong>16</strong>
            </article>
            <article className="competition-metric-card">
              <span>Current GW</span>
              <strong>{state?.currentGw ?? 'GW1'}</strong>
            </article>
            <article className="competition-metric-card">
              <span>Resolved</span>
              <strong>{resolvedCount}/{fixtures.length || '?'}</strong>
            </article>
          </div>
        </header>

        <CupTabs activeId="master-cup" />

        {message ? (
          <div className="panel competition-panel">
            <p className="muted">{message}</p>
          </div>
        ) : null}

        <div className="panel competition-panel competition-panel-feature">
            <div className="panel-header">
              <h3>{state?.currentGw ?? 'Current'} Master Cup</h3>
              <span className="muted">{state?.currentSeason ?? 'Loading season'}</span>
            </div>
            {loading ? (
              <p className="muted">Loading Master Cup fixtures...</p>
            ) : seasonNumber < 5 ? (
              <p className="muted">Master Cup starts in Season 5.</p>
            ) : currentGwFixtures.length === 0 ? (
              <p className="muted">No Master Cup fixtures for this gameweek.</p>
            ) : (
              <div className="competition-fixture-grid">
                {currentGwFixtures.map((fixture) => {
                  const homeMeta = fixture.homeTeamId ? teamById.get(fixture.homeTeamId) : null;
                  const awayMeta = fixture.awayTeamId ? teamById.get(fixture.awayTeamId) : null;
                  return (
                    <article key={`master-cup-current-${fixture.id}`} className="competition-fixture-card">
                      <div className="competition-fixture-card-head">
                        <strong>{fixture.roundName}</strong>
                        <span>{fixture.played ? decidedByLabel(fixture.decidedBy) : fixture.legNumber > 1 ? `Leg ${fixture.legNumber}` : 'To be played'}</span>
                      </div>
                      <div className="competition-team-stack">
                        <div className={`competition-team-line${fixture.winnerTeamId === fixture.homeTeamId ? ' is-winner' : ''}`} style={teamVars(homeMeta)}>
                          <div className="competition-team-main">
                            <TeamBadge
                              name={fixture.homeTeam ?? 'TBD'}
                              ballColor={homeMeta?.ballColor ?? null}
                              ringColor={homeMeta?.ringColor ?? null}
                              textColor={homeMeta?.textColor ?? null}
                              size={34}
                            />
                            <div>
                              <h4>{masterCupTeamLabel(fixture, 'home')}</h4>
                              <p>{fixture.homeSeed ? `Seed ${fixture.homeSeed}` : 'Unseeded slot'}</p>
                            </div>
                          </div>
                          <div className="competition-team-score">
                            {fixture.played && <strong>{fixture.homeProfit.toFixed(2)}</strong>}
                            {fixture.winnerTeamId === fixture.homeTeamId && <span className="competition-winner-chip">WINNER</span>}
                          </div>
                        </div>
                        <div className={`competition-team-line${fixture.winnerTeamId === fixture.awayTeamId ? ' is-winner' : ''}`} style={teamVars(awayMeta)}>
                          <div className="competition-team-main">
                            <TeamBadge
                              name={fixture.awayTeam ?? 'TBD'}
                              ballColor={awayMeta?.ballColor ?? null}
                              ringColor={awayMeta?.ringColor ?? null}
                              textColor={awayMeta?.textColor ?? null}
                              size={34}
                            />
                            <div>
                              <h4>{masterCupTeamLabel(fixture, 'away')}</h4>
                              <p>{fixture.awaySeed ? `Seed ${fixture.awaySeed}` : 'Unseeded slot'}</p>
                            </div>
                          </div>
                          <div className="competition-team-score">
                            {fixture.played && <strong>{fixture.awayProfit.toFixed(2)}</strong>}
                            {fixture.winnerTeamId === fixture.awayTeamId && <span className="competition-winner-chip">WINNER</span>}
                          </div>
                        </div>
                      </div>
                      <div className="competition-note-strip">
                        <span className="competition-score-line">{fixture.played ? masterCupScoreLabel(fixture) : 'vs'}</span>
                        <span className={fixture.winnerTeam ? 'competition-through-line' : 'muted'}>
                          {fixture.winnerTeam ? `${fixture.winnerTeam} through` : 'Winner still pending'}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

        <div className="panel competition-panel competition-panel-bracket">
          <div className="panel-header">
            <h3>Master Cup Bracket</h3>
            <div className="bracket-zoom-controls">
              <span className="muted">{fixtures.length} scheduled ties</span>
              <span className="muted">Zoom</span>
              {[90, 100, 110].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`zoom-chip ${zoomPct === value ? 'active' : ''}`}
                  onClick={() => setZoomPct(value)}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <p className="muted">Loading Master Cup bracket...</p>
          ) : seasonNumber < 5 ? (
            <p className="muted">Master Cup starts in Season 5.</p>
          ) : bracketRounds.length === 0 ? (
            <p className="muted">No Master Cup fixtures available yet.</p>
          ) : (
            <div className="bracket-zoom-canvas" style={bracketScaleStyle}>
              <CompetitionBracketTree
                kicker="Master Cup"
                title="Seeded Bracket"
                subtitle="Round of 16 through to the final with aggregate semi-finals."
                rounds={bracketRounds}
                summary={[
                  `${resolvedCount}/${fixtures.length} ties resolved`,
                  state?.currentGw ? `Live: ${state.currentGw}` : 'Waiting for first round',
                ]}
                sideMatch={sideMatch}
                sideMatchLabel="Third-Place Playoff"
                fullNames
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
