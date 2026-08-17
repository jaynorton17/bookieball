import { useEffect, useMemo, useState } from 'react';
import { TeamBadge } from './TeamBadge';

export type TableJourneyRow = {
  teamId: number;
  teamName: string;
  rank: number;
  division?: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
};

export type TableJourneySnapshot = {
  gw: string;
  rows: TableJourneyRow[];
};

type Props = {
  snapshots: TableJourneySnapshot[];
  title?: string;
  division?: string;
  emptyLabel?: string;
};

function gwNumber(gw: string): number {
  return Number(gw.replace('GW', '')) || 99;
}

function rowForTeam(snapshot: TableJourneySnapshot, teamId: number): TableJourneyRow | undefined {
  return snapshot.rows.find((row) => row.teamId === teamId);
}

export function TablePositionJourney({ snapshots, title = 'Table Journey', division, emptyLabel = 'Position history appears after the first completed gameweek.' }: Props) {
  const ordered = useMemo(() => snapshots
    .slice()
    .sort((a, b) => gwNumber(a.gw) - gwNumber(b.gw))
    .map((snapshot) => ({ ...snapshot, rows: division ? snapshot.rows.filter((row) => row.division === division) : snapshot.rows })), [division, snapshots]);

  const teamRows = useMemo(() => {
    const byId = new Map<number, TableJourneyRow>();
    ordered.forEach((snapshot) => snapshot.rows.forEach((row) => {
      const existing = byId.get(row.teamId);
      byId.set(row.teamId, {
        ...existing,
        ...row,
        ballColor: row.ballColor ?? existing?.ballColor ?? null,
        ringColor: row.ringColor ?? existing?.ringColor ?? null,
        textColor: row.textColor ?? existing?.textColor ?? null,
      });
    }));
    return [...byId.values()].sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [ordered]);

  const maxRank = useMemo(() => Math.max(1, ...ordered.flatMap((snapshot) => snapshot.rows.map((row) => row.rank))), [ordered]);
  const dense = teamRows.length > 10 || maxRank > 10;
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [division, ordered.length]);

  useEffect(() => {
    if (ordered.length <= 1 || step >= ordered.length - 1) return;
    const timer = window.setTimeout(() => setStep((value) => Math.min(value + 1, ordered.length - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [ordered.length, step]);

  const current = ordered[Math.min(step, Math.max(0, ordered.length - 1))];
  const width = Math.max(1, ordered.length - 1);
  const rankDenominator = Math.max(1, maxRank - 1);

  if (!ordered.length || !teamRows.length) {
    return <section className="table-position-journey is-empty"><div className="table-position-journey-head"><div><span>POSITION REPLAY</span><h4>{title}</h4></div></div><p className="muted">{emptyLabel}</p></section>;
  }

  return (
    <section className={`table-position-journey${dense ? ' is-dense' : ''}`} aria-label={`${title} position journey`}>
      <div className="table-position-journey-head">
        <div><span>POSITION REPLAY</span><h4>{title}</h4></div>
        <div className="table-position-journey-now"><strong>{current?.gw ?? ordered[0].gw}</strong><small>{step >= ordered.length - 1 ? 'CURRENT POSITION' : 'REPLAYING'}</small><button type="button" onClick={() => setStep(0)} disabled={step === 0}>↻ Replay</button></div>
      </div>

      <div className="table-position-stage" style={{ '--journey-ranks': maxRank } as React.CSSProperties}>
        <div className="table-position-ranks" aria-hidden="true">
          {Array.from({ length: maxRank }, (_, index) => <span key={`rank-${index + 1}`} style={{ top: `${(index / rankDenominator) * 100}%` }}>#{index + 1}</span>)}
        </div>
        <div className="table-position-grid" aria-hidden="true">
          {Array.from({ length: maxRank }, (_, index) => <i key={`line-${index}`} style={{ top: `${(index / rankDenominator) * 100}%` }} />)}
          {ordered.map((snapshot, index) => <b key={snapshot.gw} style={{ left: `${(index / width) * 100}%` }}><em>{snapshot.gw}</em></b>)}
        </div>

        <svg className="table-position-trails" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          {teamRows.map((team) => {
            const points = ordered.slice(0, step + 1).map((snapshot, index) => {
              const row = rowForTeam(snapshot, team.teamId);
              if (!row) return null;
              const x = ordered.length === 1 ? 0 : (index / width) * 1000;
              const y = ((row.rank - 1) / rankDenominator) * 1000;
              return `${x},${y}`;
            }).filter((point): point is string => !!point).join(' ');
            if (!points.includes(' ')) return null;
            return <polyline key={`trail-${team.teamId}`} points={points} style={{ '--journey-team-color': team.ballColor ?? '#f6c743' } as React.CSSProperties} />;
          })}
        </svg>

        <div className="table-position-balls">
          {teamRows.map((team) => {
            const row = current ? rowForTeam(current, team.teamId) : undefined;
            const left = ordered.length === 1 ? 0 : (step / width) * 100;
            const top = row ? ((row.rank - 1) / rankDenominator) * 100 : 100;
            return <div key={team.teamId} className={`table-position-ball${row ? '' : ' is-away'}`} style={{ left: `${left}%`, top: `${top}%`, zIndex: row ? maxRank - row.rank + 2 : 1 }} title={row ? `${team.teamName} · ${current.gw} · #${row.rank}` : `${team.teamName} · not in this table at ${current?.gw ?? ''}`}>
              <TeamBadge name={team.teamName} ballColor={team.ballColor ?? null} ringColor={team.ringColor ?? null} textColor={team.textColor ?? null} size={dense ? 18 : 26} />
              {!dense && <span>{team.teamName}<b>#{row?.rank ?? '—'}</b></span>}
            </div>;
          })}
        </div>
      </div>
    </section>
  );
}
