import { Link } from 'react-router-dom';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';

type CupTile = {
  to: string;
  eyebrow: string;
  badge: string;
  title: string;
  description: string;
  tone: 'cup' | 'showcase' | 'elite';
  trophy: 'cup' | 'super' | 'master';
};

const cupTiles: CupTile[] = [
  {
    to: '/super-cup',
    eyebrow: 'Curtain Raiser',
    badge: 'GW1',
    title: 'Super Cup',
    description: 'Season opener between last season\'s cup finalists.',
    tone: 'showcase',
    trophy: 'super',
  },
  {
    to: '/cup-draw',
    eyebrow: 'Main Knockout',
    badge: '32 slots',
    title: 'BookieBall Cup',
    description: 'Manual draw, bracket tracking, and round management.',
    tone: 'cup',
    trophy: 'cup',
  },
  {
    to: '/master-cup',
    eyebrow: 'Seeded Knockout',
    badge: 'Top 16',
    title: 'Master Cup',
    description: 'Top-16 seeded knockout with full bracket.',
    tone: 'elite',
    trophy: 'master',
  },
];

export function CupsHubPage() {
  return (
    <section className="page page-dashboard">
      <h1>Cups</h1>
      <div className="hub-showcase-card-grid" style={{ marginTop: '1.2rem' }}>
        {cupTiles.map((tile) => (
          <Link key={tile.to} to={tile.to} className={`hub-showcase-card hub-showcase-card-${tile.tone}`}>
            <div className="hub-showcase-card-head">
              <span className="hub-showcase-card-kicker">{tile.eyebrow}</span>
              <span className="hub-showcase-card-badge">{tile.badge}</span>
            </div>
            <CompetitionTrophyMark variant={tile.trophy} className="hub-showcase-card-trophy" />
            <h2>{tile.title}</h2>
            <p>{tile.description}</p>
            <div className="hub-showcase-card-footer">
              <strong className="hub-showcase-card-action">Open</strong>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
