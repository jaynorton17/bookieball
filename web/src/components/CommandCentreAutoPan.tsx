import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function masterRowHtml(row: Awaited<ReturnType<typeof api.masterLeagueTable>>['table'][number]): string {
  return `<div class="command-row command-autopan-row" style="display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:12px;padding:9px 12px;border-radius:12px;background:${row.rank === 1 ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.035)'};border:1px solid rgba(255,255,255,.055)"><div style="color:${row.rank === 1 ? '#f2c14e' : '#91a8bd'};font-weight:900;font-size:14px">#${row.rank}</div><div style="min-width:0"><div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${row.teamName}</div><div class="command-row-detail" style="color:#91a8bd;font-size:11px;margin-top:2px">${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)} profit</div></div><div style="color:${row.rank === 1 ? '#f2c14e' : '#f7fbff'};font-weight:900;font-size:clamp(14px,1.5vw,19px);text-align:right">${row.points} pts</div></div>`;
}

export function CommandCentreAutoPan() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/') return;

    let disposed = false;
    const frames = new Set<number>();
    const timers = new Set<number>();
    let activeSlide: HTMLElement | null = null;

    const clearMotion = () => {
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      timers.forEach((timer) => window.clearTimeout(timer));
      frames.clear();
      timers.clear();
    };

    const animateContainer = (container: HTMLElement, delay = 1500) => {
      container.classList.add('command-auto-pan-window');
      container.scrollTop = 0;
      container.dataset.autoPan = 'top';

      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (disposed || !document.body.contains(container)) return;
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        if (maxScroll <= 8) {
          container.dataset.autoPan = 'static';
          return;
        }

        const travelMs = Math.max(5200, Math.min(10500, 4200 + maxScroll * 9));
        const startedAt = performance.now();

        const tick = (now: number) => {
          if (disposed || !document.body.contains(container)) return;
          const progress = Math.min(1, (now - startedAt) / travelMs);
          const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          container.scrollTop = maxScroll * eased;
          container.dataset.autoPan = progress >= 1 ? 'bottom' : 'moving';
          if (progress < 1) {
            const frame = window.requestAnimationFrame(tick);
            frames.add(frame);
          }
        };

        const frame = window.requestAnimationFrame(tick);
        frames.add(frame);
      }, delay);
      timers.add(timer);
    };

    const prepare = async () => {
      const slide = document.querySelector<HTMLElement>('.command-slide');
      if (!slide) return;
      if (slide === activeSlide && slide.dataset.autoPanPrepared === 'true') return;

      clearMotion();
      activeSlide = slide;
      slide.dataset.autoPanPrepared = 'true';

      const title = slide.querySelector<HTMLElement>('.command-slide-title')?.textContent?.trim() ?? '';
      let table = slide.querySelector<HTMLElement>('.command-table');

      if (title === 'Master League' && table && table.dataset.fullMaster !== 'true') {
        try {
          const payload = await api.masterLeagueTable();
          if (disposed || !payload.table.length || !document.body.contains(table)) return;
          table.innerHTML = payload.table.slice().sort((a, b) => a.rank - b.rank).map(masterRowHtml).join('');
          table.dataset.fullMaster = 'true';
        } catch {
          // Keep existing table if the full Master table cannot be loaded.
        }
      }

      const layoutTimer = window.setTimeout(() => {
        timers.delete(layoutTimer);
        if (disposed || !document.body.contains(slide)) return;

        table = slide.querySelector<HTMLElement>('.command-table');
        const fixtures = slide.querySelector<HTMLElement>('.command-fixtures');

        if (table) animateContainer(table, 900);
        if (fixtures) animateContainer(fixtures, 1200);
      }, 250);
      timers.add(layoutTimer);
    };

    void prepare();
    const observer = new MutationObserver(() => {
      const slide = document.querySelector<HTMLElement>('.command-slide');
      if (slide !== activeSlide) void prepare();
      else if (slide && !slide.dataset.autoPanPrepared) void prepare();
    });
    observer.observe(document.querySelector('.command-centre-page') ?? document.body, { subtree: true, childList: true });

    const onLayoutChanged = () => {
      if (activeSlide) delete activeSlide.dataset.autoPanPrepared;
      void prepare();
    };
    window.addEventListener('bookieball:command-layout-changed', onLayoutChanged);

    return () => {
      disposed = true;
      clearMotion();
      observer.disconnect();
      window.removeEventListener('bookieball:command-layout-changed', onLayoutChanged);
    };
  }, [location.pathname]);

  return null;
}
