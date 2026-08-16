import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';
import { CupTabs } from '../components/CompetitionTabs';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';

type TeamMeta = Awaited<ReturnType<typeof api.teams>>[number];
type SuperCupFixture = Awaited<ReturnType<typeof api.superCup>>[number];
type SuperCupArchiveRow = Awaited<ReturnType<typeof api.superCupArchive>>[number];

function pairingLabel(reason: SuperCupFixture['pairingReason']): string {
  if (reason === 'winners_vs_winners') {
    return 'Winners vs Winners';
  }
  if (reason === 'double_winner_vs_bookieball_runner_up') {
    return 'Double Winner vs BookieBall Runner-up';
  }
  return 'Double Winner vs Master Cup Runner-up';
}

function decidedByLabel(value: SuperCupFixture['decidedBy'] | SuperCupArchiveRow['decidedBy']): string {
  if (value === 'penalties') {
    return 'Penalties';
  }
  if (value === 'team_id') {
    return 'Lower team id';
  }
  if (value === 'pending') {
    return 'Pending';
  }
  if (value === 'profit') {
    return 'Profit';
  }
  return 'Spins';
}

function teamVars(team?: TeamMeta | null): CSSProperties {
  return {
    ['--team-ball' as string]: team?.ballColor ?? '#dbe7ff',
    ['--team-ring' as string]: team?.ringColor ?? '#7aa4bf',
    ['--team-text' as string]: team?.textColor ?? '#08111f',
  };
}

export function SuperCupPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [teams, setTeams] = useState<TeamMeta[]>([]);
  const [currentFixture, setCurrentFixture] = useState<SuperCupFixture | null>(null);
  const [history, setHistory] = useState<SuperCupArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [nextState, teamRows, currentRows, archiveRows] = await Promise.all([
          api.state(),
          api.teams().catch(() => [] as TeamMeta[]),
          api.superCup(),
          api.superCupArchive().catch(() => [] as SuperCupArchiveRow[]),
        ]);
        if (!active) {
          return;
        }
        setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
        setTeams(teamRows);
        setCurrentFixture(currentRows[0] ?? null);
        setHistory(archiveRows.slice().reverse());
        setMessage('');
      } catch (error) {
        if (!active) {
          return;
        }
        setMessage(error instanceof Error ? error.message : 'Unable to load the Super Cup.');
        setCurrentFixture(null);
        setHistory([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const homeMeta = currentFixture ? teamById.get(currentFixture.homeTeamId) : null;
  const awayMeta = currentFixture ? teamById.get(currentFixture.awayTeamId) : null;
  const completedCount = history.length;

  return (
    <section className="page page-wide competition-page competition-page-super">
      <div className="competition-page-shell">
        <header className="competition-page-hero competition-page-hero-super">
          <div className="competition-page-hero-head">
            <div className="competition-page-hero-copy">
              <span className="competition-page-kicker">Curtain Raiser</span>
              <h1>Super Cup</h1>
              <p>
                Standalone GW1 prestige fixture between the previous season&apos;s knockout standard-bearers.
                It opens the year without changing either main cup path or adding Bookie d&apos;Or weighting.
              </p>
            </div>
            <div className="competition-hero-art" aria-hidden="true">
              <CompetitionTrophyMark variant="super" className="competition-hero-trophy trophy-super" />
            </div>
          </div>

          <div className="competition-metric-row">
            <article className="competition-metric-card">
              <span>Live Slot</span>
              <strong>{state?.currentGw ?? 'GW1'}</strong>
              <p>Season opener only.</p>
            </article>
            <article className="competition-metric-card">
              <span>Format</span>
              <strong>1 Tie</strong>
              <p>Single prestige fixture built from prior winners.</p>
            </article>
            <article className="competition-metric-card">
              <span>Archive</span>
              <strong>{completedCount}</strong>
              <p>Completed Super Cup editions logged so far.</p>
            </article>
          </div>
        </header>

        <CupTabs activeId="super-cup" />

        {message ? (
          <div className="panel competition-panel">
            <p className="muted">{message}</p>
          </div>
        ) : null}

        <div className="competition-panel-grid">
          <div className="panel competition-panel competition-panel-feature">
            <div className="panel-header">
              <h3>{state?.currentSeason ?? 'Current'} Super Cup</h3>
              <span className="muted">
                {state ? `${state.currentSeason} ${state.currentGw}` : 'Loading fixture'}
              </span>
            </div>
            {loading ? (
              <p className="muted">Loading Super Cup fixture...</p>
            ) : !currentFixture ? (
              <p className="muted">No Super Cup fixture is available for this season yet.</p>
            ) : (
              <div className="competition-feature-card">
                <div className="competition-feature-meta">
                  <div>
                    <strong>{pairingLabel(currentFixture.pairingReason)}</strong>
                    <p className="muted">{currentFixture.pairingExplanation}</p>
                  </div>
                  <span className="competition-feature-chip">
                    {currentFixture.sourceSeason} legacy route
                  </span>
                </div>

                <div className="competition-versus-layout">
                  <article className="competition-team-card" style={teamVars(homeMeta)}>
                    <span className="competition-team-label">BookieBall Cup route</span>
                    <div className="competition-team-main">
                      <TeamBadge
                        name={currentFixture.homeTeam}
                        ballColor={homeMeta?.ballColor ?? null}
                        ringColor={homeMeta?.ringColor ?? null}
                        textColor={homeMeta?.textColor ?? null}
                        size={42}
                      />
                      <div>
                        <h4>{currentFixture.homeTeam}</h4>
                        <p>{currentFixture.bookieballWinnerTeam}</p>
                      </div>
                    </div>
                  </article>

                  <div className="competition-score-badge">
                    <span>{currentFixture.played ? decidedByLabel(currentFixture.decidedBy) : 'GW1'}</span>
                    <strong>
                      {currentFixture.played
                        ? `${currentFixture.homeProfit.toFixed(2)} - ${currentFixture.awayProfit.toFixed(2)}`
                        : 'vs'}
                    </strong>
                    <p>{currentFixture.winnerTeam ? `${currentFixture.winnerTeam} won` : 'Awaiting kickoff'}</p>
                  </div>

                  <article className="competition-team-card" style={teamVars(awayMeta)}>
                    <span className="competition-team-label">Master Cup route</span>
                    <div className="competition-team-main">
                      <TeamBadge
                        name={currentFixture.awayTeam}
                        ballColor={awayMeta?.ballColor ?? null}
                        ringColor={awayMeta?.ringColor ?? null}
                        textColor={awayMeta?.textColor ?? null}
                        size={42}
                      />
                      <div>
                        <h4>{currentFixture.awayTeam}</h4>
                        <p>{currentFixture.masterCupWinnerTeam}</p>
                      </div>
                    </div>
                  </article>
                </div>

                <div className="competition-note-strip">
                  <span>Prestige opener only</span>
                  <span>No Bookie d&apos;Or weighting</span>
                  <span>
                    {currentFixture.winnerTeam
                      ? `Winner: ${currentFixture.winnerTeam}`
                      : 'Winner settles once GW1 scores are in'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="panel competition-panel">
            <div className="panel-header">
              <h3>Super Cup Archive</h3>
              <span className="muted">{completedCount} completed editions</span>
            </div>
            {loading ? (
              <p className="muted">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="muted">No completed Super Cups yet.</p>
            ) : (
              <div className="competition-history-list">
                {history.map((row) => {
                  const winnerMeta = row.winnerTeamId ? teamById.get(row.winnerTeamId) : null;
                  const runnerMeta = row.runnerUpTeamId ? teamById.get(row.runnerUpTeamId) : null;
                  return (
                    <article key={`super-cup-history-${row.season}`} className="competition-history-card" style={teamVars(winnerMeta)}>
                      <div className="competition-history-head">
                        <strong>{row.season}</strong>
                        <span>{decidedByLabel(row.decidedBy)}</span>
                      </div>
                      <div className="competition-history-body">
                        <div className="competition-history-team">
                          <TeamBadge
                            name={row.winnerTeam ?? 'TBD'}
                            ballColor={winnerMeta?.ballColor ?? null}
                            ringColor={winnerMeta?.ringColor ?? null}
                            textColor={winnerMeta?.textColor ?? null}
                            size={28}
                          />
                          <div>
                            <strong>{row.winnerTeam ?? 'TBD'}</strong>
                            <p>Winner</p>
                          </div>
                        </div>
                        <div className="competition-history-score">{row.homeProfit.toFixed(2)} - {row.awayProfit.toFixed(2)}</div>
                        <div className="competition-history-team">
                          <TeamBadge
                            name={row.runnerUpTeam ?? 'TBD'}
                            ballColor={runnerMeta?.ballColor ?? null}
                            ringColor={runnerMeta?.ringColor ?? null}
                            textColor={runnerMeta?.textColor ?? null}
                            size={28}
                          />
                          <div>
                            <strong>{row.runnerUpTeam ?? 'TBD'}</strong>
                            <p>Runner-up</p>
                          </div>
                        </div>
                      </div>
                      <p className="competition-history-note">
                        {pairingLabel(row.pairingReason)} - {row.pairingExplanation}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
