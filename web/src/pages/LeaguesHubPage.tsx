import { Link } from 'react-router-dom';

type LeagueTile = {
  to: string;
  title: string;
  description: string;
};

const leagueTiles: LeagueTile[] = [
  {
    to: '/league',
    title: 'Division League Tables',
    description: 'Live division standings, pressure lines, and race context.',
  },
  {
    to: '/master-league',
    title: 'Master League',
    description: 'Single-table view across all teams with fixtures and movement.',
  },
  {
    to: '/all-time-league',
    title: 'All-Time League',
    description: 'Cumulative points table from S1 GW1 to the current gameweek.',
  },
  {
    to: '/all-time-spins-league',
    title: 'All-Time Spins League',
    description: 'Teams ranked by total spins across all division fixtures.',
  },
  {
    to: '/all-time-profit-league',
    title: 'All-Time Profit League',
    description: 'Teams ranked by cumulative league profit across seasons.',
  },
];

export function LeaguesHubPage() {
  return (
    <section className="page">
      <h1>Leagues Hub</h1>
      <p className="muted">All league standings screens grouped in one place.</p>

      <div className="tile-grid tile-grid-secondary">
        {leagueTiles.map((tile) => (
          <Link key={tile.to} to={tile.to} className="tile tile-league">
            <h2>{tile.title}</h2>
            <p>{tile.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
