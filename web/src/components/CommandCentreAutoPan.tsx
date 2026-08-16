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
    let frame = 0;
    let advanceCheckTimer = 0;
    let activeSlideKey = '';

    const stop = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(advanceCheckTimer);
    };

    const runForCurrentSlide = async () => {
      const slide = document.querySelector<HTMLElement>('.command-slide');
      const title = slide?.querySelector<HTMLElement>('.command-slide-title')?.textContent?.trim() ?? '';
      const kicker = slide?.querySelector<HTMLElement>('.command-slide-kicker')?.textContent?.trim() ?? '';
      const table = slide?.querySelector<HTMLElement>('.command-table');
      if (!slide || !table) return;

      const slideKey = `${title}|${kicker}|${slide.getAttribute('style') ?? ''}`;
      if (slideKey === activeSlideKey && table.dataset.autoPanStarted === 'true') return;
      activeSlideKey = slideKey;
      stop();

      if (title === 'Master League' && table.dataset.fullMaster !== 'true') {
        try {
          const payload = await api.masterLeagueTable();
          if (disposed || !payload.table.length || !document.body.contains(table)) return;
          const rows = payload.table.slice().sort((a, b) => a.rank - b.rank);
          table.innerHTML = rows.map(masterRowHtml).join('');
          table.dataset.fullMaster = 'true';
        } catch {
          // Keep the rendered table if the full table cannot be loaded.
        }
      }

      if (disposed || !document.body.contains(table)) return;
      table.classList.add('command-auto-pan-window');
      table.dataset.autoPanStarted = 'true';
      table.dataset.autoPan = 'top';
      table.scrollTop = 0;

      const begin = () => {
        if (disposed || !document.body.contains(table)) return;
        const maxScroll = Math.max(0, table.scrollHeight - table.clientHeight);
        if (maxScroll <= 8) {
          table.dataset.autoPan = 'static';
          return;
        }

        const leadInMs = 1500;
        const travelMs = Math.max(5200, Math.min(10500, 4200 + maxScroll * 10));
        const bottomPauseMs = 1400;
        const startedAt = performance.now();

        const tick = (now: number) => {
          if (disposed || !document.body.contains(table)) return;
          const elapsed = now - startedAt;
          if (elapsed < leadInMs) {
            frame = window.requestAnimationFrame(tick);
            return;
          }
          const progress = Math.min(1, (elapsed - leadInMs) / travelMs);
          const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          table.dataset.autoPan = progress >= 1 ? 'bottom' : 'moving';
          table.scrollTop = maxScroll * eased;
          if (progress < 1) frame = window.requestAnimationFrame(tick);
        };

        frame = window.requestAnimationFrame(tick);
        advanceCheckTimer = window.setTimeout(() => {
          if (!disposed && document.body.contains(table)) table.dataset.autoPan = 'bottom';
        }, leadInMs + travelMs + bottomPauseMs);
      };

      // Let fixture/H2H decorators finish before measuring the available table height.
      window.setTimeout(begin, 180);
    };

    void runForCurrentSlide();
    const observer = new MutationObserver(() => {
      const slide = document.querySelector<HTMLElement>('.command-slide');
      const title = slide?.querySelector<HTMLElement>('.command-slide-title')?.textContent?.trim() ?? '';
      const kicker = slide?.querySelector<HTMLElement>('.command-slide-kicker')?.textContent?.trim() ?? '';
      const key = `${title}|${kicker}|${slide?.getAttribute('style') ?? ''}`;
      if (key !== activeSlideKey) void runForCurrentSlide();
    });
    const root = document.querySelector('.command-centre-page') ?? document.body;
    observer.observe(root, { subtree: true, childList: true });

    return () => {
      disposed = true;
      stop();
      observer.disconnect();
    };
  }, [location.pathname]);

  return null;
}
