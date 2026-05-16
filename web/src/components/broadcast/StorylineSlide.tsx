import type { ReactNode } from 'react';

type StorylineMetric = {
  label: string;
  value: string;
};

type StorylineSlideProps = {
  kicker?: string;
  stamp?: string;
  headline: string;
  detail: string;
  tone?: 'positive' | 'warning' | 'neutral';
  metrics?: StorylineMetric[];
  aside?: ReactNode;
};

export function StorylineSlide({
  kicker = 'Storyline',
  stamp,
  headline,
  detail,
  tone = 'neutral',
  metrics = [],
  aside = null,
}: StorylineSlideProps) {
  return (
    <div className={`broadcast-storyline-slide tone-${tone}`}>
      <div className="broadcast-storyline-copy">
        <div className="broadcast-storyline-head">
          <span className="broadcast-storyline-kicker">{kicker}</span>
          {stamp ? <span className="broadcast-storyline-stamp">{stamp}</span> : null}
        </div>
        <h3>{headline}</h3>
        <p>{detail}</p>
        {metrics.length > 0 ? (
          <div className="broadcast-storyline-metrics">
            {metrics.map((metric) => (
              <article key={`${metric.label}-${metric.value}`} className="broadcast-storyline-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </div>
        ) : null}
      </div>
      {aside ? <div className="broadcast-storyline-aside">{aside}</div> : null}
    </div>
  );
}
