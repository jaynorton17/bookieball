import type { PanelTone } from '../../lib/broadcastTheme';
import { PANEL_THEMES } from '../../lib/broadcastTheme';
import { motion } from 'framer-motion';
import { BroadcastPanel } from './BroadcastPanel';

export function TickerBar({ items, accent = 'gold' }: { items: string[]; accent?: PanelTone }) {
  const repeated = [...items, ...items];
  return (
    <BroadcastPanel accent={accent} style={{ minHeight: '72px' }} contentStyle={{ padding: '0.65rem 1rem' }}>
      <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <motion.div
          style={{ display: 'inline-flex', gap: '1.5rem', width: 'max-content', alignItems: 'center' }}
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 18, ease: 'linear', repeat: Infinity }}
        >
          {repeated.map((item, idx) => (
            <span
              key={`ticker-${idx}-${item}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.7rem',
                color: '#f7fbff',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontSize: '0.76rem',
              }}
            >
              <span style={{ color: PANEL_THEMES[accent].accent }}>•</span>
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </BroadcastPanel>
  );
}
