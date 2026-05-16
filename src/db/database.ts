import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  DEFAULT_TEAMS,
  DIVISION_FOUR,
  DIVISION_ORDER,
  GAMEWEEKS,
  getDivisionOrderForSeason,
  getDivisionSlotsForSeason,
  getTierLeagueEndGwForSeason,
  getTierLeagueGameweeksForSeason,
  getTierLeagueStartGwForSeason,
  isSeasonFiveOrLater,
  isSeasonSixOrLater,
  TIER_LEAGUE_DIVISION_ORDER,
  TIER_LEAGUE_DIVISION_SIZE,
  TRIO_DIVISION_ORDER,
  TRIO_DIVISION_SIZE,
  TRIO_REGULAR_SEASON_GAMEWEEKS,
} from '../shared/constants.js';
import type { DivisionName, TierLeagueDivisionName, TrioDivisionName } from '../shared/constants.js';
import type { CurrentState, EntryInput, EntryType, SeasonId } from '../shared/types.js';

export const BOOKIEBALL_DIR = path.join(os.homedir(), '.bookieball');
export const DB_PATH = path.join(BOOKIEBALL_DIR, 'bookieball.db');
export const BACKUPS_DIR = path.join(BOOKIEBALL_DIR, 'backups');
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');
export const BUNDLED_DB_PATH = path.join(PACKAGE_ROOT, 'bookieball.db');

const MIGRATIONS: Array<{ id: number; name: string; sql: string }> = [
  {
    id: 1,
    name: 'base_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        run_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id TEXT UNIQUE,
        name TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        ball_color TEXT,
        ring_color TEXT,
        text_color TEXT,
        preseason_favorite INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS season_teams (
        season TEXT NOT NULL,
        team_id INTEGER NOT NULL,
        division TEXT NOT NULL,
        PRIMARY KEY (season, team_id),
        FOREIGN KEY(team_id) REFERENCES teams(id)
      );

      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        team_id INTEGER NOT NULL,
        entry_type TEXT NOT NULL,
        profit REAL NOT NULL,
        spins INTEGER,
        stake REAL,
        notes TEXT,
        no_win INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(team_id) REFERENCES teams(id)
      );

      CREATE TABLE IF NOT EXISTS cup_fixtures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        round_name TEXT NOT NULL,
        home_team_id INTEGER,
        away_team_id INTEGER,
        winner_team_id INTEGER,
        source_game_a INTEGER,
        source_game_b INTEGER,
        is_manual INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(home_team_id) REFERENCES teams(id),
        FOREIGN KEY(away_team_id) REFERENCES teams(id),
        FOREIGN KEY(winner_team_id) REFERENCES teams(id),
        FOREIGN KEY(source_game_a) REFERENCES cup_fixtures(id),
        FOREIGN KEY(source_game_b) REFERENCES cup_fixtures(id)
      );

      CREATE TABLE IF NOT EXISTS awards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        team_id INTEGER NOT NULL,
        award_type TEXT NOT NULL,
        value TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(team_id) REFERENCES teams(id)
      );

      CREATE TABLE IF NOT EXISTS league_fixtures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        division TEXT NOT NULL,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        FOREIGN KEY(home_team_id) REFERENCES teams(id),
        FOREIGN KEY(away_team_id) REFERENCES teams(id)
      );

      CREATE TABLE IF NOT EXISTS gameshow_draws (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(season, gw, team_id),
        FOREIGN KEY(team_id) REFERENCES teams(id)
      );
    `,
  },
  {
    id: 2,
    name: 'teams_brand_columns',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS teams_team_id_unique ON teams(team_id);
    `,
  },
  {
    id: 3,
    name: 'league_fixtures_table',
    sql: `
      CREATE TABLE IF NOT EXISTS league_fixtures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        division TEXT NOT NULL,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        FOREIGN KEY(home_team_id) REFERENCES teams(id),
        FOREIGN KEY(away_team_id) REFERENCES teams(id)
      );
    `,
  },
  {
    id: 4,
    name: 'gameshow_draws_table',
    sql: `
      CREATE TABLE IF NOT EXISTS gameshow_draws (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(season, gw, team_id),
        FOREIGN KEY(team_id) REFERENCES teams(id)
      );
    `,
  },
  {
    id: 5,
    name: 'cup_audit_log',
    sql: `
      CREATE TABLE IF NOT EXISTS cup_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        fixture_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'system',
        old_home_team_id INTEGER,
        old_away_team_id INTEGER,
        old_winner_team_id INTEGER,
        new_home_team_id INTEGER,
        new_away_team_id INTEGER,
        new_winner_team_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(fixture_id) REFERENCES cup_fixtures(id),
        FOREIGN KEY(old_home_team_id) REFERENCES teams(id),
        FOREIGN KEY(old_away_team_id) REFERENCES teams(id),
        FOREIGN KEY(old_winner_team_id) REFERENCES teams(id),
        FOREIGN KEY(new_home_team_id) REFERENCES teams(id),
        FOREIGN KEY(new_away_team_id) REFERENCES teams(id),
        FOREIGN KEY(new_winner_team_id) REFERENCES teams(id)
      );
    `,
  },
  {
    id: 6,
    name: 'gw_snapshots',
    sql: `
      CREATE TABLE IF NOT EXISTS gw_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        label TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    id: 7,
    name: 'entries_batch_and_gw_lock',
    sql: `
      CREATE TABLE IF NOT EXISTS entry_batches (
        id TEXT PRIMARY KEY,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    id: 8,
    name: 'entry_audit_log',
    sql: `
      CREATE TABLE IF NOT EXISTS entry_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'admin',
        old_entry_type TEXT,
        old_profit REAL,
        old_spins INTEGER,
        old_stake REAL,
        old_notes TEXT,
        old_no_win INTEGER,
        new_entry_type TEXT,
        new_profit REAL,
        new_spins INTEGER,
        new_stake REAL,
        new_notes TEXT,
        new_no_win INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(entry_id) REFERENCES entries(id)
      );
    `,
  },
  {
    id: 9,
    name: 'predictions_table',
    sql: `
      CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        competition TEXT NOT NULL,
        fixture_id INTEGER NOT NULL,
        picker TEXT NOT NULL,
        pick_team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(season, gw, competition, fixture_id, picker),
        FOREIGN KEY(pick_team_id) REFERENCES teams(id)
      );
    `,
  },
  {
    id: 10,
    name: 'predictions_outcomes_and_scores',
    sql: `
      CREATE TABLE IF NOT EXISTS predictions_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        competition TEXT NOT NULL,
        fixture_id INTEGER NOT NULL,
        picker TEXT NOT NULL,
        pick_outcome TEXT NOT NULL DEFAULT 'team',
        pick_team_id INTEGER,
        predicted_home_score REAL,
        predicted_away_score REAL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(season, gw, competition, fixture_id, picker),
        FOREIGN KEY(pick_team_id) REFERENCES teams(id)
      );

      INSERT INTO predictions_v2 (
        id,
        season,
        gw,
        competition,
        fixture_id,
        picker,
        pick_outcome,
        pick_team_id,
        predicted_home_score,
        predicted_away_score,
        created_at
      )
      SELECT
        id,
        season,
        gw,
        competition,
        fixture_id,
        CASE WHEN picker = 'CPU' THEN 'Computer' ELSE picker END,
        'team',
        pick_team_id,
        NULL,
        NULL,
        created_at
      FROM predictions;

      DROP TABLE predictions;
      ALTER TABLE predictions_v2 RENAME TO predictions;
    `,
  },
  {
    id: 11,
    name: 'master_league_fixtures',
    sql: `
      CREATE TABLE IF NOT EXISTS master_league_fixtures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(home_team_id) REFERENCES teams(id),
        FOREIGN KEY(away_team_id) REFERENCES teams(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS master_league_fixture_unique
        ON master_league_fixtures(season, gw, home_team_id, away_team_id);
      CREATE INDEX IF NOT EXISTS master_league_fixture_season_gw
        ON master_league_fixtures(season, gw);
    `,
  },
  {
    id: 12,
    name: 'reporting_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS entries_season_gw_team_idx
        ON entries(season, gw, team_id);
      CREATE INDEX IF NOT EXISTS entries_team_season_idx
        ON entries(team_id, season);
      CREATE INDEX IF NOT EXISTS entries_season_team_created_idx
        ON entries(season, team_id, created_at);
      CREATE INDEX IF NOT EXISTS entries_batch_idx
        ON entries(batch_id);

      CREATE INDEX IF NOT EXISTS league_fixtures_season_gw_division_idx
        ON league_fixtures(season, gw, division);
      CREATE INDEX IF NOT EXISTS league_fixtures_season_pair_idx
        ON league_fixtures(season, home_team_id, away_team_id);

      CREATE INDEX IF NOT EXISTS cup_fixtures_season_gw_idx
        ON cup_fixtures(season, gw);
      CREATE INDEX IF NOT EXISTS cup_fixtures_season_winner_idx
        ON cup_fixtures(season, winner_team_id);

      CREATE INDEX IF NOT EXISTS season_teams_season_division_idx
        ON season_teams(season, division);
      CREATE INDEX IF NOT EXISTS season_teams_team_season_idx
        ON season_teams(team_id, season);

      CREATE INDEX IF NOT EXISTS awards_season_type_idx
        ON awards(season, award_type);
      CREATE INDEX IF NOT EXISTS awards_team_type_idx
        ON awards(team_id, award_type);

      CREATE INDEX IF NOT EXISTS predictions_season_gw_competition_idx
        ON predictions(season, gw, competition);
      CREATE INDEX IF NOT EXISTS predictions_season_picker_gw_idx
        ON predictions(season, picker, gw);

      CREATE INDEX IF NOT EXISTS gw_snapshots_season_gw_idx
        ON gw_snapshots(season, gw);
      CREATE INDEX IF NOT EXISTS gw_snapshots_season_created_idx
        ON gw_snapshots(season, created_at);

      CREATE INDEX IF NOT EXISTS entry_batches_season_gw_created_idx
        ON entry_batches(season, gw, created_at);
      CREATE INDEX IF NOT EXISTS entry_audit_log_season_gw_created_idx
        ON entry_audit_log(season, gw, created_at);
      CREATE INDEX IF NOT EXISTS cup_audit_log_season_gw_created_idx
        ON cup_audit_log(season, gw, created_at);
    `,
  },
  {
    id: 13,
    name: 'team_trend_cache',
    sql: `
      CREATE TABLE IF NOT EXISTS team_trend_cache (
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        team_id INTEGER NOT NULL,
        window_size INTEGER NOT NULL DEFAULT 3,
        from_gw TEXT NOT NULL,
        to_gw TEXT NOT NULL,
        rank_delta INTEGER NOT NULL DEFAULT 0,
        points_delta INTEGER NOT NULL DEFAULT 0,
        profit_delta REAL NOT NULL DEFAULT 0,
        points_delta_vs_previous_window INTEGER,
        profit_delta_vs_previous_window REAL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (season, gw, team_id),
        FOREIGN KEY(team_id) REFERENCES teams(id)
      );

      CREATE INDEX IF NOT EXISTS team_trend_cache_season_gw_idx
        ON team_trend_cache(season, gw);
    `,
  },
  {
    id: 14,
    name: 'trio_league_fixtures',
    sql: `
      CREATE TABLE IF NOT EXISTS trio_league_fixtures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        group_slot INTEGER NOT NULL,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(home_team_id) REFERENCES teams(id),
        FOREIGN KEY(away_team_id) REFERENCES teams(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS trio_league_fixture_unique
        ON trio_league_fixtures(season, gw, group_slot, home_team_id, away_team_id);
      CREATE INDEX IF NOT EXISTS trio_league_fixture_season_gw
        ON trio_league_fixtures(season, gw);
    `,
  },
  {
    id: 15,
    name: 'gw8_playoff_penalties',
    sql: `
      CREATE TABLE IF NOT EXISTS gw8_playoff_penalties (
        season TEXT NOT NULL,
        fixture_id INTEGER NOT NULL,
        winner_team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (season, fixture_id),
        FOREIGN KEY(fixture_id) REFERENCES league_fixtures(id),
        FOREIGN KEY(winner_team_id) REFERENCES teams(id)
      );
      CREATE INDEX IF NOT EXISTS gw8_playoff_penalties_season_idx
        ON gw8_playoff_penalties(season);
    `,
  },
  {
    id: 16,
    name: 'trio_league_division_and_stage',
    sql: `
      ALTER TABLE trio_league_fixtures ADD COLUMN division TEXT NOT NULL DEFAULT '';
      ALTER TABLE trio_league_fixtures ADD COLUMN stage TEXT NOT NULL DEFAULT 'regular';
      CREATE INDEX IF NOT EXISTS trio_league_fixture_season_gw_division_stage
        ON trio_league_fixtures(season, gw, division, stage);
    `,
  },
  {
    id: 17,
    name: 'master_cup_fixtures',
    sql: `
      CREATE TABLE IF NOT EXISTS master_cup_fixtures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        stage TEXT NOT NULL,
        tie_slot INTEGER NOT NULL,
        leg_number INTEGER NOT NULL DEFAULT 1,
        home_team_id INTEGER,
        away_team_id INTEGER,
        winner_team_id INTEGER,
        source_fixture_a INTEGER,
        source_fixture_b INTEGER,
        source_outcome_a TEXT NOT NULL DEFAULT 'winner',
        source_outcome_b TEXT NOT NULL DEFAULT 'winner',
        home_seed INTEGER,
        away_seed INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(home_team_id) REFERENCES teams(id),
        FOREIGN KEY(away_team_id) REFERENCES teams(id),
        FOREIGN KEY(winner_team_id) REFERENCES teams(id),
        FOREIGN KEY(source_fixture_a) REFERENCES master_cup_fixtures(id),
        FOREIGN KEY(source_fixture_b) REFERENCES master_cup_fixtures(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS master_cup_fixture_unique
        ON master_cup_fixtures(season, gw, stage, tie_slot, leg_number);
      CREATE INDEX IF NOT EXISTS master_cup_fixture_season_gw
        ON master_cup_fixtures(season, gw);
      CREATE INDEX IF NOT EXISTS master_cup_fixture_season_stage
        ON master_cup_fixtures(season, stage);
    `,
  },
  {
    id: 18,
    name: 'trio_playoff_penalties',
    sql: `
      CREATE TABLE IF NOT EXISTS trio_playoff_penalties (
        season TEXT NOT NULL,
        fixture_id INTEGER NOT NULL,
        winner_team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (season, fixture_id),
        FOREIGN KEY(fixture_id) REFERENCES trio_league_fixtures(id),
        FOREIGN KEY(winner_team_id) REFERENCES teams(id)
      );
      CREATE INDEX IF NOT EXISTS trio_playoff_penalties_season_idx
        ON trio_playoff_penalties(season);
    `,
  },
  {
    id: 19,
    name: 'tier_league_fixtures',
    sql: `
      CREATE TABLE IF NOT EXISTS tier_league_fixtures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL,
        division TEXT NOT NULL,
        fixture_type TEXT NOT NULL DEFAULT 'division',
        group_slot INTEGER NOT NULL,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(home_team_id) REFERENCES teams(id),
        FOREIGN KEY(away_team_id) REFERENCES teams(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tier_league_fixture_unique
        ON tier_league_fixtures(season, gw, division, fixture_type, group_slot, home_team_id, away_team_id);
      CREATE INDEX IF NOT EXISTS tier_league_fixture_season_gw
        ON tier_league_fixtures(season, gw);
      CREATE INDEX IF NOT EXISTS tier_league_fixture_season_division
        ON tier_league_fixtures(season, division, fixture_type);
    `,
  },
  {
    id: 20,
    name: 'super_cup_fixtures',
    sql: `
      CREATE TABLE IF NOT EXISTS super_cup_fixtures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season TEXT NOT NULL,
        gw TEXT NOT NULL DEFAULT 'GW1',
        source_season TEXT NOT NULL,
        pairing_reason TEXT NOT NULL,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        winner_team_id INTEGER,
        bookieball_winner_team_id INTEGER NOT NULL,
        bookieball_runner_up_team_id INTEGER NOT NULL,
        master_cup_winner_team_id INTEGER NOT NULL,
        master_cup_runner_up_team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(home_team_id) REFERENCES teams(id),
        FOREIGN KEY(away_team_id) REFERENCES teams(id),
        FOREIGN KEY(winner_team_id) REFERENCES teams(id),
        FOREIGN KEY(bookieball_winner_team_id) REFERENCES teams(id),
        FOREIGN KEY(bookieball_runner_up_team_id) REFERENCES teams(id),
        FOREIGN KEY(master_cup_winner_team_id) REFERENCES teams(id),
        FOREIGN KEY(master_cup_runner_up_team_id) REFERENCES teams(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS super_cup_fixture_season_gw_unique
        ON super_cup_fixtures(season, gw);
      CREATE INDEX IF NOT EXISTS super_cup_fixture_source_season_idx
        ON super_cup_fixtures(source_season);
      CREATE INDEX IF NOT EXISTS super_cup_fixture_winner_idx
        ON super_cup_fixtures(winner_team_id);
    `,
  },
  {
    id: 21,
    name: 'master_cup_penalties',
    sql: `
      CREATE TABLE IF NOT EXISTS master_cup_penalties (
        season TEXT NOT NULL,
        fixture_id INTEGER NOT NULL,
        winner_team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (season, fixture_id),
        FOREIGN KEY(fixture_id) REFERENCES master_cup_fixtures(id),
        FOREIGN KEY(winner_team_id) REFERENCES teams(id)
      );
      CREATE INDEX IF NOT EXISTS master_cup_penalties_season_idx
        ON master_cup_penalties(season);
    `,
  },
  {
    id: 22,
    name: 'super_cup_penalties',
    sql: `
      CREATE TABLE IF NOT EXISTS super_cup_penalties (
        season TEXT NOT NULL,
        fixture_id INTEGER NOT NULL,
        winner_team_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (season, fixture_id),
        FOREIGN KEY(fixture_id) REFERENCES super_cup_fixtures(id),
        FOREIGN KEY(winner_team_id) REFERENCES teams(id)
      );
      CREATE INDEX IF NOT EXISTS super_cup_penalties_season_idx
        ON super_cup_penalties(season);
    `,
  },
  {
    id: 23,
    name: 'locked_awards_unique_index',
    sql: `
      DELETE FROM awards
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM awards
        GROUP BY season, award_type, value
      );
      CREATE UNIQUE INDEX IF NOT EXISTS awards_season_type_value_unique
        ON awards(season, award_type, value);
    `,
  },
];

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createBatchId(): string {
  return `b_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function parseSeasonNumber(season: SeasonId): number {
  return Number.parseInt(season.slice(1), 10);
}

const AUTO_STAKE_PROFIT_START_SEASON = 4;

const SEASON_FIVE_EXPANSION_TEAMS = [
  {
    teamId: 'tote',
    name: 'Tote',
    url: 'https://www.tote.co.uk',
    ballColor: '#C81E1E',
    ringColor: '#FFFFFF',
    textColor: '#FFFFFF',
  },
  {
    teamId: 'quinn',
    name: 'Quinn',
    url: 'https://www.quinnbet.com',
    ballColor: '#0A0A0A',
    ringColor: '#D4AF37',
    textColor: '#D4AF37',
  },
  {
    teamId: 'lottoland',
    name: 'Lottoland',
    url: 'https://www.lottoland.co.uk',
    ballColor: '#1D4ED8',
    ringColor: '#FFFFFF',
    textColor: '#FFFFFF',
  },
  {
    teamId: 'kwiff',
    name: 'Kwiff',
    url: 'https://kwiff.com',
    ballColor: '#7C3AED',
    ringColor: '#E9D5FF',
    textColor: '#FFFFFF',
  },
] as const;

type CarryoverStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
};

function isAutoStakeProfitSeason(season: SeasonId): boolean {
  const seasonNumber = parseSeasonNumber(season);
  return Number.isFinite(seasonNumber) && seasonNumber >= AUTO_STAKE_PROFIT_START_SEASON;
}

function normalizeNullableNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toSafeNumber(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeEntryNumbers(
  entryType: EntryType,
  spins: number | null | undefined,
  stake: number | null | undefined,
): { spins: number | null; stake: number | null } {
  const normalizedStake = normalizeNullableNumber(stake);
  if (entryType === 'bonus') {
    return { spins: null, stake: normalizedStake };
  }
  return {
    spins: normalizeNullableNumber(spins),
    stake: normalizedStake,
  };
}

function computeStoredEntryProfit(
  season: SeasonId,
  entryType: EntryType,
  reportedProfit: number,
  spins: number | null | undefined,
  stake: number | null | undefined,
): number {
  const baseProfit = toSafeNumber(reportedProfit);
  if (!isAutoStakeProfitSeason(season)) {
    return Number(baseProfit.toFixed(2));
  }
  const normalizedStake = toSafeNumber(stake);
  const autoProfit = entryType === 'free_spins'
    ? toSafeNumber(spins) * normalizedStake
    : normalizedStake;
  return Number((baseProfit + autoProfit).toFixed(2));
}

function ensureSeasonFiveExpansionTeams(db: Database.Database): void {
  const insert = db.prepare(
    `
    INSERT INTO teams (team_id, name, url, ball_color, ring_color, text_color, preseason_favorite)
    VALUES (?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(team_id) DO UPDATE SET
      name = excluded.name,
      url = excluded.url,
      ball_color = excluded.ball_color,
      ring_color = excluded.ring_color,
      text_color = excluded.text_color
    `,
  );
  const tx = db.transaction(() => {
    SEASON_FIVE_EXPANSION_TEAMS.forEach((team) => {
      insert.run(team.teamId, team.name, team.url, team.ballColor, team.ringColor, team.textColor);
    });
  });
  tx();
}

function seasonFiveExpansionTeamIds(db: Database.Database): number[] {
  const placeholders = SEASON_FIVE_EXPANSION_TEAMS.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT id FROM teams WHERE team_id IN (${placeholders}) ORDER BY id`)
    .all(...SEASON_FIVE_EXPANSION_TEAMS.map((team) => team.teamId)) as Array<{ id: number }>;
  return rows.map((row) => row.id);
}

function normalizeCarryoverStats(input: Partial<CarryoverStats> | null | undefined): CarryoverStats {
  return {
    played: Math.max(0, Math.floor(Number(input?.played ?? 0))),
    wins: Math.max(0, Math.floor(Number(input?.wins ?? 0))),
    draws: Math.max(0, Math.floor(Number(input?.draws ?? 0))),
    losses: Math.max(0, Math.floor(Number(input?.losses ?? 0))),
    points: Math.max(0, Math.floor(Number(input?.points ?? 0))),
    profit: Number((Number(input?.profit ?? 0) || 0).toFixed(2)),
    spins: Math.max(0, Math.floor(Number(input?.spins ?? 0))),
  };
}

function seasonFiveExpansionCarryoverKey(kind: 'master' | 'alltime'): string {
  return `s5_expansion_${kind}_carryover`;
}

function clearLegacySeasonFiveMasterCarryover(db: Database.Database): void {
  db.prepare('DELETE FROM settings WHERE key = ?').run(seasonFiveExpansionCarryoverKey('master'));
}

function saveSeasonFiveExpansionCarryover(
  db: Database.Database,
  kind: 'master' | 'alltime',
  values: Record<number, CarryoverStats>,
): void {
  setSetting(db, seasonFiveExpansionCarryoverKey(kind), JSON.stringify(values));
}

function readSeasonFiveExpansionCarryover(
  db: Database.Database,
  kind: 'master' | 'alltime',
): Map<number, CarryoverStats> {
  const raw = getSetting(db, seasonFiveExpansionCarryoverKey(kind));
  if (!raw) {
    return new Map();
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<CarryoverStats>>;
    const map = new Map<number, CarryoverStats>();
    Object.entries(parsed).forEach(([teamIdKey, value]) => {
      const teamId = Number(teamIdKey);
      if (!Number.isFinite(teamId) || teamId <= 0) {
        return;
      }
      map.set(teamId, normalizeCarryoverStats(value));
    });
    return map;
  } catch {
    return new Map();
  }
}

function carryoverIsAllZero(values: Map<number, CarryoverStats>): boolean {
  if (values.size === 0) {
    return true;
  }
  return Array.from(values.values()).every((value) => (
    value.played === 0
    && value.wins === 0
    && value.draws === 0
    && value.losses === 0
    && value.points === 0
    && value.profit === 0
    && value.spins === 0
  ));
}

function seedSeasonFiveExpansionCarryovers(
  db: Database.Database,
  season: SeasonId,
  expansionTeamIds: number[],
  _masterBottom: CarryoverStats | null,
  allTimeBottom: CarryoverStats | null,
): void {
  if (expansionTeamIds.length === 0 || !isSeasonFiveOrLater(season)) {
    return;
  }
  const existingAllTime = readSeasonFiveExpansionCarryover(db, 'alltime');
  if (existingAllTime.size > 0) {
    return;
  }

  const allTimeSeed = normalizeCarryoverStats(allTimeBottom);
  const allTimeByTeam: Record<number, CarryoverStats> = {};
  expansionTeamIds.forEach((teamId) => {
    allTimeByTeam[teamId] = allTimeSeed;
  });
  saveSeasonFiveExpansionCarryover(db, 'alltime', allTimeByTeam);
}

function gwIndex(gw: string): number {
  return GAMEWEEKS.indexOf(gw as (typeof GAMEWEEKS)[number]);
}

function gwNumber(gw: string): number {
  const idx = gwIndex(gw);
  return idx >= 0 ? idx + 1 : 99;
}

type TeamTrendSnapshot = {
  rank: number;
  points: number;
  profit: number;
};

function teamTrendSnapshotForGw(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Map<number, TeamTrendSnapshot> {
  const table = getLeagueTable(db, season, gw);
  const map = new Map<number, TeamTrendSnapshot>();
  Object.values(table).forEach((rows) => {
    rows.forEach((row) => {
      map.set(row.teamId, {
        rank: row.rank,
        points: row.points,
        profit: row.profit,
      });
    });
  });
  return map;
}

export function recomputeTeamTrendCache(
  db: Database.Database,
  season: SeasonId,
  gw: string,
  windowSize = 3,
): void {
  const currentIdx = gwIndex(gw);
  if (currentIdx < 0) {
    return;
  }
  const currentGw = GAMEWEEKS[currentIdx];
  if (!currentGw) {
    return;
  }

  const effectiveWindowSize = Math.max(1, Math.min(windowSize, GAMEWEEKS.length));
  const baselineIdx = Math.max(0, currentIdx - effectiveWindowSize);
  const previousWindowStartIdx = Math.max(0, baselineIdx - effectiveWindowSize);
  const baselineGw = GAMEWEEKS[baselineIdx] ?? currentGw;
  const previousWindowStartGw = GAMEWEEKS[previousWindowStartIdx] ?? baselineGw;
  const hasPreviousWindow = baselineIdx > 0;

  const currentSnapshot = teamTrendSnapshotForGw(db, season, currentGw);
  const baselineSnapshot = teamTrendSnapshotForGw(db, season, baselineGw);
  const previousSnapshot = hasPreviousWindow
    ? teamTrendSnapshotForGw(db, season, previousWindowStartGw)
    : baselineSnapshot;
  const teamIds = (
    db.prepare('SELECT team_id FROM season_teams WHERE season = ? ORDER BY team_id')
      .all(season) as Array<{ team_id: number }>
  ).map((row) => row.team_id);

  const clearStmt = db.prepare('DELETE FROM team_trend_cache WHERE season = ? AND gw = ?');
  const upsertStmt = db.prepare(
    `
    INSERT INTO team_trend_cache (
      season,
      gw,
      team_id,
      window_size,
      from_gw,
      to_gw,
      rank_delta,
      points_delta,
      profit_delta,
      points_delta_vs_previous_window,
      profit_delta_vs_previous_window,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(season, gw, team_id) DO UPDATE SET
      window_size = excluded.window_size,
      from_gw = excluded.from_gw,
      to_gw = excluded.to_gw,
      rank_delta = excluded.rank_delta,
      points_delta = excluded.points_delta,
      profit_delta = excluded.profit_delta,
      points_delta_vs_previous_window = excluded.points_delta_vs_previous_window,
      profit_delta_vs_previous_window = excluded.profit_delta_vs_previous_window,
      updated_at = CURRENT_TIMESTAMP
    `,
  );

  const tx = db.transaction(() => {
    clearStmt.run(season, currentGw);
    teamIds.forEach((teamId) => {
      const current = currentSnapshot.get(teamId);
      const baseline = baselineSnapshot.get(teamId);
      if (!current || !baseline) {
        return;
      }
      const rankDelta = baseline.rank - current.rank;
      const pointsDelta = current.points - baseline.points;
      const profitDelta = Number((current.profit - baseline.profit).toFixed(2));

      let pointsDeltaVsPreviousWindow: number | null = null;
      let profitDeltaVsPreviousWindow: number | null = null;
      if (hasPreviousWindow) {
        const previous = previousSnapshot.get(teamId);
        if (previous) {
          const previousPointsDelta = baseline.points - previous.points;
          const previousProfitDelta = baseline.profit - previous.profit;
          pointsDeltaVsPreviousWindow = pointsDelta - previousPointsDelta;
          profitDeltaVsPreviousWindow = Number((profitDelta - previousProfitDelta).toFixed(2));
        }
      }

      upsertStmt.run(
        season,
        currentGw,
        teamId,
        effectiveWindowSize,
        baselineGw,
        currentGw,
        rankDelta,
        pointsDelta,
        profitDelta,
        pointsDeltaVsPreviousWindow,
        profitDeltaVsPreviousWindow,
      );
    });
  });
  tx();
}

export function getTeamTrendCache(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{
  teamId: number;
  windowSize: number;
  fromGw: string;
  toGw: string;
  rankDelta: number;
  pointsDelta: number;
  profitDelta: number;
  pointsDeltaVsPreviousWindow: number | null;
  profitDeltaVsPreviousWindow: number | null;
}> {
  const normalizedGw = GAMEWEEKS.includes(gw as (typeof GAMEWEEKS)[number]) ? gw : 'GW1';
  let rows = db
    .prepare(
      `
      SELECT
        team_id,
        window_size,
        from_gw,
        to_gw,
        rank_delta,
        points_delta,
        profit_delta,
        points_delta_vs_previous_window,
        profit_delta_vs_previous_window
      FROM team_trend_cache
      WHERE season = ? AND gw = ?
      ORDER BY team_id
      `,
    )
    .all(season, normalizedGw) as Array<{
    team_id: number;
    window_size: number;
    from_gw: string;
    to_gw: string;
    rank_delta: number;
    points_delta: number;
    profit_delta: number;
    points_delta_vs_previous_window: number | null;
    profit_delta_vs_previous_window: number | null;
  }>;

  if (rows.length === 0) {
    recomputeTeamTrendCache(db, season, normalizedGw);
    rows = db
      .prepare(
        `
        SELECT
          team_id,
          window_size,
          from_gw,
          to_gw,
          rank_delta,
          points_delta,
          profit_delta,
          points_delta_vs_previous_window,
          profit_delta_vs_previous_window
        FROM team_trend_cache
        WHERE season = ? AND gw = ?
        ORDER BY team_id
        `,
      )
      .all(season, normalizedGw) as typeof rows;
  }

  return rows.map((row) => ({
    teamId: row.team_id,
    windowSize: row.window_size,
    fromGw: row.from_gw,
    toGw: row.to_gw,
    rankDelta: Number(row.rank_delta),
    pointsDelta: Number(row.points_delta),
    profitDelta: Number(Number(row.profit_delta).toFixed(2)),
    pointsDeltaVsPreviousWindow: row.points_delta_vs_previous_window === null
      ? null
      : Number(row.points_delta_vs_previous_window),
    profitDeltaVsPreviousWindow: row.profit_delta_vs_previous_window === null
      ? null
      : Number(Number(row.profit_delta_vs_previous_window).toFixed(2)),
  }));
}

type CupTieBreakMode = 'random' | 'lower_team_id';

function nextSeason(season: SeasonId): SeasonId {
  return `S${parseSeasonNumber(season) + 1}`;
}

function readTeamSeedFile():
  | Array<{ teamId: string; name: string; url: string; ballColor?: string; ringColor?: string; textColor?: string; preseasonFavorite?: boolean }>
  | null {
  const customFile = process.env.BOOKIEBALL_TEAMS_JSON ?? path.join(BOOKIEBALL_DIR, 'teams.json');
  if (!fs.existsSync(customFile)) {
    return null;
  }

  const raw = fs.readFileSync(customFile, 'utf8');
  const parsed = JSON.parse(raw) as Array<{
    team_id?: string;
    teamId?: string;
    name: string;
    url: string;
    ball_color?: string;
    ballColor?: string;
    ring_color?: string;
    ringColor?: string;
    text_color?: string;
    textColor?: string;
    preseason_favorite?: number | boolean;
    preseasonFavorite?: number | boolean;
  }>;
  if (!Array.isArray(parsed) || (parsed.length !== 20 && parsed.length !== 24)) {
    throw new Error(`Team seed file must include exactly 20 or 24 team objects: ${customFile}`);
  }
  return parsed.map((team, index) => ({
    teamId: team.team_id ?? team.teamId ?? `team-${index + 1}`,
    name: team.name,
    url: team.url,
    ballColor: team.ball_color ?? team.ballColor,
    ringColor: team.ring_color ?? team.ringColor,
    textColor: team.text_color ?? team.textColor,
    preseasonFavorite: Boolean(team.preseason_favorite ?? team.preseasonFavorite),
  }));
}

export function ensureBookieballDir(): void {
  if (!fs.existsSync(BOOKIEBALL_DIR)) {
    fs.mkdirSync(BOOKIEBALL_DIR, { recursive: true });
  }
}

function bundledDatabaseAvailable(): boolean {
  try {
    return fs.statSync(BUNDLED_DB_PATH).size > 0;
  } catch {
    return false;
  }
}

function ensureDatabaseFile(): void {
  ensureBookieballDir();
  if (fs.existsSync(DB_PATH)) {
    return;
  }
  if (bundledDatabaseAvailable()) {
    fs.copyFileSync(BUNDLED_DB_PATH, DB_PATH);
  }
}

function sanitizeBackupLabel(label: string): string {
  const normalized = label.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'manual';
}

function backupTimestamp(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

export function createDatabaseBackup(label = 'manual'): string | null {
  if (!fs.existsSync(DB_PATH)) {
    return null;
  }
  ensureBookieballDir();
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const filename = `bookieball-${sanitizeBackupLabel(label)}-${backupTimestamp()}.db`;
  const targetPath = path.join(BACKUPS_DIR, filename);
  fs.copyFileSync(DB_PATH, targetPath);
  return targetPath;
}

export function openDatabase(): Database.Database {
  ensureDatabaseFile();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const hasTeamsTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'teams' LIMIT 1")
    .get() as { 1: number } | undefined;
  if (hasTeamsTable) {
    ensureSeasonFiveExpansionTeams(db);
  }
  clearLegacySeasonFiveMasterCarryover(db);
  return db;
}

export function runMigrations(db: Database.Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, run_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  const existing = db.prepare('SELECT id FROM migrations').all() as Array<{ id: number }>;
  const appliedIds = new Set(existing.map((row) => row.id));
  const pendingMigrations = MIGRATIONS.filter((migration) => !appliedIds.has(migration.id));
  const saveMigration = db.prepare('INSERT INTO migrations (id, name) VALUES (?, ?)');

  if (existing.length > 0 && pendingMigrations.length > 0) {
    const backupPath = createDatabaseBackup('pre-migration');
    if (backupPath) {
      console.log(`Created pre-migration backup: ${backupPath}`);
    }
  }

  for (const migration of pendingMigrations) {
    db.exec(migration.sql);
    saveMigration.run(migration.id, migration.name);
  }

  const teamColumns = db.prepare('PRAGMA table_info(teams)').all() as Array<{ name: string }>;
  const existingColumns = new Set(teamColumns.map((column) => column.name));
  if (!existingColumns.has('team_id')) {
    db.exec('ALTER TABLE teams ADD COLUMN team_id TEXT;');
  }
  if (!existingColumns.has('ball_color')) {
    db.exec('ALTER TABLE teams ADD COLUMN ball_color TEXT;');
  }
  if (!existingColumns.has('ring_color')) {
    db.exec('ALTER TABLE teams ADD COLUMN ring_color TEXT;');
  }
  if (!existingColumns.has('text_color')) {
    db.exec('ALTER TABLE teams ADD COLUMN text_color TEXT;');
  }
  if (!existingColumns.has('preseason_favorite')) {
    db.exec('ALTER TABLE teams ADD COLUMN preseason_favorite INTEGER NOT NULL DEFAULT 0;');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS teams_team_id_unique ON teams(team_id);');
  db.prepare("UPDATE teams SET url = 'https://www.ballycasino.co.uk' WHERE team_id = 'ballycasino'").run();

  const entryColumns = db.prepare('PRAGMA table_info(entries)').all() as Array<{ name: string }>;
  const entrySet = new Set(entryColumns.map((column) => column.name));
  if (!entrySet.has('batch_id')) {
    db.exec('ALTER TABLE entries ADD COLUMN batch_id TEXT;');
  }
}

function assignDivisionsForSeason(db: Database.Database, season: SeasonId): void {
  const count = db.prepare('SELECT COUNT(*) as c FROM season_teams WHERE season = ?').get(season) as { c: number };
  if (count.c > 0) {
    return;
  }

  if (isSeasonFiveOrLater(season)) {
    ensureSeasonFiveExpansionTeams(db);
  }

  const divisionOrder = getDivisionOrderForSeason(season);
  const divisionSlots = getDivisionSlotsForSeason(season);
  const insert = db.prepare('INSERT INTO season_teams (season, team_id, division) VALUES (?, ?, ?)');
  const teams = db.prepare('SELECT id, team_id FROM teams ORDER BY id').all() as Array<{ id: number; team_id: string | null }>;
  const expansionOrderSet = new Set<string>(SEASON_FIVE_EXPANSION_TEAMS.map((team) => team.teamId));
  let shuffled = shuffle(teams);

  if (isSeasonFiveOrLater(season)) {
    const expansionOrder = SEASON_FIVE_EXPANSION_TEAMS.map((team) => team.teamId);
    const expansionByKey = new Map(
      teams
        .filter((team) => team.team_id !== null && expansionOrderSet.has(team.team_id))
        .map((team) => [team.team_id as string, team.id]),
    );
    const expansionIdsOrdered = expansionOrder
      .map((teamId) => expansionByKey.get(teamId))
      .filter((teamId): teamId is number => typeof teamId === 'number');
    const expansionSet = new Set(expansionIdsOrdered);
    const nonExpansion = shuffle(teams.filter((team) => !expansionSet.has(team.id)));
    const tx = db.transaction(() => {
      let cursor = 0;
      divisionOrder.forEach((division) => {
        const size = divisionSlots[division];
        if (division === DIVISION_FOUR) {
          for (let i = 0; i < size; i += 1) {
            const teamId = expansionIdsOrdered[i] ?? nonExpansion[cursor]?.id;
            if (!teamId) {
              continue;
            }
            insert.run(season, teamId, division);
            if (!expansionSet.has(teamId)) {
              cursor += 1;
            }
          }
          return;
        }
        for (let i = 0; i < size; i += 1) {
          const team = nonExpansion[cursor];
          if (!team) {
            continue;
          }
          insert.run(season, team.id, division);
          cursor += 1;
        }
      });
    });
    tx();
    return;
  }

  const nonExpansionTeams = teams.filter((team) => team.team_id === null || !expansionOrderSet.has(team.team_id));
  shuffled = shuffle(nonExpansionTeams);
  const expectedSlots = divisionOrder.reduce((total, division) => total + (divisionSlots[division] ?? 0), 0);
  if (shuffled.length < expectedSlots) {
    // Fallback in case older data is missing team keys; keep season assignment possible.
    shuffled = shuffle(teams);
  }

  let cursor = 0;
  for (const division of divisionOrder) {
    const size = divisionSlots[division];
    for (let i = 0; i < size; i += 1) {
      const team = shuffled[cursor];
      if (!team) {
        continue;
      }
      insert.run(season, team.id, division);
      cursor += 1;
    }
  }
}

function generateRoundRobinRounds(teamIds: number[]): Array<Array<[number, number]>> {
  const list: Array<number | null> = [...teamIds];
  if (list.length % 2 === 1) {
    list.push(null);
  }

  const rounds: Array<Array<[number, number]>> = [];
  const pool = [...list];
  const roundCount = pool.length - 1;

  for (let round = 0; round < roundCount; round += 1) {
    const pairings: Array<[number, number]> = [];
    for (let i = 0; i < pool.length / 2; i += 1) {
      const left = pool[i];
      const right = pool[pool.length - 1 - i];
      if (left !== null && right !== null) {
        pairings.push(round % 2 === 0 ? [left, right] : [right, left]);
      }
    }
    rounds.push(pairings);

    const fixed = pool[0];
    const rotating = pool.slice(1);
    const moved = rotating.pop();
    if (moved !== undefined) {
      rotating.unshift(moved);
    }
    pool.splice(0, pool.length, fixed, ...rotating);
  }

  return rounds;
}

function roundsForDivision(db: Database.Database, season: SeasonId, division: DivisionName): Array<Array<[number, number]>> {
  const teamIds = (
    db.prepare('SELECT team_id FROM season_teams WHERE season = ? AND division = ? ORDER BY team_id').all(season, division) as Array<{ team_id: number }>
  ).map((row) => row.team_id);
  const seeded = [...teamIds];
  const regularSeasonLength = GAMEWEEKS.length - 1;
  const baseRounds = generateRoundRobinRounds(seeded);
  if (seeded.length % 2 === 1) {
    const extended = [...baseRounds];
    while (extended.length < regularSeasonLength) {
      const copy = baseRounds[extended.length % baseRounds.length];
      extended.push(copy);
    }
    return extended.slice(0, regularSeasonLength);
  }
  const doubleRoundRobin = [...baseRounds, ...baseRounds.map((r) => r.map(([h, a]) => [a, h] as [number, number]))];
  if (doubleRoundRobin.length >= regularSeasonLength) {
    return doubleRoundRobin.slice(0, regularSeasonLength);
  }
  const extended = [...doubleRoundRobin];
  while (extended.length < regularSeasonLength) {
    const source = baseRounds[extended.length % baseRounds.length];
    extended.push(source.map(([h, a]) => [a, h] as [number, number]));
  }
  return extended.slice(0, regularSeasonLength);
}

export function loadLeagueFixturesForGw(db: Database.Database, season: SeasonId, gw: string): number {
  const existing = db.prepare('SELECT COUNT(*) as c FROM league_fixtures WHERE season = ? AND gw = ?').get(season, gw) as { c: number };
  if (existing.c > 0) {
    return existing.c;
  }

  if (gw === 'GW8') {
    if (!isGw8Locked(db, season)) {
      return 0;
    }
    return ensureGw8Fixtures(db, season);
  }

  const gwIdx = gwIndex(gw);
  if (gwIdx < 0) {
    return 0;
  }

  const insert = db.prepare(
    'INSERT INTO league_fixtures (season, gw, division, home_team_id, away_team_id) VALUES (?, ?, ?, ?, ?)',
  );

  let created = 0;
  const tx = db.transaction(() => {
    const divisionOrder = getDivisionOrderForSeason(season);
    for (const division of divisionOrder) {
      const rounds = roundsForDivision(db, season, division);
      const round = rounds[gwIdx];
      if (!round) {
        continue;
      }
      for (const [home, away] of round) {
        insert.run(season, gw, division, home, away);
        created += 1;
      }
    }
  });
  tx();
  return created;
}

export function loadLeagueFixturesForSeason(db: Database.Database, season: SeasonId): number {
  let created = 0;
  for (const gw of GAMEWEEKS) {
    created += loadLeagueFixturesForGw(db, season, gw);
  }
  return created;
}

function masterLeagueSeedKey(season: SeasonId): string {
  return `master_league_seed_${season}`;
}

function ensureMasterLeagueSeedOrder(db: Database.Database, season: SeasonId): number[] {
  const existingSeasonTeams = db
    .prepare('SELECT COUNT(*) as c FROM season_teams WHERE season = ?')
    .get(season) as { c: number };
  if (existingSeasonTeams.c === 0) {
    assignDivisionsForSeason(db, season);
  }

  const teamIds = (
    db.prepare('SELECT team_id FROM season_teams WHERE season = ? ORDER BY team_id').all(season) as Array<{ team_id: number }>
  ).map((row) => row.team_id);
  if (teamIds.length < 2) {
    return [];
  }

  const validIds = new Set(teamIds);
  const stored = getSetting(db, masterLeagueSeedKey(season));
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as number[];
      const unique = new Set(parsed);
      const valid =
        Array.isArray(parsed)
        && parsed.length === teamIds.length
        && unique.size === teamIds.length
        && parsed.every((id) => Number.isInteger(id) && validIds.has(id));
      if (valid) {
        return parsed;
      }
    } catch {
      // ignore invalid seed, regenerate below
    }
  }

  const seeded = shuffle(teamIds);
  setSetting(db, masterLeagueSeedKey(season), JSON.stringify(seeded));
  return seeded;
}

function roundsForMasterLeague(db: Database.Database, season: SeasonId): Array<Array<[number, number]>> {
  const seeded = ensureMasterLeagueSeedOrder(db, season);
  if (seeded.length < 2) {
    return [];
  }
  const baseRounds = generateRoundRobinRounds(seeded);
  if (baseRounds.length >= GAMEWEEKS.length) {
    return baseRounds.slice(0, GAMEWEEKS.length);
  }
  const extended = [...baseRounds];
  while (extended.length < GAMEWEEKS.length) {
    const source = baseRounds[extended.length % baseRounds.length];
    extended.push(source.map(([home, away]) => [away, home] as [number, number]));
  }
  return extended.slice(0, GAMEWEEKS.length);
}

function masterCupSeedKey(season: SeasonId): string {
  return `master_cup_seed_${season}`;
}

function parseStoredMasterCupSeedOrder(raw: string | null): number[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as number[];
    const unique = new Set(parsed);
    if (Array.isArray(parsed) && parsed.length === 16 && unique.size === 16 && parsed.every((id) => Number.isInteger(id))) {
      return parsed;
    }
  } catch {
    // ignore invalid stored seed
  }
  return [];
}

function clearMasterCupSeedOrder(db: Database.Database, season: SeasonId): void {
  db.prepare('DELETE FROM settings WHERE key = ?').run(masterCupSeedKey(season));
}

function getConfirmedMasterCupSeedOrder(db: Database.Database, season: SeasonId): number[] {
  if (!isSeasonFiveOrLater(season)) {
    return [];
  }
  const stored = getSetting(db, masterCupSeedKey(season));
  const seasonNumber = parseSeasonNumber(season);
  if (!Number.isFinite(seasonNumber) || seasonNumber <= 1) {
    if (stored) {
      clearMasterCupSeedOrder(db, season);
    }
    return [];
  }

  const previousSeason = `S${seasonNumber - 1}` as SeasonId;
  if (!isGameweekLocked(db, previousSeason, 'GW8')) {
    if (stored) {
      clearMasterCupSeedOrder(db, season);
    }
    return [];
  }

  loadMasterLeagueFixturesForRange(db, previousSeason, 'GW1', 'GW8');
  const previousTable = getMasterLeagueTable(db, previousSeason, 'GW8');
  const seeded = previousTable.slice(0, 16).map((row) => row.teamId);
  if (seeded.length !== 16 || new Set(seeded).size !== 16) {
    if (stored) {
      clearMasterCupSeedOrder(db, season);
    }
    return [];
  }

  const parsedStored = parseStoredMasterCupSeedOrder(stored);
  const matchesStored =
    parsedStored.length === seeded.length
    && parsedStored.every((teamId, index) => teamId === seeded[index]);
  if (!matchesStored) {
    setSetting(db, masterCupSeedKey(season), JSON.stringify(seeded));
  }
  return seeded;
}

function ensureMasterCupSeedOrder(db: Database.Database, season: SeasonId): number[] {
  return getConfirmedMasterCupSeedOrder(db, season);
}

function masterCupSeedMap(db: Database.Database, season: SeasonId): Map<number, number> {
  return new Map(ensureMasterCupSeedOrder(db, season).map((teamId, index) => [teamId, index + 1]));
}

function isMasterCupGameweekClosed(db: Database.Database, season: SeasonId, gw: string): boolean {
  const currentState = getCurrentState(db);
  const seasonNumber = parseSeasonNumber(season);
  const currentSeasonNumber = parseSeasonNumber(currentState.currentSeason);
  if (
    Number.isFinite(seasonNumber)
    && Number.isFinite(currentSeasonNumber)
    && seasonNumber < currentSeasonNumber
  ) {
    return true;
  }
  return isGameweekLocked(db, season, gw);
}

function ensureMasterCupPenaltyTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS master_cup_penalties (
      season TEXT NOT NULL,
      fixture_id INTEGER NOT NULL,
      winner_team_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (season, fixture_id),
      FOREIGN KEY(fixture_id) REFERENCES master_cup_fixtures(id),
      FOREIGN KEY(winner_team_id) REFERENCES teams(id)
    );
    CREATE INDEX IF NOT EXISTS master_cup_penalties_season_idx
      ON master_cup_penalties(season);
  `);
}

function getMasterCupPenaltyWinner(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
): number | null {
  ensureMasterCupPenaltyTable(db);
  const existing = db
    .prepare(
      `
      SELECT winner_team_id
      FROM master_cup_penalties
      WHERE season = ? AND fixture_id = ?
      `,
    )
    .get(season, fixtureId) as { winner_team_id: number } | undefined;
  return existing?.winner_team_id ?? null;
}

type MasterCupFixtureRow = {
  id: number;
  gw: string;
  stage: MasterCupStage;
  tie_slot: number;
  leg_number: number;
  home_team_id: number | null;
  away_team_id: number | null;
  winner_team_id: number | null;
  source_fixture_a: number | null;
  source_fixture_b: number | null;
  source_outcome_a: MasterCupSourceOutcome;
  source_outcome_b: MasterCupSourceOutcome;
  home_seed: number | null;
  away_seed: number | null;
};

function getMasterCupFixtureRows(db: Database.Database, season: SeasonId): MasterCupFixtureRow[] {
  return db
    .prepare(
      `
      SELECT
        id,
        gw,
        stage,
        tie_slot,
        leg_number,
        home_team_id,
        away_team_id,
        winner_team_id,
        source_fixture_a,
        source_fixture_b,
        source_outcome_a,
        source_outcome_b,
        home_seed,
        away_seed
      FROM master_cup_fixtures
      WHERE season = ?
      ORDER BY CASE gw
        WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
        WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
        WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END,
      CASE stage
        WHEN 'round_of_16' THEN 1
        WHEN 'quarter_final' THEN 2
        WHEN 'semi_final' THEN 3
        WHEN 'third_place_playoff' THEN 4
        WHEN 'final' THEN 5
        ELSE 99
      END,
      tie_slot,
      leg_number,
      id
      `,
    )
    .all(season) as MasterCupFixtureRow[];
}

function clearMasterCupBracket(db: Database.Database, season: SeasonId): void {
  ensureMasterCupPenaltyTable(db);
  db.prepare('DELETE FROM master_cup_penalties WHERE season = ?').run(season);
  db.prepare('DELETE FROM master_cup_fixtures WHERE season = ?').run(season);
}

function hasValidMasterCupBracket(
  db: Database.Database,
  season: SeasonId,
  seeded: number[],
): boolean {
  if (seeded.length !== 16 || new Set(seeded).size !== 16) {
    return false;
  }

  const fixtures = getMasterCupFixtureRows(db, season);
  if (fixtures.length !== 18) {
    return false;
  }

  const stageRows = <T extends MasterCupStage>(stage: T) => fixtures.filter((fixture) => fixture.stage === stage);
  const roundOf16 = stageRows('round_of_16');
  const quarterFinals = stageRows('quarter_final');
  const semiFinals = stageRows('semi_final');
  const thirdPlacePlayoff = stageRows('third_place_playoff');
  const finals = stageRows('final');

  if (
    roundOf16.length !== 8
    || quarterFinals.length !== 4
    || semiFinals.length !== 4
    || thirdPlacePlayoff.length !== 1
    || finals.length !== 1
  ) {
    return false;
  }

  const roundOf16BySlot = new Map<number, MasterCupFixtureRow>();
  for (let index = 0; index < MASTER_CUP_ROUND_OF_16_SOURCE_SLOTS.length; index += 1) {
    const [homeSeed, awaySeed] = MASTER_CUP_ROUND_OF_16_SOURCE_SLOTS[index];
    const tieSlot = index + 1;
    const fixture = roundOf16.find((row) => row.tie_slot === tieSlot && row.leg_number === 1);
    if (!fixture) {
      return false;
    }
    const homeTeamId = seeded[homeSeed - 1] ?? null;
    const awayTeamId = seeded[awaySeed - 1] ?? null;
    if (
      fixture.gw !== 'GW1'
      || fixture.source_fixture_a !== null
      || fixture.source_fixture_b !== null
      || fixture.source_outcome_a !== 'winner'
      || fixture.source_outcome_b !== 'winner'
      || fixture.home_team_id !== homeTeamId
      || fixture.away_team_id !== awayTeamId
      || fixture.home_seed !== homeSeed
      || fixture.away_seed !== awaySeed
    ) {
      return false;
    }
    roundOf16BySlot.set(tieSlot, fixture);
  }

  const quarterFinalBySlot = new Map<number, MasterCupFixtureRow>();
  for (let index = 0; index < MASTER_CUP_QUARTER_FINAL_SOURCE_SLOTS.length; index += 1) {
    const [firstSlot, secondSlot] = MASTER_CUP_QUARTER_FINAL_SOURCE_SLOTS[index];
    const tieSlot = index + 1;
    const fixture = quarterFinals.find((row) => row.tie_slot === tieSlot && row.leg_number === 1);
    if (!fixture) {
      return false;
    }
    if (
      fixture.gw !== 'GW2'
      || fixture.source_fixture_a !== (roundOf16BySlot.get(firstSlot)?.id ?? null)
      || fixture.source_fixture_b !== (roundOf16BySlot.get(secondSlot)?.id ?? null)
      || fixture.source_outcome_a !== 'winner'
      || fixture.source_outcome_b !== 'winner'
    ) {
      return false;
    }
    quarterFinalBySlot.set(tieSlot, fixture);
  }

  const semiFinalSecondLegBySlot = new Map<number, MasterCupFixtureRow>();
  const semiFinalSourceSlots: Array<[number, number]> = [
    [1, 2],
    [3, 4],
  ];
  for (let index = 0; index < semiFinalSourceSlots.length; index += 1) {
    const [firstQuarterSlot, secondQuarterSlot] = semiFinalSourceSlots[index];
    const tieSlot = index + 1;
    const firstLeg = semiFinals.find((row) => row.tie_slot === tieSlot && row.leg_number === 1);
    const secondLeg = semiFinals.find((row) => row.tie_slot === tieSlot && row.leg_number === 2);
    if (!firstLeg || !secondLeg) {
      return false;
    }
    const expectedSourceA = quarterFinalBySlot.get(firstQuarterSlot)?.id ?? null;
    const expectedSourceB = quarterFinalBySlot.get(secondQuarterSlot)?.id ?? null;
    if (
      firstLeg.gw !== 'GW3'
      || secondLeg.gw !== 'GW4'
      || firstLeg.source_fixture_a !== expectedSourceA
      || firstLeg.source_fixture_b !== expectedSourceB
      || secondLeg.source_fixture_a !== expectedSourceA
      || secondLeg.source_fixture_b !== expectedSourceB
      || firstLeg.source_outcome_a !== 'winner'
      || firstLeg.source_outcome_b !== 'winner'
      || secondLeg.source_outcome_a !== 'winner'
      || secondLeg.source_outcome_b !== 'winner'
    ) {
      return false;
    }
    semiFinalSecondLegBySlot.set(tieSlot, secondLeg);
  }

  const thirdPlace = thirdPlacePlayoff[0];
  const final = finals[0];
  const semiOneSecondLegId = semiFinalSecondLegBySlot.get(1)?.id ?? null;
  const semiTwoSecondLegId = semiFinalSecondLegBySlot.get(2)?.id ?? null;
  if (!thirdPlace || !final) {
    return false;
  }

  return (
    thirdPlace.gw === 'GW5'
    && thirdPlace.tie_slot === 1
    && thirdPlace.leg_number === 1
    && thirdPlace.source_fixture_a === semiOneSecondLegId
    && thirdPlace.source_fixture_b === semiTwoSecondLegId
    && thirdPlace.source_outcome_a === 'loser'
    && thirdPlace.source_outcome_b === 'loser'
    && final.gw === 'GW6'
    && final.tie_slot === 1
    && final.leg_number === 1
    && final.source_fixture_a === semiOneSecondLegId
    && final.source_fixture_b === semiTwoSecondLegId
    && final.source_outcome_a === 'winner'
    && final.source_outcome_b === 'winner'
  );
}

function ensureMasterCupBracket(db: Database.Database, season: SeasonId): number {
  if (!isSeasonFiveOrLater(season)) {
    return 0;
  }

  const seeded = ensureMasterCupSeedOrder(db, season);
  const existing = db.prepare('SELECT COUNT(*) as c FROM master_cup_fixtures WHERE season = ?').get(season) as { c: number };
  if (seeded.length !== 16) {
    if (existing.c > 0) {
      clearMasterCupBracket(db, season);
    }
    return 0;
  }

  if (existing.c > 0) {
    if (hasValidMasterCupBracket(db, season, seeded)) {
      return 0;
    }
    clearMasterCupBracket(db, season);
  }

  if (seeded.length !== 16) {
    return 0;
  }

  const seedNumber = (teamId: number): number => seeded.indexOf(teamId) + 1;
  const insert = db.prepare(
    `
    INSERT INTO master_cup_fixtures (
      season,
      gw,
      stage,
      tie_slot,
      leg_number,
      home_team_id,
      away_team_id,
      source_fixture_a,
      source_fixture_b,
      source_outcome_a,
      source_outcome_b,
      home_seed,
      away_seed
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );

  let created = 0;
  const tx = db.transaction(() => {
    const roundOf16Ids: number[] = [];
    MASTER_CUP_ROUND_OF_16_SOURCE_SLOTS.forEach(([homeSeed, awaySeed], index) => {
      const homeTeamId = seeded[homeSeed - 1] ?? null;
      const awayTeamId = seeded[awaySeed - 1] ?? null;
      const result = insert.run(
        season,
        'GW1',
        'round_of_16',
        index + 1,
        1,
        homeTeamId,
        awayTeamId,
        null,
        null,
        'winner',
        'winner',
        homeSeed,
        awaySeed,
      );
      roundOf16Ids.push(Number(result.lastInsertRowid));
      created += 1;
    });

    const quarterFinalIds: number[] = [];
    MASTER_CUP_QUARTER_FINAL_SOURCE_SLOTS.forEach(([firstSlot, secondSlot], index) => {
      const result = insert.run(
        season,
        'GW2',
        'quarter_final',
        index + 1,
        1,
        null,
        null,
        roundOf16Ids[firstSlot - 1] ?? null,
        roundOf16Ids[secondSlot - 1] ?? null,
        'winner',
        'winner',
        null,
        null,
      );
      quarterFinalIds.push(Number(result.lastInsertRowid));
      created += 1;
    });

    const semiSecondLegIds: number[] = [];
    [
      [quarterFinalIds[0], quarterFinalIds[1]],
      [quarterFinalIds[2], quarterFinalIds[3]],
    ].forEach(([firstQuarterId, secondQuarterId], index) => {
      insert.run(
        season,
        'GW3',
        'semi_final',
        index + 1,
        1,
        null,
        null,
        firstQuarterId ?? null,
        secondQuarterId ?? null,
        'winner',
        'winner',
        null,
        null,
      );
      created += 1;

      const secondLeg = insert.run(
        season,
        'GW4',
        'semi_final',
        index + 1,
        2,
        null,
        null,
        firstQuarterId ?? null,
        secondQuarterId ?? null,
        'winner',
        'winner',
        null,
        null,
      );
      semiSecondLegIds.push(Number(secondLeg.lastInsertRowid));
      created += 1;
    });

    insert.run(
      season,
      'GW5',
      'third_place_playoff',
      1,
      1,
      null,
      null,
      semiSecondLegIds[0] ?? null,
      semiSecondLegIds[1] ?? null,
      'loser',
      'loser',
      null,
      null,
    );
    created += 1;

    insert.run(
      season,
      'GW6',
      'final',
      1,
      1,
      null,
      null,
      semiSecondLegIds[0] ?? null,
      semiSecondLegIds[1] ?? null,
      'winner',
      'winner',
      null,
      null,
    );
    created += 1;
  });
  tx();

  return created;
}

function getMasterCupTeamGwMetrics(
  db: Database.Database,
  season: SeasonId,
  gw: string,
  teamId: number | null,
): { profit: number; spins: number; entryCount: number } {
  if (!teamId) {
    return { profit: 0, spins: 0, entryCount: 0 };
  }
  const perf = getTeamGwPerformance(db, season, gw, teamId);
  const count = db
    .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
    .get(season, gw, teamId) as { c: number };
  return {
    profit: Number(perf.profit.toFixed(2)),
    spins: perf.spins ?? 0,
    entryCount: count.c,
  };
}

function resolveMasterCupSingleFixtureWinner(
  db: Database.Database,
  season: SeasonId,
  fixture: Pick<MasterCupFixtureRow, 'id' | 'gw' | 'home_team_id' | 'away_team_id'>,
): number | null {
  if (!fixture.home_team_id || !fixture.away_team_id) {
    return null;
  }
  if (!isMasterCupGameweekClosed(db, season, fixture.gw)) {
    return null;
  }

  const homeMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.home_team_id);
  const awayMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.away_team_id);
  if (homeMetrics.profit > awayMetrics.profit) {
    return fixture.home_team_id;
  }
  if (awayMetrics.profit > homeMetrics.profit) {
    return fixture.away_team_id;
  }
  return getMasterCupPenaltyWinner(db, season, fixture.id);
}

function getMasterCupSemiFinalAggregateState(
  db: Database.Database,
  season: SeasonId,
  tieSlot: number,
): {
  firstLeg: { id: number; gw: string; home_team_id: number; away_team_id: number };
  secondLeg: { id: number; gw: string; home_team_id: number; away_team_id: number };
  teamAId: number;
  teamBId: number;
  aggregateAProfit: number;
  aggregateBProfit: number;
  aggregateASpins: number;
  aggregateBSpins: number;
  firstLegHomeEntries: number;
  firstLegAwayEntries: number;
  secondLegHomeEntries: number;
  secondLegAwayEntries: number;
} | null {
  const legs = db
    .prepare(
      `
      SELECT id, gw, home_team_id, away_team_id, home_seed, away_seed
      FROM master_cup_fixtures
      WHERE season = ? AND stage = 'semi_final' AND tie_slot = ?
      ORDER BY leg_number, id
      `,
    )
    .all(season, tieSlot) as Array<{
    id: number;
    gw: string;
    home_team_id: number | null;
    away_team_id: number | null;
  }>;
  if (legs.length !== 2 || !legs[0]?.home_team_id || !legs[0]?.away_team_id) {
    return null;
  }

  const [firstLeg, secondLeg] = legs;
  if (!secondLeg?.home_team_id || !secondLeg.away_team_id) {
    return null;
  }

  const teamAId = firstLeg.home_team_id as number;
  const teamBId = firstLeg.away_team_id as number;
  const firstLegHome = getMasterCupTeamGwMetrics(db, season, firstLeg.gw, firstLeg.home_team_id);
  const firstLegAway = getMasterCupTeamGwMetrics(db, season, firstLeg.gw, firstLeg.away_team_id);
  const secondLegHome = getMasterCupTeamGwMetrics(db, season, secondLeg.gw, secondLeg.home_team_id);
  const secondLegAway = getMasterCupTeamGwMetrics(db, season, secondLeg.gw, secondLeg.away_team_id);

  const aggregateAProfit = Number((
    (firstLeg.home_team_id === teamAId ? firstLegHome.profit : firstLegAway.profit)
    + (secondLeg.home_team_id === teamAId ? secondLegHome.profit : secondLegAway.profit)
  ).toFixed(2));
  const aggregateBProfit = Number((
    (firstLeg.home_team_id === teamBId ? firstLegHome.profit : firstLegAway.profit)
    + (secondLeg.home_team_id === teamBId ? secondLegHome.profit : secondLegAway.profit)
  ).toFixed(2));
  const aggregateASpins =
    (firstLeg.home_team_id === teamAId ? firstLegHome.spins : firstLegAway.spins)
    + (secondLeg.home_team_id === teamAId ? secondLegHome.spins : secondLegAway.spins);
  const aggregateBSpins =
    (firstLeg.home_team_id === teamBId ? firstLegHome.spins : firstLegAway.spins)
    + (secondLeg.home_team_id === teamBId ? secondLegHome.spins : secondLegAway.spins);

  return {
    firstLeg: {
      id: firstLeg.id,
      gw: firstLeg.gw,
      home_team_id: firstLeg.home_team_id as number,
      away_team_id: firstLeg.away_team_id as number,
    },
    secondLeg: {
      id: secondLeg.id,
      gw: secondLeg.gw,
      home_team_id: secondLeg.home_team_id as number,
      away_team_id: secondLeg.away_team_id as number,
    },
    teamAId,
    teamBId,
    aggregateAProfit,
    aggregateBProfit,
    aggregateASpins,
    aggregateBSpins,
    firstLegHomeEntries: firstLegHome.entryCount,
    firstLegAwayEntries: firstLegAway.entryCount,
    secondLegHomeEntries: secondLegHome.entryCount,
    secondLegAwayEntries: secondLegAway.entryCount,
  };
}

function resolveMasterCupSemiFinalWinner(db: Database.Database, season: SeasonId, tieSlot: number): number | null {
  const aggregateState = getMasterCupSemiFinalAggregateState(db, season, tieSlot);
  if (!aggregateState) {
    return null;
  }
  const { firstLeg, secondLeg, teamAId, teamBId, aggregateAProfit, aggregateBProfit } = aggregateState;
  if (!isMasterCupGameweekClosed(db, season, firstLeg.gw) || !isMasterCupGameweekClosed(db, season, secondLeg.gw)) {
    return null;
  }

  if (aggregateAProfit > aggregateBProfit) {
    return teamAId;
  }
  if (aggregateBProfit > aggregateAProfit) {
    return teamBId;
  }
  return getMasterCupPenaltyWinner(db, season, secondLeg.id);
}

function clearMasterCupProgressFromGameweek(
  db: Database.Database,
  season: SeasonId,
  fromGw: string,
): void {
  ensureMasterCupPenaltyTable(db);
  const minGwIndex = gwIndex(fromGw);
  if (minGwIndex < 0) {
    return;
  }

  const fixtureIds = db
    .prepare(
      `
      SELECT id
      FROM master_cup_fixtures
      WHERE season = ?
        AND CASE gw
          WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
          WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
          WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END >= ?
      `,
    )
    .all(season, minGwIndex + 1) as Array<{ id: number }>;

  if (fixtureIds.length === 0) {
    return;
  }

  const deletePenalty = db.prepare('DELETE FROM master_cup_penalties WHERE season = ? AND fixture_id = ?');
  const clearWinner = db.prepare('UPDATE master_cup_fixtures SET winner_team_id = NULL WHERE id = ?');

  const tx = db.transaction(() => {
    fixtureIds.forEach(({ id }) => {
      deletePenalty.run(season, id);
      clearWinner.run(id);
    });
  });
  tx();
}

function resolveMasterCupFixtureWinner(db: Database.Database, season: SeasonId, fixtureId: number): number | null {
  const fixture = db
    .prepare(
      `
      SELECT id, gw, stage, tie_slot, leg_number, home_team_id, away_team_id, home_seed, away_seed
      FROM master_cup_fixtures
      WHERE id = ? AND season = ?
      `,
    )
    .get(fixtureId, season) as {
    id: number;
    gw: string;
    stage: MasterCupStage;
    tie_slot: number;
    leg_number: number;
    home_team_id: number | null;
    away_team_id: number | null;
    home_seed: number | null;
    away_seed: number | null;
  } | undefined;
  if (!fixture) {
    return null;
  }
  if (fixture.stage === 'semi_final') {
    if (fixture.leg_number !== 2) {
      return null;
    }
    return resolveMasterCupSemiFinalWinner(db, season, fixture.tie_slot);
  }
  return resolveMasterCupSingleFixtureWinner(db, season, fixture);
}

function resolveMasterCupSourceTeam(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
  outcome: MasterCupSourceOutcome,
): number | null {
  const fixture = db
    .prepare(
      `
      SELECT id, stage, tie_slot, leg_number, home_team_id, away_team_id
      FROM master_cup_fixtures
      WHERE id = ? AND season = ?
      `,
    )
    .get(fixtureId, season) as {
    id: number;
    stage: MasterCupStage;
    tie_slot: number;
    leg_number: number;
    home_team_id: number | null;
    away_team_id: number | null;
  } | undefined;
  if (!fixture) {
    return null;
  }
  const winnerTeamId = resolveMasterCupFixtureWinner(db, season, fixtureId);
  if (outcome === 'winner') {
    return winnerTeamId;
  }
  if (!winnerTeamId || !fixture.home_team_id || !fixture.away_team_id) {
    return null;
  }
  return winnerTeamId === fixture.home_team_id ? fixture.away_team_id : fixture.home_team_id;
}

function orderMasterCupTeams(
  db: Database.Database,
  season: SeasonId,
  stage: MasterCupStage,
  legNumber: number,
  firstTeamId: number | null,
  secondTeamId: number | null,
): { homeTeamId: number | null; awayTeamId: number | null; homeSeed: number | null; awaySeed: number | null } {
  // Keep downstream slots fully blank until both upstream ties are completely resolved.
  if (!firstTeamId || !secondTeamId) {
    return {
      homeTeamId: null,
      awayTeamId: null,
      homeSeed: null,
      awaySeed: null,
    };
  }

  const seedMap = masterCupSeedMap(db, season);
  const firstSeed = seedMap.get(firstTeamId) ?? 99;
  const secondSeed = seedMap.get(secondTeamId) ?? 99;

  if (stage === 'semi_final') {
    if (legNumber === 1) {
      return {
        homeTeamId: firstTeamId,
        awayTeamId: secondTeamId,
        homeSeed: firstSeed,
        awaySeed: secondSeed,
      };
    }
    return {
      homeTeamId: secondTeamId,
      awayTeamId: firstTeamId,
      homeSeed: secondSeed,
      awaySeed: firstSeed,
    };
  }

  return {
    homeTeamId: firstTeamId,
    awayTeamId: secondTeamId,
    homeSeed: firstSeed,
    awaySeed: secondSeed,
  };
}

function ensureMasterCupProgress(db: Database.Database, season: SeasonId, _uptoGw = 'GW6'): number {
  if (!isSeasonFiveOrLater(season)) {
    return 0;
  }

  const created = ensureMasterCupBracket(db, season);
  const updateParticipants = db.prepare(
    `
    UPDATE master_cup_fixtures
    SET home_team_id = ?, away_team_id = ?, home_seed = ?, away_seed = ?
    WHERE id = ?
    `,
  );
  const updateWinner = db.prepare(
    `
    UPDATE master_cup_fixtures
    SET winner_team_id = ?
    WHERE id = ?
    `,
  );

  const tx = db.transaction(() => {
    const fixtures = getMasterCupFixtureRows(db, season);
    fixtures.forEach((fixture) => {
      if (fixture.source_fixture_a || fixture.source_fixture_b) {
        const firstTeamId = fixture.source_fixture_a
          ? resolveMasterCupSourceTeam(db, season, fixture.source_fixture_a, fixture.source_outcome_a)
          : null;
        const secondTeamId = fixture.source_fixture_b
          ? resolveMasterCupSourceTeam(db, season, fixture.source_fixture_b, fixture.source_outcome_b)
          : null;
        const ordered = orderMasterCupTeams(
          db,
          season,
          fixture.stage,
          fixture.leg_number,
          firstTeamId,
          secondTeamId,
        );
        updateParticipants.run(
          ordered.homeTeamId,
          ordered.awayTeamId,
          ordered.homeSeed,
          ordered.awaySeed,
          fixture.id,
        );
      }

      const winnerTeamId = resolveMasterCupFixtureWinner(db, season, fixture.id);
      updateWinner.run(winnerTeamId, fixture.id);
    });
  });
  tx();

  return created;
}

export function loadMasterCupFixturesForRange(
  db: Database.Database,
  season: SeasonId,
  fromGw: string,
  toGw: string,
): number {
  if (!isSeasonFiveOrLater(season)) {
    return 0;
  }
  const fromIdx = gwIndex(fromGw);
  const toIdx = gwIndex(toGw);
  if (fromIdx < 0 || toIdx < 0) {
    return 0;
  }
  const lower = Math.min(fromIdx, toIdx);
  const upper = Math.max(fromIdx, toIdx);
  const countInRange = db.prepare(
    `
    SELECT COUNT(*) as c
    FROM master_cup_fixtures
    WHERE season = ?
      AND CASE gw
        WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
        WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
        WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END
        BETWEEN ? AND ?
    `,
  );
  const before = countInRange.get(season, lower + 1, upper + 1) as { c: number };
  ensureMasterCupProgress(db, season, GAMEWEEKS[upper] ?? 'GW6');
  const after = countInRange.get(season, lower + 1, upper + 1) as { c: number };
  return Math.max(0, after.c - before.c);
}

function trioLeagueSeedKey(season: SeasonId): string {
  return `trio_league_seed_${season}`;
}

type TrioFixtureStage = 'regular' | 'playoff_semi' | 'playoff_final';
type MasterCupStage = 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place_playoff' | 'final';
type MasterCupSourceOutcome = 'winner' | 'loser';

const MASTER_CUP_ROUND_OF_16_SOURCE_SLOTS = [
  [1, 16],
  [2, 15],
  [3, 14],
  [4, 13],
  [5, 12],
  [6, 11],
  [7, 10],
  [8, 9],
] as const;
const MASTER_CUP_QUARTER_FINAL_SOURCE_SLOTS = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
] as const;

function masterCupRoundLabel(stage: MasterCupStage, legNumber: number): string {
  if (stage === 'round_of_16') {
    return 'Round of 16';
  }
  if (stage === 'quarter_final') {
    return 'Quarter-final';
  }
  if (stage === 'semi_final') {
    return legNumber === 1 ? 'Semi-final First Leg' : 'Semi-final Second Leg';
  }
  if (stage === 'third_place_playoff') {
    return 'Third-place Playoff';
  }
  return 'Final';
}

type TrioFixtureTemplate = {
  division: TrioDivisionName;
  stage: TrioFixtureStage;
  groupSlot: number;
  homeTeamId: number;
  awayTeamId: number;
};

function defaultTrioLeagueSeedOrder(db: Database.Database, season: SeasonId, teamIds: number[]): number[] {
  const divisionOrder = getDivisionOrderForSeason(season);
  const trioSourceGroups = [
    divisionOrder.slice(0, 2),
    divisionOrder.slice(2, 4),
    divisionOrder.slice(4, 6),
  ];
  if (
    teamIds.length !== TRIO_DIVISION_ORDER.length * TRIO_DIVISION_SIZE
    || trioSourceGroups.some((group) => group.length !== 2)
  ) {
    return shuffle(teamIds);
  }

  const seasonTeams = db
    .prepare('SELECT team_id, division FROM season_teams WHERE season = ? ORDER BY team_id')
    .all(season) as Array<{ team_id: number; division: DivisionName }>;
  const byDivision = new Map<DivisionName, number[]>();
  seasonTeams.forEach((row) => {
    const rows = byDivision.get(row.division) ?? [];
    rows.push(row.team_id);
    byDivision.set(row.division, rows);
  });

  const seeded = trioSourceGroups.flatMap((group) => group.flatMap((division) => byDivision.get(division as DivisionName) ?? []));
  return seeded.length === teamIds.length ? seeded : shuffle(teamIds);
}

function ensureTrioLeagueSeedOrder(db: Database.Database, season: SeasonId): number[] {
  if (!isSeasonFiveOrLater(season)) {
    return [];
  }

  const existingSeasonTeams = db
    .prepare('SELECT COUNT(*) as c FROM season_teams WHERE season = ?')
    .get(season) as { c: number };
  if (existingSeasonTeams.c === 0) {
    assignDivisionsForSeason(db, season);
  }

  const teamIds = (
    db.prepare('SELECT team_id FROM season_teams WHERE season = ? ORDER BY team_id').all(season) as Array<{ team_id: number }>
  ).map((row) => row.team_id);
  const expectedTeamCount = TRIO_DIVISION_ORDER.length * TRIO_DIVISION_SIZE;
  if (teamIds.length !== expectedTeamCount) {
    return [];
  }

  const validIds = new Set(teamIds);
  const stored = getSetting(db, trioLeagueSeedKey(season));
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as number[];
      const unique = new Set(parsed);
      const valid =
        Array.isArray(parsed)
        && parsed.length === teamIds.length
        && unique.size === teamIds.length
        && parsed.every((id) => Number.isInteger(id) && validIds.has(id));
      if (valid) {
        return parsed;
      }
    } catch {
      // ignore invalid seed, regenerate below
    }
  }

  const seeded = defaultTrioLeagueSeedOrder(db, season, teamIds);
  setSetting(db, trioLeagueSeedKey(season), JSON.stringify(seeded));
  return seeded;
}

function trioSeedBuckets(db: Database.Database, season: SeasonId): Array<{ division: TrioDivisionName; teamIds: number[] }> {
  const seeded = ensureTrioLeagueSeedOrder(db, season);
  if (seeded.length !== TRIO_DIVISION_ORDER.length * TRIO_DIVISION_SIZE) {
    return [];
  }
  return TRIO_DIVISION_ORDER.map((division, index) => ({
    division,
    teamIds: seeded.slice(index * TRIO_DIVISION_SIZE, (index + 1) * TRIO_DIVISION_SIZE),
  }));
}

function roundsForTrioLeague(db: Database.Database, season: SeasonId): Array<TrioFixtureTemplate[]> {
  const buckets = trioSeedBuckets(db, season);
  if (buckets.length !== TRIO_DIVISION_ORDER.length) {
    return [];
  }

  const rounds = Array.from({ length: TRIO_REGULAR_SEASON_GAMEWEEKS }, () => [] as TrioFixtureTemplate[]);
  buckets.forEach(({ division, teamIds }) => {
    const divisionRounds = generateRoundRobinRounds(teamIds).slice(0, TRIO_REGULAR_SEASON_GAMEWEEKS);
    divisionRounds.forEach((round, gwIdx) => {
      round.forEach(([homeTeamId, awayTeamId], index) => {
        rounds[gwIdx]?.push({
          division,
          stage: 'regular',
          groupSlot: index + 1,
          homeTeamId,
          awayTeamId,
        });
      });
    });
  });
  return rounds;
}

function trioFixtureStageOrder(stage: TrioFixtureStage): number {
  if (stage === 'regular') {
    return 0;
  }
  if (stage === 'playoff_semi') {
    return 1;
  }
  return 2;
}

function ensureTrioLeaguePlayoffFixtures(
  db: Database.Database,
  season: SeasonId,
  gw: 'GW7' | 'GW8',
): number {
  if (!isSeasonFiveOrLater(season)) {
    return 0;
  }

  const insert = db.prepare(
    `
    INSERT INTO trio_league_fixtures (season, gw, division, stage, group_slot, home_team_id, away_team_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  );
  const updateFixture = db.prepare(
    `
    UPDATE trio_league_fixtures
    SET home_team_id = ?, away_team_id = ?
    WHERE id = ?
    `,
  );
  const deleteFixture = db.prepare('DELETE FROM trio_league_fixtures WHERE id = ?');
  const deletePenalty = db.prepare('DELETE FROM trio_playoff_penalties WHERE season = ? AND fixture_id = ?');

  if (gw === 'GW7') {
    const tables = getTrioLeagueTableGroups(db, season, 'GW6');
    let created = 0;
    const tx = db.transaction(() => {
      TRIO_DIVISION_ORDER.slice(1).forEach((division) => {
        const rows = tables.find((table) => table.division === division)?.rows ?? [];
        const expectedSemis = [
          { groupSlot: 1, homeTeamId: rows[1]?.teamId, awayTeamId: rows[4]?.teamId },
          { groupSlot: 2, homeTeamId: rows[2]?.teamId, awayTeamId: rows[3]?.teamId },
        ].filter((fixture): fixture is { groupSlot: number; homeTeamId: number; awayTeamId: number } => (
          Number.isFinite(fixture.homeTeamId) && Number.isFinite(fixture.awayTeamId)
        ));
        const existingSemis = db
          .prepare(
            `
            SELECT id, group_slot, home_team_id, away_team_id
            FROM trio_league_fixtures
            WHERE season = ? AND gw = 'GW7' AND division = ? AND stage = 'playoff_semi'
            ORDER BY group_slot, id
            `,
          )
          .all(season, division) as Array<{
          id: number;
          group_slot: number;
          home_team_id: number;
          away_team_id: number;
        }>;

        expectedSemis.forEach((fixture) => {
          const matchingSemis = existingSemis.filter((row) => row.group_slot === fixture.groupSlot);
          const primary = matchingSemis[0];
          if (!primary) {
            insert.run(season, 'GW7', division, 'playoff_semi', fixture.groupSlot, fixture.homeTeamId, fixture.awayTeamId);
            created += 1;
            return;
          }
          if (primary.home_team_id !== fixture.homeTeamId || primary.away_team_id !== fixture.awayTeamId) {
            updateFixture.run(fixture.homeTeamId, fixture.awayTeamId, primary.id);
            deletePenalty.run(season, primary.id);
          }
          matchingSemis.slice(1).forEach((row) => {
            deletePenalty.run(season, row.id);
            deleteFixture.run(row.id);
          });
        });

        existingSemis
          .filter((row) => !expectedSemis.some((fixture) => fixture.groupSlot === row.group_slot))
          .forEach((row) => {
            deletePenalty.run(season, row.id);
            deleteFixture.run(row.id);
          });
      });
    });
    tx();
    return created;
  }

  ensureTrioLeaguePlayoffFixtures(db, season, 'GW7');
  const semifinalFixtures = db
    .prepare(
      `
      SELECT id, division, group_slot, home_team_id, away_team_id
      FROM trio_league_fixtures
      WHERE season = ? AND gw = 'GW7' AND stage = 'playoff_semi'
      ORDER BY division, group_slot, id
      `,
    )
    .all(season) as Array<{
    id: number;
    division: TrioDivisionName;
    group_slot: number;
    home_team_id: number;
    away_team_id: number;
  }>;

  const semisByDivision = new Map<TrioDivisionName, Array<typeof semifinalFixtures[number]>>();
  semifinalFixtures.forEach((fixture) => {
    const rows = semisByDivision.get(fixture.division) ?? [];
    rows.push(fixture);
    semisByDivision.set(fixture.division, rows);
  });

  let created = 0;
  const tx = db.transaction(() => {
    TRIO_DIVISION_ORDER.slice(1).forEach((division) => {
      const semis = (semisByDivision.get(division) ?? []).slice().sort((a, b) => a.group_slot - b.group_slot || a.id - b.id);
      const firstWinner = semis[0] ? resolveTrioPlayoffWinner(db, season, semis[0].id) : null;
      const secondWinner = semis[1] ? resolveTrioPlayoffWinner(db, season, semis[1].id) : null;
      const ranks = trioRegularSeasonRankMap(db, season);
      const existingFinals = db
        .prepare(
          `
          SELECT id, group_slot, home_team_id, away_team_id
          FROM trio_league_fixtures
          WHERE season = ? AND gw = 'GW8' AND division = ? AND stage = 'playoff_final'
          ORDER BY group_slot, id
          `,
        )
        .all(season, division) as Array<{
        id: number;
        group_slot: number;
        home_team_id: number;
        away_team_id: number;
      }>;
      const primaryFinal = existingFinals.find((fixture) => fixture.group_slot === 1) ?? null;
      existingFinals
        .filter((fixture) => fixture.group_slot !== 1 || (primaryFinal !== null && fixture.id !== primaryFinal.id))
        .forEach((fixture) => {
          deletePenalty.run(season, fixture.id);
          deleteFixture.run(fixture.id);
        });

      if (!firstWinner || !secondWinner) {
        if (primaryFinal) {
          deletePenalty.run(season, primaryFinal.id);
          deleteFixture.run(primaryFinal.id);
        }
        return;
      }

      const firstRank = ranks.get(firstWinner) ?? 99;
      const secondRank = ranks.get(secondWinner) ?? 99;
      const [homeTeamId, awayTeamId] = firstRank <= secondRank
        ? [firstWinner, secondWinner]
        : [secondWinner, firstWinner];

      if (!primaryFinal) {
        insert.run(season, 'GW8', division, 'playoff_final', 1, homeTeamId, awayTeamId);
        created += 1;
        return;
      }

      if (primaryFinal.home_team_id !== homeTeamId || primaryFinal.away_team_id !== awayTeamId) {
        updateFixture.run(homeTeamId, awayTeamId, primaryFinal.id);
        deletePenalty.run(season, primaryFinal.id);
      }
    });
  });
  tx();

  return created;
}

export function loadMasterLeagueFixturesForRange(
  db: Database.Database,
  season: SeasonId,
  fromGw: string,
  toGw: string,
): number {
  const fromIdx = gwIndex(fromGw);
  const toIdx = gwIndex(toGw);
  if (fromIdx < 0 || toIdx < 0) {
    return 0;
  }

  const lower = Math.min(fromIdx, toIdx);
  const upper = Math.max(fromIdx, toIdx);
  const rounds = roundsForMasterLeague(db, season);
  if (rounds.length === 0) {
    return 0;
  }

  const countForGw = db.prepare('SELECT COUNT(*) as c FROM master_league_fixtures WHERE season = ? AND gw = ?');
  const insert = db.prepare(
    'INSERT INTO master_league_fixtures (season, gw, home_team_id, away_team_id) VALUES (?, ?, ?, ?)',
  );

  let created = 0;
  const tx = db.transaction(() => {
    for (let gwIdx = lower; gwIdx <= upper; gwIdx += 1) {
      const gw = GAMEWEEKS[gwIdx];
      if (!gw) {
        continue;
      }
      const existing = countForGw.get(season, gw) as { c: number };
      if (existing.c > 0) {
        continue;
      }
      const round = rounds[gwIdx];
      if (!round) {
        continue;
      }
      for (const [homeTeamId, awayTeamId] of round) {
        insert.run(season, gw, homeTeamId, awayTeamId);
        created += 1;
      }
    }
  });
  tx();

  return created;
}

export function loadTrioLeagueFixturesForRange(
  db: Database.Database,
  season: SeasonId,
  fromGw: string,
  toGw: string,
): number {
  if (!isSeasonFiveOrLater(season)) {
    return 0;
  }

  const fromIdx = gwIndex(fromGw);
  const toIdx = gwIndex(toGw);
  if (fromIdx < 0 || toIdx < 0) {
    return 0;
  }

  const lower = Math.min(fromIdx, toIdx);
  const upper = Math.max(fromIdx, toIdx);
  const rounds = roundsForTrioLeague(db, season);
  if (rounds.length === 0) {
    return 0;
  }

  const countForGw = db.prepare('SELECT COUNT(*) as c FROM trio_league_fixtures WHERE season = ? AND gw = ?');
  const insert = db.prepare(
    `
    INSERT INTO trio_league_fixtures (season, gw, division, stage, group_slot, home_team_id, away_team_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  );

  let created = 0;
  const tx = db.transaction(() => {
    for (let gwIdx = lower; gwIdx <= upper; gwIdx += 1) {
      const gw = GAMEWEEKS[gwIdx];
      if (!gw) {
        continue;
      }
      if (gw === 'GW7' || gw === 'GW8') {
        created += ensureTrioLeaguePlayoffFixtures(db, season, gw);
        continue;
      }
      const existing = countForGw.get(season, gw) as { c: number };
      if (existing.c > 0) {
        continue;
      }
      if (gwIdx >= TRIO_REGULAR_SEASON_GAMEWEEKS) {
        continue;
      }
      const round = rounds[gwIdx];
      if (!round) {
        continue;
      }
      round.forEach((fixture) => {
        insert.run(season, gw, fixture.division, fixture.stage, fixture.groupSlot, fixture.homeTeamId, fixture.awayTeamId);
        created += 1;
      });
    }
  });
  tx();

  return created;
}

type TrioGroupedTableRow = {
  division: TrioDivisionName;
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

function getTrioLeagueTableGroups(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ division: TrioDivisionName; rows: TrioGroupedTableRow[] }> {
  if (!isSeasonFiveOrLater(season)) {
    return [];
  }

  const buckets = trioSeedBuckets(db, season);
  if (buckets.length !== TRIO_DIVISION_ORDER.length) {
    return [];
  }
  const cappedGw = gwIndex(gw) >= TRIO_REGULAR_SEASON_GAMEWEEKS ? GAMEWEEKS[TRIO_REGULAR_SEASON_GAMEWEEKS - 1] : gw;
  loadTrioLeagueFixturesForRange(db, season, 'GW1', cappedGw);

  const divisionByTeamId = new Map<number, TrioDivisionName>();
  buckets.forEach((bucket) => {
    bucket.teamIds.forEach((teamId) => {
      divisionByTeamId.set(teamId, bucket.division);
    });
  });

  const teams = db
    .prepare(
      `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.ball_color,
        t.ring_color,
        t.text_color
      FROM season_teams st
      INNER JOIN teams t ON t.id = st.team_id
      WHERE st.season = ?
      `,
    )
    .all(season) as Array<{
    team_id: number;
    team_name: string;
    ball_color: string | null;
    ring_color: string | null;
    text_color: string | null;
  }>;

  const perfMap = new Map<string, { profit: number; spins: number; entryCount: number }>();
  const totalProfitMap = new Map<number, number>();
  const totalSpinsMap = new Map<number, number>();
  (
    db.prepare(
      `
      SELECT gw, team_id, COALESCE(SUM(profit), 0) AS profit, COALESCE(SUM(spins), 0) AS spins, COUNT(*) AS entry_count
      FROM entries
      WHERE season = ?
      GROUP BY gw, team_id
      `,
    ).all(season) as Array<{ gw: string; team_id: number; profit: number; spins: number; entry_count: number }>
  ).forEach((row) => {
    perfMap.set(`${row.gw}:${row.team_id}`, { profit: row.profit, spins: row.spins, entryCount: row.entry_count });
    if (gwNumber(row.gw) <= gwNumber(cappedGw)) {
      totalProfitMap.set(row.team_id, (totalProfitMap.get(row.team_id) ?? 0) + row.profit);
      totalSpinsMap.set(row.team_id, (totalSpinsMap.get(row.team_id) ?? 0) + row.spins);
    }
  });

  const statMap = new Map<number, { played: number; wins: number; draws: number; losses: number; points: number }>();
  teams.forEach((team) => {
    if (divisionByTeamId.has(team.team_id)) {
      statMap.set(team.team_id, { played: 0, wins: 0, draws: 0, losses: 0, points: 0 });
    }
  });

  (
    db.prepare(
      `
      SELECT gw, division, home_team_id, away_team_id
      FROM trio_league_fixtures
      WHERE season = ? AND stage = 'regular'
      `,
    ).all(season) as Array<{ gw: string; division: string; home_team_id: number; away_team_id: number }>
  ).forEach((fixture) => {
    if (gwNumber(fixture.gw) > gwNumber(cappedGw)) {
      return;
    }
    const division = divisionByTeamId.get(fixture.home_team_id);
    if (!division || division !== fixture.division || divisionByTeamId.get(fixture.away_team_id) !== division) {
      return;
    }
    const homePerf = perfMap.get(`${fixture.gw}:${fixture.home_team_id}`) ?? { profit: 0, spins: 0, entryCount: 0 };
    const awayPerf = perfMap.get(`${fixture.gw}:${fixture.away_team_id}`) ?? { profit: 0, spins: 0, entryCount: 0 };
    if (homePerf.entryCount === 0 && awayPerf.entryCount === 0) {
      return;
    }
    const home = statMap.get(fixture.home_team_id);
    const away = statMap.get(fixture.away_team_id);
    if (!home || !away) {
      return;
    }
    home.played += 1;
    away.played += 1;
    if (homePerf.profit > awayPerf.profit) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (awayPerf.profit > homePerf.profit) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return TRIO_DIVISION_ORDER.map((division) => {
    const rows = teams
      .filter((team) => divisionByTeamId.get(team.team_id) === division)
      .map((team) => {
        const stats = statMap.get(team.team_id) ?? { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        return {
          division,
          teamId: team.team_id,
          teamName: team.team_name,
          ballColor: team.ball_color,
          ringColor: team.ring_color,
          textColor: team.text_color,
          played: stats.played,
          wins: stats.wins,
          draws: stats.draws,
          losses: stats.losses,
          points: stats.points,
          profit: Number((totalProfitMap.get(team.team_id) ?? 0).toFixed(2)),
          spins: totalSpinsMap.get(team.team_id) ?? 0,
          rank: 0,
        };
      })
      .sort((a, b) => (
        b.points - a.points
        || b.profit - a.profit
        || b.spins - a.spins
        || b.wins - a.wins
        || a.teamName.localeCompare(b.teamName)
      ))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    return { division, rows };
  });
}

function trioRegularSeasonRankMap(db: Database.Database, season: SeasonId): Map<number, number> {
  const rankMap = new Map<number, number>();
  getTrioLeagueTableGroups(db, season, 'GW6').forEach((group) => {
    group.rows.forEach((row) => {
      rankMap.set(row.teamId, row.rank);
    });
  });
  return rankMap;
}

function uniqueTeamIds(teamIds: Array<number | null | undefined>): number[] {
  const seen = new Set<number>();
  const unique: number[] = [];
  teamIds.forEach((teamId) => {
    if (!teamId || seen.has(teamId)) {
      return;
    }
    seen.add(teamId);
    unique.push(teamId);
  });
  return unique;
}

function trioPromotionTeamIds(
  rows: TrioGroupedTableRow[],
  playoffWinnerTeamId: number | null,
): number[] {
  const promoted = uniqueTeamIds([
    rows[0]?.teamId,
    playoffWinnerTeamId,
  ]);
  for (const row of rows) {
    if (promoted.length >= 2) {
      break;
    }
    if (!promoted.includes(row.teamId)) {
      promoted.push(row.teamId);
    }
  }
  return promoted.slice(0, 2);
}

function buildNextTrioLeagueSeedOrder(db: Database.Database, season: SeasonId, next: SeasonId): number[] {
  const nextSeasonTeamIds = (
    db.prepare('SELECT team_id FROM season_teams WHERE season = ? ORDER BY team_id').all(next) as Array<{ team_id: number }>
  ).map((row) => row.team_id);
  if (nextSeasonTeamIds.length !== TRIO_DIVISION_ORDER.length * TRIO_DIVISION_SIZE) {
    return [];
  }

  if (!isSeasonFiveOrLater(season)) {
    return defaultTrioLeagueSeedOrder(db, next, nextSeasonTeamIds);
  }

  ensureTrioLeaguePlayoffFixtures(db, season, 'GW8');
  const tableGroups = getTrioLeagueTableGroups(db, season, 'GW6');
  const premierRows = tableGroups.find((group) => group.division === TRIO_DIVISION_ORDER[0])?.rows ?? [];
  const ligueRows = tableGroups.find((group) => group.division === TRIO_DIVISION_ORDER[1])?.rows ?? [];
  const bundesligaRows = tableGroups.find((group) => group.division === TRIO_DIVISION_ORDER[2])?.rows ?? [];
  if (
    premierRows.length !== TRIO_DIVISION_SIZE
    || ligueRows.length !== TRIO_DIVISION_SIZE
    || bundesligaRows.length !== TRIO_DIVISION_SIZE
  ) {
    return defaultTrioLeagueSeedOrder(db, next, nextSeasonTeamIds);
  }

  const liguePlayoffWinner = resolveTrioPlayoffWinnerForDivision(db, season, TRIO_DIVISION_ORDER[1], 1);
  const bundesligaPlayoffWinner = resolveTrioPlayoffWinnerForDivision(db, season, TRIO_DIVISION_ORDER[2], 1);
  const premierRelegated = premierRows.slice(-2).map((row) => row.teamId);
  const liguePromoted = trioPromotionTeamIds(ligueRows, liguePlayoffWinner);
  const bundesligaPromoted = trioPromotionTeamIds(bundesligaRows, bundesligaPlayoffWinner);
  const ligueRelegated = ligueRows.slice(-2).map((row) => row.teamId);

  const premierNext = [
    ...premierRows.filter((row) => !premierRelegated.includes(row.teamId)).map((row) => row.teamId),
    ...liguePromoted,
  ];
  const ligueNext = [
    ...premierRelegated,
    ...ligueRows
      .filter((row) => !liguePromoted.includes(row.teamId) && !ligueRelegated.includes(row.teamId))
      .map((row) => row.teamId),
    ...bundesligaPromoted,
  ];
  const bundesligaNext = [
    ...ligueRelegated,
    ...bundesligaRows.filter((row) => !bundesligaPromoted.includes(row.teamId)).map((row) => row.teamId),
  ];

  const seeded = [...premierNext, ...ligueNext, ...bundesligaNext];
  return seeded.length === nextSeasonTeamIds.length ? seeded : defaultTrioLeagueSeedOrder(db, next, nextSeasonTeamIds);
}

function tierLeagueSeedKey(season: SeasonId): string {
  return `tier_league_seed_${season}`;
}

type TierLeagueFixtureType = 'division' | 'cross';
type TierLeagueFixtureDivision = TierLeagueDivisionName | 'Cross-Tier';
type TierLeagueFixtureTemplate = {
  division: TierLeagueFixtureDivision;
  fixtureType: TierLeagueFixtureType;
  groupSlot: number;
  homeTeamId: number;
  awayTeamId: number;
};

type TierLeagueGroupedTableRow = {
  division: TierLeagueDivisionName;
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

const TIER_LEAGUE_CROSS_DIVISION = 'Cross-Tier' as const;
const TIER_LEAGUE_EXPECTED_TEAM_COUNT = TIER_LEAGUE_DIVISION_ORDER.length * TIER_LEAGUE_DIVISION_SIZE;

function defaultTierLeagueSeedOrder(teamIds: number[]): number[] {
  return shuffle(teamIds);
}

function ensureTierLeagueSeedOrder(db: Database.Database, season: SeasonId): number[] {
  if (!isSeasonSixOrLater(season)) {
    return [];
  }

  const existingSeasonTeams = db
    .prepare('SELECT COUNT(*) as c FROM season_teams WHERE season = ?')
    .get(season) as { c: number };
  if (existingSeasonTeams.c === 0) {
    assignDivisionsForSeason(db, season);
  }

  const teamIds = (
    db.prepare('SELECT team_id FROM season_teams WHERE season = ? ORDER BY team_id').all(season) as Array<{ team_id: number }>
  ).map((row) => row.team_id);
  if (teamIds.length !== TIER_LEAGUE_EXPECTED_TEAM_COUNT) {
    return [];
  }

  const validIds = new Set(teamIds);
  const stored = getSetting(db, tierLeagueSeedKey(season));
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as number[];
      const unique = new Set(parsed);
      const valid =
        Array.isArray(parsed)
        && parsed.length === teamIds.length
        && unique.size === teamIds.length
        && parsed.every((id) => Number.isInteger(id) && validIds.has(id));
      if (valid) {
        return parsed;
      }
    } catch {
      // ignore invalid seed and regenerate below
    }
  }

  const seasonNumber = Number.parseInt(season.slice(1), 10);
  if (Number.isFinite(seasonNumber) && seasonNumber > 6) {
    const previousSeason = `S${seasonNumber - 1}` as SeasonId;
    const seededFromPrevious = buildNextTierLeagueSeedOrder(db, previousSeason, season);
    if (seededFromPrevious.length === teamIds.length) {
      setSetting(db, tierLeagueSeedKey(season), JSON.stringify(seededFromPrevious));
      return seededFromPrevious;
    }
  }

  const seeded = defaultTierLeagueSeedOrder(teamIds);
  setSetting(db, tierLeagueSeedKey(season), JSON.stringify(seeded));
  return seeded;
}

function tierLeagueSeedBuckets(
  db: Database.Database,
  season: SeasonId,
): Array<{ division: TierLeagueDivisionName; teamIds: number[] }> {
  const seeded = ensureTierLeagueSeedOrder(db, season);
  if (seeded.length !== TIER_LEAGUE_EXPECTED_TEAM_COUNT) {
    return [];
  }
  return TIER_LEAGUE_DIVISION_ORDER.map((division, index) => ({
    division,
    teamIds: seeded.slice(index * TIER_LEAGUE_DIVISION_SIZE, (index + 1) * TIER_LEAGUE_DIVISION_SIZE),
  }));
}

function roundsForTierLeagueBucket(season: SeasonId, teamIds: number[]): Array<Array<[number, number]>> {
  const tierGameweeks = getTierLeagueGameweeksForSeason(season);
  const baseRounds = generateRoundRobinRounds(teamIds);
  const homeAwayBalanced = [
    ...baseRounds,
    ...baseRounds.map((round) => round.map(([homeTeamId, awayTeamId]) => [awayTeamId, homeTeamId] as [number, number])),
  ];
  if (homeAwayBalanced.length >= tierGameweeks.length) {
    return homeAwayBalanced.slice(0, tierGameweeks.length);
  }
  const extended = [...homeAwayBalanced];
  while (extended.length < tierGameweeks.length) {
    const source = baseRounds[extended.length % baseRounds.length] ?? [];
    extended.push(source);
  }
  return extended.slice(0, tierGameweeks.length);
}

function roundsForTierLeague(db: Database.Database, season: SeasonId): Array<TierLeagueFixtureTemplate[]> {
  const tierGameweeks = getTierLeagueGameweeksForSeason(season);
  const buckets = tierLeagueSeedBuckets(db, season);
  if (buckets.length !== TIER_LEAGUE_DIVISION_ORDER.length) {
    return [];
  }

  const rounds = Array.from({ length: tierGameweeks.length }, () => [] as TierLeagueFixtureTemplate[]);
  const idleTeamsByRound = Array.from({ length: tierGameweeks.length }, () => [] as Array<{
    division: TierLeagueDivisionName;
    teamId: number;
  }>);

  buckets.forEach(({ division, teamIds }) => {
    const divisionRounds = roundsForTierLeagueBucket(season, teamIds);
    divisionRounds.forEach((round, roundIndex) => {
      const fixture = round[0];
      if (!fixture) {
        return;
      }
      rounds[roundIndex]?.push({
        division,
        fixtureType: 'division',
        groupSlot: 1,
        homeTeamId: fixture[0],
        awayTeamId: fixture[1],
      });

      const activeTeamIds = new Set(fixture);
      const idleTeamId = teamIds.find((teamId) => !activeTeamIds.has(teamId));
      if (idleTeamId) {
        idleTeamsByRound[roundIndex]?.push({ division, teamId: idleTeamId });
      }
    });
  });

  idleTeamsByRound.forEach((idleTeams, roundIndex) => {
    const shuffledIdleTeams = shuffle(idleTeams);
    for (let pairIndex = 0; pairIndex < shuffledIdleTeams.length; pairIndex += 2) {
      const home = shuffledIdleTeams[pairIndex];
      const away = shuffledIdleTeams[pairIndex + 1];
      if (!home || !away) {
        continue;
      }
      rounds[roundIndex]?.push({
        division: TIER_LEAGUE_CROSS_DIVISION,
        fixtureType: 'cross',
        groupSlot: Math.floor(pairIndex / 2) + 1,
        homeTeamId: home.teamId,
        awayTeamId: away.teamId,
      });
    }
  });

  return rounds;
}

export function loadTierLeagueFixturesForRange(
  db: Database.Database,
  season: SeasonId,
  fromGw: string,
  toGw: string,
): number {
  if (!isSeasonSixOrLater(season)) {
    return 0;
  }

  const tierGameweeks = getTierLeagueGameweeksForSeason(season);
  const tierStartGw = getTierLeagueStartGwForSeason(season);
  const tierEndGw = getTierLeagueEndGwForSeason(season);
  const startIdx = gwIndex(tierStartGw);
  const endIdx = gwIndex(tierEndGw);
  const fromIdx = gwIndex(fromGw);
  const toIdx = gwIndex(toGw);
  if (fromIdx < 0 || toIdx < 0) {
    return 0;
  }

  const lower = Math.max(Math.min(fromIdx, toIdx), startIdx);
  const upper = Math.min(Math.max(fromIdx, toIdx), endIdx);
  if (lower > upper) {
    return 0;
  }

  const rounds = roundsForTierLeague(db, season);
  if (rounds.length !== tierGameweeks.length) {
    return 0;
  }

  const countForGw = db.prepare('SELECT COUNT(*) as c FROM tier_league_fixtures WHERE season = ? AND gw = ?');
  const insert = db.prepare(
    `
    INSERT INTO tier_league_fixtures (season, gw, division, fixture_type, group_slot, home_team_id, away_team_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  );

  let created = 0;
  const tx = db.transaction(() => {
    for (let gwIdx = lower; gwIdx <= upper; gwIdx += 1) {
      const gw = GAMEWEEKS[gwIdx];
      if (!gw) {
        continue;
      }
      const existing = countForGw.get(season, gw) as { c: number };
      if (existing.c > 0) {
        continue;
      }
      const round = rounds[gwIdx - startIdx];
      if (!round) {
        continue;
      }
      round.forEach((fixture) => {
        insert.run(
          season,
          gw,
          fixture.division,
          fixture.fixtureType,
          fixture.groupSlot,
          fixture.homeTeamId,
          fixture.awayTeamId,
        );
        created += 1;
      });
    }
  });
  tx();

  return created;
}

function getTierLeagueTableGroups(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ division: TierLeagueDivisionName; rows: TierLeagueGroupedTableRow[] }> {
  const tierStartGw = getTierLeagueStartGwForSeason(season);
  const tierEndGw = getTierLeagueEndGwForSeason(season);
  if (!isSeasonSixOrLater(season) || gwIndex(gw) < gwIndex(tierStartGw)) {
    return [];
  }

  const buckets = tierLeagueSeedBuckets(db, season);
  if (buckets.length !== TIER_LEAGUE_DIVISION_ORDER.length) {
    return [];
  }
  const cappedGw = gwIndex(gw) > gwIndex(tierEndGw) ? tierEndGw : gw;
  loadTierLeagueFixturesForRange(db, season, tierStartGw, cappedGw);

  const divisionByTeamId = new Map<number, TierLeagueDivisionName>();
  buckets.forEach((bucket) => {
    bucket.teamIds.forEach((teamId) => {
      divisionByTeamId.set(teamId, bucket.division);
    });
  });

  const teams = db
    .prepare(
      `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.ball_color,
        t.ring_color,
        t.text_color
      FROM season_teams st
      INNER JOIN teams t ON t.id = st.team_id
      WHERE st.season = ?
      `,
    )
    .all(season) as Array<{
    team_id: number;
    team_name: string;
    ball_color: string | null;
    ring_color: string | null;
    text_color: string | null;
  }>;

  const perfMap = new Map<string, { profit: number; spins: number; entryCount: number }>();
  const totalProfitMap = new Map<number, number>();
  const totalSpinsMap = new Map<number, number>();
  (
    db.prepare(
      `
      SELECT gw, team_id, COALESCE(SUM(profit), 0) AS profit, COALESCE(SUM(spins), 0) AS spins, COUNT(*) AS entry_count
      FROM entries
      WHERE season = ?
      GROUP BY gw, team_id
      `,
    ).all(season) as Array<{ gw: string; team_id: number; profit: number; spins: number; entry_count: number }>
  ).forEach((row) => {
    perfMap.set(`${row.gw}:${row.team_id}`, { profit: row.profit, spins: row.spins, entryCount: row.entry_count });
    if (gwIndex(row.gw) >= gwIndex(tierStartGw) && gwIndex(row.gw) <= gwIndex(cappedGw)) {
      totalProfitMap.set(row.team_id, (totalProfitMap.get(row.team_id) ?? 0) + row.profit);
      totalSpinsMap.set(row.team_id, (totalSpinsMap.get(row.team_id) ?? 0) + row.spins);
    }
  });

  const statMap = new Map<number, { played: number; wins: number; draws: number; losses: number; points: number }>();
  teams.forEach((team) => {
    if (divisionByTeamId.has(team.team_id)) {
      statMap.set(team.team_id, { played: 0, wins: 0, draws: 0, losses: 0, points: 0 });
    }
  });

  (
    db.prepare(
      `
      SELECT gw, home_team_id, away_team_id
      FROM tier_league_fixtures
      WHERE season = ?
      `,
    ).all(season) as Array<{ gw: string; home_team_id: number; away_team_id: number }>
  ).forEach((fixture) => {
    if (gwIndex(fixture.gw) < gwIndex(tierStartGw) || gwIndex(fixture.gw) > gwIndex(cappedGw)) {
      return;
    }
    const homePerf = perfMap.get(`${fixture.gw}:${fixture.home_team_id}`) ?? { profit: 0, spins: 0, entryCount: 0 };
    const awayPerf = perfMap.get(`${fixture.gw}:${fixture.away_team_id}`) ?? { profit: 0, spins: 0, entryCount: 0 };
    if (homePerf.entryCount === 0 && awayPerf.entryCount === 0) {
      return;
    }
    const home = statMap.get(fixture.home_team_id);
    const away = statMap.get(fixture.away_team_id);
    if (!home || !away) {
      return;
    }

    home.played += 1;
    away.played += 1;
    if (homePerf.profit > awayPerf.profit) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (awayPerf.profit > homePerf.profit) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return TIER_LEAGUE_DIVISION_ORDER.map((division) => {
    const rows = teams
      .filter((team) => divisionByTeamId.get(team.team_id) === division)
      .map((team) => {
        const stats = statMap.get(team.team_id) ?? { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        return {
          division,
          teamId: team.team_id,
          teamName: team.team_name,
          ballColor: team.ball_color,
          ringColor: team.ring_color,
          textColor: team.text_color,
          played: stats.played,
          wins: stats.wins,
          draws: stats.draws,
          losses: stats.losses,
          points: stats.points,
          profit: Number((totalProfitMap.get(team.team_id) ?? 0).toFixed(2)),
          spins: totalSpinsMap.get(team.team_id) ?? 0,
          rank: 0,
        };
      })
      .sort((a, b) => (
        b.points - a.points
        || b.profit - a.profit
        || b.spins - a.spins
        || b.wins - a.wins
        || a.teamName.localeCompare(b.teamName)
      ))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    return { division, rows };
  });
}

function buildNextTierLeagueSeedOrder(db: Database.Database, season: SeasonId, next: SeasonId): number[] {
  const nextSeasonTeamIds = (
    db.prepare('SELECT team_id FROM season_teams WHERE season = ? ORDER BY team_id').all(next) as Array<{ team_id: number }>
  ).map((row) => row.team_id);
  if (nextSeasonTeamIds.length !== TIER_LEAGUE_EXPECTED_TEAM_COUNT) {
    return [];
  }

  if (!isSeasonSixOrLater(season)) {
    return defaultTierLeagueSeedOrder(nextSeasonTeamIds);
  }

  const currentBuckets = tierLeagueSeedBuckets(db, season);
  if (currentBuckets.length !== TIER_LEAGUE_DIVISION_ORDER.length) {
    return defaultTierLeagueSeedOrder(nextSeasonTeamIds);
  }

  const tableGroups = getTierLeagueTableGroups(db, season, getTierLeagueEndGwForSeason(season));
  if (
    tableGroups.length !== TIER_LEAGUE_DIVISION_ORDER.length
    || tableGroups.some((group) => group.rows.length !== TIER_LEAGUE_DIVISION_SIZE)
  ) {
    return currentBuckets.flatMap((bucket) => bucket.teamIds);
  }

  const nextBuckets = TIER_LEAGUE_DIVISION_ORDER.map((_, index) => {
    const rows = tableGroups[index]?.rows ?? [];
    const upperRows = index > 0 ? tableGroups[index - 1]?.rows ?? [] : [];
    const lowerRows = index < TIER_LEAGUE_DIVISION_ORDER.length - 1 ? tableGroups[index + 1]?.rows ?? [] : [];
    if (rows.length !== TIER_LEAGUE_DIVISION_SIZE) {
      return currentBuckets[index]?.teamIds ?? [];
    }
    if (index === 0) {
      return [
        rows[0]?.teamId,
        rows[1]?.teamId,
        lowerRows[0]?.teamId,
      ];
    }
    if (index === TIER_LEAGUE_DIVISION_ORDER.length - 1) {
      return [
        upperRows[2]?.teamId,
        rows[1]?.teamId,
        rows[2]?.teamId,
      ];
    }
    return [
      upperRows[2]?.teamId,
      rows[1]?.teamId,
      lowerRows[0]?.teamId,
    ];
  });

  const seeded = nextBuckets.flat().filter((teamId): teamId is number => Number.isInteger(teamId));
  const seededSet = new Set(seeded);
  if (
    seeded.length !== nextSeasonTeamIds.length
    || seededSet.size !== nextSeasonTeamIds.length
    || nextSeasonTeamIds.some((teamId) => !seededSet.has(teamId))
  ) {
    return currentBuckets.flatMap((bucket) => bucket.teamIds);
  }

  return seeded;
}

function resolveTrioPlayoffWinnerForDivision(
  db: Database.Database,
  season: SeasonId,
  division: TrioDivisionName,
  groupSlot = 1,
): number | null {
  const finalFixture = db
    .prepare(
      `
      SELECT id
      FROM trio_league_fixtures
      WHERE season = ? AND gw = 'GW8' AND division = ? AND stage = 'playoff_final' AND group_slot = ?
      ORDER BY id
      LIMIT 1
      `,
    )
    .get(season, division, groupSlot) as { id: number } | undefined;
  if (!finalFixture) {
    return null;
  }
  return resolveTrioPlayoffWinner(db, season, finalFixture.id);
}

function resolveTrioPlayoffWinner(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
): number | null {
  const fixture = db
    .prepare(
      `
      SELECT gw, home_team_id, away_team_id
      FROM trio_league_fixtures
      WHERE id = ? AND season = ?
      `,
    )
    .get(fixtureId, season) as { gw: string; home_team_id: number; away_team_id: number } | undefined;
  if (!fixture) {
    return null;
  }

  const homePerf = getTeamGwPerformance(db, season, fixture.gw, fixture.home_team_id);
  const awayPerf = getTeamGwPerformance(db, season, fixture.gw, fixture.away_team_id);
  const homeCount = db
    .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
    .get(season, fixture.gw, fixture.home_team_id) as { c: number };
  const awayCount = db
    .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
    .get(season, fixture.gw, fixture.away_team_id) as { c: number };

  if (homeCount.c === 0 && awayCount.c === 0) {
    return null;
  }
  if (homePerf.profit > awayPerf.profit) {
    return fixture.home_team_id;
  }
  if (awayPerf.profit > homePerf.profit) {
    return fixture.away_team_id;
  }
  const penaltyWinner = db
    .prepare(
      `
      SELECT winner_team_id
      FROM trio_playoff_penalties
      WHERE season = ? AND fixture_id = ?
      `,
    )
    .get(season, fixtureId) as { winner_team_id: number } | undefined;
  return penaltyWinner?.winner_team_id ?? null;
}

export function getMasterLeagueFixtures(
  db: Database.Database,
  season: SeasonId,
  gw?: string,
): Array<{
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
}> {
  const fixtures = db
    .prepare(
      `
      SELECT
        mf.id,
        mf.gw,
        mf.home_team_id,
        mf.away_team_id,
        ht.name AS home_team,
        at.name AS away_team
      FROM master_league_fixtures mf
      INNER JOIN teams ht ON ht.id = mf.home_team_id
      INNER JOIN teams at ON at.id = mf.away_team_id
      WHERE mf.season = ?
      ${gw ? 'AND mf.gw = ?' : ''}
      ORDER BY CASE mf.gw
        WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
        WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
        WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END, mf.id
      `,
    )
    .all(...(gw ? [season, gw] : [season])) as Array<{
    id: number;
    gw: string;
    home_team_id: number;
    away_team_id: number;
    home_team: string;
    away_team: string;
  }>;

  return fixtures.map((fixture) => {
    const homePerf = getTeamGwPerformance(db, season, fixture.gw, fixture.home_team_id);
    const awayPerf = getTeamGwPerformance(db, season, fixture.gw, fixture.away_team_id);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.home_team_id) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.away_team_id) as { c: number };

    let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
    if (homeCount.c > 0 || awayCount.c > 0) {
      if (homePerf.profit > awayPerf.profit) {
        result = 'home';
      } else if (awayPerf.profit > homePerf.profit) {
        result = 'away';
      } else {
        result = 'draw';
      }
    }

    return {
      id: fixture.id,
      gw: fixture.gw,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      homeProfit: Number(homePerf.profit.toFixed(2)),
      awayProfit: Number(awayPerf.profit.toFixed(2)),
      homeSpins: homePerf.spins,
      awaySpins: awayPerf.spins,
      result,
    };
  });
}

export function getMasterCupFixtures(
  db: Database.Database,
  season: SeasonId,
  gw?: string,
): Array<{
  id: number;
  gw: string;
  stage: MasterCupStage;
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
}> {
  if (!isSeasonFiveOrLater(season)) {
    return [];
  }

  const currentState = getCurrentState(db);
  const effectiveProgressGw =
    gw
    ?? (season === currentState.currentSeason ? currentState.currentGw : 'GW6');
  ensureMasterCupProgress(db, season, effectiveProgressGw);
  const fixtures = db
    .prepare(
      `
      SELECT
        mcf.id,
        mcf.gw,
        mcf.stage,
        mcf.tie_slot,
        mcf.leg_number,
        mcf.home_team_id,
        mcf.away_team_id,
        mcf.winner_team_id,
        mcf.home_seed,
        mcf.away_seed,
        ht.name AS home_team,
        at.name AS away_team,
        wt.name AS winner_team
      FROM master_cup_fixtures mcf
      LEFT JOIN teams ht ON ht.id = mcf.home_team_id
      LEFT JOIN teams at ON at.id = mcf.away_team_id
      LEFT JOIN teams wt ON wt.id = mcf.winner_team_id
      WHERE mcf.season = ?
      ${gw ? 'AND mcf.gw = ?' : ''}
      ORDER BY CASE mcf.gw
        WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
        WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
        WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END,
      CASE mcf.stage
        WHEN 'round_of_16' THEN 1
        WHEN 'quarter_final' THEN 2
        WHEN 'semi_final' THEN 3
        WHEN 'third_place_playoff' THEN 4
        WHEN 'final' THEN 5
        ELSE 99
      END,
      mcf.tie_slot,
      mcf.leg_number,
      mcf.id
      `,
    )
    .all(...(gw ? [season, gw] : [season])) as Array<{
    id: number;
    gw: string;
    stage: MasterCupStage;
    tie_slot: number;
    leg_number: number;
    home_team_id: number | null;
    away_team_id: number | null;
    winner_team_id: number | null;
    home_seed: number | null;
    away_seed: number | null;
    home_team: string | null;
    away_team: string | null;
    winner_team: string | null;
  }>;

  return fixtures.map((fixture) => {
    const homeMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.home_team_id);
    const awayMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.away_team_id);
    const hasEntries = homeMetrics.entryCount > 0 || awayMetrics.entryCount > 0;
    const played = hasEntries || fixture.winner_team_id !== null;
    const gwClosed = isMasterCupGameweekClosed(db, season, fixture.gw);

    if (fixture.stage !== 'semi_final') {
      let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
      let decidedBy: 'profit' | 'spins' | 'penalties' | 'aggregate_profit' | 'aggregate_spins' | 'aggregate_penalties' | 'pending' = 'pending';
      if (gwClosed && fixture.home_team_id && fixture.away_team_id && fixture.winner_team_id !== null) {
        if (homeMetrics.profit > awayMetrics.profit) {
          result = 'home';
          decidedBy = 'profit';
        } else if (awayMetrics.profit > homeMetrics.profit) {
          result = 'away';
          decidedBy = 'profit';
        } else if (fixture.winner_team_id === fixture.home_team_id) {
          result = 'home';
          decidedBy = 'penalties';
        } else if (fixture.winner_team_id === fixture.away_team_id) {
          result = 'away';
          decidedBy = 'penalties';
        }
      }
      return {
        id: fixture.id,
        gw: fixture.gw,
        stage: fixture.stage,
        legNumber: fixture.leg_number,
        tieSlot: fixture.tie_slot,
        roundName: masterCupRoundLabel(fixture.stage, fixture.leg_number),
        homeTeamId: fixture.home_team_id,
        awayTeamId: fixture.away_team_id,
        homeTeam: fixture.home_team,
        awayTeam: fixture.away_team,
        homeSeed: fixture.home_seed,
        awaySeed: fixture.away_seed,
        winnerTeamId: fixture.winner_team_id,
        winnerTeam: fixture.winner_team,
        homeProfit: homeMetrics.profit,
        awayProfit: awayMetrics.profit,
        homeSpins: homeMetrics.spins,
        awaySpins: awayMetrics.spins,
        aggregateHomeProfit: null,
        aggregateAwayProfit: null,
        aggregateHomeSpins: null,
        aggregateAwaySpins: null,
        played,
        result,
        decidedBy,
      };
    }

    let aggregateHomeProfit: number | null = null;
    let aggregateAwayProfit: number | null = null;
    let aggregateHomeSpins: number | null = null;
    let aggregateAwaySpins: number | null = null;
    let decidedBy: 'profit' | 'spins' | 'penalties' | 'aggregate_profit' | 'aggregate_spins' | 'aggregate_penalties' | 'pending' = 'pending';
    let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';

    if (fixture.leg_number === 2 && fixture.home_team_id && fixture.away_team_id) {
      const firstLeg = db
        .prepare(
          `
          SELECT gw, home_team_id, away_team_id
          FROM master_cup_fixtures
          WHERE season = ? AND stage = 'semi_final' AND tie_slot = ? AND leg_number = 1
          LIMIT 1
          `,
        )
        .get(season, fixture.tie_slot) as { gw: string; home_team_id: number | null; away_team_id: number | null } | undefined;
      if (firstLeg?.home_team_id && firstLeg.away_team_id) {
        const teamAId = fixture.home_team_id;
        const teamBId = fixture.away_team_id;
        const firstLegHome = getMasterCupTeamGwMetrics(db, season, firstLeg.gw, firstLeg.home_team_id);
        const firstLegAway = getMasterCupTeamGwMetrics(db, season, firstLeg.gw, firstLeg.away_team_id);
        const secondLegHome = homeMetrics;
        const secondLegAway = awayMetrics;

        aggregateHomeProfit = Number((
          (firstLeg.home_team_id === teamAId ? firstLegHome.profit : firstLegAway.profit)
          + secondLegHome.profit
        ).toFixed(2));
        aggregateAwayProfit = Number((
          (firstLeg.home_team_id === teamBId ? firstLegHome.profit : firstLegAway.profit)
          + secondLegAway.profit
        ).toFixed(2));
        aggregateHomeSpins = (
          (firstLeg.home_team_id === teamAId ? firstLegHome.spins : firstLegAway.spins)
          + secondLegHome.spins
        );
        aggregateAwaySpins = (
          (firstLeg.home_team_id === teamBId ? firstLegHome.spins : firstLegAway.spins)
          + secondLegAway.spins
        );

        if (gwClosed && isMasterCupGameweekClosed(db, season, firstLeg.gw) && fixture.winner_team_id !== null) {
          if (aggregateHomeProfit > aggregateAwayProfit) {
            result = fixture.winner_team_id === fixture.home_team_id ? 'home' : 'away';
            decidedBy = 'aggregate_profit';
          } else if (aggregateAwayProfit > aggregateHomeProfit) {
            result = fixture.winner_team_id === fixture.home_team_id ? 'home' : 'away';
            decidedBy = 'aggregate_profit';
          } else if (fixture.winner_team_id === fixture.home_team_id) {
            result = 'home';
            decidedBy = 'aggregate_penalties';
          } else if (fixture.winner_team_id === fixture.away_team_id) {
            result = 'away';
            decidedBy = 'aggregate_penalties';
          }
        } else if (!gwClosed || !isMasterCupGameweekClosed(db, season, firstLeg.gw)) {
          if (homeMetrics.profit > awayMetrics.profit) {
            result = 'home';
          } else if (awayMetrics.profit > homeMetrics.profit) {
            result = 'away';
          } else {
            result = 'draw';
          }
        }
      } else if (!gwClosed) {
        if (homeMetrics.profit > awayMetrics.profit) {
          result = 'home';
        } else if (awayMetrics.profit > homeMetrics.profit) {
          result = 'away';
        } else {
          result = 'draw';
        }
      }
    }

    return {
      id: fixture.id,
      gw: fixture.gw,
      stage: fixture.stage,
      legNumber: fixture.leg_number,
      tieSlot: fixture.tie_slot,
      roundName: masterCupRoundLabel(fixture.stage, fixture.leg_number),
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      homeSeed: fixture.home_seed,
      awaySeed: fixture.away_seed,
      winnerTeamId: fixture.winner_team_id,
      winnerTeam: fixture.winner_team,
      homeProfit: homeMetrics.profit,
      awayProfit: awayMetrics.profit,
      homeSpins: homeMetrics.spins,
      awaySpins: awayMetrics.spins,
      aggregateHomeProfit,
      aggregateAwayProfit,
      aggregateHomeSpins,
      aggregateAwaySpins,
      played,
      result,
      decidedBy,
    };
  });
}

type SuperCupPairingReason =
  | 'winners_vs_winners'
  | 'double_winner_vs_bookieball_runner_up'
  | 'double_winner_vs_master_cup_runner_up';

type SuperCupDecidedBy = 'profit' | 'penalties' | 'spins' | 'team_id' | 'pending';

function isSuperCupGameweekClosed(db: Database.Database, season: SeasonId, gw = 'GW1'): boolean {
  const currentState = getCurrentState(db);
  const seasonNumber = parseSeasonNumber(season);
  const currentSeasonNumber = parseSeasonNumber(currentState.currentSeason);
  if (
    Number.isFinite(seasonNumber)
    && Number.isFinite(currentSeasonNumber)
    && seasonNumber < currentSeasonNumber
  ) {
    return true;
  }
  return isGameweekLocked(db, season, gw);
}

function ensureSuperCupPenaltyTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS super_cup_penalties (
      season TEXT NOT NULL,
      fixture_id INTEGER NOT NULL,
      winner_team_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (season, fixture_id),
      FOREIGN KEY(fixture_id) REFERENCES super_cup_fixtures(id),
      FOREIGN KEY(winner_team_id) REFERENCES teams(id)
    );
    CREATE INDEX IF NOT EXISTS super_cup_penalties_season_idx
      ON super_cup_penalties(season);
  `);
}

function getSuperCupPenaltyWinner(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
): number | null {
  ensureSuperCupPenaltyTable(db);
  const existing = db
    .prepare(
      `
      SELECT winner_team_id
      FROM super_cup_penalties
      WHERE season = ? AND fixture_id = ?
      `,
    )
    .get(season, fixtureId) as { winner_team_id: number } | undefined;
  return existing?.winner_team_id ?? null;
}

function clearSuperCupProgressFromGameweek(
  db: Database.Database,
  season: SeasonId,
  fromGw: string,
): void {
  if (gwIndex(fromGw) > gwIndex('GW1')) {
    return;
  }
  ensureSuperCupPenaltyTable(db);
  db.prepare('DELETE FROM super_cup_penalties WHERE season = ?').run(season);
  db.prepare('UPDATE super_cup_fixtures SET winner_team_id = NULL WHERE season = ?').run(season);
}

type SuperCupFinalTeam = {
  teamId: number;
  profit: number;
  spins: number;
};

type SuperCupFinalSummary = {
  winner: SuperCupFinalTeam;
  runnerUp: SuperCupFinalTeam;
};

function previousSeasonId(season: SeasonId): SeasonId | null {
  const seasonNumber = parseSeasonNumber(season);
  if (!Number.isFinite(seasonNumber) || seasonNumber <= 1) {
    return null;
  }
  return `S${seasonNumber - 1}` as SeasonId;
}

function compareSuperCupTeams(left: SuperCupFinalTeam, right: SuperCupFinalTeam): number {
  if (left.profit !== right.profit) {
    return left.profit > right.profit ? 1 : -1;
  }
  if (left.spins !== right.spins) {
    return left.spins > right.spins ? 1 : -1;
  }
  if (left.teamId === right.teamId) {
    return 0;
  }
  return left.teamId < right.teamId ? 1 : -1;
}

function getBookieBallCupFinalSummary(
  db: Database.Database,
  season: SeasonId,
): SuperCupFinalSummary | null {
  ensureCupProgress(db, season, 'GW6');
  const final = db
    .prepare(
      `
      SELECT home_team_id, away_team_id, winner_team_id
      FROM cup_fixtures
      WHERE season = ?
        AND gw = 'GW6'
      ORDER BY id
      LIMIT 1
      `,
    )
    .get(season) as {
    home_team_id: number | null;
    away_team_id: number | null;
    winner_team_id: number | null;
  } | undefined;
  if (!final?.home_team_id || !final.away_team_id || !final.winner_team_id) {
    return null;
  }

  const winnerTeamId = final.winner_team_id;
  const runnerUpTeamId = winnerTeamId === final.home_team_id ? final.away_team_id : final.home_team_id;
  const winnerMetrics = getMasterCupTeamGwMetrics(db, season, 'GW6', winnerTeamId);
  const runnerUpMetrics = getMasterCupTeamGwMetrics(db, season, 'GW6', runnerUpTeamId);

  return {
    winner: {
      teamId: winnerTeamId,
      profit: winnerMetrics.profit,
      spins: winnerMetrics.spins,
    },
    runnerUp: {
      teamId: runnerUpTeamId,
      profit: runnerUpMetrics.profit,
      spins: runnerUpMetrics.spins,
    },
  };
}

function getMasterCupFinalSummary(
  db: Database.Database,
  season: SeasonId,
): SuperCupFinalSummary | null {
  if (!isSeasonFiveOrLater(season)) {
    return null;
  }

  ensureMasterCupProgress(db, season, 'GW6');
  const final = db
    .prepare(
      `
      SELECT home_team_id, away_team_id, winner_team_id
      FROM master_cup_fixtures
      WHERE season = ?
        AND stage = 'final'
        AND gw = 'GW6'
      ORDER BY id
      LIMIT 1
      `,
    )
    .get(season) as {
    home_team_id: number | null;
    away_team_id: number | null;
    winner_team_id: number | null;
  } | undefined;
  if (!final?.home_team_id || !final.away_team_id || !final.winner_team_id) {
    return null;
  }

  const winnerTeamId = final.winner_team_id;
  const runnerUpTeamId = winnerTeamId === final.home_team_id ? final.away_team_id : final.home_team_id;
  const winnerMetrics = getMasterCupTeamGwMetrics(db, season, 'GW6', winnerTeamId);
  const runnerUpMetrics = getMasterCupTeamGwMetrics(db, season, 'GW6', runnerUpTeamId);

  return {
    winner: {
      teamId: winnerTeamId,
      profit: winnerMetrics.profit,
      spins: winnerMetrics.spins,
    },
    runnerUp: {
      teamId: runnerUpTeamId,
      profit: runnerUpMetrics.profit,
      spins: runnerUpMetrics.spins,
    },
  };
}

function deriveSuperCupFixtureSeed(
  db: Database.Database,
  season: SeasonId,
): {
  sourceSeason: SeasonId;
  pairingReason: SuperCupPairingReason;
  homeTeamId: number;
  awayTeamId: number;
  bookieballWinnerTeamId: number;
  bookieballRunnerUpTeamId: number;
  masterCupWinnerTeamId: number;
  masterCupRunnerUpTeamId: number;
} | null {
  const sourceSeason = previousSeasonId(season);
  if (!sourceSeason) {
    return null;
  }

  const bookieBallFinal = getBookieBallCupFinalSummary(db, sourceSeason);
  const masterCupFinal = getMasterCupFinalSummary(db, sourceSeason);
  if (!bookieBallFinal || !masterCupFinal) {
    return null;
  }

  if (bookieBallFinal.winner.teamId !== masterCupFinal.winner.teamId) {
    return {
      sourceSeason,
      pairingReason: 'winners_vs_winners',
      homeTeamId: bookieBallFinal.winner.teamId,
      awayTeamId: masterCupFinal.winner.teamId,
      bookieballWinnerTeamId: bookieBallFinal.winner.teamId,
      bookieballRunnerUpTeamId: bookieBallFinal.runnerUp.teamId,
      masterCupWinnerTeamId: masterCupFinal.winner.teamId,
      masterCupRunnerUpTeamId: masterCupFinal.runnerUp.teamId,
    };
  }

  const betterRunnerUp = compareSuperCupTeams(bookieBallFinal.runnerUp, masterCupFinal.runnerUp) >= 0
    ? { team: bookieBallFinal.runnerUp, reason: 'double_winner_vs_bookieball_runner_up' as const }
    : { team: masterCupFinal.runnerUp, reason: 'double_winner_vs_master_cup_runner_up' as const };

  return {
    sourceSeason,
    pairingReason: betterRunnerUp.reason,
    homeTeamId: bookieBallFinal.winner.teamId,
    awayTeamId: betterRunnerUp.team.teamId,
    bookieballWinnerTeamId: bookieBallFinal.winner.teamId,
    bookieballRunnerUpTeamId: bookieBallFinal.runnerUp.teamId,
    masterCupWinnerTeamId: masterCupFinal.winner.teamId,
    masterCupRunnerUpTeamId: masterCupFinal.runnerUp.teamId,
  };
}

export function ensureSuperCupFixture(db: Database.Database, season: SeasonId): number {
  const existing = db
    .prepare('SELECT COUNT(*) as c FROM super_cup_fixtures WHERE season = ?')
    .get(season) as { c: number };
  if (existing.c > 0) {
    return 0;
  }

  const seed = deriveSuperCupFixtureSeed(db, season);
  if (!seed) {
    return 0;
  }

  db.prepare(
    `
    INSERT INTO super_cup_fixtures (
      season,
      gw,
      source_season,
      pairing_reason,
      home_team_id,
      away_team_id,
      bookieball_winner_team_id,
      bookieball_runner_up_team_id,
      master_cup_winner_team_id,
      master_cup_runner_up_team_id
    )
    VALUES (?, 'GW1', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    season,
    seed.sourceSeason,
    seed.pairingReason,
    seed.homeTeamId,
    seed.awayTeamId,
    seed.bookieballWinnerTeamId,
    seed.bookieballRunnerUpTeamId,
    seed.masterCupWinnerTeamId,
    seed.masterCupRunnerUpTeamId,
  );

  return 1;
}

function resolveSuperCupFixtureOutcome(
  db: Database.Database,
  season: SeasonId,
  fixture: { id: number; homeTeamId: number; awayTeamId: number },
): {
  winnerTeamId: number | null;
  result: 'home' | 'away' | 'pending';
  decidedBy: SuperCupDecidedBy;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  played: boolean;
} {
  const homeMetrics = getMasterCupTeamGwMetrics(db, season, 'GW1', fixture.homeTeamId);
  const awayMetrics = getMasterCupTeamGwMetrics(db, season, 'GW1', fixture.awayTeamId);
  const played = homeMetrics.entryCount > 0 || awayMetrics.entryCount > 0;
  const gwClosed = isSuperCupGameweekClosed(db, season, 'GW1');

  if (!played) {
    return {
      winnerTeamId: null,
      result: 'pending',
      decidedBy: 'pending',
      homeProfit: homeMetrics.profit,
      awayProfit: awayMetrics.profit,
      homeSpins: homeMetrics.spins,
      awaySpins: awayMetrics.spins,
      played: false,
    };
  }

  if (!gwClosed) {
    return {
      winnerTeamId: null,
      result: 'pending',
      decidedBy: 'pending',
      homeProfit: homeMetrics.profit,
      awayProfit: awayMetrics.profit,
      homeSpins: homeMetrics.spins,
      awaySpins: awayMetrics.spins,
      played: true,
    };
  }

  if (homeMetrics.profit > awayMetrics.profit) {
    return {
      winnerTeamId: fixture.homeTeamId,
      result: 'home',
      decidedBy: 'profit',
      homeProfit: homeMetrics.profit,
      awayProfit: awayMetrics.profit,
      homeSpins: homeMetrics.spins,
      awaySpins: awayMetrics.spins,
      played: true,
    };
  }
  if (awayMetrics.profit > homeMetrics.profit) {
    return {
      winnerTeamId: fixture.awayTeamId,
      result: 'away',
      decidedBy: 'profit',
      homeProfit: homeMetrics.profit,
      awayProfit: awayMetrics.profit,
      homeSpins: homeMetrics.spins,
      awaySpins: awayMetrics.spins,
      played: true,
    };
  }
  const winnerTeamId = getSuperCupPenaltyWinner(db, season, fixture.id);
  if (!winnerTeamId) {
    return {
      winnerTeamId: null,
      result: 'pending',
      decidedBy: 'pending',
      homeProfit: homeMetrics.profit,
      awayProfit: awayMetrics.profit,
      homeSpins: homeMetrics.spins,
      awaySpins: awayMetrics.spins,
      played: true,
    };
  }
  return {
    winnerTeamId,
    result: winnerTeamId === fixture.homeTeamId ? 'home' : 'away',
    decidedBy: 'penalties',
    homeProfit: homeMetrics.profit,
    awayProfit: awayMetrics.profit,
    homeSpins: homeMetrics.spins,
    awaySpins: awayMetrics.spins,
    played: true,
  };
}

export function ensureSuperCupProgress(db: Database.Database, season: SeasonId): void {
  ensureSuperCupFixture(db, season);
  const fixture = db
    .prepare(
      `
      SELECT id, home_team_id, away_team_id
      FROM super_cup_fixtures
      WHERE season = ?
      ORDER BY id
      LIMIT 1
      `,
    )
    .get(season) as { id: number; home_team_id: number; away_team_id: number } | undefined;
  if (!fixture) {
    return;
  }
  const outcome = resolveSuperCupFixtureOutcome(db, season, {
    id: fixture.id,
    homeTeamId: fixture.home_team_id,
    awayTeamId: fixture.away_team_id,
  });
  db.prepare('UPDATE super_cup_fixtures SET winner_team_id = ? WHERE id = ?').run(outcome.winnerTeamId, fixture.id);
}

function superCupPairingExplanation(
  reason: SuperCupPairingReason,
  names: {
    bookieballWinner: string;
    masterCupWinner: string;
    bookieballRunnerUp: string;
    masterCupRunnerUp: string;
  },
): string {
  if (reason === 'winners_vs_winners') {
    return `${names.bookieballWinner} earned the BookieBall Cup slot and ${names.masterCupWinner} earned the Master Cup slot.`;
  }
  if (reason === 'double_winner_vs_bookieball_runner_up') {
    return `${names.bookieballWinner} completed the double, so ${names.bookieballRunnerUp} got the second berth as the stronger final runner-up.`;
  }
  return `${names.bookieballWinner} completed the double, so ${names.masterCupRunnerUp} got the second berth as the stronger final runner-up.`;
}

export function getSuperCupFixtures(
  db: Database.Database,
  season?: SeasonId,
): Array<{
  id: number;
  season: SeasonId;
  gw: string;
  sourceSeason: SeasonId;
  pairingReason: SuperCupPairingReason;
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
  decidedBy: SuperCupDecidedBy;
  bookieballWinnerTeamId: number;
  bookieballWinnerTeam: string;
  bookieballRunnerUpTeamId: number;
  bookieballRunnerUpTeam: string;
  masterCupWinnerTeamId: number;
  masterCupWinnerTeam: string;
  masterCupRunnerUpTeamId: number;
  masterCupRunnerUpTeam: string;
}> {
  if (season) {
    ensureSuperCupProgress(db, season);
  } else {
    const state = getCurrentState(db);
    ensureSuperCupProgress(db, state.currentSeason);
  }

  const fixtures = db
    .prepare(
      `
      SELECT
        sc.id,
        sc.season,
        sc.gw,
        sc.source_season,
        sc.pairing_reason,
        sc.home_team_id,
        sc.away_team_id,
        sc.winner_team_id,
        sc.bookieball_winner_team_id,
        sc.bookieball_runner_up_team_id,
        sc.master_cup_winner_team_id,
        sc.master_cup_runner_up_team_id,
        ht.name AS home_team,
        at.name AS away_team,
        wt.name AS winner_team,
        bwt.name AS bookieball_winner_team,
        brt.name AS bookieball_runner_up_team,
        mwt.name AS master_cup_winner_team,
        mrt.name AS master_cup_runner_up_team
      FROM super_cup_fixtures sc
      INNER JOIN teams ht ON ht.id = sc.home_team_id
      INNER JOIN teams at ON at.id = sc.away_team_id
      LEFT JOIN teams wt ON wt.id = sc.winner_team_id
      INNER JOIN teams bwt ON bwt.id = sc.bookieball_winner_team_id
      INNER JOIN teams brt ON brt.id = sc.bookieball_runner_up_team_id
      INNER JOIN teams mwt ON mwt.id = sc.master_cup_winner_team_id
      INNER JOIN teams mrt ON mrt.id = sc.master_cup_runner_up_team_id
      ${season ? 'WHERE sc.season = ?' : ''}
      ORDER BY CAST(SUBSTR(sc.season, 2) AS INTEGER), sc.id
      `,
    )
    .all(...(season ? [season] : [])) as Array<{
    id: number;
    season: SeasonId;
    gw: string;
    source_season: SeasonId;
    pairing_reason: SuperCupPairingReason;
    home_team_id: number;
    away_team_id: number;
    winner_team_id: number | null;
    bookieball_winner_team_id: number;
    bookieball_runner_up_team_id: number;
    master_cup_winner_team_id: number;
    master_cup_runner_up_team_id: number;
    home_team: string;
    away_team: string;
    winner_team: string | null;
    bookieball_winner_team: string;
    bookieball_runner_up_team: string;
    master_cup_winner_team: string;
    master_cup_runner_up_team: string;
  }>;

  return fixtures.map((fixture) => {
    const outcome = resolveSuperCupFixtureOutcome(db, fixture.season, {
      id: fixture.id,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
    });
    const runnerUpTeamId = outcome.winnerTeamId === null
      ? null
      : outcome.winnerTeamId === fixture.home_team_id
        ? fixture.away_team_id
        : fixture.home_team_id;
    const runnerUpTeam = runnerUpTeamId === fixture.home_team_id ? fixture.home_team : runnerUpTeamId === fixture.away_team_id ? fixture.away_team : null;

    return {
      id: fixture.id,
      season: fixture.season,
      gw: fixture.gw,
      sourceSeason: fixture.source_season,
      pairingReason: fixture.pairing_reason,
      pairingExplanation: superCupPairingExplanation(fixture.pairing_reason, {
        bookieballWinner: fixture.bookieball_winner_team,
        masterCupWinner: fixture.master_cup_winner_team,
        bookieballRunnerUp: fixture.bookieball_runner_up_team,
        masterCupRunnerUp: fixture.master_cup_runner_up_team,
      }),
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      winnerTeamId: outcome.winnerTeamId,
      winnerTeam: outcome.winnerTeamId === fixture.home_team_id
        ? fixture.home_team
        : outcome.winnerTeamId === fixture.away_team_id
          ? fixture.away_team
          : fixture.winner_team,
      runnerUpTeamId,
      runnerUpTeam,
      homeProfit: outcome.homeProfit,
      awayProfit: outcome.awayProfit,
      homeSpins: outcome.homeSpins,
      awaySpins: outcome.awaySpins,
      played: outcome.played,
      result: outcome.result,
      decidedBy: outcome.decidedBy,
      bookieballWinnerTeamId: fixture.bookieball_winner_team_id,
      bookieballWinnerTeam: fixture.bookieball_winner_team,
      bookieballRunnerUpTeamId: fixture.bookieball_runner_up_team_id,
      bookieballRunnerUpTeam: fixture.bookieball_runner_up_team,
      masterCupWinnerTeamId: fixture.master_cup_winner_team_id,
      masterCupWinnerTeam: fixture.master_cup_winner_team,
      masterCupRunnerUpTeamId: fixture.master_cup_runner_up_team_id,
      masterCupRunnerUpTeam: fixture.master_cup_runner_up_team,
    };
  });
}

export function getSuperCupArchive(db: Database.Database): Array<{
  season: SeasonId;
  sourceSeason: SeasonId;
  winnerTeamId: number | null;
  winnerTeam: string | null;
  runnerUpTeamId: number | null;
  runnerUpTeam: string | null;
  pairingReason: SuperCupPairingReason;
  pairingExplanation: string;
  decidedBy: SuperCupDecidedBy;
  homeProfit: number;
  awayProfit: number;
}> {
  return getSuperCupFixtures(db).map((fixture) => ({
    season: fixture.season,
    sourceSeason: fixture.sourceSeason,
    winnerTeamId: fixture.winnerTeamId,
    winnerTeam: fixture.winnerTeam,
    runnerUpTeamId: fixture.runnerUpTeamId,
    runnerUpTeam: fixture.runnerUpTeam,
    pairingReason: fixture.pairingReason,
    pairingExplanation: fixture.pairingExplanation,
    decidedBy: fixture.decidedBy,
    homeProfit: fixture.homeProfit,
    awayProfit: fixture.awayProfit,
  }));
}

export function getSuperCupTieFixtures(
  db: Database.Database,
  season: SeasonId,
  upToGw: string,
): Array<{
  fixtureId: number;
  gw: string;
  roundName: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
}> {
  if (gwIndex(upToGw) < gwIndex('GW1')) {
    return [];
  }

  ensureSuperCupProgress(db, season);
  const fixture = db
    .prepare(
      `
      SELECT
        sc.id,
        sc.gw,
        sc.home_team_id,
        sc.away_team_id,
        ht.name AS home_team_name,
        at.name AS away_team_name
      FROM super_cup_fixtures sc
      INNER JOIN teams ht ON ht.id = sc.home_team_id
      INNER JOIN teams at ON at.id = sc.away_team_id
      WHERE sc.season = ?
        AND sc.gw = 'GW1'
      ORDER BY sc.id
      LIMIT 1
      `,
    )
    .get(season) as {
    id: number;
    gw: string;
    home_team_id: number;
    away_team_id: number;
    home_team_name: string;
    away_team_name: string;
  } | undefined;

  if (!fixture || !isSuperCupGameweekClosed(db, season, fixture.gw)) {
    return [];
  }

  const outcome = resolveSuperCupFixtureOutcome(db, season, {
    id: fixture.id,
    homeTeamId: fixture.home_team_id,
    awayTeamId: fixture.away_team_id,
  });
  if (outcome.winnerTeamId !== null) {
    return [];
  }

  const homeMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.home_team_id);
  const awayMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.away_team_id);
  if (homeMetrics.entryCount === 0 || awayMetrics.entryCount === 0) {
    return [];
  }
  if (homeMetrics.profit !== awayMetrics.profit) {
    return [];
  }

  return [{
    fixtureId: fixture.id,
    gw: fixture.gw,
    roundName: 'Super Cup',
    homeTeamId: fixture.home_team_id,
    homeTeamName: fixture.home_team_name,
    awayTeamId: fixture.away_team_id,
    awayTeamName: fixture.away_team_name,
    homeProfit: Number(homeMetrics.profit.toFixed(2)),
    awayProfit: Number(awayMetrics.profit.toFixed(2)),
    homeSpins: Number(homeMetrics.spins),
    awaySpins: Number(awayMetrics.spins),
  }];
}

export function setSuperCupWinner(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
  winnerTeamId: number | null,
): void {
  ensureSuperCupPenaltyTable(db);
  const fixture = db
    .prepare(
      `
      SELECT id, gw, home_team_id, away_team_id
      FROM super_cup_fixtures
      WHERE season = ?
        AND id = ?
      `,
    )
    .get(season, fixtureId) as {
    id: number;
    gw: string;
    home_team_id: number;
    away_team_id: number;
  } | undefined;
  if (!fixture) {
    throw new Error('Super Cup fixture not found');
  }
  if (
    winnerTeamId !== null
    && winnerTeamId !== fixture.home_team_id
    && winnerTeamId !== fixture.away_team_id
  ) {
    throw new Error('Winner must be one of the fixture teams');
  }
  if (!isSuperCupGameweekClosed(db, season, fixture.gw)) {
    throw new Error('Super Cup gameweek must be closed before taking penalties');
  }

  const homeMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.home_team_id);
  const awayMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.away_team_id);
  if (homeMetrics.entryCount === 0 || awayMetrics.entryCount === 0) {
    throw new Error('Both Super Cup teams must have entries before setting a winner');
  }
  if (homeMetrics.profit !== awayMetrics.profit) {
    throw new Error('Super Cup penalties are only required when profit is level');
  }

  if (winnerTeamId === null) {
    db.prepare('DELETE FROM super_cup_penalties WHERE season = ? AND fixture_id = ?').run(season, fixtureId);
    ensureSuperCupProgress(db, season);
    return;
  }

  db.prepare(
    `
    INSERT INTO super_cup_penalties (season, fixture_id, winner_team_id, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(season, fixture_id) DO UPDATE SET
      winner_team_id = excluded.winner_team_id,
      updated_at = CURRENT_TIMESTAMP
    `,
  ).run(season, fixtureId, winnerTeamId);
  ensureSuperCupProgress(db, season);
}

export function getTrioLeagueFixtures(
  db: Database.Database,
  season: SeasonId,
  gw?: string,
): Array<{
  id: number;
  gw: string;
  division: TrioDivisionName;
  stage: TrioFixtureStage;
  groupSlot: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  winnerTeamId: number | null;
}> {
  if (!isSeasonFiveOrLater(season)) {
    return [];
  }

  const fixtures = db
    .prepare(
      `
      SELECT
        tf.id,
        tf.gw,
        tf.division,
        tf.stage,
        tf.group_slot,
        tf.home_team_id,
        tf.away_team_id,
        ht.name AS home_team,
        at.name AS away_team
      FROM trio_league_fixtures tf
      INNER JOIN teams ht ON ht.id = tf.home_team_id
      INNER JOIN teams at ON at.id = tf.away_team_id
      WHERE tf.season = ?
      ${gw ? 'AND tf.gw = ?' : ''}
      ORDER BY CASE tf.gw
        WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
        WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
        WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END,
      CASE tf.division
        WHEN 'Premier League' THEN 1
        WHEN 'Ligue 1' THEN 2
        WHEN 'Bundesliga' THEN 3
        ELSE 99
      END,
      CASE tf.stage
        WHEN 'regular' THEN 1
        WHEN 'playoff_semi' THEN 2
        WHEN 'playoff_final' THEN 3
        ELSE 99
      END,
      tf.group_slot,
      tf.id
      `,
    )
    .all(...(gw ? [season, gw] : [season])) as Array<{
    id: number;
    gw: string;
    division: TrioDivisionName;
    stage: TrioFixtureStage;
    group_slot: number;
    home_team_id: number;
    away_team_id: number;
    home_team: string;
    away_team: string;
  }>;

  return fixtures.map((fixture) => {
    const homePerf = getTeamGwPerformance(db, season, fixture.gw, fixture.home_team_id);
    const awayPerf = getTeamGwPerformance(db, season, fixture.gw, fixture.away_team_id);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.home_team_id) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.away_team_id) as { c: number };
    const played = homeCount.c > 0 || awayCount.c > 0;

    let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
    let winnerTeamId: number | null = null;
    if (played) {
      if (homePerf.profit > awayPerf.profit) {
        result = 'home';
        winnerTeamId = fixture.home_team_id;
      } else if (awayPerf.profit > homePerf.profit) {
        result = 'away';
        winnerTeamId = fixture.away_team_id;
      } else if (fixture.stage === 'regular') {
        result = 'draw';
      } else {
        winnerTeamId = resolveTrioPlayoffWinner(db, season, fixture.id);
        if (winnerTeamId === fixture.home_team_id) {
          result = 'home';
        } else if (winnerTeamId === fixture.away_team_id) {
          result = 'away';
        } else {
          result = 'pending';
        }
      }
    }

    return {
      id: fixture.id,
      gw: fixture.gw,
      division: fixture.division,
      stage: fixture.stage,
      groupSlot: fixture.group_slot,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      homeProfit: Number(homePerf.profit.toFixed(2)),
      awayProfit: Number(awayPerf.profit.toFixed(2)),
      homeSpins: homePerf.spins,
      awaySpins: awayPerf.spins,
      played,
      result,
      winnerTeamId,
    };
  });
}

export function getMasterLeagueTable(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{
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
}> {
  loadMasterLeagueFixturesForRange(db, season, 'GW1', gw);

  const teams = db
    .prepare(
      `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.ball_color,
        t.ring_color,
        t.text_color
      FROM season_teams st
      INNER JOIN teams t ON t.id = st.team_id
      WHERE st.season = ?
      `,
    )
    .all(season) as Array<{
    team_id: number;
    team_name: string;
    ball_color: string | null;
    ring_color: string | null;
    text_color: string | null;
  }>;

  const perGwPerformance = db
    .prepare(
      `
      SELECT gw, team_id, COALESCE(SUM(profit), 0) AS profit, COALESCE(SUM(spins), 0) AS spins, COUNT(*) AS entry_count
      FROM entries
      WHERE season = ?
      GROUP BY gw, team_id
      `,
    )
    .all(season) as Array<{ gw: string; team_id: number; profit: number; spins: number; entry_count: number }>;

  const perfMap = new Map<string, { profit: number; spins: number; entryCount: number }>();
  const totalProfitMap = new Map<number, number>();
  const totalSpinsMap = new Map<number, number>();
  perGwPerformance.forEach((row) => {
    perfMap.set(`${row.gw}:${row.team_id}`, { profit: row.profit, spins: row.spins, entryCount: row.entry_count });
    if (gwNumber(row.gw) <= gwNumber(gw)) {
      totalProfitMap.set(row.team_id, (totalProfitMap.get(row.team_id) ?? 0) + row.profit);
      totalSpinsMap.set(row.team_id, (totalSpinsMap.get(row.team_id) ?? 0) + row.spins);
    }
  });

  const statMap = new Map<number, { played: number; wins: number; draws: number; losses: number; points: number }>();
  teams.forEach((team) => {
    statMap.set(team.team_id, { played: 0, wins: 0, draws: 0, losses: 0, points: 0 });
  });

  const fixtures = db
    .prepare('SELECT gw, home_team_id, away_team_id FROM master_league_fixtures WHERE season = ?')
    .all(season) as Array<{ gw: string; home_team_id: number; away_team_id: number }>;

  fixtures.forEach((fixture) => {
    if (gwNumber(fixture.gw) > gwNumber(gw)) {
      return;
    }

    const homePerf = perfMap.get(`${fixture.gw}:${fixture.home_team_id}`) ?? { profit: 0, spins: 0, entryCount: 0 };
    const awayPerf = perfMap.get(`${fixture.gw}:${fixture.away_team_id}`) ?? { profit: 0, spins: 0, entryCount: 0 };
    if (homePerf.entryCount === 0 && awayPerf.entryCount === 0) {
      return;
    }

    const home = statMap.get(fixture.home_team_id);
    const away = statMap.get(fixture.away_team_id);
    if (!home || !away) {
      return;
    }

    home.played += 1;
    away.played += 1;

    if (homePerf.profit > awayPerf.profit) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (awayPerf.profit > homePerf.profit) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return teams
    .map((team) => {
      const stats = statMap.get(team.team_id) ?? { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
      return {
        teamId: team.team_id,
        teamName: team.team_name,
        ballColor: team.ball_color,
        ringColor: team.ring_color,
        textColor: team.text_color,
        played: stats.played,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        points: stats.points,
        profit: Number((totalProfitMap.get(team.team_id) ?? 0).toFixed(2)),
        spins: totalSpinsMap.get(team.team_id) ?? 0,
        rank: 0,
      };
    })
    .sort((a, b) => (
      b.points - a.points
      || b.profit - a.profit
      || b.spins - a.spins
      || b.wins - a.wins
      || a.teamName.localeCompare(b.teamName)
    ))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function getTierLeagueFixtures(
  db: Database.Database,
  season: SeasonId,
  gw?: string,
): Array<{
  id: number;
  gw: string;
  division: TierLeagueFixtureDivision;
  fixtureType: TierLeagueFixtureType;
  groupSlot: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeDivision: TierLeagueDivisionName | null;
  awayDivision: TierLeagueDivisionName | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
}> {
  if (!isSeasonSixOrLater(season)) {
    return [];
  }

  const buckets = tierLeagueSeedBuckets(db, season);
  const divisionByTeamId = new Map<number, TierLeagueDivisionName>();
  buckets.forEach((bucket) => {
    bucket.teamIds.forEach((teamId) => {
      divisionByTeamId.set(teamId, bucket.division);
    });
  });

  const fixtures = db
    .prepare(
      `
      SELECT
        tf.id,
        tf.gw,
        tf.division,
        tf.fixture_type,
        tf.group_slot,
        tf.home_team_id,
        tf.away_team_id,
        ht.name AS home_team,
        at.name AS away_team
      FROM tier_league_fixtures tf
      INNER JOIN teams ht ON ht.id = tf.home_team_id
      INNER JOIN teams at ON at.id = tf.away_team_id
      WHERE tf.season = ?
      ${gw ? 'AND tf.gw = ?' : ''}
      ORDER BY CASE tf.gw
        WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
        WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
        WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END,
      CASE tf.fixture_type
        WHEN 'division' THEN 1
        WHEN 'cross' THEN 2
        ELSE 99
      END,
      CASE tf.division
        WHEN 'Legendary' THEN 1
        WHEN 'Masters' THEN 2
        WHEN 'Elite' THEN 3
        WHEN 'Superior' THEN 4
        WHEN 'Standard' THEN 5
        WHEN 'Average' THEN 6
        WHEN 'Poor' THEN 7
        WHEN 'Awful' THEN 8
        ELSE 99
      END,
      tf.group_slot,
      tf.id
      `,
    )
    .all(...(gw ? [season, gw] : [season])) as Array<{
    id: number;
    gw: string;
    division: TierLeagueFixtureDivision;
    fixture_type: TierLeagueFixtureType;
    group_slot: number;
    home_team_id: number;
    away_team_id: number;
    home_team: string;
    away_team: string;
  }>;

  return fixtures.map((fixture) => {
    const homePerf = getTeamGwPerformance(db, season, fixture.gw, fixture.home_team_id);
    const awayPerf = getTeamGwPerformance(db, season, fixture.gw, fixture.away_team_id);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.home_team_id) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.away_team_id) as { c: number };

    let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
    if (homeCount.c > 0 || awayCount.c > 0) {
      if (homePerf.profit > awayPerf.profit) {
        result = 'home';
      } else if (awayPerf.profit > homePerf.profit) {
        result = 'away';
      } else {
        result = 'draw';
      }
    }

    return {
      id: fixture.id,
      gw: fixture.gw,
      division: fixture.division,
      fixtureType: fixture.fixture_type,
      groupSlot: fixture.group_slot,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      homeDivision: divisionByTeamId.get(fixture.home_team_id) ?? null,
      awayDivision: divisionByTeamId.get(fixture.away_team_id) ?? null,
      homeProfit: Number(homePerf.profit.toFixed(2)),
      awayProfit: Number(awayPerf.profit.toFixed(2)),
      homeSpins: homePerf.spins,
      awaySpins: awayPerf.spins,
      result,
    };
  });
}

export function getTrioLeagueTable(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{
  division: TrioDivisionName;
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
}> {
  return getTrioLeagueTableGroups(db, season, gw).flatMap((group) => group.rows);
}

export function getTierLeagueTable(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{
  division: TierLeagueDivisionName;
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
}> {
  return getTierLeagueTableGroups(db, season, gw).flatMap((group) => group.rows);
}

export function getMasterLeagueMovement(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): { baselineGw: string | null; movement: Record<number, number> } {
  const idx = gwIndex(gw);
  const currentRows = getMasterLeagueTable(db, season, gw);
  const movement: Record<number, number> = {};

  if (idx <= 0) {
    currentRows.forEach((row) => {
      movement[row.teamId] = 0;
    });
    return { baselineGw: null, movement };
  }

  const baselineGw = GAMEWEEKS[idx - 1];
  const baselineRows = getMasterLeagueTable(db, season, baselineGw);
  const baselineMap = new Map(baselineRows.map((row) => [row.teamId, row.rank]));

  currentRows.forEach((row) => {
    const previousRank = baselineMap.get(row.teamId) ?? row.rank;
    movement[row.teamId] = previousRank - row.rank;
  });

  return { baselineGw, movement };
}

function isWithinSeasonGwCutoff(
  season: string,
  gw: string,
  cutoffSeason: SeasonId,
  cutoffGw: string,
): boolean {
  const seasonNumber = Number.parseInt(season.slice(1), 10);
  if (!Number.isFinite(seasonNumber)) {
    return false;
  }
  const cutoffSeasonNumber = parseSeasonNumber(cutoffSeason);
  if (seasonNumber < cutoffSeasonNumber) {
    return true;
  }
  if (seasonNumber > cutoffSeasonNumber) {
    return false;
  }
  return gwNumber(gw) <= gwNumber(cutoffGw);
}

type AllTimeLeagueRow = {
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

export function getAllTimeLeagues(
  db: Database.Database,
  cutoffSeason: SeasonId,
  cutoffGw: string,
): {
  fromSeason: string;
  fromGw: string;
  toSeason: string;
  toGw: string;
  pointsTable: AllTimeLeagueRow[];
  spinsTable: AllTimeLeagueRow[];
  profitTable: AllTimeLeagueRow[];
} {
  const cutoffSeasonNumber = parseSeasonNumber(cutoffSeason);
  const teams = db
    .prepare(
      `
      SELECT DISTINCT
        t.id AS team_id,
        t.name AS team_name,
        t.ball_color,
        t.ring_color,
        t.text_color
      FROM teams t
      INNER JOIN season_teams st ON st.team_id = t.id
      WHERE CAST(SUBSTR(st.season, 2) AS INTEGER) <= ?
      ORDER BY name
      `,
    )
    .all(cutoffSeasonNumber) as Array<{
    team_id: number;
    team_name: string;
    ball_color: string | null;
    ring_color: string | null;
    text_color: string | null;
  }>;

  const perGwPerformance = db
    .prepare(
      `
      SELECT season, gw, team_id, COALESCE(SUM(profit), 0) AS profit, COALESCE(SUM(spins), 0) AS spins, COUNT(*) AS entry_count
      FROM entries
      GROUP BY season, gw, team_id
      `,
    )
    .all() as Array<{
    season: string;
    gw: string;
    team_id: number;
    profit: number;
    spins: number;
    entry_count: number;
  }>;

  const perfMap = new Map<string, { profit: number; spins: number; entryCount: number }>();
  const totalProfitMap = new Map<number, number>();
  const totalSpinsMap = new Map<number, number>();
  for (const row of perGwPerformance) {
    if (!isWithinSeasonGwCutoff(row.season, row.gw, cutoffSeason, cutoffGw)) {
      continue;
    }
    perfMap.set(`${row.season}:${row.gw}:${row.team_id}`, {
      profit: row.profit,
      spins: row.spins,
      entryCount: row.entry_count,
    });
  }

  const statMap = new Map<number, { played: number; wins: number; draws: number; losses: number; points: number }>();
  teams.forEach((team) => {
    statMap.set(team.team_id, { played: 0, wins: 0, draws: 0, losses: 0, points: 0 });
  });

  const fixtures = db
    .prepare(
      `
      SELECT season, gw, home_team_id, away_team_id
      FROM league_fixtures
      `,
    )
    .all() as Array<{ season: string; gw: string; home_team_id: number; away_team_id: number }>;

  for (const fixture of fixtures) {
    if (!isWithinSeasonGwCutoff(fixture.season, fixture.gw, cutoffSeason, cutoffGw)) {
      continue;
    }

    const homePerf = perfMap.get(`${fixture.season}:${fixture.gw}:${fixture.home_team_id}`) ?? {
      profit: 0,
      spins: 0,
      entryCount: 0,
    };
    const awayPerf = perfMap.get(`${fixture.season}:${fixture.gw}:${fixture.away_team_id}`) ?? {
      profit: 0,
      spins: 0,
      entryCount: 0,
    };
    if (homePerf.entryCount === 0 && awayPerf.entryCount === 0) {
      continue;
    }

    const home = statMap.get(fixture.home_team_id);
    const away = statMap.get(fixture.away_team_id);
    if (!home || !away) {
      continue;
    }

    totalProfitMap.set(fixture.home_team_id, (totalProfitMap.get(fixture.home_team_id) ?? 0) + homePerf.profit);
    totalProfitMap.set(fixture.away_team_id, (totalProfitMap.get(fixture.away_team_id) ?? 0) + awayPerf.profit);
    totalSpinsMap.set(fixture.home_team_id, (totalSpinsMap.get(fixture.home_team_id) ?? 0) + homePerf.spins);
    totalSpinsMap.set(fixture.away_team_id, (totalSpinsMap.get(fixture.away_team_id) ?? 0) + awayPerf.spins);

    home.played += 1;
    away.played += 1;

    if (homePerf.profit > awayPerf.profit) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (awayPerf.profit > homePerf.profit) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const baseRows: AllTimeLeagueRow[] = teams.map((team) => {
    const stats = statMap.get(team.team_id) ?? { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
    return {
      teamId: team.team_id,
      teamName: team.team_name,
      ballColor: team.ball_color,
      ringColor: team.ring_color,
      textColor: team.text_color,
      played: stats.played,
      wins: stats.wins,
      draws: stats.draws,
      losses: stats.losses,
      points: stats.points,
      profit: Number((totalProfitMap.get(team.team_id) ?? 0).toFixed(2)),
      spins: totalSpinsMap.get(team.team_id) ?? 0,
      rank: 0,
    };
  });

  const rankRows = (rows: AllTimeLeagueRow[], sorter: (a: AllTimeLeagueRow, b: AllTimeLeagueRow) => number): AllTimeLeagueRow[] =>
    rows
      .slice()
      .sort(sorter)
      .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    fromSeason: 'S1',
    fromGw: 'GW1',
    toSeason: cutoffSeason,
    toGw: cutoffGw,
    pointsTable: rankRows(
      baseRows,
      (a, b) => b.points - a.points || b.profit - a.profit || b.spins - a.spins || b.wins - a.wins || a.teamName.localeCompare(b.teamName),
    ),
    spinsTable: rankRows(
      baseRows,
      (a, b) => b.spins - a.spins || b.points - a.points || b.profit - a.profit || b.wins - a.wins || a.teamName.localeCompare(b.teamName),
    ),
    profitTable: rankRows(
      baseRows,
      (a, b) => b.profit - a.profit || b.points - a.points || b.spins - a.spins || b.wins - a.wins || a.teamName.localeCompare(b.teamName),
    ),
  };
}

function backfillSeasonFiveExpansionAllTimeCarryover(db: Database.Database): void {
  const expansionTeamIds = seasonFiveExpansionTeamIds(db);
  if (expansionTeamIds.length === 0) {
    return;
  }

  const existing = readSeasonFiveExpansionCarryover(db, 'alltime');
  const hasAllExpansionTeams = expansionTeamIds.every((teamId) => existing.has(teamId));
  if (hasAllExpansionTeams && !carryoverIsAllZero(existing)) {
    return;
  }

  const previousSeason = 'S4' as SeasonId;
  const previousAllTime = getAllTimeLeagues(db, previousSeason, 'GW8');
  const bottomPoints = previousAllTime.pointsTable[previousAllTime.pointsTable.length - 1] ?? null;
  const bottomProfit = previousAllTime.profitTable[previousAllTime.profitTable.length - 1] ?? null;
  const bottomSpins = previousAllTime.spinsTable[previousAllTime.spinsTable.length - 1] ?? null;
  if (!bottomPoints) {
    return;
  }

  const seededValue = normalizeCarryoverStats({
    played: bottomPoints.played,
    wins: bottomPoints.wins,
    draws: bottomPoints.draws,
    losses: bottomPoints.losses,
    points: bottomPoints.points,
    profit: bottomProfit?.profit ?? bottomPoints.profit,
    spins: bottomSpins?.spins ?? bottomPoints.spins,
  });

  const nextValues: Record<number, CarryoverStats> = {};
  expansionTeamIds.forEach((teamId) => {
    nextValues[teamId] = seededValue;
  });
  saveSeasonFiveExpansionCarryover(db, 'alltime', nextValues);
}

function ensureGw8Fixtures(db: Database.Database, season: SeasonId): number {
  const table = getLeagueTable(db, season, 'GW7');
  const playoffPairs: Array<{ upperTeamId: number; lowerTeamId: number; upperDivision: DivisionName; lowerDivision: DivisionName }> = [];
  const divisionOrder = getDivisionOrderForSeason(season);

  for (let i = 0; i < divisionOrder.length - 1; i += 1) {
    const upper = divisionOrder[i];
    const lower = divisionOrder[i + 1];
    const upperRows = table[upper] ?? [];
    const lowerRows = table[lower] ?? [];
    if (upperRows[2] && lowerRows[1]) {
      playoffPairs.push({
        upperTeamId: upperRows[2].teamId,
        lowerTeamId: lowerRows[1].teamId,
        upperDivision: upper,
        lowerDivision: lower,
      });
    }
  }

  const playoffTeamIds = new Set(playoffPairs.flatMap((pair) => [pair.upperTeamId, pair.lowerTeamId]));
  const allTeams = db
    .prepare('SELECT team_id FROM season_teams WHERE season = ? ORDER BY team_id')
    .all(season) as Array<{ team_id: number }>;
  const friendlyPool = allTeams.map((row) => row.team_id).filter((id) => !playoffTeamIds.has(id));
  const existingFixtures = db
    .prepare('SELECT id, division, home_team_id, away_team_id FROM league_fixtures WHERE season = ? AND gw = ? ORDER BY id')
    .all(season, 'GW8') as Array<{ id: number; division: string; home_team_id: number; away_team_id: number }>;
  if (existingFixtures.length > 0) {
    const pairKey = (left: number, right: number) => (left < right ? `${left}:${right}` : `${right}:${left}`);
    const expectedPlayoffKeys = new Set(playoffPairs.map((pair) => pairKey(pair.upperTeamId, pair.lowerTeamId)));
    const existingPlayoffFixtures = existingFixtures.filter((fixture) => fixture.division === 'Playoff');
    const existingFriendlyFixtures = existingFixtures.filter((fixture) => fixture.division === 'Friendly');
    const existingFriendlyTeamIds = existingFriendlyFixtures.flatMap((fixture) => [fixture.home_team_id, fixture.away_team_id]);
    const existingPlayoffKeys = new Set(existingPlayoffFixtures.map((fixture) => pairKey(fixture.home_team_id, fixture.away_team_id)));
    const hasInvalidDivision = existingFixtures.some((fixture) => fixture.division !== 'Playoff' && fixture.division !== 'Friendly');
    const hasPlayoffTeamInFriendly = existingFriendlyTeamIds.some((teamId) => playoffTeamIds.has(teamId));
    const friendlyPoolSet = new Set(friendlyPool);
    const existingFriendlySet = new Set(existingFriendlyTeamIds);
    const validPlayoffs =
      existingPlayoffFixtures.length === playoffPairs.length
      && existingPlayoffKeys.size === expectedPlayoffKeys.size
      && Array.from(expectedPlayoffKeys).every((key) => existingPlayoffKeys.has(key));
    const validFriendlies =
      existingFriendlyFixtures.length === Math.floor(friendlyPool.length / 2)
      && existingFriendlyTeamIds.length === friendlyPool.length
      && existingFriendlySet.size === friendlyPool.length
      && Array.from(friendlyPoolSet).every((teamId) => existingFriendlySet.has(teamId))
      && !hasPlayoffTeamInFriendly;
    if (!hasInvalidDivision && validPlayoffs && validFriendlies) {
      setGw8Locked(db, season, true);
      return existingFixtures.length;
    }

    const resetTx = db.transaction(() => {
      db.prepare('DELETE FROM gw8_playoff_penalties WHERE season = ?').run(season);
      db.prepare('DELETE FROM trio_playoff_penalties WHERE season = ?').run(season);
      db.prepare("DELETE FROM league_fixtures WHERE season = ? AND gw = 'GW8'").run(season);
    });
    resetTx();
  }

  const shuffled = shuffle(friendlyPool);

  const insert = db.prepare(
    'INSERT INTO league_fixtures (season, gw, division, home_team_id, away_team_id) VALUES (?, ?, ?, ?, ?)',
  );
  let created = 0;
  const tx = db.transaction(() => {
    playoffPairs.forEach((pair) => {
      insert.run(season, 'GW8', 'Playoff', pair.upperTeamId, pair.lowerTeamId);
      created += 1;
    });
    for (let i = 0; i < shuffled.length; i += 2) {
      const home = shuffled[i];
      const away = shuffled[i + 1];
      if (!home || !away) {
        continue;
      }
      insert.run(season, 'GW8', 'Friendly', home, away);
      created += 1;
    }
  });
  tx();

  setGw8Locked(db, season, true);
  return created;
}

function ensureSettings(db: Database.Database): void {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insert.run('current_season', 'S1');
  insert.run('current_gw', 'GW1');
  insert.run('cup_tie_break_mode', 'lower_team_id');
}

function ensureTeams(db: Database.Database): string | null {
  const teamCount = db.prepare('SELECT COUNT(*) as c FROM teams').get() as { c: number };
  if (teamCount.c > 0) {
    return null;
  }

  const seedTeams = readTeamSeedFile() ?? DEFAULT_TEAMS;
  const insert = db.prepare('INSERT INTO teams (team_id, name, url, ball_color, ring_color, text_color, preseason_favorite) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const transaction = db.transaction(() => {
    for (const team of seedTeams) {
      const preseasonFavorite = 'preseasonFavorite' in team && team.preseasonFavorite === true;
      insert.run(
        team.teamId,
        team.name,
        team.url,
        team.ballColor ?? null,
        team.ringColor ?? null,
        team.textColor ?? null,
        preseasonFavorite ? 1 : 0,
      );
    }
  });
  transaction();

  return null;
}

function getCurrentState(db: Database.Database): CurrentState {
  const settings = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const map = new Map(settings.map((row) => [row.key, row.value]));
  return {
    currentSeason: (map.get('current_season') ?? 'S1') as SeasonId,
    currentGw: (map.get('current_gw') ?? 'GW1') as CurrentState['currentGw'],
  };
}

function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run(key, value);
}

function getCupTieBreakMode(db: Database.Database): CupTieBreakMode {
  const value = getSetting(db, 'cup_tie_break_mode');
  return value === 'random' ? 'random' : 'lower_team_id';
}

export function setCupTieBreakMode(db: Database.Database, mode: CupTieBreakMode): CupTieBreakMode {
  setSetting(db, 'cup_tie_break_mode', mode);
  return mode;
}

export function setCurrentState(db: Database.Database, season: SeasonId, gw: string): void {
  const update = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
  update.run(season, 'current_season');
  update.run(gw, 'current_gw');
}

function gwLockKey(season: SeasonId, gw: string): string {
  return `gw_locked_${season}_${gw}`;
}

export function isGameweekLocked(db: Database.Database, season: SeasonId, gw: string): boolean {
  return getSetting(db, gwLockKey(season, gw)) === '1';
}

export function setGameweekLock(db: Database.Database, season: SeasonId, gw: string, locked: boolean): void {
  setSetting(db, gwLockKey(season, gw), locked ? '1' : '0');
}

function clearGameweekLocksFrom(db: Database.Database, season: SeasonId, fromGw: string): void {
  const minGwIndex = gwIndex(fromGw);
  if (minGwIndex < 0) {
    return;
  }
  GAMEWEEKS.forEach((gw) => {
    if (gwIndex(gw) >= minGwIndex) {
      setGameweekLock(db, season, gw, false);
    }
  });
  setGw8Locked(db, season, false);
}

export function lockGameweekWithSnapshot(db: Database.Database, state: CurrentState, label = 'safe_lock'): void {
  setGameweekLock(db, state.currentSeason, state.currentGw, true);
  captureGwSnapshot(db, state.currentSeason, state.currentGw, label);
}

function gw8LockKey(season: SeasonId): string {
  return `gw8_locked_${season}`;
}

function isGw8Locked(db: Database.Database, season: SeasonId): boolean {
  return getSetting(db, gw8LockKey(season)) === '1';
}

function setGw8Locked(db: Database.Database, season: SeasonId, locked: boolean): void {
  setSetting(db, gw8LockKey(season), locked ? '1' : '0');
}

type SeasonFinalePayload = {
  season: SeasonId;
  leagueWinners: Array<{ division: DivisionName; teamId: number; teamName: string }>;
  divisionTables: Record<DivisionName, Array<{
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
  }>>;
  masterLeague: {
    winner: { teamId: number; teamName: string } | null;
    table: Array<{
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
    }>;
  } | null;
  trioLeague: {
    enabled: boolean;
    table: Array<{
      division: TrioDivisionName;
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
    }>;
  } | null;
  tierLeague: {
    enabled: boolean;
    started: boolean;
    table: Array<{
      division: TierLeagueDivisionName;
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
    }>;
  } | null;
  bestProfits: {
    overall: { teamId: number; teamName: string; profit: number } | null;
    byDivision: Array<{ division: DivisionName; teamId: number; teamName: string; profit: number }>;
  };
  promotions: Array<{ teamId: number; teamName: string; from: DivisionName; to: DivisionName }>;
  relegations: Array<{ teamId: number; teamName: string; from: DivisionName; to: DivisionName }>;
  playoffResults: Array<{
    upperTeamId: number;
    upperTeamName: string;
    lowerTeamId: number;
    lowerTeamName: string;
    upperDivision: DivisionName;
    lowerDivision: DivisionName;
    winnerTeamId: number | null;
    winnerTeamName: string | null;
    swapped: boolean;
  }>;
  cupWinner: { teamId: number; teamName: string } | null;
  superCup: {
    sourceSeason: SeasonId;
    pairingReason: SuperCupPairingReason;
    pairingExplanation: string;
    winner: { teamId: number; teamName: string } | null;
    runnerUp: { teamId: number; teamName: string } | null;
  } | null;
  standout: Array<{ label: string; value: string }>;
  goalsOfSeason: Array<{ division: DivisionName; teamId: number; teamName: string; profit: number }>;
  bookieBallCup: {
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
      result: 'home' | 'away' | 'draw' | 'pending';
      decidedBy: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending';
    } | null;
  } | null;
  masterCup: {
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
      result: 'home' | 'away' | 'draw' | 'pending';
      decidedBy: 'profit' | 'spins' | 'penalties' | 'aggregate_profit' | 'aggregate_spins' | 'aggregate_penalties' | 'pending';
    } | null;
  } | null;
  upcomingSuperCup: {
    season: SeasonId;
    sourceSeason: SeasonId;
    pairingReason: SuperCupPairingReason;
    pairingExplanation: string;
    homeTeamId: number;
    awayTeamId: number;
    homeTeam: string;
    awayTeam: string;
  } | null;
  bookieDor: {
    weights: BookieDorWeights;
    winner: {
      teamId: number;
      teamName: string;
      division: DivisionName;
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
      division: DivisionName;
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

function buildSeasonFinaleCompetitionSummaries(
  db: Database.Database,
  season: SeasonId,
  nextSeasonId: SeasonId,
  divisionTable: ReturnType<typeof getLeagueTable>,
): Pick<
  SeasonFinalePayload,
  'divisionTables' | 'masterLeague' | 'trioLeague' | 'tierLeague' | 'bookieBallCup' | 'masterCup' | 'upcomingSuperCup'
> {
  const teamRows = db.prepare('SELECT id, name FROM teams').all() as Array<{ id: number; name: string }>;
  const teamNameMap = new Map(teamRows.map((row) => [row.id, row.name]));

  const divisionTables = Object.fromEntries(
    Object.entries(divisionTable).map(([division, rows]) => [
      division,
      rows.map((row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        points: row.points,
        profit: row.profit,
        spins: row.spins,
        rank: row.rank,
      })),
    ]),
  ) as SeasonFinalePayload['divisionTables'];

  const masterLeagueTable = getMasterLeagueTable(db, season, 'GW8');
  const masterLeague = {
    winner: masterLeagueTable[0]
      ? { teamId: masterLeagueTable[0].teamId, teamName: masterLeagueTable[0].teamName }
      : null,
    table: masterLeagueTable.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      points: row.points,
      profit: row.profit,
      spins: row.spins,
      rank: row.rank,
    })),
  } satisfies NonNullable<SeasonFinalePayload['masterLeague']>;

  const trioLeague = isSeasonFiveOrLater(season)
    ? {
        enabled: true,
        table: getTrioLeagueTable(db, season, 'GW8').map((row) => ({
          division: row.division,
          teamId: row.teamId,
          teamName: row.teamName,
          played: row.played,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
          points: row.points,
          profit: row.profit,
          spins: row.spins,
          rank: row.rank,
        })),
      } satisfies NonNullable<SeasonFinalePayload['trioLeague']>
    : null;

  const tierLeague = isSeasonSixOrLater(season)
    ? {
        enabled: true,
        started: true,
        table: getTierLeagueTable(db, season, 'GW8').map((row) => ({
          division: row.division,
          teamId: row.teamId,
          teamName: row.teamName,
          played: row.played,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
          points: row.points,
          profit: row.profit,
          spins: row.spins,
          rank: row.rank,
        })),
      } satisfies NonNullable<SeasonFinalePayload['tierLeague']>
    : null;

  const bookieBallCupFinal = getCupBracket(db, season, 'GW6').find((row) => row.gw === 'GW6') ?? null;
  const bookieBallCup = bookieBallCupFinal
    ? {
        winner: bookieBallCupFinal.winnerTeam
          ? {
              teamId: teamRows.find((row) => row.name === bookieBallCupFinal.winnerTeam)?.id ?? 0,
              teamName: bookieBallCupFinal.winnerTeam,
            }
          : null,
        runnerUp: (() => {
          if (!bookieBallCupFinal.winnerTeam) {
            return null;
          }
          const runnerUpName = bookieBallCupFinal.winnerTeam === bookieBallCupFinal.homeTeam
            ? bookieBallCupFinal.awayTeam
            : bookieBallCupFinal.homeTeam;
          if (!runnerUpName) {
            return null;
          }
          return {
            teamId: teamRows.find((row) => row.name === runnerUpName)?.id ?? 0,
            teamName: runnerUpName,
          };
        })(),
        final: {
          homeTeam: bookieBallCupFinal.homeTeam,
          awayTeam: bookieBallCupFinal.awayTeam,
          winnerTeam: bookieBallCupFinal.winnerTeam,
          homeProfit: bookieBallCupFinal.homeProfit,
          awayProfit: bookieBallCupFinal.awayProfit,
          homeSpins: bookieBallCupFinal.homeSpins,
          awaySpins: bookieBallCupFinal.awaySpins,
          played: bookieBallCupFinal.played,
          result: bookieBallCupFinal.result,
          decidedBy: bookieBallCupFinal.decidedBy,
        },
      } satisfies NonNullable<SeasonFinalePayload['bookieBallCup']>
    : null;

  const masterCupFinal = isSeasonFiveOrLater(season)
    ? getMasterCupFixtures(db, season).find((row) => row.stage === 'final') ?? null
    : null;
  const masterCup = masterCupFinal
    ? {
        winner: masterCupFinal.winnerTeamId && masterCupFinal.winnerTeam
          ? { teamId: masterCupFinal.winnerTeamId, teamName: masterCupFinal.winnerTeam }
          : null,
        runnerUp: (() => {
          if (!masterCupFinal.winnerTeamId || !masterCupFinal.homeTeamId || !masterCupFinal.awayTeamId) {
            return null;
          }
          const runnerUpTeamId = masterCupFinal.winnerTeamId === masterCupFinal.homeTeamId
            ? masterCupFinal.awayTeamId
            : masterCupFinal.homeTeamId;
          const runnerUpTeamName = runnerUpTeamId === masterCupFinal.homeTeamId
            ? masterCupFinal.homeTeam
            : masterCupFinal.awayTeam;
          return runnerUpTeamName
            ? { teamId: runnerUpTeamId, teamName: runnerUpTeamName }
            : null;
        })(),
        final: {
          homeTeam: masterCupFinal.homeTeam,
          awayTeam: masterCupFinal.awayTeam,
          winnerTeam: masterCupFinal.winnerTeam,
          homeProfit: masterCupFinal.homeProfit,
          awayProfit: masterCupFinal.awayProfit,
          homeSpins: masterCupFinal.homeSpins,
          awaySpins: masterCupFinal.awaySpins,
          played: masterCupFinal.played,
          result: masterCupFinal.result,
          decidedBy: masterCupFinal.decidedBy,
        },
      } satisfies NonNullable<SeasonFinalePayload['masterCup']>
    : null;

  ensureSuperCupFixture(db, nextSeasonId);
  const upcomingSuperCupFixture = getSuperCupFixtures(db, nextSeasonId)[0] ?? null;
  const upcomingSuperCup = upcomingSuperCupFixture
    ? {
        season: nextSeasonId,
        sourceSeason: upcomingSuperCupFixture.sourceSeason,
        pairingReason: upcomingSuperCupFixture.pairingReason,
        pairingExplanation: upcomingSuperCupFixture.pairingExplanation,
        homeTeamId: upcomingSuperCupFixture.homeTeamId,
        awayTeamId: upcomingSuperCupFixture.awayTeamId,
        homeTeam: upcomingSuperCupFixture.homeTeam,
        awayTeam: upcomingSuperCupFixture.awayTeam,
      } satisfies NonNullable<SeasonFinalePayload['upcomingSuperCup']>
    : null;

  return {
    divisionTables,
    masterLeague,
    trioLeague,
    tierLeague,
    bookieBallCup,
    masterCup,
    upcomingSuperCup,
  };
}

function seasonFinaleKey(season: SeasonId): string {
  return `season_finale_${season}`;
}

function setSeasonFinale(db: Database.Database, season: SeasonId, payload: SeasonFinalePayload): void {
  setSetting(db, seasonFinaleKey(season), JSON.stringify(payload));
}

function getSeasonFinale(db: Database.Database, season: SeasonId): SeasonFinalePayload | null {
  const raw = getSetting(db, seasonFinaleKey(season));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SeasonFinalePayload;
  } catch {
    return null;
  }
}

function setSeasonFinalePending(db: Database.Database, season: SeasonId | null): void {
  if (!season) {
    setSetting(db, 'season_finale_pending', '');
    return;
  }
  setSetting(db, 'season_finale_pending', season);
}

function getSeasonFinalePending(db: Database.Database): SeasonId | null {
  const value = getSetting(db, 'season_finale_pending');
  if (!value) {
    return null;
  }
  return value as SeasonId;
}

function getTeamGwPerformance(
  db: Database.Database,
  season: SeasonId,
  gw: string,
  teamId: number,
): { profit: number; wins: number; spins: number } {
  const row = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(profit), 0) AS profit,
        COALESCE(SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END), 0) AS wins,
        COALESCE(SUM(spins), 0) AS spins
      FROM entries
      WHERE season = ? AND gw = ? AND team_id = ?
      `,
    )
    .get(season, gw, teamId) as { profit: number; wins: number; spins: number };

  return row;
}

export type BookieDorWeights = {
  league: number;
  cup: number;
  master: number;
  consistency: number;
};

const BOOKIE_DOR_WEIGHTS: BookieDorWeights = Object.freeze({
  league: 0.5,
  cup: 0,
  master: 0.25,
  consistency: 0.25,
});

const BOOKIE_DOR_DIVISION_TITLE_BASE = 12;
const BOOKIE_DOR_DIVISION_TITLE_STEP = 6;
const BOOKIE_DOR_TRIO_TITLE_BASE = 10;
const BOOKIE_DOR_TRIO_TITLE_STEP = 4;
const BOOKIE_DOR_TIER_TITLE_BASE = 6;
const BOOKIE_DOR_TIER_TITLE_STEP = 2;
const BOOKIE_DOR_MASTER_LEAGUE_MAX_POINTS = 28;
const BOOKIE_DOR_MIN_PLACEMENT_MULTIPLIER = 0.12;
const BOOKIE_DOR_MAIN_CUP_UPSET_BONUS_PER_DIVISION = 1.5;
const BOOKIE_DOR_MASTER_CUP_UPSET_BONUS_PER_DIVISION = 1;

const BOOKIE_DOR_MAIN_CUP_WIN_POINTS: Record<string, number> = Object.freeze({
  'Round of 32': 1,
  'Round of 16': 2,
  Quarterfinal: 3,
  Semifinal: 5,
  Final: 8,
});

const BOOKIE_DOR_MASTER_CUP_WIN_POINTS: Record<MasterCupStage, number> = Object.freeze({
  round_of_16: 1,
  quarter_final: 2,
  semi_final: 4,
  third_place_playoff: 2,
  final: 6,
});

const CUP_ROUND_INDEX: Record<string, number> = {
  GW2: 1,
  GW3: 2,
  GW4: 3,
  GW5: 4,
  GW6: 5,
};

const CUP_ROUND_LABEL: Record<number, string> = {
  1: 'Round of 32',
  2: 'Round of 16',
  3: 'Quarterfinal',
  4: 'Semifinal',
  5: 'Final',
};

type BookieDorScore = {
  teamId: number;
  teamName: string;
  division: DivisionName;
  leagueRank: number;
  leagueScore: number;
  cupScore: number;
  masterScore: number;
  consistencyScore: number;
  weightedLeagueScore: number;
  weightedCupScore: number;
  weightedMasterScore: number;
  weightedConsistencyScore: number;
  cupFinish: string;
  totalScore: number;
};

function computeGoalsOfSeason(db: Database.Database, season: SeasonId): Array<{
  division: DivisionName;
  teamId: number;
  teamName: string;
  profit: number;
}> {
  const divisionOrder = getDivisionOrderForSeason(season);
  return divisionOrder
    .map((division) => {
      const best = db
        .prepare(
          `
          SELECT t.id AS team_id, t.name AS team_name, MAX(e.profit) AS best_profit
          FROM entries e
          INNER JOIN season_teams st ON st.team_id = e.team_id AND st.season = e.season
          INNER JOIN teams t ON t.id = e.team_id
          WHERE e.season = ? AND st.division = ?
          GROUP BY e.team_id
          ORDER BY best_profit DESC, e.team_id ASC
          LIMIT 1
          `,
        )
        .get(season, division) as { team_id: number; team_name: string; best_profit: number } | undefined;
      if (!best) {
        return null;
      }
      return { division, teamId: best.team_id, teamName: best.team_name, profit: best.best_profit };
    })
    .filter((row): row is { division: DivisionName; teamId: number; teamName: string; profit: number } => !!row);
}

// Bookie d'Or model inputs:
// all live season competitions: divisions, cups, master league, trio league, and tier league.
function getCupPerformanceByTeam(
  db: Database.Database,
  season: SeasonId,
): Map<number, { roundReached: number; isWinner: boolean; isRunnerUp: boolean }> {
  const fixtures = db
    .prepare('SELECT gw, home_team_id, away_team_id, winner_team_id FROM cup_fixtures WHERE season = ?')
    .all(season) as Array<{ gw: string; home_team_id: number | null; away_team_id: number | null; winner_team_id: number | null }>;

  const performance = new Map<number, { roundReached: number; isWinner: boolean; isRunnerUp: boolean }>();

  const ensure = (teamId: number) => {
    if (!performance.has(teamId)) {
      performance.set(teamId, { roundReached: 0, isWinner: false, isRunnerUp: false });
    }
    return performance.get(teamId)!;
  };

  fixtures.forEach((fixture) => {
    const round = CUP_ROUND_INDEX[fixture.gw] ?? 0;
    if (!round) {
      return;
    }
    if (fixture.home_team_id) {
      const entry = ensure(fixture.home_team_id);
      entry.roundReached = Math.max(entry.roundReached, round);
    }
    if (fixture.away_team_id) {
      const entry = ensure(fixture.away_team_id);
      entry.roundReached = Math.max(entry.roundReached, round);
    }
  });

  const finalFixture = fixtures.find((fixture) => fixture.gw === 'GW6' && fixture.home_team_id && fixture.away_team_id);
  if (finalFixture && finalFixture.home_team_id && finalFixture.away_team_id) {
    const winnerId = finalFixture.winner_team_id;
    if (winnerId) {
      const runnerUpId = winnerId === finalFixture.home_team_id ? finalFixture.away_team_id : finalFixture.home_team_id;
      const winner = ensure(winnerId);
      winner.isWinner = true;
      const runnerUp = ensure(runnerUpId);
      runnerUp.isRunnerUp = true;
    }
  }

  return performance;
}

function percentileFromRank(rank: number, size: number): number {
  if (size <= 1) {
    return 1;
  }
  return (size - rank) / (size - 1);
}

function toBookieDorSeasonKey(season: SeasonId): number {
  const parsed = parseSeasonNumber(season);
  return Number.isFinite(parsed) ? parsed : 1;
}

function getBookieDorConsistencyByTeam(
  db: Database.Database,
  season: SeasonId,
  teamIds: number[],
): Map<number, number> {
  if (teamIds.length === 0) {
    return new Map();
  }
  const seasonKey = toBookieDorSeasonKey(season);
  const rows = db
    .prepare(
      `
      SELECT
        t.id AS team_id,
        COALESCE(COUNT(e.id), 0) AS entries,
        COALESCE(SUM(CASE WHEN e.profit > 0 THEN 1 ELSE 0 END), 0) AS wins,
        COALESCE(SUM(e.profit), 0) AS profit
      FROM teams t
      LEFT JOIN entries e
        ON e.team_id = t.id
       AND CAST(SUBSTR(e.season, 2) AS INTEGER) <= ?
      WHERE t.id IN (${teamIds.map(() => '?').join(', ')})
      GROUP BY t.id
      `,
    )
    .all(seasonKey, ...teamIds) as Array<{
    team_id: number;
    entries: number;
    wins: number;
    profit: number;
  }>;

  const sortedByWinRate = rows
    .slice()
    .sort((a, b) => {
      const aRate = a.entries > 0 ? a.wins / a.entries : 0;
      const bRate = b.entries > 0 ? b.wins / b.entries : 0;
      return bRate - aRate || b.entries - a.entries || b.profit - a.profit || a.team_id - b.team_id;
    });
  const sortedByAverageProfit = rows
    .slice()
    .sort((a, b) => {
      const aAvg = a.entries > 0 ? a.profit / a.entries : 0;
      const bAvg = b.entries > 0 ? b.profit / b.entries : 0;
      return bAvg - aAvg || b.profit - a.profit || b.entries - a.entries || a.team_id - b.team_id;
    });

  const winRateRank = new Map<number, number>();
  const avgProfitRank = new Map<number, number>();
  sortedByWinRate.forEach((row, idx) => winRateRank.set(row.team_id, idx + 1));
  sortedByAverageProfit.forEach((row, idx) => avgProfitRank.set(row.team_id, idx + 1));

  const size = rows.length;
  const output = new Map<number, number>();
  rows.forEach((row) => {
    const winRank = winRateRank.get(row.team_id) ?? size;
    const avgRank = avgProfitRank.get(row.team_id) ?? size;
    const winPercentile = percentileFromRank(winRank, size);
    const avgPercentile = percentileFromRank(avgRank, size);
    const reliability = Math.max(0, Math.min(1, row.entries / 40));
    output.set(row.team_id, (winPercentile * 55) + (avgPercentile * 35) + (reliability * 10));
  });

  return output;
}

function addBookieDorPoints(pointsByTeam: Map<number, number>, teamId: number | null | undefined, points: number): void {
  if (!teamId || points === 0) {
    return;
  }
  pointsByTeam.set(teamId, Number(((pointsByTeam.get(teamId) ?? 0) + points).toFixed(2)));
}

function bookieDorPlacementMultiplier(rank: number, size: number, minimum = BOOKIE_DOR_MIN_PLACEMENT_MULTIPLIER): number {
  if (size <= 1) {
    return 1;
  }
  const boundedRank = Math.max(1, Math.min(rank, size));
  const progress = (boundedRank - 1) / (size - 1);
  return 1 - (progress * (1 - minimum));
}

function bookieDorRankPoints(rank: number, size: number, maxPoints: number, minimum = BOOKIE_DOR_MIN_PLACEMENT_MULTIPLIER): number {
  return Number((maxPoints * bookieDorPlacementMultiplier(rank, size, minimum)).toFixed(2));
}

function bookieDorDivisionTitlePoints(divisionIndex: number, divisionCount: number): number {
  return BOOKIE_DOR_DIVISION_TITLE_BASE + ((divisionCount - divisionIndex - 1) * BOOKIE_DOR_DIVISION_TITLE_STEP);
}

function bookieDorTrioTitlePoints(divisionIndex: number): number {
  return BOOKIE_DOR_TRIO_TITLE_BASE + ((TRIO_DIVISION_ORDER.length - divisionIndex - 1) * BOOKIE_DOR_TRIO_TITLE_STEP);
}

function bookieDorTierTitlePoints(divisionIndex: number): number {
  return BOOKIE_DOR_TIER_TITLE_BASE + ((TIER_LEAGUE_DIVISION_ORDER.length - divisionIndex - 1) * BOOKIE_DOR_TIER_TITLE_STEP);
}

function setBookieDorCupLabel(labelsByTeam: Map<number, string>, teamId: number | null | undefined, label: string): void {
  if (!teamId || labelsByTeam.has(teamId)) {
    return;
  }
  labelsByTeam.set(teamId, label);
}

function bookieDorMainCupAppearanceLabel(roundName: string): string {
  if (roundName === 'Final') {
    return 'BookieBall Cup finalist';
  }
  if (roundName === 'Semifinal') {
    return 'BookieBall Cup semi-finalist';
  }
  if (roundName === 'Quarterfinal') {
    return 'BookieBall Cup quarter-finalist';
  }
  if (roundName === 'Round of 16') {
    return 'BookieBall Cup round-of-16';
  }
  return 'BookieBall Cup participant';
}

function bookieDorMainCupRoundOrder(roundName: string): number {
  if (roundName === 'Final') {
    return 5;
  }
  if (roundName === 'Semifinal') {
    return 4;
  }
  if (roundName === 'Quarterfinal') {
    return 3;
  }
  if (roundName === 'Round of 16') {
    return 2;
  }
  return 1;
}

function bookieDorMasterCupAppearanceLabel(stage: MasterCupStage): string {
  if (stage === 'final') {
    return 'Master Cup finalist';
  }
  if (stage === 'third_place_playoff') {
    return 'Master Cup third-place play-off';
  }
  if (stage === 'semi_final') {
    return 'Master Cup semi-finalist';
  }
  if (stage === 'quarter_final') {
    return 'Master Cup quarter-finalist';
  }
  return 'Master Cup round-of-16';
}

function bookieDorMasterCupStageOrder(stage: MasterCupStage): number {
  if (stage === 'final') {
    return 5;
  }
  if (stage === 'third_place_playoff') {
    return 4;
  }
  if (stage === 'semi_final') {
    return 3;
  }
  if (stage === 'quarter_final') {
    return 2;
  }
  return 1;
}

function getBookieDorCupData(
  db: Database.Database,
  season: SeasonId,
  gw: string,
  divisionIndexByTeam: Map<number, number>,
): { pointsByTeam: Map<number, number>; summaryByTeam: Map<number, string> } {
  const pointsByTeam = new Map<number, number>();
  const mainCupLabels = new Map<number, string>();
  const masterCupLabels = new Map<number, string>();
  const mainCupStageByTeam = new Map<number, number>();
  const masterCupStageByTeam = new Map<number, number>();
  const cappedGwIndex = gwIndex(gw);

  const mainCupFixtures = db
    .prepare(
      `
      SELECT id, gw, round_name, home_team_id, away_team_id
      FROM cup_fixtures
      WHERE season = ?
      ORDER BY id
      `,
    )
    .all(season) as Array<{
    id: number;
    gw: string;
    round_name: string;
    home_team_id: number | null;
    away_team_id: number | null;
  }>;

  mainCupFixtures
    .filter((fixture) => gwIndex(fixture.gw) <= cappedGwIndex)
    .forEach((fixture) => {
      const roundOrder = bookieDorMainCupRoundOrder(fixture.round_name);
      if (fixture.home_team_id) {
        mainCupStageByTeam.set(
          fixture.home_team_id,
          Math.max(mainCupStageByTeam.get(fixture.home_team_id) ?? 0, roundOrder),
        );
      }
      if (fixture.away_team_id) {
        mainCupStageByTeam.set(
          fixture.away_team_id,
          Math.max(mainCupStageByTeam.get(fixture.away_team_id) ?? 0, roundOrder),
        );
      }

      const winnerTeamId = resolveCupFixtureWinner(db, fixture.id);
      addBookieDorPoints(pointsByTeam, winnerTeamId, BOOKIE_DOR_MAIN_CUP_WIN_POINTS[fixture.round_name] ?? 0);

      if (winnerTeamId && fixture.round_name === 'Final') {
        const lowerDivisionBonus = (divisionIndexByTeam.get(winnerTeamId) ?? 0) * BOOKIE_DOR_MAIN_CUP_UPSET_BONUS_PER_DIVISION;
        addBookieDorPoints(pointsByTeam, winnerTeamId, lowerDivisionBonus);
        const runnerUpTeamId = winnerTeamId === fixture.home_team_id ? fixture.away_team_id : fixture.home_team_id;
        setBookieDorCupLabel(mainCupLabels, winnerTeamId, 'BookieBall Cup winner');
        setBookieDorCupLabel(mainCupLabels, runnerUpTeamId, 'BookieBall Cup runner-up');
      } else if (!winnerTeamId && fixture.round_name === 'Final') {
        setBookieDorCupLabel(mainCupLabels, fixture.home_team_id, 'BookieBall Cup finalist');
        setBookieDorCupLabel(mainCupLabels, fixture.away_team_id, 'BookieBall Cup finalist');
      } else if (winnerTeamId && fixture.round_name === 'Semifinal') {
        const losingTeamId = winnerTeamId === fixture.home_team_id ? fixture.away_team_id : fixture.home_team_id;
        setBookieDorCupLabel(mainCupLabels, losingTeamId, 'BookieBall Cup semi-finalist');
      } else if (winnerTeamId && fixture.round_name === 'Quarterfinal') {
        const losingTeamId = winnerTeamId === fixture.home_team_id ? fixture.away_team_id : fixture.home_team_id;
        setBookieDorCupLabel(mainCupLabels, losingTeamId, 'BookieBall Cup quarter-finalist');
      } else if (winnerTeamId && fixture.round_name === 'Round of 16') {
        const losingTeamId = winnerTeamId === fixture.home_team_id ? fixture.away_team_id : fixture.home_team_id;
        setBookieDorCupLabel(mainCupLabels, losingTeamId, 'BookieBall Cup round-of-16');
      }
    });

  if (isSeasonFiveOrLater(season)) {
    const masterCupUptoGw = gwIndex(gw) <= gwIndex('GW6') ? gw : 'GW6';
    loadMasterCupFixturesForRange(db, season, 'GW1', masterCupUptoGw);
    const masterCupFixtures = db
      .prepare(
        `
        SELECT id, gw, stage, leg_number, home_team_id, away_team_id
        FROM master_cup_fixtures
        WHERE season = ?
        ORDER BY id
        `,
      )
      .all(season) as Array<{
      id: number;
      gw: string;
      stage: MasterCupStage;
      leg_number: number;
      home_team_id: number | null;
      away_team_id: number | null;
    }>;

    masterCupFixtures
      .filter((fixture) =>
        gwIndex(fixture.gw) <= gwIndex(masterCupUptoGw)
        && (fixture.stage !== 'semi_final' || fixture.leg_number === 2))
      .forEach((fixture) => {
        const stageOrder = bookieDorMasterCupStageOrder(fixture.stage);
        if (fixture.home_team_id) {
          masterCupStageByTeam.set(
            fixture.home_team_id,
            Math.max(masterCupStageByTeam.get(fixture.home_team_id) ?? 0, stageOrder),
          );
        }
        if (fixture.away_team_id) {
          masterCupStageByTeam.set(
            fixture.away_team_id,
            Math.max(masterCupStageByTeam.get(fixture.away_team_id) ?? 0, stageOrder),
          );
        }

        const winnerTeamId = resolveMasterCupFixtureWinner(db, season, fixture.id);
        addBookieDorPoints(pointsByTeam, winnerTeamId, BOOKIE_DOR_MASTER_CUP_WIN_POINTS[fixture.stage] ?? 0);

        if (fixture.stage === 'final' && winnerTeamId) {
          const lowerDivisionBonus = (divisionIndexByTeam.get(winnerTeamId) ?? 0) * BOOKIE_DOR_MASTER_CUP_UPSET_BONUS_PER_DIVISION;
          addBookieDorPoints(pointsByTeam, winnerTeamId, lowerDivisionBonus);
          const runnerUpTeamId = winnerTeamId === fixture.home_team_id ? fixture.away_team_id : fixture.home_team_id;
          setBookieDorCupLabel(masterCupLabels, winnerTeamId, 'Master Cup winner');
          setBookieDorCupLabel(masterCupLabels, runnerUpTeamId, 'Master Cup runner-up');
        } else if (fixture.stage === 'final' && !winnerTeamId) {
          setBookieDorCupLabel(masterCupLabels, fixture.home_team_id, 'Master Cup finalist');
          setBookieDorCupLabel(masterCupLabels, fixture.away_team_id, 'Master Cup finalist');
        } else if (fixture.stage === 'third_place_playoff' && winnerTeamId) {
          const fourthPlaceTeamId = winnerTeamId === fixture.home_team_id ? fixture.away_team_id : fixture.home_team_id;
          setBookieDorCupLabel(masterCupLabels, winnerTeamId, 'Master Cup third-place winner');
          setBookieDorCupLabel(masterCupLabels, fourthPlaceTeamId, 'Master Cup fourth place');
        }
      });
  }

  mainCupStageByTeam.forEach((roundOrder, teamId) => {
    if (!mainCupLabels.has(teamId)) {
      const label = roundOrder >= 5
        ? 'BookieBall Cup finalist'
        : roundOrder >= 4
          ? 'BookieBall Cup semi-finalist'
          : roundOrder >= 3
            ? 'BookieBall Cup quarter-finalist'
            : roundOrder >= 2
              ? 'BookieBall Cup round-of-16'
              : 'BookieBall Cup participant';
      mainCupLabels.set(teamId, label);
    }
  });

  masterCupStageByTeam.forEach((stageOrder, teamId) => {
    if (!masterCupLabels.has(teamId)) {
      const label = stageOrder >= 5
        ? 'Master Cup finalist'
        : stageOrder >= 4
          ? 'Master Cup third-place play-off'
          : stageOrder >= 3
            ? 'Master Cup semi-finalist'
            : stageOrder >= 2
              ? 'Master Cup quarter-finalist'
              : 'Master Cup round-of-16';
      masterCupLabels.set(teamId, label);
    }
  });

  const summaryByTeam = new Map<number, string>();
  const teamIds = new Set<number>([
    ...divisionIndexByTeam.keys(),
    ...mainCupLabels.keys(),
    ...masterCupLabels.keys(),
    ...pointsByTeam.keys(),
  ]);
  teamIds.forEach((teamId) => {
    const labels = [mainCupLabels.get(teamId), masterCupLabels.get(teamId)].filter((value): value is string => Boolean(value));
    summaryByTeam.set(teamId, labels.length > 0 ? labels.join(' + ') : 'No cup run');
  });

  return { pointsByTeam, summaryByTeam };
}

function calculateBookieDorLeaderboard(
  db: Database.Database,
  season: SeasonId,
  table: Record<string, Array<{ teamId: number; teamName: string; division: string; played: number; points: number; profit: number; spins: number; rank: number }>>,
  gw: string,
): BookieDorScore[] {
  const normalizedGw = GAMEWEEKS.includes(gw as (typeof GAMEWEEKS)[number]) ? gw : 'GW8';
  loadMasterLeagueFixturesForRange(db, season, 'GW1', normalizedGw);
  if (isSeasonFiveOrLater(season)) {
    const masterCupGw = gwIndex(normalizedGw) <= gwIndex('GW6') ? normalizedGw : 'GW6';
    loadMasterCupFixturesForRange(db, season, 'GW1', masterCupGw);
  }
  const masterRows = getMasterLeagueTable(db, season, normalizedGw);
  const trioRows = isSeasonFiveOrLater(season) ? getTrioLeagueTable(db, season, normalizedGw) : [];
  const tierRows = isSeasonSixOrLater(season) && gwIndex(normalizedGw) >= gwIndex(getTierLeagueStartGwForSeason(season))
    ? getTierLeagueTable(db, season, normalizedGw)
    : [];
  const divisionOrder = getDivisionOrderForSeason(season);
  const divisionIndexByTeam = new Map<number, number>();
  const leaguePointsByTeam = new Map<number, number>();

  divisionOrder.forEach((division, divisionIndex) => {
    const rows = table[division] ?? [];
    const titlePoints = bookieDorDivisionTitlePoints(divisionIndex, divisionOrder.length);
    rows.forEach((row) => {
      divisionIndexByTeam.set(row.teamId, divisionIndex);
      leaguePointsByTeam.set(row.teamId, bookieDorRankPoints(row.rank, rows.length, titlePoints));
    });
  });

  const masterPointsByTeam = new Map<number, number>();
  masterRows.forEach((row) => {
    masterPointsByTeam.set(
      row.teamId,
      bookieDorRankPoints(row.rank, masterRows.length, BOOKIE_DOR_MASTER_LEAGUE_MAX_POINTS, 0.1),
    );
  });

  const consistencyPointsByTeam = new Map<number, number>();
  const trioRowsByDivision = new Map<string, typeof trioRows>();
  trioRows.forEach((row) => {
    const existing = trioRowsByDivision.get(row.division) ?? [];
    existing.push(row);
    trioRowsByDivision.set(row.division, existing);
  });
  trioRowsByDivision.forEach((rows, division) => {
    const divisionIndex = TRIO_DIVISION_ORDER.indexOf(division as TrioDivisionName);
    const titlePoints = bookieDorTrioTitlePoints(Math.max(divisionIndex, 0));
    rows
      .slice()
      .sort((a, b) => a.rank - b.rank || b.points - a.points || b.profit - a.profit || a.teamName.localeCompare(b.teamName))
      .forEach((row) => {
        addBookieDorPoints(consistencyPointsByTeam, row.teamId, bookieDorRankPoints(row.rank, rows.length, titlePoints));
      });
  });

  const tierRowsByDivision = new Map<string, typeof tierRows>();
  tierRows.forEach((row) => {
    const existing = tierRowsByDivision.get(row.division) ?? [];
    existing.push(row);
    tierRowsByDivision.set(row.division, existing);
  });
  tierRowsByDivision.forEach((rows, division) => {
    const divisionIndex = TIER_LEAGUE_DIVISION_ORDER.indexOf(division as TierLeagueDivisionName);
    const titlePoints = bookieDorTierTitlePoints(Math.max(divisionIndex, 0));
    rows
      .slice()
      .sort((a, b) => a.rank - b.rank || b.points - a.points || b.profit - a.profit || a.teamName.localeCompare(b.teamName))
      .forEach((row) => {
        addBookieDorPoints(consistencyPointsByTeam, row.teamId, bookieDorRankPoints(row.rank, rows.length, titlePoints));
      });
  });

  const cupData = getBookieDorCupData(db, season, normalizedGw, divisionIndexByTeam);
  const scores: BookieDorScore[] = [];

  divisionOrder.forEach((division) => {
    const rows = table[division] ?? [];
    rows.forEach((row) => {
      const leagueScore = leaguePointsByTeam.get(row.teamId) ?? 0;
      const cupScore = cupData.pointsByTeam.get(row.teamId) ?? 0;
      const masterScore = masterPointsByTeam.get(row.teamId) ?? 0;
      const consistencyScore = consistencyPointsByTeam.get(row.teamId) ?? 0;
      const weightedLeagueScore = leagueScore;
      const weightedCupScore = cupScore;
      const weightedMasterScore = masterScore;
      const weightedConsistencyScore = consistencyScore;
      const totalScore = leagueScore + cupScore + masterScore + consistencyScore;

      scores.push({
        teamId: row.teamId,
        teamName: row.teamName,
        division,
        leagueRank: row.rank,
        leagueScore,
        cupScore,
        masterScore,
        consistencyScore,
        weightedLeagueScore,
        weightedCupScore,
        weightedMasterScore,
        weightedConsistencyScore,
        cupFinish: cupData.summaryByTeam.get(row.teamId) ?? 'No cup run',
        totalScore,
      });
    });
  });

  return scores.sort((a, b) =>
    b.totalScore - a.totalScore
    || b.leagueScore - a.leagueScore
    || b.cupScore - a.cupScore
    || b.masterScore - a.masterScore
    || b.consistencyScore - a.consistencyScore
    || a.leagueRank - b.leagueRank
    || a.teamName.localeCompare(b.teamName),
  );
}

export function getBookieDorWeights(season?: SeasonId): BookieDorWeights {
  const effectiveSeason = season ?? 'S6';
  const divisionCount = getDivisionOrderForSeason(effectiveSeason).length;
  const leagueMax = bookieDorDivisionTitlePoints(0, divisionCount);
  const masterMax = BOOKIE_DOR_MASTER_LEAGUE_MAX_POINTS;
  const mainCupMax = BOOKIE_DOR_MAIN_CUP_WIN_POINTS['Round of 32']
    + BOOKIE_DOR_MAIN_CUP_WIN_POINTS['Round of 16']
    + BOOKIE_DOR_MAIN_CUP_WIN_POINTS.Quarterfinal
    + BOOKIE_DOR_MAIN_CUP_WIN_POINTS.Semifinal
    + BOOKIE_DOR_MAIN_CUP_WIN_POINTS.Final
    + ((divisionCount - 1) * BOOKIE_DOR_MAIN_CUP_UPSET_BONUS_PER_DIVISION);
  const masterCupMax = isSeasonFiveOrLater(effectiveSeason)
    ? BOOKIE_DOR_MASTER_CUP_WIN_POINTS.round_of_16
      + BOOKIE_DOR_MASTER_CUP_WIN_POINTS.quarter_final
      + BOOKIE_DOR_MASTER_CUP_WIN_POINTS.semi_final
      + BOOKIE_DOR_MASTER_CUP_WIN_POINTS.final
      + ((divisionCount - 1) * BOOKIE_DOR_MASTER_CUP_UPSET_BONUS_PER_DIVISION)
    : 0;
  const cupMax = mainCupMax + masterCupMax;
  const consistencyMax = (isSeasonFiveOrLater(effectiveSeason) ? bookieDorTrioTitlePoints(0) : 0)
    + (isSeasonSixOrLater(effectiveSeason) ? bookieDorTierTitlePoints(0) : 0);
  const total = leagueMax + cupMax + masterMax + consistencyMax;
  if (total <= 0) {
    return { ...BOOKIE_DOR_WEIGHTS };
  }
  return {
    league: Number((leagueMax / total).toFixed(4)),
    cup: Number((cupMax / total).toFixed(4)),
    master: Number((masterMax / total).toFixed(4)),
    consistency: Number((consistencyMax / total).toFixed(4)),
  };
}

export function getBookieDorLeaderboard(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{
  teamId: number;
  teamName: string;
  division: DivisionName;
  leagueRank: number;
  leagueScore: number;
  cupScore: number;
  masterScore: number;
  consistencyScore: number;
  weightedLeagueScore: number;
  weightedCupScore: number;
  weightedMasterScore: number;
  weightedConsistencyScore: number;
  cupFinish: string;
  totalScore: number;
}> {
  const normalizedGw = GAMEWEEKS.includes(gw as (typeof GAMEWEEKS)[number]) ? gw : 'GW8';
  const table = getLeagueTable(db, season, normalizedGw);
  return calculateBookieDorLeaderboard(db, season, table, normalizedGw);
}

type CupFixtureState = {
  id: number;
  season: SeasonId;
  gw: string;
  home_team_id: number | null;
  away_team_id: number | null;
  winner_team_id: number | null;
};

function getCupFixtureState(db: Database.Database, fixtureId: number): CupFixtureState | undefined {
  return db
    .prepare('SELECT id, season, gw, home_team_id, away_team_id, winner_team_id FROM cup_fixtures WHERE id = ?')
    .get(fixtureId) as CupFixtureState | undefined;
}

function hasManualCupWinnerOverride(db: Database.Database, fixtureId: number, winnerTeamId: number): boolean {
  const latestWinnerChange = db
    .prepare(
      `
      SELECT reason, new_winner_team_id
      FROM cup_audit_log
      WHERE fixture_id = ?
        AND old_winner_team_id IS NOT new_winner_team_id
      ORDER BY id DESC
      LIMIT 1
      `,
    )
    .get(fixtureId) as { reason: string; new_winner_team_id: number | null } | undefined;

  return latestWinnerChange?.reason === 'manual_override_winner'
    && latestWinnerChange.new_winner_team_id === winnerTeamId;
}

function updateCupFixtureWithAudit(
  db: Database.Database,
  fixtureId: number,
  updates: { home_team_id?: number | null; away_team_id?: number | null; winner_team_id?: number | null },
  action: string,
  reason: string,
  actor = 'system',
): void {
  const before = getCupFixtureState(db, fixtureId);
  if (!before) {
    return;
  }

  const nextHome = updates.home_team_id !== undefined ? updates.home_team_id : before.home_team_id;
  const nextAway = updates.away_team_id !== undefined ? updates.away_team_id : before.away_team_id;
  const nextWinner = updates.winner_team_id !== undefined ? updates.winner_team_id : before.winner_team_id;
  if (before.home_team_id === nextHome && before.away_team_id === nextAway && before.winner_team_id === nextWinner) {
    return;
  }

  db.prepare('UPDATE cup_fixtures SET home_team_id = ?, away_team_id = ?, winner_team_id = ? WHERE id = ?')
    .run(nextHome, nextAway, nextWinner, fixtureId);
  db.prepare(
    `
    INSERT INTO cup_audit_log (
      season, gw, fixture_id, action, reason, actor,
      old_home_team_id, old_away_team_id, old_winner_team_id,
      new_home_team_id, new_away_team_id, new_winner_team_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    before.season,
    before.gw,
    fixtureId,
    action,
    reason,
    actor,
    before.home_team_id,
    before.away_team_id,
    before.winner_team_id,
    nextHome,
    nextAway,
    nextWinner,
  );
}

function resolveCupFixtureWinner(db: Database.Database, fixtureId: number): number | null {
  const fixture = getCupFixtureState(db, fixtureId);

  if (!fixture) {
    return null;
  }

  if (fixture.winner_team_id) {
    if (hasManualCupWinnerOverride(db, fixture.id, fixture.winner_team_id)) {
      return fixture.winner_team_id;
    }
    const currentState = getCurrentState(db);
    const fixtureIndex = gwIndex(fixture.gw);
    const currentIndex = gwIndex(currentState.currentGw);
    const locked = isGameweekLocked(db, fixture.season, fixture.gw);
    if (locked || (fixtureIndex >= 0 && currentIndex >= 0 && fixtureIndex < currentIndex)) {
      return fixture.winner_team_id;
    }
  }

  if (!fixture.home_team_id && !fixture.away_team_id) {
    return null;
  }
  if (!fixture.home_team_id || !fixture.away_team_id) {
    if (fixture.gw === 'GW2') {
      const winner = fixture.home_team_id ?? fixture.away_team_id;
      if (winner) {
        updateCupFixtureWithAudit(db, fixture.id, { winner_team_id: winner }, 'winner_update', 'auto_resolve_bye');
      }
      return winner ?? null;
    }
    return null;
  }

  const home = getTeamGwPerformance(db, fixture.season, fixture.gw, fixture.home_team_id);
  const away = getTeamGwPerformance(db, fixture.season, fixture.gw, fixture.away_team_id);

  let winner = fixture.home_team_id;
  if (away.profit > home.profit) {
    winner = fixture.away_team_id;
  } else if (away.profit < home.profit) {
    winner = fixture.home_team_id;
  } else {
    if (away.spins > home.spins) {
      winner = fixture.away_team_id;
    } else if (away.spins < home.spins) {
      winner = fixture.home_team_id;
    } else {
      const fixtureSeasonNumber = parseSeasonNumber(fixture.season);
      // Penalties start in GW4 for Seasons 1-3, and from GW2 for Seasons 4+.
      const penaltyStart = fixtureSeasonNumber >= 4 ? 'GW2' : 'GW4';
      const penaltyStartIndex = gwIndex(penaltyStart);
      const fixtureIndex = gwIndex(fixture.gw);
      const penaltiesRequired = fixtureIndex >= penaltyStartIndex;
      if (penaltiesRequired) {
        if (fixture.winner_team_id) {
          updateCupFixtureWithAudit(
            db,
            fixture.id,
            { winner_team_id: null },
            'winner_update',
            'awaiting_penalties',
          );
        }
        return null;
      }
      const mode = getCupTieBreakMode(db);
      if (mode === 'random') {
        winner = Math.random() < 0.5 ? fixture.home_team_id : fixture.away_team_id;
      } else {
        winner = fixture.home_team_id < fixture.away_team_id ? fixture.home_team_id : fixture.away_team_id;
      }
      updateCupFixtureWithAudit(
        db,
        fixture.id,
        { winner_team_id: winner },
        'winner_update',
        mode === 'random' ? 'tie_break_random' : 'tie_break_lower_id',
      );
      return winner;
    }
  }

  updateCupFixtureWithAudit(db, fixture.id, { winner_team_id: winner }, 'winner_update', 'auto_resolve_round');
  return winner;
}

function hasCupDraw(db: Database.Database, season: SeasonId): boolean {
  const row = db.prepare('SELECT COUNT(*) as c FROM cup_fixtures WHERE season = ? AND gw = ?').get(season, 'GW2') as { c: number };
  return row.c > 0;
}

export function startCupDraw(db: Database.Database, season: SeasonId): Array<{
  slot: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
}> {
  assignDivisionsForSeason(db, season);
  const existingGw2 = db.prepare('SELECT id, home_team_id, away_team_id FROM cup_fixtures WHERE season = ? AND gw = ? ORDER BY id').all(season, 'GW2') as Array<{
    id: number;
    home_team_id: number | null;
    away_team_id: number | null;
  }>;
  if (existingGw2.length > 0) {
    const hasInvalidByeVsBye = existingGw2.some((row) => row.home_team_id === null && row.away_team_id === null);
    if (!hasInvalidByeVsBye) {
      return existingGw2.map((row, index) => ({ slot: index + 1, homeTeamId: row.home_team_id, awayTeamId: row.away_team_id }));
    }
    db.prepare('DELETE FROM cup_fixtures WHERE season = ?').run(season);
  }

  const teamIds = shuffle(
    (db.prepare('SELECT team_id FROM season_teams WHERE season = ? ORDER BY team_id').all(season) as Array<{ team_id: number }>)
      .map((row) => row.team_id),
  );
  const firstRoundBracketSize = 32;
  const firstRoundFixtures = firstRoundBracketSize / 2;
  const byeCount = Math.max(0, firstRoundBracketSize - teamIds.length);
  const byePairs: Array<{ home: number | null; away: number | null }> = teamIds.slice(0, byeCount).map((teamId) =>
    Math.random() > 0.5 ? { home: teamId, away: null } : { home: null, away: teamId },
  );
  const teamPairs: Array<{ home: number | null; away: number | null }> = [];
  const remainingTeams = shuffle(teamIds.slice(byeCount));
  for (let i = 0; i < remainingTeams.length; i += 2) {
    const a = remainingTeams[i];
    const b = remainingTeams[i + 1];
    if (Math.random() > 0.5) {
      teamPairs.push({ home: a, away: b });
    } else {
      teamPairs.push({ home: b, away: a });
    }
  }
  const fixtures = shuffle([...byePairs, ...teamPairs]).slice(0, firstRoundFixtures);

  const insertGw1 = db.prepare(
    'INSERT INTO cup_fixtures (season, gw, round_name, home_team_id, away_team_id, winner_team_id, is_manual) VALUES (?, ?, ?, ?, ?, ?, 1)',
  );
  const insertLater = db.prepare(
    'INSERT INTO cup_fixtures (season, gw, round_name, home_team_id, away_team_id, source_game_a, source_game_b) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );

  const tx = db.transaction(() => {
    for (const fixture of fixtures) {
      insertGw1.run(season, 'GW2', 'Round of 32', fixture.home, fixture.away, null);
    }

    const gw2Ids = (db.prepare('SELECT id FROM cup_fixtures WHERE season = ? AND gw = ? ORDER BY id').all(season, 'GW2') as Array<{ id: number }>).map((r) => r.id);
    for (let i = 0; i < gw2Ids.length; i += 2) {
      insertLater.run(season, 'GW3', 'Round of 16', null, null, gw2Ids[i], gw2Ids[i + 1]);
    }
    const gw3Ids = (db.prepare('SELECT id FROM cup_fixtures WHERE season = ? AND gw = ? ORDER BY id').all(season, 'GW3') as Array<{ id: number }>).map((r) => r.id);
    for (let i = 0; i < gw3Ids.length; i += 2) {
      insertLater.run(season, 'GW4', 'Quarterfinal', null, null, gw3Ids[i], gw3Ids[i + 1]);
    }
    const gw4Ids = (db.prepare('SELECT id FROM cup_fixtures WHERE season = ? AND gw = ? ORDER BY id').all(season, 'GW4') as Array<{ id: number }>).map((r) => r.id);
    for (let i = 0; i < gw4Ids.length; i += 2) {
      insertLater.run(season, 'GW5', 'Semifinal', null, null, gw4Ids[i], gw4Ids[i + 1]);
    }
    const gw5Ids = (db.prepare('SELECT id FROM cup_fixtures WHERE season = ? AND gw = ? ORDER BY id').all(season, 'GW5') as Array<{ id: number }>).map((r) => r.id);
    insertLater.run(season, 'GW6', 'Final', null, null, gw5Ids[0], gw5Ids[1]);
  });
  tx();

  return (
    db.prepare('SELECT id, home_team_id, away_team_id FROM cup_fixtures WHERE season = ? AND gw = ? ORDER BY id').all(season, 'GW2') as Array<{
      id: number;
      home_team_id: number | null;
      away_team_id: number | null;
    }>
  ).map((row, index) => ({ slot: index + 1, homeTeamId: row.home_team_id, awayTeamId: row.away_team_id }));
}

function populateFixtureTeamsFromSources(db: Database.Database, fixtureId: number): void {
  const fixture = db
    .prepare('SELECT id, source_game_a, source_game_b FROM cup_fixtures WHERE id = ?')
    .get(fixtureId) as { id: number; source_game_a: number | null; source_game_b: number | null };

  if (!fixture.source_game_a && !fixture.source_game_b) {
    return;
  }

  const homeWinner = fixture.source_game_a
    ? ((db.prepare('SELECT winner_team_id FROM cup_fixtures WHERE id = ?').get(fixture.source_game_a) as { winner_team_id: number | null } | undefined)
        ?.winner_team_id ?? null)
    : null;
  const awayWinner = fixture.source_game_b
    ? ((db.prepare('SELECT winner_team_id FROM cup_fixtures WHERE id = ?').get(fixture.source_game_b) as { winner_team_id: number | null } | undefined)
        ?.winner_team_id ?? null)
    : null;
  if (homeWinner || awayWinner) {
    updateCupFixtureWithAudit(
      db,
      fixture.id,
      { home_team_id: homeWinner ?? null, away_team_id: awayWinner ?? null },
      'slot_update',
      homeWinner && awayWinner ? 'populate_from_sources' : 'awaiting_sources',
    );
    return;
  }
  updateCupFixtureWithAudit(
    db,
    fixture.id,
    { home_team_id: null, away_team_id: null },
    'slot_update',
    'awaiting_sources',
  );
}

function isCupRoundComplete(db: Database.Database, season: SeasonId, gw: string): boolean {
  const fixtures = db
    .prepare('SELECT home_team_id, away_team_id FROM cup_fixtures WHERE season = ? AND gw = ?')
    .all(season, gw) as Array<{ home_team_id: number | null; away_team_id: number | null }>;

  const hasEntry = db.prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?');
  for (const fixture of fixtures) {
    if (!fixture.home_team_id || !fixture.away_team_id) {
      continue;
    }
    const homePlayed = hasEntry.get(season, gw, fixture.home_team_id) as { c: number };
    const awayPlayed = hasEntry.get(season, gw, fixture.away_team_id) as { c: number };
    if (homePlayed.c === 0 || awayPlayed.c === 0) {
      return false;
    }
  }

  return true;
}

export function ensureCupProgress(db: Database.Database, season: SeasonId, upToGw: string): void {
  if (!hasCupDraw(db, season)) {
    return;
  }

  const currentState = getCurrentState(db);
  const currentGwIndex = gwIndex(currentState.currentGw);
  const requestedGwIndex = gwIndex(upToGw);
  const safeUpToIndex =
    season === currentState.currentSeason
      ? Math.max(requestedGwIndex, currentGwIndex)
      : requestedGwIndex;
  const upto = safeUpToIndex >= 0 ? safeUpToIndex : Math.max(requestedGwIndex, currentGwIndex, 0);
  const cupRounds = ['GW2', 'GW3', 'GW4', 'GW5', 'GW6'];
  const currentRoundLocked = isGameweekLocked(db, season, upToGw);
  for (const gw of cupRounds) {
    const roundIdx = gwIndex(gw);
    const roundLocked = isGameweekLocked(db, season, gw);
    const shouldResolveRound =
      roundIdx < upto
      || (roundIdx === upto && (roundLocked || isCupRoundComplete(db, season, gw)));
    const shouldPopulateRound =
      roundIdx <= upto || (currentRoundLocked && roundIdx === upto + 1);
    const fixtures = db.prepare('SELECT id FROM cup_fixtures WHERE season = ? AND gw = ? ORDER BY id').all(season, gw) as Array<{ id: number }>;
    for (const row of fixtures) {
      if (gw !== 'GW2' && shouldPopulateRound) {
        populateFixtureTeamsFromSources(db, row.id);
      } else if (gw !== 'GW2') {
        updateCupFixtureWithAudit(db, row.id, { home_team_id: null, away_team_id: null }, 'slot_update', 'clear_future_slots');
      }
      if (shouldResolveRound) {
        resolveCupFixtureWinner(db, row.id);
      } else {
        const fixture = getCupFixtureState(db, row.id);
        if (!fixture?.winner_team_id || !hasManualCupWinnerOverride(db, fixture.id, fixture.winner_team_id)) {
          updateCupFixtureWithAudit(db, row.id, { winner_team_id: null }, 'winner_update', 'clear_unlocked_winner');
        }
      }
    }
  }
}

export function getCupTieFixtures(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{
  fixtureId: number;
  gw: string;
  roundName: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
}> {
  const fixtures = db
    .prepare(
      `
      SELECT id, round_name, home_team_id, away_team_id, winner_team_id
      FROM cup_fixtures
      WHERE season = ? AND gw = ?
      ORDER BY id
      `,
    )
    .all(season, gw) as Array<{
    id: number;
    round_name: string;
    home_team_id: number | null;
    away_team_id: number | null;
    winner_team_id: number | null;
  }>;

  if (fixtures.length === 0) {
    return [];
  }

  const teamRows = db.prepare('SELECT id, name FROM teams').all() as Array<{ id: number; name: string }>;
  const teamNameById = new Map(teamRows.map((row) => [row.id, row.name]));
  const hasEntry = db.prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?');
  const seasonNumber = parseSeasonNumber(season);
  const penaltyStartGw = seasonNumber >= 4 ? 'GW2' : 'GW4';
  const penaltyStartIndex = gwIndex(penaltyStartGw);

  const ties: Array<{
    fixtureId: number;
    gw: string;
    roundName: string;
    homeTeamId: number;
    homeTeamName: string;
    awayTeamId: number;
    awayTeamName: string;
    homeProfit: number;
    awayProfit: number;
    homeSpins: number;
    awaySpins: number;
  }> = [];

  fixtures.forEach((fixture) => {
    if (fixture.winner_team_id) {
      return;
    }
    if (!fixture.home_team_id || !fixture.away_team_id) {
      return;
    }
    const fixtureIndex = gwIndex(gw);
    if (fixtureIndex < penaltyStartIndex) {
      return;
    }
    const homeCount = hasEntry.get(season, gw, fixture.home_team_id) as { c: number };
    const awayCount = hasEntry.get(season, gw, fixture.away_team_id) as { c: number };
    if (homeCount.c === 0 && awayCount.c === 0) {
      return;
    }
    const homePerf = getTeamGwPerformance(db, season, gw, fixture.home_team_id);
    const awayPerf = getTeamGwPerformance(db, season, gw, fixture.away_team_id);
    if (homePerf.profit !== awayPerf.profit || homePerf.spins !== awayPerf.spins) {
      return;
    }
    ties.push({
      fixtureId: fixture.id,
      gw,
      roundName: fixture.round_name,
      homeTeamId: fixture.home_team_id,
      homeTeamName: teamNameById.get(fixture.home_team_id) ?? 'Home',
      awayTeamId: fixture.away_team_id,
      awayTeamName: teamNameById.get(fixture.away_team_id) ?? 'Away',
      homeProfit: Number(homePerf.profit.toFixed(2)),
      awayProfit: Number(awayPerf.profit.toFixed(2)),
      homeSpins: Number(homePerf.spins),
      awaySpins: Number(awayPerf.spins),
    });
  });

  return ties;
}

export function getCupTieFixturesForRange(
  db: Database.Database,
  season: SeasonId,
  upToGw: string,
): ReturnType<typeof getCupTieFixtures> {
  const upToIndex = gwIndex(upToGw);
  if (upToIndex < 0) {
    return [];
  }
  return (['GW2', 'GW3', 'GW4', 'GW5', 'GW6'] as const)
    .filter((gw) => gwIndex(gw) <= upToIndex)
    .flatMap((gw) => getCupTieFixtures(db, season, gw));
}

export function getMasterCupTieFixtures(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{
  fixtureId: number;
  gw: string;
  roundName: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
}> {
  if (!isSeasonFiveOrLater(season) || gwIndex(gw) < gwIndex('GW1') || gwIndex(gw) > gwIndex('GW6')) {
    return [];
  }
  const maxGwIndex = gwIndex(gw);

  const fixtures = db
    .prepare(
      `
      SELECT
        id,
        gw,
        stage,
        tie_slot,
        leg_number,
        home_team_id,
        away_team_id,
        winner_team_id
      FROM master_cup_fixtures
      WHERE season = ?
        AND CASE gw
          WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
          WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
          WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END <= ?
      ORDER BY tie_slot, leg_number, id
      `,
    )
    .all(season, maxGwIndex + 1) as Array<{
    id: number;
    gw: string;
    stage: MasterCupStage;
    tie_slot: number;
    leg_number: number;
    home_team_id: number | null;
    away_team_id: number | null;
    winner_team_id: number | null;
  }>;

  if (fixtures.length === 0) {
    return [];
  }

  const teamRows = db.prepare('SELECT id, name FROM teams').all() as Array<{ id: number; name: string }>;
  const teamNameById = new Map(teamRows.map((row) => [row.id, row.name]));

  return fixtures.flatMap((fixture) => {
    const resolvedWinnerTeamId = resolveMasterCupFixtureWinner(db, season, fixture.id);
    if (resolvedWinnerTeamId !== null || !fixture.home_team_id || !fixture.away_team_id) {
      return [];
    }
    if (!isMasterCupGameweekClosed(db, season, fixture.gw)) {
      return [];
    }

    if (fixture.stage === 'semi_final') {
      if (fixture.leg_number !== 2) {
        return [];
      }
      const aggregateState = getMasterCupSemiFinalAggregateState(db, season, fixture.tie_slot);
      if (!aggregateState) {
        return [];
      }
      if (
        !isMasterCupGameweekClosed(db, season, aggregateState.firstLeg.gw)
        || !isMasterCupGameweekClosed(db, season, aggregateState.secondLeg.gw)
      ) {
        return [];
      }
      if (
        aggregateState.firstLegHomeEntries === 0
        || aggregateState.firstLegAwayEntries === 0
        || aggregateState.secondLegHomeEntries === 0
        || aggregateState.secondLegAwayEntries === 0
      ) {
        return [];
      }
      if (aggregateState.aggregateAProfit !== aggregateState.aggregateBProfit) {
        return [];
      }
      return [{
        fixtureId: fixture.id,
        gw: fixture.gw,
        roundName: 'Semi-final (Aggregate)',
        homeTeamId: aggregateState.teamAId,
        homeTeamName: teamNameById.get(aggregateState.teamAId) ?? 'Home',
        awayTeamId: aggregateState.teamBId,
        awayTeamName: teamNameById.get(aggregateState.teamBId) ?? 'Away',
        homeProfit: aggregateState.aggregateAProfit,
        awayProfit: aggregateState.aggregateBProfit,
        homeSpins: aggregateState.aggregateASpins,
        awaySpins: aggregateState.aggregateBSpins,
      }];
    }

    const homeMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.home_team_id);
    const awayMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.away_team_id);
    if (homeMetrics.entryCount === 0 || awayMetrics.entryCount === 0) {
      return [];
    }
    if (homeMetrics.profit !== awayMetrics.profit) {
      return [];
    }
    return [{
      fixtureId: fixture.id,
      gw: fixture.gw,
      roundName: masterCupRoundLabel(fixture.stage, fixture.leg_number),
      homeTeamId: fixture.home_team_id,
      homeTeamName: teamNameById.get(fixture.home_team_id) ?? 'Home',
      awayTeamId: fixture.away_team_id,
      awayTeamName: teamNameById.get(fixture.away_team_id) ?? 'Away',
      homeProfit: Number(homeMetrics.profit.toFixed(2)),
      awayProfit: Number(awayMetrics.profit.toFixed(2)),
      homeSpins: Number(homeMetrics.spins),
      awaySpins: Number(awayMetrics.spins),
    }];
  });
}

function getGw8PlayoffPenaltyWinner(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
): number | null {
  const row = db
    .prepare(
      `
      SELECT winner_team_id
      FROM gw8_playoff_penalties
      WHERE season = ? AND fixture_id = ?
      `,
    )
    .get(season, fixtureId) as { winner_team_id: number } | undefined;
  return row?.winner_team_id ?? null;
}

function isGw8DivisionPlayoffFixture(gw: string, division: string): boolean {
  return gw.trim().toUpperCase() === 'GW8' && division.trim().toLowerCase() === 'playoff';
}

function leagueFixtureAllowsDraw(fixture: { gw: string; division: string }): boolean {
  return !isGw8DivisionPlayoffFixture(fixture.gw, fixture.division);
}

function resolveLeagueFixtureResult(args: {
  db: Database.Database;
  season: SeasonId;
  fixtureId: number;
  gw: string;
  division: string;
  homeTeamId: number;
  awayTeamId: number;
  homeProfit: number;
  awayProfit: number;
  homeEntries: number;
  awayEntries: number;
}): 'home' | 'away' | 'draw' | 'pending' {
  const {
    db,
    season,
    fixtureId,
    gw,
    division,
    homeTeamId,
    awayTeamId,
    homeProfit,
    awayProfit,
    homeEntries,
    awayEntries,
  } = args;

  if (homeEntries === 0 && awayEntries === 0) {
    return 'pending';
  }
  if (homeProfit > awayProfit) {
    return 'home';
  }
  if (awayProfit > homeProfit) {
    return 'away';
  }
  if (isGw8DivisionPlayoffFixture(gw, division)) {
    const penaltyWinner = getGw8PlayoffPenaltyWinner(db, season, fixtureId);
    if (penaltyWinner === homeTeamId) {
      return 'home';
    }
    if (penaltyWinner === awayTeamId) {
      return 'away';
    }
    return 'pending';
  }
  return 'draw';
}

export function getGw8PlayoffTieFixtures(
  db: Database.Database,
  season: SeasonId,
): Array<{
  fixtureId: number;
  gw: string;
  roundName: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
}> {
  const fixtures = db
    .prepare(
      `
      SELECT
        lf.id,
        lf.home_team_id,
        lf.away_team_id,
        ht.name AS home_team_name,
        at.name AS away_team_name,
        p.winner_team_id
      FROM league_fixtures lf
      INNER JOIN teams ht ON ht.id = lf.home_team_id
      INNER JOIN teams at ON at.id = lf.away_team_id
      LEFT JOIN gw8_playoff_penalties p
        ON p.season = lf.season
       AND p.fixture_id = lf.id
      WHERE lf.season = ?
        AND lf.gw = 'GW8'
        AND lf.division = 'Playoff'
      ORDER BY lf.id
      `,
    )
    .all(season) as Array<{
    id: number;
    home_team_id: number;
    away_team_id: number;
    home_team_name: string;
    away_team_name: string;
    winner_team_id: number | null;
  }>;

  if (fixtures.length === 0) {
    return [];
  }

  const hasEntry = db.prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?');

  const ties: Array<{
    fixtureId: number;
    gw: string;
    roundName: string;
    homeTeamId: number;
    homeTeamName: string;
    awayTeamId: number;
    awayTeamName: string;
    homeProfit: number;
    awayProfit: number;
    homeSpins: number;
    awaySpins: number;
  }> = [];

  fixtures.forEach((fixture) => {
    if (fixture.winner_team_id) {
      return;
    }
    const homeCount = hasEntry.get(season, 'GW8', fixture.home_team_id) as { c: number };
    const awayCount = hasEntry.get(season, 'GW8', fixture.away_team_id) as { c: number };
    if (homeCount.c === 0 || awayCount.c === 0) {
      return;
    }
    const homePerf = getTeamGwPerformance(db, season, 'GW8', fixture.home_team_id);
    const awayPerf = getTeamGwPerformance(db, season, 'GW8', fixture.away_team_id);
    if (homePerf.profit !== awayPerf.profit) {
      return;
    }
    ties.push({
      fixtureId: fixture.id,
      gw: 'GW8',
      roundName: 'Playoff',
      homeTeamId: fixture.home_team_id,
      homeTeamName: fixture.home_team_name,
      awayTeamId: fixture.away_team_id,
      awayTeamName: fixture.away_team_name,
      homeProfit: Number(homePerf.profit.toFixed(2)),
      awayProfit: Number(awayPerf.profit.toFixed(2)),
      homeSpins: Number(homePerf.spins),
      awaySpins: Number(awayPerf.spins),
    });
  });

  return ties;
}

export function getTrioPlayoffTieFixtures(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{
  fixtureId: number;
  gw: string;
  roundName: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
}> {
  if (gw !== 'GW7' && gw !== 'GW8') {
    return [];
  }

  const fixtures = db
    .prepare(
      `
      SELECT
        tf.id,
        tf.gw,
        tf.division,
        tf.stage,
        tf.home_team_id,
        tf.away_team_id,
        ht.name AS home_team_name,
        at.name AS away_team_name,
        p.winner_team_id
      FROM trio_league_fixtures tf
      INNER JOIN teams ht ON ht.id = tf.home_team_id
      INNER JOIN teams at ON at.id = tf.away_team_id
      LEFT JOIN trio_playoff_penalties p
        ON p.season = tf.season
       AND p.fixture_id = tf.id
      WHERE tf.season = ?
        AND tf.gw = ?
        AND tf.stage IN ('playoff_semi', 'playoff_final')
      ORDER BY tf.division, tf.group_slot, tf.id
      `,
    )
    .all(season, gw) as Array<{
    id: number;
    gw: string;
    division: string;
    stage: TrioFixtureStage;
    home_team_id: number;
    away_team_id: number;
    home_team_name: string;
    away_team_name: string;
    winner_team_id: number | null;
  }>;

  const hasEntry = db.prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?');

  return fixtures.flatMap((fixture) => {
    if (fixture.winner_team_id) {
      return [];
    }
    const homeCount = hasEntry.get(season, fixture.gw, fixture.home_team_id) as { c: number };
    const awayCount = hasEntry.get(season, fixture.gw, fixture.away_team_id) as { c: number };
    if (homeCount.c === 0 || awayCount.c === 0) {
      return [];
    }

    const homePerf = getTeamGwPerformance(db, season, fixture.gw, fixture.home_team_id);
    const awayPerf = getTeamGwPerformance(db, season, fixture.gw, fixture.away_team_id);
    if (homePerf.profit !== awayPerf.profit) {
      return [];
    }

    return [{
      fixtureId: fixture.id,
      gw: fixture.gw,
      roundName: `${fixture.division} ${fixture.stage === 'playoff_semi' ? 'Playoff Semi' : 'Playoff Final'}`,
      homeTeamId: fixture.home_team_id,
      homeTeamName: fixture.home_team_name,
      awayTeamId: fixture.away_team_id,
      awayTeamName: fixture.away_team_name,
      homeProfit: Number(homePerf.profit.toFixed(2)),
      awayProfit: Number(awayPerf.profit.toFixed(2)),
      homeSpins: Number(homePerf.spins),
      awaySpins: Number(awayPerf.spins),
    }];
  });
}

export function setTrioPlayoffWinner(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
  winnerTeamId: number | null,
): void {
  const fixture = db
    .prepare(
      `
      SELECT id, gw, stage, home_team_id, away_team_id
      FROM trio_league_fixtures
      WHERE season = ?
        AND id = ?
        AND stage IN ('playoff_semi', 'playoff_final')
      `,
    )
    .get(season, fixtureId) as {
    id: number;
    gw: string;
    stage: TrioFixtureStage;
    home_team_id: number;
    away_team_id: number;
  } | undefined;
  if (!fixture) {
    throw new Error('Trio playoff fixture not found');
  }
  if (
    winnerTeamId !== null
    && winnerTeamId !== fixture.home_team_id
    && winnerTeamId !== fixture.away_team_id
  ) {
    throw new Error('Winner must be one of the fixture teams');
  }

  const homeCount = db
    .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
    .get(season, fixture.gw, fixture.home_team_id) as { c: number };
  const awayCount = db
    .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
    .get(season, fixture.gw, fixture.away_team_id) as { c: number };
  if (homeCount.c === 0 || awayCount.c === 0) {
    throw new Error('Both Trio playoff teams must have entries before setting a winner');
  }

  const homePerf = getTeamGwPerformance(db, season, fixture.gw, fixture.home_team_id);
  const awayPerf = getTeamGwPerformance(db, season, fixture.gw, fixture.away_team_id);
  if (homePerf.profit !== awayPerf.profit) {
    throw new Error('Trio playoff penalties are only required when profit is tied');
  }

  if (winnerTeamId === null) {
    db.prepare('DELETE FROM trio_playoff_penalties WHERE season = ? AND fixture_id = ?').run(season, fixtureId);
    return;
  }

  db.prepare(
    `
    INSERT INTO trio_playoff_penalties (season, fixture_id, winner_team_id, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(season, fixture_id) DO UPDATE SET
      winner_team_id = excluded.winner_team_id,
      updated_at = CURRENT_TIMESTAMP
    `,
  ).run(season, fixtureId, winnerTeamId);
}

export function setMasterCupWinner(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
  winnerTeamId: number | null,
): void {
  ensureMasterCupPenaltyTable(db);
  const fixture = db
    .prepare(
      `
      SELECT id, gw, stage, tie_slot, leg_number, home_team_id, away_team_id
      FROM master_cup_fixtures
      WHERE season = ?
        AND id = ?
      `,
    )
    .get(season, fixtureId) as {
    id: number;
    gw: string;
    stage: MasterCupStage;
    tie_slot: number;
    leg_number: number;
    home_team_id: number | null;
    away_team_id: number | null;
  } | undefined;
  if (!fixture || !fixture.home_team_id || !fixture.away_team_id) {
    throw new Error('Master Cup fixture not found');
  }
  if (fixture.stage === 'semi_final' && fixture.leg_number !== 2) {
    throw new Error('Only completed semi-final ties can go to Master Cup penalties');
  }
  if (
    winnerTeamId !== null
    && winnerTeamId !== fixture.home_team_id
    && winnerTeamId !== fixture.away_team_id
  ) {
    throw new Error('Winner must be one of the fixture teams');
  }
  if (!isMasterCupGameweekClosed(db, season, fixture.gw)) {
    throw new Error('Master Cup gameweek must be closed before taking penalties');
  }

  if (fixture.stage === 'semi_final') {
    const aggregateState = getMasterCupSemiFinalAggregateState(db, season, fixture.tie_slot);
    if (!aggregateState) {
      throw new Error('Master Cup semi-final tie is not ready for penalties');
    }
    if (
      !isMasterCupGameweekClosed(db, season, aggregateState.firstLeg.gw)
      || !isMasterCupGameweekClosed(db, season, aggregateState.secondLeg.gw)
    ) {
      throw new Error('Both Master Cup semi-final legs must be closed before penalties');
    }
    if (
      aggregateState.firstLegHomeEntries === 0
      || aggregateState.firstLegAwayEntries === 0
      || aggregateState.secondLegHomeEntries === 0
      || aggregateState.secondLegAwayEntries === 0
    ) {
      throw new Error('Both Master Cup semi-final legs must have entries before penalties');
    }
    if (aggregateState.aggregateAProfit !== aggregateState.aggregateBProfit) {
      throw new Error('Master Cup semi-final penalties are only required when aggregate profit is level');
    }
  } else {
    const homeMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.home_team_id);
    const awayMetrics = getMasterCupTeamGwMetrics(db, season, fixture.gw, fixture.away_team_id);
    if (homeMetrics.entryCount === 0 || awayMetrics.entryCount === 0) {
      throw new Error('Both Master Cup teams must have entries before setting a winner');
    }
    if (homeMetrics.profit !== awayMetrics.profit) {
      throw new Error('Master Cup penalties are only required when profit is level');
    }
  }

  if (winnerTeamId === null) {
    db.prepare('DELETE FROM master_cup_penalties WHERE season = ? AND fixture_id = ?').run(season, fixtureId);
    loadMasterCupFixturesForRange(db, season, 'GW1', fixture.gw);
    return;
  }

  db.prepare(
    `
    INSERT INTO master_cup_penalties (season, fixture_id, winner_team_id, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(season, fixture_id) DO UPDATE SET
      winner_team_id = excluded.winner_team_id,
      updated_at = CURRENT_TIMESTAMP
    `,
  ).run(season, fixtureId, winnerTeamId);
  loadMasterCupFixturesForRange(db, season, 'GW1', fixture.gw);
}

export function setGw8PlayoffWinner(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
  winnerTeamId: number | null,
): void {
  const fixture = db
    .prepare(
      `
      SELECT id, home_team_id, away_team_id
      FROM league_fixtures
      WHERE season = ?
        AND id = ?
        AND gw = 'GW8'
        AND division = 'Playoff'
      `,
    )
    .get(season, fixtureId) as { id: number; home_team_id: number; away_team_id: number } | undefined;
  if (!fixture) {
    throw new Error('GW8 playoff fixture not found');
  }
  if (
    winnerTeamId !== null
    && winnerTeamId !== fixture.home_team_id
    && winnerTeamId !== fixture.away_team_id
  ) {
    throw new Error('Winner must be one of the fixture teams');
  }

  const homeCount = db
    .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
    .get(season, 'GW8', fixture.home_team_id) as { c: number };
  const awayCount = db
    .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
    .get(season, 'GW8', fixture.away_team_id) as { c: number };
  if (homeCount.c === 0 || awayCount.c === 0) {
    throw new Error('Both playoff teams must have GW8 entries before setting a winner');
  }

  const homePerf = getTeamGwPerformance(db, season, 'GW8', fixture.home_team_id);
  const awayPerf = getTeamGwPerformance(db, season, 'GW8', fixture.away_team_id);
  if (homePerf.profit !== awayPerf.profit) {
    throw new Error('Playoff penalties are only required when GW8 profit is tied');
  }

  if (winnerTeamId === null) {
    db.prepare('DELETE FROM gw8_playoff_penalties WHERE season = ? AND fixture_id = ?').run(season, fixtureId);
    return;
  }

  db.prepare(
    `
    INSERT INTO gw8_playoff_penalties (season, fixture_id, winner_team_id, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(season, fixture_id) DO UPDATE SET
      winner_team_id = excluded.winner_team_id,
      updated_at = CURRENT_TIMESTAMP
    `,
  ).run(season, fixtureId, winnerTeamId);
}

export function getCupRoundStatus(db: Database.Database, season: SeasonId, upToGw: string): Array<{
  gw: string;
  roundName: string;
  totalFixtures: number;
  playableFixtures: number;
  resolvedFixtures: number;
  complete: boolean;
  locked: boolean;
}> {
  ensureCupProgress(db, season, upToGw);

  const upto = gwIndex(upToGw);
  return (['GW2', 'GW3', 'GW4', 'GW5', 'GW6'] as const).map((gw) => {
    const rows = db
      .prepare(
        `
        SELECT round_name, home_team_id, away_team_id, winner_team_id
        FROM cup_fixtures
        WHERE season = ? AND gw = ?
        ORDER BY id
        `,
      )
      .all(season, gw) as Array<{
      round_name: string;
      home_team_id: number | null;
      away_team_id: number | null;
      winner_team_id: number | null;
    }>;
    const playableFixtures = rows.filter((row) => row.home_team_id && row.away_team_id).length;
    const resolvedFixtures = rows.filter((row) => row.winner_team_id).length;
    const complete = isCupRoundComplete(db, season, gw);
    const roundIdx = gwIndex(gw);
    const locked = roundIdx < upto || (roundIdx === upto && complete);
    return {
      gw,
      roundName: rows[0]?.round_name ?? gw,
      totalFixtures: rows.length,
      playableFixtures,
      resolvedFixtures,
      complete,
      locked,
    };
  });
}

export function getCupDebug(db: Database.Database, season: SeasonId, upToGw: string): {
  tieBreakMode: CupTieBreakMode;
  roundStatus: Array<{
    gw: string;
    roundName: string;
    totalFixtures: number;
    playableFixtures: number;
    resolvedFixtures: number;
    complete: boolean;
    locked: boolean;
  }>;
  recentAudit: Array<{
    id: number;
    gw: string;
    matchNumber: number;
    action: string;
    reason: string;
    oldWinner: string | null;
    newWinner: string | null;
    createdAt: string;
  }>;
} {
  const roundStatus = getCupRoundStatus(db, season, upToGw);

  const fixtures = db
    .prepare('SELECT id, gw FROM cup_fixtures WHERE season = ? ORDER BY CASE gw WHEN \'GW2\' THEN 2 WHEN \'GW3\' THEN 3 WHEN \'GW4\' THEN 4 WHEN \'GW5\' THEN 5 WHEN \'GW6\' THEN 6 ELSE 99 END, id')
    .all(season) as Array<{ id: number; gw: string }>;
  const byGw = new Map<string, number[]>();
  for (const fixture of fixtures) {
    const list = byGw.get(fixture.gw) ?? [];
    list.push(fixture.id);
    byGw.set(fixture.gw, list);
  }
  const matchByFixtureId = new Map<number, number>();
  for (const ids of byGw.values()) {
    ids.forEach((id, idx) => matchByFixtureId.set(id, idx + 1));
  }

  const auditRows = db
    .prepare(
      `
      SELECT
        c.id,
        c.fixture_id,
        c.gw,
        c.action,
        c.reason,
        ow.name AS old_winner,
        nw.name AS new_winner,
        c.created_at
      FROM cup_audit_log c
      LEFT JOIN teams ow ON ow.id = c.old_winner_team_id
      LEFT JOIN teams nw ON nw.id = c.new_winner_team_id
      WHERE c.season = ?
      ORDER BY c.id DESC
      LIMIT 30
      `,
    )
    .all(season) as Array<{
    id: number;
    fixture_id: number;
    gw: string;
    action: string;
    reason: string;
    old_winner: string | null;
    new_winner: string | null;
    created_at: string;
  }>;

  return {
    tieBreakMode: getCupTieBreakMode(db),
    roundStatus,
    recentAudit: auditRows.map((row) => ({
      id: row.id,
      gw: row.gw,
      matchNumber: matchByFixtureId.get(row.fixture_id) ?? 0,
      action: row.action,
      reason: row.reason,
      oldWinner: row.old_winner,
      newWinner: row.new_winner,
      createdAt: row.created_at,
    })),
  };
}

export function setCupFixtureWinner(
  db: Database.Database,
  season: SeasonId,
  fixtureId: number,
  winnerTeamId: number | null,
  actor = 'admin',
): void {
  const fixture = db
    .prepare('SELECT id, home_team_id, away_team_id FROM cup_fixtures WHERE id = ? AND season = ?')
    .get(fixtureId, season) as { id: number; home_team_id: number | null; away_team_id: number | null } | undefined;
  if (!fixture) {
    throw new Error('Fixture not found');
  }
  if (
    winnerTeamId !== null &&
    winnerTeamId !== fixture.home_team_id &&
    winnerTeamId !== fixture.away_team_id
  ) {
    throw new Error('Winner must be one of the fixture teams');
  }

  updateCupFixtureWithAudit(
    db,
    fixtureId,
    { winner_team_id: winnerTeamId },
    'winner_update',
    'manual_override_winner',
    actor,
  );
}

export function resetCupFromRound(db: Database.Database, season: SeasonId, gw: string, actor = 'admin'): void {
  const rounds: Array<'GW2' | 'GW3' | 'GW4' | 'GW5' | 'GW6'> = ['GW2', 'GW3', 'GW4', 'GW5', 'GW6'];
  const targetIdx = rounds.indexOf(gw as (typeof rounds)[number]);
  if (targetIdx < 0) {
    throw new Error('Invalid cup round');
  }

  const fixtures = db
    .prepare('SELECT id, gw FROM cup_fixtures WHERE season = ? ORDER BY CASE gw WHEN \'GW2\' THEN 2 WHEN \'GW3\' THEN 3 WHEN \'GW4\' THEN 4 WHEN \'GW5\' THEN 5 WHEN \'GW6\' THEN 6 ELSE 99 END, id')
    .all(season) as Array<{ id: number; gw: string }>;

  for (const fixture of fixtures) {
    const idx = rounds.indexOf(fixture.gw as (typeof rounds)[number]);
    if (idx < targetIdx) {
      continue;
    }
    if (idx > targetIdx && fixture.gw !== 'GW2') {
      updateCupFixtureWithAudit(
        db,
        fixture.id,
        { home_team_id: null, away_team_id: null, winner_team_id: null },
        'fixture_update',
        `manual_reset_from_${gw}`,
        actor,
      );
    } else {
      updateCupFixtureWithAudit(
        db,
        fixture.id,
        { winner_team_id: null },
        'winner_update',
        `manual_reset_from_${gw}`,
        actor,
      );
    }
  }
}

function divisionStatsForSeason(db: Database.Database, season: SeasonId, gw: string): Array<{
  team_id: number;
  division: DivisionName;
  profit: number;
  wins: number;
  best_single_profit: number;
}> {
  return db
    .prepare(
      `
      SELECT
        st.team_id,
        st.division,
        COALESCE(SUM(e.profit), 0) AS profit,
        COALESCE(SUM(CASE WHEN e.profit > 0 THEN 1 ELSE 0 END), 0) AS wins,
        COALESCE(MAX(e.profit), 0) AS best_single_profit
      FROM season_teams st
      LEFT JOIN entries e
        ON e.team_id = st.team_id
       AND e.season = st.season
       AND (CASE e.gw
            WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
            WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
            WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END)
         <= (CASE ?
            WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
            WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
            WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END)
      WHERE st.season = ?
      GROUP BY st.team_id, st.division
      `,
    )
    .all(gw, season) as Array<{
    team_id: number;
    division: DivisionName;
    profit: number;
    wins: number;
    best_single_profit: number;
  }>;
}

function applySeasonRollover(db: Database.Database, season: SeasonId): SeasonId {
  const next = nextSeason(season);
  const seasonDivisionOrder = getDivisionOrderForSeason(season);
  if (isSeasonFiveOrLater(next)) {
    ensureSeasonFiveExpansionTeams(db);
  }
  const table = getLeagueTable(db, season, 'GW7');
  const bookieDorLeaderboard = calculateBookieDorLeaderboard(db, season, table, 'GW8');
  const bookieDorWinner = bookieDorLeaderboard[0] ?? null;
  loadMasterLeagueFixturesForRange(db, season, 'GW1', 'GW8');
  if (isSeasonFiveOrLater(season)) {
    loadMasterCupFixturesForRange(db, season, 'GW1', 'GW6');
  }
  ensureSuperCupProgress(db, season);
  const masterLeagueRows = getMasterLeagueTable(db, season, 'GW8');
  const masterCupWinner = isSeasonFiveOrLater(season)
    ? ((db.prepare("SELECT winner_team_id FROM master_cup_fixtures WHERE season = ? AND stage = 'final' AND gw = 'GW6' ORDER BY id LIMIT 1").get(season) as {
        winner_team_id: number | null;
      } | undefined) ?? null)
    : null;
  const superCupWinner = (db.prepare("SELECT winner_team_id FROM super_cup_fixtures WHERE season = ? AND gw = 'GW1' ORDER BY id LIMIT 1").get(season) as {
    winner_team_id: number | null;
  } | undefined) ?? null;
  const allTimeAtSeasonEnd = getAllTimeLeagues(db, season, 'GW8');
  const masterLeagueWinner = masterLeagueRows[0] ?? null;
  const tierLeagueRows = isSeasonSixOrLater(season)
    ? getTierLeagueTable(db, season, getTierLeagueEndGwForSeason(season))
    : [];

  const updateAwards = db.transaction(() => {
    const cupWinner = db
      .prepare("SELECT winner_team_id FROM cup_fixtures WHERE season = ? AND gw = 'GW6' ORDER BY id LIMIT 1")
      .get(season) as { winner_team_id: number } | undefined;
    if (cupWinner?.winner_team_id) {
      insertLockedAward(db, season, cupWinner.winner_team_id, 'cup_winner', '1');
    }

    for (const division of seasonDivisionOrder) {
      const rows = table[division] ?? [];
      if (rows[0]) {
        insertLockedAward(db, season, rows[0].teamId, 'league_title', division);
      }
    }

    if (masterLeagueWinner) {
      insertLockedAward(db, season, masterLeagueWinner.teamId, 'master_league_title', 'overall');
    }

    for (const division of TIER_LEAGUE_DIVISION_ORDER) {
      const winner = tierLeagueRows.find((row) => row.division === division && row.rank === 1);
      if (!winner) {
        continue;
      }
      insertLockedAward(db, season, winner.teamId, 'tier_league_title', division);
    }

    if (masterCupWinner?.winner_team_id) {
      insertLockedAward(db, season, masterCupWinner.winner_team_id, 'master_cup_winner', 'overall');
    }

    if (superCupWinner?.winner_team_id) {
      insertLockedAward(db, season, superCupWinner.winner_team_id, 'super_cup_winner', 'overall');
    }

    if (bookieDorWinner) {
      insertLockedAward(db, season, bookieDorWinner.teamId, 'bookie_dor', 'overall');
    }

    for (const division of seasonDivisionOrder) {
      const best = db
        .prepare(
          `
          SELECT e.team_id, MAX(e.profit) AS best_profit
          FROM entries e
          INNER JOIN season_teams st ON st.team_id = e.team_id AND st.season = e.season
          WHERE e.season = ? AND st.division = ?
          GROUP BY e.team_id
          ORDER BY best_profit DESC, e.team_id ASC
          LIMIT 1
          `,
        )
        .get(season, division) as { team_id: number; best_profit: number } | undefined;
      if (best) {
        insertLockedAward(db, season, best.team_id, 'goal_of_season', division);
      }
    }
  });
  updateAwards();

  const currentDivisions = db.prepare('SELECT team_id, division FROM season_teams WHERE season = ?').all(season) as Array<{
    team_id: number;
    division: DivisionName;
  }>;

  const divisionIndex = new Map(seasonDivisionOrder.map((division, index) => [division, index]));
  const divisionByTeam = new Map(currentDivisions.map((row) => [row.team_id, row.division]));

  if (currentDivisions.length === 0) {
    assignDivisionsForSeason(db, next);
    return next;
  }

  const divisionToTeams = new Map<DivisionName, number[]>();
  for (const division of seasonDivisionOrder) {
    divisionToTeams.set(division, currentDivisions.filter((row) => row.division === division).map((row) => row.team_id));
  }

  const ranked = new Map<DivisionName, number[]>();

  for (const division of seasonDivisionOrder) {
    const divisionRank = (table[division] ?? []).map((row) => row.teamId);
    ranked.set(division, divisionRank);
  }

  const nextMap = new Map<number, DivisionName>();
  for (const division of seasonDivisionOrder) {
    for (const teamId of ranked.get(division) ?? []) {
      nextMap.set(teamId, division);
    }
  }

  for (let i = 0; i < seasonDivisionOrder.length - 1; i += 1) {
    const upper = seasonDivisionOrder[i];
    const lower = seasonDivisionOrder[i + 1];
    const upperRank = ranked.get(upper) ?? [];
    const lowerRank = ranked.get(lower) ?? [];
    if (upperRank.length === 0 || lowerRank.length === 0) {
      continue;
    }

    const relegated = upperRank[upperRank.length - 1];
    const promoted = lowerRank[0];
    nextMap.set(relegated, lower);
    nextMap.set(promoted, upper);
  }

  const teamNameRows = db.prepare('SELECT id, name FROM teams').all() as Array<{ id: number; name: string }>;
  const teamNameMap = new Map(teamNameRows.map((row) => [row.id, row.name]));

  const playoffFixtures = db
    .prepare("SELECT id, home_team_id, away_team_id FROM league_fixtures WHERE season = ? AND gw = 'GW8' AND division = 'Playoff'")
    .all(season) as Array<{ id: number; home_team_id: number; away_team_id: number }>;
  const playoffResults: SeasonFinalePayload['playoffResults'] = [];

  playoffFixtures.forEach((fixture) => {
    const homeDivision = divisionByTeam.get(fixture.home_team_id);
    const awayDivision = divisionByTeam.get(fixture.away_team_id);
    if (!homeDivision || !awayDivision) {
      return;
    }
    const homeIdx = divisionIndex.get(homeDivision) ?? 99;
    const awayIdx = divisionIndex.get(awayDivision) ?? 99;
    const upperTeamId = homeIdx <= awayIdx ? fixture.home_team_id : fixture.away_team_id;
    const lowerTeamId = upperTeamId === fixture.home_team_id ? fixture.away_team_id : fixture.home_team_id;
    const upperDivision = divisionByTeam.get(upperTeamId) ?? homeDivision;
    const lowerDivision = divisionByTeam.get(lowerTeamId) ?? awayDivision;

    const homePerf = getTeamGwPerformance(db, season, 'GW8', fixture.home_team_id);
    const awayPerf = getTeamGwPerformance(db, season, 'GW8', fixture.away_team_id);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, 'GW8', fixture.home_team_id) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, 'GW8', fixture.away_team_id) as { c: number };

    let winnerTeamId: number | null = null;
    if (!(homeCount.c === 0 && awayCount.c === 0)) {
      if (homePerf.profit > awayPerf.profit) {
        winnerTeamId = fixture.home_team_id;
      } else if (awayPerf.profit > homePerf.profit) {
        winnerTeamId = fixture.away_team_id;
      } else {
        winnerTeamId = getGw8PlayoffPenaltyWinner(db, season, fixture.id);
        if (
          winnerTeamId !== null
          && winnerTeamId !== fixture.home_team_id
          && winnerTeamId !== fixture.away_team_id
        ) {
          winnerTeamId = null;
        }
      }
    }

    const swapped = winnerTeamId === lowerTeamId;
    if (swapped) {
      nextMap.set(lowerTeamId, upperDivision);
      nextMap.set(upperTeamId, lowerDivision);
    }

    playoffResults.push({
      upperTeamId,
      upperTeamName: teamNameMap.get(upperTeamId) ?? 'Unknown',
      lowerTeamId,
      lowerTeamName: teamNameMap.get(lowerTeamId) ?? 'Unknown',
      upperDivision,
      lowerDivision,
      winnerTeamId,
      winnerTeamName: winnerTeamId ? teamNameMap.get(winnerTeamId) ?? 'Unknown' : null,
      swapped,
    });
  });

  const promotions: SeasonFinalePayload['promotions'] = [];
  const relegations: SeasonFinalePayload['relegations'] = [];

  if (isSeasonFiveOrLater(next)) {
    const expansionIds = seasonFiveExpansionTeamIds(db);
    expansionIds.forEach((teamId) => {
      if (!nextMap.has(teamId)) {
        nextMap.set(teamId, DIVISION_FOUR);
      }
    });
    if (!isSeasonFiveOrLater(season)) {
      const masterBottom = masterLeagueRows[masterLeagueRows.length - 1] ?? null;
      const allTimeBottomPoints = allTimeAtSeasonEnd.pointsTable[allTimeAtSeasonEnd.pointsTable.length - 1] ?? null;
      const allTimeBottomProfit = allTimeAtSeasonEnd.profitTable[allTimeAtSeasonEnd.profitTable.length - 1] ?? null;
      const allTimeBottomSpins = allTimeAtSeasonEnd.spinsTable[allTimeAtSeasonEnd.spinsTable.length - 1] ?? null;
      seedSeasonFiveExpansionCarryovers(
        db,
        next,
        expansionIds,
        masterBottom
          ? {
              played: masterBottom.played,
              wins: masterBottom.wins,
              draws: masterBottom.draws,
              losses: masterBottom.losses,
              points: masterBottom.points,
              profit: masterBottom.profit,
              spins: masterBottom.spins,
            }
          : null,
        allTimeBottomPoints
          ? {
              played: allTimeBottomPoints.played,
              wins: allTimeBottomPoints.wins,
              draws: allTimeBottomPoints.draws,
              losses: allTimeBottomPoints.losses,
              points: allTimeBottomPoints.points,
              profit: allTimeBottomProfit?.profit ?? allTimeBottomPoints.profit,
              spins: allTimeBottomSpins?.spins ?? allTimeBottomPoints.spins,
            }
          : null,
      );
    }
  }

  for (const [teamId, toDivision] of nextMap.entries()) {
    const fromDivision = divisionByTeam.get(teamId);
    if (!fromDivision || fromDivision === toDivision) {
      continue;
    }
    const fromIdx = divisionIndex.get(fromDivision) ?? 99;
    const toIdx = divisionIndex.get(toDivision) ?? 99;
    const entry = { teamId, teamName: teamNameMap.get(teamId) ?? 'Unknown', from: fromDivision, to: toDivision };
    if (toIdx < fromIdx) {
      promotions.push(entry);
    } else {
      relegations.push(entry);
    }
  }

  const insert = db.prepare('INSERT INTO season_teams (season, team_id, division) VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    for (const [teamId, division] of nextMap.entries()) {
      insert.run(next, teamId, division);
    }
  });
  tx();
  ensureSuperCupFixture(db, next);
  ensureSuperCupProgress(db, next);
  if (isSeasonFiveOrLater(next)) {
    const trioSeed = buildNextTrioLeagueSeedOrder(db, season, next);
    if (trioSeed.length > 0) {
      setSetting(db, trioLeagueSeedKey(next), JSON.stringify(trioSeed));
    }
  }
  if (isSeasonSixOrLater(season) && isSeasonSixOrLater(next)) {
    const tierSeed = buildNextTierLeagueSeedOrder(db, season, next);
    if (tierSeed.length > 0) {
      setSetting(db, tierLeagueSeedKey(next), JSON.stringify(tierSeed));
    }
  }

  const leagueWinners = seasonDivisionOrder
    .map((division) => {
      const rows = table[division] ?? [];
      if (!rows[0]) {
        return null;
      }
      return { division, teamId: rows[0].teamId, teamName: rows[0].teamName };
    })
    .filter((row): row is { division: DivisionName; teamId: number; teamName: string } => !!row);

  const bestByDivision = seasonDivisionOrder
    .map((division) => {
      const rows = table[division] ?? [];
      if (rows.length === 0) {
        return null;
      }
      const best = rows.slice().sort((a, b) => b.profit - a.profit)[0];
      return { division, teamId: best.teamId, teamName: best.teamName, profit: best.profit };
    })
    .filter((row): row is { division: DivisionName; teamId: number; teamName: string; profit: number } => !!row);

  const goalsOfSeason = computeGoalsOfSeason(db, season);

  const overallBest = seasonDivisionOrder
    .flatMap((division) => table[division] ?? [])
    .sort((a, b) => b.profit - a.profit)[0] ?? null;

  const cupWinnerRow = db
    .prepare("SELECT winner_team_id FROM cup_fixtures WHERE season = ? AND gw = 'GW6' ORDER BY id LIMIT 1")
    .get(season) as { winner_team_id: number } | undefined;
  const cupWinner = cupWinnerRow?.winner_team_id
    ? { teamId: cupWinnerRow.winner_team_id, teamName: teamNameMap.get(cupWinnerRow.winner_team_id) ?? 'Unknown' }
    : null;
  const superCupRow = getSuperCupFixtures(db, season)[0] ?? null;
  const superCup = superCupRow
    ? {
        sourceSeason: superCupRow.sourceSeason,
        pairingReason: superCupRow.pairingReason,
        pairingExplanation: superCupRow.pairingExplanation,
        winner: superCupRow.winnerTeamId && superCupRow.winnerTeam
          ? { teamId: superCupRow.winnerTeamId, teamName: superCupRow.winnerTeam }
          : null,
        runnerUp: superCupRow.runnerUpTeamId && superCupRow.runnerUpTeam
          ? { teamId: superCupRow.runnerUpTeamId, teamName: superCupRow.runnerUpTeam }
          : null,
      }
    : null;

  const bestSingle = db
    .prepare(
      `
      SELECT e.team_id as team_id, MAX(e.profit) AS best_profit
      FROM entries e
      WHERE e.season = ?
      GROUP BY e.team_id
      ORDER BY best_profit DESC, e.team_id ASC
      LIMIT 1
      `,
    )
    .get(season) as { team_id: number; best_profit: number } | undefined;

  const standout: SeasonFinalePayload['standout'] = [];
  if (cupWinner) {
    standout.push({ label: 'Cup Winner', value: cupWinner.teamName });
  }
  if (superCup?.winner) {
    standout.push({ label: 'Super Cup Winner', value: superCup.winner.teamName });
  }
  if (overallBest) {
    standout.push({ label: 'Best Total Profit', value: `${overallBest.teamName} (${overallBest.profit})` });
  }
  if (bestSingle) {
    standout.push({ label: 'Best Single Profit', value: `${teamNameMap.get(bestSingle.team_id) ?? 'Unknown'} (${bestSingle.best_profit})` });
  }

  const bookieDorPayload = bookieDorWinner
    ? {
        weights: getBookieDorWeights(season),
        winner: {
          teamId: bookieDorWinner.teamId,
          teamName: bookieDorWinner.teamName,
          division: bookieDorWinner.division,
          score: Number(bookieDorWinner.totalScore.toFixed(2)),
          leagueScore: Number(bookieDorWinner.leagueScore.toFixed(2)),
          cupScore: Number(bookieDorWinner.cupScore.toFixed(2)),
          masterScore: Number(bookieDorWinner.masterScore.toFixed(2)),
          consistencyScore: Number(bookieDorWinner.consistencyScore.toFixed(2)),
          weightedLeagueScore: Number(bookieDorWinner.weightedLeagueScore.toFixed(2)),
          weightedCupScore: Number(bookieDorWinner.weightedCupScore.toFixed(2)),
          weightedMasterScore: Number(bookieDorWinner.weightedMasterScore.toFixed(2)),
          weightedConsistencyScore: Number(bookieDorWinner.weightedConsistencyScore.toFixed(2)),
          leagueRank: bookieDorWinner.leagueRank,
          cupFinish: bookieDorWinner.cupFinish,
        },
        leaderboard: bookieDorLeaderboard.slice(0, 5).map((row) => ({
          teamId: row.teamId,
          teamName: row.teamName,
          division: row.division,
          score: Number(row.totalScore.toFixed(2)),
          leagueScore: Number(row.leagueScore.toFixed(2)),
          cupScore: Number(row.cupScore.toFixed(2)),
          masterScore: Number(row.masterScore.toFixed(2)),
          consistencyScore: Number(row.consistencyScore.toFixed(2)),
          weightedLeagueScore: Number(row.weightedLeagueScore.toFixed(2)),
          weightedCupScore: Number(row.weightedCupScore.toFixed(2)),
          weightedMasterScore: Number(row.weightedMasterScore.toFixed(2)),
          weightedConsistencyScore: Number(row.weightedConsistencyScore.toFixed(2)),
        })),
      }
    : null;

  const competitionSummaries = buildSeasonFinaleCompetitionSummaries(db, season, next, table);

  const finalePayload: SeasonFinalePayload = {
    season,
    leagueWinners,
    ...competitionSummaries,
    bestProfits: {
      overall: overallBest ? { teamId: overallBest.teamId, teamName: overallBest.teamName, profit: overallBest.profit } : null,
      byDivision: bestByDivision,
    },
    promotions,
    relegations,
    playoffResults,
    cupWinner,
    superCup,
    standout,
    goalsOfSeason,
    bookieDor: bookieDorPayload,
  };
  setSeasonFinale(db, season, finalePayload);
  setSeasonFinalePending(db, season);

  return next;
}

export function initDatabase(): { dbPath: string; warnings: string[] } {
  const db = openDatabase();
  runMigrations(db);

  const warnings: string[] = [];
  ensureSettings(db);
  ensureArchivedSeasonAwardsLocked(db);
  const teamSeedWarning = ensureTeams(db);
  if (teamSeedWarning) {
    warnings.push(teamSeedWarning);
  }

  const state = getCurrentState(db);
  assignDivisionsForSeason(db, state.currentSeason);
  ensureSuperCupFixture(db, state.currentSeason);
  ensureSuperCupProgress(db, state.currentSeason);
  if (getSetting(db, 'bookie_dor_model_version') !== BOOKIE_DOR_MODEL_VERSION) {
    try {
      refreshBookieDorHistory(db);
    } catch (error) {
      warnings.push(`Bookie d'Or refresh skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  db.close();

  return { dbPath: DB_PATH, warnings };
}

export function getCupDrawStarted(db: Database.Database, season: SeasonId): boolean {
  return getSetting(db, `cup_draw_started_${season}`) === '1';
}

export function markCupDrawStarted(db: Database.Database, season: SeasonId): void {
  setSetting(db, `cup_draw_started_${season}`, '1');
}

export function resetDatabaseFile(): void {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
}

export function getState(db: Database.Database): CurrentState {
  return getCurrentState(db);
}

function hasGameweekData(db: Database.Database, season: SeasonId, gw: string): boolean {
  const row = db
    .prepare(
      `
      SELECT
        (
          SELECT COUNT(*) FROM entries WHERE season = ? AND gw = ?
        ) +
        (
          SELECT COUNT(*) FROM predictions WHERE season = ? AND gw = ?
        ) +
        (
          SELECT COUNT(*) FROM league_fixtures WHERE season = ? AND gw = ?
        ) +
        (
          SELECT COUNT(*) FROM cup_fixtures WHERE season = ? AND gw = ?
        ) +
        (
          SELECT COUNT(*) FROM super_cup_fixtures WHERE season = ? AND gw = ?
        ) AS total
      `,
    )
    .get(season, gw, season, gw, season, gw, season, gw, season, gw) as { total: number };
  return (row.total ?? 0) > 0;
}

export function getLastCompletedGameweek(
  db: Database.Database,
  currentSeason: SeasonId,
  currentGw: string,
): { season: SeasonId; gw: string } | null {
  const currentIdx = gwIndex(currentGw);
  if (currentIdx > 0) {
    return {
      season: currentSeason,
      gw: GAMEWEEKS[currentIdx - 1] ?? 'GW1',
    };
  }

  const currentSeasonNumber = parseSeasonNumber(currentSeason);
  if (!Number.isFinite(currentSeasonNumber) || currentSeasonNumber <= 1) {
    return null;
  }

  for (let seasonNumber = currentSeasonNumber - 1; seasonNumber >= 1; seasonNumber -= 1) {
    const seasonId = `S${seasonNumber}` as SeasonId;
    for (let idx = GAMEWEEKS.length - 1; idx >= 0; idx -= 1) {
      const gw = GAMEWEEKS[idx] ?? 'GW1';
      if (isGameweekLocked(db, seasonId, gw) || hasGameweekData(db, seasonId, gw)) {
        return { season: seasonId, gw };
      }
    }
  }

  return null;
}

function latestBookieDorGwForSeason(db: Database.Database, season: SeasonId): string {
  for (let idx = GAMEWEEKS.length - 1; idx >= 0; idx -= 1) {
    const gw = GAMEWEEKS[idx] ?? 'GW8';
    if (hasGameweekData(db, season, gw)) {
      return gw;
    }
  }
  return 'GW8';
}

function buildBookieDorPayloadFromLeaderboard(
  season: SeasonId,
  leaderboard: ReturnType<typeof getBookieDorLeaderboard>,
): SeasonFinalePayload['bookieDor'] {
  const winner = leaderboard[0] ?? null;
  if (!winner) {
    return null;
  }
  return {
    weights: getBookieDorWeights(season),
    winner: {
      teamId: winner.teamId,
      teamName: winner.teamName,
      division: winner.division,
      score: Number(winner.totalScore.toFixed(2)),
      leagueScore: Number(winner.leagueScore.toFixed(2)),
      cupScore: Number(winner.cupScore.toFixed(2)),
      masterScore: Number(winner.masterScore.toFixed(2)),
      consistencyScore: Number(winner.consistencyScore.toFixed(2)),
      weightedLeagueScore: Number(winner.weightedLeagueScore.toFixed(2)),
      weightedCupScore: Number(winner.weightedCupScore.toFixed(2)),
      weightedMasterScore: Number(winner.weightedMasterScore.toFixed(2)),
      weightedConsistencyScore: Number(winner.weightedConsistencyScore.toFixed(2)),
      leagueRank: winner.leagueRank,
      cupFinish: winner.cupFinish,
    },
    leaderboard: leaderboard.slice(0, 5).map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      division: row.division,
      score: Number(row.totalScore.toFixed(2)),
      leagueScore: Number(row.leagueScore.toFixed(2)),
      cupScore: Number(row.cupScore.toFixed(2)),
      masterScore: Number(row.masterScore.toFixed(2)),
      consistencyScore: Number(row.consistencyScore.toFixed(2)),
      weightedLeagueScore: Number(row.weightedLeagueScore.toFixed(2)),
      weightedCupScore: Number(row.weightedCupScore.toFixed(2)),
      weightedMasterScore: Number(row.weightedMasterScore.toFixed(2)),
      weightedConsistencyScore: Number(row.weightedConsistencyScore.toFixed(2)),
    })),
  };
}

export function getBookieDorSnapshot(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): {
  season: SeasonId;
  gw: string;
  weights: BookieDorWeights;
  holder: {
    teamId: number;
    teamName: string;
    division: DivisionName;
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
  } | null;
  leaderboard: Array<{
    teamId: number;
    teamName: string;
    division: DivisionName;
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
  }>;
} {
  const normalizedGw = GAMEWEEKS.includes(gw as (typeof GAMEWEEKS)[number]) ? gw : 'GW8';
  const leaderboard = getBookieDorLeaderboard(db, season, normalizedGw);
  const winner = leaderboard[0] ?? null;
  return {
    season,
    gw: normalizedGw,
    weights: getBookieDorWeights(season),
    holder: winner
      ? {
          teamId: winner.teamId,
          teamName: winner.teamName,
          division: winner.division,
          score: Number(winner.totalScore.toFixed(2)),
          leagueScore: Number(winner.leagueScore.toFixed(2)),
          cupScore: Number(winner.cupScore.toFixed(2)),
          masterScore: Number(winner.masterScore.toFixed(2)),
          consistencyScore: Number(winner.consistencyScore.toFixed(2)),
          weightedLeagueScore: Number(winner.weightedLeagueScore.toFixed(2)),
          weightedCupScore: Number(winner.weightedCupScore.toFixed(2)),
          weightedMasterScore: Number(winner.weightedMasterScore.toFixed(2)),
          weightedConsistencyScore: Number(winner.weightedConsistencyScore.toFixed(2)),
          leagueRank: winner.leagueRank,
          cupFinish: winner.cupFinish,
        }
      : null,
    leaderboard: leaderboard.slice(0, 10).map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      division: row.division,
      score: Number(row.totalScore.toFixed(2)),
      leagueScore: Number(row.leagueScore.toFixed(2)),
      cupScore: Number(row.cupScore.toFixed(2)),
      masterScore: Number(row.masterScore.toFixed(2)),
      consistencyScore: Number(row.consistencyScore.toFixed(2)),
      weightedLeagueScore: Number(row.weightedLeagueScore.toFixed(2)),
      weightedCupScore: Number(row.weightedCupScore.toFixed(2)),
      weightedMasterScore: Number(row.weightedMasterScore.toFixed(2)),
      weightedConsistencyScore: Number(row.weightedConsistencyScore.toFixed(2)),
      leagueRank: row.leagueRank,
      cupFinish: row.cupFinish,
    })),
  };
}

const BOOKIE_DOR_MODEL_VERSION = '4';

export function refreshBookieDorHistory(db: Database.Database): { updated: number } {
  const seasons = db
    .prepare('SELECT DISTINCT season FROM season_teams ORDER BY CAST(SUBSTR(season, 2) AS INTEGER)')
    .all() as Array<{ season: string }>;
  const currentState = getCurrentState(db);
  const currentSeasonNumber = parseSeasonNumber(currentState.currentSeason);
  const hasAward = db.prepare("SELECT 1 FROM awards WHERE season = ? AND award_type = 'bookie_dor' AND value = 'overall' LIMIT 1");

  let updated = 0;
  seasons.forEach((row) => {
    const season = row.season as SeasonId;
    const seasonNumber = parseSeasonNumber(season);
    if (seasonNumber >= currentSeasonNumber) {
      return;
    }

    if (hasAward.get(season)) {
      return;
    }

    const finale = getSeasonFinale(db, season);
    if (finale?.bookieDor?.winner) {
      insertLockedAward(db, season, finale.bookieDor.winner.teamId, 'bookie_dor', 'overall');
      updated += 1;
      return;
    }

    const leaderboard = getBookieDorLeaderboard(db, season, latestBookieDorGwForSeason(db, season));
    const winner = leaderboard[0] ?? null;
    if (winner) {
      insertLockedAward(db, season, winner.teamId, 'bookie_dor', 'overall');
      updated += 1;
    }
  });
  setSetting(db, 'bookie_dor_model_version', BOOKIE_DOR_MODEL_VERSION);

  return { updated };
}

export function getPendingSeasonFinale(db: Database.Database): { season: SeasonId; payload: SeasonFinalePayload } | null {
  const pendingSeason = getSeasonFinalePending(db);
  if (!pendingSeason) {
    return null;
  }
  const payload = getSeasonFinale(db, pendingSeason);
  if (!payload) {
    return null;
  }
  const divisionTable = getLeagueTable(db, pendingSeason, 'GW7');
  const patched: SeasonFinalePayload = {
    ...payload,
    ...buildSeasonFinaleCompetitionSummaries(db, pendingSeason, nextSeason(pendingSeason), divisionTable),
    goalsOfSeason: payload.goalsOfSeason && payload.goalsOfSeason.length > 0
      ? payload.goalsOfSeason
      : computeGoalsOfSeason(db, pendingSeason),
    superCup: payload.superCup ?? (() => {
      const superCupRow = getSuperCupFixtures(db, pendingSeason)[0] ?? null;
      return superCupRow
        ? {
            sourceSeason: superCupRow.sourceSeason,
            pairingReason: superCupRow.pairingReason,
            pairingExplanation: superCupRow.pairingExplanation,
            winner: superCupRow.winnerTeamId && superCupRow.winnerTeam
              ? { teamId: superCupRow.winnerTeamId, teamName: superCupRow.winnerTeam }
              : null,
            runnerUp: superCupRow.runnerUpTeamId && superCupRow.runnerUpTeam
              ? { teamId: superCupRow.runnerUpTeamId, teamName: superCupRow.runnerUpTeam }
              : null,
          }
        : null;
    })(),
  };
  setSeasonFinale(db, pendingSeason, patched);
  return { season: pendingSeason, payload: patched };
}

export function getTeams(db: Database.Database, season: SeasonId): Array<{
  id: number;
  teamId: string | null;
  name: string;
  url: string;
  division: DivisionName;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  preseasonFavorite: boolean;
}> {
  const teamColumns = db.prepare('PRAGMA table_info(teams)').all() as Array<{ name: string }>;
  const hasPreseasonFavorite = teamColumns.some((column) => column.name === 'preseason_favorite');
  const rows = db
    .prepare(
      `
      SELECT t.id, t.team_id, t.name, t.url, st.division, t.ball_color, t.ring_color, t.text_color, ${hasPreseasonFavorite ? 't.preseason_favorite' : '0 AS preseason_favorite'}
      FROM teams t
      INNER JOIN season_teams st ON st.team_id = t.id
      WHERE st.season = ?
      ORDER BY t.name
      `,
    )
    .all(season) as Array<{
      id: number;
      team_id: string | null;
      name: string;
      url: string;
      division: DivisionName;
      ball_color: string | null;
      ring_color: string | null;
      text_color: string | null;
      preseason_favorite: number;
    }>;
  return rows.map((row) => ({
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    url: row.url,
    division: row.division,
    ballColor: row.ball_color,
    ringColor: row.ring_color,
    textColor: row.text_color,
    preseasonFavorite: row.preseason_favorite === 1,
  }));
}

export function getLeagueTable(db: Database.Database, season: SeasonId, gw: string): Record<string, Array<{
  teamId: number;
  teamName: string;
  division: string;
  played: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  wins: number;
  rank: number;
}>> {
  const effectiveGw = gw === 'GW8' ? 'GW7' : gw;

  const teams = db
    .prepare(
      `
      SELECT t.id AS team_id, t.name AS team_name, st.division
      FROM season_teams st
      INNER JOIN teams t ON t.id = st.team_id
      WHERE st.season = ?
      `,
    )
    .all(season) as Array<{ team_id: number; team_name: string; division: DivisionName }>;

  const perGwPerformance = db
    .prepare(
      `
      SELECT gw, team_id, COALESCE(SUM(profit), 0) AS profit, COALESCE(SUM(spins), 0) AS spins, COUNT(*) AS entry_count
      FROM entries
      WHERE season = ?
      GROUP BY gw, team_id
      `,
    )
    .all(season) as Array<{ gw: string; team_id: number; profit: number; spins: number; entry_count: number }>;

  const perfMap = new Map<string, { profit: number; spins: number; entryCount: number }>();
  const totalProfitMap = new Map<number, number>();
  const totalSpinsMap = new Map<number, number>();
  for (const row of perGwPerformance) {
    perfMap.set(`${row.gw}:${row.team_id}`, { profit: row.profit, spins: row.spins, entryCount: row.entry_count });
    if (gwNumber(row.gw) <= gwNumber(effectiveGw)) {
      totalProfitMap.set(row.team_id, (totalProfitMap.get(row.team_id) ?? 0) + row.profit);
      totalSpinsMap.set(row.team_id, (totalSpinsMap.get(row.team_id) ?? 0) + row.spins);
    }
  }

  const tableMap = new Map<number, { played: number; wins: number; draws: number; losses: number; points: number }>();
  for (const team of teams) {
    tableMap.set(team.team_id, { played: 0, wins: 0, draws: 0, losses: 0, points: 0 });
  }

  const fixtures = db
    .prepare('SELECT gw, home_team_id, away_team_id FROM league_fixtures WHERE season = ?')
    .all(season) as Array<{ gw: string; home_team_id: number; away_team_id: number }>;

  for (const fixture of fixtures) {
    if (gwNumber(fixture.gw) > gwNumber(effectiveGw)) {
      continue;
    }
    const homePerf = perfMap.get(`${fixture.gw}:${fixture.home_team_id}`) ?? { profit: 0, spins: 0, entryCount: 0 };
    const awayPerf = perfMap.get(`${fixture.gw}:${fixture.away_team_id}`) ?? { profit: 0, spins: 0, entryCount: 0 };
    if (homePerf.entryCount === 0 && awayPerf.entryCount === 0) {
      continue;
    }

    const home = tableMap.get(fixture.home_team_id);
    const away = tableMap.get(fixture.away_team_id);
    if (!home || !away) {
      continue;
    }

    home.played += 1;
    away.played += 1;

    if (homePerf.profit > awayPerf.profit) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (awayPerf.profit > homePerf.profit) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const byDivision: Record<string, Array<{
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
  }>> = {};
  const divisionOrder = getDivisionOrderForSeason(season);

  for (const division of divisionOrder) {
    const rows = teams
      .filter((team) => team.division === division)
      .map((team) => {
        const stats = tableMap.get(team.team_id) ?? { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        return {
          teamId: team.team_id,
          teamName: team.team_name,
          division,
          played: stats.played,
          wins: stats.wins,
          draws: stats.draws,
          losses: stats.losses,
          points: stats.points,
          profit: Number((totalProfitMap.get(team.team_id) ?? 0).toFixed(2)),
          spins: totalSpinsMap.get(team.team_id) ?? 0,
          rank: 0,
        };
      })
      .sort((a, b) => (
        b.points - a.points
        || b.profit - a.profit
        || b.spins - a.spins
        || b.wins - a.wins
        || a.teamName.localeCompare(b.teamName)
      ))
      .map((row, index) => ({ ...row, rank: index + 1 }));

    byDivision[division] = rows;
  }

  return byDivision;
}

export function getLeagueFixtures(
  db: Database.Database,
  season: SeasonId,
  gw?: string,
): Array<{
  id: number;
  gw: string;
  division: string;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
}> {
  if (gw === 'GW8') {
    ensureGw8Fixtures(db, season);
  }

  const fixtures = db
    .prepare(
      `
      SELECT
        lf.id,
        lf.gw,
        lf.division,
        ht.name AS home_team,
        at.name AS away_team,
        lf.home_team_id,
        lf.away_team_id
      FROM league_fixtures lf
      INNER JOIN teams ht ON ht.id = lf.home_team_id
      INNER JOIN teams at ON at.id = lf.away_team_id
      WHERE lf.season = ?
      ${gw ? 'AND lf.gw = ?' : ''}
      ORDER BY CASE lf.gw
        WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
        WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
        WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END, lf.division, lf.id
      `,
    )
    .all(...(gw ? [season, gw] : [season])) as Array<{
    id: number;
    gw: string;
    division: string;
    home_team: string;
    away_team: string;
    home_team_id: number;
    away_team_id: number;
  }>;

  return fixtures.map((fixture) => {
    const homePerf = getTeamGwPerformance(db, season, fixture.gw, fixture.home_team_id);
    const awayPerf = getTeamGwPerformance(db, season, fixture.gw, fixture.away_team_id);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.home_team_id) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.away_team_id) as { c: number };
    const result = resolveLeagueFixtureResult({
      db,
      season,
      fixtureId: fixture.id,
      gw: fixture.gw,
      division: fixture.division,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeProfit: homePerf.profit,
      awayProfit: awayPerf.profit,
      homeEntries: homeCount.c,
      awayEntries: awayCount.c,
    });

    return {
      id: fixture.id,
      gw: fixture.gw,
      division: fixture.division,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      homeProfit: Number(homePerf.profit.toFixed(2)),
      awayProfit: Number(awayPerf.profit.toFixed(2)),
      homeSpins: homePerf.spins,
      awaySpins: awayPerf.spins,
      played: homeCount.c > 0 || awayCount.c > 0,
      result,
    };
  });
}

function captureGwSnapshot(db: Database.Database, season: SeasonId, gw: string, label: string): void {
  const payload = buildSnapshotPayload(db, season, gw);
  db.prepare('INSERT INTO gw_snapshots (season, gw, label, payload_json) VALUES (?, ?, ?, ?)').run(
    season,
    gw,
    label,
    JSON.stringify(payload),
  );
}

type SnapshotPayload = {
  season: SeasonId;
  gw: string;
  state: CurrentState;
  table: ReturnType<typeof getLeagueTable>;
  cup: ReturnType<typeof getCupBracket>;
  superCup: ReturnType<typeof getSuperCupFixtures>;
  seasonTeams: Array<{ teamId: number; division: string }>;
  leagueFixtures: Array<{ id: number; gw: string; division: string; homeTeamId: number; awayTeamId: number }>;
  masterLeagueFixtures: Array<{ id: number; gw: string; homeTeamId: number; awayTeamId: number; createdAt: string }>;
  masterCupFixtures: Array<{
    id: number;
    gw: string;
    stage: MasterCupStage;
    tieSlot: number;
    legNumber: number;
    homeTeamId: number | null;
    awayTeamId: number | null;
    winnerTeamId: number | null;
    sourceFixtureA: number | null;
    sourceFixtureB: number | null;
    sourceOutcomeA: MasterCupSourceOutcome;
    sourceOutcomeB: MasterCupSourceOutcome;
    homeSeed: number | null;
    awaySeed: number | null;
    createdAt: string;
  }>;
  masterCupPenalties?: Array<{
    season: string;
    fixtureId: number;
    winnerTeamId: number;
    createdAt: string;
    updatedAt: string;
  }>;
  trioLeagueFixtures: Array<{
    id: number;
    gw: string;
    division: string;
    stage: TrioFixtureStage;
    groupSlot: number;
    homeTeamId: number;
    awayTeamId: number;
    createdAt: string;
  }>;
  tierLeagueFixtures: Array<{
    id: number;
    gw: string;
    division: string;
    fixtureType: TierLeagueFixtureType;
    groupSlot: number;
    homeTeamId: number;
    awayTeamId: number;
    createdAt: string;
  }>;
  trioPlayoffPenalties?: Array<{
    season: string;
    fixtureId: number;
    winnerTeamId: number;
    createdAt: string;
    updatedAt: string;
  }>;
  gw8PlayoffPenalties?: Array<{
    season: string;
    fixtureId: number;
    winnerTeamId: number;
    createdAt: string;
    updatedAt: string;
  }>;
  cupFixtures: Array<{
    id: number;
    gw: string;
    roundName: string;
    homeTeamId: number | null;
    awayTeamId: number | null;
    winnerTeamId: number | null;
    sourceGameA: number | null;
    sourceGameB: number | null;
    isManual: number;
  }>;
  superCupFixtures: Array<{
    id: number;
    season: SeasonId;
    gw: string;
    sourceSeason: SeasonId;
    pairingReason: SuperCupPairingReason;
    homeTeamId: number;
    awayTeamId: number;
    winnerTeamId: number | null;
    bookieballWinnerTeamId: number;
    bookieballRunnerUpTeamId: number;
    masterCupWinnerTeamId: number;
    masterCupRunnerUpTeamId: number;
    createdAt: string;
  }>;
  superCupPenalties?: Array<{
    season: string;
    fixtureId: number;
    winnerTeamId: number;
    createdAt: string;
    updatedAt: string;
  }>;
  entries: Array<{
    id: number;
    season: string;
    gw: string;
    teamId: number;
    entryType: EntryType;
    profit: number;
    spins: number | null;
    stake: number | null;
    notes: string | null;
    noWin: number;
    batchId: string | null;
    createdAt: string;
  }>;
  entryBatches: Array<{ id: string; season: string; gw: string; createdAt: string }>;
  gameshowDraws: Array<{ id: number; season: string; gw: string; teamId: number; createdAt: string }>;
  predictions: Array<{
    id: number;
    season: string;
    gw: string;
    competition: string;
    fixtureId: number;
    picker: string;
    pickOutcome: string;
    pickTeamId: number | null;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
    createdAt: string;
  }>;
  awards: Array<{ id: number; season: string; teamId: number; awardType: string; value: string | null; createdAt: string }>;
  settings: Array<{ key: string; value: string }>;
};

function snapshotSettingsForSeason(db: Database.Database, season: SeasonId): Array<{ key: string; value: string }> {
  return db
    .prepare(
      `
      SELECT key, value
      FROM settings
      WHERE key IN ('current_season', 'current_gw', 'cup_tie_break_mode', 'season_finale_pending')
        OR key = ?
        OR key = ?
        OR key = ?
        OR key = ?
        OR key = ?
        OR key = ?
        OR key = ?
        OR key LIKE ?
        OR key LIKE ?
      ORDER BY key
      `,
    )
    .all(
      `cup_draw_started_${season}`,
      `gw8_locked_${season}`,
      `master_league_seed_${season}`,
      `master_cup_seed_${season}`,
      `trio_league_seed_${season}`,
      `tier_league_seed_${season}`,
      `season_finale_${season}`,
      `predictions_locked_${season}_%`,
      `gw_locked_${season}_%`,
    ) as Array<{ key: string; value: string }>;
}

function buildSnapshotPayload(db: Database.Database, season: SeasonId, gw: string): SnapshotPayload {
  ensureMasterCupPenaltyTable(db);
  ensureSuperCupPenaltyTable(db);
  const table = getLeagueTable(db, season, gw);
  const cup = getCupBracket(db, season, gw);
  const superCup = getSuperCupFixtures(db, season);
  const state = getCurrentState(db);
  const seasonTeams = db
    .prepare('SELECT team_id, division FROM season_teams WHERE season = ? ORDER BY team_id')
    .all(season) as Array<{ team_id: number; division: string }>;
  const leagueFixtures = db
    .prepare('SELECT id, gw, division, home_team_id, away_team_id FROM league_fixtures WHERE season = ? ORDER BY id')
    .all(season) as Array<{ id: number; gw: string; division: string; home_team_id: number; away_team_id: number }>;
  const masterLeagueFixtures = db
    .prepare('SELECT id, gw, home_team_id, away_team_id, created_at FROM master_league_fixtures WHERE season = ? ORDER BY id')
    .all(season) as Array<{ id: number; gw: string; home_team_id: number; away_team_id: number; created_at: string }>;
  const masterCupFixtures = db
    .prepare(
      `
      SELECT
        id,
        gw,
        stage,
        tie_slot,
        leg_number,
        home_team_id,
        away_team_id,
        winner_team_id,
        source_fixture_a,
        source_fixture_b,
        source_outcome_a,
        source_outcome_b,
        home_seed,
        away_seed,
        created_at
      FROM master_cup_fixtures
      WHERE season = ?
      ORDER BY id
      `,
    )
    .all(season) as Array<{
    id: number;
    gw: string;
    stage: MasterCupStage;
    tie_slot: number;
    leg_number: number;
    home_team_id: number | null;
    away_team_id: number | null;
    winner_team_id: number | null;
    source_fixture_a: number | null;
    source_fixture_b: number | null;
    source_outcome_a: MasterCupSourceOutcome;
    source_outcome_b: MasterCupSourceOutcome;
    home_seed: number | null;
    away_seed: number | null;
    created_at: string;
  }>;
  const masterCupPenalties = db
    .prepare(
      `
      SELECT season, fixture_id, winner_team_id, created_at, updated_at
      FROM master_cup_penalties
      WHERE season = ?
      ORDER BY fixture_id
      `,
    )
    .all(season) as Array<{
    season: string;
    fixture_id: number;
    winner_team_id: number;
    created_at: string;
    updated_at: string;
  }>;
  const trioLeagueFixtures = db
    .prepare('SELECT id, gw, division, stage, group_slot, home_team_id, away_team_id, created_at FROM trio_league_fixtures WHERE season = ? ORDER BY id')
    .all(season) as Array<{
    id: number;
    gw: string;
    division: string;
    stage: TrioFixtureStage;
    group_slot: number;
    home_team_id: number;
    away_team_id: number;
    created_at: string;
  }>;
  const tierLeagueFixtures = db
    .prepare(
      `
      SELECT id, gw, division, fixture_type, group_slot, home_team_id, away_team_id, created_at
      FROM tier_league_fixtures
      WHERE season = ?
      ORDER BY id
      `,
    )
    .all(season) as Array<{
    id: number;
    gw: string;
    division: string;
    fixture_type: TierLeagueFixtureType;
    group_slot: number;
    home_team_id: number;
    away_team_id: number;
    created_at: string;
  }>;
  const trioPlayoffPenalties = db
    .prepare(
      `
      SELECT season, fixture_id, winner_team_id, created_at, updated_at
      FROM trio_playoff_penalties
      WHERE season = ?
      ORDER BY fixture_id
      `,
    )
    .all(season) as Array<{
    season: string;
    fixture_id: number;
    winner_team_id: number;
    created_at: string;
    updated_at: string;
  }>;
  const gw8PlayoffPenalties = db
    .prepare(
      `
      SELECT season, fixture_id, winner_team_id, created_at, updated_at
      FROM gw8_playoff_penalties
      WHERE season = ?
      ORDER BY fixture_id
      `,
    )
    .all(season) as Array<{
    season: string;
    fixture_id: number;
    winner_team_id: number;
    created_at: string;
    updated_at: string;
  }>;
  const cupFixtures = db
    .prepare(
      `
      SELECT id, gw, round_name, home_team_id, away_team_id, winner_team_id, source_game_a, source_game_b, is_manual
      FROM cup_fixtures
      WHERE season = ?
      ORDER BY id
      `,
    )
    .all(season) as Array<{
    id: number;
    gw: string;
    round_name: string;
    home_team_id: number | null;
    away_team_id: number | null;
    winner_team_id: number | null;
    source_game_a: number | null;
    source_game_b: number | null;
    is_manual: number;
  }>;
  const superCupFixtures = db
    .prepare(
      `
      SELECT
        id,
        season,
        gw,
        source_season,
        pairing_reason,
        home_team_id,
        away_team_id,
        winner_team_id,
        bookieball_winner_team_id,
        bookieball_runner_up_team_id,
        master_cup_winner_team_id,
        master_cup_runner_up_team_id,
        created_at
      FROM super_cup_fixtures
      WHERE season = ?
      ORDER BY id
      `,
    )
    .all(season) as Array<{
    id: number;
    season: SeasonId;
    gw: string;
    source_season: SeasonId;
    pairing_reason: SuperCupPairingReason;
    home_team_id: number;
    away_team_id: number;
    winner_team_id: number | null;
    bookieball_winner_team_id: number;
    bookieball_runner_up_team_id: number;
    master_cup_winner_team_id: number;
    master_cup_runner_up_team_id: number;
    created_at: string;
  }>;
  const superCupPenalties = db
    .prepare(
      `
      SELECT season, fixture_id, winner_team_id, created_at, updated_at
      FROM super_cup_penalties
      WHERE season = ?
      ORDER BY fixture_id
      `,
    )
    .all(season) as Array<{
    season: string;
    fixture_id: number;
    winner_team_id: number;
    created_at: string;
    updated_at: string;
  }>;
  const entries = db
    .prepare(
      `
      SELECT id, season, gw, team_id, entry_type, profit, spins, stake, notes, no_win, batch_id, created_at
      FROM entries
      WHERE season = ?
      ORDER BY id
      `,
    )
    .all(season) as Array<{
    id: number;
    season: string;
    gw: string;
    team_id: number;
    entry_type: EntryType;
    profit: number;
    spins: number | null;
    stake: number | null;
    notes: string | null;
    no_win: number;
    batch_id: string | null;
    created_at: string;
  }>;
  const entryBatches = db
    .prepare('SELECT id, season, gw, created_at FROM entry_batches WHERE season = ? ORDER BY created_at, id')
    .all(season) as Array<{ id: string; season: string; gw: string; created_at: string }>;
  const gameshowDraws = db
    .prepare('SELECT id, season, gw, team_id, created_at FROM gameshow_draws WHERE season = ? ORDER BY id')
    .all(season) as Array<{ id: number; season: string; gw: string; team_id: number; created_at: string }>;
  const predictions = db
    .prepare(
      `
      SELECT id, season, gw, competition, fixture_id, picker, pick_outcome, pick_team_id, predicted_home_score, predicted_away_score, created_at
      FROM predictions
      WHERE season = ?
      ORDER BY id
      `,
    )
    .all(season) as Array<{
    id: number;
    season: string;
    gw: string;
    competition: string;
    fixture_id: number;
    picker: string;
    pick_outcome: string;
    pick_team_id: number | null;
    predicted_home_score: number | null;
    predicted_away_score: number | null;
    created_at: string;
  }>;
  const awards = db
    .prepare('SELECT id, season, team_id, award_type, value, created_at FROM awards WHERE season = ? ORDER BY id')
    .all(season) as Array<{ id: number; season: string; team_id: number; award_type: string; value: string | null; created_at: string }>;
  const settings = snapshotSettingsForSeason(db, season);

  return {
    season,
    gw,
    state,
    table,
    cup,
    superCup,
    seasonTeams: seasonTeams.map((row) => ({ teamId: row.team_id, division: row.division })),
    leagueFixtures: leagueFixtures.map((row) => ({
      id: row.id,
      gw: row.gw,
      division: row.division,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
    })),
    masterLeagueFixtures: masterLeagueFixtures.map((row) => ({
      id: row.id,
      gw: row.gw,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      createdAt: row.created_at,
    })),
    masterCupFixtures: masterCupFixtures.map((row) => ({
      id: row.id,
      gw: row.gw,
      stage: row.stage,
      tieSlot: row.tie_slot,
      legNumber: row.leg_number,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      winnerTeamId: row.winner_team_id,
      sourceFixtureA: row.source_fixture_a,
      sourceFixtureB: row.source_fixture_b,
      sourceOutcomeA: row.source_outcome_a,
      sourceOutcomeB: row.source_outcome_b,
      homeSeed: row.home_seed,
      awaySeed: row.away_seed,
      createdAt: row.created_at,
    })),
    masterCupPenalties: masterCupPenalties.map((row) => ({
      season: row.season,
      fixtureId: row.fixture_id,
      winnerTeamId: row.winner_team_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    trioLeagueFixtures: trioLeagueFixtures.map((row) => ({
      id: row.id,
      gw: row.gw,
      division: row.division,
      stage: row.stage,
      groupSlot: row.group_slot,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      createdAt: row.created_at,
    })),
    tierLeagueFixtures: tierLeagueFixtures.map((row) => ({
      id: row.id,
      gw: row.gw,
      division: row.division,
      fixtureType: row.fixture_type,
      groupSlot: row.group_slot,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      createdAt: row.created_at,
    })),
    trioPlayoffPenalties: trioPlayoffPenalties.map((row) => ({
      season: row.season,
      fixtureId: row.fixture_id,
      winnerTeamId: row.winner_team_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    gw8PlayoffPenalties: gw8PlayoffPenalties.map((row) => ({
      season: row.season,
      fixtureId: row.fixture_id,
      winnerTeamId: row.winner_team_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    cupFixtures: cupFixtures.map((row) => ({
      id: row.id,
      gw: row.gw,
      roundName: row.round_name,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      winnerTeamId: row.winner_team_id,
      sourceGameA: row.source_game_a,
      sourceGameB: row.source_game_b,
      isManual: row.is_manual,
    })),
    superCupFixtures: superCupFixtures.map((row) => ({
      id: row.id,
      season: row.season,
      gw: row.gw,
      sourceSeason: row.source_season,
      pairingReason: row.pairing_reason,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      winnerTeamId: row.winner_team_id,
      bookieballWinnerTeamId: row.bookieball_winner_team_id,
      bookieballRunnerUpTeamId: row.bookieball_runner_up_team_id,
      masterCupWinnerTeamId: row.master_cup_winner_team_id,
      masterCupRunnerUpTeamId: row.master_cup_runner_up_team_id,
      createdAt: row.created_at,
    })),
    superCupPenalties: superCupPenalties.map((row) => ({
      season: row.season,
      fixtureId: row.fixture_id,
      winnerTeamId: row.winner_team_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    entries: entries.map((row) => ({
      id: row.id,
      season: row.season,
      gw: row.gw,
      teamId: row.team_id,
      entryType: row.entry_type,
      profit: row.profit,
      spins: row.spins,
      stake: row.stake,
      notes: row.notes,
      noWin: row.no_win,
      batchId: row.batch_id,
      createdAt: row.created_at,
    })),
    entryBatches: entryBatches.map((row) => ({
      id: row.id,
      season: row.season,
      gw: row.gw,
      createdAt: row.created_at,
    })),
    gameshowDraws: gameshowDraws.map((row) => ({
      id: row.id,
      season: row.season,
      gw: row.gw,
      teamId: row.team_id,
      createdAt: row.created_at,
    })),
    predictions: predictions.map((row) => ({
      id: row.id,
      season: row.season,
      gw: row.gw,
      competition: row.competition,
      fixtureId: row.fixture_id,
      picker: row.picker,
      pickOutcome: row.pick_outcome,
      pickTeamId: row.pick_team_id,
      predictedHomeScore: row.predicted_home_score,
      predictedAwayScore: row.predicted_away_score,
      createdAt: row.created_at,
    })),
    awards: awards.map((row) => ({
      id: row.id,
      season: row.season,
      teamId: row.team_id,
      awardType: row.award_type,
      value: row.value,
      createdAt: row.created_at,
    })),
    settings,
  };
}

export function refreshSnapshotsForSeason(
  db: Database.Database,
  season: SeasonId,
  uptoGw: string,
): { updated: number; inserted: number } {
  const uptoIdx = gwIndex(uptoGw);
  const latestByGw = new Map<string, number>();
  const rows = db
    .prepare('SELECT id, gw FROM gw_snapshots WHERE season = ? ORDER BY id DESC')
    .all(season) as Array<{ id: number; gw: string }>;
  for (const row of rows) {
    if (!latestByGw.has(row.gw)) {
      latestByGw.set(row.gw, row.id);
    }
  }

  let updated = 0;
  let inserted = 0;
  const updateStmt = db.prepare('UPDATE gw_snapshots SET payload_json = ? WHERE id = ?');
  const insertStmt = db.prepare('INSERT INTO gw_snapshots (season, gw, label, payload_json) VALUES (?, ?, ?, ?)');

  for (const gw of GAMEWEEKS) {
    if (gwIndex(gw) > uptoIdx) {
      break;
    }
    const payload = buildSnapshotPayload(db, season, gw);
    const payloadJson = JSON.stringify(payload);
    const existingId = latestByGw.get(gw);
    if (existingId) {
      updateStmt.run(payloadJson, existingId);
      updated += 1;
    } else {
      insertStmt.run(season, gw, 'rebuild', payloadJson);
      inserted += 1;
    }
  }

  return { updated, inserted };
}

export function getSnapshots(db: Database.Database, season: SeasonId): Array<{
  id: number;
  season: string;
  gw: string;
  label: string;
  createdAt: string;
}> {
  return db
    .prepare('SELECT id, season, gw, label, created_at FROM gw_snapshots WHERE season = ? ORDER BY id DESC LIMIT 50')
    .all(season)
    .map((row: { id: number; season: string; gw: string; label: string; created_at: string }) => ({
      id: row.id,
      season: row.season,
      gw: row.gw,
      label: row.label,
      createdAt: row.created_at,
    }));
}

export function getLatestSnapshotPayload(db: Database.Database, season: SeasonId): {
  id: number;
  season: string;
  gw: string;
  label: string;
  createdAt: string;
  payload: Record<string, unknown>;
} | null {
  const row = db
    .prepare('SELECT id, season, gw, label, created_at, payload_json FROM gw_snapshots WHERE season = ? ORDER BY id DESC LIMIT 1')
    .get(season) as { id: number; season: string; gw: string; label: string; created_at: string; payload_json: string } | undefined;
  if (!row) {
    return null;
  }
  try {
    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    return {
      id: row.id,
      season: row.season,
      gw: row.gw,
      label: row.label,
      createdAt: row.created_at,
      payload,
    };
  } catch {
    return null;
  }
}

export function getSnapshotPayloadForGw(db: Database.Database, season: SeasonId, gw: string): {
  id: number;
  season: string;
  gw: string;
  label: string;
  createdAt: string;
  payload: Record<string, unknown>;
} | null {
  const row = db
    .prepare('SELECT id, season, gw, label, created_at, payload_json FROM gw_snapshots WHERE season = ? AND gw = ? ORDER BY id DESC LIMIT 1')
    .get(season, gw) as { id: number; season: string; gw: string; label: string; created_at: string; payload_json: string } | undefined;
  if (!row) {
    return null;
  }
  try {
    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    return {
      id: row.id,
      season: row.season,
      gw: row.gw,
      label: row.label,
      createdAt: row.created_at,
      payload,
    };
  } catch {
    return null;
  }
}

export function getSnapshotPayloadById(db: Database.Database, id: number): {
  id: number;
  season: string;
  gw: string;
  label: string;
  createdAt: string;
  payload: Record<string, unknown>;
} | null {
  const row = db
    .prepare('SELECT id, season, gw, label, created_at, payload_json FROM gw_snapshots WHERE id = ?')
    .get(id) as { id: number; season: string; gw: string; label: string; created_at: string; payload_json: string } | undefined;
  if (!row) {
    return null;
  }
  try {
    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    return {
      id: row.id,
      season: row.season,
      gw: row.gw,
      label: row.label,
      createdAt: row.created_at,
      payload,
    };
  } catch {
    return null;
  }
}

function isRestorableSnapshotPayload(value: Record<string, unknown>): value is SnapshotPayload {
  return (
    Array.isArray(value.seasonTeams)
    && Array.isArray(value.leagueFixtures)
    && Array.isArray(value.cupFixtures)
    && Array.isArray(value.entries)
    && Array.isArray(value.entryBatches)
    && Array.isArray(value.gameshowDraws)
    && Array.isArray(value.predictions)
    && Array.isArray(value.awards)
    && Array.isArray(value.settings)
    && !!value.state
  );
}

export function restoreSnapshotById(
  db: Database.Database,
  id: number,
): { season: string; gw: string; backupPath: string | null } {
  ensureMasterCupPenaltyTable(db);
  const snapshot = getSnapshotPayloadById(db, id);
  if (!snapshot) {
    throw new Error('Snapshot not found.');
  }
  if (!isRestorableSnapshotPayload(snapshot.payload)) {
    throw new Error('Snapshot uses legacy payload format and cannot be fully restored. Create a fresh snapshot first.');
  }

  const payload = snapshot.payload;
  const season = payload.season;
  const gw = payload.gw;
  const masterCupFixtures = Array.isArray((payload as { masterCupFixtures?: unknown }).masterCupFixtures)
    ? (payload as { masterCupFixtures: SnapshotPayload['masterCupFixtures'] }).masterCupFixtures
    : [];
  const trioLeagueFixtures = Array.isArray((payload as { trioLeagueFixtures?: unknown }).trioLeagueFixtures)
    ? (payload as { trioLeagueFixtures: SnapshotPayload['trioLeagueFixtures'] }).trioLeagueFixtures
    : [];
  const tierLeagueFixtures = Array.isArray((payload as { tierLeagueFixtures?: unknown }).tierLeagueFixtures)
    ? (payload as { tierLeagueFixtures: SnapshotPayload['tierLeagueFixtures'] }).tierLeagueFixtures
    : [];
  const superCupFixtures = Array.isArray((payload as { superCupFixtures?: unknown }).superCupFixtures)
    ? (payload as { superCupFixtures: SnapshotPayload['superCupFixtures'] }).superCupFixtures
    : [];
  const superCupPenalties = Array.isArray((payload as { superCupPenalties?: unknown }).superCupPenalties)
    ? (payload as { superCupPenalties: NonNullable<SnapshotPayload['superCupPenalties']> }).superCupPenalties
    : [];
  const masterCupPenalties = Array.isArray((payload as { masterCupPenalties?: unknown }).masterCupPenalties)
    ? (payload as { masterCupPenalties: NonNullable<SnapshotPayload['masterCupPenalties']> }).masterCupPenalties
    : [];
  const trioPlayoffPenalties = Array.isArray((payload as { trioPlayoffPenalties?: unknown }).trioPlayoffPenalties)
    ? (payload as { trioPlayoffPenalties: NonNullable<SnapshotPayload['trioPlayoffPenalties']> }).trioPlayoffPenalties
    : [];
  const gw8PlayoffPenalties = Array.isArray((payload as { gw8PlayoffPenalties?: unknown }).gw8PlayoffPenalties)
    ? (payload as { gw8PlayoffPenalties: NonNullable<SnapshotPayload['gw8PlayoffPenalties']> }).gw8PlayoffPenalties
    : [];
  if (typeof season !== 'string' || typeof gw !== 'string') {
    throw new Error('Snapshot payload is missing season or gameweek metadata.');
  }

  const backupPath = createDatabaseBackup(`pre-restore-snapshot-${id}`);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM entry_audit_log WHERE season = ?').run(season);
    db.prepare('DELETE FROM cup_audit_log WHERE season = ?').run(season);

    db.prepare('DELETE FROM predictions WHERE season = ?').run(season);
    db.prepare('DELETE FROM gameshow_draws WHERE season = ?').run(season);
    db.prepare('DELETE FROM entries WHERE season = ?').run(season);
    db.prepare('DELETE FROM entry_batches WHERE season = ?').run(season);
    db.prepare('DELETE FROM team_trend_cache WHERE season = ?').run(season);
    db.prepare('DELETE FROM awards WHERE season = ?').run(season);
    db.prepare('DELETE FROM master_league_fixtures WHERE season = ?').run(season);
    db.prepare('DELETE FROM master_cup_penalties WHERE season = ?').run(season);
    db.prepare('DELETE FROM master_cup_fixtures WHERE season = ?').run(season);
    db.prepare('DELETE FROM trio_playoff_penalties WHERE season = ?').run(season);
    db.prepare('DELETE FROM trio_league_fixtures WHERE season = ?').run(season);
    db.prepare('DELETE FROM tier_league_fixtures WHERE season = ?').run(season);
    db.prepare('DELETE FROM gw8_playoff_penalties WHERE season = ?').run(season);
    db.prepare('DELETE FROM league_fixtures WHERE season = ?').run(season);
    db.prepare('DELETE FROM cup_fixtures WHERE season = ?').run(season);
    db.prepare('DELETE FROM super_cup_penalties WHERE season = ?').run(season);
    db.prepare('DELETE FROM super_cup_fixtures WHERE season = ?').run(season);
    db.prepare('DELETE FROM season_teams WHERE season = ?').run(season);

    const insertSeasonTeam = db.prepare('INSERT INTO season_teams (season, team_id, division) VALUES (?, ?, ?)');
    payload.seasonTeams.forEach((row) => {
      insertSeasonTeam.run(season, row.teamId, row.division);
    });

    const insertLeagueFixture = db.prepare(
      'INSERT INTO league_fixtures (id, season, gw, division, home_team_id, away_team_id) VALUES (?, ?, ?, ?, ?, ?)',
    );
    payload.leagueFixtures.forEach((row) => {
      insertLeagueFixture.run(row.id, season, row.gw, row.division, row.homeTeamId, row.awayTeamId);
    });

    const insertMasterFixture = db.prepare(
      'INSERT INTO master_league_fixtures (id, season, gw, home_team_id, away_team_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    payload.masterLeagueFixtures.forEach((row) => {
      insertMasterFixture.run(row.id, season, row.gw, row.homeTeamId, row.awayTeamId, row.createdAt);
    });

    const insertMasterCupFixture = db.prepare(
      `
      INSERT INTO master_cup_fixtures (
        id,
        season,
        gw,
        stage,
        tie_slot,
        leg_number,
        home_team_id,
        away_team_id,
        winner_team_id,
        source_fixture_a,
        source_fixture_b,
        source_outcome_a,
        source_outcome_b,
        home_seed,
        away_seed,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    masterCupFixtures.forEach((row) => {
      insertMasterCupFixture.run(
        row.id,
        season,
        row.gw,
        row.stage,
        row.tieSlot,
        row.legNumber,
        row.homeTeamId,
        row.awayTeamId,
        row.winnerTeamId,
        row.sourceFixtureA,
        row.sourceFixtureB,
        row.sourceOutcomeA,
        row.sourceOutcomeB,
        row.homeSeed,
        row.awaySeed,
        row.createdAt,
      );
    });

    const insertMasterCupPenalty = db.prepare(
      `
      INSERT INTO master_cup_penalties (season, fixture_id, winner_team_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      `,
    );
    masterCupPenalties.forEach((row) => {
      insertMasterCupPenalty.run(
        season,
        row.fixtureId,
        row.winnerTeamId,
        row.createdAt,
        row.updatedAt,
      );
    });

    const insertTrioFixture = db.prepare(
      `
      INSERT INTO trio_league_fixtures (id, season, gw, division, stage, group_slot, home_team_id, away_team_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    trioLeagueFixtures.forEach((row) => {
      insertTrioFixture.run(
        row.id,
        season,
        row.gw,
        row.division ?? '',
        row.stage ?? 'regular',
        row.groupSlot,
        row.homeTeamId,
        row.awayTeamId,
        row.createdAt,
      );
    });

    const insertTierFixture = db.prepare(
      `
      INSERT INTO tier_league_fixtures (id, season, gw, division, fixture_type, group_slot, home_team_id, away_team_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    tierLeagueFixtures.forEach((row) => {
      insertTierFixture.run(
        row.id,
        season,
        row.gw,
        row.division,
        row.fixtureType,
        row.groupSlot,
        row.homeTeamId,
        row.awayTeamId,
        row.createdAt,
      );
    });

    const insertTrioPlayoffPenalty = db.prepare(
      `
      INSERT INTO trio_playoff_penalties (season, fixture_id, winner_team_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      `,
    );
    trioPlayoffPenalties.forEach((row) => {
      insertTrioPlayoffPenalty.run(
        season,
        row.fixtureId,
        row.winnerTeamId,
        row.createdAt,
        row.updatedAt,
      );
    });

    const insertGw8PlayoffPenalty = db.prepare(
      `
      INSERT INTO gw8_playoff_penalties (season, fixture_id, winner_team_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      `,
    );
    gw8PlayoffPenalties.forEach((row) => {
      insertGw8PlayoffPenalty.run(
        season,
        row.fixtureId,
        row.winnerTeamId,
        row.createdAt,
        row.updatedAt,
      );
    });

    const insertCupFixture = db.prepare(
      `
      INSERT INTO cup_fixtures (
        id, season, gw, round_name, home_team_id, away_team_id, winner_team_id, source_game_a, source_game_b, is_manual
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    payload.cupFixtures.forEach((row) => {
      insertCupFixture.run(
        row.id,
        season,
        row.gw,
        row.roundName,
        row.homeTeamId,
        row.awayTeamId,
        row.winnerTeamId,
        row.sourceGameA,
        row.sourceGameB,
        row.isManual,
      );
    });

    const insertSuperCupFixture = db.prepare(
      `
      INSERT INTO super_cup_fixtures (
        id,
        season,
        gw,
        source_season,
        pairing_reason,
        home_team_id,
        away_team_id,
        winner_team_id,
        bookieball_winner_team_id,
        bookieball_runner_up_team_id,
        master_cup_winner_team_id,
        master_cup_runner_up_team_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    superCupFixtures.forEach((row) => {
      insertSuperCupFixture.run(
        row.id,
        season,
        row.gw,
        row.sourceSeason,
        row.pairingReason,
        row.homeTeamId,
        row.awayTeamId,
        row.winnerTeamId,
        row.bookieballWinnerTeamId,
        row.bookieballRunnerUpTeamId,
        row.masterCupWinnerTeamId,
        row.masterCupRunnerUpTeamId,
        row.createdAt,
      );
    });

    const insertSuperCupPenalty = db.prepare(
      `
      INSERT INTO super_cup_penalties (season, fixture_id, winner_team_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      `,
    );
    superCupPenalties.forEach((row) => {
      insertSuperCupPenalty.run(
        season,
        row.fixtureId,
        row.winnerTeamId,
        row.createdAt,
        row.updatedAt,
      );
    });

    const insertEntryBatch = db.prepare('INSERT INTO entry_batches (id, season, gw, created_at) VALUES (?, ?, ?, ?)');
    payload.entryBatches.forEach((row) => {
      insertEntryBatch.run(row.id, season, row.gw, row.createdAt);
    });

    const insertEntry = db.prepare(
      `
      INSERT INTO entries (
        id, season, gw, team_id, entry_type, profit, spins, stake, notes, no_win, batch_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    payload.entries.forEach((row) => {
      insertEntry.run(
        row.id,
        season,
        row.gw,
        row.teamId,
        row.entryType,
        row.profit,
        row.spins,
        row.stake,
        row.notes,
        row.noWin,
        row.batchId,
        row.createdAt,
      );
    });

    const insertDraw = db.prepare('INSERT INTO gameshow_draws (id, season, gw, team_id, created_at) VALUES (?, ?, ?, ?, ?)');
    payload.gameshowDraws.forEach((row) => {
      insertDraw.run(row.id, season, row.gw, row.teamId, row.createdAt);
    });

    const insertPrediction = db.prepare(
      `
      INSERT INTO predictions (
        id, season, gw, competition, fixture_id, picker, pick_outcome, pick_team_id, predicted_home_score, predicted_away_score, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    payload.predictions.forEach((row) => {
      insertPrediction.run(
        row.id,
        season,
        row.gw,
        row.competition,
        row.fixtureId,
        row.picker,
        row.pickOutcome,
        row.pickTeamId,
        row.predictedHomeScore,
        row.predictedAwayScore,
        row.createdAt,
      );
    });

    const insertAward = db.prepare(
      'INSERT INTO awards (id, season, team_id, award_type, value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    payload.awards.forEach((row) => {
      insertAward.run(row.id, season, row.teamId, row.awardType, row.value, row.createdAt);
    });

    payload.settings.forEach((settingRow) => {
      setSetting(db, settingRow.key, settingRow.value);
    });

    const stateFromPayload = payload.state;
    const seasonState = typeof stateFromPayload.currentSeason === 'string'
      ? stateFromPayload.currentSeason
      : season;
    const gwState = typeof stateFromPayload.currentGw === 'string'
      ? stateFromPayload.currentGw
      : gw;
    setCurrentState(db, seasonState as SeasonId, gwState);
  });

  db.pragma('foreign_keys = OFF');
  try {
    tx();
  } finally {
    db.pragma('foreign_keys = ON');
  }
  const stateFromPayload = payload.state;
  const seasonState = typeof stateFromPayload.currentSeason === 'string'
    ? stateFromPayload.currentSeason
    : season;
  const gwState = typeof stateFromPayload.currentGw === 'string'
    ? stateFromPayload.currentGw
    : gw;
  ensureSuperCupProgress(db, seasonState as SeasonId);
  recomputeTeamTrendCache(db, seasonState as SeasonId, gwState);
  return { season, gw, backupPath };
}

type GameshowDrawTeam = {
  teamId: number;
  teamKey: string | null;
  teamName: string;
  division: DivisionName;
  teamUrl: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  cupOpponent: string;
  leagueOpponent: string;
  alreadyPlayed: boolean;
  currentGwProfit: number;
  currentGwSpins: number;
};

type GameshowDrawPoolDivision = {
  division: DivisionName;
  teams: GameshowDrawTeam[];
};

function getAvailableGameshowTeams(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<ReturnType<typeof getTeams>[number]> {
  const teams = getTeams(db, season);
  const usedIds = new Set(
    (
      db.prepare('SELECT team_id FROM gameshow_draws WHERE season = ? AND gw = ?').all(season, gw) as Array<{
        team_id: number;
      }>
    ).map((row) => row.team_id),
  );
  return teams.filter((team) => !usedIds.has(team.id));
}

function buildGameshowDrawTeam(
  db: Database.Database,
  season: SeasonId,
  gw: string,
  picked: ReturnType<typeof getTeams>[number],
): GameshowDrawTeam {
  const fixture = db
    .prepare(
      `
      SELECT home_team_id, away_team_id
      FROM cup_fixtures
      WHERE season = ? AND gw = ?
      AND (home_team_id = ? OR away_team_id = ?)
      LIMIT 1
      `,
    )
    .get(season, gw, picked.id, picked.id) as { home_team_id: number | null; away_team_id: number | null } | undefined;

  let cupOpponent = 'No Fixture';
  if (fixture) {
    const opponentId = fixture.home_team_id === picked.id ? fixture.away_team_id : fixture.home_team_id;
    if (opponentId) {
      const opponent = db.prepare('SELECT name FROM teams WHERE id = ?').get(opponentId) as { name: string };
      cupOpponent = opponent.name;
    } else {
      cupOpponent = gw === 'GW2' ? 'BYE' : 'TBD';
    }
  } else if (gw === 'GW1') {
    cupOpponent = 'BYE';
  }

  const leagueFixture = db
    .prepare(
      `
      SELECT home_team_id, away_team_id
      FROM league_fixtures
      WHERE season = ? AND gw = ?
        AND (home_team_id = ? OR away_team_id = ?)
      LIMIT 1
      `,
    )
    .get(season, gw, picked.id, picked.id) as { home_team_id: number; away_team_id: number } | undefined;

  let leagueOpponent = 'No Fixture';
  if (leagueFixture) {
    const opponentId = leagueFixture.home_team_id === picked.id ? leagueFixture.away_team_id : leagueFixture.home_team_id;
    const opponent = db.prepare('SELECT name FROM teams WHERE id = ?').get(opponentId) as { name: string } | undefined;
    if (opponent) {
      leagueOpponent = opponent.name;
    }
  }

  const existingPerf = getTeamGwPerformance(db, season, gw, picked.id);
  const existingEntries = db
    .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
    .get(season, gw, picked.id) as { c: number };

  return {
    teamId: picked.id,
    teamKey: picked.teamId,
    teamName: picked.name,
    division: picked.division,
    teamUrl: picked.url,
    ballColor: picked.ballColor,
    ringColor: picked.ringColor,
    textColor: picked.textColor,
    cupOpponent,
    leagueOpponent,
    alreadyPlayed: existingEntries.c > 0,
    currentGwProfit: Number(existingPerf.profit.toFixed(2)),
    currentGwSpins: existingPerf.spins,
  };
}

function reserveGameshowDrawTeam(db: Database.Database, season: SeasonId, gw: string, teamId: number): void {
  db.prepare('INSERT INTO gameshow_draws (season, gw, team_id) VALUES (?, ?, ?)').run(season, gw, teamId);
}

function getAvailableGameshowDrawPayloads(db: Database.Database, season: SeasonId, gw: string): GameshowDrawTeam[] {
  return getAvailableGameshowTeams(db, season, gw).map((team) => buildGameshowDrawTeam(db, season, gw, team));
}

export function getGameshowDrawPool(db: Database.Database, season: SeasonId, gw: string): GameshowDrawPoolDivision[] {
  const availableTeams = getAvailableGameshowDrawPayloads(db, season, gw);
  const teamsByDivision = new Map<DivisionName, GameshowDrawTeam[]>();
  availableTeams.forEach((team) => {
    const existing = teamsByDivision.get(team.division) ?? [];
    existing.push(team);
    teamsByDivision.set(team.division, existing);
  });

  return getDivisionOrderForSeason(season)
    .map((division) => ({
      division,
      teams: (teamsByDivision.get(division) ?? []).slice().sort((left, right) => left.teamName.localeCompare(right.teamName)),
    }))
    .filter((group) => group.teams.length > 0);
}

export function drawRandomTeam(db: Database.Database, season: SeasonId, gw: string): GameshowDrawTeam | null {
  const available = getAvailableGameshowDrawPayloads(db, season, gw);
  if (available.length === 0) {
    return null;
  }
  const picked = available[Math.floor(Math.random() * available.length)];
  reserveGameshowDrawTeam(db, season, gw, picked.teamId);
  return picked;
}

export function drawSpecificTeam(
  db: Database.Database,
  season: SeasonId,
  gw: string,
  teamId: number,
): GameshowDrawTeam | null {
  const picked = getAvailableGameshowDrawPayloads(db, season, gw).find((team) => team.teamId === teamId) ?? null;
  if (!picked) {
    return null;
  }
  reserveGameshowDrawTeam(db, season, gw, picked.teamId);
  return picked;
}

export function saveEntries(db: Database.Database, state: CurrentState, entries: EntryInput[]): void {
  if (isGameweekLocked(db, state.currentSeason, state.currentGw)) {
    throw new Error(`Gameweek ${state.currentGw} is locked`);
  }

  const batchId = createBatchId();
  db.prepare('INSERT INTO entry_batches (id, season, gw) VALUES (?, ?, ?)').run(batchId, state.currentSeason, state.currentGw);
  const stmt = db.prepare(
    'INSERT INTO entries (season, gw, team_id, entry_type, profit, spins, stake, notes, no_win, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const tx = db.transaction((rows: EntryInput[]) => {
    for (const row of rows) {
      const normalized = normalizeEntryNumbers(row.entryType, row.spins ?? null, row.stake ?? null);
      const storedProfit = computeStoredEntryProfit(
        state.currentSeason,
        row.entryType,
        row.profit,
        normalized.spins,
        normalized.stake,
      );
      stmt.run(
        state.currentSeason,
        state.currentGw,
        row.teamId,
        row.entryType,
        storedProfit,
        normalized.spins,
        normalized.stake,
        row.notes ?? null,
        row.noWin ? 1 : 0,
        batchId,
      );
    }
  });
  tx(entries);

  ensureCupProgress(db, state.currentSeason, state.currentGw);
  ensureSuperCupProgress(db, state.currentSeason);
  recomputeTeamTrendCache(db, state.currentSeason, state.currentGw);
  refreshSnapshotsForSeason(db, state.currentSeason, state.currentGw);
}

export function undoLastEntryBatch(db: Database.Database, state: CurrentState): { batchId: string; removed: number } | null {
  if (isGameweekLocked(db, state.currentSeason, state.currentGw)) {
    throw new Error(`Gameweek ${state.currentGw} is locked`);
  }

  const batch = db
    .prepare('SELECT id FROM entry_batches WHERE season = ? AND gw = ? ORDER BY created_at DESC, id DESC LIMIT 1')
    .get(state.currentSeason, state.currentGw) as { id: string } | undefined;
  if (!batch) {
    return null;
  }

  const tx = db.transaction(() => {
    const removed = db.prepare('DELETE FROM entries WHERE batch_id = ?').run(batch.id).changes;
    db.prepare('DELETE FROM entry_batches WHERE id = ?').run(batch.id);
    ensureCupProgress(db, state.currentSeason, state.currentGw);
    ensureSuperCupProgress(db, state.currentSeason);
    recomputeTeamTrendCache(db, state.currentSeason, state.currentGw);
    refreshSnapshotsForSeason(db, state.currentSeason, state.currentGw);
    return removed;
  });
  const removed = tx();
  return { batchId: batch.id, removed };
}

export function getEntries(
  db: Database.Database,
  season: SeasonId,
  filters: { gw?: string; teamId?: number; entryType?: EntryType; limit?: number; offset?: number } = {},
): Array<{
  id: number;
  season: string;
  gw: string;
  teamId: number;
  teamName: string;
  entryType: EntryType;
  profit: number;
  spins: number | null;
  stake: number | null;
  notes: string | null;
  noWin: boolean;
  batchId: string | null;
  createdAt: string;
  locked: boolean;
}> {
  const clauses = ['e.season = ?'];
  const params: Array<string | number> = [season];

  if (filters.gw) {
    clauses.push('e.gw = ?');
    params.push(filters.gw);
  }
  if (filters.teamId) {
    clauses.push('e.team_id = ?');
    params.push(filters.teamId);
  }
  if (filters.entryType) {
    clauses.push('e.entry_type = ?');
    params.push(filters.entryType);
  }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 1000);
  const offset = Math.max(filters.offset ?? 0, 0);

  const rows = db
    .prepare(
      `
      SELECT
        e.id,
        e.season,
        e.gw,
        e.entry_type,
        e.profit,
        e.spins,
        e.stake,
        e.notes,
        e.no_win,
        e.batch_id,
        e.created_at,
        t.id AS team_id,
        t.name AS team_name
      FROM entries e
      INNER JOIN teams t ON t.id = e.team_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ? OFFSET ?
      `,
    )
    .all(...params, limit, offset) as Array<{
    id: number;
    season: string;
    gw: string;
    entry_type: EntryType;
    profit: number;
    spins: number | null;
    stake: number | null;
    notes: string | null;
    no_win: number;
    batch_id: string | null;
    created_at: string;
    team_id: number;
    team_name: string;
  }>;

  const lockCache = new Map<string, boolean>();
  const isLocked = (entrySeason: string, entryGw: string): boolean => {
    const key = `${entrySeason}:${entryGw}`;
    if (lockCache.has(key)) {
      return lockCache.get(key) ?? false;
    }
    const locked = isGameweekLocked(db, entrySeason as SeasonId, entryGw);
    lockCache.set(key, locked);
    return locked;
  };

  return rows.map((row) => ({
    id: row.id,
    season: row.season,
    gw: row.gw,
    teamId: row.team_id,
    teamName: row.team_name,
    entryType: row.entry_type,
    profit: Number(row.profit),
    spins: row.spins === null ? null : Number(row.spins),
    stake: row.stake === null ? null : Number(row.stake),
    notes: row.notes,
    noWin: row.no_win === 1,
    batchId: row.batch_id,
    createdAt: row.created_at,
    locked: isLocked(row.season, row.gw),
  }));
}

export function getEntryAuditLog(
  db: Database.Database,
  season: SeasonId,
  limit = 50,
): Array<{
  id: number;
  entryId: number;
  teamName: string;
  gw: string;
  action: string;
  actor: string;
  oldProfit: number;
  newProfit: number;
  oldSpins: number | null;
  newSpins: number | null;
  oldStake: number | null;
  newStake: number | null;
  oldEntryType: EntryType | null;
  newEntryType: EntryType | null;
  oldNotes: string | null;
  newNotes: string | null;
  oldNoWin: boolean;
  newNoWin: boolean;
  createdAt: string;
}> {
  const rows = db
    .prepare(
      `
      SELECT
        a.id,
        a.entry_id,
        a.gw,
        a.action,
        a.actor,
        a.old_entry_type,
        a.new_entry_type,
        a.old_profit,
        a.new_profit,
        a.old_spins,
        a.new_spins,
        a.old_stake,
        a.new_stake,
        a.old_notes,
        a.new_notes,
        a.old_no_win,
        a.new_no_win,
        a.created_at,
        t.name AS team_name
      FROM entry_audit_log a
      INNER JOIN entries e ON e.id = a.entry_id
      INNER JOIN teams t ON t.id = e.team_id
      WHERE a.season = ?
      ORDER BY a.id DESC
      LIMIT ?
      `,
    )
    .all(season, Math.min(Math.max(limit, 1), 200)) as Array<{
    id: number;
    entry_id: number;
    gw: string;
    action: string;
    actor: string;
    old_entry_type: EntryType | null;
    new_entry_type: EntryType | null;
    old_profit: number;
    new_profit: number;
    old_spins: number | null;
    new_spins: number | null;
    old_stake: number | null;
    new_stake: number | null;
    old_notes: string | null;
    new_notes: string | null;
    old_no_win: number | null;
    new_no_win: number | null;
    created_at: string;
    team_name: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    entryId: row.entry_id,
    teamName: row.team_name,
    gw: row.gw,
    action: row.action,
    actor: row.actor,
    oldEntryType: row.old_entry_type,
    newEntryType: row.new_entry_type,
    oldProfit: Number(row.old_profit ?? 0),
    newProfit: Number(row.new_profit ?? 0),
    oldSpins: row.old_spins === null ? null : Number(row.old_spins),
    newSpins: row.new_spins === null ? null : Number(row.new_spins),
    oldStake: row.old_stake === null ? null : Number(row.old_stake),
    newStake: row.new_stake === null ? null : Number(row.new_stake),
    oldNotes: row.old_notes,
    newNotes: row.new_notes,
    oldNoWin: row.old_no_win === 1,
    newNoWin: row.new_no_win === 1,
    createdAt: row.created_at,
  }));
}

export function updateEntry(
  db: Database.Database,
  state: CurrentState,
  entryId: number,
  update: { entryType: EntryType; profit: number; spins?: number | null; stake?: number | null; notes?: string | null; noWin?: boolean },
  actor = 'admin',
): void {
  const existing = db
    .prepare('SELECT season, gw, entry_type, profit, spins, stake, notes, no_win FROM entries WHERE id = ?')
    .get(entryId) as {
    season: SeasonId;
    gw: string;
    entry_type: EntryType;
    profit: number;
    spins: number | null;
    stake: number | null;
    notes: string | null;
    no_win: number;
  } | undefined;
  if (!existing) {
    throw new Error('Entry not found');
  }
  if (isGameweekLocked(db, existing.season, existing.gw)) {
    throw new Error(`Gameweek ${existing.gw} is locked`);
  }

  const normalized = normalizeEntryNumbers(update.entryType, update.spins, update.stake);
  const storedProfit = computeStoredEntryProfit(
    existing.season,
    update.entryType,
    update.profit,
    normalized.spins,
    normalized.stake,
  );

  const tx = db.transaction(() => {
    db.prepare(
      `
      UPDATE entries
      SET entry_type = ?, profit = ?, spins = ?, stake = ?, notes = ?, no_win = ?
      WHERE id = ?
      `,
    ).run(
      update.entryType,
      storedProfit,
      normalized.spins,
      normalized.stake,
      update.notes ?? null,
      update.noWin ? 1 : 0,
      entryId,
    );

    db.prepare(
      `
      INSERT INTO entry_audit_log (
        entry_id, season, gw, action, actor,
        old_entry_type, old_profit, old_spins, old_stake, old_notes, old_no_win,
        new_entry_type, new_profit, new_spins, new_stake, new_notes, new_no_win
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      entryId,
      existing.season,
      existing.gw,
      'update',
      actor,
      existing.entry_type,
      existing.profit,
      existing.spins ?? null,
      existing.stake ?? null,
      existing.notes ?? null,
      existing.no_win ?? 0,
      update.entryType,
      storedProfit,
      normalized.spins,
      normalized.stake,
      update.notes ?? null,
      update.noWin ? 1 : 0,
    );
  });
  tx();

  ensureCupProgress(db, state.currentSeason, state.currentGw);
  ensureSuperCupProgress(db, state.currentSeason);
  recomputeTeamTrendCache(db, state.currentSeason, state.currentGw);
  refreshSnapshotsForSeason(db, state.currentSeason, state.currentGw);
}

export function getCupBracket(db: Database.Database, season: SeasonId, upToGw: string): Array<{
  id: number;
  round: number;
  matchNumber: number;
  gw: string;
  roundName: string;
  homeTeam: string | null;
  homeDivision: string | null;
  awayTeam: string | null;
  awayDivision: string | null;
  sourceMatchA: number | null;
  sourceMatchB: number | null;
  winnerTeam: string | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  decidedBy: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending';
}> {
  ensureCupProgress(db, season, upToGw);

  const fixtures = db
    .prepare(
      `
      SELECT
        cf.id,
        cf.gw,
        cf.round_name,
        cf.home_team_id,
        cf.away_team_id,
        cf.winner_team_id,
        cf.source_game_a,
        cf.source_game_b,
        h.name AS home_team,
        hs.division AS home_division,
        a.name AS away_team,
        asn.division AS away_division,
        w.name AS winner_team
      FROM cup_fixtures cf
      LEFT JOIN teams h ON h.id = cf.home_team_id
      LEFT JOIN season_teams hs ON hs.team_id = cf.home_team_id AND hs.season = cf.season
      LEFT JOIN teams a ON a.id = cf.away_team_id
      LEFT JOIN season_teams asn ON asn.team_id = cf.away_team_id AND asn.season = cf.season
      LEFT JOIN teams w ON w.id = cf.winner_team_id
      WHERE cf.season = ?
      ORDER BY CASE cf.gw
        WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3 WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6 ELSE 99 END, cf.id
      `,
    )
    .all(season) as Array<{
    id: number;
    gw: string;
    round_name: string;
    home_team_id: number | null;
    away_team_id: number | null;
    winner_team_id: number | null;
    source_game_a: number | null;
    source_game_b: number | null;
    home_team: string | null;
    home_division: string | null;
    away_team: string | null;
    away_division: string | null;
    winner_team: string | null;
  }>;

  const byGw = new Map<string, typeof fixtures>();
  for (const row of fixtures) {
    const list = byGw.get(row.gw) ?? [];
    list.push(row);
    byGw.set(row.gw, list);
  }

  const idToMatchNumber = new Map<number, number>();
  const gwOrder = ['GW2', 'GW3', 'GW4', 'GW5', 'GW6'];
  for (const gw of gwOrder) {
    const roundRows = byGw.get(gw) ?? [];
    for (let i = 0; i < roundRows.length; i += 1) {
    idToMatchNumber.set(roundRows[i].id, i + 1);
    }
  }

  const seasonNumber = parseSeasonNumber(season);

  return fixtures.map((row) => {
    const homePerf = row.home_team_id
      ? getTeamGwPerformance(db, season, row.gw, row.home_team_id)
      : { profit: 0, wins: 0, spins: 0 };
    const awayPerf = row.away_team_id
      ? getTeamGwPerformance(db, season, row.gw, row.away_team_id)
      : { profit: 0, wins: 0, spins: 0 };
    const homeCount = row.home_team_id
      ? (db.prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?').get(season, row.gw, row.home_team_id) as { c: number })
      : { c: 0 };
    const awayCount = row.away_team_id
      ? (db.prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?').get(season, row.gw, row.away_team_id) as { c: number })
      : { c: 0 };
    const homeProfit = Number(homePerf.profit.toFixed(2));
    const awayProfit = Number(awayPerf.profit.toFixed(2));
    const homeSpins = Number(homePerf.spins ?? 0);
    const awaySpins = Number(awayPerf.spins ?? 0);
    const hasEntries = homeCount.c > 0 || awayCount.c > 0;
    const decidedByBye = row.gw === 'GW2' && Boolean((row.home_team_id && !row.away_team_id) || (!row.home_team_id && row.away_team_id));
    const penaltyStart = seasonNumber >= 4 ? 'GW2' : 'GW4';
    const penaltiesRequired = gwIndex(row.gw) >= gwIndex(penaltyStart);
    let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
    let decidedBy: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending' = 'pending';

    if (decidedByBye) {
      decidedBy = 'bye';
      result = row.home_team_id ? 'home' : 'away';
    } else if (row.home_team_id && row.away_team_id && (hasEntries || row.winner_team_id !== null)) {
      if (homeProfit > awayProfit) {
        result = 'home';
        decidedBy = 'profit';
      } else if (awayProfit > homeProfit) {
        result = 'away';
        decidedBy = 'profit';
      } else if (homeSpins > awaySpins) {
        result = 'home';
        decidedBy = 'spins';
      } else if (awaySpins > homeSpins) {
        result = 'away';
        decidedBy = 'spins';
      } else if (row.winner_team_id === row.home_team_id) {
        result = 'home';
        decidedBy = penaltiesRequired ? 'penalties' : 'tie_break';
      } else if (row.winner_team_id === row.away_team_id) {
        result = 'away';
        decidedBy = penaltiesRequired ? 'penalties' : 'tie_break';
      } else if (hasEntries) {
        result = 'draw';
      }
    }

    return {
      id: row.id,
      round: gwOrder.indexOf(row.gw) + 1,
      matchNumber: idToMatchNumber.get(row.id) ?? 0,
      gw: row.gw,
      roundName: row.round_name,
      homeTeam: row.home_team,
      homeDivision: row.home_division,
      awayTeam: row.away_team,
      awayDivision: row.away_division,
      sourceMatchA: row.source_game_a ? (idToMatchNumber.get(row.source_game_a) ?? null) : null,
      sourceMatchB: row.source_game_b ? (idToMatchNumber.get(row.source_game_b) ?? null) : null,
      winnerTeam: row.winner_team,
      homeProfit,
      awayProfit,
      homeSpins,
      awaySpins,
      played: decidedByBye || hasEntries || row.winner_team_id !== null,
      result,
      decidedBy,
    };
  });
}

export function getTeamStats(db: Database.Database, teamId: number, season: SeasonId): {
  season: { profit: number; wins: number; entries: number };
  allTime: { profit: number; wins: number; entries: number };
  cupWins: number;
  superCupWins: number;
  superCupAppearances: number;
  leagueTitles: number;
} {
  const seasonStats = db
    .prepare('SELECT COALESCE(SUM(profit),0) AS profit, COALESCE(SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END),0) AS wins, COUNT(*) AS entries FROM entries WHERE team_id = ? AND season = ?')
    .get(teamId, season) as { profit: number; wins: number; entries: number };

  const allTimeStats = db
    .prepare('SELECT COALESCE(SUM(profit),0) AS profit, COALESCE(SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END),0) AS wins, COUNT(*) AS entries FROM entries WHERE team_id = ?')
    .get(teamId) as { profit: number; wins: number; entries: number };

  const cupWins = db.prepare("SELECT COUNT(*) as c FROM awards WHERE team_id = ? AND award_type = 'cup_winner'").get(teamId) as { c: number };
  const superCupWins = db.prepare('SELECT COUNT(*) as c FROM super_cup_fixtures WHERE winner_team_id = ?').get(teamId) as { c: number };
  const superCupAppearances = db
    .prepare(
      `
      SELECT COUNT(*) as c
      FROM super_cup_fixtures
      WHERE home_team_id = ? OR away_team_id = ?
      `,
    )
    .get(teamId, teamId) as { c: number };
  const leagueTitles = db.prepare("SELECT COUNT(*) as c FROM awards WHERE team_id = ? AND award_type = 'league_title'").get(teamId) as { c: number };

  return {
    season: seasonStats,
    allTime: allTimeStats,
    cupWins: cupWins.c,
    superCupWins: superCupWins.c,
    superCupAppearances: superCupAppearances.c,
    leagueTitles: leagueTitles.c,
  };
}

export function getTeamSeasonHistory(db: Database.Database, teamId: number): Array<{
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
  superCupFinish: string;
}> {
  const seasonRows = db
    .prepare(
      `
      SELECT season, division
      FROM season_teams
      WHERE team_id = ?
      ORDER BY CAST(SUBSTR(season, 2) AS INTEGER)
      `,
    )
    .all(teamId) as Array<{ season: SeasonId; division: DivisionName }>;

  return seasonRows.map((row) => {
    const table = getLeagueTable(db, row.season, 'GW7');
    const tableRow =
      (table[row.division] ?? []).find((entry) => entry.teamId === teamId)
      ?? Object.values(table).flat().find((entry) => entry.teamId === teamId)
      ?? null;

    const cupPerf = getCupPerformanceByTeam(db, row.season).get(teamId);
    const superCupFixture = getSuperCupFixtures(db, row.season).find(
      (fixture) => fixture.homeTeamId === teamId || fixture.awayTeamId === teamId,
    ) ?? null;
    let cupFinish = 'No cup run';
    if (cupPerf?.isWinner) {
      cupFinish = 'Winner';
    } else if (cupPerf?.isRunnerUp) {
      cupFinish = 'Runner-up';
    } else if (cupPerf?.roundReached) {
      cupFinish = CUP_ROUND_LABEL[cupPerf.roundReached] ?? 'Cup run';
    }
    let superCupFinish = 'No Super Cup';
    if (superCupFixture) {
      if (superCupFixture.winnerTeamId === teamId) {
        superCupFinish = 'Winner';
      } else if (superCupFixture.runnerUpTeamId === teamId) {
        superCupFinish = 'Runner-up';
      } else {
        superCupFinish = 'Participant';
      }
    }

    return {
      season: row.season,
      division: tableRow?.division ?? row.division,
      rank: tableRow?.rank ?? 0,
      points: tableRow?.points ?? 0,
      profit: tableRow?.profit ?? 0,
      spins: tableRow?.spins ?? 0,
      played: tableRow?.played ?? 0,
      wins: tableRow?.wins ?? 0,
      draws: tableRow?.draws ?? 0,
      losses: tableRow?.losses ?? 0,
      cupFinish,
      superCupFinish,
    };
  });
}

function divisionHistoryCutoffGw(season: SeasonId, currentSeason: SeasonId, currentGw: string): string {
  if (season !== currentSeason) {
    return 'GW8';
  }
  return gwNumber(currentGw) > 7 ? 'GW7' : currentGw;
}

function seasonHistoryCutoffGw(season: SeasonId, currentSeason: SeasonId, currentGw: string, archivedGw: string): string {
  return season === currentSeason ? currentGw : archivedGw;
}

function divisionHistoryLevel(season: SeasonId, division: string): number {
  const order = getDivisionOrderForSeason(season);
  const index = order.indexOf(division as DivisionName);
  return index >= 0 ? index + 1 : order.length + 1;
}

export function getTeamHistoryStory(
  db: Database.Database,
  teamId: number,
  currentSeason: SeasonId,
  currentGw: string,
): {
  currentSeason: string;
  currentGw: string;
  currentDivisionJourney: {
    division: string;
    points: Array<{ label: string; gw: string; rank: number; total: number }>;
  };
  divisionJourney: Array<{ season: string; division: string; divisionLevel: number; rank: number; total: number }>;
  masterLeagueJourney: Array<{ season: string; rank: number; total: number }>;
  trioLeagueJourney: Array<{ season: string; division: string; rank: number; total: number }>;
  tierLeagueJourney: Array<{ season: string; division: string; rank: number; total: number }>;
  allTimePointsJourney: Array<{ season: string; rank: number; total: number; points: number }>;
} {
  const seasonRows = db
    .prepare(
      `
      SELECT season, division
      FROM season_teams
      WHERE team_id = ?
      ORDER BY CAST(SUBSTR(season, 2) AS INTEGER)
      `,
    )
    .all(teamId) as Array<{ season: SeasonId; division: DivisionName }>;

  const currentSeasonRow = seasonRows.find((row) => row.season === currentSeason) ?? null;
  const currentDivisionPoints = currentSeasonRow
    ? GAMEWEEKS
      .slice(0, Math.min(7, Math.max(1, gwNumber(divisionHistoryCutoffGw(currentSeason, currentSeason, currentGw)))))
      .map((gw) => {
        const table = getLeagueTable(db, currentSeason, gw);
        const tableRow =
          (table[currentSeasonRow.division] ?? []).find((entry) => entry.teamId === teamId)
          ?? Object.values(table).flat().find((entry) => entry.teamId === teamId)
          ?? null;
        const division = tableRow?.division ?? currentSeasonRow.division;
        const configuredSlots = getDivisionSlotsForSeason(currentSeason)[division] ?? 0;
        const divisionRows = table[division] ?? [];
        const total = Math.max(configuredSlots, divisionRows.length, tableRow?.rank ?? 0, 1);
        return {
          label: gw,
          gw,
          rank: Math.max(1, tableRow?.rank ?? total),
          total,
        };
      })
    : [];

  const divisionJourney = seasonRows.map((row) => {
    const cutoffGw = divisionHistoryCutoffGw(row.season, currentSeason, currentGw);
    const table = getLeagueTable(db, row.season, cutoffGw);
    const tableRow =
      (table[row.division] ?? []).find((entry) => entry.teamId === teamId)
      ?? Object.values(table).flat().find((entry) => entry.teamId === teamId)
      ?? null;
    const division = tableRow?.division ?? row.division;
    const configuredSlots = getDivisionSlotsForSeason(row.season)[division] ?? 0;
    const divisionRows = table[division] ?? [];
    const total = Math.max(configuredSlots, divisionRows.length, tableRow?.rank ?? 0, 1);
    return {
      season: row.season,
      division,
      divisionLevel: divisionHistoryLevel(row.season, division),
      rank: Math.max(1, tableRow?.rank ?? total),
      total,
    };
  });

  const masterLeagueJourney = seasonRows
    .filter((row) => isSeasonFiveOrLater(row.season))
    .flatMap((row) => {
      const cutoffGw = seasonHistoryCutoffGw(row.season, currentSeason, currentGw, 'GW8');
      const table = getMasterLeagueTable(db, row.season, cutoffGw);
      const tableRow = table.find((entry) => entry.teamId === teamId) ?? null;
      if (!tableRow) {
        return [];
      }
      return [{
        season: row.season,
        rank: tableRow.rank,
        total: Math.max(table.length, tableRow.rank, 1),
      }];
    });

  const trioLeagueJourney = seasonRows
    .filter((row) => isSeasonFiveOrLater(row.season))
    .flatMap((row) => {
      const cutoffGw = seasonHistoryCutoffGw(row.season, currentSeason, currentGw, 'GW8');
      const table = getTrioLeagueTable(db, row.season, cutoffGw);
      const tableRow = table.find((entry) => entry.teamId === teamId) ?? null;
      if (!tableRow) {
        return [];
      }
      const divisionRows = table.filter((entry) => entry.division === tableRow.division);
      return [{
        season: row.season,
        division: tableRow.division,
        rank: tableRow.rank,
        total: Math.max(divisionRows.length, tableRow.rank, 1),
      }];
    });

  const tierLeagueJourney = seasonRows
    .filter((row) => isSeasonSixOrLater(row.season))
    .flatMap((row) => {
      if (row.season === currentSeason && gwNumber(currentGw) < gwNumber(getTierLeagueStartGwForSeason(row.season))) {
        return [];
      }
      const cutoffGw = seasonHistoryCutoffGw(row.season, currentSeason, currentGw, getTierLeagueEndGwForSeason(row.season));
      const table = getTierLeagueTable(db, row.season, cutoffGw);
      const tableRow = table.find((entry) => entry.teamId === teamId) ?? null;
      if (!tableRow) {
        return [];
      }
      const divisionRows = table.filter((entry) => entry.division === tableRow.division);
      return [{
        season: row.season,
        division: tableRow.division,
        rank: tableRow.rank,
        total: Math.max(divisionRows.length, tableRow.rank, 1),
      }];
    });

  const allTimePointsJourney = seasonRows
    .flatMap((row) => {
      const cutoffGw = seasonHistoryCutoffGw(row.season, currentSeason, currentGw, 'GW8');
      const pointsTable = getAllTimeLeagues(db, row.season, cutoffGw).pointsTable;
      const tableRow = pointsTable.find((entry) => entry.teamId === teamId) ?? null;
      if (!tableRow) {
        return [];
      }
      return [{
        season: row.season,
        rank: tableRow.rank,
        total: Math.max(pointsTable.length, tableRow.rank, 1),
        points: tableRow.points,
      }];
    });

  return {
    currentSeason,
    currentGw,
    currentDivisionJourney: {
      division: currentSeasonRow?.division ?? '',
      points: currentDivisionPoints,
    },
    divisionJourney,
    masterLeagueJourney,
    trioLeagueJourney,
    tierLeagueJourney,
    allTimePointsJourney,
  };
}

export function getTeamRatings(db: Database.Database): Array<{
  teamId: number;
  teamName: string;
  entries: number;
  wins: number;
  profit: number;
  avgProfit: number;
  winRate: number;
  rating: number;
}> {
  const rows = db
    .prepare(
      `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        COALESCE(SUM(e.profit), 0) AS profit,
        COALESCE(SUM(CASE WHEN e.profit > 0 THEN 1 ELSE 0 END), 0) AS wins,
        COUNT(e.id) AS entries
      FROM teams t
      LEFT JOIN entries e ON e.team_id = t.id
      GROUP BY t.id
      ORDER BY t.name
      `,
    )
    .all() as Array<{
    team_id: number;
    team_name: string;
    profit: number;
    wins: number;
    entries: number;
  }>;

  const profitValues = rows.map((row) => row.profit);
  const winRateValues = rows.map((row) => (row.entries > 0 ? row.wins / row.entries : 0));
  const avgProfitValues = rows.map((row) => (row.entries > 0 ? row.profit / row.entries : 0));

  const mean = (values: number[]): number => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);
  const std = (values: number[]): number => {
    if (values.length === 0) {
      return 1;
    }
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
    return Math.sqrt(variance) || 1;
  };

  const profitMean = mean(profitValues);
  const profitStd = std(profitValues);
  const winMean = mean(winRateValues);
  const winStd = std(winRateValues);
  const avgMean = mean(avgProfitValues);
  const avgStd = std(avgProfitValues);

  return rows.map((row) => {
    const winRate = row.entries > 0 ? row.wins / row.entries : 0;
    const avgProfit = row.entries > 0 ? row.profit / row.entries : 0;
    const profitZ = (row.profit - profitMean) / profitStd;
    const winZ = (winRate - winMean) / winStd;
    const avgZ = (avgProfit - avgMean) / avgStd;
    const rating = Number((profitZ * 0.6 + winZ * 0.3 + avgZ * 0.1).toFixed(3));

    return {
      teamId: row.team_id,
      teamName: row.team_name,
      entries: row.entries,
      wins: row.wins,
      profit: Number(row.profit.toFixed(2)),
      avgProfit: Number(avgProfit.toFixed(2)),
      winRate: Number(winRate.toFixed(3)),
      rating,
    };
  });
}

export function getSeasonGameweekProfitTotals(db: Database.Database): {
  seasons: string[];
  gameweeks: Array<{ gw: string; totals: Record<string, number> }>;
} {
  const seasons = db
    .prepare(
      `
      SELECT DISTINCT season
      FROM (
        SELECT season FROM season_teams
        UNION
        SELECT season FROM entries
      )
      ORDER BY CAST(SUBSTR(season, 2) AS INTEGER)
      `,
    )
    .all() as Array<{ season: string }>;

  const totals = db
    .prepare(
      `
      SELECT season, gw, COALESCE(SUM(profit), 0) AS total_profit
      FROM entries
      GROUP BY season, gw
      `,
    )
    .all() as Array<{ season: string; gw: string; total_profit: number }>;

  const byGw = new Map<string, Record<string, number>>();
  for (const row of totals) {
    const entry = byGw.get(row.gw) ?? {};
    entry[row.season] = Number(row.total_profit.toFixed(2));
    byGw.set(row.gw, entry);
  }

  return {
    seasons: seasons.map((row) => row.season),
    gameweeks: GAMEWEEKS.map((gw) => ({
      gw,
      totals: byGw.get(gw) ?? {},
    })),
  };
}

function getArchivedSeasonIds(db: Database.Database): SeasonId[] {
  const seasons = db
    .prepare('SELECT DISTINCT season FROM season_teams ORDER BY CAST(SUBSTR(season, 2) AS INTEGER)')
    .all() as Array<{ season: string }>;
  const currentSeasonNumber = parseSeasonNumber(getCurrentState(db).currentSeason);

  return seasons
    .map((row) => row.season as SeasonId)
    .filter((season) => {
      const seasonNumber = parseSeasonNumber(season);
      return Number.isFinite(seasonNumber) && seasonNumber < currentSeasonNumber;
    });
}

type LockedAwardType =
  | 'cup_winner'
  | 'league_title'
  | 'goal_of_season'
  | 'bookie_dor'
  | 'master_league_title'
  | 'master_cup_winner'
  | 'super_cup_winner'
  | 'tier_league_title';

type LockedAwardRecord = {
  season: SeasonId;
  teamId: number;
  awardType: LockedAwardType;
  value: string;
};

function insertLockedAward(
  db: Database.Database,
  season: SeasonId,
  teamId: number,
  awardType: LockedAwardType,
  value: string,
): void {
  db.prepare('INSERT OR IGNORE INTO awards (season, team_id, award_type, value) VALUES (?, ?, ?, ?)').run(season, teamId, awardType, value);
}

function collectLockedAwardsFromSeasonFinale(payload: SeasonFinalePayload): LockedAwardRecord[] {
  const awards: LockedAwardRecord[] = [];

  if (payload.cupWinner) {
    awards.push({
      season: payload.season,
      teamId: payload.cupWinner.teamId,
      awardType: 'cup_winner',
      value: '1',
    });
  }

  payload.leagueWinners.forEach((winner) => {
    awards.push({
      season: payload.season,
      teamId: winner.teamId,
      awardType: 'league_title',
      value: winner.division,
    });
  });

  payload.goalsOfSeason.forEach((winner) => {
    awards.push({
      season: payload.season,
      teamId: winner.teamId,
      awardType: 'goal_of_season',
      value: winner.division,
    });
  });

  if (payload.bookieDor?.winner) {
    awards.push({
      season: payload.season,
      teamId: payload.bookieDor.winner.teamId,
      awardType: 'bookie_dor',
      value: 'overall',
    });
  }

  if (payload.masterLeague?.winner) {
    awards.push({
      season: payload.season,
      teamId: payload.masterLeague.winner.teamId,
      awardType: 'master_league_title',
      value: 'overall',
    });
  }

  if (payload.masterCup?.winner) {
    awards.push({
      season: payload.season,
      teamId: payload.masterCup.winner.teamId,
      awardType: 'master_cup_winner',
      value: 'overall',
    });
  }

  if (payload.superCup?.winner) {
    awards.push({
      season: payload.season,
      teamId: payload.superCup.winner.teamId,
      awardType: 'super_cup_winner',
      value: 'overall',
    });
  }

  if (payload.tierLeague?.enabled) {
    payload.tierLeague.table
      .filter((row) => row.rank === 1)
      .forEach((winner) => {
        awards.push({
          season: payload.season,
          teamId: winner.teamId,
          awardType: 'tier_league_title',
          value: winner.division,
        });
      });
  }

  return awards;
}

function ensureArchivedSeasonAwardsLocked(db: Database.Database): { seasonsSynced: number; awardsChanged: number } {
  let seasonsSynced = 0;
  let awardsChanged = 0;

  const syncAwards = db.transaction(() => {
    const upsertAward = db.prepare(
      `
      INSERT INTO awards (season, team_id, award_type, value)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(season, award_type, value) DO UPDATE SET team_id = excluded.team_id
      WHERE awards.team_id <> excluded.team_id
      `,
    );

    getArchivedSeasonIds(db).forEach((season) => {
      const finale = getSeasonFinale(db, season);
      if (!finale) {
        return;
      }

      let changedForSeason = 0;
      collectLockedAwardsFromSeasonFinale(finale).forEach((award) => {
        const info = upsertAward.run(award.season, award.teamId, award.awardType, award.value);
        changedForSeason += Number(info.changes ?? 0);
      });

      if (changedForSeason > 0) {
        seasonsSynced += 1;
        awardsChanged += changedForSeason;
      }
    });
  });

  syncAwards();

  return { seasonsSynced, awardsChanged };
}

function buildHistoricalTierLeagueTitles(db: Database.Database): Record<string, Array<{ season: string; teamName: string }>> {
  const tierLeagues = Object.fromEntries(
    TIER_LEAGUE_DIVISION_ORDER.map((division) => [division, [] as Array<{ season: string; teamName: string }>]),
  ) as Record<string, Array<{ season: string; teamName: string }>>;

  const rows = db
    .prepare(
      `
      SELECT a.season, a.value AS division, t.name AS team_name
      FROM awards a
      INNER JOIN teams t ON t.id = a.team_id
      WHERE a.award_type = 'tier_league_title'
      ORDER BY CAST(SUBSTR(a.season, 2) AS INTEGER), a.created_at
      `,
    )
    .all() as Array<{ season: string; division: string; team_name: string }>;

  rows.forEach((row) => {
    if (!tierLeagues[row.division]) {
      tierLeagues[row.division] = [];
    }
    tierLeagues[row.division].push({ season: row.season, teamName: row.team_name });
  });

  return tierLeagues;
}

export function getTrophyRoom(db: Database.Database): {
  cup: Array<{ season: string; teamName: string }>;
  divisions: Record<string, Array<{ season: string; teamName: string }>>;
  goalsOfSeason: Record<string, Array<{ season: string; teamName: string }>>;
  bookieDor: Array<{ season: string; teamName: string }>;
  masterLeague: Array<{ season: string; teamName: string }>;
  masterCup: Array<{ season: string; teamName: string }>;
  superCup: Array<{ season: string; teamName: string }>;
  tierLeagues: Record<string, Array<{ season: string; teamName: string }>>;
} {
  ensureArchivedSeasonAwardsLocked(db);

  const cupRows = db
    .prepare(
      `
      SELECT a.season, t.name AS team_name
      FROM awards a
      INNER JOIN teams t ON t.id = a.team_id
      WHERE a.award_type = 'cup_winner'
      ORDER BY CAST(SUBSTR(a.season, 2) AS INTEGER), a.created_at
      `,
    )
    .all() as Array<{ season: string; team_name: string }>;

  const divisionRows = db
    .prepare(
      `
      SELECT a.season, a.value AS division, t.name AS team_name
      FROM awards a
      INNER JOIN teams t ON t.id = a.team_id
      WHERE a.award_type = 'league_title'
      ORDER BY CAST(SUBSTR(a.season, 2) AS INTEGER), a.created_at
      `,
    )
    .all() as Array<{ season: string; division: string; team_name: string }>;

  const goalRows = db
    .prepare(
      `
      SELECT a.season, a.value AS division, t.name AS team_name
      FROM awards a
      INNER JOIN teams t ON t.id = a.team_id
      WHERE a.award_type = 'goal_of_season'
      ORDER BY CAST(SUBSTR(a.season, 2) AS INTEGER), a.created_at
      `,
    )
    .all() as Array<{ season: string; division: string; team_name: string }>;

  const bookieDorRows = db
    .prepare(
      `
      SELECT a.season, t.name AS team_name
      FROM awards a
      INNER JOIN teams t ON t.id = a.team_id
      WHERE a.award_type = 'bookie_dor'
      ORDER BY CAST(SUBSTR(a.season, 2) AS INTEGER), a.created_at
      `,
    )
    .all() as Array<{ season: string; team_name: string }>;

  const masterLeagueRows = db
    .prepare(
      `
      SELECT a.season, t.name AS team_name
      FROM awards a
      INNER JOIN teams t ON t.id = a.team_id
      WHERE a.award_type = 'master_league_title'
      ORDER BY CAST(SUBSTR(a.season, 2) AS INTEGER), a.created_at
      `,
    )
    .all() as Array<{ season: string; team_name: string }>;

  const masterCupRows = db
    .prepare(
      `
      SELECT a.season, t.name AS team_name
      FROM awards a
      INNER JOIN teams t ON t.id = a.team_id
      WHERE a.award_type = 'master_cup_winner'
      ORDER BY CAST(SUBSTR(a.season, 2) AS INTEGER), a.created_at
      `,
    )
    .all() as Array<{ season: string; team_name: string }>;
  const superCupRows = db
    .prepare(
      `
      SELECT a.season, t.name AS team_name
      FROM awards a
      INNER JOIN teams t ON t.id = a.team_id
      WHERE a.award_type = 'super_cup_winner'
      ORDER BY CAST(SUBSTR(a.season, 2) AS INTEGER), a.created_at
      `,
    )
    .all() as Array<{ season: string; team_name: string }>;
  const tierLeagues = buildHistoricalTierLeagueTitles(db);

  const divisions: Record<string, Array<{ season: string; teamName: string }>> = {};
  const goalsOfSeason: Record<string, Array<{ season: string; teamName: string }>> = {};
  for (const division of [...DIVISION_ORDER, DIVISION_FOUR]) {
    divisions[division] = [];
    goalsOfSeason[division] = [];
  }
  for (const row of divisionRows) {
    if (!divisions[row.division]) {
      divisions[row.division] = [];
    }
    divisions[row.division].push({ season: row.season, teamName: row.team_name });
  }
  for (const row of goalRows) {
    if (!goalsOfSeason[row.division]) {
      goalsOfSeason[row.division] = [];
    }
    goalsOfSeason[row.division].push({ season: row.season, teamName: row.team_name });
  }

  return {
    cup: cupRows.map((row) => ({ season: row.season, teamName: row.team_name })),
    divisions,
    goalsOfSeason,
    bookieDor: bookieDorRows.map((row) => ({ season: row.season, teamName: row.team_name })),
    masterLeague: masterLeagueRows.map((row) => ({ season: row.season, teamName: row.team_name })),
    masterCup: masterCupRows.map((row) => ({ season: row.season, teamName: row.team_name })),
    superCup: superCupRows.map((row) => ({ season: row.season, teamName: row.team_name })),
    tierLeagues,
  };
}

export function getSeasonAchievements(db: Database.Database, season: SeasonId): Array<{ key: string; label: string; teamName: string; value: string }> {
  const superCupWinner = getSuperCupFixtures(db, season)[0] ?? null;
  const topProfit = db
    .prepare(
      `
      SELECT t.name AS team_name, COALESCE(SUM(e.profit), 0) AS value
      FROM entries e
      INNER JOIN teams t ON t.id = e.team_id
      WHERE e.season = ?
      GROUP BY e.team_id
      ORDER BY value DESC, t.name
      LIMIT 1
      `,
    )
    .get(season) as { team_name: string; value: number } | undefined;
  const topWins = db
    .prepare(
      `
      SELECT t.name AS team_name, COALESCE(SUM(CASE WHEN e.profit > 0 THEN 1 ELSE 0 END), 0) AS value
      FROM entries e
      INNER JOIN teams t ON t.id = e.team_id
      WHERE e.season = ?
      GROUP BY e.team_id
      ORDER BY value DESC, t.name
      LIMIT 1
      `,
    )
    .get(season) as { team_name: string; value: number } | undefined;
  const topSingle = db
    .prepare(
      `
      SELECT t.name AS team_name, e.gw, e.profit
      FROM entries e
      INNER JOIN teams t ON t.id = e.team_id
      WHERE e.season = ?
      ORDER BY e.profit DESC, t.name
      LIMIT 1
      `,
    )
    .get(season) as { team_name: string; gw: string; profit: number } | undefined;

  return [
    {
      key: 'super_cup',
      label: 'Super Cup',
      teamName: superCupWinner?.winnerTeam ?? 'TBD',
      value: superCupWinner?.winnerTeam ? (superCupWinner.runnerUpTeam ? `Beat ${superCupWinner.runnerUpTeam}` : 'Season opener won') : 'Curtain-raiser pending',
    },
    {
      key: 'top_profit',
      label: 'Most Total Profit',
      teamName: topProfit?.team_name ?? 'TBD',
      value: topProfit ? `${Number(topProfit.value.toFixed(2))}` : '0',
    },
    {
      key: 'most_wins',
      label: 'Most Winning Entries',
      teamName: topWins?.team_name ?? 'TBD',
      value: topWins ? `${topWins.value}` : '0',
    },
    {
      key: 'best_single',
      label: 'Best Single GW Profit',
      teamName: topSingle?.team_name ?? 'TBD',
      value: topSingle ? `${Number(topSingle.profit.toFixed(2))} (${topSingle.gw})` : '0',
    },
  ];
}

export function getHeadToHead(
  db: Database.Database,
  season: SeasonId,
  teamAId: number,
  teamBId: number,
): {
  teamA: { id: number; name: string };
  teamB: { id: number; name: string };
  played: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  meetings: Array<{ gw: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; result: 'home' | 'away' | 'draw' | 'pending' }>;
} {
  const a = db.prepare('SELECT id, name FROM teams WHERE id = ?').get(teamAId) as { id: number; name: string } | undefined;
  const b = db.prepare('SELECT id, name FROM teams WHERE id = ?').get(teamBId) as { id: number; name: string } | undefined;
  if (!a || !b) {
    throw new Error('Invalid team id');
  }

  const fixtures = db
    .prepare(
      `
      SELECT lf.id, lf.gw, lf.division, lf.home_team_id, lf.away_team_id, ht.name AS home_name, at.name AS away_name
      FROM league_fixtures lf
      INNER JOIN teams ht ON ht.id = lf.home_team_id
      INNER JOIN teams at ON at.id = lf.away_team_id
      WHERE lf.season = ?
        AND ((lf.home_team_id = ? AND lf.away_team_id = ?) OR (lf.home_team_id = ? AND lf.away_team_id = ?))
      ORDER BY CASE lf.gw
        WHEN 'GW1' THEN 1 WHEN 'GW2' THEN 2 WHEN 'GW3' THEN 3
        WHEN 'GW4' THEN 4 WHEN 'GW5' THEN 5 WHEN 'GW6' THEN 6
        WHEN 'GW7' THEN 7 WHEN 'GW8' THEN 8 ELSE 99 END
      `,
    )
    .all(season, teamAId, teamBId, teamBId, teamAId) as Array<{
    id: number;
    gw: string;
    division: string;
    home_team_id: number;
    away_team_id: number;
    home_name: string;
    away_name: string;
  }>;

  let teamAWins = 0;
  let teamBWins = 0;
  let draws = 0;
  const meetings = fixtures.map((fixture) => {
    const homePerf = getTeamGwPerformance(db, season, fixture.gw, fixture.home_team_id);
    const awayPerf = getTeamGwPerformance(db, season, fixture.gw, fixture.away_team_id);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.home_team_id) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, fixture.gw, fixture.away_team_id) as { c: number };
    const result = resolveLeagueFixtureResult({
      db,
      season,
      fixtureId: fixture.id,
      gw: fixture.gw,
      division: fixture.division,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeProfit: homePerf.profit,
      awayProfit: awayPerf.profit,
      homeEntries: homeCount.c,
      awayEntries: awayCount.c,
    });
    if (result === 'home') {
      if (fixture.home_team_id === teamAId) {
        teamAWins += 1;
      } else {
        teamBWins += 1;
      }
    } else if (result === 'away') {
      if (fixture.away_team_id === teamAId) {
        teamAWins += 1;
      } else {
        teamBWins += 1;
      }
    } else if (result === 'draw') {
      draws += 1;
    }
    return {
      gw: fixture.gw,
      homeTeam: fixture.home_name,
      awayTeam: fixture.away_name,
      homeProfit: Number(homePerf.profit.toFixed(2)),
      awayProfit: Number(awayPerf.profit.toFixed(2)),
      result,
    };
  });

  return {
    teamA: a,
    teamB: b,
    played: teamAWins + teamBWins + draws,
    teamAWins,
    teamBWins,
    draws,
    meetings,
  };
}

export function advanceGameweek(db: Database.Database): CurrentState {
  const state = getCurrentState(db);
  const currentIdx = gwIndex(state.currentGw);
  ensureCupProgress(db, state.currentSeason, state.currentGw);
  const unresolvedCupTies = getCupTieFixturesForRange(db, state.currentSeason, state.currentGw);
  if (unresolvedCupTies.length > 0) {
    throw new Error(`Complete penalty shootouts for ${unresolvedCupTies.length} tied BookieBall Cup fixture(s) before advancing.`);
  }
  const unresolvedSuperCupTies = getSuperCupTieFixtures(db, state.currentSeason, state.currentGw);
  if (unresolvedSuperCupTies.length > 0) {
    throw new Error(`Complete penalty shootouts for ${unresolvedSuperCupTies.length} tied Super Cup fixture(s) before advancing.`);
  }
  const unresolvedMasterCupTies = getMasterCupTieFixtures(db, state.currentSeason, state.currentGw);
  if (unresolvedMasterCupTies.length > 0) {
    throw new Error(`Complete penalty shootouts for ${unresolvedMasterCupTies.length} tied Master Cup fixture(s) before advancing.`);
  }
  const unresolvedTrioPlayoffTies = getTrioPlayoffTieFixtures(db, state.currentSeason, state.currentGw);
  if (unresolvedTrioPlayoffTies.length > 0) {
    throw new Error(`Complete penalty shootouts for ${unresolvedTrioPlayoffTies.length} tied Trio playoff fixture(s) before advancing.`);
  }

  if (currentIdx === GAMEWEEKS.length - 1) {
    const unresolvedGw8PlayoffTies = getGw8PlayoffTieFixtures(db, state.currentSeason);
    if (unresolvedGw8PlayoffTies.length > 0) {
      throw new Error(`Complete penalty shootouts for ${unresolvedGw8PlayoffTies.length} tied GW8 playoff fixture(s) before advancing.`);
    }
    const newSeason = applySeasonRollover(db, state.currentSeason);
    setCurrentState(db, newSeason, 'GW1');
    ensureSuperCupProgress(db, newSeason);
    recomputeTeamTrendCache(db, newSeason, 'GW1');
    captureGwSnapshot(db, newSeason, 'GW1', 'season_rollover');
    return { currentSeason: newSeason, currentGw: 'GW1' };
  }

  const newGw = GAMEWEEKS[currentIdx + 1];
  if (newGw === 'GW8') {
    ensureGw8Fixtures(db, state.currentSeason);
  }
  if (isSeasonFiveOrLater(state.currentSeason) && gwIndex(newGw) <= gwIndex('GW6')) {
    loadMasterCupFixturesForRange(db, state.currentSeason, 'GW1', newGw);
  }
  if (isSeasonFiveOrLater(state.currentSeason) && (newGw === 'GW7' || newGw === 'GW8')) {
    loadTrioLeagueFixturesForRange(db, state.currentSeason, 'GW1', newGw);
  }
  const currentTierStartGw = getTierLeagueStartGwForSeason(state.currentSeason);
  const currentTierEndGw = getTierLeagueEndGwForSeason(state.currentSeason);
  if (isSeasonSixOrLater(state.currentSeason) && gwIndex(newGw) >= gwIndex(currentTierStartGw)) {
    loadTierLeagueFixturesForRange(db, state.currentSeason, currentTierStartGw, currentTierEndGw);
  }
  setCurrentState(db, state.currentSeason, newGw);
  ensureCupProgress(db, state.currentSeason, newGw);
  ensureSuperCupProgress(db, state.currentSeason);
  recomputeTeamTrendCache(db, state.currentSeason, newGw);
  captureGwSnapshot(db, state.currentSeason, newGw, 'advance_gw');
  return { currentSeason: state.currentSeason, currentGw: newGw };
}

export function rewindGameweek(db: Database.Database): CurrentState {
  const state = getCurrentState(db);
  lockGameweekWithSnapshot(db, state, 'rewind_source_lock');

  const currentIdx = gwIndex(state.currentGw);
  if (currentIdx > 0) {
    const targetGw = GAMEWEEKS[currentIdx - 1];
    clearGameweekLocksFrom(db, state.currentSeason, targetGw);
    clearSuperCupProgressFromGameweek(db, state.currentSeason, targetGw);
    if (isSeasonFiveOrLater(state.currentSeason) && gwIndex(targetGw) <= gwIndex('GW6')) {
      clearMasterCupProgressFromGameweek(db, state.currentSeason, targetGw);
    }
    if (isSeasonFiveOrLater(state.currentSeason) && gwIndex(targetGw) <= gwIndex('GW6')) {
      loadMasterCupFixturesForRange(db, state.currentSeason, 'GW1', targetGw);
    }
    if (isSeasonFiveOrLater(state.currentSeason) && (targetGw === 'GW7' || targetGw === 'GW8')) {
      loadTrioLeagueFixturesForRange(db, state.currentSeason, 'GW1', targetGw);
    }
    const currentTierStartGw = getTierLeagueStartGwForSeason(state.currentSeason);
    const currentTierEndGw = getTierLeagueEndGwForSeason(state.currentSeason);
    if (isSeasonSixOrLater(state.currentSeason) && gwIndex(targetGw) >= gwIndex(currentTierStartGw)) {
      loadTierLeagueFixturesForRange(db, state.currentSeason, currentTierStartGw, currentTierEndGw);
    }
    setCurrentState(db, state.currentSeason, targetGw);
    assignDivisionsForSeason(db, state.currentSeason);
    ensureCupProgress(db, state.currentSeason, targetGw);
    ensureSuperCupProgress(db, state.currentSeason);
    recomputeTeamTrendCache(db, state.currentSeason, targetGw);
    captureGwSnapshot(db, state.currentSeason, targetGw, 'rewind_gw');
    return { currentSeason: state.currentSeason, currentGw: targetGw };
  }

  const seasonNumber = Number(state.currentSeason.replace('S', ''));
  if (!Number.isFinite(seasonNumber) || seasonNumber <= 1) {
    throw new Error('Already at the earliest gameweek. Cannot rewind further.');
  }

  const previousSeason = `S${seasonNumber - 1}` as SeasonId;
  const targetGw = GAMEWEEKS[GAMEWEEKS.length - 1];
  clearGameweekLocksFrom(db, previousSeason, targetGw);
  clearSuperCupProgressFromGameweek(db, previousSeason, targetGw);
  ensureGw8Fixtures(db, previousSeason);
  if (isSeasonFiveOrLater(previousSeason)) {
    clearMasterCupProgressFromGameweek(db, previousSeason, 'GW1');
    loadMasterCupFixturesForRange(db, previousSeason, 'GW1', 'GW6');
  }
  if (isSeasonFiveOrLater(previousSeason)) {
    loadTrioLeagueFixturesForRange(db, previousSeason, 'GW1', targetGw);
  }
  if (isSeasonSixOrLater(previousSeason)) {
    loadTierLeagueFixturesForRange(
      db,
      previousSeason,
      getTierLeagueStartGwForSeason(previousSeason),
      getTierLeagueEndGwForSeason(previousSeason),
    );
  }
  setCurrentState(db, previousSeason, targetGw);
  assignDivisionsForSeason(db, previousSeason);
  ensureCupProgress(db, previousSeason, targetGw);
  ensureSuperCupProgress(db, previousSeason);
  recomputeTeamTrendCache(db, previousSeason, targetGw);
  captureGwSnapshot(db, previousSeason, targetGw, 'rewind_gw');
  return { currentSeason: previousSeason, currentGw: targetGw };
}

export function setGameweek(db: Database.Database, season: SeasonId, gw: string): CurrentState {
  if (gw === 'GW8') {
    ensureGw8Fixtures(db, season);
  }
  if (isSeasonFiveOrLater(season) && gwIndex(gw) <= gwIndex('GW6')) {
    loadMasterCupFixturesForRange(db, season, 'GW1', gw);
  }
  if (isSeasonFiveOrLater(season) && (gw === 'GW7' || gw === 'GW8')) {
    loadTrioLeagueFixturesForRange(db, season, 'GW1', gw);
  }
  const tierStartGw = getTierLeagueStartGwForSeason(season);
  const tierEndGw = getTierLeagueEndGwForSeason(season);
  if (isSeasonSixOrLater(season) && gwIndex(gw) >= gwIndex(tierStartGw)) {
    loadTierLeagueFixturesForRange(db, season, tierStartGw, tierEndGw);
  }
  setCurrentState(db, season, gw);
  assignDivisionsForSeason(db, season);
  ensureCupProgress(db, season, gw);
  ensureSuperCupProgress(db, season);
  recomputeTeamTrendCache(db, season, gw);
  captureGwSnapshot(db, season, gw, 'set_gw');
  return { currentSeason: season, currentGw: gw as CurrentState['currentGw'] };
}

type PredictionCompetition = 'league' | 'cup' | 'master' | 'master_cup' | 'trio' | 'tier';
type PredictionOutcome = 'team' | 'draw';
type PredictionSlateEntry = { competition: PredictionCompetition; fixtureId: number };

const PREDICTION_PLAYERS = ['Jay', 'Computer'];
const PREDICTION_SLATE_SIZE = 10;

function predictionLockKey(season: SeasonId, gw: string): string {
  return `predictions_locked_${season}_${gw}`;
}

function predictionSlateKey(season: SeasonId, gw: string): string {
  return `prediction_slate_${season}_${gw}`;
}

function hashPredictionSeed(input: string): number {
  let hash = 0;
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = (hash * 31 + input.charCodeAt(idx)) >>> 0;
  }
  return hash;
}

function predictionSlateEntryKey(entry: PredictionSlateEntry): string {
  return `${entry.competition}-${entry.fixtureId}`;
}

function parsePredictionSlate(raw: string | null): PredictionSlateEntry[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((row) => {
        if (!row || typeof row !== 'object') {
          return null;
        }
        const competition = (row as { competition?: unknown }).competition;
        const fixtureId = Number((row as { fixtureId?: unknown }).fixtureId);
        if (
          competition !== 'league'
          && competition !== 'cup'
          && competition !== 'master'
          && competition !== 'master_cup'
          && competition !== 'trio'
          && competition !== 'tier'
        ) {
          return null;
        }
        if (!Number.isFinite(fixtureId)) {
          return null;
        }
        return { competition, fixtureId };
      })
      .filter((row): row is PredictionSlateEntry => row !== null);
  } catch {
    return [];
  }
}

export function isPredictionsLocked(db: Database.Database, season: SeasonId, gw: string): boolean {
  return getSetting(db, predictionLockKey(season, gw)) === '1';
}

export function setPredictionsLocked(db: Database.Database, season: SeasonId, gw: string, locked: boolean): void {
  setSetting(db, predictionLockKey(season, gw), locked ? '1' : '0');
}

function getLeagueFixturesForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; division: string; homeTeamId: number; awayTeamId: number }> {
  if (gw === 'GW8') {
    ensureGw8Fixtures(db, season);
  }

  return db
    .prepare(
      `
      SELECT id, division, home_team_id as homeTeamId, away_team_id as awayTeamId
      FROM league_fixtures
      WHERE season = ? AND gw = ?
      ORDER BY id
      `,
    )
    .all(season, gw) as Array<{ id: number; division: string; homeTeamId: number; awayTeamId: number }>;
}

function getLeagueResultsForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; outcome: 'home' | 'away' | 'draw' | null; winnerTeamId: number | null }> {
  const fixtures = getLeagueFixturesForPrediction(db, season, gw);
  return fixtures.map((fixture) => {
    const homePerf = getTeamGwPerformance(db, season, gw, fixture.homeTeamId);
    const awayPerf = getTeamGwPerformance(db, season, gw, fixture.awayTeamId);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, gw, fixture.homeTeamId) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, gw, fixture.awayTeamId) as { c: number };
    const result = resolveLeagueFixtureResult({
      db,
      season,
      fixtureId: fixture.id,
      gw,
      division: fixture.division,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeProfit: homePerf.profit,
      awayProfit: awayPerf.profit,
      homeEntries: homeCount.c,
      awayEntries: awayCount.c,
    });
    if (result === 'pending') {
      return { id: fixture.id, outcome: null, winnerTeamId: null };
    }
    if (result === 'home') {
      return { id: fixture.id, outcome: 'home', winnerTeamId: fixture.homeTeamId };
    }
    if (result === 'away') {
      return { id: fixture.id, outcome: 'away', winnerTeamId: fixture.awayTeamId };
    }
    return { id: fixture.id, outcome: 'draw', winnerTeamId: null };
  });
}

function getCupFixturesForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; homeTeamId: number | null; awayTeamId: number | null; winnerTeamId: number | null }> {
  return db
    .prepare(
      `
      SELECT id, home_team_id as homeTeamId, away_team_id as awayTeamId, winner_team_id as winnerTeamId
      FROM cup_fixtures
      WHERE season = ? AND gw = ?
      ORDER BY id
      `,
    )
    .all(season, gw) as Array<{ id: number; homeTeamId: number | null; awayTeamId: number | null; winnerTeamId: number | null }>;
}

function getMasterFixturesForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; homeTeamId: number; awayTeamId: number }> {
  loadMasterLeagueFixturesForRange(db, season, 'GW1', gw);
  return db
    .prepare(
      `
      SELECT id, home_team_id as homeTeamId, away_team_id as awayTeamId
      FROM master_league_fixtures
      WHERE season = ? AND gw = ?
      ORDER BY id
      `,
    )
    .all(season, gw) as Array<{ id: number; homeTeamId: number; awayTeamId: number }>;
}

function getMasterResultsForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; outcome: 'home' | 'away' | 'draw' | null; winnerTeamId: number | null }> {
  const fixtures = getMasterFixturesForPrediction(db, season, gw);
  return fixtures.map((fixture) => {
    const homePerf = getTeamGwPerformance(db, season, gw, fixture.homeTeamId);
    const awayPerf = getTeamGwPerformance(db, season, gw, fixture.awayTeamId);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, gw, fixture.homeTeamId) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, gw, fixture.awayTeamId) as { c: number };

    if (homeCount.c === 0 && awayCount.c === 0) {
      return { id: fixture.id, outcome: null, winnerTeamId: null };
    }
    if (homePerf.profit > awayPerf.profit) {
      return { id: fixture.id, outcome: 'home', winnerTeamId: fixture.homeTeamId };
    }
    if (awayPerf.profit > homePerf.profit) {
      return { id: fixture.id, outcome: 'away', winnerTeamId: fixture.awayTeamId };
    }
    return { id: fixture.id, outcome: 'draw', winnerTeamId: null };
  });
}

function getMasterCupFixturesForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; homeTeamId: number | null; awayTeamId: number | null; stage: MasterCupStage; legNumber: number }> {
  if (!isSeasonFiveOrLater(season)) {
    return [];
  }
  loadMasterCupFixturesForRange(db, season, 'GW1', gw);
  return db
    .prepare(
      `
      SELECT id, home_team_id as homeTeamId, away_team_id as awayTeamId, stage, leg_number as legNumber
      FROM master_cup_fixtures
      WHERE season = ? AND gw = ?
      ORDER BY id
      `,
    )
    .all(season, gw) as Array<{ id: number; homeTeamId: number | null; awayTeamId: number | null; stage: MasterCupStage; legNumber: number }>;
}

function getMasterCupResultsForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; outcome: 'home' | 'away' | 'draw' | null; winnerTeamId: number | null }> {
  const fixtures = getMasterCupFixturesForPrediction(db, season, gw);
  return fixtures.map((fixture) => {
    if (!fixture.homeTeamId || !fixture.awayTeamId) {
      return { id: fixture.id, outcome: null, winnerTeamId: null };
    }
    const homeMetrics = getMasterCupTeamGwMetrics(db, season, gw, fixture.homeTeamId);
    const awayMetrics = getMasterCupTeamGwMetrics(db, season, gw, fixture.awayTeamId);
    if (homeMetrics.entryCount === 0 && awayMetrics.entryCount === 0) {
      return { id: fixture.id, outcome: null, winnerTeamId: null };
    }

    if (fixture.stage === 'semi_final') {
      if (homeMetrics.profit > awayMetrics.profit) {
        return { id: fixture.id, outcome: 'home', winnerTeamId: fixture.homeTeamId };
      }
      if (awayMetrics.profit > homeMetrics.profit) {
        return { id: fixture.id, outcome: 'away', winnerTeamId: fixture.awayTeamId };
      }
      return { id: fixture.id, outcome: 'draw', winnerTeamId: null };
    }

    if (homeMetrics.profit > awayMetrics.profit) {
      return { id: fixture.id, outcome: 'home', winnerTeamId: fixture.homeTeamId };
    }
    if (awayMetrics.profit > homeMetrics.profit) {
      return { id: fixture.id, outcome: 'away', winnerTeamId: fixture.awayTeamId };
    }
    if (homeMetrics.spins > awayMetrics.spins) {
      return { id: fixture.id, outcome: 'home', winnerTeamId: fixture.homeTeamId };
    }
    if (awayMetrics.spins > homeMetrics.spins) {
      return { id: fixture.id, outcome: 'away', winnerTeamId: fixture.awayTeamId };
    }
    const winnerTeamId = resolveMasterCupFixtureWinner(db, season, fixture.id);
    if (winnerTeamId === fixture.homeTeamId) {
      return { id: fixture.id, outcome: 'home', winnerTeamId };
    }
    if (winnerTeamId === fixture.awayTeamId) {
      return { id: fixture.id, outcome: 'away', winnerTeamId };
    }
    return { id: fixture.id, outcome: null, winnerTeamId: null };
  });
}

function getTrioFixturesForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; homeTeamId: number; awayTeamId: number; stage: TrioFixtureStage }> {
  if (!isSeasonFiveOrLater(season)) {
    return [];
  }
  loadTrioLeagueFixturesForRange(db, season, 'GW1', gw);
  return db
    .prepare(
      `
      SELECT id, home_team_id as homeTeamId, away_team_id as awayTeamId, stage
      FROM trio_league_fixtures
      WHERE season = ? AND gw = ?
      ORDER BY id
      `,
    )
    .all(season, gw) as Array<{ id: number; homeTeamId: number; awayTeamId: number; stage: TrioFixtureStage }>;
}

function trioFixtureAllowsDraw(fixture: { stage: TrioFixtureStage }): boolean {
  return fixture.stage === 'regular';
}

function getTrioResultsForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; outcome: 'home' | 'away' | 'draw' | null; winnerTeamId: number | null }> {
  const fixtures = getTrioFixturesForPrediction(db, season, gw);
  return fixtures.map((fixture) => {
    const homePerf = getTeamGwPerformance(db, season, gw, fixture.homeTeamId);
    const awayPerf = getTeamGwPerformance(db, season, gw, fixture.awayTeamId);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, gw, fixture.homeTeamId) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, gw, fixture.awayTeamId) as { c: number };

    if (homeCount.c === 0 && awayCount.c === 0) {
      return { id: fixture.id, outcome: null, winnerTeamId: null };
    }
    if (homePerf.profit > awayPerf.profit) {
      return { id: fixture.id, outcome: 'home', winnerTeamId: fixture.homeTeamId };
    }
    if (awayPerf.profit > homePerf.profit) {
      return { id: fixture.id, outcome: 'away', winnerTeamId: fixture.awayTeamId };
    }
    if (fixture.stage === 'regular') {
      return { id: fixture.id, outcome: 'draw', winnerTeamId: null };
    }
    const winnerTeamId = resolveTrioPlayoffWinner(db, season, fixture.id);
    if (winnerTeamId === fixture.homeTeamId) {
      return { id: fixture.id, outcome: 'home', winnerTeamId };
    }
    if (winnerTeamId === fixture.awayTeamId) {
      return { id: fixture.id, outcome: 'away', winnerTeamId };
    }
    return { id: fixture.id, outcome: null, winnerTeamId: null };
  });
}

function getTierFixturesForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; fixtureType: TierLeagueFixtureType; homeTeamId: number; awayTeamId: number }> {
  const tierStartGw = getTierLeagueStartGwForSeason(season);
  const tierEndGw = getTierLeagueEndGwForSeason(season);
  if (!isSeasonSixOrLater(season) || gwIndex(gw) < gwIndex(tierStartGw)) {
    return [];
  }
  loadTierLeagueFixturesForRange(db, season, tierStartGw, tierEndGw);
  return db
    .prepare(
      `
      SELECT id, fixture_type as fixtureType, home_team_id as homeTeamId, away_team_id as awayTeamId
      FROM tier_league_fixtures
      WHERE season = ? AND gw = ?
      ORDER BY id
      `,
    )
    .all(season, gw) as Array<{ id: number; fixtureType: TierLeagueFixtureType; homeTeamId: number; awayTeamId: number }>;
}

function getTierResultsForPrediction(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{ id: number; outcome: 'home' | 'away' | 'draw' | null; winnerTeamId: number | null }> {
  const fixtures = getTierFixturesForPrediction(db, season, gw);
  return fixtures.map((fixture) => {
    const homePerf = getTeamGwPerformance(db, season, gw, fixture.homeTeamId);
    const awayPerf = getTeamGwPerformance(db, season, gw, fixture.awayTeamId);
    const homeCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, gw, fixture.homeTeamId) as { c: number };
    const awayCount = db
      .prepare('SELECT COUNT(*) as c FROM entries WHERE season = ? AND gw = ? AND team_id = ?')
      .get(season, gw, fixture.awayTeamId) as { c: number };

    if (homeCount.c === 0 && awayCount.c === 0) {
      return { id: fixture.id, outcome: null, winnerTeamId: null };
    }
    if (homePerf.profit > awayPerf.profit) {
      return { id: fixture.id, outcome: 'home', winnerTeamId: fixture.homeTeamId };
    }
    if (awayPerf.profit > homePerf.profit) {
      return { id: fixture.id, outcome: 'away', winnerTeamId: fixture.awayTeamId };
    }
    return { id: fixture.id, outcome: 'draw', winnerTeamId: null };
  });
}

function getPredictionFixturePool(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): PredictionSlateEntry[] {
  const pool: PredictionSlateEntry[] = [];

  getLeagueFixturesForPrediction(db, season, gw).forEach((fixture) => {
    pool.push({ competition: 'league', fixtureId: fixture.id });
  });
  getCupFixturesForPrediction(db, season, gw).forEach((fixture) => {
    if (fixture.homeTeamId && fixture.awayTeamId) {
      pool.push({ competition: 'cup', fixtureId: fixture.id });
    }
  });
  getMasterFixturesForPrediction(db, season, gw).forEach((fixture) => {
    pool.push({ competition: 'master', fixtureId: fixture.id });
  });
  getMasterCupFixturesForPrediction(db, season, gw).forEach((fixture) => {
    if (fixture.homeTeamId && fixture.awayTeamId) {
      pool.push({ competition: 'master_cup', fixtureId: fixture.id });
    }
  });
  getTrioFixturesForPrediction(db, season, gw).forEach((fixture) => {
    pool.push({ competition: 'trio', fixtureId: fixture.id });
  });
  getTierFixturesForPrediction(db, season, gw).forEach((fixture) => {
    pool.push({ competition: 'tier', fixtureId: fixture.id });
  });

  return pool;
}

export function getPredictionSlate(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): PredictionSlateEntry[] {
  const eligible = getPredictionFixturePool(db, season, gw);
  const eligibleByKey = new Map(eligible.map((entry) => [predictionSlateEntryKey(entry), entry]));
  const stored = parsePredictionSlate(getSetting(db, predictionSlateKey(season, gw)));
  const targetCount = Math.min(PREDICTION_SLATE_SIZE, eligible.length);
  const next: PredictionSlateEntry[] = [];
  const usedKeys = new Set<string>();

  stored.forEach((entry) => {
    const key = predictionSlateEntryKey(entry);
    const fixture = eligibleByKey.get(key);
    if (!fixture || usedKeys.has(key) || next.length >= targetCount) {
      return;
    }
    next.push(fixture);
    usedKeys.add(key);
  });

  const orderedEligible = eligible
    .slice()
    .sort((left, right) => {
      const leftKey = predictionSlateEntryKey(left);
      const rightKey = predictionSlateEntryKey(right);
      const leftHash = hashPredictionSeed(`${season}-${gw}-${leftKey}`);
      const rightHash = hashPredictionSeed(`${season}-${gw}-${rightKey}`);
      if (leftHash !== rightHash) {
        return leftHash - rightHash;
      }
      return leftKey.localeCompare(rightKey);
    });

  orderedEligible.forEach((entry) => {
    const key = predictionSlateEntryKey(entry);
    if (usedKeys.has(key) || next.length >= targetCount) {
      return;
    }
    next.push(entry);
    usedKeys.add(key);
  });

  if (JSON.stringify(stored) !== JSON.stringify(next)) {
    setSetting(db, predictionSlateKey(season, gw), JSON.stringify(next));
  }

  return next;
}

export function getPredictions(
  db: Database.Database,
  season: SeasonId,
  gw: string,
): Array<{
  id: number;
  gw: string;
  competition: PredictionCompetition;
  fixtureId: number;
  picker: string;
  pickOutcome: PredictionOutcome;
  pickTeamId: number | null;
  pickTeamName: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  createdAt: string;
}> {
  return db
    .prepare(
      `
      SELECT
        p.id,
        p.gw,
        p.competition,
        p.fixture_id as fixtureId,
        p.picker,
        p.pick_outcome as pickOutcome,
        p.pick_team_id as pickTeamId,
        COALESCE(t.name, 'Draw') as pickTeamName,
        p.predicted_home_score as predictedHomeScore,
        p.predicted_away_score as predictedAwayScore,
        p.created_at as createdAt
      FROM predictions p
      LEFT JOIN teams t ON t.id = p.pick_team_id
      WHERE p.season = ? AND p.gw = ?
      ORDER BY p.competition, p.fixture_id, p.picker
      `,
    )
    .all(season, gw) as Array<{
    id: number;
    gw: string;
    competition: PredictionCompetition;
    fixtureId: number;
    picker: string;
    pickOutcome: PredictionOutcome;
    pickTeamId: number | null;
    pickTeamName: string;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
    createdAt: string;
  }>;
}

export function savePredictions(
  db: Database.Database,
  season: SeasonId,
  gw: string,
  picker: string,
  competition: PredictionCompetition,
  picks: Array<{
    fixtureId: number;
    pickTeamId: number | null;
    pickOutcome?: PredictionOutcome;
    predictedHomeScore?: number | null;
    predictedAwayScore?: number | null;
  }>,
): { saved: number; locked: boolean } {
  const locked = isPredictionsLocked(db, season, gw);
  if (locked && picker !== 'Computer') {
    throw new Error(`Predictions for ${gw} are locked`);
  }
  if (picks.length === 0) {
    return { saved: 0, locked };
  }

  const slate = getPredictionSlate(db, season, gw);
  const slateKeys = new Set(slate.map(predictionSlateEntryKey));
  const allowedFixtureIds = new Set(
    slate
      .filter((entry) => entry.competition === competition)
      .map((entry) => entry.fixtureId),
  );
  if (allowedFixtureIds.size === 0) {
    throw new Error(`No ${competition} fixtures are part of the ${gw} prediction slate`);
  }

  const insert = db.prepare(
    `
    INSERT INTO predictions (
      season,
      gw,
      competition,
      fixture_id,
      picker,
      pick_outcome,
      pick_team_id,
      predicted_home_score,
      predicted_away_score
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(season, gw, competition, fixture_id, picker)
    DO UPDATE SET
      pick_outcome = excluded.pick_outcome,
      pick_team_id = excluded.pick_team_id,
      predicted_home_score = excluded.predicted_home_score,
      predicted_away_score = excluded.predicted_away_score
    `,
  );
  const leagueFixtureById = competition === 'league'
    ? new Map(getLeagueFixturesForPrediction(db, season, gw).map((fixture) => [fixture.id, fixture]))
    : null;
  const trioFixtureById = competition === 'trio'
    ? new Map(getTrioFixturesForPrediction(db, season, gw).map((fixture) => [fixture.id, fixture]))
    : null;
  const tierFixtureById = competition === 'tier'
    ? new Map(getTierFixturesForPrediction(db, season, gw).map((fixture) => [fixture.id, fixture]))
    : null;
  const deletePrediction = db.prepare(
    `
    DELETE FROM predictions
    WHERE season = ? AND gw = ? AND picker = ? AND competition = ? AND fixture_id = ?
    `,
  );
  const existingForPicker = db
    .prepare(
      `
      SELECT competition, fixture_id as fixtureId
      FROM predictions
      WHERE season = ? AND gw = ? AND picker = ?
      `,
    )
    .all(season, gw, picker) as Array<{ competition: PredictionCompetition; fixtureId: number }>;
  const transaction = db.transaction(
    (
      rows: Array<{
        fixtureId: number;
        pickTeamId: number | null;
        pickOutcome?: PredictionOutcome;
        predictedHomeScore?: number | null;
        predictedAwayScore?: number | null;
      }>,
    ) => {
      existingForPicker.forEach((row) => {
        const key = `${row.competition}-${row.fixtureId}`;
        if (slateKeys.has(key)) {
          return;
        }
        deletePrediction.run(season, gw, picker, row.competition, row.fixtureId);
      });
      rows.forEach((row) => {
        if (!allowedFixtureIds.has(row.fixtureId)) {
          throw new Error(`Fixture ${competition}-${row.fixtureId} is not part of the ${gw} prediction slate`);
        }
        const pickOutcome = row.pickOutcome === 'draw' ? 'draw' : 'team';
        if (competition === 'league') {
          const fixture = leagueFixtureById?.get(row.fixtureId);
          if (!fixture) {
            return;
          }
          if (pickOutcome === 'draw' && !leagueFixtureAllowsDraw({ gw, division: fixture.division })) {
            throw new Error('GW8 division playoff predictions cannot be draws');
          }
        }
        if (competition === 'trio') {
          const fixture = trioFixtureById?.get(row.fixtureId);
          if (!fixture) {
            return;
          }
          if (pickOutcome === 'draw' && !trioFixtureAllowsDraw(fixture)) {
            throw new Error('Trio playoff predictions cannot be draws');
          }
        }
        if (competition === 'tier' && !tierFixtureById?.has(row.fixtureId)) {
          return;
        }
        if (pickOutcome === 'team' && !row.pickTeamId) {
          return;
        }
        insert.run(
          season,
          gw,
          competition,
          row.fixtureId,
          picker,
          pickOutcome,
          row.pickTeamId ?? null,
          row.predictedHomeScore ?? null,
          row.predictedAwayScore ?? null,
        );
      });
    },
  );
  transaction(picks);
  return { saved: picks.length, locked };
}

export function ensureCpuPredictions(db: Database.Database, season: SeasonId, gw: string): number {
  const slate = getPredictionSlate(db, season, gw);
  const existing = db
    .prepare(
      `
      SELECT competition, fixture_id as fixtureId
      FROM predictions
      WHERE season = ? AND gw = ? AND picker = 'Computer'
      `,
    )
    .all(season, gw) as Array<{ competition: PredictionCompetition; fixtureId: number }>;
  const existingKeys = new Set(existing.map((row) => `${row.competition}-${row.fixtureId}`));

  const ratingMap = new Map(getTeamRatings(db).map((row) => [row.teamId, row.rating]));
  const pickByRating = (homeId: number, awayId: number): number => {
    const homeRating = ratingMap.get(homeId) ?? 0;
    const awayRating = ratingMap.get(awayId) ?? 0;
    if (homeRating === awayRating) {
      return homeId;
    }
    return homeRating > awayRating ? homeId : awayId;
  };

  const insert = db.prepare(
    `
    INSERT INTO predictions (
      season,
      gw,
      competition,
      fixture_id,
      picker,
      pick_outcome,
      pick_team_id,
      predicted_home_score,
      predicted_away_score
    )
    VALUES (?, ?, ?, ?, 'Computer', 'team', ?, NULL, NULL)
    ON CONFLICT(season, gw, competition, fixture_id, picker)
    DO UPDATE SET
      pick_outcome = excluded.pick_outcome,
      pick_team_id = excluded.pick_team_id
    `,
  );

  let added = 0;
  const leagueFixtures = new Map(getLeagueFixturesForPrediction(db, season, gw).map((fixture) => [fixture.id, fixture]));
  const cupFixtures = new Map(getCupFixturesForPrediction(db, season, gw).map((fixture) => [fixture.id, fixture]));
  const masterFixtures = new Map(getMasterFixturesForPrediction(db, season, gw).map((fixture) => [fixture.id, fixture]));
  const masterCupFixtures = new Map(getMasterCupFixturesForPrediction(db, season, gw).map((fixture) => [fixture.id, fixture]));
  const trioFixtures = new Map(getTrioFixturesForPrediction(db, season, gw).map((fixture) => [fixture.id, fixture]));
  const tierFixtures = new Map(getTierFixturesForPrediction(db, season, gw).map((fixture) => [fixture.id, fixture]));

  slate.forEach((entry) => {
    const key = predictionSlateEntryKey(entry);
    if (existingKeys.has(key)) {
      return;
    }
    if (entry.competition === 'league') {
      const fixture = leagueFixtures.get(entry.fixtureId);
      if (!fixture) {
        return;
      }
      const pickTeamId = pickByRating(fixture.homeTeamId, fixture.awayTeamId);
      insert.run(season, gw, 'league', fixture.id, pickTeamId);
      added += 1;
      return;
    }
    if (entry.competition === 'cup') {
      const fixture = cupFixtures.get(entry.fixtureId);
      if (!fixture || (!fixture.homeTeamId && !fixture.awayTeamId)) {
        return;
      }
      let pickTeamId: number;
      if (fixture.homeTeamId && !fixture.awayTeamId) {
        pickTeamId = fixture.homeTeamId;
      } else if (fixture.awayTeamId && !fixture.homeTeamId) {
        pickTeamId = fixture.awayTeamId;
      } else {
        pickTeamId = pickByRating(fixture.homeTeamId as number, fixture.awayTeamId as number);
      }
      insert.run(season, gw, 'cup', fixture.id, pickTeamId);
      added += 1;
      return;
    }
    if (entry.competition === 'master') {
      const fixture = masterFixtures.get(entry.fixtureId);
      if (!fixture) {
        return;
      }
      const pickTeamId = pickByRating(fixture.homeTeamId, fixture.awayTeamId);
      insert.run(season, gw, 'master', fixture.id, pickTeamId);
      added += 1;
      return;
    }
    if (entry.competition === 'master_cup') {
      const fixture = masterCupFixtures.get(entry.fixtureId);
      if (!fixture?.homeTeamId || !fixture.awayTeamId) {
        return;
      }
      const pickTeamId = pickByRating(fixture.homeTeamId, fixture.awayTeamId);
      insert.run(season, gw, 'master_cup', fixture.id, pickTeamId);
      added += 1;
      return;
    }
    if (entry.competition === 'trio') {
      const fixture = trioFixtures.get(entry.fixtureId);
      if (!fixture) {
        return;
      }
      const pickTeamId = pickByRating(fixture.homeTeamId, fixture.awayTeamId);
      insert.run(season, gw, 'trio', fixture.id, pickTeamId);
      added += 1;
      return;
    }
    const fixture = tierFixtures.get(entry.fixtureId);
    if (!fixture) {
      return;
    }
    const pickTeamId = pickByRating(fixture.homeTeamId, fixture.awayTeamId);
    insert.run(season, gw, 'tier', fixture.id, pickTeamId);
    added += 1;
  });

  return added;
}

export function getPredictionScoreboard(db: Database.Database, season: SeasonId): {
  totals: Array<{ picker: string; points: number; correct: number; total: number; perfectWeeks: number }>;
  weeks: Array<{ gw: string; picker: string; points: number; correct: number; total: number; perfect: boolean }>;
} {
  const predictions = db
    .prepare(
      `
      SELECT gw, competition, fixture_id as fixtureId, picker, pick_team_id as pickTeamId, pick_outcome as pickOutcome
      FROM predictions
      WHERE season = ?
      `,
    )
    .all(season) as Array<{
    gw: string;
    competition: PredictionCompetition;
    fixtureId: number;
    picker: string;
    pickTeamId: number | null;
    pickOutcome: PredictionOutcome;
  }>;

  const byGw = new Map<string, typeof predictions>();
  predictions.forEach((row) => {
    const list = byGw.get(row.gw) ?? [];
    list.push(row);
    byGw.set(row.gw, list);
  });

  const weeks: Array<{ gw: string; picker: string; points: number; correct: number; total: number; perfect: boolean }> = [];
  const totalsMap = new Map<string, { points: number; correct: number; total: number; perfectWeeks: number }>();
  PREDICTION_PLAYERS.forEach((picker) => totalsMap.set(picker, { points: 0, correct: 0, total: 0, perfectWeeks: 0 }));

  byGw.forEach((rows, gw) => {
    const leagueResults = new Map(getLeagueResultsForPrediction(db, season, gw).map((row) => [row.id, row]));
    const cupResults = new Map(
      getCupFixturesForPrediction(db, season, gw).map((row) => [
        row.id,
        { outcome: row.winnerTeamId ? 'team' : null, winnerTeamId: row.winnerTeamId },
      ]),
    );
    const masterResults = new Map(getMasterResultsForPrediction(db, season, gw).map((row) => [row.id, row]));
    const masterCupResults = new Map(getMasterCupResultsForPrediction(db, season, gw).map((row) => [row.id, row]));
    const trioResults = new Map(getTrioResultsForPrediction(db, season, gw).map((row) => [row.id, row]));
    const tierResults = new Map(getTierResultsForPrediction(db, season, gw).map((row) => [row.id, row]));

    const byPicker = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const list = byPicker.get(row.picker) ?? [];
      list.push(row);
      byPicker.set(row.picker, list);
    });

    PREDICTION_PLAYERS.forEach((picker) => {
      const picks = byPicker.get(picker) ?? [];
      let correct = 0;
      let resolved = 0;
      picks.forEach((pick) => {
        const result =
          pick.competition === 'league'
            ? leagueResults.get(pick.fixtureId)
          : pick.competition === 'cup'
              ? cupResults.get(pick.fixtureId)
              : pick.competition === 'master'
                ? masterResults.get(pick.fixtureId)
                : pick.competition === 'master_cup'
                  ? masterCupResults.get(pick.fixtureId)
                  : pick.competition === 'trio'
                    ? trioResults.get(pick.fixtureId)
                    : tierResults.get(pick.fixtureId);
        if (!result || !result.outcome) {
          return;
        }
        resolved += 1;
        if (pick.pickOutcome === 'draw') {
          if (result.outcome === 'draw') {
            correct += 1;
          }
          return;
        }
        if (result.winnerTeamId && pick.pickTeamId === result.winnerTeamId) {
          correct += 1;
        }
      });
      const total = picks.length;
      const points = correct * 5;
      const perfect = resolved > 0 && correct === resolved && resolved === total;

      weeks.push({ gw, picker, points, correct, total, perfect });

      const totals = totalsMap.get(picker) ?? { points: 0, correct: 0, total: 0, perfectWeeks: 0 };
      totals.points += points;
      totals.correct += correct;
      totals.total += total;
      totals.perfectWeeks += perfect ? 1 : 0;
      totalsMap.set(picker, totals);
    });
  });

  const totals = Array.from(totalsMap.entries()).map(([picker, totals]) => ({ picker, ...totals }));
  return { totals, weeks };
}
