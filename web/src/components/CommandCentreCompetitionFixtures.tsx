import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';

type FixtureView = {
  id: number;
  homeTeam: string | null;
  awayTeam: string | null;
  homeProfit: number;
  awayProfit: number;
  result: 'home' | 'away' | 'draw' | 'pending';
};

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

function fixtureHtml(fixture: FixtureView): string {
  const home = fixture.homeTeam ?? 'TBC';
  const away = fixture.awayTeam ?? 'TBC';
  const status = fixture.result === 'pending'
    ? 'TO PLAY'
    : fixture.result === 'draw'
      ? 'DRAW'
      : fixture.result === 'home'
        ? `${home} WIN`
        : `${away} WIN`;
  return `<div class="command-fixture${fixture.result === 'pending' ? ' is-pending' : ''}" data-generated-competition-fixture="true" style="padding:9px 11px 9px 14px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:5px"><span style="color:${fixture.result === 'pending' ? '#f2c14e' : '#91a8bd'};font-size:9px;font-weight:900;letter-spacing:.1em">${status}</span></div>
    <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:7px;font-size:13px"><strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${home}</strong><span class="command-fixture-scoreline">${signed(fixture.homeProfit)} &nbsp; VS &nbsp; ${signed(fixture.awayProfit)}</span><strong style="text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${away}</strong></div>
  </div>`;
}

export function CommandCentreCompetitionFixtures() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/') return;
    let disposed = false;
    let busy = false;

    const decorate = async () => {
      if (busy || disposed) return;
      const slide = document.querySelector<HTMLElement>('.command-slide');
      const body = slide?.querySelector<HTMLElement>('.command-slide-body');
      const table = body?.querySelector<HTMLElement>(':scope > .command-table');
      const title = slide?.querySelector<HTMLElement>('.command-slide-title')?.textContent?.trim() ?? '';
      const kicker = slide?.querySelector<HTMLElement>('.command-slide-kicker')?.textContent?.trim() ?? '';
      if (!slide || !body || !table) return;
      if (body.querySelector('[data-competition-fixtures-panel="true"]')) return;
      const isMaster = title === 'Master League';
      const isTrio = kicker === 'TRIO LEAGUE';
      const isTier = kicker === 'TIER LEAGUE';
      if (!isMaster && !isTrio && !isTier) return;

      busy = true;
      try {
        const state = await api.state();
        let fixtures: FixtureView[] = [];
        if (isMaster) {
          fixtures = (await api.masterLeagueFixtures(state.currentGw, false).catch(() => [])).map((row) => ({ ...row }));
        } else if (isTrio) {
          const rows = await api.trioLeagueFixtures(state.currentGw, false).catch(() => []);
          fixtures = rows.filter((row) => displayDivisionName(row.division) === title).map((row) => ({ ...row }));
        } else {
          const rows = await api.tierLeagueFixtures(state.currentGw, false).catch(() => []);
          fixtures = rows.filter((row) => (
            displayDivisionName(row.division) === title
            || displayDivisionName(row.homeDivision ?? '') === title
            || displayDivisionName(row.awayDivision ?? '') === title
          )).map((row) => ({ ...row }));
        }
        if (disposed || fixtures.length === 0 || !document.body.contains(table)) return;

        const layout = document.createElement('div');
        layout.className = 'command-division-layout command-competition-layout';
        const fixturePanel = document.createElement('div');
        fixturePanel.className = 'command-fixtures';
        fixturePanel.dataset.competitionFixturesPanel = 'true';
        fixturePanel.innerHTML = `<div class="command-section-label"><span>${state.currentGw} FIXTURES</span><span>${fixtures.length} games</span></div>${fixtures.map(fixtureHtml).join('')}`;

        body.insertBefore(layout, table);
        layout.appendChild(table);
        layout.appendChild(fixturePanel);
        table.style.maxWidth = 'none';
        table.style.width = '100%';
        table.style.justifySelf = 'stretch';
        table.style.alignContent = 'start';
        table.dataset.autoPanStarted = 'false';
        table.dataset.autoPanRecalc = 'true';
        window.dispatchEvent(new CustomEvent('bookieball:command-layout-changed'));
      } finally {
        busy = false;
      }
    };

    void decorate();
    const observer = new MutationObserver(() => void decorate());
    observer.observe(document.querySelector('.command-centre-page') ?? document.body, { subtree: true, childList: true });
    return () => { disposed = true; observer.disconnect(); };
  }, [location.pathname]);

  return null;
}
