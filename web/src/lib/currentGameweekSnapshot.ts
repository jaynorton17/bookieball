import { api } from './api';

export async function loadCurrentGameweekSnapshot() {
  const state = await api.state();
  const [
    teams,
    leagueTable,
    leagueFixtures,
    masterLeague,
    masterFixtures,
    trioLeague,
    trioFixtures,
    tierLeague,
    tierFixtures,
    cupFixtures,
    masterCupFixtures,
    superCupFixtures,
    entries,
    predictions,
    predictionScoreboard,
    bookieDor,
    storylines,
    allTime,
  ] = await Promise.all([
    api.teams(),
    api.leagueTable(),
    api.leagueFixtures(state.currentGw, false),
    api.masterLeagueTable(state.currentGw).catch(() => null),
    api.masterLeagueFixtures(state.currentGw, false).catch(() => []),
    api.trioLeagueTable(state.currentGw).catch(() => null),
    api.trioLeagueFixtures(state.currentGw, false).catch(() => []),
    api.tierLeagueTable(state.currentGw).catch(() => null),
    api.tierLeagueFixtures(state.currentGw, false).catch(() => []),
    api.cup(state.currentGw).catch(() => []),
    api.masterCupFixtures(state.currentGw, false).catch(() => []),
    api.superCup(state.currentSeason).catch(() => []),
    api.entries({ gw: state.currentGw, limit: 1000 }).catch(() => []),
    api.predictions(state.currentGw, state.currentSeason).catch(() => null),
    api.predictionScoreboard(state.currentSeason).catch(() => null),
    api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
    api.reportStorylines(state.currentGw).catch(() => null),
    api.allTimeLeagues().catch(() => null),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    state,
    teams,
    league: { table: leagueTable, fixtures: leagueFixtures },
    master: { table: masterLeague, fixtures: masterFixtures },
    trio: { table: trioLeague, fixtures: trioFixtures },
    tier: { table: tierLeague, fixtures: tierFixtures },
    cups: { bookieball: cupFixtures, master: masterCupFixtures, super: superCupFixtures },
    entries,
    predictions,
    predictionScoreboard,
    bookieDor,
    storylines,
    allTime,
  };
}

export type CurrentGameweekSnapshot = Awaited<ReturnType<typeof loadCurrentGameweekSnapshot>>;
