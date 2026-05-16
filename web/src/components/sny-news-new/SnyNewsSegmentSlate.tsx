import { motion } from 'framer-motion';
import type { SnyNewsPackage } from './types';

type SnyNewsSegmentSlateProps = {
  activePackage: SnyNewsPackage;
  nextPackage: SnyNewsPackage | null;
  packageIndex: number;
  packageCount: number;
};

export function SnyNewsSegmentSlate({
  activePackage,
  nextPackage,
  packageIndex: _packageIndex,
  packageCount: _packageCount,
}: SnyNewsSegmentSlateProps) {
  return (
    <motion.div
      className={`sny-news-new-segment-slate tone-${activePackage.segmentKey}`}
      initial={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.985, filter: 'blur(8px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="sny-news-new-segment-slate-band"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 18 }}
        transition={{ duration: 0.5, delay: 0.06 }}
      >
        <span>{activePackage.segmentLabel}</span>
        <strong>{activePackage.kicker}</strong>
      </motion.div>
      <motion.div
        className="sny-news-new-segment-slate-copy"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <span className="sny-news-new-segment-now">Now Showing</span>
        <h3>{activePackage.introTitle}</h3>
        <p>{activePackage.introDetail}</p>
      </motion.div>
      {nextPackage ? (
        <motion.div
          className="sny-news-new-segment-slate-footer"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, delay: 0.16 }}
        >
          <span>Up next</span>
          <strong>{nextPackage.segmentLabel}</strong>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
