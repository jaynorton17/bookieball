import { useEffect, useRef } from 'react';

export function AutoScrollViewport({ children, className = '', leadInMs = 1400, bottomPauseMs = 1200 }: { children: React.ReactNode; className?: string; leadInMs?: number; bottomPauseMs?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollTop = 0;
    let frame = 0;
    let timer = 0;
    const start = () => {
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      if (max <= 8) return;
      const travelMs = Math.max(6500, Math.min(13_000, 5600 + max * 9));
      const startedAt = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startedAt;
        if (elapsed < leadInMs) {
          frame = requestAnimationFrame(tick);
          return;
        }
        const progress = Math.min(1, (elapsed - leadInMs) / travelMs);
        const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        node.scrollTop = max * eased;
        if (progress < 1) frame = requestAnimationFrame(tick);
        else timer = window.setTimeout(() => {}, bottomPauseMs);
      };
      frame = requestAnimationFrame(tick);
    };
    timer = window.setTimeout(start, 150);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [children, leadInMs, bottomPauseMs]);

  return <div ref={ref} className={className}>{children}</div>;
}
