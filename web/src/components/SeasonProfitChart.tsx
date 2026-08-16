import { useMemo, useState } from 'react';

type SeasonProfitChartProps = {
  profitData: {
    currentSeason: string;
    seasons: string[];
    gameweeks: Array<{ gw: string; totals: Record<string, number> }>;
  } | null;
};

const CHART_WIDTH = 800;
const CHART_HEIGHT = 280;
const PADDING = { top: 30, right: 140, bottom: 40, left: 60 };

// Color palette for different seasons
const SEASON_COLORS: Record<string, string> = {
  S1: '#ff6b6b', // Coral
  S2: '#4ecdc4', // Mint
  S3: '#45b7d1', // Sky blue
  S4: '#ffd25f', // Gold
  S5: '#96ceb4', // Sage green
  S6: '#dbe5ff', // Ice blue
  S7: '#ff9ff3', // Pink
  S8: '#feca57', // Yellow-orange
  S9: '#ff7675', // Soft red
  S10: '#54a0ff', // Soft blue
};

const getSeasonColor = (season: string): string => {
  return SEASON_COLORS[season] ?? '#8884d8';
};

export function SeasonProfitChart({ profitData }: SeasonProfitChartProps) {
  const [hoveredData, setHoveredData] = useState<{
    gw: string;
    totals: Record<string, number>;
    x: number;
  } | null>(null);

  const parsedData = useMemo(() => {
    if (!profitData || !profitData.gameweeks.length) return null;

    const seasons = profitData.seasons;
    const gameweeks = profitData.gameweeks;

    // Calculate cumulative profits
    const cumulativeTotals: Record<string, number> = {};
    seasons.forEach((s) => {
      cumulativeTotals[s] = 0;
    });

    const chartPoints = gameweeks.map((gwItem) => {
      const pointTotals: Record<string, number> = {};
      seasons.forEach((s) => {
        const weeklyProfit = gwItem.totals[s] ?? 0;
        cumulativeTotals[s] = Number((cumulativeTotals[s] + weeklyProfit).toFixed(2));
        pointTotals[s] = cumulativeTotals[s];
      });

      return {
        gw: gwItem.gw,
        totals: pointTotals,
      };
    });

    // Find min and max for scaling
    const allValues = chartPoints.flatMap((p) => Object.values(p.totals));
    const minVal = Math.min(0, ...allValues);
    const maxVal = Math.max(10, ...allValues);
    const range = maxVal - minVal || 1;

    return {
      seasons,
      points: chartPoints,
      minVal,
      maxVal,
      range,
    };
  }, [profitData]);

  if (!parsedData) {
    return (
      <div className="chart-placeholder">
        <p className="muted">No season profit data available.</p>
      </div>
    );
  }

  const { seasons, points, minVal, maxVal, range } = parsedData;
  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Scale functions
  const getX = (idx: number) => {
    if (points.length <= 1) return PADDING.left + plotW / 2;
    return PADDING.left + (idx / (points.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    return PADDING.top + plotH - ((val - minVal) / range) * plotH;
  };

  // Build SVG Paths for each season
  const lines = seasons.map((season) => {
    const pointsList = points.map((p, idx) => ({
      x: getX(idx),
      y: getY(p.totals[season] ?? 0),
    }));

    const pathD = pointsList.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

    return {
      season,
      pathD,
      color: getSeasonColor(season),
      lastPoint: pointsList[pointsList.length - 1],
    };
  });

  return (
    <div className="season-profit-chart-container">
      <div className="season-profit-header">
        <h4>Season-over-Season Cumulative Profit</h4>
        <span className="muted small">Cumulative profit growth over gameweeks (GW1 - GW8)</span>
      </div>

      <div className="season-profit-svg-wrapper">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          style={{ width: '100%', height: 'auto', overflow: 'visible' }}
          onMouseLeave={() => setHoveredData(null)}
        >
          {/* Grids and Y Axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const yVal = minVal + frac * range;
            const yPos = PADDING.top + plotH - frac * plotH;
            return (
              <g key={frac}>
                <line
                  x1={PADDING.left}
                  y1={yPos}
                  x2={CHART_WIDTH - PADDING.right}
                  y2={yPos}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 4"
                />
                <text x={PADDING.left - 8} y={yPos + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
                  {yVal >= 0 ? `+£${yVal.toFixed(0)}` : `-£${Math.abs(yVal).toFixed(0)}`}
                </text>
              </g>
            );
          })}

          {/* X Axis ticks */}
          {points.map((p, idx) => {
            const xPos = getX(idx);
            return (
              <g key={p.gw}>
                <line
                  x1={xPos}
                  y1={PADDING.top}
                  x2={xPos}
                  y2={PADDING.top + plotH}
                  stroke="rgba(255,255,255,0.04)"
                />
                <text x={xPos} y={CHART_HEIGHT - 12} textAnchor="middle" fontSize={10} fill="var(--muted)">
                  {p.gw}
                </text>
                {/* Transparent overlay column for hover detection */}
                <rect
                  x={xPos - plotW / (points.length * 2)}
                  y={PADDING.top}
                  width={plotW / points.length}
                  height={plotH}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() =>
                    setHoveredData({
                      gw: p.gw,
                      totals: p.totals,
                      x: xPos,
                    })
                  }
                />
              </g>
            );
          })}

          {/* Border lines */}
          <line
            x1={PADDING.left}
            y1={PADDING.top}
            x2={PADDING.left}
            y2={PADDING.top + plotH}
            stroke="rgba(255,255,255,0.2)"
          />
          <line
            x1={PADDING.left}
            y1={PADDING.top + plotH}
            x2={CHART_WIDTH - PADDING.right}
            y2={PADDING.top + plotH}
            stroke="rgba(255,255,255,0.2)"
          />

          {/* Season Lines */}
          {lines.map((line) => (
            <g key={line.season}>
              <path
                d={line.pathD}
                fill="none"
                stroke={line.color}
                strokeWidth={line.season === profitData?.currentSeason ? 3.5 : 2}
                strokeOpacity={
                  hoveredData
                    ? 0.35 // Mute other lines on hover
                    : line.season === profitData?.currentSeason
                      ? 1
                      : 0.7
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'stroke-opacity 0.2s' }}
              />
              {/* Highlight current season with a pulsing effect or tag */}
              {line.lastPoint && (
                <g transform={`translate(${line.lastPoint.x + 6}, ${line.lastPoint.y})`}>
                  <circle r={3} fill={line.color} />
                  <text
                    x={8}
                    y={3}
                    fontSize={10}
                    fontWeight={line.season === profitData?.currentSeason ? 'bold' : 'normal'}
                    fill={line.color}
                  >
                    {line.season} {line.season === profitData?.currentSeason ? '(Current)' : ''}
                  </text>
                </g>
              )}
            </g>
          ))}

          {/* Hover indicator vertical line */}
          {hoveredData && (
            <g>
              <line
                x1={hoveredData.x}
                y1={PADDING.top}
                x2={hoveredData.x}
                y2={PADDING.top + plotH}
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="2 2"
              />
              {seasons.map((season) => {
                const val = hoveredData.totals[season] ?? 0;
                return (
                  <circle
                    key={`point-${season}`}
                    cx={hoveredData.x}
                    cy={getY(val)}
                    r={season === profitData?.currentSeason ? 5 : 4}
                    fill={getSeasonColor(season)}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Hover tooltip details card */}
      {hoveredData && (
        <div className="season-profit-tooltip">
          <div className="tooltip-title">{hoveredData.gw} Profits</div>
          <div className="tooltip-grid">
            {seasons.map((s) => (
              <div key={s} className="tooltip-item" style={{ '--item-color': getSeasonColor(s) } as React.CSSProperties}>
                <span className="tooltip-dot" />
                <span className="tooltip-season">{s}</span>
                <span className="tooltip-val font-mono">
                  {hoveredData.totals[s] >= 0 ? `+£${hoveredData.totals[s].toFixed(2)}` : `-£${Math.abs(hoveredData.totals[s]).toFixed(2)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
