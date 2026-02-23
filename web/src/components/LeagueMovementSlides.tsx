import { motion } from 'framer-motion';
import type { StudioSlide } from './SlideDeck';

export type LeagueMovementData = {
  id: string;
  headline: string;
  detail: string;
  label: string;
  direction: 'up' | 'down' | 'flat';
  value: string;
};

function pickBySeed(seed: string, variants: string[]): string {
  if (variants.length === 0) {
    return '';
  }
  let hash = 0;
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash = (hash * 31 + seed.charCodeAt(idx)) % 2147483647;
  }
  return variants[Math.abs(hash) % variants.length] ?? variants[0];
}

export function LeagueMovementSlides(items: LeagueMovementData[]): StudioSlide[] {
  return items.map((item, index) => ({
    id: `movement-${item.id}`,
    label: `League Movement • ${item.label}`,
    durationMs: 12000,
    narration: `${pickBySeed(item.id, [
      `League movement bulletin for ${item.label}.`,
      `${item.label} movement call.`,
      `Table trend update for ${item.label}.`,
    ])} ${item.headline}. Current direction is ${item.direction}.`,
    tone: 'movement',
    content: (
      <div className="studio-movement-slide">
        <span className="studio-kicker">League Movement</span>
        <h3>{item.headline}</h3>
        <p>{item.detail}</p>
        <motion.div
          className={`studio-movement-arrow ${item.direction}`}
          initial={{ opacity: 0, x: item.direction === 'up' ? -8 : 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.12 + index * 0.03 }}
        >
          <span className="studio-movement-icon" aria-hidden="true">
            {item.direction === 'up' ? '↑' : item.direction === 'down' ? '↓' : '→'}
          </span>
          <strong>{item.value}</strong>
        </motion.div>
      </div>
    ),
  }));
}
