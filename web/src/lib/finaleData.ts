import { displayDivisionName } from './divisionLabels';
import type { TeamPalette } from './broadcastTheme';
import {
  formatSigned,
  resolveStatus,
  isOfficialDivisionFixtureRecord,
  fixtureResultForTeam,
  formString,
  formPoints,
  joinNames,
} from './finaleHelpers';

export type StandingsSummaryRow = {
  teamId: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

export type TitleRaceRow = {
  teamId: number | null;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  profit: number;
  points: number;
  status: 'champion' | 'playoff' | 'danger' | 'steady';
  palette: TeamPalette;
};

export type DivisionJourneyTeam = {
  teamId: number;
  teamName: string;
  palette: TeamPalette;
  ranks: number[];
  startRank: number;
  finalRank: number;
  highlighted: boolean;
};

export type DivisionStory = {
  earlyLeader: { teamId: number; teamName: string } | null;
  hotRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null;
  coldRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null;
  openingRanks: Record<number, number>;
  journeyTeams: DivisionJourneyTeam[];
  gwLabels: string[];
};

export type LeagueFixture = {
  id: number;
  gw: string;
  division: string;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: string;
};

export type SeasonFinalePayload = {
  season: string;
  leagueWinners: Array<{ division: string; teamId: number; teamName: string }>;
  divisionTables?: Record<string, Array<StandingsSummaryRow>>;
  masterLeague?: {
    winner: { teamId: number; teamName: string } | null;
    table: Array<StandingsSummaryRow>;
  } | null;
  trioLeague?: {
    enabled: boolean;
    table: Array<StandingsSummaryRow & { division: string }>;
  } | null;
  tierLeague?: {
    enabled: boolean;
    started: boolean;
    table: Array<StandingsSummaryRow & { division: string }>;
  } | null;
  bestProfits: {
    overall: { teamId: number; teamName: string; profit: number } | null;
    byDivision: Array<{ division: string; teamId: number; teamName: string; profit: number }>;
  };
  promotions: Array<{ teamId: number; teamName: string; from: string; to: string }>;
  relegations: Array<{ teamId: number; teamName: string; from: string; to: string }>;
  playoffResults: Array<{
    upperTeamId: number;
    upperTeamName: string;
    lowerTeamId: number;
    lowerTeamName: string;
    upperDivision: string;
    lowerDivision: string;
    winnerTeamId: number | null;
    winnerTeamName: string | null;
    swapped: boolean;
  }>;
  cupWinner: { teamId: number; teamName: string } | null;
  superCup: {
    sourceSeason: string;
    pairingReason: string;
    pairingExplanation: string;
    winner: { teamId: number; teamName: string } | null;
    runnerUp: { teamId: number; teamName: string } | null;
  } | null;
  standout: Array<{ label: string; value: string }>;
  goalsOfSeason: Array<{ division: string; teamId: number; teamName: string; profit: number }>;
  bookieBallCup?: {
    winner: { teamId: number; teamName: string } | null;
    runnerUp: { teamId: number; teamName: string } | null;
    final: {
      homeTeam: string | null;
      awayTeam: string | null;
      winnerTeam: string | null;
      homeProfit: number;
      awayProfit: number;
      homeSpins: number;
      awaySpins: number;
      played: boolean;
      result: string;
      decidedBy: string;
    } | null;
  } | null;
  masterCup?: {
    winner: { teamId: number; teamName: string } | null;
    runnerUp: { teamId: number; teamName: string } | null;
    final: {
      homeTeam: string | null;
      awayTeam: string | null;
      winnerTeam: string | null;
      homeProfit: number;
      awayProfit: number;
      homeSpins: number;
      awaySpins: number;
      played: boolean;
      result: string;
      decidedBy: string;
    } | null;
  } | null;
  upcomingSuperCup?: {
    season: string;
    sourceSeason: string;
    pairingReason: string;
    pairingExplanation: string;
    homeTeamId: number;
    awayTeamId: number;
    homeTeam: string;
    awayTeam: string;
  } | null;
  bookieDor: {
    weights: { league: number; cup: number; master: number; consistency: number };
    winner: {
      teamId: number;
      teamName: string;
      division: string;
      score: number;
      leagueScore: number;
      cupScore: number;
      masterScore: number;
      consistencyScore: number;
      weightedLeagueScore: number;
      weightedCupScore: number;
      weightedMasterScore: number;
      weightedConsistencyScore: number;
      leagueRank: number;
      cupFinish: string;
    };
    leaderboard: Array<{
      teamId: number;
      teamName: string;
      division: string;
      score: number;
      leagueScore: number;
      cupScore: number;
      masterScore: number;
      consistencyScore: number;
      weightedLeagueScore: number;
      weightedCupScore: number;
      weightedMasterScore: number;
      weightedConsistencyScore: number;
    }>;
  } | null;
};

export type DivisionSlideData = {
  winner: { division: string; teamId: number; teamName: string };
  rows: TitleRaceRow[];
  championRow: TitleRaceRow | null;
  runnerUp: TitleRaceRow | null;
  championPalette: TeamPalette;
  titleMargin: number | null;
  bestProfit: { division: string; teamId: number; teamName: string; profit: number } | null;
  goalOfSeason: { division: string; teamId: number; teamName: string; profit: number } | null;
  promotionsIn: Array<{ teamId: number; teamName: string; from: string; to: string }>;
  relegationsOut: Array<{ teamId: number; teamName: string; from: string; to: string }>;
  playoffs: Array<{
    upperTeamId: number;
    upperTeamName: string;
    lowerTeamId: number;
    lowerTeamName: string;
    upperDivision: string;
    lowerDivision: string;
    winnerTeamId: number | null;
    winnerTeamName: string | null;
    swapped: boolean;
  }>;
  storyHeadline: string;
  chaseStory: string;
  earlyLeaderStory: string;
  profitStory: string;
  peakStory: string;
  movementStory: string[];
  earlyLeader: { teamId: number; teamName: string } | null;
  hotRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null;
  coldRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null;
  openingRanks: Record<number, number>;
  journeyTeams: DivisionJourneyTeam[];
  gwLabels: string[];
};

export type PromotionSpotlightData = {
  teamId: number;
  teamName: string;
  from: string;
  to: string;
  finalRank: number | null;
  points: number | null;
  profit: number | null;
  startRank: number | null;
  hotRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null;
  playoffTie: {
    upperTeamId: number;
    upperTeamName: string;
    lowerTeamId: number;
    lowerTeamName: string;
    upperDivision: string;
    lowerDivision: string;
    winnerTeamId: number | null;
    winnerTeamName: string | null;
    swapped: boolean;
  } | null;
};

export type DivisionTableMap = Record<string, Array<StandingsSummaryRow>>;

export function mapStandingsRows(
  rows: StandingsSummaryRow[],
  resolvePalette: (teamId: number | null | undefined, teamName: string) => TeamPalette,
): TitleRaceRow[] {
  return rows
    .slice()
    .sort((left, right) => left.rank - right.rank)
    .map((row, index, ordered) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      points: row.points,
      profit: row.profit,
      status: resolveStatus(index, ordered.length),
      palette: resolvePalette(row.teamId, row.teamName),
    }));
}

export function computeDivisionStories(
  divisionTableMap: DivisionTableMap,
  seasonLeagueFixtures: LeagueFixture[],
  resolvePalette: (teamId: number | null | undefined, teamName: string) => TeamPalette,
): Map<string, DivisionStory> {
  const stories = new Map<string, DivisionStory>();

  Object.entries(divisionTableMap).forEach(([division, rows]) => {
    const orderedRows = [...rows].sort((left, right) => left.rank - right.rank || left.teamName.localeCompare(right.teamName));
    const gwLabels = Array.from({ length: 7 }, (_, index) => `GW${index + 1}`);
    if (orderedRows.length === 0) {
      stories.set(division, {
        earlyLeader: null,
        hotRun: null,
        coldRun: null,
        openingRanks: {},
        journeyTeams: [],
        gwLabels,
      });
      return;
    }

    const officialFixtures = seasonLeagueFixtures
      .filter((fixture) => fixture.division === division && isOfficialDivisionFixtureRecord(fixture))
      .slice()
      .sort((left, right) => Number(left.gw.replace('GW', '')) - Number(right.gw.replace('GW', '')) || left.id - right.id);

    const stats = new Map<number, { points: number; profit: number; spins: number; wins: number }>();
    const resultsByTeamId = new Map<number, Array<{ gw: string; result: 'W' | 'D' | 'L' }>>();
    const ranksByTeamId = new Map<number, number[]>();
    const openingRanks: Record<number, number> = {};

    orderedRows.forEach((row) => {
      stats.set(row.teamId, { points: 0, profit: 0, spins: 0, wins: 0 });
      resultsByTeamId.set(row.teamId, []);
      ranksByTeamId.set(row.teamId, []);
    });

    for (let gwNumber = 1; gwNumber <= 7; gwNumber += 1) {
      const gwLabel = `GW${gwNumber}`;
      officialFixtures
        .filter((fixture) => fixture.gw === gwLabel && fixture.result !== 'pending')
        .forEach((fixture) => {
          const home = orderedRows.find((row) => row.teamName === fixture.homeTeam);
          const away = orderedRows.find((row) => row.teamName === fixture.awayTeam);
          if (!home || !away) return;

          const homeStats = stats.get(home.teamId);
          const awayStats = stats.get(away.teamId);
          if (!homeStats || !awayStats) return;

          homeStats.profit += fixture.homeProfit;
          awayStats.profit += fixture.awayProfit;
          homeStats.spins += fixture.homeSpins;
          awayStats.spins += fixture.awaySpins;

          const homeResult = fixtureResultForTeam(fixture, home.teamName);
          const awayResult = fixtureResultForTeam(fixture, away.teamName);
          if (homeResult) resultsByTeamId.get(home.teamId)?.push({ gw: fixture.gw, result: homeResult });
          if (awayResult) resultsByTeamId.get(away.teamId)?.push({ gw: fixture.gw, result: awayResult });

          if (fixture.result === 'home') { homeStats.points += 3; homeStats.wins += 1; }
          else if (fixture.result === 'away') { awayStats.points += 3; awayStats.wins += 1; }
          else if (fixture.result === 'draw') { homeStats.points += 1; awayStats.points += 1; }
        });

      const standings = orderedRows
        .map((row) => ({ row, stats: stats.get(row.teamId) ?? { points: 0, profit: 0, spins: 0, wins: 0 } }))
        .sort((left, right) => (
          right.stats.points - left.stats.points
          || right.stats.profit - left.stats.profit
          || right.stats.spins - left.stats.spins
          || right.stats.wins - left.stats.wins
          || left.row.teamName.localeCompare(right.row.teamName)
        ));

      if (gwNumber === 1) {
        standings.forEach((entry, index) => { openingRanks[entry.row.teamId] = index + 1; });
      }
      standings.forEach((entry, index) => { ranksByTeamId.get(entry.row.teamId)?.push(index + 1); });
    }

    const earlyLeaderRow = orderedRows.find((row) => openingRanks[row.teamId] === 1) ?? null;

    const evaluateWindow = (
      rowsForTeam: Array<{ gw: string; result: 'W' | 'D' | 'L' }>,
      comparator: (candidate: { points: number; wins: number; draws: number }, best: { points: number; wins: number; draws: number }) => boolean,
    ) => {
      let bestWindow: { form: string; points: number; range: string; wins: number; draws: number } | null = null;
      const windowSize = Math.min(3, rowsForTeam.length);
      if (windowSize === 0) return null;
      for (let start = 0; start <= rowsForTeam.length - windowSize; start += 1) {
        const slice = rowsForTeam.slice(start, start + windowSize);
        const wins = slice.filter((row) => row.result === 'W').length;
        const draws = slice.filter((row) => row.result === 'D').length;
        const points = formPoints(slice.map((row) => row.result));
        const candidate = {
          form: formString(slice.map((row) => row.result)),
          points,
          range: slice.length > 1 ? `${slice[0]?.gw} to ${slice[slice.length - 1]?.gw}` : `${slice[0]?.gw}`,
          wins,
          draws,
        };
        if (!bestWindow || comparator(candidate, bestWindow)) bestWindow = candidate;
      }
      return bestWindow;
    };

    let hotRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null = null;
    let coldRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null = null;

    orderedRows.forEach((row) => {
      const formRows = resultsByTeamId.get(row.teamId) ?? [];
      const bestWindow = evaluateWindow(formRows, (candidate, best) => (
        candidate.points > best.points
        || (candidate.points === best.points && candidate.wins > best.wins)
        || (candidate.points === best.points && candidate.wins === best.wins && candidate.draws > best.draws)
      ));
      const worstWindow = evaluateWindow(formRows, (candidate, best) => (
        candidate.points < best.points
        || (candidate.points === best.points && candidate.wins < best.wins)
        || (candidate.points === best.points && candidate.wins === best.wins && candidate.draws < best.draws)
      ));

      if (bestWindow && (!hotRun || bestWindow.points > hotRun.points)) {
        hotRun = { teamId: row.teamId, teamName: row.teamName, form: bestWindow.form, points: bestWindow.points, range: bestWindow.range };
      }
      if (worstWindow && (!coldRun || worstWindow.points < coldRun.points)) {
        coldRun = { teamId: row.teamId, teamName: row.teamName, form: worstWindow.form, points: worstWindow.points, range: worstWindow.range };
      }
    });

    const journeyTeams = orderedRows.map((row) => {
      const rawRanks = ranksByTeamId.get(row.teamId) ?? [];
      const fallbackRank = row.rank || orderedRows.findIndex((entry) => entry.teamId === row.teamId) + 1 || 1;
      const filledRanks = officialFixtures.length === 0
        ? gwLabels.map(() => fallbackRank)
        : gwLabels.map((_, index) => rawRanks[index] ?? rawRanks[rawRanks.length - 1] ?? fallbackRank);
      return {
        teamId: row.teamId,
        teamName: row.teamName,
        palette: resolvePalette(row.teamId, row.teamName),
        ranks: filledRanks,
        startRank: filledRanks[0] ?? fallbackRank,
        finalRank: row.rank ?? filledRanks[filledRanks.length - 1] ?? fallbackRank,
        highlighted: false,
      };
    });

    stories.set(division, { earlyLeader: earlyLeaderRow ? { teamId: earlyLeaderRow.teamId, teamName: earlyLeaderRow.teamName } : null, hotRun, coldRun, openingRanks, journeyTeams, gwLabels });
  });

  return stories;
}

export function computeDivisionSlides(
  payload: SeasonFinalePayload,
  divisionTableMap: DivisionTableMap,
  divisionStoryByDivision: Map<string, DivisionStory>,
  resolvePalette: (teamId: number | null | undefined, teamName: string) => TeamPalette,
): DivisionSlideData[] {
  return payload.leagueWinners.map((winner) => {
    const divisionStory = divisionStoryByDivision.get(winner.division);
    const rows = mapStandingsRows((divisionTableMap[winner.division] ?? []) as StandingsSummaryRow[], resolvePalette);
    const championRow = rows[0] ?? null;
    const runnerUp = rows[1] ?? null;
    const bestProfit = payload.bestProfits.byDivision.find((row) => row.division === winner.division) ?? null;
    const goalOfSeason = payload.goalsOfSeason.find((row) => row.division === winner.division) ?? null;
    const promotionsIn = payload.promotions.filter((row) => row.to === winner.division);
    const relegationsOut = payload.relegations.filter((row) => row.from === winner.division);
    const playoffs = payload.playoffResults.filter((row) => row.upperDivision === winner.division || row.lowerDivision === winner.division);
    const playoffSwing = playoffs.find((row) => row.swapped) ?? playoffs[0] ?? null;
    const championPalette = resolvePalette(winner.teamId, winner.teamName);
    const titleMargin = championRow && runnerUp ? championRow.points - runnerUp.points : null;
    const chaseStory = runnerUp
      ? titleMargin === 0
        ? `${winner.teamName} and ${runnerUp.teamName} finished level on points, and the title was settled on the finer edge of the campaign.`
        : `${winner.teamName} held off ${runnerUp.teamName} by ${titleMargin} point${titleMargin === 1 ? '' : 's'} to take the crown.`
      : `${winner.teamName} ran clear and controlled the division from the front.`;
    const earlyLeaderStory = divisionStory?.earlyLeader
      ? divisionStory.earlyLeader.teamName === winner.teamName
        ? `${winner.teamName} were already setting the pace after the opening week and never really let the division breathe.`
        : `${divisionStory.earlyLeader.teamName} led after the opening week, but ${winner.teamName} rewrote the story over the season run.`
      : 'The early-season pace-setter could not be isolated from the stored fixture history.';
    const profitStory = bestProfit
      ? `${bestProfit.teamName} posted the best return at ${formatSigned(bestProfit.profit)}.`
      : 'No division profit leader was logged in the finale payload.';
    const peakStory = goalOfSeason
      ? `${goalOfSeason.teamName} also owned the peak night with ${formatSigned(goalOfSeason.profit)}.`
      : 'No single-night award was recorded for this division.';
    const movementStory = [
      promotionsIn.length > 0 ? `Coming up: ${joinNames(promotionsIn.map((row) => row.teamName))} move into this division next season.` : null,
      relegationsOut.length > 0 ? `Dropping out: ${joinNames(relegationsOut.map((row) => row.teamName))} leave the division story behind.` : null,
      playoffSwing
        ? playoffSwing.swapped
          ? `${playoffSwing.winnerTeamName ?? playoffSwing.lowerTeamName} flipped the playoff and rewrote the final ladder.`
          : `${playoffSwing.winnerTeamName ?? playoffSwing.upperTeamName} held the playoff line and protected the order.`
        : 'No playoff shock changed the division shape.',
    ].filter(Boolean) as string[];

    const storyHeadline = playoffSwing?.swapped
      ? 'Playoff drama changed the picture'
      : titleMargin !== null && titleMargin <= 1
        ? 'The race went right to the wire'
        : 'The champion set the tone early';

    return {
      winner,
      rows,
      championRow,
      runnerUp,
      championPalette,
      titleMargin,
      bestProfit,
      goalOfSeason,
      promotionsIn,
      relegationsOut,
      playoffs,
      storyHeadline,
      chaseStory,
      earlyLeaderStory,
      profitStory,
      peakStory,
      movementStory,
      earlyLeader: divisionStory?.earlyLeader ?? null,
      hotRun: divisionStory?.hotRun ?? null,
      coldRun: divisionStory?.coldRun ?? null,
      openingRanks: divisionStory?.openingRanks ?? {},
      journeyTeams: (divisionStory?.journeyTeams ?? []).map((team) => ({ ...team, highlighted: team.teamId === winner.teamId })),
      gwLabels: divisionStory?.gwLabels ?? Array.from({ length: 7 }, (_, index) => `GW${index + 1}`),
    };
  });
}

export function computePromotionSpotlights(
  payload: SeasonFinalePayload,
  divisionTableMap: DivisionTableMap,
  divisionStoryByDivision: Map<string, DivisionStory>,
): PromotionSpotlightData[] {
  return payload.promotions.map((promotion) => {
    const sourceRows = divisionTableMap[promotion.from] ?? [];
    const sourceRow = sourceRows.find((row) => row.teamId === promotion.teamId) ?? null;
    const sourceStory = divisionStoryByDivision.get(promotion.from);
    const playoffTie = payload.playoffResults.find((row) => row.winnerTeamId === promotion.teamId && row.swapped) ?? null;
    const startRank = sourceStory?.openingRanks[promotion.teamId] ?? null;
    const hotRun = sourceStory?.hotRun?.teamId === promotion.teamId ? sourceStory.hotRun : null;
    return {
      ...promotion,
      finalRank: sourceRow?.rank ?? null,
      points: sourceRow?.points ?? null,
      profit: sourceRow?.profit ?? null,
      startRank,
      hotRun,
      playoffTie,
    };
  });
}
