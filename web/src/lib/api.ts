const rawApiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:5181/api';
const API_BASE = rawApiBase.replace(/\/+$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

function queryString(params: Record<string, string | undefined | null>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    query.set(key, value);
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export const api = {
  studioDeskPrompt: () => request<{ prompt: string }>('/studio/prompt'),
  state: () => request<{ currentSeason: string; currentGw: string; cupDrawStarted: boolean; gwLocked: boolean }>('/state'),
  lastCompletedGameweek: () =>
    request<{
      currentSeason: string;
      currentGw: string;
      lastCompleted: { season: string; gw: string } | null;
    }>('/last-completed-gw'),
  teams: () =>
    request<
      Array<{
        id: number;
        teamId: string | null;
        name: string;
        url: string;
        division: string;
        ballColor: string | null;
        ringColor: string | null;
        textColor: string | null;
        preseasonFavorite: boolean;
        trendCache: {
          teamId: number;
          windowSize: number;
          fromGw: string;
          toGw: string;
          rankDelta: number;
          pointsDelta: number;
          profitDelta: number;
          pointsDeltaVsPreviousWindow: number | null;
          profitDeltaVsPreviousWindow: number | null;
        } | null;
      }>
    >('/teams'),
  teamTrends: (gw?: string) =>
    request<{
      season: string;
      gw: string;
      trends: Array<{
        teamId: number;
        windowSize: number;
        fromGw: string;
        toGw: string;
        rankDelta: number;
        pointsDelta: number;
        profitDelta: number;
        pointsDeltaVsPreviousWindow: number | null;
        profitDeltaVsPreviousWindow: number | null;
      }>;
    }>(`/team-trends${gw ? `?gw=${encodeURIComponent(gw)}` : ''}`),
  leagueTable: () =>
    request<
      Record<
        string,
        Array<{ teamId: number; teamName: string; division: string; played: number; wins: number; draws: number; losses: number; points: number; profit: number; spins: number; rank: number }>
      >
    >('/league-table'),
  leagueMovement: () =>
    request<{
      baselineGw: string | null;
      baselineLabel: string | null;
      movement: Record<string, Record<number, number>>;
    }>('/league-movement'),
  leagueFixtures: (gw?: string, all?: boolean, season?: string) => {
    const params = new URLSearchParams();
    if (gw) {
      params.set('gw', gw);
    }
    if (all) {
      params.set('all', '1');
    }
    if (season) {
      params.set('season', season);
    }
    const qs = params.toString();
    return request<Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; result: 'home' | 'away' | 'draw' | 'pending' }>>(
      `/league-fixtures${qs ? `?${qs}` : ''}`,
    );
  },
  masterLeagueTable: (gw?: string) =>
    request<{
      gw: string;
      baselineGw: string | null;
      movement: Record<number, number>;
      table: Array<{
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
      }>;
    }>(`/master-league/table${gw ? `?gw=${encodeURIComponent(gw)}` : ''}`),
  masterLeagueFixtures: (gw?: string, all?: boolean) =>
    request<Array<{
      id: number;
      gw: string;
      homeTeamId: number;
      awayTeamId: number;
      homeTeam: string;
      awayTeam: string;
      homeProfit: number;
      awayProfit: number;
      homeSpins: number;
      awaySpins: number;
      result: 'home' | 'away' | 'draw' | 'pending';
    }>>(`/master-league/fixtures${all ? '?all=1' : gw ? `?gw=${encodeURIComponent(gw)}` : ''}`),
  allTimeLeagues: () =>
    request<{
      fromSeason: string;
      fromGw: string;
      toSeason: string;
      toGw: string;
      pointsTable: Array<{
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
      }>;
      spinsTable: Array<{
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
      }>;
      profitTable: Array<{
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
      }>;
    }>('/all-time-leagues'),
  seasonProfitComparison: () =>
    request<{
      currentSeason: string;
      seasons: string[];
      gameweeks: Array<{ gw: string; totals: Record<string, number> }>;
    }>('/season-profit-comparison'),
  cup: (gw?: string, season?: string) =>
    request<
      Array<{
        id: number;
        round: number;
        matchNumber: number;
        gw: string;
        roundName: string;
        homeTeam: string | null;
        homeDivision: string | null;
        awayTeam: string | null;
        awayDivision: string | null;
        sourceMatchA: number | null;
        sourceMatchB: number | null;
        winnerTeam: string | null;
      }>
    >(`/cup${queryString({ gw, season })}`),
  cupStatus: () =>
    request<
      Array<{
        gw: string;
        roundName: string;
        totalFixtures: number;
        playableFixtures: number;
        resolvedFixtures: number;
        complete: boolean;
        locked: boolean;
      }>
    >('/cup/status'),
  startCupDraw: () =>
    request<{
      ok: boolean;
      fixtures: Array<{
        id: number;
        round: number;
        matchNumber: number;
        gw: string;
        roundName: string;
        homeTeam: string | null;
        homeDivision: string | null;
        awayTeam: string | null;
        awayDivision: string | null;
        sourceMatchA: number | null;
        sourceMatchB: number | null;
        winnerTeam: string | null;
      }>;
    }>(
      '/cup/start-draw',
      { method: 'POST', body: '{}' },
    ),
  drawTeam: () =>
    request<{
      teamId: number;
      teamKey: string | null;
      teamName: string;
      division: string;
      teamUrl: string;
      ballColor: string | null;
      ringColor: string | null;
      textColor: string | null;
      cupOpponent: string;
      leagueOpponent: string;
      alreadyPlayed: boolean;
      currentGwProfit: number;
      currentGwSpins: number;
    }>('/gameshow/draw', { method: 'POST', body: '{}' }),
  predictions: (gw?: string, season?: string) =>
    request<{
      season: string;
      gw: string;
      locked: boolean;
      predictions: Array<{
        id: number;
        gw: string;
        competition: 'league' | 'cup';
        fixtureId: number;
        picker: string;
        pickOutcome: 'team' | 'draw';
        pickTeamId: number | null;
        pickTeamName: string;
        predictedHomeScore: number | null;
        predictedAwayScore: number | null;
        createdAt: string;
      }>;
    }>(`/predictions${queryString({ gw, season })}`),
  savePredictions: (payload: {
    gw: string;
    competition: 'league' | 'cup';
    picks: Array<{
      fixtureId: number;
      pickTeamId?: number | null;
      pickOutcome?: 'team' | 'draw';
      predictedHomeScore?: number | null;
      predictedAwayScore?: number | null;
    }>;
    picker?: string;
  }) =>
    request<{ ok: boolean; saved: number; locked: boolean }>('/predictions', { method: 'POST', body: JSON.stringify(payload) }),
  lockPredictions: (gw?: string) =>
    request<{ ok: boolean; locked: boolean; cpuAdded: number }>('/predictions/lock', { method: 'POST', body: JSON.stringify({ gw }) }),
  unlockPredictions: (gw?: string) =>
    request<{ ok: boolean; locked: boolean }>('/predictions/unlock', { method: 'POST', body: JSON.stringify({ gw }) }),
  predictionScoreboard: (season?: string) =>
    request<{
      totals: Array<{ picker: string; points: number; correct: number; total: number; perfectWeeks: number }>;
      weeks: Array<{ gw: string; picker: string; points: number; correct: number; total: number; perfect: boolean }>;
    }>(`/predictions/scoreboard${season ? `?season=${encodeURIComponent(season)}` : ''}`),
  bookieDor: (season?: string, gw?: string) =>
    request<{
      season: string;
      gw: string;
      weights: { league: number; cup: number; master: number; consistency: number };
      holder: {
        teamId: number;
        teamName: string;
        division: string;
        score: number;
        leagueScore: number;
        cupScore: number;
        masterScore: number;
        consistencyScore: number;
        weightedLeagueScore: number;
        weightedCupScore: number;
        weightedMasterScore: number;
        weightedConsistencyScore: number;
        leagueRank: number;
        cupFinish: string;
      } | null;
      leaderboard: Array<{
        teamId: number;
        teamName: string;
        division: string;
        score: number;
        leagueScore: number;
        cupScore: number;
        masterScore: number;
        consistencyScore: number;
        weightedLeagueScore: number;
        weightedCupScore: number;
        weightedMasterScore: number;
        weightedConsistencyScore: number;
        leagueRank: number;
        cupFinish: string;
      }>;
    }>(`/bookie-dor${queryString({ season, gw })}`),
  teamSeasonHistory: (teamId: number) =>
    request<{
      seasons: Array<{
        season: string;
        division: string;
        rank: number;
        points: number;
        profit: number;
        spins: number;
        played: number;
        wins: number;
        draws: number;
        losses: number;
        cupFinish: string;
      }>;
    }>(`/team/${teamId}/history`),
  teamSeasonHistoryBulk: (teamIds?: number[]) =>
    request<{
      histories: Record<number, Array<{
        season: string;
        division: string;
        rank: number;
        points: number;
        profit: number;
        spins: number;
        played: number;
        wins: number;
        draws: number;
        losses: number;
        cupFinish: string;
      }>>;
    }>('/team/history-bulk', { method: 'POST', body: JSON.stringify({ teamIds }) }),
  reportStorylines: (gw?: string) =>
    request<{
      generatedAt: string;
      season: string;
      gw: string;
      storylines: Array<{ id: string; headline: string; detail: string; tone: 'positive' | 'warning' | 'neutral'; metric?: string }>;
      tickerItems: string[];
      summary: { fixtures: number; resolved: number; cupFixtures: number; cupResolved: number };
    }>(`/report/storylines${gw ? `?gw=${encodeURIComponent(gw)}` : ''}`),
  reportRivalryDesk: (gw?: string) =>
    request<{
      generatedAt: string;
      season: string;
      gw: string;
      rivalries: Array<{
        id: string;
        matchup: string;
        record: string;
        edge: string;
        avgMargin: string;
        nextMeeting: string;
        narrative: string;
      }>;
    }>(`/report/rivalry-desk${gw ? `?gw=${encodeURIComponent(gw)}` : ''}`),
  reportSnapshotCompare: (fromGw?: string, toGw?: string) => {
    const params = new URLSearchParams();
    if (fromGw) {
      params.set('fromGw', fromGw);
    }
    if (toGw) {
      params.set('toGw', toGw);
    }
    const qs = params.toString();
    return request<{
      generatedAt: string;
      season: string;
      fromGw: string;
      toGw: string;
      fromSnapshot: { id: number; label: string; createdAt: string } | null;
      toSnapshot: { id: number; label: string; createdAt: string } | null;
      divisions: Array<{
        division: string;
        topRise: { teamName: string; delta: number } | null;
        topDrop: { teamName: string; delta: number } | null;
        movers: Array<{ teamName: string; delta: number; currentRank: number }>;
      }>;
    }>(`/report/snapshot-compare${qs ? `?${qs}` : ''}`);
  },
  reportPack: (gw?: string) =>
    request<{
      generatedAt: string;
      season: string;
      gw: string;
      presenterNotes: string[];
      reportText: string;
      story: {
        season: string;
        gw: string;
        storylines: Array<{ id: string; headline: string; detail: string; tone: 'positive' | 'warning' | 'neutral'; metric?: string }>;
        tickerItems: string[];
        summary: { fixtures: number; resolved: number; cupFixtures: number; cupResolved: number };
      };
      rivalryDesk: Array<{
        id: string;
        matchup: string;
        record: string;
        edge: string;
        avgMargin: string;
        nextMeeting: string;
        narrative: string;
      }>;
      achievements: Array<{ key: string; label: string; teamName: string; value: string }>;
      snapshots: Array<{ id: number; season: string; gw: string; label: string; createdAt: string }>;
      snapshotCompare: {
        season: string;
        fromGw: string;
        toGw: string;
        divisions: Array<{
          division: string;
          topRise: { teamName: string; delta: number } | null;
          topDrop: { teamName: string; delta: number } | null;
          movers: Array<{ teamName: string; delta: number; currentRank: number }>;
        }>;
      };
      predictionScoreboard: {
        totals: Array<{ picker: string; points: number; correct: number; total: number; perfectWeeks: number }>;
        weeks: Array<{ gw: string; picker: string; points: number; correct: number; total: number; perfect: boolean }>;
      };
      seasonProfitComparison: {
        seasons: string[];
        gameweeks: Array<{ gw: string; totals: Record<string, number> }>;
      };
    }>(`/report/pack${gw ? `?gw=${encodeURIComponent(gw)}` : ''}`),
  seasonFinale: () =>
    request<
      | { pending: false }
      | {
          season: string;
          payload: {
            season: string;
            leagueWinners: Array<{ division: string; teamId: number; teamName: string }>;
            bestProfits: {
              overall: { teamId: number; teamName: string; profit: number } | null;
              byDivision: Array<{ division: string; teamId: number; teamName: string; profit: number }>;
            };
            promotions: Array<{ teamId: number; teamName: string; from: string; to: string }>;
            relegations: Array<{ teamId: number; teamName: string; from: string; to: string }>;
            playoffResults: Array<{
              upperTeamId: number;
              upperTeamName: string;
              lowerTeamId: number;
              lowerTeamName: string;
              upperDivision: string;
              lowerDivision: string;
              winnerTeamId: number | null;
              winnerTeamName: string | null;
              swapped: boolean;
            }>;
            cupWinner: { teamId: number; teamName: string } | null;
            standout: Array<{ label: string; value: string }>;
            goalsOfSeason: Array<{ division: string; teamId: number; teamName: string; profit: number }>;
            bookieDor: {
              weights: { league: number; cup: number; master: number; consistency: number };
              winner: {
                teamId: number;
                teamName: string;
                division: string;
                score: number;
                leagueScore: number;
                cupScore: number;
                masterScore: number;
                consistencyScore: number;
                weightedLeagueScore: number;
                weightedCupScore: number;
                weightedMasterScore: number;
                weightedConsistencyScore: number;
                leagueRank: number;
                cupFinish: string;
              };
              leaderboard: Array<{
                teamId: number;
                teamName: string;
                division: string;
                score: number;
                leagueScore: number;
                cupScore: number;
                masterScore: number;
                consistencyScore: number;
                weightedLeagueScore: number;
                weightedCupScore: number;
                weightedMasterScore: number;
                weightedConsistencyScore: number;
              }>;
            } | null;
          };
        }
    >('/season-finale'),
  saveEntries: (entries: unknown[]) => request<{ ok: boolean }>('/entries', { method: 'POST', body: JSON.stringify({ entries }) }),
  entries: (filters?: { gw?: string; teamId?: number; type?: 'free_spins' | 'bonus'; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (filters?.gw) {
      params.set('gw', filters.gw);
    }
    if (filters?.teamId) {
      params.set('teamId', String(filters.teamId));
    }
    if (filters?.type) {
      params.set('type', filters.type);
    }
    if (filters?.limit) {
      params.set('limit', String(filters.limit));
    }
    if (filters?.offset) {
      params.set('offset', String(filters.offset));
    }
    const qs = params.toString();
    return request<
      Array<{
        id: number;
        season: string;
        gw: string;
        teamId: number;
        teamName: string;
        entryType: 'free_spins' | 'bonus';
        profit: number;
        spins: number | null;
        stake: number | null;
        notes: string | null;
        noWin: boolean;
        batchId: string | null;
        createdAt: string;
        locked: boolean;
      }>
    >(`/entries${qs ? `?${qs}` : ''}`);
  },
  updateEntry: (entryId: number, payload: { entryType: 'free_spins' | 'bonus'; profit: number; spins?: number | null; stake?: number | null; notes?: string | null; noWin?: boolean }) =>
    request<{ ok: boolean }>(`/entries/${entryId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  undoLastEntries: () => request<{ ok: boolean; result: { batchId: string; removed: number } | null }>('/admin/undo-last-entries', { method: 'POST', body: '{}' }),
  advanceGw: () => request<{ currentSeason: string; currentGw: string }>('/admin/advance-gw', { method: 'POST', body: '{}' }),
  loadLeagueFixtures: () => request<{ ok: boolean; message: string; created: number }>('/admin/load-league-fixtures', { method: 'POST', body: '{}' }),
  generateMasterLeagueFixtures: (fromGw?: string, toGw?: string) =>
    request<{ ok: boolean; created: number; fromGw: string; toGw: string }>(
      '/admin/master-league/generate-upcoming',
      { method: 'POST', body: JSON.stringify({ fromGw, toGw }) },
    ),
  setGw: (season: string, gw: string) => request<{ currentSeason: string; currentGw: string }>('/admin/set-gw', { method: 'POST', body: JSON.stringify({ season, gw }) }),
  lockGw: () => request<{ ok: boolean }>('/admin/lock-gw', { method: 'POST', body: '{}' }),
  lockGwSafe: () => request<{ ok: boolean }>('/admin/lock-gw-safe', { method: 'POST', body: '{}' }),
  unlockGw: () => request<{ ok: boolean }>('/admin/unlock-gw', { method: 'POST', body: '{}' }),
  refreshSnapshots: () => request<{ ok: boolean; updated: number; inserted: number }>('/admin/refresh-snapshots', { method: 'POST', body: '{}' }),
  cupDebug: () =>
    request<{
      tieBreakMode: 'random' | 'lower_team_id';
      roundStatus: Array<{
        gw: string;
        roundName: string;
        totalFixtures: number;
        playableFixtures: number;
        resolvedFixtures: number;
        complete: boolean;
        locked: boolean;
      }>;
      recentAudit: Array<{
        id: number;
        gw: string;
        matchNumber: number;
        action: string;
        reason: string;
        oldWinner: string | null;
        newWinner: string | null;
        createdAt: string;
      }>;
    }>('/admin/cup/debug'),
  setCupTieBreakMode: (mode: 'random' | 'lower_team_id') =>
    request<{ ok: boolean; mode: 'random' | 'lower_team_id' }>('/admin/cup/tie-break-mode', { method: 'POST', body: JSON.stringify({ mode }) }),
  setCupWinner: (fixtureId: number, winnerTeamId: number | null) =>
    request<{ ok: boolean }>('/admin/cup/set-winner', { method: 'POST', body: JSON.stringify({ fixtureId, winnerTeamId }) }),
  resetCupRound: (gw: string) => request<{ ok: boolean }>('/admin/cup/reset-round', { method: 'POST', body: JSON.stringify({ gw }) }),
  teamStats: (teamId: number) => request<{ season: { profit: number; wins: number; entries: number }; allTime: { profit: number; wins: number; entries: number }; cupWins: number; leagueTitles: number }>(`/team/${teamId}/stats`),
  teamRatings: () =>
    request<
      Array<{
        teamId: number;
        teamName: string;
        entries: number;
        wins: number;
        profit: number;
        avgProfit: number;
        winRate: number;
        rating: number;
      }>
    >('/team-ratings'),
  achievements: () =>
    request<Array<{ key: string; label: string; teamName: string; value: string }>>('/achievements'),
  headToHead: (teamA: number, teamB: number) =>
    request<{
      teamA: { id: number; name: string };
      teamB: { id: number; name: string };
      played: number;
      teamAWins: number;
      teamBWins: number;
      draws: number;
      meetings: Array<{ gw: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; result: 'home' | 'away' | 'draw' | 'pending' }>;
    }>(`/head-to-head?teamA=${teamA}&teamB=${teamB}`),
  snapshots: () => request<Array<{ id: number; season: string; gw: string; label: string; createdAt: string }>>('/admin/snapshots'),
  snapshotPayload: (id: number) => request<{ id: number; season: string; gw: string; label: string; createdAt: string; payload: Record<string, unknown> }>(`/admin/snapshot?id=${encodeURIComponent(String(id))}`),
  restoreSnapshot: (id: number) =>
    request<{
      ok: boolean;
      restored: { season: string; gw: string; backupPath: string | null };
      state: { currentSeason: string; currentGw: string };
    }>('/admin/restore-snapshot', { method: 'POST', body: JSON.stringify({ id }) }),
  entryAudit: (limit = 50) =>
    request<
      Array<{
        id: number;
        entryId: number;
        teamName: string;
        gw: string;
        action: string;
        actor: string;
        oldProfit: number;
        newProfit: number;
        oldSpins: number | null;
        newSpins: number | null;
        oldStake: number | null;
        newStake: number | null;
        oldEntryType: 'free_spins' | 'bonus' | null;
        newEntryType: 'free_spins' | 'bonus' | null;
        oldNotes: string | null;
        newNotes: string | null;
        oldNoWin: boolean;
        newNoWin: boolean;
        createdAt: string;
      }>
    >(`/admin/entry-audit?limit=${encodeURIComponent(String(limit))}`),
  trophyRoom: () =>
    request<{
      cup: Array<{ season: string; teamName: string }>;
      divisions: Record<string, Array<{ season: string; teamName: string }>>;
      goalsOfSeason: Record<string, Array<{ season: string; teamName: string }>>;
      bookieDor: Array<{ season: string; teamName: string }>;
      masterLeague: Array<{ season: string; teamName: string }>;
    }>('/trophy-room'),
};
