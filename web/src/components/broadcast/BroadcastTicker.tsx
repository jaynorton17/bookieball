type BroadcastTickerProps = {
  label?: string;
  items: string[];
};

export function BroadcastTicker({ label = 'Studio Live', items }: BroadcastTickerProps) {
  const rows = items.length > 0 ? items : ['Live updates loading'];
  const doubled = [...rows, ...rows];

  return (
    <div className="broadcast-ticker" role="region" aria-label="Broadcast ticker">
      <span className="broadcast-ticker-label">{label}</span>
      <div className="broadcast-ticker-viewport">
        <div className="broadcast-ticker-track">
          {doubled.map((item, index) => (
            <span key={`${item}-${index}`} className="broadcast-ticker-item">
              <strong>LIVE</strong>
              <span>{item}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
