import { useMemo } from 'react';

type ChartData = {
  season: string;
  gw: string;
  profit: number;
  wins: number;
  losses: number;
  draws: number;
  totalSpins: number;
  rank: number;
};

type TeamPerformanceChartProps = {
  teamName: string;
  performanceData: ChartData[];
};

const CHART_WIDTH = 500;
const CHART_HEIGHT = 180;
const PADDING = { top: 20, right: 20, bottom: 30, left: 50 };

function SimpleLineChart({
  data,
  dataKey,
  label,
  color,
  domain,
}: {
  data: { x: string; y: number }[];
  dataKey: string;
  label: string;
  color: string;
  domain?: [number, number];
}) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.y);
  const minY = domain ? domain[0] : Math.min(...values);
  const maxY = domain ? domain[1] : Math.max(...values);
  const rangeY = maxY - minY || 1;

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const points = data.map((d, i) => {
    const x = PADDING.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = PADDING.top + plotH - ((d.y - minY) / rangeY) * plotH;
    return { x, y, raw: d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = points.length > 0 
    ? `${pathD} L${points[points.length - 1].x},${PADDING.top + plotH} L${points[0].x},${PADDING.top + plotH} Z`
    : '';

  const tickCount = Math.min(data.length, 6);
  const tickStep = Math.max(1, Math.floor(data.length / tickCount));
  const gradId = `grad-${dataKey}`;

  return (
    <div style={{ flex: '1 1 220px', minWidth: 220 }} className="analytics-chart-card">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        <text x={CHART_WIDTH / 2} y={14} textAnchor="middle" fontSize={12} fill="currentColor" fontWeight={600}>
          {label}
        </text>

        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const yVal = minY + frac * rangeY;
          const yPos = PADDING.top + plotH - frac * plotH;
          return (
            <g key={frac}>
              <line x1={PADDING.left} y1={yPos} x2={CHART_WIDTH - PADDING.right} y2={yPos} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
              <text x={PADDING.left - 6} y={yPos + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
                {Math.round(yVal * 100) / 100}
              </text>
            </g>
          );
        })}

        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={PADDING.top + plotH} stroke="rgba(255, 255, 255, 0.2)" />
        <line x1={PADDING.left} y1={PADDING.top + plotH} x2={CHART_WIDTH - PADDING.right} y2={PADDING.top + plotH} stroke="rgba(255, 255, 255, 0.2)" />

        {/* Gradient Area Fill */}
        {areaD && <path d={areaD} fill={`url(#${gradId})`} />}

        {/* Line Path */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={color} stroke="white" strokeWidth={1.5} style={{ cursor: 'pointer' }}>
            <title>{`${p.raw.x}: ${p.raw.y}`}</title>
          </circle>
        ))}

        {data.map((d, i) =>
          i % tickStep === 0 || i === data.length - 1 ? (
            <text
              key={i}
              x={points[i].x}
              y={CHART_HEIGHT - 6}
              textAnchor="middle"
              fontSize={9}
              fill="var(--muted)"
              transform={`rotate(-20, ${points[i].x}, ${CHART_HEIGHT - 6})`}
            >
              {d.x.replace('S', 'S').replace('GW', ' GW')}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export function TeamPerformanceChart({ teamName, performanceData }: TeamPerformanceChartProps) {
  const summaryStats = useMemo(() => {
    if (performanceData.length === 0) return null;

    const totalProfit = performanceData.reduce((sum, h) => sum + h.profit, 0);
    const totalWins = performanceData.reduce((sum, h) => sum + h.wins, 0);
    const totalLosses = performanceData.reduce((sum, h) => sum + h.losses, 0);
    const totalDraws = performanceData.reduce((sum, h) => sum + h.draws, 0);
    const totalSpins = performanceData.reduce((sum, h) => sum + h.totalSpins, 0);
    const totalEntries = performanceData.length;

    const winRate = (totalWins / Math.max(1, totalWins + totalLosses + totalDraws)) * 100;
    const avgProfit = totalProfit / Math.max(1, totalEntries);
    const latestRank = performanceData[performanceData.length - 1]?.rank ?? 0;

    return {
      totalProfit,
      winRate,
      avgProfit,
      totalSpins,
      latestRank,
      totalEntries,
    };
  }, [performanceData]);

  if (performanceData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p className="muted">No performance data available for {teamName}</p>
      </div>
    );
  }

  const chartData = performanceData.map((entry) => ({
    x: `${entry.season} ${entry.gw}`,
    profit: entry.profit,
    winRate: entry.wins / Math.max(1, entry.wins + entry.losses + entry.draws),
    totalSpins: entry.totalSpins,
    rank: entry.rank,
  }));

  const profitData = chartData.map((d) => ({ x: d.x, y: d.profit }));
  const winRateData = chartData.map((d) => ({ x: d.x, y: d.winRate }));
  const spinsData = chartData.map((d) => ({ x: d.x, y: d.totalSpins }));
  const rankData = chartData.map((d) => ({ x: d.x, y: d.rank }));

  return (
    <div className="team-performance-chart">
      {summaryStats && (
        <div className="analytics-stats-grid">
          <div className="analytics-stat-card">
            <span className="muted small">Total Cumulative Profit</span>
            <h2 className={summaryStats.totalProfit >= 0 ? 'text-profit-pos' : 'text-profit-neg'}>
              {summaryStats.totalProfit >= 0 ? `+£${summaryStats.totalProfit.toFixed(2)}` : `-£${Math.abs(summaryStats.totalProfit).toFixed(2)}`}
            </h2>
            <small className="muted">Across {summaryStats.totalEntries} entries</small>
          </div>

          <div className="analytics-stat-card">
            <span className="muted small">Win Rate</span>
            <h2>{summaryStats.winRate.toFixed(1)}%</h2>
            <small className="muted">Average {summaryStats.avgProfit >= 0 ? `+£${summaryStats.avgProfit.toFixed(2)}` : `-£${Math.abs(summaryStats.avgProfit).toFixed(2)}`} / GW</small>
          </div>

          <div className="analytics-stat-card">
            <span className="muted small">Total Spins</span>
            <h2>{summaryStats.totalSpins}</h2>
            <small className="muted">Spins accumulated</small>
          </div>

          <div className="analytics-stat-card">
            <span className="muted small">Current Division Rank</span>
            <h2>#{summaryStats.latestRank}</h2>
            <small className="muted">Latest standing</small>
          </div>
        </div>
      )}

      <div className="charts-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <SimpleLineChart data={profitData} dataKey="profit" label="Profit History" color="var(--accent2)" />
        <SimpleLineChart data={winRateData} dataKey="winRate" label="Win Rate History" color="var(--accent)" domain={[0, 1]} />
        <SimpleLineChart data={spinsData} dataKey="totalSpins" label="Spins History" color="var(--broadcast-blue)" />
        <SimpleLineChart data={rankData} dataKey="rank" label="Division Rank History" color="var(--danger)" domain={[20, 1]} />
      </div>
    </div>
  );
}
