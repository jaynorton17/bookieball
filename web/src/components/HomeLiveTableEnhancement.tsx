import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { onBookieBallEvent } from '../lib/appEvents';

type LiveStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
};

type StatsLookup = {
  division: Map<string, LiveStats>;
  master: Map<string, LiveStats>;
  trio: Map<string, LiveStats>;
  tier: Map<string, LiveStats>;
};

const TABLE_SELECTOR = '.command-centre-v2 .command-table-native';

function key(name: string): string {
  return name.trim().toLowerCase();
}

function formatProfit(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : ''}${safe.toFixed(2)}`;
}

function makeCell(label: string, value: string, className?: string): HTMLSpanElement {
  const cell = document.createElement('span');
  if (className) cell.className = className;
  cell.dataset.label = label;
  cell.textContent = value;
  return cell;
}

function ensureHeader(table: HTMLElement) {
  if (table.querySelector(':scope > .home-live-table-header')) return;
  const header = document.createElement('div');
  header.className = 'home-live-table-header';
  const spacer = document.createElement('span');
  spacer.className = 'home-live-table-header-spacer';
  header.append(
    spacer,
    makeCell('Team', 'TEAM'),
    makeCell('Played', 'P'),
    makeCell('Won', 'W'),
    makeCell('Drew', 'D'),
    makeCell('Lost', 'L'),
    makeCell('Points', 'PTS'),
    makeCell('Profit', 'PROFIT'),
  );
  table.prepend(header);
}

function enhanceRow(row: HTMLElement, stats: LiveStats) {
  const profit = formatProfit(stats.profit);
  const signature = `${stats.played}|${stats.wins}|${stats.draws}|${stats.losses}|${stats.points}|${profit}`;
  if (row.dataset.homeTableStats === signature) return;
  row.dataset.homeTableStats = signature;
  row.classList.add('home-live-table-row');

  let statsNode = row.querySelector<HTMLElement>(':scope > .home-live-table-stats');
  if (!statsNode) {
    statsNode = document.createElement('div');
    statsNode.className = 'home-live-table-stats';
    row.append(statsNode);
  }
  statsNode.replaceChildren(
    makeCell('Played', String(stats.played)),
    makeCell('Won', String(stats.wins)),
    makeCell('Drew', String(stats.draws)),
    makeCell('Lost', String(stats.losses)),
    makeCell('Points', String(stats.points), 'is-points'),
    makeCell('Profit', profit, stats.profit > 0 ? 'is-positive' : stats.profit < 0 ? 'is-negative' : ''),
  );
}

function mapRows<T extends { teamName: string; played: number; wins: number; draws: number; losses: number; points: number; profit: number }>(rows: T[]): Map<string, LiveStats> {
  return new Map(rows.map((row) => [key(row.teamName), {
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    points: row.points,
    profit: row.profit,
  }]));
}

async function loadStats(): Promise<StatsLookup> {
  const state = await api.state();
  const [league, master, trio, tier] = await Promise.all([
    api.leagueTable(),
    api.masterLeagueTable(state.currentGw).catch(() => null),
    api.trioLeagueTable(state.currentGw).catch(() => null),
    api.tierLeagueTable(state.currentGw).catch(() => null),
  ]);

  return {
    division: mapRows(Object.values(league).flat()),
    master: mapRows(master?.table ?? []),
    trio: mapRows(trio?.table ?? []),
    tier: mapRows(tier?.table ?? []),
  };
}

function lookupForSlide(slide: HTMLElement, lookups: StatsLookup): Map<string, LiveStats> | null {
  const kicker = slide.querySelector<HTMLElement>('.command-slide-kicker')?.textContent?.trim().toUpperCase() ?? '';
  if (kicker === 'DIVISION') return lookups.division;
  if (kicker === 'MASTER LEAGUE') return lookups.master;
  if (kicker === 'TRIO LEAGUE') return lookups.trio;
  if (kicker === 'TIER LEAGUE') return lookups.tier;
  return null;
}

function enhanceTables(lookups: StatsLookup | null) {
  if (!lookups) return;
  document.querySelectorAll<HTMLElement>(TABLE_SELECTOR).forEach((table) => {
    const slide = table.closest<HTMLElement>('.command-slide');
    if (!slide) return;
    const lookup = lookupForSlide(slide, lookups);
    if (!lookup) return;

    const rows = [...table.querySelectorAll<HTMLElement>(':scope > .command-row')];
    let enhanced = 0;
    rows.forEach((row) => {
      const teamName = row.querySelector<HTMLElement>('.command-row-team strong')?.textContent?.trim() ?? '';
      const stats = lookup.get(key(teamName));
      if (!stats) return;
      enhanceRow(row, stats);
      enhanced += 1;
    });

    if (enhanced > 0) {
      table.classList.add('home-live-table-detailed');
      ensureHeader(table);
    }
  });
}

export function HomeLiveTableEnhancement() {
  const location = useLocation();
  const statsRef = useRef<StatsLookup | null>(null);

  useEffect(() => {
    if (location.pathname !== '/') return undefined;
    const root = document.getElementById('root');
    if (!root) return undefined;

    let active = true;
    let frame = 0;
    const scheduleSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => enhanceTables(statsRef.current));
    };
    const refresh = async () => {
      try {
        const next = await loadStats();
        if (!active) return;
        statsRef.current = next;
        scheduleSync();
      } catch {
        // Keep the existing Home table untouched if standings cannot be loaded.
      }
    };

    void refresh();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    const offMutation = onBookieBallEvent('data-mutated', () => void refresh());
    const offGameweek = onBookieBallEvent('gameweek-changed', () => void refresh());

    return () => {
      active = false;
      observer.disconnect();
      offMutation();
      offGameweek();
      window.cancelAnimationFrame(frame);
    };
  }, [location.pathname]);

  return null;
}
