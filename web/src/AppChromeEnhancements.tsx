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
  const all = Array.from(document.querySelectorAll<HTMLElement>('body *'));
  const heroTitle = all.find((el) => el.childElementCount === 0 && el.textContent?.trim() === 'THE KICK-OFF SHOW');
  const heroSection = heroTitle?.closest<HTMLElement>('section') ?? heroTitle?.parentElement?.parentElement?.parentElement ?? null;
  if (heroSection) heroSection.classList.add('gameshow-hidden-intro');

  const stepCards = all.filter((el) => /^STEP\s+[1-4]\s*•/i.test(el.textContent?.trim() ?? '') && el.childElementCount <= 6);
  stepCards.forEach((card) => card.closest<HTMLElement>('button, section, article, div')?.classList.add('gameshow-stage-control'));

  const resultHeading = all.find((el) => /^Step 1\s*•\s*Prediction Results/i.test(el.textContent?.trim() ?? ''));
  const activeStage = resultHeading?.closest<HTMLElement>('section, article') ?? null;
  if (activeStage) activeStage.classList.add('gameshow-active-stage-scroll');

  if (currentSeason && currentGw) {
    const replacement = `${currentSeason} ${currentGw}`;
    all.forEach((el) => {
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
