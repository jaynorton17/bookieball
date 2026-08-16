import { type CSSProperties, type ReactNode } from 'react';
import type { PanelTone } from '../../lib/broadcastTheme';
import { PANEL_THEMES, GLASS_BACKDROP } from '../../lib/broadcastTheme';

export function BroadcastPanel({
  title,
  subtitle,
  accent = 'gold',
  children,
  style,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  accent?: PanelTone;
  children: ReactNode;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
}) {
  const theme = PANEL_THEMES[accent];

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '22px',
        border: `1px solid ${theme.glassBorder}`,
        background: theme.glassBg,
        backdropFilter: GLASS_BACKDROP,
        WebkitBackdropFilter: GLASS_BACKDROP,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -12px 24px rgba(0,0,0,0.12), 0 12px 24px rgba(0,0,0,0.18), 0 0 0 1px ${theme.panelGlow}`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 20%)',
          pointerEvents: 'none',
        }}
      />
      {title ? (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '0.6rem 1rem',
            borderBottom: `1px solid ${theme.rim}18`,
            background: theme.header,
            color: theme.text,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -8px 10px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '0.75rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              fontSize: '0.78rem',
            }}
          >
            <span>{title}</span>
            {subtitle ? <span style={{ opacity: 0.88, fontSize: '0.68rem', letterSpacing: '0.12em' }}>{subtitle}</span> : null}
          </div>
        </div>
      ) : null}
      <div style={{ position: 'relative', zIndex: 1, padding: '1rem', ...contentStyle }}>{children}</div>
    </div>
  );
}
