import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './lib/api';
import { onBookieBallEvent } from './lib/appEvents';

type LiveFixture = { homeTeam: string | null; awayTeam: string | null; homeProfit: number; awayProfit: number };

function fixtureKey(home: string | null | undefined, away: string | null | undefined): string {
  return `${(home ?? '').trim().toLowerCase()}|${(away ?? '').trim().toLowerCase()}`;
}

function score(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : ''}${safe.toFixed(2)}`;
}

function simplifyGameshowShell(currentSeason?: string, currentGw?: string): void {
  const gameshow = document.querySelector<HTMLElement>('.gameshow-page');
  if (!gameshow) return;

  const hero = gameshow.querySelector<HTMLElement>(':scope > .hub-showcase');
  if (hero) hero.classList.add('gameshow-hidden-intro');

  if (currentSeason && currentGw) {
    const replacement = `${currentSeason} ${currentGw}`;
    gameshow.querySelectorAll<HTMLElement>('span, strong, small, p').forEach((el) => {
      if (el.childElementCount !== 0) return;
      const text = el.textContent?.trim() ?? '';
      if (/^S\d+\s+GW\d+$/i.test(text) && text !== replacement) el.textContent = replacement;
    });
  }
}

export function AppChromeEnhancements() {
  const location = useLocation();
  const [penaltyCount, setPenaltyCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const queue = await api.penaltyQueue();
        if (active) setPenaltyCount(queue.length);
      } catch {
        if (active) setPenaltyCount(0);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const offMutation = onBookieBallEvent('data-mutated', () => void refresh());
    const offGameweek = onBookieBallEvent('gameweek-changed', () => void refresh());
    return () => {
      active = false;
      window.clearInterval(timer);
      offMutation();
      offGameweek();
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('gameshow-laptop-mode', location.pathname === '/gameshow');
    document.body.classList.toggle('command-centre-laptop-mode', location.pathname === '/');
    return () => {
      document.body.classList.remove('gameshow-laptop-mode');
      document.body.classList.remove('command-centre-laptop-mode');
    };
  }, [location.pathname]);

  useEffect(() => {
    const nav = document.querySelector('.topbar-nav');
    if (!nav) return;
    let penaltyLink = nav.querySelector<HTMLAnchorElement>('a[data-penalties-nav="true"]');
    if (!penaltyLink) {
      penaltyLink = document.createElement('a');
      penaltyLink.href = '/penalty-shootout';
      penaltyLink.dataset.penaltiesNav = 'true';
      penaltyLink.className = 'topbar-nav-link penalties-nav-link';
      penaltyLink.addEventListener('click', (event) => {
        event.preventDefault();
        window.history.pushState({}, '', '/penalty-shootout');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      nav.appendChild(penaltyLink);
    }
    penaltyLink.textContent = penaltyCount > 0 ? `Penalties (${penaltyCount})` : 'Penalties';
    penaltyLink.classList.toggle('active', location.pathname === '/penalty-shootout');
    penaltyLink.classList.toggle('penalties-live', penaltyCount > 0);
  }, [location.pathname, penaltyCount]);

  useEffect(() => {
    if (location.pathname !== '/gameshow') return;
    let active = true;
    let season = '';
    let gw = '';
    let queued = false;

    const apply = () => {
      queued = false;
      if (active) simplifyGameshowShell(season, gw);
    };
    const queueApply = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(apply);
    };

    void api.state().then((state) => {
      if (!active) return;
      season = state.currentSeason;
      gw = state.currentGw;
      queueApply();
    }).catch(() => undefined);

    queueApply();
    const observer = new MutationObserver(queueApply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/gameshow') return;
    let active = true;

    const decorate = async () => {
      try {
        const state = await api.state();
        const [league, master, trio, tier, cup, masterCup, superCup] = await Promise.all([
          api.leagueFixtures(state.currentGw, false).catch(() => []),
          api.masterLeagueFixtures(state.currentGw, false).catch(() => []),
          api.trioLeagueFixtures(state.currentGw, false).catch(() => []),
          api.tierLeagueFixtures(state.currentGw, false).catch(() => []),
          api.cup(state.currentGw).catch(() => []),
          api.masterCupFixtures(state.currentGw, false).catch(() => []),
          api.superCup(state.currentSeason).catch(() => []),
        ]);
        if (!active) return;

        const fixtures: LiveFixture[] = [
          ...league,
          ...master,
          ...trio,
          ...tier,
          ...cup.map((fixture) => ({ homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit })),
          ...masterCup.map((fixture) => ({ homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit })),
          ...superCup.filter((fixture) => fixture.gw === state.currentGw),
        ];
        const byPair = new Map(fixtures.map((fixture) => [fixtureKey(fixture.homeTeam, fixture.awayTeam), fixture]));
        document.querySelectorAll<HTMLElement>('.kickoff-simple-fixture strong').forEach((element) => {
          const text = element.textContent ?? '';
          const parts = text.split(/\s+vs\s+/i);
          if (parts.length !== 2) return;
          const home = parts[0].replace(/\s+[+-]?\d+\.\d+\s*$/, '').trim();
          const away = parts[1].replace(/^\s*[+-]?\d+\.\d+\s*/, '').trim();
          const fixture = byPair.get(fixtureKey(home, away));
          if (!fixture) return;
          element.textContent = `${home}  ${score(fixture.homeProfit)}   VS   ${score(fixture.awayProfit)}  ${away}`;
        });
      } catch {
        // Presentation-only compatibility path.
      }
    };

    void decorate();
    const offMutation = onBookieBallEvent('data-mutated', () => void decorate());
    const offGameweek = onBookieBallEvent('gameweek-changed', () => void decorate());
    return () => {
      active = false;
      offMutation();
      offGameweek();
    };
  }, [location.pathname]);

  return null;
}
