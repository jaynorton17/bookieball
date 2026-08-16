import { memo } from 'react';

type TeamBadgeProps = {
  name: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
  size?: number;
};

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function TeamBadgeInner({ name, ballColor, ringColor, textColor, size = 26 }: TeamBadgeProps) {
  return (
    <span
      className="team-badge"
      style={{
        width: size,
        height: size,
        background: ballColor ?? '#77efdb',
        borderColor: ringColor ?? '#0f2b36',
        color: textColor ?? '#0f2b36',
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export const TeamBadge = memo(TeamBadgeInner);
