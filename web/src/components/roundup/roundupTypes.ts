export type DivisionKey = 'champions' | 'premier' | 'division-one' | 'division-two' | 'division-three' | 'division-four';
export type FormResult = 'W' | 'D' | 'L';
export type RoundupPrimarySegment = 'full' | 'leagues' | 'cups' | 'spotlights';
export type RoundupLeagueSegment = 'all' | 'divisions' | 'master' | 'trio' | 'all-time';
export type RoundupCupSegment = 'all' | 'super-cup' | 'bookieball' | 'master-cup';
export type RoundupSpotlightSegment = 'all' | 'champions' | DivisionKey;

export type RoundupShowSelection = {
  primary: RoundupPrimarySegment;
  league: RoundupLeagueSegment;
  division: 'all' | DivisionKey;
  cup: RoundupCupSegment;
  spotlight: RoundupSpotlightSegment;
};

export type DivisionSpec = {
  key: DivisionKey;
  title: string;
  shortTitle: string;
};

export type RoundupTeam = {
  id: number;
  name: string;
  division: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  preseasonFavorite: boolean;
  trendCache: {
    teamId: number;
    windowSize: number;
    fromGw: string;
    toGw: string;
    rankDelta: number;
    pointsDelta: number;
    profitDelta: number;
    pointsDeltaVsPreviousWindow: number | null;
    profitDeltaVsPreviousWindow: number | null;
  } | null;
};

export type RoundupForecastRow = {
  teamId: number;
  predictedRank: number | null;
  predictedPlayed: number;
  predictedWins: number;
  predictedDraws: number;
  predictedLosses: number;
  predictedPoints: number;
  predictedProfit: number;
  predictedSpins: number;
  avgFinish: number | null;
  titleProbability: number;
  topHalfProbability: number;
  bottomProbability: number;
  promotionProbability: number;
  playoffProbability: number;
  relegationProbability: number;
  remainingFixtures: number;
  remainingDifficultyAverage: number | null;
  remainingDifficultyRank: number | null;
  remainingDifficultyLabel: string;
  projectedDelta: number | null;
  modelReasonsUp: string[];
  modelReasonsDown: string[];
};

export type RoundupTableRow = {
  teamId: number;
  teamName: string;
  division: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

export type RoundupFixture = {
  id: number;
  gw: string;
  division: string;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
};

export type RoundupHistoryRow = {
  season: string;
  division: string;
  rank: number;
  points: number;
  profit: number;
  spins: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  cupFinish: string;
  superCupFinish?: string;
};

export type RoundupTeamPredictionRace = {
  jayCorrect: number;
  computerCorrect: number;
  resolved: number;
};

export type JourneyTeam = {
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  ranks: number[];
};

export type DivisionResultsFixtureRow = {
  id: string;
  fixture: string;
  score: string;
  status: string;
};

export type DivisionRoundupData = {
  key: DivisionKey;
  title: string;
  shortTitle: string;
  tableRows: Array<RoundupTableRow & { ballColor: string | null; ringColor: string | null; textColor: string | null; goalDiff: number | null }>;
  journeyTeams: JourneyTeam[];
  currentGwNumber: number;
  seasonLength: number;
  resultsTitle: string;
  fixturesTitle: string;
  isNewSeason: boolean;
  isSeasonComplete: boolean;
  resultsRows: DivisionResultsFixtureRow[];
  fixtureRows: DivisionResultsFixtureRow[];
};

export type RoundupCupFixture = {
  id: number;
  round: number;
  matchNumber: number;
  gw: string;
  roundName: string;
  homeTeam: string | null;
  awayTeam: string | null;
  winnerTeam: string | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  decidedBy: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending';
};

export type RoundupSuperCupFixture = {
  id: number;
  season: string;
  gw: string;
  sourceSeason: string;
  pairingReason: 'winners_vs_winners' | 'double_winner_vs_bookieball_runner_up' | 'double_winner_vs_master_cup_runner_up';
  pairingExplanation: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  winnerTeamId: number | null;
  winnerTeam: string | null;
  runnerUpTeamId: number | null;
  runnerUpTeam: string | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  played: boolean;
  result: 'home' | 'away' | 'pending';
  decidedBy: 'profit' | 'penalties' | 'spins' | 'team_id' | 'pending';
};

export type RoundupMasterLeagueRow = {
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

export type RoundupMasterLeagueFixture = {
  id: number;
  gw: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
};

export type RoundupMasterCupFixture = {
  id: number;
  gw: string;
  stage: 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place_playoff' | 'final';
  legNumber: number;
  tieSlot: number;
  roundName: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeSeed: number | null;
  awaySeed: number | null;
  winnerTeamId: number | null;
  winnerTeam: string | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  aggregateHomeProfit: number | null;
  aggregateAwayProfit: number | null;
  aggregateHomeSpins: number | null;
  aggregateAwaySpins: number | null;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  decidedBy: 'profit' | 'spins' | 'penalties' | 'aggregate_profit' | 'aggregate_spins' | 'aggregate_penalties' | 'pending';
};

export type RoundupTrioLeagueRow = {
  division: string;
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

export type RoundupTrioLeagueFixture = {
  id: number;
  gw: string;
  division: string;
  stage: 'regular' | 'playoff_semi' | 'playoff_final';
  groupSlot: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
  winnerTeamId: number | null;
};

export type RoundupAllTimeRow = {
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

export type RoundupAllTimePayload = {
  fromSeason: string;
  fromGw: string;
  toSeason: string;
  toGw: string;
  pointsTable: RoundupAllTimeRow[];
  spinsTable: RoundupAllTimeRow[];
  profitTable: RoundupAllTimeRow[];
};

export type PreviousChampionRow = {
  season: string;
  division: string;
  teamName: string;
  points: number;
  profit: number;
  wins: number;
  draws: number;
  losses: number;
  dominance: string;
};

export type SpotlightPerspective = 'leader' | 'chaser' | 'mid' | 'bottom';
export type SpotlightMovement = 'up' | 'down' | 'flat';
export type FixtureDifficulty = 'easy' | 'balanced' | 'hard';
export type ProfitVolatility = 'Stable' | 'Swingy' | 'Boom/Bust';

export type ChampionsSpotlightEntry = {
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  rank: number;
  points: number;
  profit: number;
  wins: number;
  losses: number;
  goalDiff: number | null;
  formLast3: FormResult[];
  formLast5: FormResult[];
  tagLine: string;
  perspective: SpotlightPerspective;
  gapAbove: number | null;
  gapBelow: number | null;
  gapToSecond: number | null;
  gapToSafety: number | null;
  biggestWin: string;
  biggestLoss: string;
  controlIndex: number | null;
  losingStreak: number;
  startPosition: number;
  highestPosition: number;
  currentPosition: number;
  movement: SpotlightMovement;
  movementLabel: string;
  allTimeLeagueTitles: number;
  championsLeagueTitles: number;
  cupWins: number;
  averageFinish: number | null;
  historicalProfitRecord: number;
  allTimeSpins: number;
  legacyLine: string;
  difficulty: FixtureDifficulty;
  difficultyScore: number | null;
  volatility: ProfitVolatility;
  volatilityScore: number;
  titleProbability: number | null;
  projectionLine: string;
};

export type ChampionsSpotlightModel = {
  introTitle: string;
  miniTable: DivisionRoundupData['tableRows'];
  entries: ChampionsSpotlightEntry[];
};

export type CupSegmentRow = {
  id: string;
  fixtureId: number;
  gw: string;
  roundName: string;
  homeTeam: string | null;
  awayTeam: string | null;
  winnerTeam: string | null;
  homeProfit: number | null;
  awayProfit: number | null;
  score: string;
  detail: string;
  played: boolean;
  decidedBy: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending';
  fixture: string;
  status: string;
};

export type CupSegmentModel = {
  title: string;
  roundLabel: string;
  results: CupSegmentRow[];
  upcoming: CupSegmentRow[];
  allRows: CupSegmentRow[];
};

export type DivisionRoundupModel = {
  divisions: DivisionRoundupData[];
  previousChampions: PreviousChampionRow[];
  championsSpotlight: ChampionsSpotlightModel | null;
  cupSegment: CupSegmentModel | null;
};
