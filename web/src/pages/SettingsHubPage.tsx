import { Link } from 'react-router-dom';

type ToolTile = { to: string; title: string; description: string; eyebrow: string; icon: string };

const toolTiles: ToolTile[] = [
  { to: '/insights', title: 'Gameweek Control Room', eyebrow: 'RUN THE SEASON', description: 'Lock, advance or rewind gameweeks, create fixtures, manage snapshots and resolve season admin.', icon: 'GW' },
  { to: '/entries', title: 'Manual Entry', eyebrow: 'RESULTS', description: 'Enter profit, spins, stake and notes quickly with the keyboard-first entry workflow.', icon: '＋' },
  { to: '/fixtures', title: 'Fixture Database', eyebrow: 'FIXTURES', description: 'Filter every competition, gameweek and team from one compact fixture database.', icon: '≡' },
  { to: '/cup-draw', title: 'Cup Draw', eyebrow: 'CUPS', description: 'Run and review BookieBall Cup draw operations.', icon: '🏆' },
  { to: '/penalty-shootout', title: 'Penalty Centre', eyebrow: 'TIEBREAKERS', description: 'Work through the live penalty queue or run one-off shoot-outs.', icon: '●' },
  { to: '/settings', title: 'Settings', eyebrow: 'SYSTEM', description: 'Competition configuration, season setup and lower-level administration.', icon: '⚙' },
];

export function SettingsHubPage() {
  return <section className="page page-dashboard tools-hub-page"><header className="tools-hub-head"><div><span>BOOKIEBALL OPERATIONS</span><h1>Tools</h1><p>Run BookieBall here. Analysis lives separately under Analytics.</p></div><Link className="secondary" to="/reports">Open Analytics</Link></header><div className="tools-hub-grid">{toolTiles.map((tile) => <Link key={tile.to} to={tile.to} className="tools-hub-tile"><span>{tile.eyebrow}</span><div className="tools-visual-icon" aria-hidden="true">{tile.icon}</div><h2>{tile.title}</h2><p>{tile.description}</p><b>Open →</b></Link>)}</div></section>;
}
