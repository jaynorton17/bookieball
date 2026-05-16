import { motion } from 'framer-motion';

type DivisionRaceMeterBar = {
  teamName: string;
  value: number;
  label?: string;
};

type DivisionRaceMeterProps = {
  title: string;
  bars: DivisionRaceMeterBar[];
};

export function DivisionRaceMeter({ title, bars }: DivisionRaceMeterProps) {
  const maxValue = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <div className="broadcast-race-meter">
      <div className="broadcast-race-meter-head">
        <span>Division Race Meter</span>
        <strong>{title}</strong>
      </div>
      <div className="broadcast-race-meter-list">
        {bars.map((bar, index) => (
          <div key={`${title}-${bar.teamName}`} className="broadcast-race-meter-row">
            <span>{bar.teamName}</span>
            <div className="broadcast-race-meter-track">
              <motion.span
                className="broadcast-race-meter-fill"
                initial={{ width: 0 }}
                animate={{ width: `${(bar.value / maxValue) * 100}%` }}
                transition={{ duration: 0.55, delay: index * 0.08 }}
              />
            </div>
            <strong>{bar.label ?? String(bar.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
