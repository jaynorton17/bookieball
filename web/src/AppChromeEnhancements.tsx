import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './lib/api';
import { onBookieBallEvent } from './lib/appEvents';
import { loadCurrentGameweekSnapshot } from './lib/currentGameweekSnapshot';

type LiveFixture = { homeTeam: string | null; awayTeam: string | null; homeProfit: number; awayProfit: number };

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];

function fixtureKey(home: string | null | undefined, away: string | null | undefined): string {
  return `${(home ?? '').trim().toLowerCase()}|${(away ?? '').trim().toLowerCase()}`;
}

function score(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : ''}${safe.toFixed(2)}`;
}

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function deterministicBallPosition(index: number, total: number): { left: number; bottom: number; delay: number } {
  const columns = Math.max(5, Math.min(8, Math.ceil(Math.sqrt(total * 1.6))));
  const row = Math.floor(index / columns);
  const column = index % columns;
  const rows = Math.max(1, Math.ceil(total / columns));
  const left = 10 + (column / Math.max(1, columns - 1)) * 80 + Math.sin(index * 1.71) * 2.4;
  const bottom = 8 + (row / Math.max(1, rows - 1)) * 48 + Math.cos(index * 1.23) * 2.5;
  return { left, bottom, delay: (index % 11) * -0.17 };
}

async function warmGameshowRoute(): Promise<void> {
  const state = await api.state();
  const seasonNumber = Number(state.currentSeason.replace(/^S/i, '')) || 1;
  const seasonFiveOrLater = seasonNumber >= 5;
  const seasonSixOrLater = seasonNumber >= 6;

  const [teams] = await Promise.all([
    api.teams().catch(() => []),
    api.leagueTable().catch(() => null),
    api.leagueFixtures(undefined, true).catch(() => []),
    api.leagueMovement().catch(() => null),
    api.masterLeagueTable(state.currentGw).catch(() => null),
    api.masterLeagueFixtures(undefined, true).catch(() => []),
    seasonFiveOrLater ? api.masterCupFixtures(undefined, true).catch(() => []) : Promise.resolve([]),
    api.trioLeagueTable(state.currentGw).catch(() => null),
    api.trioLeagueFixtures(undefined, true).catch(() => []),
    seasonSixOrLater ? api.tierLeagueTable(state.currentGw).catch(() => null) : Promise.resolve(null),
    seasonSixOrLater ? api.tierLeagueFixtures(undefined, true).catch(() => []) : Promise.resolve([]),
    api.cup().catch(() => []),
    api.superCup(state.currentSeason).catch(() => []),
    api.entries({ limit: 2000 }).catch(() => []),
    api.entries({ gw: state.currentGw, limit: 1000 }).catch(() => []),
    api.predictions(state.currentGw).catch(() => null),
    api.predictionScoreboard().catch(() => null),
    api.predictionScoreboard('S1').catch(() => null),
    api.seasonFinale().catch(() => null),
    ...GAMEWEEKS.map((gw) => api.predictions(gw).catch(() => null)),
    api.reportStorylines(state.currentGw).catch(() => null),
    api.allTimeLeagues().catch(() => null),
    api.lastCompletedGameweek().catch(() => null),
    api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
  ]);

  if (!teams.length) return;

  const history = await api.teamSeasonHistoryBulk(teams.map((team) => team.id)).catch(() => null);
  void api.teamHistoryStoryBulk(teams.map((team) => team.id)).catch(() => null);
  if (!history) return;

  const seasons = Array.from(new Set(
    Object.values(history.histories)
      .flat()
      .map((row) => row.season)
      .filter((season) => /^S\d+$/.test(season)),
  ));
  if (!seasons.includes(state.currentSeason)) seasons.push(state.currentSeason);

  void Promise.all(seasons.flatMap((season) => [
    api.leagueFixtures(undefined, true, season).catch(() => []),
    api.cup(undefined, season).catch(() => []),
    ...GAMEWEEKS.map((gw) => api.predictions(gw, season).catch(() => null)),
  ])).catch(() => undefined);
}

function ensureGameshowCylinder(): void {
  document.querySelectorAll<HTMLElement>('.kickoff-carousel-card').forEach((card) => {
    const nativeItems = Array.from(card.querySelectorAll<HTMLElement>('.kickoff-carousel-track-item'));

    if (nativeItems.length === 1) {
      card.classList.add('gameshow-all-team-prep');
      const chip = card.querySelector<HTMLElement>('.news-chip');
      const title = card.querySelector<HTMLElement>('.kickoff-wheel-card-head h3');
      const subtitle = card.querySelector<HTMLElement>('.kickoff-wheel-card-head p');
      if (chip) chip.textContent = 'ALL-TEAM DRAW';
      if (title) title.textContent = 'Loading Team Balls';
      if (subtitle) subtitle.textContent = 'Every eligible team enters the same cylinder.';
      return;
    }

    if (nativeItems.length < 8) return;
    const shell = card.querySelector<HTMLElement>('.kickoff-carousel-shell');
    if (!shell) return;

    let cylinder = shell.querySelector<HTMLElement>('.gameshow-ball-cylinder');
    if (!cylinder) {
      cylinder = document.createElement('div');
      cylinder.className = 'gameshow-ball-cylinder';
      cylinder.innerHTML = `
        <div class="gameshow-cylinder-title"><span>LIVE TEAM DRAW</span><strong>All eligible balls are in</strong></div>
        <div class="gameshow-cylinder-machine">
          <div class="gameshow-cylinder-glass">
            <div class="gameshow-cylinder-balls"></div>
            <div class="gameshow-cylinder-neck"></div>
          </div>
          <div class="gameshow-cylinder-plunger"><span></span></div>
          <div class="gameshow-cylinder-picked"><small>SELECTED</small><strong>Mixing…</strong></div>
        </div>
      `;
      shell.appendChild(cylinder);
      card.classList.add('gameshow-cylinder-enhanced');
    }

    const ballsHost = cylinder.querySelector<HTMLElement>('.gameshow-cylinder-balls');
    if (!ballsHost) return;
    const labels = nativeItems.map((item) => item.querySelector('strong')?.textContent?.trim() ?? '').filter(Boolean);
    const signature = labels.join('|');
    if (ballsHost.dataset.signature !== signature) {
      ballsHost.dataset.signature = signature;
      ballsHost.replaceChildren();
      nativeItems.forEach((item, index) => {
        const name = item.querySelector('strong')?.textContent?.trim() ?? `Team ${index + 1}`;
        const sourceBadge = item.querySelector<HTMLElement>('.team-badge');
        const position = deterministicBallPosition(index, nativeItems.length);
        const ball = document.createElement('div');
        ball.className = 'gameshow-cylinder-ball';
        ball.dataset.team = name;
        ball.textContent = sourceBadge?.textContent?.trim() || teamInitials(name);
        ball.title = name;
        ball.style.setProperty('--ball-left', `${position.left}%`);
        ball.style.setProperty('--ball-bottom', `${position.bottom}%`);
        ball.style.setProperty('--ball-delay', `${position.delay}s`);
        ball.style.setProperty('--ball-color', sourceBadge?.style.background || '#5eb7ff');
        ball.style.setProperty('--ball-ring', sourceBadge?.style.borderColor || '#ffffff');
        ball.style.setProperty('--ball-text', sourceBadge?.style.color || '#07111d');
        ballsHost.appendChild(ball);
      });
    }

    const activeItem = card.querySelector<HTMLElement>('.kickoff-carousel-track-item.active');
    const lockedItem = card.querySelector<HTMLElement>('.kickoff-carousel-track-item.locked');
    const activeName = (lockedItem ?? activeItem)?.querySelector('strong')?.textContent?.trim() ?? '';
    const isLocked = Boolean(lockedItem);
    const picked = cylinder.querySelector<HTMLElement>('.gameshow-cylinder-picked strong');
    if (picked) picked.textContent = isLocked && activeName ? activeName : 'Mixing…';
    cylinder.classList.toggle('is-picking', Boolean(activeName) && !isLocked);
    cylinder.classList.toggle('is-locked', isLocked);
    cylinder.querySelectorAll<HTMLElement>('.gameshow-cylinder-ball').forEach((ball) => {
      const matches = ball.dataset.team === activeName;
      ball.classList.toggle('is-active', matches && !isLocked);
      ball.classList.toggle('is-picked', matches && isLocked);
    });
  });
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

        if (location.pathname === '/gameshow') {
          void warmGameshowRoute();
          return;
        }

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

  useEffect(() => {
    if (location.pathname !== '/gameshow') return;
    ensureGameshowCylinder();
    const timer = window.setInterval(ensureGameshowCylinder, 90);
    return () => window.clearInterval(timer);
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
    const timer = window.setInterval(() => void decorate(), 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [location.pathname]);

  return null;
}
