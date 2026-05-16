import { Link } from 'react-router-dom';

type LeagueTile = {
  to: string;
  eyebrow: string;
  badge: string;
  title: string;
  description: string;
  detail: string;
  tone: 'league' | 'format' | 'archive';
};

const leagueTiles: LeagueTile[] = [
  {
    to: '/league',
    eyebrow: 'Core Ladder',
    badge: 'Official',
    title: 'Divisions',
    description: 'Official division tables, form, fixtures, playoffs, and friendlies.',
    detail: 'Main pyramid with promotion, relegation, and weekly standings.',
    tone: 'league',
  },
  {
    to: '/master-league',
    eyebrow: 'Full Field',
    badge: '24 clubs',
    title: 'Master League',
    description: 'Single-table standings across all teams plus the master season board.',
    detail: 'One-table race across the whole field with season-long movement.',
    tone: 'format',
  },
  {
    to: '/trio-league',
    eyebrow: 'Expansion Format',
    badge: '3 tiers',
    title: 'Trio Leagues',
    description: 'Three-tier structure with regular weeks and promotion playoffs.',
    detail: 'Premier League, Ligue 1, and Bundesliga with playoff promotion.',
    tone: 'format',
  },
  {
    to: '/tier-league',
    eyebrow: 'Expansion Format',
    badge: '8 tiers',
    title: 'Tier League',
    description: 'Eight divisions of three with cross-tier clashes and end-of-season movement.',
    detail: 'Legendary down to Awful with cross-tier fixtures each round.',
    tone: 'format',
  },
  {
    to: '/all-time-league',
    eyebrow: 'Archive Board',
    badge: 'History',
    title: 'All Time Leagues',
    description: 'Points, spins, and profit archives with the all-time tabs.',
    detail: 'Long-run standings across seasons, gameweeks, profit, and spins.',
    tone: 'archive',
  },
];

const leagueHighlights = [
  {
    label: 'Boards',
    value: '5',
    detail: 'Divisions, Master, Trio, Tier, and All-Time in one launch point.',
  },
  {
    label: 'Expansion Modes',
    value: '2',
    detail: 'Trio and Tier formats now sit alongside the core divisions.',
  },
  {
    label: 'Archive View',
    value: 'Full',
    detail: 'Historical context stays in the same visual family as live tables.',
  },
] as const;

export function LeaguesHubPage() {
  return (
    <section className="page page-dashboard">
      <div className="hub-showcase">
        <div className="hub-showcase-hero hub-showcase-hero-leagues">
          <div className="hub-showcase-hero-head">
            <div className="hub-showcase-hero-copy">
              <span className="hub-showcase-kicker">Interactive League Hub</span>
              <h1>Independent Leagues</h1>
              <p>
                Every standalone league board now launches from the same broadcast-style shell:
                the core pyramid, the all-team master table, the Trio ladder, the Tier ladder,
                and the long-run archive.
              </p>
            </div>
          </div>

          <div className="hub-showcase-meta-grid">
            {leagueHighlights.map((item) => (
              <article key={item.label} className="hub-showcase-meta-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="hub-showcase-card-grid">
          {leagueTiles.map((tile) => (
            <Link key={tile.to} to={tile.to} className={`hub-showcase-card hub-showcase-card-${tile.tone}`}>
              <div className="hub-showcase-card-head">
                <span className="hub-showcase-card-kicker">{tile.eyebrow}</span>
                <span className="hub-showcase-card-badge">{tile.badge}</span>
              </div>
              <h2>{tile.title}</h2>
              <p>{tile.description}</p>
              <div className="hub-showcase-card-footer">
                <span className="hub-showcase-card-meta">{tile.detail}</span>
                <strong className="hub-showcase-card-action">Open Board</strong>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </section>
  );
}
