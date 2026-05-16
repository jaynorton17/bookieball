import type { SnyNewsPackage, SnyNewsPackageStage } from './types';

type SnyNewsTickerProps = {
  label: string;
  items: string[];
  activePackage: SnyNewsPackage | null;
  activeStage: SnyNewsPackageStage | null;
};

const TICKER_MARKERS = ['LIVE', 'WATCH', 'DESK', 'UPDATE'];

export function SnyNewsTicker({ label, items, activePackage, activeStage }: SnyNewsTickerProps) {
  const packageRows = activePackage?.stages.flatMap((stage, index) => (
    index === 0 && stage.tickerItems ? stage.tickerItems : []
  )) ?? [];
  const rows = Array.from(new Set([...packageRows, ...items])).filter(Boolean);
  const preparedRows = rows.length > 0 ? rows : ['Live updates loading'];
  const doubled = [...preparedRows, ...preparedRows];

  return (
    <div className={`sny-news-new-ticker tone-${activePackage?.segmentKey ?? 'feature'}`}>
      <div className="sny-news-new-ticker-shell" role="region" aria-label="Sky Sports News New ticker">
        <div className="sny-news-new-ticker-labels">
          <span className="sny-news-new-ticker-label">{label}</span>
          <span className="sny-news-new-ticker-segment">
            {activeStage?.label ?? activePackage?.segmentLabel ?? 'Studio Loop'}
          </span>
        </div>
        <div className="sny-news-new-ticker-viewport">
          <div className="sny-news-new-ticker-track">
            {doubled.map((item, index) => (
              <span key={`${item}-${index}`} className="sny-news-new-ticker-item">
                <strong>{TICKER_MARKERS[index % TICKER_MARKERS.length]}</strong>
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
