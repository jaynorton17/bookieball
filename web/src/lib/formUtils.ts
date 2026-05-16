export type FormBadgeResult = 'W' | 'D' | 'L';

type RecentFormOptions<T> = {
  fixtures: T[];
  include: (fixture: T) => boolean;
  resultOf: (fixture: T) => FormBadgeResult | null;
  getGw: (fixture: T) => string;
  getSecondarySort?: (fixture: T) => number;
  limit?: number;
};

export function gwOrderValue(gw: string): number {
  const match = /^GW(\d+)$/.exec(gw);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function seasonOrderValue(season: string): number {
  const match = /^S(\d+)$/.exec(season);
  return match ? Number(match[1]) : -1;
}

export function isOfficialDivisionFixture(division: string, gw: string): boolean {
  return division !== 'Playoff' && division !== 'Friendly' && gw !== 'GW8';
}

export function recentForm<T>({
  fixtures,
  include,
  resultOf,
  getGw,
  getSecondarySort,
  limit = 5,
}: RecentFormOptions<T>): FormBadgeResult[] {
  return fixtures
    .filter(include)
    .sort((left, right) => {
      const gwDelta = gwOrderValue(getGw(left)) - gwOrderValue(getGw(right));
      if (gwDelta !== 0) {
        return gwDelta;
      }
      return (getSecondarySort?.(left) ?? 0) - (getSecondarySort?.(right) ?? 0);
    })
    .map(resultOf)
    .filter((value): value is FormBadgeResult => value !== null)
    .slice(-limit);
}

export function sortWinnersMostRecent<T extends { season: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => seasonOrderValue(right.season) - seasonOrderValue(left.season));
}
