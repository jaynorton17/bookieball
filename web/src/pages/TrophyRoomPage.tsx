import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';
import { sortWinnersMostRecent } from '../lib/formUtils';

const TIER_LEAGUE_ORDER = ['Legendary', 'Masters', 'Elite', 'Superior', 'Standard', 'Average', 'Poor', 'Awful'] as const;
type TrophyWinner = { season: string; teamName: string };
type TeamMeta = Awaited<ReturnType<typeof api.teams>>[number];
type TrophyRoomData = { cup: TrophyWinner[]; divisions: Record<string, TrophyWinner[]>; goalsOfSeason: Record<string, TrophyWinner[]>; bookieDor: TrophyWinner[]; masterLeague: TrophyWinner[]; masterCup: TrophyWinner[]; superCup: TrophyWinner[]; tierLeagues: Record<string, TrophyWinner[]> };
type TrophyCard = { key: string; title: string; trophy: 'cup' | 'super' | 'master'; tone: 'cup' | 'super' | 'master' | 'league'; winners: TrophyWinner[] };
const EMPTY_TROPHY_ROOM: TrophyRoomData = { cup: [], divisions: {}, goalsOfSeason: {}, bookieDor: [], masterLeague: [], masterCup: [], superCup: [], tierLeagues: {} };

function seasonNumber(season: string): number { return Number(season.replace('S', '')) || 0; }
function countByTeam(rows: TrophyWinner[]): Array<[string, number]> { const counts = new Map<string, number>(); rows.forEach((row) => counts.set(row.teamName, (counts.get(row.teamName) ?? 0) + 1)); return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
function bestStreak(cards: TrophyCard[]): { teamName: string; competition: string; streak: number } | null {
  let best: { teamName: string; competition: string; streak: number } | null = null;
  cards.forEach((card) => { const rows = card.winners.slice().sort((a, b) => seasonNumber(a.season) - seasonNumber(b.season)); let previousTeam = ''; let previousSeason = -99; let streak = 0; rows.forEach((row) => { const season = seasonNumber(row.season); if (row.teamName === previousTeam && season === previousSeason + 1) streak += 1; else streak = 1; if (!best || streak > best.streak) best = { teamName: row.teamName, competition: card.title, streak }; previousTeam = row.teamName; previousSeason = season; }); });
  return best;
}
function longestWait(rows: TrophyWinner[]): { teamName: string; seasons: number } | null {
  const byTeam = new Map<string, number[]>(); rows.forEach((row) => { const seasons = byTeam.get(row.teamName) ?? []; seasons.push(seasonNumber(row.season)); byTeam.set(row.teamName, seasons); }); let best: { teamName: string; seasons: number } | null = null;
  byTeam.forEach((seasons, teamName) => { const ordered = [...new Set(seasons)].sort((a, b) => a - b); for (let index = 1; index < ordered.length; index += 1) { const gap = ordered[index] - ordered[index - 1] - 1; if (gap > 0 && (!best || gap > best.seasons)) best = { teamName, seasons: gap }; } }); return best;
}
function HonourHero({ label, record, team, trophy }: { label: string; record: [string, number] | null; team?: TeamMeta; trophy: 'cup' | 'super' | 'master' }) { return <article className="trophy-honour-hero"><span>{label}</span><div className="trophy-honour-main"><TeamBadge name={record?.[0] ?? '—'} ballColor={team?.ballColor ?? null} ringColor={team?.ringColor ?? null} textColor={team?.textColor ?? null} size={54} /><div><strong>{record?.[0] ?? '—'}</strong><b>{record ? `${record[1]} HONOURS` : '—'}</b></div><CompetitionTrophyMark variant={trophy} className="trophy-honour-mark" /></div></article>; }
function TrophyShelf({ card, teamByName }: { card: TrophyCard; teamByName: Map<string, TeamMeta> }) { return <details className={`trophy-shelf tone-${card.tone}`}><summary className="trophy-shelf-head"><CompetitionTrophyMark variant={card.trophy} className="trophy-shelf-mark" /><div><h3>{card.title}</h3><p>{card.winners.length ? `${card.winners.length} honours · click for archive` : 'No winner yet'}</p></div></summary><div className="trophy-recent-winners">{card.winners.length === 0 ? <span className="muted">No winners yet.</span> : card.winners.map((winner, index) => { const team = teamByName.get(winner.teamName); return <div key={`${card.key}-${winner.season}-${winner.teamName}-${index}`} className="trophy-recent-row"><span>{winner.season}</span><TeamBadge name={winner.teamName} ballColor={team?.ballColor ?? null} ringColor={team?.ringColor ?? null} textColor={team?.textColor ?? null} size={18} /><strong>{winner.teamName}</strong></div>; })}</div></details>; }

export function TrophyRoomPage() {
  const [trophyRoom, setTrophyRoom] = useState<TrophyRoomData>(EMPTY_TROPHY_ROOM); const [teams, setTeams] = useState<TeamMeta[]>([]);
  useEffect(() => { Promise.all([api.trophyRoom().catch(() => null), api.teams().catch(() => [] as TeamMeta[])]).then(([payload, teamRows]) => { setTeams(teamRows); if (!payload) { setTrophyRoom(EMPTY_TROPHY_ROOM); return; } setTrophyRoom({ cup: Array.isArray(payload.cup) ? payload.cup : [], divisions: payload.divisions && typeof payload.divisions === 'object' ? payload.divisions : {}, goalsOfSeason: payload.goalsOfSeason && typeof payload.goalsOfSeason === 'object' ? payload.goalsOfSeason : {}, bookieDor: Array.isArray(payload.bookieDor) ? payload.bookieDor : [], masterLeague: Array.isArray(payload.masterLeague) ? payload.masterLeague : [], masterCup: Array.isArray(payload.masterCup) ? payload.masterCup : [], superCup: Array.isArray(payload.superCup) ? payload.superCup : [], tierLeagues: payload.tierLeagues && typeof payload.tierLeagues === 'object' ? payload.tierLeagues : {} }); }); }, []);

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);
  const coreCards = useMemo<TrophyCard[]>(() => [
    { key: 'bookie-dor', title: "Bookie d'Or", trophy: 'super', tone: 'super', winners: sortWinnersMostRecent(trophyRoom.bookieDor) },
    { key: 'super-cup', title: 'Super Cup', trophy: 'super', tone: 'super', winners: sortWinnersMostRecent(trophyRoom.superCup) },
    { key: 'cup', title: 'BookieBall Cup', trophy: 'cup', tone: 'cup', winners: sortWinnersMostRecent(trophyRoom.cup) },
    { key: 'master-league', title: 'Master League', trophy: 'master', tone: 'league', winners: sortWinnersMostRecent(trophyRoom.masterLeague) },
    { key: 'master-cup', title: 'Master Cup', trophy: 'master', tone: 'master', winners: sortWinnersMostRecent(trophyRoom.masterCup) },
  ], [trophyRoom]);
  const archiveCards = useMemo<TrophyCard[]>(() => [
    ...TIER_LEAGUE_ORDER.map((division) => ({ key: `tier-${division}`, title: `Tier · ${division}`, trophy: 'master' as const, tone: 'league' as const, winners: sortWinnersMostRecent(Array.isArray(trophyRoom.tierLeagues[division]) ? trophyRoom.tierLeagues[division] : []) })),
    ...Object.entries(trophyRoom.divisions).map(([division, winners]) => ({ key: `division-${division}`, title: displayDivisionName(division), trophy: 'cup' as const, tone: 'league' as const, winners: sortWinnersMostRecent(Array.isArray(winners) ? winners : []) })),
  ], [trophyRoom]);
  const allCards = useMemo(() => [...coreCards, ...archiveCards], [coreCards, archiveCards]);
  const honours = useMemo(() => allCards.flatMap((card) => card.winners.map((winner) => ({ ...winner, competition: card.title }))), [allCards]);
  const mostDecorated = useMemo(() => countByTeam(honours)[0] ?? null, [honours]);
  const mostRecent = useMemo(() => honours.slice().sort((a, b) => seasonNumber(b.season) - seasonNumber(a.season))[0] ?? null, [honours]);
  const cupKing = useMemo(() => countByTeam([...trophyRoom.cup, ...trophyRoom.masterCup, ...trophyRoom.superCup])[0] ?? null, [trophyRoom]);
  const leagueKing = useMemo(() => countByTeam([...Object.values(trophyRoom.divisions).flat(), ...trophyRoom.masterLeague, ...Object.values(trophyRoom.tierLeagues).flat()])[0] ?? null, [trophyRoom]);
  const streak = useMemo(() => bestStreak(allCards), [allCards]); const wait = useMemo(() => longestWait(honours), [honours]);

  return <section className="page page-dashboard competition-page competition-page-trophy"><div className="competition-page-shell">
    <header className="competition-page-hero competition-page-hero-trophy"><div className="competition-page-hero-head"><div className="competition-page-hero-copy"><span className="competition-page-kicker">Honours Board</span><h1>Trophy Room</h1><p>16 seasons of BookieBall honours.</p></div><div className="competition-hero-art competition-hero-art-triple" aria-hidden="true"><CompetitionTrophyMark variant="super" className="competition-hero-trophy trophy-super" /><CompetitionTrophyMark variant="cup" className="competition-hero-trophy trophy-cup" /><CompetitionTrophyMark variant="master" className="competition-hero-trophy trophy-master" /></div></div></header>
    <div className="trophy-honour-heroes"><HonourHero label="MOST DECORATED" record={mostDecorated} team={mostDecorated ? teamByName.get(mostDecorated[0]) : undefined} trophy="super" /><HonourHero label="CUP KING" record={cupKing} team={cupKing ? teamByName.get(cupKing[0]) : undefined} trophy="cup" /><HonourHero label="LEAGUE KING" record={leagueKing} team={leagueKing ? teamByName.get(leagueKing[0]) : undefined} trophy="master" /></div>
    <div className="trophy-record-strip"><article><span>Longest title streak</span><strong>{streak ? `${streak.teamName} · ${streak.streak} straight` : '—'}</strong><small>{streak?.competition ?? ''}</small></article><article><span>Longest wait between honours</span><strong>{wait ? `${wait.teamName} · ${wait.seasons} seasons` : '—'}</strong></article><article><span>Latest honour</span><strong>{mostRecent ? `${mostRecent.season} · ${mostRecent.teamName}` : '—'}</strong><small>{mostRecent?.competition ?? ''}</small></article></div>
    <div className="trophy-cabinet trophy-cabinet-core">{coreCards.map((card) => <TrophyShelf key={card.key} card={card} teamByName={teamByName} />)}</div>
    <details className="panel trophy-archive-drawer"><summary><strong>Division &amp; Tier Honours Archive</strong> <span className="muted">· {archiveCards.length} competitions</span></summary><div className="trophy-archive-grid">{archiveCards.map((card) => { const latest = card.winners[0]; return <div key={card.key} className="trophy-archive-row"><strong>{card.title}</strong><span>{latest ? `${latest.season} · ${latest.teamName}` : 'No winner yet'}</span><b>{card.winners.length}</b></div>; })}</div></details>
    <div className="panel competition-panel competition-panel-inline"><div className="panel-header"><div><h3>Season Finale</h3><p className="muted">End-of-season presentation and awards deck.</p></div><Link className="action" to="/season-finale">Open Finale</Link></div></div>
  </div></section>;
}
