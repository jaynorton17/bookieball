import {
  isFixtureStatusFinalConfirmed,
  isFixtureStatusInPlay,
  isFixtureStatusPending,
  isFixtureStatusProvisional,
  isFixtureStatusResolved,
  isWeeklyStatusResolved,
} from '../web/src/lib/statusCodes.ts';
import {
  nextStudioRotationState,
  normalizeStudioRotationState,
  orderTeamRunsByFocus,
  type StudioRotationState,
} from '../web/src/lib/studioRotation.ts';
import { buildReporterScript } from '../web/src/lib/studioNarration.ts';
import { getBookieDorWeights, getLastCompletedGameweek, getState, openDatabase } from '../src/db/database.js';

function fail(message: string): never {
  throw new Error(`Studio regression failed: ${message}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function run(): void {
  const baseRuns = [{ teamId: 1 }, { teamId: 2 }, { teamId: 3 }];
  const focusedRuns = orderTeamRunsByFocus(baseRuns, 2);
  assert(focusedRuns.length === baseRuns.length, 'focus ordering changed run count');
  assert(focusedRuns[0]?.teamId === 2, 'focused team was not moved to queue front');
  assert(orderTeamRunsByFocus(baseRuns, null)[0]?.teamId === 1, 'null focus should keep original ordering');
  assert(orderTeamRunsByFocus(baseRuns, 99)[0]?.teamId === 1, 'unknown focus should keep original ordering');

  const normalized = normalizeStudioRotationState({
    state: {
      phase: 'teams',
      teamRunIndex: 8,
      teamSlideIndex: 6,
      leagueSlideIndex: 9,
    },
    teamRunCount: 3,
    activeTeamSlideCount: 2,
    supportSlideCount: 4,
  });
  assert(normalized.teamRunIndex >= 0 && normalized.teamRunIndex <= 2, 'teamRunIndex did not clamp into queue');
  assert(normalized.teamSlideIndex >= 0 && normalized.teamSlideIndex <= 1, 'teamSlideIndex did not clamp into slide set');
  assert(normalized.leagueSlideIndex >= 0 && normalized.leagueSlideIndex <= 3, 'leagueSlideIndex did not clamp into support set');

  let state: StudioRotationState = {
    phase: 'teams',
    teamRunIndex: 0,
    teamSlideIndex: 0,
    leagueSlideIndex: 0,
  };

  state = nextStudioRotationState({
    state,
    teamRunCount: 3,
    activeTeamSlideCount: 2,
    supportSlideCount: 3,
    focusTeamId: null,
  });
  assert(state.phase === 'teams' && state.teamSlideIndex === 1, 'first tick should advance within team slides');

  state = nextStudioRotationState({
    state,
    teamRunCount: 3,
    activeTeamSlideCount: 2,
    supportSlideCount: 3,
    focusTeamId: null,
  });
  assert(state.phase === 'leagues', 'end of team slide stack should swap to league phase');
  assert(state.teamRunIndex === 1, 'team run should move to next team before league phase');
  assert(state.teamSlideIndex === 0, 'team slide index should reset when team phase ends');

  state = nextStudioRotationState({
    state,
    teamRunCount: 3,
    activeTeamSlideCount: 2,
    supportSlideCount: 3,
    focusTeamId: null,
  });
  assert(state.phase === 'teams', 'league tick should return to team phase');
  assert(state.leagueSlideIndex === 1, 'league slide index should advance during league tick');

  assert(isFixtureStatusPending('pending'), 'pending fixture status should be pending');
  assert(isFixtureStatusInPlay('in_play'), 'in_play fixture status should be in play');
  assert(isFixtureStatusProvisional('provisional'), 'provisional fixture status should be provisional');
  assert(isFixtureStatusFinalConfirmed('final_confirmed'), 'final_confirmed fixture status should be final confirmed');
  assert(!isFixtureStatusPending('provisional'), 'provisional fixture status should not be pending');
  assert(isFixtureStatusResolved('provisional'), 'provisional fixture status should be resolved');
  assert(isFixtureStatusResolved('final_confirmed'), 'final_confirmed fixture status should be resolved');
  assert(!isFixtureStatusResolved('pending'), 'pending fixture status should not be resolved');
  assert(isWeeklyStatusResolved('won'), 'weekly status won should be resolved');
  assert(!isWeeklyStatusResolved('in_play'), 'weekly status in_play should not be resolved');
  const soloScript = buildReporterScript('Team A are top. Team B are chasing.', 'desk', 'solo');
  assert(soloScript.length === 1, 'solo reporter script should render as one speech line');
  assert(soloScript[0]?.speaker === 'anchor', 'solo reporter should use anchor speaker');
  const duoScript = buildReporterScript('Team A are top. Team B are chasing.', 'desk', 'duo');
  assert(duoScript.length >= 2, 'duo reporter script should render multiple speech lines');
  assert(duoScript[0]?.speaker === 'anchor', 'duo reporter script should start with anchor');
  assert(duoScript.some((line) => line.speaker === 'analyst'), 'duo reporter script should include analyst lines');

  const weights = getBookieDorWeights();
  const scoreChampionOnly = (100 * weights.league) + (0 * weights.cup) + (0 * weights.master) + (0 * weights.consistency);
  const scoreAllRound = (70 * weights.league) + (0 * weights.cup) + (80 * weights.master) + (80 * weights.consistency);
  assert(scoreAllRound > scoreChampionOnly, 'Bookie d\'Or model should reward all-around profile over league-only profile');
  assert(weights.league <= 0.5, 'Bookie d\'Or league weight should not dominate the model');
  assert(weights.cup === 0, 'Bookie d\'Or should exclude cup competitions');

  const db = openDatabase();
  try {
    const state = getState(db);
    const recap = getLastCompletedGameweek(db, state.currentSeason, state.currentGw);
    if (state.currentGw === 'GW1') {
      const seasonNumber = Number(state.currentSeason.replace('S', ''));
      if (seasonNumber > 1) {
        assert(Boolean(recap), 'GW1 should resolve a cross-season last-completed gameweek');
        assert(recap?.gw === 'GW8', 'cross-season last-completed gameweek should resolve to GW8');
      }
    } else {
      assert(Boolean(recap), 'in-season last-completed gameweek should not be null');
    }
  } finally {
    db.close();
  }

  console.log('Studio regression checks passed.');
}

run();
