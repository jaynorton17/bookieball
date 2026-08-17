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

function Podium({ rows, color, teamById, archive = false }: { rows: GraphicRow[]; color: string; teamById: Map<number, Team>; archive?: boolean }) {
  const top = rows.slice(0, 3);
  if (!top.length) return null;
  const order = [top[1], top[0], top[2]].filter(Boolean) as GraphicRow[];
  return (
    <div className={`home-analytics-podium${archive ? ' is-archive' : ''}`}>
      {order.map((row) => {
        const placing = row.rank;
        const team = row.teamId ? teamById.get(row.teamId) : undefined;
        return (
          <article key={`${row.rank}-${row.name}`} className={`home-podium-place place-${placing}`} style={{ ['--graphic-accent' as string]: color }}>
            <span className="home-podium-rank">#{placing}</span>
            <TeamMark team={team} size={archive && placing === 1 ? 48 : 38} />
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
  const [leftWins = '—', draws = '—', rightWins = '—'] = row.value.split(/\s*-\s*/);

  return (
    <div className="home-rivalry-spotlight" style={{ ['--graphic-accent' as string]: color }}>
      <article className="home-rivalry-side">
        <TeamMark team={teamA} size={78} />
        <strong>{left ?? row.name}</strong>
      </article>

      <div className="home-rivalry-record">
        <span>ALL-TIME W · D · W</span>
        <div className="home-rivalry-scoreboard"><b>{leftWins}</b><em>—</em><b>{draws}</b><em>—</em><b>{rightWins}</b></div>
      </div>

      <article className="home-rivalry-side right">
        <TeamMark team={teamB} size={78} />
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
  const shown = rows.slice(0, 8);
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

function SpinOrbs({ rows, teamById }: { rows: GraphicRow[]; teamById: Map<number, Team> }) {
  return (
    <div className="home-spin-orbs">
      {rows.slice(0, 3).map((row) => {
        const team = row.teamId ? teamById.get(row.teamId) : undefined;
        return <article key={`${row.rank}-${row.name}`} className={`home-spin-orb place-${row.rank}`}>
          <span>#{row.rank}</span>
          <div className="home-spin-ball"><TeamMark team={team} size={row.rank === 1 ? 58 : 48} /></div>
          <strong>{row.name}</strong>
          <b>{row.value}</b>
          {row.detail ? <small>{row.detail}</small> : null}
        </article>;
      })}
    </div>
  );
}

const BAR_SLIDES = new Set(['profit', 'all-time-profit']);

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
  if (slideId === 'all-time-points') return <Podium rows={rows} color={color} teamById={teamById} archive />;
  if (slideId === 'all-time-spins') return <SpinOrbs rows={rows} teamById={teamById} />;
  if (slideId.startsWith('rivalry-')) return <RivalrySpotlight rows={rows} color={color} teamById={teamById} />;
  if (BAR_SLIDES.has(slideId)) return <Bars rows={rows} color={color} teamById={teamById} />;
  return null;
}

export function isHomeGraphicSlide(slideId: string): boolean {
  return slideId === 'bookiedor'
    || slideId === 'all-time-points'
    || slideId === 'all-time-spins'
    || slideId.startsWith('rivalry-')
    || BAR_SLIDES.has(slideId);
}
