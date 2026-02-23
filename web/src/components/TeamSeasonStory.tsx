import { useEffect, useMemo, useState } from 'react';
import { displayDivisionName } from '../lib/divisionLabels';

const DIVISION_LEVELS = [
  'Champions Bookies',
  'Premier Bookies',
  'Average Bookies',
  'Struggling Bookies',
  'Awful Bookies',
];

export type TeamSeasonHistory = {
  season: string;
  division: string;
  rank: number;
  points: number;
  profit: number;
  spins: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  cupFinish: string;
};

type TeamSeasonStoryProps = {
  history: TeamSeasonHistory[];
  compact?: boolean;
  autoPlay?: boolean;
  title?: string;
};

const seasonNumber = (season: string): number => {
  const value = Number(season.replace(/\D/g, ''));
  return Number.isFinite(value) ? value : 0;
};

export function TeamSeasonStory({
  history,
  compact = false,
  autoPlay = false,
  title = 'Season Journey',
}: TeamSeasonStoryProps) {
  const [slideIndex, setSlideIndex] = useState(0);

  const ordered = useMemo(
    () => history.slice().sort((a, b) => seasonNumber(a.season) - seasonNumber(b.season)),
    [history],
  );

  useEffect(() => {
    setSlideIndex(0);
  }, [ordered.length]);

  useEffect(() => {
    if (!autoPlay || ordered.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % ordered.length);
    }, compact ? 4000 : 5500);
    return () => window.clearInterval(timer);
  }, [autoPlay, compact, ordered.length]);

  const divisions = useMemo(() => new Map(DIVISION_LEVELS.map((div, index) => [div, index])), []);
  const width = Math.max(compact ? 420 : 560, ordered.length * (compact ? 84 : 92));
  const height = compact ? 180 : 220;
  const margin = { top: 24, right: 30, bottom: 38, left: 90 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const points = ordered.map((entry, index) => {
    const level = divisions.get(entry.division) ?? (DIVISION_LEVELS.length - 1);
    const x = ordered.length > 1
      ? margin.left + (plotWidth / (ordered.length - 1)) * index
      : margin.left + plotWidth / 2;
    const y = margin.top + (plotHeight / (DIVISION_LEVELS.length - 1)) * level;
    return { x, y, entry };
  });

  const path = points.length > 0
    ? points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    : '';

  const slide = ordered[slideIndex];
  const slideLines = slide
    ? [
        `Division: ${displayDivisionName(slide.division)}`,
        `Finish: ${slide.rank ? `#${slide.rank}` : '—'} • Points: ${slide.points} • Profit: ${slide.profit}`,
        `Record: ${slide.wins}-${slide.draws}-${slide.losses} • Spins: ${slide.spins}`,
        `Cup: ${slide.cupFinish}`,
      ]
    : [];

  return (
    <div className={`team-story${compact ? ' compact' : ''}`}>
      <div className="team-story-header">
        <h4>{title}</h4>
        {ordered.length > 0 && (
          <span className="team-story-count">{ordered.length} seasons</span>
        )}
      </div>
      <div className="team-story-chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Season journey chart">
          <rect x="0" y="0" width={width} height={height} fill="transparent" />
          <line
            className="story-axis"
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={height - margin.bottom}
          />
          <line
            className="story-axis"
            x1={margin.left}
            y1={height - margin.bottom}
            x2={width - margin.right}
            y2={height - margin.bottom}
          />

          {DIVISION_LEVELS.map((division, idx) => {
            const y = margin.top + (plotHeight / (DIVISION_LEVELS.length - 1)) * idx;
            return (
              <g key={`tick-${division}`}>
                <line className="story-grid" x1={margin.left} y1={y} x2={width - margin.right} y2={y} />
                <text className="story-label" x={margin.left - 10} y={y + 4} textAnchor="end">
                  {displayDivisionName(division)}
                </text>
              </g>
            );
          })}

          {points.length > 1 && (
            <path className="story-line" d={path} />
          )}
          {points.map((point) => (
            <circle key={`pt-${point.entry.season}`} className="story-point" cx={point.x} cy={point.y} r={5} />
          ))}

          {points.map((point) => (
            <text key={`x-${point.entry.season}`} className="story-xlabel" x={point.x} y={height - 12} textAnchor="middle">
              {point.entry.season}
            </text>
          ))}

          <text className="story-axis-label" x={margin.left - 52} y={margin.top - 8} textAnchor="start">
            League
          </text>
          <text className="story-axis-label" x={width - margin.right} y={height - 8} textAnchor="end">
            Season
          </text>
        </svg>
      </div>

      <div className="team-story-slide">
        {slide ? (
          <>
            <div className="team-story-season">{slide.season}</div>
            <div className="team-story-lines">
              {slideLines.map((line) => (
                <div key={line} className="team-story-line">{line}</div>
              ))}
            </div>
          </>
        ) : (
          <div className="muted">No season data yet.</div>
        )}
        <div className="team-story-controls">
          <button
            type="button"
            className="team-story-btn"
            onClick={() => setSlideIndex((prev) => (prev - 1 + ordered.length) % (ordered.length || 1))}
            disabled={ordered.length <= 1}
          >
            Prev
          </button>
          <span className="team-story-progress">
            {ordered.length > 0 ? `${slideIndex + 1}/${ordered.length}` : '0/0'}
          </span>
          <button
            type="button"
            className="team-story-btn"
            onClick={() => setSlideIndex((prev) => (prev + 1) % (ordered.length || 1))}
            disabled={ordered.length <= 1}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
