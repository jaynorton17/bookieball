import { BroadcastTicker } from './broadcast/BroadcastTicker';

type TickerBarProps = {
  label?: string;
  items: string[];
};

export function TickerBar({ label = 'Bookieball Studio', items }: TickerBarProps) {
  const prefixes = ['Update', 'Desk', 'Live', 'Watch'];
  const decorated = (items.length > 0 ? items : ['Live updates loading']).map((item, idx) => `${prefixes[idx % prefixes.length]}: ${item}`);
  return <BroadcastTicker label={label} items={decorated} />;
}
