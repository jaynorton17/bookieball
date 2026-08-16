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
    void loadTeamCareer(selectedId).then((next) => {
      if (active) setCareer(next);
    }).catch(() => {
      if (active) setCareer(null);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open, selectedId]);

  const selectedTeam = teams.find((team) => team.id === selectedId) ?? null;
  const points = useMemo(() => {
    if (!career?.seasons.length) return [];
    const levels = career.seasons.map((season) => season.competitions.league.divisionLevel ?? 1);
    const maxLevel = Math.max(1, ...levels);
    return career.seasons.map((season, index) => {
      const league = season.competitions.league;
      const x = career.seasons.length <= 1 ? 50 : 5 + (index / (career.seasons.length - 1)) * 90;
      const level = league.divisionLevel ?? maxLevel;
      const rank = league.rank ?? 1;
      const total = league.total ?? Math.max(rank, 8);
      const withinDivision = total > 1 ? (rank - 1) / (total - 1) : 0;
      const normalized = ((level - 1) + withinDivision) / Math.max(1, maxLevel);
      return { season, x, y: 12 + normalized * 68 };
    });
  }, [career]);

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
              <svg viewBox="0 0 100 88" preserveAspectRatio="none" style={{ width: '100%', minWidth: 900, height: 340, overflow: 'visible' }}>
                {[0, 1, 2, 3, 4].map((line) => <line key={line} x1="3" x2="97" y1={12 + line * 17} y2={12 + line * 17} stroke="rgba(255,255,255,.08)" strokeWidth=".25" />)}
                <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#5eb7ff" strokeWidth=".7" vectorEffect="non-scaling-stroke" />
                {points.map((point) => (
                  <g key={point.season.season}>
                    <circle cx={point.x} cy={point.y} r="1.9" fill={selectedTeam?.ballColor ?? '#5eb7ff'} stroke={selectedTeam?.ringColor ?? '#fff'} strokeWidth=".45" vectorEffect="non-scaling-stroke" />
                    <text x={point.x} y={84} textAnchor="middle" fill="#91a8bd" fontSize="2.4">{point.season.season}</text>
                    <text x={point.x} y={Math.max(5, point.y - 4)} textAnchor="middle" fill="#f7fbff" fontSize="2.2">#{point.season.competitions.league.rank ?? '—'}</text>
                  </g>
                ))}
              </svg>
              <div style={{ color: '#91a8bd', fontSize: 11, marginTop: -10 }}>The team ball rises and falls with its standard-league level and finishing position from season to season.</div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 9, marginTop: 12 }}>
              {career.seasons.map((season) => (
                <article key={season.season} style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 13, padding: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}><strong style={{ fontSize: 16 }}>{season.season}</strong><span style={{ color: '#5eb7ff', fontWeight: 900 }}>{season.competitions.league.label}</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 8px', color: '#91a8bd', fontSize: 10 }}>
                    {competitionRows.map(([key, name]) => {
                      const finish = season.competitions[key];
                      return <span key={`${season.season}-${key}`} style={{ display: 'contents' }}><span>{name}</span><strong style={{ color: finish.winner ? '#f2c14e' : finish.entered ? '#fff' : '#61788d' }}>{finish.label}</strong></span>;
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
