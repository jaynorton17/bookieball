import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DEFAULT_TEAMS, DIVISION_ORDER, DIVISION_SLOTS, GAMEWEEKS } from '../shared/constants.js';
import type { DivisionName } from '../shared/constants.js';
import type { CurrentState, EntryInput, EntryType, SeasonId } from '../shared/types.js';

export const BOOKIEBALL_DIR = path.join(os.homedir(), '.bookieball');
export const DB_PATH = path.join(BOOKIEBALL_DIR, 'bookieball.db');
export const BACKUPS_DIR = path.join(BOOKIEBALL_DIR, 'backups');

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
  if (!Array.isArray(parsed) || parsed.length !== 20) {
    throw new Error(`Team seed file must include exactly 20 team objects: ${customFile}`);
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
  ensureBookieballDir();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
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

  const teams = db.prepare('SELECT id FROM teams ORDER BY id').all() as Array<{ id: number }>;
  const shuffled = shuffle(teams);
  let cursor = 0;
  const insert = db.prepare('INSERT INTO season_teams (season, team_id, division) VALUES (?, ?, ?)');

  for (const division of DIVISION_ORDER) {
    const size = DIVISION_SLOTS[division];
    for (let i = 0; i < size; i += 1) {
      const team = shuffled[cursor];
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
    for (const division of DIVISION_ORDER) {
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
  const teams = db
    .prepare(
      `
      SELECT id AS team_id, name AS team_name, ball_color, ring_color, text_color
      FROM teams
      ORDER BY name
      `,
    )
    .all() as Array<{
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

function ensureGw8Fixtures(db: Database.Database, season: SeasonId): number {
  const existing = db.prepare('SELECT COUNT(*) as c FROM league_fixtures WHERE season = ? AND gw = ?').get(season, 'GW8') as { c: number };
  if (existing.c > 0) {
    setGw8Locked(db, season, true);
    return existing.c;
  }

  const table = getLeagueTable(db, season, 'GW7');
  const playoffPairs: Array<{ upperTeamId: number; lowerTeamId: number; upperDivision: DivisionName; lowerDivision: DivisionName }> = [];

  for (let i = 0; i < DIVISION_ORDER.length - 1; i += 1) {
    const upper = DIVISION_ORDER[i];
    const lower = DIVISION_ORDER[i + 1];
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
  standout: Array<{ label: string; value: string }>;
  goalsOfSeason: Array<{ division: DivisionName; teamId: number; teamName: string; profit: number }>;
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
  league: 0.45,
  cup: 0.25,
  master: 0.2,
  consistency: 0.1,
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
  return DIVISION_ORDER
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
// league context + cup run + master league + cross-season consistency.
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

function calculateBookieDorLeaderboard(
  db: Database.Database,
  season: SeasonId,
  table: Record<string, Array<{ teamId: number; teamName: string; division: string; played: number; points: number; profit: number; spins: number; rank: number }>>,
  gw: string,
): BookieDorScore[] {
  const cupPerformance = getCupPerformanceByTeam(db, season);
  const normalizedGw = GAMEWEEKS.includes(gw as (typeof GAMEWEEKS)[number]) ? gw : 'GW8';
  loadMasterLeagueFixturesForRange(db, season, 'GW1', normalizedGw);
  const masterRows = getMasterLeagueTable(db, season, normalizedGw);
  const masterRankByTeam = new Map(masterRows.map((row) => [row.teamId, row.rank]));
  const masterSize = masterRows.length;
  const masterProfitRanks = new Map<number, number>();
  const masterPpgByTeam = new Map<number, number>();
  masterRows
    .slice()
    .sort((a, b) => b.profit - a.profit || b.points - a.points || b.spins - a.spins || a.teamName.localeCompare(b.teamName))
    .forEach((row, idx) => {
      masterProfitRanks.set(row.teamId, idx + 1);
      masterPpgByTeam.set(row.teamId, row.played > 0 ? row.points / row.played : 0);
    });
  const scores: BookieDorScore[] = [];
  const teamIds: number[] = [];
  for (const division of DIVISION_ORDER) {
    const rows = table[division] ?? [];
    rows.forEach((row) => teamIds.push(row.teamId));
  }
  const consistencyByTeam = getBookieDorConsistencyByTeam(db, season, teamIds);

  for (const division of DIVISION_ORDER) {
    const rows = table[division] ?? [];
    if (rows.length === 0) {
      continue;
    }
    const divisionSize = rows.length;
    const profitRanks = new Map<number, number>();
    rows
      .slice()
      .sort((a, b) => b.profit - a.profit || b.points - a.points || b.spins - a.spins || a.teamName.localeCompare(b.teamName))
      .forEach((row, idx) => {
        profitRanks.set(row.teamId, idx + 1);
      });

    rows.forEach((row) => {
      const pointsPercentile = percentileFromRank(row.rank, divisionSize);
      const profitRank = profitRanks.get(row.teamId) ?? row.rank;
      const profitPercentile = percentileFromRank(profitRank, divisionSize);
      const ppg = row.played > 0 ? row.points / row.played : 0;
      const ppgNormalized = Math.min(1, Math.max(0, ppg / 3));
      const titleBonus = row.rank === 1 ? 6 : row.rank === 2 ? 3 : row.rank === 3 ? 1 : 0;
      const leagueScore = (pointsPercentile * 55) + (profitPercentile * 35) + (ppgNormalized * 10) + titleBonus;

      const masterRank = masterRankByTeam.get(row.teamId);
      let masterScore = 0;
      if (masterRank !== undefined && masterSize > 0) {
        const masterPointsPercentile = percentileFromRank(masterRank, masterSize);
        const masterProfitRank = masterProfitRanks.get(row.teamId) ?? masterRank;
        const masterProfitPercentile = percentileFromRank(masterProfitRank, masterSize);
        const masterPpg = masterPpgByTeam.get(row.teamId) ?? 0;
        const masterPpgNormalized = Math.max(0, Math.min(1, masterPpg / 3));
        const masterBonus = masterRank === 1 ? 5 : masterRank === 2 ? 2 : masterRank === 3 ? 1 : 0;
        masterScore = (masterPointsPercentile * 55) + (masterProfitPercentile * 35) + (masterPpgNormalized * 10) + masterBonus;
      }

      const cup = cupPerformance.get(row.teamId) ?? { roundReached: 0, isWinner: false, isRunnerUp: false };
      let cupScore = 0;
      let cupFinish = 'No cup run';
      if (cup.isWinner) {
        cupScore = 100;
        cupFinish = 'Winner';
      } else if (cup.isRunnerUp) {
        cupScore = 90;
        cupFinish = 'Runner-up';
      } else if (cup.roundReached > 0) {
        const normalizedByRound: Record<number, number> = {
          1: 30,
          2: 50,
          3: 68,
          4: 82,
          5: 100,
        };
        cupScore = normalizedByRound[cup.roundReached] ?? 0;
        cupFinish = CUP_ROUND_LABEL[cup.roundReached] ?? 'Cup run';
      }

      const consistencyScore = consistencyByTeam.get(row.teamId) ?? 0;
      const weightedLeagueScore = leagueScore * BOOKIE_DOR_WEIGHTS.league;
      const weightedCupScore = cupScore * BOOKIE_DOR_WEIGHTS.cup;
      const weightedMasterScore = masterScore * BOOKIE_DOR_WEIGHTS.master;
      const weightedConsistencyScore = consistencyScore * BOOKIE_DOR_WEIGHTS.consistency;
      const totalScore = weightedLeagueScore + weightedCupScore + weightedMasterScore + weightedConsistencyScore;

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
        cupFinish,
        totalScore,
      });
    });
  }

  return scores.sort((a, b) =>
    b.totalScore - a.totalScore
    || b.weightedLeagueScore - a.weightedLeagueScore
    || b.weightedCupScore - a.weightedCupScore
    || b.weightedMasterScore - a.weightedMasterScore
    || b.weightedConsistencyScore - a.weightedConsistencyScore
    || a.leagueRank - b.leagueRank
    || a.teamName.localeCompare(b.teamName),
  );
}

export function getBookieDorWeights(): BookieDorWeights {
  return { ...BOOKIE_DOR_WEIGHTS };
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
    return fixture.winner_team_id;
  }

  if (!fixture.home_team_id && !fixture.away_team_id) {
    return null;
  }
  if (!fixture.home_team_id) {
    updateCupFixtureWithAudit(db, fixture.id, { winner_team_id: fixture.away_team_id }, 'winner_update', 'auto_resolve_bye');
    return fixture.away_team_id;
  }
  if (!fixture.away_team_id) {
    updateCupFixtureWithAudit(db, fixture.id, { winner_team_id: fixture.home_team_id }, 'winner_update', 'auto_resolve_bye');
    return fixture.home_team_id;
  }

  const home = getTeamGwPerformance(db, fixture.season, fixture.gw, fixture.home_team_id);
  const away = getTeamGwPerformance(db, fixture.season, fixture.gw, fixture.away_team_id);

  let winner = fixture.home_team_id;
  if (away.profit > home.profit) {
    winner = fixture.away_team_id;
  } else if (away.profit === home.profit) {
    if (away.spins > home.spins) {
      winner = fixture.away_team_id;
    } else if (away.spins === home.spins) {
      const tieBreakMode = getCupTieBreakMode(db);
      if (tieBreakMode === 'random') {
        if (Math.random() > 0.5) {
          winner = fixture.away_team_id;
        }
      } else {
        winner = Math.min(fixture.home_team_id, fixture.away_team_id);
      }
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

  const teamIds = shuffle((db.prepare('SELECT id FROM teams ORDER BY id').all() as Array<{ id: number }>).map((row) => row.id));
  const byeCount = 12;
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
  const fixtures = shuffle([...byePairs, ...teamPairs]);

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
  updateCupFixtureWithAudit(
    db,
    fixture.id,
    { home_team_id: homeWinner, away_team_id: awayWinner },
    'slot_update',
    'populate_from_sources',
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

  const upto = gwIndex(upToGw);
  const cupRounds = ['GW2', 'GW3', 'GW4', 'GW5', 'GW6'];
  for (const gw of cupRounds) {
    const roundIdx = gwIndex(gw);
    const shouldResolveRound = roundIdx < upto || (roundIdx === upto && isCupRoundComplete(db, season, gw));
    const shouldPopulateRound = roundIdx <= upto + 1;
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
        updateCupFixtureWithAudit(db, row.id, { winner_team_id: null }, 'winner_update', 'clear_unlocked_winner');
      }
    }
  }
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
  const table = getLeagueTable(db, season, 'GW7');
  const bookieDorLeaderboard = calculateBookieDorLeaderboard(db, season, table, 'GW8');
  const bookieDorWinner = bookieDorLeaderboard[0] ?? null;
  loadMasterLeagueFixturesForRange(db, season, 'GW1', 'GW8');
  const masterLeagueRows = getMasterLeagueTable(db, season, 'GW8');
  const masterLeagueWinner = masterLeagueRows[0] ?? null;

  const updateAwards = db.transaction(() => {
    const cupWinner = db
      .prepare("SELECT winner_team_id FROM cup_fixtures WHERE season = ? AND gw = 'GW6' ORDER BY id LIMIT 1")
      .get(season) as { winner_team_id: number } | undefined;
    if (cupWinner?.winner_team_id) {
      db.prepare('INSERT INTO awards (season, team_id, award_type, value) VALUES (?, ?, ?, ?)').run(season, cupWinner.winner_team_id, 'cup_winner', '1');
    }

    for (const division of DIVISION_ORDER) {
      const rows = table[division] ?? [];
      if (rows[0]) {
        db.prepare('INSERT INTO awards (season, team_id, award_type, value) VALUES (?, ?, ?, ?)').run(
          season,
          rows[0].teamId,
          'league_title',
          division,
        );
      }
    }

    if (masterLeagueWinner) {
      db.prepare('INSERT INTO awards (season, team_id, award_type, value) VALUES (?, ?, ?, ?)').run(
        season,
        masterLeagueWinner.teamId,
        'master_league_title',
        'overall',
      );
    }

    if (bookieDorWinner) {
      db.prepare('INSERT INTO awards (season, team_id, award_type, value) VALUES (?, ?, ?, ?)').run(
        season,
        bookieDorWinner.teamId,
        'bookie_dor',
        'overall',
      );
    }

    for (const division of DIVISION_ORDER) {
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
        db.prepare('INSERT INTO awards (season, team_id, award_type, value) VALUES (?, ?, ?, ?)').run(
          season,
          best.team_id,
          'goal_of_season',
          division,
        );
      }
    }
  });
  updateAwards();

  const currentDivisions = db.prepare('SELECT team_id, division FROM season_teams WHERE season = ?').all(season) as Array<{
    team_id: number;
    division: DivisionName;
  }>;

  const divisionIndex = new Map(DIVISION_ORDER.map((division, index) => [division, index]));
  const divisionByTeam = new Map(currentDivisions.map((row) => [row.team_id, row.division]));

  if (currentDivisions.length === 0) {
    assignDivisionsForSeason(db, next);
    return next;
  }

  const divisionToTeams = new Map<DivisionName, number[]>();
  for (const division of DIVISION_ORDER) {
    divisionToTeams.set(division, currentDivisions.filter((row) => row.division === division).map((row) => row.team_id));
  }

  const ranked = new Map<DivisionName, number[]>();

  for (const division of DIVISION_ORDER) {
    const divisionRank = (table[division] ?? []).map((row) => row.teamId);
    ranked.set(division, divisionRank);
  }

  const nextMap = new Map<number, DivisionName>();
  for (const division of DIVISION_ORDER) {
    for (const teamId of ranked.get(division) ?? []) {
      nextMap.set(teamId, division);
    }
  }

  for (let i = 0; i < DIVISION_ORDER.length - 1; i += 1) {
    const upper = DIVISION_ORDER[i];
    const lower = DIVISION_ORDER[i + 1];
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
    .prepare("SELECT home_team_id, away_team_id FROM league_fixtures WHERE season = ? AND gw = 'GW8' AND division = 'Playoff'")
    .all(season) as Array<{ home_team_id: number; away_team_id: number }>;
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
      } else if (homePerf.spins > awayPerf.spins) {
        winnerTeamId = fixture.home_team_id;
      } else if (awayPerf.spins > homePerf.spins) {
        winnerTeamId = fixture.away_team_id;
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

  const leagueWinners = DIVISION_ORDER
    .map((division) => {
      const rows = table[division] ?? [];
      if (!rows[0]) {
        return null;
      }
      return { division, teamId: rows[0].teamId, teamName: rows[0].teamName };
    })
    .filter((row): row is { division: DivisionName; teamId: number; teamName: string } => !!row);

  const bestByDivision = DIVISION_ORDER
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

  const overallBest = DIVISION_ORDER
    .flatMap((division) => table[division] ?? [])
    .sort((a, b) => b.profit - a.profit)[0] ?? null;

  const cupWinnerRow = db
    .prepare("SELECT winner_team_id FROM cup_fixtures WHERE season = ? AND gw = 'GW6' ORDER BY id LIMIT 1")
    .get(season) as { winner_team_id: number } | undefined;
  const cupWinner = cupWinnerRow?.winner_team_id
    ? { teamId: cupWinnerRow.winner_team_id, teamName: teamNameMap.get(cupWinnerRow.winner_team_id) ?? 'Unknown' }
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
  if (overallBest) {
    standout.push({ label: 'Best Total Profit', value: `${overallBest.teamName} (${overallBest.profit})` });
  }
  if (bestSingle) {
    standout.push({ label: 'Best Single Profit', value: `${teamNameMap.get(bestSingle.team_id) ?? 'Unknown'} (${bestSingle.best_profit})` });
  }

  const bookieDorPayload = bookieDorWinner
    ? {
        weights: getBookieDorWeights(),
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

  const finalePayload: SeasonFinalePayload = {
    season,
    leagueWinners,
    bestProfits: {
      overall: overallBest ? { teamId: overallBest.teamId, teamName: overallBest.teamName, profit: overallBest.profit } : null,
      byDivision: bestByDivision,
    },
    promotions,
    relegations,
    playoffResults,
    cupWinner,
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
  const teamSeedWarning = ensureTeams(db);
  if (teamSeedWarning) {
    warnings.push(teamSeedWarning);
  }

  const state = getCurrentState(db);
  assignDivisionsForSeason(db, state.currentSeason);
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
        ) AS total
      `,
    )
    .get(season, gw, season, gw, season, gw, season, gw) as { total: number };
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
  leaderboard: ReturnType<typeof getBookieDorLeaderboard>,
): SeasonFinalePayload['bookieDor'] {
  const winner = leaderboard[0] ?? null;
  if (!winner) {
    return null;
  }
  return {
    weights: getBookieDorWeights(),
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
    weights: getBookieDorWeights(),
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

const BOOKIE_DOR_MODEL_VERSION = '2';

export function refreshBookieDorHistory(db: Database.Database): { updated: number } {
  const seasons = db
    .prepare('SELECT DISTINCT season FROM season_teams ORDER BY CAST(SUBSTR(season, 2) AS INTEGER)')
    .all() as Array<{ season: string }>;
  const currentState = getCurrentState(db);
  const currentSeasonNumber = parseSeasonNumber(currentState.currentSeason);
  const deleteAward = db.prepare("DELETE FROM awards WHERE season = ? AND award_type = 'bookie_dor'");
  const insertAward = db.prepare("INSERT INTO awards (season, team_id, award_type, value) VALUES (?, ?, 'bookie_dor', 'overall')");

  let updated = 0;
  seasons.forEach((row) => {
    const season = row.season as SeasonId;
    const seasonNumber = parseSeasonNumber(season);
    if (seasonNumber >= currentSeasonNumber) {
      return;
    }
    const leaderboard = getBookieDorLeaderboard(db, season, latestBookieDorGwForSeason(db, season));
    const winner = leaderboard[0] ?? null;
    deleteAward.run(season);
    if (winner) {
      insertAward.run(season, winner.teamId);
    }
    const finale = getSeasonFinale(db, season);
    if (finale) {
      const payload = {
        ...finale,
        bookieDor: buildBookieDorPayloadFromLeaderboard(leaderboard),
      };
      setSeasonFinale(db, season, payload);
    }
    updated += 1;
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
  if (!payload.goalsOfSeason || payload.goalsOfSeason.length === 0) {
    const patched = {
      ...payload,
      goalsOfSeason: computeGoalsOfSeason(db, pendingSeason),
    };
    setSeasonFinale(db, pendingSeason, patched);
    return { season: pendingSeason, payload: patched };
  }
  return { season: pendingSeason, payload };
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

  for (const division of DIVISION_ORDER) {
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
      .sort((a, b) => b.points - a.points || b.profit - a.profit || b.spins - a.spins || b.wins - a.wins || Math.random() - 0.5)
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
  result: 'home' | 'away' | 'draw' | 'pending';
}> {
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
  seasonTeams: Array<{ teamId: number; division: string }>;
  leagueFixtures: Array<{ id: number; gw: string; division: string; homeTeamId: number; awayTeamId: number }>;
  masterLeagueFixtures: Array<{ id: number; gw: string; homeTeamId: number; awayTeamId: number; createdAt: string }>;
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
        OR key LIKE ?
        OR key LIKE ?
      ORDER BY key
      `,
    )
    .all(
      `cup_draw_started_${season}`,
      `gw8_locked_${season}`,
      `master_league_seed_${season}`,
      `season_finale_${season}`,
      `predictions_locked_${season}_%`,
      `gw_locked_${season}_%`,
    ) as Array<{ key: string; value: string }>;
}

function buildSnapshotPayload(db: Database.Database, season: SeasonId, gw: string): SnapshotPayload {
  const table = getLeagueTable(db, season, gw);
  const cup = getCupBracket(db, season, gw);
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
    db.prepare('DELETE FROM league_fixtures WHERE season = ?').run(season);
    db.prepare('DELETE FROM cup_fixtures WHERE season = ?').run(season);
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
  recomputeTeamTrendCache(db, seasonState as SeasonId, gwState);
  return { season, gw, backupPath };
}

export function drawRandomTeam(db: Database.Database, season: SeasonId, gw: string): {
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
} | null {
  const teams = getTeams(db, season);
  const usedIds = new Set(
    (
      db.prepare('SELECT team_id FROM gameshow_draws WHERE season = ? AND gw = ?').all(season, gw) as Array<{
        team_id: number;
      }>
    ).map((row) => row.team_id),
  );
  const available = teams.filter((team) => !usedIds.has(team.id));
  if (available.length === 0) {
    return null;
  }
  const picked = available[Math.floor(Math.random() * available.length)];
  db.prepare('INSERT INTO gameshow_draws (season, gw, team_id) VALUES (?, ?, ?)').run(season, gw, picked.id);

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
      cupOpponent = 'BYE';
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
      stmt.run(
        state.currentSeason,
        state.currentGw,
        row.teamId,
        row.entryType,
        row.profit,
        row.spins ?? null,
        row.stake ?? null,
        row.notes ?? null,
        row.noWin ? 1 : 0,
        batchId,
      );
    }
  });
  tx(entries);

  ensureCupProgress(db, state.currentSeason, state.currentGw);
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

  const tx = db.transaction(() => {
    db.prepare(
      `
      UPDATE entries
      SET entry_type = ?, profit = ?, spins = ?, stake = ?, notes = ?, no_win = ?
      WHERE id = ?
      `,
    ).run(
      update.entryType,
      update.profit,
      update.spins ?? null,
      update.stake ?? null,
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
      update.profit,
      update.spins ?? null,
      update.stake ?? null,
      update.notes ?? null,
      update.noWin ? 1 : 0,
    );
  });
  tx();

  ensureCupProgress(db, state.currentSeason, state.currentGw);
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
}> {
  ensureCupProgress(db, season, upToGw);

  const fixtures = db
    .prepare(
      `
      SELECT
        cf.id,
        cf.gw,
        cf.round_name,
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

  return fixtures.map((row) => ({
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
  }));
}

export function getTeamStats(db: Database.Database, teamId: number, season: SeasonId): {
  season: { profit: number; wins: number; entries: number };
  allTime: { profit: number; wins: number; entries: number };
  cupWins: number;
  leagueTitles: number;
} {
  const seasonStats = db
    .prepare('SELECT COALESCE(SUM(profit),0) AS profit, COALESCE(SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END),0) AS wins, COUNT(*) AS entries FROM entries WHERE team_id = ? AND season = ?')
    .get(teamId, season) as { profit: number; wins: number; entries: number };

  const allTimeStats = db
    .prepare('SELECT COALESCE(SUM(profit),0) AS profit, COALESCE(SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END),0) AS wins, COUNT(*) AS entries FROM entries WHERE team_id = ?')
    .get(teamId) as { profit: number; wins: number; entries: number };

  const cupWins = db.prepare("SELECT COUNT(*) as c FROM awards WHERE team_id = ? AND award_type = 'cup_winner'").get(teamId) as { c: number };
  const leagueTitles = db.prepare("SELECT COUNT(*) as c FROM awards WHERE team_id = ? AND award_type = 'league_title'").get(teamId) as { c: number };

  return {
    season: seasonStats,
    allTime: allTimeStats,
    cupWins: cupWins.c,
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
    let cupFinish = 'No cup run';
    if (cupPerf?.isWinner) {
      cupFinish = 'Winner';
    } else if (cupPerf?.isRunnerUp) {
      cupFinish = 'Runner-up';
    } else if (cupPerf?.roundReached) {
      cupFinish = CUP_ROUND_LABEL[cupPerf.roundReached] ?? 'Cup run';
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
    };
  });
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

export function getTrophyRoom(db: Database.Database): {
  cup: Array<{ season: string; teamName: string }>;
  divisions: Record<string, Array<{ season: string; teamName: string }>>;
  goalsOfSeason: Record<string, Array<{ season: string; teamName: string }>>;
  bookieDor: Array<{ season: string; teamName: string }>;
  masterLeague: Array<{ season: string; teamName: string }>;
} {
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

  const divisions: Record<string, Array<{ season: string; teamName: string }>> = {};
  const goalsOfSeason: Record<string, Array<{ season: string; teamName: string }>> = {};
  for (const division of DIVISION_ORDER) {
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
  };
}

export function getSeasonAchievements(db: Database.Database, season: SeasonId): Array<{ key: string; label: string; teamName: string; value: string }> {
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
      SELECT lf.gw, lf.home_team_id, lf.away_team_id, ht.name AS home_name, at.name AS away_name
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
    gw: string;
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

  if (currentIdx === GAMEWEEKS.length - 1) {
    const newSeason = applySeasonRollover(db, state.currentSeason);
    setCurrentState(db, newSeason, 'GW1');
    recomputeTeamTrendCache(db, newSeason, 'GW1');
    captureGwSnapshot(db, newSeason, 'GW1', 'season_rollover');
    return { currentSeason: newSeason, currentGw: 'GW1' };
  }

  const newGw = GAMEWEEKS[currentIdx + 1];
  if (newGw === 'GW8') {
    ensureGw8Fixtures(db, state.currentSeason);
  }
  setCurrentState(db, state.currentSeason, newGw);
  ensureCupProgress(db, state.currentSeason, newGw);
  recomputeTeamTrendCache(db, state.currentSeason, newGw);
  captureGwSnapshot(db, state.currentSeason, newGw, 'advance_gw');
  return { currentSeason: state.currentSeason, currentGw: newGw };
}

export function setGameweek(db: Database.Database, season: SeasonId, gw: string): CurrentState {
  if (gw === 'GW8') {
    ensureGw8Fixtures(db, season);
  }
  setCurrentState(db, season, gw);
  assignDivisionsForSeason(db, season);
  ensureCupProgress(db, season, gw);
  recomputeTeamTrendCache(db, season, gw);
  captureGwSnapshot(db, season, gw, 'set_gw');
  return { currentSeason: season, currentGw: gw as CurrentState['currentGw'] };
}

type PredictionCompetition = 'league' | 'cup';
type PredictionOutcome = 'team' | 'draw';

const PREDICTION_PLAYERS = ['Jay', 'Computer'];

function predictionLockKey(season: SeasonId, gw: string): string {
  return `predictions_locked_${season}_${gw}`;
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
): Array<{ id: number; homeTeamId: number; awayTeamId: number }> {
  return db
    .prepare(
      `
      SELECT id, home_team_id as homeTeamId, away_team_id as awayTeamId
      FROM league_fixtures
      WHERE season = ? AND gw = ?
      ORDER BY id
      `,
    )
    .all(season, gw) as Array<{ id: number; homeTeamId: number; awayTeamId: number }>;
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
      rows.forEach((row) => {
        const pickOutcome = row.pickOutcome === 'draw' ? 'draw' : 'team';
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
  const leagueFixtures = getLeagueFixturesForPrediction(db, season, gw);
  leagueFixtures.forEach((fixture) => {
    const key = `league-${fixture.id}`;
    if (existingKeys.has(key)) {
      return;
    }
    const pickTeamId = pickByRating(fixture.homeTeamId, fixture.awayTeamId);
    insert.run(season, gw, 'league', fixture.id, pickTeamId);
    added += 1;
  });

  const cupFixtures = getCupFixturesForPrediction(db, season, gw);
  cupFixtures.forEach((fixture) => {
    const key = `cup-${fixture.id}`;
    if (existingKeys.has(key)) {
      return;
    }
    if (!fixture.homeTeamId && !fixture.awayTeamId) {
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
          pick.competition === 'league' ? leagueResults.get(pick.fixtureId) : cupResults.get(pick.fixtureId);
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
