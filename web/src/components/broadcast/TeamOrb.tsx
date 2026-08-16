import { type CSSProperties } from 'react';
import type { TeamPalette } from '../../lib/broadcastTheme';
import { initials } from '../../lib/finaleHelpers';

export function TeamOrb({
  name,
  palette,
  size = 64,
  champion = false,
}: {
  name: string;
  palette: TeamPalette;
  size?: number;
  champion?: boolean;
}) {
  const outerStyle: CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: `radial-gradient(circle at 30% 22%, rgba(255,255,255,0.35), rgba(255,255,255,0.02) 40%, transparent 60%), ${palette.ballColor}`,
    border: `2.5px solid ${palette.ringColor}`,
    boxShadow: champion
      ? `0 0 0 5px rgba(255,255,255,0.05), 0 0 20px ${palette.ringColor}55, inset 0 10px 14px rgba(255,255,255,0.16)`
      : `0 0 0 3px rgba(255,255,255,0.04), inset 0 8px 12px rgba(255,255,255,0.12)`,
    overflow: 'hidden',
    flexShrink: 0,
  };

  return (
    <div style={outerStyle} title={name}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0) 46%, rgba(0,0,0,0.12) 100%)',
        }}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: size * 0.32,
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: palette.textColor,
          textShadow: '0 2px 6px rgba(255,255,255,0.2)',
        }}
      >
        {initials(name)}
      </span>
    </div>
  );
}
