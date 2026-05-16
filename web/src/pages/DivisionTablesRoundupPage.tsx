import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DivisionTablesRoundup } from '../components/roundup/DivisionTablesRoundup';
import type {
  DivisionKey,
  RoundupAllTimePayload,
  RoundupCupFixture,
  RoundupFixture,
  RoundupHistoryRow,
  RoundupMasterCupFixture,
  RoundupMasterLeagueFixture,
  RoundupMasterLeagueRow,
  RoundupShowSelection,
  RoundupSuperCupFixture,
  RoundupTableRow,
  RoundupTeamPredictionRace,
  RoundupTeam,
  RoundupTrioLeagueFixture,
  RoundupTrioLeagueRow,
} from '../components/roundup/roundupTypes';
import { api } from '../lib/api';
import { recoverCupFixturesFromEntries } from '../lib/cupScoreRecovery';

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];
const DEFAULT_SELECTION: RoundupShowSelection = {
  primary: 'full',
  league: 'all',
  division: 'all',
  cup: 'all',
  spotlight: 'all',
};
const DIVISION_KEYS = new Set<DivisionKey>(['champions', 'premier', 'division-one', 'division-two', 'division-three', 'division-four']);

function parseSelection(searchParams: URLSearchParams): RoundupShowSelection {
  const primary = searchParams.get('primary');
  const league = searchParams.get('league');
  const division = searchParams.get('division');
  const cup = searchParams.get('cup');
  const spotlight = searchParams.get('spotlight');

  return {
    primary: primary === 'leagues' || primary === 'cups' || primary === 'spotlights' ? primary : 'full',
    league: league === 'divisions' || league === 'master' || league === 'trio' || league === 'all-time' ? league : 'all',
    division: division && DIVISION_KEYS.has(division as DivisionKey) ? (division as DivisionKey) : 'all',
    cup: cup === 'super-cup' || cup === 'bookieball' || cup === 'master-cup' ? cup : 'all',
    spotlight: spotlight === 'champions' || (spotlight && DIVISION_KEYS.has(spotlight as DivisionKey))
      ? (spotlight as RoundupShowSelection['spotlight'])
      : 'all',
  };
}

function seasonSortValue(season: string): number {
  const match = season.match(/s\s*(\d+)/i);
  if (!match?.[1]) {
    return 0;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

type RoundupPayload = {
  currentSeason: string;
  currentGw: string;
  teams: RoundupTeam[];
  leagueTable: Record<string, RoundupTableRow[]>;
  fixtures: RoundupFixture[];
  cupFixtures: RoundupCupFixture[];
  superCupFixtures: RoundupSuperCupFixture[];
  masterCupFixtures: RoundupMasterCupFixture[];
  masterLeagueRows: RoundupMasterLeagueRow[];
  masterLeagueFixtures: RoundupMasterLeagueFixture[];
  trioLeagueRows: RoundupTrioLeagueRow[];
  trioLeagueFixtures: RoundupTrioLeagueFixture[];
  allTimeLeagues: RoundupAllTimePayload | null;
  histories: Record<number, RoundupHistoryRow[]>;
  teamPredictionRaceBySeason: Record<string, Record<string, RoundupTeamPredictionRace>>;
};

async function loadRoundupPayload(): Promise<RoundupPayload> {
  const state = await api.state();
  const [teams, leagueTable, fixtures, cupFixtures, superCupFixtures, masterLeagueTable, masterLeagueFixtures, masterCupFixtures, trioLeagueTable, trioLeagueFixtures, allTimeLeagues, historyBulk, entries] = await Promise.all([
    api.teams(),
    api.leagueTable(),
    api.leagueFixtures(undefined, true, state.currentSeason),
    api.cup(undefined, state.currentSeason),
    api.superCup(state.currentSeason).catch(() => [] as RoundupSuperCupFixture[]),
    api.masterLeagueTable(),
    api.masterLeagueFixtures(undefined, true),
    api.masterCupFixtures(undefined, true).catch(() => [] as RoundupMasterCupFixture[]),
    api.trioLeagueTable(state.currentGw).catch(() => ({ gw: state.currentGw, enabled: false, table: [] as RoundupTrioLeagueRow[] })),
    api.trioLeagueFixtures(undefined, true).catch(() => [] as RoundupTrioLeagueFixture[]),
    api.allTimeLeagues().catch(() => null),
    api.teamSeasonHistoryBulk(),
    api.entries({ limit: 2000 }).catch(() => []),
  ]);
  const hydratedCupFixtures = recoverCupFixturesFromEntries(cupFixtures, entries, state.currentSeason);
  const historySeasons = Object.values(historyBulk.histories)
    .flat()
    .map((row) => row.season)
    .filter((season): season is string => /^S\d+$/i.test(season));
  const seasonsToScan = Array.from(new Set([state.currentSeason, ...historySeasons]))
    .sort((left, right) => seasonSortValue(left) - seasonSortValue(right))
    .slice(-3);

  const teamPredictionRaceEntries = await Promise.all(
    seasonsToScan.map(async (season) => {
      const [seasonLeagueFixtures, seasonCupFixtures, seasonPredictionRowsByGw] = await Promise.all([
        api.leagueFixtures(undefined, true, season).catch(() => [] as RoundupFixture[]),
        api.cup(undefined, season).catch(() => [] as RoundupCupFixture[]),
        Promise.all(
          GAMEWEEKS.map((gw) =>
            api
              .predictions(gw, season)
              .then((response) => response.predictions)
              .catch(() => []),
          ),
        ),
      ]);

      const seasonPredictionByKey = new Map<string, {
        gw: string;
        competition: 'league' | 'cup' | 'master' | 'master_cup' | 'trio' | 'tier';
        fixtureId: number;
        picker: string;
        pickOutcome: 'team' | 'draw';
        pickTeamName: string;
      }>();
      seasonPredictionRowsByGw.flat().forEach((prediction) => {
        seasonPredictionByKey.set(
          `${prediction.gw}-${prediction.competition}-${prediction.fixtureId}-${prediction.picker}`,
          prediction,
        );
      });

      const raceByTeam = new Map<string, RoundupTeamPredictionRace>();
      const ensureTeamRace = (teamName: string): RoundupTeamPredictionRace => {
        const existing = raceByTeam.get(teamName);
        if (existing) {
          return existing;
        }
        const next = { jayCorrect: 0, computerCorrect: 0, resolved: 0 };
        raceByTeam.set(teamName, next);
        return next;
      };

      seasonLeagueFixtures.forEach((fixture) => {
        if (fixture.result === 'pending') {
          return;
        }
        const winnerName =
          fixture.result === 'draw'
            ? null
            : fixture.result === 'home'
              ? fixture.homeTeam
              : fixture.awayTeam;
        [fixture.homeTeam, fixture.awayTeam].forEach((teamName) => {
          const row = ensureTeamRace(teamName);
          row.resolved += 1;
          const jayPick = seasonPredictionByKey.get(`${fixture.gw}-league-${fixture.id}-Jay`);
          if (
            jayPick
            && (
              (jayPick.pickOutcome === 'draw' && fixture.result === 'draw')
              || (jayPick.pickOutcome === 'team' && winnerName !== null && jayPick.pickTeamName === winnerName)
            )
          ) {
            row.jayCorrect += 1;
          }
          const cpuPick = seasonPredictionByKey.get(`${fixture.gw}-league-${fixture.id}-Computer`);
          if (
            cpuPick
            && (
              (cpuPick.pickOutcome === 'draw' && fixture.result === 'draw')
              || (cpuPick.pickOutcome === 'team' && winnerName !== null && cpuPick.pickTeamName === winnerName)
            )
          ) {
            row.computerCorrect += 1;
          }
        });
      });

      seasonCupFixtures.forEach((fixture) => {
        if (!fixture.winnerTeam) {
          return;
        }
        const participating = new Set(
          [fixture.homeTeam, fixture.awayTeam, fixture.winnerTeam].filter((name): name is string => Boolean(name)),
        );
        participating.forEach((teamName) => {
          const row = ensureTeamRace(teamName);
          row.resolved += 1;
          const jayPick = seasonPredictionByKey.get(`${fixture.gw}-cup-${fixture.id}-Jay`);
          if (jayPick && jayPick.pickOutcome !== 'draw' && jayPick.pickTeamName === fixture.winnerTeam) {
            row.jayCorrect += 1;
          }
          const cpuPick = seasonPredictionByKey.get(`${fixture.gw}-cup-${fixture.id}-Computer`);
          if (cpuPick && cpuPick.pickOutcome !== 'draw' && cpuPick.pickTeamName === fixture.winnerTeam) {
            row.computerCorrect += 1;
          }
        });
      });

      return [season, Object.fromEntries(raceByTeam.entries())] as const;
    }),
  );
  const teamPredictionRaceBySeason = Object.fromEntries(teamPredictionRaceEntries);

  return {
    currentSeason: state.currentSeason,
    currentGw: state.currentGw,
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      division: team.division,
      ballColor: team.ballColor ?? null,
      ringColor: team.ringColor ?? null,
      textColor: team.textColor ?? null,
      preseasonFavorite: team.preseasonFavorite,
      trendCache: team.trendCache ?? null,
    })),
    leagueTable,
    fixtures,
    cupFixtures: hydratedCupFixtures.map((fixture) => ({
      id: fixture.id,
      round: fixture.round,
      matchNumber: fixture.matchNumber,
      gw: fixture.gw,
      roundName: fixture.roundName,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      winnerTeam: fixture.winnerTeam,
      homeProfit: fixture.homeProfit,
      awayProfit: fixture.awayProfit,
      homeSpins: fixture.homeSpins,
      awaySpins: fixture.awaySpins,
      played: fixture.played,
      result: fixture.result,
      decidedBy: fixture.decidedBy,
    })),
    superCupFixtures: superCupFixtures.map((fixture) => ({
      id: fixture.id,
      season: fixture.season,
      gw: fixture.gw,
      sourceSeason: fixture.sourceSeason,
      pairingReason: fixture.pairingReason,
      pairingExplanation: fixture.pairingExplanation,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      winnerTeamId: fixture.winnerTeamId,
      winnerTeam: fixture.winnerTeam,
      runnerUpTeamId: fixture.runnerUpTeamId,
      runnerUpTeam: fixture.runnerUpTeam,
      homeProfit: fixture.homeProfit,
      awayProfit: fixture.awayProfit,
      homeSpins: fixture.homeSpins,
      awaySpins: fixture.awaySpins,
      played: fixture.played,
      result: fixture.result,
      decidedBy: fixture.decidedBy,
    })),
    masterCupFixtures,
    masterLeagueRows: (masterLeagueTable.table ?? []).map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      ballColor: row.ballColor,
      ringColor: row.ringColor,
      textColor: row.textColor,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      points: row.points,
      profit: row.profit,
      spins: row.spins,
      rank: row.rank,
    })),
    masterLeagueFixtures: masterLeagueFixtures.map((fixture) => ({
      id: fixture.id,
      gw: fixture.gw,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeProfit: fixture.homeProfit,
      awayProfit: fixture.awayProfit,
      homeSpins: fixture.homeSpins,
      awaySpins: fixture.awaySpins,
      result: fixture.result,
    })),
    trioLeagueRows: (trioLeagueTable.table ?? []).map((row) => ({
      division: row.division,
      teamId: row.teamId,
      teamName: row.teamName,
      ballColor: row.ballColor,
      ringColor: row.ringColor,
      textColor: row.textColor,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      points: row.points,
      profit: row.profit,
      spins: row.spins,
      rank: row.rank,
    })),
    trioLeagueFixtures: trioLeagueFixtures.map((fixture) => ({
      id: fixture.id,
      gw: fixture.gw,
      division: fixture.division,
      stage: fixture.stage,
      groupSlot: fixture.groupSlot,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeProfit: fixture.homeProfit,
      awayProfit: fixture.awayProfit,
      homeSpins: fixture.homeSpins,
      awaySpins: fixture.awaySpins,
      result: fixture.result,
      winnerTeamId: fixture.winnerTeamId,
    })),
    allTimeLeagues,
    histories: historyBulk.histories,
    teamPredictionRaceBySeason,
  };
}

export function DivisionTablesRoundupPage() {
  const [searchParams] = useSearchParams();
  const [payload, setPayload] = useState<RoundupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selection = useMemo(() => parseSelection(searchParams), [searchParams]);

  useEffect(() => {
    let active = true;

    const runRefresh = async (showLoading: boolean) => {
      if (showLoading && active) {
        setLoading(true);
      }
      if (!active) {
        return;
      }
      try {
        const next = await loadRoundupPayload();
        if (!active) {
          return;
        }
        setPayload(next);
        setError(null);
      } catch (fetchError) {
        if (!active) {
          return;
        }
        const message = fetchError instanceof Error ? fetchError.message : 'Unable to load division roundup data.';
        setError(message);
      } finally {
        if (showLoading && active) {
          setLoading(false);
        }
      }
    };

    void runRefresh(true);
    const timer = window.setInterval(() => {
      void runRefresh(false);
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="page news-page roundup-page ssn-root">
      <div className="ssn-header">
        {error && payload ? <p className="muted roundup-refresh-note">Live refresh warning: {error}</p> : null}
      </div>

      <div className="ssn-main">
        {loading && !payload ? (
          <p className="muted">Loading division roundup data...</p>
        ) : null}

        {!loading && !payload ? (
          <p className="muted">No roundup data available.</p>
        ) : null}

        {error && !payload ? (
          <p className="error-banner">{error}</p>
        ) : null}

        {payload ? (
          <DivisionTablesRoundup
            currentSeason={payload.currentSeason}
            currentGw={payload.currentGw}
            teams={payload.teams}
            leagueTable={payload.leagueTable}
            fixtures={payload.fixtures}
            cupFixtures={payload.cupFixtures}
            superCupFixtures={payload.superCupFixtures}
            masterCupFixtures={payload.masterCupFixtures}
            masterLeagueRows={payload.masterLeagueRows}
            masterLeagueFixtures={payload.masterLeagueFixtures}
            trioLeagueRows={payload.trioLeagueRows}
            trioLeagueFixtures={payload.trioLeagueFixtures}
            allTimeLeagues={payload.allTimeLeagues}
            histories={payload.histories}
            teamPredictionRaceBySeason={payload.teamPredictionRaceBySeason}
            selection={selection ?? DEFAULT_SELECTION}
          />
        ) : null}
      </div>
    </section>
  );
}
