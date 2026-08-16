export type BookieBallEventMap = {
  'data-mutated': { url: string; method: string };
  'gameweek-changed': { url: string };
  'snapshot-refresh': { reason: string };
};

type EventName = keyof BookieBallEventMap;

export function emitBookieBallEvent<K extends EventName>(name: K, detail: BookieBallEventMap[K]): void {
  window.dispatchEvent(new CustomEvent(`bookieball:${name}`, { detail }));
}

export function onBookieBallEvent<K extends EventName>(name: K, handler: (detail: BookieBallEventMap[K]) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<BookieBallEventMap[K]>).detail);
  window.addEventListener(`bookieball:${name}`, listener);
  return () => window.removeEventListener(`bookieball:${name}`, listener);
}
