import { api } from './api';
import { displayDivisionName } from './divisionLabels';
import type { CompetitionFinish, TeamCareer, TeamSeasonCareer, KnockoutJourneyStep, TrophyCount } from './historyModels';
import type { CompetitionKey } from './competitionRegistry';

let careerCache = new Map<number, Promise<TeamCareer>>();

function label(value: string | null | undefined): string {
  if (!value || value === 'none') return '—';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function emptyFinish(competition: CompetitionKey): CompetitionFinish {
  return { competition, entered: false, label: '—', division: null, rank: null, total: null, stage: null, divisionLevel: null };
}

function stageLabel(stage: string): string {
  if (stage === 'round_of_16') return 'R16';
  if (stage === 'quarter_final') return 'Quarter-final';
  if (stage === 'semi_final') return 'Semi-final';
  if (stage === 'third_place_playoff') return '3rd-place playoff';
  if (stage === 'final') return 'Final';
  return label(stage);
}

function seasonNumber(season: string): number {
  return Number(season.replace(/\D/g, '')) || 0;
}

function winnerCount(rows: Array<{ teamName: string }> | undefined, teamName: string): number {
  return (rows ?? []).filter((row) => row.teamName === teamName).length;
}

export function clearTeamCareerCache(teamId?: number): void {
  if (teamId === undefined) careerCache.clear();
  else careerCache.delete(teamId);
}

export function loadTeamCareer(teamId: number): Promise<TeamCareer> {
  const existing = careerCache.get(teamId);
  if (existing) return existing;

  const pending = (async () => {
    const [teams, storyPayload, historyPayload, allTime, trophyRoom, state] = await Promise.all([
      api.teams(),
      api.teamHistoryStoryBulk([teamId]),
      api.teamSeasonHistory(teamId),
      api.allTimeLeagues().catch(() => null),
      api.trophyRoom().catch(() => null),
      api.state().catch(() => null),
    ]);
    const team = teams.find((row) => row.id === teamId);
    if (!team) throw new Error(`Unknown team ${teamId}`);
    const story = storyPayload.histories[teamId];
    const history = historyPayload.seasons ?? [];

    const seasons = Array.from(new Set([
      ...(story?.divisionJourney ?? []).map((row) => row.season),
      ...(story?.masterLeagueJourney ?? []).map((row) => row.season),
      ...(story?.trioLeagueJourney ?? []).map((row) => row.season),
      ...(story?.tierLeagueJourney ?? []).map((row) => row.season),
      ...history.map((row) => row.season),
    ])).sort((a, b) => seasonNumber(a) - seasonNumber(b));

    const [masterCups, cups, superCups] = await Promise.all([
      Promise.all(seasons.map(async (season) => [season, await api.masterCupFixtures(undefined, true, season).catch(() => [])] as const)),
      Promise.all(seasons.map(async (season) => [season, await api.cup(undefined, season).catch(() => [])] as const)),
      Promise.all(seasons.map(async (season) => [season, await api.superCup(season).catch(() => [])] as const)),
    ]);
    const masterBySeason = Object.fromEntries(masterCups);
    const cupBySeason = Object.fromEntries(cups);
    const superBySeason = Object.fromEntries(superCups);

    const knockoutJourney: KnockoutJourneyStep[] = [];
    const seasonRows: TeamSeasonCareer[] = seasons.map((season) => {
      const division = story?.divisionJourney.find((row) => row.season === season);
      const master = story?.masterLeagueJourney.find((row) => row.season === season);
      const trio = story?.trioLeagueJourney.find((row) => row.season === season);
      const tier = story?.tierLeagueJourney.find((row) => row.season === season);
      const historyRow = history.find((row) => row.season === season);

      const competitions = {
        league: division
          ? { competition: 'league' as const, entered: true, label: `${division.division} #${division.rank}`, division: division.division, rank: division.rank, total: division.total, divisionLevel: division.divisionLevel }
          : historyRow
            ? { competition: 'league' as const, entered: true, label: `${historyRow.division} #${historyRow.rank}`, division: historyRow.division, rank: historyRow.rank, total: null, divisionLevel: null }
            : emptyFinish('league'),
        master: master
          ? { competition: 'master' as const, entered: true, label: `#${master.rank}/${master.total}`, division: null, rank: master.rank, total: master.total }
          : emptyFinish('master'),
        trio: trio
          ? { competition: 'trio' as const, entered: true, label: `${trio.division} #${trio.rank}/${trio.total}`, division: trio.division, rank: trio.rank, total: trio.total }
          : emptyFinish('trio'),
        tier: tier
          ? { competition: 'tier' as const, entered: true, label: `${tier.division} #${tier.rank}/${tier.total}`, division: tier.division, rank: tier.rank, total: tier.total }
          : emptyFinish('tier'),
        bookieball_cup: historyRow?.cupFinish && historyRow.cupFinish !== 'none'
          ? { competition: 'bookieball_cup' as const, entered: true, label: label(historyRow.cupFinish), division: null, winner: historyRow.cupFinish.toLowerCase().includes('winner') }
          : emptyFinish('bookieball_cup'),
        master_cup: emptyFinish('master_cup'),
        super_cup: historyRow?.superCupFinish && historyRow.superCupFinish !== 'none'
          ? { competition: 'super_cup' as const, entered: true, label: label(historyRow.superCupFinish), division: null, winner: historyRow.superCupFinish.toLowerCase().includes('winner') }
          : emptyFinish('super_cup'),
      } satisfies Record<CompetitionKey, CompetitionFinish>;

      const masterFixtures = (masterBySeason[season] ?? []).filter((fixture) => fixture.homeTeamId === teamId || fixture.awayTeamId === teamId);
      if (masterFixtures.length) {
        const ordered = masterFixtures.slice().sort((a, b) => a.id - b.id);
        const final = ordered.find((fixture) => fixture.stage === 'final');
        const furthest = ordered[ordered.length - 1];
        let finish = stageLabel(furthest.stage);
        let winner = false;
        let runnerUp = false;
        if (final?.winnerTeamId === teamId) { finish = 'Winner'; winner = true; }
        else if (final?.played) { finish = 'Runner-up'; runnerUp = true; }
        else if (furthest.played && furthest.winnerTeamId && furthest.winnerTeamId !== teamId) finish = `Out ${stageLabel(furthest.stage)}`;
        competitions.master_cup = { competition: 'master_cup', entered: true, label: finish, division: null, stage: furthest.stage, winner, runnerUp };

        for (const fixture of ordered) {
          const opponentId = fixture.homeTeamId === teamId ? fixture.awayTeamId : fixture.homeTeamId;
          const opponentName = fixture.homeTeamId === teamId ? fixture.awayTeam : fixture.homeTeam;
          knockoutJourney.push({
            competition: 'master_cup', season, round: stageLabel(fixture.stage), fixtureId: fixture.id,
            opponentTeamId: opponentId, opponentTeamName: opponentName,
            outcome: fixture.winnerTeamId === teamId ? (fixture.stage === 'final' ? 'winner' : 'advanced') : fixture.played ? (fixture.stage === 'final' ? 'runner_up' : 'eliminated') : 'pending',
          });
        }
      }

      for (const fixture of (cupBySeason[season] ?? []).filter((row) => row.homeTeam === team.name || row.awayTeam === team.name)) {
        const opponentName = fixture.homeTeam === team.name ? fixture.awayTeam : fixture.homeTeam;
        const opponent = teams.find((row) => row.name === opponentName);
        const isFinal = fixture.roundName.trim().toLowerCase() === 'final';
        knockoutJourney.push({
          competition: 'bookieball_cup', season, round: fixture.roundName, fixtureId: fixture.id,
          opponentTeamId: opponent?.id ?? null, opponentTeamName: opponentName,
          outcome: fixture.winnerTeam === team.name ? (isFinal ? 'winner' : 'advanced') : fixture.played ? (isFinal ? 'runner_up' : 'eliminated') : 'pending',
        });
      }

      for (const fixture of (superBySeason[season] ?? []).filter((row) => row.homeTeamId === teamId || row.awayTeamId === teamId)) {
        const opponentId = fixture.homeTeamId === teamId ? fixture.awayTeamId : fixture.homeTeamId;
        const opponentName = fixture.homeTeamId === teamId ? fixture.awayTeam : fixture.homeTeam;
        knockoutJourney.push({
          competition: 'super_cup', season, round: 'Super Cup', fixtureId: fixture.id,
          opponentTeamId: opponentId, opponentTeamName: opponentName,
          outcome: fixture.winnerTeamId === teamId ? 'winner' : fixture.played ? 'runner_up' : 'pending',
        });
      }

      const stats = historyRow ? {
        played: historyRow.played,
        wins: historyRow.wins,
        draws: historyRow.draws,
        losses: historyRow.losses,
        points: historyRow.points,
        profit: historyRow.profit,
        spins: historyRow.spins,
      } : null;

      return { season, teamId, teamName: team.name, stats, competitions };
    });

    const allTimeRow = allTime?.pointsTable.find((row) => row.teamId === teamId) ?? null;
    const fallbackStats = history.reduce((totals, row) => ({
      played: totals.played + row.played,
      wins: totals.wins + row.wins,
      draws: totals.draws + row.draws,
      losses: totals.losses + row.losses,
      points: totals.points + row.points,
      profit: totals.profit + row.profit,
      spins: totals.spins + row.spins,
    }), { played: 0, wins: 0, draws: 0, losses: 0, points: 0, profit: 0, spins: 0 });

    const trophies: TrophyCount[] = [];
    const pushTrophy = (key: string, trophyLabel: string, count: number) => trophies.push({ key, label: trophyLabel, count });
    pushTrophy('bookie-dor', "Bookie d'Or", winnerCount(trophyRoom?.bookieDor, team.name));
    pushTrophy('bookieball-cup', 'BookieBall Cup', winnerCount(trophyRoom?.cup, team.name));
    pushTrophy('master-league', 'Master League', winnerCount(trophyRoom?.masterLeague, team.name));
    pushTrophy('master-cup', 'Master Cup', winnerCount(trophyRoom?.masterCup, team.name));
    pushTrophy('super-cup', 'Super Cup', winnerCount(trophyRoom?.superCup, team.name));

    const completedBefore = state ? seasonNumber(state.currentSeason) : Number.POSITIVE_INFINITY;
    const trioTitles = (story?.trioLeagueJourney ?? []).filter((row) => row.rank === 1 && seasonNumber(row.season) < completedBefore).length;
    pushTrophy('trio-league', 'Trio League', trioTitles);

    Object.entries(trophyRoom?.divisions ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([division, winners]) => pushTrophy(`division-${division}`, displayDivisionName(division), winnerCount(winners, team.name)));
    Object.entries(trophyRoom?.tierLeagues ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([division, winners]) => pushTrophy(`tier-${division}`, `Tier · ${division}`, winnerCount(winners, team.name)));

    const totalHonours = trophies.reduce((sum, trophy) => sum + trophy.count, 0);
    const summary = {
      totalProfit: allTimeRow?.profit ?? fallbackStats.profit,
      totalPoints: allTimeRow?.points ?? fallbackStats.points,
      allTimePointsRank: allTimeRow?.rank ?? null,
      totalPlayed: allTimeRow?.played ?? fallbackStats.played,
      totalWins: allTimeRow?.wins ?? fallbackStats.wins,
      totalDraws: allTimeRow?.draws ?? fallbackStats.draws,
      totalLosses: allTimeRow?.losses ?? fallbackStats.losses,
      totalSpins: allTimeRow?.spins ?? fallbackStats.spins,
      totalHonours,
      trophies,
    };

    return { teamId, teamName: team.name, summary, seasons: seasonRows, knockoutJourney };
  })();

  careerCache.set(teamId, pending);
  return pending;
}
