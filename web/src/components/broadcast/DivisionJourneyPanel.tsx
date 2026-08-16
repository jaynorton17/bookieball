import { useEffect, useState } from 'react';
import type { TeamPalette, PanelTone } from '../../lib/broadcastTheme';
import { PANEL_THEMES } from '../../lib/broadcastTheme';
import { BroadcastPanel } from './BroadcastPanel';

type DivisionJourneyTeam = {
  teamId: number;
  teamName: string;
  palette: TeamPalette;
  ranks: number[];
  startRank: number;
  finalRank: number;
  highlighted: boolean;
};

export function DivisionJourneyPanel({
  division,
  teams,
  gwLabels,
}: {
  division: string;
  teams: DivisionJourneyTeam[];
  gwLabels: string[];
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const maxFrame = Math.max(0, gwLabels.length - 1);
    if (maxFrame === 0) {
      setProgress(0);
      return;
    }
    setProgress(0);
    let frame = 0;
    const durationMs = 7600;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(elapsed / durationMs, 1);
      const eased = 1 - ((1 - ratio) ** 3);
      setProgress(eased * maxFrame);
      if (ratio < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [division, gwLabels]);

  const width = 900;
  const height = 360;
  const padding = { top: 20, right: 56, bottom: 30, left: 42 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const teamCount = Math.max(teams.length, 1);
  const rankSpan = teamCount - 1;

  const xScale = (index: number) => padding.left + (index / Math.max(gwLabels.length - 1, 1)) * plotW;
  const yScale = (rank: number) => padding.top + ((rank - 1) / rankSpan) * plotH;

  const isAtEnd = progress >= gwLabels.length - 1 - 0.01;
  const visibleCount = Math.min(gwLabels.length - 1, Math.max(1, Math.floor(progress)));

  const accent: PanelTone = 'gold';
  const theme = PANEL_THEMES[accent];

  return (
    <BroadcastPanel accent={accent} style={{ minHeight: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <filter id={`glow-${division}`}><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {Array.from({ length: teamCount }, (_, rank) => (
          <line
            key={`grid-${rank}`}
            x1={padding.left} y1={yScale(rank + 1)}
            x2={width - padding.right} y2={yScale(rank + 1)}
            stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}
          />
        ))}

        {gwLabels.map((label, index) => (
          <text
            key={`gw-${index}`}
            x={xScale(index)} y={height - padding.bottom + 18}
            textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10} fontWeight={700}
          >
            {label}
          </text>
        ))}

        {teams.map((team) => {
          const pathD = team.ranks
            .map((rank, index) => `${index === 0 ? 'M' : 'L'}${xScale(index)},${yScale(rank)}`)
            .join(' ');
          const isWinner = team.highlighted;
          const strokeColor = isWinner ? '#f5d38f' : 'rgba(140,180,255,0.5)';

          return (
            <g key={`team-${team.teamId}`}>
              <path
                d={pathD}
                fill="none"
                stroke={isWinner ? strokeColor : 'rgba(140,180,255,0.15)'}
                strokeWidth={isWinner ? 3 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isWinner ? 1 : 0.45}
              />

              {isAtEnd && (
                <circle cx={xScale(gwLabels.length - 1)} cy={yScale(team.finalRank)} r={4.5} fill={strokeColor} stroke="#0a1424" strokeWidth={1.5} />
              )}

              {isWinner && (
                <text x={xScale(gwLabels.length - 1) + 8} y={yScale(team.finalRank) + 4} fill={strokeColor} fontSize={12} fontWeight={900}>
                  {team.teamName}
                </text>
              )}

              {visibleCount > 0 && !isAtEnd && (
                <circle
                  cx={xScale(visibleCount)}
                  cy={yScale(team.ranks[visibleCount] ?? team.finalRank)}
                  r={3.5}
                  fill={strokeColor}
                  stroke="#0a1424"
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}
      </svg>
    </BroadcastPanel>
  );
}
