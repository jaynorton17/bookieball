import type { PanelTone, TeamPalette } from '../../lib/broadcastTheme';
import { PANEL_THEMES } from '../../lib/broadcastTheme';
import { BroadcastPanel } from './BroadcastPanel';
import { TeamOrb } from './TeamOrb';

export function ShowcaseHeroPanel({
  accent = 'gold',
  eyebrow,
  headline,
  copy,
  teamName,
  palette,
  chips,
}: {
  accent?: PanelTone;
  eyebrow: string;
  headline: string;
  copy: string;
  teamName: string;
  palette: TeamPalette;
  chips: Array<{ label: string; value: string }>;
}) {
  return (
    <BroadcastPanel accent={accent} style={{ minHeight: '100%' }}>
      <div style={{ display: 'grid', gap: '1rem', minHeight: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'center' }}>
          <TeamOrb name={teamName} palette={palette} size={78} champion />
          <div style={{ display: 'grid', gap: '0.42rem' }}>
            <span
              style={{
                color: PANEL_THEMES[accent].rim,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                fontSize: '0.72rem',
                fontWeight: 900,
              }}
            >
              {eyebrow}
            </span>
            <strong
              style={{
                color: '#f8fbff',
                fontSize: 'clamp(1.9rem, 3vw, 3.2rem)',
                lineHeight: 0.92,
                letterSpacing: '-0.06em',
                textTransform: 'uppercase',
                fontWeight: 950,
              }}
            >
              {headline}
            </strong>
          </div>
        </div>
        <p
          style={{
            margin: 0,
            color: 'rgba(231,240,255,0.84)',
            lineHeight: 1.58,
            fontSize: '0.96rem',
          }}
        >
          {copy}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(chips.length, 1)}, minmax(0, 1fr))`, gap: '0.75rem' }}>
          {chips.map((chip) => (
              <div
                key={`${headline}-${chip.label}`}
                style={{
                  display: 'grid',
                  gap: '0.32rem',
                  padding: '0.7rem 0.75rem',
                  borderRadius: '14px',
                  border: `1px solid ${PANEL_THEMES[accent].rim}15`,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))',
                  backdropFilter: 'blur(6px)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
            >
              <span
                style={{
                  color: 'rgba(224,235,252,0.68)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                }}
              >
                {chip.label}
              </span>
              <strong
                style={{
                  color: '#f8fbff',
                  fontSize: '1.08rem',
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  fontWeight: 900,
                }}
              >
                {chip.value}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </BroadcastPanel>
  );
}
