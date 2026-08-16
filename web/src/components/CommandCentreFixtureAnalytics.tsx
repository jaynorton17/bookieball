import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';

type H2H = Awaited<ReturnType<typeof api.headToHeadAllTime>>;
type FixtureView = { homeTeam: string | null; awayTeam: string | null; homeProfit: number; awayProfit: number };

function key(home: string | null | undefined, away: string | null | undefined): string {
  return `${(home ?? '').trim().toLowerCase()}|${(away ?? '').trim().toLowerCase()}`;
}

function score(value: number): string {
  return `${value > 0 ? '+' : ''}${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export function CommandCentreFixtureAnalytics() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/') return;
    let disposed = false;
    let busy = false;

    const decorate = async () => {
      if (busy || disposed) return;
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.command-slide .command-fixture'));
      if (!cards.length) return;
      busy = true;
      try {
        const state = await api.state();
        const [teams, league, master, trio, tier] = await Promise.all([
          api.teams(),
          api.leagueFixtures(state.currentGw, false).catch(() => []),
          api.masterLeagueFixtures(state.currentGw, false).catch(() => []),
          api.trioLeagueFixtures(state.currentGw, false).catch(() => []),
          api.tierLeagueFixtures(state.currentGw, false).catch(() => []),
        ]);
        if (disposed) return;

        const fixtures: FixtureView[] = [...league, ...master, ...trio, ...tier];
        const fixtureByPair = new Map(fixtures.map((fixture) => [key(fixture.homeTeam, fixture.awayTeam), fixture]));
        const teamByName = new Map(teams.map((team) => [team.name.trim().toLowerCase(), team]));
        const h2hCache = new Map<string, H2H>();

        await Promise.all(cards.map(async (card) => {
          const strongs = Array.from(card.querySelectorAll<HTMLElement>('strong'));
          if (strongs.length < 2) return;
          const home = strongs[0].textContent?.trim() ?? '';
          const away = strongs[strongs.length - 1].textContent?.trim() ?? '';
          if (!home || !away) return;

          const fixture = fixtureByPair.get(key(home, away));
          const matchup = strongs[0].parentElement;
          const middle = matchup ? Array.from(matchup.children).find((node) => node.tagName === 'SPAN') as HTMLElement | undefined : undefined;
          if (fixture && middle) {
            middle.textContent = `${score(fixture.homeProfit)}   VS   ${score(fixture.awayProfit)}`;
            middle.classList.add('command-fixture-scoreline');
          }

          const homeTeam = teamByName.get(home.toLowerCase());
          const awayTeam = teamByName.get(away.toLowerCase());
          if (!homeTeam || !awayTeam) return;

          const pairKey = key(home, away);
          let h2h = h2hCache.get(pairKey);
          if (!h2h) {
            h2h = await api.headToHeadAllTime(homeTeam.id, awayTeam.id).catch(() => null as H2H | null) ?? undefined;
            if (h2h) h2hCache.set(pairKey, h2h);
          }
          if (!h2h || disposed) return;

          let footer = card.querySelector<HTMLElement>('.command-fixture-h2h');
          if (!footer) {
            footer = document.createElement('div');
            footer.className = 'command-fixture-h2h';
            card.appendChild(footer);
          }
          footer.textContent = `ALL-TIME H2H · ${home} ${h2h.teamAWins}W ${h2h.teamBWins}L ${h2h.draws}D · ${away} ${h2h.teamBWins}W ${h2h.teamAWins}L ${h2h.draws}D`;
        }));
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
