import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SnyNewsInfoBand } from './SnyNewsInfoBand';
import { SnyNewsMainPanel } from './SnyNewsMainPanel';
import { SnyNewsSidebar } from './SnyNewsSidebar';
import { SnyNewsTicker } from './SnyNewsTicker';
import { SnyNewsTimelineContext } from './SnyNewsTimelineContext';
import type { SnyNewsPackage, SnyNewsSpotlightItem } from './types';

type SnyNewsLayoutProps = {
  packages: SnyNewsPackage[];
  tickerLabel: string;
  tickerItems: string[];
};

const INTRO_DWELL_MS = 1200;
const MIN_STAGE_DWELL_MS = 5500;

function findNextAvailablePackageId(
  targetId: string | null,
  previousPackageIds: string[],
  packages: SnyNewsPackage[],
): string | null {
  if (packages.length === 0) {
    return null;
  }
  if (targetId && packages.some((pkg) => pkg.id === targetId)) {
    return targetId;
  }
  if (targetId && previousPackageIds.length > 0) {
    const previousIndex = previousPackageIds.indexOf(targetId);
    if (previousIndex >= 0) {
      for (let offset = 1; offset <= previousPackageIds.length; offset += 1) {
        const candidateId = previousPackageIds[(previousIndex + offset) % previousPackageIds.length];
        if (packages.some((pkg) => pkg.id === candidateId)) {
          return candidateId;
        }
      }
    }
  }
  return packages[0]?.id ?? null;
}

function findNextPackageAfterId(
  currentPackageId: string | null,
  previousPackageIds: string[],
  packages: SnyNewsPackage[],
): string | null {
  if (packages.length === 0) {
    return null;
  }
  if (!currentPackageId) {
    return packages[0]?.id ?? null;
  }

  const currentIndex = packages.findIndex((pkg) => pkg.id === currentPackageId);
  if (currentIndex >= 0) {
    return packages[(currentIndex + 1) % packages.length]?.id ?? packages[0]?.id ?? null;
  }

  const previousIndex = previousPackageIds.indexOf(currentPackageId);
  if (previousIndex >= 0) {
    for (let offset = 1; offset <= previousPackageIds.length; offset += 1) {
      const candidateId = previousPackageIds[(previousIndex + offset) % previousPackageIds.length];
      if (packages.some((pkg) => pkg.id === candidateId)) {
        return candidateId;
      }
    }
  }

  return packages[0]?.id ?? null;
}

function buildQueue(items: SnyNewsSpotlightItem[], activeIndex: number): SnyNewsSpotlightItem[] {
  if (items.length <= 1) {
    return [];
  }
  const queue: SnyNewsSpotlightItem[] = [];
  for (let offset = 1; offset < items.length && queue.length < 1; offset += 1) {
    queue.push(items[(activeIndex + offset) % items.length]);
  }
  return queue;
}

export function SnyNewsLayout({
  packages,
  tickerLabel,
  tickerItems,
}: SnyNewsLayoutProps) {
  const [activePackageId, setActivePackageId] = useState<string | null>(packages[0]?.id ?? null);
  const [activeStageId, setActiveStageId] = useState<string | null>(packages[0]?.stages[0]?.id ?? null);
  const [showIntro, setShowIntro] = useState(true);
  const [animationComplete, setAnimationComplete] = useState(true);
  const previousPackageIdsRef = useRef<string[]>(packages.map((pkg) => pkg.id));
  const activePackageFallbackRef = useRef<SnyNewsPackage | null>(packages[0] ?? null);
  const activeStageFallbackRef = useRef<{ packageId: string; stage: SnyNewsPackage['stages'][number] } | null>(
    packages[0]?.stages[0] ? { packageId: packages[0].id, stage: packages[0].stages[0] } : null,
  );
  const stageTimerRef = useRef<number | null>(null);
  const stageStartedAtRef = useRef<number>(0);
  const stageClockKeyRef = useRef<string | null>(null);

  const packageIds = useMemo(
    () => packages.map((pkg) => pkg.id),
    [packages],
  );

  const liveActivePackage = useMemo(
    () => (activePackageId ? packages.find((pkg) => pkg.id === activePackageId) ?? null : null),
    [activePackageId, packages],
  );
  const activePackage = liveActivePackage ?? activePackageFallbackRef.current ?? packages[0] ?? null;
  const activeStages = activePackage?.stages ?? [];
  const liveActiveStage = useMemo(() => {
    if (!liveActivePackage || !activeStageId) {
      return null;
    }
    return liveActivePackage.stages.find((stage) => stage.id === activeStageId) ?? null;
  }, [activeStageId, liveActivePackage]);
  const activeStage = (
    liveActiveStage
    ?? (activeStageFallbackRef.current?.packageId === activePackage?.id ? activeStageFallbackRef.current.stage : null)
    ?? activeStages[0]
    ?? null
  );
  const activePackageIndex = useMemo(() => {
    if (!activePackage?.id) {
      return 0;
    }
    const liveIndex = packages.findIndex((pkg) => pkg.id === activePackage.id);
    return liveIndex >= 0 ? liveIndex : 0;
  }, [activePackage?.id, packages]);
  const activeStageIndex = useMemo(() => {
    if (!activeStage?.id) {
      return 0;
    }
    const index = activeStages.findIndex((stage) => stage.id === activeStage.id);
    return index >= 0 ? index : 0;
  }, [activeStage?.id, activeStages]);
  const activeClockKey = activePackage && activeStage ? `${activePackage.id}:${activeStage.id}` : null;
  const nextStage = activeStageIndex < activeStages.length - 1
    ? activeStages[activeStageIndex + 1] ?? null
    : null;
  const nextPackage = packages.length > 1
    ? packages[(activePackageIndex + 1) % packages.length] ?? null
    : null;

  const clearStageTimer = useCallback(() => {
    if (stageTimerRef.current !== null) {
      window.clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (packages.length === 0) {
      clearStageTimer();
      setActivePackageId(null);
      setActiveStageId(null);
      setShowIntro(false);
      setAnimationComplete(true);
      activePackageFallbackRef.current = null;
      activeStageFallbackRef.current = null;
      previousPackageIdsRef.current = [];
      return;
    }

    if (!activePackageId) {
      setActivePackageId(packages[0]?.id ?? null);
      setActiveStageId(packages[0]?.stages[0]?.id ?? null);
    }
    previousPackageIdsRef.current = packageIds;
  }, [activePackageId, clearStageTimer, packageIds, packages]);

  useEffect(() => {
    if (liveActivePackage) {
      activePackageFallbackRef.current = liveActivePackage;
    }
  }, [liveActivePackage]);

  useEffect(() => {
    if (activePackage?.id && activeStage) {
      activeStageFallbackRef.current = { packageId: activePackage.id, stage: activeStage };
    }
  }, [activePackage?.id, activeStage]);

  useEffect(() => {
    if (!activePackage || activeStages.length === 0) {
      setActiveStageId(null);
      return;
    }
    if (!activeStageId) {
      setActiveStageId(activeStages[0]?.id ?? null);
      return;
    }
    if (!activeStage) {
      return;
    }
    if (activeStage.id !== activeStageId) {
      setActiveStageId(activeStage.id);
    }
  }, [activePackage, activeStage, activeStageId, activeStages]);

  useEffect(() => {
    if (!activeClockKey) {
      clearStageTimer();
      stageClockKeyRef.current = null;
      stageStartedAtRef.current = 0;
      return;
    }
    if (stageClockKeyRef.current === activeClockKey) {
      return;
    }
    clearStageTimer();
    stageClockKeyRef.current = activeClockKey;
    stageStartedAtRef.current = window.performance.now();
    const expectsAnimation = (activeStage?.animationLockMs ?? 0) > 0;
    setAnimationComplete(!expectsAnimation);
    setShowIntro(activeStageIndex === 0);
  }, [activeClockKey, activeStage?.animationLockMs, activeStageIndex, clearStageTimer]);

  const advanceTimeline = useCallback(() => {
    if (packages.length === 0) {
      return;
    }
    if (!activePackageId) {
      setActivePackageId(packages[0]?.id ?? null);
      setActiveStageId(packages[0]?.stages[0]?.id ?? null);
      return;
    }

    const currentLivePackage = packages.find((pkg) => pkg.id === activePackageId) ?? null;
    if (currentLivePackage && activeStageId) {
      const liveStageIndex = currentLivePackage.stages.findIndex((stage) => stage.id === activeStageId);
      if (liveStageIndex >= 0 && liveStageIndex < currentLivePackage.stages.length - 1) {
        setActiveStageId(currentLivePackage.stages[liveStageIndex + 1]?.id ?? null);
        return;
      }
    }

    const nextPackageId = findNextPackageAfterId(activePackageId, previousPackageIdsRef.current, packages);
    const nextResolvedPackageId = findNextAvailablePackageId(nextPackageId, previousPackageIdsRef.current, packages);
    const nextResolvedPackage = packages.find((pkg) => pkg.id === nextResolvedPackageId) ?? packages[0] ?? null;
    setActivePackageId(nextResolvedPackage?.id ?? null);
    setActiveStageId(nextResolvedPackage?.stages[0]?.id ?? null);
  }, [activePackageId, activeStageId, packages]);

  useEffect(() => {
    if (!activePackage || !activeStage || !activeClockKey) {
      clearStageTimer();
      return;
    }

    const stageStartedAt = stageStartedAtRef.current || window.performance.now();
    const introLockMs = activeStageIndex === 0 ? INTRO_DWELL_MS : 0;
    const stageLockMs = Math.max(MIN_STAGE_DWELL_MS, activeStage.dwellMs ?? MIN_STAGE_DWELL_MS);
    const expectsAnimation = (activeStage.animationLockMs ?? 0) > 0;
    const minimumReadyAt = stageStartedAt + introLockMs + stageLockMs;

    const scheduleCheckpoint = () => {
      clearStageTimer();
      const now = window.performance.now();
      const introDone = now >= stageStartedAt + introLockMs;

      if (showIntro !== (!introDone && introLockMs > 0)) {
        setShowIntro(!introDone && introLockMs > 0);
      }

      if (!introDone) {
        stageTimerRef.current = window.setTimeout(scheduleCheckpoint, Math.max(16, stageStartedAt + introLockMs - now));
        return;
      }

      if (now < minimumReadyAt) {
        stageTimerRef.current = window.setTimeout(scheduleCheckpoint, Math.max(16, minimumReadyAt - now));
        return;
      }

      if (expectsAnimation && !animationComplete) {
        stageTimerRef.current = window.setTimeout(scheduleCheckpoint, 80);
        return;
      }

      advanceTimeline();
    };

    scheduleCheckpoint();

    return clearStageTimer;
  }, [
    activeClockKey,
    activePackage,
    activeStage,
    activeStageIndex,
    advanceTimeline,
    animationComplete,
    clearStageTimer,
    showIntro,
  ]);

  const reportAnimationPending = useCallback((stageKey: string | null) => {
    if (!stageKey || stageKey !== stageClockKeyRef.current) {
      return;
    }
    setAnimationComplete(false);
  }, []);

  const reportAnimationComplete = useCallback((stageKey: string | null) => {
    if (!stageKey || stageKey !== stageClockKeyRef.current) {
      return;
    }
    setAnimationComplete(true);
  }, []);

  const fallbackSpotlight = useMemo(() => {
    return activeStage?.spotlight
      ?? nextStage?.spotlight
      ?? nextPackage?.stages[0]?.spotlight
      ?? null;
  }, [activeStage?.spotlight, nextPackage, nextStage?.spotlight]);

  const queue = useMemo(
    () => buildQueue(
      [nextStage?.spotlight, nextPackage?.stages[0]?.spotlight].filter(
        (item): item is SnyNewsSpotlightItem => item !== null && item !== undefined,
      ),
      0,
    ),
    [nextPackage, nextStage?.spotlight],
  );

  return (
    <SnyNewsTimelineContext.Provider
      value={{
        stageKey: activeClockKey,
        reportAnimationPending,
        reportAnimationComplete,
      }}
    >
      <section className="sny-news-new-screen">
        <div className="sny-news-new-top">
          <SnyNewsMainPanel
            activePackage={activePackage}
            activeStage={activeStage}
            nextStage={nextStage}
            nextPackage={nextPackage}
            packageIndex={activePackageIndex}
            packageCount={packages.length}
            showIntro={showIntro}
          />
          <SnyNewsSidebar activeSpotlight={fallbackSpotlight} queue={queue} activePackage={activePackage} />
        </div>
        <SnyNewsInfoBand activePackage={activePackage} activeStage={activeStage} nextPackage={nextPackage} nextStage={nextStage} />
        <SnyNewsTicker label={tickerLabel} items={tickerItems} activePackage={activePackage} activeStage={activeStage} />
      </section>
    </SnyNewsTimelineContext.Provider>
  );
}
