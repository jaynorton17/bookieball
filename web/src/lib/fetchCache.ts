import { emitBookieBallEvent } from './appEvents';

type CacheEntry = {
  expiresAt: number;
  response: Response;
  category: 'state' | 'live' | 'history';
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

    const fetchPromise = nativeFetch(request).then((response) => {
      if (response.ok) {
        cache.set(url, {
          response: response.clone(),
          expiresAt: Date.now() + ttlForCategory(category),
          category,
        });
      }
      return response;
    }).finally(() => inFlight.delete(url));

    inFlight.set(url, fetchPromise);
    return (await fetchPromise).clone();
  }) as typeof window.fetch;
}
