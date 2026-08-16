import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './lib/api';

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
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const warmGameshow = async () => {
      try {
        const state = await api.state();
        if (!active) return;
        const signature = `${state.currentSeason}:${state.currentGw}`;
        if (lastWarmedRef.current === signature) return;
        lastWarmedRef.current = signature;

        await Promise.all([
          api.leagueTable().catch(() => null),
          api.leagueFixtures(undefined, true).catch(() => []),
          api.leagueMovement().catch(() => null),
          api.masterLeagueTable(state.currentGw).catch(() => null),
          api.masterLeagueFixtures(undefined, true).catch(() => []),
          api.trioLeagueTable(state.currentGw).catch(() => null),
          api.trioLeagueFixtures(undefined, true).catch(() => []),
          api.tierLeagueTable(state.currentGw).catch(() => null),
          api.tierLeagueFixtures(undefined, true).catch(() => []),
          api.teams().catch(() => []),
          api.cup().catch(() => []),
          api.superCup(state.currentSeason).catch(() => []),
          api.entries({ gw: state.currentGw, limit: 1000 }).catch(() => []),
          api.predictions(state.currentGw).catch(() => null),
          api.predictionScoreboard().catch(() => null),
          api.reportStorylines(state.currentGw).catch(() => null),
          api.allTimeLeagues().catch(() => null),
          api.lastCompletedGameweek().catch(() => null),
          api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
          api.studioDeskPrompt().catch(() => null),
        ]);
      } catch {
        // Warm-up is best effort only; the Gameshow still loads normally if anything fails.
      }
    };

    void warmGameshow();
    const timer = window.setInterval(() => void warmGameshow(), 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('gameshow-laptop-mode', location.pathname === '/gameshow');
    return () => document.body.classList.remove('gameshow-laptop-mode');
  }, [location.pathname]);

  useEffect(() => {
    const nav = document.querySelector('.topbar-nav');
    if (!nav) return;

    let link = nav.querySelector<HTMLAnchorElement>('a[data-penalties-nav="true"]');
    if (!link) {
      link = document.createElement('a');
      link.href = '/penalty-shootout';
      link.dataset.penaltiesNav = 'true';
      link.className = 'topbar-nav-link penalties-nav-link';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        window.history.pushState({}, '', '/penalty-shootout');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      nav.appendChild(link);
    }

    link.textContent = penaltyCount > 0 ? `Penalties (${penaltyCount})` : 'Penalties';
    link.classList.toggle('active', location.pathname === '/penalty-shootout');
    link.classList.toggle('penalties-live', penaltyCount > 0);
  }, [location.pathname, penaltyCount]);

  return null;
}
