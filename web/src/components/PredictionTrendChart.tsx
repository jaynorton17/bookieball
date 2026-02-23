const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];

type WeekScore = {
  gw: string;
  picker: string;
  points: number;
};

type PredictionTrendChartProps = {
  title: string;
  subtitle?: string;
  weeks: WeekScore[] | null;
};

const orderIndex = (gw: string): number => {
  const value = Number(gw.replace('GW', ''));
  return Number.isFinite(value) ? value : 99;
};

export function PredictionTrendChart({ title, subtitle, weeks }: PredictionTrendChartProps) {
  const weekMap = new Map<string, { Jay: number; Computer: number }>();
  (weeks ?? []).forEach((row) => {
    const entry = weekMap.get(row.gw) ?? { Jay: 0, Computer: 0 };
    if (row.picker === 'Jay') {
      entry.Jay = row.points;
    } else if (row.picker === 'Computer') {
      entry.Computer = row.points;
    }
    weekMap.set(row.gw, entry);
  });

  const orderedWeeks = GAMEWEEKS.filter((gw) => weekMap.has(gw)).sort((a, b) => orderIndex(a) - orderIndex(b));
  const cumulative = orderedWeeks.reduce(
    (acc, gw) => {
      const entry = weekMap.get(gw) ?? { Jay: 0, Computer: 0 };
      const last = acc[acc.length - 1] ?? { Jay: 0, Computer: 0 };
      acc.push({
        gw,
        Jay: last.Jay + entry.Jay,
        Computer: last.Computer + entry.Computer,
      });
      return acc;
    },
    [] as Array<{ gw: string; Jay: number; Computer: number }>,
  );

  const width = Math.max(420, cumulative.length * 84);
  const height = 220;
  const margin = { top: 26, right: 24, bottom: 36, left: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxScore = Math.max(10, ...cumulative.flatMap((row) => [row.Jay, row.Computer]));

  const scaleX = (index: number) =>
    cumulative.length > 1 ? margin.left + (plotWidth / (cumulative.length - 1)) * index : margin.left + plotWidth / 2;
  const scaleY = (value: number) =>
    margin.top + (1 - value / maxScore) * plotHeight;

  const jayPath = cumulative.map((row, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(idx)} ${scaleY(row.Jay)}`).join(' ');
  const cpuPath = cumulative.map((row, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(idx)} ${scaleY(row.Computer)}`).join(' ');

  return (
    <div className="prediction-trend-card">
      <div className="prediction-trend-header">
        <div>
          <h4>{title}</h4>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      {cumulative.length === 0 ? (
        <p className="muted">No prediction scores yet.</p>
      ) : (
        <div className="prediction-trend-chart">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} prediction trend`}>
            <line className="trend-axis" x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} />
            <line className="trend-axis" x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} />
            {[0.25, 0.5, 0.75].map((ratio) => {
              const y = margin.top + ratio * plotHeight;
              return <line key={`grid-${ratio}`} className="trend-grid-line" x1={margin.left} y1={y} x2={width - margin.right} y2={y} />;
            })}
            <path className="trend-line jay" d={jayPath} />
            <path className="trend-line cpu" d={cpuPath} />
            {cumulative.map((row, idx) => (
              <circle key={`jay-${row.gw}`} className="trend-point jay" cx={scaleX(idx)} cy={scaleY(row.Jay)} r={4} />
            ))}
            {cumulative.map((row, idx) => (
              <circle key={`cpu-${row.gw}`} className="trend-point cpu" cx={scaleX(idx)} cy={scaleY(row.Computer)} r={4} />
            ))}
            {cumulative.map((row, idx) => (
              <text key={`gw-${row.gw}`} className="trend-xlabel" x={scaleX(idx)} y={height - 12} textAnchor="middle">
                {row.gw}
              </text>
            ))}
          </svg>
          <div className="trend-legend">
            <span className="legend-item jay"><span className="legend-dot" />Jay</span>
            <span className="legend-item cpu"><span className="legend-dot" />Computer</span>
          </div>
        </div>
      )}
    </div>
  );
}
