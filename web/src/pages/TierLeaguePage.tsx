import { useEffect, useMemo, useState } from 'react';
import { LeagueTabs } from '../components/CompetitionTabs';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { recentForm } from '../lib/formUtils';

const INTRO_GAMEWEEKS = ['GW4', 'GW5', 'GW6', 'GW7', 'GW8'] as const;
const FULL_GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'] as const;
const TIER_DIVISION_ORDER = ['Legendary', 'Masters', 'Elite', 'Superior', 'Standard', 'Average', 'Poor', 'Awful'] as const;

type TierTableRow = Awaited<ReturnType<typeof api.tierLeagueTable>>['table'][number];
type TierFixture = Awaited<ReturnType<typeof api.tierLeagueFixtures>>[number];

function formatProfit(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function tierCutlines(division: string): Array<{ afterRank: number; label: string; tone: 'promotion' | 'relegation' }> {
  if (division === 'Legendary') {
    return [
      { afterRank: 2, label: 'Relegation Line', tone: 'relegation' },
    ];
  }
  if (division === 'Awful') {
    return [
      { afterRank: 1, label: 'Promotion Line', tone: 'promotion' },
    ];
  }
  return [
    { afterRank: 1, label: 'Promotion Line', tone: 'promotion' },
    { afterRank: 2, label: 'Relegation Line', tone: 'relegation' },
  ];
}

function fixtureSubtitle(fixture: TierFixture): string {
  if (fixture.fixtureType === 'cross') {
    const homeDivision = fixture.homeDivision ?? 'Unknown';
    const awayDivision = fixture.awayDivision ?? 'Unknown';
    return `${homeDivision} v ${awayDivision}`;
  }
  return fixture.division;
}

function tierLeagueStartsFromGw1(season: string | null): boolean {
  if (!season) {
    return false;
  }
  const seasonNumber = Number(season.replace('S', ''));
  return Number.isFinite(seasonNumber) && seasonNumber >= 7;
}

export function TierLeaguePage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [started, setStarted] = useState(false);
  const [table, setTable] = useState<TierTableRow[]>([]);
  const [fixtures, setFixtures] = useState<TierFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const tierStartsGw1 = tierLeagueStartsFromGw1(state?.currentSeason ?? null);
  const tierStartGw = tierStartsGw1 ? 'GW1' : 'GW4';
  const tierGameweeks = tierStartsGw1 ? FULL_GAMEWEEKS : INTRO_GAMEWEEKS;

  const reload = async () => {
    setLoading(true);
    try {
      const nextState = await api.state();
      setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });

      const seasonNumber = Number(nextState.currentSeason.replace('S', ''));
      if (!Number.isFinite(seasonNumber) || seasonNumber < 6) {
        setEnabled(false);
        setStarted(false);
        setTable([]);
        setFixtures([]);
        setMessage('Tier League starts in Season 6.');
        return;
      }

      const [tableResponse, fixtureResponse] = await Promise.all([
        api.tierLeagueTable(nextState.currentGw),
        api.tierLeagueFixtures(undefined, true),
      ]);
      setEnabled(tableResponse.enabled);
      setStarted(tableResponse.started);
      setTable(tableResponse.table);
      setFixtures(fixtureResponse);
      setMessage(
        tableResponse.started
          ? ''
          : tierLeagueStartsFromGw1(nextState.currentSeason)
            ? 'Tier League starts from GW1 in this season and runs right through to GW8.'
            : 'Tier League goes live in GW4. Moving from GW3 to GW4 will seed the eight divisions and generate fixtures through GW8.',
      );
    } catch (error) {
      setEnabled(false);
      setStarted(false);
      setTable([]);
      setFixtures([]);
      setMessage(
        error instanceof Error
          ? `Tier League API unavailable: ${error.message}`
          : 'Tier League API unavailable. Restart the backend and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const currentGwFixtures = useMemo(
    () => (state ? fixtures.filter((fixture) => fixture.gw === state.currentGw) : []),
    [fixtures, state],
  );

  const currentDivisionFixtures = useMemo(
    () => TIER_DIVISION_ORDER
      .map((division) => ({
        division,
        fixtures: currentGwFixtures.filter((fixture) => fixture.fixtureType === 'division' && fixture.division === division),
      }))
      .filter((group) => group.fixtures.length > 0),
    [currentGwFixtures],
  );

  const currentCrossFixtures = useMemo(
    () => currentGwFixtures.filter((fixture) => fixture.fixtureType === 'cross'),
    [currentGwFixtures],
  );

  const tableByDivision = useMemo(
    () => TIER_DIVISION_ORDER
      .map((division) => ({
        division,
        rows: table.filter((row) => row.division === division),
      }))
      .filter((group) => group.rows.length > 0),
    [table],
  );

  const fixturesByGw = useMemo(
    () => tierGameweeks
      .map((gw) => ({
        gw,
        divisionFixtures: TIER_DIVISION_ORDER
          .map((division) => ({
            division,
            fixtures: fixtures.filter((fixture) => fixture.gw === gw && fixture.fixtureType === 'division' && fixture.division === division),
          }))
          .filter((group) => group.fixtures.length > 0),
        crossFixtures: fixtures.filter((fixture) => fixture.gw === gw && fixture.fixtureType === 'cross'),
      }))
      .filter((group) => group.divisionFixtures.length > 0 || group.crossFixtures.length > 0),
    [fixtures, tierGameweeks],
  );

  const formForTeam = (teamId: number) => recentForm({
    fixtures,
    include: (fixture) =>
      fixture.result !== 'pending'
      && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
    resultOf: (fixture) => {
      if (fixture.result === 'draw') {
        return 'D';
      }
      const win = (fixture.result === 'home' && fixture.homeTeamId === teamId) || (fixture.result === 'away' && fixture.awayTeamId === teamId);
      return win ? 'W' : 'L';
    },
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });

  const renderFixtureRow = (fixture: TierFixture) => (
    <div key={`tier-fixture-${fixture.id}`} className="master-fixture-row trio-fixture-row">
      <span className="muted trio-fixture-stage">
        {fixture.fixtureType === 'cross' ? `${fixtureSubtitle(fixture)} • X${fixture.groupSlot}` : `Division Match • M${fixture.groupSlot}`}
      </span>
      <strong className="trio-fixture-team trio-fixture-team-home">{fixture.homeTeam}</strong>
      <span className="trio-fixture-score">
        {fixture.result === 'pending'
          ? 'vs'
          : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`}
      </span>
      <strong className="trio-fixture-team trio-fixture-team-away">{fixture.awayTeam}</strong>
    </div>
  );

  return (
    <section className="page trio-page tier-league-page">
      <h1>Tier League</h1>
      <p className="muted">
        {state
          ? `${state.currentSeason} ${state.currentGw} • Eight divisions of three, with cross-tier clash fixtures ensuring every team plays from ${tierStartGw} to GW8.`
          : 'Loading Tier League...'}
      </p>

      <LeagueTabs activeId="tier" />

      {message && <div className="panel"><p className="muted">{message}</p></div>}

      {enabled ? (
        <div className="panel trio-section-panel trio-explainer-panel">
          <h3>Format Explainer</h3>
          <ul className="trio-explainer-list">
            <li><strong>Structure:</strong> 24 teams split across Legendary, Masters, Elite, Superior, Standard, Average, Poor, and Awful.</li>
            <li><strong>Matchweeks:</strong> the competition runs from {tierStartGw} to GW8.</li>
            <li><strong>Division game:</strong> each week every division has one in-division fixture, leaving one team idle inside that division.</li>
            <li><strong>Cross-tier clash:</strong> the eight idle teams are then paired at random into four extra matches, and those results still count.</li>
            <li><strong>Movement:</strong> after GW8, the top team in each division goes up and the bottom team goes down, except Legendary and Awful.</li>
          </ul>
        </div>
      ) : null}

      <div className="panel trio-section-panel">
        <h3>{state?.currentGw ?? 'Current'} Fixtures</h3>
        {!enabled ? (
          <p className="muted">Tier League becomes available in Season 6.</p>
        ) : !started ? (
          <p className="muted">Fixtures will be created automatically when the season reaches {tierStartGw}.</p>
        ) : currentDivisionFixtures.length === 0 && currentCrossFixtures.length === 0 ? (
          <p className="muted">No fixtures generated for this gameweek yet.</p>
        ) : (
          <div className="trio-fixture-groups">
            {currentDivisionFixtures.map((group) => (
              <div key={`tier-current-${group.division}`} className="master-fixture-group trio-fixture-group">
                <h4>{group.division}</h4>
                {group.fixtures.map(renderFixtureRow)}
              </div>
            ))}
            {currentCrossFixtures.length > 0 ? (
              <div className="master-fixture-group trio-fixture-group tier-cross-fixture-group">
                <h4>Cross-Tier Clashes</h4>
                {currentCrossFixtures.map(renderFixtureRow)}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="panel trio-section-panel">
        <h3>Tier Tables</h3>
        {loading ? (
          <p className="muted">Loading table...</p>
        ) : !started ? (
          <p className="muted">Standings begin once the Tier League starts in {tierStartGw}.</p>
        ) : tableByDivision.length === 0 ? (
          <p className="muted">No table rows yet.</p>
        ) : (
          <div className="trio-table-grid">
            {tableByDivision.map((group) => (
              <div key={`tier-table-${group.division}`} className="trio-table-card">
                <h4>{group.division}</h4>
                <div className="trio-table-scroll">
                  <table className="scoreboard-table master-league-table trio-league-table">
                    <colgroup>
                      <col className="trio-col-rank" />
                      <col className="trio-col-team" />
                      <col className="trio-col-small" />
                      <col className="trio-col-tiny" />
                      <col className="trio-col-tiny" />
                      <col className="trio-col-tiny" />
                      <col className="trio-col-small" />
                      <col className="trio-col-spins" />
                      <col className="trio-col-profit" />
                      <col className="trio-col-form" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Team</th>
                        <th>PLD</th>
                        <th>W</th>
                        <th>L</th>
                        <th>D</th>
                        <th>Pts</th>
                        <th>Spins</th>
                        <th>Profit</th>
                        <th>Form</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows
                        .slice()
                        .sort((left, right) => left.rank - right.rank)
                        .flatMap((row) => {
                          const cutlines = tierCutlines(group.division).filter((entry) => entry.afterRank === row.rank);
                          return [
                            (
                              <tr key={`tier-row-${group.division}-${row.teamId}`}>
                                <td>{row.rank}</td>
                                <td>
                                  <span className="master-team-cell trio-team-cell">
                                    <TeamBadge
                                      name={row.teamName}
                                      ballColor={row.ballColor}
                                      ringColor={row.ringColor}
                                      textColor={row.textColor}
                                      size={18}
                                    />
                                    <span>{row.teamName}</span>
                                  </span>
                                </td>
                                <td>{row.played}</td>
                                <td>{row.wins}</td>
                                <td>{row.losses}</td>
                                <td>{row.draws}</td>
                                <td>{row.points}</td>
                                <td>{row.spins}</td>
                                <td>{formatProfit(row.profit)}</td>
                                <td>
                                  <div className="form-mini-row trio-form-row">
                                    {formForTeam(row.teamId).map((result, index) => (
                                      <span
                                        key={`tier-form-${group.division}-${row.teamId}-${index}-${result}`}
                                        className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}
                                      >
                                        {result}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ),
                            ...cutlines.map((cutline, index) => (
                              <tr key={`tier-cut-${group.division}-${cutline.afterRank}-${cutline.tone}-${index}`} className="trio-table-cutline-row" aria-hidden="true">
                                <td colSpan={10}>
                                  <div className={`trio-table-cutline trio-table-cutline-${cutline.tone}`}>
                                    <span>{cutline.label}</span>
                                  </div>
                                </td>
                              </tr>
                            )),
                          ];
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel trio-section-panel">
        <h3>Season Fixture Board</h3>
        {!enabled ? (
          <p className="muted">Tier League fixtures are disabled before Season 6.</p>
        ) : !started ? (
          <p className="muted">The full {tierStartGw}-GW8 schedule will be created as soon as the season moves into {tierStartGw}.</p>
        ) : fixturesByGw.length === 0 ? (
          <p className="muted">No fixtures available yet.</p>
        ) : (
          <div className="trio-season-board">
            {fixturesByGw.map((group) => (
              <div key={`tier-group-${group.gw}`} className="master-fixture-group trio-fixture-group">
                <h4>{group.gw}</h4>
                {group.divisionFixtures.map((divisionGroup) => (
                  <div key={`tier-group-division-${group.gw}-${divisionGroup.division}`} className="master-fixture-group trio-fixture-subgroup">
                    <h5>{divisionGroup.division}</h5>
                    {divisionGroup.fixtures.map(renderFixtureRow)}
                  </div>
                ))}
                {group.crossFixtures.length > 0 ? (
                  <div className="master-fixture-group trio-fixture-subgroup tier-cross-fixture-group">
                    <h5>Cross-Tier Clashes</h5>
                    {group.crossFixtures.map(renderFixtureRow)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
