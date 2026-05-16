import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { buildTableCutLines } from '../../lib/tableCutLines';
import type { SsnDivisionJourneyTeam } from '../SsnDivisionJourneyChart';
import { GraphStoryOverlay } from '../broadcast/GraphStoryOverlay';
import { useSnyNewsTimelineAnimation } from './SnyNewsTimelineContext';

type Point = {
  x: number;
  y: number;
};

type SegmentSamples = {
  points: Point[];
  lengths: number[];
  totalLength: number;
};

type JourneyInfoRow = {
  label: string;
  value: string;
};

type JourneyStoryTone = 'leader' | 'climber' | 'drop' | 'pressure';

type SnyJourneyMotionGraphicProps = {
  teams: SsnDivisionJourneyTeam[];
  gwNumbers: number[];
  divisionTitle?: string;
  cutLineTitle?: string;
  highlightedTeamId?: number | null;
  mode?: 'division' | 'master';
  startDelayMs?: number;
  stageDwellMs?: number;
  storyTone?: JourneyStoryTone;
  contextTitle?: string;
  contextRows?: JourneyInfoRow[];
  finalRows?: JourneyInfoRow[];
  finalInsight?: string;
  lockTimeline?: boolean;
};

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 330;
const START_X = 42;
const SAMPLES_PER_SEGMENT = 12;

function buildSmoothPath(points: Point[]): string {
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

function cubicBezierPoint(start: Point, controlA: Point, controlB: Point, end: Point, t: number): Point {
  const clampedT = Math.min(1, Math.max(0, t));
  const inverse = 1 - clampedT;
  return {
    x: (
      (inverse ** 3) * start.x
      + 3 * (inverse ** 2) * clampedT * controlA.x
      + 3 * inverse * (clampedT ** 2) * controlB.x
      + (clampedT ** 3) * end.x
    ),
    y: (
      (inverse ** 3) * start.y
      + 3 * (inverse ** 2) * clampedT * controlA.y
      + 3 * inverse * (clampedT ** 2) * controlB.y
      + (clampedT ** 3) * end.y
    ),
  };
}

function buildSegmentControls(start: Point, end: Point): { controlA: Point; controlB: Point } {
  const controlX = start.x + (end.x - start.x) / 2;
  return {
    controlA: { x: controlX, y: start.y },
    controlB: { x: controlX, y: end.y },
  };
}

function pointDistance(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function buildSegmentSamples(start: Point, end: Point): SegmentSamples {
  const { controlA, controlB } = buildSegmentControls(start, end);
  const points: Point[] = [start];
  const lengths: number[] = [0];
  let totalLength = 0;

  for (let step = 1; step <= SAMPLES_PER_SEGMENT; step += 1) {
    const point = cubicBezierPoint(start, controlA, controlB, end, step / SAMPLES_PER_SEGMENT);
    totalLength += pointDistance(points[points.length - 1], point);
    points.push(point);
    lengths.push(totalLength);
  }

  return {
    points,
    lengths,
    totalLength,
  };
}

function pointOnSegmentSamples(segment: SegmentSamples, localRatio: number): Point {
  if (segment.points.length === 0) {
    return { x: START_X, y: CHART_HEIGHT - 44 };
  }
  if (segment.points.length === 1 || segment.totalLength <= 0) {
    return segment.points[segment.points.length - 1] ?? { x: START_X, y: CHART_HEIGHT - 44 };
  }

  const cappedRatio = Math.min(1, Math.max(0, localRatio));
  const targetLength = segment.totalLength * cappedRatio;
  for (let index = 1; index < segment.lengths.length; index += 1) {
    const currentLength = segment.lengths[index] ?? segment.totalLength;
    if (currentLength < targetLength) {
      continue;
    }
    const previousLength = segment.lengths[index - 1] ?? 0;
    const lengthSpan = Math.max(0.0001, currentLength - previousLength);
    const mix = (targetLength - previousLength) / lengthSpan;
    const start = segment.points[index - 1] ?? segment.points[0];
    const end = segment.points[index] ?? start;
    return {
      x: start.x + (end.x - start.x) * mix,
      y: start.y + (end.y - start.y) * mix,
    };
  }

  return segment.points[segment.points.length - 1] ?? { x: START_X, y: CHART_HEIGHT - 44 };
}

function pointOnJourneySegments(segments: SegmentSamples[], progressUnits: number): Point {
  if (segments.length === 0) {
    return { x: START_X, y: CHART_HEIGHT - 44 };
  }
  const cappedProgress = Math.min(segments.length, Math.max(0, progressUnits));
  if (cappedProgress >= segments.length) {
    const finalSegment = segments[segments.length - 1];
    return finalSegment?.points[finalSegment.points.length - 1] ?? { x: START_X, y: CHART_HEIGHT - 44 };
  }
  const segmentIndex = Math.min(segments.length - 1, Math.floor(cappedProgress));
  const localRatio = cappedProgress - segmentIndex;
  const segment = segments[segmentIndex];
  if (!segment) {
    return { x: START_X, y: CHART_HEIGHT - 44 };
  }

  return pointOnSegmentSamples(segment, localRatio);
}

function buildProgressKeyframes(maxProgress: number): number[] {
  if (maxProgress <= 1) {
    return [0, maxProgress];
  }
  return Array.from({ length: maxProgress + 1 }, (_, index) => index);
}

function buildKeyframeTimes(length: number): number[] | undefined {
  if (length <= 1) {
    return undefined;
  }
  return Array.from({ length }, (_, index) => index / (length - 1));
}

function rankToY(rank: number, maxRank: number, paddingTop: number, paddingBottom: number): number {
  if (maxRank <= 1) {
    return paddingTop;
  }
  const clampedRank = Math.max(1, Math.min(maxRank, rank));
  const span = CHART_HEIGHT - paddingTop - paddingBottom;
  return paddingTop + ((clampedRank - 1) / (maxRank - 1)) * span;
}

export function SnyJourneyMotionGraphic({
  teams,
  gwNumbers,
  divisionTitle = '',
  cutLineTitle,
  highlightedTeamId = null,
  mode = 'division',
  startDelayMs = 0,
  stageDwellMs,
  storyTone,
  contextTitle,
  contextRows,
  finalRows,
  finalInsight,
  lockTimeline = false,
}: SnyJourneyMotionGraphicProps) {
  const paddingLeft = mode === 'master' ? 74 : 86;
  const paddingRight = mode === 'master' ? 176 : 210;
  const paddingTop = 22;
  const paddingBottom = 42;
  const axisWeeks = gwNumbers.length > 0 ? gwNumbers : [1];
  const maxProgress = Math.max(1, axisWeeks.length);
  const progressValue = useMotionValue(0);
  const { markAnimationComplete, markAnimationPending } = useSnyNewsTimelineAnimation();
  const [animationProgress, setAnimationProgress] = useState(0);
  const [storyFocusTeamId, setStoryFocusTeamId] = useState<number | null>(highlightedTeamId);
  const [hoveredTeamId, setHoveredTeamId] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    teamId: number;
    teamName: string;
    gw: number;
    rank: number;
    x: number;
    y: number;
  } | null>(null);

  const animationSignature = useMemo(
    () => `${mode}|${axisWeeks.join(',')}|${teams.map((team) => `${team.teamId}:${team.ranks.join(',')}`).join('|')}`,
    [axisWeeks, mode, teams],
  );

  const maxRank = useMemo(() => {
    const ranks = teams
      .flatMap((team) => team.ranks)
      .map((rank) => Number(rank))
      .filter((rank) => Number.isFinite(rank) && rank > 0)
      .map((rank) => Math.floor(rank));
    return Math.max(1, teams.length, ...ranks);
  }, [teams]);

  const xPositions = useMemo(() => {
    if (axisWeeks.length <= 1) {
      return [paddingLeft];
    }
    const span = CHART_WIDTH - paddingLeft - paddingRight;
    const step = span / (axisWeeks.length - 1);
    return axisWeeks.map((_, index) => paddingLeft + step * index);
  }, [axisWeeks, paddingLeft, paddingRight]);

  const baseTeamPaths = useMemo(() => (
    teams.map((team) => {
      const rankSequence = axisWeeks.map((_, index) => {
        const parsedRank = Number(team.ranks[index]);
        if (!Number.isFinite(parsedRank) || parsedRank <= 0) {
          return maxRank;
        }
        return Math.min(maxRank, Math.max(1, Math.floor(parsedRank)));
      });
      const points = rankSequence.map((rank, index) => ({
        x: xPositions[index] ?? paddingLeft,
        y: rankToY(rank, maxRank, paddingTop, paddingBottom),
      }));
      const startPoint = {
        x: START_X,
        y: CHART_HEIGHT - paddingBottom,
      };
      const frames = [startPoint, ...points];
      const segmentSamples = frames
        .slice(0, -1)
        .map((frame, index) => buildSegmentSamples(frame, frames[index + 1] ?? frame));
      const routeLength = segmentSamples.reduce((total, segment) => total + segment.totalLength, 0);
      const startRank = rankSequence[0] ?? maxRank;
      const finalRank = rankSequence[rankSequence.length - 1] ?? maxRank;
      const delta = startRank - finalRank;
      return {
        ...team,
        frames,
        segmentSamples,
        fullPath: buildSmoothPath(frames),
        routeLength,
        rankSequence,
        startRank,
        finalRank,
        delta,
      };
    })
  ), [axisWeeks, maxRank, paddingBottom, paddingLeft, paddingTop, teams, xPositions]);

  const leaderTeam = useMemo(
    () => baseTeamPaths.slice().sort((left, right) => left.finalRank - right.finalRank || left.teamName.localeCompare(right.teamName))[0] ?? null,
    [baseTeamPaths],
  );
  const chaseTeams = useMemo(
    () => baseTeamPaths
      .slice()
      .sort((left, right) => left.finalRank - right.finalRank || left.teamName.localeCompare(right.teamName))
      .slice(1, mode === 'master' ? 4 : 3),
    [baseTeamPaths, mode],
  );
  const biggestRiseTeam = useMemo(
    () => baseTeamPaths
      .filter((team) => team.delta > 0)
      .sort((left, right) => right.delta - left.delta || left.finalRank - right.finalRank)[0] ?? null,
    [baseTeamPaths],
  );
  const biggestDropTeam = useMemo(
    () => baseTeamPaths
      .filter((team) => team.delta < 0)
      .sort((left, right) => left.delta - right.delta || right.finalRank - left.finalRank)[0] ?? null,
    [baseTeamPaths],
  );
  const pressureTeam = useMemo(
    () => biggestDropTeam ?? baseTeamPaths.slice().sort((left, right) => right.finalRank - left.finalRank)[0] ?? null,
    [baseTeamPaths, biggestDropTeam],
  );
  const resolvedStoryTone = storyTone
    ?? (biggestRiseTeam ? 'climber' : biggestDropTeam ? 'pressure' : 'leader');
  const resolvedStoryTeamId = highlightedTeamId
    ?? (resolvedStoryTone === 'climber'
      ? biggestRiseTeam?.teamId
      : resolvedStoryTone === 'drop'
        ? biggestDropTeam?.teamId
        : resolvedStoryTone === 'pressure'
          ? pressureTeam?.teamId
          : leaderTeam?.teamId)
    ?? null;

  const showFinalReveal = animationProgress >= maxProgress - 0.035;
  const effectiveFocusTeamId = hoveredTeamId
    ?? (showFinalReveal ? storyFocusTeamId ?? resolvedStoryTeamId : resolvedStoryTeamId ?? storyFocusTeamId)
    ?? null;

  const featuredLimit = mode === 'master' ? Math.min(5, teams.length) : Math.min(4, teams.length);

  const teamPaths = useMemo(() => (
    baseTeamPaths.map((team) => {
      const isLeader = team.finalRank === 1;
      const isChaser = team.finalRank > 1 && team.finalRank <= (mode === 'master' ? 3 : 2);
      const isStory = resolvedStoryTeamId !== null && resolvedStoryTeamId === team.teamId;
      const isHighlighted = effectiveFocusTeamId !== null && effectiveFocusTeamId === team.teamId;
      const isFeatured = isLeader || isChaser || isStory || Math.abs(team.delta) >= 2 || team.finalRank <= featuredLimit;
      return {
        ...team,
        isLeader,
        isChaser,
        isStory,
        isHighlighted,
        isFeatured,
      };
    })
  ), [baseTeamPaths, effectiveFocusTeamId, featuredLimit, mode, resolvedStoryTeamId]);

  const renderTeams = useMemo(() => {
    return teamPaths
      .slice()
      .sort((left, right) => {
        const leftPriority = left.isHighlighted ? 5 : left.isStory ? 4 : left.isLeader ? 3 : left.isChaser ? 2.5 : left.isFeatured ? 2 : 1;
        const rightPriority = right.isHighlighted ? 5 : right.isStory ? 4 : right.isLeader ? 3 : right.isChaser ? 2.5 : right.isFeatured ? 2 : 1;
        return leftPriority - rightPriority || right.finalRank - left.finalRank || left.teamName.localeCompare(right.teamName);
      });
  }, [teamPaths]);

  const cutLines = useMemo(
    () => (mode === 'division' ? buildTableCutLines(cutLineTitle ?? divisionTitle, maxRank) : []),
    [cutLineTitle, divisionTitle, maxRank, mode],
  );

  const labelTeamIds = useMemo(() => {
    const ids = new Set<number>();
    if (leaderTeam) {
      ids.add(leaderTeam.teamId);
    }
    chaseTeams.slice(0, mode === 'master' ? 2 : 1).forEach((team) => ids.add(team.teamId));
    if (biggestRiseTeam) {
      ids.add(biggestRiseTeam.teamId);
    }
    if (biggestDropTeam) {
      ids.add(biggestDropTeam.teamId);
    }
    if (pressureTeam && resolvedStoryTone === 'pressure') {
      ids.add(pressureTeam.teamId);
    }
    if (resolvedStoryTeamId !== null) {
      ids.add(resolvedStoryTeamId);
    }
    if (effectiveFocusTeamId !== null) {
      ids.add(effectiveFocusTeamId);
    }
    return ids;
  }, [biggestDropTeam, biggestRiseTeam, chaseTeams, effectiveFocusTeamId, leaderTeam, mode, pressureTeam, resolvedStoryTeamId, resolvedStoryTone]);

  const labeledTeams = useMemo(
    () => renderTeams
      .filter((team) => labelTeamIds.has(team.teamId))
      .sort((left, right) => left.finalRank - right.finalRank || left.teamName.localeCompare(right.teamName)),
    [labelTeamIds, renderTeams],
  );

  const storyFocusOrder = useMemo(() => {
    return [resolvedStoryTeamId, leaderTeam?.teamId ?? null, chaseTeams[0]?.teamId ?? null, biggestRiseTeam?.teamId ?? null, biggestDropTeam?.teamId ?? null, null]
      .filter((teamId, index, list): teamId is number | null => list.indexOf(teamId) === index);
  }, [biggestDropTeam, biggestRiseTeam, chaseTeams, leaderTeam, resolvedStoryTeamId]);

  const progressRatio = Math.min(1, Math.max(0, animationProgress / maxProgress));
  const routeTrailLagUnits = mode === 'master' ? 0.18 : 0.16;
  const routeRevealProgress = showFinalReveal
    ? maxProgress
    : Math.max(0, animationProgress - routeTrailLagUnits);
  const routeRevealRatio = Math.min(1, Math.max(0, routeRevealProgress / maxProgress));

  const focusCard = useMemo(() => {
    if (effectiveFocusTeamId === null) {
      return null;
    }
    const focusedTeam = teamPaths.find((team) => team.teamId === effectiveFocusTeamId) ?? null;
    if (!focusedTeam) {
      return null;
    }
    const rankIndex = Math.min(
      Math.max(Math.round(Math.max(animationProgress - 0.1, 0)), 0),
      focusedTeam.rankSequence.length - 1,
    );
    const currentRank = focusedTeam.rankSequence[rankIndex] ?? maxRank;
    const previousRank = focusedTeam.rankSequence[Math.max(0, rankIndex - 1)] ?? currentRank;
    const delta = previousRank - currentRank;
    return {
      key: `focus-${focusedTeam.teamId}-${rankIndex}-${currentRank}`,
      teamName: focusedTeam.teamName,
      rank: currentRank,
      movementLabel: delta > 0 ? `Up ${delta}` : delta < 0 ? `Down ${Math.abs(delta)}` : 'Holding',
      cueLabel: hoveredTeamId === focusedTeam.teamId
        ? `Hovered • GW${axisWeeks[rankIndex] ?? axisWeeks[0] ?? 1}`
        : focusedTeam.teamId === resolvedStoryTeamId
          ? (resolvedStoryTone === 'leader'
            ? 'Leader focus'
            : resolvedStoryTone === 'climber'
              ? 'Fast riser'
              : resolvedStoryTone === 'drop'
                ? 'Biggest drop'
                : 'Pressure team')
          : mode === 'master'
            ? 'Field focus'
            : 'Journey focus',
      tone: delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'flat' as const,
      ballColor: focusedTeam.ballColor,
      ringColor: focusedTeam.ringColor,
      textColor: focusedTeam.textColor,
    };
  }, [animationProgress, axisWeeks, effectiveFocusTeamId, hoveredTeamId, maxRank, mode, resolvedStoryTeamId, resolvedStoryTone, teamPaths]);

  const contextCardRows = useMemo(() => {
    const fallbackRows: JourneyInfoRow[] = [
      { label: 'Leader', value: leaderTeam?.teamName ?? 'Live' },
      { label: 'Biggest climb', value: biggestRiseTeam?.teamName ?? leaderTeam?.teamName ?? 'Live' },
      { label: 'Pressure team', value: pressureTeam?.teamName ?? 'Live' },
    ];
    return (contextRows ?? fallbackRows).filter((row) => row.value && row.value.trim().length > 0).slice(0, 3);
  }, [biggestRiseTeam, contextRows, leaderTeam, pressureTeam]);

  const finalCardRows = useMemo(() => {
    const fallbackRows: JourneyInfoRow[] = [
      { label: 'Leader', value: leaderTeam?.teamName ?? 'Live' },
      { label: 'Nearest chaser', value: chaseTeams[0]?.teamName ?? 'Live' },
      { label: 'Story focus', value: teamPaths.find((team) => team.teamId === resolvedStoryTeamId)?.teamName ?? leaderTeam?.teamName ?? 'Live' },
    ];
    return (finalRows ?? fallbackRows).filter((row) => row.value && row.value.trim().length > 0).slice(0, 3);
  }, [chaseTeams, finalRows, leaderTeam, resolvedStoryTeamId, teamPaths]);

  const contextCardTitle = contextTitle ?? (mode === 'master' ? 'Master Movement' : `${divisionTitle || 'Division'} Journey`);

  const storyCallout = useMemo(() => {
    if (resolvedStoryTeamId === null || progressRatio < 0.22) {
      return null;
    }
    const storyTeam = teamPaths.find((team) => team.teamId === resolvedStoryTeamId) ?? null;
    if (!storyTeam) {
      return null;
    }
    const currentPoint = pointOnJourneySegments(storyTeam.segmentSamples, animationProgress);
    const label = resolvedStoryTone === 'leader'
      ? 'Leader'
      : resolvedStoryTone === 'climber'
        ? 'Fast Riser'
        : resolvedStoryTone === 'drop'
          ? 'Biggest Drop'
          : 'Pressure';
    const width = Math.max(66, label.length * 6.2 + 18);
    const prefersLeft = currentPoint.x > CHART_WIDTH - paddingRight - width - 22;
    const x = prefersLeft
      ? Math.max(paddingLeft - 6, currentPoint.x - width - 18)
      : Math.min(CHART_WIDTH - paddingRight - width + 6, currentPoint.x + 16);
    const y = Math.max(18, Math.min(CHART_HEIGHT - 24, currentPoint.y - 16));
    return {
      label,
      width,
      x,
      y,
    };
  }, [animationProgress, paddingLeft, paddingRight, resolvedStoryTeamId, resolvedStoryTone, teamPaths]);

  const animationDurationSeconds = useMemo(() => {
    const defaultDuration = mode === 'master'
      ? Math.max(7.7, Math.min(8.4, axisWeeks.length * 0.72 + teams.length * 0.035 + 0.55))
      : Math.max(4.7, Math.min(5.2, axisWeeks.length * 0.62 + 0.58));
    if (!stageDwellMs) {
      return defaultDuration;
    }
    const settleWindow = mode === 'master' ? 1.45 : 1.0;
    const available = (stageDwellMs / 1000) - Math.max(0, startDelayMs) / 1000 - settleWindow;
    const minDuration = mode === 'master' ? 7.2 : 4.4;
    const maxDuration = mode === 'master' ? 8.4 : 5.2;
    return Math.max(minDuration, Math.min(maxDuration, available > 0 ? available : defaultDuration));
  }, [axisWeeks.length, mode, stageDwellMs, startDelayMs, teams.length]);

  const progressKeyframes = useMemo(
    () => buildProgressKeyframes(maxProgress),
    [maxProgress],
  );
  const progressTimes = useMemo(
    () => buildKeyframeTimes(progressKeyframes.length),
    [progressKeyframes.length],
  );

  useEffect(() => {
    const unsubscribe = progressValue.on('change', (value) => {
      setAnimationProgress(value);
    });
    return () => unsubscribe();
  }, [progressValue]);

  useEffect(() => {
    if (!lockTimeline) {
      return undefined;
    }
    markAnimationPending();
    return undefined;
  }, [animationSignature, lockTimeline, markAnimationPending, startDelayMs]);

  useEffect(() => {
    progressValue.set(0);
    setAnimationProgress(0);
    setStoryFocusTeamId(resolvedStoryTeamId);
    setHoveredTeamId(null);
    setHoveredPoint(null);
    let controls: { stop: () => void } | null = null;
    const timeoutId = window.setTimeout(() => {
      controls = animate(progressValue, progressKeyframes, {
        duration: animationDurationSeconds,
        ease: 'linear',
        times: progressTimes,
        onComplete: () => {
          if (lockTimeline) {
            markAnimationComplete();
          }
        },
      });
    }, Math.max(0, startDelayMs));
    return () => {
      window.clearTimeout(timeoutId);
      if (controls) {
        controls.stop();
      }
    };
  }, [
    animationDurationSeconds,
    animationSignature,
    lockTimeline,
    markAnimationComplete,
    progressKeyframes,
    progressTimes,
    progressValue,
    resolvedStoryTeamId,
    startDelayMs,
  ]);

  useEffect(() => {
    if (!lockTimeline) {
      return undefined;
    }
    const fallbackMs = Math.max(
      500,
      Math.round(Math.max(0, startDelayMs) + (Math.max(0.1, animationDurationSeconds) * 1000) + 600),
    );
    const timeoutId = window.setTimeout(() => {
      markAnimationComplete();
    }, fallbackMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    animationDurationSeconds,
    animationSignature,
    lockTimeline,
    markAnimationComplete,
    startDelayMs,
  ]);

  useEffect(() => {
    if (!showFinalReveal || hoveredTeamId !== null || storyFocusOrder.length === 0) {
      return undefined;
    }
    let index = 0;
    setStoryFocusTeamId(storyFocusOrder[index] ?? null);
    const timer = window.setInterval(() => {
      index = (index + 1) % storyFocusOrder.length;
      setStoryFocusTeamId(storyFocusOrder[index] ?? null);
    }, mode === 'master' ? 2200 : 2600);
    return () => {
      window.clearInterval(timer);
    };
  }, [hoveredTeamId, mode, showFinalReveal, storyFocusOrder]);

  return (
    <div className={`sny-journey-motion sny-journey-motion--${mode}`}>
      <div className={`sny-journey-context-card tone-${resolvedStoryTone}`}>
        <span className="sny-journey-context-kicker">{contextCardTitle}</span>
        <div className="sny-journey-context-rows">
          {contextCardRows.map((row) => (
            <article key={`${row.label}-${row.value}`}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </article>
          ))}
        </div>
      </div>
      <GraphStoryOverlay
        narrative={null}
        focus={focusCard}
      />
      <svg
        className="sny-journey-motion-grid"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {mode === 'division' ? (
          <>
            <rect
              x={paddingLeft - 8}
              y={rankToY(1, maxRank, paddingTop, paddingBottom) - 14}
              width={CHART_WIDTH - paddingLeft - paddingRight + 18}
              height={Math.max(18, rankToY(Math.min(2, maxRank), maxRank, paddingTop, paddingBottom) - rankToY(1, maxRank, paddingTop, paddingBottom) + 28)}
              className="sny-journey-zone zone-top"
            />
            {maxRank > 3 ? (
              <rect
                x={paddingLeft - 8}
                y={rankToY(Math.max(1, maxRank - 1), maxRank, paddingTop, paddingBottom) - 14}
                width={CHART_WIDTH - paddingLeft - paddingRight + 18}
                height={Math.max(18, rankToY(maxRank, maxRank, paddingTop, paddingBottom) - rankToY(Math.max(1, maxRank - 1), maxRank, paddingTop, paddingBottom) + 28)}
                className="sny-journey-zone zone-danger"
              />
            ) : null}
          </>
        ) : null}

        {Array.from({ length: maxRank }, (_, index) => {
          const rank = index + 1;
          const y = rankToY(rank, maxRank, paddingTop, paddingBottom);
          return (
            <g key={`rank-${rank}`}>
              <line x1={paddingLeft - 8} y1={y} x2={CHART_WIDTH - paddingRight + 10} y2={y} className="sny-journey-grid-line" />
              <text x={22} y={y + 4} className="sny-journey-rank-label">#{rank}</text>
            </g>
          );
        })}

        {xPositions.map((x, index) => (
          <g key={`gw-${axisWeeks[index]}`}>
            <line x1={x} y1={paddingTop - 6} x2={x} y2={CHART_HEIGHT - paddingBottom + 10} className="sny-journey-grid-column" />
            <text x={x} y={CHART_HEIGHT - 10} className="sny-journey-week-label">
              GW{axisWeeks[index]}
            </text>
          </g>
        ))}

        {cutLines.map((line) => {
          const upperY = rankToY(line.afterRank, maxRank, paddingTop, paddingBottom);
          const lowerY = rankToY(Math.min(maxRank, line.afterRank + 1), maxRank, paddingTop, paddingBottom);
          const y = (upperY + lowerY) / 2;
          return (
            <g key={`${line.afterRank}-${line.label}`} className={`sny-journey-cutline tone-${line.tone}`}>
              <line x1={paddingLeft - 4} y1={y} x2={CHART_WIDTH - paddingRight + 4} y2={y} className="sny-journey-cutline-stroke" />
              <text x={CHART_WIDTH - paddingRight + 8} y={y - 4} className="sny-journey-cutline-label">
                {line.label}
              </text>
            </g>
          );
        })}

        <polyline
          points={`${START_X},${CHART_HEIGHT - paddingBottom} ${paddingLeft},${CHART_HEIGHT - paddingBottom}`}
          className="sny-journey-entry-line"
        />
        <text x={START_X} y={CHART_HEIGHT - 10} className="sny-journey-week-label">Start</text>

        {renderTeams.map((team) => (
          <path
            key={`route-base-${team.teamId}`}
            d={team.fullPath}
            className={`sny-journey-route base${team.isHighlighted ? ' highlighted' : team.isStory ? ' story' : team.isLeader ? ' leader' : team.isChaser ? ' chaser' : team.isFeatured ? ' featured' : ' field'}${team.isStory ? ` tone-${resolvedStoryTone}` : ''}`}
            style={{
              ['--route-color' as string]: team.ringColor ?? team.ballColor ?? '#9cb4d8',
            } as CSSProperties}
          />
        ))}

        {renderTeams.map((team) => {
          const routeLength = Math.max(1, team.routeLength || 0);
          return (
            <path
              key={`route-active-${team.teamId}`}
              d={team.fullPath}
              strokeDasharray={routeLength}
              strokeDashoffset={Math.max(0, routeLength * (1 - routeRevealRatio))}
              className={`sny-journey-route active${team.isHighlighted ? ' highlighted' : team.isStory ? ' story' : team.isLeader ? ' leader' : team.isChaser ? ' chaser' : team.isFeatured ? ' featured' : ' field'}${team.isStory ? ` tone-${resolvedStoryTone}` : ''}`}
              style={{
                ['--route-color' as string]: team.ballColor ?? team.ringColor ?? '#f2f5fc',
              } as CSSProperties}
            />
          );
        })}

        {renderTeams.flatMap((team) => {
          if (!team.isHighlighted && !team.isFeatured) {
            return [];
          }
          return team.frames.slice(1).map((point, index) => {
            const gw = axisWeeks[index];
            return (
              <circle
                key={`node-${team.teamId}-${gw}`}
                cx={point.x}
                cy={point.y}
                r={mode === 'master' ? 1.8 : 2.3}
                className={`sny-journey-node${team.isHighlighted ? ' highlighted' : ''}`}
              />
            );
          });
        })}

        {renderTeams.map((team) => {
          const radius = mode === 'master'
            ? (team.isHighlighted ? 7.5 : team.isStory ? 6.8 : team.isLeader ? 6.3 : team.isChaser ? 5.9 : team.isFeatured ? 5.2 : 4.2)
            : (team.isHighlighted ? 9.2 : team.isStory ? 8.4 : team.isLeader ? 8 : team.isChaser ? 7.3 : team.isFeatured ? 7 : 6);
          const showText = team.isHighlighted || team.isStory || team.isLeader || team.isChaser || mode !== 'master';
          const label = (team.teamName?.trim().charAt(0) || '?').toUpperCase();
          const markerFrames = team.frames.length > 0
            ? team.frames
            : [{ x: START_X, y: CHART_HEIGHT - paddingBottom }];
          const markerValues = markerFrames.map((point) => `${point.x} ${point.y}`).join(';');
          const markerTimes = progressTimes?.join(';');
          return (
            <g
              key={`ball-${team.teamId}-${animationSignature}`}
              transform={`translate(${markerFrames[0]?.x ?? START_X} ${markerFrames[0]?.y ?? (CHART_HEIGHT - paddingBottom)})`}
            >
              {markerFrames.length > 1 ? (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={markerValues}
                  dur={`${animationDurationSeconds}s`}
                  begin={`${Math.max(0, startDelayMs) / 1000}s`}
                  fill="freeze"
                  calcMode="linear"
                  keyTimes={markerTimes}
                />
              ) : null}
              <g
                className={`sny-journey-ball${team.isHighlighted ? ' highlighted' : team.isStory ? ' story' : team.isLeader ? ' leader' : team.isChaser ? ' chaser' : team.isFeatured ? ' featured' : ' field'}${team.isStory ? ` tone-${resolvedStoryTone}` : ''}`}
                style={{
                  ['--ball-fill' as string]: team.ballColor ?? '#d5ddf2',
                  ['--ball-ring' as string]: team.ringColor ?? '#ffffff',
                  ['--ball-text' as string]: team.textColor ?? '#061327',
                } as CSSProperties}
              >
                <circle className="sny-journey-ball-outer" r={radius + 1.9} />
                <circle className="sny-journey-ball-core" r={radius} />
                {showText ? <text className="sny-journey-ball-text" x={0} y={0}>{label}</text> : null}
              </g>
            </g>
            );
          })}

        {storyCallout ? (
          <g
            className={`sny-journey-story-callout tone-${resolvedStoryTone}`}
            transform={`translate(${storyCallout.x} ${storyCallout.y})`}
          >
            <rect x={0} y={-12} width={storyCallout.width} height={20} rx={10} ry={10} />
            <text x={storyCallout.width / 2} y={-2}>{storyCallout.label}</text>
          </g>
        ) : null}

        {teamPaths.flatMap((team) => (
          team.frames.slice(1).map((point, index) => {
            const gw = axisWeeks[index];
            const rank = team.rankSequence[index] ?? maxRank;
            return (
              <circle
                key={`hit-${team.teamId}-${gw}`}
                cx={point.x}
                cy={point.y}
                r={mode === 'master' ? 7.6 : 9}
                className="sny-journey-hit-area"
                onMouseEnter={() => {
                  setHoveredTeamId(team.teamId);
                  setHoveredPoint({
                    teamId: team.teamId,
                    teamName: team.teamName,
                    gw,
                    rank,
                    x: point.x,
                    y: point.y,
                  });
                }}
                onMouseLeave={() => {
                  setHoveredPoint((current) => (current?.teamId === team.teamId && current.gw === gw ? null : current));
                  setHoveredTeamId((current) => (current === team.teamId ? null : current));
                }}
              />
            );
          })
        ))}

        {showFinalReveal ? labeledTeams
          .map((team) => {
            const finalPoint = team.frames[team.frames.length - 1] ?? null;
            if (!finalPoint) {
              return null;
            }
            const labelIndex = labeledTeams.findIndex((candidate) => candidate.teamId === team.teamId);
            const yOffset = labelIndex % 2 === 0 ? -11 : 11;
            const labelX = Math.min(CHART_WIDTH - 18, finalPoint.x + 16);
            return (
              <g
                key={`label-${team.teamId}`}
                className={`sny-journey-finish-label${team.isHighlighted ? ' highlighted' : team.isStory ? ' story' : team.isLeader ? ' leader' : team.isChaser ? ' chaser' : team.isFeatured ? ' featured' : ''}${team.isStory ? ` tone-${resolvedStoryTone}` : ''}`}
                transform={`translate(${labelX} ${finalPoint.y + yOffset})`}
              >
                <line x1={-12} y1={0} x2={-2} y2={0} className="sny-journey-finish-tick" />
                <text x={0} y={-1} className="sny-journey-finish-rank">#{team.finalRank}</text>
                <text x={24} y={-1} className="sny-journey-finish-name">{team.teamName}</text>
              </g>
            );
          }) : null}
      </svg>

      <AnimatePresence>
        {showFinalReveal ? (
          <motion.div
            key={`final-${mode}-${divisionTitle}`}
            className={`sny-journey-final-card tone-${resolvedStoryTone}`}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="sny-journey-final-kicker">{mode === 'master' ? 'Field Snapshot' : 'Race Snapshot'}</span>
            <div className="sny-journey-final-rows">
              {finalCardRows.map((row) => (
                <article key={`${row.label}-${row.value}`}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </article>
              ))}
            </div>
            {finalInsight ? <p>{finalInsight}</p> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {hoveredPoint ? (
          <motion.div
            key={`tooltip-${hoveredPoint.teamId}-${hoveredPoint.gw}`}
            className="sny-journey-tooltip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{
              opacity: 1,
              scale: 1,
              left: `${(hoveredPoint.x / CHART_WIDTH) * 100}%`,
              top: `${(hoveredPoint.y / CHART_HEIGHT) * 100}%`,
            }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
          >
            <strong>{hoveredPoint.teamName}</strong>
            <span>GW{hoveredPoint.gw} • #{hoveredPoint.rank}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
