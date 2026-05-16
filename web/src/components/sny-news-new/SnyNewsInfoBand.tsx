import { AnimatePresence, motion } from 'framer-motion';
import type { SnyNewsPackage, SnyNewsPackageStage } from './types';

type SnyNewsInfoBandProps = {
  activePackage: SnyNewsPackage | null;
  activeStage: SnyNewsPackageStage | null;
  nextPackage: SnyNewsPackage | null;
  nextStage: SnyNewsPackageStage | null;
};

export function SnyNewsInfoBand({
  activePackage,
  activeStage,
  nextPackage,
  nextStage,
}: SnyNewsInfoBandProps) {
  const tags = (activeStage?.tags ?? activePackage?.tags ?? []).slice(0, 2);
  const explanation = activeStage?.focusNote
    ?? activeStage?.detail
    ?? activePackage?.focusNote
    ?? activePackage?.detail
    ?? 'The active package explains the main editorial cue on screen.';

  return (
    <section className={`sny-news-new-info-band tone-${activePackage?.segmentKey ?? 'feature'}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activePackage?.id ?? 'loading'}-${activeStage?.id ?? 'stage'}`}
          className="sny-news-new-info-band-inner"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="sny-news-new-info-summary">
            <span className="sny-news-new-info-kicker">
              {activePackage?.segmentLabel ?? 'On Now'}
              {activeStage?.label ? ` • ${activeStage.label}` : ''}
            </span>
            <strong>{activeStage?.summary ?? activePackage?.summary ?? 'Broadcast explainer loading.'}</strong>
            <p>{explanation}</p>
          </div>

          <div className="sny-news-new-info-aside">
            {nextStage ? <span>Next: {nextStage.label}</span> : nextPackage ? <span>Next: {nextPackage.segmentLabel}</span> : null}
          </div>

          {tags.length > 0 ? (
            <div className="sny-news-new-info-tags" aria-label="Context tags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
