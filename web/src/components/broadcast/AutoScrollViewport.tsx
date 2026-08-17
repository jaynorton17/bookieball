type Props = {
  children: React.ReactNode;
  className?: string;
  leadInMs?: number;
  bottomPauseMs?: number;
};

export function AutoScrollViewport({ children, className = '' }: Props) {
  return (
    <div className={`${className} command-manual-scroll`} tabIndex={0}>
      {children}
    </div>
  );
}
