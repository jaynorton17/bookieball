import { Link } from 'react-router-dom';

type LeagueTile = { to: string; eyebrow: string; badge: string; title: string; description: string; tone: 'league' | 'format' | 'archive'; icon: string };

const leagueTiles: LeagueTile[] = [
  { to: '/league', eyebrow: 'Core Ladder', badge: 'Official', title: 'Divisions', description: 'Division tables, form, and playoffs.', tone: 'league', icon: '⇅' },
  { to: '/master-league', eyebrow: 'Full Field', badge: '24 clubs', title: 'Master League', description: 'Single-table race across all teams.', tone: 'format', icon: '24' },
  { to: '/trio-league', eyebrow: 'Promotion Race', badge: '3 tiers', title: 'Trio Leagues', description: 'Three-tier structure with promotion playoffs.', tone: 'format', icon: '△' },
  { to: '/tier-league', eyebrow: 'Promotion Pyramid', badge: '8 tiers', title: 'Tier League', description: 'Eight three-team divisions with cross-tier clashes.', tone: 'format', icon: '▴' },
  { to: '/all-time-league', eyebrow: 'Archive Board', badge: 'History', title: 'All Time Leagues', description: 'Points, spins, and profit archives.', tone: 'archive', icon: '🏆' },
];

export function LeaguesHubPage() {
  return <section className="page page-dashboard leagues-visual-hub"><h1>Leagues</h1><div className="hub-showcase-card-grid" style={{ marginTop: '1.2rem' }}>{leagueTiles.map((tile) => <Link key={tile.to} to={tile.to} className={`hub-showcase-card hub-showcase-card-${tile.tone}`}><div className="hub-showcase-card-head"><span className="hub-showcase-card-kicker">{tile.eyebrow}</span><span className="hub-showcase-card-badge">{tile.badge}</span></div><div className="hub-visual-icon" aria-hidden="true">{tile.icon}</div><h2>{tile.title}</h2><p>{tile.description}</p><div className="hub-showcase-card-footer"><strong className="hub-showcase-card-action">Open</strong></div></Link>)}</div></section>;
}
