import { useEffect } from 'react';
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

export function AppChromeEnhancements() {
  const location = useLocation();

  useEffect(() => {
    document.body.classList.toggle('gameshow-laptop-mode', location.pathname === '/gameshow');
    document.body.classList.toggle('command-centre-laptop-mode', location.pathname === '/');
    return () => {
      document.body.classList.remove('gameshow-laptop-mode');
      document.body.classList.remove('command-centre-laptop-mode');
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
