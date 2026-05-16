import { motion } from 'framer-motion';

type ShockResultCardProps = {
  winner: string;
  loser: string;
  rankGap: string;
  profitMargin: string;
  detail?: string;
  stamp?: string;
};

export function ShockResultCard({
  winner,
  loser,
  rankGap,
  profitMargin,
  detail = 'Result flipped the expected order on the day.',
  stamp = 'SHOCK RESULT',
}: ShockResultCardProps) {
  return (
    <div className="broadcast-shock-card">
      <div className="broadcast-shock-head">
        <span>{stamp}</span>
        <strong>{winner}</strong>
      </div>
      <div className="broadcast-shock-vs">
        <motion.span
          className="winner"
          initial={{ opacity: 0.5, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          {winner}
        </motion.span>
        <span className="divider">beat</span>
        <motion.span
          className="loser"
          initial={{ opacity: 0.5, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.06 }}
        >
          {loser}
        </motion.span>
      </div>
      <p>{detail}</p>
      <div className="broadcast-shock-metrics">
        <article>
          <span>Rank Gap</span>
          <strong>{rankGap}</strong>
        </article>
        <article>
          <span>Profit Margin</span>
          <strong>{profitMargin}</strong>
        </article>
      </div>
    </div>
  );
}
