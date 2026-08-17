import type { TableJourneySnapshot } from './TablePositionJourney';

type Props = {
  delta: number | null | undefined;
  compact?: boolean;
};

function gwNumber(gw: string): number {
  const parsed = Number(gw.replace('GW', ''));
  return Number.isFinite(parsed) ? parsed : 99;
}

export function rankMovementFromJourney(
  snapshots: TableJourneySnapshot[],
  teamId: number,
  division?: string,
): number | null {
  const ordered = snapshots
    .slice()
    .sort((a, b) => gwNumber(a.gw) - gwNumber(b.gw));

  const relevant = division
    ? ordered.map((snapshot) => ({ ...snapshot, rows: snapshot.rows.filter((row) => row.division === division) }))
    : ordered;

  if (relevant.length < 2) return null;
  const current = relevant[relevant.length - 1];
  const previous = relevant[relevant.length - 2];
  const currentRow = current.rows.find((row) => row.teamId === teamId);
  const previousRow = previous.rows.find((row) => row.teamId === teamId);
  if (!currentRow || !previousRow) return null;
  return previousRow.rank - currentRow.rank;
}

export function RankMovementBadge({ delta, compact = false }: Props) {
  const movement = delta ?? 0;
  const direction = movement > 0 ? 'up' : movement < 0 ? 'down' : 'flat';
  const amount = Math.abs(movement);
  const label = direction === 'up' ? `Up ${amount} position${amount === 1 ? '' : 's'}` : direction === 'down' ? `Down ${amount} position${amount === 1 ? '' : 's'}` : 'No change from previous gameweek';

  return (
    <span className={`rank-movement-chip is-${direction}${compact ? ' is-compact' : ''}`} title={label} aria-label={label}>
      <i aria-hidden="true">{direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—'}</i>
      {direction !== 'flat' && <b>{amount}</b>}
    </span>
  );
}
