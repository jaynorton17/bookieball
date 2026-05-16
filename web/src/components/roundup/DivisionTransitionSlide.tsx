type DivisionTransitionSlideProps = {
  title: string;
};

export function DivisionTransitionSlide({ title }: DivisionTransitionSlideProps) {
  return (
    <section className="roundup-transition-slide" aria-live="polite">
      <p className="roundup-kicker">DIVISION TABLES ROUNDUP</p>
      <h2>{title} - Division Tables Roundup</h2>
    </section>
  );
}
