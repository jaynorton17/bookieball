import { AnimatePresence, motion } from 'framer-motion';
import { TeamBadge } from '../TeamBadge';

type GraphNarrative = {
  key: string;
  headline: string;
  detail: string;
};

type GraphFocusCard = {
  key: string;
  teamName: string;
  rank: number;
  movementLabel: string;
  cueLabel: string;
  tone: 'up' | 'down' | 'flat';
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
};

type GraphStoryOverlayProps = {
  narrative?: GraphNarrative | null;
  focus?: GraphFocusCard | null;
};

export function GraphStoryOverlay({
  narrative = null,
  focus = null,
}: GraphStoryOverlayProps) {
  return (
    <>
      <AnimatePresence>
        {narrative ? (
          <motion.div
            key={narrative.key}
            className="broadcast-graph-story"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <strong>{narrative.headline}</strong>
            <span>{narrative.detail}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {focus ? (
          <motion.aside
            key={focus.key}
            className={`broadcast-graph-focus tone-${focus.tone}`}
            initial={{ opacity: 0, x: 12, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="broadcast-graph-focus-head">
              <TeamBadge
                name={focus.teamName}
                ballColor={focus.ballColor ?? null}
                ringColor={focus.ringColor ?? null}
                textColor={focus.textColor ?? null}
                size={28}
              />
              <div className="broadcast-graph-focus-copy">
                <span>{focus.cueLabel}</span>
                <strong>{focus.teamName}</strong>
              </div>
            </div>
            <div className="broadcast-graph-focus-metrics">
              <article>
                <span>Rank</span>
                <strong>#{focus.rank}</strong>
              </article>
              <article>
                <span>Movement</span>
                <strong>{focus.movementLabel}</strong>
              </article>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}
