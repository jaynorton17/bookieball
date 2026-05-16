import type { ReactNode } from 'react';

export type SnyNewsSegmentKey =
  | 'feature'
  | 'league'
  | 'cup'
  | 'master'
  | 'trio'
  | 'prediction'
  | 'rivalry'
  | 'archive'
  | 'spotlight';

export type SnyNewsPackage = {
  id: string;
  kicker: string;
  headline: string;
  summary: string;
  detail: string;
  tags: string[];
  segmentKey: SnyNewsSegmentKey;
  segmentLabel: string;
  introTitle: string;
  introDetail: string;
  roleLabel: 'Headline' | 'Support';
  clockPriority?: 'core' | 'support' | 'fallback';
  repeatWeight?: number;
  flagshipRepeater?: boolean;
  focusNote?: string;
  stages: SnyNewsPackageStage[];
};

export type SnyNewsPackageStage = {
  id: string;
  label: string;
  summary: string;
  detail: string;
  tags?: string[];
  dwellMs?: number;
  animationLockMs?: number;
  focusNote?: string;
  tickerItems?: string[];
  spotlight?: SnyNewsSpotlightItem | null;
  content: ReactNode;
};

export type SnyNewsSpotlightStat = {
  label: string;
  value: string;
};

export type SnyNewsSpotlightItem = {
  id: string;
  teamId: number | null;
  teamName: string;
  label: string;
  family?: string;
  note?: string;
  supportLine: string;
  tone?: SnyNewsSegmentKey;
  dwellMs?: number;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
  stats: SnyNewsSpotlightStat[];
};
