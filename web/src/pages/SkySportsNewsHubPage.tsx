import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DivisionKey, RoundupCupSegment, RoundupLeagueSegment, RoundupPrimarySegment, RoundupSpotlightSegment } from '../components/roundup/roundupTypes';

type LeagueAction = { label: string; league: RoundupLeagueSegment; division?: 'all' | DivisionKey };
type CupAction = { label: string; cup: RoundupCupSegment };
type SpotlightAction = { label: string; spotlight: RoundupSpotlightSegment };

const topLevelActions: Array<{ key: RoundupPrimarySegment; label: string; description: string; icon: string }> = [
  { key: 'full', label: 'Whole Show', description: 'Run the complete studio rundown.', icon: '▶' },
  { key: 'leagues', label: 'Leagues', description: 'Tables, divisions, Master and Trio.', icon: '▤' },
  { key: 'cups', label: 'Cups', description: 'Super Cup, BookieBall Cup and Master Cup.', icon: '🏆' },
  { key: 'spotlights', label: 'Spotlights', description: 'Team feature packages.', icon: '●' },
];
const leagueActions: LeagueAction[] = [
  { label: 'Play All Leagues', league: 'all' }, { label: 'Play All Divisions', league: 'divisions', division: 'all' }, { label: 'Play Champions', league: 'divisions', division: 'champions' }, { label: 'Play Premier', league: 'divisions', division: 'premier' }, { label: 'Play Division 1', league: 'divisions', division: 'division-one' }, { label: 'Play Division 2', league: 'divisions', division: 'division-two' }, { label: 'Play Division 3', league: 'divisions', division: 'division-three' }, { label: 'Play Division 4', league: 'divisions', division: 'division-four' }, { label: 'Play Master League', league: 'master' }, { label: 'Play Trio Leagues', league: 'trio' }, { label: 'Play All-Time', league: 'all-time' },
];
const cupActions: CupAction[] = [{ label: 'Play All Cups', cup: 'all' }, { label: 'Play Super Cup', cup: 'super-cup' }, { label: 'Play BookieBall Cup', cup: 'bookieball' }, { label: 'Play Master Cup', cup: 'master-cup' }];
const spotlightActions: SpotlightAction[] = [{ label: 'Play All Spotlights', spotlight: 'all' }, { label: 'Play Champions Spotlight', spotlight: 'champions' }, { label: 'Play Premier Spotlight', spotlight: 'premier' }, { label: 'Play Division 1 Spotlight', spotlight: 'division-one' }, { label: 'Play Division 2 Spotlight', spotlight: 'division-two' }, { label: 'Play Division 3 Spotlight', spotlight: 'division-three' }, { label: 'Play Division 4 Spotlight', spotlight: 'division-four' }];

function buildShowLink(args: { primary: RoundupPrimarySegment; league?: RoundupLeagueSegment; division?: 'all' | DivisionKey; cup?: RoundupCupSegment; spotlight?: RoundupSpotlightSegment }): string {
  const params = new URLSearchParams();
  if (args.primary !== 'full') params.set('primary', args.primary);
  if (args.league && args.league !== 'all') params.set('league', args.league); else if (args.primary === 'leagues') params.set('league', 'all');
  if (args.division && args.division !== 'all') params.set('division', args.division);
  if (args.cup && args.cup !== 'all') params.set('cup', args.cup); else if (args.primary === 'cups') params.set('cup', 'all');
  if (args.spotlight && args.spotlight !== 'all') params.set('spotlight', args.spotlight); else if (args.primary === 'spotlights') params.set('spotlight', 'all');
  const query = params.toString(); return query ? `/sky-sports-news/show?${query}` : '/sky-sports-news/show';
}

export function SkySportsNewsHubPage() {
  const [activePrimary, setActivePrimary] = useState<RoundupPrimarySegment>('full');
  const actionLinks = useMemo(() => {
    if (activePrimary === 'full') return [{ label: 'Play Whole Show', to: buildShowLink({ primary: 'full' }), description: 'Run the full uninterrupted studio show.' }];
    if (activePrimary === 'leagues') return leagueActions.map((action) => ({ label: action.label, to: buildShowLink({ primary: 'leagues', league: action.league, division: action.division }), description: action.league === 'divisions' ? 'Division-only rundown.' : 'Jump straight into this league segment.' }));
    if (activePrimary === 'cups') return cupActions.map((action) => ({ label: action.label, to: buildShowLink({ primary: 'cups', cup: action.cup }), description: 'Bracket-led cup coverage.' }));
    return spotlightActions.map((action) => ({ label: action.label, to: buildShowLink({ primary: 'spotlights', spotlight: action.spotlight }), description: 'Team spotlight package.' }));
  }, [activePrimary]);

  return <section className="page page-dashboard ssn-panel-page ssn-control-surface"><header className="ssn-panel-hero"><p className="roundup-kicker">SKY SPORTS NEWS</p><h1>Studio Control</h1><p>Pick the package, then launch the feed.</p></header><div className="ssn-control-grid">{topLevelActions.map((action) => <button key={action.key} type="button" className={`ssn-control-tile${activePrimary === action.key ? ' is-active' : ''}`} onClick={() => setActivePrimary(action.key)} aria-pressed={activePrimary === action.key}><div className="ssn-visual-icon" aria-hidden="true">{action.icon}</div><strong>{action.label}</strong><span>{action.description}</span></button>)}</div><section className="panel ssn-launch-panel"><div className="panel-header"><div><h2>Launch {topLevelActions.find((row) => row.key === activePrimary)?.label}</h2><p className="muted">Choose the exact feed.</p></div></div><div className="ssn-panel-link-grid">{actionLinks.map((action) => <Link key={action.to} to={action.to} className="ssn-panel-link"><strong>{action.label}</strong><span>{action.description}</span></Link>)}</div></section></section>;
}
