const BASE_DIVISION_ORDER = [
  'Champions Bookies',
  'Premier Bookies',
  'Average Bookies',
  'Struggling Bookies',
  'Awful Bookies',
];

export const DIVISION_FOUR_BOOKIES = 'Division 4 Bookies';

const DIVISION_LABEL_OVERRIDES: Record<string, string> = {
  'Average Bookies': 'Division 1',
  'Struggling Bookies': 'Division 2',
  'Awful Bookies': 'Division 3',
  [DIVISION_FOUR_BOOKIES]: 'Division 4',
};

function parseSeasonNumber(season: string | null | undefined): number {
  if (!season) {
    return 0;
  }
  const match = String(season).match(/(\d+)/);
  if (!match?.[1]) {
    return 0;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isSeasonFiveOrLater(season: string | null | undefined): boolean {
  return parseSeasonNumber(season) >= 5;
}

export function isSeasonSixOrLater(season: string | null | undefined): boolean {
  return parseSeasonNumber(season) >= 6;
}

export function getDivisionOrderForSeason(season: string | null | undefined): string[] {
  if (isSeasonFiveOrLater(season)) {
    return [...BASE_DIVISION_ORDER, DIVISION_FOUR_BOOKIES];
  }
  return [...BASE_DIVISION_ORDER];
}

export function sortDivisionNames(divisions: string[], season: string | null | undefined): string[] {
  const order = getDivisionOrderForSeason(season);
  const indexByDivision = new Map(order.map((division, index) => [division, index]));
  return divisions
    .slice()
    .sort((left, right) => {
      const leftIndex = indexByDivision.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = indexByDivision.get(right) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return left.localeCompare(right);
    });
}

export function displayDivisionName(division: string | null | undefined): string {
  if (!division) {
    return '';
  }
  return DIVISION_LABEL_OVERRIDES[division] ?? division;
}
