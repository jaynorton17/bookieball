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
  ['league', 'League'],
  ['master', 'Master League'],
  ['trio', 'Trio League'],
  ['tier', 'Tier League'],
  ['bookieball_cup', 'BookieBall Cup'],
  ['master_cup', 'Master Cup'],
  ['super_cup', 'Super Cup'],
] as const;

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
    for (const point of points) {
      if (!seen.has(point.level)) seen.set(point.level, point.division);
    }
    const maxLevel = Math.max(1, ...Array.from(seen.keys()));
    return Array.from(seen.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([level, division]) => ({
        level,
        division,
        y: 16 + (maxLevel <= 1 ? 0.5 : (level - 1) / (maxLevel - 1)) * 54,
      }));
  }, [points]);

  const activePoint = points[Math.min(journeyIndex, Math.max(0, points.length - 1))] ?? null;

  if (!open) return null;

  return (
    <div className="team-journey-overlay" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(2,7,13,.94)', backdropFilter: 'blur(10px)', padding: 18, overflow: 'auto' }}>
      <div style={{ maxWidth: 1480, margin: '0 auto', minHeight: 'calc(100vh - 36px)', background: 'linear-gradient(145deg,#08192b,#06111f)', border: '1px solid rgba(126,187,239,.2)', borderRadius: 22, color: '#f7fbff', padding: 22 }}>
        <header style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ color: '#6ec5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.16em' }}>FULL TEAM JOURNEY</div>
            <h2 style={{ margin: '5px 0 0', fontSize: 30 }}>Every League & Cup</h2>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={selectedId ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))} style={{ background: '#0b2035', color: '#fff', border: '1px solid rgba(255,255,255,.18)', borderRadius: 9, padding: '9px 12px', minWidth: 220 }}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <button type="button" onClick={onClose} style={{ background: '#17324d', color: '#fff', border: '1px solid rgba(255,255,255,.16)', borderRadius: 9, padding: '9px 14px', cursor: 'pointer' }}>Close</button>
          </div>
        </header>

        {selectedTeam && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
            <TeamBadge name={selectedTeam.name} ballColor={selectedTeam.ballColor} ringColor={selectedTeam.ringColor} textColor={selectedTeam.textColor} size={42} />
            <div><strong style={{ fontSize: 20 }}>{selectedTeam.name}</strong><div style={{ color: '#91a8bd', fontSize: 12 }}>League · Master League · Trio · Tier · BookieBall Cup · Master Cup · Super Cup</div></div>
          </div>
        )}

        {loading ? <div style={{ padding: 40, color: '#91a8bd' }}>Building complete career…</div> : !career?.seasons.length ? <div style={{ padding: 40, color: '#91a8bd' }}>No historical journey available.</div> : (
          <>
            <section style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: 12, overflowX: 'auto' }}>
              <div style={{ position: 'relative', minWidth: 900, height: 350 }}>
                <svg viewBox="0 0 100 88" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
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
                      <circle r="2.75" fill={selectedTeam?.ballColor ?? '#5eb7ff'} stroke={selectedTeam?.ringColor ?? '#fff'} strokeWidth=".6" vectorEffect="non-scaling-stroke" />
                      <circle r="3.5" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".35" vectorEffect="non-scaling-stroke" />
                    </g>
                  )}
                </svg>
                {activePoint && (
                  <div style={{ position: 'absolute', right: 18, top: 14, padding: '7px 10px', borderRadius: 10, background: 'rgba(5,15,27,.82)', border: '1px solid rgba(94,183,255,.22)', textAlign: 'right' }}>
                    <strong style={{ display: 'block', color: '#fff', fontSize: 13 }}>{activePoint.season.season}</strong>
                    <span style={{ color: '#6ec5ff', fontSize: 11, fontWeight: 800 }}>{activePoint.division}</span>
                  </div>
                )}
              </div>
              <div style={{ color: '#91a8bd', fontSize: 11, marginTop: -4 }}>The ball travels through each season and moves vertically only when the team changes division.</div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 9, marginTop: 12 }}>
              {career.seasons.map((season) => (
                <article key={season.season} style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 13, padding: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}><strong style={{ fontSize: 16 }}>{season.season}</strong><span style={{ color: '#5eb7ff', fontWeight: 900 }}>{season.competitions.league.division ?? season.competitions.league.label}</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 8px', color: '#91a8bd', fontSize: 10 }}>
                    {competitionRows.map(([key, name]) => {
                      const finish = season.competitions[key];
                      const value = key === 'league' ? (finish.division ?? finish.label) : finish.label;
                      return <span key={`${season.season}-${key}`} style={{ display: 'contents' }}><span>{name}</span><strong style={{ color: finish.winner ? '#f2c14e' : finish.entered ? '#fff' : '#61788d' }}>{value}</strong></span>;
                    })}
                  </div>
                </article>
              ))}
            </section>

            {career.knockoutJourney.length > 0 && (
              <section style={{ marginTop: 14, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 13 }}>
                <div style={{ color: '#f2c14e', fontSize: 11, fontWeight: 900, letterSpacing: '.12em', marginBottom: 9 }}>CUP JOURNEY</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {career.knockoutJourney.map((step, index) => (
                    <div key={`${step.competition}-${step.season}-${step.fixtureId ?? index}`} style={{ minWidth: 150, padding: '8px 10px', borderRadius: 10, border: `1px solid ${step.outcome === 'winner' ? 'rgba(242,193,78,.48)' : step.outcome === 'eliminated' || step.outcome === 'runner_up' ? 'rgba(255,122,132,.3)' : 'rgba(92,214,138,.24)'}`, background: step.outcome === 'winner' ? 'rgba(242,193,78,.1)' : 'rgba(255,255,255,.025)' }}>
                      <strong style={{ display: 'block', fontSize: 11 }}>{step.season} · {step.round}</strong>
                      <span style={{ color: '#91a8bd', fontSize: 9 }}>{step.opponentTeamName ? `vs ${step.opponentTeamName}` : 'No opponent'}</span>
                      <div style={{ marginTop: 3, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', color: step.outcome === 'winner' ? '#f2c14e' : step.outcome === 'eliminated' || step.outcome === 'runner_up' ? '#ff9aa2' : '#79e5a1' }}>{step.outcome.replace('_', ' ')}</div>
                    </div>
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
