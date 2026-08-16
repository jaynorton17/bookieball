import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DivisionRaceMeter } from '../components/broadcast/DivisionRaceMeter';
import { ShockResultCard } from '../components/broadcast/ShockResultCard';
import { StorylineSlide } from '../components/broadcast/StorylineSlide';
import { PredictionTrendChart } from '../components/PredictionTrendChart';
import { SnyNewsLayout } from '../components/sny-news-new/SnyNewsLayout';
import { SnyJourneyMotionGraphic } from '../components/sny-news-new/SnyJourneyMotionGraphic';
import type { SnyNewsPackage, SnyNewsSpotlightItem } from '../components/sny-news-new/types';
import type { SsnDivisionJourneyTeam } from '../components/SsnDivisionJourneyChart';
import { StudioTableCarousel, type StudioTableDivision, type StudioTableRow } from '../components/StudioTableCarousel';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { displayDivisionName, getDivisionOrderForSeason } from '../lib/divisionLabels';

const warnedUnknownDivisionNames = new Set<string>();
let warnedMissingDivisionName = false;

const CORE_CLOCK_PACKAGE_IDS = new Set([
  'news-lead',
  'division-champions',
  'master-league-watch',
  'super-cup-watch',
  'cup-watch',
  'team-spotlight-feature',
]);

const SNY_CLOCK_ORDER = [
  'news-lead',
  'division-champions',
  'master-league-watch',
  'super-cup-watch',
  'division-premier',
  'cup-watch',
  'division-struggling',
  'rivalry-desk',
  'division-awful',
  'prediction-desk',
  'team-spotlight-feature',
  'division-division-4',
  'master-cup-watch',
  'archive-focus',
  'trio-league-watch',
];

type ApiState = Awaited<ReturnType<typeof api.state>>;
type ApiTeams = Awaited<ReturnType<typeof api.teams>>;
type ApiTeamTrends = Awaited<ReturnType<typeof api.teamTrends>>;
type ApiLeagueTable = Awaited<ReturnType<typeof api.leagueTable>>;
type ApiLeagueMovement = Awaited<ReturnType<typeof api.leagueMovement>>;
type ApiLeagueFixtures = Awaited<ReturnType<typeof api.leagueFixtures>>;
type ApiCupStatus = Awaited<ReturnType<typeof api.cupStatus>>;
type ApiCup = Awaited<ReturnType<typeof api.cup>>;
type ApiSuperCupFixtures = Awaited<ReturnType<typeof api.superCup>>;
type ApiReportPack = Awaited<ReturnType<typeof api.reportPack>>;
type ApiAllTime = Awaited<ReturnType<typeof api.allTimeLeagues>>;
type ApiBookieDor = Awaited<ReturnType<typeof api.bookieDor>>;
type ApiMasterLeagueTable = Awaited<ReturnType<typeof api.masterLeagueTable>>;
type ApiMasterLeagueFixtures = Awaited<ReturnType<typeof api.masterLeagueFixtures>>;
type ApiMasterCupFixtures = Awaited<ReturnType<typeof api.masterCupFixtures>>;
type ApiTrioLeagueTable = Awaited<ReturnType<typeof api.trioLeagueTable>>;
type ApiTrioLeagueFixtures = Awaited<ReturnType<typeof api.trioLeagueFixtures>>;

type DashboardData = {
  state: ApiState;
  teams: ApiTeams;
  trends: ApiTeamTrends;
  leagueTable: ApiLeagueTable;
  leagueMovement: ApiLeagueMovement;
  leagueFixtures: ApiLeagueFixtures;
  cupStatus: ApiCupStatus;
  cupFixtures: ApiCup;
  superCupFixtures: ApiSuperCupFixtures;
  reportPack: ApiReportPack;
  allTime: ApiAllTime;
  bookieDor: ApiBookieDor;
  masterLeague: ApiMasterLeagueTable;
  masterLeagueFixtures: ApiMasterLeagueFixtures;
  masterCupFixtures: ApiMasterCupFixtures;
  trioLeague: ApiTrioLeagueTable;
  trioLeagueFixtures: ApiTrioLeagueFixtures;
};

type SnyStudioDivision = StudioTableDivision & {
  sourceTitle: string;
};

type JourneyBundle = {
  division: string;
  sourceDivision?: string;
  teams: SsnDivisionJourneyTeam[];
  gwNumbers: number[];
};

type ShockResult = {
  winner: string;
  loser: string;
  sourceDivision: string;
  division: string;
  gw: string;
  rankGap: number;
  profitMargin: number;
};

type CompactRow = {
  key: string;
  label: string;
  value: string;
  note?: string;
  teamName?: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
};

type TeamStoryContext = {
  teamId: number | null;
  teamName: string;
  division: string | null;
  rank: number | null;
  points: number | null;
  profit: number | null;
  movement: number | null;
  trendPoints: number | null;
  trendProfit: number | null;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
};

const DESK_IDENTITY_COLORS: Record<string, { ballColor: string; ringColor: string; textColor: string }> = {
  Jay: {
    ballColor: '#89d9ff',
    ringColor: '#0f3042',
    textColor: '#0d2030',
  },
  Computer: {
    ballColor: '#dbc2ff',
    ringColor: '#35214d',
    textColor: '#1d1332',
  },
};

type CupStoryFeature = {
  angleLabel: string;
  family: string;
  headline: string;
  detail: string;
  stakes: string;
  supportTitle: string;
  supportCopy: string;
  roundName: string;
  gw: string;
  stamp: string;
  tone: 'positive' | 'warning' | 'neutral';
  home: TeamStoryContext | null;
  away: TeamStoryContext | null;
  featuredTeam: TeamStoryContext | null;
  metrics: Array<{ label: string; value: string }>;
};

function buildDeskIdentityContext(name: string): TeamStoryContext {
  const palette = DESK_IDENTITY_COLORS[name] ?? {
    ballColor: '#ffd97a',
    ringColor: '#352814',
    textColor: '#20180a',
  };
  return {
    teamId: null,
    teamName: name,
    division: null,
    rank: null,
    points: null,
    profit: null,
    movement: null,
    trendPoints: null,
    trendProfit: null,
    ballColor: palette.ballColor,
    ringColor: palette.ringColor,
    textColor: palette.textColor,
  };
}

function resolveDivisionDisplayName(division: string | null | undefined): string {
  if (!division) {
    if (!warnedMissingDivisionName) {
      warnedMissingDivisionName = true;
      console.warn('[SSN] Missing division name in Sky Sports News New.');
    }
    return 'Unknown Division';
  }
  const normalized = division.trim();
  const displayName = displayDivisionName(normalized).trim().replace(/\s+Bookies$/i, '').trim();
  if (displayName) {
    return displayName;
  }
  if (!warnedUnknownDivisionNames.has(normalized)) {
    warnedUnknownDivisionNames.add(normalized);
    console.warn(`[SSN] Unknown division name "${normalized}" in Sky Sports News New. Rendering as Unknown Division.`);
  }
  return 'Unknown Division';
}

function formatMovement(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || delta === 0) {
    return 'Flat';
  }
  return delta > 0 ? `Up ${delta}` : `Down ${Math.abs(delta)}`;
}

function gwToNumber(gw: string): number {
  const parsed = Number(String(gw).replace('GW', ''));
  return Number.isFinite(parsed) ? parsed : 99;
}

function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function formatPointsDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '0 pts';
  }
  return `${value > 0 ? '+' : ''}${value} pts`;
}

function formatOptionalRank(value: number | null | undefined): string {
  return value !== null && value !== undefined ? `#${value}` : '';
}

function formatOptionalValue(value: number | null | undefined): string {
  return value !== null && value !== undefined ? `${value}` : '';
}

function formatOptionalSigned(value: number | null | undefined): string {
  return value !== null && value !== undefined ? formatSigned(value) : '';
}

function formatOptionalPointsDelta(value: number | null | undefined): string {
  return value !== null && value !== undefined ? formatPointsDelta(value) : '';
}

function formatOptionalMovement(value: number | null | undefined): string {
  return value !== null && value !== undefined ? formatMovement(value) : '';
}

function formatGapFromLeader(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'Level';
  }
  if (value <= 0) {
    return 'Level';
  }
  return `-${value} pts`;
}

function trendMarker(delta: number | null | undefined): 'up' | 'down' | 'flat' {
  if (delta === null || delta === undefined || delta === 0) {
    return 'flat';
  }
  return delta > 0 ? 'up' : 'down';
}

function trendGlyph(marker: 'up' | 'down' | 'flat'): string {
  if (marker === 'up') {
    return '▲';
  }
  if (marker === 'down') {
    return '▼';
  }
  return '●';
}

function roundPriority(roundName: string | null | undefined): number {
  const normalized = (roundName ?? '').toLowerCase();
  if (normalized.includes('final') && !normalized.includes('third')) {
    return 5;
  }
  if (normalized.includes('semi')) {
    return 4;
  }
  if (normalized.includes('quarter')) {
    return 3;
  }
  if (normalized.includes('16')) {
    return 2;
  }
  if (normalized.includes('32')) {
    return 1;
  }
  return 0;
}

function sortDivisionRows(left: StudioTableRow, right: StudioTableRow): number {
  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }
  if (right.points !== left.points) {
    return right.points - left.points;
  }
  if (right.profit !== left.profit) {
    return right.profit - left.profit;
  }
  if (right.spins !== left.spins) {
    return right.spins - left.spins;
  }
  if (right.wins !== left.wins) {
    return right.wins - left.wins;
  }
  return left.teamName.localeCompare(right.teamName);
}

function orderDivisions(divisions: string[], season: string): string[] {
  const sourceOrder = new Map(getDivisionOrderForSeason(season).map((division, index) => [division, index] as const));
  const known = divisions
    .filter((division) => sourceOrder.has(division as never))
    .slice()
    .sort((left, right) => {
      const leftIndex = sourceOrder.get(left as never) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = sourceOrder.get(right as never) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return resolveDivisionDisplayName(left).localeCompare(resolveDivisionDisplayName(right));
    });
  const extra = divisions
    .filter((division) => !sourceOrder.has(division as never))
    .sort((left, right) => left.localeCompare(right));
  return [...known, ...extra];
}

function buildSnyDivisionId(sourceDivision: string): string {
  return sourceDivision
    .trim()
    .replace(/\s+Bookies$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function finalizeClockPackages(packages: SnyNewsPackage[]): SnyNewsPackage[] {
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg] as const));
  const orderedIds = new Set<string>();
  const ordered = SNY_CLOCK_ORDER
    .map((id) => {
      const pkg = byId.get(id) ?? null;
      if (pkg) {
        orderedIds.add(id);
      }
      return pkg;
    })
    .filter((pkg): pkg is SnyNewsPackage => pkg !== null);
  const extras = packages.filter((pkg) => !orderedIds.has(pkg.id));

  return [...ordered, ...extras].map((pkg) => ({
    ...pkg,
    clockPriority: CORE_CLOCK_PACKAGE_IDS.has(pkg.id)
      ? 'core'
      : pkg.id === 'loading' || pkg.id === 'fallback'
        ? 'fallback'
        : 'support',
    repeatWeight: CORE_CLOCK_PACKAGE_IDS.has(pkg.id) ? 2 : 1,
    flagshipRepeater: CORE_CLOCK_PACKAGE_IDS.has(pkg.id),
    stages: pkg.stages.map((stage, stageIndex) => {
      if ((stage.tickerItems ?? []).length > 0) {
        return stage;
      }
      if (stageIndex !== 0 && stage.id !== 'wrap') {
        return stage;
      }
      return {
        ...stage,
        tickerItems: [`${pkg.segmentLabel}: ${stage.summary}`],
      };
    }),
  }));
}

function buildStudioDivisions(
  leagueTable: ApiLeagueTable,
  leagueMovement: ApiLeagueMovement,
  teams: ApiTeams,
  season: string,
): SnyStudioDivision[] {
  const teamById = new Map(teams.map((team) => [team.id, team] as const));
  const divisionOrder = orderDivisions(Object.keys(leagueTable), season);

  return divisionOrder
    .map((sourceDivision) => {
      const title = resolveDivisionDisplayName(sourceDivision);
      if (title === 'Unknown Division') {
        console.warn(`[SSN] Skipping division "${sourceDivision}" because it has no valid display title.`);
        return null;
      }
      const rows = (leagueTable[sourceDivision] ?? [])
        .map<StudioTableRow>((row) => {
          const team = teamById.get(row.teamId);
          const movementDelta = leagueMovement.movement[sourceDivision]?.[row.teamId] ?? 0;
          return {
            teamId: row.teamId,
            teamName: row.teamName,
            ballColor: team?.ballColor ?? null,
            ringColor: team?.ringColor ?? null,
            textColor: team?.textColor ?? null,
            rank: row.rank,
            played: row.played,
            wins: row.wins,
            draws: row.draws,
            losses: row.losses,
            points: row.points,
            profit: row.profit,
            spins: row.spins,
            record: `${row.wins}-${row.draws}-${row.losses}`,
            trend: movementDelta > 0 ? 'up' : movementDelta < 0 ? 'down' : 'flat',
            isChampion: row.rank === 1,
          };
        })
        .sort(sortDivisionRows);

      if (rows.length === 0) {
        return null;
      }

      return {
        id: buildSnyDivisionId(sourceDivision),
        sourceTitle: sourceDivision,
        title,
        subtitle: `${rows.length} teams • points, profit, spins`,
        crest: title.slice(0, 1).toUpperCase(),
        rows,
      };
    })
    .filter((division): division is SnyStudioDivision => division !== null);
}

function buildJourneyBundle(
  sourceDivision: string,
  displayDivision: string,
  divisionRows: StudioTableRow[],
  fixtures: ApiLeagueFixtures,
  teams: ApiTeams,
  maxGwNumber = 7,
): JourneyBundle | null {
  const fixturesByDivision = fixtures
    .filter((fixture) => fixture.division === sourceDivision && gwToNumber(fixture.gw) <= maxGwNumber)
    .slice()
    .sort((left, right) => gwToNumber(left.gw) - gwToNumber(right.gw));

  const gwNumbers = Array.from(new Set(fixturesByDivision.map((fixture) => gwToNumber(fixture.gw)))).sort((left, right) => left - right);
  if (divisionRows.length === 0 || gwNumbers.length === 0) {
    return null;
  }

  const teamByName = new Map(teams.map((team) => [team.name, team] as const));
  const standings = new Map(divisionRows.map((row) => [row.teamName, {
    teamId: row.teamId,
    teamName: row.teamName,
    ballColor: row.ballColor,
    ringColor: row.ringColor,
    textColor: row.textColor,
    points: 0,
    profit: 0,
    spins: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    ranks: [] as number[],
  }]));

  gwNumbers.forEach((gwNumber) => {
    fixturesByDivision
      .filter((fixture) => gwToNumber(fixture.gw) === gwNumber && fixture.result !== 'pending')
      .forEach((fixture) => {
        const home = standings.get(fixture.homeTeam);
        const away = standings.get(fixture.awayTeam);
        if (!home || !away) {
          return;
        }

        home.profit += fixture.homeProfit;
        away.profit += fixture.awayProfit;
        home.spins += fixture.homeSpins;
        away.spins += fixture.awaySpins;

        if (fixture.result === 'home') {
          home.points += 3;
          home.wins += 1;
          away.losses += 1;
        } else if (fixture.result === 'away') {
          away.points += 3;
          away.wins += 1;
          home.losses += 1;
        } else if (fixture.result === 'draw') {
          home.points += 1;
          away.points += 1;
          home.draws += 1;
          away.draws += 1;
        }
      });

    const ranked = Array.from(standings.values()).sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      if (right.profit !== left.profit) {
        return right.profit - left.profit;
      }
      if (right.spins !== left.spins) {
        return right.spins - left.spins;
      }
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      return left.teamName.localeCompare(right.teamName);
    });

    ranked.forEach((row, index) => {
      row.ranks.push(index + 1);
    });
  });

  const journeyTeams = Array.from(standings.values())
    .map<SsnDivisionJourneyTeam>((row) => {
      const team = teamByName.get(row.teamName);
      return {
        teamId: row.teamId,
        teamName: row.teamName,
        ballColor: team?.ballColor ?? row.ballColor ?? null,
        ringColor: team?.ringColor ?? row.ringColor ?? null,
        textColor: team?.textColor ?? row.textColor ?? null,
        ranks: row.ranks.length > 0 ? row.ranks : gwNumbers.map(() => divisionRows.length),
      };
    })
    .sort((left, right) => {
      const leftFinal = left.ranks[left.ranks.length - 1] ?? divisionRows.length;
      const rightFinal = right.ranks[right.ranks.length - 1] ?? divisionRows.length;
      return leftFinal - rightFinal || left.teamName.localeCompare(right.teamName);
    });

  if (journeyTeams.every((team) => team.ranks.length === 0)) {
    return null;
  }

  return {
    division: displayDivision,
    sourceDivision,
    teams: journeyTeams,
    gwNumbers,
  };
}

function buildMasterJourneyBundle(
  rows: ApiMasterLeagueTable['table'],
  fixtures: ApiMasterLeagueFixtures,
  teams: ApiTeams,
  maxGwNumber = 8,
): JourneyBundle | null {
  const fixturesByGw = fixtures
    .filter((fixture) => gwToNumber(fixture.gw) <= maxGwNumber)
    .slice()
    .sort((left, right) => gwToNumber(left.gw) - gwToNumber(right.gw) || left.id - right.id);

  const gwNumbers = Array.from(new Set(fixturesByGw.map((fixture) => gwToNumber(fixture.gw)))).sort((left, right) => left - right);
  if (rows.length === 0 || gwNumbers.length === 0) {
    return null;
  }

  const teamById = new Map(teams.map((team) => [team.id, team] as const));
  const standings = new Map(rows.map((row) => [row.teamId, {
    teamId: row.teamId,
    teamName: row.teamName,
    ballColor: row.ballColor,
    ringColor: row.ringColor,
    textColor: row.textColor,
    points: 0,
    profit: 0,
    spins: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    ranks: [] as number[],
  }]));

  gwNumbers.forEach((gwNumber) => {
    fixturesByGw
      .filter((fixture) => gwToNumber(fixture.gw) === gwNumber)
      .forEach((fixture) => {
        const home = standings.get(fixture.homeTeamId);
        const away = standings.get(fixture.awayTeamId);
        if (!home || !away) {
          return;
        }

        if (fixture.result !== 'pending') {
          home.profit += fixture.homeProfit;
          away.profit += fixture.awayProfit;
          home.spins += fixture.homeSpins;
          away.spins += fixture.awaySpins;

          if (fixture.result === 'home') {
            home.points += 3;
            home.wins += 1;
            away.losses += 1;
          } else if (fixture.result === 'away') {
            away.points += 3;
            away.wins += 1;
            home.losses += 1;
          } else if (fixture.result === 'draw') {
            home.points += 1;
            away.points += 1;
            home.draws += 1;
            away.draws += 1;
          }
        }
      });

    const ranked = Array.from(standings.values()).sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      if (right.profit !== left.profit) {
        return right.profit - left.profit;
      }
      if (right.spins !== left.spins) {
        return right.spins - left.spins;
      }
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      return left.teamName.localeCompare(right.teamName);
    });

    ranked.forEach((row, index) => {
      row.ranks.push(index + 1);
    });
  });

  const journeyTeams = Array.from(standings.values())
    .map<SsnDivisionJourneyTeam>((row) => {
      const team = teamById.get(row.teamId);
      return {
        teamId: row.teamId,
        teamName: row.teamName,
        ballColor: team?.ballColor ?? row.ballColor ?? null,
        ringColor: team?.ringColor ?? row.ringColor ?? null,
        textColor: team?.textColor ?? row.textColor ?? null,
        ranks: row.ranks.length > 0 ? row.ranks : gwNumbers.map(() => rows.length),
      };
    })
    .sort((left, right) => {
      const leftFinal = left.ranks[left.ranks.length - 1] ?? rows.length;
      const rightFinal = right.ranks[right.ranks.length - 1] ?? rows.length;
      return leftFinal - rightFinal || left.teamName.localeCompare(right.teamName);
    });

  return {
    division: 'Master League',
    teams: journeyTeams,
    gwNumbers,
  };
}

function buildShockResult(studioDivisions: SnyStudioDivision[], fixtures: ApiLeagueFixtures): ShockResult | null {
  const rankMap = new Map<string, number>();
  studioDivisions.forEach((division) => {
    division.rows.forEach((row) => {
      rankMap.set(`${division.sourceTitle}:${row.teamName}`, row.rank);
    });
  });

  return fixtures
    .filter((fixture) => fixture.result === 'home' || fixture.result === 'away')
    .map((fixture) => {
      const homeRank = rankMap.get(`${fixture.division}:${fixture.homeTeam}`);
      const awayRank = rankMap.get(`${fixture.division}:${fixture.awayTeam}`);
      if (!homeRank || !awayRank) {
        return null;
      }

      const winner = fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam;
      const loser = fixture.result === 'home' ? fixture.awayTeam : fixture.homeTeam;
      const winnerRank = fixture.result === 'home' ? homeRank : awayRank;
      const loserRank = fixture.result === 'home' ? awayRank : homeRank;

      if (winnerRank <= loserRank) {
        return null;
      }

      return {
        winner,
        loser,
        sourceDivision: fixture.division,
        division: resolveDivisionDisplayName(fixture.division),
        gw: fixture.gw,
        rankGap: winnerRank - loserRank,
        profitMargin: Math.abs(fixture.homeProfit - fixture.awayProfit),
      };
    })
    .filter((fixture): fixture is ShockResult => fixture !== null)
    .sort((left, right) => right.rankGap - left.rankGap || right.profitMargin - left.profitMargin)[0] ?? null;
}

type CompactLeaderboardProps = {
  title: string;
  strap: string;
  rows: CompactRow[];
};

type TrendInsightRow = {
  key: string;
  teamName: string;
  formValue: string;
  profitValue: string;
  marker: 'up' | 'down' | 'flat';
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
};

type RaceInsight = {
  label: string;
  value: string;
  note: string;
};

type ChasePackRow = {
  key: string;
  teamName: string;
  gap: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
};

function CompactLeaderboard({ title, strap, rows }: CompactLeaderboardProps) {
  return (
    <div className="sny-news-data-card">
      <header className="sny-news-data-card-head">
        <span>{strap}</span>
        <strong>{title}</strong>
      </header>
      <div className="sny-news-data-card-body">
        {rows.slice(0, 3).map((row, index) => (
          <article key={row.key} className={`sny-news-leader-row${index === 0 ? ' is-featured' : ''}`}>
            <div className="sny-news-leader-copy">
              {row.teamName ? (
                <TeamBadge
                  name={row.teamName}
                  ballColor={row.ballColor}
                  ringColor={row.ringColor}
                  textColor={row.textColor}
                  size={28}
                />
              ) : null}
              <div>
                <strong>{row.label}</strong>
                {row.note ? <span>{row.note}</span> : null}
              </div>
            </div>
            <span className="sny-news-leader-value">{row.value}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

type TrendInsightTableProps = {
  title: string;
  strap: string;
  rows: TrendInsightRow[];
};

function TrendInsightTable({ title, strap, rows }: TrendInsightTableProps) {
  return (
    <div className="sny-news-data-card sny-news-trend-insight-table">
      <header className="sny-news-data-card-head">
        <span>{strap}</span>
        <strong>{title}</strong>
      </header>
      <div className="sny-news-data-card-body">
        {rows.slice(0, 3).map((row, index) => (
          <article key={row.key} className={`sny-news-trend-insight-row marker-${row.marker}${index === 0 ? ' is-featured' : ''}`}>
            <div className="sny-news-trend-insight-copy">
              <TeamBadge
                name={row.teamName}
                ballColor={row.ballColor}
                ringColor={row.ringColor}
                textColor={row.textColor}
                size={28}
              />
              <strong>{row.teamName}</strong>
            </div>
            <span>{row.formValue}</span>
            <span>{row.profitValue}</span>
            <span className="sny-news-trend-insight-marker">{trendGlyph(row.marker)}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

type RaceWrapBoardProps = {
  kicker: string;
  strap: string;
  headline: string;
  detail: string;
  leader: string;
  leadValue: string;
  nearestChallenger: string;
  contextRows: Array<{ label: string; value: string }>;
  chasePack: ChasePackRow[];
  insights: RaceInsight[];
  trendTitle: string;
  trendRows: TrendInsightRow[];
  highlightLabel: string;
  highlightText: string;
};

function RaceWrapBoard({
  kicker,
  strap,
  headline,
  detail,
  leader,
  leadValue,
  nearestChallenger,
  contextRows,
  chasePack,
  insights,
  trendTitle,
  trendRows,
  highlightLabel,
  highlightText,
}: RaceWrapBoardProps) {
  return (
    <div className="sny-news-race-wrap">
      <section className="sny-news-data-card sny-news-race-story-card">
        <header className="sny-news-data-card-head">
          <span>{kicker}</span>
          <strong>{strap}</strong>
        </header>
        <div className="sny-news-race-headline">
          <h3>{headline}</h3>
          <p>{detail}</p>
        </div>
        <div className="sny-news-race-context-grid">
          {contextRows.slice(0, 3).map((row, index) => (
            <article key={`${row.label}-${row.value}`} className={`sny-news-race-context-item${index === 0 ? ' is-primary' : ''}`}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </article>
          ))}
        </div>
        <section className="sny-news-race-chase-pack">
          <header>
            <span>Chase Pack</span>
            <strong>{nearestChallenger !== 'Live' ? `${nearestChallenger} lead the chase` : 'Next line'}</strong>
          </header>
          <div className="sny-news-race-chase-rows">
            {chasePack.slice(0, 3).map((row) => (
              <article key={row.key} className="sny-news-race-chase-row">
                <div className="sny-news-race-chase-copy">
                  <TeamBadge
                    name={row.teamName}
                    ballColor={row.ballColor}
                    ringColor={row.ringColor}
                    textColor={row.textColor}
                    size={24}
                  />
                  <strong>{row.teamName}</strong>
                </div>
                <span>{row.gap}</span>
              </article>
            ))}
          </div>
        </section>
        <div className="sny-news-race-insights-grid">
          {insights.slice(0, 2).map((insight) => (
            <article key={`${insight.label}-${insight.value}`} className="sny-news-race-insight-card">
              <span>{insight.label}</span>
              <strong>{insight.value}</strong>
              <p>{insight.note}</p>
            </article>
          ))}
        </div>
      </section>
      <aside className="sny-news-competition-feature">
        <TrendInsightTable
          title={trendTitle}
          strap={leader}
          rows={trendRows}
        />
        <article className="sny-news-highlight-card">
          <span>{highlightLabel}</span>
          <strong>{leadValue}</strong>
          <p>{highlightText}</p>
        </article>
      </aside>
    </div>
  );
}

type EditorialStoryBoardProps = {
  kicker: string;
  strap: string;
  headline: string;
  detail: string;
  contextRows: Array<{ label: string; value: string }>;
  insights: RaceInsight[];
  aside: ReactNode;
};

function EditorialStoryBoard({
  kicker,
  strap,
  headline,
  detail,
  contextRows,
  insights,
  aside,
}: EditorialStoryBoardProps) {
  return (
    <div className="sny-news-race-wrap sny-news-editorial-board">
      <section className="sny-news-data-card sny-news-race-story-card">
        <header className="sny-news-data-card-head">
          <span>{kicker}</span>
          <strong>{strap}</strong>
        </header>
        <div className="sny-news-race-headline">
          <h3>{headline}</h3>
          <p>{detail}</p>
        </div>
        <div className="sny-news-race-context-grid">
          {contextRows.slice(0, 3).map((row, index) => (
            <article key={`${row.label}-${row.value}`} className={`sny-news-race-context-item${index === 0 ? ' is-primary' : ''}`}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </article>
          ))}
        </div>
        <div className="sny-news-race-insights-grid">
          {insights.slice(0, 2).map((insight) => (
            <article key={`${insight.label}-${insight.value}`} className="sny-news-race-insight-card">
              <span>{insight.label}</span>
              <strong>{insight.value}</strong>
              <p>{insight.note}</p>
            </article>
          ))}
        </div>
      </section>
      <aside className="sny-news-competition-feature">
        {aside}
      </aside>
    </div>
  );
}

type CupWatchBoardProps = {
  feature: CupStoryFeature | null;
};

type CupTeamCardProps = {
  team: TeamStoryContext | null;
  label: string;
};

function CupTeamCard({ team, label }: CupTeamCardProps) {
  if (!team) {
    return (
      <article className="sny-news-cup-team-card">
        <span className="sny-news-cup-team-role">{label}</span>
        <strong>TBD</strong>
        <p>Waiting for the knockout route to confirm this side.</p>
      </article>
    );
  }

  return (
    <article className="sny-news-cup-team-card">
      <span className="sny-news-cup-team-role">{label}</span>
      <div className="sny-news-cup-team-head">
        <TeamBadge
          name={team.teamName}
          ballColor={team.ballColor}
          ringColor={team.ringColor}
          textColor={team.textColor}
          size={34}
        />
        <div>
          <strong>{team.teamName}</strong>
          <small>
            {team.division ? resolveDivisionDisplayName(team.division) : 'Cup story'}
            {team.rank ? ` • #${team.rank}` : ''}
          </small>
        </div>
      </div>
      <div className="sny-news-cup-team-stats">
        {team.points !== null ? <span>Pts {team.points}</span> : null}
        {team.trendPoints !== null ? <span>Form {formatPointsDelta(team.trendPoints)}</span> : null}
        {team.profit !== null ? <span>Profit {formatSigned(team.profit)}</span> : null}
      </div>
    </article>
  );
}

function CupWatchBoard({ feature }: CupWatchBoardProps) {
  if (!feature) {
    return (
      <div className="sny-news-data-card">
        <header className="sny-news-data-card-head">
          <span>Cup Watch</span>
          <strong>BookieBall Cup</strong>
        </header>
        <div className="sny-news-highlight-card">
          <span>Standby</span>
          <strong>The knockout story is still loading</strong>
          <p>The cup package will switch to a featured tie or knockout shock once the bracket data is ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sny-news-cup-feature">
      <section className="sny-news-data-card sny-news-cup-story-card">
        <header className="sny-news-data-card-head">
          <span>{feature.angleLabel}</span>
          <strong>{feature.family}</strong>
        </header>
        <div className="sny-news-cup-story-copy">
          <span className="sny-news-cup-round-chip">{feature.roundName}</span>
          <h3>{feature.headline}</h3>
          <p>{feature.detail}</p>
        </div>
        <div className="sny-news-cup-matchup">
          <CupTeamCard team={feature.home} label="Home side" />
          <div className="sny-news-cup-versus">
            <span>{feature.gw}</span>
            <strong>VS</strong>
          </div>
          <CupTeamCard team={feature.away} label="Away side" />
        </div>
        <div className="sny-news-story-callouts">
          {feature.metrics.slice(0, 3).map((metric) => (
            <article key={`${metric.label}-${metric.value}`} className="sny-news-story-callout">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </section>
      <aside className="sny-news-cup-side">
        <article className="sny-news-highlight-card">
          <span>{feature.supportTitle}</span>
          <strong>{feature.stakes}</strong>
          <p>{feature.supportCopy}</p>
        </article>
        {feature.featuredTeam ? (
          <article className="sny-news-data-card compact">
            <header className="sny-news-data-card-head">
              <span>Story Focus</span>
              <strong>{feature.featuredTeam.teamName}</strong>
            </header>
            <div className="sny-news-data-card-body">
              <article className="sny-news-leader-row">
                <div className="sny-news-leader-copy">
                  <TeamBadge
                    name={feature.featuredTeam.teamName}
                    ballColor={feature.featuredTeam.ballColor}
                    ringColor={feature.featuredTeam.ringColor}
                    textColor={feature.featuredTeam.textColor}
                    size={30}
                  />
                  <div>
                    <strong>{feature.featuredTeam.division ? resolveDivisionDisplayName(feature.featuredTeam.division) : 'Cup focus'}</strong>
                    <span>{feature.featuredTeam.rank ? `League rank #${feature.featuredTeam.rank}` : 'Knockout story'}</span>
                  </div>
                </div>
                {feature.featuredTeam.points !== null ? (
                  <span className="sny-news-leader-value">{feature.featuredTeam.points} pts</span>
                ) : null}
              </article>
              <div className="sny-news-story-dual-note">
                {feature.featuredTeam.trendPoints !== null ? <span>Form {formatPointsDelta(feature.featuredTeam.trendPoints)}</span> : null}
                {feature.featuredTeam.movement !== null ? <span>{formatMovement(feature.featuredTeam.movement)}</span> : null}
                {feature.featuredTeam.profit !== null ? <span>Profit {formatSigned(feature.featuredTeam.profit)}</span> : null}
              </div>
            </div>
          </article>
        ) : null}
      </aside>
    </div>
  );
}

type KnockoutFeatureBoardProps = {
  kicker: string;
  family: string;
  angleLabel: string;
  roundName: string;
  headline: string;
  detail: string;
  supportTitle: string;
  supportLine: string;
  home: TeamStoryContext | null;
  away: TeamStoryContext | null;
  homeLabel: string;
  awayLabel: string;
  metrics: Array<{ label: string; value: string }>;
  featuredTeam?: TeamStoryContext | null;
};

function KnockoutFeatureBoard({
  kicker,
  family,
  angleLabel,
  roundName,
  headline,
  detail,
  supportTitle,
  supportLine,
  home,
  away,
  homeLabel,
  awayLabel,
  metrics,
  featuredTeam,
}: KnockoutFeatureBoardProps) {
  return (
    <div className="sny-news-cup-feature">
      <section className="sny-news-data-card sny-news-cup-story-card">
        <header className="sny-news-data-card-head">
          <span>{angleLabel}</span>
          <strong>{family}</strong>
        </header>
        <div className="sny-news-cup-story-copy">
          <span className="sny-news-cup-round-chip">{roundName || kicker}</span>
          <h3>{headline}</h3>
          <p>{detail}</p>
        </div>
        <div className="sny-news-cup-matchup">
          <CupTeamCard team={home} label={homeLabel} />
          <div className="sny-news-cup-versus">
            <span>{kicker}</span>
            <strong>VS</strong>
          </div>
          <CupTeamCard team={away} label={awayLabel} />
        </div>
        <div className="sny-news-story-callouts">
          {metrics.slice(0, 3).map((metric) => (
            <article key={`${metric.label}-${metric.value}`} className="sny-news-story-callout">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </section>
      <aside className="sny-news-competition-feature">
        <article className="sny-news-highlight-card">
          <span>{supportTitle}</span>
          <strong>{headline}</strong>
          <p>{supportLine}</p>
        </article>
        {featuredTeam ? (
          <article className="sny-news-data-card compact">
            <header className="sny-news-data-card-head">
              <span>Live Threat</span>
              <strong>{featuredTeam.teamName}</strong>
            </header>
            <div className="sny-news-data-card-body">
              <article className="sny-news-leader-row">
                <div className="sny-news-leader-copy">
                  <TeamBadge
                    name={featuredTeam.teamName}
                    ballColor={featuredTeam.ballColor}
                    ringColor={featuredTeam.ringColor}
                    textColor={featuredTeam.textColor}
                    size={30}
                  />
                  <div>
                    <strong>{featuredTeam.division ? resolveDivisionDisplayName(featuredTeam.division) : 'Knockout live'}</strong>
                    <span>{featuredTeam.rank ? `League rank #${featuredTeam.rank}` : 'Route focus'}</span>
                  </div>
                </div>
                {featuredTeam.points !== null ? (
                  <span className="sny-news-leader-value">{featuredTeam.points} pts</span>
                ) : null}
              </article>
              <div className="sny-news-story-dual-note">
                {featuredTeam.trendPoints !== null ? <span>Form {formatPointsDelta(featuredTeam.trendPoints)}</span> : null}
                {featuredTeam.movement !== null ? <span>{formatMovement(featuredTeam.movement)}</span> : null}
                {featuredTeam.profit !== null ? <span>Profit {formatSigned(featuredTeam.profit)}</span> : null}
              </div>
            </div>
          </article>
        ) : null}
      </aside>
    </div>
  );
}

type RivalryFocusBoardProps = {
  matchup: string;
  narrative: string;
  edge: string;
  record: string;
  avgMargin: string;
  nextMeeting: string;
  leftTeam: TeamStoryContext | null;
  rightTeam: TeamStoryContext | null;
};

function RivalryFocusBoard({
  matchup,
  narrative,
  edge,
  record,
  avgMargin,
  nextMeeting,
  leftTeam,
  rightTeam,
}: RivalryFocusBoardProps) {
  return (
    <div className="sny-news-cup-feature sny-news-rivalry-board">
      <section className="sny-news-data-card sny-news-cup-story-card">
        <header className="sny-news-data-card-head">
          <span>Rivalry Focus</span>
          <strong>Head-to-Head Desk</strong>
        </header>
        <div className="sny-news-cup-story-copy">
          <span className="sny-news-cup-round-chip">{edge}</span>
          <h3>{matchup}</h3>
          <p>{narrative}</p>
        </div>
        <div className="sny-news-cup-matchup">
          <CupTeamCard team={leftTeam} label="Edge holder" />
          <div className="sny-news-cup-versus">
            <span>Desk</span>
            <strong>VS</strong>
          </div>
          <CupTeamCard team={rightTeam} label="Response side" />
        </div>
        <div className="sny-news-story-callouts">
          {[
            { label: 'Record', value: record },
            { label: 'Margin', value: avgMargin },
            { label: 'Next', value: nextMeeting },
          ].map((metric) => (
            <article key={`${metric.label}-${metric.value}`} className="sny-news-story-callout">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </section>
      <aside className="sny-news-competition-feature">
        <article className="sny-news-highlight-card">
          <span>Why it matters</span>
          <strong>{edge}</strong>
          <p>{narrative}</p>
        </article>
        <article className="sny-news-data-card compact">
          <header className="sny-news-data-card-head">
            <span>Next meeting</span>
            <strong>{nextMeeting}</strong>
          </header>
          <div className="sny-news-data-card-body">
            <div className="sny-news-story-dual-note">
              <span>{leftTeam?.teamName ?? 'First side'}</span>
              <span>{rightTeam?.teamName ?? 'Second side'}</span>
              <span>{record}</span>
            </div>
          </div>
        </article>
      </aside>
    </div>
  );
}

type FixtureBoardRow = {
  id: string;
  title: string;
  context: string;
  outcome: string;
  note: string;
  tone?: 'positive' | 'warning' | 'neutral';
};

type FixtureBoardProps = {
  kicker: string;
  title: string;
  rows: FixtureBoardRow[];
  footer?: string;
};

function FixtureBoard({ kicker, title, rows, footer }: FixtureBoardProps) {
  return (
    <div className="sny-news-data-card sny-news-fixture-board">
      <header className="sny-news-data-card-head">
        <span>{kicker}</span>
        <strong>{title}</strong>
      </header>
      <div className="sny-news-data-card-body">
        {rows.map((row) => (
          <article key={row.id} className={`sny-news-fixture-row tone-${row.tone ?? 'neutral'}`}>
            <div className="sny-news-fixture-copy">
              <strong>{row.title}</strong>
              <span>{row.context}</span>
            </div>
            <div className="sny-news-fixture-meta">
              <strong>{row.outcome}</strong>
              <span>{row.note}</span>
            </div>
          </article>
        ))}
        {footer ? <p className="muted">{footer}</p> : null}
      </div>
    </div>
  );
}

type SpotlightFeatureBoardProps = {
  teamName: string;
  angleLabel: string;
  supportLine: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
  metrics: Array<{ label: string; value: string }>;
  notes: string[];
};

function SpotlightFeatureBoard({
  teamName,
  angleLabel,
  supportLine,
  ballColor,
  ringColor,
  textColor,
  metrics,
  notes,
}: SpotlightFeatureBoardProps) {
  return (
    <div className="sny-news-spotlight-feature">
      <section className="sny-news-data-card">
        <header className="sny-news-data-card-head">
          <span>{angleLabel}</span>
          <strong>Team Spotlight</strong>
        </header>
        <div className="sny-news-spotlight-feature-head">
          <TeamBadge
            name={teamName}
            ballColor={ballColor}
            ringColor={ringColor}
            textColor={textColor}
            size={62}
          />
          <div>
            <h3>{teamName}</h3>
            <p>{supportLine}</p>
          </div>
        </div>
        <div className="sny-news-story-callouts">
          {metrics.slice(0, 3).map((metric) => (
            <article key={`${metric.label}-${metric.value}`} className="sny-news-story-callout">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </section>
      <aside className="sny-news-spotlight-feature-side">
        {notes.slice(0, 1).map((note) => (
          <article key={note} className="sny-news-highlight-card">
            <span>Watch</span>
            <p>{note}</p>
          </article>
        ))}
      </aside>
    </div>
  );
}

type TrioLeadersBoardProps = {
  leaders: ApiTrioLeagueTable['table'];
  footer: string;
};

function TrioLeadersBoard({ leaders, footer }: TrioLeadersBoardProps) {
  return (
    <div className="sny-news-trio-grid">
      {leaders.map((leader) => (
        <article key={`${leader.division}-${leader.teamId}`} className="sny-news-data-card compact">
          <header className="sny-news-data-card-head">
            <span>Trio Leader</span>
            <strong>{leader.division}</strong>
          </header>
          <div className="sny-news-data-card-body">
            <article className="sny-news-leader-row">
              <div className="sny-news-leader-copy">
                <TeamBadge
                  name={leader.teamName}
                  ballColor={leader.ballColor}
                  ringColor={leader.ringColor}
                  textColor={leader.textColor}
                  size={30}
                />
                <div>
                  <strong>{leader.teamName}</strong>
                  <span>{leader.rank === 1 ? 'Division pace-setter' : `Rank #${leader.rank}`}</span>
                </div>
              </div>
              <span className="sny-news-leader-value">{leader.points} pts</span>
            </article>
            <div className="sny-news-story-dual-note">
              <span>Profit {formatSigned(leader.profit)}</span>
              <span>Played {leader.played}</span>
              <span>Spins {leader.spins}</span>
            </div>
          </div>
        </article>
      ))}
      <article className="sny-news-highlight-card">
        <span>Promotion angle</span>
        <p>{footer}</p>
      </article>
    </div>
  );
}

export function SnyNewsNewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [
          state,
          teams,
          trends,
          leagueTable,
          leagueMovement,
          leagueFixtures,
          cupStatus,
          cupFixtures,
          superCupFixtures,
          reportPack,
          allTime,
          bookieDor,
          masterLeague,
          masterLeagueFixtures,
          masterCupFixtures,
          trioLeague,
          trioLeagueFixtures,
        ] = await Promise.all([
          api.state(),
          api.teams(),
          api.teamTrends(),
          api.leagueTable(),
          api.leagueMovement(),
          api.leagueFixtures(undefined, true),
          api.cupStatus(),
          api.cup(),
          api.superCup().catch(() => [] as ApiSuperCupFixtures),
          api.reportPack(),
          api.allTimeLeagues(),
          api.bookieDor(),
          api.masterLeagueTable(),
          api.masterLeagueFixtures(undefined, true),
          api.masterCupFixtures(undefined, true),
          api.trioLeagueTable(),
          api.trioLeagueFixtures(undefined, true),
        ]);

        if (!active) {
          return;
        }

        setData({
          state,
          teams,
          trends,
          leagueTable,
          leagueMovement,
          leagueFixtures,
          cupStatus,
          cupFixtures,
          superCupFixtures,
          reportPack,
          allTime,
          bookieDor,
          masterLeague,
          masterLeagueFixtures,
          masterCupFixtures,
          trioLeague,
          trioLeagueFixtures,
        });
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to load Sky Sports News New data.');
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const studioDivisions = useMemo(
    () => (data ? buildStudioDivisions(data.leagueTable, data.leagueMovement, data.teams, data.state.currentSeason) : []),
    [data],
  );

  const primaryDivision = studioDivisions[0] ?? null;
  const reportSnapshot = data?.reportPack.snapshotCompare.divisions ?? [];
  const currentGwNumber = data ? gwToNumber(data.state.currentGw) : 0;

  const masterJourneyBundle = useMemo(() => {
    if (!data) {
      return null;
    }
    return buildMasterJourneyBundle(
      data.masterLeague.table,
      data.masterLeagueFixtures,
      data.teams,
      Math.min(8, currentGwNumber || 8),
    );
  }, [currentGwNumber, data]);

  const divisionJourneyBundles = useMemo(() => {
    if (!data) {
      return new Map<string, JourneyBundle>();
    }
    return new Map(
      studioDivisions
        .map((division) => {
          const bundle = buildJourneyBundle(
            division.sourceTitle,
            division.title,
            division.rows,
            data.leagueFixtures,
            data.teams,
            Math.min(7, currentGwNumber || 7),
          );
          return bundle ? [division.title, bundle] as const : null;
        })
        .filter((entry): entry is readonly [string, JourneyBundle] => entry !== null),
    );
  }, [currentGwNumber, data, studioDivisions]);

  const divisionSnapshotByTitle = useMemo(
    () => new Map(
      reportSnapshot.map((division) => [resolveDivisionDisplayName(division.division), division] as const),
    ),
    [reportSnapshot],
  );

  const seasonNumber = useMemo(() => {
    if (!data) {
      return 0;
    }
    const parsed = Number(String(data.state.currentSeason).replace('S', ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [data]);

  const primaryRaceBars = useMemo(
    () => (primaryDivision?.rows ?? []).slice(0, 3).map((row) => ({
      teamName: row.teamName,
      value: row.points,
      label: `${row.points} pts`,
    })),
    [primaryDivision],
  );

  const shockResult = useMemo(
    () => buildShockResult(studioDivisions, data?.leagueFixtures ?? []),
    [data?.leagueFixtures, studioDivisions],
  );

  const rivalry = data?.reportPack.rivalryDesk[0] ?? null;
  const primaryStory = data?.reportPack.story.storylines[0] ?? null;

  const archiveRows = useMemo<CompactRow[]>(() => {
    if (!data) {
      return [];
    }
    return data.allTime.pointsTable.slice(0, 4).map((row) => ({
      key: `archive-${row.teamId}`,
      label: row.teamName,
      value: `${row.points} pts`,
      note: `${row.played} played • ${formatSigned(row.profit)}`,
      teamName: row.teamName,
      ballColor: row.ballColor,
      ringColor: row.ringColor,
      textColor: row.textColor,
    }));
  }, [data]);

  const predictionDeskState = useMemo(() => {
    if (!data) {
      return null;
    }

    const totals = data.reportPack.predictionScoreboard.totals;
    const weeks = data.reportPack.predictionScoreboard.weeks;
    const jay = totals.find((row) => row.picker === 'Jay') ?? null;
    const computer = totals.find((row) => row.picker === 'Computer') ?? null;
    const deskRows = [jay, computer].filter((row): row is NonNullable<typeof row> => row !== null);
    if (deskRows.length === 0) {
      return null;
    }

    const ordered = deskRows
      .slice()
      .sort((left, right) => right.points - left.points || right.correct - left.correct || left.picker.localeCompare(right.picker));
    const leader = ordered[0] ?? null;
    const chaser = ordered[1] ?? null;
    const leaderGap = leader && chaser ? Math.max(0, leader.points - chaser.points) : null;

    const orderedWeeks = weeks
      .slice()
      .sort((left, right) => gwToNumber(left.gw) - gwToNumber(right.gw) || left.picker.localeCompare(right.picker));
    const latestWeek = orderedWeeks[orderedWeeks.length - 1]?.gw ?? null;
    const latestWeekRows = latestWeek
      ? orderedWeeks.filter((row) => row.gw === latestWeek && (row.picker === 'Jay' || row.picker === 'Computer'))
      : [];
    const latestWeekWinner = latestWeekRows
      .slice()
      .sort((left, right) => right.points - left.points || left.picker.localeCompare(right.picker))[0] ?? null;
    const latestWeekGap = latestWeekRows.length === 2 ? Math.abs(latestWeekRows[0].points - latestWeekRows[1].points) : null;

    return {
      leader,
      chaser,
      leaderGap,
      latestWeek,
      latestWeekWinner,
      latestWeekGap,
      leaderContext: leader ? buildDeskIdentityContext(leader.picker) : null,
      chaserContext: chaser ? buildDeskIdentityContext(chaser.picker) : null,
      rows: ordered.map((row) => {
        const deskContext = buildDeskIdentityContext(row.picker);
        return {
          key: `prediction-${row.picker}`,
          label: row.picker,
          value: `${row.points} pts`,
          note: `${row.correct}/${row.total} correct • ${row.perfectWeeks} perfect`,
          teamName: row.picker,
          ballColor: deskContext.ballColor,
          ringColor: deskContext.ringColor,
          textColor: deskContext.textColor,
        };
      }),
    };
  }, [data]);

  const masterLeader = data?.masterLeague.table[0] ?? null;
  const archiveLeader = data?.allTime.pointsTable[0] ?? null;

  const cupFeature = useMemo<CupStoryFeature | null>(() => {
    if (!data) {
      return null;
    }

    const teamById = new Map(data.teams.map((team) => [team.id, team] as const));
    const teamIdByName = new Map(data.teams.map((team) => [team.name.toLowerCase(), team.id] as const));
    const tableRowByTeamId = new Map<number, StudioTableRow>();
    const divisionByTeamId = new Map<number, string>();
    studioDivisions.forEach((division) => {
      division.rows.forEach((row) => {
        tableRowByTeamId.set(row.teamId, row);
        divisionByTeamId.set(row.teamId, division.title);
      });
    });

    const trendByTeamId = new Map(data.trends.trends.map((trend) => [trend.teamId, trend] as const));
    const movementByTeamId = new Map<number, number>();
    Object.values(data.leagueMovement.movement).forEach((divisionMovement) => {
      Object.entries(divisionMovement).forEach(([teamId, delta]) => {
        movementByTeamId.set(Number(teamId), delta);
      });
    });

    const buildContext = (teamName: string | null | undefined): TeamStoryContext | null => {
      if (!teamName) {
        return null;
      }
      const teamId = teamIdByName.get(teamName.toLowerCase()) ?? null;
      if (!teamId) {
        return {
          teamId: null,
          teamName,
          division: null,
          rank: null,
          points: null,
          profit: null,
          movement: null,
          trendPoints: null,
          trendProfit: null,
          ballColor: null,
          ringColor: null,
          textColor: null,
        };
      }
      const team = teamById.get(teamId);
      const row = tableRowByTeamId.get(teamId);
      const trend = trendByTeamId.get(teamId);
      return {
        teamId,
        teamName,
        division: resolveDivisionDisplayName(divisionByTeamId.get(teamId) ?? team?.division ?? null),
        rank: row?.rank ?? null,
        points: row?.points ?? null,
        profit: row?.profit ?? null,
        movement: movementByTeamId.get(teamId) ?? null,
        trendPoints: trend?.pointsDelta ?? null,
        trendProfit: trend?.profitDelta ?? null,
        ballColor: team?.ballColor ?? row?.ballColor ?? null,
        ringColor: team?.ringColor ?? row?.ringColor ?? null,
        textColor: team?.textColor ?? row?.textColor ?? null,
      };
    };

    const unresolvedFixtures = data.cupFixtures.filter((fixture) => !fixture.played && fixture.homeTeam && fixture.awayTeam);
    const resolvedFixtures = data.cupFixtures.filter((fixture) => fixture.played && fixture.homeTeam && fixture.awayTeam);

    const decorateFixture = (fixture: ApiCup[number]) => {
      const home = buildContext(fixture.homeTeam);
      const away = buildContext(fixture.awayTeam);
      const homeRank = home?.rank ?? null;
      const awayRank = away?.rank ?? null;
      const rankGap = homeRank !== null && awayRank !== null ? Math.abs(homeRank - awayRank) : 0;
      const combinedPoints = (home?.points ?? 0) + (away?.points ?? 0);
      return {
        fixture,
        home,
        away,
        rankGap,
        combinedPoints,
        roundScore: roundPriority(fixture.roundName),
        profitMargin: Math.abs(fixture.homeProfit - fixture.awayProfit),
      };
    };

    const unresolvedCandidate = unresolvedFixtures
      .map(decorateFixture)
      .sort((left, right) => (
        right.roundScore - left.roundScore
        || right.rankGap - left.rankGap
        || right.combinedPoints - left.combinedPoints
      ))[0] ?? null;

    if (unresolvedCandidate) {
      const { fixture, home, away, rankGap, roundScore } = unresolvedCandidate;
      const hasBothRanks = home !== null && away !== null && (home.rank ?? 0) !== null && (away.rank ?? 0) !== null;
      const lowerRankTeam = hasBothRanks ? ((home.rank ?? 0) > (away.rank ?? 0) ? home : away) : null;
      const higherRankTeam = hasBothRanks ? ((home.rank ?? 0) < (away.rank ?? 0) ? home : away) : null;
      const featuredTeam = rankGap >= 2
        ? lowerRankTeam ?? home ?? away
        : higherRankTeam ?? home ?? away;
      const homeForm = formatOptionalPointsDelta(home?.trendPoints) || 'Form live';
      const awayForm = formatOptionalPointsDelta(away?.trendPoints) || 'Form live';
      const sameDivision = home?.division && away?.division && home.division === away.division;
      const angleLabel = roundScore >= 4
        ? 'Cup Pressure Tie'
        : rankGap >= 2
          ? 'Cup Upset Watch'
          : sameDivision
            ? 'Cup Rivalry'
            : 'Featured Tie';
      const detail = roundScore >= 4
        ? `${fixture.roundName} puts ${fixture.homeTeam} and ${fixture.awayTeam} under direct elimination pressure.`
        : rankGap >= 2 && lowerRankTeam && higherRankTeam
          ? `${lowerRankTeam.teamName} try to flip a ${rankGap}-place league gap against ${higherRankTeam.teamName}.`
          : `${fixture.homeTeam} and ${fixture.awayTeam} are next in the knockout spotlight.`;

      return {
        angleLabel,
        family: 'BookieBall Cup',
        headline: `${fixture.homeTeam} v ${fixture.awayTeam}`,
        detail,
        stakes: `Winner stays alive in the ${fixture.roundName}; loser drops out of the cup route.`,
        supportTitle: 'Why it matters',
        supportCopy: featuredTeam
          ? `${featuredTeam.teamName} are the current cup story because this tie can shift the knockout tone of the whole rundown.`
          : 'This tie carries the most immediate knockout pressure in the current bracket.',
        roundName: fixture.roundName,
        gw: fixture.gw,
        stamp: fixture.gw,
        tone: rankGap >= 2 || roundScore >= 4 ? 'warning' : 'neutral',
        home,
        away,
        featuredTeam,
        metrics: [
          { label: 'Round', value: fixture.roundName },
          { label: rankGap > 0 ? 'Rank gap' : 'League context', value: rankGap > 0 ? `${rankGap} places` : sameDivision ? 'Same division' : 'Cross division' },
          { label: 'Form', value: `${homeForm} / ${awayForm}` },
        ],
      };
    }

    const cupShock = resolvedFixtures
      .map((fixture) => {
        const decorated = decorateFixture(fixture);
        const winner = fixture.result === 'home' ? decorated.home : decorated.away;
        const loser = fixture.result === 'home' ? decorated.away : decorated.home;
        if (!winner || !loser || winner.rank === null || loser.rank === null || winner.rank <= loser.rank) {
          return null;
        }
        return {
          ...decorated,
          winner,
          loser,
        };
      })
      .filter((fixture): fixture is NonNullable<typeof fixture> => fixture !== null)
      .sort((left, right) => (
        right.roundScore - left.roundScore
        || right.rankGap - left.rankGap
        || right.profitMargin - left.profitMargin
      ))[0] ?? null;

    if (cupShock) {
      const decidedBy = cupShock.fixture.decidedBy.replace(/_/g, ' ');
      return {
        angleLabel: 'Biggest Cup Shock',
        family: 'BookieBall Cup',
        headline: `${cupShock.winner.teamName} knock out ${cupShock.loser.teamName}`,
        detail: `${cupShock.winner.teamName} flipped a ${cupShock.rankGap}-place league gap in the ${cupShock.fixture.roundName}.`,
        stakes: `${cupShock.winner.teamName} stay alive, and that side of the cup route now belongs to the underdog story.`,
        supportTitle: 'What changed',
        supportCopy: `${cupShock.fixture.roundName} swung on ${formatSigned(cupShock.profitMargin)} and was decided by ${decidedBy}.`,
        roundName: cupShock.fixture.roundName,
        gw: cupShock.fixture.gw,
        stamp: cupShock.fixture.gw,
        tone: 'warning',
        home: cupShock.home,
        away: cupShock.away,
        featuredTeam: cupShock.winner,
        metrics: [
          { label: 'Round', value: cupShock.fixture.roundName },
          { label: 'Rank gap', value: `${cupShock.rankGap} places` },
          { label: 'Profit swing', value: formatSigned(cupShock.profitMargin) },
        ],
      };
    }

    const resolvedCandidate = resolvedFixtures
      .map(decorateFixture)
      .sort((left, right) => (
        right.roundScore - left.roundScore
        || right.profitMargin - left.profitMargin
        || right.combinedPoints - left.combinedPoints
      ))[0] ?? null;

    if (resolvedCandidate) {
      const winner = resolvedCandidate.fixture.result === 'home' ? resolvedCandidate.home : resolvedCandidate.away;
      const decidedBy = resolvedCandidate.fixture.decidedBy.replace(/_/g, ' ');
      return {
        angleLabel: 'Cup Route Watch',
        family: 'BookieBall Cup',
        headline: `${resolvedCandidate.fixture.homeTeam} v ${resolvedCandidate.fixture.awayTeam}`,
        detail: `${resolvedCandidate.fixture.roundName} has already swung, and the bracket route is now clearer on this side of the cup.`,
        stakes: `${winner?.teamName ?? 'The winner'} carry the route forward after a knockout swing decided by ${decidedBy}.`,
        supportTitle: 'Route shift',
        supportCopy: winner
          ? `${winner.teamName} are the live knockout reference after this result rewired the route on their side of the draw.`
          : 'The most recent resolved tie now defines the next cup talking point.',
        roundName: resolvedCandidate.fixture.roundName,
        gw: resolvedCandidate.fixture.gw,
        stamp: resolvedCandidate.fixture.gw,
        tone: 'neutral',
        home: resolvedCandidate.home,
        away: resolvedCandidate.away,
        featuredTeam: winner,
        metrics: [
          { label: 'Round', value: resolvedCandidate.fixture.roundName },
          { label: 'Decider', value: decidedBy },
          { label: 'Profit swing', value: formatSigned(resolvedCandidate.profitMargin) },
        ],
      };
    }

    return null;
  }, [data, studioDivisions]);

  const packages = useMemo<SnyNewsPackage[]>(() => {
    if (!data) {
      return [{
        id: 'loading',
        kicker: 'Sky Sports News New',
        headline: 'Loading newsroom loop',
        summary: 'The newsroom loop is assembling its first clean run of packages.',
        detail: 'League, cup, archive, and prediction stories are loading into the screen.',
        tags: ['Loading', 'Studio'],
        segmentKey: 'feature',
        segmentLabel: 'Newsroom Boot',
        introTitle: 'Studio system booting',
        introDetail: 'Preparing the separate Sky Sports News New rundown and loading the current analytics packages.',
        roleLabel: 'Headline',
        focusNote: 'The separate Sky Sports News New route is preparing its first editorial pass.',
        stages: [
          {
            id: 'boot',
            label: 'Boot',
            summary: 'The newsroom loop is assembling its first clean run of packages.',
            detail: 'League, cup, archive, and prediction stories are loading into the screen.',
            tags: ['Loading'],
            dwellMs: 4200,
            content: (
              <StorylineSlide
                kicker="Sky Sports News New"
                stamp="BOOTING"
                headline="Preparing the separate newsroom screen"
                detail="The new page is loading existing report, table, cup, archive, and prediction feeds."
                tone="neutral"
              />
            ),
          },
        ],
      }];
    }

    const nextPackages: SnyNewsPackage[] = [];
    const seasonStamp = `${data.state.currentSeason} • ${data.state.currentGw}`;
    const teamById = new Map(data.teams.map((team) => [team.id, team] as const));
    const teamIdByName = new Map(data.teams.map((team) => [team.name.toLowerCase(), team.id] as const));
    const tableRowByTeamId = new Map<number, StudioTableRow>();
    const divisionByTeamId = new Map<number, string>();
    const leadGapByTeamId = new Map<number, number>();
    const gapAboveByTeamId = new Map<number, number>();
    studioDivisions.forEach((division) => {
      division.rows.forEach((row, index) => {
        tableRowByTeamId.set(row.teamId, row);
        divisionByTeamId.set(row.teamId, division.title);
        const chaser = division.rows[index + 1] ?? null;
        const above = division.rows[index - 1] ?? null;
        if (index === 0) {
          leadGapByTeamId.set(row.teamId, Math.max(0, row.points - (chaser?.points ?? row.points)));
        }
        gapAboveByTeamId.set(row.teamId, above ? Math.max(0, above.points - row.points) : 0);
      });
    });

    const movementByTeamId = new Map<number, number>();
    Object.values(data.leagueMovement.movement).forEach((divisionMovement) => {
      Object.entries(divisionMovement).forEach(([teamId, delta]) => {
        movementByTeamId.set(Number(teamId), delta);
      });
    });

    const trendByTeamId = new Map(data.trends.trends.map((trend) => [trend.teamId, trend] as const));
    const masterRowByTeamId = new Map(data.masterLeague.table.map((row) => [row.teamId, row] as const));
    const masterMovementByTeamId = new Map(
      Object.entries(data.masterLeague.movement).map(([teamId, delta]) => [Number(teamId), delta] as const),
    );
    const orderedDivisions = studioDivisions.filter((division) => seasonNumber >= 5 || division.title !== 'Division 4');

    const findTeamIdByName = (teamName: string | null | undefined): number | null => {
      if (!teamName) {
        return null;
      }
      return teamIdByName.get(teamName.toLowerCase()) ?? null;
    };

    const buildTeamContext = (teamId: number | null): TeamStoryContext | null => {
      if (!teamId) {
        return null;
      }
      const team = teamById.get(teamId);
      const row = tableRowByTeamId.get(teamId);
      const trend = trendByTeamId.get(teamId);
      return {
        teamId,
        teamName: team?.name ?? row?.teamName ?? `Team ${teamId}`,
        division: resolveDivisionDisplayName(divisionByTeamId.get(teamId) ?? team?.division ?? null),
        rank: row?.rank ?? null,
        points: row?.points ?? null,
        profit: row?.profit ?? null,
        movement: movementByTeamId.has(teamId) ? movementByTeamId.get(teamId) ?? 0 : null,
        trendPoints: trend?.pointsDelta ?? null,
        trendProfit: trend?.profitDelta ?? null,
        ballColor: team?.ballColor ?? row?.ballColor ?? null,
        ringColor: team?.ringColor ?? row?.ringColor ?? null,
        textColor: team?.textColor ?? row?.textColor ?? null,
      };
    };

    const buildContextByName = (teamName: string | null | undefined): TeamStoryContext | null => {
      const teamId = findTeamIdByName(teamName);
      if (!teamId && teamName) {
        return {
          teamId: null,
          teamName,
          division: null,
          rank: null,
          points: null,
          profit: null,
          movement: null,
          trendPoints: null,
          trendProfit: null,
          ballColor: null,
          ringColor: null,
          textColor: null,
        };
      }
      return buildTeamContext(teamId);
    };

    const fallbackContext = buildTeamContext(primaryDivision?.rows[0]?.teamId ?? data.teams[0]?.id ?? null);

    const buildSpotlight = ({
      id,
      label,
      family,
      note,
      supportLine,
      tone,
      team,
      stats,
    }: {
      id: string;
      label: string;
      family: string;
      note?: string;
      supportLine: string;
      tone: SnyNewsPackage['segmentKey'];
      team: TeamStoryContext | null;
      stats: Array<{ label: string; value: string | number | null | undefined }>;
    }): SnyNewsSpotlightItem => {
      const resolvedTeam = team ?? fallbackContext;
      const preparedStats = stats
        .filter((stat) => stat.value !== null && stat.value !== undefined && String(stat.value).trim().length > 0)
        .map((stat) => ({ label: stat.label, value: String(stat.value) }))
        .slice(0, 4);
      if (preparedStats.length === 0 && resolvedTeam) {
        if (resolvedTeam.division) {
          preparedStats.push({ label: 'Division', value: resolveDivisionDisplayName(resolvedTeam.division) });
        }
        if (resolvedTeam.rank !== null) {
          preparedStats.push({ label: 'Rank', value: `#${resolvedTeam.rank}` });
        }
        if (resolvedTeam.points !== null) {
          preparedStats.push({ label: 'Points', value: `${resolvedTeam.points}` });
        }
      }
      return {
        id,
        teamId: resolvedTeam?.teamId ?? null,
        teamName: resolvedTeam?.teamName ?? 'Studio Watch',
        label,
        family,
        note,
        supportLine,
        tone,
        ballColor: resolvedTeam?.ballColor ?? null,
        ringColor: resolvedTeam?.ringColor ?? null,
        textColor: resolvedTeam?.textColor ?? null,
        stats: preparedStats.slice(0, 4),
      };
    };

    const buildTrendRows = (
      rows: Array<{
        teamId: number;
        teamName: string;
        rank: number;
        profit: number;
        points: number;
        ballColor?: string | null;
        ringColor?: string | null;
        textColor?: string | null;
      }>,
      movementMap: Map<number, number>,
    ): TrendInsightRow[] => (
      rows
        .map((row) => {
          const trend = trendByTeamId.get(row.teamId) ?? null;
          const movement = movementMap.get(row.teamId) ?? 0;
          const marker = movement !== 0 ? trendMarker(movement) : trendMarker(trend?.pointsDelta ?? 0);
          return {
            key: `trend-${row.teamId}`,
            teamName: row.teamName,
            formValue: trend ? formatPointsDelta(trend.pointsDelta) : `${row.points} pts`,
            profitValue: trend ? formatSigned(trend.profitDelta) : formatSigned(row.profit),
            marker,
            ballColor: row.ballColor ?? null,
            ringColor: row.ringColor ?? null,
            textColor: row.textColor ?? null,
            pointsDelta: trend?.pointsDelta ?? 0,
            profitDelta: trend?.profitDelta ?? 0,
            movement,
            rank: row.rank,
          };
        })
        .sort((left, right) => (
          right.pointsDelta - left.pointsDelta
          || right.profitDelta - left.profitDelta
          || right.movement - left.movement
          || left.rank - right.rank
        ))
        .slice(0, 3)
        .map(({ key, teamName, formValue, profitValue, marker, ballColor, ringColor, textColor }) => ({
          key,
          teamName,
          formValue,
          profitValue,
          marker,
          ballColor,
          ringColor,
          textColor,
        }))
    );

    const buildDivisionFormRows = (division: SnyStudioDivision) => buildTrendRows(division.rows, movementByTeamId);

    const buildDivisionChasePackRows = (division: SnyStudioDivision): ChasePackRow[] => (
      division.rows
        .slice(1, 4)
        .map((row) => ({
          key: `chase-${division.id}-${row.teamId}`,
          teamName: row.teamName,
          gap: formatGapFromLeader(leadGapByTeamId.get(row.teamId) ?? null),
          ballColor: row.ballColor,
          ringColor: row.ringColor,
          textColor: row.textColor,
        }))
    );

    const buildDivisionFixtureRows = (
      division: SnyStudioDivision,
      options?: {
        leaderName?: string | null;
        pressureName?: string | null;
        riserName?: string | null;
      },
    ): FixtureBoardRow[] => {
      const fixtures = data.leagueFixtures.filter((fixture) => fixture.division === division.sourceTitle);
      const leaderFixture = options?.leaderName
        ? fixtures.find((fixture) => fixture.homeTeam === options.leaderName || fixture.awayTeam === options.leaderName) ?? null
        : null;
      const pressureFixture = options?.pressureName
        ? fixtures.find((fixture) => fixture.homeTeam === options.pressureName || fixture.awayTeam === options.pressureName) ?? null
        : null;
      const riserFixture = options?.riserName
        ? fixtures.find((fixture) => fixture.homeTeam === options.riserName || fixture.awayTeam === options.riserName) ?? null
        : null;
      const shockFixture = shockResult && shockResult.sourceDivision === division.sourceTitle
        ? fixtures.find((fixture) => fixture.homeTeam === shockResult.winner && fixture.awayTeam === shockResult.loser) ?? null
        : null;

      const pending = fixtures
        .filter((fixture) => fixture.result === 'pending')
        .sort((left, right) => gwToNumber(left.gw) - gwToNumber(right.gw) || left.id - right.id);
      const resolved = fixtures
        .filter((fixture) => fixture.result !== 'pending')
        .sort((left, right) => (
          gwToNumber(right.gw) - gwToNumber(left.gw)
          || Math.abs(right.homeProfit - right.awayProfit) - Math.abs(left.homeProfit - left.awayProfit)
        ));

      const selected = [leaderFixture, pressureFixture, riserFixture, shockFixture]
        .filter((fixture): fixture is (typeof fixtures)[number] => fixture !== null);

      pending.forEach((fixture) => {
        if (selected.length >= 3 || selected.some((entry) => entry.id === fixture.id)) {
          return;
        }
        selected.push(fixture);
      });
      resolved.forEach((fixture) => {
        if (selected.length >= 3 || selected.some((entry) => entry.id === fixture.id)) {
          return;
        }
        selected.push(fixture);
      });

      return selected.slice(0, 3).map((fixture) => ({
        id: `division-${division.id}-${fixture.id}`,
        title: `${fixture.homeTeam} v ${fixture.awayTeam}`,
        context: `${fixture.gw} • ${resolveDivisionDisplayName(division.title)}`,
        outcome: fixture.result === 'pending'
          ? 'Next pressure line'
          : fixture.result === 'home'
            ? `${fixture.homeTeam} win`
            : fixture.result === 'away'
              ? `${fixture.awayTeam} win`
              : 'Points shared',
        note: fixture.result === 'pending'
          ? fixture.homeTeam === options?.leaderName || fixture.awayTeam === options?.leaderName
            ? 'This is the leader line that can shift the whole division picture.'
            : fixture.homeTeam === options?.pressureName || fixture.awayTeam === options?.pressureName
              ? 'This is the pressure fixture sitting closest to the line.'
              : 'This is the next live line in the division.'
          : shockResult && shockResult.sourceDivision === division.sourceTitle && fixture.homeTeam === shockResult.winner && fixture.awayTeam === shockResult.loser
            ? `Shock result in ${shockResult.gw}: ${shockResult.winner} cleared a ${shockResult.rankGap}-place gap.`
            : `Profit swing ${formatSigned(Math.abs(fixture.homeProfit - fixture.awayProfit))}.`,
        tone: fixture.result === 'pending'
          ? 'warning'
          : shockResult && shockResult.sourceDivision === division.sourceTitle && fixture.homeTeam === shockResult.winner && fixture.awayTeam === shockResult.loser
            ? 'warning'
            : 'positive',
      }));
    };

    const buildMasterFixtureRows = (): FixtureBoardRow[] => {
      const pending = data.masterLeagueFixtures
        .filter((fixture) => fixture.result === 'pending')
        .sort((left, right) => gwToNumber(left.gw) - gwToNumber(right.gw) || left.id - right.id);
      const resolved = data.masterLeagueFixtures
        .filter((fixture) => fixture.result !== 'pending')
        .sort((left, right) => gwToNumber(right.gw) - gwToNumber(left.gw) || Math.abs(right.homeProfit - right.awayProfit) - Math.abs(left.homeProfit - left.awayProfit));
      return [...pending.slice(0, 1), ...resolved.slice(0, 2)].map((fixture) => ({
        id: `master-fixture-${fixture.id}`,
        title: `${fixture.homeTeam} v ${fixture.awayTeam}`,
        context: `${fixture.gw} • Master League`,
        outcome: fixture.result === 'pending'
          ? 'Next tie'
          : fixture.result === 'home'
            ? `${fixture.homeTeam} win`
            : fixture.result === 'away'
              ? `${fixture.awayTeam} win`
              : 'Points shared',
        note: fixture.result === 'pending'
          ? 'This is the next all-field pressure point.'
          : `Profit swing ${formatSigned(Math.abs(fixture.homeProfit - fixture.awayProfit))}.`,
        tone: fixture.result === 'pending' ? 'neutral' : 'positive',
      }));
    };

    const buildCupRows = (): FixtureBoardRow[] => {
      const fixtures = data.cupFixtures.filter((fixture) => fixture.homeTeam && fixture.awayTeam);
      const pending = fixtures
        .filter((fixture) => !fixture.played)
        .sort((left, right) => roundPriority(right.roundName) - roundPriority(left.roundName) || gwToNumber(left.gw) - gwToNumber(right.gw));
      const resolved = fixtures
        .filter((fixture) => fixture.played)
        .sort((left, right) => roundPriority(right.roundName) - roundPriority(left.roundName) || Math.abs(right.homeProfit - right.awayProfit) - Math.abs(left.homeProfit - left.awayProfit));
      return [...pending.slice(0, 2), ...resolved.slice(0, 1)].map((fixture) => ({
        id: `cup-row-${fixture.id}`,
        title: `${fixture.homeTeam} v ${fixture.awayTeam}`,
        context: `${fixture.roundName} • ${fixture.gw}`,
        outcome: fixture.played ? `${fixture.winnerTeam ?? 'Winner'} advance` : 'Tie live',
        note: fixture.played ? `Decided by ${fixture.decidedBy.replace(/_/g, ' ')}.` : 'Knockout pressure is live.',
        tone: fixture.played ? 'positive' : 'warning',
      }));
    };

    const buildMasterCupRows = (feature: ApiMasterCupFixtures[number] | null): FixtureBoardRow[] => {
      const fixtures = data.masterCupFixtures.filter((fixture) => fixture.homeTeam && fixture.awayTeam);
      const selected = fixtures
        .slice()
        .sort((left, right) => {
          const leftPriority = Number(left.id === feature?.id) * 100
            + Number(!left.played) * 30
            + roundPriority(left.roundName) * 6
            + Math.abs((left.homeSeed ?? 8) - (left.awaySeed ?? 8));
          const rightPriority = Number(right.id === feature?.id) * 100
            + Number(!right.played) * 30
            + roundPriority(right.roundName) * 6
            + Math.abs((right.homeSeed ?? 8) - (right.awaySeed ?? 8));
          return rightPriority - leftPriority || left.id - right.id;
        })
        .slice(0, 3);

      return selected.map((fixture) => ({
        id: `master-cup-${fixture.id}`,
        title: `${fixture.homeTeam} v ${fixture.awayTeam}`,
        context: `${fixture.roundName} • Leg ${fixture.legNumber}`,
        outcome: fixture.played ? `${fixture.winnerTeam ?? 'Winner'} progress` : 'Tie live',
        note: fixture.played
          ? `Knockout route decided by ${fixture.decidedBy.replace(/_/g, ' ')}.`
          : `Seeds #${fixture.homeSeed ?? '-'} / #${fixture.awaySeed ?? '-'} carry the pressure.`,
        tone: fixture.played ? 'positive' : 'warning',
      }));
    };

    const buildTrioRows = (featureTeamName: string | null | undefined): FixtureBoardRow[] => {
      const sorted = data.trioLeagueFixtures
        .slice()
        .sort((left, right) => {
          const leftPriority = Number(left.homeTeam === featureTeamName || left.awayTeam === featureTeamName) * 40
            + Number(left.stage.includes('playoff')) * 25
            + Number(left.result === 'pending') * 12;
          const rightPriority = Number(right.homeTeam === featureTeamName || right.awayTeam === featureTeamName) * 40
            + Number(right.stage.includes('playoff')) * 25
            + Number(right.result === 'pending') * 12;
          return rightPriority - leftPriority
            || gwToNumber(left.gw) - gwToNumber(right.gw)
            || left.id - right.id;
        })
        .slice(0, 3);

      return sorted.map((fixture) => ({
        id: `trio-${fixture.id}`,
        title: `${fixture.homeTeam} v ${fixture.awayTeam}`,
        context: `${fixture.division} • ${fixture.stage.replace(/_/g, ' ')}`,
        outcome: fixture.result === 'pending'
          ? 'Promotion line live'
          : fixture.result === 'home'
            ? `${fixture.homeTeam} win`
            : fixture.result === 'away'
              ? `${fixture.awayTeam} win`
              : 'Points shared',
        note: fixture.result === 'pending'
          ? 'Promotion or playoff leverage sits on this line.'
          : `Profit swing ${formatSigned(Math.abs(fixture.homeProfit - fixture.awayProfit))}.`,
        tone: fixture.stage === 'playoff_final' || fixture.stage === 'playoff_semi' ? 'warning' : 'neutral',
      }));
    };

    const buildPredictionRows = (): CompactRow[] => predictionDeskState?.rows ?? [];

    const primaryLeader = primaryDivision?.rows[0] ?? null;
    const primaryChaser = primaryDivision?.rows[1] ?? null;
    const primaryLeadGap = primaryLeader && primaryChaser ? Math.max(0, primaryLeader.points - primaryChaser.points) : null;
    const primaryLeaderContext = buildTeamContext(primaryLeader?.teamId ?? null);
    const biggestRise = reportSnapshot
      .flatMap((division) => division.topRise ? [{ division: division.division, ...division.topRise }] : [])
      .sort((left, right) => right.delta - left.delta)[0] ?? null;
    const biggestDrop = reportSnapshot
      .flatMap((division) => division.topDrop ? [{ division: division.division, ...division.topDrop }] : [])
      .sort((left, right) => left.delta - right.delta)[0] ?? null;
    const biggestRiseContext = buildContextByName(biggestRise?.teamName);
    const biggestDropContext = buildContextByName(biggestDrop?.teamName);
    const primaryFormRows = primaryDivision ? buildDivisionFormRows(primaryDivision) : [];
    const primaryFormLeader = primaryFormRows[0] ?? null;
    const primaryInsights: RaceInsight[] = [
      {
        label: 'Form Leader',
        value: primaryFormLeader?.teamName ?? primaryLeader?.teamName ?? 'Live',
        note: primaryFormLeader
          ? `${primaryFormLeader.formValue} with ${primaryFormLeader.profitValue} on the current recent-form window.`
          : 'The strongest short-window side sits closest to the front page.',
      },
      {
        label: 'Fastest Climber',
        value: biggestRiseContext?.teamName ?? primaryChaser?.teamName ?? 'Live',
        note: biggestRiseContext
          ? `${formatMovement(biggestRiseContext.movement)} keeps ${biggestRiseContext.teamName} as the sharpest mover on this cycle.`
          : `${primaryChaser?.teamName ?? 'The next side'} remain closest to the live pace-setter.`,
      },
      {
        label: 'Pressure Team',
        value: biggestDropContext?.teamName ?? primaryChaser?.teamName ?? 'Live',
        note: biggestDropContext
          ? `${formatMovement(biggestDropContext.movement)} and ${biggestDropContext.trendPoints !== null ? formatPointsDelta(biggestDropContext.trendPoints) : 'live form'} keep the pressure story attached to them.`
          : 'The front page keeps one pressure cue behind the leader.',
      },
    ];

    if (primaryStory || primaryLeader) {
      const ladderRows: CompactRow[] = (primaryDivision?.rows ?? []).slice(0, 3).map((row) => ({
        key: `live-${row.teamId}`,
        label: row.teamName,
        value: `${row.points} pts`,
        note: `${formatSigned(row.profit)} • #${row.rank}`,
        teamName: row.teamName,
        ballColor: row.ballColor,
        ringColor: row.ringColor,
        textColor: row.textColor,
      }));
      nextPackages.push({
        id: 'news-lead',
        kicker: 'Front Page',
        headline: primaryStory?.headline ?? `${primaryLeader?.teamName ?? 'The leader'} set the pace`,
        summary: 'The lead story sets the tone for the current loop.',
        detail: primaryStory?.detail ?? 'The live round-up opens with the strongest current division angle.',
        tags: ['Headline', 'Live Round-Up', data.state.currentGw],
        segmentKey: 'feature',
        segmentLabel: 'News Lead / Live Round-Up',
        introTitle: 'News lead',
        introDetail: 'The broadcast loop opens with the front-page story, then frames the live race it sits inside.',
        roleLabel: 'Headline',
        focusNote: 'Lead with the front page, then reduce quickly to one race or pressure cue.',
        stages: [
          {
            id: 'headline',
            label: 'Headline',
            summary: 'The front page story opens the cycle.',
            detail: primaryStory?.detail ?? 'The lead story sets the tone for the screen.',
            tags: ['Headline', data.state.currentGw],
            dwellMs: 6500,
            tickerItems: [primaryStory?.headline ?? `${primaryLeader?.teamName ?? 'The leader'} lead the live round-up.`],
            spotlight: buildSpotlight({
              id: 'lead-spotlight',
              label: primaryStory?.tone === 'warning' ? 'Pressure Team' : 'Table Leader',
              family: 'Lead Story',
              note: primaryDivision ? resolveDivisionDisplayName(primaryDivision.title) : 'Live',
              supportLine: primaryStory?.tone === 'warning' && biggestDrop
                ? `${biggestDrop.teamName} are the pressure team sitting inside the lead story.`
                : primaryLeader && primaryChaser
                  ? `${primaryLeader.teamName} set the pace with ${primaryLeadGap ?? 0} point${primaryLeadGap === 1 ? '' : 's'} over ${primaryChaser.teamName}.`
                  : 'The lead story is tied to the team setting the pace.',
              tone: 'feature',
              team: primaryStory?.tone === 'warning' ? biggestDropContext : primaryLeaderContext,
              stats: [
                { label: 'Rank', value: primaryStory?.tone === 'warning' ? formatOptionalRank(biggestDropContext?.rank) : primaryLeader ? `#${primaryLeader.rank}` : '' },
                { label: 'Points', value: primaryStory?.tone === 'warning' ? formatOptionalValue(biggestDropContext?.points) : primaryLeader ? `${primaryLeader.points}` : '' },
                { label: 'Move', value: primaryStory?.tone === 'warning' ? formatOptionalMovement(biggestDropContext?.movement) : primaryLeadGap !== null ? `${primaryLeadGap} pts` : '' },
              ],
            }),
            content: (
              <EditorialStoryBoard
                kicker="News Lead"
                strap={seasonStamp}
                headline={primaryStory?.headline ?? `${primaryLeader?.teamName ?? 'The leader'} headline the round-up`}
                detail={primaryStory?.detail ?? `${primaryLeader?.teamName ?? 'The leader'} remain the live pace-setter as the main loop opens.`}
                contextRows={[
                  { label: 'Leader', value: primaryLeader?.teamName ?? 'Live' },
                  { label: 'Lead', value: primaryLeadGap !== null ? `+${primaryLeadGap} pts` : 'Tight' },
                  { label: 'Nearest challenger', value: primaryChaser?.teamName ?? 'Live' },
                ]}
                insights={primaryInsights}
                aside={primaryStory?.tone === 'warning' && shockResult ? (
                  <ShockResultCard
                    winner={shockResult.winner}
                    loser={shockResult.loser}
                    rankGap={`${shockResult.rankGap} places`}
                    profitMargin={formatSigned(shockResult.profitMargin)}
                    detail={`${shockResult.division} • ${shockResult.gw}`}
                    stamp="UPSET WATCH"
                  />
                ) : primaryRaceBars.length > 0 ? (
                  <DivisionRaceMeter title={primaryDivision?.title ?? 'Division Race'} bars={primaryRaceBars} />
                ) : null}
              />
            ),
          },
          {
            id: 'live-roundup',
            label: 'Live Round-Up',
            summary: 'The lead story widens into the current live ladder picture.',
            detail: primaryLeader && primaryChaser
              ? `${primaryLeader.teamName} lead by ${primaryLeadGap ?? 0} point${primaryLeadGap === 1 ? '' : 's'} over ${primaryChaser.teamName}.`
              : 'The live ladder provides the competitive frame behind the headline.',
            tags: ['Ladder', 'Pressure'],
            dwellMs: 5500,
            spotlight: buildSpotlight({
              id: 'lead-ladder',
              label: 'Fast Riser',
              family: 'Live Round-Up',
              note: biggestRise?.division ? resolveDivisionDisplayName(biggestRise.division) : 'Live',
              supportLine: biggestRise
                ? `${biggestRise.teamName} are the strongest movement story waiting further down the loop.`
                : 'The live round-up hands off into deeper division coverage.',
              tone: 'feature',
              team: biggestRiseContext ?? primaryLeaderContext,
              stats: [
                { label: 'Move', value: formatOptionalMovement(biggestRiseContext?.movement) },
                { label: 'Form', value: formatOptionalPointsDelta(biggestRiseContext?.trendPoints) },
                { label: 'Profit', value: formatOptionalSigned(biggestRiseContext?.trendProfit) },
              ],
            }),
            content: (
              <EditorialStoryBoard
                kicker="Live Round-Up"
                strap={data.state.currentGw}
                headline={primaryLeader ? `${primaryLeader.teamName.toUpperCase()} SET THE LIVE PACE` : 'THE LADDER REMAINS WIDE OPEN'}
                detail={primaryLeader && primaryChaser
                  ? `${primaryLeader.teamName} lead ${resolveDivisionDisplayName(primaryDivision?.title ?? '')}, while ${primaryChaser.teamName} remain close enough to keep the opening package under pressure.`
                  : 'The live ladder now hands off to the division-by-division programme sequence.'}
                contextRows={[
                  { label: 'Leader', value: primaryLeader?.teamName ?? 'Live' },
                  { label: 'Lead', value: primaryLeadGap !== null ? `+${primaryLeadGap} pts` : 'Tight' },
                  { label: 'Nearest challenger', value: primaryChaser?.teamName ?? 'Live' },
                ]}
                insights={primaryInsights}
                aside={shockResult ? (
                  <ShockResultCard
                    winner={shockResult.winner}
                    loser={shockResult.loser}
                    rankGap={`${shockResult.rankGap} places`}
                    profitMargin={formatSigned(shockResult.profitMargin)}
                    detail={`${shockResult.division} • ${shockResult.gw}`}
                    stamp="UPSET WATCH"
                  />
                ) : (
                  <CompactLeaderboard title="Top Three" strap="Live Ladder" rows={ladderRows} />
                )}
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'The front page closes cleanly before the programme moves into the first division feature.',
            detail: primaryLeader && primaryDivision
              ? `${primaryLeader.teamName} leave the front page as the pace-setter, and ${resolveDivisionDisplayName(primaryDivision.title)} is next on the clock.`
              : 'The front page closes with one clear handoff into the first division package.',
            tags: ['Headline', 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'lead-wrap',
              label: 'Next Watch',
              family: 'Lead Wrap',
              note: primaryDivision ? resolveDivisionDisplayName(primaryDivision.title) : 'Next',
              supportLine: primaryLeader && primaryDivision
                ? `${primaryLeader.teamName} hand the loop over to ${resolveDivisionDisplayName(primaryDivision.title)}, where the wider movement story gets its full run.`
                : 'The front page now hands off to deeper competition coverage.',
              tone: 'feature',
              team: primaryLeaderContext ?? biggestRiseContext,
              stats: [
                { label: 'Leader', value: primaryLeader ? `#${primaryLeader.rank}` : '' },
                { label: 'Lead', value: primaryLeadGap !== null ? `${primaryLeadGap} pts` : '' },
                { label: 'Next', value: primaryDivision ? resolveDivisionDisplayName(primaryDivision.title) : '' },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Lead Wrap"
                stamp="NEXT"
                headline={primaryLeader ? `${primaryLeader.teamName} take the handoff point` : 'Front page set'}
                detail={primaryLeader && primaryDivision
                  ? `${primaryLeader.teamName} leave the opening package in front, and the programme now widens into the full ${resolveDivisionDisplayName(primaryDivision.title)} round-up.`
                  : 'The opening package is done. The loop now moves into the first division feature.'}
                tone="neutral"
                metrics={[
                  { label: 'Leader', value: primaryLeader?.teamName ?? 'Live' },
                  { label: 'Next', value: primaryDivision ? resolveDivisionDisplayName(primaryDivision.title) : 'Division' },
                ]}
              />
            ),
          },
        ],
      });
    }

    orderedDivisions.forEach((division) => {
      const divisionShort = resolveDivisionDisplayName(division.title);
      const snapshot = divisionSnapshotByTitle.get(division.title) ?? null;
      const divisionBundle = divisionJourneyBundles.get(division.title) ?? null;
      const leader = division.rows[0] ?? null;
      const chaser = division.rows[1] ?? null;
      const bottom = division.rows[division.rows.length - 1] ?? null;
      const leaderContext = buildTeamContext(leader?.teamId ?? null);
      const riseContext = buildContextByName(snapshot?.topRise?.teamName);
      const dropContext = buildContextByName(snapshot?.topDrop?.teamName);
      const focusContext = riseContext ?? dropContext ?? leaderContext;
      const divisionLeadGap = leader && chaser ? Math.max(0, leader.points - chaser.points) : null;
      const formRows = buildDivisionFormRows(division);
      const chasePackRows = buildDivisionChasePackRows(division);
      const fixtureRows = buildDivisionFixtureRows(division, {
        leaderName: leader?.teamName,
        pressureName: dropContext?.teamName ?? bottom?.teamName,
        riserName: riseContext?.teamName,
      });
      const formLeader = formRows[0] ?? null;
      const spotlightContext = dropContext ?? riseContext ?? leaderContext;
      const spotlightGapToLeader = leadGapByTeamId.get(spotlightContext?.teamId ?? -1) ?? null;
      const divisionStoryTone = snapshot?.topRise
        ? 'climber'
        : snapshot?.topDrop
          ? 'pressure'
          : 'leader';
      const highlightText = leader && chaser
        ? `${leader.teamName} still lead ${divisionShort}, but ${chaser.teamName} remain the nearest chase-side while ${dropContext?.teamName ?? bottom?.teamName ?? 'the lower line'} hold the pressure cue.`
        : `${divisionShort} closes with the leader, the chase pack, and the next pressure team still clearly visible.`;
      const raceInsights: RaceInsight[] = [
        {
          label: 'Form Leader',
          value: formLeader?.teamName ?? leader?.teamName ?? 'Live',
          note: formLeader ? `${formLeader.formValue} with ${formLeader.profitValue} on the current recent-form readout.` : 'The strongest short-window form side sits on top of the race board.',
        },
        {
          label: 'Fastest Climber',
          value: riseContext?.teamName ?? leader?.teamName ?? 'Live',
          note: riseContext
            ? `${formatMovement(riseContext.movement)} and ${riseContext.trendPoints !== null ? formatPointsDelta(riseContext.trendPoints) : 'live form'} keep them closest to the next upward swing.`
            : 'The race board holds on the side with the clearest upward route.',
        },
        {
          label: 'Pressure Team',
          value: dropContext?.teamName ?? bottom?.teamName ?? 'Live',
          note: dropContext
            ? `${formatGapFromLeader(leadGapByTeamId.get(dropContext.teamId ?? -1) ?? null)} off the lead with ${dropContext.trendPoints !== null ? formatPointsDelta(dropContext.trendPoints) : 'live form'} keeping the pressure live.`
            : `${bottom?.teamName ?? 'The lower line'} sit nearest the sharper edge of the division frame.`,
        },
      ];

      nextPackages.push({
        id: `division-${division.id}`,
        kicker: divisionShort,
        headline: leader ? `${leader.teamName} lead ${divisionShort}` : `${divisionShort} round-up`,
        summary: `${divisionShort} gets its own directed round-up sequence.`,
        detail: leader
          ? `${leader.teamName} lead the current table, while movement and fixture pressure shape the rest of the package.`
          : `${divisionShort} is handled as its own separate programme segment.`,
        tags: [divisionShort, 'Round-Up', data.state.currentGw],
        segmentKey: 'league',
        segmentLabel: `${divisionShort} Division Round-Up`,
        introTitle: `${divisionShort} intro`,
        introDetail: `${divisionShort} gets journey, table, selected fixtures, and a short wrap.`,
        roleLabel: 'Headline',
        focusNote: 'Move from path to table to fixture consequence, then close the division cleanly.',
        stages: [
          {
            id: 'journey',
            label: 'Journey',
            summary: `${divisionShort} opens with the movement replay.`,
            detail: snapshot?.topRise
              ? `${snapshot.topRise.teamName} are the clearest riser through the division journey.`
              : snapshot?.topDrop
                ? `${snapshot.topDrop.teamName} are the pressure line inside the division journey.`
                : `${leader?.teamName ?? 'The leader'} anchor the movement story in ${divisionShort}.`,
            tags: [divisionShort, 'Journey'],
            dwellMs: 8000,
            animationLockMs: 8000,
            spotlight: buildSpotlight({
              id: `${division.id}-journey`,
              label: snapshot?.topRise ? 'Fast Riser' : snapshot?.topDrop ? 'Pressure Team' : 'Table Leader',
              family: `${divisionShort} Journey`,
              note: divisionShort,
              supportLine: snapshot?.topRise
                ? `${snapshot.topRise.teamName} have the clearest upward path in the ${divisionShort} replay.`
                : snapshot?.topDrop
                  ? `${snapshot.topDrop.teamName} are the main pressure story as the path bends downward.`
                  : `${leader?.teamName ?? 'The leader'} anchor the division replay from start to finish.`,
              tone: 'league',
              team: focusContext,
              stats: [
                { label: 'Rank', value: formatOptionalRank(focusContext?.rank) },
                { label: focusContext?.rank === 1 ? 'Lead' : 'Gap to lead', value: focusContext?.rank === 1 ? `${divisionLeadGap ?? 0} pts` : formatGapFromLeader(leadGapByTeamId.get(focusContext?.teamId ?? -1) ?? null) },
                { label: 'Form', value: formatOptionalPointsDelta(focusContext?.trendPoints) },
                { label: 'Profit', value: formatOptionalSigned(focusContext?.profit) },
              ],
            }),
            content: divisionBundle ? (
              <div className="sny-news-chart-shell">
                <SnyJourneyMotionGraphic
                  teams={divisionBundle.teams}
                  gwNumbers={divisionBundle.gwNumbers}
                  divisionTitle={divisionBundle.division}
                  cutLineTitle={divisionBundle.sourceDivision}
                  highlightedTeamId={focusContext?.teamId ?? leaderContext?.teamId ?? null}
                  startDelayMs={1200}
                  stageDwellMs={8000}
                  lockTimeline
                  storyTone={divisionStoryTone}
                  contextTitle={`${divisionShort} Movement`}
                  contextRows={[
                    { label: 'Leader', value: leader?.teamName ?? 'Live' },
                    { label: 'Biggest climb', value: riseContext?.teamName ?? leader?.teamName ?? 'Live' },
                    { label: 'Pressure team', value: dropContext?.teamName ?? bottom?.teamName ?? 'Live' },
                  ]}
                  finalRows={[
                    { label: 'Leader', value: leader?.teamName ?? 'Live' },
                    { label: 'Lead', value: divisionLeadGap !== null ? `+${divisionLeadGap} pts` : 'Tight' },
                    { label: 'Nearest chaser', value: chaser?.teamName ?? 'Live' },
                  ]}
                  finalInsight={highlightText}
                />
              </div>
            ) : (
              <StorylineSlide
                kicker={`${divisionShort} Journey`}
                stamp={data.state.currentGw}
                headline={`${divisionShort} movement story`}
                detail="The journey graphic is waiting for enough fixture history to build a proper path, so the package holds on the division story until the replay is ready."
                tone="neutral"
              />
            ),
          },
          {
            id: 'table',
            label: 'Table / Race',
            summary: `${divisionShort} resets on the live table.`,
            detail: leader && chaser
              ? `${leader.teamName} lead by ${divisionLeadGap ?? 0} point${divisionLeadGap === 1 ? '' : 's'} over ${chaser.teamName}.`
              : `${divisionShort} table is the current ladder reference for this package.`,
            tags: [divisionShort, 'Table'],
            dwellMs: 5000,
            spotlight: buildSpotlight({
              id: `${division.id}-table`,
              label: 'Table Leader',
              family: `${divisionShort} Table`,
              note: divisionShort,
              supportLine: leader && chaser
                ? `${leader.teamName} set the pace, but ${chaser.teamName} keep the table honest right behind them.`
                : 'The standings are the current reference point for this division story.',
              tone: 'league',
              team: leaderContext,
              stats: [
                { label: 'Rank', value: leader ? `#${leader.rank}` : '' },
                { label: 'Points', value: leader ? `${leader.points}` : '' },
                { label: 'Lead', value: divisionLeadGap !== null ? `${divisionLeadGap} pts` : '' },
                { label: 'Profit', value: leader ? formatSigned(leader.profit) : '' },
              ],
            }),
            content: (
              <StudioTableCarousel
                divisions={[division]}
                intervalMs={9000}
                presentationMode="clean"
                readabilityMode="compact"
                highlightedTeamId={focusContext?.teamId ?? leader?.teamId ?? null}
              />
            ),
          },
          {
            id: 'results',
            label: 'Results',
            summary: `${divisionShort} narrows to the fixtures that matter.`,
            detail: 'Only the fixtures with the clearest table consequences are kept in view here.',
            tags: [divisionShort, 'Results'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: `${division.id}-results`,
              label: dropContext ? 'Pressure Tie' : 'Result Focus',
              family: `${divisionShort} Results`,
              note: divisionShort,
              supportLine: `${fixtureRows[0]?.title ?? `${divisionShort} results`} are the key line on this pass through the division.`,
              tone: 'league',
              team: spotlightContext,
              stats: [
                { label: 'Rank', value: formatOptionalRank(spotlightContext?.rank) },
                { label: 'Gap to lead', value: formatGapFromLeader(spotlightGapToLeader) },
                { label: 'Form', value: formatOptionalPointsDelta(spotlightContext?.trendPoints) },
                { label: 'Season profit', value: formatOptionalSigned(spotlightContext?.profit) },
              ],
            }),
            content: (
              <FixtureBoard
                kicker="Fixtures / Results"
                title={`${divisionShort} in focus`}
                rows={fixtureRows.length > 0 ? fixtureRows : [{
                  id: `${division.id}-empty`,
                  title: `${divisionShort} waiting room`,
                  context: data.state.currentGw,
                  outcome: 'No key line yet',
                  note: 'This package will fill with the fixtures that most affect the division story.',
                  tone: 'neutral',
                }]}
                footer="Selected lines only. This is the fixture context that actually shifts the division story."
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: `${divisionShort} closes on the leader, the pressure point, and the next watch.`,
            detail: leader && bottom
              ? `${leader.teamName} hold the current edge, while ${dropContext?.teamName ?? bottom.teamName} sit on the sharper pressure line.`
              : `${divisionShort} closes by resetting the leader and the next pressure cue.`,
            tags: [divisionShort, 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: `${division.id}-wrap`,
              label: dropContext ? 'Pressure Team' : 'Form Leader',
              family: `${divisionShort} Wrap`,
              note: divisionShort,
              supportLine: dropContext
                ? `Pressure is building around ${dropContext.teamName} as the leader, chase pack, and lower line close together.`
                : `${leader?.teamName ?? 'The leader'} leave the segment with the cleanest current edge and the chase pack still close behind.`,
              tone: 'league',
              team: dropContext ?? leaderContext ?? buildTeamContext(bottom?.teamId ?? null),
              stats: [
                { label: 'Rank', value: formatOptionalRank((dropContext ?? leaderContext)?.rank) },
                { label: 'Gap to lead', value: formatGapFromLeader(leadGapByTeamId.get((dropContext ?? leaderContext)?.teamId ?? -1) ?? null) },
                { label: 'Form', value: formatOptionalPointsDelta((dropContext ?? leaderContext)?.trendPoints) },
                { label: 'Season profit', value: formatOptionalSigned((dropContext ?? leaderContext)?.profit) },
              ],
            }),
            content: (
              <RaceWrapBoard
                kicker={`${divisionShort} Wrap`}
                strap={data.state.currentGw}
                headline={leader ? `${leader.teamName.toUpperCase()} HOLD THE ${divisionShort.toUpperCase()} LEAD` : `${divisionShort.toUpperCase()} REMAINS LIVE`}
                detail={highlightText}
                leader={leader?.teamName ?? 'Live'}
                leadValue={divisionLeadGap !== null ? `${divisionLeadGap} pts` : 'Tight'}
                nearestChallenger={chaser?.teamName ?? 'Live'}
                contextRows={[
                  { label: 'Leader', value: leader?.teamName ?? 'Live' },
                  { label: 'Lead', value: divisionLeadGap !== null ? `+${divisionLeadGap} pts` : 'Tight' },
                  { label: 'Nearest challenger', value: chaser?.teamName ?? 'Live' },
                ]}
                chasePack={chasePackRows}
                insights={raceInsights}
                trendTitle={`Recent Form - ${divisionShort}`}
                trendRows={formRows}
                highlightLabel={dropContext ? 'Pressure line' : 'Race context'}
                highlightText={highlightText}
              />
            ),
          },
        ],
      });
    });

    const superCupFixture = data.superCupFixtures.find((fixture) => fixture.gw === data.state.currentGw) ?? data.superCupFixtures[0] ?? null;
    if (superCupFixture) {
      const superCupHome = buildContextByName(superCupFixture.homeTeam);
      const superCupAway = buildContextByName(superCupFixture.awayTeam);
      const superCupContext = buildContextByName(superCupFixture.winnerTeam ?? superCupFixture.homeTeam) ?? primaryLeaderContext;
      const superCupAngleLabel = superCupFixture.pairingReason === 'winners_vs_winners'
        ? 'Winners Clash'
        : superCupFixture.pairingReason === 'double_winner_vs_bookieball_runner_up'
          ? 'Double Winner vs BookieBall Runner-up'
          : 'Double Winner vs Master Runner-up';
      nextPackages.push({
        id: 'super-cup-watch',
        kicker: 'Super Cup',
        headline: `${superCupFixture.homeTeam} v ${superCupFixture.awayTeam}`,
        summary: 'Super Cup is the standalone curtain-raiser built from the previous season’s two cup routes.',
        detail: `${superCupFixture.pairingExplanation} It sits outside the BookieBall Cup and Master Cup brackets and carries zero Bookie d'Or weight.`,
        tags: ['Super Cup', superCupFixture.gw, superCupAngleLabel],
        segmentKey: 'cup',
        segmentLabel: 'Super Cup Watch',
        introTitle: 'Super cup intro',
        introDetail: 'The Super Cup is treated as a one-off prestige opener, never as part of the two main knockout trees.',
        roleLabel: 'Headline',
        focusNote: 'Keep the emphasis on the curtain-raiser and why the pairing exists.',
        stages: [
          {
            id: 'feature',
            label: 'Curtain-Raiser',
            summary: 'Super Cup leads with the prestige pairing and the reason those two clubs were chosen.',
            detail: `${superCupFixture.homeTeam} and ${superCupFixture.awayTeam} open the season in a standalone clash built from ${superCupFixture.sourceSeason} cup results.`,
            tags: ['Super Cup', 'Opener'],
            dwellMs: 5000,
            spotlight: buildSpotlight({
              id: 'super-cup-spotlight',
              label: superCupAngleLabel,
              family: 'Prestige Opener',
              note: superCupFixture.gw,
              supportLine: `${superCupFixture.pairingExplanation} This fixture opens the season without changing either main cup bracket.`,
              tone: 'cup',
              team: superCupContext,
              stats: [
                { label: 'Source season', value: superCupFixture.sourceSeason },
                { label: 'Pairing', value: superCupAngleLabel },
                { label: 'Weight', value: 'No Bookie d\'Or impact' },
              ],
            }),
            content: (
              <KnockoutFeatureBoard
                kicker="Super Cup"
                family="Prestige Opener"
                angleLabel={superCupAngleLabel}
                roundName={superCupFixture.gw}
                headline={`${superCupFixture.homeTeam} v ${superCupFixture.awayTeam}`}
                detail={`${superCupFixture.pairingExplanation} It is the curtain-raiser, not part of either main knockout route.`}
                metrics={[
                  { label: 'Source', value: superCupFixture.sourceSeason },
                  { label: 'Status', value: superCupFixture.winnerTeam ? `${superCupFixture.winnerTeam} won` : superCupFixture.played ? `${superCupFixture.homeProfit.toFixed(2)} - ${superCupFixture.awayProfit.toFixed(2)}` : 'Awaiting kickoff' },
                  { label: 'Weight', value: 'No Bookie d\'Or impact' },
                ]}
                supportTitle="Why it matters"
                supportLine="It frames the season launch as a champions clash, while leaving the BookieBall Cup and Master Cup structures completely unchanged."
                home={superCupHome}
                away={superCupAway}
                homeLabel="BookieBall / selected side"
                awayLabel="Master Cup / selected side"
                featuredTeam={superCupContext}
              />
            ),
          },
          {
            id: 'context',
            label: 'Selection Logic',
            summary: 'The second beat makes the selection logic explicit so the pairing reads clearly on air.',
            detail: 'Super Cup selection is editorially simple: default winners clash, or the stronger runner-up if one club won both cups.',
            tags: ['Super Cup', 'Logic'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'super-cup-context',
              label: 'Pairing Logic',
              family: 'Super Cup',
              note: superCupFixture.sourceSeason,
              supportLine: superCupFixture.pairingExplanation,
              tone: 'cup',
              team: superCupContext,
              stats: [
                { label: 'BookieBall winner', value: superCupFixture.bookieballWinnerTeam },
                { label: 'Master winner', value: superCupFixture.masterCupWinnerTeam },
                { label: 'Runner-up slot', value: superCupFixture.runnerUpTeam ?? 'Not needed' },
              ],
            }),
            content: (
              <FixtureBoard
                kicker="Super Cup Logic"
                title="Why these clubs are here"
                rows={[
                  {
                    id: 'super-cup-logic-main',
                    title: superCupAngleLabel,
                    context: `${superCupFixture.homeTeam} vs ${superCupFixture.awayTeam}`,
                    outcome: superCupFixture.sourceSeason,
                    note: superCupFixture.pairingExplanation,
                    tone: 'neutral',
                  },
                  {
                    id: 'super-cup-logic-bb',
                    title: 'BookieBall Cup slot',
                    context: superCupFixture.bookieballWinnerTeam,
                    outcome: superCupFixture.bookieballRunnerUpTeam,
                    note: 'Winner qualifies directly; runner-up only matters if the same club won both cups.',
                    tone: 'neutral',
                  },
                  {
                    id: 'super-cup-logic-master',
                    title: 'Master Cup slot',
                    context: superCupFixture.masterCupWinnerTeam,
                    outcome: superCupFixture.masterCupRunnerUpTeam,
                    note: 'Prestige opener only — no bracket progression and no Bookie d\'Or weighting.',
                    tone: 'neutral',
                  },
                ]}
                footer="The Super Cup is a one-off season opener and never rewires the BookieBall Cup or Master Cup paths."
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'Super Cup closes by restating that it is a standalone season launch fixture.',
            detail: superCupFixture.winnerTeam
              ? `${superCupFixture.winnerTeam} leave the opener with the first prestige result of the season.`
              : 'The opener is set, but the first prestige result of the season is still waiting to land.',
            tags: ['Super Cup', 'Wrap'],
            dwellMs: 3500,
            spotlight: buildSpotlight({
              id: 'super-cup-wrap',
              label: 'Curtain-Raiser',
              family: 'Super Cup',
              note: superCupFixture.gw,
              supportLine: superCupFixture.winnerTeam
                ? `${superCupFixture.winnerTeam} took the standalone opener without changing either knockout bracket.`
                : 'The opener stays standalone: one fixture, one honour, no effect on the two main cup structures.',
              tone: 'cup',
              team: superCupContext,
              stats: [
                { label: 'Fixture', value: `${superCupFixture.homeTeam} v ${superCupFixture.awayTeam}` },
                { label: 'Winner', value: superCupFixture.winnerTeam ?? 'Pending' },
                { label: 'Award weight', value: '0' },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Super Cup Wrap"
                stamp={superCupFixture.gw}
                headline={superCupFixture.winnerTeam ? `${superCupFixture.winnerTeam} took the season opener` : 'Super Cup opener locked in'}
                detail={superCupFixture.winnerTeam
                  ? `${superCupFixture.winnerTeam} leave the Super Cup with the first prestige result of the season, while both main knockout brackets stay untouched.`
                  : `${superCupFixture.homeTeam} and ${superCupFixture.awayTeam} are set for the curtain-raiser, and the two main knockout brackets remain completely separate.`}
                tone="neutral"
                metrics={[
                  { label: 'Pairing', value: superCupAngleLabel },
                  { label: 'Weight', value: 'No Bookie d\'Or impact' },
                ]}
              />
            ),
          },
        ],
      });
    }

    if (data.cupStatus.length > 0 || data.cupFixtures.length > 0) {
      const cupRows = buildCupRows();
      const cupContext = cupFeature?.featuredTeam ?? primaryLeaderContext;
      nextPackages.push({
        id: 'cup-watch',
        kicker: 'BookieBall Cup',
        headline: cupFeature?.headline ?? 'Knockout story live',
        summary: 'Cup Watch follows the featured tie, then only the support rows that change the route.',
        detail: cupFeature?.detail ?? 'The cup package is driven by the strongest live knockout angle, not by stage counters alone.',
        tags: ['Cup', cupFeature?.angleLabel ?? 'Knockout Story', cupFeature?.roundName ?? 'Live'],
        segmentKey: 'cup',
        segmentLabel: 'Cup Watch',
        introTitle: 'Cup intro',
        introDetail: 'Cup Watch opens on the featured knockout story, then widens briefly before wrapping the route forward.',
        roleLabel: 'Headline',
        focusNote: 'Keep the emphasis on jeopardy, resolution, and the featured tie.',
        stages: [
          {
            id: 'feature',
            label: 'Featured Tie',
            summary: 'Cup Watch leads with the tie or shock carrying the biggest stakes.',
            detail: cupFeature?.detail ?? 'The featured tie carries the biggest knockout jeopardy on this pass through the cup.',
            tags: ['Cup', cupFeature?.roundName ?? 'Live'],
            dwellMs: 6000,
            spotlight: buildSpotlight({
              id: 'cup-spotlight',
              label: cupFeature?.angleLabel ?? 'Cup Focus',
              family: 'Knockout Story',
              note: cupFeature?.roundName ?? 'Cup',
              supportLine: cupFeature?.supportCopy ?? 'The cup rail follows the team carrying the strongest knockout narrative.',
              tone: 'cup',
              team: cupContext,
              stats: [
                { label: 'Round', value: cupFeature?.roundName ?? '' },
                { label: 'Rank', value: formatOptionalRank(cupContext?.rank) },
                { label: 'Form', value: formatOptionalPointsDelta(cupContext?.trendPoints) },
              ],
            }),
            content: <CupWatchBoard feature={cupFeature} />,
          },
          {
            id: 'route',
            label: 'Route',
            summary: 'The support board stays selective so the featured tie remains the story.',
            detail: cupFeature?.stakes ?? 'The knockout route stays focused on the teams still shaping the story.',
            tags: ['Cup', 'Route'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'cup-route',
              label: 'Still Alive',
              family: 'Cup Route',
              note: cupFeature?.roundName ?? 'Cup',
              supportLine: cupFeature?.featuredTeam
                ? `${cupFeature.featuredTeam.teamName} remain the live knockout reference as the segment closes.`
                : 'The knockout route now moves to the next pressure point.',
              tone: 'cup',
              team: cupContext,
              stats: [
                { label: 'Move', value: formatOptionalMovement(cupContext?.movement) },
                { label: 'Points', value: formatOptionalValue(cupContext?.points) },
              ],
            }),
            content: (
              <FixtureBoard
                kicker="Cup Context"
                title={cupFeature?.supportTitle ?? 'Knockout route'}
                rows={cupRows.length > 0 ? cupRows : [{
                  id: 'cup-empty',
                  title: 'Cup route loading',
                  context: 'BookieBall Cup',
                  outcome: 'Standby',
                  note: 'Featured ties and route support will appear here once the bracket has more live information.',
                  tone: 'neutral',
                }]}
                footer={cupFeature?.supportCopy ?? 'Knockout support stays tightly filtered so the featured tie remains the story.'}
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'Cup Watch closes on the team or tie carrying the route into the next knockout beat.',
            detail: cupFeature?.featuredTeam
              ? `${cupFeature.featuredTeam.teamName} leave the package as the live knockout reference point.`
              : 'Cup Watch closes by resetting the next live knockout reference point.',
            tags: ['Cup', 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'cup-wrap',
              label: 'Cup Wrap',
              family: 'Knockout Close',
              note: cupFeature?.roundName ?? 'Cup',
              supportLine: cupFeature?.featuredTeam
                ? `${cupFeature.featuredTeam.teamName} remain the side to watch when the knockout package hands off.`
                : 'The knockout package closes by resetting the next cup reference point.',
              tone: 'cup',
              team: cupContext,
              stats: [
                { label: 'Round', value: cupFeature?.roundName ?? '' },
                { label: 'Story', value: cupFeature?.angleLabel ?? 'Knockout Story' },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Cup Wrap"
                stamp={cupFeature?.roundName ?? 'LIVE'}
                headline={cupFeature?.featuredTeam ? `${cupFeature.featuredTeam.teamName} stay alive in the cup story` : 'Knockout route set'}
                detail={cupFeature?.featuredTeam
                  ? `${cupFeature.featuredTeam.teamName} leave Cup Watch as the live reference point, and the next return to the cup will build from that route.`
                  : 'Cup Watch closes with the route reset around the next live knockout cue.'}
                tone={cupFeature?.tone ?? 'neutral'}
                metrics={[
                  { label: 'Angle', value: cupFeature?.angleLabel ?? 'Cup Watch' },
                  { label: 'Next', value: cupFeature?.featuredTeam?.teamName ?? 'Knockout route' },
                ]}
              />
            ),
          },
        ],
      });
    }

    if (masterLeader || data.masterLeague.table.length > 0) {
      const masterChaser = data.masterLeague.table[1] ?? null;
      const masterLeadGap = masterLeader && masterChaser ? masterLeader.points - masterChaser.points : null;
      const masterRiser = data.masterLeague.table
        .slice()
        .sort((left, right) => (masterMovementByTeamId.get(right.teamId) ?? 0) - (masterMovementByTeamId.get(left.teamId) ?? 0))[0] ?? null;
      const masterPressure = data.masterLeague.table
        .slice()
        .sort((left, right) => (masterMovementByTeamId.get(left.teamId) ?? 0) - (masterMovementByTeamId.get(right.teamId) ?? 0) || right.rank - left.rank)[0] ?? null;
      const masterLeaderContext = buildTeamContext(masterLeader?.teamId ?? null);
      const masterFormRows = buildTrendRows(data.masterLeague.table, masterMovementByTeamId);
      const masterChasePack: ChasePackRow[] = data.masterLeague.table.slice(1, 4).map((row) => ({
        key: `master-chase-${row.teamId}`,
        teamName: row.teamName,
        gap: formatGapFromLeader(masterLeadGap !== null ? row.points !== null ? Math.max(0, masterLeader ? masterLeader.points - row.points : 0) : null : null),
        ballColor: row.ballColor,
        ringColor: row.ringColor,
        textColor: row.textColor,
      }));
      const masterInsights: RaceInsight[] = [
        {
          label: 'Form Leader',
          value: masterFormRows[0]?.teamName ?? masterLeader?.teamName ?? 'Live',
          note: masterFormRows[0] ? `${masterFormRows[0].formValue} with ${masterFormRows[0].profitValue} on the current run.` : 'The strongest short-window side leads the current master readout.',
        },
        {
          label: 'Fastest Climber',
          value: masterRiser?.teamName ?? masterLeader?.teamName ?? 'Live',
          note: masterRiser ? `${formatMovement(masterMovementByTeamId.get(masterRiser.teamId) ?? 0)} makes them the sharpest mover in the field.` : 'The field mover is the next threat behind the leader.',
        },
        {
          label: 'Pressure Team',
          value: masterPressure?.teamName ?? 'Live',
          note: masterPressure ? `${formatMovement(masterMovementByTeamId.get(masterPressure.teamId) ?? 0)} leaves them under the heaviest current field pressure.` : 'The lower master line remains the next place to watch.',
        },
      ];
      const masterRows: CompactRow[] = data.masterLeague.table.slice(0, 3).map((row) => ({
        key: `master-${row.teamId}`,
        label: row.teamName,
        value: `${row.points} pts`,
        note: `${formatSigned(row.profit)} • #${row.rank}`,
        teamName: row.teamName,
        ballColor: row.ballColor,
        ringColor: row.ringColor,
        textColor: row.textColor,
      }));
      nextPackages.push({
        id: 'master-league-watch',
        kicker: 'Master League',
        headline: masterLeader ? `${masterLeader.teamName} lead the Master League` : 'Master League live',
        summary: 'Master League is treated as its own flagship all-field movement package.',
        detail: masterLeader
          ? `${masterLeader.teamName} lead the current Master League while the full field travels behind them.`
          : 'Master League gets a separate full-field movement sequence.',
        tags: ['Master League', 'All Teams', 'Movement'],
        segmentKey: 'master',
        segmentLabel: 'Master League Watch',
        introTitle: 'Master league intro',
        introDetail: 'This is the full-field premium graphic: all teams moving through the Master League together.',
        roleLabel: 'Headline',
        focusNote: 'Use the movement graphic first, then reduce to the leader and the main chasers.',
        stages: [
          {
            id: 'movement',
            label: 'Movement',
            summary: 'All teams stay visible as the Master League field moves through the season.',
            detail: masterLeader
              ? `${masterLeader.teamName} are the current pace-setter, but the whole Master field is shown moving behind them.`
              : 'The full Master League field is kept visible so the movement tells the story.',
            tags: ['Master', 'Field'],
            dwellMs: 9000,
            animationLockMs: 9000,
            spotlight: buildSpotlight({
              id: 'master-spotlight',
              label: 'Master Leader',
              family: 'Master League',
              note: 'All Teams',
              supportLine: masterLeader && masterChaser
                ? `${masterLeader.teamName} lead the whole field by ${masterLeadGap ?? 0} point${masterLeadGap === 1 ? '' : 's'} over ${masterChaser.teamName}.`
                : 'The Master League rail follows the team setting the all-field pace.',
              tone: 'master',
              team: masterLeaderContext,
              stats: [
                { label: 'Master', value: masterLeader ? `#${masterLeader.rank}` : '' },
                { label: 'Points', value: masterLeader ? `${masterLeader.points}` : '' },
                { label: 'Lead', value: masterLeadGap !== null ? `${masterLeadGap} pts` : '' },
              ],
            }),
            content: masterJourneyBundle ? (
              <div className="sny-news-chart-shell">
                <SnyJourneyMotionGraphic
                  teams={masterJourneyBundle.teams}
                  gwNumbers={masterJourneyBundle.gwNumbers}
                  divisionTitle={masterJourneyBundle.division}
                  highlightedTeamId={masterRiser?.teamId ?? masterLeader?.teamId ?? null}
                  mode="master"
                  startDelayMs={1200}
                  stageDwellMs={9000}
                  lockTimeline
                  storyTone={masterRiser ? 'climber' : masterPressure ? 'pressure' : 'leader'}
                  contextTitle="Master Movement"
                  contextRows={[
                    { label: 'Leader', value: masterLeader?.teamName ?? 'Live' },
                    { label: 'Biggest climb', value: masterRiser?.teamName ?? masterLeader?.teamName ?? 'Live' },
                    { label: 'Pressure team', value: masterPressure?.teamName ?? 'Live' },
                  ]}
                  finalRows={[
                    { label: 'Leader', value: masterLeader?.teamName ?? 'Live' },
                    { label: 'Lead', value: masterLeadGap !== null ? `+${masterLeadGap} pts` : 'Tight' },
                    { label: 'Nearest chaser', value: masterChaser?.teamName ?? 'Live' },
                  ]}
                  finalInsight={masterLeader && masterRiser
                    ? `${masterLeader.teamName} still set the pace, but ${masterRiser.teamName} remain the sharpest field mover behind them.`
                    : 'The Master field settles with one leader, one chase side, and one movement cue still visible.'}
                />
              </div>
            ) : (
              <StorylineSlide
                kicker="Master League"
                stamp={data.state.currentGw}
                headline={masterLeader ? `${masterLeader.teamName} lead the master field` : 'Master League loading'}
                detail="The full movement graphic will appear here once the Master League fixture path is ready to replay."
                tone="neutral"
              />
            ),
          },
          {
            id: 'table',
            label: 'Table / Race',
            summary: 'The all-field movement resolves into the current Master League race.',
            detail: masterLeader && masterChaser
              ? `${masterLeader.teamName} lead the table, with ${masterChaser.teamName} closest on the chase.`
              : 'The current table frames the leader and the nearest challengers.',
            tags: ['Master', 'Race'],
            dwellMs: 5000,
            spotlight: buildSpotlight({
              id: 'master-riser',
              label: 'Fast Riser',
              family: 'Master League',
              note: 'Movement',
              supportLine: masterRiser
                ? `${masterRiser.teamName} are the sharpest upward mover in the current Master table.`
                : 'The Master table is being framed around the strongest mover.',
              tone: 'master',
              team: buildTeamContext(masterRiser?.teamId ?? null) ?? masterLeaderContext,
              stats: [
                { label: 'Master', value: masterRiser ? `#${masterRiser.rank}` : '' },
                { label: 'Move', value: masterRiser ? formatMovement(masterMovementByTeamId.get(masterRiser.teamId) ?? 0) : '' },
                { label: 'Points', value: masterRiser ? `${masterRiser.points}` : '' },
              ],
            }),
            content: (
              <EditorialStoryBoard
                kicker="Master Table"
                strap={data.state.currentGw}
                headline={masterLeader ? `${masterLeader.teamName.toUpperCase()} FRONT THE MASTER RACE` : 'MASTER TABLE LIVE'}
                detail={masterLeader && masterChaser
                  ? `${masterLeader.teamName} lead the current Master League table by ${masterLeadGap ?? 0} point${masterLeadGap === 1 ? '' : 's'} over ${masterChaser.teamName}, while ${masterRiser?.teamName ?? 'the latest mover'} provide the swing story.`
                  : 'The current table reduces the full-field movement down to the teams that actually matter right now.'}
                contextRows={[
                  { label: 'Leader', value: masterLeader?.teamName ?? 'Live' },
                  { label: 'Lead', value: masterLeadGap !== null ? `+${masterLeadGap} pts` : 'Tight' },
                  { label: 'Nearest challenger', value: masterChaser?.teamName ?? 'Live' },
                ]}
                insights={masterInsights}
                aside={<CompactLeaderboard title="Master Table" strap="Current Top Three" rows={masterRows} />}
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'Master League closes on the leader, the sharpest riser, and the all-field cue to remember.',
            detail: masterLeader && masterRiser
              ? `${masterLeader.teamName} still lead the field, while ${masterRiser.teamName} leave the package as the movement side to remember.`
              : 'The Master League closes by resetting the leader and the strongest field movement cue.',
            tags: ['Master', 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'master-wrap',
              label: 'Field Watch',
              family: 'Master League',
              note: 'Wrap',
              supportLine: masterLeader && masterRiser
                ? `${masterLeader.teamName} leave the package in front, but ${masterRiser.teamName} are the field swing worth carrying into the next loop beat.`
                : 'The Master League closes by resetting the leader and the strongest movement cue.',
              tone: 'master',
              team: buildTeamContext(masterRiser?.teamId ?? null) ?? masterLeaderContext,
              stats: [
                { label: 'Leader', value: masterLeader ? `#${masterLeader.rank}` : '' },
                { label: 'Move', value: masterRiser ? formatMovement(masterMovementByTeamId.get(masterRiser.teamId) ?? 0) : '' },
                { label: 'Next', value: masterLeader?.teamName ?? '' },
              ],
            }),
            content: (
              <RaceWrapBoard
                kicker="Master Wrap"
                strap="FIELD CLOSE"
                headline={masterLeader ? `${masterLeader.teamName.toUpperCase()} HOLD THE MASTER LEAGUE EDGE` : 'MASTER LEAGUE REMAINS LIVE'}
                detail={masterLeader && masterChaser
                  ? `${masterLeader.teamName} still lead the whole field, ${masterChaser.teamName} head the chase pack, and ${masterPressure?.teamName ?? masterRiser?.teamName ?? 'the lower line'} remain the next movement cue.`
                  : 'The Master League closes with the leader, the chase pack, and the main movement cue still visible.'}
                leader={masterLeader?.teamName ?? 'Live'}
                leadValue={masterLeadGap !== null ? `${masterLeadGap} pts` : 'Tight'}
                nearestChallenger={masterChaser?.teamName ?? 'Live'}
                contextRows={[
                  { label: 'Leader', value: masterLeader?.teamName ?? 'Live' },
                  { label: 'Lead', value: masterLeadGap !== null ? `+${masterLeadGap} pts` : 'Tight' },
                  { label: 'Nearest challenger', value: masterChaser?.teamName ?? 'Live' },
                ]}
                chasePack={masterChasePack}
                insights={masterInsights}
                trendTitle="Recent Form - Master League"
                trendRows={masterFormRows}
                highlightLabel="Field watch"
                highlightText={masterLeader && masterRiser
                  ? `${masterLeader.teamName} hold the edge, but ${masterRiser.teamName} remain the live field mover behind them.`
                  : 'The master race closes with one leader and one movement cue in clear view.'}
              />
            ),
          },
        ],
      });
    }

    if (data.masterCupFixtures.length > 0) {
      const masterCupFeature = data.masterCupFixtures
        .filter((fixture) => fixture.homeTeam && fixture.awayTeam)
        .slice()
        .sort((left, right) => roundPriority(right.roundName) - roundPriority(left.roundName) || Number(left.played) - Number(right.played))[0] ?? null;
      const masterCupHome = buildContextByName(masterCupFeature?.homeTeam ?? null);
      const masterCupAway = buildContextByName(masterCupFeature?.awayTeam ?? null);
      const masterCupContext = buildContextByName(masterCupFeature?.winnerTeam ?? masterCupFeature?.homeTeam ?? null) ?? primaryLeaderContext;
      const masterCupRows = buildMasterCupRows(masterCupFeature);
      const masterCupAngleLabel = masterCupFeature?.stage === 'final'
        ? 'Final Watch'
        : masterCupFeature?.legNumber && masterCupFeature.legNumber > 1
          ? 'Aggregate Battle'
          : !masterCupFeature?.played
            ? 'Seeded Tie'
            : 'Route Shift';
      nextPackages.push({
        id: 'master-cup-watch',
        kicker: 'Master Cup',
        headline: masterCupFeature ? `${masterCupFeature.homeTeam} v ${masterCupFeature.awayTeam}` : 'Master Cup live',
        summary: 'Master Cup is handled as its own seeded knockout story.',
        detail: 'The Master Cup package stays tied to one seeded knockout angle at a time.',
        tags: ['Master Cup', data.state.currentGw],
        segmentKey: 'master',
        segmentLabel: 'Master Cup Watch',
        introTitle: 'Master cup intro',
        introDetail: 'Master Cup is kept separate from Master League, with seeded knockout pressure framed as its own show.',
        roleLabel: 'Headline',
        focusNote: 'Keep Master Cup tied to one seeded tie or route shift at a time.',
        stages: [
          {
            id: 'feature',
            label: 'Featured Tie',
            summary: 'Master Cup leads with the seeded tie carrying the biggest current stakes.',
            detail: masterCupFeature
              ? `${masterCupFeature.roundName} keeps ${masterCupFeature.homeTeam} and ${masterCupFeature.awayTeam} at the centre of the master knockout route.`
              : 'The next seeded knockout story is waiting to come into focus.',
            tags: ['Master Cup', 'Feature'],
            dwellMs: 5000,
            spotlight: buildSpotlight({
              id: 'master-cup-spotlight',
              label: masterCupAngleLabel,
              family: 'Master Cup',
              note: masterCupFeature?.roundName ?? 'Knockout',
              supportLine: masterCupFeature
                ? `${masterCupFeature.roundName} keeps ${masterCupFeature.homeTeam} and ${masterCupFeature.awayTeam} under seeded knockout pressure.`
                : 'The Master Cup rail follows the tie with the clearest jeopardy.',
              tone: 'master',
              team: masterCupContext,
              stats: [
                { label: 'Round', value: masterCupFeature?.roundName ?? '' },
                { label: 'Seed', value: masterCupContext?.teamId === findTeamIdByName(masterCupFeature?.homeTeam) ? `#${masterCupFeature?.homeSeed ?? '-'}` : `#${masterCupFeature?.awaySeed ?? '-'}` },
                { label: 'Master', value: masterCupContext?.teamId && masterRowByTeamId.get(masterCupContext.teamId) ? `#${masterRowByTeamId.get(masterCupContext.teamId)?.rank}` : '' },
              ],
            }),
            content: (
              <KnockoutFeatureBoard
                kicker="Master Cup"
                family="Seeded Knockout"
                angleLabel={masterCupAngleLabel}
                roundName={masterCupFeature?.roundName ?? data.state.currentGw}
                headline={masterCupFeature ? `${masterCupFeature.homeTeam} v ${masterCupFeature.awayTeam}` : 'Master Cup live'}
                detail={masterCupFeature
                  ? `${masterCupFeature.roundName} is the seeded knockout story in focus, with ${masterCupFeature.played ? `${masterCupFeature.winnerTeam ?? 'the winner'} already through` : 'the tie still live'}.`
                  : 'Seeded knockout pressure will appear here once the next live tie is ready.'}
                metrics={[
                  { label: 'Round', value: masterCupFeature?.roundName ?? 'Live' },
                  { label: 'Seeds', value: masterCupFeature ? `#${masterCupFeature.homeSeed ?? '-'} / #${masterCupFeature.awaySeed ?? '-'}` : 'TBD' },
                  { label: 'Stage', value: masterCupFeature?.stage?.replace(/_/g, ' ') ?? 'Route watch' },
                ]}
                supportTitle="Why it matters"
                supportLine={masterCupFeature
                  ? `${masterCupFeature.homeTeam} and ${masterCupFeature.awayTeam} carry the current seeded jeopardy, so the rest of the bracket is reduced to support only.`
                  : 'The Master Cup feature will lock onto the next seeded route change as soon as it appears.'}
                home={masterCupHome}
                away={masterCupAway}
                homeLabel={masterCupFeature?.homeSeed ? `Seed #${masterCupFeature.homeSeed}` : 'Home seed'}
                awayLabel={masterCupFeature?.awaySeed ? `Seed #${masterCupFeature.awaySeed}` : 'Away seed'}
                featuredTeam={masterCupContext}
              />
            ),
          },
          {
            id: 'route',
            label: 'Route',
            summary: 'Support ties stay compact so the featured tie remains the centre of gravity.',
            detail: 'Only the seeded ties that actually change the route are kept on screen.',
            tags: ['Master Cup', 'Route'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'master-cup-route',
              label: 'Cup Threat',
              family: 'Master Cup',
              note: masterCupFeature?.roundName ?? 'Knockout',
              supportLine: masterCupContext
                ? `${masterCupContext.teamName} are the live threat still shaping the Master Cup route.`
                : 'The route support board stays tied to the featured tie.',
              tone: 'master',
              team: masterCupContext,
              stats: [
                { label: 'Division', value: masterCupContext?.division ? resolveDivisionDisplayName(masterCupContext.division) : '' },
                { label: 'Profit', value: formatOptionalSigned(masterCupContext?.profit) },
              ],
            }),
            content: (
              <FixtureBoard
                kicker="Master Cup Route"
                title={masterCupFeature?.stage === 'final' ? 'Final route' : 'Seeded route'}
                rows={masterCupRows}
                footer="Only the seeded ties that change the knockout route stay on screen here."
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'Master Cup closes with the live seeded threat that still owns the route forward.',
            detail: masterCupContext
              ? `${masterCupContext.teamName} leave the package as the knockout side still shaping the Master Cup route.`
              : 'The package closes by resetting the seeded threat still carrying the route.',
            tags: ['Master Cup', 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'master-cup-wrap',
              label: 'Route Holder',
              family: 'Master Cup',
              note: masterCupFeature?.roundName ?? 'Knockout',
              supportLine: masterCupContext
                ? `${masterCupContext.teamName} are the live knockout reference when the Master Cup hands off.`
                : 'Master Cup closes by holding the active seeded threat on the rail.',
              tone: 'master',
              team: masterCupContext,
              stats: [
                { label: 'Round', value: masterCupFeature?.roundName ?? '' },
                { label: 'Story', value: masterCupFeature?.stage === 'final' ? 'Final watch' : 'Seeded tie' },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Master Cup Wrap"
                stamp={masterCupFeature?.roundName ?? 'LIVE'}
                headline={masterCupContext ? `${masterCupContext.teamName} stay live in the master knockout` : 'Master Cup route set'}
                detail={masterCupContext
                  ? `${masterCupContext.teamName} leave the Master Cup segment as the seeded knockout reference, and the next return to the competition will build from that route.`
                  : 'The Master Cup segment closes with the route held on the next seeded threat.'}
                tone="neutral"
                metrics={[
                  { label: 'Round', value: masterCupFeature?.roundName ?? 'Live' },
                  { label: 'Focus', value: masterCupContext?.teamName ?? 'Route' },
                ]}
              />
            ),
          },
        ],
      });
    }

    if (data.trioLeague.enabled && (data.trioLeague.table.length > 0 || data.trioLeagueFixtures.length > 0)) {
      const trioLeaders = Array.from(
        data.trioLeague.table
          .slice()
          .sort((left, right) => left.division.localeCompare(right.division) || left.rank - right.rank)
          .reduce((map, row) => {
            if (!map.has((row as any).division) && row.rank === 1) {
              map.set((row as any).division, row);
            }
            return map;
          }, new Map<string, ApiTrioLeagueTable['table'][number]>()),
      ).map(([, row]) => row);
      const trioFeature = trioLeaders
        .slice()
        .sort((left, right) => right.points - left.points || right.profit - left.profit)[0] ?? null;
      const trioContext = buildTeamContext(trioFeature?.teamId ?? null);
      const trioRows = buildTrioRows(trioFeature?.teamName);
      nextPackages.push({
        id: 'trio-league-watch',
        kicker: 'Trio League',
        headline: trioFeature ? `${trioFeature.teamName} front the trio picture` : 'Trio League live',
        summary: 'Trio League gets a concise leaders-plus-promotion sequence.',
        detail: trioFeature
          ? `${trioFeature.teamName} give the trio package its lead angle, with promotion routes kept as the support story.`
          : 'Trio League is treated as a separate support competition.',
        tags: ['Trio League', 'Promotion', data.state.currentGw],
        segmentKey: 'trio',
        segmentLabel: 'Trio League Watch',
        introTitle: 'Trio intro',
        introDetail: 'Trio League focuses on leaders, promotion routes, and the playoff lines that matter.',
        roleLabel: 'Support',
        focusNote: 'Keep Trio concise: leaders first, then only the promotion or playoff lines that matter.',
        stages: [
          {
            id: 'leaders',
            label: 'Leaders',
            summary: 'Trio opens on the leaders in each division.',
            detail: trioFeature
              ? `${trioFeature.teamName} set the strongest trio pace, while the rest of the picture is reduced to promotion context.`
              : 'The trio package always starts with the leader reference points.',
            tags: ['Trio', 'Leaders'],
            dwellMs: 5000,
            spotlight: buildSpotlight({
              id: 'trio-spotlight',
              label: 'Trio Leader',
              family: 'Promotion Watch',
              note: trioFeature?.division ?? 'Trio',
              supportLine: trioFeature
                ? `${trioFeature.teamName} set the trio pace and carry the strongest promotion signal on this cycle.`
                : 'The trio rail follows the current promotion pace-setter.',
              tone: 'trio',
              team: trioContext,
              stats: [
                { label: 'Division', value: trioFeature?.division ?? '' },
                { label: 'Rank', value: trioFeature ? `#${trioFeature.rank}` : '' },
                { label: 'Points', value: trioFeature ? `${trioFeature.points}` : '' },
              ],
            }),
            content: <TrioLeadersBoard leaders={trioLeaders.slice(0, 3)} footer={trioFeature ? `${trioFeature.teamName} lead the strongest trio division pace, while the playoff route decides which sides rise next.` : 'The trio package keeps one clean eye on leaders and promotion routes.'} />,
          },
          {
            id: 'route',
            label: 'Route / Playoff',
            summary: 'Only the trio lines affecting promotion or playoffs stay on screen.',
            detail: 'The trio package keeps its results board tight and stage-led.',
            tags: ['Trio', 'Route'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'trio-route',
              label: 'Playoff Threat',
              family: 'Trio League',
              note: trioFeature?.division ?? 'Trio',
              supportLine: trioContext
                ? `${trioContext.teamName} remain the trio reference while the playoff route settles around them.`
                : 'The trio support board stays tied to the promotion threat.',
              tone: 'trio',
              team: trioContext,
              stats: [
                { label: 'Points', value: trioFeature ? `${trioFeature.points}` : '' },
                { label: 'Profit', value: trioFeature ? formatSigned(trioFeature.profit) : '' },
              ],
            }),
            content: <FixtureBoard kicker="Trio Race" title="Promotion lines" rows={trioRows} footer="Only the trio fixtures that affect promotion or playoff position are kept on screen." />,
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'Trio closes on the leader still carrying the clearest promotion signal.',
            detail: trioContext
              ? `${trioContext.teamName} leave the trio package as the main promotion reference point.`
              : 'The trio segment closes by resetting the promotion side to watch.',
            tags: ['Trio', 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'trio-wrap',
              label: 'Promotion Watch',
              family: 'Trio League',
              note: trioFeature?.division ?? 'Trio',
              supportLine: trioContext
                ? `${trioContext.teamName} remain the trio reference when the programme leaves the promotion package.`
                : 'The trio package closes by holding one clear promotion reference point.',
              tone: 'trio',
              team: trioContext,
              stats: [
                { label: 'Division', value: trioFeature?.division ?? '' },
                { label: 'Focus', value: trioContext?.teamName ?? '' },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Trio Wrap"
                stamp="PROMOTION"
                headline={trioContext ? `${trioContext.teamName} hold the trio watch` : 'Trio route set'}
                detail={trioContext
                  ? `${trioContext.teamName} leave Trio League Watch as the current promotion reference point, and the next return to trio will build around that line.`
                  : 'Trio League Watch closes by resetting the live promotion reference point.'}
                tone="neutral"
                metrics={[
                  { label: 'Division', value: trioFeature?.division ?? 'Trio' },
                  { label: 'Focus', value: trioContext?.teamName ?? 'Promotion line' },
                ]}
              />
            ),
          },
        ],
      });
    }

    if (rivalry) {
      const rivalryMatchupParts = rivalry.matchup
        .split(/\s+v(?:s)?\.?\s+|\s+versus\s+/i)
        .map((part) => part.trim())
        .filter(Boolean);
      const rivalryLeftContext = buildContextByName(rivalryMatchupParts[0] ?? null) ?? buildContextByName(shockResult?.winner ?? null);
      const rivalryRightContext = buildContextByName(rivalryMatchupParts[1] ?? null) ?? buildContextByName(shockResult?.loser ?? null);
      nextPackages.push({
        id: 'rivalry-desk',
        kicker: 'Rivalry Desk',
        headline: rivalry.matchup,
        summary: 'One matchup, one edge, one clear rivalry story.',
        detail: rivalry.narrative,
        tags: ['Rivalry', 'Head-to-Head', 'Narrative'],
        segmentKey: 'rivalry',
        segmentLabel: 'Rivalry Focus',
        introTitle: 'Rivalry focus',
        introDetail: 'The desk narrows in on one matchup and the narrative edge surrounding it.',
        roleLabel: 'Headline',
        focusNote: 'The rivalry is the story here, with one support cue only if it sharpens the angle.',
        stages: [
          {
            id: 'desk',
            label: 'Desk',
            summary: 'Rivalry Focus starts with the relationship story.',
            detail: rivalry.narrative,
            tags: ['Rivalry', 'Desk'],
            dwellMs: 6000,
            spotlight: buildSpotlight({
              id: 'rivalry-spotlight',
              label: 'Edge Holder',
              family: 'Head-to-Head',
              note: rivalry.edge,
              supportLine: rivalry.narrative,
              tone: 'rivalry',
              team: rivalryLeftContext,
              stats: [
                { label: 'Record', value: rivalry.record },
                { label: 'Margin', value: rivalry.avgMargin },
                { label: 'Next', value: rivalry.nextMeeting },
              ],
            }),
            content: (
              <RivalryFocusBoard
                matchup={rivalry.matchup}
                narrative={rivalry.narrative}
                edge={rivalry.edge}
                record={rivalry.record}
                avgMargin={rivalry.avgMargin}
                nextMeeting={rivalry.nextMeeting}
                leftTeam={rivalryLeftContext}
                rightTeam={rivalryRightContext}
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'The rivalry closes on why the next meeting matters.',
            detail: `${rivalry.edge}. Next meeting: ${rivalry.nextMeeting}.`,
            tags: ['Rivalry', 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'rivalry-wrap',
              label: 'Response Side',
              family: 'Rivalry Desk',
              note: rivalry.nextMeeting,
              supportLine: `${rivalry.matchup} stays relevant because the edge and the next meeting still carry real leverage.`,
              tone: 'rivalry',
              team: rivalryRightContext ?? rivalryLeftContext,
              stats: [
                { label: 'Edge', value: rivalry.edge },
                { label: 'Record', value: rivalry.record },
                { label: 'Next', value: rivalry.nextMeeting },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Rivalry Wrap"
                stamp="NEXT MEETING"
                headline={`${rivalry.matchup} still carries weight`}
                detail={`${rivalry.edge}, the record sits at ${rivalry.record}, and the next meeting remains the real payoff on this rivalry desk package.`}
                tone="neutral"
                metrics={[
                  { label: 'Record', value: rivalry.record },
                  { label: 'Next', value: rivalry.nextMeeting },
                ]}
                aside={shockResult ? (
                  <ShockResultCard
                    winner={shockResult.winner}
                    loser={shockResult.loser}
                    rankGap={`${shockResult.rankGap} places`}
                    profitMargin={formatSigned(shockResult.profitMargin)}
                    detail={`${shockResult.division} • ${shockResult.gw}`}
                    stamp="LATEST SWING"
                  />
                ) : null}
              />
            ),
          },
        ],
      });
    }

    if (data.reportPack.predictionScoreboard.weeks.length > 0 && predictionDeskState) {
      const predictionRows = buildPredictionRows();
      const predictionLeader = predictionDeskState.leader;
      const predictionChaser = predictionDeskState.chaser;
      const predictionLeaderGap = predictionDeskState.leaderGap;
      const predictionLeaderContext = predictionDeskState.leaderContext;
      const predictionChaserContext = predictionDeskState.chaserContext ?? predictionDeskState.leaderContext;
      const predictionWeekLabel = predictionDeskState.latestWeek ?? data.state.currentGw;
      const predictionInsights: RaceInsight[] = [
        {
          label: 'Latest week winner',
          value: predictionDeskState.latestWeekWinner?.picker ?? predictionLeader?.picker ?? 'Live',
          note: predictionDeskState.latestWeek
            ? `${predictionWeekLabel} is the latest scoreboard checkpoint in the desk race.`
            : 'The most recent desk checkpoint defines the next shift in the totals board.',
        },
        {
          label: 'Gap story',
          value: predictionLeaderGap !== null ? `${predictionLeaderGap} pts` : 'Live',
          note: predictionLeaderGap !== null && predictionLeaderGap <= 2
            ? `${predictionChaser?.picker ?? 'The chaser'} remain close enough to keep the race open.`
            : `${predictionLeader?.picker ?? 'The leader'} currently hold a clearer cushion on totals.`,
        },
        {
          label: 'Perfect week threat',
          value: predictionLeader ? `${predictionLeader.perfectWeeks}` : '0',
          note: predictionLeader
            ? `${predictionLeader.picker} has ${predictionLeader.perfectWeeks} perfect-week mark${predictionLeader.perfectWeeks === 1 ? '' : 's'} on the board.`
            : 'Perfect-week pressure is part of the desk race context.',
        },
      ];
      nextPackages.push({
        id: 'prediction-desk',
        kicker: 'Prediction Desk',
        headline: predictionLeader ? `${predictionLeader.picker} lead Jay v Computer` : 'Jay v Computer trend line',
        summary: 'The prediction race changes pace without leaving the scoreboard story.',
        detail: predictionLeader && predictionChaser
          ? `${predictionLeader.picker} leads the Jay versus Computer desk battle by ${predictionLeaderGap ?? 0} point${predictionLeaderGap === 1 ? '' : 's'}.`
          : 'The line tells one simple story: who is ahead in the desk battle.',
        tags: ['Predictions', 'Trend', 'Desk'],
        segmentKey: 'prediction',
        segmentLabel: 'Prediction Desk',
        introTitle: 'Prediction desk',
        introDetail: 'The rundown pivots to Jay versus Computer and the running scoreboard story.',
        roleLabel: 'Support',
        focusNote: 'Prediction Desk is a clean Jay-versus-Computer change of pace inside the loop.',
        stages: [
          {
            id: 'trend',
            label: 'Trend',
            summary: 'Prediction Desk opens on the Jay versus Computer trend line.',
            detail: predictionLeader && predictionChaser
              ? `${predictionLeader.picker} currently lead, while ${predictionChaser.picker} stay close enough to keep the desk race live.`
              : 'The running trend line is the quickest way into the desk race.',
            tags: ['Predictions', 'Trend'],
            dwellMs: 6000,
            spotlight: buildSpotlight({
              id: 'prediction-spotlight',
              label: 'Desk Leader',
              family: 'Prediction Desk',
              note: predictionWeekLabel,
              supportLine: predictionLeader && predictionChaser
                ? `${predictionLeader.picker} set the desk pace, but ${predictionChaser.picker} remain the side still pressing the line.`
                : 'Prediction Desk stays tied to one live scoreboard leader.',
              tone: 'prediction',
              team: predictionLeaderContext,
              stats: [
                { label: 'Leader', value: predictionLeader ? `${predictionLeader.points} pts` : '' },
                { label: 'Gap', value: predictionLeaderGap !== null ? `${predictionLeaderGap} pts` : '' },
                { label: 'Week', value: predictionWeekLabel },
              ],
            }),
            content: (
              <PredictionTrendChart
                title="Prediction Scoreboard Trend"
                subtitle={`${data.state.currentSeason} cumulative • Jay v Computer`}
                weeks={data.reportPack.predictionScoreboard.weeks}
              />
            ),
          },
          {
            id: 'desk-race',
            label: 'Desk Race',
            summary: 'The prediction race is reduced to leader, gap, and closing pressure.',
            detail: predictionLeader && predictionChaser
              ? `${predictionLeader.picker} hold the totals edge, but the real desk question is whether ${predictionChaser.picker} are closing the gap.`
              : 'The totals board reduces the desk race to one clean leaderboard.',
            tags: ['Predictions', 'Desk Race'],
            dwellMs: 5000,
            spotlight: buildSpotlight({
              id: 'prediction-wrap',
              label: predictionLeaderGap !== null && predictionLeaderGap <= 2 ? 'Gap Closing' : 'Desk Watch',
              family: 'Prediction Desk',
              note: predictionLeader?.picker ?? 'Desk',
              supportLine: predictionLeader && predictionChaser
                ? `${predictionChaser.picker} is the chase-side to watch while ${predictionLeader.picker} try to protect the current desk edge.`
                : 'The prediction desk stays tied to one live race angle.',
              tone: 'prediction',
              team: predictionLeaderGap !== null && predictionLeaderGap <= 2 ? predictionChaserContext : predictionLeaderContext,
              stats: [
                { label: 'Leader', value: predictionLeader?.picker ?? '' },
                { label: 'Gap', value: predictionLeaderGap !== null ? `${predictionLeaderGap} pts` : '' },
                { label: 'Perfect', value: predictionLeader ? `${predictionLeader.perfectWeeks}` : '' },
              ],
            }),
            content: (
              <EditorialStoryBoard
                kicker="Prediction Desk"
                strap="TOTALS"
                headline={predictionLeader ? `${predictionLeader.picker.toUpperCase()} SET THE DESK PACE` : 'PREDICTION RACE LIVE'}
                detail={predictionLeader && predictionChaser
                  ? `${predictionLeader.picker} lead the cumulative desk board with ${predictionLeader.points} points, while ${predictionChaser.picker} remain the closest live threat on the Jay-versus-Computer line.`
                  : 'The prediction desk reduces the race to one clean totals picture before handing back to the competition packages.'}
                contextRows={[
                  { label: 'Leader', value: predictionLeader?.picker ?? 'Live' },
                  { label: 'Gap', value: predictionLeaderGap !== null ? `+${predictionLeaderGap} pts` : 'Live' },
                  { label: 'Nearest challenger', value: predictionChaser?.picker ?? 'Live' },
                ]}
                insights={predictionInsights}
                aside={<CompactLeaderboard title="Desk Totals" strap="Jay v Computer" rows={predictionRows} />}
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'Prediction Desk closes on the current Jay versus Computer balance.',
            detail: predictionLeader && predictionChaser
              ? `${predictionLeader.picker} leave the desk package on top, but ${predictionChaser.picker} stay close enough to keep the next return live.`
              : 'The prediction desk closes by resetting the live scoreboard leader.',
            tags: ['Predictions', 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'prediction-close',
              label: 'Desk Close',
              family: 'Prediction Desk',
              note: predictionLeader?.picker ?? 'Desk',
              supportLine: predictionLeader && predictionChaser
                ? `${predictionLeader.picker} leave the segment in front, and the next desk return will test whether ${predictionChaser.picker} are any closer.`
                : 'The prediction desk closes by resetting the active race leader.',
              tone: 'prediction',
              team: predictionLeaderContext,
              stats: [
                { label: 'Leader', value: predictionLeader?.picker ?? '' },
                { label: 'Points', value: predictionLeader ? `${predictionLeader.points}` : '' },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Prediction Wrap"
                stamp="DESK CLOSE"
                headline={predictionLeader ? `${predictionLeader.picker} keep the desk lead` : 'Prediction race reset'}
                detail={predictionLeader && predictionChaser
                  ? `${predictionLeader.picker} leave the prediction package still leading Jay versus Computer, and the next desk return will ask whether ${predictionChaser.picker} have narrowed the gap.`
                  : 'The prediction package closes by resetting the live desk race.'}
                tone="neutral"
                metrics={[
                  { label: 'Leader', value: predictionLeader?.picker ?? 'Live' },
                  { label: 'Gap', value: predictionLeaderGap !== null ? `${predictionLeaderGap} pts` : 'Live' },
                ]}
              />
            ),
          },
        ],
      });
    }

    if (archiveRows.length > 0) {
      const archiveContext = buildTeamContext(archiveLeader?.teamId ?? null);
      nextPackages.push({
        id: 'archive-focus',
        kicker: 'Archive Focus',
        headline: archiveLeader ? `${archiveLeader.teamName} remains the archive benchmark` : 'All-time leaderboard check',
        summary: 'Current stories get their historical weight here.',
        detail: archiveLeader
          ? `${archiveLeader.teamName} still carry the heaviest all-time points benchmark, which gives the current loop a clear historical reference.`
          : 'The archive package shows who carries the heaviest long-term status.',
        tags: ['Archive', 'All-Time', 'History'],
        segmentKey: 'archive',
        segmentLabel: 'Archive Focus',
        introTitle: 'Archive focus',
        introDetail: 'The rundown pauses for historical context and all-time leaderboard framing.',
        roleLabel: 'Support',
        focusNote: 'Use archive as a short prestige beat, not as a data dump.',
        stages: [
          {
            id: 'heavyweight',
            label: 'Heavyweight',
            summary: 'Archive Focus opens on one all-time benchmark team.',
            detail: archiveLeader
              ? `${archiveLeader.teamName} remain the all-time benchmark, so the archive package stays tied to one meaningful reference point.`
              : 'Archive Focus always starts with one heavyweight benchmark.',
            tags: ['Archive', 'Benchmark'],
            dwellMs: 5000,
            spotlight: buildSpotlight({
              id: 'archive-spotlight',
              label: 'All-Time Giant',
              family: 'Archive Focus',
              note: `${data.allTime.fromSeason}-${data.allTime.toSeason}`,
              supportLine: archiveLeader
                ? `${archiveLeader.teamName} still set the benchmark when the archive lens comes on.`
                : 'The archive rail tracks the current historical benchmark.',
              tone: 'archive',
              team: archiveContext,
              stats: [
                { label: 'All-Time', value: archiveLeader ? `#${archiveLeader.rank}` : '' },
                { label: 'Points', value: archiveLeader ? `${archiveLeader.points}` : '' },
                { label: 'Current', value: formatOptionalRank(archiveContext?.rank) },
              ],
            }),
            content: (
              <SpotlightFeatureBoard
                teamName={archiveContext?.teamName ?? archiveLeader?.teamName ?? 'Archive Focus'}
                angleLabel="All-Time Heavyweight"
                supportLine={archiveLeader
                  ? `${archiveLeader.teamName} remain the historical benchmark, so every current story gets measured against them when the archive package opens.`
                  : 'Historical context is framed through one clear benchmark side.'}
                ballColor={archiveContext?.ballColor}
                ringColor={archiveContext?.ringColor}
                textColor={archiveContext?.textColor}
                metrics={[
                  { label: 'All-Time Rank', value: archiveLeader ? `#${archiveLeader.rank}` : 'Live' },
                  { label: 'Points', value: archiveLeader ? `${archiveLeader.points} pts` : 'Live' },
                  { label: 'Profit', value: archiveLeader ? formatSigned(archiveLeader.profit) : 'Live' },
                ]}
                notes={[`Archive span: ${data.allTime.fromSeason} to ${data.allTime.toSeason}.`]}
              />
            ),
          },
          {
            id: 'leaderboard',
            label: 'Leaderboard',
            summary: 'The archive story widens just enough to show the current historical order.',
            detail: 'Archive support stays concise: one benchmark, then the leaderboard that explains it.',
            tags: ['Archive', 'Leaders'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'archive-wrap',
              label: 'Legacy Benchmark',
              family: 'Archive Desk',
              note: 'History',
              supportLine: archiveLeader
                ? `${archiveLeader.teamName} are still the team every historical comparison has to pass through.`
                : 'The archive board stays anchored to one benchmark.',
              tone: 'archive',
              team: archiveContext,
              stats: [
                { label: 'All-Time', value: archiveLeader ? `#${archiveLeader.rank}` : '' },
                { label: 'Points', value: archiveLeader ? `${archiveLeader.points}` : '' },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Archive Desk"
                stamp={`${data.allTime.fromSeason} to ${data.allTime.toSeason}`}
                headline={archiveLeader ? `${archiveLeader.teamName} remain the archive benchmark` : 'Archive leaderboard live'}
                detail={archiveLeader
                  ? `${archiveLeader.teamName} still sit atop the all-time points board, which gives the current broadcast loop a historical benchmark that actually means something.`
                  : 'The archive package gives the current loop a sense of long-term weight and legacy.'}
                tone="neutral"
                metrics={[
                  { label: 'Leader', value: archiveLeader?.teamName ?? 'Live' },
                  { label: 'Span', value: `${data.allTime.fromSeason}-${data.allTime.toSeason}` },
                ]}
                aside={<CompactLeaderboard title="All-Time Points" strap="Archive Reference" rows={archiveRows} />}
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'Archive Focus closes on the benchmark team the current loop still has to measure against.',
            detail: archiveLeader
              ? `${archiveLeader.teamName} leave the archive package as the benchmark every live story still passes through.`
              : 'Archive Focus closes by resetting the active benchmark side.',
            tags: ['Archive', 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'archive-close',
              label: 'Archive Close',
              family: 'Archive Focus',
              note: 'Benchmark',
              supportLine: archiveLeader
                ? `${archiveLeader.teamName} remain the benchmark when the archive package hands back to the live loop.`
                : 'Archive Focus closes by keeping one benchmark team in view.',
              tone: 'archive',
              team: archiveContext,
              stats: [
                { label: 'All-Time', value: archiveLeader ? `#${archiveLeader.rank}` : '' },
                { label: 'Span', value: `${data.allTime.fromSeason}-${data.allTime.toSeason}` },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Archive Wrap"
                stamp="LEGACY"
                headline={archiveLeader ? `${archiveLeader.teamName} still define the archive benchmark` : 'Archive benchmark set'}
                detail={archiveLeader
                  ? `${archiveLeader.teamName} leave Archive Focus as the historical team the live loop still has to measure itself against.`
                  : 'Archive Focus closes by resetting the historical benchmark before the loop moves on.'}
                tone="neutral"
                metrics={[
                  { label: 'Leader', value: archiveLeader?.teamName ?? 'Live' },
                  { label: 'Span', value: `${data.allTime.fromSeason}-${data.allTime.toSeason}` },
                ]}
              />
            ),
          },
        ],
      });
    }

    const featureTeam = biggestRiseContext ?? cupFeature?.featuredTeam ?? primaryLeaderContext ?? buildTeamContext(archiveLeader?.teamId ?? null) ?? fallbackContext;
    if (featureTeam) {
      const featureAngle = biggestRiseContext
        ? 'Under-the-Radar Climber'
        : cupFeature?.featuredTeam
          ? 'Cup Livewire'
          : primaryLeaderContext
            ? 'Title Pace-Setter'
            : 'Archive Heavyweight';
      const featureStoryTone = /climb|riser/i.test(featureAngle)
        ? 'climber'
        : /slump|pressure|livewire/i.test(featureAngle)
          ? 'pressure'
          : 'leader';
      const featureBundle = featureTeam.division ? divisionJourneyBundles.get(featureTeam.division) ?? null : null;
      const featureDivisionTable = featureTeam.division
        ? studioDivisions.find((division) => division.title === featureTeam.division) ?? null
        : null;
      nextPackages.push({
        id: 'team-spotlight-feature',
        kicker: 'Team Spotlight',
        headline: `${featureTeam.teamName} take the feature package`,
        summary: 'The team spotlight is a full feature, not just a sidebar identity card.',
        detail: `${featureTeam.teamName} get a full story package built around the clearest current angle attached to them.`,
        tags: ['Team Spotlight', featureAngle, data.state.currentGw],
        segmentKey: 'spotlight',
        segmentLabel: 'Team Spotlight Feature',
        introTitle: 'Spotlight feature',
        introDetail: 'The loop ends with one full team feature package before cycling back to the lead story.',
        roleLabel: 'Headline',
        focusNote: 'This is the long-form team package: identity first, then the supporting graphic that proves the angle.',
        stages: [
          {
            id: 'hero',
            label: 'Hero',
            summary: 'The spotlight package opens on team identity and the reason they matter now.',
            detail: `${featureTeam.teamName} are on screen now because the current loop has attached the ${featureAngle.toLowerCase()} angle to them.`,
            tags: ['Spotlight', 'Hero'],
            dwellMs: 6000,
            spotlight: buildSpotlight({
              id: 'feature-hero',
              label: featureAngle,
              family: 'Team Spotlight',
              note: featureTeam.division ? resolveDivisionDisplayName(featureTeam.division) : 'Feature',
              supportLine: `${featureTeam.teamName} are the current feature team because that angle now best explains why they matter in the loop.`,
              tone: 'spotlight',
              team: featureTeam,
              stats: [
                { label: 'Rank', value: featureTeam.rank !== null ? `#${featureTeam.rank}` : '' },
                { label: 'Points', value: featureTeam.points !== null ? `${featureTeam.points}` : '' },
                { label: 'Move', value: featureTeam.movement !== null ? formatMovement(featureTeam.movement) : '' },
              ],
            }),
            content: (
              <SpotlightFeatureBoard
                teamName={featureTeam.teamName}
                angleLabel={featureAngle}
                supportLine={`${featureTeam.teamName} are being treated as the full feature package because that angle gives the loop one clean team-led story before the cycle restarts.`}
                ballColor={featureTeam.ballColor}
                ringColor={featureTeam.ringColor}
                textColor={featureTeam.textColor}
                metrics={[
                  { label: 'Rank', value: featureTeam.rank !== null ? `#${featureTeam.rank}` : 'Live' },
                  { label: 'Points', value: featureTeam.points !== null ? `${featureTeam.points}` : 'Live' },
                  { label: 'Profit', value: featureTeam.profit !== null ? formatSigned(featureTeam.profit) : 'Live' },
                ]}
                notes={[featureTeam.division ? `${featureTeam.teamName} currently sit in ${resolveDivisionDisplayName(featureTeam.division)}.` : 'Current division context is live when available.']}
              />
            ),
          },
          {
            id: 'support',
            label: 'Support Graphic',
            summary: 'The spotlight angle is then proved with one supporting graphic.',
            detail: featureBundle
              ? 'The supporting graphic keeps the same team highlighted inside its wider division path.'
              : featureDivisionTable
                ? 'The supporting table holds the same team inside their live division frame.'
              : 'The supporting context stays selective so the hero angle remains clear.',
            tags: ['Spotlight', 'Support'],
            dwellMs: 8000,
            animationLockMs: 6000,
            spotlight: buildSpotlight({
              id: 'feature-support',
              label: featureAngle,
              family: 'Spotlight Support',
              note: featureTeam.division ? resolveDivisionDisplayName(featureTeam.division) : 'Feature',
              supportLine: `${featureTeam.teamName} remain highlighted while the support graphic explains the wider competitive context.`,
              tone: 'spotlight',
              team: featureTeam,
              stats: [
                { label: 'Form', value: featureTeam.trendPoints !== null ? formatPointsDelta(featureTeam.trendPoints) : '' },
                { label: 'Profit', value: featureTeam.trendProfit !== null ? formatSigned(featureTeam.trendProfit) : '' },
              ],
            }),
            content: featureBundle ? (
              <div className="sny-news-chart-shell">
                <SnyJourneyMotionGraphic
                  teams={featureBundle.teams}
                  gwNumbers={featureBundle.gwNumbers}
                  divisionTitle={featureBundle.division}
                  cutLineTitle={featureBundle.sourceDivision}
                  highlightedTeamId={featureTeam.teamId}
                  stageDwellMs={8000}
                  lockTimeline
                  storyTone={featureStoryTone}
                  contextTitle={`${featureTeam.teamName} Journey`}
                  contextRows={[
                    { label: 'Leader', value: featureDivisionTable?.rows[0]?.teamName ?? featureTeam.teamName },
                    { label: 'Feature team', value: featureTeam.teamName },
                    { label: 'Division', value: featureTeam.division ? resolveDivisionDisplayName(featureTeam.division) : 'Feature' },
                  ]}
                  finalRows={[
                    { label: 'Focus', value: featureTeam.teamName },
                    { label: 'Rank', value: featureTeam.rank !== null ? `#${featureTeam.rank}` : 'Live' },
                    { label: 'Form', value: featureTeam.trendPoints !== null ? formatPointsDelta(featureTeam.trendPoints) : 'Live' },
                  ]}
                  finalInsight={`${featureTeam.teamName} stay on screen because the support graphic keeps the current ${featureAngle.toLowerCase()} angle grounded in the wider race.`}
                />
              </div>
            ) : featureDivisionTable ? (
              <StudioTableCarousel
                divisions={[featureDivisionTable]}
                intervalMs={9000}
                presentationMode="clean"
                readabilityMode="compact"
                highlightedTeamId={featureTeam.teamId}
              />
            ) : (
              <StorylineSlide
                kicker="Spotlight Support"
                stamp="CONTEXT"
                headline={`${featureTeam.teamName} inside the wider picture`}
                detail={`${featureTeam.teamName} remain the hero, but the support graphic stays selective so the feature package does not collapse back into a dashboard dump.`}
                tone="neutral"
              />
            ),
          },
          {
            id: 'wrap',
            label: 'Wrap',
            summary: 'The team feature closes with the one thing to remember about this side.',
            detail: `${featureTeam.teamName} leave the package with one clean memory hook, then the loop returns to the front page.`,
            tags: ['Spotlight', 'Wrap'],
            dwellMs: 4000,
            spotlight: buildSpotlight({
              id: 'feature-wrap',
              label: 'Why Now',
              family: 'Team Spotlight',
              note: 'Wrap',
              supportLine: `${featureTeam.teamName} are closing the loop because the current angle still gives the viewer a reason to care when the cycle restarts.`,
              tone: 'spotlight',
              team: featureTeam,
              stats: [
                { label: 'Rank', value: featureTeam.rank !== null ? `#${featureTeam.rank}` : '' },
                { label: 'Form', value: featureTeam.trendPoints !== null ? formatPointsDelta(featureTeam.trendPoints) : '' },
              ],
            }),
            content: (
              <StorylineSlide
                kicker="Spotlight Wrap"
                stamp="WHY NOW"
                headline={`${featureTeam.teamName} stay worth watching`}
                detail={`${featureTeam.teamName} leave the feature package with the ${featureAngle.toLowerCase()} angle still intact, which gives the returning news lead a clear handback point.`}
                tone="neutral"
                metrics={[
                  { label: 'Angle', value: featureAngle },
                  { label: 'Division', value: featureTeam.division ? resolveDivisionDisplayName(featureTeam.division) : 'Live' },
                ]}
              />
            ),
          },
        ],
      });
    }

    if (nextPackages.length === 0) {
      nextPackages.push({
        id: 'fallback',
        kicker: 'Sky Sports News New',
        headline: 'Broadcast package standby',
        summary: 'The screen stays clean while the next package is prepared.',
        detail: 'The layout remains live and ready for the next headline.',
        tags: ['Fallback', 'Support', 'Studio'],
        segmentKey: 'feature',
        segmentLabel: 'Standby',
        introTitle: 'Studio standby',
        introDetail: 'The newsroom shell stays live while the next available analytics package is prepared.',
        roleLabel: 'Support',
        focusNote: 'Standby should still feel like a controlled broadcast state.',
        stages: [
          {
            id: 'hold',
            label: 'Hold',
            summary: 'The screen stays ready while the next package is prepared.',
            detail: 'The presentation shell is live and waiting for the next headline or competition cue.',
            tags: ['Standby', 'Studio'],
            dwellMs: 4000,
            content: (
              <StorylineSlide
                kicker="Standby"
                headline="Waiting for the next studio signal"
                detail="The presentation shell is ready and will surface the next available storyline, table, cup, rivalry, or prediction package."
                tone="neutral"
              />
            ),
          },
        ],
      });
    }

    return finalizeClockPackages(nextPackages);
  }, [
    archiveLeader,
    archiveRows,
    cupFeature,
    data,
    divisionJourneyBundles,
    divisionSnapshotByTitle,
    masterJourneyBundle,
    masterLeader,
    primaryDivision,
    predictionDeskState,
    primaryRaceBars,
    primaryStory,
    reportSnapshot,
    rivalry,
    seasonNumber,
    shockResult,
    studioDivisions,
  ]);

  const tickerItems = useMemo(() => {
    if (!data) {
      return [
        'SKY SPORTS NEWS NEW is loading its isolated presentation layer.',
        'Existing Sky Sports News routes remain untouched.',
        'Report, table, cup, archive, and prediction feeds are being composed.',
      ];
    }

    const items = [
      ...data.reportPack.story.tickerItems.slice(0, 8),
      ...data.reportPack.presenterNotes.slice(0, 4),
      ...data.reportPack.achievements.slice(0, 3).map((achievement) => `${achievement.label}: ${achievement.teamName} ${achievement.value}`),
      ...data.cupStatus.slice(0, 2).map((status) => `${status.roundName}: ${status.resolvedFixtures}/${status.totalFixtures} resolved`),
    ];

    if (data.bookieDor.holder) {
      items.push(`Bookie d'Or watch: ${data.bookieDor.holder.teamName} lead the all-competition points board.`);
    }
    if (shockResult) {
      items.push(`Upset watch: ${shockResult.winner} over ${shockResult.loser} in ${shockResult.division}.`);
    }
    if (primaryDivision) {
      items.push(`${primaryDivision.title}: ${primaryDivision.rows[0]?.teamName ?? 'Lead team'} set the pace at the top.`);
    }

    return Array.from(new Set(items.filter((item) => item && item.trim().length > 0))).slice(0, 18);
  }, [data, primaryDivision, shockResult]);

  return (
    <section className="page page-wide sny-news-new-page">
      {error ? (
        <div className="sny-news-new-alert sny-news-new-alert-floating">
          <strong>Data load issue</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <SnyNewsLayout
        packages={packages}
        tickerLabel="SKY SPORTS NEWS NEW"
        tickerItems={tickerItems}
      />
    </section>
  );
}
