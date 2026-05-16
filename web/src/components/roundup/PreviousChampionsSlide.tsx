import { useMemo } from 'react';
import type { PreviousChampionRow } from './roundupTypes';

type PreviousChampionsSlideProps = {
  rows: PreviousChampionRow[];
};

const DIVISION_ORDER = [
  'Champions Division',
  'Premier Division',
  'Division One',
  'Division Two',
  'Division Three',
  'Division Four',
];

function parseSeasonNumber(value: string): number | null {
  const match = value.match(/(\d+)/);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function seasonLabel(value: string): string {
  const number = parseSeasonNumber(value);
  if (number === null) {
    return value;
  }
  return `Season ${number}`;
}

function formatSigned(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? '+' : '';
  return `${sign}${safe.toFixed(2)}`;
}

export function PreviousChampionsSlide({ rows }: PreviousChampionsSlideProps) {
  const groupedRows = useMemo(() => {
    const rowsByDivision = new Map<string, PreviousChampionRow[]>();
    rows.forEach((row) => {
      const divisionRows = rowsByDivision.get(row.division) ?? [];
      divisionRows.push(row);
      rowsByDivision.set(row.division, divisionRows);
    });

    const orderedDivisions = [
      ...DIVISION_ORDER.filter((division) => rowsByDivision.has(division)),
      ...Array.from(rowsByDivision.keys())
        .filter((division) => !DIVISION_ORDER.includes(division))
        .sort((left, right) => left.localeCompare(right)),
    ];

    return orderedDivisions.map((division) => {
      const divisionRows = rowsByDivision.get(division) ?? [];
      const sortedRows = divisionRows.slice().sort((left, right) => {
        const leftSeason = parseSeasonNumber(left.season);
        const rightSeason = parseSeasonNumber(right.season);
        if (leftSeason !== null && rightSeason !== null && leftSeason !== rightSeason) {
          return leftSeason - rightSeason;
        }
        return left.season.localeCompare(right.season);
      });
      return {
        division,
        rows: sortedRows,
      };
    });
  }, [rows]);

  return (
    <section className="roundup-previous-champions" aria-label="Previous champions">
      <p className="roundup-kicker">Division Tables Roundup</p>
      <h2>Previous Champions</h2>

      {rows.length === 0 ? (
        <p className="roundup-empty-copy">No previous champions data available yet.</p>
      ) : (
        <div className="roundup-previous-grid">
          {groupedRows.map((group) => (
            <article key={group.division}>
              <header>
                <h3>{group.division}</h3>
                <p>{group.rows.length} seasons</p>
              </header>
              <ul className="roundup-previous-list">
                {group.rows.map((row) => (
                  <li key={`${group.division}-${row.season}-${row.teamName}`}>
                    <strong>{seasonLabel(row.season)} • {row.teamName}</strong>
                    <em>{formatSigned(row.profit)} profit • {row.wins}W {row.draws}D {row.losses}L • {row.points} pts</em>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
