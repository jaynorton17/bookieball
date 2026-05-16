import { Link } from 'react-router-dom';

type CupTile = {
  to: string;
  eyebrow: string;
  badge: string;
  title: string;
  description: string;
  detail: string;
  tone: 'cup' | 'showcase' | 'elite';
};

const cupTiles: CupTile[] = [
  {
    to: '/super-cup',
    eyebrow: 'Curtain Raiser',
    badge: 'GW1',
    title: 'Super Cup',
    description: 'Standalone GW1 curtain-raiser between the previous season\'s cup standard-bearers.',
    detail: 'Season opener built from the prior year\'s BookieBall Cup and Master Cup finalists.',
    tone: 'showcase',
  },
  {
    to: '/cup-draw',
    eyebrow: 'Main Knockout',
    badge: '32 slots',
    title: 'BookieBall Cup',
    description: 'Manual draw, rounds, bracket, and Bookie Ball Cup tracking.',
    detail: 'Draw studio, round management, and full winner-path control.',
    tone: 'cup',
  },
  {
    to: '/master-cup',
    eyebrow: 'Seeded Knockout',
    badge: 'Top 16',
    title: 'Master Cup',
    description: 'Top-16 seeded knockout with round-of-16, quarter-finals, semis, third place, and final.',
    detail: 'Seed-based bracket with a third-place playoff and a dedicated final path.',
    tone: 'elite',
  },
];

const cupHighlights = [
  {
    label: 'Competitions',
    value: '3',
    detail: 'Super Cup, BookieBall Cup, and Master Cup share one launch deck.',
  },
  {
    label: 'Bracket Styles',
    value: '2',
    detail: 'One open draw and one seeded knockout sit side by side.',
  },
  {
    label: 'Opening Night',
    value: 'Live',
    detail: 'The Super Cup keeps the season opener in the same visual system.',
  },
] as const;

export function CupsHubPage() {
  return (
    <section className="page page-dashboard">
      <div className="hub-showcase">
        <div className="hub-showcase-hero hub-showcase-hero-cups">
          <div className="hub-showcase-hero-head">
            <div className="hub-showcase-hero-copy">
              <span className="hub-showcase-kicker">Interactive Cup Hub</span>
              <h1>Cup Competitions</h1>
              <p>
                The cup side of bookieball now opens through the same polished launch treatment:
                season opener, main knockout, and seeded elite bracket all framed like one family.
              </p>
            </div>
          </div>

          <div className="hub-showcase-meta-grid">
            {cupHighlights.map((item) => (
              <article key={item.label} className="hub-showcase-meta-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="hub-showcase-card-grid">
          {cupTiles.map((tile) => (
            <Link key={tile.to} to={tile.to} className={`hub-showcase-card hub-showcase-card-${tile.tone}`}>
              <div className="hub-showcase-card-head">
                <span className="hub-showcase-card-kicker">{tile.eyebrow}</span>
                <span className="hub-showcase-card-badge">{tile.badge}</span>
              </div>
              <h2>{tile.title}</h2>
              <p>{tile.description}</p>
              <div className="hub-showcase-card-footer">
                <span className="hub-showcase-card-meta">{tile.detail}</span>
                <strong className="hub-showcase-card-action">Open Cup</strong>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </section>
  );
}
