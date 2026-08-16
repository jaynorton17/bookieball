import { memo } from 'react';

type CompetitionTrophyMarkProps = {
  variant?: 'cup' | 'super' | 'master';
  className?: string;
};

const VARIANT_ACCENTS: Record<NonNullable<CompetitionTrophyMarkProps['variant']>, { cup: string; shine: string; base: string }> = {
  cup: {
    cup: '#ffbd59',
    shine: '#fff1c7',
    base: '#f97316',
  },
  super: {
    cup: '#f7d56a',
    shine: '#fff9dc',
    base: '#60a5fa',
  },
  master: {
    cup: '#d9def2',
    shine: '#ffffff',
    base: '#8b5cf6',
  },
};

function CompetitionTrophyMarkInner({ variant = 'cup', className = '' }: CompetitionTrophyMarkProps) {
  const accent = VARIANT_ACCENTS[variant];

  return (
    <svg
      viewBox="0 0 120 120"
      className={`competition-trophy-mark ${className}`.trim()}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`competition-trophy-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accent.shine} />
          <stop offset="55%" stopColor={accent.cup} />
          <stop offset="100%" stopColor={accent.base} />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      <path
        d="M34 26h52v12c0 13.9-7.4 26.6-19.5 33.4L64 73.1V84h15.5v9.5H40.5V84H56V73.1l-2.5-1.7C41.4 64.6 34 51.9 34 38V26Z"
        fill={`url(#competition-trophy-${variant})`}
      />
      <path
        d="M34 31H23.5c0 13.8 4.9 22.4 15.1 27.2M86 31h10.5c0 13.8-4.9 22.4-15.1 27.2"
        fill="none"
        stroke={accent.cup}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M45 104h30" stroke={accent.base} strokeWidth="8" strokeLinecap="round" />
      <path d="M48 16c8.1-4.6 16-5.8 24 0" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const CompetitionTrophyMark = memo(CompetitionTrophyMarkInner);
