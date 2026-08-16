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
    let startTimer = 0;
    let settleTimer = 0;

    const clearTimers = () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(settleTimer);
    };

    const prepare = async () => {
      clearTimers();
      const slide = document.querySelector<HTMLElement>('.command-slide');
      const title = document.querySelector<HTMLElement>('.command-slide-title')?.textContent?.trim() ?? '';
      const table = slide?.querySelector<HTMLElement>('.command-table');
      if (!slide || !table) return;

      if (title === 'Master League' && table.dataset.fullMaster !== 'true') {
        try {
          const payload = await api.masterLeagueTable();
          if (disposed || !payload.table.length) return;
          const rows = payload.table.slice().sort((a, b) => a.rank - b.rank);
          table.innerHTML = rows.map(masterRowHtml).join('');
          table.dataset.fullMaster = 'true';
        } catch {
          // Leave the existing rows in place if the full table cannot be loaded.
        }
      }

      if (disposed) return;
      table.classList.add('command-auto-pan-window');
      table.scrollTop = 0;
      table.dataset.autoPan = 'top';

      requestAnimationFrame(() => {
        if (disposed) return;
        const overflow = table.scrollHeight - table.clientHeight;
        if (overflow <= 10) {
          table.dataset.autoPan = 'static';
          return;
        }

        startTimer = window.setTimeout(() => {
          if (disposed || !document.body.contains(table)) return;
          table.dataset.autoPan = 'moving';
          table.scrollTo({ top: table.scrollHeight - table.clientHeight, behavior: 'smooth' });
          settleTimer = window.setTimeout(() => {
            if (disposed || !document.body.contains(table)) return;
            table.dataset.autoPan = 'bottom';
          }, 5200);
        }, 1800);
      });
    };

    void prepare();
    const observer = new MutationObserver(() => void prepare());
    const root = document.querySelector('.command-centre-page') ?? document.body;
    observer.observe(root, { subtree: true, childList: true });

    return () => {
      disposed = true;
      clearTimers();
      observer.disconnect();
    };
  }, [location.pathname]);

  return null;
}
