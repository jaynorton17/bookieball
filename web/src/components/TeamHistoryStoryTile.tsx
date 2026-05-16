import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { displayDivisionName } from '../lib/divisionLabels';
import { TeamBadge } from './TeamBadge';

const DIVISION_LEVELS = [
  'Champions Bookies',
  'Premier Bookies',
  'Average Bookies',
  'Struggling Bookies',
  'Awful Bookies',
  'Division 4 Bookies',
];
const CUP_STAGE_LABELS = ['R32', 'R16', 'QF', 'SF', 'Final'];
const MASTER_CUP_STAGE_LABELS = ['R16', 'QF', 'SF', 'Final'];

const STEP_DURATION_MS = 2000;

type TeamMeta = {
  name: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
};

type StoryPayload = {
  currentSeason: string;
  currentGw: string;
  currentDivisionJourney: {
    division: string;
    points: Array<{ label: string; gw: string; rank: number; total: number }>;
  };
  divisionJourney: Array<{ season: string; division: string; divisionLevel: number; rank: number; total: number }>;
  masterLeagueJourney: Array<{ season: string; rank: number; total: number }>;
  trioLeagueJourney: Array<{ season: string; division: string; rank: number; total: number }>;
  tierLeagueJourney: Array<{ season: string; division: string; rank: number; total: number }>;
  allTimePointsJourney: Array<{ season: string; rank: number; total: number; points: number }>;
};

type SlidePoint = {
  label: string;
  value: number;
  badge: string;
  detail: string;
};

type SlideSeries = {
  team: TeamMeta;
  points: SlidePoint[];
};

type SlideDefinition = {
  id: string;
  title: string;
  subtitle: string;
  labels: string[];
  series: SlideSeries[];
  axis: 'rank' | 'division';
  maxValue: number;
  axisLabels?: Array<{ value: number; label: string }>;
};

type TeamHistoryStoryTileProps = {
  entries: Array<{
    team: TeamMeta;
    story: StoryPayload;
    cupJourney?: SlidePoint[];
    masterCupJourney?: SlidePoint[];
  }>;
};

type ChartPoint = SlidePoint & {
  labelIndex: number;
  x: number;
  y: number;
};

const shellStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: '1rem',
  padding: '1rem',
  borderRadius: '22px',
  border: '1px solid rgba(255, 232, 177, 0.16)',
  background: [
    'linear-gradient(180deg, rgba(30, 20, 51, 0.98), rgba(8, 11, 22, 0.99))',
    'repeating-linear-gradient(145deg, rgba(255,255,255,0.018) 0 2px, rgba(255,255,255,0) 2px 8px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -14px 20px rgba(0,0,0,0.22), 0 18px 30px rgba(0,0,0,0.22)',
};

const headerStyle: CSSProperties = {
  display: 'grid',
  gap: '0.85rem',
};

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap',
};

const identityStyle: CSSProperties = {
  display: 'grid',
  gap: '0.16rem',
};

const selectedTeamRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const selectedTeamChipStyle = (accent: string): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.42rem',
  padding: '0.34rem 0.68rem',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fcf7e3',
  fontSize: '0.76rem',
  fontWeight: 800,
  boxShadow: `inset 3px 0 0 ${accent}`,
});

const slidePillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.45rem',
  flexWrap: 'wrap',
};

const slidePillStyle = (active: boolean): CSSProperties => ({
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '999px',
  padding: '0.38rem 0.68rem',
  background: active
    ? 'linear-gradient(180deg, rgba(255, 221, 142, 0.92), rgba(135, 180, 255, 0.74))'
    : 'rgba(255,255,255,0.05)',
  color: active ? '#0c2135' : '#f7fbff',
  fontSize: '0.74rem',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  cursor: 'pointer',
});

const chartShellStyle: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: [
    'linear-gradient(180deg, rgba(30, 43, 66, 0.94), rgba(8, 13, 24, 0.98))',
    'repeating-linear-gradient(145deg, rgba(255,255,255,0.015) 0 2px, rgba(255,255,255,0) 2px 8px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 18px rgba(0,0,0,0.18)',
  padding: '0.95rem',
};

const chartHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

const chartMetaChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.28rem 0.62rem',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fcf7e3',
  fontSize: '0.74rem',
  fontWeight: 800,
};

const chartCanvasStyle: CSSProperties = {
  overflowX: 'auto',
  paddingBottom: '0.1rem',
};

const seriesLegendStyle: CSSProperties = {
  display: 'flex',
  gap: '0.45rem',
  flexWrap: 'wrap',
};

const seriesLegendChipStyle = (accent: string): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.42rem',
  padding: '0.3rem 0.62rem',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#f7fbff',
  fontSize: '0.74rem',
  boxShadow: `inset 3px 0 0 ${accent}`,
});

const detailGridStyle: CSSProperties = {
  display: 'grid',
  gap: '0.55rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

const detailCardStyle: CSSProperties = {
  display: 'grid',
  gap: '0.28rem',
  padding: '0.8rem 0.88rem',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const controlButtonStyle = (primary: boolean): CSSProperties => ({
  border: primary ? '1px solid rgba(255, 226, 149, 0.44)' : '1px solid rgba(255,255,255,0.14)',
  borderRadius: '999px',
  padding: '0.6rem 0.95rem',
  background: primary
    ? 'linear-gradient(135deg, rgba(255, 214, 112, 0.88), rgba(119, 239, 219, 0.58))'
    : 'rgba(255,255,255,0.05)',
  color: primary ? '#0f2b36' : '#f7fbff',
  fontWeight: 800,
  cursor: 'pointer',
});

function labelOrderValue(label: string): number {
  const match = label.match(/(\d+)/);
  if (!match?.[1]) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function orderedLabels(series: SlideSeries[]): string[] {
  return Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.label))))
    .sort((left, right) => {
      const leftValue = labelOrderValue(left);
      const rightValue = labelOrderValue(right);
      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
      return left.localeCompare(right);
    });
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const controlX = previous.x + (current.x - previous.x) / 2;
    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

function interpolateSeriesPoint(points: ChartPoint[], progress: number): { x: number; y: number } | null {
  if (points.length === 0) {
    return null;
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return null;
  }
  if (progress < first.labelIndex) {
    return null;
  }
  if (progress <= first.labelIndex) {
    return { x: first.x, y: first.y };
  }
  if (progress >= last.labelIndex) {
    return { x: last.x, y: last.y };
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (!current || !next) {
      continue;
    }
    if (progress >= current.labelIndex && progress <= next.labelIndex) {
      const span = Math.max(1, next.labelIndex - current.labelIndex);
      const mix = (progress - current.labelIndex) / span;
      return {
        x: current.x + (next.x - current.x) * mix,
        y: current.y + (next.y - current.y) * mix,
      };
    }
  }
  return { x: last.x, y: last.y };
}

function buildVisibleSeriesPoints(points: ChartPoint[], progress: number): Array<{ x: number; y: number }> {
  if (points.length === 0) {
    return [];
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || progress < first.labelIndex) {
    return [];
  }
  if (progress >= last.labelIndex) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }
  const visible = points
    .filter((point) => point.labelIndex <= progress)
    .map((point) => ({ x: point.x, y: point.y }));
  const interpolated = interpolateSeriesPoint(points, progress);
  if (interpolated) {
    const lastVisible = visible[visible.length - 1];
    if (!lastVisible || lastVisible.x !== interpolated.x || lastVisible.y !== interpolated.y) {
      visible.push(interpolated);
    }
  }
  return visible;
}

function activeSeriesPoint(points: ChartPoint[], progress: number): SlidePoint | null {
  if (points.length === 0) {
    return null;
  }
  const currentLabelIndex = Math.max(0, Math.floor(progress + 0.001));
  let latest: ChartPoint | null = null;
  points.forEach((point) => {
    if (point.labelIndex <= currentLabelIndex) {
      latest = point;
    }
  });
  return latest ?? points[0] ?? null;
}

function rankTicks(maxValue: number): number[] {
  if (maxValue <= 6) {
    return Array.from({ length: maxValue }, (_, index) => index + 1);
  }
  return Array.from(new Set([1, Math.max(1, Math.ceil(maxValue / 2)), maxValue])).sort((left, right) => left - right);
}

function buildSlideDefinitions(entries: TeamHistoryStoryTileProps['entries']): SlideDefinition[] {
  const built: SlideDefinition[] = [];

  const currentSeries = entries
    .map(({ team, story }) => ({
      team,
      points: story.currentDivisionJourney.points.map((point) => ({
        label: point.label,
        value: point.rank,
        badge: `${point.label} • #${point.rank}`,
        detail: `${displayDivisionName(story.currentDivisionJourney.division)} • #${point.rank}/${point.total}`,
      })),
    }))
    .filter((series) => series.points.length > 0);
  if (currentSeries.length > 0) {
    built.push({
      id: 'current-division',
      title: 'Current Division Journey',
      subtitle: `${entries[0]?.story.currentSeason ?? ''} • week by week • one gameweek every 2 seconds`,
      labels: orderedLabels(currentSeries),
      series: currentSeries,
      axis: 'rank',
      maxValue: Math.max(1, ...entries.flatMap(({ story }) => story.currentDivisionJourney.points.map((point) => point.total))),
    });
  }

  const cupSeries = entries
    .map(({ team, cupJourney }) => ({
      team,
      points: cupJourney ?? [],
    }))
    .filter((series) => series.points.length > 0);
  if (cupSeries.length > 0) {
    built.push({
      id: 'current-cup',
      title: 'Current BookieBall Cup Run',
      subtitle: `${entries[0]?.story.currentSeason ?? ''} • route through this season's cup`,
      labels: CUP_STAGE_LABELS,
      series: cupSeries,
      axis: 'division',
      maxValue: CUP_STAGE_LABELS.length,
      axisLabels: CUP_STAGE_LABELS.map((label, index) => ({
        value: CUP_STAGE_LABELS.length - index,
        label,
      })),
    });
  }

  const masterCupSeries = entries
    .map(({ team, masterCupJourney }) => ({
      team,
      points: masterCupJourney ?? [],
    }))
    .filter((series) => series.points.length > 0);
  if (masterCupSeries.length > 0) {
    built.push({
      id: 'current-master-cup',
      title: 'Current Master Cup Run',
      subtitle: `${entries[0]?.story.currentSeason ?? ''} • route through this season's master cup`,
      labels: MASTER_CUP_STAGE_LABELS,
      series: masterCupSeries,
      axis: 'division',
      maxValue: MASTER_CUP_STAGE_LABELS.length,
      axisLabels: MASTER_CUP_STAGE_LABELS.map((label, index) => ({
        value: MASTER_CUP_STAGE_LABELS.length - index,
        label,
      })),
    });
  }

  const divisionSeries = entries
    .map(({ team, story }) => ({
      team,
      points: story.divisionJourney.map((point) => ({
        label: point.season,
        value: point.divisionLevel,
        badge: `${point.season} • ${displayDivisionName(point.division)}`,
        detail: `${displayDivisionName(point.division)} • #${point.rank}/${point.total}`,
      })),
    }))
    .filter((series) => series.points.length > 0);
  if (divisionSeries.length > 0) {
    built.push({
      id: 'division-history',
      title: 'Division Movement',
      subtitle: 'Season by season through the main ladder',
      labels: orderedLabels(divisionSeries),
      series: divisionSeries,
      axis: 'division',
      maxValue: DIVISION_LEVELS.length,
      axisLabels: DIVISION_LEVELS.map((division, index) => ({
        value: index + 1,
        label: displayDivisionName(division),
      })),
    });
  }

  const masterSeries = entries
    .map(({ team, story }) => ({
      team,
      points: story.masterLeagueJourney.map((point) => ({
        label: point.season,
        value: point.rank,
        badge: `${point.season} • #${point.rank}`,
        detail: `Master League • #${point.rank}/${point.total}`,
      })),
    }))
    .filter((series) => series.points.length > 0);
  if (masterSeries.length > 0) {
    built.push({
      id: 'master-history',
      title: 'Master League Position',
      subtitle: 'Season by season master-league standing',
      labels: orderedLabels(masterSeries),
      series: masterSeries,
      axis: 'rank',
      maxValue: Math.max(1, ...entries.flatMap(({ story }) => story.masterLeagueJourney.map((point) => point.total))),
    });
  }

  const trioSeries = entries
    .map(({ team, story }) => ({
      team,
      points: story.trioLeagueJourney.map((point) => ({
        label: point.season,
        value: point.rank,
        badge: `${point.season} • ${point.division}`,
        detail: `${point.division} • #${point.rank}/${point.total}`,
      })),
    }))
    .filter((series) => series.points.length > 0);
  if (trioSeries.length > 0) {
    built.push({
      id: 'trio-history',
      title: 'Trio League Position',
      subtitle: 'Season by season trio-league standing',
      labels: orderedLabels(trioSeries),
      series: trioSeries,
      axis: 'rank',
      maxValue: Math.max(1, ...entries.flatMap(({ story }) => story.trioLeagueJourney.map((point) => point.total))),
    });
  }

  const tierSeries = entries
    .map(({ team, story }) => ({
      team,
      points: story.tierLeagueJourney.map((point) => ({
        label: point.season,
        value: point.rank,
        badge: `${point.season} • ${point.division}`,
        detail: `${point.division} • #${point.rank}/${point.total}`,
      })),
    }))
    .filter((series) => series.points.length > 0);
  if (tierSeries.length > 0) {
    built.push({
      id: 'tier-history',
      title: 'Tier League Position',
      subtitle: 'Season by season tier-league standing',
      labels: orderedLabels(tierSeries),
      series: tierSeries,
      axis: 'rank',
      maxValue: Math.max(1, ...entries.flatMap(({ story }) => story.tierLeagueJourney.map((point) => point.total))),
    });
  }

  const allTimeSeries = entries
    .map(({ team, story }) => ({
      team,
      points: story.allTimePointsJourney.map((point) => ({
        label: point.season,
        value: point.rank,
        badge: `${point.season} • #${point.rank}`,
        detail: `All-time points • #${point.rank}/${point.total} on ${point.points} points`,
      })),
    }))
    .filter((series) => series.points.length > 0);
  if (allTimeSeries.length > 0) {
    built.push({
      id: 'all-time-history',
      title: 'All-Time Points Position',
      subtitle: 'Standing at the close of each season snapshot',
      labels: orderedLabels(allTimeSeries),
      series: allTimeSeries,
      axis: 'rank',
      maxValue: Math.max(1, ...entries.flatMap(({ story }) => story.allTimePointsJourney.map((point) => point.total))),
    });
  }

  return built;
}

function AnimatedStoryChart(props: {
  slide: SlideDefinition;
  stepDurationMs: number;
}) {
  const progressValue = useMotionValue(0);
  const [progress, setProgress] = useState(0);

  const width = Math.max(460, props.slide.labels.length * 110);
  const height = 280;
  const margin = { top: 26, right: 34, bottom: 48, left: props.slide.axis === 'division' ? 126 : 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const xPositions = useMemo(() => {
    if (props.slide.labels.length <= 1) {
      return [margin.left + plotWidth / 2];
    }
    return props.slide.labels.map((_, index) => margin.left + (plotWidth / (props.slide.labels.length - 1)) * index);
  }, [margin.left, plotWidth, props.slide.labels]);

  const scaleY = (value: number) => {
    if (props.slide.maxValue <= 1) {
      return margin.top + plotHeight / 2;
    }
    return margin.top + ((value - 1) / (props.slide.maxValue - 1)) * plotHeight;
  };

  const yLabels = props.slide.axis === 'division'
    ? (props.slide.axisLabels ?? [])
    : rankTicks(props.slide.maxValue).map((value) => ({ value, label: `#${value}` }));

  const seriesPoints = useMemo(() => (
    props.slide.series.map((series) => ({
      team: series.team,
      points: series.points
        .map((point) => {
          const labelIndex = props.slide.labels.indexOf(point.label);
          if (labelIndex < 0) {
            return null;
          }
          return {
            ...point,
            labelIndex,
            x: xPositions[labelIndex] ?? margin.left,
            y: scaleY(point.value),
          } satisfies ChartPoint;
        })
        .filter((point): point is ChartPoint => point !== null),
    }))
  ), [margin.left, props.slide.labels, props.slide.series, scaleY, xPositions]);

  useEffect(() => {
    const unsubscribe = progressValue.on('change', (value) => {
      setProgress(value);
    });
    return () => unsubscribe();
  }, [progressValue]);

  useEffect(() => {
    progressValue.set(0);
    setProgress(0);
    if (props.slide.labels.length <= 1) {
      return undefined;
    }
    const controls = animate(progressValue, props.slide.labels.length - 1, {
      duration: (props.slide.labels.length - 1) * (props.stepDurationMs / 1000),
      ease: 'linear',
    });
    return () => controls.stop();
  }, [progressValue, props.slide.id, props.slide.labels.length, props.stepDurationMs]);

  const activeLabelIndex = Math.min(
    props.slide.labels.length - 1,
    Math.max(0, Math.floor(progress + 0.001)),
  );

  return (
    <div style={chartShellStyle}>
      <div style={chartHeaderStyle}>
        <div style={{ display: 'grid', gap: '0.16rem' }}>
          <strong style={{ color: '#fcf7e3' }}>{props.slide.title}</strong>
          <span className="muted">{props.slide.subtitle}</span>
        </div>
        <span style={chartMetaChipStyle}>
          {props.slide.labels.length} steps
        </span>
      </div>

      <div style={seriesLegendStyle}>
        {seriesPoints.map((series) => {
          const accent = series.team.ringColor ?? series.team.ballColor ?? '#8fb7ff';
          return (
            <span key={`${props.slide.id}-${series.team.name}`} style={seriesLegendChipStyle(accent)}>
              <TeamBadge
                name={series.team.name}
                ballColor={series.team.ballColor}
                ringColor={series.team.ringColor}
                textColor={series.team.textColor}
                size={18}
              />
              {series.team.name}
            </span>
          );
        })}
      </div>

      <div style={chartCanvasStyle}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={props.slide.title} style={{ width: `${width}px`, height: 'auto', display: 'block' }}>
          <rect x="0" y="0" width={width} height={height} fill="transparent" />
          {yLabels.map((label) => {
            const y = scaleY(label.value);
            return (
              <g key={`${props.slide.id}-y-${label.label}`}>
                <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
                <text x={margin.left - 12} y={y + 4} textAnchor="end" fill="rgba(224, 236, 253, 0.68)" fontSize="11">
                  {label.label}
                </text>
              </g>
            );
          })}
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="rgba(255,255,255,0.14)" />
          <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="rgba(255,255,255,0.14)" />
          {xPositions.map((x, index) => (
            <g key={`${props.slide.id}-x-${props.slide.labels[index]}`}>
              <line x1={x} y1={margin.top} x2={x} y2={height - margin.bottom} stroke="rgba(255,255,255,0.04)" />
              <text x={x} y={height - 16} textAnchor="middle" fill={index === activeLabelIndex ? '#fcf7e3' : 'rgba(224, 236, 253, 0.76)'} fontSize="11" fontWeight="700">
                {props.slide.labels[index]}
              </text>
            </g>
          ))}

          {seriesPoints.map((series) => {
            const accent = series.team.ringColor ?? series.team.ballColor ?? '#8fb7ff';
            const fill = series.team.ballColor ?? '#f7fbff';
            const text = series.team.textColor ?? '#081421';
            const visiblePoints = buildVisibleSeriesPoints(series.points, progress);
            const path = buildSmoothPath(visiblePoints);
            const ball = interpolateSeriesPoint(series.points, progress);
            return (
              <g key={`${props.slide.id}-series-${series.team.name}`}>
                <path d={buildSmoothPath(series.points)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {path ? (
                  <path d={path} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                ) : null}
                {series.points.map((point) => (
                  <circle key={`${props.slide.id}-${series.team.name}-${point.label}`} cx={point.x} cy={point.y} r="5" fill="#081421" stroke={accent} strokeWidth="2.5" />
                ))}
                {ball ? (
                  <g transform={`translate(${ball.x} ${ball.y})`}>
                    <circle r="10.5" fill={fill} stroke={accent} strokeWidth="4" />
                    <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill={text} fontSize="10" fontWeight="900">
                      {(series.team.name.trim().charAt(0) || '?').toUpperCase()}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={detailGridStyle}>
        {seriesPoints.map((series) => {
          const accent = series.team.ringColor ?? series.team.ballColor ?? '#8fb7ff';
          const activePoint = activeSeriesPoint(series.points, progress);
          return (
            <div key={`${props.slide.id}-detail-${series.team.name}`} style={{ ...detailCardStyle, boxShadow: `inset 3px 0 0 ${accent}` }}>
              <span style={{ color: 'rgba(224, 236, 253, 0.72)', fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {series.team.name}
              </span>
              <strong style={{ color: '#fcf7e3' }}>{activePoint?.badge ?? 'Waiting'}</strong>
              <span className="muted">{activePoint?.detail ?? 'No story point available for this step yet.'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TeamHistoryStoryTile({ entries }: TeamHistoryStoryTileProps) {
  const entriesSignature = useMemo(() => JSON.stringify(entries), [entries]);
  const slides = useMemo(() => buildSlideDefinitions(entries), [entriesSignature]);
  const [slideIndex, setSlideIndex] = useState(0);
  const previousEntriesSignatureRef = useRef(entriesSignature);
  const currentSlide = slides[slideIndex] ?? null;

  useEffect(() => {
    if (previousEntriesSignatureRef.current !== entriesSignature) {
      previousEntriesSignatureRef.current = entriesSignature;
      setSlideIndex(0);
      return;
    }
    setSlideIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [entriesSignature, slides.length]);

  useEffect(() => {
    if (!currentSlide || slideIndex >= slides.length - 1) {
      return undefined;
    }
    const segmentCount = Math.max(1, currentSlide.labels.length - 1);
    const timer = window.setTimeout(() => {
      setSlideIndex((index) => Math.min(index + 1, slides.length - 1));
    }, segmentCount * STEP_DURATION_MS + 1100);
    return () => window.clearTimeout(timer);
  }, [currentSlide, slideIndex, slides.length]);

  if (!currentSlide || entries.length === 0) {
    return (
      <article style={shellStyle}>
        <div className="muted">No team history story is available yet.</div>
      </article>
    );
  }

  return (
    <article style={shellStyle}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <div style={identityStyle}>
            <strong style={{ color: '#fcf7e3', fontSize: '1.08rem' }}>
              {entries.length === 1 ? entries[0]?.team.name : `${entries.length} teams selected`}
            </strong>
            <span className="muted">
              One story tile, with all selected teams on the same graph and each step travelling every 2 seconds.
            </span>
          </div>
          <div style={slidePillRowStyle}>
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                style={slidePillStyle(index === slideIndex)}
                onClick={() => setSlideIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        <div style={selectedTeamRowStyle}>
          {entries.map(({ team }) => {
            const accent = team.ringColor ?? team.ballColor ?? '#8fb7ff';
            return (
              <span key={team.name} style={selectedTeamChipStyle(accent)}>
                <TeamBadge
                  name={team.name}
                  ballColor={team.ballColor}
                  ringColor={team.ringColor}
                  textColor={team.textColor}
                  size={20}
                />
                {team.name}
              </span>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentSlide.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <AnimatedStoryChart slide={currentSlide} stepDurationMs={STEP_DURATION_MS} />
        </motion.div>
      </AnimatePresence>

      <div style={controlsStyle}>
        <span className="muted">
          Slide {slideIndex + 1} of {slides.length}
        </span>
        <div style={buttonRowStyle}>
          <button
            type="button"
            style={controlButtonStyle(false)}
            onClick={() => setSlideIndex((index) => Math.max(0, index - 1))}
            disabled={slideIndex === 0}
          >
            Prev
          </button>
          <button
            type="button"
            style={controlButtonStyle(true)}
            onClick={() => setSlideIndex((index) => Math.min(slides.length - 1, index + 1))}
            disabled={slideIndex >= slides.length - 1}
          >
            Next
          </button>
        </div>
      </div>
    </article>
  );
}
