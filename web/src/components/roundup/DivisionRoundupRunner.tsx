import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BroadcastBattleBoard,
  CompetitionBracketBoard,
  CompetitionBracketTree,
  LowerThirdAlertRail,
  type BroadcastBattleCard,
  type CompetitionBracketRound,
  type CompetitionBracketTie,
  type LowerThirdAlertItem,
} from '../StudioLiveWidgets';
import { TickerBar } from '../TickerBar';
import { TeamBadge } from '../TeamBadge';
import { parseGwNumber } from './roundupLogic';
import { DivisionJourneyGraph } from './DivisionJourneyGraph';
import { DivisionLiveTable } from './DivisionLiveTable';
import { DivisionResultsFixturesSlide } from './DivisionResultsFixturesSlide';
import type {
  ChampionsSpotlightEntry,
  ChampionsSpotlightModel,
  CupSegmentModel,
  DivisionKey,
  DivisionRoundupData,
  PreviousChampionRow,
  RoundupAllTimePayload,
  RoundupForecastRow,
  RoundupFixture,
  RoundupHistoryRow,
  RoundupMasterCupFixture,
  RoundupMasterLeagueFixture,
  RoundupMasterLeagueRow,
  RoundupShowSelection,
  RoundupSuperCupFixture,
  RoundupTeamPredictionRace,
  RoundupTeam,
  RoundupTrioLeagueFixture,
  RoundupTrioLeagueRow,
} from './roundupTypes';

type ShowSlideGroup =
  | 'opening'
  | 'division'
  | 'master'
  | 'trio'
  | 'cup'
  | 'all-time'
  | 'division-archive'
  | 'spotlight'
  | 'breaking'
  | 'recap'
  | 'closing';

type ShowSlide = {
  id: string;
  durationMs: number;
  content: ReactNode;
  emphasis?: 'normal' | 'key-final';
  group: ShowSlideGroup;
  scope?: string;
};

type DivisionRoundupRunnerProps = {
  currentSeason: string;
  currentGw: string;
  cycleAnchor: string;
  divisions: DivisionRoundupData[];
  previousChampions: PreviousChampionRow[];
  championsSpotlight: ChampionsSpotlightModel | null;
  cupSegment: CupSegmentModel | null;
  superCupFixtures: RoundupSuperCupFixture[];
  teams: RoundupTeam[];
  fixtures: RoundupFixture[];
  histories: Record<number, RoundupHistoryRow[]>;
  masterLeagueRows: RoundupMasterLeagueRow[];
  masterLeagueFixtures: RoundupMasterLeagueFixture[];
  masterLeagueForecast: RoundupForecastRow[];
  masterCupFixtures: RoundupMasterCupFixture[];
  trioLeagueRows: RoundupTrioLeagueRow[];
  trioLeagueFixtures: RoundupTrioLeagueFixture[];
  trioForecastsByDivision: Record<string, RoundupForecastRow[]>;
  divisionForecastsByKey: Partial<Record<DivisionKey, RoundupForecastRow[]>>;
  allTimeLeagues: RoundupAllTimePayload | null;
  teamPredictionRaceBySeason: Record<string, Record<string, RoundupTeamPredictionRace>>;
  selection: RoundupShowSelection;
};

function normalizeTeamName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function minDuration(valueMs: number): number {
  return Math.max(6500, valueMs);
}

function graphAnimationDurationMs(currentGwNumber: number): number {
  return Math.max(1, currentGwNumber) * 1300;
}

function graphSlideDurationMs(currentGwNumber: number): number {
  return graphAnimationDurationMs(currentGwNumber) + 2500;
}

function signedInteger(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const sign = safe > 0 ? '+' : '';
  return `${sign}${safe}`;
}

function signedFloat(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? '+' : '';
  return `${sign}${safe.toFixed(2)}`;
}

function formatForm(form: Array<'W' | 'D' | 'L'>): string {
  return form.length > 0 ? form.join('-') : 'N/A';
}

function rankShiftLabel(delta: number): string {
  if (delta > 0) {
    return `↑ ${Math.abs(delta)}`;
  }
  if (delta < 0) {
    return `↓ ${Math.abs(delta)}`;
  }
  return '→ 0';
}

function formatOrdinalPosition(value: number): string {
  const safe = Math.max(1, Math.round(value));
  const remainderTen = safe % 10;
  const remainderHundred = safe % 100;
  if (remainderTen === 1 && remainderHundred !== 11) {
    return `${safe}st`;
  }
  if (remainderTen === 2 && remainderHundred !== 12) {
    return `${safe}nd`;
  }
  if (remainderTen === 3 && remainderHundred !== 13) {
    return `${safe}rd`;
  }
  return `${safe}th`;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function trioStageLabel(fixture: RoundupTrioLeagueFixture): string {
  if (fixture.stage === 'playoff_semi') {
    return 'Playoff Semi';
  }
  if (fixture.stage === 'playoff_final') {
    return 'Playoff Final';
  }
  return 'Regular Season';
}

function filterSlidesForSelection(slides: ShowSlide[], selection: RoundupShowSelection): ShowSlide[] {
  const openingSlides = slides.filter((slide) => slide.group === 'opening');
  if (selection.primary === 'full') {
    return slides;
  }

  if (selection.primary === 'leagues') {
    if (selection.league === 'all') {
      return [
        ...openingSlides,
        ...slides.filter((slide) => slide.group === 'division' || slide.group === 'master' || slide.group === 'trio' || slide.group === 'all-time'),
      ];
    }
    if (selection.league === 'divisions') {
      return [
        ...openingSlides,
        ...slides.filter((slide) =>
          slide.group === 'division'
          && (selection.division === 'all' || slide.scope === selection.division),
        ),
      ];
    }
    if (selection.league === 'master') {
      return [...openingSlides, ...slides.filter((slide) => slide.group === 'master')];
    }
    if (selection.league === 'trio') {
      return [...openingSlides, ...slides.filter((slide) => slide.group === 'trio')];
    }
    return [...openingSlides, ...slides.filter((slide) => slide.group === 'all-time')];
  }

  if (selection.primary === 'cups') {
    return [
      ...openingSlides,
      ...slides.filter((slide) =>
        slide.group === 'cup'
        && (selection.cup === 'all' || slide.scope === selection.cup),
      ),
    ];
  }

  return [
    ...openingSlides,
    ...slides.filter((slide) =>
      slide.group === 'spotlight'
      && (selection.spotlight === 'all' || slide.scope === selection.spotlight),
    ),
  ];
}

type CompetitionStandingsRow = {
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
  projection?: RoundupForecastRow | null;
};

type CompetitionCutLine = {
  afterRank: number;
  tone: 'positive' | 'warning' | 'danger';
  label: string;
  ghost?: boolean;
};

type BreakingNewsStory = {
  id: string;
  kicker: string;
  headline: string;
  writeup: string;
  detail: string;
  score: number;
};

type ThisTimeLastWeekEntry = {
  id: string;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  totalProfit: number;
  appearanceCount: number;
  competitionSummary: string;
};

function roundProfit(value: number | null | undefined): number {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return Number(safe.toFixed(2));
}

function buildThisTimeLastWeekEntries(args: {
  currentGwNumber: number;
  teams: RoundupTeam[];
  fixtures: RoundupFixture[];
  masterLeagueFixtures: RoundupMasterLeagueFixture[];
  trioLeagueFixtures: RoundupTrioLeagueFixture[];
  cupSegment: CupSegmentModel | null;
  masterCupFixtures: RoundupMasterCupFixture[];
}): ThisTimeLastWeekEntry[] {
  const {
    currentGwNumber,
    teams,
    fixtures,
    masterLeagueFixtures,
    trioLeagueFixtures,
    cupSegment,
    masterCupFixtures,
  } = args;
  const targetGwNumber = currentGwNumber - 1;
  if (targetGwNumber < 1) {
    return [];
  }

  const teamByName = new Map<string, RoundupTeam>(
    teams.map((team) => [normalizeTeamName(team.name), team]),
  );
  const byTeam = new Map<string, {
    teamName: string;
    ballColor: string | null;
    ringColor: string | null;
    textColor: string | null;
    totalProfit: number;
    appearanceCount: number;
    competitions: Set<string>;
  }>();

  const addProfit = (teamName: string | null | undefined, profit: number | null | undefined, competition: string) => {
    const safeName = teamName?.trim();
    const safeProfit = roundProfit(profit);
    if (!safeName || safeProfit <= 0) {
      return;
    }
    const normalizedName = normalizeTeamName(safeName);
    const knownTeam = teamByName.get(normalizedName);
    const key = knownTeam ? `team-${knownTeam.id}` : `name-${normalizedName}`;
    const existing = byTeam.get(key) ?? {
      teamName: safeName,
      ballColor: knownTeam?.ballColor ?? null,
      ringColor: knownTeam?.ringColor ?? null,
      textColor: knownTeam?.textColor ?? null,
      totalProfit: 0,
      appearanceCount: 0,
      competitions: new Set<string>(),
    };
    existing.totalProfit = roundProfit(existing.totalProfit + safeProfit);
    existing.appearanceCount += 1;
    existing.competitions.add(competition);
    byTeam.set(key, existing);
  };

  fixtures.forEach((fixture) => {
    if (parseGwNumber(fixture.gw) !== targetGwNumber || fixture.result === 'pending') {
      return;
    }
    addProfit(fixture.homeTeam, fixture.homeProfit, fixture.division);
    addProfit(fixture.awayTeam, fixture.awayProfit, fixture.division);
  });

  masterLeagueFixtures.forEach((fixture) => {
    if (parseGwNumber(fixture.gw) !== targetGwNumber || fixture.result === 'pending') {
      return;
    }
    addProfit(fixture.homeTeam, fixture.homeProfit, 'Master League');
    addProfit(fixture.awayTeam, fixture.awayProfit, 'Master League');
  });

  trioLeagueFixtures.forEach((fixture) => {
    if (parseGwNumber(fixture.gw) !== targetGwNumber || fixture.result === 'pending') {
      return;
    }
    addProfit(fixture.homeTeam, fixture.homeProfit, fixture.division);
    addProfit(fixture.awayTeam, fixture.awayProfit, fixture.division);
  });

  cupSegment?.allRows.forEach((fixture) => {
    if (parseGwNumber(fixture.gw) !== targetGwNumber || !fixture.played) {
      return;
    }
    addProfit(fixture.homeTeam, fixture.homeProfit, 'BookieBall Cup');
    addProfit(fixture.awayTeam, fixture.awayProfit, 'BookieBall Cup');
  });

  masterCupFixtures.forEach((fixture) => {
    if (parseGwNumber(fixture.gw) !== targetGwNumber || !fixture.played) {
      return;
    }
    addProfit(fixture.homeTeam, fixture.homeProfit, 'Master Cup');
    addProfit(fixture.awayTeam, fixture.awayProfit, 'Master Cup');
  });

  return Array.from(byTeam.entries())
    .map(([id, entry]) => {
      const competitionList = Array.from(entry.competitions);
      const leadCompetitions = competitionList.slice(0, 2).join(' / ');
      const extraCompetitions = competitionList.length > 2 ? ` +${competitionList.length - 2}` : '';
      return {
        id,
        teamName: entry.teamName,
        ballColor: entry.ballColor,
        ringColor: entry.ringColor,
        textColor: entry.textColor,
        totalProfit: entry.totalProfit,
        appearanceCount: entry.appearanceCount,
        competitionSummary: `${leadCompetitions}${extraCompetitions}`,
      };
    })
    .sort((left, right) =>
      right.totalProfit - left.totalProfit
      || right.appearanceCount - left.appearanceCount
      || left.teamName.localeCompare(right.teamName),
    );
}

function CompetitionStandingsTable(args: {
  kicker: string;
  title: string;
  subtitle?: string;
  rows: CompetitionStandingsRow[];
  visibleRows?: CompetitionStandingsRow[];
  cutLines?: CompetitionCutLine[];
  projectionMode?: boolean;
}) {
  const { kicker, title, subtitle, rows, visibleRows, cutLines = [], projectionMode = false } = args;
  const orderedRows = (visibleRows ?? rows).slice().sort((left, right) => left.rank - right.rank);
  const fullRows = rows.slice().sort((left, right) => left.rank - right.rank);
  const leader = fullRows[0] ?? null;
  const runnerUp = fullRows[1] ?? null;
  const bottom = fullRows[fullRows.length - 1] ?? null;
  const profitLeader = fullRows
    .slice()
    .sort((left, right) => right.profit - left.profit || right.points - left.points)[0] ?? null;

  return (
    <section className="roundup-competition-table-slide">
      <header className="roundup-slide-head">
        <p className="roundup-kicker">{kicker}</p>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="roundup-competition-table-wrap">
        <aside className="roundup-live-table roundup-live-table--wide" aria-label={`${title} standings`}>
          <table>
            <colgroup>
              <col className="roundup-col-pos" />
              <col className="roundup-col-team" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-stat" />
              <col className="roundup-col-spins" />
              <col className="roundup-col-profit" />
            </colgroup>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Team</th>
                <th>PLD</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>Pts</th>
                <th>Spins</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {orderedRows.map((row) => {
                const cutLine = cutLines.find((line) => line.afterRank === row.rank) ?? null;
                return (
                  <Fragment key={`${title}-${row.teamId}`}>
                    <tr className={projectionMode ? 'is-projection-row' : undefined}>
                      <td>{row.rank}</td>
                      <td>
                        <span className="roundup-team-cell">
                          <TeamBadge
                            name={row.teamName}
                            ballColor={row.ballColor}
                            ringColor={row.ringColor}
                            textColor={row.textColor}
                            size={22}
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
                      <td>{row.profit.toFixed(2)}</td>
                    </tr>
                    {cutLine ? (
                      <tr className={`roundup-cutline-row tone-${cutLine.tone}${cutLine.ghost ? ' is-ghost' : ''}`}>
                        <td colSpan={9}>
                          <span>{cutLine.label}</span>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <div className="roundup-live-table-summary">
            {leader ? (
              <article>
                <span>Leader</span>
                <strong>{leader.teamName}</strong>
                <small>{leader.points} pts • {leader.profit.toFixed(2)} profit</small>
              </article>
            ) : null}
            {runnerUp ? (
              <article>
                <span>Second</span>
                <strong>{runnerUp.teamName}</strong>
                <small>{runnerUp.points} pts • PLD {runnerUp.played}</small>
              </article>
            ) : null}
            {profitLeader ? (
              <article>
                <span>Best Profit</span>
                <strong>{profitLeader.teamName}</strong>
                <small>{profitLeader.profit.toFixed(2)} profit • {profitLeader.spins} spins</small>
              </article>
            ) : null}
            {bottom ? (
              <article>
                <span>Bottom</span>
                <strong>{bottom.teamName}</strong>
                <small>{bottom.points} pts • PLD {bottom.played}</small>
              </article>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function formatProbability(value: number): string {
  return `${value.toFixed(1)}%`;
}

function buildProjectedRows(
  rows: CompetitionStandingsRow[],
  forecastRows: RoundupForecastRow[],
): CompetitionStandingsRow[] {
  const forecastByTeamId = new Map(forecastRows.map((row) => [row.teamId, row]));
  return rows
    .map((row) => {
      const forecast = forecastByTeamId.get(row.teamId) ?? null;
      return {
        ...row,
        rank: forecast?.predictedRank ?? row.rank,
        played: forecast?.predictedPlayed ?? row.played,
        wins: forecast?.predictedWins ?? row.wins,
        draws: forecast?.predictedDraws ?? row.draws,
        losses: forecast?.predictedLosses ?? row.losses,
        points: forecast?.predictedPoints ?? row.points,
        profit: forecast?.predictedProfit ?? row.profit,
        spins: forecast?.predictedSpins ?? row.spins,
        projection: forecast,
      };
    })
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      return left.teamName.localeCompare(right.teamName);
    });
}

function buildDivisionProjectionCutLines(division: DivisionRoundupData): CompetitionCutLine[] {
  const size = division.tableRows.length;
  if (size <= 1) {
    return [];
  }
  const lines: CompetitionCutLine[] = [];
  if (division.key !== 'champions') {
    lines.push({ afterRank: 1, tone: 'positive', label: 'Projected promotion line', ghost: true });
  }
  lines.push({ afterRank: size - 1, tone: 'danger', label: 'Projected drop line', ghost: true });
  return lines;
}

function buildTrioProjectionCutLines(division: string): CompetitionCutLine[] {
  if (division === 'Premier League') {
    return [{ afterRank: 6, tone: 'danger', label: 'Projected relegation line', ghost: true }];
  }
  if (division === 'Ligue 1') {
    return [
      { afterRank: 1, tone: 'positive', label: 'Projected automatic promotion', ghost: true },
      { afterRank: 5, tone: 'warning', label: 'Projected playoff line', ghost: true },
      { afterRank: 6, tone: 'danger', label: 'Projected relegation line', ghost: true },
    ];
  }
  return [
    { afterRank: 1, tone: 'positive', label: 'Projected automatic promotion', ghost: true },
    { afterRank: 5, tone: 'warning', label: 'Projected playoff line', ghost: true },
  ];
}

function buildForecastPulseLine(forecastRows: RoundupForecastRow[], rows: CompetitionStandingsRow[]): string | null {
  if (forecastRows.length === 0 || rows.length === 0) {
    return null;
  }
  const rowByTeamId = new Map(rows.map((row) => [row.teamId, row]));
  const mover = forecastRows
    .map((forecast) => {
      const row = rowByTeamId.get(forecast.teamId);
      if (!row || forecast.projectedDelta === null || forecast.projectedDelta === 0) {
        return null;
      }
      return {
        row,
        forecast,
        swing: Math.abs(forecast.projectedDelta),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => right.swing - left.swing)[0] ?? null;

  if (!mover) {
    return null;
  }

  return mover.forecast.projectedDelta > 0
    ? `Model mover: ${mover.row.teamName} are projected up from ${formatOrdinalPosition(mover.row.rank)} to ${formatOrdinalPosition(mover.forecast.predictedRank ?? mover.row.rank)}.`
    : `Model warning: ${mover.row.teamName} are projected down from ${formatOrdinalPosition(mover.row.rank)} to ${formatOrdinalPosition(mover.forecast.predictedRank ?? mover.row.rank)}.`;
}

function isCupWinner(cupFinish: string): boolean {
  return /winner|champion/i.test(cupFinish);
}

function bestHistoricalFinish(history: RoundupHistoryRow[]): number | null {
  const validRanks = history
    .map((entry) => entry.rank)
    .filter((rank) => Number.isFinite(rank) && rank > 0);
  if (validRanks.length === 0) {
    return null;
  }
  return Math.min(...validRanks);
}

function seasonNumberFromLabel(value: string): number | null {
  const match = value.match(/(\d+)/);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

const DIVISION_SEASON_AXIS: Array<{ tier: number; label: string }> = [
  { tier: 1, label: 'Champions' },
  { tier: 2, label: 'Premier' },
  { tier: 3, label: 'Division 1' },
  { tier: 4, label: 'Division 2' },
  { tier: 5, label: 'Division 3' },
  { tier: 6, label: 'Division 4' },
];

type TeamSeasonDivisionPoint = {
  seasonNumber: number;
  seasonLabel: string;
  divisionTier: number;
  divisionLabel: string;
};

type TeamSeasonDivisionGraphModel = {
  points: TeamSeasonDivisionPoint[];
};

function normalizedDivisionTier(label: string): { tier: number; label: string } {
  const normalized = normalizeTeamName(label);
  if (/champion/.test(normalized)) {
    return { tier: 1, label: 'Champions' };
  }
  if (/premier/.test(normalized)) {
    return { tier: 2, label: 'Premier' };
  }
  if (/division\s*1|div\s*1|average/.test(normalized)) {
    return { tier: 3, label: 'Division 1' };
  }
  if (/division\s*2|div\s*2|struggling/.test(normalized)) {
    return { tier: 4, label: 'Division 2' };
  }
  if (/division\s*3|div\s*3|awful/.test(normalized)) {
    return { tier: 5, label: 'Division 3' };
  }
  if (/division\s*4|div\s*4/.test(normalized)) {
    return { tier: 6, label: 'Division 4' };
  }
  return { tier: 7, label };
}

function buildTeamSeasonDivisionGraph(args: {
  row: DivisionRoundupData['tableRows'][number];
  division: DivisionRoundupData;
  histories: Record<number, RoundupHistoryRow[]>;
  currentSeason: string;
}): TeamSeasonDivisionGraphModel | null {
  const { row, division, histories, currentSeason } = args;
  const bySeason = new Map<number, TeamSeasonDivisionPoint>();
  const teamHistory = histories[row.teamId] ?? [];

  teamHistory.forEach((entry) => {
    const seasonNumber = seasonNumberFromLabel(entry.season);
    if (seasonNumber === null) {
      return;
    }
    const divisionInfo = normalizedDivisionTier(entry.division);
    bySeason.set(seasonNumber, {
      seasonNumber,
      seasonLabel: `S${seasonNumber}`,
      divisionTier: divisionInfo.tier,
      divisionLabel: divisionInfo.label,
    });
  });

  const currentSeasonNumber = seasonNumberFromLabel(currentSeason);
  if (currentSeasonNumber !== null) {
    const currentDivisionInfo = normalizedDivisionTier(row.division || division.title);
    bySeason.set(currentSeasonNumber, {
      seasonNumber: currentSeasonNumber,
      seasonLabel: `S${currentSeasonNumber}`,
      divisionTier: currentDivisionInfo.tier,
      divisionLabel: currentDivisionInfo.label,
    });
  }

  const points = Array.from(bySeason.values()).sort((left, right) => left.seasonNumber - right.seasonNumber);
  if (points.length === 0) {
    return null;
  }
  return { points };
}

function resolveTeamPredictionRace(
  raceByTeam: Record<string, RoundupTeamPredictionRace> | undefined,
  teamName: string,
): RoundupTeamPredictionRace | null {
  if (!raceByTeam) {
    return null;
  }
  if (raceByTeam[teamName]) {
    return raceByTeam[teamName];
  }
  const normalizedName = normalizeTeamName(teamName);
  const matchedName = Object.keys(raceByTeam).find((name) => normalizeTeamName(name) === normalizedName);
  return matchedName ? raceByTeam[matchedName] : null;
}

function buildTeamPredictionRows(args: {
  row: DivisionRoundupData['tableRows'][number];
  histories: Record<number, RoundupHistoryRow[]>;
  currentSeason: string;
  teamPredictionRaceBySeason: Record<string, Record<string, RoundupTeamPredictionRace>>;
}): Array<{
  season: string;
  seasonNumber: number | null;
  jayCorrect: number;
  computerCorrect: number;
  resolved: number;
}> {
  const { row, histories, currentSeason, teamPredictionRaceBySeason } = args;
  const teamHistory = histories[row.teamId] ?? [];
  const historySeasons = teamHistory.map((entry) => entry.season).filter((season) => /^S\d+$/i.test(season));
  const predictionSeasons = Object.keys(teamPredictionRaceBySeason).filter((season) => (
    resolveTeamPredictionRace(teamPredictionRaceBySeason[season], row.teamName) !== null
  ));
  const seasons = Array.from(new Set([currentSeason, ...historySeasons, ...predictionSeasons]));
  return seasons
    .map((season) => {
      const race = resolveTeamPredictionRace(teamPredictionRaceBySeason[season], row.teamName);
      return {
        season,
        seasonNumber: seasonNumberFromLabel(season),
        jayCorrect: race?.jayCorrect ?? 0,
        computerCorrect: race?.computerCorrect ?? 0,
        resolved: race?.resolved ?? 0,
      };
    })
    .sort((left, right) => {
      if (left.seasonNumber !== null && right.seasonNumber !== null) {
        return right.seasonNumber - left.seasonNumber;
      }
      if (left.seasonNumber !== null) {
        return -1;
      }
      if (right.seasonNumber !== null) {
        return 1;
      }
      return right.season.localeCompare(left.season, undefined, { numeric: true, sensitivity: 'base' });
    })
    .slice(0, 3);
}

function TeamSeasonDivisionGraph(args: {
  graph: TeamSeasonDivisionGraphModel;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
}) {
  const {
    graph,
    teamName,
    ballColor,
    ringColor,
    textColor,
  } = args;
  const width = 980;
  const height = 340;
  const leftPad = 112;
  const rightPad = 28;
  const topPad = 20;
  const bottomPad = 46;
  const minSeason = graph.points[0]?.seasonNumber ?? 1;
  const maxSeason = graph.points[graph.points.length - 1]?.seasonNumber ?? minSeason;
  const xFromSeason = (seasonNumber: number): number => {
    if (maxSeason === minSeason) {
      return leftPad + ((width - leftPad - rightPad) / 2);
    }
    const ratio = (seasonNumber - minSeason) / (maxSeason - minSeason);
    return leftPad + ((width - leftPad - rightPad) * ratio);
  };
  const yFromTier = (tier: number): number => {
    const clamped = Math.max(1, Math.min(6, tier));
    const ratio = (clamped - 1) / 5;
    return topPad + ((height - topPad - bottomPad) * ratio);
  };

  const graphPoints = graph.points.map((point) => ({
    ...point,
    x: xFromSeason(point.seasonNumber),
    y: yFromTier(point.divisionTier),
  }));
  const animationSignature = useMemo(
    () => graph.points.map((point) => `${point.seasonNumber}:${point.divisionTier}`).join('|'),
    [graph.points],
  );
  const [activeProgress, setActiveProgress] = useState(0);
  useEffect(() => {
    setActiveProgress(0);
    if (graphPoints.length <= 1) {
      return undefined;
    }
    const segmentCount = graphPoints.length - 1;
    const totalDurationMs = segmentCount * 1000;
    let rafId = 0;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }
      const elapsed = timestamp - startTime;
      const clampedElapsed = Math.min(totalDurationMs, elapsed);
      setActiveProgress(clampedElapsed / 1000);
      if (clampedElapsed < totalDurationMs) {
        rafId = window.requestAnimationFrame(step);
      }
    };
    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [animationSignature, graphPoints.length]);
  const clampedProgress = Math.max(0, Math.min(activeProgress, graphPoints.length - 1));
  const lowerIndex = Math.floor(clampedProgress);
  const upperIndex = Math.min(graphPoints.length - 1, lowerIndex + 1);
  const blend = clampedProgress - lowerIndex;
  const lowerPoint = graphPoints[lowerIndex] ?? null;
  const upperPoint = graphPoints[upperIndex] ?? lowerPoint;
  const activePoint = lowerPoint && upperPoint
    ? {
      x: lowerPoint.x + ((upperPoint.x - lowerPoint.x) * blend),
      y: lowerPoint.y + ((upperPoint.y - lowerPoint.y) * blend),
      seasonLabel: blend === 0 ? lowerPoint.seasonLabel : upperPoint.seasonLabel,
      divisionLabel: blend === 0 ? lowerPoint.divisionLabel : upperPoint.divisionLabel,
    }
    : null;
  const completedPoints = graphPoints.slice(0, lowerIndex + 1);
  const trailPoints = activePoint && blend > 0
    ? [...completedPoints, { x: activePoint.x, y: activePoint.y }]
    : completedPoints;
  const trailPath = trailPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const initials = (teamName.trim().slice(0, 2) || '?').toUpperCase();

  return (
    <section className="roundup-journey-graph" aria-label={`${teamName} season to division journey`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
        <title>{`${teamName} season to division graph`}</title>
        {DIVISION_SEASON_AXIS.map((axis) => {
          const y = yFromTier(axis.tier);
          return (
            <g key={`division-axis-${axis.label}`}>
              <line x1={leftPad} y1={y} x2={width - rightPad} y2={y} className="roundup-grid-line" />
              <text x={12} y={y + 4} className="roundup-grid-rank-label">{axis.label}</text>
            </g>
          );
        })}
        {graphPoints.map((point) => (
          <g key={`season-axis-${point.seasonNumber}`}>
            <line x1={point.x} y1={topPad} x2={point.x} y2={height - bottomPad + 6} className="roundup-grid-column" />
            <text x={point.x} y={height - 12} className="roundup-grid-week-label">{point.seasonLabel}</text>
          </g>
        ))}
        <path d={trailPath} className="roundup-team-trail" style={{ stroke: ringColor ?? ballColor ?? '#f3c62d' }} />
        {completedPoints.map((point) => (
          <g key={`team-marker-${point.seasonNumber}`} transform={`translate(${point.x} ${point.y})`}>
            <circle r={4.5} style={{ fill: ringColor ?? ballColor ?? '#f3c62d' }} />
            <title>{`${point.seasonLabel}: ${point.divisionLabel}`}</title>
          </g>
        ))}
        {activePoint ? (
          <g key={`team-ball-active-${teamName}`} className="roundup-team-ball" transform={`translate(${activePoint.x} ${activePoint.y})`}>
            <circle r={11} style={{ fill: ballColor ?? '#f0f4ff', stroke: ringColor ?? '#ffffff' }} />
            <text x={0} y={0} style={{ fill: textColor ?? '#101010' }}>{initials}</text>
            <title>{`${activePoint.seasonLabel}: ${activePoint.divisionLabel}`}</title>
          </g>
        ) : null}
      </svg>
    </section>
  );
}

const PREVIOUS_WINNER_DIVISION_ORDER = [
  'Champions Division',
  'Premier Division',
  'Division One',
  'Division Two',
  'Division Three',
  'Division Four',
] as const;

function groupPreviousChampions(rows: PreviousChampionRow[]): Array<{ division: string; rows: PreviousChampionRow[] }> {
  const winnersByDivision = new Map<string, PreviousChampionRow[]>();
  rows.forEach((row) => {
    const divisionRows = winnersByDivision.get(row.division) ?? [];
    divisionRows.push(row);
    winnersByDivision.set(row.division, divisionRows);
  });

  const orderedDivisions = [
    ...PREVIOUS_WINNER_DIVISION_ORDER.filter((division) => winnersByDivision.has(division)),
    ...Array.from(winnersByDivision.keys())
      .filter((division) => !PREVIOUS_WINNER_DIVISION_ORDER.includes(division as (typeof PREVIOUS_WINNER_DIVISION_ORDER)[number]))
      .sort((left, right) => left.localeCompare(right)),
  ];

  return orderedDivisions.map((division) => ({
    division,
    rows: (winnersByDivision.get(division) ?? []).slice().sort((left, right) => {
      const leftSeason = seasonNumberFromLabel(left.season);
      const rightSeason = seasonNumberFromLabel(right.season);
      if (leftSeason !== null && rightSeason !== null && leftSeason !== rightSeason) {
        return rightSeason - leftSeason;
      }
      return right.season.localeCompare(left.season);
    }),
  }));
}

function divisionTitleDeciding(division: DivisionRoundupData): boolean {
  const rows = division.tableRows.slice().sort((left, right) => left.rank - right.rank);
  if (rows.length < 2) {
    return false;
  }
  const leader = rows[0];
  const second = rows[1];
  const pointsGap = Math.abs((leader?.points ?? 0) - (second?.points ?? 0));
  const closeToFinish = division.currentGwNumber >= Math.max(1, division.seasonLength - 1);
  return pointsGap <= 2 && closeToFinish;
}

function determineFixtureWinnerLoser(fixture: RoundupFixture): {
  winner: string | null;
  loser: string | null;
  margin: number;
} {
  if (fixture.result === 'pending' || fixture.result === 'draw') {
    return {
      winner: null,
      loser: null,
      margin: Math.abs((fixture.homeProfit ?? 0) - (fixture.awayProfit ?? 0)),
    };
  }
  const margin = Math.abs((fixture.homeProfit ?? 0) - (fixture.awayProfit ?? 0));
  if (fixture.result === 'home') {
    return { winner: fixture.homeTeam, loser: fixture.awayTeam, margin };
  }
  return { winner: fixture.awayTeam, loser: fixture.homeTeam, margin };
}

function sortDivisionRowsByRank(division: DivisionRoundupData): DivisionRoundupData['tableRows'] {
  return division.tableRows.slice().sort((left, right) => left.rank - right.rank);
}

function buildDivisionCommentary(division: DivisionRoundupData): string[] {
  const rows = sortDivisionRowsByRank(division);
  const leader = rows[0];
  const second = rows[1];
  const safe = rows[rows.length - 2];
  const last = rows[rows.length - 1];
  const isSeasonComplete = division.isSeasonComplete;
  const gapPairs = rows
    .slice(0, Math.max(0, rows.length - 1))
    .map((row, index) => {
      const next = rows[index + 1];
      if (!next) {
        return null;
      }
      return {
        index,
        pair: `${row.teamName} / ${next.teamName}`,
        topTeam: row.teamName,
        nextTeam: next.teamName,
        gap: Math.abs(row.points - next.points),
      };
    })
    .filter((value): value is { index: number; pair: string; topTeam: string; nextTeam: string; gap: number } => value !== null)
    .sort((left, right) => left.gap - right.gap);

  const movements = division.journeyTeams.map((team) => {
    const start = team.ranks[0] ?? 1;
    const current = team.ranks[Math.min(team.ranks.length - 1, division.currentGwNumber)] ?? start;
    return {
      teamName: team.teamName,
      start,
      current,
      delta: start - current,
    };
  });
  const biggestRiser = movements
    .filter((movement) => movement.delta > 0)
    .slice()
    .sort((left, right) => right.delta - left.delta)[0] ?? null;
  const biggestFaller = movements
    .filter((movement) => movement.delta < 0)
    .slice()
    .sort((left, right) => left.delta - right.delta)[0] ?? null;
  const leaderMovement = leader ? movements.find((movement) => movement.teamName === leader.teamName) ?? null : null;
  const profitLeader = rows
    .slice()
    .sort((left, right) => right.profit - left.profit || right.points - left.points)[0] ?? null;

  const leadLine = leader
    ? isSeasonComplete
      ? second
        ? `${leader.teamName} won ${division.title} on ${leader.points} pts with ${signedFloat(leader.profit)} profit, ${leader.points - second.points === 0 ? `finishing level on points with ${second.teamName} and ahead on the tiebreaks.` : `finishing ${leader.points - second.points} pt${leader.points - second.points === 1 ? '' : 's'} clear of ${second.teamName}.`}`
        : `${leader.teamName} finished top of ${division.title} on ${leader.points} pts with ${signedFloat(leader.profit)} profit.`
      : second
        ? `${leader.teamName} lead ${division.title}, ${leader.points - second.points === 0 ? 'level on points with' : `${leader.points - second.points} pts clear of`} ${second.teamName}, with ${signedFloat(leader.profit)} profit.`
        : `${leader.teamName} set the pace on ${leader.points} pts with ${signedFloat(leader.profit)} profit.`
    : 'Table leader pending.';

  const pressurePair = gapPairs[0] ?? null;
  const pressureLine = pressurePair
    ? isSeasonComplete
      ? `Closest finish: ${pressurePair.topTeam} and ${pressurePair.nextTeam} ended ${pressurePair.gap === 0 ? 'level on points' : `${pressurePair.gap} pt${pressurePair.gap === 1 ? '' : 's'} apart`}.`
      : pressurePair.index === 0
        ? `Title race is live: ${pressurePair.topTeam} and ${pressurePair.nextTeam} are ${pressurePair.gap === 0 ? 'level' : `split by ${pressurePair.gap} pt${pressurePair.gap === 1 ? '' : 's'}`}.`
        : pressurePair.index === rows.length - 2
          ? `Safety line is tight: ${pressurePair.topTeam} and ${pressurePair.nextTeam} are ${pressurePair.gap === 0 ? 'locked together' : `${pressurePair.gap} pt${pressurePair.gap === 1 ? '' : 's'} apart`}.`
          : `Playoff line is tight: ${pressurePair.topTeam} and ${pressurePair.nextTeam} are ${pressurePair.gap === 0 ? 'level' : `${pressurePair.gap} pt${pressurePair.gap === 1 ? '' : 's'} apart`}.`
    : 'Pressure lines still settling.';

  const movementLine = biggestRiser && biggestFaller && biggestRiser.teamName !== biggestFaller.teamName
    ? `${biggestRiser.teamName} have climbed ${Math.abs(biggestRiser.delta)} place${Math.abs(biggestRiser.delta) === 1 ? '' : 's'}; ${biggestFaller.teamName} have dropped ${Math.abs(biggestFaller.delta)}.`
    : biggestRiser
      ? `${biggestRiser.teamName} are the climbers, up ${Math.abs(biggestRiser.delta)} place${Math.abs(biggestRiser.delta) === 1 ? '' : 's'} since the opening week.`
      : biggestFaller
        ? `${biggestFaller.teamName} have slipped the most, down ${Math.abs(biggestFaller.delta)} place${Math.abs(biggestFaller.delta) === 1 ? '' : 's'} since the start.`
        : leader && leaderMovement?.start === 1
          ? `${leader.teamName} have led from the front all season.`
          : leader && leaderMovement
            ? `${leader.teamName} have climbed from ${formatOrdinalPosition(leaderMovement.start)} to the summit.`
            : 'Rank movement is still bedding in.';

  const profitLine = profitLeader
    ? isSeasonComplete
      ? `${profitLeader.teamName} closed the official season with the best profit mark at ${signedFloat(profitLeader.profit)}.`
      : leader && profitLeader.teamName === leader.teamName
        ? `${profitLeader.teamName} also top the profit chart on ${signedFloat(profitLeader.profit)}.`
        : `Profit pace-setter: ${profitLeader.teamName} lead the money board on ${signedFloat(profitLeader.profit)}.`
    : 'Profit board pending.';

  const dangerLine = last
    ? isSeasonComplete
      ? safe
        ? safe.points === last.points
          ? `${last.teamName} finished bottom, level on points with ${safe.teamName}, and lost out on the tiebreaks.`
          : `${last.teamName} finished bottom on ${last.points} pts, ${safe.points - last.points} pt${safe.points - last.points === 1 ? '' : 's'} behind ${safe.teamName}.`
        : `${last.teamName} finished bottom on ${last.points} pts.`
      : safe
        ? safe.points === last.points
          ? `${last.teamName} are bottom, level on points with ${safe.teamName}, so tiebreak pressure is on.`
          : `${last.teamName} are bottom and ${safe.points - last.points} pt${safe.points - last.points === 1 ? '' : 's'} from safety.`
        : `${last.teamName} are under pressure at the bottom on ${last.points} pts.`
    : 'Bottom-place fight pending.';

  return [leadLine, pressureLine, movementLine, profitLine, dangerLine];
}

function buildDivisionBattleCards(division: DivisionRoundupData): BroadcastBattleCard[] {
  const rows = sortDivisionRowsByRank(division);
  const leader = rows[0] ?? null;
  const second = rows[1] ?? null;
  const safe = rows[rows.length - 2] ?? null;
  const last = rows[rows.length - 1] ?? null;
  const isSeasonComplete = division.isSeasonComplete;
  const journeyByName = new Map(division.journeyTeams.map((team) => [normalizeTeamName(team.teamName), team]));
  const movements = division.journeyTeams.map((team) => {
    const start = team.ranks[0] ?? 1;
    const current = team.ranks[Math.min(team.ranks.length - 1, division.currentGwNumber)] ?? start;
    return { teamName: team.teamName, start, current, delta: start - current, ranks: team.ranks };
  });
  const biggestRiser = movements.filter((movement) => movement.delta > 0).sort((left, right) => right.delta - left.delta)[0] ?? null;
  const profitLeader = rows.slice().sort((left, right) => right.profit - left.profit || right.points - left.points)[0] ?? null;

  const cards: BroadcastBattleCard[] = [];

  if (leader) {
    const leaderTrend = journeyByName.get(normalizeTeamName(leader.teamName))?.ranks ?? [];
    cards.push({
      id: `${division.key}-battle-title`,
      label: isSeasonComplete ? 'Division Winner' : 'Title Watch',
      headline: second ? `${leader.teamName} vs ${second.teamName}` : leader.teamName,
      detail: second
        ? isSeasonComplete
          ? `${leader.teamName} won ${division.shortTitle} ${leader.points - second.points === 0 ? `level on points with ${second.teamName}, ahead on the tiebreaks.` : `${leader.points - second.points} point${leader.points - second.points === 1 ? '' : 's'} clear of ${second.teamName}.`}`
          : `${leader.points - second.points === 0 ? 'Level on points' : `${leader.points - second.points} point gap`} at the top of ${division.shortTitle}.`
        : isSeasonComplete
          ? `${leader.teamName} finished top of ${division.shortTitle}.`
          : `${leader.teamName} are setting the pace.`,
      metric: `${leader.points} pts • ${signedFloat(leader.profit)}`,
      stamp: isSeasonComplete ? 'WINNERS' : second && leader.points - second.points <= 1 ? 'TITLE RACE' : 'HOLDING TOP',
      tone: isSeasonComplete ? 'results' : second && leader.points - second.points <= 1 ? 'warning' : 'positive',
      trend: leaderTrend,
    });
  }

  if (biggestRiser) {
    cards.push({
      id: `${division.key}-battle-move`,
      label: 'Big Move',
      headline: biggestRiser.teamName,
      detail: `Up ${Math.abs(biggestRiser.delta)} place${Math.abs(biggestRiser.delta) === 1 ? '' : 's'} from ${formatOrdinalPosition(biggestRiser.start)} to ${formatOrdinalPosition(biggestRiser.current)}.`,
      metric: rankShiftLabel(biggestRiser.delta),
      stamp: 'MOVER',
      tone: 'movement',
      trend: biggestRiser.ranks,
    });
  }

  if (profitLeader) {
    const profitTrend = journeyByName.get(normalizeTeamName(profitLeader.teamName))?.ranks ?? [];
    cards.push({
      id: `${division.key}-battle-profit`,
      label: 'Profit Pace',
      headline: profitLeader.teamName,
      detail: isSeasonComplete
        ? `Best official profit return: ${signedFloat(profitLeader.profit)} with ${profitLeader.spins} spins recorded.`
        : `${signedFloat(profitLeader.profit)} profit with ${profitLeader.spins} spins on the board.`,
      metric: `${profitLeader.points} pts`,
      stamp: isSeasonComplete ? 'BEST PROFIT' : 'PROFIT LEAD',
      tone: 'results',
      trend: profitTrend,
    });
  }

  if (last) {
    const lastTrend = journeyByName.get(normalizeTeamName(last.teamName))?.ranks ?? [];
    cards.push({
      id: `${division.key}-battle-danger`,
      label: isSeasonComplete ? 'Bottom Place' : 'Pressure Line',
      headline: last.teamName,
      detail: isSeasonComplete
        ? safe
          ? `${safe.points === last.points ? `Finished level on points with ${safe.teamName}, but lost the tiebreak.` : `Closed ${safe.points - last.points} point${safe.points - last.points === 1 ? '' : 's'} behind ${safe.teamName} in the final table.`}`
          : `${last.points} points in the final table.`
        : safe
          ? `${safe.points === last.points ? `Level with ${safe.teamName}` : `${safe.points - last.points} point${safe.points - last.points === 1 ? '' : 's'} from ${safe.teamName} and safety`}.`
          : `${last.points} points at the foot of the table.`,
      metric: `${last.points} pts`,
      stamp: isSeasonComplete ? 'FINAL TABLE' : safe && safe.points - last.points <= 1 ? 'SURVIVAL FIGHT' : 'IN DANGER',
      tone: isSeasonComplete ? 'results' : 'warning',
      trend: lastTrend,
    });
  }

  return cards.slice(0, 4);
}

function buildBreakingInterrupt(currentGwNumber: number, fixtures: RoundupFixture[], divisions: DivisionRoundupData[]): string | null {
  const rankByTeam = new Map<string, { rank: number; size: number }>();
  divisions.forEach((division) => {
    const rows = sortDivisionRowsByRank(division);
    rows.forEach((row) => {
      rankByTeam.set(normalizeTeamName(row.teamName), { rank: row.rank, size: rows.length });
    });
  });

  const gwFixtures = fixtures.filter((fixture) => parseGwNumber(fixture.gw) === currentGwNumber && fixture.result !== 'pending');

  for (const fixture of gwFixtures) {
    const outcome = determineFixtureWinnerLoser(fixture);
    if (!outcome.winner || !outcome.loser) {
      continue;
    }
    const winnerRank = rankByTeam.get(normalizeTeamName(outcome.winner));
    const loserRank = rankByTeam.get(normalizeTeamName(outcome.loser));
    if (!winnerRank || !loserRank) {
      continue;
    }

    const bottomBeatsTop = winnerRank.rank >= Math.max(3, winnerRank.size - 1) && loserRank.rank <= 2;
    const heavySwing = outcome.margin >= 4;
    const contenderCollapse = loserRank.rank <= 2 && outcome.margin >= 2;

    if (bottomBeatsTop || heavySwing || contenderCollapse) {
      return `${outcome.winner} shock ${outcome.loser} with a ${outcome.margin.toFixed(2)} swing`; 
    }
  }

  return null;
}

function buildBreakingNewsStories(args: {
  currentGwNumber: number;
  divisions: DivisionRoundupData[];
  fixtures: RoundupFixture[];
  teams: RoundupTeam[];
  masterLeagueRows: RoundupMasterLeagueRow[];
  trioLeagueRows: RoundupTrioLeagueRow[];
  cupSegment: CupSegmentModel | null;
}): BreakingNewsStory[] {
  const {
    currentGwNumber,
    divisions,
    fixtures,
    teams,
    masterLeagueRows,
    trioLeagueRows,
    cupSegment,
  } = args;

  const teamContextByName = new Map<string, {
    division: string;
    tier: number;
    rank: number | null;
    tableSize: number | null;
  }>();
  divisions.forEach((division) => {
    const rows = sortDivisionRowsByRank(division);
    rows.forEach((row) => {
      const divisionLabel = row.division || division.title;
      const divisionInfo = normalizedDivisionTier(divisionLabel);
      teamContextByName.set(normalizeTeamName(row.teamName), {
        division: divisionInfo.label,
        tier: divisionInfo.tier,
        rank: row.rank,
        tableSize: rows.length,
      });
    });
  });
  teams.forEach((team) => {
    const key = normalizeTeamName(team.name);
    if (!teamContextByName.has(key)) {
      const divisionInfo = normalizedDivisionTier(team.division);
      teamContextByName.set(key, {
        division: divisionInfo.label,
        tier: divisionInfo.tier,
        rank: null,
        tableSize: null,
      });
    }
  });

  const stories: BreakingNewsStory[] = [];
  const seenIds = new Set<string>();
  const pushStory = (story: BreakingNewsStory | null) => {
    if (!story || seenIds.has(story.id)) {
      return;
    }
    seenIds.add(story.id);
    stories.push(story);
  };

  const recentDivisionResults = fixtures
    .filter((fixture) => (
      parseGwNumber(fixture.gw) >= Math.max(1, currentGwNumber - 1)
      && fixture.result !== 'pending'
      && fixture.result !== 'draw'
    ))
    .map((fixture) => {
      const outcome = determineFixtureWinnerLoser(fixture);
      const winnerContext = outcome.winner ? teamContextByName.get(normalizeTeamName(outcome.winner)) ?? null : null;
      const loserContext = outcome.loser ? teamContextByName.get(normalizeTeamName(outcome.loser)) ?? null : null;
      return {
        fixture,
        outcome,
        winnerContext,
        loserContext,
        rankGap: winnerContext && loserContext && winnerContext.rank !== null && loserContext.rank !== null
          ? Math.max(0, winnerContext.rank - loserContext.rank)
          : 0,
      };
    })
    .filter((entry) => entry.outcome.winner && entry.outcome.loser);

  const divisionShock = recentDivisionResults
    .filter((entry) => entry.rankGap >= 1)
    .sort((left, right) => (
      ((right.rankGap * 10) + right.outcome.margin) - ((left.rankGap * 10) + left.outcome.margin)
    ))[0] ?? null;
  if (divisionShock && divisionShock.outcome.winner && divisionShock.outcome.loser) {
    pushStory({
      id: `breaking-division-shock-${divisionShock.fixture.id}`,
      kicker: 'DIVISION SHOCK',
      headline: `${divisionShock.outcome.winner} stun ${divisionShock.outcome.loser}`,
      writeup: `${divisionShock.outcome.winner} came in ranked ${formatOrdinalPosition(divisionShock.winnerContext?.rank ?? 4)} and took down ${divisionShock.outcome.loser}, who were sitting ${formatOrdinalPosition(divisionShock.loserContext?.rank ?? 1)}. A ${divisionShock.outcome.margin.toFixed(2)} swing makes it one of the sharpest ladder jolts in the current cycle.`,
      detail: `${divisionShock.fixture.gw} • Rank gap ${divisionShock.rankGap} • Margin ${divisionShock.outcome.margin.toFixed(2)}`,
      score: 96,
    });
  }

  const divisionMovements = divisions.flatMap((division) => division.journeyTeams.map((team) => {
    const start = team.ranks[0] ?? 1;
    const current = team.ranks[Math.min(team.ranks.length - 1, division.currentGwNumber)] ?? start;
    return {
      division,
      team,
      start,
      current,
      delta: start - current,
    };
  }));
  const biggestClimber = divisionMovements
    .filter((entry) => entry.delta > 0)
    .sort((left, right) => right.delta - left.delta || left.current - right.current)[0] ?? null;
  if (biggestClimber) {
    pushStory({
      id: `breaking-division-rise-${biggestClimber.division.key}-${biggestClimber.team.teamId}`,
      kicker: 'DIVISION CLIMBER',
      headline: `${biggestClimber.team.teamName} surge through ${biggestClimber.division.shortTitle}`,
      writeup: `${biggestClimber.team.teamName} opened the season ${formatOrdinalPosition(biggestClimber.start)} and now sit ${formatOrdinalPosition(biggestClimber.current)} after climbing ${Math.abs(biggestClimber.delta)} place${Math.abs(biggestClimber.delta) === 1 ? '' : 's'}. That is real movement on a four-team board.`,
      detail: `${biggestClimber.division.shortTitle} • Up ${Math.abs(biggestClimber.delta)} place${Math.abs(biggestClimber.delta) === 1 ? '' : 's'} since the opener`,
      score: 92,
    });
  }

  const biggestCollapse = divisionMovements
    .filter((entry) => entry.delta < 0)
    .sort((left, right) => left.delta - right.delta || right.current - left.current)[0] ?? null;
  if (biggestCollapse) {
    pushStory({
      id: `breaking-division-drop-${biggestCollapse.division.key}-${biggestCollapse.team.teamId}`,
      kicker: 'DIVISION DROP',
      headline: `${biggestCollapse.team.teamName} slide backwards`,
      writeup: `${biggestCollapse.team.teamName} started ${formatOrdinalPosition(biggestCollapse.start)} in ${biggestCollapse.division.shortTitle} and have drifted to ${formatOrdinalPosition(biggestCollapse.current)}. The table has moved around them and the pressure is now obvious.`,
      detail: `${biggestCollapse.division.shortTitle} • Down ${Math.abs(biggestCollapse.delta)} place${Math.abs(biggestCollapse.delta) === 1 ? '' : 's'}`,
      score: 88,
    });
  }

  const tightestDivisionRace = divisions
    .map((division) => {
      const rows = sortDivisionRowsByRank(division);
      const leader = rows[0] ?? null;
      const second = rows[1] ?? null;
      if (!leader || !second) {
        return null;
      }
      return {
        division,
        leader,
        second,
        gap: Math.abs(leader.points - second.points),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.gap - right.gap || right.division.currentGwNumber - left.division.currentGwNumber)[0] ?? null;
  if (tightestDivisionRace) {
    pushStory({
      id: `breaking-title-race-${tightestDivisionRace.division.key}`,
      kicker: 'TITLE RACE',
      headline: `${tightestDivisionRace.division.shortTitle} too close to call`,
      writeup: `Only ${tightestDivisionRace.gap} point${tightestDivisionRace.gap === 1 ? '' : 's'} split ${tightestDivisionRace.leader.teamName} and ${tightestDivisionRace.second.teamName}. One strong entry day swings the entire division.`,
      detail: `${tightestDivisionRace.leader.teamName} ${tightestDivisionRace.leader.points} pts • ${tightestDivisionRace.second.teamName} ${tightestDivisionRace.second.points} pts`,
      score: 86,
    });
  }

  const masterRows = masterLeagueRows.slice().sort((left, right) => left.rank - right.rank);
  const masterOverperformer = masterRows
    .filter((row) => row.rank <= 6)
    .map((row) => {
      const context = teamContextByName.get(normalizeTeamName(row.teamName));
      return { row, context, score: (context?.tier ?? 1) * 10 - row.rank };
    })
    .filter((entry) => (entry.context?.tier ?? 1) >= 3)
    .sort((left, right) => right.score - left.score)[0] ?? null;
  if (masterOverperformer?.context) {
    pushStory({
      id: `breaking-master-rise-${masterOverperformer.row.teamId}`,
      kicker: 'MASTER LEAGUE',
      headline: `${masterOverperformer.row.teamName} crash the elite`,
      writeup: `${masterOverperformer.row.teamName} come from ${masterOverperformer.context.division} on the divisional ladder but sit ${formatOrdinalPosition(masterOverperformer.row.rank)} in Master League on ${masterOverperformer.row.points} points. That is a serious cross-competition overperformance.`,
      detail: `Master rank ${masterOverperformer.row.rank} • ${signedFloat(masterOverperformer.row.profit)} profit`,
      score: 90,
    });
  }

  const masterUnderperformer = masterRows
    .filter((row) => row.rank > Math.floor(masterRows.length / 2))
    .map((row) => {
      const context = teamContextByName.get(normalizeTeamName(row.teamName));
      return { row, context, score: row.rank + (context?.tier === 1 ? 8 : context?.tier === 2 ? 5 : 0) };
    })
    .filter((entry) => (entry.context?.tier ?? 9) <= 2)
    .sort((left, right) => right.score - left.score)[0] ?? null;
  if (masterUnderperformer?.context) {
    pushStory({
      id: `breaking-master-drop-${masterUnderperformer.row.teamId}`,
      kicker: 'MASTER LEAGUE',
      headline: `${masterUnderperformer.row.teamName} stuck lower than expected`,
      writeup: `${masterUnderperformer.row.teamName} are a ${masterUnderperformer.context.division} side in the divisions, but the Master League has them down in ${formatOrdinalPosition(masterUnderperformer.row.rank)}. The bigger board has exposed a real consistency issue.`,
      detail: `${masterUnderperformer.row.points} pts • ${signedFloat(masterUnderperformer.row.profit)} profit`,
      score: 84,
    });
  }

  const trioGroups = ['Premier League', 'Ligue 1', 'Bundesliga'].map((division) => ({
    division,
    rows: trioLeagueRows.filter((row) => row.division === division).slice().sort((left, right) => left.rank - right.rank),
  }));
  const trioPremier = trioGroups.find((group) => group.division === 'Premier League')?.rows ?? [];
  if (trioPremier.length >= 8) {
    const bottomTwo = trioPremier.slice(-2);
    pushStory({
      id: 'breaking-trio-premier-danger',
      kicker: 'TRIO PREMIER',
      headline: `${bottomTwo[0]?.teamName ?? 'One side'} and ${bottomTwo[1]?.teamName ?? 'another side'} on the drop line`,
      writeup: `Only the bottom two go down in Trio Premier League now, and the current relegation places belong to ${bottomTwo.map((row) => row.teamName).join(' and ')}. That strips the survival picture down to something brutally clear.`,
      detail: `Relegation line • ${bottomTwo.map((row) => `${row.teamName} ${row.points} pts`).join(' • ')}`,
      score: 80,
    });
  }

  const trioLigue = trioGroups.find((group) => group.division === 'Ligue 1')?.rows ?? [];
  if (trioLigue.length >= 5) {
    pushStory({
      id: 'breaking-trio-ligue-promotion',
      kicker: 'TRIO LIGUE 1',
      headline: `${trioLigue[0]?.teamName ?? 'Leader pending'} hold the direct route up`,
      writeup: `${trioLigue[0]?.teamName ?? 'The leader'} currently own the automatic promotion place, while ${trioLigue.slice(1, 5).map((row) => row.teamName).join(', ')} make up the playoff queue for the second spot. The line between direct promotion and the playoff board matters now.`,
      detail: `${trioLigue[0]?.teamName ?? 'Leader'} ${trioLigue[0]?.points ?? 0} pts • Playoff line through 5th`,
      score: 78,
    });
  }

  const trioBundesliga = trioGroups.find((group) => group.division === 'Bundesliga')?.rows ?? [];
  if (trioBundesliga.length >= 5) {
    pushStory({
      id: 'breaking-trio-bundesliga-promotion',
      kicker: 'TRIO BUNDESLIGA',
      headline: `${trioBundesliga[0]?.teamName ?? 'Leader pending'} set the pace`,
      writeup: `${trioBundesliga[0]?.teamName ?? 'The leader'} sit on the direct promotion line, with ${trioBundesliga.slice(1, 5).map((row) => row.teamName).join(', ')} all still alive in the playoff race for the second place. It is a compressed promotion picture rather than a runaway.`,
      detail: `${trioBundesliga[0]?.teamName ?? 'Leader'} ${trioBundesliga[0]?.points ?? 0} pts • Playoff spots 2nd-5th`,
      score: 76,
    });
  }

  const cupShock = cupSegment?.results
    .map((row) => {
      const winner = row.winnerTeam;
      const loser = winner && row.homeTeam && row.awayTeam
        ? (normalizeTeamName(winner) === normalizeTeamName(row.homeTeam) ? row.awayTeam : row.homeTeam)
        : null;
      const winnerContext = winner ? teamContextByName.get(normalizeTeamName(winner)) ?? null : null;
      const loserContext = loser ? teamContextByName.get(normalizeTeamName(loser)) ?? null : null;
      const scoreGap = Math.abs(Number(row.score.split('-')[0]?.trim() ?? 0) - Number(row.score.split('-')[1]?.trim() ?? 0));
      return {
        row,
        winner,
        loser,
        winnerContext,
        loserContext,
        tierGap: winnerContext && loserContext ? Math.max(0, winnerContext.tier - loserContext.tier) : 0,
        scoreGap,
      };
    })
    .filter((entry) => entry.winner && entry.loser)
    .sort((left, right) => ((right.tierGap * 10) + right.scoreGap) - ((left.tierGap * 10) + left.scoreGap))[0] ?? null;
  if (cupShock?.winner && cupShock.loser) {
    const isTierShock = cupShock.tierGap > 0;
    pushStory({
      id: `breaking-cup-${cupShock.row.fixtureId}`,
      kicker: 'CUP WATCH',
      headline: isTierShock ? `${cupShock.winner} dump out ${cupShock.loser}` : `${cupShock.winner} take the cup headline`,
      writeup: isTierShock
        ? `${cupShock.winner} came from ${cupShock.winnerContext?.division ?? 'a lower rung'} and knocked out ${cupShock.loser} from ${cupShock.loserContext?.division ?? 'above them'} in the cup. Those are the ties that tilt a bracket.`
        : `${cupShock.winner} delivered the sharpest completed cup result on the board and now carry the momentum into the next bracket checkpoint.`,
      detail: `${cupShock.row.roundName} • ${cupShock.row.score} • ${cupShock.row.detail}`,
      score: isTierShock ? 82 : 70,
    });
  } else if (cupSegment?.allRows[0]) {
    const nextCupRow = cupSegment.upcoming[0] ?? cupSegment.allRows[0];
    pushStory({
      id: `breaking-cup-watch-${nextCupRow.fixtureId}`,
      kicker: 'CUP WATCH',
      headline: `${nextCupRow.roundName} board taking shape`,
      writeup: `${nextCupRow.fixture} sits on the live cup radar. Even without a resolved shock yet, the bracket pressure is building and one clean result will reshape the board.`,
      detail: `${nextCupRow.roundName} • ${nextCupRow.status}`,
      score: 68,
    });
  }

  const fillerStories = divisions
    .map((division) => {
      const rows = sortDivisionRowsByRank(division);
      const leader = rows[0] ?? null;
      const last = rows[rows.length - 1] ?? null;
      if (!leader || !last) {
        return null;
      }
      return {
        id: `breaking-filler-${division.key}`,
        kicker: division.shortTitle.toUpperCase(),
        headline: `${leader.teamName} set the pace in ${division.shortTitle}`,
        writeup: division.isSeasonComplete
          ? `${leader.teamName} closed out ${division.shortTitle} as winners, while ${last.teamName} were left at the foot of the table.`
          : `${leader.teamName} currently control ${division.shortTitle}, but ${last.teamName} are the side with the most urgent response to find.`,
        detail: `${leader.points} pts at the top • ${last.points} pts at the bottom`,
        score: 50,
      };
    })
    .filter((story): story is BreakingNewsStory => story !== null);

  const orderedStories = stories
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
  if (orderedStories.length >= 10) {
    return orderedStories;
  }

  fillerStories.forEach((story) => {
    if (orderedStories.length >= 10 || seenIds.has(story.id)) {
      return;
    }
    seenIds.add(story.id);
    orderedStories.push(story);
  });

  return orderedStories.slice(0, 10);
}

function buildForecastWatchStories(args: {
  divisions: DivisionRoundupData[];
  divisionForecastsByKey: Partial<Record<DivisionKey, RoundupForecastRow[]>>;
  masterLeagueRows: RoundupMasterLeagueRow[];
  masterLeagueForecast: RoundupForecastRow[];
  trioLeagueRows: RoundupTrioLeagueRow[];
  trioForecastsByDivision: Record<string, RoundupForecastRow[]>;
}): BreakingNewsStory[] {
  const {
    divisions,
    divisionForecastsByKey,
    masterLeagueRows,
    masterLeagueForecast,
    trioLeagueRows,
    trioForecastsByDivision,
  } = args;

  const entries: Array<{
    scope: string;
    teamName: string;
    currentRank: number;
    predictedRank: number;
    delta: number;
    titleProbability: number;
    promotionProbability: number;
    playoffProbability: number;
    relegationProbability: number;
    remainingDifficultyLabel: string;
  }> = [];

  divisions.forEach((division) => {
    const rowByTeamId = new Map(division.tableRows.map((row) => [row.teamId, row]));
    (divisionForecastsByKey[division.key] ?? []).forEach((forecast) => {
      const row = rowByTeamId.get(forecast.teamId);
      if (!row || forecast.predictedRank === null || !forecast.projectedDelta) {
        return;
      }
      entries.push({
        scope: division.shortTitle,
        teamName: row.teamName,
        currentRank: row.rank,
        predictedRank: forecast.predictedRank,
        delta: forecast.projectedDelta,
        titleProbability: forecast.titleProbability,
        promotionProbability: forecast.promotionProbability,
        playoffProbability: forecast.playoffProbability,
        relegationProbability: forecast.relegationProbability,
        remainingDifficultyLabel: forecast.remainingDifficultyLabel,
      });
    });
  });

  const masterByTeamId = new Map(masterLeagueRows.map((row) => [row.teamId, row]));
  masterLeagueForecast.forEach((forecast) => {
    const row = masterByTeamId.get(forecast.teamId);
    if (!row || forecast.predictedRank === null || !forecast.projectedDelta) {
      return;
    }
    entries.push({
      scope: 'Master League',
      teamName: row.teamName,
      currentRank: row.rank,
      predictedRank: forecast.predictedRank,
      delta: forecast.projectedDelta,
      titleProbability: forecast.titleProbability,
      promotionProbability: 0,
      playoffProbability: 0,
      relegationProbability: 0,
      remainingDifficultyLabel: forecast.remainingDifficultyLabel,
    });
  });

  const trioByDivision = new Map<string, Map<number, RoundupTrioLeagueRow>>();
  trioLeagueRows.forEach((row) => {
    const existing = trioByDivision.get(row.division) ?? new Map<number, RoundupTrioLeagueRow>();
    existing.set(row.teamId, row);
    trioByDivision.set(row.division, existing);
  });
  Object.entries(trioForecastsByDivision).forEach(([division, forecastRows]) => {
    const rowsByTeamId = trioByDivision.get(division) ?? new Map<number, RoundupTrioLeagueRow>();
    forecastRows.forEach((forecast) => {
      const row = rowsByTeamId.get(forecast.teamId);
      if (!row || forecast.predictedRank === null || !forecast.projectedDelta) {
        return;
      }
      entries.push({
        scope: division,
        teamName: row.teamName,
        currentRank: row.rank,
        predictedRank: forecast.predictedRank,
        delta: forecast.projectedDelta,
        titleProbability: forecast.titleProbability,
        promotionProbability: forecast.promotionProbability,
        playoffProbability: forecast.playoffProbability,
        relegationProbability: forecast.relegationProbability,
        remainingDifficultyLabel: forecast.remainingDifficultyLabel,
      });
    });
  });

  const stories: BreakingNewsStory[] = [];
  const biggestRiser = entries
    .filter((entry) => entry.delta > 0)
    .sort((left, right) => right.delta - left.delta || right.currentRank - left.currentRank)[0] ?? null;
  if (biggestRiser) {
    stories.push({
      id: `forecast-rise-${biggestRiser.scope}-${biggestRiser.teamName}`,
      kicker: 'FORECAST MOVER',
      headline: `${biggestRiser.teamName} are projected to rise`,
      writeup: `${biggestRiser.teamName} currently sit ${formatOrdinalPosition(biggestRiser.currentRank)} in ${biggestRiser.scope}, but the model now places them around ${formatOrdinalPosition(biggestRiser.predictedRank)}. The run-in is rated ${biggestRiser.remainingDifficultyLabel.toLowerCase()}.`,
      detail: `${biggestRiser.scope} • now ${formatOrdinalPosition(biggestRiser.currentRank)} • projected ${formatOrdinalPosition(biggestRiser.predictedRank)}`,
      score: 94,
    });
  }

  const biggestFaller = entries
    .filter((entry) => entry.delta < 0)
    .sort((left, right) => left.delta - right.delta || left.currentRank - right.currentRank)[0] ?? null;
  if (biggestFaller) {
    stories.push({
      id: `forecast-fall-${biggestFaller.scope}-${biggestFaller.teamName}`,
      kicker: 'SHOCK WATCH',
      headline: `${biggestFaller.teamName} are at risk of sliding`,
      writeup: `${biggestFaller.teamName} are currently ${formatOrdinalPosition(biggestFaller.currentRank)} in ${biggestFaller.scope}, but the model projects a drop to ${formatOrdinalPosition(biggestFaller.predictedRank)}. This is the main warning on the forecast board.`,
      detail: `${biggestFaller.scope} • projected down ${Math.abs(biggestFaller.delta)} place${Math.abs(biggestFaller.delta) === 1 ? '' : 's'}`,
      score: 92,
    });
  }

  const trioLive = entries
    .filter((entry) => entry.scope === 'Ligue 1' || entry.scope === 'Bundesliga')
    .sort((left, right) => (
      (right.promotionProbability + right.playoffProbability) - (left.promotionProbability + left.playoffProbability)
    ))[0] ?? null;
  if (trioLive && trioLive.promotionProbability + trioLive.playoffProbability > 0) {
    stories.push({
      id: `forecast-trio-live-${trioLive.scope}-${trioLive.teamName}`,
      kicker: 'TRIO FORECAST',
      headline: `${trioLive.teamName} stay live in the promotion race`,
      writeup: `${trioLive.teamName} carry ${formatProbability(trioLive.promotionProbability)} automatic-promotion odds and ${formatProbability(trioLive.playoffProbability)} playoff-track odds in ${trioLive.scope}. The model still sees a genuine route up.`,
      detail: `${trioLive.scope} • relegation risk ${formatProbability(trioLive.relegationProbability)}`,
      score: 88,
    });
  }

  const titleLive = entries
    .filter((entry) => entry.titleProbability >= 35)
    .sort((left, right) => right.titleProbability - left.titleProbability)[0] ?? null;
  if (titleLive) {
    stories.push({
      id: `forecast-title-${titleLive.scope}-${titleLive.teamName}`,
      kicker: 'TITLE PROJECTION',
      headline: `${titleLive.teamName} lead the model board`,
      writeup: `${titleLive.teamName} now rate as a ${formatProbability(titleLive.titleProbability)} title shot in ${titleLive.scope}. The forecast board is leaning their way, not just the live table.`,
      detail: `${titleLive.scope} • title chance ${formatProbability(titleLive.titleProbability)}`,
      score: 86,
    });
  }

  return stories.slice(0, 4);
}

// Kept as a no-op so stale hot-reload references cannot crash the roundup after
// removing the old Season 5 teaser slide.
function divisionFourBreakingLine(_currentGwNumber: number): string | null {
  return null;
}

function buildCupShockFactor(model: CupSegmentModel, fixtureName: string): number {
  const needle = normalizeTeamName(fixtureName);
  const row = model.allRows.find((item) => normalizeTeamName(item.fixture) === needle);
  if (!row) {
    return 2.5;
  }
  if (row.winnerTeam) {
    return 7.2;
  }
  return 4.1;
}

function cupRoundKey(roundName: string): 'r32' | 'r16' | 'qf' | 'sf' | 'f' | 'other' {
  if (/round\s*of\s*32|roundof32|r32/i.test(roundName)) {
    return 'r32';
  }
  if (/round\s*of\s*16|roundof16|r16/i.test(roundName)) {
    return 'r16';
  }
  if (/quarter|quarterfinal|qf/i.test(roundName)) {
    return 'qf';
  }
  if (/semi|semifinal|sf/i.test(roundName)) {
    return 'sf';
  }
  if (/\bfinal\b/i.test(roundName)) {
    return 'f';
  }
  return 'other';
}

function groupCupRowsByRound(rows: CupSegmentRow[]): Array<{ key: string; label: string; rows: CupSegmentRow[] }> {
  const order = ['r32', 'r16', 'qf', 'sf', 'f', 'other'] as const;
  const labels: Record<(typeof order)[number], string> = {
    r32: 'Round of 32',
    r16: 'Round of 16',
    qf: 'Quarterfinals',
    sf: 'Semifinals',
    f: 'Final',
    other: 'Cup Round',
  };
  const grouped = new Map<string, CupSegmentRow[]>();
  rows.forEach((row) => {
    const key = cupRoundKey(row.roundName);
    const roundRows = grouped.get(key) ?? [];
    roundRows.push(row);
    grouped.set(key, roundRows);
  });
  return order
    .filter((key) => grouped.has(key))
    .map((key) => ({
      key,
      label: labels[key],
      rows: (grouped.get(key) ?? []).slice().sort((left, right) => left.fixtureId - right.fixtureId),
    }));
}

function stageOrder(stage: RoundupMasterCupFixture['stage']): number {
  switch (stage) {
    case 'round_of_16':
      return 0;
    case 'quarter_final':
      return 1;
    case 'semi_final':
      return 2;
    case 'third_place_playoff':
      return 3;
    case 'final':
      return 4;
    default:
      return 9;
  }
}

function buildCupBracketRounds(
  rows: CupSegmentModel['allRows'],
  teams: RoundupTeam[],
  activeRoundLabel: string,
): CompetitionBracketRound[] {
  const teamByName = new Map(teams.map((team) => [normalizeTeamName(team.name), team]));
  return groupCupRowsByRound(rows).map((group) => ({
    key: group.key,
    label: group.label,
    ties: group.rows.map((row) => {
      const homeMeta = row.homeTeam ? teamByName.get(normalizeTeamName(row.homeTeam)) ?? null : null;
      const awayMeta = row.awayTeam ? teamByName.get(normalizeTeamName(row.awayTeam)) ?? null : null;
      const showNumericScore = row.homeTeam && row.awayTeam && row.played;
      return {
        id: row.id,
        title: row.gw,
        detail: row.fixture,
        statusLabel: row.winnerTeam ? 'winner' : group.label === activeRoundLabel ? 'live' : row.gw.toLowerCase(),
        active: group.label === activeRoundLabel && !row.winnerTeam,
        resolved: Boolean(row.winnerTeam),
        winnerPath: Boolean(row.winnerTeam),
        home: {
          teamName: row.homeTeam ?? 'TBD',
          score: showNumericScore && row.homeProfit !== null ? row.homeProfit.toFixed(2) : null,
          winner: Boolean(row.winnerTeam) && row.homeTeam !== null && normalizeTeamName(row.winnerTeam) === normalizeTeamName(row.homeTeam),
          ballColor: homeMeta?.ballColor ?? null,
          ringColor: homeMeta?.ringColor ?? null,
          textColor: homeMeta?.textColor ?? null,
        },
        away: {
          teamName: row.awayTeam ?? 'TBD',
          score: showNumericScore && row.awayProfit !== null ? row.awayProfit.toFixed(2) : null,
          winner: Boolean(row.winnerTeam) && row.awayTeam !== null && normalizeTeamName(row.winnerTeam) === normalizeTeamName(row.awayTeam),
          ballColor: awayMeta?.ballColor ?? null,
          ringColor: awayMeta?.ringColor ?? null,
          textColor: awayMeta?.textColor ?? null,
        },
      };
    }),
  }));
}

function buildMasterCupBracketRounds(
  fixtures: RoundupMasterCupFixture[],
  currentGw: string,
  teams: RoundupTeam[],
): CompetitionBracketRound[] {
  const teamByName = new Map(teams.map((team) => [normalizeTeamName(team.name), team]));
  const labels: Record<RoundupMasterCupFixture['stage'], string> = {
    round_of_16: 'Round of 16',
    quarter_final: 'Quarterfinals',
    semi_final: 'Semifinals',
    third_place_playoff: 'Third-Place Playoff',
    final: 'Final',
  };

  const grouped = new Map<RoundupMasterCupFixture['stage'], RoundupMasterCupFixture[]>();
  fixtures
    .slice()
    .sort((left, right) => stageOrder(left.stage) - stageOrder(right.stage) || left.tieSlot - right.tieSlot || left.legNumber - right.legNumber)
    .forEach((fixture) => {
      const list = grouped.get(fixture.stage) ?? [];
      list.push(fixture);
      grouped.set(fixture.stage, list);
    });

  return Array.from(grouped.entries())
    .sort((left, right) => stageOrder(left[0]) - stageOrder(right[0]))
    .map(([stage, stageFixtures]) => ({
      key: stage,
      label: labels[stage],
      ties: stageFixtures.map((fixture) => {
        const homeMeta = fixture.homeTeam ? teamByName.get(normalizeTeamName(fixture.homeTeam)) ?? null : null;
        const awayMeta = fixture.awayTeam ? teamByName.get(normalizeTeamName(fixture.awayTeam)) ?? null : null;
        const homeWinner = fixture.winnerTeam && fixture.homeTeam
          ? normalizeTeamName(fixture.winnerTeam) === normalizeTeamName(fixture.homeTeam)
          : false;
        const awayWinner = fixture.winnerTeam && fixture.awayTeam
          ? normalizeTeamName(fixture.winnerTeam) === normalizeTeamName(fixture.awayTeam)
          : false;
        const detail = stage === 'semi_final'
          ? `Tie ${fixture.tieSlot} • Leg ${fixture.legNumber}`
          : fixture.roundName;
        return {
          id: `master-cup-${fixture.id}`,
          title: fixture.gw,
          detail,
          statusLabel: fixture.winnerTeam ? 'winner' : fixture.gw === currentGw ? 'live' : fixture.gw.toLowerCase(),
          active: fixture.gw === currentGw && !fixture.winnerTeam,
          resolved: Boolean(fixture.winnerTeam),
          winnerPath: Boolean(fixture.winnerTeam),
          home: {
            teamName: fixture.homeTeam ?? 'TBD',
            score: fixture.homeTeam ? fixture.homeProfit.toFixed(2) : null,
            winner: homeWinner,
            ballColor: homeMeta?.ballColor ?? null,
            ringColor: homeMeta?.ringColor ?? null,
            textColor: homeMeta?.textColor ?? null,
          },
          away: {
            teamName: fixture.awayTeam ?? 'TBD',
            score: fixture.awayTeam ? fixture.awayProfit.toFixed(2) : null,
            winner: awayWinner,
            ballColor: awayMeta?.ballColor ?? null,
            ringColor: awayMeta?.ringColor ?? null,
            textColor: awayMeta?.textColor ?? null,
          },
        };
      }),
    }));
}

function buildMasterCupTreeData(
  fixtures: RoundupMasterCupFixture[],
  currentGw: string,
  teams: RoundupTeam[],
): { rounds: CompetitionBracketRound[]; thirdPlaceTie: CompetitionBracketTie | null } {
  const teamByName = new Map(teams.map((team) => [normalizeTeamName(team.name), team]));
  const stageFixtures = new Map<RoundupMasterCupFixture['stage'], RoundupMasterCupFixture[]>();
  fixtures.forEach((fixture) => {
    const list = stageFixtures.get(fixture.stage) ?? [];
    list.push(fixture);
    stageFixtures.set(fixture.stage, list);
  });

  const mapSingleLegTie = (fixture: RoundupMasterCupFixture, idPrefix: string): CompetitionBracketTie => {
    const homeMeta = fixture.homeTeam ? teamByName.get(normalizeTeamName(fixture.homeTeam)) ?? null : null;
    const awayMeta = fixture.awayTeam ? teamByName.get(normalizeTeamName(fixture.awayTeam)) ?? null : null;
    const homeWinner = fixture.winnerTeam && fixture.homeTeam
      ? normalizeTeamName(fixture.winnerTeam) === normalizeTeamName(fixture.homeTeam)
      : false;
    const awayWinner = fixture.winnerTeam && fixture.awayTeam
      ? normalizeTeamName(fixture.winnerTeam) === normalizeTeamName(fixture.awayTeam)
      : false;
    return {
      id: `${idPrefix}-${fixture.id}`,
      title: fixture.gw,
      detail: fixture.roundName,
      statusLabel: fixture.winnerTeam ? 'winner' : fixture.gw === currentGw ? 'live' : fixture.gw.toLowerCase(),
      active: fixture.gw === currentGw && !fixture.winnerTeam,
      resolved: Boolean(fixture.winnerTeam),
      winnerPath: Boolean(fixture.winnerTeam),
      home: {
        teamName: fixture.homeTeam ?? 'TBD',
        score: fixture.homeTeam ? fixture.homeProfit.toFixed(2) : null,
        winner: homeWinner,
        ballColor: homeMeta?.ballColor ?? null,
        ringColor: homeMeta?.ringColor ?? null,
        textColor: homeMeta?.textColor ?? null,
      },
      away: {
        teamName: fixture.awayTeam ?? 'TBD',
        score: fixture.awayTeam ? fixture.awayProfit.toFixed(2) : null,
        winner: awayWinner,
        ballColor: awayMeta?.ballColor ?? null,
        ringColor: awayMeta?.ringColor ?? null,
        textColor: awayMeta?.textColor ?? null,
      },
    };
  };

  const aggregateSemiFinalTie = (tieSlot: number, tieFixtures: RoundupMasterCupFixture[]): CompetitionBracketTie | null => {
    if (tieFixtures.length === 0) {
      return null;
    }
    const ordered = tieFixtures.slice().sort((left, right) => left.legNumber - right.legNumber);
    const base = ordered[0];
    const homeName = base.homeTeam ?? 'TBD';
    const awayName = base.awayTeam ?? 'TBD';
    const homeMeta = base.homeTeam ? teamByName.get(normalizeTeamName(base.homeTeam)) ?? null : null;
    const awayMeta = base.awayTeam ? teamByName.get(normalizeTeamName(base.awayTeam)) ?? null : null;
    let homeAggregate = 0;
    let awayAggregate = 0;
    ordered.forEach((fixture) => {
      if (fixture.homeTeam && normalizeTeamName(fixture.homeTeam) === normalizeTeamName(homeName)) {
        homeAggregate += fixture.homeProfit;
        awayAggregate += fixture.awayProfit;
      } else {
        homeAggregate += fixture.awayProfit;
        awayAggregate += fixture.homeProfit;
      }
    });
    const winnerName = ordered.find((fixture) => fixture.winnerTeam)?.winnerTeam ?? null;
    const homeWinner = winnerName ? normalizeTeamName(winnerName) === normalizeTeamName(homeName) : false;
    const awayWinner = winnerName ? normalizeTeamName(winnerName) === normalizeTeamName(awayName) : false;
    const active = ordered.some((fixture) => fixture.gw === currentGw && !fixture.winnerTeam);
    return {
      id: `master-cup-semi-${tieSlot}`,
      title: `Tie ${tieSlot}`,
      detail: ordered.length > 1 ? 'Aggregate semifinal' : base.roundName,
      statusLabel: winnerName ? 'winner' : active ? 'live' : 'semi',
      active,
      resolved: Boolean(winnerName),
      winnerPath: Boolean(winnerName),
      home: {
        teamName: homeName,
        score: homeName !== 'TBD' ? homeAggregate.toFixed(2) : null,
        winner: homeWinner,
        ballColor: homeMeta?.ballColor ?? null,
        ringColor: homeMeta?.ringColor ?? null,
        textColor: homeMeta?.textColor ?? null,
      },
      away: {
        teamName: awayName,
        score: awayName !== 'TBD' ? awayAggregate.toFixed(2) : null,
        winner: awayWinner,
        ballColor: awayMeta?.ballColor ?? null,
        ringColor: awayMeta?.ringColor ?? null,
        textColor: awayMeta?.textColor ?? null,
      },
    };
  };

  const roundOf16 = (stageFixtures.get('round_of_16') ?? [])
    .slice()
    .sort((left, right) => left.tieSlot - right.tieSlot)
    .map((fixture) => mapSingleLegTie(fixture, 'master-cup-r16'));
  const quarterFinals = (stageFixtures.get('quarter_final') ?? [])
    .slice()
    .sort((left, right) => left.tieSlot - right.tieSlot)
    .map((fixture) => mapSingleLegTie(fixture, 'master-cup-qf'));
  const semiFinals = Array.from(
    (stageFixtures.get('semi_final') ?? []).reduce((map, fixture) => {
      const list = map.get(fixture.tieSlot) ?? [];
      list.push(fixture);
      map.set(fixture.tieSlot, list);
      return map;
    }, new Map<number, RoundupMasterCupFixture[]>()),
  )
    .sort((left, right) => left[0] - right[0])
    .map(([tieSlot, tieFixtures]) => aggregateSemiFinalTie(tieSlot, tieFixtures))
    .filter((value): value is CompetitionBracketTie => value !== null);
  const finalTie = (stageFixtures.get('final') ?? [])
    .slice()
    .sort((left, right) => left.tieSlot - right.tieSlot)[0];
  const thirdPlaceTie = (stageFixtures.get('third_place_playoff') ?? [])
    .slice()
    .sort((left, right) => left.tieSlot - right.tieSlot)[0] ?? null;

  return {
    rounds: [
      { key: 'round_of_16', label: 'Round of 16', ties: roundOf16 },
      { key: 'quarter_final', label: 'Quarterfinals', ties: quarterFinals },
      { key: 'semi_final', label: 'Semifinals', ties: semiFinals },
      { key: 'final', label: 'Final', ties: finalTie ? [mapSingleLegTie(finalTie, 'master-cup-final')] : [] },
    ].filter((round) => round.ties.length > 0),
    thirdPlaceTie: thirdPlaceTie ? mapSingleLegTie(thirdPlaceTie, 'master-cup-third') : null,
  };
}

function buildTickerItems(args: {
  currentSeason: string;
  currentGw: string;
  divisions: DivisionRoundupData[];
  championsSpotlight: ChampionsSpotlightModel | null;
  cupSegment: CupSegmentModel | null;
  masterLeagueRows: RoundupMasterLeagueRow[];
  masterLeagueForecast: RoundupForecastRow[];
  allTimeLeagues: RoundupAllTimePayload | null;
  breakingHeadline: string | null;
  forecastWatchStories: BreakingNewsStory[];
}): string[] {
  const {
    currentSeason,
    currentGw,
    divisions,
    championsSpotlight,
    cupSegment,
    masterLeagueRows,
    masterLeagueForecast,
    allTimeLeagues,
    breakingHeadline,
    forecastWatchStories,
  } = args;

  const items: string[] = [];
  items.push(`${currentSeason} ${currentGw} live broadcast in progress`);

  divisions.forEach((division) => {
    const leader = sortDivisionRowsByRank(division)[0];
    if (leader) {
      items.push(
        division.isSeasonComplete
          ? `${division.shortTitle}: ${leader.teamName} won it on ${leader.points} points`
          : `${division.shortTitle}: ${leader.teamName} lead on ${leader.points} points`,
      );
    }
  });

  if (championsSpotlight?.entries?.[0]) {
    items.push(`Champions watch: ${championsSpotlight.entries[0].projectionLine}`);
  }

  if (cupSegment) {
    items.push(`Cup round: ${cupSegment.roundLabel}`);
  }

  const masterLeader = masterLeagueRows.slice().sort((left, right) => left.rank - right.rank)[0];
  if (masterLeader) {
    items.push(`Master League: ${masterLeader.teamName} top on ${masterLeader.points} points`);
  }
  const masterModelLeader = masterLeagueForecast
    .slice()
    .sort((left, right) => (left.predictedRank ?? 99) - (right.predictedRank ?? 99))[0] ?? null;
  if (masterModelLeader && masterLeader && masterModelLeader.teamId !== masterLeader.teamId) {
    const leaderName = masterLeagueRows.find((row) => row.teamId === masterModelLeader.teamId)?.teamName;
    if (leaderName) {
      items.push(`Model projection: ${leaderName} are the most likely Master League winners`);
    }
  }

  if (allTimeLeagues?.pointsTable?.[0]) {
    items.push(`All-time points leader: ${allTimeLeagues.pointsTable[0].teamName}`);
  }

  forecastWatchStories.slice(0, 2).forEach((story) => {
    items.push(`${story.kicker}: ${story.headline}`);
  });

  if (breakingHeadline) {
    items.unshift(`Breaking: ${breakingHeadline}`);
  }

  const deduped = Array.from(new Set(items.map((line) => line.trim()).filter((line) => line.length > 0)));
  return deduped.length > 0 ? deduped : ['Division Tables Roundup live updates'];
}

function buildDivisionSpotlightCopy(args: {
  segmentTitle: string;
  division: DivisionRoundupData;
  row: DivisionRoundupData['tableRows'][number];
  histories: Record<number, RoundupHistoryRow[]>;
  fixtures: RoundupFixture[];
  currentGwNumber: number;
}): {
  headline: string;
  lines: string[];
} {
  const { segmentTitle, division, row, histories, fixtures, currentGwNumber } = args;
  const teamHistory = histories[row.teamId] ?? [];
  const allTimeTitles = teamHistory.filter((entry) => entry.rank === 1).length;
  const allTimeRank = teamHistory.length > 0
    ? (teamHistory.reduce((sum, entry) => sum + entry.rank, 0) / teamHistory.length).toFixed(2)
    : 'N/A';
  const bestFinish = bestHistoricalFinish(teamHistory);

  const journey = division.journeyTeams.find((team) => team.teamId === row.teamId);
  const previousRank = journey?.ranks[Math.max(0, currentGwNumber - 1)] ?? row.rank;
  const rankDelta = previousRank - row.rank;

  const upcoming = fixtures
    .filter((fixture) => {
      if (parseGwNumber(fixture.gw) < currentGwNumber) {
        return false;
      }
      const teamName = normalizeTeamName(row.teamName);
      const home = normalizeTeamName(fixture.homeTeam);
      const away = normalizeTeamName(fixture.awayTeam);
      return home === teamName || away === teamName;
    })
    .slice(0, 3);

  const runs = sortDivisionRowsByRank(division);
  const opponentRankMap = new Map(runs.map((entry) => [normalizeTeamName(entry.teamName), entry.rank]));
  const avgOpponentRank = upcoming.length > 0
    ? (upcoming.reduce((sum, fixture) => {
      const opponentName = normalizeTeamName(fixture.homeTeam) === normalizeTeamName(row.teamName)
        ? fixture.awayTeam
        : fixture.homeTeam;
      return sum + (opponentRankMap.get(normalizeTeamName(opponentName)) ?? runs.length);
    }, 0) / upcoming.length)
    : null;

  const pressureIndex = clampPercent((row.rank / Math.max(1, runs.length)) * 60 + Math.max(0, 15 - row.points) * 2);
  const historicalProfit = teamHistory.reduce((sum, entry) => sum + entry.profit, 0);
  const historicalSpins = teamHistory.reduce((sum, entry) => sum + entry.spins, 0);
  const cupWins = teamHistory.filter((entry) => isCupWinner(entry.cupFinish)).length;

  const lines = [
    `Position change since last week: ${rankShiftLabel(rankDelta)}`,
    `Upcoming fixture strength: ${avgOpponentRank === null ? 'N/A' : avgOpponentRank.toFixed(2)} avg opponent rank`,
    `All-time division titles: ${allTimeTitles}`,
    `Cup performance history: ${cupWins} cup wins`,
    `Best historical finish: ${bestFinish === null ? 'N/A' : `#${bestFinish}`}`,
    `Completed seasons on record: ${teamHistory.length}`,
    `Profit vs spins: ${signedFloat(row.profit)} this season, ${row.spins} spins`,
    `Pressure Index: ${pressureIndex.toFixed(0)} / 100`,
    `All-time rank trend: ${allTimeRank} avg finish`,
    `Historical profit: ${signedFloat(historicalProfit)} • Historical spins: ${historicalSpins}`,
  ];

  return {
    headline: `${segmentTitle}: ${row.teamName}`,
    lines,
  };
}

function showDurationForSpotlight(isKeyFinal: boolean): number {
  return isKeyFinal ? 9000 : 7000;
}

export function DivisionRoundupRunner({
  currentSeason,
  currentGw,
  cycleAnchor,
  divisions,
  previousChampions,
  championsSpotlight,
  cupSegment,
  superCupFixtures,
  teams,
  fixtures,
  histories,
  masterLeagueRows,
  masterLeagueFixtures,
  masterLeagueForecast,
  masterCupFixtures,
  trioLeagueRows,
  trioLeagueFixtures,
  trioForecastsByDivision,
  divisionForecastsByKey,
  allTimeLeagues,
  teamPredictionRaceBySeason,
  selection,
}: DivisionRoundupRunnerProps) {
  const currentGwNumber = parseGwNumber(currentGw);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const saturdayLateDrama = useMemo(() => {
    const now = new Date();
    return now.getDay() === 6 && now.getHours() >= 20;
  }, [cycleAnchor]);

  const breakingHeadline = useMemo(
    () => buildBreakingInterrupt(currentGwNumber, fixtures, divisions),
    [currentGwNumber, divisions, fixtures],
  );
  const breakingNewsStories = useMemo(
    () => buildBreakingNewsStories({
      currentGwNumber,
      divisions,
      fixtures,
      teams,
      masterLeagueRows,
      trioLeagueRows,
      cupSegment,
    }),
    [currentGwNumber, cupSegment, divisions, fixtures, masterLeagueRows, teams, trioLeagueRows],
  );
  const forecastWatchStories = useMemo(
    () => buildForecastWatchStories({
      divisions,
      divisionForecastsByKey,
      masterLeagueRows,
      masterLeagueForecast,
      trioLeagueRows,
      trioForecastsByDivision,
    }),
    [divisionForecastsByKey, divisions, masterLeagueForecast, masterLeagueRows, trioForecastsByDivision, trioLeagueRows],
  );
  const thisTimeLastWeekEntries = useMemo(
    () => buildThisTimeLastWeekEntries({
      currentGwNumber,
      teams,
      fixtures,
      masterLeagueFixtures,
      trioLeagueFixtures,
      cupSegment,
      masterCupFixtures,
    }),
    [currentGwNumber, cupSegment, fixtures, masterCupFixtures, masterLeagueFixtures, teams, trioLeagueFixtures],
  );

  const slides = useMemo<ShowSlide[]>(() => {
    if (divisions.length === 0) {
      return [
        {
          id: 'empty-state',
          durationMs: minDuration(5000),
          group: 'opening',
          content: (
            <section className="roundup-empty-state">
              <h2>Sky Sports News</h2>
              <p>No division data available for {currentSeason} {currentGw}.</p>
            </section>
          ),
        },
      ];
    }

    const generated: ShowSlide[] = [];
    generated.push({
      id: 'show-open',
      durationMs: minDuration(8000),
      group: 'opening',
      content: (
        <section className="roundup-transition-slide roundup-show-open">
          <p className="roundup-kicker">SKY SPORTS NEWS</p>
          <h2>Division Tables Roundup</h2>
          <p>Live from the studio desk</p>
        </section>
      ),
    });
    generated.push({
      id: 'this-time-last-week',
      durationMs: minDuration(8500),
      group: 'opening',
      content: (
        <section className="roundup-transition-slide roundup-last-week-tile">
          <p className="roundup-kicker">THIS TIME LAST WEEK</p>
          <h2>GW{Math.max(1, currentGwNumber - 1)} Profit Board</h2>
          <p>
            {thisTimeLastWeekEntries.length > 0
              ? `${thisTimeLastWeekEntries.length} teams finished the last gameweek in profit across divisions, master, trio and the cups.`
              : currentGwNumber > 1
                ? 'No teams finished the previous gameweek in profit.'
                : 'No previous gameweek data is available yet this season.'}
          </p>
          {thisTimeLastWeekEntries.length > 0 ? (
            <div className="roundup-last-week-grid">
              {thisTimeLastWeekEntries.slice(0, 12).map((entry) => (
                <article key={entry.id} className="roundup-last-week-card">
                  <div className="roundup-last-week-team">
                    <TeamBadge
                      name={entry.teamName}
                      ballColor={entry.ballColor}
                      ringColor={entry.ringColor}
                      textColor={entry.textColor}
                      size={30}
                    />
                    <div>
                      <strong>{entry.teamName}</strong>
                      <span>{entry.competitionSummary}</span>
                    </div>
                  </div>
                  <div className="roundup-last-week-profit">
                    <strong>{signedFloat(entry.totalProfit)}</strong>
                    <span>
                      {entry.appearanceCount} profitable outing{entry.appearanceCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {thisTimeLastWeekEntries.length > 12 ? (
            <p className="roundup-last-week-more">
              And {thisTimeLastWeekEntries.length - 12} more teams also finished in profit.
            </p>
          ) : null}
        </section>
      ),
    });

    divisions.forEach((division) => {
      const commentary = buildDivisionCommentary(division);
      const battleCards = buildDivisionBattleCards(division);
      const forecastRows = divisionForecastsByKey[division.key] ?? [];
      const currentRows = division.tableRows.slice().sort((left, right) => left.rank - right.rank);
      const modelLine = buildForecastPulseLine(forecastRows, currentRows);
      const alertItems: LowerThirdAlertItem[] = [...commentary, ...(modelLine ? [modelLine] : [])].map((line, index) => ({
        id: `${division.key}-alert-${index}`,
        label: division.shortTitle,
        headline: line,
        tone: index === 0 ? 'positive' : line.includes('Model') ? 'movement' : index === 4 ? 'warning' : index === 2 ? 'movement' : 'live',
      }));
      const keyFinal = divisionTitleDeciding(division);
      const graphWeekCount = Math.max(currentGwNumber, division.currentGwNumber);
      const graphAnimationDuration = graphAnimationDurationMs(graphWeekCount);
      const graphHoldDuration = keyFinal
        ? Math.max(graphSlideDurationMs(graphWeekCount), minDuration(11000))
        : minDuration(graphSlideDurationMs(graphWeekCount));

      generated.push({
        id: `division-${division.key}-graph`,
        durationMs: graphHoldDuration,
        emphasis: keyFinal ? 'key-final' : 'normal',
        group: 'division',
        scope: division.key,
        content: (
          <section className="roundup-runner roundup-runner--ssn-graph">
            <div className="roundup-top-layout ssn-top-panel">
              <div className="roundup-left-panel roundup-left-panel--graph">
                <header className="roundup-slide-head">
                  <p className="roundup-kicker">DIVISION TABLES ROUNDUP</p>
                  <h2>{division.title}</h2>
                </header>
                <DivisionJourneyGraph
                  teams={division.journeyTeams}
                  currentGwNumber={division.currentGwNumber}
                  active
                  resetToken={`graph-${division.key}-${cycleAnchor}`}
                  animationDurationMs={graphAnimationDuration}
                />
              </div>
              <div className="roundup-right-panel">
                <DivisionLiveTable division={division} />
              </div>
            </div>
            <div className="roundup-bottom-stack ssn-mid-row">
              <div className="ssn-race-grid">
                <BroadcastBattleBoard
                  kicker="Race Board"
                  title={`${division.title} Live`}
                  subtitle="Title, movement, profit, and danger lines on one screen."
                  cards={battleCards}
                />
              </div>
              <div className="ssn-alert-row">
                <LowerThirdAlertRail items={alertItems} label="Studio Alerts" />
              </div>
            </div>
          </section>
        ),
      });

      generated.push({
        id: `division-${division.key}-results`,
        durationMs: keyFinal ? minDuration(9000) : minDuration(5000),
        emphasis: keyFinal ? 'key-final' : 'normal',
        group: 'division',
        scope: division.key,
        content: (
          <section className="roundup-runner">
            <div className="roundup-main-layout">
              <div className="roundup-left-panel">
                <header className="roundup-slide-head">
                  <p className="roundup-kicker">{division.title}</p>
                  <h2>Yesterday's Results & Today's Fixtures</h2>
                </header>
                <DivisionResultsFixturesSlide division={division} />
              </div>
              <div className="roundup-right-panel">
                <DivisionLiveTable division={division} />
              </div>
            </div>
          </section>
        ),
      });

      if (forecastRows.length > 0) {
        const projectedRows = buildProjectedRows(currentRows, forecastRows);
        generated.push({
          id: `division-${division.key}-projection`,
          durationMs: 7000,
          group: 'division',
          scope: division.key,
          content: CompetitionStandingsTable({
            kicker: 'MODEL PROJECTION',
            title: `${division.title} Projected Finish`,
            subtitle: `Most likely finish order based on current trend, run-in, and remaining fixtures.`,
            rows: projectedRows,
            projectionMode: true,
            cutLines: buildDivisionProjectionCutLines(division),
          }),
        });
      }
    });

    const deferredDivisionSlides: ShowSlide[] = [];
    const previousChampionGroups = groupPreviousChampions(previousChampions);
    if (previousChampionGroups.length > 0) {
      deferredDivisionSlides.push({
        id: 'division-previous-winners-archive',
        durationMs: minDuration(12000),
        group: 'division-archive',
        content: (
          <section className="roundup-runner roundup-master-segment">
            <header className="roundup-slide-head">
              <p className="roundup-kicker">DIVISION WINNER ARCHIVE</p>
              <h2>Previous Winners by Division</h2>
            </header>
            <div className="roundup-previous-grid roundup-previous-grid--archive">
              {previousChampionGroups.map((group) => (
                <article key={`previous-winners-${group.division}`}>
                  <header>
                    <h3>{group.division}</h3>
                    <p>{group.rows.length} seasons</p>
                  </header>
                  <ul className="roundup-previous-list">
                    {group.rows.map((row) => (
                      <li key={`${group.division}-${row.season}-${row.teamName}`}>
                        <strong>{row.season} • {row.teamName}</strong>
                        <em>{signedFloat(row.profit)} profit • {row.wins}W {row.draws}D {row.losses}L • {row.points} pts</em>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ),
      });
    } else {
      deferredDivisionSlides.push({
        id: 'division-previous-winners-empty',
        durationMs: minDuration(5000),
        group: 'division-archive',
        content: (
          <section className="roundup-transition-slide">
            <p className="roundup-kicker">DIVISION WINNER ARCHIVE</p>
            <h2>Previous Winners</h2>
            <p>No previous division winner data available yet.</p>
          </section>
        ),
      });
    }

    if (breakingHeadline) {
      deferredDivisionSlides.push({
        id: 'breaking-interrupt',
        durationMs: minDuration(8000),
        emphasis: 'key-final',
        group: 'division-archive',
        content: (
          <section className="roundup-transition-slide roundup-breaking-slide">
            <p className="roundup-kicker">BREAKING NEWS</p>
            <h2>{breakingHeadline}</h2>
            <p>Emergency desk analysis: title and survival implications updated live.</p>
          </section>
        ),
      });
    }

    const spotlightSlides: ShowSlide[] = [];

    if (championsSpotlight && championsSpotlight.entries.length > 0) {
      spotlightSlides.push({
        id: 'champions-spotlight-intro',
        durationMs: minDuration(5000),
        group: 'spotlight',
        scope: 'champions',
        content: (
          <section className="roundup-transition-slide roundup-spotlight-intro">
            <p className="roundup-kicker">CHAMPIONS SPOTLIGHT</p>
            <h2>{championsSpotlight.introTitle}</h2>
            <p>Legacy, form, trajectory, and forward projection.</p>
          </section>
        ),
      });

      const rows = championsSpotlight.miniTable.slice().sort((left, right) => left.rank - right.rank);
      const titleRaceTight = rows.length > 1 && Math.abs(rows[0].points - rows[1].points) <= 2;

      championsSpotlight.entries.forEach((entry) => {
        spotlightSlides.push({
          id: `champions-spotlight-${entry.teamId}`,
          durationMs: minDuration(showDurationForSpotlight(titleRaceTight && entry.rank <= 2)),
          emphasis: titleRaceTight && entry.rank <= 2 ? 'key-final' : 'normal',
          group: 'spotlight',
          scope: 'champions',
          content: (
            <section className="roundup-runner roundup-spotlight-runner">
              <div className="roundup-spotlight-layout">
                <div className="roundup-spotlight-main">
                  <header className="roundup-slide-head">
                    <p className="roundup-kicker">CHAMPIONS SPOTLIGHT</p>
                    <h2>{entry.teamName}</h2>
                    <p className="roundup-spotlight-team-index">{entry.tagLine}</p>
                  </header>
                  <div className="roundup-spotlight-intro-row">
                    <TeamBadge name={entry.teamName} ballColor={entry.ballColor} ringColor={entry.ringColor} textColor={entry.textColor} size={56} />
                    <div>
                      <h3>Position {entry.rank} • {entry.points} pts</h3>
                      <p>Form (L5): {formatForm(entry.formLast5)}</p>
                    </div>
                  </div>
                  <dl className="roundup-spotlight-metrics">
                    <div><dt>Cup Status</dt><dd>{entry.cupWins > 0 ? `${entry.cupWins} all-time cup wins` : 'Still searching for cup breakthrough'}</dd></div>
                    <div><dt>All-Time League Rank</dt><dd>{entry.averageFinish === null ? 'N/A' : entry.averageFinish.toFixed(2)}</dd></div>
                    <div><dt>All-Time Profit</dt><dd>{signedFloat(entry.historicalProfitRecord)}</dd></div>
                    <div><dt>All-Time Spins</dt><dd>{entry.allTimeSpins}</dd></div>
                    <div><dt>Previous Titles</dt><dd>{entry.allTimeLeagueTitles}</dd></div>
                    <div><dt>Key Rival</dt><dd>{rows.find((row) => row.rank === (entry.rank === 1 ? 2 : Math.max(1, entry.rank - 1)))?.teamName ?? 'N/A'}</dd></div>
                  </dl>
                  <p className="roundup-spotlight-note">{entry.legacyLine}</p>
                </div>

                <aside className="roundup-live-table roundup-spotlight-table">
                  <header>
                    <p className="roundup-kicker">Champions Mini Table</p>
                    <h3>Live Standings</h3>
                  </header>
                  <table>
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Team</th>
                        <th>PLD</th>
                        <th>W</th>
                        <th>L</th>
                        <th>D</th>
                        <th>Pts</th>
                        <th>Spins</th>
                        <th>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`champions-row-${row.teamId}`} className={row.teamId === entry.teamId ? 'is-spotlight-team' : undefined}>
                          <td>{row.rank}</td>
                          <td>{row.teamName}</td>
                          <td>{row.played}</td>
                          <td>{row.wins}</td>
                          <td>{row.losses}</td>
                          <td>{row.draws}</td>
                          <td>{row.points}</td>
                          <td>{row.spins}</td>
                          <td>{row.profit.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </aside>
              </div>

              <footer className="roundup-spotlight-ticker">
                <span>Projection:</span>
                <strong>{entry.projectionLine}</strong>
              </footer>
            </section>
          ),
        });
      });
    }

    const cupSlides: ShowSlide[] = [];

    if (superCupFixtures.length > 0) {
      const fixture = superCupFixtures
        .slice()
        .sort((left, right) => left.id - right.id)[0];
      if (fixture) {
        const homeTeam = teams.find((team) => team.id === fixture.homeTeamId) ?? null;
        const awayTeam = teams.find((team) => team.id === fixture.awayTeamId) ?? null;
        const superCupTie: CompetitionBracketTie = {
          id: `super-cup-${fixture.id}`,
          title: 'Standalone season opener',
          detail: fixture.pairingExplanation,
          statusLabel: fixture.winnerTeam
            ? `${fixture.winnerTeam} won the prestige curtain-raiser`
            : fixture.played
              ? `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)} on the board`
              : 'GW1 opener pending',
          active: currentGw === fixture.gw,
          resolved: fixture.winnerTeamId !== null,
          winnerPath: fixture.winnerTeamId !== null,
          home: {
            teamId: fixture.homeTeamId,
            teamName: fixture.homeTeam,
            score: fixture.played ? fixture.homeProfit.toFixed(2) : undefined,
            winner: fixture.winnerTeamId === fixture.homeTeamId,
            ballColor: homeTeam?.ballColor ?? null,
            ringColor: homeTeam?.ringColor ?? null,
            textColor: homeTeam?.textColor ?? null,
          },
          away: {
            teamId: fixture.awayTeamId,
            teamName: fixture.awayTeam,
            score: fixture.played ? fixture.awayProfit.toFixed(2) : undefined,
            winner: fixture.winnerTeamId === fixture.awayTeamId,
            ballColor: awayTeam?.ballColor ?? null,
            ringColor: awayTeam?.ringColor ?? null,
            textColor: awayTeam?.textColor ?? null,
          },
        };
        cupSlides.push({
          id: 'super-cup-board',
          durationMs: minDuration(8500),
          group: 'cup',
          scope: 'super-cup',
          content: (
            <section className="roundup-runner roundup-cup-board">
              <CompetitionBracketTree
                kicker="SUPER CUP"
                title={`${fixture.gw} Curtain-Raiser`}
                subtitle="Standalone prestige opener built from the previous season's BookieBall Cup and Master Cup finalists. It does not alter either bracket."
                rounds={[{ key: 'super-cup', label: 'Super Cup', ties: [superCupTie] }]}
                summary={[
                  fixture.pairingExplanation,
                  fixture.winnerTeam ? `${fixture.winnerTeam} lifted the opener.` : 'Curtain-raiser still waiting for a winner.',
                  "Bookie d'Or weighting: zero",
                ]}
              />
            </section>
          ),
        });
      }
    }

    if (cupSegment) {
      const cupBracketRounds = buildCupBracketRounds(cupSegment.allRows, teams, cupSegment.roundLabel);
      const cupSummary = [
        `${cupSegment.results.length}/${cupSegment.allRows.length} ties resolved`,
        cupSegment.upcoming.length > 0 ? `${cupSegment.upcoming.length} ties still live` : 'Bracket complete',
        `Current focus: ${cupSegment.roundLabel}`,
      ];
      cupSlides.push({
        id: 'cup-bracket-board',
        durationMs: minDuration(9000),
        group: 'cup',
        scope: 'bookieball',
        content: (
          <section className="roundup-runner roundup-cup-board">
            <CompetitionBracketTree
              kicker="BOOKIEBALL CUP"
              title={cupSegment.roundLabel}
              subtitle="Full knockout tree with winner paths lighting across the bracket."
              rounds={cupBracketRounds}
              summary={cupSummary}
            />
          </section>
        ),
      });
    }

    if (masterCupFixtures.length > 0) {
      const masterCupTree = buildMasterCupTreeData(masterCupFixtures, currentGw, teams);
      const resolvedCount = masterCupFixtures.filter((fixture) => fixture.winnerTeamId !== null).length;
      const currentRound = masterCupFixtures.find((fixture) => fixture.gw === currentGw)?.roundName
        ?? masterCupFixtures[masterCupFixtures.length - 1]?.roundName
        ?? 'Master Cup';
      cupSlides.push({
        id: 'master-cup-bracket-board',
        durationMs: minDuration(9000),
        group: 'cup',
        scope: 'master-cup',
        content: (
          <section className="roundup-runner roundup-cup-board">
            <CompetitionBracketTree
              kicker="MASTER CUP"
              title={currentRound}
              subtitle="Seeded knockout tree with aggregate semifinal paths and a separate third-place tie."
              rounds={masterCupTree.rounds}
              summary={[
                `${resolvedCount}/${masterCupFixtures.length} ties resolved`,
                `Current focus: ${currentRound}`,
                'Semi-finals remain two-legged',
              ]}
              sideMatch={masterCupTree.thirdPlaceTie}
              sideMatchLabel="Third-Place Playoff"
            />
          </section>
        ),
      });
    }

    const divisionByKey = new Map(divisions.map((division) => [division.key, division]));

    const spotlightSegments: Array<{ key: DivisionRoundupData['key']; title: string; intro: string; durationMs: number }> = [
      { key: 'premier', title: 'Premier Division Spotlight', intro: 'Pressure Index and run-in pressure', durationMs: 6000 },
      { key: 'division-one', title: 'Division 1 Spotlight', intro: 'Promotion battle and efficiency watch', durationMs: 6000 },
      { key: 'division-two', title: 'Division 2 Spotlight', intro: 'Rebuild stories and resurgence signals', durationMs: 6000 },
      { key: 'division-three', title: 'Division 3 Spotlight', intro: 'Emerging sides and rookie impact', durationMs: 6000 },
      { key: 'division-four', title: 'Division 4 Spotlight', intro: 'New entrants and early survival momentum', durationMs: 6000 },
    ];

    spotlightSegments.forEach((segment) => {
      const division = divisionByKey.get(segment.key);
      if (!division) {
        return;
      }

      spotlightSlides.push({
        id: `${segment.key}-spotlight-intro`,
        durationMs: minDuration(5000),
        group: 'spotlight',
        scope: segment.key,
        content: (
          <section className="roundup-transition-slide roundup-spotlight-intro">
            <p className="roundup-kicker">{segment.title.toUpperCase()}</p>
            <h2>{segment.title}</h2>
            <p>{segment.intro}</p>
          </section>
        ),
      });

      const rowsForDivision = sortDivisionRowsByRank(division);
      rowsForDivision.forEach((row) => {
        const copy = buildDivisionSpotlightCopy({
          segmentTitle: segment.title,
          division,
          row,
          histories,
          fixtures,
          currentGwNumber,
        });
        const seasonDivisionGraph = buildTeamSeasonDivisionGraph({
          row,
          division,
          histories,
          currentSeason,
        });
        const predictionRows = buildTeamPredictionRows({
          row,
          histories,
          currentSeason,
          teamPredictionRaceBySeason,
        });
        const predictionTotals = predictionRows.reduce((acc, seasonRow) => ({
          jayCorrect: acc.jayCorrect + seasonRow.jayCorrect,
          computerCorrect: acc.computerCorrect + seasonRow.computerCorrect,
          resolved: acc.resolved + seasonRow.resolved,
        }), { jayCorrect: 0, computerCorrect: 0, resolved: 0 });
        const predictionRaceLine = predictionTotals.resolved === 0
          ? 'No Me vs Computer data yet.'
          : predictionTotals.jayCorrect === predictionTotals.computerCorrect
            ? `Level at ${predictionTotals.jayCorrect}-${predictionTotals.computerCorrect}`
            : predictionTotals.jayCorrect > predictionTotals.computerCorrect
              ? `You lead by ${predictionTotals.jayCorrect - predictionTotals.computerCorrect}`
              : `Computer leads by ${predictionTotals.computerCorrect - predictionTotals.jayCorrect}`;
        const latestPredictionSeason = predictionRows[0] ?? null;
        const latestPredictionLine = latestPredictionSeason
          ? `${latestPredictionSeason.season}: You ${latestPredictionSeason.jayCorrect}/${latestPredictionSeason.resolved} • Computer ${latestPredictionSeason.computerCorrect}/${latestPredictionSeason.resolved}`
          : 'No recent prediction split available.';

        spotlightSlides.push({
          id: `${segment.key}-team-${row.teamId}-season-division-graph`,
          durationMs: minDuration(graphSlideDurationMs(currentGwNumber)),
          group: 'spotlight',
          scope: segment.key,
          content: (
            <section className="roundup-runner roundup-generic-spotlight">
              <header className="roundup-slide-head">
                <p className="roundup-kicker">{segment.title}</p>
                <h2>{row.teamName} Season vs Division</h2>
              </header>
              {seasonDivisionGraph ? (
                <TeamSeasonDivisionGraph
                  graph={seasonDivisionGraph}
                  teamName={row.teamName}
                  ballColor={row.ballColor}
                  ringColor={row.ringColor}
                  textColor={row.textColor}
                />
              ) : (
                <p className="roundup-empty-copy">No season-vs-division data yet.</p>
              )}
            </section>
          ),
        });

        spotlightSlides.push({
          id: `${segment.key}-team-${row.teamId}`,
          durationMs: minDuration(segment.durationMs),
          group: 'spotlight',
          scope: segment.key,
          content: (
            <section className="roundup-runner roundup-generic-spotlight">
              <div className="roundup-main-layout">
                <div className="roundup-left-panel">
                  <header className="roundup-slide-head">
                    <p className="roundup-kicker">{segment.title}</p>
                    <h2>{row.teamName}</h2>
                  </header>
                  <div className="roundup-spotlight-intro-row">
                    <TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={48} />
                    <div>
                      <h3>{copy.headline}</h3>
                      <p>{row.rank <= 2 ? 'Within striking distance' : row.rank === rowsForDivision.length ? 'Need a response now' : 'Momentum still open'}</p>
                    </div>
                  </div>
                  <ul className="roundup-focus-list roundup-focus-list-centered">
                    {copy.lines.map((line) => (
                      <li key={`${segment.key}-${row.teamId}-${line}`}>{line}</li>
                    ))}
                  </ul>
                  <div className="roundup-spotlight-prediction-strip">
                    <span className="roundup-kicker">ME VS COMPUTER</span>
                    <strong>{predictionRaceLine}</strong>
                    <p>{latestPredictionLine}</p>
                  </div>
                </div>
                <div className="roundup-right-panel">
                  <DivisionLiveTable division={division} />
                </div>
              </div>
            </section>
          ),
        });
      });
    });

    if (masterLeagueRows.length > 0) {
      const masterRows = masterLeagueRows.slice().sort((left, right) => left.rank - right.rank);
      const splitIndex = Math.ceil(masterRows.length / 2);
      const topHalfRows = masterRows.slice(0, splitIndex);
      const bottomHalfRows = masterRows.slice(splitIndex);
      generated.push({
        id: 'master-league-standings-top',
        durationMs: 7000,
        group: 'master',
        content: CompetitionStandingsTable({
          kicker: 'MASTER LEAGUE',
          title: 'Master League Table • Top Half',
          subtitle: `Places 1-${topHalfRows[topHalfRows.length - 1]?.rank ?? splitIndex}.`,
          rows: masterRows,
          visibleRows: topHalfRows,
        }),
      });
      if (bottomHalfRows.length > 0) {
        generated.push({
          id: 'master-league-standings-bottom',
          durationMs: 7000,
          group: 'master',
          content: CompetitionStandingsTable({
            kicker: 'MASTER LEAGUE',
            title: 'Master League Table • Bottom Half',
            subtitle: `Places ${bottomHalfRows[0]?.rank ?? splitIndex + 1}-${bottomHalfRows[bottomHalfRows.length - 1]?.rank ?? masterRows.length}.`,
            rows: masterRows,
            visibleRows: bottomHalfRows,
          }),
        });
      }
      if (masterLeagueForecast.length > 0) {
        generated.push({
          id: 'master-league-projection',
          durationMs: 7000,
          group: 'master',
          content: CompetitionStandingsTable({
            kicker: 'MODEL PROJECTION',
            title: 'Master League Projected Finish',
            subtitle: 'Most likely final order from the forecast engine.',
            rows: buildProjectedRows(masterRows, masterLeagueForecast),
            projectionMode: true,
          }),
        });
      }
    }

    if (trioLeagueRows.length > 0) {
      const trioDivisionOrder = ['Premier League', 'Ligue 1', 'Bundesliga'];
      const trioGroups = trioDivisionOrder
        .map((division) => ({
          division,
          rows: trioLeagueRows
            .filter((row) => row.division === division)
            .slice()
            .sort((left, right) => left.rank - right.rank),
        }))
        .filter((group) => group.rows.length > 0);

      generated.push({
        id: 'trio-league-intro',
        durationMs: 7000,
        group: 'trio',
        content: (
          <section className="roundup-transition-slide">
            <p className="roundup-kicker">TRIO LEAGUES</p>
            <h2>Three-tier ladder update</h2>
            <p>Premier League, Ligue 1, and Bundesliga tables coming up next.</p>
          </section>
        ),
      });

      trioGroups.forEach((group) => {
        generated.push({
          id: `trio-league-table-${group.division}`,
          durationMs: 7000,
          group: 'trio',
          content: CompetitionStandingsTable({
            kicker: 'TRIO LEAGUES',
            title: `${group.division} Table`,
            subtitle: group.division === 'Premier League'
              ? 'Relegation line remains the key pressure point.'
              : 'Promotion, playoff, and relegation pressure in one table.',
            rows: group.rows,
            cutLines: buildTrioProjectionCutLines(group.division).map((line) => ({ ...line, ghost: false })),
          }),
        });

        const forecastRows = trioForecastsByDivision[group.division] ?? [];
        if (forecastRows.length > 0) {
          generated.push({
            id: `trio-league-projection-${group.division}`,
            durationMs: 7000,
            group: 'trio',
            content: CompetitionStandingsTable({
              kicker: 'MODEL PROJECTION',
              title: `${group.division} Projected Finish`,
              subtitle: 'Regular-season model projection with projected cut-lines.',
              rows: buildProjectedRows(group.rows, forecastRows),
              projectionMode: true,
              cutLines: buildTrioProjectionCutLines(group.division),
            }),
          });
        }
      });
    }

    generated.push(...cupSlides);

    if (allTimeLeagues) {
      const pointsTop10 = allTimeLeagues.pointsTable.slice(0, 10);
      const profitTop10 = allTimeLeagues.profitTable.slice(0, 10);
      const spinsTop10 = allTimeLeagues.spinsTable.slice(0, 10);

      generated.push({
        id: 'all-time-points',
        durationMs: minDuration(7000),
        group: 'all-time',
        content: CompetitionStandingsTable({
          kicker: 'ALL-TIME LEAGUES',
          title: 'All-Time Points Table',
          subtitle: 'Top 10 by total points across the archive.',
          rows: allTimeLeagues.pointsTable,
          visibleRows: pointsTop10,
        }),
      });

      generated.push({
        id: 'all-time-profit',
        durationMs: minDuration(7000),
        group: 'all-time',
        content: CompetitionStandingsTable({
          kicker: 'ALL-TIME LEAGUES',
          title: 'All-Time Profit Table',
          subtitle: 'Top 10 by total profit across all seasons.',
          rows: allTimeLeagues.profitTable,
          visibleRows: profitTop10,
        }),
      });

      generated.push({
        id: 'all-time-spins',
        durationMs: minDuration(7000),
        group: 'all-time',
        content: CompetitionStandingsTable({
          kicker: 'ALL-TIME LEAGUES',
          title: 'All-Time Spins Table',
          subtitle: 'Top 10 by total spins across the archive.',
          rows: allTimeLeagues.spinsTable,
          visibleRows: spinsTop10,
        }),
      });
    }

    generated.push(...deferredDivisionSlides);
    generated.push(...spotlightSlides);
    generated.push(...[...forecastWatchStories, ...breakingNewsStories].map((story, index) => ({
      id: `breaking-news-${index}-${story.id}`,
      durationMs: minDuration(6500),
      group: 'breaking',
      content: (
        <section className="roundup-transition-slide roundup-breaking-slide roundup-breaking-news-slide">
          <p className="roundup-kicker">BREAKING NEWS • {story.kicker}</p>
          <h2>{story.headline}</h2>
          <p>{story.writeup}</p>
          <ul className="roundup-focus-list roundup-focus-list-centered">
            <li>{story.detail}</li>
          </ul>
        </section>
      ),
    })));

    const previousWeek = Math.max(1, currentGwNumber - 1);
    const previousResults = fixtures
      .filter((fixture) => parseGwNumber(fixture.gw) === previousWeek && fixture.result !== 'pending')
      .slice(0, 12);

    const rankByTeam = new Map<string, number>();
    divisions.forEach((division) => {
      division.tableRows.forEach((row) => {
        rankByTeam.set(normalizeTeamName(row.teamName), row.rank);
      });
    });

    const fixtureImpactScore = (fixture: RoundupFixture): number => {
      const homeRank = rankByTeam.get(normalizeTeamName(fixture.homeTeam)) ?? 99;
      const awayRank = rankByTeam.get(normalizeTeamName(fixture.awayTeam)) ?? 99;
      const rankDiff = Math.abs(homeRank - awayRank);
      const titleImplication = homeRank <= 2 && awayRank <= 2 ? 5 : 0;
      const relegationImpact = homeRank >= 3 && awayRank >= 3 ? 4 : 0;
      const rivalryWeight = rankDiff <= 1 ? 3 : rankDiff <= 2 ? 1 : 0;
      return titleImplication + relegationImpact + rivalryWeight;
    };

    const currentFixtures = fixtures
      .filter((fixture) => parseGwNumber(fixture.gw) === Math.max(1, currentGwNumber))
      .slice()
      .sort((left, right) => {
        const rightImpact = fixtureImpactScore(right);
        const leftImpact = fixtureImpactScore(left);
        if (rightImpact !== leftImpact) {
          return rightImpact - leftImpact;
        }
        return left.id - right.id;
      })
      .slice(0, 12);

    generated.push({
      id: 'results-fixtures-wrap',
      durationMs: minDuration(6000),
      group: 'recap',
      content: (
        <section className="roundup-runner roundup-cup-board">
          <header className="roundup-slide-head">
            <p className="roundup-kicker">YESTERDAY RESULTS & TODAY FIXTURES</p>
            <h2>{currentGwNumber <= 1 ? 'It\'s only just begun' : currentGwNumber >= 7 ? 'Late-season implications now front and center' : 'Momentum check across all divisions'}</h2>
          </header>
          <div className="roundup-results-slide roundup-cup-columns">
            <section className="roundup-results-column">
              <h3>Yesterday's Results</h3>
              {previousResults.length > 0 ? (
                <ul className="roundup-results-list">
                  {previousResults.map((fixture) => (
                    <li key={`prev-${fixture.id}`}>
                      <strong>{fixture.homeTeam} vs {fixture.awayTeam}</strong>
                      <em>{fixture.homeProfit.toFixed(2)} - {fixture.awayProfit.toFixed(2)}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="roundup-empty-copy">No previous gameweek results available.</p>
              )}
            </section>
            <section className="roundup-results-column">
              <h3>Today's Fixtures</h3>
              {currentFixtures.length > 0 ? (
                <ul className="roundup-results-list">
                  {currentFixtures.map((fixture) => (
                    <li key={`curr-${fixture.id}`}>
                      <strong>{fixture.homeTeam} vs {fixture.awayTeam}</strong>
                      <em>{fixture.result === 'pending' ? 'Upcoming tie' : `Result: ${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="roundup-empty-copy">SEASON COMPLETE</p>
              )}
            </section>
          </div>
        </section>
      ),
    });

    generated.push({
      id: 'final-headlines-recap',
      durationMs: minDuration(6000),
      group: 'recap',
      content: (
        <section className="roundup-transition-slide roundup-final-recap">
          <p className="roundup-kicker">FINAL HEADLINES RECAP</p>
          <h2>Title race, survival line, cup drama, and master forecast updated</h2>
          <ul className="roundup-focus-list roundup-focus-list-centered">
            <li>Title race summary refreshed for next gameweek</li>
            <li>Relegation danger list tightened</li>
            <li>Cup storyline momentum locked in</li>
            <li>Master League prediction board published</li>
          </ul>
        </section>
      ),
    });

    generated.push({
      id: 'show-close',
      durationMs: minDuration(5000),
      group: 'closing',
      content: (
        <section className="roundup-transition-slide roundup-show-close">
          <p className="roundup-kicker">SKY SPORTS NEWS</p>
          <h2>See you next Game Week</h2>
          <p>Closing sting</p>
        </section>
      ),
    });

    const filtered = filterSlidesForSelection(generated, selection);
    if (filtered.length > 0) {
      return filtered;
    }

    return [
      {
        id: 'selection-empty-state',
        durationMs: minDuration(5000),
        group: 'opening',
        content: (
          <section className="roundup-empty-state">
            <h2>Sky Sports News</h2>
            <p>No slides available for this selection yet.</p>
          </section>
        ),
      },
    ];
  }, [
    allTimeLeagues,
    breakingHeadline,
    divisionForecastsByKey,
    championsSpotlight,
    cupSegment,
    breakingNewsStories,
    forecastWatchStories,
    currentGw,
    currentGwNumber,
    currentSeason,
    cycleAnchor,
    divisions,
    fixtures,
    histories,
    masterCupFixtures,
    masterLeagueForecast,
    masterLeagueFixtures,
    masterLeagueRows,
    previousChampions,
    selection,
    superCupFixtures,
    teamPredictionRaceBySeason,
    thisTimeLastWeekEntries,
    trioForecastsByDivision,
    trioLeagueFixtures,
    trioLeagueRows,
  ]);

  const activeSlide = slides[activeSlideIndex] ?? slides[0];
  const activeSlideId = activeSlide?.id ?? '';
  const activeSlideDurationMs = activeSlide?.durationMs ?? minDuration(5000);

  useEffect(() => {
    setActiveSlideIndex(0);
  }, [cycleAnchor]);

  useEffect(() => {
    if (!activeSlideId || slides.length <= 1) {
      return undefined;
    }
    const extraDramaMs = saturdayLateDrama ? 1200 : 0;
    const timeoutId = window.setTimeout(() => {
      setActiveSlideIndex((index) => (index + 1) % slides.length);
    }, activeSlideDurationMs + extraDramaMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSlideDurationMs, activeSlideId, saturdayLateDrama, slides.length]);

  const tickerItems = useMemo(
    () => buildTickerItems({
      currentSeason,
      currentGw,
      divisions,
      championsSpotlight,
      cupSegment,
      masterLeagueRows,
      masterLeagueForecast,
      allTimeLeagues,
      breakingHeadline,
      forecastWatchStories,
    }),
    [allTimeLeagues, breakingHeadline, championsSpotlight, cupSegment, currentGw, currentSeason, divisions, forecastWatchStories, masterLeagueForecast, masterLeagueRows],
  );

  return (
    <section className={`roundup-show-shell ssn-screen${saturdayLateDrama ? ' is-late-drama' : ''}`}>
      <div className={`roundup-show-stage ssn-stage${activeSlide?.emphasis === 'key-final' ? ' is-key-final' : ''}`}>
        <AnimatePresence mode="wait">
          {activeSlide ? (
            <motion.article
              key={activeSlide.id}
              className="roundup-show-slide"
              initial={{ opacity: 0, y: 14, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 1.003 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeSlide.content}
            </motion.article>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="roundup-lower-third ssn-ticker">
        <TickerBar label="Sky Sports News" items={tickerItems} />
      </div>
    </section>
  );
}
