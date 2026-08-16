import type { PanelTone } from '../../lib/broadcastTheme';
import { PANEL_THEMES } from '../../lib/broadcastTheme';
import { BroadcastPanel } from './BroadcastPanel';

export function StatTile({
  label,
  value,
  note,
  accent = 'gold',
}: {
  label: string;
  value: string;
  note?: string;
  accent?: PanelTone;
}) {
  const theme = PANEL_THEMES[accent];
  return (
    <BroadcastPanel accent={accent}>
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <span
          style={{
            color: 'rgba(221,232,248,0.68)',
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
          }}
        >
          {label}
        </span>
        <strong
          style={{
            fontSize: 'clamp(1.6rem, 2.2vw, 2.6rem)',
            lineHeight: 0.92,
            letterSpacing: '-0.06em',
            fontWeight: 950,
            color: theme.text,
            textShadow: '0 8px 20px rgba(0,0,0,0.28)',
          }}
        >
          {value}
        </strong>
        {note ? (
          <span style={{ color: 'rgba(235, 242, 255, 0.68)', fontSize: '0.78rem' }}>{note}</span>
        ) : null}
      </div>
    </BroadcastPanel>
  );
}
