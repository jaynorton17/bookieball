import { TeamBadge } from '../TeamBadge';

type GraphicRow = {
  rank: number;
  name: string;
  value: string;
  detail?: string;
  teamId?: number;
};

type Team = {
  id: number;
  name: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
};

function numberFrom(value: string): number {
  const parsed = Number(value.replace(/[^0-9+-.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function TeamMark({ team }: { team?: Team }) {
  return team ? (
    <TeamBadge
      name={team.name}
      ballColor={team.ballColor}
      ringColor={team.ringColor}
      textColor={team.textColor}
      size={34}
    />
  ) : null;
}

function Podium({ rows, color, teamById }: { rows: GraphicRow[]; color: string; teamById: Map<number, Team> }) {
  const top = rows.slice(0, 3);
  if (!top.length) return null;
  const order = [top[1], top[0], top[2]].filter(Boolean) as GraphicRow[];
  return (
    <div className="home-analytics-podium">
      {order.map((row) => {
        const placing = row.rank;
        const team = row.teamId ? teamById.get(row.teamId) : undefined;
        return (
          <article key={`${row.rank}-${row.name}`} className={`home-podium-place place-${placing}`} style={{ ['--graphic-accent' as string]: color }}>
            <span className="home-podium-rank">#{placing}</span>
            <TeamMark team={team} />
            <strong>{row.name}</strong>
            <b>{row.value}</b>
            {row.detail ? <small>{row.detail}</small> : null}
          </article>
        );
      })}
    </div>
  );
}

function Rivalries({ rows, color }: { rows: GraphicRow[]; color: string }) {
  return (
    <div className="home-rivalry-board">
      {rows.slice(0, 6).map((row) => {
        const [left, right] = row.name.split(/\s+vs\s+/i);
        return (
          <article key={`${row.rank}-${row.name}`} className="home-rivalry-card" style={{ ['--graphic-accent' as string]: color }}>
            <div><span>#{row.rank}</span><strong>{left ?? row.name}</strong></div>
            <b>{row.value}</b>
            <div className="right"><span>H2H</span><strong>{right ?? ''}</strong></div>
            {row.detail ? <small>{row.detail}</small> : null}
          </article>
        );
      })}
    </div>
  );
}

function Bars({ rows, color, teamById }: { rows: GraphicRow[]; color: string; teamById: Map<number, Team> }) {
  const shown = rows.slice(0, 10);
  const values = shown.map((row) => numberFrom(row.value));
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  return (
    <div className="home-power-bars">
      {shown.map((row, index) => {
        const team = row.teamId ? teamById.get(row.teamId) : undefined;
        const width = Math.max(5, (Math.abs(values[index] ?? 0) / max) * 100);
        return (
          <article key={`${row.rank}-${row.name}`} className="home-power-row">
            <span className="home-power-rank">{row.rank}</span>
            <TeamMark team={team} />
            <div className="home-power-main">
              <div><strong>{row.name}</strong><b>{row.value}</b></div>
              <div className="home-power-track"><i style={{ width: `${width}%`, background: color }} /></div>
              {row.detail ? <small>{row.detail}</small> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

const BAR_SLIDES = new Set(['dominance', 'elo', 'peak-elo', 'ratings', 'profit']);

export function HomeAnalyticsGraphic({
  slideId,
  rows,
  color,
  teamById,
}: {
  slideId: string;
  rows: GraphicRow[];
  color: string;
  teamById: Map<number, Team>;
}) {
  if (slideId === 'bookiedor') return <Podium rows={rows} color={color} teamById={teamById} />;
  if (slideId === 'rivalries') return <Rivalries rows={rows} color={color} />;
  if (BAR_SLIDES.has(slideId)) return <Bars rows={rows} color={color} teamById={teamById} />;
  return null;
}

export function isHomeGraphicSlide(slideId: string): boolean {
  return slideId === 'bookiedor' || slideId === 'rivalries' || BAR_SLIDES.has(slideId);
}
