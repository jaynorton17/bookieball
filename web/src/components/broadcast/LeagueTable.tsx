import type { PanelTone, TeamPalette } from '../../lib/broadcastTheme';
import { BroadcastPanel } from './BroadcastPanel';
import { TeamOrb } from './TeamOrb';
import { formatSigned } from '../../lib/finaleHelpers';

type TitleRaceRow = {
  teamId: number | null;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  profit: number;
  points: number;
  status: 'champion' | 'playoff' | 'danger' | 'steady';
  palette: TeamPalette;
};

export function LeagueTable({
  title,
  rows,
}: {
  title: string;
  rows: TitleRaceRow[];
}) {
  return (
    <BroadcastPanel title={title} subtitle="Final Standings" accent="blue" style={{ minHeight: '100%' }}>
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.4fr repeat(6, minmax(42px, 0.6fr))',
            gap: '0.35rem',
            padding: '0 0.6rem',
            color: 'rgba(223,236,255,0.62)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            fontWeight: 800,
            fontSize: '0.65rem',
          }}
        >
          <span>Club</span>
          <span>P</span>
          <span>W</span>
          <span>D</span>
          <span>L</span>
          <span>Profit</span>
          <span>Pts</span>
        </div>

        {rows.map((row, index) => {
          const rowAccent =
            row.status === 'champion'
              ? 'linear-gradient(180deg, rgba(249,221,145,0.16), rgba(121,78,18,0.12))'
              : row.status === 'playoff'
                ? 'linear-gradient(180deg, rgba(105,162,255,0.14), rgba(18,64,138,0.1))'
                : row.status === 'danger'
                  ? 'linear-gradient(180deg, rgba(233,100,92,0.14), rgba(97,18,24,0.1))'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))';

          const chipLabel =
            row.status === 'champion'
              ? 'Champion'
              : row.status === 'playoff'
                ? 'Playoff'
                : row.status === 'danger'
                  ? 'Danger'
                  : null;

          return (
            <div
              key={`${row.teamName}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '2.4fr repeat(6, minmax(42px, 0.6fr))',
                gap: '0.35rem',
                alignItems: 'center',
                padding: '0.62rem 0.7rem',
                borderRadius: '14px',
                border: `1px solid ${row.status === 'champion' ? 'rgba(249,221,145,0.12)' : 'rgba(255,255,255,0.06)'}`,
                background: rowAccent,
                backdropFilter: row.status === 'champion' ? 'blur(4px)' : undefined,
                boxShadow:
                  row.status === 'champion'
                    ? 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 18px rgba(0,0,0,0.14)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                <span
                  style={{
                    width: '22px',
                    color: row.status === 'champion' ? '#f9d673' : 'rgba(235,243,255,0.7)',
                    fontWeight: 900,
                    fontSize: '0.82rem',
                    textAlign: 'center',
                  }}
                >
                  {index + 1}
                </span>
                <TeamOrb name={row.teamName} palette={row.palette} size={34} champion={row.status === 'champion'} />
                <div style={{ minWidth: 0, display: 'grid', gap: '0.15rem' }}>
                  <strong
                    style={{
                      color: '#f8fbff',
                      fontSize: '0.88rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.teamName}
                  </strong>
                  {chipLabel ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        width: 'fit-content',
                        padding: '0.1rem 0.38rem',
                        borderRadius: '999px',
                        fontSize: '0.58rem',
                        fontWeight: 900,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color:
                          row.status === 'champion'
                            ? '#1a1504'
                            : row.status === 'playoff'
                              ? '#edf6ff'
                              : '#fff3f2',
                        background:
                          row.status === 'champion'
                            ? 'linear-gradient(180deg, #f4dc92, #d49d31)'
                            : row.status === 'playoff'
                              ? 'linear-gradient(180deg, #6caaff, #2159b5)'
                              : 'linear-gradient(180deg, #ef7469, #8e1d21)',
                      }}
                    >
                      {chipLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <span style={{ color: '#f8fbff', fontWeight: 800, fontSize: '0.88rem' }}>{row.played}</span>
              <span style={{ color: '#f8fbff', fontWeight: 800, fontSize: '0.88rem' }}>{row.wins}</span>
              <span style={{ color: '#f8fbff', fontWeight: 800, fontSize: '0.88rem' }}>{row.draws}</span>
              <span style={{ color: '#f8fbff', fontWeight: 800, fontSize: '0.88rem' }}>{row.losses}</span>
              <span style={{ color: '#f6e6aa', fontWeight: 900, fontSize: '0.88rem' }}>{formatSigned(row.profit)}</span>
              <span style={{ color: '#f8fbff', fontWeight: 950, fontSize: '1rem' }}>{row.points}</span>
            </div>
          );
        })}
      </div>
    </BroadcastPanel>
  );
}
