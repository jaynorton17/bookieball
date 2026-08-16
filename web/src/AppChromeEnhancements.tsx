import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CommandCentreAutoPan } from './components/CommandCentreAutoPan';
import { TeamJourneyOverlay } from './components/TeamJourneyOverlay';
import { api } from './lib/api';

type LiveFixture = { homeTeam: string | null; awayTeam: string | null; homeProfit: number; awayProfit: number };
type H2H = Awaited<ReturnType<typeof api.headToHeadAllTime>>;

function fixtureKey(home: string | null | undefined, away: string | null | undefined): string {
  return `${(home ?? '').trim().toLowerCase()}|${(away ?? '').trim().toLowerCase()}`;
}

function score(value: number): string {
  return `${value > 0 ? '+' : ''}${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

function groupedBoardHtml(groups: Array<{ division: string; rows: Array<{ rank: number; teamName: string; points: number; wins: number; draws: number; losses: number; profit: number }> }>): string {
  return `<div class="command-group-board">${groups.map((group) => `<section class="command-group-card"><div class="command-group-title">${group.division}</div>${group.rows.slice(0, 5).map((row) => `<div class="command-group-row"><span class="command-group-rank">#${row.rank}</span><strong>${row.teamName}</strong><span>${row.points} pts</span><small>${row.wins}W ${row.draws}D ${row.losses}L · ${row.profit > 0 ? '+' : ''}${row.profit.toFixed(2)}</small></div>`).join('')}</section>`).join('')}</div>`;
}

export function AppChromeEnhancements() {
  const location = useLocation();
  const [penaltyCount, setPenaltyCount] = useState(0);
  const [teamJourneyOpen, setTeamJourneyOpen] = useState(false);
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
    const warmGameshow = async () => {
      try {
        const state = await api.state();
        if (!active) return;
        const signature = `${state.currentSeason}:${state.currentGw}`;
        if (lastWarmedRef.current === signature) return;
        lastWarmedRef.current = signature;

        const teams = await api.teams().catch(() => []);
        await Promise.all([
          api.leagueTable().catch(() => null),
          api.leagueFixtures(undefined, true).catch(() => []),
          api.leagueMovement().catch(() => null),
          api.masterLeagueTable(state.currentGw).catch(() => null),
          api.masterLeagueFixtures(undefined, true).catch(() => []),
          api.masterCupFixtures(undefined, true).catch(() => []),
          api.trioLeagueTable(state.currentGw).catch(() => null),
          api.trioLeagueFixtures(undefined, true).catch(() => []),
          api.tierLeagueTable(state.currentGw).catch(() => null),
          api.tierLeagueFixtures(undefined, true).catch(() => []),
          api.cup().catch(() => []),
          api.superCup(state.currentSeason).catch(() => []),
          api.entries({ gw: state.currentGw, limit: 1000 }).catch(() => []),
          api.entries({ limit: 2000 }).catch(() => []),
          api.predictions(state.currentGw).catch(() => null),
          api.predictionScoreboard().catch(() => null),
          api.reportStorylines(state.currentGw).catch(() => null),
          api.allTimeLeagues().catch(() => null),
          api.lastCompletedGameweek().catch(() => null),
          api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
          api.studioDeskPrompt().catch(() => null),
          api.teamSeasonHistoryBulk(teams.map((team) => team.id)).catch(() => null),
          api.teamHistoryStoryBulk(teams.map((team) => team.id)).catch(() => null),
        ]);

        const currentSeasonNumber = Number(state.currentSeason.replace('S', '')) || 1;
        const archiveSeasons = Array.from({ length: Math.max(0, currentSeasonNumber - 1) }, (_, index) => `S${index + 1}`);
        void Promise.all(archiveSeasons.flatMap((season) => [
          api.leagueFixtures(undefined, true, season).catch(() => []),
          api.cup(undefined, season).catch(() => []),
          ...['GW1','GW2','GW3','GW4','GW5','GW6','GW7','GW8'].map((gw) => api.predictions(gw, season).catch(() => null)),
        ]));
      } catch {
        // Best-effort warm-up. The Show can still load normally.
      }
    };
    void warmGameshow();
    const timer = window.setInterval(() => void warmGameshow(), 2000);
    return () => { active = false; window.clearInterval(timer); };
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

    const oldJourneyButton = nav.querySelector('button[data-team-journey="true"]');
    oldJourneyButton?.remove();

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
    if (location.pathname !== '/') return;
    const attachJourneyButton = () => {
      const controls = document.querySelector<HTMLElement>('.command-centre-header .command-controls');
      if (!controls || controls.querySelector('[data-home-team-journey="true"]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.homeTeamJourney = 'true';
      button.className = 'command-nav-btn command-team-journey-btn';
      button.textContent = 'Team Journey';
      button.addEventListener('click', () => setTeamJourneyOpen(true));
      controls.prepend(button);
    };
    attachJourneyButton();
    const observer = new MutationObserver(attachJourneyButton);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/gameshow') return;
    let active = true;
    const decorateFixtureScores = async () => {
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
          const home = parts[0].replace(/\s+[+-]?\d+\.\d+\s*$/,'').trim();
          const away = parts[1].replace(/^\s*[+-]?\d+\.\d+\s*/,'').trim();
          const fixture = byPair.get(fixtureKey(home, away));
          if (!fixture) return;
          element.textContent = `${home}  ${score(fixture.homeProfit)}   VS   ${score(fixture.awayProfit)}  ${away}`;
        });
      } catch {
        // Visual enhancement only.
      }
    };
    void decorateFixtureScores();
    const timer = window.setInterval(() => void decorateFixtureScores(), 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/') return;
    let disposed = false;
    let decorating = false;

    const decorateHomeFixtures = async () => {
      if (decorating) return;
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.command-slide .command-fixture'));
      if (!cards.length) return;
      decorating = true;
      try {
        const [state, teams, fixtures] = await Promise.all([
          api.state(),
          api.teams(),
          api.leagueFixtures(undefined, true),
        ]);
        if (disposed) return;
        const current = fixtures.filter((fixture) => fixture.gw === state.currentGw);
        const fixtureMap = new Map(current.map((fixture) => [fixtureKey(fixture.homeTeam, fixture.awayTeam), fixture]));
        const teamMap = new Map(teams.map((team) => [team.name.trim().toLowerCase(), team]));
        const h2hMap = new Map<string, H2H>();

        await Promise.all(cards.map(async (card) => {
          const names = Array.from(card.querySelectorAll<HTMLElement>('strong'));
          if (names.length < 2) return;
          const home = names[0].textContent?.trim() ?? '';
          const away = names[names.length - 1].textContent?.trim() ?? '';
          const fixture = fixtureMap.get(fixtureKey(home, away));
          if (!fixture) return;

          const matchup = names[0].parentElement;
          if (matchup) {
            const middle = Array.from(matchup.children).find((child) => child.tagName === 'SPAN') as HTMLElement | undefined;
            if (middle) {
              middle.textContent = `${score(fixture.homeProfit)}   VS   ${score(fixture.awayProfit)}`;
              middle.classList.add('command-fixture-scoreline');
            }
          }

          const homeTeam = teamMap.get(home.toLowerCase());
          const awayTeam = teamMap.get(away.toLowerCase());
          if (!homeTeam || !awayTeam) return;
          const key = fixtureKey(home, away);
          let record = h2hMap.get(key);
          if (!record) {
            record = await api.headToHeadAllTime(homeTeam.id, awayTeam.id).catch(() => null as H2H | null) ?? undefined;
            if (record) h2hMap.set(key, record);
          }
          if (!record || disposed) return;

          let footer = card.querySelector<HTMLElement>('.command-fixture-h2h');
          if (!footer) {
            footer = document.createElement('div');
            footer.className = 'command-fixture-h2h';
            card.appendChild(footer);
          }
          footer.textContent = `ALL-TIME H2H  ·  ${home} ${record.teamAWins}W ${record.teamBWins}L ${record.draws}D  ·  ${away} ${record.teamBWins}W ${record.teamAWins}L ${record.draws}D`;
        }));
      } catch {
        // Leave fixture cards untouched if analytics are temporarily unavailable.
      } finally {
        decorating = false;
      }
    };

    void decorateHomeFixtures();
    const observer = new MutationObserver(() => void decorateHomeFixtures());
    observer.observe(document.body, { subtree: true, childList: true });
    return () => { disposed = true; observer.disconnect(); };
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/') return;
    let disposed = false;
    const decorate = async () => {
      const title = document.querySelector<HTMLElement>('.command-slide-title')?.textContent?.trim();
      if (title !== 'Trio League' && title !== 'Tier League') return;
      const table = document.querySelector<HTMLElement>('.command-slide .command-table');
      if (!table || table.dataset.groupedCompetition === title) return;
      try {
        const payload = title === 'Trio League' ? await api.trioLeagueTable() : await api.tierLeagueTable();
        if (disposed || !payload.table.length) return;
        const divisions = Array.from(new Set(payload.table.map((row) => row.division)));
        const groups = divisions.map((division) => ({
          division,
          rows: payload.table.filter((row) => row.division === division).slice().sort((a, b) => a.rank - b.rank),
        }));
        table.dataset.groupedCompetition = title;
        table.innerHTML = groupedBoardHtml(groups);
      } catch {
        // Keep the normal slide if the grouped view cannot be built.
      }
    };
    void decorate();
    const observer = new MutationObserver(() => void decorate());
    observer.observe(document.body, { subtree: true, childList: true });
    return () => { disposed = true; observer.disconnect(); };
  }, [location.pathname]);

  return <><CommandCentreAutoPan /><TeamJourneyOverlay open={teamJourneyOpen} onClose={() => setTeamJourneyOpen(false)} /></>;
}
