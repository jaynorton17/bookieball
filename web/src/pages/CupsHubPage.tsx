import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';

type Team = Awaited<ReturnType<typeof api.teams>>[number];
type CupFixture = Awaited<ReturnType<typeof api.cup>>[number];
type MasterCupFixture = Awaited<ReturnType<typeof api.masterCupFixtures>>[number];
type PathStep = { label: string; state: 'advanced' | 'out' | 'champion' | 'live' | 'waiting'; opponent?: string };
type TeamPath = { teamName: string; teamId?: number; steps: PathStep[]; status: string; champion: boolean };

const cupTiles = [
  { to: '/super-cup', eyebrow: 'Curtain Raiser', badge: 'GW1', title: 'Super Cup', description: 'Season opener.', tone: 'showcase', trophy: 'super' as const },
  { to: '/cup-draw', eyebrow: 'Main Knockout', badge: '32 slots', title: 'BookieBall Cup', description: 'Live bracket and draw.', tone: 'cup', trophy: 'cup' as const },
  { to: '/master-cup', eyebrow: 'Seeded Knockout', badge: 'Top 16', title: 'Master Cup', description: 'Seeded elite knockout.', tone: 'elite', trophy: 'master' as const },
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
  const roundOrder = Array.from(new Map(fixtures.map((fixture) => [fixture.round, fixture.roundName])).entries()).sort((a, b) => a[0] - b[0]);
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
        if (round === finalRound) { champion = true; return { label: roundName, state: 'champion', opponent }; }
        return { label: roundName, state: 'advanced', opponent };
      }
      knockedOut = true;
      return { label: roundName, state: 'out', opponent };
    });
    const last = [...steps].reverse().find((step) => step.state !== 'waiting');
    const status = champion ? 'CHAMPION' : last?.state === 'out' ? `OUT · ${last.label}` : last?.state === 'live' ? `LIVE · ${last.label}` : 'STILL ALIVE';
    return { teamName, teamId: teamByName.get(teamName)?.id, steps, status, champion };
  }).sort((a, b) => Number(b.champion) - Number(a.champion) || Number(a.status.startsWith('OUT')) - Number(b.status.startsWith('OUT')) || a.teamName.localeCompare(b.teamName));
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
  }).sort((a, b) => Number(b.champion) - Number(a.champion) || Number(a.status.startsWith('OUT')) - Number(b.status.startsWith('OUT')) || a.teamName.localeCompare(b.teamName));
}

function TournamentOverview({ title, to, paths, teams }: { title: string; to: string; paths: TeamPath[]; teams: Team[] }) {
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const stageLabels = paths[0]?.steps.map((step) => step.label) ?? [];
  return (
    <section className="panel cup-bracket-overview">
      <div className="panel-header"><div><h3>{title}</h3><p className="muted">Live route to the trophy</p></div><Link className="secondary" to={to}>Open Full Bracket</Link></div>
      <div className="cup-mini-bracket">
        {stageLabels.map((label, stageIndex) => {
          const stageTeams = paths.filter((path) => path.steps[stageIndex] && path.steps[stageIndex].state !== 'waiting').slice(0, 8);
          return <div key={`${title}-${label}`} className="cup-mini-round"><span>{label}</span><div>{stageTeams.map((path) => {
            const step = path.steps[stageIndex];
            const team = path.teamId ? teamById.get(path.teamId) : undefined;
            return <article key={`${label}-${path.teamName}`} style={{ borderColor: statusColor(step.state) }} title={step.opponent ? `${label} vs ${step.opponent}` : label}><TeamBadge name={path.teamName} ballColor={team?.ballColor ?? null} ringColor={team?.ringColor ?? null} textColor={team?.textColor ?? null} size={18} /><strong>{path.teamName}</strong><b>{step.state === 'champion' ? '🏆' : step.state === 'live' ? 'LIVE' : step.state === 'advanced' ? '✓' : 'OUT'}</b></article>;
          })}</div></div>;
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
      setSeason(state.currentSeason); setTeams(teamRows); setCupFixtures(cupRows); setMasterCupFixtures(masterRows);
    });
    return () => { active = false; };
  }, []);

  const cupPaths = useMemo(() => buildCupPaths(cupFixtures, teams), [cupFixtures, teams]);
  const masterPaths = useMemo(() => buildMasterCupPaths(masterCupFixtures, teams), [masterCupFixtures, teams]);
  const openBookieBallTies = cupFixtures.filter((fixture) => !fixture.winnerTeam && fixture.homeTeam && fixture.awayTeam).length;
  const openMasterTies = masterCupFixtures.filter((fixture) => !fixture.winnerTeam && fixture.homeTeam && fixture.awayTeam).length;
  const latestCup = cupFixtures.filter((fixture) => fixture.winnerTeam).slice().sort((a, b) => b.id - a.id)[0] ?? null;
  const nextCup = cupFixtures.find((fixture) => !fixture.winnerTeam && fixture.homeTeam && fixture.awayTeam) ?? null;
  const nextMaster = masterCupFixtures.find((fixture) => !fixture.winnerTeam && fixture.homeTeam && fixture.awayTeam) ?? null;

  return (
    <section className="page page-dashboard">
      <div className="cups-compact-head"><div><h1>Cups</h1><p className="muted">{season ? `${season} knockout picture` : 'Loading knockout picture…'}</p></div><span className="news-chip">{openBookieBallTies + openMasterTies} live ties</span></div>
      <div className="cup-quick-tiles">{cupTiles.map((tile) => <Link key={tile.to} to={tile.to} className={`hub-showcase-card hub-showcase-card-${tile.tone} cup-quick-tile`}><div className="hub-showcase-card-head"><span className="hub-showcase-card-kicker">{tile.eyebrow}</span><span className="hub-showcase-card-badge">{tile.badge}</span></div><CompetitionTrophyMark variant={tile.trophy} className="hub-showcase-card-trophy" /><h2>{tile.title}</h2><p>{tile.description}</p></Link>)}</div>

      <div className="cup-story-strip">
        <article><span>LATEST CUP RESULT</span><strong>{latestCup ? `${latestCup.winnerTeam} advanced` : 'No result yet'}</strong><small>{latestCup ? `${latestCup.roundName} · ${latestCup.homeTeam} ${latestCup.homeProfit.toFixed(2)} – ${latestCup.awayProfit.toFixed(2)} ${latestCup.awayTeam}` : 'BookieBall Cup'}</small></article>
        <article><span>NEXT BOOKIEBALL CUP TIE</span><strong>{nextCup ? `${nextCup.homeTeam} vs ${nextCup.awayTeam}` : 'No tie waiting'}</strong><small>{nextCup?.roundName ?? '—'}</small></article>
        <article><span>NEXT MASTER CUP TIE</span><strong>{nextMaster ? `${nextMaster.homeTeam} vs ${nextMaster.awayTeam}` : 'No tie waiting'}</strong><small>{nextMaster?.roundName ?? '—'}</small></article>
      </div>

      <div className="cup-bracket-grid"><TournamentOverview title="BookieBall Cup" to="/cup-draw" paths={cupPaths} teams={teams} /><TournamentOverview title="Master Cup" to="/master-cup" paths={masterPaths} teams={teams} /></div>
    </section>
  );
}
