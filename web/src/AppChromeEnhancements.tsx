import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TeamJourneyOverlay } from './components/TeamJourneyOverlay';
import { api } from './lib/api';

type LiveFixture = { homeTeam: string | null; awayTeam: string | null; homeProfit: number; awayProfit: number };

function fixtureKey(home: string | null | undefined, away: string | null | undefined): string {
  return `${(home ?? '').trim().toLowerCase()}|${(away ?? '').trim().toLowerCase()}`;
}

function score(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
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

    let journeyButton = nav.querySelector<HTMLButtonElement>('button[data-team-journey="true"]');
    if (!journeyButton) {
      journeyButton = document.createElement('button');
      journeyButton.type = 'button';
      journeyButton.dataset.teamJourney = 'true';
      journeyButton.className = 'topbar-nav-link team-journey-nav-link';
      journeyButton.textContent = 'Team Journey';
      journeyButton.addEventListener('click', () => setTeamJourneyOpen(true));
      nav.appendChild(journeyButton);
    }
  }, [location.pathname, penaltyCount]);

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
          const home = parts[0].replace(/\s+-?\d+\.\d+\s*$/,'').trim();
          const away = parts[1].replace(/^\s*-?\d+\.\d+\s*/,'').trim();
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

  return <TeamJourneyOverlay open={teamJourneyOpen} onClose={() => setTeamJourneyOpen(false)} />;
}
