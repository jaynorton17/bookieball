import { displayDivisionName } from './divisionLabels';
import type { TeamPalette } from './broadcastTheme';

type TeamMeta = {
  id: number;
  name: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
};

type TitleRaceRow = {
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

type LeagueFixture = {
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

export function formatDivisionName(division: string): string {
  return displayDivisionName(division);
}

export function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatOrdinal(value: number): string {
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

export function parseProfitFromValue(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function uppercaseName(value: string): string {
  return value.toUpperCase();
}

export function initials(name: string): string {
  const words = name.split(' ').filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function createPalette(meta?: Partial<TeamMeta> | null): TeamPalette {
  return {
    ballColor: meta?.ballColor ?? '#d6e9ff',
    ringColor: meta?.ringColor ?? '#91c7ff',
    textColor: meta?.textColor ?? '#0f1b2d',
  };
}

export function resolveStatus(index: number, total: number): TitleRaceRow['status'] {
  if (index === 0) {
    return 'champion';
  }
  if (total >= 4 && index === 2) {
    return 'playoff';
  }
  if (index === total - 1) {
    return 'danger';
  }
  return 'steady';
}

export function summarizeCupResult(
  decidedBy: string | null | undefined,
  played: boolean,
  winnerTeam: string | null | undefined,
): string {
  if (!played) {
    return 'Awaiting final';
  }
  if (!winnerTeam) {
    return 'Final unresolved';
  }
  switch (decidedBy) {
    case 'penalties':
    case 'aggregate_penalties':
      return 'Won on penalties';
    case 'spins':
    case 'aggregate_spins':
      return 'Won on spins';
    case 'aggregate_profit':
      return 'Won on aggregate';
    case 'profit':
    default:
      return 'Won in regulation';
  }
}

export function groupByDivision<T extends { division: string }>(rows: T[]): Array<{ division: string; rows: T[] }> {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    const list = grouped.get(row.division) ?? [];
    list.push(row);
    grouped.set(row.division, list);
  });
  return Array.from(grouped.entries()).map(([division, divisionRows]) => ({ division, rows: divisionRows }));
}

export function joinNames(names: string[]): string {
  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return names[0] ?? '';
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function isOfficialDivisionFixtureRecord(fixture: LeagueFixture): boolean {
  return fixture.division !== 'Playoff' && fixture.division !== 'Friendly' && fixture.gw !== 'GW8';
}

export function fixtureResultForTeam(fixture: LeagueFixture, teamName: string): 'W' | 'D' | 'L' | null {
  if (fixture.result === 'pending') {
    return null;
  }
  if (fixture.homeTeam !== teamName && fixture.awayTeam !== teamName) {
    return null;
  }
  if (fixture.result === 'draw') {
    return 'D';
  }
  if (fixture.homeTeam === teamName) {
    return fixture.result === 'home' ? 'W' : 'L';
  }
  return fixture.result === 'away' ? 'W' : 'L';
}

export function formString(results: Array<'W' | 'D' | 'L'>): string {
  return results.length > 0 ? results.join('-') : 'No form';
}

export function formPoints(results: Array<'W' | 'D' | 'L'>): number {
  return results.reduce((sum, result) => sum + (result === 'W' ? 3 : result === 'D' ? 1 : 0), 0);
}

export function uniqueTeamEntries(entries: Array<{ teamId: number | null; teamName: string }>): Array<{ teamId: number | null; teamName: string }> {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.teamName.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export type {
  TeamMeta,
  TitleRaceRow,
  LeagueFixture,
};
