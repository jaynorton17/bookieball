import { TeamBadge } from '../TeamBadge';

type GraphicRow = {
  rank: number;
  name: string;
  value: string;
  detail?: string;
  teamId?: number;
  teamAId?: number;
  teamBId?: number;
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

function TeamMark({ team, size = 34 }: { team?: Team; size?: number }) {
  return team ? (
    <TeamBadge
      name={team.name}
      ballColor={team.ballColor}
      ringColor={team.ringColor}
      textColor={team.textColor}
      size={size}
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

function RivalrySpotlight({ rows, color, teamById }: { rows: GraphicRow[]; color: string; teamById: Map<number, Team> }) {
  const row = rows[0];
  if (!row) return null;
  const [left, right] = row.name.split(/\s+vs\s+/i);
  const teamA = row.teamAId ? teamById.get(row.teamAId) : undefined;
  const teamB = row.teamBId ? teamById.get(row.teamBId) : undefined;

  return (
    <div className="home-rivalry-spotlight" style={{ ['--graphic-accent' as string]: color }}>
      <article className="home-rivalry-side">
        <TeamMark team={teamA} size={58} />
        <span>TEAM A</span>
        <strong>{left ?? row.name}</strong>
      </article>

      <div className="home-rivalry-record">
        <span>ALL-TIME HEAD TO HEAD</span>
        <b>{row.value}</b>
        <small>WINS&nbsp;&nbsp;·&nbsp;&nbsp;DRAWS&nbsp;&nbsp;·&nbsp;&nbsp;WINS</small>
      </div>

      <article className="home-rivalry-side right">
        <TeamMark team={teamB} size={58} />
        <span>TEAM B</span>
        <strong>{right ?? ''}</strong>
      </article>

      <div className="home-rivalry-previous">
        <span>PREVIOUS MEETING</span>
        <strong>{row.detail ?? 'No previous meeting recorded.'}</strong>
      </div>
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

const BAR_SLIDES = new Set(['ratings', 'profit']);

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
  if (slideId.startsWith('rivalry-')) return <RivalrySpotlight rows={rows} color={color} teamById={teamById} />;
  if (BAR_SLIDES.has(slideId)) return <Bars rows={rows} color={color} teamById={teamById} />;
  return null;
}

export function isHomeGraphicSlide(slideId: string): boolean {
  return slideId === 'bookiedor' || slideId.startsWith('rivalry-') || BAR_SLIDES.has(slideId);
}
