import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';

type TombolaBall = {
  name: string;
  initials: string;
  ballColor: string;
  ringColor: string;
  textColor: string;
};

type DrawPool = Awaited<ReturnType<typeof api.gameshowDrawPool>>;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function cssColor(element: HTMLElement | null, property: 'backgroundColor' | 'borderColor' | 'color', fallback: string): string {
  if (!element) return fallback;
  const inlineValue = property === 'backgroundColor'
    ? element.style.backgroundColor || element.style.background
    : property === 'borderColor'
      ? element.style.borderColor
      : element.style.color;
  if (inlineValue) return inlineValue;
  const computed = window.getComputedStyle(element)[property];
  return computed || fallback;
}

function ballsFromPool(groups: DrawPool): TombolaBall[] {
  const unique = new Map<number, TombolaBall>();
  groups.forEach((group) => {
    group.teams.forEach((team) => {
      if (unique.has(team.teamId)) return;
      unique.set(team.teamId, {
        name: team.teamName,
        initials: initials(team.teamName),
        ballColor: team.ballColor ?? '#5eb7ff',
        ringColor: team.ringColor ?? '#f7fbff',
        textColor: team.textColor ?? '#06101c',
      });
    });
  });
  return [...unique.values()];
}

function sourceBalls(card: HTMLElement): TombolaBall[] {
  const unique = new Map<string, TombolaBall>();
  card.querySelectorAll<HTMLElement>('.kickoff-carousel-track-item').forEach((item) => {
    const badge = item.querySelector<HTMLElement>('.team-badge');
    const name = item.querySelector('strong')?.textContent?.trim() ?? '';
    // Division/group carousel rows (for example "Championship") do not have a team badge.
    // Never turn those legacy staging labels into tombola balls.
    if (!badge || !name || /^(TBD|BYE|\.\.\.)$/i.test(name) || unique.has(name)) return;
    unique.set(name, {
      name,
      initials: badge.textContent?.trim() || initials(name),
      ballColor: cssColor(badge, 'backgroundColor', '#5eb7ff'),
      ringColor: cssColor(badge, 'borderColor', '#f7fbff'),
      textColor: cssColor(badge, 'color', '#06101c'),
    });
  });
  return [...unique.values()];
}

function deterministicPosition(index: number, total: number) {
  const cols = total >= 20 ? 6 : total >= 12 ? 5 : 4;
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = 11 + (col / Math.max(1, cols - 1)) * 78 + Math.sin(index * 1.61) * 2.7;
  const y = 10 + (row / Math.max(1, rows - 1)) * 60 + Math.cos(index * 1.27) * 2.2;
  const driftX = 24 + (index % 5) * 11;
  const driftY = 20 + (index % 7) * 8;
  const duration = 1.15 + (index % 8) * 0.08;
  return { x, y, driftX, driftY, duration, delay: index * 0.035 };
}

function createHost(card: HTMLElement, balls: TombolaBall[]): HTMLElement {
  const host = document.createElement('div');
  host.className = 'tombola-centrepiece is-loading';
  host.setAttribute('aria-live', 'polite');
  host.innerHTML = `
    <div class="tombola-centrepiece-head">
      <div>
        <span>LIVE TEAM DRAW</span>
        <strong>Every remaining team is in the tombola</strong>
      </div>
      <b><span data-tombola-count>${balls.length || '…'}</span> TEAMS REMAINING</b>
    </div>
    <div class="tombola-centrepiece-stage">
      <div class="tombola-stage-glow"></div>
      <div class="tombola-machine">
        <div class="tombola-neck"><i></i></div>
        <div class="tombola-glass">
          <div class="tombola-glass-shine"></div>
          <div class="tombola-air-streams"><i></i><i></i><i></i><i></i></div>
          <div class="tombola-ball-field"></div>
          <div class="tombola-pick-chute"><i></i></div>
        </div>
        <div class="tombola-base">
          <span></span><strong>BOOKIEBALL DRAW MACHINE</strong><span></span>
        </div>
      </div>
      <div class="tombola-status">
        <small>DRAW STATUS</small>
        <strong data-tombola-status>Loading team balls…</strong>
        <span data-tombola-detail>The draw machine is preparing the full remaining field.</span>
      </div>
    </div>
  `;

  const field = host.querySelector<HTMLElement>('.tombola-ball-field');
  balls.forEach((ball, index) => {
    const position = deterministicPosition(index, balls.length);
    const node = document.createElement('div');
    node.className = 'tombola-ball';
    node.dataset.team = ball.name;
    node.title = ball.name;
    node.textContent = ball.initials;
    node.style.setProperty('--ball-x', `${position.x}%`);
    node.style.setProperty('--ball-y', `${position.y}%`);
    node.style.setProperty('--ball-drift-x', `${position.driftX}px`);
    node.style.setProperty('--ball-drift-y', `${position.driftY}px`);
    node.style.setProperty('--ball-duration', `${position.duration}s`);
    node.style.setProperty('--ball-delay', `${position.delay}s`);
    node.style.setProperty('--ball-color', ball.ballColor);
    node.style.setProperty('--ball-ring', ball.ringColor);
    node.style.setProperty('--ball-text', ball.textColor);
    field?.appendChild(node);
  });

  card.classList.add('tombola-centrepiece-active');
  card.appendChild(host);

  window.setTimeout(() => {
    if (!host.isConnected || host.classList.contains('is-picked') || balls.length === 0) return;
    host.classList.remove('is-loading');
    host.classList.add('is-mixing');
    const status = host.querySelector<HTMLElement>('[data-tombola-status]');
    const detail = host.querySelector<HTMLElement>('[data-tombola-detail]');
    if (status) status.textContent = 'Air on — mixing every ball';
    if (detail) detail.textContent = 'All remaining teams are being blown around before the draw locks.';
  }, 1100);

  return host;
}

function syncCard(card: HTMLElement, apiBalls: TombolaBall[]): void {
  const fallbackBalls = sourceBalls(card);
  const balls = apiBalls.length > 0 ? apiBalls : fallbackBalls;
  const signature = balls.map((ball) => ball.name).join('|');

  let host = card.querySelector<HTMLElement>(':scope > .tombola-centrepiece');
  if (!host || host.dataset.signature !== signature) {
    host?.remove();
    host = createHost(card, balls);
    host.dataset.signature = signature;
  }

  const count = host.querySelector<HTMLElement>('[data-tombola-count]');
  if (count) count.textContent = balls.length > 0 ? String(balls.length) : '…';

  const validTeamNames = new Set(balls.map((ball) => ball.name));
  const lockedItem = card.querySelector<HTMLElement>('.kickoff-carousel-track-item.locked');
  const activeItem = card.querySelector<HTMLElement>('.kickoff-carousel-track-item.active');
  const lockedLabel = lockedItem?.querySelector('strong')?.textContent?.trim() ?? '';
  const activeLabel = activeItem?.querySelector('strong')?.textContent?.trim() ?? '';
  const selectedName = validTeamNames.has(lockedLabel) ? lockedLabel : '';
  const activeName = validTeamNames.has(activeLabel) ? activeLabel : '';
  const status = host.querySelector<HTMLElement>('[data-tombola-status]');
  const detail = host.querySelector<HTMLElement>('[data-tombola-detail]');

  // A legacy one-item division stage such as "Championship" is intentionally ignored.
  // The user sees the glass immediately while the underlying draw engine moves to team selection.
  if (selectedName) {
    host.classList.remove('is-loading', 'is-mixing');
    host.classList.add('is-picked');
    host.querySelectorAll<HTMLElement>('.tombola-ball').forEach((ball) => {
      ball.classList.toggle('is-winner', ball.dataset.team === selectedName);
      ball.classList.toggle('is-not-winner', ball.dataset.team !== selectedName);
    });
    if (status) status.textContent = selectedName;
    if (detail) detail.textContent = 'Selected team — draw locked.';
    return;
  }

  host.classList.remove('is-picked');
  host.querySelectorAll<HTMLElement>('.tombola-ball').forEach((ball) => {
    ball.classList.remove('is-winner', 'is-not-winner');
    ball.classList.toggle('is-current', Boolean(activeName) && ball.dataset.team === activeName);
  });

  if (balls.length > 0 && !host.classList.contains('is-loading')) {
    host.classList.add('is-mixing');
    if (status) status.textContent = 'Air on — mixing every ball';
    if (detail) detail.textContent = 'The draw is live — all remaining teams are in the glass.';
  }
}

function syncTombola(apiBalls: TombolaBall[]): void {
  document.querySelectorAll<HTMLElement>('.kickoff-carousel-card').forEach((card) => syncCard(card, apiBalls));
}

export function GameshowTombolaCentrepiece() {
  const location = useLocation();

  useLayoutEffect(() => {
    if (location.pathname !== '/gameshow') return;

    let disposed = false;
    let apiBalls: TombolaBall[] = [];
    let queued = false;

    const syncBeforePaint = () => {
      if (queued || disposed) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (!disposed) syncTombola(apiBalls);
      });
    };

    // Initial sync is deliberately synchronous inside a layout effect. This adds the
    // empty glass before the browser paints the legacy division/carousel screen.
    syncTombola(apiBalls);

    void api.gameshowDrawPool()
      .then((groups) => {
        if (disposed) return;
        apiBalls = ballsFromPool(groups);
        syncTombola(apiBalls);
      })
      .catch(() => {
        if (!disposed) syncTombola(apiBalls);
      });

    const observer = new MutationObserver(syncBeforePaint);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      disposed = true;
      observer.disconnect();
      document.querySelectorAll<HTMLElement>('.kickoff-carousel-card.tombola-centrepiece-active').forEach((card) => {
        card.classList.remove('tombola-centrepiece-active');
        card.querySelector(':scope > .tombola-centrepiece')?.remove();
      });
    };
  }, [location.pathname]);

  return null;
}
