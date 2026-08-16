export function TrophyMark({ accent }: { accent: string }) {
  return (
    <svg width="160" height="190" viewBox="0 0 160 190" style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <linearGradient id="trophy-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7e4a7" />
          <stop offset="42%" stopColor="#d6a73b" />
          <stop offset="100%" stopColor="#6d4811" />
        </linearGradient>
        <filter id="trophy-glow">
          <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor={accent} floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Body */}
      <path
        d="M 48 50 C 48 30, 112 30, 112 50 L 105 110 C 105 128, 55 128, 55 110 Z"
        fill="url(#trophy-body)"
        filter="url(#trophy-glow)"
      />
      {/* Inner highlight */}
      <path
        d="M 54 54 C 54 36, 106 36, 106 54 L 100 104 C 100 120, 60 120, 60 104 Z"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.5"
      />

      {/* Left handle */}
      <path
        d="M 48 68 L 18 68 C 8 68, 8 88, 18 88 L 48 88"
        fill="none"
        stroke="#d7ab42"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right handle */}
      <path
        d="M 112 68 L 142 68 C 152 68, 152 88, 142 88 L 112 88"
        fill="none"
        stroke="#d7ab42"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Stem */}
      <rect x="70" y="120" width="20" height="22" rx="4" fill="url(#trophy-body)" />
      {/* Stem highlight */}
      <rect x="72" y="122" width="16" height="18" rx="3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* Base */}
      <rect x="36" y="148" width="88" height="20" rx="8" fill="url(#trophy-body)" />
      {/* Base highlight */}
      <rect x="38" y="150" width="84" height="16" rx="6" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
    </svg>
  );
}
