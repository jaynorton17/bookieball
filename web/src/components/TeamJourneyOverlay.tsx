import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { TeamBadge } from './TeamBadge';

type Team = Awaited<ReturnType<typeof api.teams>>[number];
type Story = Awaited<ReturnType<typeof api.teamHistoryStoryBulk>>['histories'][number];
type SeasonRow = Awaited<ReturnType<typeof api.teamSeasonHistory>>['seasons'][number];
type MasterCupFixture = Awaited<ReturnType<typeof api.masterCupFixtures>>[number];

type Props = {
  open: boolean;
  onClose: () => void;
};

type SeasonSnapshot = {
  season: string;
  division: string;
  divisionRank: number | null;
  divisionTotal: number | null;
  divisionLevel: number | null;
  masterRank: number | null;
  masterTotal: number | null;
  trio: string | null;
  tier: string | null;
  cupFinish: string;
  masterCupFinish: string;
  superCupFinish: string;
};

function seasonNumber(value: string): number {
  const parsed = Number(value.replace('S', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function masterStageLabel(stage: MasterCupFixture['stage']): string {
  if (stage === 'round_of_16') return 'R16';
  if (stage === 'quarter_final') return 'QF';
  if (stage === 'semi_final') return 'SF';
  if (stage === 'third_place_playoff') return '3rd PO';
  return 'Final';
}

function masterCupFinish(fixtures: MasterCupFixture[], teamId: number): string {
  const involved = fixtures.filter((fixture) => fixture.homeTeamId === teamId || fixture.awayTeamId === teamId);
  if (!involved.length) return '—';
  const final = involved.find((fixture) => fixture.stage === 'final');
  if (final) {
    if (final.winnerTeamId === teamId) return 'Winner';
    if (final.played) return 'Runner-up';
    return 'Final';
  }
  const ordered: MasterCupFixture['stage'][] = ['round_of_16', 'quarter_final', 'semi_final', 'third_place_playoff'];
  const furthest = involved.slice().sort((a, b) => ordered.indexOf(b.stage) - ordered.indexOf(a.stage))[0];
  if (!furthest) return '—';
  if (furthest.played && furthest.winnerTeamId && furthest.winnerTeamId !== teamId) return `Out ${masterStageLabel(furthest.stage)}`;
  return masterStageLabel(furthest.stage);
}

function finishLabel(value: string | null | undefined): string {
  if (!value || value === 'none' || value === '—') return '—';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function TeamJourneyOverlay({ open, onClose }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [masterCupBySeason, setMasterCupBySeason] = useState<Record<string, MasterCupFixture[]>>({});
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
    void (async () => {
      try {
        const [storyPayload, historyPayload] = await Promise.all([
          api.teamHistoryStoryBulk([selectedId]),
          api.teamSeasonHistory(selectedId),
        ]);
        if (!active) return;
        const nextStory = storyPayload.histories[selectedId] ?? null;
        setStory(nextStory);
        setSeasonRows(historyPayload.seasons ?? []);

        const seasons = Array.from(new Set([
          ...(nextStory?.divisionJourney ?? []).map((row) => row.season),
          ...(nextStory?.masterLeagueJourney ?? []).map((row) => row.season),
          ...(historyPayload.seasons ?? []).map((row) => row.season),
        ])).sort((a, b) => seasonNumber(a) - seasonNumber(b));
        const masterEntries = await Promise.all(seasons.map(async (season) => [season, await api.masterCupFixtures(undefined, true, season).catch(() => [] as MasterCupFixture[])] as const));
        if (active) setMasterCupBySeason(Object.fromEntries(masterEntries));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, selectedId]);

  const selectedTeam = teams.find((team) => team.id === selectedId) ?? null;
  const snapshots = useMemo<SeasonSnapshot[]>(() => {
    if (!story || !selectedId) return [];
    const seasons = Array.from(new Set([
      ...story.divisionJourney.map((row) => row.season),
      ...story.masterLeagueJourney.map((row) => row.season),
      ...story.trioLeagueJourney.map((row) => row.season),
      ...story.tierLeagueJourney.map((row) => row.season),
      ...seasonRows.map((row) => row.season),
    ])).sort((a, b) => seasonNumber(a) - seasonNumber(b));
    return seasons.map((season) => {
      const division = story.divisionJourney.find((row) => row.season === season);
      const master = story.masterLeagueJourney.find((row) => row.season === season);
      const trio = story.trioLeagueJourney.find((row) => row.season === season);
      const tier = story.tierLeagueJourney.find((row) => row.season === season);
      const history = seasonRows.find((row) => row.season === season);
      return {
        season,
        division: division?.division ?? history?.division ?? '—',
        divisionRank: division?.rank ?? history?.rank ?? null,
        divisionTotal: division?.total ?? null,
        divisionLevel: division?.divisionLevel ?? null,
        masterRank: master?.rank ?? null,
        masterTotal: master?.total ?? null,
        trio: trio ? `${trio.division} #${trio.rank}` : null,
        tier: tier ? `${tier.division} #${tier.rank}` : null,
        cupFinish: finishLabel(history?.cupFinish),
        masterCupFinish: masterCupFinish(masterCupBySeason[season] ?? [], selectedId),
        superCupFinish: finishLabel(history?.superCupFinish),
      };
    });
  }, [story, seasonRows, masterCupBySeason, selectedId]);

  const maxLevel = Math.max(1, ...snapshots.map((row) => row.divisionLevel ?? 1));
  const points = snapshots.map((row, index) => {
    const x = snapshots.length <= 1 ? 50 : 5 + (index / (snapshots.length - 1)) * 90;
    const level = row.divisionLevel ?? maxLevel;
    const rank = row.divisionRank ?? 1;
    const total = row.divisionTotal ?? Math.max(rank, 8);
    const withinDivision = total > 1 ? (rank - 1) / (total - 1) : 0;
    const normalized = ((level - 1) + withinDivision) / Math.max(1, maxLevel);
    const y = 12 + normalized * 68;
    return { x, y, row };
  });

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(2,7,13,.92)', backdropFilter: 'blur(10px)', padding: 18, overflow: 'auto' }}>
      <div style={{ maxWidth: 1480, margin: '0 auto', minHeight: 'calc(100vh - 36px)', background: 'linear-gradient(145deg,#08192b,#06111f)', border: '1px solid rgba(126,187,239,.2)', borderRadius: 22, color: '#f7fbff', padding: 22 }}>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ color: '#6ec5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.16em' }}>16-SEASON TEAM JOURNEY</div>
            <h2 style={{ margin: '5px 0 0', fontSize: 30 }}>Career Progression</h2>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={selectedId ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))} style={{ background: '#0b2035', color: '#fff', border: '1px solid rgba(255,255,255,.18)', borderRadius: 9, padding: '9px 12px', minWidth: 220 }}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <button type="button" onClick={onClose} style={{ background: '#17324d', color: '#fff', border: '1px solid rgba(255,255,255,.16)', borderRadius: 9, padding: '9px 14px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>

        {selectedTeam && <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}><TeamBadge name={selectedTeam.name} ballColor={selectedTeam.ballColor} ringColor={selectedTeam.ringColor} textColor={selectedTeam.textColor} size={42} /><div><strong style={{ fontSize: 20 }}>{selectedTeam.name}</strong><div style={{ color: '#91a8bd', fontSize: 12 }}>League · Master League · BookieBall Cup · Master Cup · Super Cup</div></div></div>}

        {loading ? <div style={{ padding: 40, color: '#91a8bd' }}>Building team history…</div> : snapshots.length === 0 ? <div style={{ padding: 40, color: '#91a8bd' }}>No historical journey available for this team yet.</div> : (
          <>
            <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: 12, overflowX: 'auto' }}>
              <svg viewBox="0 0 100 88" preserveAspectRatio="none" style={{ width: '100%', minWidth: 900, height: 360, overflow: 'visible' }}>
                {[0,1,2,3,4].map((line) => <line key={line} x1="3" x2="97" y1={12 + line * 17} y2={12 + line * 17} stroke="rgba(255,255,255,.08)" strokeWidth=".25" />)}
                <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#5eb7ff" strokeWidth=".7" vectorEffect="non-scaling-stroke" />
                {points.map((point, index) => (
                  <g key={point.row.season}>
                    <circle cx={point.x} cy={point.y} r="1.9" fill={selectedTeam?.ballColor ?? '#5eb7ff'} stroke={selectedTeam?.ringColor ?? '#fff'} strokeWidth=".45" vectorEffect="non-scaling-stroke" />
                    <text x={point.x} y={84} textAnchor="middle" fill="#91a8bd" fontSize="2.4">{point.row.season}</text>
                    <text x={point.x} y={Math.max(5, point.y - 4)} textAnchor="middle" fill="#f7fbff" fontSize="2.2">#{point.row.divisionRank ?? '—'}</text>
                    {index === points.length - 1 && <text x={Math.min(94, point.x + 2)} y={Math.max(6, point.y + 4)} fill="#6ec5ff" fontSize="2.2">{point.row.division}</text>}
                  </g>
                ))}
              </svg>
              <div style={{ color: '#91a8bd', fontSize: 11, marginTop: -12 }}>The ball rises and falls with the club’s league level and finishing position each season.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 9, marginTop: 12 }}>
              {snapshots.map((row) => (
                <article key={`snapshot-${row.season}`} style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 13, padding: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{row.season}</strong><span style={{ color: '#5eb7ff', fontWeight: 900 }}>#{row.divisionRank ?? '—'}</span></div>
                  <div style={{ color: '#c8d7e5', fontSize: 12, marginTop: 4 }}>{row.division}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 8px', color: '#91a8bd', fontSize: 10, marginTop: 8 }}>
                    <span>Master League</span><strong style={{ color: '#fff' }}>{row.masterRank ? `#${row.masterRank}/${row.masterTotal ?? '—'}` : '—'}</strong>
                    <span>BookieBall Cup</span><strong style={{ color: '#fff' }}>{row.cupFinish}</strong>
                    <span>Master Cup</span><strong style={{ color: '#fff' }}>{row.masterCupFinish}</strong>
                    <span>Super Cup</span><strong style={{ color: '#fff' }}>{row.superCupFinish}</strong>
                    {row.trio && <><span>Trio</span><strong style={{ color: '#fff' }}>{row.trio}</strong></>}
                    {row.tier && <><span>Tier</span><strong style={{ color: '#fff' }}>{row.tier}</strong></>}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
