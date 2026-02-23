type TickerBarProps = {
  label?: string;
  items: string[];
};

export function TickerBar({ label = 'Sky Sports News', items }: TickerBarProps) {
  const prefixes = ['Update', 'Desk', 'Live', 'Watch'];
  const decorated = (items.length > 0 ? items : ['Live updates loading…']).map((item, idx) => `${prefixes[idx % prefixes.length]}: ${item}`);
  const tickerItems = [...decorated, ...decorated];

  return (
    <div className="studio-ticker" role="region" aria-label="News ticker">
      <span className="studio-ticker-label">{label}</span>
      <div className="studio-ticker-viewport">
        <div className="studio-ticker-track">
          {tickerItems.map((item, idx) => (
            <span key={`${item}-${idx}`} className="studio-ticker-item">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
