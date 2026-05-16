import { AnimatePresence, motion } from 'framer-motion';
import { TeamBadge } from '../TeamBadge';
import type { SnyNewsPackage, SnyNewsSpotlightItem } from './types';

type SnyNewsSidebarProps = {
  activeSpotlight: SnyNewsSpotlightItem | null;
  queue: SnyNewsSpotlightItem[];
  activePackage: SnyNewsPackage | null;
};

export function SnyNewsSidebar({
  activeSpotlight,
  queue,
  activePackage,
}: SnyNewsSidebarProps) {
  const tone = activeSpotlight?.tone ?? activePackage?.segmentKey ?? 'feature';
  const nextSpotlight = queue[0] ?? null;

  return (
    <aside className={`sny-news-new-sidebar tone-${tone}`}>
      <header className="sny-news-new-sidebar-head">
        <div>
          <span className="sny-news-new-sidebar-kicker">Why This Team</span>
          <h3>{activeSpotlight?.family ?? 'Team story'}</h3>
        </div>
      </header>

      <div className="sny-news-new-sidebar-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSpotlight?.id ?? 'loading'}
            className={`sny-news-new-sidebar-frame tone-${tone}`}
            initial={{ opacity: 0, x: 18, scale: 0.986 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -18, scale: 0.986 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="sny-news-new-sidebar-accent" />
            <article className="sny-news-new-spotlight-card">
              <div className="sny-news-new-spotlight-angle">
                <span className="sny-news-new-spotlight-chip">
                  {activeSpotlight?.label ?? 'Team spotlight'}
                </span>
                {activeSpotlight?.note ? (
                  <small>{activeSpotlight.note}</small>
                ) : null}
              </div>

              <div className="sny-news-new-spotlight-identity">
                <div className="sny-news-new-spotlight-badge-wrap">
                  <div className="sny-news-new-spotlight-badge-ring" />
                  <TeamBadge
                    name={activeSpotlight?.teamName ?? 'Sky Sports News'}
                    ballColor={activeSpotlight?.ballColor}
                    ringColor={activeSpotlight?.ringColor}
                    textColor={activeSpotlight?.textColor}
                    size={84}
                  />
                </div>
                <div className="sny-news-new-spotlight-copy">
                  <strong>{activeSpotlight?.teamName ?? 'Preparing spotlight'}</strong>
                  <span className="sny-news-new-spotlight-why">Why now</span>
                  <p>{activeSpotlight?.supportLine ?? 'The side rail rotates one clear team story at a time.'}</p>
                </div>
              </div>

              <div className="sny-news-new-spotlight-stats" aria-label="Spotlight stats">
                {(activeSpotlight?.stats ?? []).slice(0, 4).map((stat) => (
                  <article key={`${stat.label}-${stat.value}`} className="sny-news-new-spotlight-stat">
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </article>
                ))}
              </div>
            </article>
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="sny-news-new-sidebar-footer">
        {nextSpotlight ? (
          <div className={`sny-news-new-sidebar-next tone-${nextSpotlight.tone ?? 'feature'}`}>
            <span>Up Next</span>
            <strong>{nextSpotlight.label}</strong>
            <p>{nextSpotlight.teamName}</p>
          </div>
        ) : (
          <p className="sny-news-new-sidebar-hold">
            Spotlight queue will appear once the next team story is ready.
          </p>
        )}
      </footer>
    </aside>
  );
}
