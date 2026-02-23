export type StudioPhase = 'teams' | 'leagues';

export type StudioRotationState = {
  phase: StudioPhase;
  teamRunIndex: number;
  teamSlideIndex: number;
  leagueSlideIndex: number;
};

type NormalizeStudioRotationArgs = {
  state: StudioRotationState;
  teamRunCount: number;
  activeTeamSlideCount: number;
  supportSlideCount: number;
};

type NextStudioRotationArgs = NormalizeStudioRotationArgs & {
  focusTeamId: number | null;
};

function clampLoopIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const remainder = index % total;
  return remainder >= 0 ? remainder : remainder + total;
}

export function normalizeStudioRotationState({
  state,
  teamRunCount,
  activeTeamSlideCount,
  supportSlideCount,
}: NormalizeStudioRotationArgs): StudioRotationState {
  if (teamRunCount === 0) {
    return {
      phase: supportSlideCount > 0 ? 'leagues' : 'teams',
      teamRunIndex: 0,
      teamSlideIndex: 0,
      leagueSlideIndex: clampLoopIndex(state.leagueSlideIndex, supportSlideCount),
    };
  }

  const normalizedPhase =
    state.phase === 'leagues' && supportSlideCount === 0
      ? 'teams'
      : state.phase === 'teams' && activeTeamSlideCount === 0 && supportSlideCount > 0
        ? 'leagues'
        : state.phase;

  return {
    phase: normalizedPhase,
    teamRunIndex: clampLoopIndex(state.teamRunIndex, teamRunCount),
    teamSlideIndex: clampLoopIndex(state.teamSlideIndex, Math.max(1, activeTeamSlideCount)),
    leagueSlideIndex: clampLoopIndex(state.leagueSlideIndex, supportSlideCount),
  };
}

export function nextStudioRotationState({
  state,
  teamRunCount,
  activeTeamSlideCount,
  supportSlideCount,
  focusTeamId,
}: NextStudioRotationArgs): StudioRotationState {
  if (teamRunCount === 0) {
    return {
      phase: supportSlideCount > 0 ? 'leagues' : 'teams',
      teamRunIndex: 0,
      teamSlideIndex: 0,
      leagueSlideIndex: clampLoopIndex(state.leagueSlideIndex + 1, supportSlideCount),
    };
  }

  if (state.phase === 'teams') {
    if (activeTeamSlideCount > 0 && state.teamSlideIndex < activeTeamSlideCount - 1) {
      return {
        ...state,
        teamSlideIndex: state.teamSlideIndex + 1,
      };
    }

    const nextTeamRunIndex = clampLoopIndex(state.teamRunIndex + 1, teamRunCount);
    if (supportSlideCount > 0) {
      return {
        ...state,
        phase: 'leagues',
        teamRunIndex: nextTeamRunIndex,
        teamSlideIndex: 0,
      };
    }

    return {
      ...state,
      teamRunIndex: nextTeamRunIndex,
      teamSlideIndex: 0,
      phase: focusTeamId ? 'teams' : state.phase,
    };
  }

  if (supportSlideCount === 0) {
    return {
      ...state,
      phase: 'teams',
      teamSlideIndex: 0,
    };
  }

  return {
    ...state,
    phase: 'teams',
    teamSlideIndex: 0,
    leagueSlideIndex: clampLoopIndex(state.leagueSlideIndex + 1, supportSlideCount),
  };
}

export function orderTeamRunsByFocus<T extends { teamId: number }>(
  runs: T[],
  focusTeamId: number | null | undefined,
): T[] {
  if (!focusTeamId || runs.length <= 1) {
    return runs;
  }
  const startIndex = runs.findIndex((run) => run.teamId === focusTeamId);
  if (startIndex <= 0) {
    return runs;
  }
  return [
    ...runs.slice(startIndex),
    ...runs.slice(0, startIndex),
  ];
}
