import { useEffect, useMemo, useState } from 'react';
import { LeagueTabs } from '../components/CompetitionTabs';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { recentForm } from '../lib/formUtils';

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];
const TRIO_DIVISION_ORDER = ['Premier League', 'Ligue 1', 'Bundesliga'] as const;

type TrioTableRow = {
  division: string;
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

type TrioFixture = {
  id: number;
  gw: string;
  division: string;
  stage: 'regular' | 'playoff_semi' | 'playoff_final';
  groupSlot: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  winnerTeamId: number | null;
};

function gwNumber(gw: string): number {
  return Number(gw.replace('GW', '')) || 99;
}

function formatProfit(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function stageLabel(fixture: TrioFixture): string {
  if (fixture.stage === 'playoff_semi') {
    return 'Playoff Semi-Final';
  }
  if (fixture.stage === 'playoff_final') {
    return 'Playoff Final';
  }
  return 'Regular Season';
}

function trioScoreLabel(fixture: TrioFixture): string {
  return fixture.played
    ? `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`
    : 'vs';
}

function trioCutlines(division: string): Array<{ afterRank: number; label: string; tone: 'promotion' | 'playoff' | 'relegation' }> {
  if (division === 'Premier League') {
    return [
      { afterRank: 6, label: 'Relegation Line', tone: 'relegation' },
    ];
  }
  if (division === 'Ligue 1') {
    return [
      { afterRank: 1, label: 'Auto Promotion Line', tone: 'promotion' },
      { afterRank: 5, label: 'Playoff Line', tone: 'playoff' },
      { afterRank: 6, label: 'Relegation Line', tone: 'relegation' },
    ];
  }
  return [
    { afterRank: 1, label: 'Auto Promotion Line', tone: 'promotion' },
    { afterRank: 5, label: 'Playoff Line', tone: 'playoff' },
  ];
}

export function TrioLeaguePage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [table, setTable] = useState<TrioTableRow[]>([]);
  const [fixtures, setFixtures] = useState<TrioFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const nextState = await api.state();
      setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });

      const seasonNumber = Number(nextState.currentSeason.replace('S', ''));
      if (!Number.isFinite(seasonNumber) || seasonNumber < 5) {
        setEnabled(false);
        setTable([]);
        setFixtures([]);
        setMessage('Trio League starts in Season 5. Season 4 remains unchanged.');
        return;
      }

      const [tableResponse, fixtureResponse] = await Promise.all([
        api.trioLeagueTable(nextState.currentGw),
        api.trioLeagueFixtures(undefined, true),
      ]);
      setEnabled(tableResponse.enabled);
      setTable(tableResponse.table);
      setFixtures(fixtureResponse);
      setMessage(tableResponse.enabled ? '' : 'Trio League is not enabled for this season.');
    } catch (error) {
      setEnabled(false);
      setTable([]);
      setFixtures([]);
      setMessage(
        error instanceof Error
          ? `Trio League API unavailable: ${error.message}`
          : 'Trio League API unavailable. Restart the backend and try again.',
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

  const currentFixturesByDivision = useMemo(
    () => TRIO_DIVISION_ORDER
      .map((division) => ({
        division,
        fixtures: currentGwFixtures.filter((fixture) => fixture.division === division),
      }))
      .filter((group) => group.fixtures.length > 0),
    [currentGwFixtures],
  );

  const tableByDivision = useMemo(
    () => TRIO_DIVISION_ORDER
      .map((division) => ({
        division,
        rows: table.filter((row) => row.division === division),
      }))
      .filter((group) => group.rows.length > 0),
    [table],
  );

  const fixturesByGw = useMemo(() => {
    const groups = new Map<string, TrioFixture[]>();
    fixtures
      .slice()
      .sort((a, b) =>
        gwNumber(a.gw) - gwNumber(b.gw)
        || TRIO_DIVISION_ORDER.indexOf(a.division as (typeof TRIO_DIVISION_ORDER)[number]) - TRIO_DIVISION_ORDER.indexOf(b.division as (typeof TRIO_DIVISION_ORDER)[number])
        || a.groupSlot - b.groupSlot
        || a.id - b.id)
      .forEach((fixture) => {
        const list = groups.get(fixture.gw) ?? [];
        list.push(fixture);
        groups.set(fixture.gw, list);
      });
    return GAMEWEEKS
      .filter((gw) => groups.has(gw))
      .map((gw) => ({ gw, fixtures: groups.get(gw) ?? [] }));
  }, [fixtures]);

  const formForTeam = (teamId: number, division: string) => recentForm({
    fixtures,
    include: (fixture) =>
      fixture.result !== 'pending'
      && fixture.stage === 'regular'
      && fixture.division === division
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

  return (
    <section className="page trio-page competition-page competition-page-trio">
      <div className="competition-page-shell">
        <header className="competition-page-hero competition-page-hero-trio">
          <div className="competition-page-hero-head">
            <div className="competition-page-hero-copy">
              <span className="competition-page-kicker">Expansion Format</span>
              <h1>Trio League</h1>
              <p>Three-tier ladder with GW7 semi-finals and GW8 promotion finals.</p>
            </div>
            <div className="competition-hero-art" aria-hidden="true">
              <CompetitionTrophyMark variant="cup" className="competition-hero-trophy trophy-cup" />
            </div>
          </div>
          <div className="competition-metric-row">
            <article className="competition-metric-card">
              <span>Format</span>
              <strong>3 tiers</strong>
              <p>Premier League, Ligue 1, Bundesliga</p>
            </article>
            <article className="competition-metric-card">
              <span>Teams per tier</span>
              <strong>8</strong>
              <p>24 clubs total</p>
            </article>
            <article className="competition-metric-card">
              <span>Season</span>
              <strong>{state ? state.currentSeason : '—'}</strong>
              <p>{state ? state.currentGw : 'Loading...'}</p>
            </article>
          </div>
        </header>

      <LeagueTabs activeId="trio" />

      {message && <div className="panel"><p className="muted">{message}</p></div>}

      {enabled ? (
        <div className="panel trio-section-panel trio-explainer-panel">
          <h3>Format Explainer</h3>
          <ul className="trio-explainer-list">
            <li><strong>Premier League:</strong> 7th and 8th are relegated.</li>
            <li><strong>Ligue 1:</strong> 1st goes up automatically and 7th-8th go down.</li>
            <li><strong>Ligue 1 playoffs:</strong> 2nd v 5th and 3rd v 4th in GW7.</li>
            <li><strong>GW8:</strong> semi-final winners meet in the promotion final and the final winner takes the second promotion place.</li>
            <li><strong>Tied playoff rule:</strong> Trio playoff ties are decided on profit only, then penalties if profit is level.</li>
            <li><strong>Bundesliga:</strong> 1st goes up automatically, with 2nd-5th entering the playoffs for the second promotion place.</li>
          </ul>
        </div>
      ) : null}

      <div className="panel trio-section-panel">
        <h3>{state?.currentGw ?? 'Current'} Fixtures</h3>
        {!enabled ? (
          <p className="muted">Trio fixtures become available in Season 5.</p>
        ) : currentFixturesByDivision.length === 0 ? (
          <p className="muted">No fixtures generated for this gameweek yet.</p>
        ) : (
          <div className="trio-fixture-groups">
            {currentFixturesByDivision.map((group) => (
              <div key={`trio-current-division-${group.division}`} className="master-fixture-group trio-fixture-group">
                <h4>{group.division}</h4>
                {group.fixtures.map((fixture) => (
                  <div key={`trio-current-${fixture.id}`} className="master-fixture-row trio-fixture-row">
                    <span className="muted trio-fixture-stage">{stageLabel(fixture)} • M{fixture.groupSlot}</span>
                    <strong className="trio-fixture-team trio-fixture-team-home">{fixture.homeTeam}</strong>
                    <span className="trio-fixture-score">{trioScoreLabel(fixture)}</span>
                    <strong className="trio-fixture-team trio-fixture-team-away">{fixture.awayTeam}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel trio-section-panel">
        <h3>Trio League Table</h3>
        {loading ? (
          <p className="muted">Loading table...</p>
        ) : tableByDivision.length === 0 ? (
          <p className="muted">No table rows yet.</p>
        ) : (
          <div className="trio-table-grid">
            {tableByDivision.map((group) => (
              <div key={`trio-table-${group.division}`} className="trio-table-card">
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
                        <th>Form (Last 5)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows
                        .slice()
                        .sort((left, right) => left.rank - right.rank)
                        .flatMap((row) => {
                          const cutlines = trioCutlines(group.division).filter((entry) => entry.afterRank === row.rank);
                          const form = formForTeam(row.teamId, group.division);
                          return [
                            (
                              <tr key={`trio-row-${group.division}-${row.teamId}`}>
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
                                  <div
                                    className="form-mini-row trio-form-row"
                                    title={form.length > 0 ? `Recent form: ${form.join(' ')}` : 'No completed trio matches yet'}
                                  >
                                    {form.map((result, index) => (
                                      <span
                                        key={`trio-form-${group.division}-${row.teamId}-${index}-${result}`}
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
                              <tr key={`trio-cut-${group.division}-${cutline.afterRank}-${cutline.tone}-${index}`} className="trio-table-cutline-row" aria-hidden="true">
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
          <p className="muted">Trio fixtures are disabled outside Season 5+.</p>
        ) : fixturesByGw.length === 0 ? (
          <p className="muted">No fixtures available yet.</p>
        ) : (
          <div className="trio-season-board">
            {fixturesByGw.map((group) => (
              <div key={`trio-group-${group.gw}`} className="master-fixture-group trio-fixture-group">
                <h4>{group.gw}</h4>
                {TRIO_DIVISION_ORDER.map((division) => {
                  const divisionFixtures = group.fixtures.filter((fixture) => fixture.division === division);
                  if (divisionFixtures.length === 0) {
                    return null;
                  }
                  return (
                    <div key={`trio-group-division-${group.gw}-${division}`} className="master-fixture-group trio-fixture-subgroup">
                      <h5>{division}</h5>
                      {divisionFixtures.map((fixture) => (
                        <div key={`trio-group-row-${fixture.id}`} className="master-fixture-row trio-fixture-row">
                          <span className="muted trio-fixture-stage">{stageLabel(fixture)} • M{fixture.groupSlot}</span>
                          <strong className="trio-fixture-team trio-fixture-team-home">{fixture.homeTeam}</strong>
                          <span className="trio-fixture-score">{trioScoreLabel(fixture)}</span>
                          <strong className="trio-fixture-team trio-fixture-team-away">{fixture.awayTeam}</strong>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}
