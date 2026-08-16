import type { PanelTone, TeamPalette } from '../../lib/broadcastTheme';
import { BroadcastPanel } from './BroadcastPanel';
import { TeamOrb } from './TeamOrb';
import { formatSigned } from '../../lib/finaleHelpers';

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

export function CompactStandingsBoard({
  title,
  rows,
  accent = 'steel',
  subtitle,
}: {
  title: string;
  rows: TitleRaceRow[];
  accent?: PanelTone;
  subtitle?: string;
}) {
  return (
    <BroadcastPanel title={title} subtitle={subtitle ?? 'Final order'} accent={accent} style={{ minHeight: '100%' }}>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {rows.map((row, index) => (
          <div
            key={`${title}-${row.teamName}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px auto 1fr auto',
              gap: '0.6rem',
              alignItems: 'center',
              padding: '0.55rem 0.65rem',
              borderRadius: '12px',
              border: `1px solid ${row.status === 'champion' ? 'rgba(249,221,145,0.1)' : 'rgba(255,255,255,0.06)'}`,
              background: row.status === 'champion'
                ? 'linear-gradient(180deg, rgba(249,221,145,0.14), rgba(121,78,18,0.1))'
                : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
            }}
          >
            <span style={{ color: row.status === 'champion' ? '#f5d38f' : 'rgba(235,243,255,0.7)', fontWeight: 900, fontSize: '0.82rem', textAlign: 'center' }}>
              {index + 1}
            </span>
            <TeamOrb name={row.teamName} palette={row.palette} size={28} champion={row.status === 'champion'} />
            <div style={{ display: 'grid', gap: '0.12rem', minWidth: 0 }}>
              <strong
                style={{
                  color: '#f8fbff',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.teamName}
              </strong>
              <span style={{ color: 'rgba(223,236,255,0.62)', fontSize: '0.72rem' }}>
                {formatSigned(row.profit)} • {row.points} pts
              </span>
            </div>
            <span style={{ color: 'rgba(235,243,255,0.7)', fontWeight: 800, fontSize: '0.82rem' }}>{row.played}P</span>
          </div>
        ))}
      </div>
    </BroadcastPanel>
  );
}
