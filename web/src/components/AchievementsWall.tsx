type Achievement = {
  key: string;
  label: string;
  teamName: string;
  value: string;
};

type AchievementsWallProps = {
  achievements: Achievement[];
};

export function AchievementsWall({ achievements }: AchievementsWallProps) {
  const getAchievementTheme = (key: string) => {
    switch (key) {
      case 'super_cup':
        return {
          title: 'Super Cup Winner',
          gradient: 'linear-gradient(135deg, #ffd25f 0%, #ff9f43 100%)',
          icon: (
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
              <path d="M12 2a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" fill="#ffd25f50" />
            </svg>
          ),
          border: '#ffd25f',
        };
      case 'top_profit':
        return {
          title: 'Profit King',
          gradient: 'linear-gradient(135deg, #77efdb 0%, #10ac84 100%)',
          icon: (
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1={12} y1={1} x2={12} y2={23} />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
          border: '#77efdb',
        };
      case 'most_wins':
        return {
          title: 'Consistency King',
          gradient: 'linear-gradient(135deg, #7dc9ff 0%, #2e86de 100%)',
          icon: (
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ),
          border: '#7dc9ff',
        };
      case 'best_single':
        return {
          title: 'Spotlight Performance',
          gradient: 'linear-gradient(135deg, #ff9ff3 0%, #f368e0 100%)',
          icon: (
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#ff9ff350" />
            </svg>
          ),
          border: '#ff9ff3',
        };
      default:
        return {
          title: 'Accolade',
          gradient: 'linear-gradient(135deg, #b0c5d4 0%, #718093 100%)',
          icon: (
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
          ),
          border: '#b0c5d4',
        };
    }
  };

  return (
    <div className="achievements-wall-container">
      <div className="achievements-wall-header">
        <h4>Season Accolades &amp; Records</h4>
        <span className="muted small">Awarded to the top performers in the current season</span>
      </div>

      <div className="achievements-grid">
        {achievements.map((ach) => {
          const theme = getAchievementTheme(ach.key);
          return (
            <div
              key={ach.key}
              className="achievement-card"
              style={{
                borderColor: theme.border,
                ['--badge-accent' as string]: theme.border,
              } as React.CSSProperties}
            >
              <div className="achievement-icon-wrapper" style={{ background: theme.gradient }}>
                {theme.icon}
              </div>
              <div className="achievement-details">
                <span className="achievement-badge-title">{theme.title}</span>
                <span className="achievement-label">{ach.label}</span>
                <h3 className="achievement-team">{ach.teamName}</h3>
                <span className="achievement-value font-mono">
                  {ach.key === 'top_profit' || ach.key === 'best_single' ? `£${ach.value}` : ach.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
