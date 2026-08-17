import { api } from './api';
import type { TableJourneyRow, TableJourneySnapshot } from '../components/TablePositionJourney';

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];

type TeamMeta = { id: number; name: string; ballColor: string | null; ringColor: string | null; textColor: string | null };
type DivisionRow = { teamId: number; teamName: string; division: string; rank: number };

function gwIndex(gw: string): number { return Math.max(0, GAMEWEEKS.indexOf(gw)); }
function gameweeksThrough(currentGw: string, startGw = 'GW1'): string[] {
  const start = Math.max(0, GAMEWEEKS.indexOf(startGw));
  const end = Math.max(start, gwIndex(currentGw));
  return GAMEWEEKS.slice(start, end + 1);
}
function teamMap(teams: TeamMeta[]): Map<number, TeamMeta> { return new Map(teams.map((team) => [team.id, team])); }
function decorate(row: { teamId: number; teamName: string; rank: number; division?: string; ballColor?: string | null; ringColor?: string | null; textColor?: string | null }, teams: Map<number, TeamMeta>): TableJourneyRow {
  const team = teams.get(row.teamId);
  return {
    teamId: row.teamId,
    teamName: row.teamName,
    rank: row.rank,
    division: row.division,
    ballColor: row.ballColor ?? team?.ballColor ?? null,
    ringColor: row.ringColor ?? team?.ringColor ?? null,
    textColor: row.textColor ?? team?.textColor ?? null,
  };
}

function preseasonSnapshot(rows: TableJourneyRow[]): TableJourneySnapshot {
  const grouped = new Map<string, TableJourneyRow[]>();
  rows.forEach((row) => {
    const key = row.division ?? '__all__';
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  });

  const preseasonRows = [...grouped.values()].flatMap((group) => group
    .slice()
    .sort((a, b) => a.teamName.localeCompare(b.teamName))
    .map((row, index) => ({ ...row, rank: index + 1 })));

  return { gw: 'GW0', rows: preseasonRows };
}

function withPreseason(snapshots: TableJourneySnapshot[]): TableJourneySnapshot[] {
  if (!snapshots.length || snapshots.some((snapshot) => snapshot.gw === 'GW0')) return snapshots;
  return [preseasonSnapshot(snapshots[0].rows), ...snapshots];
}

export async function loadDivisionTableJourney(
  currentSeason: string,
  currentGw: string,
  currentTable: Record<string, DivisionRow[]>,
  teams: TeamMeta[],
): Promise<TableJourneySnapshot[]> {
  const wanted = gameweeksThrough(currentGw);
  const meta = await api.snapshots().catch(() => []);
  const colours = teamMap(teams);
  const byGw = new Map<string, (typeof meta)[number]>();
  meta
    .filter((snapshot) => snapshot.season === currentSeason && wanted.includes(snapshot.gw))
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((snapshot) => byGw.set(snapshot.gw, snapshot));

  const historical = await Promise.all(wanted.map(async (gw): Promise<TableJourneySnapshot | null> => {
    if (gw === currentGw) {
      return { gw, rows: Object.entries(currentTable).flatMap(([division, divisionRows]) => divisionRows.map((row) => decorate({ ...row, division }, colours))) };
    }
    const snapshot = byGw.get(gw);
    if (!snapshot) return null;
    const payload = await api.snapshotPayload(snapshot.id).catch(() => null);
    const rawTable = payload?.payload?.table;
    if (!rawTable || typeof rawTable !== 'object' || Array.isArray(rawTable)) return null;
    const rows = Object.entries(rawTable as Record<string, unknown>).flatMap(([division, value]) => {
      if (!Array.isArray(value)) return [];
      return value.flatMap((candidate) => {
        if (!candidate || typeof candidate !== 'object') return [];
        const row = candidate as Partial<DivisionRow>;
        if (typeof row.teamId !== 'number' || typeof row.teamName !== 'string' || typeof row.rank !== 'number') return [];
        return [decorate({ teamId: row.teamId, teamName: row.teamName, rank: row.rank, division: typeof row.division === 'string' ? row.division : division }, colours)];
      });
    });
    return rows.length ? { gw, rows } : null;
  }));

  return withPreseason(historical.filter((snapshot): snapshot is TableJourneySnapshot => !!snapshot));
}

export async function loadMasterTableJourney(currentGw: string): Promise<TableJourneySnapshot[]> {
  const gws = gameweeksThrough(currentGw);
  const responses = await Promise.all(gws.map((gw) => api.masterLeagueTable(gw).catch(() => null)));
  const snapshots = responses.flatMap((response, index) => response ? [{ gw: gws[index], rows: response.table.map((row) => decorate(row, new Map())) }] : []);
  return withPreseason(snapshots);
}

export async function loadTrioTableJourney(currentGw: string): Promise<TableJourneySnapshot[]> {
  const gws = gameweeksThrough(currentGw);
  const responses = await Promise.all(gws.map((gw) => api.trioLeagueTable(gw).catch(() => null)));
  const snapshots = responses.flatMap((response, index) => response?.enabled ? [{ gw: gws[index], rows: response.table.map((row) => decorate(row, new Map())) }] : []);
  return withPreseason(snapshots);
}

export async function loadTierTableJourney(currentGw: string, startGw: string): Promise<TableJourneySnapshot[]> {
  const gws = gameweeksThrough(currentGw, startGw);
  const responses = await Promise.all(gws.map((gw) => api.tierLeagueTable(gw).catch(() => null)));
  const snapshots = responses.flatMap((response, index) => response?.enabled && response.started ? [{ gw: gws[index], rows: response.table.map((row) => decorate(row, new Map())) }] : []);
  return withPreseason(snapshots);
}
