import { motion } from 'framer-motion';

type MomentumMeterProps = {
  label: string;
  values: number[];
};

function toneFromValues(values: number[]): 'up' | 'flat' | 'down' {
  const latest = values[values.length - 1] ?? 0;
  const earliest = values[0] ?? 0;
  const delta = latest - earliest;
  if (delta > 0.35) {
    return 'up';
  }
  if (delta < -0.35) {
    return 'down';
  }
  return 'flat';
}

export function MomentumMeter({ label, values }: MomentumMeterProps) {
  const tone = toneFromValues(values);
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));

  return (
    <div className={`broadcast-momentum-meter tone-${tone}`}>
      <div className="broadcast-momentum-head">
        <span>{label}</span>
        <strong>
          {tone === 'up' ? 'Rising' : tone === 'down' ? 'Dropping' : 'Steady'}
        </strong>
      </div>
      <div className="broadcast-momentum-bars" aria-hidden="true">
        {values.map((value, index) => {
          const height = `${Math.max(18, (Math.abs(value) / maxAbs) * 100)}%`;
          return (
            <motion.span
              key={`${label}-${index}-${value}`}
              className={`broadcast-momentum-bar ${value >= 0 ? 'positive' : 'negative'}`}
              initial={{ height: '0%' }}
              animate={{ height }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
            />
          );
        })}
      </div>
    </div>
  );
}
