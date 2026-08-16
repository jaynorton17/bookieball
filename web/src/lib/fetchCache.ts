type CacheEntry = {
  expiresAt: number;
  response: Response;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Response>>();
let installed = false;

function ttlForUrl(url: string): number {
  const historical = /[?&]season=S\d+/i.test(url) || /\/team\/history-bulk/i.test(url);
  if (historical) return 10 * 60_000;
  if (/\/state(?:\?|$)/i.test(url)) return 1_500;
  return 20_000;
}

export function clearBookieBallFetchCache(): void {
  cache.clear();
  inFlight.clear();
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
      clearBookieBallFetchCache();
      return response;
    }

    const now = Date.now();
    const cached = cache.get(url);
    if (cached && cached.expiresAt > now) {
      return cached.response.clone();
    }
    if (cached) cache.delete(url);

    const pending = inFlight.get(url);
    if (pending) return (await pending).clone();

    const fetchPromise = nativeFetch(request).then((response) => {
      if (response.ok) {
        cache.set(url, {
          response: response.clone(),
          expiresAt: Date.now() + ttlForUrl(url),
        });
      }
      return response;
    }).finally(() => {
      inFlight.delete(url);
    });

    inFlight.set(url, fetchPromise);
    return (await fetchPromise).clone();
  }) as typeof window.fetch;
}
