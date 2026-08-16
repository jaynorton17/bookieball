import type { PanelTone } from '../../lib/broadcastTheme';
import { PANEL_THEMES } from '../../lib/broadcastTheme';

export function HeaderBar({
  kicker,
  title,
  subtitle,
  accent = 'gold',
  tag,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  accent?: PanelTone;
  tag?: string;
}) {
  const theme = PANEL_THEMES[accent];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'flex-start' }}>
      <div style={{ display: 'grid', gap: '8px' }}>
        <span
          style={{
            display: 'inline-flex',
            width: 'fit-content',
            padding: '0.36rem 0.7rem',
            borderRadius: '999px',
            border: `1px solid ${theme.rim}28`,
            background: 'linear-gradient(180deg, rgba(28, 42, 68, 0.82), rgba(8, 14, 24, 0.82))',
            color: theme.accent,
            fontSize: '0.7rem',
            fontWeight: 900,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            backdropFilter: 'blur(8px)',
          }}
        >
          {kicker}
        </span>
        <div style={{ display: 'grid', gap: '6px' }}>
          <h1
            style={{
              margin: 0,
              color: '#f8fbff',
              fontSize: 'clamp(2.4rem, 4.5vw, 4.8rem)',
              lineHeight: 0.9,
              letterSpacing: '-0.06em',
              fontWeight: 950,
              textTransform: 'uppercase',
              textShadow: '0 12px 30px rgba(0,0,0,0.35)',
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              style={{
                margin: 0,
                maxWidth: '680px',
                color: 'rgba(228, 238, 255, 0.7)',
                fontSize: '0.95rem',
                letterSpacing: '0.02em',
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {tag ? (
        <div
          style={{
            padding: '0.55rem 0.8rem',
            minWidth: '80px',
            borderRadius: '14px',
            border: `1px solid ${theme.rim}22`,
            background: 'linear-gradient(180deg, rgba(28, 40, 62, 0.82), rgba(6, 12, 20, 0.82))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
            color: theme.accent,
            fontWeight: 800,
            textAlign: 'right',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontSize: '0.72rem',
            flexShrink: 0,
          }}
        >
          {tag}
        </div>
      ) : null}
    </div>
  );
}
