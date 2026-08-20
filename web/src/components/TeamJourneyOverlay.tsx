import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { loadTeamCareer } from '../lib/teamCareer';
import type { TeamCareer } from '../lib/historyModels';
import { TeamBadge } from './TeamBadge';

type Team = Awaited<ReturnType<typeof api.teams>>[number];

type Props = {
  open: boolean;
  onClose: () => void;
};

const competitionRows = [
  ['league', 'Division League'],
  ['master', 'Master League'],
  ['trio', 'Trio League'],
  ['tier', 'Tier League'],
  ['bookieball_cup', 'BookieBall Cup'],
  ['master_cup', 'Master Cup'],
  ['super_cup', 'Super Cup'],
] as const;

function signed(value: number, digits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : ''}${safe.toFixed(digits)}`;
}

export function TeamJourneyOverlay({ open, onClose }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [career, setCareer] = useState<TeamCareer | null>(null);
  const [loading, setLoading] = useState(false);
  const [journeyIndex, setJourneyIndex] = useState(0);

  useEffect(() => {
    if (!open || teams.length) return;
    void api.teams().then((rows) => {
      const sorted = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
      setTeams(sorted);
      if (sorted[0]) setSelectedId((current) => current ?? sorted[0].id);
    }).catch(() => setTeams([]));
  }, [open, teams.length]);

  useEffect(() => {
    if (!open || !selectedId) return;
    let active = true;
    setLoading(true);
    setCareer(null);
    setJourneyIndex(0);
    void loadTeamCareer(selectedId).then((next) => {
      if (active) setCareer(next);
    }).catch(() => {
      if (active) setCareer(null);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open, selectedId]);

  useEffect(() => {
    if (!open || !career?.seasons.length) return;
    setJourneyIndex(0);
    const timer = window.setInterval(() => {
      setJourneyIndex((current) => (current + 1) % career.seasons.length);
    }, 1250);
    return () => window.clearInterval(timer);
  }, [open, career]);

  const selectedTeam = teams.find((team) => team.id === selectedId) ?? null;
  const points = useMemo(() => {
    if (!career?.seasons.length) return [];
    const levels = career.seasons.map((season) => season.competitions.league.divisionLevel ?? 1);
    const maxLevel = Math.max(1, ...levels);
    return career.seasons.map((season, index) => {
      const league = season.competitions.league;
      const x = career.seasons.length <= 1 ? 50 : 7 + (index / (career.seasons.length - 1)) * 86;
      const level = league.divisionLevel ?? maxLevel;
      const normalized = maxLevel <= 1 ? 0.5 : (level - 1) / (maxLevel - 1);
      return { season, x, y: 16 + normalized * 54, level, division: league.division ?? league.label };
    });
  }, [career]);

  const divisionBands = useMemo(() => {
    const seen = new Map<number, string>();
    for (const point of points) if (!seen.has(point.level)) seen.set(point.level, point.division);
    const maxLevel = Math.max(1, ...Array.from(seen.keys()));
    return Array.from(seen.entries()).sort((a, b) => a[0] - b[0]).map(([level, division]) => ({
      level,
      division,
      y: 16 + (maxLevel <= 1 ? 0.5 : (level - 1) / (maxLevel - 1)) * 54,
    }));
  }, [points]);

  const activePoint = points[Math.min(journeyIndex, Math.max(0, points.length - 1))] ?? null;

  if (!open) return null;

  return (
    <div className="team-journey-overlay">
      <div className="team-journey-shell">
        <header className="team-journey-header">
          <div>
            <span>FULL TEAM JOURNEY</span>
            <h2>Career &amp; Season Archive</h2>
          </div>
          <div className="team-journey-actions">
            <select value={selectedId ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </header>

        {loading ? <div className="team-journey-loading">Building complete career…</div> : !career || !selectedTeam ? <div className="team-journey-loading">No historical journey available.</div> : (
          <>
            <section className="team-career-hero">
              <div className="team-career-identity">
                <TeamBadge name={selectedTeam.name} ballColor={selectedTeam.ballColor} ringColor={selectedTeam.ringColor} textColor={selectedTeam.textColor} size={72} />
                <div>
                  <span>CAREER SUMMARY</span>
                  <h1>{selectedTeam.name}</h1>
                  <p>{career.seasons.length} seasons in the BookieBall archive</p>
                </div>
              </div>
              <div className="team-career-headlines">
                <article className="is-profit"><span>Total Profit</span><strong>{signed(career.summary.totalProfit)}</strong></article>
                <article><span>All-Time Points</span><strong>{career.summary.totalPoints}</strong><small>{career.summary.allTimePointsRank ? `#${career.summary.allTimePointsRank} all-time` : 'Rank unavailable'}</small></article>
                <article><span>Total Honours</span><strong>{career.summary.totalHonours}</strong></article>
              </div>
              <div className="team-career-record">
                <div><span>Played</span><b>{career.summary.totalPlayed}</b></div>
                <div><span>Won</span><b>{career.summary.totalWins}</b></div>
                <div><span>Drew</span><b>{career.summary.totalDraws}</b></div>
                <div><span>Lost</span><b>{career.summary.totalLosses}</b></div>
                <div><span>Spins</span><b>{career.summary.totalSpins}</b></div>
              </div>
            </section>

            <section className="team-career-trophies">
              <div className="team-journey-section-head"><div><span>HONOURS CABINET</span><h3>Every Competition</h3></div><p>The number is how many times this team has won that honour.</p></div>
              <div className="team-career-trophy-grid">
                {career.summary.trophies.map((trophy) => (
                  <article key={trophy.key} className={trophy.count > 0 ? 'has-wins' : 'is-empty'}>
                    <i aria-hidden="true">◆</i>
                    <strong>{trophy.label}</strong>
                    <b>{trophy.count}</b>
                  </article>
                ))}
              </div>
            </section>

            <section className="team-season-archive">
              <div className="team-journey-section-head"><div><span>SEASON BY SEASON</span><h3>Full Career Cards</h3></div><p>League record plus every competition finish for that season.</p></div>
              <div className="team-season-card-grid">
                {career.seasons.map((season) => {
                  const league = season.competitions.league;
                  const stats = season.stats;
                  const seasonWins = competitionRows.filter(([key]) => season.competitions[key].winner).map(([, name]) => name);
                  return (
                    <article key={season.season} className="team-season-card">
                      <header>
                        <div><span>SEASON</span><strong>{season.season}</strong></div>
                        <div className="team-season-division"><span>DIVISION</span><b>{league.division ?? league.label}</b><small>{league.rank ? `Finished #${league.rank}${league.total ? ` of ${league.total}` : ''}` : ''}</small></div>
                      </header>

                      {stats ? <div className="team-season-stat-grid">
                        <div><span>P</span><b>{stats.played}</b></div>
                        <div><span>W</span><b>{stats.wins}</b></div>
                        <div><span>D</span><b>{stats.draws}</b></div>
                        <div><span>L</span><b>{stats.losses}</b></div>
                        <div className="is-points"><span>PTS</span><b>{stats.points}</b></div>
                        <div className={stats.profit >= 0 ? 'is-profit positive' : 'is-profit negative'}><span>PROFIT</span><b>{signed(stats.profit)}</b></div>
                        <div><span>SPINS</span><b>{stats.spins}</b></div>
                      </div> : <div className="team-season-no-stats">No division match totals stored for this season.</div>}

                      {seasonWins.length > 0 && <div className="team-season-wins"><span>🏆 WON THIS SEASON</span><strong>{seasonWins.join(' · ')}</strong></div>}

                      <div className="team-season-competition-grid">
                        {competitionRows.map(([key, name]) => {
                          const finish = season.competitions[key];
                          const value = key === 'league' ? (finish.division ?? finish.label) : finish.label;
                          return <div key={`${season.season}-${key}`} className={`${finish.winner ? 'is-winner' : ''}${finish.entered ? '' : ' is-not-entered'}`}><span>{name}</span><strong>{value}</strong>{finish.rank && key !== 'league' ? <small>#{finish.rank}{finish.total ? ` / ${finish.total}` : ''}</small> : null}</div>;
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="team-journey-chart-card">
              <div className="team-journey-section-head"><div><span>DIVISION JOURNEY</span><h3>{selectedTeam.name} through the seasons</h3></div><p>The ball moves vertically when the team changes division.</p></div>
              <div className="team-journey-chart-wrap">
                <div className="team-journey-chart">
                  <svg viewBox="0 0 100 88" preserveAspectRatio="none">
                    {divisionBands.map((band) => (
                      <g key={`division-${band.level}`}>
                        <line x1="8" x2="96" y1={band.y} y2={band.y} stroke="rgba(255,255,255,.09)" strokeWidth=".25" />
                        <text x="2" y={band.y + 0.8} fill="#6ec5ff" fontSize="2.2" fontWeight="700">{band.division}</text>
                      </g>
                    ))}
                    <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#5eb7ff" strokeWidth=".65" opacity=".62" vectorEffect="non-scaling-stroke" />
                    {points.map((point, index) => (
                      <g key={point.season.season}>
                        <circle cx={point.x} cy={point.y} r=".75" fill={index <= journeyIndex ? '#5eb7ff' : '#29465f'} opacity={index <= journeyIndex ? .9 : .55} />
                        <text x={point.x} y="83" textAnchor="middle" fill={index === journeyIndex ? '#f7fbff' : '#91a8bd'} fontSize="2.4" fontWeight={index === journeyIndex ? '800' : '500'}>{point.season.season}</text>
                      </g>
                    ))}
                    {activePoint && (
                      <g style={{ transition: 'transform 900ms cubic-bezier(.22,.8,.25,1)' }} transform={`translate(${activePoint.x} ${activePoint.y})`}>
                        <circle r="2.75" fill={selectedTeam.ballColor ?? '#5eb7ff'} stroke={selectedTeam.ringColor ?? '#fff'} strokeWidth=".6" vectorEffect="non-scaling-stroke" />
                        <circle r="3.5" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".35" vectorEffect="non-scaling-stroke" />
                      </g>
                    )}
                  </svg>
                  {activePoint && <div className="team-journey-chart-label"><strong>{activePoint.season.season}</strong><span>{activePoint.division}</span></div>}
                </div>
              </div>
            </section>

            {career.knockoutJourney.length > 0 && (
              <section className="team-knockout-archive">
                <div className="team-journey-section-head"><div><span>CUP JOURNEY</span><h3>Knockout Record</h3></div><p>Round-by-round Cup, Master Cup and Super Cup history.</p></div>
                <div className="team-knockout-grid">
                  {career.knockoutJourney.map((step, index) => (
                    <article key={`${step.competition}-${step.season}-${step.fixtureId ?? index}`} className={`is-${step.outcome}`}>
                      <strong>{step.season} · {step.round}</strong>
                      <span>{step.opponentTeamName ? `vs ${step.opponentTeamName}` : 'No opponent'}</span>
                      <b>{step.outcome.replace('_', ' ')}</b>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
