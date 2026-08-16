import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { buildTableCutLines } from '../lib/tableCutLines';
import { GraphStoryOverlay } from './broadcast/GraphStoryOverlay';

export type SsnDivisionJourneyTeam = {
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  ranks: number[];
};

type SsnDivisionJourneyChartProps = {
  teams: SsnDivisionJourneyTeam[];
  gwNumbers: number[];
  startDelayMs?: number;
  divisionTitle?: string;
  highlightedTeamId?: number | null;
  showSpotlightRail?: boolean;
  showNarrativeOverlays?: boolean;
  enableStoryMode?: boolean;
};

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 320;
const CHART_PADDING_LEFT = 90;
const CHART_PADDING_RIGHT = 176;
const CHART_PADDING_TOP = 24;
const CHART_PADDING_BOTTOM = 42;

const START_X = 42;
const START_Y = CHART_HEIGHT - CHART_PADDING_BOTTOM;

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

function interpolateFramePoint(
  frames: Array<{ x: number; y: number }>,
  progress: number,
): { x: number; y: number } {
  if (frames.length === 0) {
    return { x: START_X, y: START_Y };
  }
  const cappedProgress = Math.min(Math.max(progress, 0), frames.length - 1);
  const baseIndex = Math.floor(cappedProgress);
  const nextIndex = Math.min(frames.length - 1, baseIndex + 1);
  const mix = cappedProgress - baseIndex;
  const base = frames[baseIndex] ?? frames[frames.length - 1];
  const next = frames[nextIndex] ?? base;
  return {
    x: base.x + (next.x - base.x) * mix,
    y: base.y + (next.y - base.y) * mix,
  };
}

function buildVisibleFrames(
  frames: Array<{ x: number; y: number }>,
  progress: number,
): Array<{ x: number; y: number }> {
  if (frames.length === 0) {
    return [];
  }
  const cappedProgress = Math.min(Math.max(progress, 0), frames.length - 1);
  const baseIndex = Math.floor(cappedProgress);
  const visibleFrames = frames.slice(0, Math.max(1, baseIndex + 1));
  if (cappedProgress > baseIndex && baseIndex < frames.length - 1) {
    visibleFrames.push(interpolateFramePoint(frames, cappedProgress));
  }
  return visibleFrames;
}

function rankToY(rank: number, maxRank: number): number {
  if (maxRank <= 1) {
    return CHART_PADDING_TOP;
  }
  const clampedRank = Math.max(1, Math.min(maxRank, rank));
  const span = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  return CHART_PADDING_TOP + ((clampedRank - 1) / (maxRank - 1)) * span;
}

export function SsnDivisionJourneyChart({
  teams,
  gwNumbers,
  startDelayMs = 0,
  divisionTitle = '',
  highlightedTeamId = null,
  showSpotlightRail = true,
  showNarrativeOverlays = true,
  enableStoryMode = true,
}: SsnDivisionJourneyChartProps) {
  const axisWeeks = gwNumbers.length > 0 ? gwNumbers : [1];
  const maxFrameIndex = Math.max(1, axisWeeks.length);
  const progressValue = useMotionValue(0);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [storyFocusTeamId, setStoryFocusTeamId] = useState<number | null>(null);
  const [hoveredTeamId, setHoveredTeamId] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    teamId: number;
    teamName: string;
    gw: number;
    rank: number;
    x: number;
    y: number;
  } | null>(null);
  const animationStartDelayMs = Math.max(0, startDelayMs);
  const animationSignature = useMemo(
    () => `${axisWeeks.join(',')}|${teams.map((team) => `${team.teamId}:${team.ranks.join(',')}`).join('|')}`,
    [axisWeeks, teams],
  );
  const maxRank = useMemo(() => {
    const sanitizedRanks = teams
      .flatMap((team) => team.ranks)
      .map((rank) => Number(rank))
      .filter((rank) => Number.isFinite(rank) && rank > 0)
      .map((rank) => Math.floor(rank));
    return Math.max(1, teams.length, ...sanitizedRanks);
  }, [teams]);
  const xPositions = useMemo(() => {
    if (axisWeeks.length <= 1) {
      return [CHART_PADDING_LEFT];
    }
    const span = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
    const step = span / (axisWeeks.length - 1);
    return axisWeeks.map((_, index) => CHART_PADDING_LEFT + step * index);
  }, [axisWeeks]);
  const effectiveFocusTeamId = hoveredTeamId ?? storyFocusTeamId ?? highlightedTeamId;
  const teamPaths = useMemo(() => {
    return teams.map((team) => {
      const rankSequence = axisWeeks.map((_, index) => {
        const parsedRank = Number(team.ranks[index]);
        if (!Number.isFinite(parsedRank) || parsedRank <= 0) {
          return maxRank;
        }
        return Math.min(maxRank, Math.max(1, Math.floor(parsedRank)));
      });
      const points = rankSequence.map((rank, index) => ({
        x: xPositions[index] ?? CHART_PADDING_LEFT,
        y: rankToY(rank, maxRank),
      }));
      const frames = [{ x: START_X, y: START_Y }, ...points];
      return {
        ...team,
        rankSequence,
        frames,
        isHighlighted: effectiveFocusTeamId !== null && effectiveFocusTeamId === team.teamId,
      };
    });
  }, [axisWeeks, effectiveFocusTeamId, maxRank, teams, xPositions]);
  const cutLines = useMemo(
    () => buildTableCutLines(divisionTitle, maxRank),
    [divisionTitle, maxRank],
  );
  const featuredFinishers = useMemo(() => {
    return teamPaths
      .map((team) => {
        const startRank = team.rankSequence[0] ?? maxRank;
        const finalRank = team.rankSequence[team.rankSequence.length - 1] ?? maxRank;
        return {
          ...team,
          startRank,
          finalRank,
          delta: startRank - finalRank,
        };
      })
      .sort((left, right) => left.finalRank - right.finalRank || left.teamName.localeCompare(right.teamName))
      .slice(0, Math.min(4, teamPaths.length));
  }, [maxRank, teamPaths]);
  const storyFocusOrder = useMemo(() => {
    const winner = featuredFinishers[0] ?? null;
    const movers = teamPaths
      .map((team) => {
        const startRank = team.rankSequence[0] ?? maxRank;
        const finalRank = team.rankSequence[team.rankSequence.length - 1] ?? maxRank;
        return {
          teamId: team.teamId,
          teamName: team.teamName,
          delta: startRank - finalRank,
          finalRank,
        };
      })
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.finalRank - right.finalRank);
    const biggestRiser = movers
      .filter((team) => team.delta > 0)
      .sort((left, right) => right.delta - left.delta || left.finalRank - right.finalRank)[0] ?? null;
    const biggestFaller = movers
      .filter((team) => team.delta < 0)
      .sort((left, right) => left.delta - right.delta || right.finalRank - left.finalRank)[0] ?? null;
    return [winner?.teamId ?? null, biggestRiser?.teamId ?? null, biggestFaller?.teamId ?? null, null]
      .filter((teamId, index, list) => index === 0 || teamId !== list[index - 1]);
  }, [featuredFinishers, maxRank, teamPaths]);
  const narrativeEvents = useMemo(() => {
    return axisWeeks.map((gw, index) => {
      const currentTeams = teamPaths.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        currentRank: team.rankSequence[index] ?? maxRank,
        previousRank: team.rankSequence[Math.max(0, index - 1)] ?? maxRank,
      }));
      const currentLeader = currentTeams.find((team) => team.currentRank === 1) ?? null;
      const previousLeader = index > 0
        ? teamPaths
          .map((team) => ({
            teamId: team.teamId,
            currentRank: team.rankSequence[index - 1] ?? maxRank,
          }))
          .find((team) => team.currentRank === 1) ?? null
        : null;
      const leaderChange = currentLeader && previousLeader && currentLeader.teamId !== previousLeader.teamId;
      const rises = currentTeams
        .map((team) => ({
          ...team,
          delta: team.previousRank - team.currentRank,
        }))
        .sort((left, right) => right.delta - left.delta);
      const falls = currentTeams
        .map((team) => ({
          ...team,
          delta: team.previousRank - team.currentRank,
        }))
        .sort((left, right) => left.delta - right.delta);
      const biggestRise = rises[0] ?? null;
      const biggestFall = falls[0] ?? null;
      let headline = '';
      let detail = '';
      if (leaderChange && currentLeader) {
        headline = `GW${gw} — ${currentLeader.teamName} take the lead`;
        detail = `${currentLeader.teamName} move into 1st place.`;
      } else if (biggestRise && biggestRise.delta >= 2) {
        headline = `GW${gw} — ${biggestRise.teamName} surge`;
        detail = `${biggestRise.teamName} climb ${biggestRise.delta} places.`;
      } else if (biggestFall && biggestFall.delta <= -2) {
        headline = `GW${gw} — ${biggestFall.teamName} drop back`;
        detail = `${biggestFall.teamName} fall ${Math.abs(biggestFall.delta)} places.`;
      } else if (currentLeader) {
        headline = `GW${gw} — ${currentLeader.teamName} hold top spot`;
        detail = `${currentLeader.teamName} stay in 1st place.`;
      }
      return headline ? { gw, headline, detail } : null;
    }).filter((event): event is { gw: number; headline: string; detail: string } => event !== null);
  }, [axisWeeks, maxRank, teamPaths]);
  const activeNarrative = useMemo(() => {
    if (!showNarrativeOverlays || animationProgress < 0.72) {
      return null;
    }
    const activeGwIndex = Math.max(0, Math.min(axisWeeks.length - 1, Math.floor(animationProgress - 0.2)));
    const activeGw = axisWeeks[activeGwIndex];
    return narrativeEvents.find((event) => event.gw === activeGw) ?? null;
  }, [animationProgress, axisWeeks, narrativeEvents, showNarrativeOverlays]);
  const focusCard = useMemo(() => {
    if (effectiveFocusTeamId === null) {
      return null;
    }
    const focusedTeam = teamPaths.find((team) => team.teamId === effectiveFocusTeamId) ?? null;
    if (!focusedTeam) {
      return null;
    }
    const currentRankIndex = Math.min(
      Math.max(Math.round(Math.max(animationProgress - 0.15, 0)), 0),
      focusedTeam.rankSequence.length - 1,
    );
    const previousRankIndex = Math.max(0, currentRankIndex - 1);
    const currentRank = focusedTeam.rankSequence[currentRankIndex] ?? maxRank;
    const previousRank = focusedTeam.rankSequence[previousRankIndex] ?? currentRank;
    const delta = previousRank - currentRank;
    const movementLabel = delta > 0
      ? `Up ${delta}`
      : delta < 0
        ? `Down ${Math.abs(delta)}`
        : 'Holding';
    return {
      key: `focus-${focusedTeam.teamId}-${currentRankIndex}-${currentRank}`,
      teamName: focusedTeam.teamName,
      rank: currentRank,
      movementLabel,
      cueLabel: hoveredTeamId === focusedTeam.teamId ? `Hovered • GW${axisWeeks[currentRankIndex] ?? axisWeeks[0] ?? 1}` : 'Focus Mode',
      tone: delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'flat' as const,
      ballColor: focusedTeam.ballColor,
      ringColor: focusedTeam.ringColor,
      textColor: focusedTeam.textColor,
    };
  }, [animationProgress, axisWeeks, effectiveFocusTeamId, hoveredTeamId, maxRank, teamPaths]);
  const showFinalReveal = animationProgress >= maxFrameIndex - 0.02;

  useEffect(() => {
    const unsubscribe = progressValue.on('change', (value) => {
      setAnimationProgress(value);
    });
    return () => unsubscribe();
  }, [progressValue]);

  useEffect(() => {
    progressValue.set(0);
    setAnimationProgress(0);
    setStoryFocusTeamId(null);
    setHoveredTeamId(null);
    setHoveredPoint(null);
    if (maxFrameIndex <= 0) {
      return undefined;
    }
    let controls: { stop: () => void } | null = null;
    const timeoutId = window.setTimeout(() => {
      controls = animate(progressValue, maxFrameIndex, {
        duration: Math.max(4.8, axisWeeks.length * 0.9),
        ease: [0.22, 1, 0.36, 1],
      });
    }, animationStartDelayMs);
    return () => {
      window.clearTimeout(timeoutId);
      if (controls !== null) {
        controls.stop();
      }
    };
  }, [animationSignature, animationStartDelayMs, axisWeeks.length, maxFrameIndex, progressValue]);

  useEffect(() => {
    if (!enableStoryMode || !showFinalReveal || hoveredTeamId !== null || storyFocusOrder.length === 0) {
      return undefined;
    }
    let index = 0;
    setStoryFocusTeamId(storyFocusOrder[0] ?? null);
    const timer = window.setInterval(() => {
      index = (index + 1) % storyFocusOrder.length;
      setStoryFocusTeamId(storyFocusOrder[index] ?? null);
    }, 2400);
    return () => {
      window.clearInterval(timer);
    };
  }, [enableStoryMode, hoveredTeamId, showFinalReveal, storyFocusOrder]);

  return (
    <div className="ssn-journey-chart">
      <GraphStoryOverlay
        narrative={activeNarrative ? {
          key: `${activeNarrative.gw}-${activeNarrative.headline}`,
          headline: activeNarrative.headline,
          detail: activeNarrative.detail,
        } : null}
        focus={focusCard}
      />
      <svg className="ssn-journey-grid" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        <rect
          x={CHART_PADDING_LEFT - 8}
          y={rankToY(1, maxRank) - 14}
          width={CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT + 18}
          height={Math.max(18, rankToY(Math.min(2, maxRank), maxRank) - rankToY(1, maxRank) + 28)}
          className="ssn-journey-zone zone-top"
        />
        {maxRank > 3 && (
          <rect
            x={CHART_PADDING_LEFT - 8}
            y={rankToY(Math.max(1, maxRank - 1), maxRank) - 14}
            width={CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT + 18}
            height={Math.max(18, rankToY(maxRank, maxRank) - rankToY(Math.max(1, maxRank - 1), maxRank) + 28)}
            className="ssn-journey-zone zone-danger"
          />
        )}
        {Array.from({ length: maxRank }, (_, index) => {
          const rank = index + 1;
          const y = rankToY(rank, maxRank);
          return (
            <g key={`rank-${rank}`}>
              <line x1={CHART_PADDING_LEFT - 10} y1={y} x2={CHART_WIDTH - CHART_PADDING_RIGHT + 10} y2={y} className="ssn-journey-grid-line" />
              <text x={24} y={y + 4} className="ssn-journey-rank-label">#{rank}</text>
            </g>
          );
        })}
        {xPositions.map((x, index) => (
          <g key={`gw-${axisWeeks[index]}`}>
            <line x1={x} y1={CHART_PADDING_TOP - 8} x2={x} y2={CHART_HEIGHT - CHART_PADDING_BOTTOM + 10} className="ssn-journey-grid-column" />
            <text x={x} y={CHART_HEIGHT - 10} className="ssn-journey-week-label">
              GW{axisWeeks[index]}
            </text>
          </g>
        ))}
        {cutLines.map((line) => {
          const upperY = rankToY(line.afterRank, maxRank);
          const lowerY = rankToY(Math.min(maxRank, line.afterRank + 1), maxRank);
          const y = (upperY + lowerY) / 2;
          return (
            <g key={`cut-${line.afterRank}-${line.label}`} className={`ssn-journey-cutline tone-${line.tone}`}>
              <line
                x1={CHART_PADDING_LEFT - 4}
                y1={y}
                x2={CHART_WIDTH - CHART_PADDING_RIGHT + 4}
                y2={y}
                className="ssn-journey-cutline-stroke"
              />
              <text x={CHART_WIDTH - CHART_PADDING_RIGHT + 2} y={y - 4} className="ssn-journey-cutline-label">
                {line.label}
              </text>
            </g>
          );
        })}
        <polyline points={`${START_X},${START_Y} ${CHART_PADDING_LEFT},${START_Y}`} className="ssn-journey-entry-line" />
        <text x={START_X} y={CHART_HEIGHT - 10} className="ssn-journey-week-label">Start</text>
        {teamPaths.map((team) => {
          const cappedProgress = Math.min(animationProgress, team.frames.length - 1);
          const visibleFrames = buildVisibleFrames(team.frames, cappedProgress);
          const visibleTrailPath = buildSmoothPath(visibleFrames);
          return (
            <path
              key={`trail-${team.teamId}`}
              d={visibleTrailPath}
              className={`ssn-journey-team-trail${team.isHighlighted ? ' highlighted' : effectiveFocusTeamId !== null ? ' muted' : ''}`}
              style={{ ['--trail-color' as string]: team.ringColor ?? team.ballColor ?? '#9cb4d8' } as CSSProperties}
            />
          );
        })}
        {featuredFinishers.map((team) => {
          const finalPoint = team.frames[team.frames.length - 1] ?? null;
          if (!finalPoint || animationProgress < team.frames.length - 1 - 0.02) {
            return null;
          }
          return (
            <g
              key={`finish-${team.teamId}`}
              className={`ssn-journey-end-ball-marker${team.isHighlighted ? ' highlighted' : effectiveFocusTeamId !== null ? ' muted' : ''}`}
              style={{
                ['--ball-fill' as string]: team.ballColor ?? '#d5ddf2',
                ['--ball-ring' as string]: team.ringColor ?? '#ffffff',
                ['--ball-text' as string]: team.textColor ?? '#061327',
              } as CSSProperties}
              transform={`translate(${Math.min(CHART_WIDTH - CHART_PADDING_RIGHT + 2, finalPoint.x + 22)} ${finalPoint.y})`}
            >
              <circle className="ssn-journey-end-ball-circle" r={8} />
              <text className="ssn-journey-end-ball-text" x={0} y={0}>{team.finalRank}</text>
            </g>
          );
        })}
        {teamPaths.map((team) => {
          const currentPoint = interpolateFramePoint(
            team.frames,
            Math.min(animationProgress, team.frames.length - 1),
          );
          return (
            <g
              key={`ball-${team.teamId}`}
              className={`ssn-journey-ball-marker${team.isHighlighted ? ' highlighted' : effectiveFocusTeamId !== null ? ' muted' : ''}`}
              style={{
                ['--ball-fill' as string]: team.ballColor ?? '#d5ddf2',
                ['--ball-ring' as string]: team.ringColor ?? '#ffffff',
                ['--ball-text' as string]: team.textColor ?? '#061327',
              } as CSSProperties}
              transform={`translate(${currentPoint.x} ${currentPoint.y})`}
            >
              <title>{team.teamName}</title>
              <circle className="ssn-journey-ball-circle" r={8.5} />
              <text className="ssn-journey-ball-text" x={0} y={0}>{(team.teamName?.trim().charAt(0) || '?').toUpperCase()}</text>
            </g>
          );
        })}
        {teamPaths.flatMap((team) => (
          team.frames.slice(1).map((point, index) => {
            const gw = axisWeeks[index];
            const rank = team.rankSequence[index] ?? maxRank;
            return (
              <circle
                key={`hit-${team.teamId}-${gw}`}
                cx={point.x}
                cy={point.y}
                r={showFinalReveal ? 8.5 : 6.5}
                className="ssn-journey-hit-area"
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
        {showFinalReveal && teamPaths.map((team) => {
          const finalPoint = team.frames[team.frames.length - 1] ?? null;
          const finalRank = team.rankSequence[team.rankSequence.length - 1] ?? maxRank;
          if (!finalPoint) {
            return null;
          }
          const labelX = CHART_WIDTH - CHART_PADDING_RIGHT + 18;
          return (
            <g
              key={`label-${team.teamId}`}
              className={`ssn-journey-finish-label${team.isHighlighted ? ' highlighted' : effectiveFocusTeamId !== null ? ' muted' : ''}`}
              transform={`translate(${labelX} ${finalPoint.y})`}
            >
              <line x1={-12} y1={0} x2={-2} y2={0} className="ssn-journey-finish-tick" />
              <text x={0} y={-1} className="ssn-journey-finish-rank">#{finalRank}</text>
              <text x={24} y={-1} className="ssn-journey-finish-name">{team.teamName}</text>
            </g>
          );
        })}
      </svg>
      <AnimatePresence>
        {hoveredPoint ? (
          <motion.div
            key={`tooltip-${hoveredPoint.teamId}-${hoveredPoint.gw}`}
            className="ssn-journey-tooltip"
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
      {showSpotlightRail && (
        <div className="ssn-journey-spotlight-rail">
          {featuredFinishers.map((team) => (
            <article
              key={`journey-rail-${team.teamId}`}
              className="ssn-journey-spotlight-card"
              style={{
                ['--card-ball' as string]: team.ballColor ?? '#d5ddf2',
                ['--card-ring' as string]: team.ringColor ?? '#ffffff',
                ['--card-text' as string]: team.textColor ?? '#061327',
              } as CSSProperties}
            >
              <div className="ssn-journey-spotlight-rank">
                <span className="ssn-journey-spotlight-ball">{(team.teamName?.trim().charAt(0) || '?').toUpperCase()}</span>
                <strong>#{team.finalRank}</strong>
              </div>
              <div className="ssn-journey-spotlight-copy">
                <span>{team.teamName}</span>
                <small>
                  {team.delta > 0 ? `UP ${team.delta}` : team.delta < 0 ? `DOWN ${Math.abs(team.delta)}` : 'HOLD'}
                </small>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
