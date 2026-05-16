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

type TransitionProfile = {
  initial: Record<string, number>;
  animate: Record<string, number>;
  exit: Record<string, number>;
  transition: {
    duration: number;
    ease: [number, number, number, number];
  };
};

function durationForSlide(slide: StudioSlide | undefined, fallback: number): number {
  const label = `${slide?.label ?? ''} ${slide?.id ?? ''}`.toLowerCase();
  if (slide?.durationMs) {
    return slide.durationMs;
  }
  if (/headline|shock|storyline|opening/i.test(label)) {
    return 3800;
  }
  if (/table|standings/i.test(label)) {
    return 5600;
  }
  if (/journey|graph|story mode/i.test(label)) {
    return 9000;
  }
  if (/bracket|cup/i.test(label)) {
    return 6800;
  }
  return fallback;
}

function transitionForSlide(slide: StudioSlide | undefined): TransitionProfile {
  const label = `${slide?.label ?? ''} ${slide?.id ?? ''}`.toLowerCase();
  if (/journey|graph|movement/i.test(label)) {
    return {
      initial: { opacity: 0, y: 18, scale: 0.985 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: -12, scale: 1.01 },
      transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
    };
  }
  if (/headline|shock|storyline|opening/i.test(label)) {
    return {
      initial: { opacity: 0, scale: 0.96 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 1.025 },
      transition: { duration: 0.44, ease: [0.22, 1, 0.36, 1] },
    };
  }
  if (/bracket|cup/i.test(label)) {
    return {
      initial: { opacity: 0, x: 28, scale: 0.99 },
      animate: { opacity: 1, x: 0, scale: 1 },
      exit: { opacity: 0, x: -28, scale: 1.01 },
      transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.985 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.015 },
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  };
}

export function SlideDeck({
  slides,
  defaultDurationMs = 12000,
}: SlideDeckProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const activeSlide = slides[activeIndex];
  const transitionProfile = transitionForSlide(activeSlide);

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
    if (paused || slides.length < 2 || slides.length === 0) {
      return;
    }
    const duration = durationForSlide(activeSlide, defaultDurationMs);
    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [activeIndex, activeSlide, defaultDurationMs, paused, slides.length]);

  const goNext = () => setActiveIndex((prev) => (prev + 1) % slides.length);
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const divisionRoundupActive = /^(division roundup|divisions round up)\b/i.test(activeSlide?.label ?? '');

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

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        setPaused((current) => !current);
        return;
      }
      if (slides.length < 2) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [slides.length]);

  return (
    <div className="studio-deck" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="studio-deck-head">
        <span className={`studio-deck-label tone-${activeSlide?.tone ?? 'system'}${divisionRoundupActive ? ' is-division-roundup' : ''}`}>
          {activeSlide?.label ?? 'Studio Update'}
        </span>
        <span className={`studio-deck-mode-chip${paused ? ' paused' : ''}`}>
          {paused ? 'Studio Broadcast Mode • Paused' : 'Studio Broadcast Mode • Live'}
        </span>
        {slides.length > 1 ? (
          <span className="studio-deck-count">
            {activeIndex + 1}/{slides.length}
          </span>
        ) : null}
      </div>

      <div className="studio-deck-stage">
        {slides.length > 1 ? (
          <AnimatePresence mode="wait">
            {activeSlide ? (
              <motion.article
                key={activeSlide.id}
                className={`studio-slide tone-${activeSlide.tone ?? 'system'}`}
                initial={transitionProfile.initial}
                animate={transitionProfile.animate}
                exit={transitionProfile.exit}
                transition={transitionProfile.transition}
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
        ) : activeSlide ? (
          <article key={activeSlide.id} className={`studio-slide tone-${activeSlide.tone ?? 'system'}`}>
            {activeSlide.content}
          </article>
        ) : (
          <article key="studio-empty" className="studio-slide tone-system">
            <h3>No studio data yet</h3>
            <p>Load fixtures and standings to start the broadcast slideshow.</p>
          </article>
        )}
      </div>
    </div>
  );
}
