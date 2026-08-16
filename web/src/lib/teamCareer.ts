import { api } from './api';
import type { CompetitionFinish, TeamCareer, TeamSeasonCareer, KnockoutJourneyStep } from './historyModels';
import type { CompetitionKey } from './competitionRegistry';

let careerCache = new Map<number, Promise<TeamCareer>>();

function label(value: string | null | undefined): string {
  if (!value || value === 'none') return '—';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function emptyFinish(competition: CompetitionKey): CompetitionFinish {
  return { competition, entered: false, label: '—', rank: null, total: null, stage: null, divisionLevel: null };
}

function stageLabel(stage: string): string {
  if (stage === 'round_of_16') return 'R16';
  if (stage === 'quarter_final') return 'Quarter-final';
  if (stage === 'semi_final') return 'Semi-final';
  if (stage === 'third_place_playoff') return '3rd-place playoff';
  if (stage === 'final') return 'Final';
  return label(stage);
}

export function clearTeamCareerCache(teamId?: number): void {
  if (teamId === undefined) careerCache.clear();
  else careerCache.delete(teamId);
}

export function loadTeamCareer(teamId: number): Promise<TeamCareer> {
  const existing = careerCache.get(teamId);
  if (existing) return existing;

  const pending = (async () => {
    const [teams, storyPayload, historyPayload] = await Promise.all([
      api.teams(),
      api.teamHistoryStoryBulk([teamId]),
      api.teamSeasonHistory(teamId),
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
    ])).sort((a, b) => Number(a.replace('S', '')) - Number(b.replace('S', '')));

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
          ? { competition: 'league' as const, entered: true, label: `${division.division} #${division.rank}`, rank: division.rank, total: division.total, divisionLevel: division.divisionLevel }
          : historyRow
            ? { competition: 'league' as const, entered: true, label: `${historyRow.division} #${historyRow.rank}`, rank: historyRow.rank, total: null, divisionLevel: null }
            : emptyFinish('league'),
        master: master
          ? { competition: 'master' as const, entered: true, label: `#${master.rank}/${master.total}`, rank: master.rank, total: master.total }
          : emptyFinish('master'),
        trio: trio
          ? { competition: 'trio' as const, entered: true, label: `${trio.division} #${trio.rank}/${trio.total}`, rank: trio.rank, total: trio.total }
          : emptyFinish('trio'),
        tier: tier
          ? { competition: 'tier' as const, entered: true, label: `${tier.division} #${tier.rank}/${tier.total}`, rank: tier.rank, total: tier.total }
          : emptyFinish('tier'),
        bookieball_cup: historyRow?.cupFinish && historyRow.cupFinish !== 'none'
          ? { competition: 'bookieball_cup' as const, entered: true, label: label(historyRow.cupFinish) }
          : emptyFinish('bookieball_cup'),
        master_cup: emptyFinish('master_cup'),
        super_cup: historyRow?.superCupFinish && historyRow.superCupFinish !== 'none'
          ? { competition: 'super_cup' as const, entered: true, label: label(historyRow.superCupFinish) }
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
        competitions.master_cup = { competition: 'master_cup', entered: true, label: finish, stage: furthest.stage, winner, runnerUp };

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

      return { season, teamId, teamName: team.name, competitions };
    });

    return { teamId, teamName: team.name, seasons: seasonRows, knockoutJourney };
  })();

  careerCache.set(teamId, pending);
  return pending;
}
