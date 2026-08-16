import { api } from './api';
import { loadAllTimeAnalytics } from './allTimeAnalytics';

let cachedSeason = '';
let cachedPromise: ReturnType<typeof loadAllTimeAnalytics> | null = null;

export function clearAllTimeAnalyticsCache(): void {
  cachedSeason = '';
  cachedPromise = null;
}

export async function loadCachedAllTimeAnalytics() {
  const state = await api.state();
  if (cachedPromise && cachedSeason === state.currentSeason) return cachedPromise;
  cachedSeason = state.currentSeason;
  cachedPromise = loadAllTimeAnalytics().catch((error) => {
    cachedPromise = null;
    cachedSeason = '';
    throw error;
  });
  return cachedPromise;
}
