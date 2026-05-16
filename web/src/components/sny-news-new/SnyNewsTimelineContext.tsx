import { createContext, useContext } from 'react';

type SnyNewsTimelineContextValue = {
  stageKey: string | null;
  reportAnimationPending: (stageKey: string | null) => void;
  reportAnimationComplete: (stageKey: string | null) => void;
};

const noop = () => {};

export const SnyNewsTimelineContext = createContext<SnyNewsTimelineContextValue>({
  stageKey: null,
  reportAnimationPending: noop,
  reportAnimationComplete: noop,
});

export function useSnyNewsTimelineAnimation() {
  const context = useContext(SnyNewsTimelineContext);
  const stageKey = context.stageKey;

  return {
    stageKey,
    markAnimationPending: () => context.reportAnimationPending(stageKey),
    markAnimationComplete: () => context.reportAnimationComplete(stageKey),
  };
}
