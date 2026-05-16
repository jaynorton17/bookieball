import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { JourneyTeam } from './roundupTypes';

type DivisionJourneyGraphProps = {
  teams: JourneyTeam[];
  currentGwNumber: number;
  active: boolean;
  resetToken: string;
  animationDurationMs?: number;
};

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 470;
const PADDING_LEFT = 72;
const PADDING_RIGHT = 32;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 58;

function rankToY(rank: number, maxRank: number): number {
  if (maxRank <= 1) {
    return PADDING_TOP;
  }
  const clamped = Math.max(1, Math.min(maxRank, rank));
  const span = VIEWBOX_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  return PADDING_TOP + ((clamped - 1) / (maxRank - 1)) * span;
}

function weekToX(week: number, maxWeek: number): number {
  if (maxWeek <= 0) {
    return PADDING_LEFT;
  }
  const span = VIEWBOX_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  return PADDING_LEFT + (span * week) / maxWeek;
}

function resolveTeamRankAtWeek(team: JourneyTeam, week: number): number {
  if (team.ranks.length === 0) {
    return 1;
  }
  if (week < team.ranks.length) {
    return Math.max(1, Math.round(team.ranks[week] ?? 1));
  }
  return Math.max(1, Math.round(team.ranks[team.ranks.length - 1] ?? 1));
}

function resolveInterpolatedRank(team: JourneyTeam, weekProgress: number): number {
  const lowerWeek = Math.max(0, Math.floor(weekProgress));
  const upperWeek = Math.max(lowerWeek, Math.ceil(weekProgress));
  const lowerRank = resolveTeamRankAtWeek(team, lowerWeek);
  const upperRank = resolveTeamRankAtWeek(team, upperWeek);
  const blend = weekProgress - lowerWeek;
  return lowerRank + ((upperRank - lowerRank) * blend);
}

export function DivisionJourneyGraph({
  teams,
  currentGwNumber,
  active,
  resetToken,
  animationDurationMs,
}: DivisionJourneyGraphProps) {
  const safeCurrentGw = Math.max(0, currentGwNumber);
  const [weekProgress, setWeekProgress] = useState(0);

  useEffect(() => {
    setWeekProgress(0);
    if (!active || safeCurrentGw <= 0) {
      return undefined;
    }

    const durationMs = Math.max(1000, animationDurationMs ?? (safeCurrentGw * 1000));
    let rafId = 0;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      setWeekProgress(progress * safeCurrentGw);
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [active, resetToken, safeCurrentGw]);

  const weekRange = useMemo(
    () => Array.from({ length: safeCurrentGw + 1 }, (_, index) => index),
    [safeCurrentGw],
  );

  const maxRank = useMemo(() => {
    const rankValues = teams.flatMap((team) => team.ranks).map((value) => Math.max(1, Math.round(value)));
    return Math.max(1, teams.length, ...rankValues);
  }, [teams]);

  const weekProgressClamped = Math.min(safeCurrentGw, Math.max(0, weekProgress));

  return (
    <section className="roundup-journey-graph chart-container" aria-label="League position journey graph">
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img">
        <title>Division league position journey</title>
        {Array.from({ length: maxRank }, (_, index) => {
          const rank = index + 1;
          const y = rankToY(rank, maxRank);
          return (
            <g key={`rank-${rank}`}>
              <line x1={PADDING_LEFT} y1={y} x2={VIEWBOX_WIDTH - PADDING_RIGHT} y2={y} className="roundup-grid-line" />
              <text x={16} y={y + 4} className="roundup-grid-rank-label">#{rank}</text>
            </g>
          );
        })}

        {weekRange.map((week) => {
          const x = weekToX(week, safeCurrentGw);
          return (
            <g key={`week-${week}`}>
              <line x1={x} y1={PADDING_TOP} x2={x} y2={VIEWBOX_HEIGHT - PADDING_BOTTOM} className="roundup-grid-column" />
              <text x={x} y={VIEWBOX_HEIGHT - 12} className="roundup-grid-week-label">GW{week}</text>
            </g>
          );
        })}

        {teams.map((team) => {
          const points = weekRange.map((week) => {
            const rank = resolveTeamRankAtWeek(team, week);
            return {
              x: weekToX(week, safeCurrentGw),
              y: rankToY(rank, maxRank),
            };
          });
          const completedWeek = Math.floor(weekProgressClamped);
          const visibleTrail = points.slice(0, completedWeek + 1);
          const nextWeek = Math.min(safeCurrentGw, completedWeek + 1);
          if (nextWeek > completedWeek && weekProgressClamped > completedWeek) {
            const blend = weekProgressClamped - completedWeek;
            const fromPoint = points[completedWeek];
            const toPoint = points[nextWeek];
            if (fromPoint && toPoint) {
              visibleTrail.push({
                x: fromPoint.x + ((toPoint.x - fromPoint.x) * blend),
                y: fromPoint.y + ((toPoint.y - fromPoint.y) * blend),
              });
            }
          }
          const trailPath = visibleTrail.map((point) => `${point.x},${point.y}`).join(' ');
          return (
            <polyline
              key={`trail-${team.teamId}`}
              points={trailPath}
              className="roundup-team-trail"
              style={{ ['--roundup-trail-color' as string]: team.ringColor ?? team.ballColor ?? '#f3c62d' } as CSSProperties}
            />
          );
        })}

        {teams.map((team) => {
          const rank = resolveInterpolatedRank(team, weekProgressClamped);
          const x = weekToX(weekProgressClamped, safeCurrentGw);
          const y = rankToY(rank, maxRank);
          const initials = team.teamName.trim().slice(0, 2).toUpperCase() || '?';
          return (
            <g
              key={`ball-${team.teamId}`}
              className="roundup-team-ball"
              transform={`translate(${x} ${y})`}
              style={{
                ['--roundup-ball-fill' as string]: team.ballColor ?? '#f0f4ff',
                ['--roundup-ball-ring' as string]: team.ringColor ?? '#ffffff',
                ['--roundup-ball-text' as string]: team.textColor ?? '#121212',
              } as CSSProperties}
            >
              <circle r={13.5} />
              <text x={0} y={0}>{initials}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
