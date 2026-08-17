import { useCallback, useEffect, useMemo, useState } from 'react';
import { PenaltyShootoutBoard, type PenaltyTeam } from '../components/PenaltyShootoutBoard';
import { api } from '../lib/api';
import { onBookieBallEvent } from '../lib/appEvents';

type PenaltyCompetition = 'cup' | 'super_cup' | 'master_cup' | 'gw8_playoff' | 'trio_playoff';
type PenaltyTie = { competition: PenaltyCompetition; fixtureId: number; gw: string; roundName: string; homeTeamId: number; homeTeamName: string; awayTeamId: number; awayTeamName: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number };

function competitionLabel(value: PenaltyCompetition): string { if (value === 'cup') return 'BookieBall Cup'; if (value === 'super_cup') return 'Super Cup'; if (value === 'master_cup') return 'Master Cup'; if (value === 'trio_playoff') return 'Trio Playoff'; return 'GW8 Playoff'; }
function gwValue(gw: string): number { const parsed = Number(gw.replace('GW', '')); return Number.isFinite(parsed) ? parsed : 99; }
function sortQueue(queue: PenaltyTie[]): PenaltyTie[] { const order: Record<PenaltyCompetition, number> = { super_cup: 0, cup: 1, master_cup: 2, trio_playoff: 3, gw8_playoff: 4 }; return queue.slice().sort((a, b) => gwValue(a.gw) - gwValue(b.gw) || order[a.competition] - order[b.competition] || a.fixtureId - b.fixtureId); }

export function PenaltiesPage() {
  const [queue, setQueue] = useState<PenaltyTie[]>([]); const [teams, setTeams] = useState<PenaltyTeam[]>([]); const [selectedKey, setSelectedKey] = useState<string | null>(null); const [computerPlay, setComputerPlay] = useState(false); const [computerNonce, setComputerNonce] = useState(0); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [nextQueue, nextTeams] = await Promise.all([api.penaltyQueue().catch(() => [] as PenaltyTie[]), api.teams().catch(() => [])]);
      const sorted = sortQueue(nextQueue); setQueue(sorted); setTeams(nextTeams.map((team) => ({ id: team.id, name: team.name, ballColor: team.ballColor ?? null, ringColor: team.ringColor ?? null })));
      setSelectedKey((current) => { if (current && sorted.some((tie) => `${tie.competition}:${tie.fixtureId}` === current)) return current; return sorted[0] ? `${sorted[0].competition}:${sorted[0].fixtureId}` : null; });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const offMutation = onBookieBallEvent('data-mutated', () => void refresh());
    const offGameweek = onBookieBallEvent('gameweek-changed', () => void refresh());
    return () => { window.clearInterval(timer); offMutation(); offGameweek(); };
  }, [refresh]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const selected = useMemo(() => queue.find((tie) => `${tie.competition}:${tie.fixtureId}` === selectedKey) ?? null, [queue, selectedKey]);
  useEffect(() => { setComputerPlay(false); setNotice(''); }, [selectedKey]);

  const saveWinner = async (winner: { id: number; name: string }) => { if (!selected || busy) return; setBusy(true); setNotice(''); try { if (selected.competition === 'cup') await api.setCupWinner(selected.fixtureId, winner.id); else if (selected.competition === 'super_cup') await api.setSuperCupWinner(selected.fixtureId, winner.id); else if (selected.competition === 'master_cup') await api.setMasterCupWinner(selected.fixtureId, winner.id); else if (selected.competition === 'trio_playoff') await api.setTrioPlayoffWinner(selected.fixtureId, winner.id); else await api.setGw8PlayoffWinner(selected.fixtureId, winner.id); setNotice(`${winner.name} saved as the winner.`); await refresh(); } catch { setNotice('Could not save the shootout winner.'); } finally { setBusy(false); } };
  const computerTakeMatch = () => { if (!selected || busy) return; setNotice(''); setComputerNonce((value) => value + 1); setComputerPlay(true); };
  const skipMatch = async (tie: PenaltyTie) => { if (busy) return; setBusy(true); setNotice(''); try { await api.autoResolvePenalty(tie.competition, tie.fixtureId); setNotice(`${tie.homeTeamName} vs ${tie.awayTeamName} resolved automatically.`); await refresh(); } catch { setNotice('Could not auto-resolve that match.'); } finally { setBusy(false); } };
  const skipAll = async () => { if (busy || queue.length === 0) return; setBusy(true); setNotice(''); try { const result = await api.autoResolveAllPenalties(); setNotice(`Resolved ${result.count} of ${result.total} penalty match${result.total === 1 ? '' : 'es'}.`); await refresh(); } catch { setNotice('Could not resolve the penalty queue.'); } finally { setBusy(false); } };

  return <section className="page page-wide penalty-queue-page penalty-visual-pass"><div className="penalty-queue-page-head"><div><span className="hub-showcase-kicker">Live Decisions</span><h1>Penalties</h1><p className="muted">Select a waiting tie and run the shootout.</p></div><div className={`penalty-queue-total${queue.length ? ' live' : ''}`}><strong>{queue.length}</strong><span>{queue.length === 1 ? 'match waiting' : 'matches waiting'}</span></div></div>{notice && <div className="penalty-queue-notice">{notice}</div>}{loading ? <p className="muted">Loading penalty queue…</p> : queue.length === 0 ? <div className="penalty-queue-clear"><strong>Queue clear</strong><span>No matches currently need penalties.</span></div> : <div className="penalty-queue-layout"><div className="penalty-queue-list penalty-queue-rail"><div className="penalty-queue-list-head"><strong>Queue</strong><button type="button" className="secondary" disabled={busy} onClick={() => void skipAll()}>{busy ? 'Resolving…' : 'Resolve all'}</button></div>{queue.map((tie, index) => { const key = `${tie.competition}:${tie.fixtureId}`; const active = key === selectedKey; return <button type="button" key={key} className={`penalty-queue-row${active ? ' active' : ''}`} onClick={() => setSelectedKey(key)}><span className="penalty-queue-number">{index + 1}</span><span className="penalty-queue-copy"><span className="penalty-queue-meta">{competitionLabel(tie.competition)} · {tie.gw}</span><strong>{tie.homeTeamName} <span>vs</span> {tie.awayTeamName}</strong></span></button>; })}</div><div className="penalty-queue-stage">{selected && <><div className="penalty-queue-stage-head"><div><span className="hub-showcase-kicker">{competitionLabel(selected.competition)}</span><h2>{selected.homeTeamName} vs {selected.awayTeamName}</h2><p className="muted">{selected.gw} · {selected.roundName}</p></div>{!computerPlay && <div className="penalty-queue-actions"><button type="button" className="action" onClick={computerTakeMatch} disabled={busy}>Computer takes this match</button><button type="button" className="secondary" onClick={() => void skipMatch(selected)} disabled={busy}>Auto-resolve</button></div>}</div><PenaltyShootoutBoard homeTeam={teamById.get(selected.homeTeamId) ?? { id: selected.homeTeamId, name: selected.homeTeamName, ballColor: null, ringColor: null }} awayTeam={teamById.get(selected.awayTeamId) ?? { id: selected.awayTeamId, name: selected.awayTeamName, ballColor: null, ringColor: null }} resetKey={`${selected.competition}-${selected.fixtureId}-${computerPlay ? `computer-${computerNonce}` : 'manual'}`} autoStart={computerPlay} initialAutoPlay={computerPlay} autoConfirm={computerPlay} startLabel={computerPlay ? 'Computer is taking the full shootout…' : 'Take penalties'} confirmLabel={busy ? 'Saving…' : 'Confirm winner'} confirmDisabled={busy} showAutoTake={false} showAutoComplete={false} onConfirmWinner={(winner) => void saveWinner(winner)} /></>}</div></div>}</section>;
}
