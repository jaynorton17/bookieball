import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode, type TouchEventHandler } from 'react';

export type StudioSlide = {
  id: string;
  label: string;
  durationMs?: number;
  narration?: string;
  tone?: 'team' | 'fixtures' | 'rivalry' | 'movement' | 'system';
  content: ReactNode;
};

type SlideDeckProps = {
  slides: StudioSlide[];
  defaultDurationMs?: number;
};

export function SlideDeck({
  slides,
  defaultDurationMs = 12000,
}: SlideDeckProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const activeSlide = slides[activeIndex];

  useEffect(() => {
    if (slides.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length < 2 || slides.length === 0) {
      return;
    }
    const duration = activeSlide?.durationMs ?? defaultDurationMs;
    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [activeIndex, activeSlide?.durationMs, defaultDurationMs, slides.length]);

  const goNext = () => setActiveIndex((prev) => (prev + 1) % slides.length);
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);

  const onTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd: TouchEventHandler<HTMLDivElement> = (event) => {
    if (touchStartX.current === null) {
      return;
    }
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 36 || slides.length < 2) {
      return;
    }
    if (delta > 0) {
      goPrev();
      return;
    }
    goNext();
  };

  return (
    <div className="studio-deck" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="studio-deck-head">
        <span className={`studio-deck-label tone-${activeSlide?.tone ?? 'system'}`}>
          {activeSlide?.label ?? 'Studio Update'}
        </span>
      </div>

      <div className="studio-deck-stage">
        <AnimatePresence mode="wait">
          {activeSlide ? (
            <motion.article
              key={activeSlide.id}
              className={`studio-slide tone-${activeSlide.tone ?? 'system'}`}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.015 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeSlide.content}
            </motion.article>
          ) : (
            <motion.article
              key="studio-empty"
              className="studio-slide tone-system"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3>No studio data yet</h3>
              <p>Load fixtures and standings to start the broadcast slideshow.</p>
            </motion.article>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
