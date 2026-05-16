import { Link } from 'react-router-dom';

type MainTile = {
  to: string;
  title: string;
  description: string;
};

const mainTiles: MainTile[] = [
  {
    to: '/leagues',
    title: 'Leagues',
    description: 'Divisions, Master League, Trio League, Tier League, and All-Time Leagues.',
  },
  {
    to: '/cups',
    title: 'Cups',
    description: 'Super Cup, BookieBall Cup, and Master Cup competition hubs.',
  },
  {
    to: '/fixtures',
    title: 'All Fixtures',
    description: 'Every available league and cup fixture with team, competition, and gameweek drill-down filters.',
  },
  {
    to: '/reports',
    title: 'Interactive Analytics Hub',
    description: 'Simplified reporting, snapshots, comparisons, and data-first season views.',
  },
  {
    to: '/gameshow',
    title: 'Kick-Off Show',
    description: 'Predictions, studio packages, odds boards, and pre-show rundown.',
  },
  {
    to: '/settings-hub',
    title: 'Settings',
    description: 'Admin controls, fixture generation, and penalty tools.',
  },
  {
    to: '/trophy-room',
    title: 'Trophy Room',
    description: 'Winners archive for live trophies and the home of Bookie d’Or.',
  },
  {
    to: '/entries',
    title: 'Manual Entry',
    description: 'Add and edit gameweek entries manually across all teams.',
  },
];

export function HomePage() {
  return (
    <section className="page page-dashboard">
      <h1>bookieball Dashboard</h1>
      <p className="muted">Main areas for leagues, cups, analytics, settings, archive, and manual updates.</p>

      <div className="tile-grid tile-grid-secondary">
        {mainTiles.map((tile) => (
          <Link key={tile.to} to={tile.to} className="tile">
            <h2>{tile.title}</h2>
            <p>{tile.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
