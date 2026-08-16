import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CompetitionBracketTree, type CompetitionBracketRound, type CompetitionBracketTie } from '../components/StudioLiveWidgets';
import { TeamHistoryStoryTile } from '../components/TeamHistoryStoryTile';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { displayDivisionName, getDivisionOrderForSeason } from '../lib/divisionLabels';
import { buildTeamLegacySummary, type TeamHistoryRow, type TeamLegacySummary, type TrophyRoomPayload } from '../lib/reports/legacy';
import { isOfficialDivisionFixture, recentForm, type FormBadgeResult } from '../lib/formUtils';

type TeamProfile = Awaited<ReturnType<typeof api.teams>>[number];
type AllTimeTableRow = Awaited<ReturnType<typeof api.allTimeLeagues>>['pointsTable'][number];
type LeagueTablePayload = Awaited<ReturnType<typeof api.leagueTable>>;
type LeagueTableRow = LeagueTablePayload[string][number];
type LeagueFixture = Awaited<ReturnType<typeof api.leagueFixtures>>[number];
type MasterLeaguePayload = Awaited<ReturnType<typeof api.masterLeagueTable>>;
type MasterLeagueRow = Awaited<ReturnType<typeof api.masterLeagueTable>>['table'][number];
type MasterLeagueFixture = Awaited<ReturnType<typeof api.masterLeagueFixtures>>[number];
type TrioLeaguePayload = Awaited<ReturnType<typeof api.trioLeagueTable>>;
type TrioLeagueRow = Awaited<ReturnType<typeof api.trioLeagueTable>>['table'][number];
type TrioLeagueFixture = Awaited<ReturnType<typeof api.trioLeagueFixtures>>[number];
type TierLeaguePayload = Awaited<ReturnType<typeof api.tierLeagueTable>>;
type TierLeagueRow = Awaited<ReturnType<typeof api.tierLeagueTable>>['table'][number];
type TierLeagueFixture = Awaited<ReturnType<typeof api.tierLeagueFixtures>>[number];
type CupFixture = Awaited<ReturnType<typeof api.cup>>[number];
type CupStatusRow = Awaited<ReturnType<typeof api.cupStatus>>[number];
type MasterCupFixture = Awaited<ReturnType<typeof api.masterCupFixtures>>[number];
type SuperCupFixture = Awaited<ReturnType<typeof api.superCup>>[number];
type TeamHistoryStoryRecord = Awaited<ReturnType<typeof api.teamHistoryStoryBulk>>['histories'][number];

type CompetitionOption = {
  id: string;
  label: string;
};

type ComparisonViewMode = 'focused' | 'full';

type ConfirmedSelection = {
  competitionIds: string[];
  teamIds: number[];
};

type LeaguePanelTone = 'division' | 'master' | 'trio' | 'tier' | 'cup' | 'history';
type SectionFixtureState = { enabled: boolean; gw: string | null };

type TeamMetricSummary = {
  gamesPlayed: number;
  winPct: number;
  spins: number;
  profit: number;
  averageProfitPerWeek: number;
};

type TeamOverviewRecord = {
  team: TeamProfile;
  stats: TeamMetricSummary;
  history: TeamHistoryRow[];
  allTimeRow: AllTimeTableRow | null;
  divisionPosition: { division: string; rank: number } | null;
  masterPosition: MasterLeagueRow | null;
  trio: {
    enabled: boolean;
    row: TrioLeagueRow | null;
  };
  tier: {
    enabled: boolean;
    started: boolean;
    row: TierLeagueRow | null;
  };
  superCup: {
    fixture: SuperCupFixture | null;
    wins: number;
    appearances: number;
  };
  legacy: TeamLegacySummary;
};

type EditorialStripItem = {
  label: string;
  teamName: string;
  detail: string;
};

type OverallRatingBreakdown = {
  divisionScore: number;
  masterScore: number;
  trioScore: number;
  tierScore: number;
  profitEfficiencyScore: number;
  winEfficiencyScore: number;
  efficiencyScore: number;
  formScore: number;
  legacyWeight: number;
  legacyScore: number;
  total: number;
  formResults: FormBadgeResult[];
};

type CompetitionContextData = {
  leagueTable: LeagueTablePayload | null;
  leagueFixtures: LeagueFixture[];
  masterLeague: MasterLeaguePayload | null;
  masterLeagueFixtures: MasterLeagueFixture[];
  trioLeague: TrioLeaguePayload | null;
  trioLeagueFixtures: TrioLeagueFixture[];
  tierLeague: TierLeaguePayload | null;
  tierLeagueFixtures: TierLeagueFixture[];
  cupStatus: CupStatusRow[];
  cupFixtures: CupFixture[];
  masterCupFixtures: MasterCupFixture[];
  superCupFixtures: SuperCupFixture[];
};

type CupPathNodeState = 'won' | 'lost' | 'current' | 'future' | 'bye' | 'champion' | 'ended';

type CupPathNode = {
  id: string;
  roundLabel: string;
  opponent: string;
  status: string;
  detail: string;
  score?: string | null;
  state: CupPathNodeState;
};

const COMPETITION_OPTIONS: CompetitionOption[] = [
  { id: 'divisions', label: 'Divisions' },
  { id: 'master-league', label: 'Master League' },
  { id: 'trio-league', label: 'Trio League' },
  { id: 'tier-league', label: 'Tier League' },
  { id: 'team-history', label: 'Team History' },
  { id: 'super-cup', label: 'Super Cup' },
  { id: 'bookieball-cup', label: 'BookieBall Cup' },
  { id: 'master-cup', label: 'Master Cup' },
];

const TRIO_DIVISION_ORDER = ['Premier League', 'Ligue 1', 'Bundesliga'] as const;
const TIER_DIVISION_ORDER = ['Legendary', 'Masters', 'Elite', 'Superior', 'Standard', 'Average', 'Poor', 'Awful'] as const;
const BOOKIEBALL_CUP_PATH = [
  { gw: 'GW2', label: 'R32' },
  { gw: 'GW3', label: 'R16' },
  { gw: 'GW4', label: 'QF' },
  { gw: 'GW5', label: 'SF' },
  { gw: 'GW6', label: 'Final' },
] as const;

const COMPARISON_METRIC_ROW_COUNT = 9;
const COMPARISON_METRIC_ROW_HEIGHT = 84;
const MASTER_CUP_PATH = [
  { stage: 'round_of_16', label: 'R16' },
  { stage: 'quarter_final', label: 'QF' },
  { stage: 'semi_final', label: 'SF' },
  { stage: 'final', label: 'Final' },
] as const;
const BOOKIEBALL_CUP_BRACKET_ROUNDS = [
  { gw: 'GW2', label: 'Round of 32' },
  { gw: 'GW3', label: 'Round of 16' },
  { gw: 'GW4', label: 'Quarterfinals' },
  { gw: 'GW5', label: 'Semifinals' },
  { gw: 'GW6', label: 'Final' },
] as const;
const MASTER_CUP_STAGE_LABELS: Record<MasterCupFixture['stage'], string> = {
  round_of_16: 'Round of 16',
  quarter_final: 'Quarterfinals',
  semi_final: 'Semifinals',
  third_place_playoff: 'Third-Place Playoff',
  final: 'Final',
};

const EDGE_ACCENT = '#79ffb1';
const EDGE_ACCENT_BORDER = 'rgba(121, 255, 177, 0.42)';
const EDGE_ACCENT_BACKGROUND = 'rgba(121, 255, 177, 0.12)';
const EDGE_ACCENT_GLOW = 'rgba(121, 255, 177, 0.26)';
const EDGE_ACCENT_TEXT = '#e6fff0';
const SELECTED_ACCENT = '#8fb7ff';
const SELECTED_ACCENT_BORDER = 'rgba(143, 183, 255, 0.38)';
const SELECTED_ACCENT_BACKGROUND = 'rgba(143, 183, 255, 0.14)';
const CUP_WON_ACCENT = '#7cf2a5';
const CUP_LOST_ACCENT = '#ff8b97';
const CUP_PENDING_ACCENT = '#a9bee8';
const CUP_ENDED_ACCENT = '#7e8999';
const CUP_BYE_ACCENT = '#d9b56e';
const LEGACY_GOLD = '#f3d58a';
const LEGACY_GOLD_BORDER = 'rgba(243, 213, 138, 0.34)';
const LEGACY_GOLD_BACKGROUND = 'rgba(243, 213, 138, 0.12)';

const tileStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
  minHeight: '0',
} as const;

const tileHeaderStyle = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.75rem',
} as const;

const listStyle = {
  display: 'grid',
  gap: '0.5rem',
  maxHeight: '360px',
  overflowY: 'auto',
  paddingRight: '0.2rem',
} as const;

const optionRowStyle = {
  display: 'grid',
  gap: '0.18rem',
  padding: '0.5rem 0.6rem',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'rgba(255, 255, 255, 0.04)',
} as const;

const optionLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  minWidth: 0,
  cursor: 'pointer',
} as const;

const teamMetaStyle = {
  marginLeft: 'auto',
  color: 'rgba(224, 236, 253, 0.72)',
  fontSize: '0.72rem',
  whiteSpace: 'nowrap',
} as const;

const actionRowStyle = {
  marginTop: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
} as const;

const primaryButtonStyle = {
  border: '1px solid rgba(255, 226, 149, 0.5)',
  borderRadius: '999px',
  padding: '0.7rem 1.1rem',
  background: 'linear-gradient(135deg, rgba(255, 214, 112, 0.9), rgba(119, 239, 219, 0.62))',
  color: '#0f2b36',
  fontWeight: 800,
  cursor: 'pointer',
} as const;

const disabledButtonStyle = {
  ...primaryButtonStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
} as const;

const secondaryButtonStyle = {
  border: '1px solid rgba(255, 255, 255, 0.16)',
  borderRadius: '999px',
  padding: '0.65rem 1rem',
  background: 'rgba(255, 255, 255, 0.06)',
  color: '#f7fbff',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const selectionDropdownShellStyle = {
  position: 'relative',
  marginTop: '1rem',
  display: 'inline-flex',
  justifyContent: 'flex-end',
  width: '100%',
  zIndex: 3,
} as const;

const selectionDropdownHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
} as const;

const selectionDropdownToggleStyle = {
  border: '1px solid rgba(255, 222, 150, 0.26)',
  borderRadius: '999px',
  padding: '0.55rem 0.95rem',
  background: 'linear-gradient(180deg, rgba(33, 49, 76, 0.96), rgba(10, 19, 34, 0.98))',
  color: '#fcf4d2',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.55rem',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 10px 22px rgba(3, 10, 22, 0.32)',
} as const;

const selectionDropdownMenuStyle = {
  position: 'absolute',
  top: 'calc(100% + 0.6rem)',
  right: 0,
  minWidth: '320px',
  maxWidth: 'min(92vw, 620px)',
  display: 'grid',
  gap: '0.75rem',
  padding: '0.95rem 1rem',
  borderRadius: '18px',
  border: '1px solid rgba(255, 228, 167, 0.18)',
  background: 'linear-gradient(180deg, rgba(24, 38, 60, 0.98), rgba(7, 13, 24, 0.99))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 20px 40px rgba(3, 10, 22, 0.42)',
  zIndex: 4,
} as const;

const selectionDropdownLabelStyle = {
  display: 'grid',
  gap: '0.14rem',
} as const;

const dropdownActionsStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
} as const;

const chipRowStyle = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
} as const;

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.38rem',
  borderRadius: '999px',
  padding: '0.35rem 0.7rem',
  border: '1px solid rgba(255, 229, 176, 0.16)',
  background: 'linear-gradient(180deg, rgba(36, 53, 81, 0.88), rgba(17, 27, 43, 0.88))',
  color: '#f7fbff',
  fontSize: '0.8rem',
} as const;

const focusFrameStyle: CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  overflow: 'hidden',
  marginTop: '1rem',
  padding: '1.25rem',
  borderRadius: '26px',
  border: '1px solid rgba(255, 238, 186, 0.16)',
  background: 'linear-gradient(180deg, rgba(15, 27, 52, 0.98), rgba(4, 9, 18, 0.99))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 44px rgba(3, 8, 18, 0.5)',
};

const focusAtmosphereStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: [
    'radial-gradient(circle at 50% -8%, rgba(255, 214, 122, 0.18), transparent 28%)',
    'radial-gradient(circle at 18% 28%, rgba(121, 175, 255, 0.18), transparent 22%)',
    'radial-gradient(circle at 84% 24%, rgba(255, 219, 133, 0.16), transparent 20%)',
    'linear-gradient(180deg, rgba(10, 19, 34, 0.05), rgba(4, 8, 16, 0.4))',
  ].join(', '),
  pointerEvents: 'none',
  zIndex: 0,
};

const focusVignetteStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle at 50% 45%, transparent 34%, rgba(1, 4, 10, 0.46) 100%)',
  pointerEvents: 'none',
  zIndex: 0,
};

const floodlightLeftStyle: CSSProperties = {
  position: 'absolute',
  left: '-6%',
  top: '-2%',
  width: '38%',
  height: '72%',
  background: 'radial-gradient(circle at 20% 20%, rgba(152, 206, 255, 0.26), rgba(152, 206, 255, 0.09) 26%, transparent 60%)',
  filter: 'blur(16px)',
  opacity: 0.9,
  pointerEvents: 'none',
  zIndex: 0,
};

const floodlightRightStyle: CSSProperties = {
  position: 'absolute',
  right: '-8%',
  top: '-4%',
  width: '42%',
  height: '72%',
  background: 'radial-gradient(circle at 80% 24%, rgba(255, 220, 130, 0.28), rgba(255, 220, 130, 0.08) 24%, transparent 62%)',
  filter: 'blur(18px)',
  opacity: 0.86,
  pointerEvents: 'none',
  zIndex: 0,
};

const focusFrameInnerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
};

const focusPanelStyle = {
  display: 'grid',
  gap: '0.85rem',
} as const;

const focusHeaderStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  minHeight: '170px',
  padding: '1.15rem 1.2rem',
  borderRadius: '20px',
  border: '1px solid rgba(255, 235, 182, 0.2)',
  background: [
    'linear-gradient(140deg, rgba(22, 41, 71, 0.96), rgba(9, 17, 31, 0.98))',
    'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 2px, rgba(255,255,255,0) 2px 7px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -12px 20px rgba(0,0,0,0.2), 0 14px 28px rgba(0,0,0,0.28)',
};

const focusHeaderGlowStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle at 18% 50%, rgba(255, 225, 150, 0.18), transparent 24%)',
  pointerEvents: 'none',
};

const heroBadgeShellStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  width: '110px',
  height: '110px',
  borderRadius: '28px',
  border: '1px solid rgba(255, 232, 175, 0.22)',
  background: 'linear-gradient(160deg, rgba(30, 46, 72, 0.96), rgba(10, 16, 29, 0.98))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 0 1px rgba(255,255,255,0.04), 0 14px 26px rgba(0,0,0,0.28)',
};

const heroBadgeGlowStyle = (accent: string): CSSProperties => ({
  position: 'absolute',
  inset: '18px',
  borderRadius: '22px',
  background: `radial-gradient(circle, ${accent}44 0%, transparent 72%)`,
  filter: 'blur(10px)',
  pointerEvents: 'none',
});

const heroBadgeFrameStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  placeItems: 'center',
  width: '78px',
  height: '78px',
  borderRadius: '50%',
  border: '2px solid rgba(255, 243, 202, 0.42)',
  background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.2), rgba(255,255,255,0) 58%), rgba(11, 18, 30, 0.5)',
  boxShadow: '0 0 0 6px rgba(255,255,255,0.04), inset 0 3px 8px rgba(255,255,255,0.08)',
};

const focusTitleStyle = {
  display: 'grid',
  gap: '0.28rem',
  minWidth: 0,
} as const;

const heroKickerStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  padding: '0.32rem 0.62rem',
  borderRadius: '999px',
  border: '1px solid rgba(255, 224, 145, 0.18)',
  background: 'linear-gradient(180deg, rgba(52, 69, 98, 0.7), rgba(19, 29, 47, 0.7))',
  color: '#f3dd9d',
  fontSize: '0.68rem',
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
};

const heroNameStyle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(2rem, 3vw, 2.8rem)',
  lineHeight: 0.96,
  fontWeight: 900,
  letterSpacing: '-0.04em',
  color: '#fcf7e3',
  textShadow: '0 8px 22px rgba(0, 0, 0, 0.34)',
};

const heroSublineStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(224, 236, 253, 0.76)',
  fontSize: '0.96rem',
  letterSpacing: '0.04em',
};

const stackedSheenStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 24%)',
  pointerEvents: 'none',
};

const stackedLabelStyle = {
  fontSize: '0.72rem',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgba(220, 231, 247, 0.7)',
} as const;

const competitionHeaderTextStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  fontSize: '0.78rem',
  fontWeight: 900,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

const comparisonIntroStyle: CSSProperties = {
  display: 'grid',
  gap: '0.32rem',
  marginBottom: '1rem',
};

const comparisonSummaryRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.55rem',
  flexWrap: 'wrap',
  marginBottom: '1rem',
};

const comparisonEditorialStripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '0.75rem',
  marginBottom: '1rem',
};

const comparisonEditorialCardStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: '0.2rem',
  padding: '0.8rem 0.9rem',
  borderRadius: '16px',
  border: '1px solid rgba(255, 232, 177, 0.16)',
  background: [
    'linear-gradient(180deg, rgba(26, 39, 61, 0.96), rgba(8, 14, 24, 0.98))',
    'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 42%)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 16px rgba(0,0,0,0.18)',
};

const overallRatingStripStyle: CSSProperties = {
  display: 'grid',
  gap: '0.85rem',
  marginBottom: '1rem',
  padding: '0.95rem 1rem',
  borderRadius: '18px',
  border: '1px solid rgba(255, 232, 177, 0.18)',
  background: [
    'linear-gradient(180deg, rgba(27, 40, 63, 0.96), rgba(7, 13, 24, 0.98))',
    'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 42%)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -12px 18px rgba(0,0,0,0.18), 0 14px 26px rgba(0,0,0,0.2)',
};

const overallRatingHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

const overallRatingTeamRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.55rem',
  flexWrap: 'wrap',
};

const overallRatingTeamChipStyle = (highlighted: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.55rem',
  padding: highlighted ? '0.56rem 0.82rem' : '0.48rem 0.7rem',
  borderRadius: '999px',
  border: `1px solid ${highlighted ? EDGE_ACCENT_BORDER : 'rgba(255,255,255,0.12)'}`,
  background: highlighted
    ? `linear-gradient(180deg, ${EDGE_ACCENT_BACKGROUND}, rgba(25, 37, 58, 0.94))`
    : 'linear-gradient(180deg, rgba(30, 43, 67, 0.82), rgba(14, 22, 35, 0.9))',
  boxShadow: highlighted
    ? `0 0 0 1px rgba(121, 255, 177, 0.16), 0 14px 24px rgba(0,0,0,0.18), 0 0 18px ${EDGE_ACCENT_GLOW}`
    : '0 8px 14px rgba(0,0,0,0.1)',
  color: '#fcf7e3',
  transform: highlighted ? 'translateY(-1px)' : 'none',
});

const overallRatingValueStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 900,
  color: '#fff0bc',
  letterSpacing: '-0.03em',
};

const formBadgeRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.28rem',
  flexWrap: 'wrap',
};

const formBadgeStyle = (result: FormBadgeResult): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '1.45rem',
  padding: '0.18rem 0.32rem',
  borderRadius: '999px',
  border: result === 'W'
    ? '1px solid rgba(104, 220, 153, 0.34)'
    : result === 'D'
      ? '1px solid rgba(196, 208, 224, 0.2)'
      : '1px solid rgba(220, 104, 104, 0.28)',
  background: result === 'W'
    ? 'rgba(60, 173, 99, 0.2)'
    : result === 'D'
      ? 'rgba(132, 146, 167, 0.16)'
      : 'rgba(177, 66, 66, 0.18)',
  color: result === 'W' ? '#dffbe9' : result === 'D' ? '#edf4ff' : '#ffd8d8',
  fontSize: '0.7rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

const comparisonLeaderChipStyle = (): CSSProperties => ({
  ...chipStyle,
  border: `1px solid ${EDGE_ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${EDGE_ACCENT_BACKGROUND}, rgba(17, 27, 43, 0.9))`,
  color: EDGE_ACCENT_TEXT,
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 10px 20px rgba(0,0,0,0.16), 0 0 0 1px rgba(121, 255, 177, 0.12), 0 0 16px rgba(121, 255, 177, 0.14)`,
});

const comparisonGridBaseStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem',
};

const comparisonCardStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: '0.82rem',
  padding: '0.94rem',
  borderRadius: '20px',
  border: '1px solid rgba(255, 232, 177, 0.18)',
  background: [
    'linear-gradient(165deg, rgba(28, 42, 66, 0.98), rgba(8, 14, 25, 0.98))',
    'repeating-linear-gradient(145deg, rgba(255,255,255,0.022) 0 2px, rgba(255,255,255,0) 2px 8px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -12px 18px rgba(0,0,0,0.2), 0 14px 28px rgba(0,0,0,0.24)',
  alignContent: 'start',
};

const prestigeCardStyle: CSSProperties = {
  borderColor: EDGE_ACCENT_BORDER,
  background: [
    'radial-gradient(circle at 18% 18%, rgba(121, 255, 177, 0.13), transparent 26%)',
    'linear-gradient(165deg, rgba(34, 49, 76, 0.99), rgba(10, 16, 28, 0.99))',
    'repeating-linear-gradient(145deg, rgba(255,255,255,0.022) 0 2px, rgba(255,255,255,0) 2px 8px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -12px 18px rgba(0,0,0,0.18), 0 20px 36px rgba(0,0,0,0.3), 0 0 0 1px rgba(121, 255, 177, 0.18), 0 0 26px rgba(121, 255, 177, 0.12)',
};

const subduedCardStyle: CSSProperties = {
  background: [
    'linear-gradient(165deg, rgba(22, 34, 54, 0.97), rgba(7, 12, 21, 0.98))',
    'repeating-linear-gradient(145deg, rgba(255,255,255,0.014) 0 2px, rgba(255,255,255,0) 2px 8px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -10px 16px rgba(0,0,0,0.24), 0 10px 20px rgba(0,0,0,0.18)',
  borderColor: 'rgba(255,255,255,0.1)',
};

const comparisonCardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.85rem',
  minWidth: 0,
  height: '96px',
};

const comparisonCardTitleStyle: CSSProperties = {
  display: 'grid',
  gap: '0.18rem',
  minWidth: 0,
  height: '76px',
  gridTemplateRows: '28px 18px 22px',
  alignContent: 'start',
};

const comparisonMetricListStyle: CSSProperties = {
  display: 'grid',
  gap: '0.38rem',
  gridTemplateRows: `repeat(${COMPARISON_METRIC_ROW_COUNT}, ${COMPARISON_METRIC_ROW_HEIGHT}px)`,
};

const comparisonMetricStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  padding: '0.6rem 0.76rem',
  height: `${COMPARISON_METRIC_ROW_HEIGHT}px`,
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.025))',
  boxSizing: 'border-box',
};

const comparisonMetricLeaderStyle = (): CSSProperties => ({
  ...comparisonMetricStyle,
  border: `1px solid ${EDGE_ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${EDGE_ACCENT_BACKGROUND}, rgba(255,255,255,0.05))`,
  boxShadow: `inset 0 0 0 1px rgba(121, 255, 177, 0.12)`,
});

const comparisonMetricHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateRows: '14px 16px',
  gap: '0.16rem',
  minWidth: 0,
  alignContent: 'center',
};

const comparisonMetricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(150px, 1.2fr) minmax(120px, 0.9fr) 170px',
  alignItems: 'center',
  gap: '0.7rem',
  height: '100%',
};

const comparisonMetricLabelStyle: CSSProperties = {
  fontSize: '0.68rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(224, 236, 253, 0.68)',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const comparisonMetricNoteStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: 'rgba(224, 236, 253, 0.62)',
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const comparisonMetricValueStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 800,
  color: '#fcf7e3',
  lineHeight: 1.1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  height: '100%',
  minWidth: 0,
  textAlign: 'right',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const comparisonMetricMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  width: '170px',
  minWidth: '170px',
  minHeight: '24px',
  height: '100%',
};

const comparisonMetricDeltaStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  maxWidth: '170px',
  padding: '0.18rem 0.46rem',
  borderRadius: '999px',
  border: `1px solid ${EDGE_ACCENT_BORDER}`,
  background: EDGE_ACCENT_BACKGROUND,
  color: EDGE_ACCENT_TEXT,
  fontSize: '0.68rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  alignSelf: 'center',
};

const comparisonMetricMetaEmptyStyle: CSSProperties = {
  ...comparisonMetricDeltaStyle,
  visibility: 'hidden',
};

const metricSweepStyle: CSSProperties = {
  position: 'absolute',
  inset: '-10%',
  background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(121, 255, 177, 0.16), rgba(255,255,255,0))',
  pointerEvents: 'none',
  transform: 'translateX(-110%) skewX(-18deg)',
};

const heroPrestigeTagStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  padding: '0.25rem 0.52rem',
  borderRadius: '999px',
  border: `1px solid ${EDGE_ACCENT_BORDER}`,
  background: EDGE_ACCENT_BACKGROUND,
  color: EDGE_ACCENT_TEXT,
  fontSize: '0.68rem',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

const editorialTagRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  flexWrap: 'nowrap',
  overflowX: 'auto',
  overflowY: 'hidden',
  height: '32px',
  alignItems: 'center',
};

const legacySectionStyle: CSSProperties = {
  display: 'grid',
  gap: '0.72rem',
  paddingTop: '0.2rem',
  alignContent: 'start',
};

const legacyHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: '0.12rem',
  minHeight: '34px',
};

const legacyHeaderTitleStyle: CSSProperties = {
  fontSize: '0.8rem',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontWeight: 900,
  color: LEGACY_GOLD,
};

const legacyHeaderSubtitleStyle: CSSProperties = {
  color: 'rgba(224, 236, 253, 0.62)',
  fontSize: '0.78rem',
};

const legacyGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gridTemplateRows: '78px 78px',
  gap: '0.55rem',
};

const legacyTileStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: '0.22rem',
  padding: '0.72rem 0.78rem',
  minHeight: '78px',
  borderRadius: '14px',
  border: '1px solid rgba(255, 232, 177, 0.14)',
  background: [
    'linear-gradient(180deg, rgba(26, 37, 58, 0.98), rgba(8, 14, 24, 0.98))',
    'repeating-linear-gradient(145deg, rgba(255,255,255,0.02) 0 2px, rgba(255,255,255,0) 2px 8px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 16px rgba(0,0,0,0.22)',
};

const legacyTileGoldStyle = (): CSSProperties => ({
  ...legacyTileStyle,
  border: `1px solid ${LEGACY_GOLD_BORDER}`,
  background: [
    `linear-gradient(180deg, ${LEGACY_GOLD_BACKGROUND}, rgba(13, 18, 29, 0.98))`,
    'repeating-linear-gradient(145deg, rgba(255,255,255,0.03) 0 2px, rgba(255,255,255,0) 2px 8px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -10px 16px rgba(0,0,0,0.24), 0 0 0 1px rgba(243, 213, 138, 0.14)',
});

const legacyTileFullWidthStyle: CSSProperties = {
  gridColumn: '1 / -1',
};

const legacyTileLabelStyle: CSSProperties = {
  fontSize: '0.68rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(224, 236, 253, 0.68)',
};

const legacyTileValueStyle: CSSProperties = {
  fontSize: '1.38rem',
  lineHeight: 1.05,
  fontWeight: 900,
  color: '#fcf7e3',
};

const legacyTileBestFinishValueStyle: CSSProperties = {
  ...legacyTileValueStyle,
  fontSize: '1rem',
  lineHeight: 1.18,
  letterSpacing: '-0.01em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const honoursStripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gridAutoRows: '32px',
  gap: '0.42rem',
  alignItems: 'stretch',
  alignContent: 'start',
  minHeight: '68px',
  maxHeight: '68px',
  overflow: 'hidden',
};

const honourPillStyle = (): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.32rem',
  padding: '0.28rem 0.58rem',
  borderRadius: '999px',
  border: `1px solid ${LEGACY_GOLD_BORDER}`,
  background: `linear-gradient(180deg, ${LEGACY_GOLD_BACKGROUND}, rgba(18, 28, 44, 0.84))`,
  color: '#fcf7e3',
  fontSize: '0.72rem',
  whiteSpace: 'nowrap',
});

const contextDeckStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  marginTop: '1rem',
};

const contextSectionStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '20px',
  border: '1px solid rgba(255, 232, 177, 0.16)',
  background: [
    'linear-gradient(180deg, rgba(24, 36, 57, 0.98), rgba(8, 14, 25, 0.99))',
    'repeating-linear-gradient(145deg, rgba(255,255,255,0.022) 0 2px, rgba(255,255,255,0) 2px 8px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -14px 20px rgba(0,0,0,0.22), 0 18px 30px rgba(0,0,0,0.22)',
};

const contextSectionBodyStyle: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
  padding: '1rem',
};

const contextSectionToolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

const sectionSummaryMetaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.36rem 0.72rem',
  borderRadius: '999px',
  border: '1px solid rgba(255, 232, 177, 0.14)',
  background: 'linear-gradient(180deg, rgba(33, 49, 76, 0.88), rgba(9, 18, 32, 0.92))',
  color: '#f7fbff',
  fontSize: '0.76rem',
};

const contextViewToggleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.22rem',
  padding: '0.24rem',
  borderRadius: '999px',
  border: '1px solid rgba(255, 232, 177, 0.14)',
  background: 'linear-gradient(180deg, rgba(28, 41, 63, 0.92), rgba(8, 14, 24, 0.96))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 16px rgba(0,0,0,0.12)',
};

const contextControlClusterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const contextViewToggleButtonStyle = (active: boolean): CSSProperties => ({
  border: 'none',
  borderRadius: '999px',
  padding: '0.42rem 0.78rem',
  background: active
    ? 'linear-gradient(180deg, rgba(255, 224, 145, 0.92), rgba(121, 175, 255, 0.72))'
    : 'transparent',
  color: active ? '#0f2233' : '#e6eefb',
  fontSize: '0.76rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
});

const contextSelectShellStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.24rem 0.44rem 0.24rem 0.72rem',
  borderRadius: '999px',
  border: '1px solid rgba(255, 232, 177, 0.14)',
  background: 'linear-gradient(180deg, rgba(28, 41, 63, 0.92), rgba(8, 14, 24, 0.96))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 16px rgba(0,0,0,0.12)',
};

const contextSelectStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#f7fbff',
  fontSize: '0.8rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  outline: 'none',
  cursor: 'pointer',
};

const contextSectionIntroStyle: CSSProperties = {
  display: 'grid',
  gap: '0.22rem',
};

const contextGroupGridStyle: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
};

const contextCardStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: '0.75rem',
  padding: '0.9rem 0.95rem',
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: [
    'linear-gradient(180deg, rgba(27, 39, 61, 0.96), rgba(7, 12, 22, 0.98))',
    'repeating-linear-gradient(145deg, rgba(255,255,255,0.018) 0 2px, rgba(255,255,255,0) 2px 8px)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 18px rgba(0,0,0,0.18)',
};

const contextCardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

const contextCardTitleStyle: CSSProperties = {
  display: 'grid',
  gap: '0.14rem',
};

const contextChipStyle = (): CSSProperties => ({
  ...chipStyle,
  border: `1px solid ${SELECTED_ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${SELECTED_ACCENT_BACKGROUND}, rgba(18, 28, 44, 0.88))`,
});

const contextTableScrollStyle: CSSProperties = {
  overflowX: 'auto',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(0, 0, 0, 0.16)',
};

const contextTableStyle: CSSProperties = {
  width: '100%',
  minWidth: '860px',
  borderCollapse: 'collapse',
};

const contextTableHeadCellStyle: CSSProperties = {
  padding: '0.72rem 0.7rem',
  textAlign: 'left',
  fontSize: '0.68rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(224, 236, 253, 0.72)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
};

const contextTableCellStyle: CSSProperties = {
  padding: '0.72rem 0.7rem',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  fontSize: '0.92rem',
  color: '#f7fbff',
  whiteSpace: 'nowrap',
};

const contextTableTeamCellStyle: CSSProperties = {
  ...contextTableCellStyle,
  minWidth: '220px',
};

const contextTableRowStyle: CSSProperties = {
  background: 'transparent',
};

const tableWindowGapCellStyle: CSSProperties = {
  padding: '0.62rem 0.7rem',
  textAlign: 'center',
  color: 'rgba(224, 236, 253, 0.62)',
  fontSize: '0.76rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  borderTop: '1px solid rgba(255,255,255,0.06)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.03)',
};

const contextEmptyStyle: CSSProperties = {
  padding: '1rem',
  borderRadius: '16px',
  border: '1px dashed rgba(255,255,255,0.14)',
  color: 'rgba(224, 236, 253, 0.72)',
  background: 'rgba(255,255,255,0.02)',
};

const teamHistoryDeckStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem',
};

const fixtureListStyle: CSSProperties = {
  display: 'grid',
  gap: '0.55rem',
};

const fixtureRowStyle = (_accent: string | null, highlighted: boolean): CSSProperties => ({
  display: 'grid',
  gap: '0.32rem',
  padding: '0.78rem 0.86rem',
  borderRadius: '14px',
  border: highlighted ? `1px solid ${SELECTED_ACCENT_BORDER}` : '1px solid rgba(255,255,255,0.08)',
  background: highlighted
    ? `linear-gradient(180deg, ${SELECTED_ACCENT_BACKGROUND}, rgba(255,255,255,0.04))`
    : 'rgba(255,255,255,0.03)',
  boxShadow: highlighted ? `inset 4px 0 0 ${SELECTED_ACCENT}` : 'none',
});

const fixtureRowHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

const fixtureMatchupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  flexWrap: 'wrap',
  fontWeight: 800,
  color: '#fcf7e3',
};

const fixtureScoreStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 900,
  color: '#fff1bc',
  letterSpacing: '-0.02em',
};

const fixtureWinnerChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.38rem',
  width: 'fit-content',
  padding: '0.24rem 0.58rem',
  borderRadius: '999px',
  border: `1px solid ${EDGE_ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${EDGE_ACCENT_BACKGROUND}, rgba(14, 26, 18, 0.92))`,
  color: '#effff3',
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(121, 255, 177, 0.14), 0 0 18px ${EDGE_ACCENT_GLOW}`,
  fontSize: '0.72rem',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const cupPathGridStyle: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
};

const cupPathCardStyle: CSSProperties = {
  ...contextCardStyle,
  gap: '0.9rem',
};

const cupPathTimelineStyle: CSSProperties = {
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: 'minmax(170px, 1fr)',
  gap: '0.9rem',
  overflowX: 'auto',
  paddingBottom: '0.25rem',
};

const cupPathTrackStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 28px',
  gap: '0.55rem',
  alignItems: 'stretch',
};

const cupPathConnectorStyle: CSSProperties = {
  position: 'relative',
  alignSelf: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '18px',
  color: 'rgba(255, 232, 177, 0.84)',
  fontSize: '1rem',
  fontWeight: 900,
};

const cupPathConnectorLineStyle: CSSProperties = {
  position: 'absolute',
  left: '2px',
  right: '10px',
  top: '50%',
  height: '2px',
  borderRadius: '999px',
  background: 'linear-gradient(90deg, rgba(169, 190, 232, 0.18), rgba(169, 190, 232, 0.7), rgba(169, 190, 232, 0.18))',
  boxShadow: '0 0 10px rgba(169, 190, 232, 0.22)',
};

const cupPathNodeStyle = (_accent: string, state: CupPathNodeState): CSSProperties => {
  const paletteByState: Record<CupPathNodeState, { border: string; glow: string; background: string; opacity?: number }> = {
    won: {
      border: `${CUP_WON_ACCENT}6b`,
      glow: `${CUP_WON_ACCENT}28`,
      background: `linear-gradient(180deg, ${CUP_WON_ACCENT}2e, rgba(255,255,255,0.04))`,
    },
    champion: {
      border: `${EDGE_ACCENT}75`,
      glow: `${EDGE_ACCENT}33`,
      background: `linear-gradient(180deg, ${EDGE_ACCENT}38, rgba(255,255,255,0.05))`,
    },
    bye: {
      border: `${CUP_BYE_ACCENT}6b`,
      glow: `${CUP_BYE_ACCENT}28`,
      background: `linear-gradient(180deg, ${CUP_BYE_ACCENT}2e, rgba(255,255,255,0.04))`,
    },
    current: {
      border: `${CUP_PENDING_ACCENT}7a`,
      glow: `${CUP_PENDING_ACCENT}2e`,
      background: `linear-gradient(180deg, ${CUP_PENDING_ACCENT}33, rgba(255,255,255,0.05))`,
    },
    future: {
      border: 'rgba(255,255,255,0.1)',
      glow: 'transparent',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
      opacity: 0.78,
    },
    lost: {
      border: `${CUP_LOST_ACCENT}57`,
      glow: `${CUP_LOST_ACCENT}1f`,
      background: `linear-gradient(180deg, ${CUP_LOST_ACCENT}24, rgba(255,255,255,0.03))`,
    },
    ended: {
      border: `${CUP_ENDED_ACCENT}3d`,
      glow: 'transparent',
      background: `linear-gradient(180deg, ${CUP_ENDED_ACCENT}29, rgba(255,255,255,0.03))`,
      opacity: 0.72,
    },
  };
  const palette = paletteByState[state];

  return {
    position: 'relative',
    overflow: 'hidden',
    display: 'grid',
    gap: '0.35rem',
    minHeight: '160px',
    padding: '0.82rem 0.88rem',
    borderRadius: '16px',
    border: `1px solid ${palette.border}`,
    background: [
      palette.background,
      'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 38%)',
      'repeating-linear-gradient(145deg, rgba(255,255,255,0.02) 0 2px, rgba(255,255,255,0) 2px 8px)',
    ].join(', '),
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 16px rgba(0,0,0,0.2), ${palette.glow === 'transparent' ? 'none' : `0 0 0 1px ${palette.glow}, 0 0 18px ${palette.glow}`}`,
    opacity: palette.opacity ?? 1,
  };
};

const cupPathNodeRoundStyle: CSSProperties = {
  fontSize: '0.68rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(224, 236, 253, 0.68)',
};

const cupPathNodeOpponentStyle: CSSProperties = {
  fontSize: '1.02rem',
  fontWeight: 900,
  color: '#fcf7e3',
  lineHeight: 1.15,
};

const cupPathNodeStatusStyle = (state: CupPathNodeState): CSSProperties => ({
  display: 'inline-flex',
  width: 'fit-content',
  padding: '0.22rem 0.5rem',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: state === 'champion' || state === 'bye'
    ? `${CUP_BYE_ACCENT}29`
    : state === 'won'
      ? `${CUP_WON_ACCENT}29`
      : state === 'lost'
        ? `${CUP_LOST_ACCENT}24`
        : state === 'current'
          ? `${CUP_PENDING_ACCENT}29`
          : 'rgba(255,255,255,0.04)',
  fontSize: '0.74rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: state === 'lost'
    ? '#ffd7de'
    : state === 'current'
      ? '#dce9ff'
      : state === 'won' || state === 'champion'
        ? '#e8ffef'
        : '#fff0bc',
});

const cupPathNodeScoreStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 900,
  color: '#fcf7e3',
  letterSpacing: '-0.03em',
};

const honoursTitleStyle: CSSProperties = {
  fontSize: '0.68rem',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgba(224, 236, 253, 0.7)',
};

const DIVISION_STRENGTH_SCORES: Record<string, number> = {
  'Champions Bookies': 20,
  'Premier Bookies': 17,
  'Division 1': 14,
  'Division 2': 11,
  'Division 3': 8,
  'Division 4': 5,
};

const TRIO_BASE_SCORES: Record<string, number> = {
  'Premier League': 10,
  'Ligue 1': 7,
  Bundesliga: 4,
};

const TIER_BASE_SCORES: Record<string, number> = {
  Legendary: 12,
  Masters: 10,
  Elite: 8,
  Superior: 6,
  Standard: 4,
  Average: 3,
  Poor: 2,
  Awful: 1,
};

function toggleString(values: string[], nextValue: string): string[] {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

function toggleNumber(values: number[], nextValue: number): number[] {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

function formatSignedProfit(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function buildStatusText(args: { enabled: boolean; started?: boolean; row: { division: string; rank: number } | null }): { title: string; value: string } {
  if (!args.enabled) {
    return { title: 'Disabled', value: 'No current position' };
  }
  if (args.started === false) {
    return { title: 'Waiting to start', value: 'No current position' };
  }
  if (!args.row) {
    return { title: 'Active', value: 'No current position' };
  }
  return { title: args.row.division, value: `#${args.row.rank}` };
}

function buildOverviewStats(row: AllTimeTableRow | null): TeamMetricSummary {
  if (!row) {
    return {
      gamesPlayed: 0,
      winPct: 0,
      spins: 0,
      profit: 0,
      averageProfitPerWeek: 0,
    };
  }
  const winPct = row.played > 0 ? (row.wins / row.played) * 100 : 0;
  const averageProfitPerWeek = row.played > 0 ? row.profit / row.played : 0;
  return {
    gamesPlayed: row.played,
    winPct,
    spins: row.spins,
    profit: row.profit,
    averageProfitPerWeek,
  };
}

function getDivisionIndex(division: string | null | undefined, season: string | null): number {
  if (!division) {
    return Number.MAX_SAFE_INTEGER;
  }
  const order = getDivisionOrderForSeason(season);
  const index = order.indexOf(division);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function compareDivisionStanding(left: TeamOverviewRecord, right: TeamOverviewRecord, season: string | null): number {
  const leftDivisionIndex = getDivisionIndex(left.divisionPosition?.division ?? left.team.division, season);
  const rightDivisionIndex = getDivisionIndex(right.divisionPosition?.division ?? right.team.division, season);
  if (leftDivisionIndex !== rightDivisionIndex) {
    return leftDivisionIndex - rightDivisionIndex;
  }
  const leftRank = left.divisionPosition?.rank ?? Number.MAX_SAFE_INTEGER;
  const rightRank = right.divisionPosition?.rank ?? Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  if (left.stats.profit !== right.stats.profit) {
    return right.stats.profit - left.stats.profit;
  }
  return left.team.name.localeCompare(right.team.name);
}

function getOrderedCompetitionIndex(order: readonly string[], division: string | null | undefined): number {
  if (!division) {
    return Number.MAX_SAFE_INTEGER;
  }
  const index = order.indexOf(division);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function compareRankOnly(leftRank: number | null | undefined, rightRank: number | null | undefined): number {
  const normalizedLeft = leftRank ?? Number.MAX_SAFE_INTEGER;
  const normalizedRight = rightRank ?? Number.MAX_SAFE_INTEGER;
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft - normalizedRight;
  }
  return 0;
}

function compareCompetitionStanding(
  left: { division: string; rank: number } | null,
  right: { division: string; rank: number } | null,
  order: readonly string[],
): number {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  const leftIndex = getOrderedCompetitionIndex(order, left.division);
  const rightIndex = getOrderedCompetitionIndex(order, right.division);
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }
  return compareRankOnly(left.rank, right.rank);
}

function leaderFrom<T>(items: TeamOverviewRecord[], select: (item: TeamOverviewRecord) => T, compare: (left: T, right: T) => number): TeamOverviewRecord | null {
  return items.reduce<TeamOverviewRecord | null>((best, item) => {
    if (!best) {
      return item;
    }
    return compare(select(item), select(best)) > 0 ? item : best;
  }, null);
}

function leagueHeaderStyle(tone: LeaguePanelTone): CSSProperties {
  if (tone === 'division') {
    return {
      background: 'linear-gradient(180deg, rgba(50, 103, 190, 0.98), rgba(17, 50, 108, 0.98))',
      color: '#fff6d8',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -6px 10px rgba(0,0,0,0.18)',
    };
  }
  if (tone === 'master') {
    return {
      background: 'linear-gradient(180deg, rgba(206, 214, 229, 0.96), rgba(118, 129, 151, 0.96))',
      color: '#091220',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42), inset 0 -6px 10px rgba(0,0,0,0.12)',
    };
  }
  if (tone === 'trio') {
    return {
      background: 'linear-gradient(180deg, rgba(173, 34, 43, 0.98), rgba(104, 17, 24, 0.98))',
      color: '#ffe6bf',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -6px 10px rgba(0,0,0,0.2)',
    };
  }
  if (tone === 'cup') {
    return {
      background: 'linear-gradient(180deg, rgba(197, 146, 54, 0.98), rgba(96, 64, 15, 0.98))',
      color: '#fff5d6',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -6px 10px rgba(0,0,0,0.2)',
    };
  }
  if (tone === 'history') {
    return {
      background: 'linear-gradient(180deg, rgba(88, 44, 132, 0.98), rgba(27, 12, 52, 0.98))',
      color: '#fff1cb',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -6px 10px rgba(0,0,0,0.22)',
    };
  }
  return {
    background: 'linear-gradient(180deg, rgba(53, 56, 65, 0.98), rgba(12, 14, 18, 0.98))',
    color: '#f4d887',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -6px 10px rgba(0,0,0,0.2)',
  };
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function gameweekOrderValue(gw: string | null | undefined): number {
  if (!gw) {
    return Number.MAX_SAFE_INTEGER;
  }
  const match = gw.match(/(\d+)/);
  if (!match?.[1]) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function sortGameweeks(values: Array<string | null | undefined>): string[] {
  return uniqueStrings(values).sort((left, right) => {
    const leftOrder = gameweekOrderValue(left);
    const rightOrder = gameweekOrderValue(right);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.localeCompare(right);
  });
}

function normalizeTeamName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function masterCupStageOrder(stage: MasterCupFixture['stage']): number {
  switch (stage) {
    case 'round_of_16':
      return 0;
    case 'quarter_final':
      return 1;
    case 'semi_final':
      return 2;
    case 'third_place_playoff':
      return 3;
    case 'final':
      return 4;
    default:
      return 9;
  }
}

function groupCupFixturesByRound<T extends { roundName: string }>(fixtures: T[]): Array<{ roundName: string; fixtures: T[] }> {
  const grouped = new Map<string, T[]>();
  fixtures.forEach((fixture) => {
    const current = grouped.get(fixture.roundName) ?? [];
    current.push(fixture);
    grouped.set(fixture.roundName, current);
  });
  return Array.from(grouped.entries()).map(([roundName, roundFixtures]) => ({
    roundName,
    fixtures: roundFixtures,
  }));
}

function getDisplayCompetitionLabels(confirmedCompetitionLabels: string[]): string[] {
  return confirmedCompetitionLabels.length > 0 ? confirmedCompetitionLabels : ['All competitions'];
}

function hasMeaningfulScore(values: Array<number | null | undefined>): boolean {
  return values.some((value) => Number.isFinite(value) && Math.abs(Number(value)) > 0);
}

function formatPathScore(homeValue: number, awayValue: number): string {
  return `${formatSignedProfit(homeValue)} • ${formatSignedProfit(awayValue)}`;
}

function buildCupNodeBase(id: string, roundLabel: string, state: CupPathNodeState, opponent: string, status: string, detail: string, score?: string | null): CupPathNode {
  return { id, roundLabel, state, opponent, status, detail, score };
}

function formatProfitEdge(value: number): string {
  return formatSignedProfit(value);
}

function formatPercentEdge(value: number): string {
  return `+${value.toFixed(1)}%`;
}

function formatAvgEdge(value: number): string {
  return formatSignedProfit(value);
}

function clampScore(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeAgainstBest(value: number, best: number, scale: number): number {
  if (best <= 0) {
    return 0;
  }
  return clampScore(scale * (value / best), scale);
}

function divisionStrengthScore(division: string | null | undefined): number {
  return DIVISION_STRENGTH_SCORES[displayDivisionName(division ?? '')] ?? 0;
}

function masterLeagueScore(rank: number | null | undefined, totalTeams: number): number {
  if (!rank || totalTeams <= 0) {
    return 0;
  }
  if (totalTeams === 1) {
    return 20;
  }
  return clampScore(20 * (1 - ((rank - 1) / (totalTeams - 1))), 20);
}

function trioLeagueScore(row: TrioLeagueRow | null): number {
  if (!row) {
    return 0;
  }
  const base = TRIO_BASE_SCORES[row.division] ?? 0;
  const positionBonus = 5 * (1 - ((row.rank - 1) / 7));
  return clampScore(base + positionBonus, 15);
}

function tierLeagueScore(row: TierLeagueRow | null): number {
  if (!row) {
    return 0;
  }
  const base = TIER_BASE_SCORES[row.division] ?? 0;
  const positionBonus = 3 * (1 - ((row.rank - 1) / 2));
  return clampScore(base + positionBonus, 15);
}

function formPoints(results: FormBadgeResult[]): number {
  return clampScore(results.reduce((sum, result) => (
    sum + (result === 'W' ? 3 : result === 'D' ? 1 : 0)
  ), 0), 15);
}

function renderFormSummary(results: FormBadgeResult[]): string {
  return results.length > 0 ? results.join(' ') : '—';
}

function buildLeagueFormResults(teamName: string, division: string, fixtures: LeagueFixture[]): FormBadgeResult[] {
  return recentForm({
    fixtures,
    include: (fixture) =>
      fixture.result !== 'pending'
      && isOfficialDivisionFixture(fixture.division, fixture.gw)
      && fixture.division === division
      && (fixture.homeTeam === teamName || fixture.awayTeam === teamName),
    resultOf: (fixture) => {
      if (fixture.result === 'draw') {
        return 'D';
      }
      const win = (fixture.result === 'home' && fixture.homeTeam === teamName) || (fixture.result === 'away' && fixture.awayTeam === teamName);
      return win ? 'W' : 'L';
    },
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });
}

function buildMasterFormResults(teamId: number, fixtures: MasterLeagueFixture[]): FormBadgeResult[] {
  return recentForm({
    fixtures,
    include: (fixture) =>
      fixture.result !== 'pending' && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
    resultOf: (fixture) => {
      if (fixture.result === 'draw') {
        return 'D';
      }
      const win = (fixture.result === 'home' && fixture.homeTeamId === teamId) || (fixture.result === 'away' && fixture.awayTeamId === teamId);
      return win ? 'W' : 'L';
    },
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });
}

function buildTrioFormResults(teamId: number, division: string, fixtures: TrioLeagueFixture[]): FormBadgeResult[] {
  return recentForm({
    fixtures,
    include: (fixture) =>
      fixture.result !== 'pending'
      && fixture.stage === 'regular'
      && fixture.division === division
      && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
    resultOf: (fixture) => {
      if (fixture.result === 'draw') {
        return 'D';
      }
      const win = (fixture.result === 'home' && fixture.homeTeamId === teamId) || (fixture.result === 'away' && fixture.awayTeamId === teamId);
      return win ? 'W' : 'L';
    },
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });
}

function buildTierFormResults(teamId: number, fixtures: TierLeagueFixture[]): FormBadgeResult[] {
  return recentForm({
    fixtures,
    include: (fixture) =>
      fixture.result !== 'pending' && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
    resultOf: (fixture) => {
      if (fixture.result === 'draw') {
        return 'D';
      }
      const win = (fixture.result === 'home' && fixture.homeTeamId === teamId) || (fixture.result === 'away' && fixture.awayTeamId === teamId);
      return win ? 'W' : 'L';
    },
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });
}

function buildOverallFormResults(overview: TeamOverviewRecord, context: CompetitionContextData | null): FormBadgeResult[] {
  if (!context) {
    return [];
  }

  const combinedFixtures = [
    ...context.leagueFixtures
      .filter((fixture) =>
        fixture.result !== 'pending'
        && isOfficialDivisionFixture(fixture.division, fixture.gw)
        && (fixture.homeTeam === overview.team.name || fixture.awayTeam === overview.team.name))
      .map((fixture) => ({
        gw: fixture.gw,
        sortOrder: fixture.id,
        result: fixture.result === 'draw'
          ? 'D'
          : ((fixture.result === 'home' && fixture.homeTeam === overview.team.name) || (fixture.result === 'away' && fixture.awayTeam === overview.team.name) ? 'W' : 'L'),
      })),
    ...context.masterLeagueFixtures
      .filter((fixture) =>
        fixture.result !== 'pending' && (fixture.homeTeamId === overview.team.id || fixture.awayTeamId === overview.team.id))
      .map((fixture) => ({
        gw: fixture.gw,
        sortOrder: 1000000 + fixture.id,
        result: fixture.result === 'draw'
          ? 'D'
          : ((fixture.result === 'home' && fixture.homeTeamId === overview.team.id) || (fixture.result === 'away' && fixture.awayTeamId === overview.team.id) ? 'W' : 'L'),
      })),
    ...context.trioLeagueFixtures
      .filter((fixture) =>
        fixture.result !== 'pending'
        && fixture.stage === 'regular'
        && (fixture.homeTeamId === overview.team.id || fixture.awayTeamId === overview.team.id))
      .map((fixture) => ({
        gw: fixture.gw,
        sortOrder: 2000000 + fixture.id,
        result: fixture.result === 'draw'
          ? 'D'
          : ((fixture.result === 'home' && fixture.homeTeamId === overview.team.id) || (fixture.result === 'away' && fixture.awayTeamId === overview.team.id) ? 'W' : 'L'),
      })),
    ...context.tierLeagueFixtures
      .filter((fixture) =>
        fixture.result !== 'pending' && (fixture.homeTeamId === overview.team.id || fixture.awayTeamId === overview.team.id))
      .map((fixture) => ({
        gw: fixture.gw,
        sortOrder: 3000000 + fixture.id,
        result: fixture.result === 'draw'
          ? 'D'
          : ((fixture.result === 'home' && fixture.homeTeamId === overview.team.id) || (fixture.result === 'away' && fixture.awayTeamId === overview.team.id) ? 'W' : 'L'),
      })),
  ];

  return recentForm({
    fixtures: combinedFixtures,
    include: () => true,
    resultOf: (fixture) => fixture.result as FormBadgeResult,
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.sortOrder,
  });
}

function isCompletedBookieBallCupFixture(fixture: CupFixture): boolean {
  return fixture.decidedBy === 'bye'
    ? Boolean(fixture.winnerTeam)
    : fixture.played && fixture.result !== 'pending' && Boolean(fixture.winnerTeam);
}

function isCompletedMasterCupStage(
  stage: MasterCupFixture[],
  referenceFixture: MasterCupFixture,
  resolvedFixture: MasterCupFixture | null,
): boolean {
  if (!resolvedFixture || resolvedFixture.decidedBy === 'pending' || resolvedFixture.winnerTeamId === null) {
    return false;
  }
  if (referenceFixture.stage === 'semi_final') {
    const lastLeg = stage[stage.length - 1] ?? referenceFixture;
    return lastLeg.played && lastLeg.result !== 'pending';
  }
  return referenceFixture.played && referenceFixture.result !== 'pending';
}

function isCompletedSuperCupFixture(fixture: SuperCupFixture): boolean {
  return fixture.played && fixture.result !== 'pending' && fixture.winnerTeamId !== null && fixture.decidedBy !== 'pending';
}

function isPenaltyDecision(
  decidedBy: CupFixture['decidedBy'] | MasterCupFixture['decidedBy'] | SuperCupFixture['decidedBy'] | null | undefined,
): boolean {
  return decidedBy === 'penalties' || decidedBy === 'aggregate_penalties';
}

function buildResolvedCupPathDetail(args: {
  won: boolean;
  decidedBy: CupFixture['decidedBy'] | MasterCupFixture['decidedBy'] | SuperCupFixture['decidedBy'] | null | undefined;
  finalLabel?: string;
}): string {
  if (isPenaltyDecision(args.decidedBy)) {
    return args.won ? 'Won on penalties' : 'Lost on penalties';
  }
  return args.won ? (args.finalLabel ?? 'Complete') : 'Complete';
}

function buildResolvedCupBracketDetail(
  decidedBy: CupFixture['decidedBy'] | MasterCupFixture['decidedBy'] | SuperCupFixture['decidedBy'] | null | undefined,
  fallback: string,
  winnerName?: string | null,
): string {
  if (isPenaltyDecision(decidedBy)) {
    return winnerName ? `${winnerName} won on penalties` : 'Decided on penalties';
  }
  return fallback;
}

export function ReportsHubPage() {
  const reduceMotion = useReducedMotion();
  const [currentSeason, setCurrentSeason] = useState<string | null>(null);
  const [currentGw, setCurrentGw] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [confirmedSelection, setConfirmedSelection] = useState<ConfirmedSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamOverviews, setTeamOverviews] = useState<TeamOverviewRecord[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [teamHistoryStories, setTeamHistoryStories] = useState<Record<number, TeamHistoryStoryRecord>>({});
  const [teamHistoryStoriesLoading, setTeamHistoryStoriesLoading] = useState(false);
  const [teamHistoryStoriesError, setTeamHistoryStoriesError] = useState<string | null>(null);
  const [sectionFixtureStates, setSectionFixtureStates] = useState<Record<string, SectionFixtureState>>({});
  const [competitionContext, setCompetitionContext] = useState<CompetitionContextData | null>(null);
  const [competitionContextLoading, setCompetitionContextLoading] = useState(false);
  const [competitionContextError, setCompetitionContextError] = useState<string | null>(null);
  const [selectionSummaryOpen, setSelectionSummaryOpen] = useState(false);
  const [sectionViewModes, setSectionViewModes] = useState<Record<string, ComparisonViewMode>>({});
  const competitionSelectAllRef = useRef<HTMLInputElement | null>(null);
  const teamSelectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [nextTeams, nextState] = await Promise.all([api.teams(), api.state()]);
        if (active) {
          setTeams(nextTeams);
          setCurrentSeason(nextState.currentSeason);
          setCurrentGw(nextState.currentGw);
        }
      } catch {
        if (active) {
          setError('Unable to load teams right now.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const orderedTeams = useMemo(
    () => [...teams].sort((left, right) => left.name.localeCompare(right.name)),
    [teams],
  );

  const allCompetitionIds = useMemo(
    () => COMPETITION_OPTIONS.map((option) => option.id),
    [],
  );

  const allTeamIds = useMemo(
    () => orderedTeams.map((team) => team.id),
    [orderedTeams],
  );

  const allCompetitionsSelected = selectedCompetitions.length === allCompetitionIds.length;
  const someCompetitionsSelected = selectedCompetitions.length > 0 && !allCompetitionsSelected;
  const allTeamsSelected = allTeamIds.length > 0 && selectedTeams.length === allTeamIds.length;
  const someTeamsSelected = selectedTeams.length > 0 && !allTeamsSelected;

  useEffect(() => {
    if (competitionSelectAllRef.current) {
      competitionSelectAllRef.current.indeterminate = someCompetitionsSelected;
    }
  }, [someCompetitionsSelected]);

  useEffect(() => {
    if (teamSelectAllRef.current) {
      teamSelectAllRef.current.indeterminate = someTeamsSelected;
    }
  }, [someTeamsSelected]);

  const teamById = useMemo(
    () => new Map(orderedTeams.map((team) => [team.id, team])),
    [orderedTeams],
  );

  const teamByNameKey = useMemo(
    () => new Map(orderedTeams.map((team) => [normalizeTeamName(team.name), team])),
    [orderedTeams],
  );

  const effectiveCompetitionIds = useMemo(() => {
    if (!confirmedSelection) {
      return [];
    }
    if (confirmedSelection.teamIds.length > 0 && confirmedSelection.competitionIds.length === 0) {
      return COMPETITION_OPTIONS.map((option) => option.id);
    }
    if (confirmedSelection.competitionIds.length > 0) {
      if (confirmedSelection.teamIds.length === 0) {
        return confirmedSelection.competitionIds;
      }
      return Array.from(new Set([
        ...confirmedSelection.competitionIds,
        'divisions',
        'master-league',
        'trio-league',
        'tier-league',
      ]));
    }
    return [];
  }, [confirmedSelection]);

  const confirmedTeams = useMemo(
    () => orderedTeams.filter((team) => confirmedSelection?.teamIds.includes(team.id)),
    [confirmedSelection, orderedTeams],
  );

  const confirmedCompetitionLabels = useMemo(
    () => COMPETITION_OPTIONS.filter((option) => confirmedSelection?.competitionIds.includes(option.id)).map((option) => option.label),
    [confirmedSelection],
  );

  const activeCompetitionLabels = getDisplayCompetitionLabels(confirmedCompetitionLabels);
  const competitionSummaryCountLabel = confirmedCompetitionLabels.length > 0
    ? `${confirmedCompetitionLabels.length} comps`
    : 'All comps';

  useEffect(() => {
    if (confirmedTeams.length === 0) {
      setTeamOverviews([]);
      setOverviewError(null);
      setOverviewLoading(false);
      return;
    }

    let active = true;

    const loadOverview = async () => {
      setOverviewLoading(true);
      setOverviewError(null);
      try {
        const [allTime, leagueTable, masterLeague, trioLeague, tierLeague, superCupFixtures, teamStatsByTeam, historyResponse, trophyRoom] = await Promise.all([
          api.allTimeLeagues(),
          api.leagueTable(),
          api.masterLeagueTable(),
          api.trioLeagueTable(),
          api.tierLeagueTable(),
          api.superCup().catch(() => [] as SuperCupFixture[]),
          Promise.all(confirmedTeams.map((team) => api.teamStats(team.id).catch(() => null))),
          api.teamSeasonHistoryBulk(confirmedTeams.map((team) => team.id)).catch(() => ({ histories: {} as Record<number, TeamHistoryRow[]> })),
          api.trophyRoom().catch(() => null as TrophyRoomPayload | null),
        ]);

        if (!active) {
          return;
        }

        const divisionRows = Object.values(leagueTable).flatMap((rows) => rows);
        const nextOverviews = confirmedTeams.map((team, index) => {
          const allTimeRow = allTime.pointsTable.find((row) => row.teamId === team.id) ?? null;
          const divisionPosition = divisionRows.find((row) => row.teamId === team.id);
          const masterPosition = masterLeague.table.find((row) => row.teamId === team.id) ?? null;
          const trioRow = trioLeague.table.find((row) => row.teamId === team.id) ?? null;
          const tierRow = tierLeague.table.find((row) => row.teamId === team.id) ?? null;
          const superCupFixture = superCupFixtures.find(
            (fixture) => fixture.homeTeamId === team.id || fixture.awayTeamId === team.id,
          ) ?? null;
          const teamStats = teamStatsByTeam[index] ?? null;
          const teamHistory = historyResponse.histories[team.id] ?? [];

          return {
            team,
            stats: buildOverviewStats(allTimeRow),
            history: teamHistory,
            allTimeRow,
            divisionPosition: divisionPosition
              ? { division: divisionPosition.division, rank: divisionPosition.rank }
              : null,
            masterPosition,
            trio: {
              enabled: trioLeague.enabled,
              row: trioRow,
            },
            tier: {
              enabled: tierLeague.enabled,
              started: tierLeague.started,
              row: tierRow,
            },
            superCup: {
              fixture: superCupFixture,
              wins: teamStats?.superCupWins ?? 0,
              appearances: teamStats?.superCupAppearances ?? 0,
            },
            legacy: buildTeamLegacySummary(team.name, teamHistory, trophyRoom),
          };
        });

        setTeamOverviews(nextOverviews);
      } catch {
        if (active) {
          setOverviewError('Unable to load the selected team overview right now.');
          setTeamOverviews([]);
        }
      } finally {
        if (active) {
          setOverviewLoading(false);
        }
      }
    };

    void loadOverview();

    return () => {
      active = false;
    };
  }, [confirmedTeams]);

  useEffect(() => {
    const needsTeamHistory = effectiveCompetitionIds.includes('team-history');
    if (!needsTeamHistory || confirmedTeams.length === 0) {
      setTeamHistoryStories({});
      setTeamHistoryStoriesLoading(false);
      setTeamHistoryStoriesError(null);
      return;
    }

    let active = true;

    const loadStories = async () => {
      setTeamHistoryStoriesLoading(true);
      setTeamHistoryStoriesError(null);
      try {
        const response = await api.teamHistoryStoryBulk(confirmedTeams.map((team) => team.id));
        if (!active) {
          return;
        }
        setTeamHistoryStories(response.histories);
      } catch {
        if (active) {
          setTeamHistoryStories({});
          setTeamHistoryStoriesError('Unable to build the animated team history right now.');
        }
      } finally {
        if (active) {
          setTeamHistoryStoriesLoading(false);
        }
      }
    };

    void loadStories();

    return () => {
      active = false;
    };
  }, [confirmedTeams, effectiveCompetitionIds]);

  useEffect(() => {
    if (!confirmedSelection || effectiveCompetitionIds.length === 0) {
      setCompetitionContext(null);
      setCompetitionContextError(null);
      setCompetitionContextLoading(false);
      return;
    }

    let active = true;

    const loadContext = async () => {
      setCompetitionContextLoading(true);
      setCompetitionContextError(null);
      try {
        const teamDrivenMode = confirmedSelection.teamIds.length > 0;
        const needsDivisions = effectiveCompetitionIds.includes('divisions') || teamDrivenMode;
        const needsMasterLeague = effectiveCompetitionIds.includes('master-league') || teamDrivenMode;
        const needsTrioLeague = effectiveCompetitionIds.includes('trio-league') || teamDrivenMode;
        const needsTierLeague = effectiveCompetitionIds.includes('tier-league') || teamDrivenMode;
        const needsBookieBallCup = effectiveCompetitionIds.includes('bookieball-cup') || teamDrivenMode;
        const needsMasterCup = effectiveCompetitionIds.includes('master-cup') || teamDrivenMode;
        const needsSuperCup = effectiveCompetitionIds.includes('super-cup') || teamDrivenMode;

        const [
          divisionsData,
          masterLeagueData,
          trioLeagueData,
          tierLeagueData,
          bookieBallCupData,
          masterCupFixtures,
          superCupFixtures,
        ] = await Promise.all([
          needsDivisions
            ? Promise.all([
              api.leagueTable().catch(() => null as LeagueTablePayload | null),
              api.leagueFixtures(undefined, true).catch(() => [] as LeagueFixture[]),
            ])
            : Promise.resolve([null, []] as [LeagueTablePayload | null, LeagueFixture[]]),
          needsMasterLeague
            ? Promise.all([
              api.masterLeagueTable().catch(() => null as MasterLeaguePayload | null),
              api.masterLeagueFixtures(undefined, true).catch(() => [] as MasterLeagueFixture[]),
            ])
            : Promise.resolve([null, []] as [MasterLeaguePayload | null, MasterLeagueFixture[]]),
          needsTrioLeague
            ? Promise.all([
              api.trioLeagueTable().catch(() => null as TrioLeaguePayload | null),
              api.trioLeagueFixtures(undefined, true).catch(() => [] as TrioLeagueFixture[]),
            ])
            : Promise.resolve([null, []] as [TrioLeaguePayload | null, TrioLeagueFixture[]]),
          needsTierLeague
            ? Promise.all([
              api.tierLeagueTable().catch(() => null as TierLeaguePayload | null),
              api.tierLeagueFixtures(undefined, true).catch(() => [] as TierLeagueFixture[]),
            ])
            : Promise.resolve([null, []] as [TierLeaguePayload | null, TierLeagueFixture[]]),
          needsBookieBallCup
            ? Promise.all([
              api.cup(undefined, currentSeason ?? undefined).catch(() => [] as CupFixture[]),
              api.cupStatus().catch(() => [] as CupStatusRow[]),
            ])
            : Promise.resolve([[], []] as [CupFixture[], CupStatusRow[]]),
          needsMasterCup
            ? api.masterCupFixtures(undefined, true).catch(() => [] as MasterCupFixture[])
            : Promise.resolve([] as MasterCupFixture[]),
          needsSuperCup
            ? api.superCup(currentSeason ?? undefined).catch(() => [] as SuperCupFixture[])
            : Promise.resolve([] as SuperCupFixture[]),
        ]);

        if (!active) {
          return;
        }

        setCompetitionContext({
          leagueTable: divisionsData[0],
          leagueFixtures: divisionsData[1],
          masterLeague: masterLeagueData[0],
          masterLeagueFixtures: masterLeagueData[1],
          trioLeague: trioLeagueData[0],
          trioLeagueFixtures: trioLeagueData[1],
          tierLeague: tierLeagueData[0],
          tierLeagueFixtures: tierLeagueData[1],
          cupStatus: bookieBallCupData[1],
          cupFixtures: bookieBallCupData[0],
          masterCupFixtures,
          superCupFixtures,
        });
      } catch {
        if (active) {
          setCompetitionContext(null);
          setCompetitionContextError('Unable to load the selected competition context right now.');
        }
      } finally {
        if (active) {
          setCompetitionContextLoading(false);
        }
      }
    };

    void loadContext();

    return () => {
      active = false;
    };
  }, [confirmedSelection, currentSeason, effectiveCompetitionIds]);

  const explicitCompetitionIds = useMemo(
    () => new Set(confirmedSelection?.competitionIds ?? []),
    [confirmedSelection],
  );

  const sortedTeamOverviews = useMemo(
    () => [...teamOverviews].sort((left, right) => compareDivisionStanding(left, right, currentSeason)),
    [currentSeason, teamOverviews],
  );

  const primaryOverview = sortedTeamOverviews[0] ?? null;
  const primaryConfirmedTeam = primaryOverview?.team ?? confirmedTeams[0] ?? null;

  const comparisonLeaders = useMemo(() => {
    if (sortedTeamOverviews.length < 2) {
      return null;
    }
    const highestDivision = [...sortedTeamOverviews].sort((left, right) => compareDivisionStanding(left, right, currentSeason))[0] ?? null;
    const bestPosition = [...sortedTeamOverviews].sort((left, right) => compareDivisionStanding(left, right, currentSeason))[0] ?? null;
    const masterCandidates = sortedTeamOverviews.filter((item) => item.masterPosition !== null);
    const trioCandidates = sortedTeamOverviews.filter((item) => item.trio.row !== null);
    const tierCandidates = sortedTeamOverviews.filter((item) => item.tier.row !== null);
    const bestMasterLeague = masterCandidates.length > 0
      ? leaderFrom(masterCandidates, (item) => item.masterPosition?.rank ?? Number.MAX_SAFE_INTEGER, (left, right) => right - left)
      : null;
    const bestTrioLeague = trioCandidates.length > 0
      ? [...trioCandidates].sort((left, right) => compareCompetitionStanding(
        left.trio.row ? { division: left.trio.row.division, rank: left.trio.row.rank } : null,
        right.trio.row ? { division: right.trio.row.division, rank: right.trio.row.rank } : null,
        TRIO_DIVISION_ORDER,
      ))[0] ?? null
      : null;
    const bestTierLeague = tierCandidates.length > 0
      ? [...tierCandidates].sort((left, right) => compareCompetitionStanding(
        left.tier.row ? { division: left.tier.row.division, rank: left.tier.row.rank } : null,
        right.tier.row ? { division: right.tier.row.division, rank: right.tier.row.rank } : null,
        TIER_DIVISION_ORDER,
      ))[0] ?? null
      : null;
    const mostProfit = leaderFrom(sortedTeamOverviews, (item) => item.stats.profit, (left, right) => left - right);
    const mostSpins = leaderFrom(sortedTeamOverviews, (item) => item.stats.spins, (left, right) => left - right);
    const bestWinPct = leaderFrom(sortedTeamOverviews, (item) => item.stats.winPct, (left, right) => left - right);
    const bestAvgProfitPerGw = leaderFrom(sortedTeamOverviews, (item) => item.stats.averageProfitPerWeek, (left, right) => left - right);
    return {
      highestDivision,
      bestPosition,
      bestMasterLeague,
      bestTrioLeague,
      bestTierLeague,
      mostProfit,
      mostSpins,
      bestWinPct,
      bestAvgProfitPerGw,
    };
  }, [currentSeason, sortedTeamOverviews]);

  const confirmedTeamIdsSet = useMemo(
    () => new Set(confirmedTeams.map((team) => team.id)),
    [confirmedTeams],
  );

  const confirmedTeamNames = useMemo(
    () => new Set(confirmedTeams.map((team) => team.name)),
    [confirmedTeams],
  );

  const confirmedTeamKeySet = useMemo(
    () => new Set(confirmedTeams.map((team) => normalizeTeamName(team.name))),
    [confirmedTeams],
  );

  const overviewByTeamId = useMemo(
    () => new Map(sortedTeamOverviews.map((overview) => [overview.team.id, overview])),
    [sortedTeamOverviews],
  );

  const comparisonRatings = useMemo(() => {
    if (sortedTeamOverviews.length === 0) {
      return null;
    }

    const masterTeamCount = competitionContext?.masterLeague?.table.length
      ?? Math.max(0, ...sortedTeamOverviews.map((item) => item.masterPosition?.rank ?? 0));
    const maxProfit = Math.max(0, ...sortedTeamOverviews.map((item) => item.stats.profit));
    const maxWinRate = Math.max(0, ...sortedTeamOverviews.map((item) => item.stats.winPct));
    const bestLegacyWeight = Math.max(0, ...sortedTeamOverviews.map((item) => (
      item.legacy.silverware * 2 + item.legacy.leagueTitles * 3 + item.legacy.cupWins * 2
    )));

    const breakdownByTeamId = new Map<number, OverallRatingBreakdown>();

    sortedTeamOverviews.forEach((overview) => {
      const divisionScore = divisionStrengthScore(overview.divisionPosition?.division ?? overview.team.division);
      const masterScore = masterLeagueScore(overview.masterPosition?.rank ?? null, masterTeamCount);
      const trioScore = overview.trio.enabled ? trioLeagueScore(overview.trio.row) : 0;
      const tierScore = overview.tier.enabled && overview.tier.started !== false ? tierLeagueScore(overview.tier.row) : 0;
      const profitEfficiencyScore = normalizeAgainstBest(Math.max(overview.stats.profit, 0), maxProfit, 10);
      const winEfficiencyScore = normalizeAgainstBest(overview.stats.winPct, maxWinRate, 5);
      const efficiencyScore = clampScore(profitEfficiencyScore + winEfficiencyScore, 15);
      const formResults = buildOverallFormResults(overview, competitionContext);
      const formScore = formPoints(formResults);
      const legacyWeight = overview.legacy.silverware * 2 + overview.legacy.leagueTitles * 3 + overview.legacy.cupWins * 2;
      const legacyScore = normalizeAgainstBest(legacyWeight, bestLegacyWeight, 15);
      const total = roundScore(
        divisionScore
        + masterScore
        + trioScore
        + tierScore
        + efficiencyScore
        + formScore
        + legacyScore,
      );

      breakdownByTeamId.set(overview.team.id, {
        divisionScore: roundScore(divisionScore),
        masterScore: roundScore(masterScore),
        trioScore: roundScore(trioScore),
        tierScore: roundScore(tierScore),
        profitEfficiencyScore: roundScore(profitEfficiencyScore),
        winEfficiencyScore: roundScore(winEfficiencyScore),
        efficiencyScore: roundScore(efficiencyScore),
        formScore: roundScore(formScore),
        legacyWeight,
        legacyScore: roundScore(legacyScore),
        total,
        formResults,
      });
    });

    const sortByBreakdown = (select: (breakdown: OverallRatingBreakdown) => number) => (
      [...sortedTeamOverviews].sort((left, right) => {
        const leftBreakdown = breakdownByTeamId.get(left.team.id);
        const rightBreakdown = breakdownByTeamId.get(right.team.id);
        return (rightBreakdown ? select(rightBreakdown) : 0) - (leftBreakdown ? select(leftBreakdown) : 0);
      })
    );

    const overallOrdered = sortByBreakdown((breakdown) => breakdown.total);
    const formOrdered = sortByBreakdown((breakdown) => breakdown.formScore);
    const legacyOrdered = sortByBreakdown((breakdown) => breakdown.legacyScore);
    const efficiencyOrdered = sortByBreakdown((breakdown) => breakdown.efficiencyScore);

    const overallLeader = overallOrdered[0] ?? null;
    const overallRunnerUp = overallOrdered[1] ?? null;
    const formLeader = formOrdered[0] ?? null;
    const formRunnerUp = formOrdered[1] ?? null;
    const legacyLeader = legacyOrdered[0] ?? null;
    const legacyRunnerUp = legacyOrdered[1] ?? null;
    const efficiencyLeader = efficiencyOrdered[0] ?? null;
    const efficiencyRunnerUp = efficiencyOrdered[1] ?? null;

    const summaryItems: EditorialStripItem[] = [];
    if (overallLeader) {
      const overallGap = (breakdownByTeamId.get(overallLeader.team.id)?.total ?? 0) - (overallRunnerUp ? (breakdownByTeamId.get(overallRunnerUp.team.id)?.total ?? 0) : 0);
      summaryItems.push({
        label: 'Overall Edge',
        teamName: overallLeader.team.name,
        detail: overallGap <= 0.3
          ? `${(breakdownByTeamId.get(overallLeader.team.id)?.total ?? 0).toFixed(1)}/100 • neck and neck`
          : `${(breakdownByTeamId.get(overallLeader.team.id)?.total ?? 0).toFixed(1)}/100 • ${overallGap.toFixed(1)} clear`,
      });
    }
    if (formLeader) {
      const formGap = (breakdownByTeamId.get(formLeader.team.id)?.formScore ?? 0) - (formRunnerUp ? (breakdownByTeamId.get(formRunnerUp.team.id)?.formScore ?? 0) : 0);
      summaryItems.push({
        label: 'Form Edge',
        teamName: formLeader.team.name,
        detail: `${(breakdownByTeamId.get(formLeader.team.id)?.formScore ?? 0).toFixed(1)}/15 • ${formGap <= 0.3 ? 'level' : `+${formGap.toFixed(1)}`}`,
      });
    }
    if (legacyLeader) {
      const legacyGap = (breakdownByTeamId.get(legacyLeader.team.id)?.legacyScore ?? 0) - (legacyRunnerUp ? (breakdownByTeamId.get(legacyRunnerUp.team.id)?.legacyScore ?? 0) : 0);
      summaryItems.push({
        label: 'Legacy Edge',
        teamName: legacyLeader.team.name,
        detail: `${(breakdownByTeamId.get(legacyLeader.team.id)?.legacyScore ?? 0).toFixed(1)}/15 • ${legacyGap <= 0.3 ? legacyLeader.legacy.bestFinish : `+${legacyGap.toFixed(1)}`}`,
      });
    }
    if (efficiencyLeader) {
      const efficiencyGap = (breakdownByTeamId.get(efficiencyLeader.team.id)?.efficiencyScore ?? 0) - (efficiencyRunnerUp ? (breakdownByTeamId.get(efficiencyRunnerUp.team.id)?.efficiencyScore ?? 0) : 0);
      summaryItems.push({
        label: 'Efficiency Edge',
        teamName: efficiencyLeader.team.name,
        detail: `${(breakdownByTeamId.get(efficiencyLeader.team.id)?.efficiencyScore ?? 0).toFixed(1)}/15 • ${efficiencyGap <= 0.3 ? 'level' : `+${efficiencyGap.toFixed(1)}`}`,
      });
    }

    const averageFormScore = sortedTeamOverviews.reduce((sum, item) => sum + (breakdownByTeamId.get(item.team.id)?.formScore ?? 0), 0) / sortedTeamOverviews.length;
    const averageEfficiencyScore = sortedTeamOverviews.reduce((sum, item) => sum + (breakdownByTeamId.get(item.team.id)?.efficiencyScore ?? 0), 0) / sortedTeamOverviews.length;

    const tagsByTeamId = new Map<number, string[]>();
    sortedTeamOverviews.forEach((item) => {
      const breakdown = breakdownByTeamId.get(item.team.id);
      if (!breakdown) {
        tagsByTeamId.set(item.team.id, []);
        return;
      }

      const tags = new Set<string>();
      if (overallLeader?.team.id === item.team.id) {
        tags.add('Stronger overall');
      }
      if (formLeader?.team.id === item.team.id && breakdown.formScore > averageFormScore) {
        tags.add('Better form');
      }
      if (efficiencyLeader?.team.id === item.team.id && breakdown.efficiencyScore > averageEfficiencyScore) {
        tags.add('Higher efficiency');
      }
      if (legacyLeader?.team.id === item.team.id) {
        tags.add('Stronger legacy');
      }
      if (comparisonLeaders?.highestDivision?.team.id === item.team.id && overallLeader?.team.id !== item.team.id) {
        tags.add('Division advantage');
      }
      if (comparisonLeaders?.bestMasterLeague?.team.id === item.team.id && comparisonLeaders?.highestDivision?.team.id !== item.team.id) {
        tags.add('Strong in Master League');
      }
      if (legacyLeader?.team.id === item.team.id && formLeader?.team.id !== item.team.id) {
        tags.add('Better legacy, weaker form');
      }
      if (efficiencyLeader?.team.id === item.team.id && comparisonLeaders?.highestDivision?.team.id !== item.team.id) {
        tags.add('High efficiency, lower ladder');
      }
      if (comparisonLeaders?.highestDivision?.team.id === item.team.id
        && efficiencyLeader?.team.id !== item.team.id
        && formLeader?.team.id !== item.team.id) {
        tags.add('League form lagging');
      }
      tagsByTeamId.set(item.team.id, Array.from(tags).slice(0, 3));
    });

    return {
      breakdownByTeamId,
      overallLeader,
      overallRunnerUp,
      formLeader,
      formRunnerUp,
      legacyLeader,
      legacyRunnerUp,
      efficiencyLeader,
      efficiencyRunnerUp,
      summaryItems,
      tagsByTeamId,
      orderedByScore: overallOrdered,
    };
  }, [comparisonLeaders, competitionContext, sortedTeamOverviews]);

  const teamHistorySelected = selectedCompetitions.includes('team-history');
  const missingTeamHistorySelection = teamHistorySelected && selectedTeams.length === 0;
  const canConfirm = (selectedTeams.length > 0 || selectedCompetitions.length > 0) && !missingTeamHistorySelection;
  const selectionStatusLabel = missingTeamHistorySelection
    ? 'Team History needs at least one team selected'
    : `${selectedCompetitions.length > 0 ? `${selectedCompetitions.length} competitions selected` : 'All competitions ready'} • ${selectedTeams.length} teams selected`;

  const primaryAccent = primaryConfirmedTeam?.ringColor ?? primaryConfirmedTeam?.ballColor ?? '#ffd37e';

  const getSectionViewMode = (sectionKey: string, hasHighlights: boolean): ComparisonViewMode => {
    if (!hasHighlights) {
      return 'full';
    }
    return sectionViewModes[sectionKey] ?? 'focused';
  };

  const setSectionViewMode = (sectionKey: string, mode: ComparisonViewMode) => {
    setSectionViewModes((current) => ({ ...current, [sectionKey]: mode }));
  };

  const renderContextSection = (args: {
    key: string;
    tone: LeaguePanelTone;
    title: string;
    summary: string;
    subtitle?: string;
    controls?: ReactNode;
    children: ReactNode;
  }) => (
    <section key={args.key} style={contextSectionStyle}>
      <div style={{ ...competitionHeaderTextStyle, ...leagueHeaderStyle(args.tone), padding: '0.72rem 0.95rem' }}>
        <span>{args.title}</span>
        <span style={{ opacity: 0.84 }}>{args.summary}</span>
      </div>
      <div style={contextSectionBodyStyle}>
        {args.subtitle || args.controls ? (
          <div style={contextSectionToolbarStyle}>
            {args.subtitle ? (
              <div style={contextSectionIntroStyle}>
                <strong style={{ color: '#fcf7e3' }}>{args.subtitle}</strong>
              </div>
            ) : <span />}
            {args.controls}
          </div>
        ) : null}
        {args.children}
      </div>
    </section>
  );

  const renderFormBadges = (results: FormBadgeResult[]) => {
    if (results.length === 0) {
      return <span className="muted">—</span>;
    }
    return (
      <div style={formBadgeRowStyle}>
        {results.map((result, index) => (
          <motion.span
            key={`${result}-${index}`}
            initial={reduceMotion ? false : { opacity: 0, y: 5, scale: index === results.length - 1 ? 0.94 : 0.98 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: index === results.length - 1 ? 1.04 : 1 }}
            transition={reduceMotion ? undefined : { duration: 0.24, delay: index * 0.04, ease: 'easeOut' }}
            style={{
              ...formBadgeStyle(result),
              boxShadow: index === results.length - 1 ? '0 0 0 1px rgba(255,255,255,0.08)' : undefined,
            }}
          >
            {result}
          </motion.span>
        ))}
      </div>
    );
  };

  const buildFocusedIntervals = (rows: Array<LeagueTableRow | MasterLeagueRow | TrioLeagueRow | TierLeagueRow>, highlightTeamIds: Set<number>) => {
    const highlightedIndexes = rows
      .map((row, index) => (highlightTeamIds.has(row.teamId) ? index : -1))
      .filter((index) => index >= 0);

    if (highlightedIndexes.length === 0) {
      return [{ start: 0, end: rows.length - 1 }];
    }

    const intervals = highlightedIndexes
      .map((index) => ({
        start: Math.max(0, index - 2),
        end: Math.min(rows.length - 1, index + 2),
      }))
      .sort((left, right) => left.start - right.start);

    return intervals.reduce<Array<{ start: number; end: number }>>((merged, interval) => {
      const previous = merged[merged.length - 1];
      if (!previous || interval.start > previous.end + 1) {
        merged.push(interval);
        return merged;
      }
      previous.end = Math.max(previous.end, interval.end);
      return merged;
    }, []);
  };

  const renderStandingsTable = (args: {
    title: string;
    subtitle: string;
    rows: Array<LeagueTableRow | MasterLeagueRow | TrioLeagueRow | TierLeagueRow>;
    highlightTeamIds: Set<number>;
    emptyMessage: string;
    formForRow?: (row: LeagueTableRow | MasterLeagueRow | TrioLeagueRow | TierLeagueRow) => FormBadgeResult[];
    viewMode: ComparisonViewMode;
  }) => {
    if (args.rows.length === 0) {
      return <div style={contextEmptyStyle}>{args.emptyMessage}</div>;
    }
    const highlightedCount = args.rows.filter((row) => args.highlightTeamIds.has(row.teamId)).length;
    const intervals = args.viewMode === 'focused'
      ? buildFocusedIntervals(args.rows, args.highlightTeamIds)
      : [{ start: 0, end: args.rows.length - 1 }];
    return (
      <motion.article layout style={contextCardStyle}>
        <div style={contextCardHeaderStyle}>
          <div style={contextCardTitleStyle}>
            <strong style={{ color: '#fcf7e3' }}>{args.title}</strong>
            <span className="muted">{args.subtitle}</span>
          </div>
          {highlightedCount > 0 ? (
            <span style={chipStyle}>{highlightedCount} highlighted</span>
          ) : null}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${args.title}-${args.viewMode}`}
            layout
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={reduceMotion ? undefined : { duration: 0.24, ease: 'easeOut' }}
            style={contextTableScrollStyle}
          >
            <table style={contextTableStyle}>
              <thead>
                <tr>
                  <th style={contextTableHeadCellStyle}>#</th>
                  <th style={contextTableHeadCellStyle}>Club</th>
                  <th style={contextTableHeadCellStyle}>P</th>
                  <th style={contextTableHeadCellStyle}>W</th>
                  <th style={contextTableHeadCellStyle}>D</th>
                  <th style={contextTableHeadCellStyle}>L</th>
                  <th style={contextTableHeadCellStyle}>Profit</th>
                  <th style={contextTableHeadCellStyle}>Spins</th>
                  <th style={contextTableHeadCellStyle}>Pts</th>
                  <th style={contextTableHeadCellStyle}>Form</th>
                </tr>
              </thead>
              <tbody>
                {intervals.map((interval, intervalIndex) => (
                  <AnimatePresence key={`${args.title}-window-${interval.start}-${interval.end}`} initial={false}>
                    <>
                      {intervalIndex > 0 ? (
                        <tr key={`${args.title}-gap-${intervalIndex}`}>
                          <td colSpan={10} style={tableWindowGapCellStyle}>
                            {`${interval.start - intervals[intervalIndex - 1].end - 1} rows hidden in focused view`}
                          </td>
                        </tr>
                      ) : null}
                      {args.rows.slice(interval.start, interval.end + 1).map((row) => {
                        const rowWithColors = row as (LeagueTableRow & { ballColor?: string | null; ringColor?: string | null; textColor?: string | null });
                        const team = teamById.get(row.teamId);
                        const textColor = team?.textColor ?? rowWithColors.textColor;
                        const highlighted = args.highlightTeamIds.has(row.teamId);
                        const formResults = args.formForRow?.(row) ?? [];
                        return (
                          <motion.tr
                            layout
                            key={`${args.title}-${row.teamId}`}
                            initial={reduceMotion ? false : highlighted ? { opacity: 0.7, backgroundColor: 'rgba(255,255,255,0.02)' } : { opacity: 0.92 }}
                            animate={reduceMotion ? undefined : highlighted ? { opacity: 1, backgroundColor: 'rgba(255,255,255,0)' } : { opacity: 1 }}
                            transition={reduceMotion ? undefined : highlighted ? { duration: 0.6, ease: 'easeOut' } : { duration: 0.24 }}
                            style={highlighted
                              ? {
                                ...contextTableRowStyle,
                                background: `linear-gradient(90deg, ${SELECTED_ACCENT_BACKGROUND}, rgba(255,255,255,0.02))`,
                                boxShadow: `inset 4px 0 0 ${SELECTED_ACCENT}, 0 0 24px rgba(143, 183, 255, 0.12)`,
                              }
                              : contextTableRowStyle}
                          >
                            <td style={contextTableCellStyle}>{row.rank}</td>
                            <td style={contextTableTeamCellStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                <TeamBadge
                                  name={row.teamName}
                                  ballColor={team?.ballColor ?? rowWithColors.ballColor ?? null}
                                  ringColor={team?.ringColor ?? rowWithColors.ringColor ?? null}
                                  textColor={textColor ?? null}
                                  size={22}
                                />
                                <span style={{ fontWeight: 800, color: '#fcf7e3' }}>{row.teamName}</span>
                                {highlighted ? (
                                  <motion.span
                                    initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                                    animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                                    transition={reduceMotion ? undefined : { duration: 0.35, delay: 0.12 }}
                                    style={contextChipStyle()}
                                  >
                                    Selected
                                  </motion.span>
                                ) : null}
                              </div>
                            </td>
                            <td style={contextTableCellStyle}>{row.played}</td>
                            <td style={contextTableCellStyle}>{row.wins}</td>
                            <td style={contextTableCellStyle}>{row.draws}</td>
                            <td style={contextTableCellStyle}>{row.losses}</td>
                            <td style={contextTableCellStyle}>{formatSignedProfit(row.profit)}</td>
                            <td style={contextTableCellStyle}>{row.spins}</td>
                            <td style={{ ...contextTableCellStyle, fontWeight: 900, color: '#fff0bc' }}>{row.points}</td>
                            <td style={contextTableCellStyle}>{renderFormBadges(formResults)}</td>
                          </motion.tr>
                        );
                      })}
                    </>
                  </AnimatePresence>
                ))}
              </tbody>
            </table>
          </motion.div>
        </AnimatePresence>
      </motion.article>
    );
  };

  const renderFixtureList = (args: {
    title: string;
    subtitle: string;
    items: Array<{
      id: string | number;
      homeTeam: string;
      awayTeam: string;
      score: string;
      detail: string;
      highlighted: boolean;
      accent: string | null;
      winnerLabel?: string | null;
    }>;
    emptyMessage: string;
  }) => {
    if (args.items.length === 0) {
      return <div style={contextEmptyStyle}>{args.emptyMessage}</div>;
    }
    return (
      <article style={contextCardStyle}>
        <div style={contextCardHeaderStyle}>
          <div style={contextCardTitleStyle}>
            <strong style={{ color: '#fcf7e3' }}>{args.title}</strong>
            <span className="muted">{args.subtitle}</span>
          </div>
        </div>
        <div style={fixtureListStyle}>
          {args.items.map((item) => (
            <div key={item.id} style={fixtureRowStyle(item.accent, item.highlighted)}>
              <div style={fixtureRowHeaderStyle}>
                <div style={fixtureMatchupStyle}>
                  <span>{item.homeTeam}</span>
                  <span className="muted">vs</span>
                  <span>{item.awayTeam}</span>
                </div>
                <span style={fixtureScoreStyle}>{item.score}</span>
              </div>
              {item.winnerLabel ? (
                <span style={fixtureWinnerChipStyle}>{item.winnerLabel}</span>
              ) : null}
              <span className="muted">{item.detail}</span>
            </div>
          ))}
        </div>
      </article>
    );
  };

  const renderCupPathGraphic = (args: {
    key: string;
    team: TeamProfile;
    competitionLabel: string;
    subtitle: string;
    nodes: CupPathNode[];
  }) => {
    return (
      <motion.article
        key={args.key}
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reduceMotion ? undefined : { duration: 0.4, ease: 'easeOut' }}
        style={{
          ...cupPathCardStyle,
          borderColor: 'rgba(255,255,255,0.1)',
          boxShadow: `${cupPathCardStyle.boxShadow}, 0 0 0 1px rgba(169, 190, 232, 0.08)`,
        }}
      >
        <div style={contextCardHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <TeamBadge
              name={args.team.name}
              ballColor={args.team.ballColor}
              ringColor={args.team.ringColor}
              textColor={args.team.textColor}
              size={34}
            />
            <div style={contextCardTitleStyle}>
              <strong style={{ color: '#fcf7e3' }}>{args.competitionLabel} — {args.team.name} Road to the Final</strong>
              <span className="muted">{args.subtitle}</span>
            </div>
          </div>
        </div>
        <div style={cupPathTimelineStyle}>
          {args.nodes.map((node, index) => (
            <div key={node.id} style={cupPathTrackStyle}>
              <motion.div
                style={cupPathNodeStyle('', node.state)}
                initial={reduceMotion ? false : { opacity: 0, x: 10, scale: 0.98 }}
                animate={reduceMotion ? undefined : { opacity: 1, x: 0, scale: node.state === 'current' ? 1.01 : 1 }}
                transition={reduceMotion ? undefined : { duration: 0.34, delay: index * 0.08, ease: 'easeOut' }}
              >
                <span style={cupPathNodeRoundStyle}>{node.roundLabel}</span>
                <strong style={cupPathNodeOpponentStyle}>{node.opponent}</strong>
                <span style={cupPathNodeStatusStyle(node.state)}>{node.status}</span>
                {node.score ? <span style={cupPathNodeScoreStyle}>{node.score}</span> : null}
                <span className="muted">{node.detail}</span>
              </motion.div>
              {index < args.nodes.length - 1 ? (
                <span style={cupPathConnectorStyle}>
                  <motion.span
                    style={cupPathConnectorLineStyle}
                    initial={reduceMotion ? false : { scaleX: 0, opacity: 0.3 }}
                    animate={reduceMotion ? undefined : { scaleX: 1, opacity: 1 }}
                    transition={reduceMotion ? undefined : { duration: 0.3, delay: 0.08 + index * 0.08, ease: 'easeOut' }}
                  />
                  <motion.span
                    aria-hidden="true"
                    initial={reduceMotion ? false : { opacity: 0, x: -3 }}
                    animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                    transition={reduceMotion ? undefined : { duration: 0.24, delay: 0.16 + index * 0.08 }}
                  >
                    →
                  </motion.span>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </motion.article>
    );
  };

  const buildBookieBallCupPath = (team: TeamProfile) => {
    if (!competitionContext) {
      return null;
    }

    const openingFixture = competitionContext.cupFixtures.find(
      (fixture) => fixture.gw === 'GW2' && (fixture.homeTeam === team.name || fixture.awayTeam === team.name),
    );

    if (!openingFixture) {
      return null;
    }

    let currentFixture: CupFixture | null = openingFixture;
    let canProgress = true;
    let routeEnded = false;

    const nodes = BOOKIEBALL_CUP_PATH.map((stage, index) => {
      const fixture = canProgress && currentFixture && currentFixture.gw === stage.gw ? currentFixture : null;
      if (!fixture) {
        return buildCupNodeBase(
          `${team.id}-${stage.gw}`,
          stage.label,
          routeEnded ? 'ended' : 'future',
          routeEnded ? '—' : 'TBD',
          routeEnded ? 'Ended' : 'Pending',
          routeEnded ? 'Not reached' : 'Awaiting opponent',
        );
      }

      const teamIsHome = fixture.homeTeam === team.name;
      const teamIsAway = fixture.awayTeam === team.name;
      const fixtureComplete = isCompletedBookieBallCupFixture(fixture);
      const hasActivity = hasMeaningfulScore([fixture.homeProfit, fixture.awayProfit, fixture.homeSpins, fixture.awaySpins]);
      const opponent = teamIsHome
        ? (fixture.awayTeam ?? (stage.gw === 'GW2' ? 'BYE' : 'TBD'))
        : teamIsAway
          ? (fixture.homeTeam ?? (stage.gw === 'GW2' ? 'BYE' : 'TBD'))
          : 'TBD';

      let state: CupPathNodeState = 'future';
      let status = 'Pending';
      let detail = fixture.homeTeam || fixture.awayTeam ? 'Pending' : 'Awaiting opponent';
      let score: string | null = null;

      if (fixture.decidedBy === 'bye' && (teamIsHome || teamIsAway)) {
        state = 'bye';
        status = 'Bye';
        detail = fixture.winnerTeam === team.name ? 'Advanced automatically' : 'Advances on round close';
        canProgress = true;
      } else if (fixtureComplete && fixture.winnerTeam === team.name) {
        state = stage.gw === 'GW6' ? 'champion' : 'won';
        status = 'Won';
        detail = buildResolvedCupPathDetail({
          won: true,
          decidedBy: fixture.decidedBy,
          finalLabel: stage.gw === 'GW6' ? 'Final result' : 'Complete',
        });
        score = formatPathScore(fixture.homeProfit, fixture.awayProfit);
        canProgress = true;
      } else if (fixtureComplete && fixture.winnerTeam !== team.name) {
        state = 'lost';
        status = 'Lost';
        detail = buildResolvedCupPathDetail({
          won: false,
          decidedBy: fixture.decidedBy,
        });
        score = formatPathScore(fixture.homeProfit, fixture.awayProfit);
        routeEnded = true;
        canProgress = false;
      } else if (fixture.homeTeam && fixture.awayTeam) {
        state = 'current';
        status = hasActivity ? 'Live' : 'Pending';
        detail = hasActivity ? 'In progress' : 'Awaiting result';
        score = hasActivity ? formatPathScore(fixture.homeProfit, fixture.awayProfit) : null;
        canProgress = false;
      } else {
        state = 'future';
        status = 'Pending';
        detail = 'Awaiting opponent';
        canProgress = false;
      }

      const nextStage = BOOKIEBALL_CUP_PATH[index + 1];
      currentFixture = !routeEnded && canProgress && nextStage
        ? competitionContext.cupFixtures.find(
          (candidate) => candidate.gw === nextStage.gw && (candidate.sourceMatchA === fixture.matchNumber || candidate.sourceMatchB === fixture.matchNumber),
        ) ?? null
        : null;

      return buildCupNodeBase(`${team.id}-${stage.gw}`, stage.label, state, opponent, status, detail, score);
    });

    return {
      key: `bookieball-path-${team.id}`,
      team,
      competitionLabel: 'BookieBall Cup',
      subtitle: 'Selected-team route only',
      nodes,
    };
  };

  const buildMasterCupPath = (team: TeamProfile) => {
    if (!competitionContext) {
      return null;
    }

    const openingFixture = competitionContext.masterCupFixtures.find(
      (fixture) => fixture.stage === 'round_of_16' && (fixture.homeTeamId === team.id || fixture.awayTeamId === team.id),
    );

    if (!openingFixture) {
      return null;
    }

    let currentTieSlot = openingFixture.tieSlot;
    let canProgress = true;
    let routeEnded = false;

    const nodes = MASTER_CUP_PATH.map((stageDef) => {
      const stageFixtures = (canProgress ? competitionContext.masterCupFixtures : [])
        .filter((fixture) => fixture.stage === stageDef.stage && fixture.tieSlot === currentTieSlot)
        .sort((left, right) => left.legNumber - right.legNumber || left.id - right.id);

      const referenceFixture = stageFixtures.find((fixture) => fixture.homeTeamId === team.id || fixture.awayTeamId === team.id) ?? stageFixtures[0] ?? null;
      const nextTieSlot = stageDef.stage === 'round_of_16' || stageDef.stage === 'quarter_final'
        ? Math.ceil(currentTieSlot / 2)
        : stageDef.stage === 'semi_final'
          ? 1
          : null;

      if (!referenceFixture) {
        if (!routeEnded && canProgress && nextTieSlot !== null) {
          currentTieSlot = nextTieSlot;
        }
        return buildCupNodeBase(
          `${team.id}-${stageDef.stage}`,
          stageDef.label,
          routeEnded ? 'ended' : 'future',
          routeEnded ? '—' : 'TBD',
          routeEnded ? 'Ended' : 'Pending',
          routeEnded ? 'Not reached' : 'Awaiting opponent',
        );
      }

      const opponent = referenceFixture.homeTeamId === team.id
        ? (referenceFixture.awayTeam ?? 'TBD')
        : referenceFixture.awayTeamId === team.id
          ? (referenceFixture.homeTeam ?? 'TBD')
          : 'TBD';

      const resolvedFixture = [...stageFixtures].reverse().find((fixture) => fixture.winnerTeamId !== null) ?? null;
      const lastLeg = stageFixtures[stageFixtures.length - 1] ?? referenceFixture;
      const hasActivity = stageFixtures.some((fixture) => hasMeaningfulScore([
        fixture.homeProfit,
        fixture.awayProfit,
        fixture.homeSpins,
        fixture.awaySpins,
      ]));

      let state: CupPathNodeState = 'future';
      let status = 'Pending';
      let detail = referenceFixture.homeTeam && referenceFixture.awayTeam ? 'Pending' : 'Awaiting opponent';
      let score: string | null = null;

      const stageComplete = isCompletedMasterCupStage(stageFixtures, referenceFixture, resolvedFixture);

      if (stageComplete && resolvedFixture?.winnerTeamId === team.id) {
        state = stageDef.stage === 'final' ? 'champion' : 'won';
        status = 'Won';
        detail = buildResolvedCupPathDetail({
          won: true,
          decidedBy: resolvedFixture.decidedBy,
          finalLabel: stageDef.stage === 'final' ? 'Final result' : 'Complete',
        });
        canProgress = true;
      } else if (stageComplete && resolvedFixture?.winnerTeamId && resolvedFixture.winnerTeamId !== team.id) {
        state = 'lost';
        status = 'Lost';
        detail = buildResolvedCupPathDetail({
          won: false,
          decidedBy: resolvedFixture.decidedBy,
        });
        routeEnded = true;
        canProgress = false;
      } else if (referenceFixture.homeTeam && referenceFixture.awayTeam) {
        state = 'current';
        status = hasActivity ? 'Live' : 'Pending';
        detail = hasActivity ? 'In progress' : 'Awaiting result';
        canProgress = false;
      } else {
        state = 'future';
        status = 'Pending';
        detail = 'Awaiting opponent';
        canProgress = false;
      }

      if (stageComplete && resolvedFixture) {
        score = stageDef.stage === 'semi_final' && lastLeg.aggregateHomeProfit !== null && lastLeg.aggregateAwayProfit !== null
          ? `Agg ${formatPathScore(lastLeg.aggregateHomeProfit, lastLeg.aggregateAwayProfit)}`
          : formatPathScore(lastLeg.homeProfit, lastLeg.awayProfit);
      } else if (hasActivity) {
        score = formatPathScore(lastLeg.homeProfit, lastLeg.awayProfit);
      }

      if (!routeEnded && canProgress && nextTieSlot !== null) {
        currentTieSlot = nextTieSlot;
      }

      return buildCupNodeBase(`${team.id}-${stageDef.stage}`, stageDef.label, state, opponent, status, detail, score);
    });

    return {
      key: `master-cup-path-${team.id}`,
      team,
      competitionLabel: 'Master Cup',
      subtitle: 'Selected-team route only',
      nodes,
    };
  };

  const buildSuperCupPath = (team: TeamProfile) => {
    if (!competitionContext) {
      return null;
    }
    const fixture = competitionContext.superCupFixtures.find(
      (item) => item.homeTeamId === team.id || item.awayTeamId === team.id,
    );

    if (!fixture) {
      return null;
    }

    const opponent = fixture.homeTeamId === team.id ? fixture.awayTeam : fixture.homeTeam;
    const fixtureComplete = isCompletedSuperCupFixture(fixture);
    const hasActivity = hasMeaningfulScore([fixture.homeProfit, fixture.awayProfit, fixture.homeSpins, fixture.awaySpins]);
    let state: CupPathNodeState = 'current';
    let status = 'Pending';
    let detail = 'Curtain raiser';
    let score: string | null = null;

    if (fixtureComplete && fixture.winnerTeamId === team.id) {
      state = 'champion';
      status = 'Won';
      detail = buildResolvedCupPathDetail({
        won: true,
        decidedBy: fixture.decidedBy,
        finalLabel: 'Final result',
      });
      score = formatPathScore(fixture.homeProfit, fixture.awayProfit);
    } else if (fixtureComplete && fixture.winnerTeamId !== team.id) {
      state = 'lost';
      status = 'Lost';
      detail = buildResolvedCupPathDetail({
        won: false,
        decidedBy: fixture.decidedBy,
        finalLabel: 'Final result',
      });
      score = formatPathScore(fixture.homeProfit, fixture.awayProfit);
    } else if (hasActivity) {
      state = 'current';
      status = 'Live';
      detail = 'Live curtain raiser';
      score = formatPathScore(fixture.homeProfit, fixture.awayProfit);
    } else {
      state = 'current';
      status = 'Pending';
      detail = 'Awaiting result';
    }

    return {
      key: `super-cup-path-${team.id}`,
      team,
      competitionLabel: 'Super Cup',
      subtitle: 'Season-opening prestige fixture',
      nodes: [{
        id: `super-cup-${team.id}`,
        roundLabel: 'Curtain Raiser',
        opponent,
        status,
        detail,
        score,
        state,
      }],
    };
  };

  const getCupEditorialTags = (teamOverview: TeamOverviewRecord): string[] => {
    const tags = new Set<string>();
    const paths = [
      buildBookieBallCupPath(teamOverview.team),
      buildMasterCupPath(teamOverview.team),
      buildSuperCupPath(teamOverview.team),
    ].filter((path): path is NonNullable<typeof path> => path !== null);

    paths.forEach((path) => {
      const activeNodes = path.nodes.filter((node) => node.state !== 'future' && node.state !== 'ended');
      const lostNode = activeNodes.find((node) => node.state === 'lost');
      const wonNode = activeNodes.filter((node) => node.state === 'won' || node.state === 'champion');
      const byeNode = activeNodes.find((node) => node.state === 'bye');
      const currentNode = activeNodes.find((node) => node.state === 'current');

      if (wonNode.some((node) => node.roundLabel === 'QF' || node.roundLabel === 'SF' || node.roundLabel === 'Final' || node.roundLabel === 'Curtain Raiser')) {
        tags.add('Strong cup run');
      }
      if (byeNode || activeNodes.some((node) => node.status === 'Pending' && node.opponent === 'TBD')) {
        tags.add('Favourable draw');
      }
      if (lostNode && (lostNode.roundLabel === 'R32' || lostNode.roundLabel === 'R16' || lostNode.roundLabel === 'QF' || lostNode.roundLabel === 'Curtain Raiser')) {
        tags.add('Eliminated early');
      }
      if (currentNode && path.competitionLabel === 'Super Cup') {
        tags.add('Season opener live');
      }
    });

    if (teamOverview.superCup.fixture?.winnerTeamId === teamOverview.team.id) {
      tags.add('Super Cup winner');
    }

    return Array.from(tags).slice(0, 2);
  };

  type StandingsFixtureItem = {
    id: string | number;
    homeTeam: string;
    awayTeam: string;
    score: string;
    detail: string;
    highlighted: boolean;
    accent: string | null;
    winnerLabel?: string | null;
  };

  const getFixtureHighlightMeta = (homeTeam: string | null | undefined, awayTeam: string | null | undefined) => {
    const homeKey = normalizeTeamName(homeTeam);
    const awayKey = normalizeTeamName(awayTeam);
    const homeHighlighted = homeKey !== '' && confirmedTeamKeySet.has(homeKey);
    const awayHighlighted = awayKey !== '' && confirmedTeamKeySet.has(awayKey);
    const accentTeam = homeHighlighted
      ? teamByNameKey.get(homeKey) ?? null
      : awayHighlighted
        ? teamByNameKey.get(awayKey) ?? null
        : null;
    return {
      highlighted: homeHighlighted || awayHighlighted,
      accent: accentTeam?.ringColor ?? accentTeam?.ballColor ?? null,
    };
  };

  const getDefaultSectionFixtureGw = (availableGameweeks: string[]) => {
    if (currentGw && availableGameweeks.includes(currentGw)) {
      return currentGw;
    }
    return availableGameweeks[availableGameweeks.length - 1] ?? currentGw ?? null;
  };

  const getSectionFixtureEnabled = (sectionKey: string) => sectionFixtureStates[sectionKey]?.enabled ?? false;

  const getSectionFixtureGameweek = (sectionKey: string, availableGameweeks: string[]) => {
    const saved = sectionFixtureStates[sectionKey]?.gw;
    if (saved && availableGameweeks.includes(saved)) {
      return saved;
    }
    return getDefaultSectionFixtureGw(availableGameweeks);
  };

  const setSectionFixtureEnabled = (sectionKey: string, enabled: boolean, availableGameweeks: string[]) => {
    setSectionFixtureStates((current) => ({
      ...current,
      [sectionKey]: {
        enabled,
        gw: current[sectionKey]?.gw ?? getDefaultSectionFixtureGw(availableGameweeks),
      },
    }));
  };

  const setSectionFixtureGameweek = (sectionKey: string, gw: string) => {
    setSectionFixtureStates((current) => ({
      ...current,
      [sectionKey]: {
        enabled: current[sectionKey]?.enabled ?? true,
        gw,
      },
    }));
  };

  const filterFixtureItemsForViewMode = (sectionKey: string, hasHighlights: boolean, items: StandingsFixtureItem[]) => {
    if (getSectionViewMode(sectionKey, hasHighlights) !== 'focused' || !hasHighlights) {
      return items;
    }
    return items.filter((item) => item.highlighted);
  };

  const buildStandardFixtureItem = (args: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeProfit: number;
    awayProfit: number;
    homeSpins: number;
    awaySpins: number;
    result: 'home' | 'away' | 'draw' | 'pending';
    liveDetail: string;
    pendingDetail: string;
    winLabel: string;
  }): StandingsFixtureItem => {
    const live = hasMeaningfulScore([args.homeProfit, args.awayProfit, args.homeSpins, args.awaySpins]);
    const winnerName = args.result === 'home'
      ? args.homeTeam
      : args.result === 'away'
        ? args.awayTeam
        : null;
    return {
      id: args.id,
      homeTeam: args.homeTeam,
      awayTeam: args.awayTeam,
      score: live || args.result !== 'pending' ? formatPathScore(args.homeProfit, args.awayProfit) : 'Pending',
      winnerLabel: args.result === 'draw'
        ? 'Draw'
        : winnerName && args.result !== 'pending'
          ? `Winner • ${winnerName}`
          : null,
      detail: args.result === 'pending'
        ? (live ? args.liveDetail : args.pendingDetail)
        : args.result === 'draw'
          ? 'Finished level'
          : `${winnerName} won ${args.winLabel}`,
      ...getFixtureHighlightMeta(args.homeTeam, args.awayTeam),
    };
  };

  const renderLeagueContextControls = (
    sectionKey: string,
    highlightedCount: number,
    fixtureOptions?: { availableGameweeks: string[]; selectedGw: string | null; enabled: boolean },
  ) => {
    const hasHighlights = highlightedCount > 0;
    const viewMode = getSectionViewMode(sectionKey, hasHighlights);
    return (
      <div style={contextControlClusterStyle}>
        <span style={sectionSummaryMetaStyle}>
          <strong>{highlightedCount}</strong>
          <span>{highlightedCount === 1 ? 'highlighted club' : 'highlighted clubs'}</span>
        </span>
        <div style={contextViewToggleStyle}>
          <button
            type="button"
            style={contextViewToggleButtonStyle(viewMode === 'focused')}
            onClick={() => setSectionViewMode(sectionKey, 'focused')}
            disabled={!hasHighlights}
          >
            Focused View
          </button>
          <button
            type="button"
            style={contextViewToggleButtonStyle(viewMode === 'full')}
            onClick={() => setSectionViewMode(sectionKey, 'full')}
          >
            Full Table
          </button>
        </div>
        {fixtureOptions ? (
          <>
            <div style={contextViewToggleStyle}>
              <button
                type="button"
                style={contextViewToggleButtonStyle(fixtureOptions.enabled)}
                onClick={() => setSectionFixtureEnabled(sectionKey, !fixtureOptions.enabled, fixtureOptions.availableGameweeks)}
                disabled={fixtureOptions.availableGameweeks.length === 0}
              >
                Fixtures
              </button>
            </div>
            {fixtureOptions.enabled ? (
              <label style={contextSelectShellStyle}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(224, 236, 253, 0.72)' }}>
                  Gameweek
                </span>
                <select
                  value={fixtureOptions.selectedGw ?? ''}
                  onChange={(event) => setSectionFixtureGameweek(sectionKey, event.target.value)}
                  style={contextSelectStyle}
                  disabled={fixtureOptions.availableGameweeks.length === 0}
                >
                  {fixtureOptions.availableGameweeks.length === 0 ? <option value="">No GWs</option> : null}
                  {fixtureOptions.availableGameweeks.map((gw) => (
                    <option key={`${sectionKey}-fixture-gw-${gw}`} value={gw}>
                      {gw}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : null}
      </div>
    );
  };

  const renderSectionFixtureList = (args: {
    sectionKey: string;
    title: string;
    subtitle: string;
    highlightCount: number;
    items: StandingsFixtureItem[];
    emptyMessage: string;
    enabled: boolean;
  }) => {
    if (!args.enabled) {
      return null;
    }
    const visibleItems = filterFixtureItemsForViewMode(args.sectionKey, args.highlightCount > 0, args.items);
    return renderFixtureList({
      title: args.title,
      subtitle: args.subtitle,
      items: visibleItems,
      emptyMessage: args.highlightCount > 0 && getSectionViewMode(args.sectionKey, true) === 'focused'
        ? `No selected clubs are involved here for ${args.subtitle}.`
        : args.emptyMessage,
    });
  };

  const renderTeamHistorySection = () => {
    if (!effectiveCompetitionIds.includes('team-history')) {
      return null;
    }
    const cupRoundValue = (roundLabel: string) => {
      const index = BOOKIEBALL_CUP_PATH.findIndex((stage) => stage.label === roundLabel);
      return index >= 0 ? BOOKIEBALL_CUP_PATH.length - index : 1;
    };
    const masterCupRoundValue = (roundLabel: string) => {
      const index = MASTER_CUP_PATH.findIndex((stage) => stage.label === roundLabel);
      return index >= 0 ? MASTER_CUP_PATH.length - index : 1;
    };
    const storyEntries = sortedTeamOverviews
      .map((overview) => {
        const story = teamHistoryStories[overview.team.id] ?? null;
        if (!story) {
          return null;
        }
        const bookieBallPath = buildBookieBallCupPath(overview.team);
        const masterCupPath = buildMasterCupPath(overview.team);
        const cupJourney = bookieBallPath
          ? bookieBallPath.nodes
            .filter((node) => node.state !== 'future' && node.state !== 'ended')
            .map((node) => ({
              label: node.roundLabel,
              value: cupRoundValue(node.roundLabel),
              badge: `${node.roundLabel} • ${node.status}`,
              detail: `${node.status} • ${node.opponent}${node.score ? ` • ${node.score}` : ''}${node.detail ? ` • ${node.detail}` : ''}`,
            }))
          : [];
        const masterCupJourney = masterCupPath
          ? masterCupPath.nodes
            .filter((node) => node.state !== 'future' && node.state !== 'ended')
            .map((node) => ({
              label: node.roundLabel,
              value: masterCupRoundValue(node.roundLabel),
              badge: `${node.roundLabel} • ${node.status}`,
              detail: `${node.status} • ${node.opponent}${node.score ? ` • ${node.score}` : ''}${node.detail ? ` • ${node.detail}` : ''}`,
            }))
          : [];
        return {
          team: {
            name: overview.team.name,
            ballColor: overview.team.ballColor,
            ringColor: overview.team.ringColor,
            textColor: overview.team.textColor,
          },
          story,
          cupJourney,
          masterCupJourney,
        };
      })
      .filter((entry): entry is {
        team: { name: string; ballColor: string | null; ringColor: string | null; textColor: string | null };
        story: TeamHistoryStoryRecord;
        cupJourney: Array<{ label: string; value: number; badge: string; detail: string }>;
        masterCupJourney: Array<{ label: string; value: number; badge: string; detail: string }>;
      } => entry !== null);

    return renderContextSection({
      key: 'team-history-context',
      tone: 'history',
      title: 'Team History',
      summary: sortedTeamOverviews.length > 0 ? `${sortedTeamOverviews.length} clubs` : 'Select teams',
      subtitle: 'One shared animated story tile, comparing all selected teams on the same graph',
      children: teamHistoryStoriesError ? (
        <div style={contextEmptyStyle}>{teamHistoryStoriesError}</div>
      ) : storyEntries.length > 0 ? (
        <div style={teamHistoryDeckStyle}>
          <TeamHistoryStoryTile entries={storyEntries} />
        </div>
      ) : teamHistoryStoriesLoading || overviewLoading ? (
        <div style={contextEmptyStyle}>Loading team history...</div>
      ) : (
        <div style={contextEmptyStyle}>Select at least one team to unlock Team History.</div>
      ),
    });
  };

  const renderBookieBallCupFullContext = () => {
    if (!competitionContext || competitionContext.cupFixtures.length === 0) {
      return <div style={contextEmptyStyle}>No BookieBall Cup bracket is available yet.</div>;
    }

    const rounds: CompetitionBracketRound[] = BOOKIEBALL_CUP_BRACKET_ROUNDS.map((round) => ({
      key: round.gw,
      label: round.label,
      ties: competitionContext.cupFixtures
        .filter((fixture) => fixture.gw === round.gw)
        .slice()
        .sort((left, right) => left.matchNumber - right.matchNumber || left.id - right.id)
        .map((fixture) => {
          const isByeFixture = fixture.decidedBy === 'bye';
          const homeName = fixture.homeTeam ?? (isByeFixture && fixture.awayTeam ? 'BYE' : 'TBD');
          const awayName = fixture.awayTeam ?? (isByeFixture && fixture.homeTeam ? 'BYE' : 'TBD');
          const homeMeta = teamByNameKey.get(normalizeTeamName(homeName)) ?? null;
          const awayMeta = teamByNameKey.get(normalizeTeamName(awayName)) ?? null;
          const fixtureComplete = isCompletedBookieBallCupFixture(fixture);
          const hasActivity = hasMeaningfulScore([fixture.homeProfit, fixture.awayProfit, fixture.homeSpins, fixture.awaySpins]);
          const selectedTie = confirmedTeamKeySet.has(normalizeTeamName(homeName)) || confirmedTeamKeySet.has(normalizeTeamName(awayName));
          const winnerKey = normalizeTeamName(fixture.winnerTeam);
          const homeWinner = fixtureComplete && winnerKey !== '' && winnerKey === normalizeTeamName(homeName);
          const awayWinner = fixtureComplete && winnerKey !== '' && winnerKey === normalizeTeamName(awayName);
          const teamsLocked = Boolean(fixture.homeTeam) && (Boolean(fixture.awayTeam) || fixture.decidedBy === 'bye');
          const statusLabel = isByeFixture
            ? 'Bye'
            : fixtureComplete
              ? 'Won'
              : teamsLocked
                ? (hasActivity ? 'Live' : 'Pending')
                : 'TBD';
          const detail = isByeFixture
            ? (fixture.winnerTeam ? 'Advanced automatically' : 'Advances on round close')
            : fixtureComplete
              ? buildResolvedCupBracketDetail(
                fixture.decidedBy,
                round.gw === 'GW6' ? 'Final result' : 'Complete',
                fixture.winnerTeam,
              )
              : teamsLocked
                ? (hasActivity ? 'In progress' : 'Awaiting result')
                : 'Awaiting bracket';

          return {
            id: `bookieball-bracket-${fixture.id}`,
            title: fixture.roundName,
            detail,
            statusLabel,
            active: !fixtureComplete && teamsLocked && (hasActivity || fixture.gw === currentGw),
            resolved: fixtureComplete,
            winnerPath: selectedTie,
            home: {
              teamName: homeName,
              score: fixtureComplete || hasActivity ? formatSignedProfit(fixture.homeProfit) : null,
              winner: homeWinner,
              ballColor: homeMeta?.ballColor ?? null,
              ringColor: homeMeta?.ringColor ?? null,
              textColor: homeMeta?.textColor ?? null,
            },
            away: {
              teamName: awayName,
              score: fixtureComplete || hasActivity ? formatSignedProfit(fixture.awayProfit) : null,
              winner: awayWinner,
              ballColor: awayMeta?.ballColor ?? null,
              ringColor: awayMeta?.ringColor ?? null,
              textColor: awayMeta?.textColor ?? null,
            },
          } satisfies CompetitionBracketTie;
        }),
    })).filter((round) => round.ties.length > 0);

    return (
      <div className={`reports-cup-bracket-shell${confirmedTeams.length > 0 ? ' has-selection' : ''}`}>
        <CompetitionBracketTree
          kicker="Cup Bracket"
          title="BookieBall Cup Bracket"
          subtitle={confirmedTeams.length > 0
            ? 'Selected clubs stay highlighted inside the full knockout bracket.'
            : 'Full knockout tree with both sides feeding inward to the final.'}
          rounds={rounds}
          fullNames
          showMeta
          summary={competitionContext.cupStatus.length > 0
            ? competitionContext.cupStatus.map((status) => `${status.roundName}: ${status.resolvedFixtures}/${status.playableFixtures}`)
            : [`${competitionContext.cupFixtures.length} ties loaded`]}
        />
      </div>
    );
  };

  const renderMasterCupFullContext = () => {
    if (!competitionContext || competitionContext.masterCupFixtures.length === 0) {
      return <div style={contextEmptyStyle}>No Master Cup bracket is available yet.</div>;
    }

    const stageFixtures = competitionContext.masterCupFixtures
      .slice()
      .sort((left, right) => masterCupStageOrder(left.stage) - masterCupStageOrder(right.stage) || left.tieSlot - right.tieSlot || left.legNumber - right.legNumber);

    const groupedByStage = stageFixtures.reduce((map, fixture) => {
      const list = map.get(fixture.stage) ?? [];
      list.push(fixture);
      map.set(fixture.stage, list);
      return map;
    }, new Map<MasterCupFixture['stage'], MasterCupFixture[]>());

    const mapSingleLegTie = (fixture: MasterCupFixture, idPrefix: string): CompetitionBracketTie => {
      const homeName = fixture.homeTeam ?? 'TBD';
      const awayName = fixture.awayTeam ?? 'TBD';
      const homeMeta = fixture.homeTeamId !== null ? teamById.get(fixture.homeTeamId) ?? null : null;
      const awayMeta = fixture.awayTeamId !== null ? teamById.get(fixture.awayTeamId) ?? null : null;
      const fixtureComplete = isCompletedMasterCupStage([fixture], fixture, fixture.winnerTeamId !== null ? fixture : null);
      const hasActivity = hasMeaningfulScore([fixture.homeProfit, fixture.awayProfit, fixture.homeSpins, fixture.awaySpins]);
      const selectedTie = (fixture.homeTeamId !== null && confirmedTeamIdsSet.has(fixture.homeTeamId))
        || (fixture.awayTeamId !== null && confirmedTeamIdsSet.has(fixture.awayTeamId));
      const teamsLocked = Boolean(fixture.homeTeam) && Boolean(fixture.awayTeam);
      return {
        id: `${idPrefix}-${fixture.id}`,
        title: fixture.roundName,
        detail: fixtureComplete
          ? buildResolvedCupBracketDetail(
            fixture.decidedBy,
            fixture.stage === 'third_place_playoff' ? 'Third-place playoff' : fixture.roundName,
            fixture.winnerTeam,
          )
          : fixture.stage === 'third_place_playoff'
            ? 'Third-place playoff'
            : fixture.roundName,
        statusLabel: fixtureComplete ? 'Won' : teamsLocked ? (hasActivity ? 'Live' : 'Pending') : 'TBD',
        active: !fixtureComplete && teamsLocked && (hasActivity || fixture.gw === currentGw),
        resolved: fixtureComplete,
        winnerPath: selectedTie,
        home: {
          teamName: homeName,
          score: fixtureComplete || hasActivity ? formatSignedProfit(fixture.homeProfit) : null,
          winner: fixtureComplete && fixture.winnerTeamId === fixture.homeTeamId,
          ballColor: homeMeta?.ballColor ?? null,
          ringColor: homeMeta?.ringColor ?? null,
          textColor: homeMeta?.textColor ?? null,
        },
        away: {
          teamName: awayName,
          score: fixtureComplete || hasActivity ? formatSignedProfit(fixture.awayProfit) : null,
          winner: fixtureComplete && fixture.winnerTeamId === fixture.awayTeamId,
          ballColor: awayMeta?.ballColor ?? null,
          ringColor: awayMeta?.ringColor ?? null,
          textColor: awayMeta?.textColor ?? null,
        },
      };
    };

    const aggregateSemiFinalTie = (tieSlot: number, fixtures: MasterCupFixture[]): CompetitionBracketTie | null => {
      if (fixtures.length === 0) {
        return null;
      }
      const ordered = fixtures.slice().sort((left, right) => left.legNumber - right.legNumber || left.id - right.id);
      const base = ordered[0];
      const homeName = base.homeTeam ?? 'TBD';
      const awayName = base.awayTeam ?? 'TBD';
      const homeMeta = base.homeTeamId !== null ? teamById.get(base.homeTeamId) ?? null : null;
      const awayMeta = base.awayTeamId !== null ? teamById.get(base.awayTeamId) ?? null : null;
      let homeAggregate = 0;
      let awayAggregate = 0;
      ordered.forEach((fixture) => {
        if (fixture.homeTeam && normalizeTeamName(fixture.homeTeam) === normalizeTeamName(homeName)) {
          homeAggregate += fixture.homeProfit;
          awayAggregate += fixture.awayProfit;
        } else {
          homeAggregate += fixture.awayProfit;
          awayAggregate += fixture.homeProfit;
        }
      });
      const resolvedFixture = ordered.find((fixture) => fixture.winnerTeamId !== null) ?? null;
      const fixtureComplete = isCompletedMasterCupStage(ordered, base, resolvedFixture);
      const hasActivity = ordered.some((fixture) => hasMeaningfulScore([fixture.homeProfit, fixture.awayProfit, fixture.homeSpins, fixture.awaySpins]));
      const selectedTie = ordered.some((fixture) => (
        (fixture.homeTeamId !== null && confirmedTeamIdsSet.has(fixture.homeTeamId))
        || (fixture.awayTeamId !== null && confirmedTeamIdsSet.has(fixture.awayTeamId))
      ));
      const teamsLocked = Boolean(base.homeTeam) && Boolean(base.awayTeam);

      return {
        id: `master-cup-semi-${tieSlot}`,
        title: `Tie ${tieSlot}`,
        detail: fixtureComplete
          ? buildResolvedCupBracketDetail(resolvedFixture?.decidedBy, 'Aggregate semifinal', resolvedFixture?.winnerTeam)
          : 'Aggregate semifinal',
        statusLabel: fixtureComplete ? 'Won' : teamsLocked ? (hasActivity ? 'Live' : 'Pending') : 'TBD',
        active: !fixtureComplete && teamsLocked && (hasActivity || ordered.some((fixture) => fixture.gw === currentGw)),
        resolved: fixtureComplete,
        winnerPath: selectedTie,
        home: {
          teamName: homeName,
          score: fixtureComplete || hasActivity ? formatSignedProfit(homeAggregate) : null,
          winner: fixtureComplete && resolvedFixture?.winnerTeamId === base.homeTeamId,
          ballColor: homeMeta?.ballColor ?? null,
          ringColor: homeMeta?.ringColor ?? null,
          textColor: homeMeta?.textColor ?? null,
        },
        away: {
          teamName: awayName,
          score: fixtureComplete || hasActivity ? formatSignedProfit(awayAggregate) : null,
          winner: fixtureComplete && resolvedFixture?.winnerTeamId === base.awayTeamId,
          ballColor: awayMeta?.ballColor ?? null,
          ringColor: awayMeta?.ringColor ?? null,
          textColor: awayMeta?.textColor ?? null,
        },
      };
    };

    const rounds: CompetitionBracketRound[] = [
      {
        key: 'round_of_16',
        label: MASTER_CUP_STAGE_LABELS.round_of_16,
        ties: (groupedByStage.get('round_of_16') ?? [])
          .slice()
          .sort((left, right) => left.tieSlot - right.tieSlot || left.id - right.id)
          .map((fixture) => mapSingleLegTie(fixture, 'master-cup-r16')),
      },
      {
        key: 'quarter_final',
        label: MASTER_CUP_STAGE_LABELS.quarter_final,
        ties: (groupedByStage.get('quarter_final') ?? [])
          .slice()
          .sort((left, right) => left.tieSlot - right.tieSlot || left.id - right.id)
          .map((fixture) => mapSingleLegTie(fixture, 'master-cup-qf')),
      },
      {
        key: 'semi_final',
        label: MASTER_CUP_STAGE_LABELS.semi_final,
        ties: Array.from(
          (groupedByStage.get('semi_final') ?? []).reduce((map, fixture) => {
            const list = map.get(fixture.tieSlot) ?? [];
            list.push(fixture);
            map.set(fixture.tieSlot, list);
            return map;
          }, new Map<number, MasterCupFixture[]>()),
        )
          .sort((left, right) => left[0] - right[0])
          .map(([tieSlot, fixtures]) => aggregateSemiFinalTie(tieSlot, fixtures))
          .filter((value): value is CompetitionBracketTie => value !== null),
      },
      {
        key: 'final',
        label: MASTER_CUP_STAGE_LABELS.final,
        ties: (groupedByStage.get('final') ?? [])
          .slice()
          .sort((left, right) => left.tieSlot - right.tieSlot || left.id - right.id)
          .slice(0, 1)
          .map((fixture) => mapSingleLegTie(fixture, 'master-cup-final')),
      },
    ].filter((round) => round.ties.length > 0);

    const thirdPlaceTieFixture = (groupedByStage.get('third_place_playoff') ?? [])
      .slice()
      .sort((left, right) => left.tieSlot - right.tieSlot || left.id - right.id)[0] ?? null;

    return (
      <div className={`reports-cup-bracket-shell${confirmedTeams.length > 0 ? ' has-selection' : ''}`}>
        <CompetitionBracketTree
          kicker="Cup Bracket"
          title="Master Cup Bracket"
          subtitle={confirmedTeams.length > 0
            ? 'Selected clubs stay highlighted inside the seeded knockout tree.'
            : 'Seeded knockout bracket progressing inward to the final.'}
          rounds={rounds}
          fullNames
          showMeta
          summary={[
            `${competitionContext.masterCupFixtures.length} fixtures in the current tree`,
            'Two-legged semifinals stay aggregated inside the bracket',
          ]}
          sideMatch={thirdPlaceTieFixture ? mapSingleLegTie(thirdPlaceTieFixture, 'master-cup-third') : null}
          sideMatchLabel={thirdPlaceTieFixture ? 'Third-place playoff' : undefined}
        />
      </div>
    );
  };

  const renderCompetitionContext = () => {
    if (!competitionContext || effectiveCompetitionIds.length === 0) {
      return null;
    }

    const sections: ReactNode[] = [];
    const divisionOrder = getDivisionOrderForSeason(currentSeason);

    if (effectiveCompetitionIds.includes('divisions')) {
      const sectionKey = 'divisions-context';
      const availableDivisionNames = uniqueStrings([
        ...divisionOrder.filter((division) => Boolean(competitionContext.leagueTable?.[division]?.length)),
        ...Object.keys(competitionContext.leagueTable ?? {}),
      ]);
      const divisionFixtureGameweeks = sortGameweeks(competitionContext.leagueFixtures.map((fixture) => fixture.gw));
      const divisionFixturesEnabled = getSectionFixtureEnabled(sectionKey);
      const divisionFixtureGw = getSectionFixtureGameweek(sectionKey, divisionFixtureGameweeks);
      const relevantDivisionNames = uniqueStrings(
        confirmedTeams.map((team) => overviewByTeamId.get(team.id)?.divisionPosition?.division ?? team.division),
      );
      const divisionsToRender = confirmedTeams.length === 0
        ? availableDivisionNames
        : (relevantDivisionNames.length > 0 ? relevantDivisionNames : availableDivisionNames);

      sections.push(renderContextSection({
        key: sectionKey,
        tone: 'division',
        title: 'Divisions',
        summary: `${divisionsToRender.length} tables`,
        subtitle: confirmedTeams.length === 0
          ? 'Competition-led division context'
          : 'Selected teams are spotlighted inside their live division tables',
        controls: renderLeagueContextControls(sectionKey, confirmedTeams.length, {
          availableGameweeks: divisionFixtureGameweeks,
          selectedGw: divisionFixtureGw,
          enabled: divisionFixturesEnabled,
        }),
        children: (
          <div style={contextGroupGridStyle}>
            {divisionsToRender.map((division) => {
              const rows = competitionContext.leagueTable?.[division] ?? [];
              const highlightTeamIds = new Set(
                confirmedTeams
                  .filter((team) => (overviewByTeamId.get(team.id)?.divisionPosition?.division ?? team.division) === division)
                  .map((team) => team.id),
              );
              const viewMode = getSectionViewMode(sectionKey, highlightTeamIds.size > 0);
              const fixtureItems = divisionFixtureGw
                ? competitionContext.leagueFixtures
                  .filter((fixture) => fixture.division === division && fixture.gw === divisionFixtureGw)
                  .sort((left, right) => left.id - right.id)
                  .map((fixture) => buildStandardFixtureItem({
                    id: `division-${fixture.id}`,
                    homeTeam: fixture.homeTeam,
                    awayTeam: fixture.awayTeam,
                    homeProfit: fixture.homeProfit,
                    awayProfit: fixture.awayProfit,
                    homeSpins: fixture.homeSpins,
                    awaySpins: fixture.awaySpins,
                    result: fixture.result,
                    liveDetail: 'Live division fixture',
                    pendingDetail: 'Scheduled division fixture',
                    winLabel: 'the division fixture',
                  }))
                : [];
              return (
                <div key={`division-table-${division}`}>
                  {renderStandingsTable({
                    title: displayDivisionName(division),
                    subtitle: currentGw ? `${currentSeason ?? 'Current season'} • ${currentGw}` : 'Current standings',
                    rows,
                    highlightTeamIds,
                    emptyMessage: 'No division standings are available for this group yet.',
                    formForRow: (row) => buildLeagueFormResults(row.teamName, division, competitionContext.leagueFixtures),
                    viewMode,
                  })}
                  {renderSectionFixtureList({
                    sectionKey,
                    title: `${displayDivisionName(division)} Fixtures`,
                    subtitle: divisionFixtureGw ? `${divisionFixtureGw} fixture list` : 'No gameweek selected',
                    highlightCount: highlightTeamIds.size,
                    items: fixtureItems,
                    emptyMessage: divisionFixtureGw
                      ? `No fixtures are available for ${displayDivisionName(division)} in ${divisionFixtureGw}.`
                      : 'No fixtures are available yet.',
                    enabled: divisionFixturesEnabled,
                  })}
                </div>
              );
            })}
          </div>
        ),
      }));
    }

    if (effectiveCompetitionIds.includes('master-league')) {
      const sectionKey = 'master-context';
      const masterFixtureGameweeks = sortGameweeks(competitionContext.masterLeagueFixtures.map((fixture) => fixture.gw));
      const masterFixturesEnabled = getSectionFixtureEnabled(sectionKey);
      const masterFixtureGw = getSectionFixtureGameweek(sectionKey, masterFixtureGameweeks);
      const masterViewMode = getSectionViewMode(sectionKey, confirmedTeamIdsSet.size > 0);
      const masterFixtureItems = masterFixtureGw
        ? competitionContext.masterLeagueFixtures
          .filter((fixture) => fixture.gw === masterFixtureGw)
          .sort((left, right) => left.id - right.id)
          .map((fixture) => buildStandardFixtureItem({
            id: `master-league-${fixture.id}`,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            homeProfit: fixture.homeProfit,
            awayProfit: fixture.awayProfit,
            homeSpins: fixture.homeSpins,
            awaySpins: fixture.awaySpins,
            result: fixture.result,
            liveDetail: 'Live cross-league fixture',
            pendingDetail: 'Scheduled cross-league fixture',
            winLabel: 'the Master League fixture',
          }))
        : [];
      sections.push(renderContextSection({
        key: sectionKey,
        tone: 'master',
        title: 'Master League',
        summary: competitionContext.masterLeague ? `${competitionContext.masterLeague.table.length} clubs` : 'Unavailable',
        subtitle: confirmedTeams.length === 0
          ? 'Full cross-league context'
          : 'Selected teams are highlighted inside the current Master League table',
        controls: renderLeagueContextControls(sectionKey, confirmedTeamIdsSet.size, {
          availableGameweeks: masterFixtureGameweeks,
          selectedGw: masterFixtureGw,
          enabled: masterFixturesEnabled,
        }),
        children: (
          <div style={contextGroupGridStyle}>
            {renderStandingsTable({
              title: 'Master League Table',
              subtitle: competitionContext.masterLeague?.gw ? `${currentSeason ?? 'Current season'} • ${competitionContext.masterLeague.gw}` : 'Current standings',
              rows: competitionContext.masterLeague?.table ?? [],
              highlightTeamIds: confirmedTeamIdsSet,
              emptyMessage: 'Master League standings are unavailable right now.',
              formForRow: (row) => buildMasterFormResults(row.teamId, competitionContext.masterLeagueFixtures),
              viewMode: masterViewMode,
            })}
            {renderSectionFixtureList({
              sectionKey,
              title: 'Master League Fixtures',
              subtitle: masterFixtureGw ? `${masterFixtureGw} fixture list` : 'No gameweek selected',
              highlightCount: confirmedTeamIdsSet.size,
              items: masterFixtureItems,
              emptyMessage: masterFixtureGw
                ? `No Master League fixtures are available in ${masterFixtureGw}.`
                : 'No Master League fixtures are available yet.',
              enabled: masterFixturesEnabled,
            })}
          </div>
        ),
      }));
    }

    if (effectiveCompetitionIds.includes('trio-league')) {
      const sectionKey = 'trio-context';
      const trioRows = competitionContext.trioLeague?.table ?? [];
      const trioFixtureGameweeks = sortGameweeks(competitionContext.trioLeagueFixtures.map((fixture) => fixture.gw));
      const trioFixturesEnabled = getSectionFixtureEnabled(sectionKey);
      const trioFixtureGw = getSectionFixtureGameweek(sectionKey, trioFixtureGameweeks);
      const trioAvailable = TRIO_DIVISION_ORDER.filter((division) => trioRows.some((row) => row.division === division));
      const trioRelevant = uniqueStrings(sortedTeamOverviews.map((overview) => overview.trio.row?.division));
      const trioToRender = confirmedTeams.length === 0
        ? trioAvailable
        : (trioRelevant.length > 0 ? trioRelevant : trioAvailable);
      const trioHighlightCount = sortedTeamOverviews.filter((overview) => overview.trio.row !== null).length;
      const trioStageLabel = (stage: TrioLeagueFixture['stage']) => {
        switch (stage) {
          case 'playoff_semi':
            return 'Playoff Semifinal';
          case 'playoff_final':
            return 'Playoff Final';
          default:
            return 'Regular Season';
        }
      };

      sections.push(renderContextSection({
        key: sectionKey,
        tone: 'trio',
        title: 'Trio League',
        summary: competitionContext.trioLeague?.enabled ? `${trioRows.length} clubs` : 'Inactive',
        subtitle: competitionContext.trioLeague?.enabled
          ? 'Grouped by trio division'
          : 'Trio League is not active in the current season',
        controls: competitionContext.trioLeague?.enabled ? renderLeagueContextControls(sectionKey, trioHighlightCount, {
          availableGameweeks: trioFixtureGameweeks,
          selectedGw: trioFixtureGw,
          enabled: trioFixturesEnabled,
        }) : undefined,
        children: competitionContext.trioLeague?.enabled ? (
          <div style={contextGroupGridStyle}>
            {trioToRender.map((division) => {
              const rows = trioRows.filter((row) => row.division === division);
              const highlightTeamIds = new Set(
                sortedTeamOverviews
                  .filter((overview) => overview.trio.row?.division === division)
                  .map((overview) => overview.team.id),
              );
              const viewMode = getSectionViewMode(sectionKey, highlightTeamIds.size > 0);
              const fixtureItems = trioFixtureGw
                ? competitionContext.trioLeagueFixtures
                  .filter((fixture) => fixture.division === division && fixture.gw === trioFixtureGw)
                  .sort((left, right) => left.groupSlot - right.groupSlot || left.id - right.id)
                  .map((fixture) => buildStandardFixtureItem({
                    id: `trio-${fixture.id}`,
                    homeTeam: fixture.homeTeam,
                    awayTeam: fixture.awayTeam,
                    homeProfit: fixture.homeProfit,
                    awayProfit: fixture.awayProfit,
                    homeSpins: fixture.homeSpins,
                    awaySpins: fixture.awaySpins,
                    result: fixture.result,
                    liveDetail: `Live ${trioStageLabel(fixture.stage).toLowerCase()} tie`,
                    pendingDetail: `Scheduled ${trioStageLabel(fixture.stage).toLowerCase()} tie`,
                    winLabel: 'the Trio League fixture',
                  }))
                : [];
              return (
                <div key={`trio-table-${division}`}>
                  {renderStandingsTable({
                    title: division,
                    subtitle: competitionContext.trioLeague?.gw ? `${currentSeason ?? 'Current season'} • ${competitionContext.trioLeague.gw}` : 'Current standings',
                    rows,
                    highlightTeamIds,
                    emptyMessage: 'No trio standings are available for this division yet.',
                    formForRow: (row) => buildTrioFormResults(row.teamId, division, competitionContext.trioLeagueFixtures),
                    viewMode,
                  })}
                  {renderSectionFixtureList({
                    sectionKey,
                    title: `${division} Fixtures`,
                    subtitle: trioFixtureGw ? `${trioFixtureGw} fixture list` : 'No gameweek selected',
                    highlightCount: highlightTeamIds.size,
                    items: fixtureItems,
                    emptyMessage: trioFixtureGw
                      ? `No Trio League fixtures are available for ${division} in ${trioFixtureGw}.`
                      : 'No Trio League fixtures are available yet.',
                    enabled: trioFixturesEnabled,
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={contextEmptyStyle}>Trio League is not available in the current season.</div>
        ),
      }));
    }

    if (effectiveCompetitionIds.includes('tier-league')) {
      const sectionKey = 'tier-context';
      const tierRows = competitionContext.tierLeague?.table ?? [];
      const tierFixtureGameweeks = sortGameweeks(competitionContext.tierLeagueFixtures.map((fixture) => fixture.gw));
      const tierFixturesEnabled = getSectionFixtureEnabled(sectionKey);
      const tierFixtureGw = getSectionFixtureGameweek(sectionKey, tierFixtureGameweeks);
      const tierAvailable = TIER_DIVISION_ORDER.filter((division) => tierRows.some((row) => row.division === division));
      const tierRelevant = uniqueStrings(sortedTeamOverviews.map((overview) => overview.tier.row?.division));
      const tierToRender = confirmedTeams.length === 0
        ? tierAvailable
        : (tierRelevant.length > 0 ? tierRelevant : tierAvailable);
      const tierHighlightCount = sortedTeamOverviews.filter((overview) => overview.tier.row !== null).length;

      sections.push(renderContextSection({
        key: sectionKey,
        tone: 'tier',
        title: 'Tier League',
        summary: competitionContext.tierLeague?.enabled ? `${tierRows.length} clubs` : 'Inactive',
        subtitle: competitionContext.tierLeague?.started === false
          ? 'Tier League is active but has not started yet'
          : 'Grouped by tier division',
        controls: competitionContext.tierLeague?.enabled ? renderLeagueContextControls(sectionKey, tierHighlightCount, {
          availableGameweeks: tierFixtureGameweeks,
          selectedGw: tierFixtureGw,
          enabled: tierFixturesEnabled,
        }) : undefined,
        children: competitionContext.tierLeague?.enabled ? (
          competitionContext.tierLeague.started === false ? (
            <div style={contextEmptyStyle}>Tier League has not started yet for the current season.</div>
          ) : (
            <div style={contextGroupGridStyle}>
              {tierToRender.map((division) => {
                const rows = tierRows.filter((row) => row.division === division);
                const highlightTeamIds = new Set(
                  sortedTeamOverviews
                    .filter((overview) => overview.tier.row?.division === division)
                    .map((overview) => overview.team.id),
                );
                const viewMode = getSectionViewMode(sectionKey, highlightTeamIds.size > 0);
                const fixtureItems = tierFixtureGw
                  ? competitionContext.tierLeagueFixtures
                    .filter((fixture) => fixture.division === division && fixture.gw === tierFixtureGw)
                    .sort((left, right) => left.groupSlot - right.groupSlot || left.id - right.id)
                    .map((fixture) => buildStandardFixtureItem({
                      id: `tier-${fixture.id}`,
                      homeTeam: fixture.homeTeam,
                      awayTeam: fixture.awayTeam,
                      homeProfit: fixture.homeProfit,
                      awayProfit: fixture.awayProfit,
                      homeSpins: fixture.homeSpins,
                      awaySpins: fixture.awaySpins,
                      result: fixture.result,
                      liveDetail: `Live ${fixture.fixtureType === 'cross' ? 'cross-division' : 'division'} tie`,
                      pendingDetail: `Scheduled ${fixture.fixtureType === 'cross' ? 'cross-division' : 'division'} tie`,
                      winLabel: 'the Tier League fixture',
                    }))
                  : [];
                return (
                  <div key={`tier-table-${division}`}>
                    {renderStandingsTable({
                      title: division,
                      subtitle: competitionContext.tierLeague?.gw ? `${currentSeason ?? 'Current season'} • ${competitionContext.tierLeague.gw}` : 'Current standings',
                      rows,
                      highlightTeamIds,
                      emptyMessage: 'No tier standings are available for this division yet.',
                      formForRow: (row) => buildTierFormResults(row.teamId, competitionContext.tierLeagueFixtures),
                      viewMode,
                    })}
                    {renderSectionFixtureList({
                      sectionKey,
                      title: `${division} Fixtures`,
                      subtitle: tierFixtureGw ? `${tierFixtureGw} fixture list` : 'No gameweek selected',
                      highlightCount: highlightTeamIds.size,
                      items: fixtureItems,
                      emptyMessage: tierFixtureGw
                        ? `No Tier League fixtures are available for ${division} in ${tierFixtureGw}.`
                        : 'No Tier League fixtures are available yet.',
                      enabled: tierFixturesEnabled,
                    })}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div style={contextEmptyStyle}>Tier League is not available in the current season.</div>
        ),
      }));
    }

    if (effectiveCompetitionIds.includes('super-cup')) {
      const fixture = competitionContext.superCupFixtures[0] ?? null;
      const superCupPaths = confirmedTeams.map((team) => buildSuperCupPath(team)).filter((path) => path !== null);
      const explicitSuperCup = explicitCompetitionIds.has('super-cup');
      if (confirmedTeams.length > 0 && superCupPaths.length === 0 && !explicitSuperCup) {
        // Skip the standalone opener unless one of the selected teams is actually in it.
      } else {
      const superCupSelected = fixture
        ? confirmedTeamIdsSet.has(fixture.homeTeamId) || confirmedTeamIdsSet.has(fixture.awayTeamId)
        : false;
      const superCupAccent = fixture
        ? (teamById.get(fixture.homeTeamId)?.ringColor ?? teamById.get(fixture.homeTeamId)?.ballColor ?? '#ffd37e')
        : '#ffd37e';
      const superCupComplete = fixture ? isCompletedSuperCupFixture(fixture) : false;
      const superCupLive = fixture ? hasMeaningfulScore([fixture.homeProfit, fixture.awayProfit, fixture.homeSpins, fixture.awaySpins]) : false;

      sections.push(renderContextSection({
        key: 'super-cup-context',
        tone: 'cup',
        title: 'Super Cup',
        summary: confirmedTeams.length > 0 && !explicitSuperCup ? `${superCupPaths.length} team paths` : (fixture ? fixture.gw : 'Unavailable'),
        subtitle: confirmedTeams.length > 0
          ? (explicitSuperCup ? 'Selected-team opener paths first, then full context' : 'Selected-team opener paths only')
          : 'Standalone curtain-raiser',
        children: (
          <div style={contextGroupGridStyle}>
            {superCupPaths.length > 0 ? (
              <div style={cupPathGridStyle}>
                {superCupPaths.map((path) => renderCupPathGraphic(path))}
              </div>
            ) : confirmedTeams.length > 0 && explicitSuperCup ? (
              <div style={contextEmptyStyle}>None of the selected teams are part of the current Super Cup fixture.</div>
            ) : null}

            {(explicitSuperCup || confirmedTeams.length === 0) ? (
              fixture ? renderFixtureList({
                title: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
                subtitle: fixture.pairingExplanation,
                items: [{
                  id: fixture.id,
                  homeTeam: fixture.homeTeam,
                  awayTeam: fixture.awayTeam,
                  score: superCupComplete || superCupLive
                    ? formatPathScore(fixture.homeProfit, fixture.awayProfit)
                    : 'GW1',
                  winnerLabel: superCupComplete && fixture.winnerTeam
                    ? `Winner • ${fixture.winnerTeam}`
                    : null,
                  detail: superCupComplete
                    ? buildResolvedCupBracketDetail(fixture.decidedBy, 'Final result', fixture.winnerTeam)
                    : superCupLive
                      ? 'Live curtain raiser'
                      : 'Pending',
                  highlighted: superCupSelected,
                  accent: superCupAccent,
                }],
                emptyMessage: 'No Super Cup fixture is available yet.',
              }) : (
                <div style={contextEmptyStyle}>No Super Cup fixture is available for the current season yet.</div>
              )
            ) : null}
          </div>
        ),
      }));
      }
    }

    if (effectiveCompetitionIds.includes('bookieball-cup')) {
      const bookieBallPaths = confirmedTeams.map((team) => buildBookieBallCupPath(team)).filter((path) => path !== null);
      const explicitBookieBallCup = explicitCompetitionIds.has('bookieball-cup');
      const showBookieBallBracket = explicitBookieBallCup || confirmedTeams.length === 0;

      if (confirmedTeams.length === 0 || bookieBallPaths.length > 0 || explicitBookieBallCup) {
        sections.push(renderContextSection({
          key: 'bookieball-cup-context',
          tone: 'cup',
          title: 'BookieBall Cup',
          summary: showBookieBallBracket
            ? (competitionContext.cupFixtures.length > 0 ? `${competitionContext.cupFixtures.length} ties` : 'Unavailable')
            : `${bookieBallPaths.length} team paths`,
          subtitle: confirmedTeams.length > 0
            ? (showBookieBallBracket ? 'Full knockout bracket with selected clubs highlighted' : 'Selected-team paths only')
            : 'Full knockout bracket',
          children: (
            <div style={contextGroupGridStyle}>
              {!showBookieBallBracket && bookieBallPaths.length > 0 ? (
                <div style={cupPathGridStyle}>
                  {bookieBallPaths.map((path) => renderCupPathGraphic(path))}
                </div>
              ) : !showBookieBallBracket && confirmedTeams.length > 0 && explicitBookieBallCup ? (
                <div style={contextEmptyStyle}>None of the selected teams currently have a visible BookieBall Cup route.</div>
              ) : null}

              {showBookieBallBracket ? renderBookieBallCupFullContext() : null}
            </div>
          ),
        }));
      }
    }

    if (effectiveCompetitionIds.includes('master-cup')) {
      const masterCupPaths = confirmedTeams.map((team) => buildMasterCupPath(team)).filter((path) => path !== null);
      const explicitMasterCup = explicitCompetitionIds.has('master-cup');
      const showMasterCupBracket = explicitMasterCup || confirmedTeams.length === 0;

      if (confirmedTeams.length === 0 || masterCupPaths.length > 0 || explicitMasterCup) {
        sections.push(renderContextSection({
          key: 'master-cup-context',
          tone: 'cup',
          title: 'Master Cup',
          summary: showMasterCupBracket
            ? (competitionContext.masterCupFixtures.length > 0 ? `${competitionContext.masterCupFixtures.length} fixtures` : 'Unavailable')
            : `${masterCupPaths.length} team paths`,
          subtitle: confirmedTeams.length > 0
            ? (showMasterCupBracket ? 'Full seeded bracket with selected clubs highlighted' : 'Selected-team paths only')
            : 'Prestige knockout bracket',
          children: (
            <div style={contextGroupGridStyle}>
              {!showMasterCupBracket && masterCupPaths.length > 0 ? (
                <div style={cupPathGridStyle}>
                  {masterCupPaths.map((path) => renderCupPathGraphic(path))}
                </div>
              ) : !showMasterCupBracket && confirmedTeams.length > 0 && explicitMasterCup ? (
                <div style={contextEmptyStyle}>None of the selected teams currently have a visible Master Cup route.</div>
              ) : null}

              {showMasterCupBracket ? renderMasterCupFullContext() : null}
            </div>
          ),
        }));
      }
    }

    if (sections.length === 0) {
      return null;
    }

    return (
      <div style={contextDeckStyle}>
        <div style={comparisonIntroStyle}>
          <span style={heroKickerStyle}>Competition Context</span>
          <h2 style={{ ...heroNameStyle, fontSize: 'clamp(1.6rem, 2.3vw, 2.1rem)' }}>
            {confirmedTeams.length === 0
              ? 'Competition-led reporting view'
              : confirmedTeams.length === 1
                ? 'Overview first, then competition spotlight'
                : 'Comparison first, then grouped competition context'}
          </h2>
          <p style={heroSublineStyle}>
            {confirmedTeams.length === 0
              ? 'Selected competitions are shown in full, without forcing empty team cards.'
              : 'Each selected competition stays intact while your selected teams are highlighted inside the right context.'}
          </p>
        </div>
        {sections}
      </div>
    );
  };

  const renderComparisonMetric = (args: {
    label: string;
    value: string;
    leader?: boolean;
    note?: string;
    deltaLabel?: string | null;
    delay?: number;
  }) => {
    const metaLabel = args.leader
      ? (args.deltaLabel ? `▲ EDGE ${args.deltaLabel}` : '▲ EDGE')
      : '';

    return (
      <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={reduceMotion ? undefined : { duration: 0.38, delay: args.delay ?? 0, ease: 'easeOut' }}
      style={args.leader ? comparisonMetricLeaderStyle() : comparisonMetricStyle}
    >
      {args.leader && !reduceMotion ? (
        <motion.div
          style={metricSweepStyle}
          initial={{ x: '-110%' }}
          animate={{ x: '120%' }}
          transition={{ duration: 0.7, delay: (args.delay ?? 0) + 0.12, ease: 'easeOut' }}
        />
      ) : null}
      {args.leader ? (
        <div
          style={{
            position: 'absolute',
            top: '18%',
            right: 0,
            bottom: '18%',
            width: '3px',
            borderRadius: '999px 0 0 999px',
            background: `linear-gradient(180deg, transparent, ${EDGE_ACCENT}, transparent)`,
            boxShadow: `0 0 12px ${EDGE_ACCENT_GLOW}`,
          }}
        />
      ) : null}
      <div style={comparisonMetricGridStyle}>
        <div style={comparisonMetricHeaderStyle}>
          <span style={comparisonMetricLabelStyle}>{args.label}</span>
          <span
            className="muted"
            style={{
              ...comparisonMetricNoteStyle,
              visibility: args.note ? 'visible' : 'hidden',
            }}
          >
            {args.note ?? 'placeholder'}
          </span>
        </div>
        <motion.strong
          style={{
            ...comparisonMetricValueStyle,
            color: args.leader ? EDGE_ACCENT_TEXT : comparisonMetricValueStyle.color,
            textShadow: args.leader ? `0 0 18px ${EDGE_ACCENT_GLOW}` : undefined,
          }}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
          transition={reduceMotion ? undefined : { duration: 0.28, delay: (args.delay ?? 0) + 0.06 }}
        >
          {args.value}
        </motion.strong>
        <div style={comparisonMetricMetaStyle}>
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={reduceMotion ? undefined : { duration: 0.26, delay: (args.delay ?? 0) + 0.22 }}
            style={metaLabel ? comparisonMetricDeltaStyle : comparisonMetricMetaEmptyStyle}
          >
            {metaLabel || 'placeholder'}
          </motion.span>
        </div>
      </div>
    </motion.div>
    );
  };

  const LegacyTile = (args: {
    label: string;
    value: string;
    emphasis?: 'default' | 'gold' | 'wide';
  }) => {
    const baseStyle = args.emphasis === 'gold' || args.emphasis === 'wide' ? legacyTileGoldStyle() : legacyTileStyle;
    return (
      <div style={args.emphasis === 'wide' ? { ...baseStyle, ...legacyTileFullWidthStyle } : baseStyle}>
        <span style={legacyTileLabelStyle}>{args.label}</span>
        <strong style={args.emphasis === 'wide' ? legacyTileBestFinishValueStyle : legacyTileValueStyle}>{args.value}</strong>
      </div>
    );
  };

  const HonoursStrip = (args: {
    honours: TeamLegacySummary['honours'];
  }) => {
    if (args.honours.length === 0) {
      return (
        <div style={honoursStripStyle}>
          <span className="muted">None</span>
        </div>
      );
    }
    return (
      <div style={honoursStripStyle}>
        {args.honours.map((honour) => (
          <span
            key={honour.id}
            style={honourPillStyle()}
          >
            <strong>{honour.season}</strong>
            <span>{honour.label}</span>
          </span>
        ))}
      </div>
    );
  };

  const LegacySection = (args: {
    legacy: TeamLegacySummary;
  }) => (
    <section style={legacySectionStyle}>
      <div style={legacyHeaderStyle}>
        <span style={legacyHeaderTitleStyle}>Legacy</span>
        <span style={legacyHeaderSubtitleStyle}>Club history and honours</span>
      </div>
      <div style={legacyGridStyle}>
        <div>
          <LegacyTile label="Silverware" value={String(args.legacy.silverware)} emphasis="gold" />
        </div>
        <div>
          <LegacyTile label="League Titles" value={String(args.legacy.leagueTitles)} />
        </div>
        <div>
          <LegacyTile label="Cup Wins" value={String(args.legacy.cupWins)} />
        </div>
        <div>
          <LegacyTile label="Best Finish" value={args.legacy.bestFinish || 'None'} emphasis="wide" />
        </div>
      </div>
      <div style={legacyHeaderStyle}>
        <span style={honoursTitleStyle}>Honours</span>
      </div>
      <HonoursStrip honours={args.legacy.honours} />
    </section>
  );

  const renderOverviewComparisonCard = (teamOverview: TeamOverviewRecord, args?: {
    singleTeam?: boolean;
    index?: number;
  }) => {
    const singleTeam = args?.singleTeam ?? false;
    const animationIndex = args?.index ?? 0;
    const showComparisonEdges = !singleTeam && sortedTeamOverviews.length > 1;
    const ratingBreakdown = comparisonRatings?.breakdownByTeamId.get(teamOverview.team.id) ?? null;
    const isOverallLeader = showComparisonEdges && comparisonRatings?.overallLeader?.team.id === teamOverview.team.id;
    const emphasizeCard = singleTeam || isOverallLeader;
    const trioTeamStatus = buildStatusText({
      enabled: teamOverview.trio.enabled,
      row: teamOverview.trio.row
        ? { division: teamOverview.trio.row.division, rank: teamOverview.trio.row.rank }
        : null,
    });
    const tierTeamStatus = buildStatusText({
      enabled: teamOverview.tier.enabled,
      started: teamOverview.tier.started,
      row: teamOverview.tier.row
        ? { division: teamOverview.tier.row.division, rank: teamOverview.tier.row.rank }
        : null,
    });
    const divisionLabel = teamOverview.divisionPosition
      ? displayDivisionName(teamOverview.divisionPosition.division)
      : 'No current division';
    const positionLabel = teamOverview.divisionPosition
      ? `#${teamOverview.divisionPosition.rank} — ${divisionLabel}`
      : divisionLabel;
    const trioStandingValue = teamOverview.trio.row
      ? `#${teamOverview.trio.row.rank} in ${teamOverview.trio.row.division}`
      : trioTeamStatus.value;
    const tierStandingValue = teamOverview.tier.row
      ? `#${teamOverview.tier.row.rank} in ${teamOverview.tier.row.division}`
      : tierTeamStatus.value;
    const tags = Array.from(new Set([
      ...(singleTeam ? [] : (comparisonRatings?.tagsByTeamId.get(teamOverview.team.id) ?? [])),
      ...getCupEditorialTags(teamOverview),
    ])).slice(0, 4);
    const formValue = renderFormSummary(ratingBreakdown?.formResults ?? []);
    const orderedByDivisionStanding = [...sortedTeamOverviews].sort((left, right) => compareDivisionStanding(left, right, currentSeason));
    const orderedByMaster = [...sortedTeamOverviews]
      .filter((item) => item.masterPosition !== null)
      .sort((left, right) => (left.masterPosition?.rank ?? Number.MAX_SAFE_INTEGER) - (right.masterPosition?.rank ?? Number.MAX_SAFE_INTEGER));
    const orderedByProfit = [...sortedTeamOverviews].sort((left, right) => right.stats.profit - left.stats.profit);
    const orderedBySpins = [...sortedTeamOverviews].sort((left, right) => right.stats.spins - left.stats.spins);
    const orderedByWinPct = [...sortedTeamOverviews].sort((left, right) => right.stats.winPct - left.stats.winPct);
    const orderedByAvgGw = [...sortedTeamOverviews].sort((left, right) => right.stats.averageProfitPerWeek - left.stats.averageProfitPerWeek);
    const divisionEdgeLabel = showComparisonEdges && orderedByDivisionStanding[0]?.team.id === teamOverview.team.id && orderedByDivisionStanding[1]
      ? getDivisionIndex(teamOverview.divisionPosition?.division ?? teamOverview.team.division, currentSeason) < getDivisionIndex(orderedByDivisionStanding[1].divisionPosition?.division ?? orderedByDivisionStanding[1].team.division, currentSeason)
        ? 'Tier advantage'
        : null
      : null;
    const positionEdgeLabel = showComparisonEdges && comparisonLeaders?.bestPosition?.team.id === teamOverview.team.id && orderedByDivisionStanding[1]
      ? (teamOverview.divisionPosition?.division && orderedByDivisionStanding[1].divisionPosition?.division && teamOverview.divisionPosition.division === orderedByDivisionStanding[1].divisionPosition.division
        ? `+${Math.max(0, (orderedByDivisionStanding[1].divisionPosition?.rank ?? 0) - (teamOverview.divisionPosition?.rank ?? 0))} places`
        : 'Tier advantage')
      : null;
    const masterEdgeLabel = showComparisonEdges && orderedByMaster[0]?.team.id === teamOverview.team.id && orderedByMaster[1]
      ? `+${Math.max(0, (orderedByMaster[1].masterPosition?.rank ?? 0) - (teamOverview.masterPosition?.rank ?? 0))} places`
      : null;
    const profitEdge = showComparisonEdges && orderedByProfit[0]?.team.id === teamOverview.team.id && orderedByProfit[1]
      ? orderedByProfit[0].stats.profit - orderedByProfit[1].stats.profit
      : 0;
    const spinsEdge = showComparisonEdges && orderedBySpins[0]?.team.id === teamOverview.team.id && orderedBySpins[1]
      ? orderedBySpins[0].stats.spins - orderedBySpins[1].stats.spins
      : 0;
    const winEdge = showComparisonEdges && orderedByWinPct[0]?.team.id === teamOverview.team.id && orderedByWinPct[1]
      ? orderedByWinPct[0].stats.winPct - orderedByWinPct[1].stats.winPct
      : 0;
    const avgEdge = showComparisonEdges && orderedByAvgGw[0]?.team.id === teamOverview.team.id && orderedByAvgGw[1]
      ? orderedByAvgGw[0].stats.averageProfitPerWeek - orderedByAvgGw[1].stats.averageProfitPerWeek
      : 0;
    const formEdge = showComparisonEdges && comparisonRatings?.formLeader?.team.id === teamOverview.team.id && comparisonRatings.formRunnerUp
      ? (comparisonRatings.breakdownByTeamId.get(teamOverview.team.id)?.formScore ?? 0) - (comparisonRatings.breakdownByTeamId.get(comparisonRatings.formRunnerUp.team.id)?.formScore ?? 0)
      : 0;

    return (
      <motion.article
        key={`comparison-card-${teamOverview.team.id}`}
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reduceMotion ? undefined : { duration: 0.42, delay: animationIndex * 0.04, ease: 'easeOut' }}
        style={{
          ...comparisonCardStyle,
          ...(emphasizeCard ? prestigeCardStyle : subduedCardStyle),
          boxShadow: emphasizeCard
            ? `${prestigeCardStyle.boxShadow}, 0 0 0 1px rgba(121, 255, 177, 0.12)`
            : subduedCardStyle.boxShadow,
        }}
      >
        <div style={stackedSheenStyle} />
        <div style={comparisonCardHeaderStyle}>
          <div
            style={emphasizeCard ? {
              borderRadius: '50%',
              boxShadow: `0 0 0 8px rgba(121, 255, 177, 0.12), 0 0 24px rgba(121, 255, 177, 0.34)`,
            } : undefined}
          >
            <TeamBadge
              name={teamOverview.team.name}
              ballColor={teamOverview.team.ballColor}
              ringColor={teamOverview.team.ringColor}
              textColor={teamOverview.team.textColor}
              size={56}
            />
          </div>
          <div style={comparisonCardTitleStyle}>
            <strong
              style={{
                fontSize: emphasizeCard ? '1.26rem' : '1.18rem',
                color: emphasizeCard ? '#fff5cf' : '#fcf7e3',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {teamOverview.team.name}
            </strong>
            <span
              className="muted"
              style={{
                color: emphasizeCard ? 'rgba(255, 241, 193, 0.82)' : undefined,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {ratingBreakdown ? `${ratingBreakdown.total.toFixed(1)}/100 overall rating` : 'Club profile'}
            </span>
            <span style={{ ...heroPrestigeTagStyle, visibility: isOverallLeader ? 'visible' : 'hidden' }}>Overall Edge</span>
          </div>
        </div>

        <div style={editorialTagRowStyle}>
          {tags.length > 0 ? tags.map((tag, index) => (
            <motion.span
              key={`${teamOverview.team.id}-${tag}`}
              initial={reduceMotion ? false : { opacity: 0, x: -6 }}
              animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              transition={reduceMotion ? undefined : { duration: 0.28, delay: 0.08 + index * 0.05 }}
              style={contextChipStyle()}
            >
              {tag}
            </motion.span>
          )) : (
            <span style={{ ...contextChipStyle(), visibility: 'hidden' }}>Placeholder</span>
          )}
        </div>

        <div style={comparisonMetricListStyle}>
          {renderComparisonMetric({
            label: 'Current Position',
            value: positionLabel,
            leader: showComparisonEdges && comparisonLeaders?.bestPosition?.team.id === teamOverview.team.id,
            deltaLabel: showComparisonEdges ? (positionEdgeLabel ?? divisionEdgeLabel) : null,
            note: 'Official division standing',
            delay: 0,
          })}
          {renderComparisonMetric({
            label: 'Master League',
            value: teamOverview.masterPosition ? `#${teamOverview.masterPosition.rank}` : 'N/A',
            leader: showComparisonEdges && comparisonLeaders?.bestMasterLeague?.team.id === teamOverview.team.id,
            deltaLabel: showComparisonEdges ? masterEdgeLabel : null,
            delay: 0.08,
          })}
          {renderComparisonMetric({
            label: 'Total Profit',
            value: formatSignedProfit(teamOverview.stats.profit),
            leader: showComparisonEdges && comparisonLeaders?.mostProfit?.team.id === teamOverview.team.id,
            deltaLabel: showComparisonEdges && profitEdge > 0.001 ? formatProfitEdge(profitEdge) : null,
            delay: 0.16,
          })}
          {renderComparisonMetric({
            label: 'Total Spins',
            value: String(teamOverview.stats.spins),
            leader: showComparisonEdges && comparisonLeaders?.mostSpins?.team.id === teamOverview.team.id,
            deltaLabel: showComparisonEdges && spinsEdge > 0 ? `+${spinsEdge}` : null,
            delay: 0.24,
          })}
          {renderComparisonMetric({
            label: 'Win Percentage',
            value: formatPercent(teamOverview.stats.winPct),
            leader: showComparisonEdges && comparisonLeaders?.bestWinPct?.team.id === teamOverview.team.id,
            deltaLabel: showComparisonEdges && winEdge > 0.05 ? formatPercentEdge(winEdge) : null,
            delay: 0.32,
          })}
          {renderComparisonMetric({
            label: 'Avg Profit per Gameweek',
            value: formatSignedProfit(teamOverview.stats.averageProfitPerWeek),
            leader: showComparisonEdges && comparisonLeaders?.bestAvgProfitPerGw?.team.id === teamOverview.team.id,
            deltaLabel: showComparisonEdges && avgEdge > 0.001 ? formatAvgEdge(avgEdge) : null,
            note: `${teamOverview.stats.gamesPlayed} games`,
            delay: 0.4,
          })}
          {renderComparisonMetric({
            label: 'Form',
            value: formValue,
            leader: showComparisonEdges && comparisonRatings?.formLeader?.team.id === teamOverview.team.id,
            deltaLabel: showComparisonEdges && formEdge > 0.3 ? `+${formEdge.toFixed(1)}` : null,
            note: ratingBreakdown ? `${ratingBreakdown.formScore.toFixed(1)}/15 over the last 5` : 'Last five league results',
            delay: 0.48,
          })}
          {renderComparisonMetric({
            label: 'Trio League',
            value: trioStandingValue,
            leader: showComparisonEdges && comparisonLeaders?.bestTrioLeague?.team.id === teamOverview.team.id,
            note: teamOverview.trio.row ? 'Current trio standing' : trioTeamStatus.title,
            delay: 0.56,
          })}
          {renderComparisonMetric({
            label: 'Tier League',
            value: tierStandingValue,
            leader: showComparisonEdges && comparisonLeaders?.bestTierLeague?.team.id === teamOverview.team.id,
            note: teamOverview.tier.row ? 'Current tier standing' : tierTeamStatus.title,
            delay: 0.64,
          })}
        </div>

        <LegacySection legacy={teamOverview.legacy} />
      </motion.article>
    );
  };

  if (confirmedSelection) {
    return (
      <section className="page page-dashboard">
        <h1>Interactive Analytics Hub</h1>

        <div style={selectionDropdownShellStyle}>
          <button
            type="button"
            style={selectionDropdownToggleStyle}
            onClick={() => setSelectionSummaryOpen((current) => !current)}
          >
            <span>Selections confirmed</span>
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              {competitionSummaryCountLabel} • {confirmedTeams.length} teams
            </span>
            <span aria-hidden="true">{selectionSummaryOpen ? '▴' : '▾'}</span>
          </button>

          {selectionSummaryOpen ? (
            <div style={selectionDropdownMenuStyle}>
              <div style={selectionDropdownHeaderStyle}>
                <div style={selectionDropdownLabelStyle}>
                  <strong>Selections confirmed</strong>
                  <p className="muted" style={{ margin: 0 }}>
                    {activeCompetitionLabels[0] === 'All competitions'
                      ? `All competitions • ${confirmedTeams.length} teams`
                      : `${confirmedCompetitionLabels.length} competitions • ${confirmedTeams.length} teams`}
                  </p>
                </div>
                <button
                  type="button"
                  style={selectionDropdownToggleStyle}
                  onClick={() => setSelectionSummaryOpen(false)}
                >
                  Close
                </button>
              </div>

              <div style={chipRowStyle}>
                {activeCompetitionLabels.map((label) => (
                  <span key={`competition-${label}`} style={chipStyle}>{label}</span>
                ))}
              </div>

              <div style={chipRowStyle}>
                {confirmedTeams.length > 0 ? confirmedTeams.map((team) => (
                  <span key={`team-${team.id}`} style={chipStyle}>
                    <TeamBadge
                      name={team.name}
                      ballColor={team.ballColor}
                      ringColor={team.ringColor}
                      textColor={team.textColor}
                      size={18}
                    />
                    <span>{team.name}</span>
                  </span>
                )) : (
                  <span className="muted">No team spotlight selected</span>
                )}
              </div>

              <div style={dropdownActionsStyle}>
                <span className="muted" style={{ margin: 0 }}>
                  {confirmedTeams.length === 0
                    ? 'Competition-led mode'
                    : confirmedTeams.length > 1
                      ? 'Comparison mode'
                      : 'Focused overview mode'}
                </span>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => {
                    setSelectionSummaryOpen(false);
                    setConfirmedSelection(null);
                  }}
                >
                  Edit Selection
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {overviewLoading ? <p className="muted">Loading overview...</p> : null}
        {overviewError ? <p className="muted">{overviewError}</p> : null}

        {!overviewLoading && !overviewError && primaryOverview && sortedTeamOverviews.length === 1 ? (
          <div
            style={{
              ...focusFrameStyle,
              borderColor: `${primaryAccent}55`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 44px rgba(3, 8, 18, 0.5), 0 0 0 1px ${primaryAccent}22`,
            }}
          >
            <div style={focusAtmosphereStyle} />
            <div style={floodlightLeftStyle} />
            <div style={floodlightRightStyle} />
            <div style={focusVignetteStyle} />
            <div style={focusFrameInnerStyle}>
              <div style={focusPanelStyle}>
                <div style={{ ...focusHeaderStyle, boxShadow: `${focusHeaderStyle.boxShadow}, inset 0 0 0 1px ${primaryAccent}55` }}>
                  <div style={focusHeaderGlowStyle} />
                  <div style={heroBadgeShellStyle}>
                    <div style={heroBadgeGlowStyle(primaryAccent)} />
                    <div style={heroBadgeFrameStyle}>
                      <TeamBadge
                        name={primaryConfirmedTeam.name}
                        ballColor={primaryConfirmedTeam.ballColor}
                        ringColor={primaryConfirmedTeam.ringColor}
                        textColor={primaryConfirmedTeam.textColor}
                        size={84}
                      />
                    </div>
                  </div>
                  <div style={focusTitleStyle}>
                    <span style={heroKickerStyle}>Interactive Analytics Hub</span>
                    <h2 style={heroNameStyle}>{primaryConfirmedTeam.name}</h2>
                    <p style={heroSublineStyle}>Same comparison fields, focused on one club.</p>
                  </div>
                </div>
                <div style={{ ...comparisonGridBaseStyle, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  {renderOverviewComparisonCard(primaryOverview, { singleTeam: true, index: 0 })}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!overviewLoading && !overviewError && sortedTeamOverviews.length > 1 ? (
          <div
            style={{
              ...focusFrameStyle,
              borderColor: 'rgba(255, 222, 150, 0.2)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 44px rgba(3, 8, 18, 0.5), 0 0 0 1px rgba(255, 222, 150, 0.12)',
            }}
          >
            <div style={focusAtmosphereStyle} />
            <div style={floodlightLeftStyle} />
            <div style={floodlightRightStyle} />
            <div style={focusVignetteStyle} />
            <div style={focusFrameInnerStyle}>
              <div style={comparisonIntroStyle}>
                <span style={heroKickerStyle}>
                  {sortedTeamOverviews.length === 2 ? 'Head-to-Head Comparison' : 'Multi-Team Comparison'}
                </span>
                <h2 style={{ ...heroNameStyle, fontSize: 'clamp(1.75rem, 2.5vw, 2.3rem)' }}>
                  {sortedTeamOverviews.length === 2 ? 'Selected teams side by side' : `${sortedTeamOverviews.length} teams compared together`}
                </h2>
                <p style={heroSublineStyle}>
                  Weighted strength, current form, efficiency, and legacy now drive the story. Cups stay editorial only and do not affect the rating.
                </p>
              </div>

              {comparisonRatings ? (
                <div style={overallRatingStripStyle}>
                  <div style={overallRatingHeaderStyle}>
                    <div style={contextCardTitleStyle}>
                      <strong style={{ color: '#fcf7e3' }}>Overall Rating</strong>
                      <span className="muted">Weighted out of 100 across division strength, Master League, Trio, Tier, efficiency, form, and legacy.</span>
                    </div>
                    {comparisonRatings.overallLeader ? (
                      <span style={{
                        ...comparisonLeaderChipStyle(),
                        boxShadow: `${comparisonLeaderChipStyle().boxShadow}, 0 0 18px rgba(121, 255, 177, 0.18)`,
                      }}>
                        <strong>Overall Winner</strong>
                        <span>{comparisonRatings.overallLeader.team.name}</span>
                      </span>
                    ) : null}
                  </div>

                  <div style={overallRatingTeamRowStyle}>
                    {comparisonRatings.orderedByScore.map((overview, index) => {
                      const breakdown = comparisonRatings.breakdownByTeamId.get(overview.team.id);
                      const highlighted = comparisonRatings.overallLeader?.team.id === overview.team.id;
                      if (!breakdown) {
                        return null;
                      }
                      return (
                        <motion.div
                          key={`rating-${overview.team.id}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                          transition={reduceMotion ? undefined : { duration: 0.3, delay: index * 0.06 }}
                          style={overallRatingTeamChipStyle(highlighted)}
                        >
                          <TeamBadge
                            name={overview.team.name}
                            ballColor={overview.team.ballColor}
                            ringColor={overview.team.ringColor}
                            textColor={overview.team.textColor}
                            size={20}
                          />
                          <strong style={{ color: highlighted ? '#fff7d8' : undefined, fontSize: highlighted ? '0.98rem' : undefined }}>{overview.team.name}</strong>
                          <motion.span
                            style={overallRatingValueStyle}
                            initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
                            animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
                            transition={reduceMotion ? undefined : { duration: 0.28, delay: 0.08 + index * 0.05, ease: 'easeOut' }}
                          >
                            {breakdown.total.toFixed(1)}
                          </motion.span>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div style={comparisonEditorialStripStyle}>
                    {comparisonRatings.summaryItems.map((item, index) => (
                      <motion.div
                        key={`summary-${item.label}`}
                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={reduceMotion ? undefined : { duration: 0.34, delay: index * 0.08 }}
                        style={comparisonEditorialCardStyle}
                      >
                        <span style={stackedLabelStyle}>{item.label}</span>
                        <strong style={{ color: '#fcf7e3', fontSize: '1.05rem', lineHeight: 1.1 }}>{item.teamName}</strong>
                        <span className="muted">{item.detail}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : null}

              {comparisonLeaders ? (
                <div style={comparisonSummaryRowStyle}>
                  {comparisonLeaders.highestDivision ? (
                    <span style={comparisonLeaderChipStyle()}>
                      <strong>Higher Division</strong>
                      <span>{comparisonLeaders.highestDivision.team.name}</span>
                    </span>
                  ) : null}
                  {comparisonLeaders.bestPosition ? (
                    <span style={comparisonLeaderChipStyle()}>
                      <strong>Best Position</strong>
                      <span>{comparisonLeaders.bestPosition.team.name}</span>
                    </span>
                  ) : null}
                  {comparisonLeaders.mostProfit ? (
                    <span style={comparisonLeaderChipStyle()}>
                      <strong>Most Profit</strong>
                      <span>{comparisonLeaders.mostProfit.team.name}</span>
                    </span>
                  ) : null}
                  {comparisonLeaders.mostSpins ? (
                    <span style={comparisonLeaderChipStyle()}>
                      <strong>Most Spins</strong>
                      <span>{comparisonLeaders.mostSpins.team.name}</span>
                    </span>
                  ) : null}
                  {comparisonLeaders.bestWinPct ? (
                    <span style={comparisonLeaderChipStyle()}>
                      <strong>Best Win %</strong>
                      <span>{comparisonLeaders.bestWinPct.team.name}</span>
                    </span>
                  ) : null}
                  {comparisonLeaders.bestAvgProfitPerGw ? (
                    <span style={comparisonLeaderChipStyle()}>
                      <strong>Best Avg / GW</strong>
                      <span>{comparisonLeaders.bestAvgProfitPerGw.team.name}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div
                style={{
                  ...comparisonGridBaseStyle,
                  gridTemplateColumns: sortedTeamOverviews.length === 2
                    ? 'repeat(2, minmax(0, 1fr))'
                    : 'repeat(auto-fit, minmax(280px, 1fr))',
                }}
              >
                {sortedTeamOverviews.map((teamOverview, index) => renderOverviewComparisonCard(teamOverview, { index }))}
              </div>
            </div>
          </div>
        ) : null}

        {renderTeamHistorySection()}
        {competitionContextLoading ? <p className="muted">Loading competition context...</p> : null}
        {competitionContextError ? <p className="muted">{competitionContextError}</p> : null}
        {!competitionContextLoading && !competitionContextError ? renderCompetitionContext() : null}
      </section>
    );
  }

  return (
    <section className="page page-dashboard">
      <h1>Interactive Analytics Hub</h1>
      <p className="muted">Select competitions, teams, or both, then confirm to open a focused reporting view.</p>

      <div className="tile-grid tile-grid-secondary">
        <article className="tile" style={tileStyle}>
          <div style={tileHeaderStyle}>
            <h2>Competitions</h2>
            <span className="muted">{selectedCompetitions.length}</span>
          </div>
          <div style={listStyle}>
            <label style={optionRowStyle}>
              <span style={optionLabelStyle}>
                <input
                  ref={competitionSelectAllRef}
                  type="checkbox"
                  checked={allCompetitionsSelected}
                  onChange={() => setSelectedCompetitions(allCompetitionsSelected ? [] : [...allCompetitionIds])}
                />
                <strong>Select All</strong>
                <span style={teamMetaStyle}>{COMPETITION_OPTIONS.length} total</span>
              </span>
            </label>
            {COMPETITION_OPTIONS.map((competition) => (
              <label key={competition.id} style={optionRowStyle}>
                <span style={optionLabelStyle}>
                  <input
                    type="checkbox"
                    checked={selectedCompetitions.includes(competition.id)}
                    onChange={() => setSelectedCompetitions((current) => toggleString(current, competition.id))}
                  />
                  <strong>{competition.label}</strong>
                </span>
              </label>
            ))}
          </div>
        </article>

        <article className="tile" style={tileStyle}>
          <div style={tileHeaderStyle}>
            <h2>Teams</h2>
            <span className="muted">{selectedTeams.length}</span>
          </div>
          {loading ? <p className="muted">Loading teams...</p> : null}
          {error ? <p className="muted">{error}</p> : null}
          {!loading && !error ? (
            <div style={listStyle}>
              <label style={optionRowStyle}>
                <span style={optionLabelStyle}>
                  <input
                    ref={teamSelectAllRef}
                    type="checkbox"
                    checked={allTeamsSelected}
                    onChange={() => setSelectedTeams(allTeamsSelected ? [] : [...allTeamIds])}
                  />
                  <strong>Select All</strong>
                  <span style={teamMetaStyle}>{orderedTeams.length} total</span>
                </span>
              </label>
              {orderedTeams.map((team) => (
                <label key={team.id} style={optionRowStyle}>
                  <span style={optionLabelStyle}>
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(team.id)}
                      onChange={() => setSelectedTeams((current) => toggleNumber(current, team.id))}
                    />
                    <TeamBadge
                      name={team.name}
                      ballColor={team.ballColor}
                      ringColor={team.ringColor}
                      textColor={team.textColor}
                      size={22}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
                    <span style={teamMetaStyle}>{displayDivisionName(team.division)}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </article>
      </div>

      <div style={actionRowStyle}>
        <p className="muted" style={{ margin: 0 }}>
          {selectionStatusLabel}
        </p>
        <button
          type="button"
          style={canConfirm ? primaryButtonStyle : disabledButtonStyle}
          onClick={() => {
            if (!canConfirm) {
              return;
            }
            setConfirmedSelection({
              competitionIds: [...selectedCompetitions],
              teamIds: [...selectedTeams],
            });
          }}
          disabled={!canConfirm}
        >
          Confirm Selection
        </button>
      </div>
    </section>
  );
}
