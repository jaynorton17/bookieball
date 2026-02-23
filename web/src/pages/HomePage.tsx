import { Link } from 'react-router-dom';

type DashboardTile = {
  to: string;
  title: string;
  description: string;
  className?: string;
};

const dashboardTiles: DashboardTile[] = [
  {
    to: '/insights',
    title: 'Insights & Tools',
    description: 'Operational links for recap and management workflows.',
    className: 'tile-league',
  },
  {
    to: '/matchday',
    title: 'Matchday Wall',
    description: 'Live gameweek wall: shocks, streaks, spotlight fixtures, and highlight reel.',
    className: 'tile-league',
  },
  {
    to: '/reporting',
    title: 'Reporting Desk',
    description: 'Storylines, rivalry desk, snapshot compare, and downloadable report packs.',
    className: 'tile-league',
  },
  {
    to: '/entries',
    title: 'Entry Manager',
    description: 'Manual add, edit, and review every entry across gameweeks.',
  },
  {
    to: '/trophy-room',
    title: 'Trophy Room',
    description: 'Cup and division winners by season.',
  },
  {
    to: '/season-finale',
    title: 'End of Season Presentation',
    description: 'Finale showcase: awards, promotions, relegations, and standout moments.',
  },
];

export function HomePage() {
  return (
    <section className="page">
      <h1>Welcome to bookieball</h1>
      <p className="muted">Run your local league + cup gameshow from GW1 to GW8.</p>

      <div className="dashboard-launch-grid">
        <div className="tile-grid tile-grid-secondary">
          <Link to="/sky-sports-news" className="tile tile-featured tile-league">
            <h2>Sky Sports News Live</h2>
            <p>Always-on studio desk for team spotlights, fixtures, rivalry notes, and ticker updates.</p>
          </Link>
          <Link to="/gameshow" className="tile tile-featured tile-league">
            <h2>Kick-Off Show</h2>
            <p>Run the full show flow: draw, pick logging, studio broadcast, and recap.</p>
          </Link>
          <Link to="/leagues" className="tile tile-featured tile-league">
            <h2>Leagues Hub</h2>
            <p>All league views in one place: divisions, master league, and all-time boards.</p>
          </Link>
          <Link to="/cup-draw" className="tile tile-featured">
            <h2>Bookie Cup</h2>
            <p>Cup draw, bracket progression, knockout winners, and integrity checks.</p>
          </Link>
          {dashboardTiles.map((tile) => (
            <Link key={tile.to} to={tile.to} className={`tile${tile.className ? ` ${tile.className}` : ''}`}>
              <h2>{tile.title}</h2>
              <p>{tile.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
