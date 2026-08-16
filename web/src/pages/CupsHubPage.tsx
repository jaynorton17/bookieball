import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';

type Team = Awaited<ReturnType<typeof api.teams>>[number];
type CupFixture = Awaited<ReturnType<typeof api.cup>>[number];
type MasterCupFixture = Awaited<ReturnType<typeof api.masterCupFixtures>>[number];

type PathStep = {
  label: string;
  state: 'advanced' | 'out' | 'champion' | 'live' | 'waiting';
  opponent?: string;
};

type TeamPath = {
  teamName: string;
  teamId?: number;
  steps: PathStep[];
  status: string;
  champion: boolean;
};

const cupTiles = [
  { to: '/super-cup', eyebrow: 'Curtain Raiser', badge: 'GW1', title: 'Super Cup', description: 'Season opener between last season’s cup finalists.', tone: 'showcase', trophy: 'super' as const },
  { to: '/cup-draw', eyebrow: 'Main Knockout', badge: '32 slots', title: 'BookieBall Cup', description: 'Manual draw, bracket tracking, and round management.', tone: 'cup', trophy: 'cup' as const },
  { to: '/master-cup', eyebrow: 'Seeded Knockout', badge: 'Top 16', title: 'Master Cup', description: 'Top-16 seeded knockout with two-leg semi-finals.', tone: 'elite', trophy: 'master' as const },
];

const masterStageOrder: MasterCupFixture['stage'][] = ['round_of_16', 'quarter_final', 'semi_final', 'final'];

function masterStageLabel(stage: MasterCupFixture['stage']): string {
  if (stage === 'round_of_16') return 'R16';
  if (stage === 'quarter_final') return 'QF';
  if (stage === 'semi_final') return 'SF';
  if (stage === 'third_place_playoff') return '3rd';
  return 'Final';
}

function statusColor(state: PathStep['state']): string {
  if (state === 'champion') return '#f2c14e';
  if (state === 'advanced') return '#5cd68a';
  if (state === 'out') return '#ff7a84';
  if (state === 'live') return '#5eb7ff';
  return 'rgba(255,255,255,.18)';
}

function buildCupPaths(fixtures: CupFixture[], teams: Team[]): TeamPath[] {
  const teamByName = new Map(teams.map((team) => [team.name, team]));
  const roundOrder = Array.from(new Map(fixtures.map((fixture) => [fixture.round, fixture.roundName])).entries())
    .sort((a, b) => a[0] - b[0]);
  const participants = Array.from(new Set(fixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]).filter((name): name is string => Boolean(name))));
  const finalRound = roundOrder.at(-1)?.[0] ?? -1;

  return participants.map((teamName) => {
    let knockedOut = false;
    let champion = false;
    const steps: PathStep[] = roundOrder.map(([round, roundName]) => {
      if (knockedOut || champion) return { label: roundName, state: 'waiting' };
      const fixture = fixtures.find((row) => row.round === round && (row.homeTeam === teamName || row.awayTeam === teamName));
      if (!fixture) return { label: roundName, state: 'waiting' };
      const opponent = fixture.homeTeam === teamName ? fixture.awayTeam ?? 'BYE' : fixture.homeTeam ?? 'BYE';
      if (!fixture.winnerTeam) return { label: roundName, state: 'live', opponent };
      if (fixture.winnerTeam === teamName) {
        if (round === finalRound) {
          champion = true;
          return { label: roundName, state: 'champion', opponent };
        }
        return { label: roundName, state: 'advanced', opponent };
      }
      knockedOut = true;
      return { label: roundName, state: 'out', opponent };
    });
    const last = [...steps].reverse().find((step) => step.state !== 'waiting');
    const status = champion ? 'CHAMPION' : last?.state === 'out' ? `OUT · ${last.label}` : last?.state === 'live' ? `LIVE · ${last.label}` : 'STILL ALIVE';
    return { teamName, teamId: teamByName.get(teamName)?.id, steps, status, champion };
  }).sort((a, b) => Number(b.champion) - Number(a.champion) || (a.status.startsWith('OUT') ? 1 : 0) - (b.status.startsWith('OUT') ? 1 : 0) || a.teamName.localeCompare(b.teamName));
}

function buildMasterCupPaths(fixtures: MasterCupFixture[], teams: Team[]): TeamPath[] {
  const teamByName = new Map(teams.map((team) => [team.name, team]));
  const participants = Array.from(new Set(fixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]).filter((name): name is string => Boolean(name))));
  const finalWinner = fixtures.find((fixture) => fixture.stage === 'final' && fixture.winnerTeam)?.winnerTeam ?? null;

  return participants.map((teamName) => {
    let knockedOut = false;
    const steps: PathStep[] = masterStageOrder.map((stage) => {
      if (knockedOut) return { label: masterStageLabel(stage), state: 'waiting' };
      const stageFixtures = fixtures.filter((fixture) => fixture.stage === stage && (fixture.homeTeam === teamName || fixture.awayTeam === teamName));
      if (!stageFixtures.length) return { label: masterStageLabel(stage), state: 'waiting' };
      const deciding = [...stageFixtures].reverse().find((fixture) => fixture.winnerTeam) ?? stageFixtures.at(-1)!;
      const opponent = deciding.homeTeam === teamName ? deciding.awayTeam ?? 'TBD' : deciding.homeTeam ?? 'TBD';
      if (!deciding.winnerTeam) return { label: masterStageLabel(stage), state: 'live', opponent };
      if (deciding.winnerTeam === teamName) return { label: masterStageLabel(stage), state: stage === 'final' ? 'champion' : 'advanced', opponent };
      knockedOut = true;
      return { label: masterStageLabel(stage), state: 'out', opponent };
    });
    const champion = finalWinner === teamName;
    const last = [...steps].reverse().find((step) => step.state !== 'waiting');
    const status = champion ? 'CHAMPION' : last?.state === 'out' ? `OUT · ${last.label}` : last?.state === 'live' ? `LIVE · ${last.label}` : 'STILL ALIVE';
    return { teamName, teamId: teamByName.get(teamName)?.id, steps, status, champion };
  }).sort((a, b) => Number(b.champion) - Number(a.champion) || (a.status.startsWith('OUT') ? 1 : 0) - (b.status.startsWith('OUT') ? 1 : 0) || a.teamName.localeCompare(b.teamName));
}

function ProgressionBoard({ title, subtitle, paths, teams }: { title: string; subtitle: string; paths: TeamPath[]; teams: Team[] }) {
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  return (
    <section className="panel" style={{ padding: 18, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, marginBottom: 14 }}>
        <div><span className="hub-showcase-card-kicker">TOURNAMENT TRACKER</span><h2 style={{ margin: '4px 0' }}>{title}</h2><p className="muted" style={{ margin: 0 }}>{subtitle}</p></div>
        <span className="news-chip">{paths.filter((path) => !path.status.startsWith('OUT')).length} alive</span>
      </div>
      <div style={{ display: 'grid', gap: 7, maxHeight: 540, overflowY: 'auto', paddingRight: 4 }}>
        {paths.map((path) => {
          const team = path.teamId ? teamById.get(path.teamId) : undefined;
          return (
            <div key={`${title}-${path.teamName}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(145px, .9fr) minmax(0, 2.6fr) 110px', gap: 12, alignItems: 'center', padding: '9px 11px', borderRadius: 12, background: path.champion ? 'rgba(242,193,78,.10)' : 'rgba(255,255,255,.035)', border: `1px solid ${path.champion ? 'rgba(242,193,78,.32)' : 'rgba(255,255,255,.06)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {team && <TeamBadge name={team.name} ballColor={team.ballColor} ringColor={team.ringColor} textColor={team.textColor} size={24} />}
                <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{path.teamName}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {path.steps.map((step, index) => (
                  <div key={`${path.teamName}-${step.label}-${index}`} title={step.opponent ? `${step.label} vs ${step.opponent}` : step.label} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{ flex: 1, minWidth: 44, textAlign: 'center', borderRadius: 8, padding: '6px 4px', border: `1px solid ${statusColor(step.state)}`, background: `${statusColor(step.state)}18`, color: step.state === 'waiting' ? '#71869a' : statusColor(step.state), fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }}>{step.label}{step.state === 'out' ? ' ✕' : step.state === 'champion' ? ' ★' : step.state === 'advanced' ? ' ✓' : ''}</div>
                    {index < path.steps.length - 1 && <span style={{ width: 8, height: 1, background: step.state === 'advanced' || step.state === 'champion' ? '#5cd68a' : 'rgba(255,255,255,.12)' }} />}
                  </div>
                ))}
              </div>
              <strong style={{ textAlign: 'right', color: path.champion ? '#f2c14e' : path.status.startsWith('OUT') ? '#ff7a84' : '#5eb7ff', fontSize: 11 }}>{path.status}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CupsHubPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [cupFixtures, setCupFixtures] = useState<CupFixture[]>([]);
  const [masterCupFixtures, setMasterCupFixtures] = useState<MasterCupFixture[]>([]);
  const [season, setSeason] = useState('');

  useEffect(() => {
    let active = true;
    void api.state().then(async (state) => {
      const [teamRows, cupRows, masterRows] = await Promise.all([
        api.teams().catch(() => []),
        api.cup(undefined, state.currentSeason).catch(() => []),
        api.masterCupFixtures(undefined, true, state.currentSeason).catch(() => []),
      ]);
      if (!active) return;
      setSeason(state.currentSeason);
      setTeams(teamRows);
      setCupFixtures(cupRows);
      setMasterCupFixtures(masterRows);
    });
    return () => { active = false; };
  }, []);

  const cupPaths = useMemo(() => buildCupPaths(cupFixtures, teams), [cupFixtures, teams]);
  const masterPaths = useMemo(() => buildMasterCupPaths(masterCupFixtures, teams), [masterCupFixtures, teams]);

  return (
    <section className="page page-dashboard">
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}><div><h1 style={{ marginBottom: 4 }}>Cups</h1><p className="muted" style={{ margin: 0 }}>{season ? `${season} knockout picture` : 'Loading tournament picture…'}</p></div></div>
      <div className="hub-showcase-card-grid" style={{ marginTop: '1rem' }}>
        {cupTiles.map((tile) => (
          <Link key={tile.to} to={tile.to} className={`hub-showcase-card hub-showcase-card-${tile.tone}`}>
            <div className="hub-showcase-card-head"><span className="hub-showcase-card-kicker">{tile.eyebrow}</span><span className="hub-showcase-card-badge">{tile.badge}</span></div>
            <CompetitionTrophyMark variant={tile.trophy} className="hub-showcase-card-trophy" />
            <h2>{tile.title}</h2><p>{tile.description}</p><div className="hub-showcase-card-footer"><strong className="hub-showcase-card-action">Open</strong></div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
        {cupPaths.length > 0 && <ProgressionBoard title="BookieBall Cup Journey" subtitle="Follow every club from entry to elimination — green advances, red is the knockout point, gold is the champion." paths={cupPaths} teams={teams} />}
        {masterPaths.length > 0 && <ProgressionBoard title="Master Cup Journey" subtitle="Seeded route through the Round of 16, quarter-finals, two-leg semi-finals and final." paths={masterPaths} teams={teams} />}
      </div>
    </section>
  );
}
