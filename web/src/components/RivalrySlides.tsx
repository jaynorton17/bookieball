import { motion } from 'framer-motion';
import type { StudioSlide } from './SlideDeck';

export type RivalrySlideData = {
  id: string;
  title: string;
  matchup: string;
  record: string;
  profitSwing: string;
  outcome: string;
  winnerHighlight: string;
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

export function RivalrySlides(rivalries: RivalrySlideData[]): StudioSlide[] {
  return rivalries.map((rivalry, idx) => ({
    id: `rivalry-${rivalry.id}`,
    label: `Rivalry • ${rivalry.title}`,
    durationMs: 12000,
    narration: `${pickBySeed(rivalry.id, [
      `Rivalry desk on ${rivalry.matchup}.`,
      `Head-to-head update: ${rivalry.matchup}.`,
      `Competitive spotlight for ${rivalry.matchup}.`,
    ])} ${rivalry.outcome}. ${rivalry.winnerHighlight} is the headline winner.`,
    tone: 'rivalry',
    content: (
      <div className="studio-rivalry-slide">
        <div className="studio-rivalry-banner">Rivalry Week</div>
        <h3>{rivalry.matchup}</h3>
        <p>{rivalry.outcome}</p>
        <div className="studio-rivalry-grid">
          <motion.div
            className="studio-rivalry-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.04 + 0.08 }}
          >
            <span>Head-to-Head</span>
            <strong>{rivalry.record}</strong>
          </motion.div>
          <motion.div
            className="studio-rivalry-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.04 + 0.18 }}
          >
            <span>Profit Swing</span>
            <strong>{rivalry.profitSwing}</strong>
          </motion.div>
          <motion.div
            className="studio-rivalry-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.04 + 0.28 }}
          >
            <span>Winner Highlight</span>
            <strong>{rivalry.winnerHighlight}</strong>
          </motion.div>
        </div>
      </div>
    ),
  }));
}
