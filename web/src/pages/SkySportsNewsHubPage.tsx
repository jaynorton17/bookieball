import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  DivisionKey,
  RoundupCupSegment,
  RoundupLeagueSegment,
  RoundupPrimarySegment,
  RoundupSpotlightSegment,
} from '../components/roundup/roundupTypes';

type LeagueAction = {
  label: string;
  league: RoundupLeagueSegment;
  division?: 'all' | DivisionKey;
};

type CupAction = {
  label: string;
  cup: RoundupCupSegment;
};

type SpotlightAction = {
  label: string;
  spotlight: RoundupSpotlightSegment;
};

const topLevelActions: Array<{ key: RoundupPrimarySegment; label: string; description: string }> = [
  { key: 'full', label: 'Whole Show', description: 'Play the complete Sky Sports News rundown.' },
  { key: 'leagues', label: 'Leagues', description: 'Divisions, Master League, Trio Leagues, and all-time tables.' },
  { key: 'cups', label: 'Cups', description: 'Super Cup curtain-raiser plus BookieBall Cup and Master Cup coverage.' },
  { key: 'spotlights', label: 'Spotlights', description: 'Team feature slides and spotlight packages.' },
];

const leagueActions: LeagueAction[] = [
  { label: 'Play All Leagues', league: 'all' },
  { label: 'Play All Divisions', league: 'divisions', division: 'all' },
  { label: 'Play Champions', league: 'divisions', division: 'champions' },
  { label: 'Play Premier', league: 'divisions', division: 'premier' },
  { label: 'Play Division 1', league: 'divisions', division: 'division-one' },
  { label: 'Play Division 2', league: 'divisions', division: 'division-two' },
  { label: 'Play Division 3', league: 'divisions', division: 'division-three' },
  { label: 'Play Division 4', league: 'divisions', division: 'division-four' },
  { label: 'Play Master League', league: 'master' },
  { label: 'Play Trio Leagues', league: 'trio' },
  { label: 'Play All-Time', league: 'all-time' },
];

const cupActions: CupAction[] = [
  { label: 'Play All Cups', cup: 'all' },
  { label: 'Play Super Cup', cup: 'super-cup' },
  { label: 'Play BookieBall Cup', cup: 'bookieball' },
  { label: 'Play Master Cup', cup: 'master-cup' },
];

const spotlightActions: SpotlightAction[] = [
  { label: 'Play All Spotlights', spotlight: 'all' },
  { label: 'Play Champions Spotlight', spotlight: 'champions' },
  { label: 'Play Premier Spotlight', spotlight: 'premier' },
  { label: 'Play Division 1 Spotlight', spotlight: 'division-one' },
  { label: 'Play Division 2 Spotlight', spotlight: 'division-two' },
  { label: 'Play Division 3 Spotlight', spotlight: 'division-three' },
  { label: 'Play Division 4 Spotlight', spotlight: 'division-four' },
];

function buildShowLink(args: {
  primary: RoundupPrimarySegment;
  league?: RoundupLeagueSegment;
  division?: 'all' | DivisionKey;
  cup?: RoundupCupSegment;
  spotlight?: RoundupSpotlightSegment;
}): string {
  const params = new URLSearchParams();
  if (args.primary !== 'full') {
    params.set('primary', args.primary);
  }
  if (args.league && args.league !== 'all') {
    params.set('league', args.league);
  } else if (args.primary === 'leagues') {
    params.set('league', 'all');
  }
  if (args.division && args.division !== 'all') {
    params.set('division', args.division);
  }
  if (args.cup && args.cup !== 'all') {
    params.set('cup', args.cup);
  } else if (args.primary === 'cups') {
    params.set('cup', 'all');
  }
  if (args.spotlight && args.spotlight !== 'all') {
    params.set('spotlight', args.spotlight);
  } else if (args.primary === 'spotlights') {
    params.set('spotlight', 'all');
  }
  const query = params.toString();
  return query ? `/sky-sports-news/show?${query}` : '/sky-sports-news/show';
}

export function SkySportsNewsHubPage() {
  const [activePrimary, setActivePrimary] = useState<RoundupPrimarySegment>('full');

  const actionLinks = useMemo(() => {
    if (activePrimary === 'full') {
      return [
        {
          label: 'Play Whole Show',
          to: buildShowLink({ primary: 'full' }),
          description: 'Run the full uninterrupted studio show.',
        },
      ];
    }
    if (activePrimary === 'leagues') {
      return leagueActions.map((action) => ({
        label: action.label,
        to: buildShowLink({ primary: 'leagues', league: action.league, division: action.division }),
        description: action.league === 'divisions'
          ? 'Division-only rundown with no cups or spotlights mixed in.'
          : 'Jump straight into the selected league segment.',
      }));
    }
    if (activePrimary === 'cups') {
      return cupActions.map((action) => ({
        label: action.label,
        to: buildShowLink({ primary: 'cups', cup: action.cup }),
        description: 'Bracket-led cup coverage only.',
      }));
    }
    return spotlightActions.map((action) => ({
      label: action.label,
      to: buildShowLink({ primary: 'spotlights', spotlight: action.spotlight }),
      description: 'Spotlight packages only.',
    }));
  }, [activePrimary]);

  return (
    <section className="page page-dashboard ssn-panel-page">
      <header className="ssn-panel-hero">
        <p className="roundup-kicker">SKY SPORTS NEWS</p>
        <h1>Studio Control Panel</h1>
        <p>Select the package you want to run, then launch the rundown.</p>
      </header>

      <div className="ssn-panel-grid">
        <section className="panel ssn-panel-section">
          <header className="ssn-panel-section-head">
            <h2>Show Segments</h2>
            <p>Choose the section first, then launch the specific feed.</p>
          </header>
          <div className="ssn-panel-button-grid">
            {topLevelActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={`ssn-panel-button${activePrimary === action.key ? ' is-active' : ''}`}
                onClick={() => setActivePrimary(action.key)}
                aria-pressed={activePrimary === action.key}
              >
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel ssn-panel-section">
          <header className="ssn-panel-section-head">
            <h2>Launch Feed</h2>
            <p>The live SSN screen itself remains unchanged. This panel only decides which segment to run.</p>
          </header>
          <div className="ssn-panel-link-grid">
            {actionLinks.map((action) => (
              <Link key={action.to} to={action.to} className="ssn-panel-link">
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
