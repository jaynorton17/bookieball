import { displayDivisionName } from './divisionLabels';

export type SeasonFinalePayload = {
  season: string;
  leagueWinners: Array<{ division: string; teamId: number; teamName: string }>;
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
  standout: Array<{ label: string; value: string }>;
  goalsOfSeason: Array<{ division: string; teamId: number; teamName: string; profit: number }>;
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

export type FinaleSlide = {
  title: string;
  lines: string[];
};

function formatOrdinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickLine(options: string[], seed: string): string {
  return options[hashString(seed) % options.length];
}

function safeNumber(value: number | undefined | null, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function buildSeasonFinaleSlides(payload?: SeasonFinalePayload | null): FinaleSlide[] {
  if (!payload) {
    return [];
  }

  const slides: FinaleSlide[] = [];
  const seed = payload.season;
  slides.push({
    title: `Season ${payload.season} Finale`,
    lines: [
      pickLine(
        [
          'Awards • Promotions • Playoffs',
          'Champions crowned • Stories remembered',
          'One season closed, next season loading',
        ],
        `${seed}:intro`,
      ),
    ],
  });

  slides.push({
    title: 'Division Champions',
    lines: payload.leagueWinners.length > 0
      ? payload.leagueWinners.map((winner) => `${displayDivisionName(winner.division)}: ${winner.teamName}`)
      : ['No league winners recorded.'],
  });

  slides.push({
    title: 'Cup Champion',
    lines: payload.cupWinner
      ? [
          pickLine(
            [
              `Cup winner: ${payload.cupWinner.teamName}`,
              `${payload.cupWinner.teamName} lifted the cup`,
              `Cup final belonged to ${payload.cupWinner.teamName}`,
            ],
            `${seed}:cup`,
          ),
        ]
      : ['Cup winner: TBD'],
  });

  if (payload.bookieDor?.winner) {
    const winner = payload.bookieDor.winner;
    const leaderboard = payload.bookieDor.leaderboard.slice(0, 3);
    const leaderboardLine = leaderboard.length > 0
      ? `Top 3: ${leaderboard.map((row, idx) => `${idx + 1}. ${row.teamName} (${safeNumber(row.score).toFixed(1)})`).join(' • ')}`
      : null;
    const winnerScore = safeNumber(winner.score);
    const weightedLeague = safeNumber(winner.weightedLeagueScore, safeNumber(winner.leagueScore));
    const weightedCup = safeNumber(winner.weightedCupScore, safeNumber(winner.cupScore));
    const weightedMaster = safeNumber(winner.weightedMasterScore, safeNumber(winner.masterScore));
    const weightedConsistency = safeNumber(winner.weightedConsistencyScore, safeNumber(winner.consistencyScore));
    slides.push({
      title: "Bookie d'Or",
      lines: [
        pickLine(
          [
            `Winner: ${winner.teamName} (${displayDivisionName(winner.division)})`,
            `${winner.teamName} takes the crown from ${displayDivisionName(winner.division)}`,
          ],
          `${seed}:dor-winner`,
        ),
        `Score: ${winnerScore.toFixed(1)} • League ${weightedLeague.toFixed(1)} • Cup ${weightedCup.toFixed(1)} • Master ${weightedMaster.toFixed(1)} • Consistency ${weightedConsistency.toFixed(1)}`,
        `Weights: League ${Math.round((payload.bookieDor.weights?.league ?? 0) * 100)}% • Cup ${Math.round((payload.bookieDor.weights?.cup ?? 0) * 100)}% • Master ${Math.round((payload.bookieDor.weights?.master ?? 0) * 100)}% • Consistency ${Math.round((payload.bookieDor.weights?.consistency ?? 0) * 100)}%`,
        `League finish: ${formatOrdinal(winner.leagueRank)} • Cup: ${winner.cupFinish}`,
        ...(leaderboardLine ? [leaderboardLine] : []),
      ],
    });
  } else {
    slides.push({
      title: "Bookie d'Or",
      lines: ["Bookie d'Or: TBD"],
    });
  }

  const goalsOfSeason = payload.goalsOfSeason ?? [];
  slides.push({
    title: 'Goals of the Season',
    lines: goalsOfSeason.length > 0
      ? goalsOfSeason.map((row) => `${displayDivisionName(row.division)}: ${row.teamName} (${row.profit})`)
      : ['No goal of the season awards yet.'],
  });

  slides.push({
    title: 'Best Profits',
    lines: [
      payload.bestProfits.overall
        ? `Overall: ${payload.bestProfits.overall.teamName} (${payload.bestProfits.overall.profit})`
        : 'Overall: TBD',
      ...payload.bestProfits.byDivision.map((row) => `${displayDivisionName(row.division)}: ${row.teamName} (${row.profit})`),
    ],
  });

  const movementLines = [
    ...payload.promotions.map((row) => `Promoted: ${row.teamName} (${displayDivisionName(row.from)} → ${displayDivisionName(row.to)})`),
    ...payload.relegations.map((row) => `Relegated: ${row.teamName} (${displayDivisionName(row.from)} → ${displayDivisionName(row.to)})`),
  ];
  slides.push({
    title: 'Promotions & Relegations',
    lines: movementLines.length > 0
      ? [
          pickLine(
            [
              'Movement confirmed after the final standings lock.',
              'Division doors opened and closed this season.',
              'Here is the final movement map.',
            ],
            `${seed}:movement`,
          ),
          ...movementLines,
        ]
      : ['No movement recorded.'],
  });

  slides.push({
    title: 'Playoff Results',
    lines: payload.playoffResults.length > 0
      ? payload.playoffResults.map((row) => {
          const outcome = row.swapped ? 'Swap' : 'Held';
          const winnerName = row.winnerTeamName ?? 'Draw';
          return `${row.upperTeamName} vs ${row.lowerTeamName} • Winner: ${winnerName} • ${outcome}`;
        })
      : ['No playoff results recorded.'],
  });

  const standoutLines = payload.standout
    .filter((row) => row.label !== 'Cup Winner')
    .map((row) => `${row.label}: ${row.value}`);
  if (standoutLines.length > 0) {
    slides.push({
      title: 'Season Highlights',
      lines: standoutLines,
    });
  }

  return slides;
}
