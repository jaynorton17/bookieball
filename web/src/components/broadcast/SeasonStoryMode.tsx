import { SlideDeck, type StudioSlide } from '../SlideDeck';

type SeasonStoryModeProps = {
  title?: string;
  subtitle?: string;
  slides: StudioSlide[];
};

export function SeasonStoryMode({
  title = 'Season Story Mode',
  subtitle = 'Auto-running season summary built from the existing broadcast slides.',
  slides,
}: SeasonStoryModeProps) {
  return (
    <section className="broadcast-season-story">
      <div className="broadcast-season-story-head">
        <span>Studio Broadcast Mode</span>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <SlideDeck slides={slides} defaultDurationMs={9000} />
    </section>
  );
}
