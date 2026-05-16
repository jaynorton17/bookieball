import { Link } from 'react-router-dom';

type CompetitionTab = {
  id: string;
  label: string;
  to: string;
};

type CompetitionTabsProps = {
  tabs: CompetitionTab[];
  activeId: string;
  ariaLabel: string;
};

const LEAGUE_TABS: CompetitionTab[] = [
  { id: 'divisions', label: 'Divisions', to: '/league' },
  { id: 'master', label: 'Master League', to: '/master-league' },
  { id: 'trio', label: 'Trio League', to: '/trio-league' },
  { id: 'tier', label: 'Tier League', to: '/tier-league' },
  { id: 'all-time', label: 'All-Time Leagues', to: '/all-time-league' },
];

const CUP_TABS: CompetitionTab[] = [
  { id: 'super-cup', label: 'Super Cup', to: '/super-cup' },
  { id: 'bookieball-cup', label: 'BookieBall Cup', to: '/cup-draw' },
  { id: 'master-cup', label: 'Master Cup', to: '/master-cup' },
];

function CompetitionTabs({ tabs, activeId, ariaLabel }: CompetitionTabsProps) {
  return (
    <nav className="tab-row" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <Link key={tab.id} to={tab.to} className={`tab-button ${activeId === tab.id ? 'active' : ''}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

type LeagueTabsProps = {
  activeId: 'divisions' | 'master' | 'trio' | 'tier' | 'all-time';
};

export function LeagueTabs({ activeId }: LeagueTabsProps) {
  return <CompetitionTabs tabs={LEAGUE_TABS} activeId={activeId} ariaLabel="League sections" />;
}

type CupTabsProps = {
  activeId: 'super-cup' | 'bookieball-cup' | 'master-cup';
};

export function CupTabs({ activeId }: CupTabsProps) {
  return <CompetitionTabs tabs={CUP_TABS} activeId={activeId} ariaLabel="Cup sections" />;
}
