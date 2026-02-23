import type { DivisionName, Gameweek } from './constants.js';

export type SeasonId = `S${number}`;

export type EntryType = 'free_spins' | 'bonus';

export interface Team {
  id: number;
  name: string;
  url: string;
  division: DivisionName;
}

export interface CurrentState {
  currentSeason: SeasonId;
  currentGw: Gameweek;
}

export interface EntryInput {
  teamId: number;
  entryType: EntryType;
  profit: number;
  spins?: number | null;
  stake?: number | null;
  notes?: string | null;
  noWin?: boolean;
}
