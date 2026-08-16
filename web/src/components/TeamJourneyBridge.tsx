import { useEffect, useState } from 'react';
import { TeamJourneyOverlay } from './TeamJourneyOverlay';

export function TeamJourneyBridge() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('bookieball:team-journey', show);
    return () => window.removeEventListener('bookieball:team-journey', show);
  }, []);

  return <TeamJourneyOverlay open={open} onClose={() => setOpen(false)} />;
}
