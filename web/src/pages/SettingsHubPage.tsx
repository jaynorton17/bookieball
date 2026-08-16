import { Link } from 'react-router-dom';

type SettingsTile = {
  to: string;
  title: string;
  description: string;
};

const settingsTiles: SettingsTile[] = [
  {
    to: '/settings',
    title: 'Settings',
    description: 'Fixture generation, season tools, and admin controls.',
  },
  {
    to: '/penalty-shootout',
    title: 'Penalty Shootout',
    description: 'Run manual shoot-outs and one-off penalties.',
  },
];

export function SettingsHubPage() {
  return (
    <section className="page page-dashboard">
      <h1>Settings</h1>

      <div className="tile-grid tile-grid-secondary">
        {settingsTiles.map((tile) => (
          <Link key={tile.to} to={tile.to} className="tile">
            <h2>{tile.title}</h2>
            <p>{tile.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
