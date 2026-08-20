import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type ParsedStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: string;
  profit: string;
};

const TABLE_SELECTOR = '.command-centre-v2 .command-slide-body.has-fixtures .command-table-native';

function parseRowStats(row: HTMLElement): ParsedStats | null {
  const detail = row.querySelector<HTMLElement>('.command-row-team small')?.textContent?.trim() ?? '';
  const pointsText = row.querySelector<HTMLElement>('.command-row-value')?.textContent?.trim() ?? '';
  const record = detail.match(/(\d+)\s*W\s+(\d+)\s*D\s+(\d+)\s*L\s*[·•-]\s*([+-]?\d+(?:\.\d+)?)/i);
  const points = pointsText.match(/[+-]?\d+(?:\.\d+)?/);
  if (!record || !points) return null;

  const wins = Number(record[1]);
  const draws = Number(record[2]);
  const losses = Number(record[3]);
  return {
    played: wins + draws + losses,
    wins,
    draws,
    losses,
    points: points[0],
    profit: record[4],
  };
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

function enhanceRow(row: HTMLElement) {
  const stats = parseRowStats(row);
  if (!stats) return;
  const signature = `${stats.played}|${stats.wins}|${stats.draws}|${stats.losses}|${stats.points}|${stats.profit}`;
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
    makeCell('Points', stats.points, 'is-points'),
    makeCell('Profit', stats.profit, Number(stats.profit) > 0 ? 'is-positive' : Number(stats.profit) < 0 ? 'is-negative' : ''),
  );
}

function enhanceTables() {
  document.querySelectorAll<HTMLElement>(TABLE_SELECTOR).forEach((table) => {
    table.classList.add('home-live-table-detailed');
    ensureHeader(table);
    table.querySelectorAll<HTMLElement>(':scope > .command-row').forEach(enhanceRow);
  });
}

export function HomeLiveTableEnhancement() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/') return undefined;
    const root = document.getElementById('root');
    if (!root) return undefined;

    let frame = 0;
    const scheduleSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(enhanceTables);
    };

    scheduleSync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [location.pathname]);

  return null;
}
