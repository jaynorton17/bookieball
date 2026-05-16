import { TeamBadge } from '../TeamBadge';
import type { DivisionRoundupData } from './roundupTypes';

type DivisionLiveTableProps = {
  division: DivisionRoundupData;
};

export function DivisionLiveTable({ division }: DivisionLiveTableProps) {
  const orderedRows = division.tableRows
    .slice()
    .sort((left, right) => left.rank - right.rank)
    .slice(0, 4);
  const fullRows = division.tableRows
    .slice()
    .sort((left, right) => left.rank - right.rank);
  const leader = fullRows[0] ?? null;
  const runnerUp = fullRows[1] ?? null;
  const bottom = fullRows[fullRows.length - 1] ?? null;
  const profitLeader = fullRows
    .slice()
    .sort((left, right) => right.profit - left.profit || right.points - left.points)[0] ?? null;

  return (
    <aside className="roundup-live-table" aria-label={`${division.title} live table`}>
      <header>
        <p className="roundup-kicker">Live Table</p>
        <h3>{division.title}</h3>
      </header>

      {orderedRows.length === 0 ? (
        <p className="roundup-empty-copy">No live table rows available.</p>
      ) : (
        <>
          <table>
            <colgroup>
              <col className="roundup-col-pos" />
              <col className="roundup-col-team" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-spins" />
              <col className="roundup-col-profit" />
            </colgroup>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Team</th>
                <th>PLD</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>Pts</th>
                <th>Spins</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {orderedRows.map((row) => (
                <tr key={`table-${division.key}-${row.teamId}`}>
                  <td>{row.rank}</td>
                  <td>
                    <span className="roundup-team-cell">
                      <TeamBadge
                        name={row.teamName}
                        ballColor={row.ballColor}
                        ringColor={row.ringColor}
                        textColor={row.textColor}
                        size={22}
                      />
                      <span>{row.teamName}</span>
                    </span>
                  </td>
                  <td>{row.played}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{row.draws}</td>
                  <td>{row.points}</td>
                  <td>{row.spins}</td>
                  <td>{row.profit.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="roundup-live-table-summary">
            {leader ? (
              <article>
                <span>{division.isSeasonComplete ? 'Winner' : 'Leader'}</span>
                <strong>{leader.teamName}</strong>
                <small>{leader.points} pts • {leader.profit.toFixed(2)} profit</small>
              </article>
            ) : null}
            {runnerUp ? (
              <article>
                <span>{division.isSeasonComplete ? 'Runner-Up' : 'Second'}</span>
                <strong>{runnerUp.teamName}</strong>
                <small>{runnerUp.points} pts • PLD {runnerUp.played}</small>
              </article>
            ) : null}
            {profitLeader ? (
              <article>
                <span>Best Profit</span>
                <strong>{profitLeader.teamName}</strong>
                <small>{profitLeader.profit.toFixed(2)} profit • {profitLeader.spins} spins</small>
              </article>
            ) : null}
            {bottom ? (
              <article>
                <span>{division.isSeasonComplete ? 'Bottom' : 'Under Pressure'}</span>
                <strong>{bottom.teamName}</strong>
                <small>{bottom.points} pts • PLD {bottom.played}</small>
              </article>
            ) : null}
          </div>
        </>
      )}
    </aside>
  );
}
