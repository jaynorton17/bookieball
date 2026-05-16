export const APP_NAME = 'bookieball';
export const API_PORT = 5181;
export const WEB_PORT = 5180;
export const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'] as const;

export const DIVISION_ORDER = [
  'Champions Bookies',
  'Premier Bookies',
  'Average Bookies',
  'Struggling Bookies',
  'Awful Bookies',
] as const;

export const DIVISION_SLOTS: Record<(typeof DIVISION_ORDER)[number], number> = {
  'Champions Bookies': 4,
  'Premier Bookies': 4,
  'Average Bookies': 4,
  'Struggling Bookies': 4,
  'Awful Bookies': 4,
};

export const SEASON_FIVE_EXPANSION_START = 5;
export const SEASON_SIX_TIER_LEAGUE_START = 6;
export const SEASON_SEVEN_FULL_TIER_LEAGUE_START = 7;
export const DIVISION_FOUR = 'Division 4 Bookies' as const;
export const TRIO_DIVISION_ORDER = [
  'Premier League',
  'Ligue 1',
  'Bundesliga',
] as const;
export const TRIO_DIVISION_SIZE = 8;
export const TRIO_REGULAR_SEASON_GAMEWEEKS = 6;
export const TIER_LEAGUE_DIVISION_ORDER = [
  'Legendary',
  'Masters',
  'Elite',
  'Superior',
  'Standard',
  'Average',
  'Poor',
  'Awful',
] as const;
export const TIER_LEAGUE_DIVISION_SIZE = 3;
export const TIER_LEAGUE_GAMEWEEKS = ['GW4', 'GW5', 'GW6', 'GW7', 'GW8'] as const;
export const TIER_LEAGUE_START_GW = 'GW4' as const;
export const TIER_LEAGUE_END_GW = 'GW8' as const;

export type DivisionName = (typeof DIVISION_ORDER)[number] | typeof DIVISION_FOUR;
export type TrioDivisionName = (typeof TRIO_DIVISION_ORDER)[number];
export type TierLeagueDivisionName = (typeof TIER_LEAGUE_DIVISION_ORDER)[number];
export type Gameweek = (typeof GAMEWEEKS)[number];

function parseSeasonNumber(season: string): number {
  const match = String(season).match(/(\d+)/);
  if (!match?.[1]) {
    return 0;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isSeasonFiveOrLater(season: string): boolean {
  return parseSeasonNumber(season) >= SEASON_FIVE_EXPANSION_START;
}

export function isSeasonSixOrLater(season: string): boolean {
  return parseSeasonNumber(season) >= SEASON_SIX_TIER_LEAGUE_START;
}

export function isSeasonSevenOrLater(season: string): boolean {
  return parseSeasonNumber(season) >= SEASON_SEVEN_FULL_TIER_LEAGUE_START;
}

export function getTierLeagueGameweeksForSeason(season: string): Gameweek[] {
  if (isSeasonSevenOrLater(season)) {
    return [...GAMEWEEKS];
  }
  return [...TIER_LEAGUE_GAMEWEEKS];
}

export function getTierLeagueStartGwForSeason(season: string): Gameweek {
  return isSeasonSevenOrLater(season) ? 'GW1' : TIER_LEAGUE_START_GW;
}

export function getTierLeagueEndGwForSeason(_season: string): Gameweek {
  return TIER_LEAGUE_END_GW;
}

export function getDivisionOrderForSeason(season: string): DivisionName[] {
  if (isSeasonFiveOrLater(season)) {
    return [...DIVISION_ORDER, DIVISION_FOUR];
  }
  return [...DIVISION_ORDER];
}

export function getDivisionSlotsForSeason(season: string): Record<string, number> {
  if (isSeasonFiveOrLater(season)) {
    return {
      ...DIVISION_SLOTS,
      [DIVISION_FOUR]: 4,
    };
  }
  return { ...DIVISION_SLOTS };
}

export const DEFAULT_TEAMS = [
  { teamId: 'midnite', name: 'Midnite', url: 'https://www.midnite.com', ballColor: '#00A651', ringColor: '#000000', textColor: '#FFFFFF' },
  { teamId: 'livescorebet', name: 'LiveScore Bet', url: 'https://www.livescorebet.com', ballColor: '#FF7A00', ringColor: '#000000', textColor: '#FFFFFF' },
  { teamId: 'galabingo', name: 'Gala Bingo', url: 'https://www.galabingo.com', ballColor: '#FFD400', ringColor: '#1E4AA8', textColor: '#000000' },
  { teamId: 'foxybingo', name: 'Foxy Bingo', url: 'https://www.foxybingo.com', ballColor: '#7A2DFF', ringColor: '#FF7A00', textColor: '#FFFFFF' },
  { teamId: 'coral', name: 'Coral', url: 'https://www.coral.co.uk', ballColor: '#1E73FF', ringColor: '#0B2E6B', textColor: '#FFFFFF', preseasonFavorite: true },
  { teamId: 'ladbrokes', name: 'Ladbrokes', url: 'https://www.ladbrokes.com', ballColor: '#E10600', ringColor: '#FFFFFF', textColor: '#FFFFFF', preseasonFavorite: true },
  { teamId: 'mrq', name: 'Mr Q', url: 'https://www.mrq.com', ballColor: '#FFFFFF', ringColor: '#0B2E6B', textColor: '#0B2E6B' },
  { teamId: 'bwin', name: 'Bwin', url: 'https://www.bwin.com', ballColor: '#000000', ringColor: '#FFD400', textColor: '#FFD400' },
  { teamId: 'skybet', name: 'Sky Bet', url: 'https://www.skybet.com', ballColor: '#E10600', ringColor: '#1E73FF', textColor: '#FFFFFF', preseasonFavorite: true },
  { teamId: 'skyvegas', name: 'Sky Vegas', url: 'https://www.skyvegas.com', ballColor: '#1E73FF', ringColor: '#E10600', textColor: '#FFFFFF', preseasonFavorite: true },
  { teamId: 'paddypower', name: 'Paddy Power', url: 'https://www.paddypower.com', ballColor: '#00A651', ringColor: '#FFFFFF', textColor: '#FFFFFF', preseasonFavorite: true },
  { teamId: 'virgingames', name: 'Virgin Games', url: 'https://www.virgingames.com', ballColor: '#E10600', ringColor: '#F2F2F2', textColor: '#FFFFFF' },
  { teamId: 'jackpotjoy', name: 'Jackpot Joy', url: 'https://www.jackpotjoy.com', ballColor: '#1E73FF', ringColor: '#FFFFFF', textColor: '#FFFFFF' },
  { teamId: 'doublebubble', name: 'Double Bubble Casino', url: 'https://www.doublebubblebingo.com', ballColor: '#FF4FB6', ringColor: '#C2185B', textColor: '#FFFFFF' },
  { teamId: 'monopolycasino', name: 'Monopoly Casino', url: 'https://www.monopolycasino.com', ballColor: '#0B2E6B', ringColor: '#FFFFFF', textColor: '#FFFFFF' },
  { teamId: 'rainbowriches', name: 'Rainbow Riches', url: 'https://www.rainbowrichescasino.com', ballColor: '#0B6B3A', ringColor: '#66CC66', textColor: '#FFFFFF' },
  { teamId: 'ballycasino', name: 'Bally Casino', url: 'https://www.ballycasino.co.uk', ballColor: '#FFFFFF', ringColor: '#8B0000', textColor: '#8B0000' },
  { teamId: 'tombola', name: 'Tombola', url: 'https://www.tombola.co.uk', ballColor: '#00A651', ringColor: '#FFFFFF', textColor: '#FFFFFF' },
  { teamId: 'grpcasino', name: 'GRP Casino', url: 'https://www.grpcasino.com', ballColor: '#000000', ringColor: '#FFD400', textColor: '#FFD400' },
  { teamId: 'casino888', name: '888 Casino', url: 'https://www.888casino.com', ballColor: '#0B6B3A', ringColor: '#000000', textColor: '#FFFFFF' },
] as const;
