import { AnimatePresence, motion } from 'framer-motion';
import { SnyNewsSegmentSlate } from './SnyNewsSegmentSlate';
import type { SnyNewsPackage, SnyNewsPackageStage } from './types';

type SnyNewsMainPanelProps = {
  activePackage: SnyNewsPackage | null;
  activeStage: SnyNewsPackageStage | null;
  nextStage: SnyNewsPackageStage | null;
  nextPackage: SnyNewsPackage | null;
  packageIndex: number;
  packageCount: number;
  showIntro: boolean;
};

export function SnyNewsMainPanel({
  activePackage,
  activeStage,
  nextStage,
  nextPackage,
  packageIndex,
  packageCount,
  showIntro,
}: SnyNewsMainPanelProps) {
  return (
    <section className={`sny-news-new-main-panel tone-${activePackage?.segmentKey ?? 'feature'}`}>
      <header className="sny-news-new-main-head">
        <div>
          <span className="sny-news-new-main-kicker">
            {activePackage?.segmentLabel ?? activePackage?.kicker ?? 'Main Panel'}
          </span>
          <h2>{activePackage?.kicker ?? 'Loading package'}</h2>
        </div>
        {nextStage || nextPackage ? (
          <span className="sny-news-new-main-next">
            Next: {nextStage?.label ?? nextPackage?.segmentLabel}
          </span>
        ) : null}
      </header>

      <div className="sny-news-new-main-stage">
        <AnimatePresence>
          {showIntro && activePackage ? (
            <SnyNewsSegmentSlate
              key={`intro-${activePackage.id}`}
              activePackage={activePackage}
              nextPackage={nextPackage}
              packageIndex={packageIndex}
              packageCount={packageCount}
            />
          ) : null}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activePackage?.id ?? 'loading'}-${activeStage?.id ?? 'stage'}`}
            className={`sny-news-new-main-frame tone-${activePackage?.segmentKey ?? 'feature'}`}
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.99 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ visibility: showIntro ? 'hidden' : 'visible' }}
            aria-hidden={showIntro}
          >
            <div className="sny-news-new-main-frame-chrome" />
            {activeStage?.content ?? <p className="muted">Loading main package...</p>}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
