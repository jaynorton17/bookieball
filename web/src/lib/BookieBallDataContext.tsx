import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onBookieBallEvent } from './appEvents';
import { loadCurrentGameweekSnapshot, type CurrentGameweekSnapshot } from './currentGameweekSnapshot';

type ContextValue = {
  snapshot: CurrentGameweekSnapshot | null;
  loading: boolean;
  error: string;
  refresh: (reason?: string) => Promise<void>;
};

const BookieBallDataContext = createContext<ContextValue | null>(null);

export function BookieBallDataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<CurrentGameweekSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const refresh = useCallback(async (_reason = 'manual') => {
    const requestId = ++requestRef.current;
    setLoading((current) => current || snapshot === null);
    try {
      const next = await loadCurrentGameweekSnapshot();
      if (requestId !== requestRef.current) return;
      setSnapshot(next);
      setError('');
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load BookieBall live data.');
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [snapshot]);

  useEffect(() => {
    void refresh('initial');
    const offGameweek = onBookieBallEvent('gameweek-changed', () => void refresh('gameweek-changed'));
    const offMutation = onBookieBallEvent('data-mutated', () => void refresh('data-mutated'));
    const offSnapshot = onBookieBallEvent('snapshot-refresh', ({ reason }) => void refresh(reason));
    return () => {
      offGameweek();
      offMutation();
      offSnapshot();
    };
  }, [refresh]);

  const value = useMemo(() => ({ snapshot, loading, error, refresh }), [snapshot, loading, error, refresh]);
  return <BookieBallDataContext.Provider value={value}>{children}</BookieBallDataContext.Provider>;
}

export function useBookieBallData(): ContextValue {
  const value = useContext(BookieBallDataContext);
  if (!value) throw new Error('useBookieBallData must be used inside BookieBallDataProvider');
  return value;
}
