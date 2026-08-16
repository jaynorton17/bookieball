import { emitBookieBallEvent } from './appEvents';

type CacheEntry = {
  expiresAt: number;
  response: Response;
  category: 'state' | 'live' | 'history';
};

type DrawPoolTeam = {
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
};

type DrawPoolDivision = {
  division: string;
  teams: DrawPoolTeam[];
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Response>>();
let installed = false;

function categoryForUrl(url: string): CacheEntry['category'] {
  if (/[?&]season=S\d+/i.test(url) || /\/team\/(?:history|history-bulk)/i.test(url) || /all-time/i.test(url) || /archive/i.test(url)) return 'history';
  if (/\/state(?:\?|$)/i.test(url)) return 'state';
  return 'live';
}

function ttlForCategory(category: CacheEntry['category']): number {
  if (category === 'history') return 30 * 60_000;
  if (category === 'state') return 1_000;
  return 8_000;
}

export function clearBookieBallFetchCache(category?: CacheEntry['category']): void {
  if (!category) {
    cache.clear();
    inFlight.clear();
    return;
  }
  for (const [url, entry] of cache) {
    if (entry.category === category) cache.delete(url);
  }
}

function isGameweekMutation(url: string): boolean {
  return /\/admin\/(?:advance-gw|set-gw|rewind)/i.test(url);
}

function isGameshowDrawPool(url: string): boolean {
  return /\/gameshow\/draw-pool(?:\?|$)/i.test(url);
}

async function normalizeGameshowDrawPool(response: Response): Promise<Response> {
  if (!response.ok) return response;
  try {
    const groups = await response.clone().json() as DrawPoolDivision[];
    if (!Array.isArray(groups) || groups.length === 0) return response;

    const seen = new Set<number>();
    const allTeams: DrawPoolTeam[] = [];
    groups.forEach((group) => {
      (group.teams ?? []).forEach((team) => {
        if (seen.has(team.teamId)) return;
        seen.add(team.teamId);
        allTeams.push(team);
      });
    });

    if (allTeams.length === 0) return response;

    // GameshowPage historically expects a division-grouped pool. Present one
    // synthetic group containing every eligible team so the existing server-side
    // draw validation/persistence remains untouched while selection is uniform
    // across all remaining team balls.
    const combined: DrawPoolDivision[] = [{
      division: groups[0].division,
      teams: allTeams,
    }];

    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify(combined), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

export function installBookieBallFetchCache(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const method = request.method.toUpperCase();
    const url = request.url;

    if (method !== 'GET') {
      const response = await nativeFetch(request);
      if (response.ok) {
        clearBookieBallFetchCache('state');
        clearBookieBallFetchCache('live');
        emitBookieBallEvent('data-mutated', { url, method });
        if (isGameweekMutation(url)) emitBookieBallEvent('gameweek-changed', { url });
      }
      return response;
    }

    const category = categoryForUrl(url);
    const now = Date.now();
    const cached = cache.get(url);
    if (cached && cached.expiresAt > now) return cached.response.clone();
    if (cached) cache.delete(url);

    const pending = inFlight.get(url);
    if (pending) return (await pending).clone();

    const fetchPromise = nativeFetch(request)
      .then((response) => isGameshowDrawPool(url) ? normalizeGameshowDrawPool(response) : response)
      .then((response) => {
        if (response.ok) {
          cache.set(url, {
            response: response.clone(),
            expiresAt: Date.now() + ttlForCategory(category),
            category,
          });
        }
        return response;
      })
      .finally(() => inFlight.delete(url));

    inFlight.set(url, fetchPromise);
    return (await fetchPromise).clone();
  }) as typeof window.fetch;
}
