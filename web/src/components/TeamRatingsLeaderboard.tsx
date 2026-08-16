import { useState, useMemo } from 'react';

type RatingRow = {
  teamId: number;
  teamName: string;
  entries: number;
  wins: number;
  profit: number;
  avgProfit: number;
  winRate: number;
  rating: number;
};

type TeamRatingsLeaderboardProps = {
  ratings: RatingRow[];
};

type SortKey = 'rank' | 'teamName' | 'rating' | 'winRate' | 'profit' | 'avgProfit' | 'entries';
type SortOrder = 'asc' | 'desc';

export function TeamRatingsLeaderboard({ ratings }: TeamRatingsLeaderboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rating');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pre-sort by rating desc to compute rank
  const rankedRatings = useMemo(() => {
    return [...ratings]
      .sort((a, b) => b.rating - a.rating)
      .map((row, idx) => ({
        ...row,
        rank: idx + 1,
      }));
  }, [ratings]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc'); // Default to descending
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = rankedRatings.filter((row) =>
      row.teamName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [rankedRatings, searchQuery, sortKey, sortOrder]);

  const ratingClass = (rating: number): string => {
    if (rating >= 0.5) return 'rating-elite';
    if (rating >= 0) return 'rating-positive';
    if (rating >= -0.5) return 'rating-neutral';
    return 'rating-danger';
  };

  return (
    <div className="ratings-leaderboard-container">
      <div className="ratings-leaderboard-header">
        <div className="ratings-title-block">
          <h4>Global Team Power Ratings</h4>
          <p className="muted small">
            Calculated using weighted Z-scores of total profit (60%), win rate (30%), and average profit per entry (10%).
          </p>
        </div>
        <div className="ratings-search">
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ratings-search-input"
          />
        </div>
      </div>

      <div className="table-scroll">
        <table className="ratings-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('rank')} className="clickable text-center">
                Rank {sortKey === 'rank' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('teamName')} className="clickable text-left">
                Team {sortKey === 'teamName' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('rating')} className="clickable text-center">
                Power Rating {sortKey === 'rating' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('winRate')} className="clickable text-center">
                Win Rate {sortKey === 'winRate' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('profit')} className="clickable text-right">
                Total Profit {sortKey === 'profit' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('avgProfit')} className="clickable text-right">
                Avg Profit {sortKey === 'avgProfit' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('entries')} className="clickable text-center">
                Spins {sortKey === 'entries' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center muted py-4">
                  No matching teams found.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((row) => (
                <tr key={row.teamId} className="rating-row">
                  <td className="text-center font-bold">#{row.rank}</td>
                  <td className="font-medium text-left">{row.teamName}</td>
                  <td className="text-center">
                    <span className={`rating-badge ${ratingClass(row.rating)}`}>
                      {row.rating >= 0 ? `+${row.rating.toFixed(3)}` : row.rating.toFixed(3)}
                    </span>
                  </td>
                  <td className="text-center font-mono">{(row.winRate * 100).toFixed(1)}%</td>
                  <td className={`text-right font-mono ${row.profit >= 0 ? 'text-profit-pos' : 'text-profit-neg'}`}>
                    {row.profit >= 0 ? `+£${row.profit.toFixed(2)}` : `-£${Math.abs(row.profit).toFixed(2)}`}
                  </td>
                  <td className={`text-right font-mono ${row.avgProfit >= 0 ? 'text-profit-pos' : 'text-profit-neg'}`}>
                    {row.avgProfit >= 0 ? `+£${row.avgProfit.toFixed(2)}` : `-£${Math.abs(row.avgProfit).toFixed(2)}`}
                  </td>
                  <td className="text-center font-mono">{row.entries}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
