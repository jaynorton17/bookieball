import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { buildSeasonFinaleSlides, type SeasonFinalePayload } from '../lib/seasonFinaleSlides';

type SeasonFinale = {
  season: string;
  payload: SeasonFinalePayload;
};

export function SeasonFinalePage() {
  const [seasonFinale, setSeasonFinale] = useState<SeasonFinale | null>(null);
  const [loading, setLoading] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    let active = true;
    api.seasonFinale()
      .then((response) => {
        if (!active) {
          return;
        }
        if ('pending' in response && response.pending === false) {
          setSeasonFinale(null);
        } else {
          setSeasonFinale(response as SeasonFinale);
        }
      })
      .catch(() => {
        if (active) {
          setSeasonFinale(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const slides = useMemo(() => buildSeasonFinaleSlides(seasonFinale?.payload ?? null), [seasonFinale]);
  const activeSlide = slides[slideIndex] ?? null;

  useEffect(() => {
    if (!isPlaying || slides.length === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [isPlaying, slides.length]);

  useEffect(() => {
    if (slideIndex >= slides.length && slides.length > 0) {
      setSlideIndex(0);
    }
  }, [slideIndex, slides.length]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (slides.length === 0) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSlideIndex((prev) => (prev + 1) % slides.length);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
      } else if (event.key === ' ') {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [slides.length]);

  const progress = slides.length > 0 ? ((slideIndex + 1) / slides.length) * 100 : 0;

  return (
    <section className="finale-deck">
      <div className="finale-stage">
        <div className="finale-topbar">
          <div>
            <div className="finale-kicker">End of Season Presentation</div>
            <h1 className="finale-hero">Bookieball Finale</h1>
          </div>
          <div className="finale-season">
            {seasonFinale?.payload.season ?? 'Season TBD'}
          </div>
        </div>

        {loading ? (
          <div className="finale-slide finale-slide--full">
            <div className="finale-title">Loading presentation…</div>
            <div className="finale-lines">
              <div className="finale-line">Pulling season results and awards.</div>
            </div>
          </div>
        ) : activeSlide ? (
          <div className="finale-slide finale-slide--full" key={`finale-slide-${slideIndex}`}>
            <div className="finale-title">{activeSlide.title}</div>
            <div className="finale-lines">
              {activeSlide.lines.map((line, idx) => (
                <div key={`finale-line-${slideIndex}-${idx}`} className="finale-line">{line}</div>
              ))}
            </div>
          </div>
        ) : (
          <div className="finale-slide finale-slide--full">
            <div className="finale-title">Season finale not ready</div>
            <div className="finale-lines">
              <div className="finale-line">Finish GW8 to generate the full presentation.</div>
            </div>
          </div>
        )}

        <div className="finale-controls">
          <div className="finale-controls-left">
            <button
              type="button"
              className="finale-button"
              onClick={() => setSlideIndex((prev) => (prev - 1 + slides.length) % (slides.length || 1))}
              disabled={slides.length === 0}
            >
              Prev
            </button>
            <button
              type="button"
              className="finale-button finale-button-primary"
              onClick={() => setIsPlaying((prev) => !prev)}
              disabled={slides.length === 0}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="finale-button"
              onClick={() => setSlideIndex((prev) => (prev + 1) % (slides.length || 1))}
              disabled={slides.length === 0}
            >
              Next
            </button>
          </div>
          <div className="finale-controls-right">
            <div className="finale-progress">
              <span>{slides.length > 0 ? `${slideIndex + 1}/${slides.length}` : '0/0'}</span>
              <div className="finale-bar">
                <div className="finale-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <Link to="/" className="finale-exit">Exit</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
