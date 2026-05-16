import { useMemo } from 'react';
import type { OddsCurrentRow, OddsTeamProfile } from '../../lib/kickoffOdds';
import { buildLeagueForecastTable, type LeagueForecastRules, type LeagueForecastTrend } from '../../lib/leagueForecast';
import { buildDivisionRoundupModel } from './roundupLogic';
import { DivisionRoundupRunner } from './DivisionRoundupRunner';
import type {
  DivisionKey,
  RoundupAllTimePayload,
  RoundupCupFixture,
  RoundupForecastRow,
  RoundupFixture,
  RoundupHistoryRow,
  RoundupMasterCupFixture,
  RoundupMasterLeagueFixture,
  RoundupMasterLeagueRow,
  RoundupTableRow,
  RoundupTeamPredictionRace,
  RoundupTeam,
  RoundupShowSelection,
  RoundupSuperCupFixture,
  RoundupTrioLeagueFixture,
  RoundupTrioLeagueRow,
} from './roundupTypes';

type DivisionTablesRoundupProps = {
  currentSeason: string;
  currentGw: string;
  teams: RoundupTeam[];
  leagueTable: Record<string, RoundupTableRow[]>;
  fixtures: RoundupFixture[];
  histories: Record<number, RoundupHistoryRow[]>;
  cupFixtures: RoundupCupFixture[];
  superCupFixtures: RoundupSuperCupFixture[];
  masterCupFixtures: RoundupMasterCupFixture[];
  masterLeagueRows: RoundupMasterLeagueRow[];
  masterLeagueFixtures: RoundupMasterLeagueFixture[];
  trioLeagueRows: RoundupTrioLeagueRow[];
  trioLeagueFixtures: RoundupTrioLeagueFixture[];
  allTimeLeagues: RoundupAllTimePayload | null;
  teamPredictionRaceBySeason: Record<string, Record<string, RoundupTeamPredictionRace>>;
  selection: RoundupShowSelection;
};

function toOddsCurrentRow(row: {
  teamId: number;
  teamName: string;
  rank: number;
  played: number;
  points: number;
  profit: number;
  spins: number;
  wins: number;
  draws: number;
  losses: number;
}): OddsCurrentRow {
  return {
    teamId: row.teamId,
    teamName: row.teamName,
    rank: row.rank,
    played: row.played,
    points: row.points,
    profit: row.profit,
    spins: row.spins,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
  };
}

function buildDivisionForecastRules(division: string, teamCount: number): LeagueForecastRules {
  const normalized = division.trim().toLowerCase();
  return {
    titlePositions: [1],
    topHalfCutoff: Math.max(1, Math.ceil(teamCount / 2)),
    bottomPositions: [teamCount],
    promotionPositions: normalized.includes('champion') ? [] : [1],
    relegationPositions: [teamCount],
  };
}

function buildMasterForecastRules(teamCount: number): LeagueForecastRules {
  return {
    titlePositions: [1],
    topHalfCutoff: Math.max(1, Math.ceil(teamCount / 2)),
    bottomPositions: [teamCount],
  };
}

function buildTrioForecastRules(division: string, teamCount: number): LeagueForecastRules {
  if (division === 'Premier League') {
    return {
      titlePositions: [1],
      topHalfCutoff: Math.max(1, Math.ceil(teamCount / 2)),
      bottomPositions: [teamCount],
      relegationPositions: [7, 8].filter((position) => position <= teamCount),
    };
  }
  if (division === 'Ligue 1') {
    return {
      titlePositions: [1],
      topHalfCutoff: Math.max(1, Math.ceil(teamCount / 2)),
      bottomPositions: [teamCount],
      promotionPositions: [1],
      playoffPositions: [2, 3, 4, 5].filter((position) => position <= teamCount),
      relegationPositions: [7, 8].filter((position) => position <= teamCount),
    };
  }
  return {
    titlePositions: [1],
    topHalfCutoff: Math.max(1, Math.ceil(teamCount / 2)),
    bottomPositions: [teamCount],
    promotionPositions: [1],
    playoffPositions: [2, 3, 4, 5].filter((position) => position <= teamCount),
  };
}

export function DivisionTablesRoundup({
  currentSeason,
  currentGw,
  teams,
  leagueTable,
  fixtures,
  histories,
  cupFixtures,
  superCupFixtures,
  masterCupFixtures,
  masterLeagueRows,
  masterLeagueFixtures,
  trioLeagueRows,
  trioLeagueFixtures,
  allTimeLeagues,
  teamPredictionRaceBySeason,
  selection,
}: DivisionTablesRoundupProps) {
  const teamIdByName = useMemo(() => new Map(teams.map((team) => [team.name, team.id])), [teams]);
  const profilesByTeamId = useMemo(
    () => new Map<number, OddsTeamProfile>(
      teams.map((team) => [
        team.id,
        {
          teamId: team.id,
          teamName: team.name,
          preseasonFavorite: team.preseasonFavorite,
          history: histories[team.id] ?? [],
        },
      ]),
    ),
    [histories, teams],
  );
  const trendsByTeamId = useMemo(
    () => new Map<number, LeagueForecastTrend>(teams.map((team) => [team.id, team.trendCache ?? null])),
    [teams],
  );
  const model = buildDivisionRoundupModel({
    currentSeason,
    currentGw,
    teams,
    leagueTable,
    fixtures,
    histories,
    cupFixtures,
  });

  const visibleDivisions = model.divisions.filter((division) => division.tableRows.length > 0);
  const divisionForecastsByKey = useMemo(() => {
    const forecasts: Partial<Record<DivisionKey, RoundupForecastRow[]>> = {};

    visibleDivisions.forEach((division) => {
      const rows = division.tableRows
        .slice()
        .sort((left, right) => left.rank - right.rank)
        .map(toOddsCurrentRow);
      const divisionSourceName = division.tableRows[0]?.division ?? division.title;
      const remainingFixtures = fixtures
        .filter((fixture) => (
          fixture.division === divisionSourceName
          && fixture.result === 'pending'
          && /^GW[1-7]$/i.test(fixture.gw)
        ))
        .map((fixture) => {
          const homeTeamId = teamIdByName.get(fixture.homeTeam) ?? null;
          const awayTeamId = teamIdByName.get(fixture.awayTeam) ?? null;
          if (!homeTeamId || !awayTeamId) {
            return null;
          }
          return {
            id: fixture.id,
            homeTeamId,
            awayTeamId,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
          };
        })
        .filter((fixtureRow): fixtureRow is NonNullable<typeof fixtureRow> => fixtureRow !== null);

      forecasts[division.key] = Array.from(
        buildLeagueForecastTable({
          rows,
          profilesByTeamId,
          trendsByTeamId,
          remainingFixtures,
          rules: buildDivisionForecastRules(divisionSourceName, rows.length),
          seedKey: `ssn:${currentSeason}:${currentGw}:${division.key}`,
        }).values(),
      );
    });

    return forecasts;
  }, [currentGw, currentSeason, fixtures, profilesByTeamId, teamIdByName, trendsByTeamId, visibleDivisions]);
  const masterLeagueForecast = useMemo(() => {
    const rows = masterLeagueRows.slice().sort((left, right) => left.rank - right.rank).map(toOddsCurrentRow);
    if (rows.length === 0) {
      return [];
    }
    const remainingFixtures = masterLeagueFixtures
      .filter((fixture) => fixture.result === 'pending')
      .map((fixture) => ({
        id: fixture.id,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
      }));
    return Array.from(
      buildLeagueForecastTable({
        rows,
        profilesByTeamId,
        trendsByTeamId,
        remainingFixtures,
        rules: buildMasterForecastRules(rows.length),
        seedKey: `ssn:${currentSeason}:${currentGw}:master`,
      }).values(),
    );
  }, [currentGw, currentSeason, masterLeagueFixtures, masterLeagueRows, profilesByTeamId, trendsByTeamId]);
  const trioForecastsByDivision = useMemo(() => {
    const forecasts: Record<string, RoundupForecastRow[]> = {};
    const trioDivisions = Array.from(new Set(trioLeagueRows.map((row) => row.division)));
    trioDivisions.forEach((division) => {
      const rows = trioLeagueRows
        .filter((row) => row.division === division)
        .slice()
        .sort((left, right) => left.rank - right.rank)
        .map(toOddsCurrentRow);
      if (rows.length === 0) {
        return;
      }
      const remainingFixtures = trioLeagueFixtures
        .filter((fixture) => fixture.division === division && fixture.stage === 'regular' && fixture.result === 'pending')
        .map((fixture) => ({
          id: fixture.id,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
        }));
      forecasts[division] = Array.from(
        buildLeagueForecastTable({
          rows,
          profilesByTeamId,
          trendsByTeamId,
          remainingFixtures,
          rules: buildTrioForecastRules(division, rows.length),
          seedKey: `ssn:${currentSeason}:${currentGw}:trio:${division}`,
        }).values(),
      );
    });
    return forecasts;
  }, [currentGw, currentSeason, profilesByTeamId, trioLeagueFixtures, trioLeagueRows, trendsByTeamId]);
  const selectionToken = [selection.primary, selection.league, selection.division, selection.cup, selection.spotlight].join('|');

  return (
    <DivisionRoundupRunner
      currentSeason={currentSeason}
      currentGw={currentGw}
      cycleAnchor={`${currentSeason}|${currentGw}|${selectionToken}`}
      divisions={visibleDivisions}
      previousChampions={model.previousChampions}
      championsSpotlight={model.championsSpotlight}
      cupSegment={model.cupSegment}
      superCupFixtures={superCupFixtures}
      masterCupFixtures={masterCupFixtures}
      teams={teams}
      fixtures={fixtures}
      histories={histories}
      masterLeagueRows={masterLeagueRows}
      masterLeagueFixtures={masterLeagueFixtures}
      masterLeagueForecast={masterLeagueForecast}
      trioLeagueRows={trioLeagueRows}
      trioLeagueFixtures={trioLeagueFixtures}
      trioForecastsByDivision={trioForecastsByDivision}
      divisionForecastsByKey={divisionForecastsByKey}
      allTimeLeagues={allTimeLeagues}
      teamPredictionRaceBySeason={teamPredictionRaceBySeason}
      selection={selection}
    />
  );
}
