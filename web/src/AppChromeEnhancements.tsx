import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './lib/api';
import { onBookieBallEvent } from './lib/appEvents';
import { loadCurrentGameweekSnapshot } from './lib/currentGameweekSnapshot';

type LiveFixture = { homeTeam: string | null; awayTeam: string | null; homeProfit: number; awayProfit: number };

function fixtureKey(home: string | null | undefined, away: string | null | undefined): string {
  return `${(home ?? '').trim().toLowerCase()}|${(away ?? '').trim().toLowerCase()}`;
}

function score(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : ''}${safe.toFixed(2)}`;
}

export function AppChromeEnhancements() {
  const location = useLocation();
  const [penaltyCount, setPenaltyCount] = useState(0);
  const lastWarmedRef = useRef('');

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
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    const warm = async (force = false) => {
      try {
        const state = await api.state();
        if (!active) return;
        const signature = `${state.currentSeason}:${state.currentGw}`;
        if (!force && lastWarmedRef.current === signature) return;
        lastWarmedRef.current = signature;
        await loadCurrentGameweekSnapshot();

        const teams = await api.teams().catch(() => []);
        void Promise.all([
          api.teamSeasonHistoryBulk(teams.map((team) => team.id)).catch(() => null),
          api.teamHistoryStoryBulk(teams.map((team) => team.id)).catch(() => null),
        ]);
      } catch {
        // Warm-up is best effort; normal screens still load independently.
      }
    };

    void warm();
    const offGameweek = onBookieBallEvent('gameweek-changed', () => void warm(true));
    const offMutation = onBookieBallEvent('data-mutated', () => {
      if (location.pathname === '/gameshow' || location.pathname === '/') void warm(true);
    });
    return () => {
      active = false;
      offGameweek();
      offMutation();
    };
  }, [location.pathname]);

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

  // Temporary Gameshow compatibility bridge. This can disappear as GameshowPage is split
  // into native stage components; Home no longer relies on any DOM post-processing.
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
    const timer = window.setInterval(() => void decorate(), 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [location.pathname]);

  return null;
}
