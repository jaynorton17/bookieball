import { useEffect, useMemo, useState } from 'react';
import { CupTabs } from '../components/CompetitionTabs';
import { api } from '../lib/api';

const MASTER_CUP_GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6'];

type MasterCupFixture = {
  id: number;
  gw: string;
  stage: 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place_playoff' | 'final';
  legNumber: number;
  tieSlot: number;
  roundName: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeSeed: number | null;
  awaySeed: number | null;
  winnerTeamId: number | null;
  winnerTeam: string | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  aggregateHomeProfit: number | null;
  aggregateAwayProfit: number | null;
  aggregateHomeSpins: number | null;
  aggregateAwaySpins: number | null;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  decidedBy: 'profit' | 'spins' | 'penalties' | 'aggregate_profit' | 'aggregate_spins' | 'aggregate_penalties' | 'pending';
};

function gwNumber(gw: string): number {
  return Number(gw.replace('GW', '')) || 99;
}

function masterCupTeamLabel(fixture: MasterCupFixture, side: 'home' | 'away'): string {
  const teamName = side === 'home' ? fixture.homeTeam : fixture.awayTeam;
  const seed = side === 'home' ? fixture.homeSeed : fixture.awaySeed;
  if (!teamName) {
    return 'TBD';
  }
  return seed ? `#${seed} ${teamName}` : teamName;
}

function masterCupScoreLabel(fixture: MasterCupFixture): string {
  if (!fixture.played) {
    return fixture.roundName;
  }
  const base = `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`;
  if (fixture.stage === 'semi_final' && fixture.legNumber === 2 && fixture.aggregateHomeProfit !== null && fixture.aggregateAwayProfit !== null) {
    return `${base} • Agg ${fixture.aggregateHomeProfit.toFixed(2)} - ${fixture.aggregateAwayProfit.toFixed(2)}`;
  }
  return base;
}

export function MasterCupPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [fixtures, setFixtures] = useState<MasterCupFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const reload = async () => {
      setLoading(true);
      try {
        const nextState = await api.state();
        const seasonNumber = Number(nextState.currentSeason.replace('S', '')) || 0;
        let nextFixtures: MasterCupFixture[] = [];
        if (seasonNumber >= 5) {
          nextFixtures = await api.masterCupFixtures(undefined, true);
        }
        if (!active) {
          return;
        }
        setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
        setFixtures(nextFixtures);
        setMessage('');
      } catch (error) {
        if (!active) {
          return;
        }
        setFixtures([]);
        setMessage(
          error instanceof Error
            ? `Master Cup API unavailable: ${error.message}`
            : 'Master Cup API unavailable. Restart the backend and try again.',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void reload();
    return () => {
      active = false;
    };
  }, []);

  const currentGwFixtures = useMemo(
    () => (state ? fixtures.filter((fixture) => fixture.gw === state.currentGw) : []),
    [fixtures, state],
  );

  const fixturesByGw = useMemo(() => {
    const groups = new Map<string, MasterCupFixture[]>();
    fixtures
      .slice()
      .sort((a, b) => gwNumber(a.gw) - gwNumber(b.gw) || a.tieSlot - b.tieSlot || a.legNumber - b.legNumber || a.id - b.id)
      .forEach((fixture) => {
        const list = groups.get(fixture.gw) ?? [];
        list.push(fixture);
        groups.set(fixture.gw, list);
      });
    return MASTER_CUP_GAMEWEEKS
      .filter((gw) => groups.has(gw))
      .map((gw) => ({ gw, fixtures: groups.get(gw) ?? [] }));
  }, [fixtures]);

  const seasonNumber = state ? Number(state.currentSeason.replace('S', '')) || 0 : 0;

  return (
    <section className="page page-wide">
      <h1>Master Cup</h1>
      <p className="muted">
        {state
          ? `${state.currentSeason} ${state.currentGw} • Top-16 knockout seeded from the previous Master League season.`
          : 'Loading Master Cup...'}
      </p>

      <CupTabs activeId="master-cup" />

      {message ? (
        <div className="panel">
          <p className="muted">{message}</p>
        </div>
      ) : null}

      <div className="panel">
        <h3>{state?.currentGw ?? 'Current'} Master Cup</h3>
        {loading ? (
          <p className="muted">Loading Master Cup fixtures...</p>
        ) : seasonNumber < 5 ? (
          <p className="muted">Master Cup starts in Season 5.</p>
        ) : currentGwFixtures.length === 0 ? (
          <p className="muted">No Master Cup fixtures for this gameweek.</p>
        ) : (
          <div className="master-fixture-list">
            {currentGwFixtures.map((fixture) => (
              <div key={`master-cup-current-${fixture.id}`} className="master-fixture-row">
                <strong>{masterCupTeamLabel(fixture, 'home')}</strong>
                <span>{masterCupScoreLabel(fixture)}</span>
                <strong>{masterCupTeamLabel(fixture, 'away')}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Master Cup Board</h3>
        {loading ? (
          <p className="muted">Loading Master Cup board...</p>
        ) : seasonNumber < 5 ? (
          <p className="muted">Master Cup starts in Season 5.</p>
        ) : fixturesByGw.length === 0 ? (
          <p className="muted">No Master Cup fixtures available yet.</p>
        ) : (
          <div className="master-fixture-groups">
            {fixturesByGw.map((group) => (
              <div key={`master-cup-group-${group.gw}`} className="master-fixture-group">
                <h4>{group.gw}</h4>
                {group.fixtures.map((fixture) => (
                  <div key={`master-cup-group-row-${fixture.id}`} className="master-fixture-row">
                    <span>{masterCupTeamLabel(fixture, 'home')}</span>
                    <span>{masterCupScoreLabel(fixture)}</span>
                    <span>{masterCupTeamLabel(fixture, 'away')}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
