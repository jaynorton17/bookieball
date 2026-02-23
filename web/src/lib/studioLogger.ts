type StudioLogPayload = Record<string, unknown> | undefined;

function debugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem('bookieball_studio_debug') === '1';
  } catch {
    return false;
  }
}

function write(scope: string, event: string, payload?: StudioLogPayload): void {
  if (!debugEnabled()) {
    return;
  }
  const stamp = new Date().toISOString();
  if (payload) {
    console.info(`[studio][${scope}] ${stamp} ${event}`, payload);
    return;
  }
  console.info(`[studio][${scope}] ${stamp} ${event}`);
}

export function studioLog(scope: string, event: string, payload?: StudioLogPayload): void {
  write(scope, event, payload);
}
