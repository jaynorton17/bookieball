import { useEffect, useMemo, useState } from 'react';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { displayDivisionName, getDivisionOrderForSeason } from '../lib/divisionLabels';

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'] as const;

const COMPETITIONS = [
  {
    key: 'divisions',
    label: 'Divisions',
    description: 'Official division fixtures, playoffs, and friendlies.',
  },
  {
    key: 'master-league',
    label: 'Master League',
    description: 'Cross-table fixtures for the full master schedule.',
  },
  {
    key: 'trio-league',
    label: 'Trio League',
    description: 'Regular-season and playoff trio fixtures.',
  },
  {
    key: 'tier-league',
    label: 'Tier League',
    description: 'Eight three-team divisions with cross-tier clashes from GW4 to GW8.',
  },
  {
    key: 'super-cup',
    label: 'Super Cup',
    description: 'Standalone GW1 curtain-raiser between the previous season\'s cup standard-bearers.',
  },
  {
    key: 'bookieball-cup',
    label: 'BookieBall Cup',
    description: 'The main knockout bracket across the season.',
  },
  {
    key: 'master-cup',
    label: 'Master Cup',
    description: 'Seeded knockout fixtures from the master competition.',
  },
] as const;

type CompetitionKey = (typeof COMPETITIONS)[number]['key'];
type AppState = Awaited<ReturnType<typeof api.state>>;
type TeamProfile = Awaited<ReturnType<typeof api.teams>>[number];
type LeagueFixture = Awaited<ReturnType<typeof api.leagueFixtures>>[number];
type MasterLeagueFixture = Awaited<ReturnType<typeof api.masterLeagueFixtures>>[number];
type TrioLeagueFixture = Awaited<ReturnType<typeof api.trioLeagueFixtures>>[number];
type TierLeagueFixture = Awaited<ReturnType<typeof api.tierLeagueFixtures>>[number];
type CupFixture = Awaited<ReturnType<typeof api.cup>>[number];
type MasterCupFixture = Awaited<ReturnType<typeof api.masterCupFixtures>>[number];
type SuperCupFixture = Awaited<ReturnType<typeof api.superCup>>[number];

type UnifiedFixture = {
  key: string;
  id: number;
  competitionKey: CompetitionKey;
  competitionLabel: string;
  subgroupLabel: string;
  subgroupSort: number;
  gw: string;
  gwNumber: number;
  homeTeam: string | null;
  awayTeam: string | null;
  homeProfit: number | null;
  awayProfit: number | null;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  resolved: boolean;
  scoreLabel: string;
  outcomeLabel: string;
};

const COMPETITION_LABELS = Object.fromEntries(
  COMPETITIONS.map((competition) => [competition.key, competition.label]),
) as Record<CompetitionKey, string>;

const COMPETITION_ORDER = new Map<CompetitionKey, number>(
  COMPETITIONS.map((competition, index) => [competition.key, index]),
);

function gwNumber(gw: string): number {
  return Number(gw.replace('GW', '')) || 99;
}

function formatScore(
  result: UnifiedFixture['result'],
  homeProfit: number | null,
  awayProfit: number | null,
  played: boolean,
): string {
  if (!played) {
    return 'vs';
  }
  if (homeProfit === null || awayProfit === null) {
    return 'TBD';
  }
  return `${homeProfit.toFixed(2)} - ${awayProfit.toFixed(2)}`;
}

function trioStageLabel(stage: TrioLeagueFixture['stage']): string {
  if (stage === 'playoff_semi') {
    return 'Playoff Semi-Final';
  }
  if (stage === 'playoff_final') {
    return 'Playoff Final';
  }
  return 'Regular Season';
}

function pairingLabel(reason: SuperCupFixture['pairingReason']): string {
  if (reason === 'winners_vs_winners') {
    return 'Winners vs Winners';
  }
  if (reason === 'double_winner_vs_bookieball_runner_up') {
    return 'Double Winner vs BookieBall Runner-up';
  }
  return 'Double Winner vs Master Cup Runner-up';
}

function leagueOutcomeLabel(
  result: LeagueFixture['result'] | MasterLeagueFixture['result'] | TrioLeagueFixture['result'],
  homeTeam: string,
  awayTeam: string,
): string {
  if (result === 'home') {
    return `${homeTeam} won`;
  }
  if (result === 'away') {
    return `${awayTeam} won`;
  }
  if (result === 'draw') {
    return 'Draw';
  }
  return 'Pending';
}

function cupOutcomeLabel(
  winnerTeam: string | null,
  roundName: string,
  decidedBy: CupFixture['decidedBy'] | MasterCupFixture['decidedBy'],
  mode: 'bookieball-cup' | 'master-cup',
  stage?: MasterCupFixture['stage'],
): string {
  if (!winnerTeam) {
    return 'Pending';
  }
  if (mode === 'bookieball-cup') {
    if (/final/i.test(roundName)) {
      return `${winnerTeam} won the cup`;
    }
    if (decidedBy === 'bye') {
      return `${winnerTeam} advanced by bye`;
    }
    return `${winnerTeam} advanced`;
  }
  if (stage === 'final') {
    return `${winnerTeam} won the Master Cup`;
  }
  if (stage === 'third_place_playoff') {
    return `${winnerTeam} won third place`;
  }
  return `${winnerTeam} advanced`;
}

function involvesTeam(fixture: UnifiedFixture, teamName: string): boolean {
  return fixture.homeTeam === teamName || fixture.awayTeam === teamName;
}

function buildFixtureRows(args: {
  season: string;
  leagueFixtures: LeagueFixture[];
  masterLeagueFixtures: MasterLeagueFixture[];
  trioLeagueFixtures: TrioLeagueFixture[];
  tierLeagueFixtures: TierLeagueFixture[];
  cupFixtures: CupFixture[];
  masterCupFixtures: MasterCupFixture[];
  superCupFixtures: SuperCupFixture[];
}): UnifiedFixture[] {
  const divisionIndex = new Map(
    getDivisionOrderForSeason(args.season).map((division, index) => [division, index]),
  );
  const trioDivisionIndex = new Map([
    ['Premier League', 0],
    ['Ligue 1', 1],
    ['Bundesliga', 2],
  ]);
  const tierDivisionIndex = new Map([
    ['Legendary', 0],
    ['Masters', 1],
    ['Elite', 2],
    ['Superior', 3],
    ['Standard', 4],
    ['Average', 5],
    ['Poor', 6],
    ['Awful', 7],
  ]);

  const rows: UnifiedFixture[] = [
    ...args.leagueFixtures.map((fixture) => ({
      key: `divisions-${fixture.id}`,
      id: fixture.id,
      competitionKey: 'divisions' as const,
      competitionLabel: COMPETITION_LABELS.divisions,
      subgroupLabel: displayDivisionName(fixture.division),
      subgroupSort: divisionIndex.get(fixture.division) ?? 99,
      gw: fixture.gw,
      gwNumber: gwNumber(fixture.gw),
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeProfit: fixture.homeProfit,
      awayProfit: fixture.awayProfit,
      played: fixture.played,
      result: fixture.result,
      resolved: fixture.result !== 'pending',
      scoreLabel: formatScore(fixture.result, fixture.homeProfit, fixture.awayProfit, fixture.played),
      outcomeLabel: leagueOutcomeLabel(fixture.result, fixture.homeTeam, fixture.awayTeam),
    })),
    ...args.masterLeagueFixtures.map((fixture) => ({
      key: `master-league-${fixture.id}`,
      id: fixture.id,
      competitionKey: 'master-league' as const,
      competitionLabel: COMPETITION_LABELS['master-league'],
      subgroupLabel: 'All Teams',
      subgroupSort: 0,
      gw: fixture.gw,
      gwNumber: gwNumber(fixture.gw),
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeProfit: fixture.homeProfit,
      awayProfit: fixture.awayProfit,
      played: fixture.result !== 'pending',
      result: fixture.result,
      resolved: fixture.result !== 'pending',
      scoreLabel: formatScore(fixture.result, fixture.homeProfit, fixture.awayProfit, fixture.result !== 'pending'),
      outcomeLabel: leagueOutcomeLabel(fixture.result, fixture.homeTeam, fixture.awayTeam),
    })),
    ...args.trioLeagueFixtures.map((fixture) => ({
      key: `trio-league-${fixture.id}`,
      id: fixture.id,
      competitionKey: 'trio-league' as const,
      competitionLabel: COMPETITION_LABELS['trio-league'],
      subgroupLabel: `${fixture.division} • ${trioStageLabel(fixture.stage)}`,
      subgroupSort: ((trioDivisionIndex.get(fixture.division) ?? 99) * 10)
        + (fixture.stage === 'regular' ? 0 : fixture.stage === 'playoff_semi' ? 1 : 2),
      gw: fixture.gw,
      gwNumber: gwNumber(fixture.gw),
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeProfit: fixture.homeProfit,
      awayProfit: fixture.awayProfit,
      played: fixture.played,
      result: fixture.result,
      resolved: fixture.result !== 'pending',
      scoreLabel: formatScore(fixture.result, fixture.homeProfit, fixture.awayProfit, fixture.played),
      outcomeLabel: leagueOutcomeLabel(fixture.result, fixture.homeTeam, fixture.awayTeam),
    })),
    ...args.tierLeagueFixtures.map((fixture) => ({
      key: `tier-league-${fixture.id}`,
      id: fixture.id,
      competitionKey: 'tier-league' as const,
      competitionLabel: COMPETITION_LABELS['tier-league'],
      subgroupLabel: fixture.fixtureType === 'cross'
        ? `Cross-Tier • ${fixture.homeDivision ?? 'Unknown'} v ${fixture.awayDivision ?? 'Unknown'}`
        : fixture.division,
      subgroupSort: fixture.fixtureType === 'cross'
        ? 100 + fixture.groupSlot
        : tierDivisionIndex.get(fixture.division) ?? 99,
      gw: fixture.gw,
      gwNumber: gwNumber(fixture.gw),
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeProfit: fixture.homeProfit,
      awayProfit: fixture.awayProfit,
      played: fixture.result !== 'pending',
      result: fixture.result,
      resolved: fixture.result !== 'pending',
      scoreLabel: formatScore(fixture.result, fixture.homeProfit, fixture.awayProfit, fixture.result !== 'pending'),
      outcomeLabel: leagueOutcomeLabel(fixture.result, fixture.homeTeam, fixture.awayTeam),
    })),
    ...args.cupFixtures.map((fixture) => ({
      key: `bookieball-cup-${fixture.id}`,
      id: fixture.id,
      competitionKey: 'bookieball-cup' as const,
      competitionLabel: COMPETITION_LABELS['bookieball-cup'],
      subgroupLabel: fixture.roundName,
      subgroupSort: fixture.round,
      gw: fixture.gw,
      gwNumber: gwNumber(fixture.gw),
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeProfit: fixture.played ? fixture.homeProfit : null,
      awayProfit: fixture.played ? fixture.awayProfit : null,
      played: fixture.played,
      result: fixture.result,
      resolved: fixture.winnerTeam !== null,
      scoreLabel: fixture.decidedBy === 'bye'
        ? 'Bye'
        : formatScore(fixture.played ? fixture.result : 'pending', fixture.homeProfit, fixture.awayProfit, fixture.played),
      outcomeLabel: cupOutcomeLabel(fixture.winnerTeam, fixture.roundName, fixture.decidedBy, 'bookieball-cup'),
    })),
    ...args.superCupFixtures.map((fixture) => ({
      key: `super-cup-${fixture.id}`,
      id: fixture.id,
      competitionKey: 'super-cup' as const,
      competitionLabel: COMPETITION_LABELS['super-cup'],
      subgroupLabel: pairingLabel(fixture.pairingReason),
      subgroupSort: 0,
      gw: fixture.gw,
      gwNumber: gwNumber(fixture.gw),
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeProfit: fixture.played ? fixture.homeProfit : null,
      awayProfit: fixture.played ? fixture.awayProfit : null,
      played: fixture.played,
      result: fixture.result,
      resolved: fixture.winnerTeamId !== null,
      scoreLabel: formatScore(fixture.result === 'pending' ? 'pending' : fixture.result, fixture.homeProfit, fixture.awayProfit, fixture.played),
      outcomeLabel: fixture.winnerTeam
        ? `${fixture.winnerTeam} won the Super Cup`
        : 'Prestige opener pending',
    })),
    ...args.masterCupFixtures.map((fixture) => ({
      key: `master-cup-${fixture.id}`,
      id: fixture.id,
      competitionKey: 'master-cup' as const,
      competitionLabel: COMPETITION_LABELS['master-cup'],
      subgroupLabel: fixture.legNumber > 1 ? `${fixture.roundName} • Leg ${fixture.legNumber}` : fixture.roundName,
      subgroupSort:
        (fixture.stage === 'round_of_16'
          ? 0
          : fixture.stage === 'quarter_final'
            ? 1
            : fixture.stage === 'semi_final'
              ? 2
              : fixture.stage === 'third_place_playoff'
                ? 3
                : 4) * 10 + fixture.legNumber,
      gw: fixture.gw,
      gwNumber: gwNumber(fixture.gw),
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeProfit: fixture.played ? fixture.homeProfit : null,
      awayProfit: fixture.played ? fixture.awayProfit : null,
      played: fixture.played,
      result: fixture.result,
      resolved: fixture.winnerTeam !== null,
      scoreLabel: formatScore(fixture.played ? fixture.result : 'pending', fixture.homeProfit, fixture.awayProfit, fixture.played),
      outcomeLabel: cupOutcomeLabel(fixture.winnerTeam, fixture.roundName, fixture.decidedBy, 'master-cup', fixture.stage),
    })),
  ];

  return rows.sort((left, right) => {
    const gwDiff = left.gwNumber - right.gwNumber;
    if (gwDiff !== 0) {
      return gwDiff;
    }
    const competitionDiff = (COMPETITION_ORDER.get(left.competitionKey) ?? 99) - (COMPETITION_ORDER.get(right.competitionKey) ?? 99);
    if (competitionDiff !== 0) {
      return competitionDiff;
    }
    const subgroupDiff = left.subgroupSort - right.subgroupSort;
    if (subgroupDiff !== 0) {
      return subgroupDiff;
    }
    return left.id - right.id;
  });
}

export function AllFixturesPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [fixtures, setFixtures] = useState<UnifiedFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCompetition, setSelectedCompetition] = useState<CompetitionKey | ''>('');
  const [selectedGw, setSelectedGw] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const nextState = await api.state();
      const [teamRows, leagueFixtures, masterLeagueFixtures, trioLeagueFixtures, tierLeagueFixtures, cupFixtures, superCupFixtures, masterCupFixtures] = await Promise.all([
        api.teams(),
        api.leagueFixtures(undefined, true, nextState.currentSeason),
        api.masterLeagueFixtures(undefined, true).catch(() => [] as MasterLeagueFixture[]),
        api.trioLeagueFixtures(undefined, true).catch(() => [] as TrioLeagueFixture[]),
        api.tierLeagueFixtures(undefined, true).catch(() => [] as TierLeagueFixture[]),
        api.cup(undefined, nextState.currentSeason).catch(() => [] as CupFixture[]),
        api.superCup(nextState.currentSeason).catch(() => [] as SuperCupFixture[]),
        api.masterCupFixtures(undefined, true).catch(() => [] as MasterCupFixture[]),
      ]);

      setState(nextState);
      setTeams(teamRows);
      setFixtures(
        buildFixtureRows({
          season: nextState.currentSeason,
          leagueFixtures,
          masterLeagueFixtures,
          trioLeagueFixtures,
          tierLeagueFixtures,
          cupFixtures,
          superCupFixtures,
          masterCupFixtures,
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load fixtures.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const teamByName = useMemo(
    () => new Map(teams.map((team) => [team.name, team])),
    [teams],
  );

  const gameweekOptions = useMemo(
    () => GAMEWEEKS.filter((gw) => fixtures.some((fixture) => fixture.gw === gw)),
    [fixtures],
  );

  const teamOptions = useMemo(
    () => teams.slice().sort((left, right) => left.name.localeCompare(right.name)),
    [teams],
  );

  const hasActiveFilters = Boolean(selectedTeam || selectedCompetition || selectedGw);

  const competitionCounts = useMemo(() => {
    const counts = new Map<CompetitionKey, number>();
    COMPETITIONS.forEach((competition) => counts.set(competition.key, 0));
    fixtures.forEach((fixture) => {
      if (selectedTeam && !involvesTeam(fixture, selectedTeam)) {
        return;
      }
      if (selectedGw && fixture.gw !== selectedGw) {
        return;
      }
      counts.set(fixture.competitionKey, (counts.get(fixture.competitionKey) ?? 0) + 1);
    });
    return counts;
  }, [fixtures, selectedGw, selectedTeam]);

  const filteredFixtures = useMemo(
    () =>
      fixtures.filter((fixture) => {
        if (selectedCompetition && fixture.competitionKey !== selectedCompetition) {
          return false;
        }
        if (selectedTeam && !involvesTeam(fixture, selectedTeam)) {
          return false;
        }
        if (selectedGw && fixture.gw !== selectedGw) {
          return false;
        }
        return true;
      }),
    [fixtures, selectedCompetition, selectedGw, selectedTeam],
  );

  const visibleCompetitionCount = useMemo(
    () => new Set(filteredFixtures.map((fixture) => fixture.competitionKey)).size,
    [filteredFixtures],
  );

  const resolvedCount = useMemo(
    () => filteredFixtures.filter((fixture) => fixture.resolved).length,
    [filteredFixtures],
  );

  const toggleCompetition = (competitionKey: CompetitionKey) => {
    setSelectedCompetition((previous) => (previous === competitionKey ? '' : competitionKey));
  };

  const toggleTeam = (teamName: string) => {
    setSelectedTeam((previous) => (previous === teamName ? '' : teamName));
  };

  const toggleGameweek = (gw: string) => {
    setSelectedGw((previous) => (previous === gw ? '' : gw));
  };

  const clearFilters = () => {
    setSelectedTeam('');
    setSelectedCompetition('');
    setSelectedGw('');
  };

  const renderTeamCell = (teamName: string | null) => {
    if (!teamName) {
      return <span className="muted">TBD</span>;
    }
    const team = teamByName.get(teamName);
    const isDrillable = teamName !== 'BYE' && teamName !== 'TBD';

    return (
      <span className="fixtures-team-cell">
        {team ? (
          <TeamBadge
            name={team.name}
            ballColor={team.ballColor}
            ringColor={team.ringColor}
            textColor={team.textColor}
            size={20}
          />
        ) : null}
        {isDrillable ? (
          <button
            type="button"
            className={`fixtures-drill-button ${selectedTeam === teamName ? 'active' : ''}`}
            onClick={() => toggleTeam(teamName)}
          >
            {teamName}
          </button>
        ) : (
          <span>{teamName}</span>
        )}
      </span>
    );
  };

  return (
    <section className="page page-wide fixtures-explorer-page">
      <h1>All Fixtures</h1>
      <p className="muted">
        {state
          ? `${state.currentSeason} ${state.currentGw} • Browse every loaded league and cup fixture, then drill into team, competition, or gameweek.`
          : 'Loading fixtures explorer...'}
      </p>

      {error && <p className="muted" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="fixtures-summary-grid">
        {COMPETITIONS.map((competition) => {
          const count = competitionCounts.get(competition.key) ?? 0;
          const disabled = count === 0 && selectedCompetition !== competition.key;
          return (
            <button
              key={competition.key}
              type="button"
              className={`fixtures-summary-card ${selectedCompetition === competition.key ? 'active' : ''}`}
              onClick={() => toggleCompetition(competition.key)}
              disabled={disabled}
            >
              <span>{competition.label}</span>
              <strong>{count}</strong>
              <small>{competition.description}</small>
            </button>
          );
        })}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Drill-Down Filters</h3>
          <div className="fixtures-panel-actions">
            <button type="button" className="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? 'Loading...' : 'Reload'}
            </button>
            <button type="button" className="secondary" onClick={clearFilters} disabled={!hasActiveFilters}>
              Clear Filters
            </button>
          </div>
        </div>

        <div className="fixtures-filter-grid">
          <label className="fixtures-filter-field">
            <span>Team</span>
            <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
              <option value="">All teams</option>
              {teamOptions.map((team) => (
                <option key={`fixture-team-${team.id}`} value={team.name}>{team.name}</option>
              ))}
            </select>
          </label>

          <label className="fixtures-filter-field">
            <span>League / Cup</span>
            <select
              value={selectedCompetition}
              onChange={(event) => setSelectedCompetition(event.target.value as CompetitionKey | '')}
            >
              <option value="">All leagues and cups</option>
              {COMPETITIONS.map((competition) => (
                <option key={`fixture-competition-${competition.key}`} value={competition.key}>{competition.label}</option>
              ))}
            </select>
          </label>

          <label className="fixtures-filter-field">
            <span>Gameweek</span>
            <select value={selectedGw} onChange={(event) => setSelectedGw(event.target.value)}>
              <option value="">All gameweeks</option>
              {gameweekOptions.map((gw) => (
                <option key={`fixture-gw-${gw}`} value={gw}>{gw}</option>
              ))}
            </select>
          </label>
        </div>

        {hasActiveFilters ? (
          <div className="fixtures-active-filters">
            {selectedTeam && (
              <button type="button" className="fixtures-filter-chip" onClick={() => setSelectedTeam('')}>
                Team: {selectedTeam}
              </button>
            )}
            {selectedCompetition && (
              <button type="button" className="fixtures-filter-chip" onClick={() => setSelectedCompetition('')}>
                League / Cup: {COMPETITION_LABELS[selectedCompetition]}
              </button>
            )}
            {selectedGw && (
              <button type="button" className="fixtures-filter-chip" onClick={() => setSelectedGw('')}>
                Gameweek: {selectedGw}
              </button>
            )}
          </div>
        ) : null}

        <p className="muted fixtures-drill-hint">
          Click a competition, team, or gameweek anywhere in the table to drill into it instantly.
        </p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Fixture List</h3>
          <p className="muted fixtures-results-meta">
            {filteredFixtures.length} fixture{filteredFixtures.length === 1 ? '' : 's'} showing
            {' '}•{' '}
            {visibleCompetitionCount} competition{visibleCompetitionCount === 1 ? '' : 's'}
            {' '}•{' '}
            {resolvedCount} resolved
          </p>
        </div>

        {loading && fixtures.length === 0 ? (
          <p className="muted">Loading fixture feeds...</p>
        ) : filteredFixtures.length === 0 ? (
          <p className="muted">No fixtures match the current filters.</p>
        ) : (
          <div className="table-scroll">
            <table className="scoreboard-table">
              <thead>
                <tr>
                  <th>League / Cup</th>
                  <th>Detail</th>
                  <th>GW</th>
                  <th>Home</th>
                  <th>Score</th>
                  <th>Away</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredFixtures.map((fixture) => (
                  <tr key={fixture.key}>
                    <td>
                      <button
                        type="button"
                        className={`fixtures-drill-button ${selectedCompetition === fixture.competitionKey ? 'active' : ''}`}
                        onClick={() => toggleCompetition(fixture.competitionKey)}
                      >
                        {fixture.competitionLabel}
                      </button>
                    </td>
                    <td>{fixture.subgroupLabel}</td>
                    <td>
                      <button
                        type="button"
                        className={`fixtures-drill-button ${selectedGw === fixture.gw ? 'active' : ''}`}
                        onClick={() => toggleGameweek(fixture.gw)}
                      >
                        {fixture.gw}
                      </button>
                    </td>
                    <td>{renderTeamCell(fixture.homeTeam)}</td>
                    <td className="fixtures-score-cell">
                      <span className={`fixtures-score ${fixture.resolved ? 'resolved' : 'pending'}`}>{fixture.scoreLabel}</span>
                    </td>
                    <td>{renderTeamCell(fixture.awayTeam)}</td>
                    <td className="fixtures-status-cell">{fixture.outcomeLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
