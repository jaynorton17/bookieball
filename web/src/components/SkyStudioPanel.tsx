import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { type FixtureSlideGroup } from './FixturesSlides';
import { LeagueMovementSlides, type LeagueMovementData } from './LeagueMovementSlides';
import { RivalrySlides, type RivalrySlideData } from './RivalrySlides';
import { SsnDivisionJourneyChart, type SsnDivisionJourneyTeam } from './SsnDivisionJourneyChart';
import { SlideDeck, type StudioSlide } from './SlideDeck';
import { BroadcastBattleBoard, LowerThirdAlertRail, VerifiedFactRail, type BroadcastBattleCard, type LowerThirdAlertItem, type VerifiedFactRailItem } from './StudioLiveWidgets';
import { StudioTableCarousel, type StudioTableDivision } from './StudioTableCarousel';
import { TeamBadge } from './TeamBadge';
import { DivisionRaceMeter } from './broadcast/DivisionRaceMeter';
import { FormTable } from './broadcast/FormTable';
import { MomentumMeter } from './broadcast/MomentumMeter';
import { ShockResultCard } from './broadcast/ShockResultCard';
import { StorylineSlide } from './broadcast/StorylineSlide';
import {
  TeamSpotlightSlides,
  type TeamPlayoffContext,
  type TeamPlayoffOutlook,
  type TeamSpotlightData,
} from './TeamSpotlightSlides';
import { TickerBar } from './TickerBar';
import { buildNarrationText, extractStoryArcLabels, splitSentences } from '../lib/studioNarration';
import { studioLog } from '../lib/studioLogger';
import {
  nextStudioRotationState,
  normalizeStudioRotationState,
  type StudioPhase,
  type StudioRotationState,
} from '../lib/studioRotation';
import {
  isFixtureStatusFinalConfirmed,
  isFixtureStatusInPlay,
  isFixtureStatusPending,
  isFixtureStatusProvisional,
  isFixtureStatusResolved,
  isWeeklyStatusInPlay,
  isWeeklyStatusResolved,
  type FixtureSlideStatusCode,
  weeklyStatusTone,
} from '../lib/statusCodes';
import { cupFixtureDetailLabel, cupFixtureScoreLabel, cupFixtureTeamsLabel } from '../lib/cupDisplay';
import ssnMasterPackageJson from '../data/ssn-master-package.json';

export type SkyStudioTeam = TeamSpotlightData;
export type SkyStudioFixtureGroup = FixtureSlideGroup;
export type SkyStudioCupFixture = {
  id: number;
  gw: string;
  roundName: string;
  homeTeam: string | null;
  awayTeam: string | null;
  winnerTeam: string | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  decidedBy: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending';
};
export type SkyStudioTrioRow = {
  division: string;
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};
export type SkyStudioTrioFixture = {
  id: number;
  gw: string;
  division: string;
  stage: 'regular' | 'playoff_semi' | 'playoff_final';
  groupSlot: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
  winnerTeamId: number | null;
};
export type SkyStudioRivalry = RivalrySlideData;
export type SkyStudioMovement = LeagueMovementData;
export type SkyStudioTableDivision = StudioTableDivision;
export type SkyStudioBroadcastPackage = {
  id: string;
  label: string;
  headline: string;
  lines: string[];
  tone?: StudioSlide['tone'];
  alert?: string;
  content?: ReactNode;
  durationMs?: number;
};
type AllTimeLeagueMode = 'points' | 'profit' | 'spins';
type AllTimeLeagueRow = {
  teamId: number;
  teamName: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};
type AllTimeLeaguesPayload = {
  fromSeason: string;
  fromGw: string;
  toSeason: string;
  toGw: string;
  pointsTable: AllTimeLeagueRow[];
  spinsTable: AllTimeLeagueRow[];
  profitTable: AllTimeLeagueRow[];
};
type SpotlightPulse = {
  id: number;
  message: string;
  teamId?: number | null;
};
type ScoreUpdateAlert = {
  id: number;
  headline: string;
  lines: string[];
  teamId?: number | null;
};
type SsnDivisionResultRow = {
  id: string;
  fixture: string;
  score: string;
  status: string;
  detail: string;
  badge?: string;
};
type SsnDivisionJourney = {
  divisionId: string;
  divisionTitle: string;
  gwNumbers: number[];
  teams: SsnDivisionJourneyTeam[];
};
type StingerState = {
  label: string;
  subline: string;
  detailLine?: string;
  teamName?: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
  variant?: 'division-roundup';
};
type SsnResumeState = {
  season: string;
  gw: string;
  rotationState: StudioRotationState;
  ssnTableCycleComplete: boolean;
  ssnSpotlightGroup: 'top' | 'lower';
  ssnSpotlightActive: boolean;
  teamShuffleCycle: number;
  postTableQueued: boolean;
  activeSlideId: string | null;
};

const CARD_DURATION_MS = 12000;
const DEFAULT_SLIDE_DURATION_MS = CARD_DURATION_MS;
const TABLE_CAROUSEL_INTERVAL_MS = 10000;
const TEAM_SPOTLIGHT_SLIDE_LIMIT = 3;
const TEAM_SPOTLIGHT_SLIDE_DURATION_MS = 10000;
const TEAM_REPEAT_HARD_LOCK_COUNT = 3;
const MIN_SLIDE_DURATION_MS = 8000;
const MIN_GRAPH_SLIDE_DURATION_MS = 10000;
const ALL_TIME_SEGMENT_TEAM_BATCH = 5;
const ALL_TIME_SEGMENT_DURATION_MS = 120000;
const ALL_TIME_SEGMENT_ORDER: AllTimeLeagueMode[] = ['spins', 'points', 'profit'];
const SSN_RESUME_STORAGE_KEY = 'bookieball_ssn_resume_state';
const SSN_DIVISION_ROUNDUP_SUBLINE_BASE = '- Divisions - Master - Cup - All-Time';
const SSN_DIVISION_ROUNDUP_SUBLINE_WITH_DIV4 = '- Divisions - Trio - Master - Cup - All-Time';
const ALL_TIME_MODE_COPY: Record<AllTimeLeagueMode, { title: string; subtitle: string; metric: string }> = {
  points: {
    title: 'All-Time Points League',
    subtitle: 'Ranked by total division league points.',
    metric: 'points',
  },
  profit: {
    title: 'All-Time Profit League',
    subtitle: 'Ranked by cumulative profit from division fixtures.',
    metric: 'profit',
  },
  spins: {
    title: 'All-Time Spins League',
    subtitle: 'Ranked by cumulative spins from division fixtures.',
    metric: 'spins',
  },
};
const TEAM_SPOTLIGHT_PRIORITY = [
  '-story-spotlight',
  '-analytics-board',
  '-weekly-match-centre',
  '-season-journey',
  '-legacy-story',
  '-live-opponent-scores',
  '-projection-story',
  '-extended-archive',
];
const TRIO_DIVISION_ORDER = ['Premier League', 'Ligue 1', 'Bundesliga'] as const;

function trioDivisionSortValue(division: string): number {
  const normalized = division.trim().toLowerCase();
  const index = TRIO_DIVISION_ORDER.findIndex((entry) => entry.toLowerCase() === normalized);
  return index >= 0 ? index : TRIO_DIVISION_ORDER.length + normalized.charCodeAt(0);
}

function trioStageLabel(fixture: SkyStudioTrioFixture): string {
  if (fixture.stage === 'playoff_semi') {
    return 'Playoff Semi-Final';
  }
  if (fixture.stage === 'playoff_final') {
    return 'Playoff Final';
  }
  return 'Regular Season';
}
const SSN_SPOTLIGHT_PRIORITY = [
  '-story-spotlight',
  '-season-journey',
  '-analytics-board',
  '-weekly-match-centre',
  '-legacy-story',
  '-projection-story',
  '-live-opponent-scores',
];
const SSN_ENHANCED_SPOTLIGHT_SPECS: Array<{ suffix: string; label: string }> = [
  { suffix: '-story-spotlight', label: 'Team Profile' },
];
const SSN_ALL_TIME_PICK_TWO_MODES: AllTimeLeagueMode[] = ['points', 'profit'];
const SSN_TEAM_SPOTLIGHT_TARGET_SLIDES = 1;
const SSN_TEAM_SPOTLIGHT_MAX_DURATION_MS = 60000;
const SSN_TEAM_SPOTLIGHT_MIN_DURATION_MS = 9000;
const SSN_TEAM_SPOTLIGHT_PER_SLIDE_CAP_MS = 12000;
const SPOTLIGHT_STUDIO_BANK = [
  "Sydney: Welcome back to the studio — we’re set for a fascinating head-to-head.",
  "Sydney: Table round tonight, and the story is form. Not just results — the manner of them.",
  "Jess: Exactly. You can win without convincing, but over a run of games the numbers expose it.",
  "Sydney: If you’re just joining us, keep an eye on momentum — this format rewards sustained control.",
  "Jess: And it punishes noise. One lucky spike is nice, but consistent edges are what travel.",
  "Sydney: Before we get into the action, let’s set the table context — where are these sides in their cycle?",
  "Jess: Are they trending up, stable, or wobbling? That’s the real question.",
  "Sydney: This feels like a classic ‘six-pointer’ — not for pride, but for position.",
  "Jess: Right. Two sides close enough that the next sequence can flip the pecking order.",
  "Sydney: Early phase is always about intent. Are they playing to lead, or playing not to lose?",
  "Jess: And you can usually tell inside the first few exchanges — selection tells you everything.",
  "Sydney: We’ve seen that cautious opening before — but it can be a trap if it turns passive.",
  "Jess: Passive teams don’t lose immediately; they just slowly donate control.",
  "Sydney: Let’s talk form. One side has been steadier over recent rounds — the other has been volatile.",
  "Jess: Volatility is fine if you can bound the downside. If you can’t, you’re living on borrowed time.",
  "Sydney: Great point. Steady doesn’t mean slow — it means repeatable.",
  "Jess: Repeatable decisions beat heroic ones, especially across a table season.",
  "Sydney: Cup round framing is different, though — you don’t need a perfect month, you need a perfect night.",
  "Jess: Exactly. Knockouts compress everything. One bad stretch and you’re on the coach home.",
  "Sydney: And psychologically, that changes choices. People chase. People force. People tighten up.",
  "Jess: The best performers simplify. They reduce the game to fundamentals under pressure.",
  "Sydney: We’ve got a bit of spice in this matchup — it has the feel of a rivalry day.",
  "Jess: Rivalry days tend to produce faster tempo and sharper reactions. Great for drama, dangerous for decision quality.",
  "Sydney: Here we go — opening exchanges underway, and you can already see the pace.",
  "Jess: Early indicators: one side is landing cleaner outcomes, less wasted motion.",
  "Sydney: That’s the first sign of a side in form — efficiency looks boring until it wins you matches.",
  "Jess: And it wins you matches a lot.",
  "Sydney: Jess, when you look at table form, what do you value most: volume or conversion?",
  "Jess: Conversion. A smaller number of high-quality outcomes beats a big number of noisy ones.",
  "Sydney: That’s the studio line: quality over quantity.",
  "Jess: And the data backs it. Forced sequences inflate activity, not advantage.",
  "Sydney: We’re seeing a slight swing already — not huge, but meaningful.",
  "Jess: Those are the swings that decide table rounds. Big spikes get headlines; small edges get points.",
  "Sydney: If you’re chasing places, you don’t need spectacle — you need reliability.",
  "Jess: The table doesn’t reward vibes; it rewards repeatable advantage.",
  "Sydney: This is where game management enters the chat. Protect the lead without becoming timid.",
  "Jess: Exactly. Defence is not hesitation. Defence is selecting the right moments.",
  "Sydney: Midgame now — and this is often where the better-coached side asserts structure.",
  "Jess: Watch for decision discipline here. Are they still taking the good looks, or are they tilting?",
  "Sydney: There’s a composure to one side’s approach — it looks like they’ve been here before.",
  "Jess: That’s form showing. They’re not reacting to every wobble; they’re staying on plan.",
  "Sydney: The other side needs a response — but the response has to be clean.",
  "Jess: The worst response is desperation. Desperation turns a small deficit into a large one.",
  "Sydney: Let’s zoom out: in table rounds, sometimes a draw is a good result depending on context.",
  "Jess: Exactly. If you’re away from home, or you’re short-handed, you manage the night.",
  "Sydney: But in cup rounds, you can’t ‘manage the night’ the same way — you have to finish the job.",
  "Jess: Cup rounds demand closure. You either advance or you don’t.",
  "Sydney: We’re getting a little run here — and runs are where narratives begin.",
  "Jess: A run is also where fundamentals are tested. Can you keep it clean when it’s working?",
  "Sydney: When teams are in form, they don’t just start runs — they stop runs too.",
  "Jess: Stopping the opponent’s momentum is a skill. It’s tactical and psychological.",
  "Sydney: This is a tight contest — and tight contests invite overthinking.",
  "Jess: True. People start ‘playing the scoreboard’ instead of ‘playing the moment.’",
  "Sydney: Jess, what’s your tell that a team is starting to force it?",
  "Jess: Timing changes. They rush. They take lower-quality looks. The error rate climbs.",
  "Sydney: And conversely, when a side is calm?",
  "Jess: They pause, they select, they commit. Fewer half-decisions.",
  "Sydney: That’s proper studio analysis.",
  "Jess: It’s not glamorous, but it’s the difference between contenders and pretenders.",
  "Sydney: Let’s introduce a cup narrative: this has all the ingredients for a giant-killing story.",
  "Jess: It does — underdogs love chaos, favourites love control. If the underdog stays structured, it gets real.",
  "Sydney: If you’re the favourite, what’s the danger?",
  "Jess: Believing you’ll ‘inevitably’ win. Inevitability is how favourites get upset.",
  "Sydney: The safest lead is the one you actively defend.",
  "Jess: Exactly. Protecting doesn’t mean freezing. It means making the right choices with the lead.",
  "Sydney: We’re approaching the business end now — the phase where reputations are made.",
  "Jess: Late-game is where your habits show. You don’t become a closer in the final minute; you reveal it.",
  "Sydney: Big moment coming — you can sense it in the rhythm.",
  "Jess: This is where a single clean sequence can swing the entire result.",
  "Sydney: And this is where the crowd would be on its feet if we were in a stadium.",
  "Jess: Studio desk is standing too, Sydney — metaphorically at least.",
  "Sydney: That’s a pressure exchange. One side handled it, the other side wore it.",
  "Jess: And pressure leaves fingerprints. It shows up in the next decision.",
  "Sydney: If this is a table round, you’re thinking about points, form, the run-in.",
  "Jess: If it’s cup, you’re thinking: survive the moment, then win the tie.",
  "Sydney: We’ve got a classic contrast here: composure versus urgency.",
  "Jess: Urgency can be useful, but it must be controlled. Uncontrolled urgency is just panic with a nicer name.",
  "Sydney: That’s a line we’ll clip for socials.",
  "Jess: Please don’t.",
  "Sydney: Late swing potential here — and this is where leaders earn their pay.",
  "Jess: Leaders shorten the game. They reduce it to clean, repeatable outcomes.",
  "Sydney: One side is still in touch — and that matters. You can’t win if you’re out of range.",
  "Jess: Being in range keeps the opponent honest. It makes them keep playing, not coasting.",
  "Sydney: Coasting is the silent killer. It looks safe until it isn’t.",
  "Jess: Especially in cup rounds. One lapse and you’re done.",
  "Sydney: If you’re just joining us: it’s close, it’s tense, and it’s quality.",
  "Jess: And the quality is in the decisions, not the noise.",
  "Sydney: We might be heading toward a finish where the smallest detail decides everything.",
  "Jess: And those are the best finishes — because they’re earned.",
  "Sydney: Here’s a scenario: table round, you’re chasing top four, do you take risks or bank the point?",
  "Jess: Depends on your form. If you’re in control, press. If you’re surviving, bank it.",
  "Sydney: Sensible.",
  "Jess: Romantic football says ‘always go for it.’ Real football says ‘read the game.’",
  "Sydney: Another scenario: cup round, underdog leads late. What’s the instruction?",
  "Jess: Keep doing what got you there. Don’t suddenly become a different team.",
  "Sydney: Don’t try to ‘not lose.’",
  "Jess: Exactly. Teams that play ‘not to lose’ usually lose.",
  "Sydney: We’re in the final stretch now — and this is where composure becomes the headline.",
  "Jess: Watch for who stays disciplined. Discipline beats adrenaline at the end.",
  "Sydney: Big exchange — that felt like a turning point.",
  "Jess: It did. And now the question is: can they convert that moment into the result?",
  "Sydney: If they’re leading, it’s about closing. If they’re chasing, it’s about clean aggression.",
  "Jess: Clean aggression is the phrase. Not chaos, not hope — purposeful pressure.",
  "Sydney: Let’s talk about streaks. A team in a winning streak often plays faster because they trust themselves.",
  "Jess: And a team in a losing streak often plays faster because they don’t trust the silence.",
  "Sydney: That’s psychological truth in one sentence.",
  "Jess: Confidence buys you patience. Doubt sells it cheaply.",
  "Sydney: This matchup has been high-grade: both sides have had moments, but only one side has looked consistently efficient.",
  "Jess: Efficiency is form. Form is efficiency repeated.",
  "Sydney: We’re nearly at decision time — and this is where the studio gets brave and calls it.",
  "Jess: Careful, Sydney. Call it too early and the game will punish you.",
  "Sydney: Fair. Let’s say it this way: one side has control, but control must be finished.",
  "Jess: Exactly. Control without closure is just a nice graph.",
  "Sydney: Final exchanges now — this is where you want your best habits, not your biggest emotions.",
  "Jess: Habits win late. Emotions spend late.",
  "Sydney: And if we’re headed to the whistle, this has the feel of a table round classic.",
  "Jess: Or a cup round shock, depending on the next swing.",
  "Sydney: Huge moment — that could be the decisive sequence.",
  "Jess: And that’s what closers do: they find the decisive sequence.",
  "Sydney: If that holds, it’s a big result in the table context — it changes the pressure next week.",
  "Jess: It does. The table reacts. The calendar reacts. Confidence reacts.",
  "Sydney: And in cup context, it’s even bigger: it’s survival, it’s advancement, it’s a season kept alive.",
  "Jess: Cup football is ruthless. One result can define your year.",
  "Sydney: Post-match lens: this wasn’t won with noise — it was won with discipline.",
  "Jess: And that’s the best compliment. It means it’s repeatable.",
  "Sydney: If you’re the winner, you’ll take that form into the next round.",
  "Jess: If you’re the loser, you’ll look back at two or three moments where discipline slipped.",
  "Sydney: That’s the story tonight — form, pressure, and who handled the business end.",
  "Jess: Thanks for staying with us. Same time next round — table or cup, we’ll be here for it.",
  "Sydney: That’s us from the studio desk — goodnight.",
];
type StudioCameraMode = 'desk' | 'results' | 'tactics';
type StudioLayoutMode = 'broadcast' | 'table';
type StudioGraphicsMode = 'sky' | 'clean' | 'classic';
type StudioDirectorMode = 'auto' | 'team-focus' | 'fixtures-first';
type StudioTableReadabilityMode = 'compact' | 'comfortable';
type StudioTableFocusMode = 'auto' | 'spotlight';
type StudioVoiceCharacterMode = 'balanced' | 'analytical' | 'emotional' | 'contrarian';
type StudioPresentationMode = 'full' | 'lean';
type SupportSlideBucket = 'fixtures' | 'results' | 'cup' | 'trio' | 'master' | 'league';

type SkyStudioPanelProps = {
  currentGw: string;
  currentSeason?: string;
  gwLocked?: boolean;
  fixtureCount: number;
  resolvedCount: number;
  teams: SkyStudioTeam[];
  tableDivisions: SkyStudioTableDivision[];
  masterLeagueRows: SkyStudioTableDivision['rows'];
  trioLeagueRows?: SkyStudioTrioRow[];
  tierLeagueRows?: SkyStudioTrioRow[];
  trioLeagueFixtures?: SkyStudioTrioFixture[];
  fixtureGroups: SkyStudioFixtureGroup[];
  cupFixtures?: SkyStudioCupFixture[];
  allTimeLeagues?: AllTimeLeaguesPayload | null;
  rivalries: SkyStudioRivalry[];
  movements: SkyStudioMovement[];
  tickerItems: string[];
  verifiedFactRailItems?: VerifiedFactRailItem[];
  broadcastPackages?: SkyStudioBroadcastPackage[];
  spotlightPulse?: SpotlightPulse | null;
  scoreUpdateAlert?: ScoreUpdateAlert | null;
  focusTeamId?: number | null;
  skySportsNews?: boolean;
  dayPhaseLabel?: string;
  dayPhaseLine?: string;
  truthLabel?: string;
  presentationMode?: StudioPresentationMode;
};

type ProducerCard = {
  id: string;
  label: string;
  headline: string;
  detail?: string;
  tone: 'live' | 'team' | 'fixtures' | 'results' | 'competition' | 'movement';
  alert?: string;
};

type TeamRun = {
  divisionId?: string;
  teamId: number;
  slides: StudioSlide[];
};

type FocusLeaguePanelRow = {
  teamId: number;
  teamName: string;
  rank: number;
  played: number;
  points: number;
  profit: number;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
};

type FocusLeaguePanel = {
  id: string;
  title: string;
  summary: string;
  rows: FocusLeaguePanelRow[];
};

type StoryRundownItem = {
  id: string;
  phase: 'teams' | 'leagues';
  label: string;
  tone: StudioSlide['tone'];
};

type PlayoffRaceCardTone = 'up' | 'flat' | 'down' | 'watch';

type PlayoffRaceCard = {
  id: string;
  title: string;
  teamId: number | null;
  teamIds: number[];
  teamName: string;
  detail: string;
  tone: PlayoffRaceCardTone;
};

type UpsetRadarItem = {
  id: string;
  fixture: string;
  winner: string;
  expected: string;
  level: 'watch' | 'huge';
  statusCode: FixtureSlideStatusCode;
};

type RaceTensionMeter = {
  id: string;
  label: string;
  value: number;
};

type TrendCacheCard = {
  id: string;
  teamId: number;
  teamName: string;
  lineOne: string;
  lineTwo: string;
};

type PlayoffBracketMatch = {
  id: string;
  competition: string;
  fixture: string;
  score: string;
  outcome: string;
  upperDivision: string;
  lowerDivision: string;
  upperTeam: string;
  lowerTeam: string;
  winner: string | null;
  statusCode: FixtureSlideStatusCode;
  statusLabel: string;
  stakesLine: string;
  penaltyLine: string;
  levelOnProfit: boolean;
  source: 'fixture' | 'expected';
};

type PlayoffBracketData = {
  matches: PlayoffBracketMatch[];
  teamLineByTeamKey: Map<string, string>;
  participantTeamIds: Set<number>;
};

type PlayoffTieBlueprint = {
  id: string;
  upperDivisionId: string;
  lowerDivisionId: string;
  upperDivisionTitle: string;
  lowerDivisionTitle: string;
  upperTeamId: number;
  upperTeamName: string;
  lowerTeamId: number;
  lowerTeamName: string;
};

type SsnMasterVoice = 'Sydney' | 'Jess';
type SsnMasterSegmentKey =
  | 'opening'
  | 'current_cup_round'
  | 'champions_spotlight'
  | 'premier_update'
  | 'master_league_update'
  | 'all_time_leagues'
  | 'remaining_spotlights';
type SsnMasterSegment = {
  script?: string[];
  scriptBeats?: string[];
};
type SsnMasterPackage = {
  segments?: Partial<Record<SsnMasterSegmentKey, SsnMasterSegment>>;
  commentaryVariations?: Partial<Record<SsnMasterSegmentKey, Partial<Record<SsnMasterVoice, string[]>>>>;
};
type SsnDivisionBucket = 'champions' | 'premier' | 'div1' | 'div2' | 'div3' | 'div4';
const SSN_DIVISION_BUCKET_ORDER: SsnDivisionBucket[] = ['champions', 'premier', 'div1', 'div2', 'div3', 'div4'];

const ssnMasterPackage = ssnMasterPackageJson as SsnMasterPackage;
const SSN_FALLBACK_SCRIPT: Record<SsnMasterSegmentKey, string[]> = {
  opening: [
    'Sydney: Welcome to the Bookieball studio edition.',
    'Jess: Division tables, cup stories, and spotlight updates are all coming up.',
  ],
  current_cup_round: [
    'The cup is where logic gets tested.',
    'Tonight it is asking serious questions.',
  ],
  champions_spotlight: [
    'Champions Division now.',
    'Someone is setting standards.',
  ],
  premier_update: [
    'Premier Division update.',
    'Promotion dreams are alive.',
  ],
  master_league_update: [
    'Master League update.',
    'There are sides accelerating fast.',
  ],
  all_time_leagues: [
    'Now to the all-time leagues.',
    'Tonight the list could change.',
  ],
  remaining_spotlights: [],
};
const SSN_FALLBACK_COMMENTARY: Partial<Record<SsnMasterSegmentKey, Record<SsnMasterVoice, string[]>>> = {
  current_cup_round: {
    Sydney: ['This tie remains live and every swing matters.'],
    Jess: ['Cup rounds can turn quickly, so momentum is everything.'],
  },
  champions_spotlight: {
    Sydney: ['Top-level consistency is deciding this race right now.'],
    Jess: ['The pressure profile is rising every gameweek.'],
  },
  premier_update: {
    Sydney: ['Promotion pressure is building at both ends of the table.'],
    Jess: ['Small margins are shaping this division every week.'],
  },
  master_league_update: {
    Sydney: ['Master League remains a launchpad for rising teams.'],
    Jess: ['The form line is beginning to separate the pack.'],
  },
  all_time_leagues: {
    Sydney: ['Legacy tables shift slowly, but they can still move tonight.'],
    Jess: ['Every new point and profit swing adds to long-term history.'],
  },
  remaining_spotlights: {
    Sydney: ['There are still key stories unfolding across the rest of the board.'],
    Jess: ['Mid-table and survival battles are still packed with pressure.'],
  },
};

const STORY_PROGRESS_STAGES = ['Intro', 'League', 'Cup', 'Verdict', 'Next'];

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function readSsnScript(segmentKey: SsnMasterSegmentKey): string[] {
  const script = normalizeStringArray(ssnMasterPackage.segments?.[segmentKey]?.script);
  if (script.length > 0) {
    return script;
  }
  if (segmentKey === 'opening') {
    return SSN_FALLBACK_SCRIPT.opening;
  }
  return [];
}

function readSsnScriptBeats(segmentKey: SsnMasterSegmentKey): string[] {
  const scriptBeats = normalizeStringArray(ssnMasterPackage.segments?.[segmentKey]?.scriptBeats);
  if (scriptBeats.length > 0) {
    return scriptBeats;
  }
  return SSN_FALLBACK_SCRIPT[segmentKey] ?? [];
}

function readSsnCommentaryVariation(segmentKey: SsnMasterSegmentKey, voice: SsnMasterVoice): string[] {
  const configured = normalizeStringArray(ssnMasterPackage.commentaryVariations?.[segmentKey]?.[voice]);
  if (configured.length > 0) {
    return configured;
  }
  return SSN_FALLBACK_COMMENTARY[segmentKey]?.[voice] ?? [];
}

function ssnDivisionBucket(title: string): SsnDivisionBucket | null {
  const normalized = title.trim().toLowerCase();
  if (/champion/.test(normalized)) {
    return 'champions';
  }
  if (/premier/.test(normalized)) {
    return 'premier';
  }
  if (/division\s*1|\bdiv\s*1\b|average/.test(normalized)) {
    return 'div1';
  }
  if (/division\s*2|\bdiv\s*2\b|struggling/.test(normalized)) {
    return 'div2';
  }
  if (/division\s*3|\bdiv\s*3\b|awful/.test(normalized)) {
    return 'div3';
  }
  if (/division\s*4|\bdiv\s*4\b/.test(normalized)) {
    return 'div4';
  }
  return null;
}

type ComparableTableRow = {
  teamName: string;
  rank: number;
  points: number;
  profit: number;
  spins: number;
  wins: number;
};

function compareTableRowsByRank(left: ComparableTableRow, right: ComparableTableRow): number {
  const equalStandingsMetrics = (
    left.points === right.points
    && left.profit === right.profit
    && left.spins === right.spins
    && left.wins === right.wins
  );
  if (equalStandingsMetrics) {
    return left.teamName.localeCompare(right.teamName);
  }
  const leftRank = Number(left.rank);
  const rightRank = Number(right.rank);
  const hasLeftRank = Number.isFinite(leftRank) && leftRank > 0;
  const hasRightRank = Number.isFinite(rightRank) && rightRank > 0;
  if (hasLeftRank && hasRightRank && leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  if (hasLeftRank !== hasRightRank) {
    return hasLeftRank ? -1 : 1;
  }
  if (right.points !== left.points) {
    return right.points - left.points;
  }
  if (right.profit !== left.profit) {
    return right.profit - left.profit;
  }
  if (right.spins !== left.spins) {
    return right.spins - left.spins;
  }
  if (right.wins !== left.wins) {
    return right.wins - left.wins;
  }
  return left.teamName.localeCompare(right.teamName);
}

function divisionTitlePreference(bucket: SsnDivisionBucket, title: string): number {
  const normalized = title.trim().toLowerCase();
  if (bucket === 'champions') {
    return /champion/.test(normalized) ? 2 : 0;
  }
  if (bucket === 'premier') {
    return /premier/.test(normalized) ? 2 : 0;
  }
  if (bucket === 'div1') {
    if (/division\s*1|\bdiv\s*1\b/.test(normalized)) {
      return 2;
    }
    return /average/.test(normalized) ? 1 : 0;
  }
  if (bucket === 'div2') {
    if (/division\s*2|\bdiv\s*2\b/.test(normalized)) {
      return 2;
    }
    return /struggling/.test(normalized) ? 1 : 0;
  }
  if (bucket === 'div3') {
    if (/division\s*3|\bdiv\s*3\b/.test(normalized)) {
      return 2;
    }
    return /awful/.test(normalized) ? 1 : 0;
  }
  if (bucket === 'div4') {
    return /division\s*4|\bdiv\s*4\b/.test(normalized) ? 2 : 0;
  }
  return 0;
}

function pickPreferredDivisionForBucket(
  divisions: SkyStudioTableDivision[],
  bucket: SsnDivisionBucket,
): SkyStudioTableDivision | null {
  const matches = divisions.filter((division) => ssnDivisionBucket(division.title) === bucket);
  if (matches.length === 0) {
    return null;
  }
  return matches
    .slice()
    .sort((left, right) => {
      const leftRealRows = left.rows.filter((row) => row.teamId > 0).length;
      const rightRealRows = right.rows.filter((row) => row.teamId > 0).length;
      if (rightRealRows !== leftRealRows) {
        return rightRealRows - leftRealRows;
      }
      if (right.rows.length !== left.rows.length) {
        return right.rows.length - left.rows.length;
      }
      const leftPref = divisionTitlePreference(bucket, left.title);
      const rightPref = divisionTitlePreference(bucket, right.title);
      if (rightPref !== leftPref) {
        return rightPref - leftPref;
      }
      const leftLeader = left.rows.slice().sort(compareTableRowsByRank)[0];
      const rightLeader = right.rows.slice().sort(compareTableRowsByRank)[0];
      if (leftLeader && rightLeader && rightLeader.points !== leftLeader.points) {
        return rightLeader.points - leftLeader.points;
      }
      const titleCompare = left.title.localeCompare(right.title);
      if (titleCompare !== 0) {
        return titleCompare;
      }
      return String(left.id).localeCompare(String(right.id));
    })[0] ?? null;
}

function seasonNumberFromLabel(season: string): number | null {
  const match = season.trim().match(/s\s*(\d+)/i);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function archiveTitleCount(rows: Array<{ rank: number }>): number {
  return rows.filter((row) => row.rank === 1).length;
}

function archiveCupWinCount(rows: Array<{ cupFinish: string }>): number {
  return rows.filter((row) => /winner|champion/i.test(row.cupFinish)).length;
}

function archiveBestFinish(rows: Array<{ rank: number }>): number | null {
  const validRanks = rows
    .map((row) => row.rank)
    .filter((rank) => Number.isFinite(rank) && rank > 0);
  if (validRanks.length === 0) {
    return null;
  }
  return Math.min(...validRanks);
}

function isGraphSlideId(slideId: string): boolean {
  if (!slideId) {
    return false;
  }
  return /^ssn-division-\d+-journey-/.test(slideId) || /(?:^|-)graph(?:-|$)/i.test(slideId);
}

function parseGwNumber(value: string): number {
  const match = value.match(/(\d+)/);
  if (!match) {
    return 0;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isOfficialDivisionSeasonComplete(gwNumber: number, gwLocked: boolean): boolean {
  return gwNumber > 7 || (gwNumber === 7 && gwLocked);
}

function minimumGraphDurationForGw(gw: string): number {
  const gwNumber = parseGwNumber(gw);
  return gwNumber === 7 || gwNumber === 8 ? 11000 : MIN_GRAPH_SLIDE_DURATION_MS;
}

function minimumDurationForSlideId(slideId: string, currentGw: string): number {
  return isGraphSlideId(slideId) ? minimumGraphDurationForGw(currentGw) : MIN_SLIDE_DURATION_MS;
}

function fixtureStatusLabel(statusCode: FixtureSlideStatusCode): string {
  if (statusCode === 'in_play') {
    return 'Live';
  }
  if (statusCode === 'provisional') {
    return 'Provisional';
  }
  if (statusCode === 'final_confirmed') {
    return 'Confirmed';
  }
  return 'Upcoming';
}

function fixtureStatusCue(statusCode: FixtureSlideStatusCode): 'LIVE' | 'PROVISIONAL' | 'CONFIRMED' {
  if (statusCode === 'provisional') {
    return 'PROVISIONAL';
  }
  if (statusCode === 'final_confirmed') {
    return 'CONFIRMED';
  }
  return 'LIVE';
}

function formPoints(form: Array<'W' | 'D' | 'L'>): number {
  return form.reduce((score, result) => {
    if (result === 'W') {
      return score + 3;
    }
    if (result === 'D') {
      return score + 1;
    }
    return score;
  }, 0);
}

function resultPoints(result: 'W' | 'D' | 'L' | 'P'): number {
  if (result === 'W') {
    return 3;
  }
  if (result === 'D') {
    return 1;
  }
  return 0;
}

function isPlaceholderOpponent(name: string): boolean {
  const normalized = name.trim().toUpperCase();
  return normalized === 'BYE' || normalized === 'TBD' || normalized === '';
}

function movementBias(label: string): number {
  const normalized = label.toLowerCase();
  if (/up|rise|surge|climb|boost|improv/.test(normalized)) {
    return 1;
  }
  if (/down|drop|slide|fall|dip|risk/.test(normalized)) {
    return -1;
  }
  return 0;
}

function promotionSlotCount(teamCount: number): number {
  if (teamCount >= 7) {
    return 2;
  }
  return 1;
}

function relegationSlotCount(teamCount: number): number {
  if (teamCount >= 10) {
    return 2;
  }
  return 1;
}

function playoffOutlookLabel(outlook: TeamPlayoffOutlook): string {
  if (outlook === 'promotion-likely') {
    return 'Looks likely to go up';
  }
  if (outlook === 'drop-risk') {
    return 'At risk of dropping';
  }
  if (outlook === 'surprise-underperformer') {
    return 'Surprise underperformer';
  }
  if (outlook === 'late-surge-contender') {
    return 'Late surge contender';
  }
  return 'Likely to hold position';
}

function normalizeGap(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatWhole(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return `${Math.round(value)}`;
}

function formatRank(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }
  const mod10 = value % 10;
  if (mod10 === 1) {
    return `${value}st`;
  }
  if (mod10 === 2) {
    return `${value}nd`;
  }
  if (mod10 === 3) {
    return `${value}rd`;
  }
  return `${value}th`;
}

function ordinalWord(value: number): string {
  const words = [
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'eighth',
    'ninth',
    'tenth',
  ];
  if (value >= 1 && value <= words.length) {
    return words[value - 1]!;
  }
  return `${value}th`;
}

function seasonOrdinalLabel(season: string): string {
  const match = season.trim().match(/s\s*(\d+)/i);
  if (!match?.[1]) {
    return season;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return season;
  }
  return `${ordinalWord(value)} season`;
}

function formatGameWeekLabel(gw: string): string {
  const match = gw.trim().match(/gw\s*(\d+)/i);
  if (!match?.[1]) {
    return gw;
  }
  return `Game week ${match[1]}`;
}

function cameraModeFromTone(tone: StudioSlide['tone'] | undefined): StudioCameraMode {
  if (tone === 'fixtures') {
    return 'results';
  }
  if (tone === 'movement' || tone === 'rivalry') {
    return 'tactics';
  }
  return 'desk';
}

function cameraModeLabel(mode: StudioCameraMode): string {
  if (mode === 'results') {
    return 'Results Cam';
  }
  if (mode === 'tactics') {
    return 'Tactics Cam';
  }
  return 'Desk Cam';
}

function extractOutcomeWinner(outcome: string): string | null {
  const trimmed = outcome.trim();
  if (!trimmed || /pending|draw/i.test(trimmed)) {
    return null;
  }
  const match = trimmed.match(/^(.+?)\s+(won|advanced)\b/i);
  if (!match?.[1]) {
    return null;
  }
  return match[1].trim();
}

function extractOutcomeLeader(outcome: string): string | null {
  const trimmed = outcome.trim();
  if (!trimmed || /pending|draw/i.test(trimmed)) {
    return null;
  }
  const liveLead = trimmed.match(/as it stands,\s*(?:winner was\s*)?(.+?)\s+(?:lead|leads|won|advanced)\b/i);
  if (liveLead?.[1]) {
    return liveLead[1].trim();
  }
  const confirmed = trimmed.match(/confirmed winner:\s*(.+)$/i);
  if (confirmed?.[1]) {
    return confirmed[1].trim();
  }
  const winner = extractOutcomeWinner(trimmed);
  return winner ?? null;
}

function parseScoreMargin(score: string): number | null {
  const match = score.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const left = Number(match[1]);
  const right = Number(match[2]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }
  return Math.abs(left - right);
}

function scoreIsLevel(score: string): boolean {
  return parseScoreMargin(score) === 0;
}

function truncateLine(value: string, maxLength = 140): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeTeamKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function stripSpeakerPrefix(value: string): string {
  return value.replace(/^(Sydney|Jess|Miles):\s*/i, '').trim();
}

type NarrationSpeaker = 'sydney' | 'jess' | 'miles' | 'narrator';
type NarrationSegment = {
  speaker: NarrationSpeaker;
  text: string;
};

function sanitizeSpokenText(value: string): string {
  const withoutPrefix = value.replace(/\b(Sydney|Jess|Miles)\s*:\s*/gi, ' ');
  const withoutNames = withoutPrefix.replace(/\b(Sydney|Jess|Miles)\b/gi, ' ');
  return withoutNames
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();
}

function parseSpeakerTag(value: string): NarrationSpeaker {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'sydney') {
    return 'sydney';
  }
  if (normalized === 'jess') {
    return 'jess';
  }
  if (normalized === 'miles') {
    return 'miles';
  }
  return 'narrator';
}

function splitNarrationSegments(input: string): NarrationSegment[] {
  const value = input.trim();
  if (!value) {
    return [];
  }
  const marker = /\b(Sydney|Jess|Miles)\s*:/gi;
  const matches = Array.from(value.matchAll(marker));
  if (matches.length === 0) {
    const clean = sanitizeSpokenText(value);
    return clean ? [{ speaker: 'narrator', text: clean }] : [];
  }
  const segments: NarrationSegment[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    if (start > cursor) {
      const lead = sanitizeSpokenText(value.slice(cursor, start));
      if (lead) {
        segments.push({ speaker: 'narrator', text: lead });
      }
    }
    const speaker = parseSpeakerTag(match[1] ?? '');
    const contentStart = start + match[0].length;
    const contentEnd = index < matches.length - 1 ? (matches[index + 1]?.index ?? value.length) : value.length;
    const chunk = sanitizeSpokenText(value.slice(contentStart, contentEnd));
    if (chunk) {
      segments.push({ speaker, text: chunk });
    }
    cursor = contentEnd;
  });
  if (cursor < value.length) {
    const trailing = sanitizeSpokenText(value.slice(cursor));
    if (trailing) {
      segments.push({ speaker: 'narrator', text: trailing });
    }
  }
  return segments;
}

function compactNarrationSegments(segments: NarrationSegment[]): NarrationSegment[] {
  return segments.reduce<NarrationSegment[]>((acc, segment) => {
    if (!segment.text) {
      return acc;
    }
    const previous = acc[acc.length - 1];
    if (previous && previous.speaker === segment.speaker) {
      previous.text = `${previous.text} ${segment.text}`.trim();
      return acc;
    }
    acc.push({ ...segment });
    return acc;
  }, []);
}

function sameSpeechVoice(a: SpeechSynthesisVoice | null, b: SpeechSynthesisVoice | null): boolean {
  if (!a || !b) {
    return false;
  }
  return a.voiceURI === b.voiceURI && a.name === b.name;
}

function pickPresenterVoices(voices: SpeechSynthesisVoice[]): Record<NarrationSpeaker, SpeechSynthesisVoice | null> {
  const englishVoices = voices.filter((voice) => /^en(-|_)/i.test(voice.lang) || /english/i.test(voice.name));
  const pool = englishVoices.length > 0 ? englishVoices : voices;
  const sydney = pool[0] ?? null;
  const jess = pool.find((voice) => !sameSpeechVoice(voice, sydney)) ?? sydney;
  const miles = pool.find((voice) => !sameSpeechVoice(voice, sydney) && !sameSpeechVoice(voice, jess)) ?? sydney ?? jess;
  const narrator = sydney ?? jess ?? miles;
  return { sydney, jess, miles, narrator };
}

function safeLocalStorageRead(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    studioLog('studio', 'storage-read-failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function safeLocalStorageWrite(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    studioLog('studio', 'storage-write-failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function safeLocalStorageRemove(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    studioLog('studio', 'storage-remove-failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseSsnResumeState(value: string | null): SsnResumeState | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<SsnResumeState> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (typeof parsed.season !== 'string' || typeof parsed.gw !== 'string') {
      return null;
    }
    const rotation = parsed.rotationState as Partial<StudioRotationState> | undefined;
    if (!rotation || (rotation.phase !== 'teams' && rotation.phase !== 'leagues')) {
      return null;
    }
    const teamRunIndex = Number(rotation.teamRunIndex);
    const teamSlideIndex = Number(rotation.teamSlideIndex);
    const leagueSlideIndex = Number(rotation.leagueSlideIndex);
    return {
      season: parsed.season,
      gw: parsed.gw,
      rotationState: {
        phase: rotation.phase,
        teamRunIndex: Number.isFinite(teamRunIndex) ? Math.max(0, Math.floor(teamRunIndex)) : 0,
        teamSlideIndex: Number.isFinite(teamSlideIndex) ? Math.max(0, Math.floor(teamSlideIndex)) : 0,
        leagueSlideIndex: Number.isFinite(leagueSlideIndex) ? Math.max(0, Math.floor(leagueSlideIndex)) : 0,
      },
      ssnTableCycleComplete: Boolean(parsed.ssnTableCycleComplete),
      ssnSpotlightGroup: parsed.ssnSpotlightGroup === 'lower' ? 'lower' : 'top',
      ssnSpotlightActive: Boolean(parsed.ssnSpotlightActive),
      teamShuffleCycle: Number.isFinite(parsed.teamShuffleCycle) ? Math.max(0, Math.floor(parsed.teamShuffleCycle)) : 0,
      postTableQueued: Boolean(parsed.postTableQueued),
      activeSlideId: typeof parsed.activeSlideId === 'string' ? parsed.activeSlideId : null,
    };
  } catch {
    return null;
  }
}

function parseScoreForCommentary(value: string): number | null {
  const normalized = value.trim();
  if (
    normalized.length === 0
    || normalized.toLowerCase() === 'pending'
    || normalized.toLowerCase() === 'bye'
    || normalized === '—'
  ) {
    return null;
  }
  const numeric = Number(normalized.replace(/[^0-9+.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCommentaryPoints(value: number): string {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function parseFixtureScorePair(scoreLabel: string): { home: number; away: number } | null {
  const parts = scoreLabel.split('-').map((part) => part.trim());
  if (parts.length !== 2) {
    return null;
  }
  const home = parseScoreForCommentary(parts[0] ?? '');
  const away = parseScoreForCommentary(parts[1] ?? '');
  if (home === null || away === null) {
    return null;
  }
  return { home, away };
}

function parseFixtureTeams(fixtureLabel: string): { home: string; away: string } | null {
  const parts = fixtureLabel
    .split(/\s+v(?:s)?\.?\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }
  return { home: parts[0], away: parts[1] };
}

function cupRoundKey(roundName: string): 'r32' | 'r16' | 'qf' | 'sf' | 'f' | 'other' {
  if (/round\s*of\s*32|roundof32|r32/i.test(roundName)) {
    return 'r32';
  }
  if (/round\s*of\s*16|roundof16|r16/i.test(roundName)) {
    return 'r16';
  }
  if (/quarter|quarterfinal|qf/i.test(roundName)) {
    return 'qf';
  }
  if (/semi|semifinal|sf/i.test(roundName)) {
    return 'sf';
  }
  if (/\bfinal\b/i.test(roundName)) {
    return 'f';
  }
  return 'other';
}

function groupCupFixturesByRound(fixtures: SkyStudioCupFixture[]): Array<{ key: string; label: string; fixtures: SkyStudioCupFixture[] }> {
  const order = ['r32', 'r16', 'qf', 'sf', 'f', 'other'] as const;
  const labels: Record<(typeof order)[number], string> = {
    r32: 'Round of 32',
    r16: 'Round of 16',
    qf: 'Quarterfinals',
    sf: 'Semifinals',
    f: 'Final',
    other: 'Cup Round',
  };
  const grouped = new Map<string, SkyStudioCupFixture[]>();
  fixtures.forEach((fixture) => {
    const key = cupRoundKey(fixture.roundName);
    const roundFixtures = grouped.get(key) ?? [];
    roundFixtures.push(fixture);
    grouped.set(key, roundFixtures);
  });
  return order
    .filter((key) => grouped.has(key))
    .map((key) => ({
      key,
      label: labels[key],
      fixtures: (grouped.get(key) ?? []).slice().sort((left, right) => left.id - right.id),
    }));
}

function isBenignSpeechInterruption(code: string | undefined): boolean {
  const normalized = (code ?? '').toLowerCase();
  return normalized === 'interrupted'
    || normalized === 'canceled'
    || normalized === 'cancelled'
    || normalized.includes('interrupted')
    || normalized.includes('canceled')
    || normalized.includes('cancelled');
}

function parsePicksLabel(label: string): { jay: string | null; computer: string | null } {
  const parts = label.split('•').map((part) => part.trim());
  const readPick = (value: string | undefined): string | null => {
    if (!value) {
      return null;
    }
    const pick = value.split(':').slice(1).join(':').trim();
    if (!pick || pick === '—' || /pending/i.test(pick)) {
      return null;
    }
    return pick;
  };
  return {
    jay: readPick(parts[0]),
    computer: readPick(parts[1]),
  };
}

function parseSwingValue(value: string): number | null {
  const match = value.match(/-?\\d+(?:\\.\\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractFixtureWinner(outcome: string): string | null {
  const trimmed = outcome.trim();
  if (!trimmed || /pending|draw|level/i.test(trimmed)) {
    return null;
  }
  const directWinner = trimmed.match(/winner\\s*(?:was|:)?\\s*(.+)$/i);
  if (directWinner?.[1]) {
    return directWinner[1].trim();
  }
  const leadMatch = trimmed.match(/as it stands,\\s*([^,]+?)\\s+lead/i);
  if (leadMatch?.[1]) {
    return leadMatch[1].trim();
  }
  const wonMatch = trimmed.match(/^(.+?)\\s+(won|advanced)\\b/i);
  if (wonMatch?.[1]) {
    return wonMatch[1].trim();
  }
  return null;
}

function summarizeFixtureImplication(
  winner: string | null,
  winnerContext: {
    divisionTitle: string;
    teamName: string;
    rank: number;
    points: number;
  } | null,
): string {
  if (winnerContext) {
    return `${winnerContext.teamName} move to ${formatRank(winnerContext.rank)} in ${winnerContext.divisionTitle}.`;
  }
  if (winner) {
    return `${winner} take control of this fixture storyline.`;
  }
  return 'This tie remains open and can still swing late.';
}

function supportSlideBucket(slide: StudioSlide): SupportSlideBucket {
  if (/cup/i.test(slide.id) || /cup/i.test(slide.label)) {
    return 'cup';
  }
  if (/playoff/i.test(slide.id) || /playoff/i.test(slide.label)) {
    return 'fixtures';
  }
  if (/trio/i.test(slide.id) || /trio/i.test(slide.label)) {
    return 'trio';
  }
  if (/master/i.test(slide.id) || /master/i.test(slide.label)) {
    return 'master';
  }
  if (/result/i.test(slide.id) || /just in/i.test(slide.label)) {
    return 'results';
  }
  if (/fixture/i.test(slide.id) || /upcoming/i.test(slide.id) || /coming up/i.test(slide.label)) {
    return 'fixtures';
  }
  return 'league';
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

function createSeededRng(seed: number): () => number {
  let state = seed || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffleBySeed<T>(items: T[], seed: string): T[] {
  const shuffled = [...items];
  const random = createSeededRng(hashSeed(seed));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function pickSeedLine(lines: readonly string[] | undefined, seed: string, fallback = ''): string {
  if (!lines || lines.length === 0) {
    return fallback;
  }
  const [pick] = shuffleBySeed([...lines], seed);
  return pick ?? fallback;
}

function pickSpotlightBankLines(seed: string, count: number): string[] {
  if (SPOTLIGHT_STUDIO_BANK.length === 0 || count <= 0) {
    return [];
  }
  const sydneyLines = SPOTLIGHT_STUDIO_BANK.filter((line) => line.startsWith('Sydney:'));
  const jessLines = SPOTLIGHT_STUDIO_BANK.filter((line) => line.startsWith('Jess:'));
  const picks: string[] = [];
  if (sydneyLines.length > 0) {
    picks.push(shuffleBySeed(sydneyLines, `${seed}-sydney`)[0]);
  }
  if (count > 1 && jessLines.length > 0) {
    picks.push(shuffleBySeed(jessLines, `${seed}-jess`)[0]);
  }
  if (picks.length >= count) {
    return picks.slice(0, count);
  }
  const remainder = SPOTLIGHT_STUDIO_BANK.filter((line) => !picks.includes(line));
  return [...picks, ...shuffleBySeed(remainder, `${seed}-rest`).slice(0, count - picks.length)];
}

function loopIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const remainder = index % total;
  return remainder >= 0 ? remainder : remainder + total;
}

function activeSlideFromState(
  state: StudioRotationState,
  teamRuns: TeamRun[],
  supportSlides: StudioSlide[],
): StudioSlide | null {
  if (state.phase === 'teams') {
    if (teamRuns.length === 0) {
      return supportSlides.length > 0
        ? supportSlides[loopIndex(state.leagueSlideIndex, supportSlides.length)] ?? null
        : null;
    }
    const activeRun = teamRuns[loopIndex(state.teamRunIndex, teamRuns.length)];
    if (!activeRun || activeRun.slides.length === 0) {
      return supportSlides.length > 0
        ? supportSlides[loopIndex(state.leagueSlideIndex, supportSlides.length)] ?? null
        : null;
    }
    return activeRun.slides[loopIndex(state.teamSlideIndex, activeRun.slides.length)] ?? null;
  }

  if (supportSlides.length > 0) {
    return supportSlides[loopIndex(state.leagueSlideIndex, supportSlides.length)] ?? null;
  }

  if (teamRuns.length === 0) {
    return null;
  }
  const fallbackRun = teamRuns[loopIndex(state.teamRunIndex, teamRuns.length)];
  if (!fallbackRun || fallbackRun.slides.length === 0) {
    return null;
  }
  return fallbackRun.slides[0] ?? null;
}

function nextRundownState(
  state: StudioRotationState,
  teamRuns: TeamRun[],
  supportSlides: StudioSlide[],
): StudioRotationState {
  const teamRunCount = teamRuns.length;
  const activeRun = teamRunCount > 0
    ? teamRuns[loopIndex(state.teamRunIndex, teamRunCount)]
    : null;
  const activeTeamSlideCount = activeRun?.slides.length ?? 0;

  const normalized = normalizeStudioRotationState({
    state,
    teamRunCount,
    activeTeamSlideCount,
    supportSlideCount: supportSlides.length,
  });
  const normalizedRun = teamRunCount > 0
    ? teamRuns[loopIndex(normalized.teamRunIndex, teamRunCount)]
    : null;
  const normalizedTeamSlideCount = normalizedRun?.slides.length ?? 0;

  return nextStudioRotationState({
    state: normalized,
    teamRunCount,
    activeTeamSlideCount: normalizedTeamSlideCount,
    supportSlideCount: supportSlides.length,
    focusTeamId: null,
  });
}

function selectTeamSpotlightSlides(
  slides: StudioSlide[],
  options?: {
    limit?: number;
    priorityNeedles?: string[];
  },
): StudioSlide[] {
  const limit = options?.limit ?? TEAM_SPOTLIGHT_SLIDE_LIMIT;
  const priorityNeedles = options?.priorityNeedles ?? TEAM_SPOTLIGHT_PRIORITY;
  if (slides.length <= limit) {
    return slides;
  }
  const selected: StudioSlide[] = [];
  const usedIds = new Set<string>();

  priorityNeedles.forEach((needle) => {
    const match = slides.find((slide) => slide.id.includes(needle));
    if (!match || usedIds.has(match.id)) {
      return;
    }
    selected.push(match);
    usedIds.add(match.id);
  });

  slides.forEach((slide) => {
    if (usedIds.has(slide.id)) {
      return;
    }
    selected.push(slide);
    usedIds.add(slide.id);
  });

  return selected.slice(0, limit);
}

function buildTeamRunBag(
  runs: TeamRun[],
  cycle: number,
  currentGw: string,
  focusTeamId: number | null,
  avoidStartingTeamIds: number[],
): TeamRun[] {
  if (runs.length <= 1) {
    return runs;
  }
  const idFingerprint = runs.map((run) => run.teamId).join(',');
  let bag = shuffleBySeed(runs, `${currentGw}|${idFingerprint}|cycle-${cycle}`);

  if (avoidStartingTeamIds.length > 0) {
    const lockedSet = new Set(avoidStartingTeamIds);
    const unlocked = bag.filter((run) => !lockedSet.has(run.teamId));
    const locked = bag.filter((run) => lockedSet.has(run.teamId));
    if (unlocked.length > 0) {
      bag = [...unlocked, ...locked];
    }
  }

  if (focusTeamId && cycle === 0) {
    const focusIndex = bag.findIndex((run) => run.teamId === focusTeamId);
    if (focusIndex > 0) {
      const [focusRun] = bag.splice(focusIndex, 1);
      bag.unshift(focusRun);
    }
  }

  return bag;
}

function orderSupportSlides(slides: StudioSlide[], mode: StudioDirectorMode): StudioSlide[] {
  if (slides.length <= 1) {
    return slides;
  }

  const orderedBuckets: SupportSlideBucket[] =
    mode === 'fixtures-first'
      ? ['fixtures', 'results', 'cup', 'trio', 'master', 'league']
      : mode === 'team-focus'
        ? ['league', 'fixtures', 'results', 'cup', 'trio', 'master']
        : ['fixtures', 'results', 'cup', 'trio', 'master', 'league'];

  const byBucket = new Map<SupportSlideBucket, StudioSlide[]>();
  orderedBuckets.forEach((bucket) => byBucket.set(bucket, []));
  slides.forEach((slide) => {
    const bucket = supportSlideBucket(slide);
    const queue = byBucket.get(bucket) ?? [];
    queue.push(slide);
    byBucket.set(bucket, queue);
  });

  if (mode !== 'auto') {
    return orderedBuckets.flatMap((bucket) => byBucket.get(bucket) ?? []);
  }

  const queueByBucket = new Map<SupportSlideBucket, StudioSlide[]>();
  orderedBuckets.forEach((bucket) => {
    queueByBucket.set(bucket, [...(byBucket.get(bucket) ?? [])]);
  });
  const result: StudioSlide[] = [];
  let hasRemaining = true;
  while (hasRemaining) {
    hasRemaining = false;
    orderedBuckets.forEach((bucket) => {
      const queue = queueByBucket.get(bucket) ?? [];
      const next = queue.shift();
      if (next) {
        result.push(next);
        hasRemaining = true;
      }
      queueByBucket.set(bucket, queue);
    });
  }
  return result;
}

export function SkyStudioPanel({
  currentGw,
  currentSeason,
  gwLocked = false,
  fixtureCount,
  resolvedCount,
  teams,
  tableDivisions,
  masterLeagueRows,
  trioLeagueRows = [],
  tierLeagueRows = [],
  trioLeagueFixtures = [],
  fixtureGroups,
  cupFixtures = [],
  allTimeLeagues = null,
  rivalries,
  movements,
  tickerItems,
  broadcastPackages = [],
  scoreUpdateAlert = null,
  focusTeamId = null,
  skySportsNews = false,
  dayPhaseLabel = 'Live Phase',
  dayPhaseLine = 'Live desk coverage is active.',
  truthLabel = 'LIVE',
  presentationMode = 'full',
  verifiedFactRailItems = [],
}: SkyStudioPanelProps) {
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [layoutMode, setLayoutMode] = useState<StudioLayoutMode>('broadcast');
  const [graphicsMode, setGraphicsMode] = useState<StudioGraphicsMode>('sky');
  const [directorMode, setDirectorMode] = useState<StudioDirectorMode>('auto');
  const [tableReadabilityMode, setTableReadabilityMode] = useState<StudioTableReadabilityMode>('comfortable');
  const [tableFocusMode, setTableFocusMode] = useState<StudioTableFocusMode>('auto');
  const [voiceEnabled] = useState(true);
  const [voiceInteractionReady, setVoiceInteractionReady] = useState(false);
  const [activeTableDivision, setActiveTableDivision] = useState<SkyStudioTableDivision | null>(null);
  const [pinnedStoryOne, setPinnedStoryOne] = useState('');
  const [pinnedStoryTwo, setPinnedStoryTwo] = useState('');
  const [allTimeIntermission, setAllTimeIntermission] = useState<{ mode: AllTimeLeagueMode; sequence: number } | null>(null);
  const [ssnTableCycleComplete, setSsnTableCycleComplete] = useState(false);
  const [ssnSpotlightGroup, setSsnSpotlightGroup] = useState<'top' | 'lower'>('lower');
  const [ssnSpotlightActive, setSsnSpotlightActive] = useState(false);
  const [rotationState, setRotationState] = useState<StudioRotationState>({
    phase: 'teams',
    teamRunIndex: 0,
    teamSlideIndex: 0,
    leagueSlideIndex: 0,
  });
  const [coldOpenPending, setColdOpenPending] = useState(() => !skySportsNews);
  const [pendingInterruptSlides, setPendingInterruptSlides] = useState<StudioSlide[]>([]);
  const [activeInterruptSlide, setActiveInterruptSlide] = useState<StudioSlide | null>(null);
  const previousRotationRef = useRef<StudioRotationState | null>(null);
  const previousBagTailTeamIdsRef = useRef<number[]>([]);
  const previousResolvedCountRef = useRef(resolvedCount);
  const previousCycleRef = useRef(0);
  const allTimeSpotlightCounterRef = useRef(0);
  const allTimeModeIndexRef = useRef(0);
  const allTimeSegmentSequenceRef = useRef(0);
  const lastSpokenSlideRef = useRef<string | null>(null);
  const lastSpokenTextRef = useRef('');
  const narrationInProgressRef = useRef(false);
  const narrationWaitingAdvanceRef = useRef(false);
  const narrationSlideIdRef = useRef<string | null>(null);
  const narrationFallbackTimerRef = useRef<number | null>(null);
  const narrationAdvanceQueuedSlideIdRef = useRef<string | null>(null);
  const activeSlideIdRef = useRef<string | null>(null);
  const attemptAdvanceRef = useRef<() => void>(() => {});
  const ssnResumeAppliedRef = useRef(false);
  const ssnPostTableQueuedRef = useRef(false);
  const scoreUpdateQueuedRef = useRef<number | null>(null);
  const ssnSegmentRef = useRef<string | null>(null);
  const allTimeRotationRef = useRef<{
    phase: StudioPhase;
    teamSlideIndex: number;
    teamSlideCount: number;
  } | null>(null);
  const studioPanelRef = useRef<HTMLElement | null>(null);
  const [lastSpotlightDivisionId, setLastSpotlightDivisionId] = useState<string | undefined>(undefined);
  const [lastSpotlightTeamId, setLastSpotlightTeamId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Graphics pack: stinger overlay
  // This overlay displays during segment transitions (Kickoff Show, Table Round,
  // Cup Draw, All-Time Leagues) and when a new team spotlight begins. It
  // briefly covers the studio panel with a gradient sweep and title block.
  const [stinger, setStinger] = useState<StingerState | null>(null);
  const stingerTimerRef = useRef<any>(null);
  const prevSegmentRef = useRef<string | null>(null);
  const prevFocusTeamRef = useRef<number | null>(null);
  const prevSkySportsNewsModeRef = useRef(Boolean(skySportsNews));

  const triggerStinger = useCallback(
    (data: StingerState) => {
      // Clear any existing timers
      if (stingerTimerRef.current) {
        clearTimeout(stingerTimerRef.current);
      }
      const normalizedLabel = /^division roundup$/i.test(data.label.trim())
        ? 'DIVISIONS ROUND UP'
        : data.label;
      setStinger({ ...data, label: normalizedLabel });
      // Hide after ~2.3 seconds
      stingerTimerRef.current = setTimeout(() => {
        setStinger(null);
      }, 2300);
    },
    [],
  );
  const [teamShuffleCycle, setTeamShuffleCycle] = useState(0);
  const leanMode = presentationMode === 'lean';
  const focusLock = Boolean(focusTeamId);
  const skySportsNewsMode = Boolean(skySportsNews);
  const enteringSkySportsNewsMode = skySportsNewsMode && !prevSkySportsNewsModeRef.current;
  const ssnMasterTableRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    prevSkySportsNewsModeRef.current = skySportsNewsMode;
  }, [skySportsNewsMode]);

  // Watch for changes in the leading broadcast package label to trigger stingers
  useEffect(() => {
    if (skySportsNewsMode) {
      return;
    }
    if (!broadcastPackages || broadcastPackages.length === 0) {
      return;
    }
    const firstLabel = broadcastPackages[0]?.label;
    const segmentLabels = ['Kickoff Show', 'Table Round', 'Cup Draw', 'All-Time Leagues'];
    if (firstLabel && segmentLabels.includes(firstLabel) && prevSegmentRef.current !== firstLabel) {
      // Customise sublines per segment to give viewers context
      const sublineMap: Record<string, string> = {
        'Kickoff Show': 'Kickoff Coverage',
        'Table Round': 'League Spotlight',
        'Cup Draw': 'Cup Draw Live',
        'All-Time Leagues': 'All-Time Rankings',
      };
      const subline = sublineMap[firstLabel] ?? 'Studio Desk Live';
      triggerStinger({ label: firstLabel, subline });
      prevSegmentRef.current = firstLabel;
    }
  }, [broadcastPackages, skySportsNewsMode, triggerStinger]);

  // Watch for team spotlight changes via focusTeamId to trigger stingers
  useEffect(() => {
    if (skySportsNewsMode) {
      return;
    }
    if (!focusTeamId) {
      return;
    }
    if (prevFocusTeamRef.current !== focusTeamId) {
      let teamName: string | undefined;
      if (teams && Array.isArray(teams)) {
        // Attempt to match the team by id; fallback gracefully
        const match = teams.find((t) => t.id === focusTeamId);
        teamName = match?.name;
      }
      const label = skySportsNewsMode ? 'Team Spotlight' : 'Kickoff Spotlight';
      const subline = skySportsNewsMode ? 'Storyline Loading' : 'Team Reveal';
      triggerStinger({ label, subline, teamName });
      prevFocusTeamRef.current = focusTeamId;
    }
  }, [focusTeamId, skySportsNewsMode, teams, triggerStinger]);
  const renderScoreParts = useCallback((score: string) => {
    const match = score.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
    if (!match) {
      return <span className="studio-score">{score}</span>;
    }
    return (
      <span className="studio-score-split">
        <span className="studio-score-part">{match[1]}</span>
        <span className="studio-score-divider">-</span>
        <span className="studio-score-part">{match[2]}</span>
      </span>
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedAutoScroll = safeLocalStorageRead('bookieball_auto_scroll_enabled');
    if (storedAutoScroll === '0') {
      setAutoScrollEnabled(false);
    }
    const storedLayoutMode = safeLocalStorageRead('bookieball_layout_mode');
    if (storedLayoutMode === 'broadcast' || storedLayoutMode === 'table') {
      setLayoutMode(storedLayoutMode);
    }
    const storedGraphicsMode = safeLocalStorageRead('bookieball_graphics_mode');
    if (storedGraphicsMode === 'clean' || storedGraphicsMode === 'classic' || storedGraphicsMode === 'sky') {
      setGraphicsMode(storedGraphicsMode);
    } else if (storedGraphicsMode === 'full') {
      setGraphicsMode('sky');
    }
    const storedDirectorMode = safeLocalStorageRead('bookieball_director_mode');
    if (storedDirectorMode === 'auto' || storedDirectorMode === 'team-focus' || storedDirectorMode === 'fixtures-first') {
      setDirectorMode(storedDirectorMode);
    }
    const storedTableReadabilityMode = safeLocalStorageRead('bookieball_table_readability_mode');
    if (storedTableReadabilityMode === 'compact' || storedTableReadabilityMode === 'comfortable') {
      setTableReadabilityMode(storedTableReadabilityMode);
    }
    const storedTableFocusMode = safeLocalStorageRead('bookieball_table_focus_mode');
    if (storedTableFocusMode === 'auto' || storedTableFocusMode === 'spotlight') {
      setTableFocusMode(storedTableFocusMode);
    }
    // Legacy setting could leave narration permanently muted with no visible toggle.
    safeLocalStorageRemove('bookieball_voice_enabled');
    const storedPinnedStoryOne = safeLocalStorageRead('bookieball_producer_pin_one');
    const storedPinnedStoryTwo = safeLocalStorageRead('bookieball_producer_pin_two');
    if (storedPinnedStoryOne) {
      setPinnedStoryOne(storedPinnedStoryOne);
    }
    if (storedPinnedStoryTwo) {
      setPinnedStoryTwo(storedPinnedStoryTwo);
    }
  }, []);

  useEffect(() => {
    safeLocalStorageWrite('bookieball_auto_scroll_enabled', autoScrollEnabled ? '1' : '0');
  }, [autoScrollEnabled]);

  useEffect(() => {
    safeLocalStorageWrite('bookieball_layout_mode', layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    safeLocalStorageWrite('bookieball_graphics_mode', graphicsMode);
  }, [graphicsMode]);

  useEffect(() => {
    safeLocalStorageWrite('bookieball_director_mode', directorMode);
  }, [directorMode]);

  useEffect(() => {
    safeLocalStorageWrite('bookieball_table_readability_mode', tableReadabilityMode);
  }, [tableReadabilityMode]);

  useEffect(() => {
    safeLocalStorageWrite('bookieball_table_focus_mode', tableFocusMode);
  }, [tableFocusMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setVoiceInteractionReady(true);
      return;
    }
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation;
    if (activation?.hasBeenActive) {
      setVoiceInteractionReady(true);
      return;
    }
    const unlock = () => {
      setVoiceInteractionReady(true);
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    };
  }, []);

  useEffect(() => {
    if (!pinnedStoryOne) {
      safeLocalStorageRemove('bookieball_producer_pin_one');
      return;
    }
    safeLocalStorageWrite('bookieball_producer_pin_one', pinnedStoryOne);
  }, [pinnedStoryOne]);

  useEffect(() => {
    if (!pinnedStoryTwo) {
      safeLocalStorageRemove('bookieball_producer_pin_two');
      return;
    }
    safeLocalStorageWrite('bookieball_producer_pin_two', pinnedStoryTwo);
  }, [pinnedStoryTwo]);

  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );
  const teamIdByTeamKey = useMemo(
    () => new Map(teams.map((team) => [normalizeTeamKey(team.name), team.id])),
    [teams],
  );

  const teamRankById = useMemo(() => {
    const map = new Map<number, { rank: number; points: number; divisionTitle: string }>();
    tableDivisions.forEach((division) => {
      division.rows.forEach((row) => {
        map.set(row.teamId, {
          rank: row.rank,
          points: row.points,
          divisionTitle: division.title,
        });
      });
    });
    return map;
  }, [tableDivisions]);

  const gwNumber = useMemo(() => parseGwNumber(currentGw), [currentGw]);
  const officialDivisionSeasonComplete = useMemo(
    () => isOfficialDivisionSeasonComplete(gwNumber, gwLocked),
    [gwLocked, gwNumber],
  );
  const isGw8PlayoffWindow = gwNumber === 8;
  const playoffDivisionOrder = useMemo(() => {
    const bucketIndex = new Map(SSN_DIVISION_BUCKET_ORDER.map((bucket, index) => [bucket, index]));
    return tableDivisions
      .filter((division) => Boolean(ssnDivisionBucket(division.title)))
      .slice()
      .sort((left, right) => {
        const leftBucket = ssnDivisionBucket(left.title);
        const rightBucket = ssnDivisionBucket(right.title);
        const leftIndex = leftBucket ? (bucketIndex.get(leftBucket) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        const rightIndex = rightBucket ? (bucketIndex.get(rightBucket) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }
        return left.title.localeCompare(right.title);
      })
      .map((division) => division.id);
  }, [tableDivisions]);

  const playoffTieBlueprint = useMemo<PlayoffTieBlueprint[]>(() => {
    if (!isGw8PlayoffWindow) {
      return [];
    }
    const divisionById = new Map(tableDivisions.map((division) => [division.id, division]));
    const ties: PlayoffTieBlueprint[] = [];
    for (let index = 0; index < playoffDivisionOrder.length - 1; index += 1) {
      const upperDivisionId = playoffDivisionOrder[index];
      const lowerDivisionId = playoffDivisionOrder[index + 1];
      if (!upperDivisionId || !lowerDivisionId) {
        continue;
      }
      const upperDivision = divisionById.get(upperDivisionId);
      const lowerDivision = divisionById.get(lowerDivisionId);
      const upperRows = upperDivision?.rows ?? [];
      const lowerRows = lowerDivision?.rows ?? [];
      const upperThird = upperRows[2];
      const lowerSecond = lowerRows[1];
      if (!upperDivision || !lowerDivision || !upperThird || !lowerSecond) {
        continue;
      }
      ties.push({
        id: `gw8-${upperDivisionId}-vs-${lowerDivisionId}`,
        upperDivisionId,
        lowerDivisionId,
        upperDivisionTitle: upperDivision.title,
        lowerDivisionTitle: lowerDivision.title,
        upperTeamId: upperThird.teamId,
        upperTeamName: upperThird.teamName,
        lowerTeamId: lowerSecond.teamId,
        lowerTeamName: lowerSecond.teamName,
      });
    }
    return ties;
  }, [isGw8PlayoffWindow, playoffDivisionOrder, tableDivisions]);

  const playoffBracketData = useMemo<PlayoffBracketData>(() => {
    const matches: PlayoffBracketMatch[] = [];
    const teamLineByTeamKey = new Map<string, string>();
    const participantTeamIds = new Set<number>();
    if (!isGw8PlayoffWindow || playoffTieBlueprint.length === 0) {
      return {
        matches,
        teamLineByTeamKey,
        participantTeamIds,
      };
    }

    const playoffFixtures = fixtureGroups
      .filter((group) => /playoff/i.test(group.title))
      .flatMap((group) => group.fixtures.map((fixture) => ({ groupTitle: group.title, fixture })));
    const appendTeamLine = (teamName: string, line: string) => {
      const key = normalizeTeamKey(teamName);
      if (!key) {
        return;
      }
      const previous = teamLineByTeamKey.get(key);
      teamLineByTeamKey.set(key, previous ? `${previous} ${line}`.trim() : line);
    };

    playoffTieBlueprint.forEach((tie) => {
      participantTeamIds.add(tie.upperTeamId);
      participantTeamIds.add(tie.lowerTeamId);
      const fixtureMatch = playoffFixtures.find(({ fixture }) => {
        const teamsInFixture = parseFixtureTeams(fixture.fixture);
        if (!teamsInFixture) {
          return false;
        }
        const fixtureTeams = new Set([
          normalizeTeamKey(teamsInFixture.home),
          normalizeTeamKey(teamsInFixture.away),
        ]);
        return fixtureTeams.has(normalizeTeamKey(tie.upperTeamName))
          && fixtureTeams.has(normalizeTeamKey(tie.lowerTeamName));
      });
      const fixture = fixtureMatch?.fixture;
      const statusCode: FixtureSlideStatusCode = fixture?.statusCode ?? 'pending';
      const winner = fixture ? extractOutcomeWinner(fixture.outcome) : null;
      const score = fixture?.score ?? 'vs';
      const outcome = fixture?.outcome ?? 'Kick-off pending';
      const levelOnProfit = fixture ? scoreIsLevel(fixture.score) : false;
      const penaltyLine = levelOnProfit
        ? 'Level on profit right now. If it stays there, it goes to penalties for Jay to take.'
        : 'If profit is level at full time, it goes to penalties for Jay to take.';
      const statusLine = statusCode === 'pending'
        ? 'Kick-off pending.'
        : statusCode === 'in_play'
          ? levelOnProfit
            ? 'As it stands this tie is level on profit.'
            : `As it stands, ${winner ? `${winner} lead this tie.` : 'this tie is still in play.'}`
          : statusCode === 'provisional'
            ? levelOnProfit
              ? 'As it stands this tie is level on profit and awaits penalties.'
              : `As it stands, ${winner ? `winner was ${winner}.` : 'winner call is pending.'} This remains provisional until rollover.`
            : levelOnProfit
              ? 'Confirmed result is level on profit and needs penalties.'
              : `${winner ? `Confirmed winner was ${winner}.` : 'Confirmed result is pending final publication.'}`;
      const stakesLine = `If ${tie.upperTeamName} win, they keep their place in ${tie.upperDivisionTitle}. If ${tie.lowerTeamName} win, they take that place.`;
      const fixtureLabel = fixture?.fixture ?? `${tie.upperTeamName} vs ${tie.lowerTeamName}`;
      matches.push({
        id: `playoff-bracket-${tie.id}`,
        competition: fixtureMatch?.groupTitle ?? 'Playoff',
        fixture: fixtureLabel,
        score,
        outcome,
        upperDivision: tie.upperDivisionTitle,
        lowerDivision: tie.lowerDivisionTitle,
        upperTeam: tie.upperTeamName,
        lowerTeam: tie.lowerTeamName,
        winner,
        statusCode,
        statusLabel: fixtureStatusLabel(statusCode),
        stakesLine,
        penaltyLine,
        levelOnProfit,
        source: fixture ? 'fixture' : 'expected',
      });
      const line = `${fixtureLabel}. ${statusLine} ${penaltyLine} ${stakesLine}`;
      appendTeamLine(tie.upperTeamName, line);
      appendTeamLine(tie.lowerTeamName, line);
      if (winner) {
        appendTeamLine(winner, line);
      }
    });

    return {
      matches,
      teamLineByTeamKey,
      participantTeamIds,
    };
  }, [fixtureGroups, isGw8PlayoffWindow, playoffTieBlueprint]);

  const playoffContextByTeamId = useMemo(() => {
    const map = new Map<number, TeamPlayoffContext>();
    const divisionTitleSet = new Set(teams.map((team) => normalizeTeamKey(team.league)));
    const topDivisionId = playoffDivisionOrder[0] ?? null;
    const bottomDivisionId = playoffDivisionOrder[playoffDivisionOrder.length - 1] ?? null;
    const playoffTieByTeamId = new Map<number, PlayoffTieBlueprint>();
    playoffTieBlueprint.forEach((tie) => {
      playoffTieByTeamId.set(tie.upperTeamId, tie);
      playoffTieByTeamId.set(tie.lowerTeamId, tie);
    });

    tableDivisions.forEach((division) => {
      if (!divisionTitleSet.has(normalizeTeamKey(division.title))) {
        return;
      }
      const rows = [...division.rows].sort((a, b) => a.rank - b.rank);
      if (rows.length === 0) {
        return;
      }
      const isTopDivision = division.id === topDivisionId;
      const isBottomDivision = division.id === bottomDivisionId;
      const promotionSlots = isTopDivision ? 0 : promotionSlotCount(rows.length);
      const relegationSlots = isBottomDivision ? 0 : relegationSlotCount(rows.length);
      const promotionCut = promotionSlots > 0 ? rows[Math.min(rows.length - 1, promotionSlots - 1)] ?? rows[0] : null;
      const promotionChaser = promotionSlots > 0 ? rows[promotionSlots] ?? null : null;
      const relegationLineIndex = relegationSlots > 0 ? Math.max(0, rows.length - relegationSlots) : -1;
      const relegationLine = relegationLineIndex >= 0 ? rows[relegationLineIndex] ?? rows[rows.length - 1] ?? null : null;
      const safetyLine = relegationLineIndex >= 1 ? rows[relegationLineIndex - 1] ?? null : null;

      rows.forEach((row) => {
        const team = teamById.get(row.teamId);
        const nextFixture = team?.nextLeagueFixture?.trim() || 'the next fixture';
        const trendCache = team?.trendCache ?? null;
        const predictedRank = team?.predictedRank ?? null;
        const rankDelta = predictedRank === null ? null : row.rank - predictedRank;
        const preseasonFavorite = team?.preseasonFavorite === true;
        const recentFormPoints = team ? formPoints(team.leagueForm.slice(-3)) : 0;
        const movementSignal = movementBias(team?.divisionMovement ?? '');
        const trendSignal = recentFormPoints >= 6
          ? 2
          : recentFormPoints <= 1
            ? -2
            : recentFormPoints >= 4
              ? 1
              : 0;
        const trendScore = trendSignal
          + movementSignal
          + (trendCache ? (trendCache.rankDelta >= 1 ? 1 : trendCache.rankDelta <= -1 ? -1 : 0) : 0)
          + (trendCache ? (trendCache.pointsDelta >= 2 ? 1 : trendCache.pointsDelta <= -2 ? -1 : 0) : 0);
        const inPromotion = promotionSlots > 0 && row.rank <= promotionSlots;
        const inDropZone = relegationSlots > 0 && row.rank > rows.length - relegationSlots;
        const promotionGap = promotionSlots > 0
          ? (inPromotion
            ? normalizeGap(row.points - (promotionChaser?.points ?? row.points))
            : normalizeGap((promotionCut?.points ?? row.points) - row.points))
          : undefined;
        const safetyGap = relegationSlots > 0
          ? (inDropZone
            ? normalizeGap((safetyLine?.points ?? row.points) - row.points)
            : normalizeGap(row.points - (relegationLine?.points ?? row.points)))
          : undefined;
        const nearPromotion = promotionSlots > 0 && !inPromotion && (promotionGap ?? 99) <= 2;
        const nearDrop = relegationSlots > 0 && !inDropZone && (safetyGap ?? 99) <= 2;
        const tie = isGw8PlayoffWindow ? playoffTieByTeamId.get(row.teamId) ?? null : null;

        let outlook: TeamPlayoffOutlook = 'hold';
        let raceLine = `${row.teamName} look set to hold position in ${division.title}.`;
        let pointsGapLine = 'Position looks stable right now.';
        let expectationLine = predictedRank !== null
          ? `They are tracking around a ${formatRank(predictedRank)} projection.`
          : 'Projection baseline is limited, so table evidence drives the read.';
        let actionLine = `Take care of ${nextFixture} to keep control of the next phase.`;
        let phase: TeamPlayoffContext['phase'] = gwNumber >= 6 ? 'run-in' : 'regular';
        let scope: TeamPlayoffContext['scope'] = 'division';
        let playoffParticipant = false;
        let statusCue: TeamPlayoffContext['statusCue'] = truthLabel === 'CONFIRMED'
          ? 'CONFIRMED'
          : truthLabel === 'PROVISIONAL'
            ? 'PROVISIONAL'
            : 'LIVE';

        if (tie) {
          const bracketMatch = playoffBracketData.matches.find((match) => match.id === `playoff-bracket-${tie.id}`) ?? null;
          const matchStatus = bracketMatch?.statusCode ?? 'pending';
          const winner = bracketMatch?.winner ?? null;
          const isUpper = tie.upperTeamId === row.teamId;
          phase = 'playoffs';
          scope = 'playoff';
          playoffParticipant = true;
          statusCue = fixtureStatusCue(matchStatus);
          raceLine = `${tie.upperTeamName} versus ${tie.lowerTeamName} is live in the ${tie.upperDivisionTitle}/${tie.lowerDivisionTitle} playoff tie.`;
          pointsGapLine = bracketMatch
            ? `${fixtureStatusLabel(matchStatus)} call. ${bracketMatch.stakesLine}`
            : `Tie card is set. If ${tie.upperTeamName} win they hold, if ${tie.lowerTeamName} win they take the place.`;
          actionLine = 'No result is confirmed until gameweek lock and rollover are complete.';
          expectationLine = preseasonFavorite
            ? 'Big pressure moment for a pre-season favorite in this playoff tie.'
            : 'This tie decides promotion or survival in one direct showdown.';
          if (winner) {
            if (isUpper) {
              outlook = normalizeTeamKey(winner) === normalizeTeamKey(tie.upperTeamName) ? 'hold' : 'drop-risk';
            } else {
              outlook = normalizeTeamKey(winner) === normalizeTeamKey(tie.lowerTeamName) ? 'promotion-likely' : 'hold';
            }
          } else if (matchStatus === 'in_play') {
            outlook = isUpper ? 'hold' : 'late-surge-contender';
          } else {
            outlook = 'hold';
          }
        } else if (officialDivisionSeasonComplete) {
          expectationLine = 'The official division season is complete, so the final table now carries the story.';
          actionLine = 'No extra league points are available from here; only playoff outcomes sit outside the table.';
          pointsGapLine = `${row.points} points with ${formatSigned(row.profit)} profit in the final table.`;
          if (row.rank === 1) {
            raceLine = `${row.teamName} won ${division.title}.`;
          } else if (row.rank === rows.length) {
            raceLine = `${row.teamName} finished bottom of ${division.title}.`;
          } else {
            raceLine = `${row.teamName} finished ${formatRank(row.rank)} in ${division.title}.`;
          }
        } else {
          if (
            preseasonFavorite
            && ((promotionSlots > 0 && row.rank > promotionSlots) || (relegationSlots > 0 && inDropZone) || trendScore <= -1)
          ) {
            outlook = 'surprise-underperformer';
            expectationLine = 'Surprising slide for a pre-season favorite.';
            raceLine = `${row.teamName} are below expected pace in ${division.title}.`;
          } else if (!isTopDivision && inPromotion && ((promotionGap ?? 0) >= 1 || trendScore >= 1)) {
            outlook = 'promotion-likely';
            raceLine = `${row.teamName} are in a likely promotion lane in ${division.title}.`;
          } else if (!isBottomDivision && (inDropZone || nearDrop || trendScore <= -2)) {
            outlook = 'drop-risk';
            raceLine = `${row.teamName} are under pressure near the drop line in ${division.title}.`;
          } else if (!isTopDivision && !inPromotion && (nearPromotion || trendScore >= 2 || (rankDelta !== null && rankDelta <= -2))) {
            outlook = 'late-surge-contender';
            raceLine = `${row.teamName} are building a late surge in ${division.title}.`;
          }

          if (outlook === 'promotion-likely' && promotionGap !== undefined) {
            pointsGapLine = promotionGap > 0
              ? `${promotionGap} point${promotionGap === 1 ? '' : 's'} clear of the chasing line.`
              : 'No cushion at the line yet.';
            actionLine = `Win ${nextFixture} to tighten control of the promotion lane.`;
          } else if (outlook === 'drop-risk' && safetyGap !== undefined) {
            pointsGapLine = safetyGap > 0
              ? `${safetyGap} point${safetyGap === 1 ? '' : 's'} needed to reach safety.`
              : 'Safety is one result away.';
            actionLine = `They need a response in ${nextFixture} to avoid dropping.`;
          } else if (outlook === 'late-surge-contender' && promotionGap !== undefined) {
            pointsGapLine = `${promotionGap} point${promotionGap === 1 ? '' : 's'} off the step-up line.`;
            actionLine = `A strong result in ${nextFixture} keeps the surge alive.`;
          } else if (isTopDivision) {
            pointsGapLine = 'Top division status means promotion is not in play here.';
          } else if (isBottomDivision) {
            pointsGapLine = 'Bottom division status means no relegation drop applies here.';
          } else if (safetyGap !== undefined) {
            pointsGapLine = `${safetyGap} point${safetyGap === 1 ? '' : 's'} clear of immediate danger.`;
          }
        }

        const trendMemoryLine = trendCache
          ? (() => {
            const rankWindowLine = trendCache.rankDelta > 0
              ? `Up ${trendCache.rankDelta} place${trendCache.rankDelta === 1 ? '' : 's'} across the last ${trendCache.windowSize} gameweeks.`
              : trendCache.rankDelta < 0
                ? `Down ${Math.abs(trendCache.rankDelta)} place${Math.abs(trendCache.rankDelta) === 1 ? '' : 's'} across the last ${trendCache.windowSize} gameweeks.`
                : `Rank held steady across the last ${trendCache.windowSize} gameweeks.`;
            const pointsWindowLine = trendCache.pointsDelta >= 0
              ? `Up ${trendCache.pointsDelta} point${trendCache.pointsDelta === 1 ? '' : 's'} from ${trendCache.fromGw} to ${trendCache.toGw}.`
              : `Down ${Math.abs(trendCache.pointsDelta)} point${Math.abs(trendCache.pointsDelta) === 1 ? '' : 's'} from ${trendCache.fromGw} to ${trendCache.toGw}.`;
            const comparisonLine = trendCache.pointsDeltaVsPreviousWindow === null
              ? ''
              : trendCache.pointsDeltaVsPreviousWindow >= 0
                ? `Up ${trendCache.pointsDeltaVsPreviousWindow} points versus the previous ${trendCache.windowSize}-gameweek window.`
                : `Down ${Math.abs(trendCache.pointsDeltaVsPreviousWindow)} points versus the previous ${trendCache.windowSize}-gameweek window.`;
            const profitWindowLine = trendCache.profitDelta >= 0
              ? `Profit up ${formatSigned(trendCache.profitDelta)} over the same window.`
              : `Profit down ${formatSigned(trendCache.profitDelta)} over the same window.`;
            return `${rankWindowLine} ${pointsWindowLine} ${comparisonLine} ${profitWindowLine}`.trim();
          })()
          : 'Trend memory is still loading as more gameweeks settle.';
        const recentFormLine = team?.leagueForm?.length
          ? `Recent form ${team.leagueForm.slice(-3).join('-')} and ${team.divisionMovement || 'stable movement'} this week.`
          : 'Recent form data is limited, so watch the next result trend.';
        const bracketLine = team
          ? playoffBracketData.teamLineByTeamKey.get(normalizeTeamKey(team.name)) ?? ''
          : '';

        map.set(row.teamId, {
          phase,
          outlook,
          outlookLabel: playoffOutlookLabel(outlook),
          scope,
          playoffParticipant,
          statusCue,
          raceLine,
          expectationLine,
          actionLine,
          trendLine: `${recentFormLine} ${trendMemoryLine}`.trim(),
          pointsGapLine,
          promotionGap,
          safetyGap,
          bracketLine,
          trendMemoryLine,
        });
      });
    });
    return map;
  }, [
    currentGw,
    gwNumber,
    isGw8PlayoffWindow,
    playoffBracketData.matches,
    playoffBracketData.teamLineByTeamKey,
    playoffDivisionOrder,
    playoffTieBlueprint,
    tableDivisions,
    teamById,
    teams,
    truthLabel,
    officialDivisionSeasonComplete,
  ]);

  const spotlightTeams = useMemo<SkyStudioTeam[]>(
    () => teams.map((team) => ({
      ...team,
      playoffContext: playoffContextByTeamId.get(team.id) ?? null,
    })),
    [playoffContextByTeamId, teams],
  );

  const teamSlides = useMemo(() => TeamSpotlightSlides(spotlightTeams), [spotlightTeams]);

  const buildFocusLeaguePanels = useCallback((team: SkyStudioTeam): FocusLeaguePanel[] => {
    const panels: FocusLeaguePanel[] = [];
    const divisionRows = (team.tableSnapshot ?? [])
      .slice()
      .sort((left, right) => left.rank - right.rank || left.teamName.localeCompare(right.teamName))
      .map((row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        rank: row.rank,
        played: row.played,
        points: row.points,
        profit: row.profit,
        ballColor: row.ballColor,
        ringColor: row.ringColor,
        textColor: row.textColor,
      }));
    if (divisionRows.length > 0) {
      panels.push({
        id: `division-${team.id}`,
        title: team.league,
        summary: team.rank !== null ? `${formatRank(team.rank)} • ${team.points} pts` : 'Rank pending',
        rows: divisionRows,
      });
    }

    const masterRows = masterLeagueRows
      .slice()
      .sort((left, right) => left.rank - right.rank || left.teamName.localeCompare(right.teamName))
      .map((row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        rank: row.rank,
        played: row.played,
        points: row.points,
        profit: row.profit,
        ballColor: row.ballColor,
        ringColor: row.ringColor,
        textColor: row.textColor,
      }));
    if (team.masterPosition && masterRows.length > 0) {
      panels.push({
        id: `master-${team.id}`,
        title: 'Master League',
        summary: team.masterPosition.rank !== null ? `${formatRank(team.masterPosition.rank)} • ${team.masterPosition.points} pts` : 'Rank pending',
        rows: masterRows,
      });
    }

    const trioRow = trioLeagueRows.find((row) => row.teamId === team.id) ?? null;
    if (trioRow) {
      const trioRows = trioLeagueRows
        .filter((row) => row.division === trioRow.division)
        .slice()
        .sort((left, right) => left.rank - right.rank || left.teamName.localeCompare(right.teamName))
        .map((row) => ({
          teamId: row.teamId,
          teamName: row.teamName,
          rank: row.rank,
          played: row.played,
          points: row.points,
          profit: row.profit,
          ballColor: row.ballColor,
          ringColor: row.ringColor,
          textColor: row.textColor,
        }));
      if (trioRows.length > 0) {
        panels.push({
          id: `trio-${team.id}`,
          title: trioRow.division,
          summary: `${formatRank(trioRow.rank)} • ${trioRow.points} pts`,
          rows: trioRows,
        });
      }
    }

    const tierRow = tierLeagueRows.find((row) => row.teamId === team.id) ?? null;
    if (tierRow) {
      const tierRows = tierLeagueRows
        .filter((row) => row.division === tierRow.division)
        .slice()
        .sort((left, right) => left.rank - right.rank || left.teamName.localeCompare(right.teamName))
        .map((row) => ({
          teamId: row.teamId,
          teamName: row.teamName,
          rank: row.rank,
          played: row.played,
          points: row.points,
          profit: row.profit,
          ballColor: row.ballColor,
          ringColor: row.ringColor,
          textColor: row.textColor,
        }));
      if (tierRows.length > 0) {
        panels.push({
          id: `tier-${team.id}`,
          title: `Tier League • ${tierRow.division}`,
          summary: `${formatRank(tierRow.rank)} • ${tierRow.points} pts`,
          rows: tierRows,
        });
      }
    }

    return panels;
  }, [masterLeagueRows, tierLeagueRows, trioLeagueRows]);

  const buildFocusTeamSlides = useCallback((team: SkyStudioTeam): StudioSlide[] => {
    const leaguePanels = buildFocusLeaguePanels(team);
    const weeklyFixtures = (team.weeklyFixtures ?? []).slice();
    const leagueNarration = leaguePanels.length > 0
      ? leaguePanels.map((panel) => {
        const highlighted = panel.rows.find((row) => row.teamId === team.id) ?? null;
        return highlighted
          ? `${panel.title}: ${team.name} ${formatRank(highlighted.rank)} with ${highlighted.points} points and ${formatSigned(highlighted.profit)} profit.`
          : `${panel.title} is on screen.`;
      }).join(' ')
      : `${team.name} league positions are loading.`;
    const fixtureNarration = weeklyFixtures.length > 0
      ? weeklyFixtures.map((fixture) => `${fixture.competition}: ${fixture.fixture}. ${fixture.status}.`).join(' ')
      : `No fixtures are loaded for ${team.name} in ${team.currentGw}.`;

    const leagueSlide: StudioSlide = {
      id: `team-${team.id}-focus-leagues`,
      label: `${team.name} • League Positions`,
      durationMs: TEAM_SPOTLIGHT_SLIDE_DURATION_MS,
      narration: `${team.name} league positions board. ${leagueNarration}`,
      tone: 'team',
      content: (
        <div className="studio-team-fixture-spotlight studio-focus-team-spotlight">
          <div className="studio-team-fixture-head">
            <div className="studio-team-fixture-title">
              <TeamBadge
                name={team.name}
                ballColor={team.ballColor}
                ringColor={team.ringColor}
                textColor={team.textColor}
                size={40}
              />
              <div>
                <span className="studio-kicker">Selected Team</span>
                <h3>{team.name}</h3>
                <p>All current league positions with the team row highlighted.</p>
              </div>
            </div>
          </div>
          <div className="studio-focus-team-league-grid">
            {leaguePanels.map((panel) => (
              <section key={panel.id} className="studio-team-fixture-card studio-focus-team-league-card">
                <div className="studio-team-fixture-card-head">
                  <h4>{panel.title}</h4>
                  <span>{panel.summary}</span>
                </div>
                <div className="studio-team-table-wrap">
                  <table className="studio-team-mini-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Team</th>
                        <th>PLD</th>
                        <th>PTS</th>
                        <th>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {panel.rows.map((row) => (
                        <tr key={`${panel.id}-${row.teamId}`} className={row.teamId === team.id ? 'is-team' : ''}>
                          <td>{row.rank}</td>
                          <td className="team-cell">
                            <TeamBadge
                              name={row.teamName}
                              ballColor={row.ballColor}
                              ringColor={row.ringColor}
                              textColor={row.textColor}
                              size={22}
                            />
                            <span>{row.teamName}</span>
                          </td>
                          <td>{row.played}</td>
                          <td>{row.points}</td>
                          <td>{formatSigned(row.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </div>
      ),
    };

    const fixturesSlide: StudioSlide = {
      id: `team-${team.id}-focus-fixtures`,
      label: `${team.name} • Fixtures`,
      durationMs: TEAM_SPOTLIGHT_SLIDE_DURATION_MS,
      narration: `${team.name} fixtures board. ${fixtureNarration}`,
      tone: 'fixtures',
      content: (
        <div className="studio-team-fixture-spotlight studio-focus-team-spotlight">
          <div className="studio-team-fixture-head">
            <div className="studio-team-fixture-title">
              <TeamBadge
                name={team.name}
                ballColor={team.ballColor}
                ringColor={team.ringColor}
                textColor={team.textColor}
                size={40}
              />
              <div>
                <span className="studio-kicker">Selected Team</span>
                <h3>{team.name}</h3>
                <p>Every live fixture for {team.currentGw}, grouped by competition.</p>
              </div>
            </div>
          </div>
          <section className="studio-team-fixture-card studio-focus-team-fixtures-card">
            <div className="studio-team-fixture-card-head">
              <h4>{team.currentGw} Fixtures</h4>
              <span>{weeklyFixtures.length} competition{weeklyFixtures.length === 1 ? '' : 's'}</span>
            </div>
            {weeklyFixtures.length > 0 ? (
              <div className="studio-team-fixture-list">
                {weeklyFixtures.map((fixture) => (
                  <article key={fixture.id} className={`studio-team-fixture-item ${weeklyStatusTone(fixture.statusCode)}`}>
                    <div className="studio-team-fixture-item-head">
                      <span className="studio-comp-badge league">{fixture.competition}</span>
                      <strong>{fixture.fixture}</strong>
                      <span className={`studio-inline-result ${weeklyStatusTone(fixture.statusCode)}`}>{fixture.status}</span>
                    </div>
                    <div className="studio-focus-team-fixture-meta">
                      <span>{team.name}: {fixture.teamScore}</span>
                      <span>{fixture.opponentName ?? 'Opponent'}: {fixture.opponentScore}</span>
                    </div>
                    <p className="studio-team-fixture-reason">{fixture.picks}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="studio-muted">No fixtures are loaded for this team in {team.currentGw}.</p>
            )}
          </section>
        </div>
      ),
    };

    return [leagueSlide, fixturesSlide];
  }, [buildFocusLeaguePanels]);

  const leagueFactSlides = useMemo<StudioSlide[]>(() => {
    if (tableDivisions.length === 0) {
      return [];
    }

    const allRows = tableDivisions.flatMap((division) => division.rows);
    const divisionLeaders = tableDivisions
      .map((division) => {
        const leader = division.rows[0];
        if (!leader) {
          return null;
        }
        return {
          divisionTitle: division.title,
          teamName: leader.teamName,
          points: leader.points,
          profit: leader.profit,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const pressureZones = tableDivisions
      .map((division) => {
        const relegation = division.rows[division.rows.length - 1];
        const safe = division.rows[division.rows.length - 2];
        if (!relegation || !safe) {
          return null;
        }
        return {
          divisionTitle: division.title,
          relegationTeam: relegation.teamName,
          safetyTeam: safe.teamName,
          gap: safe.points - relegation.points,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 4);
    const divisionRunthroughs = tableDivisions
      .map((division) => {
        const rows = division.rows
          .slice()
          .sort((a, b) => a.rank - b.rank);
        if (rows.length === 0) {
          return null;
        }
        const midpoint = Math.ceil(rows.length / 2);
        const bottomRank = rows[rows.length - 1]?.rank ?? rows.length;
        const narration = rows
          .map((row) => {
            const context =
              officialDivisionSeasonComplete
                ? row.rank === 1
                  ? 'finished as division winners'
                  : row.rank === 2
                    ? 'finished as runners-up'
                    : row.rank === bottomRank
                      ? 'finished bottom in the final table'
                      : row.rank <= midpoint
                        ? 'banked a top-half finish'
                        : 'closed the season in the lower half'
                : row.rank === 1
                  ? 'setting the pace'
                  : row.rank === bottomRank
                    ? 'under pressure in the bottom place'
                    : row.rank <= midpoint
                      ? 'still in the race'
                      : 'chasing momentum';
            return `${row.teamName} are ${formatRank(row.rank)} with ${row.points} points and ${formatSigned(row.profit)} profit, ${context}.`;
          })
          .join(' ');
        return {
          divisionId: division.id,
          divisionTitle: division.title,
          rows,
          narration,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const profitLeader = allRows
      .slice()
      .sort((a, b) => b.profit - a.profit)[0];
    const spinsLeader = allRows
      .slice()
      .sort((a, b) => b.spins - a.spins)[0];
    const pointsLeader = allRows
      .slice()
      .sort((a, b) => b.points - a.points)[0];
    const competitionSummaries = fixtureGroups
      .map((group) => {
        const resolved = group.fixtures.filter((fixture) => isFixtureStatusResolved(fixture.statusCode)).length;
        return {
          title: group.title,
          total: group.fixtures.length,
          resolved,
        };
      })
      .filter((group) => group.total > 0);
    const flatFixtures = fixtureGroups.flatMap((group) => (
      group.fixtures.map((fixture) => ({
        groupTitle: group.title,
        fixture,
      }))
    ));
    const upcomingFixtures = flatFixtures
      .filter(({ fixture }) => isFixtureStatusPending(fixture.statusCode) || isFixtureStatusInPlay(fixture.statusCode))
      .slice(0, 8);
    const recentResultFixtures = flatFixtures
      .filter(({ fixture }) => isFixtureStatusResolved(fixture.statusCode))
      .slice(0, 8);
    const cupFixtures = flatFixtures
      .filter(({ groupTitle }) => /cup/i.test(groupTitle))
      .slice(0, 8);
    const masterLeagueFixtures = flatFixtures
      .filter(({ groupTitle }) => /master league/i.test(groupTitle))
      .slice(0, 8);
    const leaderBattleCards: BroadcastBattleCard[] = divisionLeaders.slice(0, 4).map((leader) => ({
      id: `leader-${leader.divisionTitle}`,
      label: leader.divisionTitle,
      headline: leader.teamName,
      detail: officialDivisionSeasonComplete
        ? `${leader.teamName} won the division on ${leader.points} points with ${formatSigned(leader.profit)} profit.`
        : `${leader.points} points with ${formatSigned(leader.profit)} profit setting the division pace.`,
      metric: `${leader.points} pts`,
      stamp: officialDivisionSeasonComplete ? 'WINNERS' : 'PACE SETTER',
      tone: officialDivisionSeasonComplete ? 'results' : 'positive',
    }));
    const pressureBattleCards: BroadcastBattleCard[] = pressureZones.slice(0, 4).map((pressure) => ({
      id: `pressure-${pressure.divisionTitle}`,
      label: pressure.divisionTitle,
      headline: pressure.relegationTeam,
      detail: officialDivisionSeasonComplete
        ? pressure.gap === 0
          ? `Finished level on points with ${pressure.safetyTeam}, but below them on the final tiebreaks.`
          : `Finished ${pressure.gap} point${pressure.gap === 1 ? '' : 's'} behind ${pressure.safetyTeam} in the final table.`
        : pressure.gap === 0
          ? `Level with ${pressure.safetyTeam}; tiebreak pressure is live.`
          : `${pressure.gap} point${pressure.gap === 1 ? '' : 's'} behind ${pressure.safetyTeam} and the safety line.`,
      metric: `${pressure.gap} pt${pressure.gap === 1 ? '' : 's'}`,
      stamp: officialDivisionSeasonComplete ? 'FINAL TABLE' : pressure.gap <= 1 ? 'SAFETY FIGHT' : 'UNDER PRESSURE',
      tone: officialDivisionSeasonComplete ? 'results' : 'warning',
    }));

    const slides: StudioSlide[] = [];

    slides.push({
      id: 'league-facts-leaders',
      label: `Division Leaders • ${currentGw}`,
      durationMs: CARD_DURATION_MS,
      narration: officialDivisionSeasonComplete
        ? `Division winners check. ${divisionLeaders.slice(0, 3).map((leader) => `${leader.teamName} won ${leader.divisionTitle}`).join('. ')}${divisionLeaders.length > 3 ? '. Additional final-table winners are on screen' : ''}.`
        : `Division leader check. ${divisionLeaders.slice(0, 3).map((leader) => `${leader.divisionTitle} led by ${leader.teamName}`).join('. ')}${divisionLeaders.length > 3 ? '. Additional divisions are on screen' : ''}.`,
      tone: 'movement',
      content: (
        <BroadcastBattleBoard
          kicker="League Overview"
          title={officialDivisionSeasonComplete ? 'Division Winners' : 'Division Leaders'}
          subtitle={officialDivisionSeasonComplete ? 'The official GW1-GW7 season is complete, so the final table leaders are locked in.' : 'Who is setting the pace in each division right now.'}
          cards={leaderBattleCards}
        />
      ),
    });

    if (pressureZones.length > 0) {
      slides.push({
        id: 'league-facts-pressure',
        label: officialDivisionSeasonComplete ? 'Final Table Outcomes' : 'Pressure Zones',
        durationMs: CARD_DURATION_MS,
        narration: officialDivisionSeasonComplete
          ? `Final table outcomes. ${pressureZones.map((pressure) => `${pressure.relegationTeam} finished behind ${pressure.safetyTeam}`).join('. ')}.`
          : `Pressure zone update. ${pressureZones.map((pressure) => `${pressure.relegationTeam} are chasing ${pressure.safetyTeam}`).join('. ')}.`,
        tone: 'movement',
        content: (
          <BroadcastBattleBoard
            kicker="League Overview"
            title={officialDivisionSeasonComplete ? 'Final Table Outcomes' : 'Pressure Zones'}
            subtitle={officialDivisionSeasonComplete ? 'Where each division landed once the official season ended after GW7.' : 'Relegation-line danger and safety pressure by division.'}
            cards={pressureBattleCards}
          />
        ),
      });
    }

    divisionRunthroughs.forEach((runthrough) => {
      slides.push({
        id: `league-facts-rundown-${runthrough.divisionId}`,
        label: `${runthrough.divisionTitle} Rundown`,
        durationMs: CARD_DURATION_MS,
        narration: `Division team rundown for ${runthrough.divisionTitle}. ${runthrough.narration}`,
        tone: 'movement',
        content: (
          <div className="studio-movement-slide">
            <span className="studio-kicker">League Rundown</span>
            <h3>{runthrough.divisionTitle}</h3>
            <p>{officialDivisionSeasonComplete ? 'Every team check-in with final position, points, and profit.' : 'Every team check-in with points, profit, and current race context.'}</p>
            <div className="studio-rivalry-grid">
              {runthrough.rows.map((row) => (
                <article key={`runthrough-${runthrough.divisionId}-${row.teamId}`} className="studio-rivalry-card">
                  <span>{formatRank(row.rank)}</span>
                  <strong>{row.teamName}</strong>
                  <strong>{row.points} pts</strong>
                  <span>{formatSigned(row.profit)} profit</span>
                  <span>{row.wins}W {row.draws}D {row.losses}L</span>
                </article>
              ))}
            </div>
          </div>
        ),
      });
    });

    slides.push({
      id: 'league-facts-analytics',
      label: 'League Analytics',
      durationMs: CARD_DURATION_MS,
      narration: `League analytics update. Profit form leader ${profitLeader?.teamName ?? 'unknown'}, points pace leader ${pointsLeader?.teamName ?? 'unknown'}, with fixtures progressing across the board.`,
      tone: 'movement',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">League Overview</span>
          <h3>League Analytics</h3>
          <p>Cross-league facts once all team spotlights finish.</p>
          <div className="studio-rivalry-grid">
            <article className="studio-rivalry-card">
              <span>Top Profit</span>
              <strong>{profitLeader?.teamName ?? '—'}</strong>
              <strong>{profitLeader ? formatSigned(profitLeader.profit) : '—'}</strong>
            </article>
            <article className="studio-rivalry-card">
              <span>Spin Leader</span>
              <strong>{spinsLeader?.teamName ?? '—'}</strong>
              <strong>{spinsLeader?.spins ?? '—'} spins</strong>
            </article>
            <article className="studio-rivalry-card">
              <span>Points Leader</span>
              <strong>{pointsLeader?.teamName ?? '—'}</strong>
              <strong>{pointsLeader?.points ?? '—'} pts</strong>
            </article>
            <article className="studio-rivalry-card">
              <span>Resolved Fixtures</span>
              <strong>{resolvedCount}/{fixtureCount}</strong>
              <span>{fixtureCount > 0 ? `${Math.round((resolvedCount / fixtureCount) * 100)}% complete` : 'No fixtures loaded'}</span>
            </article>
          </div>
        </div>
      ),
    });

    if (competitionSummaries.length > 0) {
      slides.push({
        id: 'league-facts-competitions',
        label: 'Competition Snapshot',
        durationMs: CARD_DURATION_MS,
        narration: `Competition snapshot. ${competitionSummaries.map((competition) => `${competition.title} is in progress`).join('. ')}.`,
        tone: 'movement',
        content: (
          <div className="studio-movement-slide">
            <span className="studio-kicker">League Overview</span>
            <h3>All Competitions Snapshot</h3>
            <p>League and cup progress in one view before the next team cycle.</p>
            <div className="studio-rivalry-grid">
              {competitionSummaries.map((competition) => (
                <article key={`competition-${competition.title}`} className="studio-rivalry-card">
                  <span>{competition.title}</span>
                  <strong>{competition.resolved}/{competition.total}</strong>
                  <span>{competition.total - competition.resolved} pending</span>
                </article>
              ))}
            </div>
          </div>
        ),
      });
    }

    if (upcomingFixtures.length > 0) {
      slides.push({
        id: 'league-facts-upcoming',
        label: 'Upcoming Fixtures',
        durationMs: CARD_DURATION_MS,
        narration: `Upcoming fixtures desk. ${upcomingFixtures.slice(0, 4).map(({ fixture }) => fixture.fixture).join('. ')}.`,
        tone: 'fixtures',
        content: (
          <div className="studio-fixtures-slide">
            <div className="studio-fixtures-head">
              <span className="studio-kicker">Desk • Coming Up</span>
              <h3>Upcoming Fixtures</h3>
              <p>Next ties in league, master league, and cup.</p>
            </div>
            <div className="studio-fixtures-list studio-scroll-panel">
              {upcomingFixtures.map(({ groupTitle, fixture }) => (
                <article key={`upcoming-${fixture.id}`} className={`studio-fixture-row${fixture.rivalry ? ' rivalry' : ''}`}>
                  <div className="studio-fixture-main">
                    <strong>{fixture.fixture}</strong>
                    <span className="studio-comp-badge league">{groupTitle}</span>
                  </div>
                  <div className="studio-fixture-meta">
                    <span>{fixture.outcome}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ),
      });
    }

    if (recentResultFixtures.length > 0) {
      slides.push({
        id: 'league-facts-results-just-in',
        label: 'Results Just In',
        durationMs: CARD_DURATION_MS,
        narration: `Results just in. ${recentResultFixtures.slice(0, 4).map(({ fixture }) => fixture.outcome).join('. ')}.`,
        tone: 'fixtures',
        content: (
          <div className="studio-fixtures-slide">
            <div className="studio-fixtures-head">
              <span className="studio-kicker">Desk • Just Happened</span>
              <h3>Results Just In</h3>
              <p>Recent outcomes across all active competitions.</p>
            </div>
            <div className="studio-fixtures-list studio-scroll-panel">
              {recentResultFixtures.map(({ groupTitle, fixture }) => (
                <article key={`result-${fixture.id}`} className={`studio-fixture-row${fixture.rivalry ? ' rivalry' : ''}`}>
                  <div className="studio-fixture-main">
                    <strong>{fixture.fixture}</strong>
                    <span className="studio-comp-badge cup">{groupTitle}</span>
                  </div>
                  <div className="studio-fixture-meta">
                    <span>{fixture.outcome}</span>
                    {renderScoreParts(fixture.score)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ),
      });
    }

    if (cupFixtures.length > 0) {
      slides.push({
        id: 'league-facts-cup-watch',
        label: 'Cup Watch',
        durationMs: CARD_DURATION_MS,
        narration: `Cup watch. ${cupFixtures.slice(0, 4).map(({ fixture }) => `${fixture.fixture}. ${fixture.outcome}`).join(' ')}`,
        tone: 'rivalry',
        content: (
          <div className="studio-fixtures-slide">
            <div className="studio-fixtures-head">
              <span className="studio-kicker">Desk • Cup</span>
              <h3>Cup Watch</h3>
              <p>Cup ties, winners, and pending knockout storylines.</p>
            </div>
            <div className="studio-fixtures-list studio-scroll-panel">
              {cupFixtures.map(({ groupTitle, fixture }) => (
                <article key={`cup-${fixture.id}`} className={`studio-fixture-row${fixture.rivalry ? ' rivalry' : ''}`}>
                  <div className="studio-fixture-main">
                    <strong>{fixture.fixture}</strong>
                    <span className="studio-comp-badge cup">{groupTitle}</span>
                  </div>
                  <div className="studio-fixture-meta">
                    <span>{fixture.outcome}</span>
                    {renderScoreParts(fixture.score)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ),
      });
    }

    if (masterLeagueFixtures.length > 0) {
      slides.push({
        id: 'league-facts-master-watch',
        label: 'Master League Watch',
        durationMs: CARD_DURATION_MS,
        narration: `Master league watch. ${masterLeagueFixtures.slice(0, 4).map(({ fixture }) => `${fixture.fixture}. ${fixture.outcome}`).join(' ')}`,
        tone: 'movement',
        content: (
          <div className="studio-fixtures-slide">
            <div className="studio-fixtures-head">
              <span className="studio-kicker">Desk • Master League</span>
              <h3>Master League Watch</h3>
              <p>Current master league fixtures, outcomes, and pending calls.</p>
            </div>
            <div className="studio-fixtures-list studio-scroll-panel">
              {masterLeagueFixtures.map(({ groupTitle, fixture }) => (
                <article key={`master-${fixture.id}`} className={`studio-fixture-row${fixture.rivalry ? ' rivalry' : ''}`}>
                  <div className="studio-fixture-main">
                    <strong>{fixture.fixture}</strong>
                    <span className="studio-comp-badge league">{groupTitle}</span>
                  </div>
                  <div className="studio-fixture-meta">
                    <span>{fixture.outcome}</span>
                    {renderScoreParts(fixture.score)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ),
      });
    }

    return slides;
  }, [currentGw, fixtureCount, fixtureGroups, resolvedCount, tableDivisions, officialDivisionSeasonComplete]);

  const teamOfDaySlides = useMemo<StudioSlide[]>(() => {
    if (teams.length === 0) {
      return [];
    }
    const topProfitTeam = teams
      .filter((team) => typeof team.currentGwProfit === 'number')
      .slice()
      .sort((a, b) => (b.currentGwProfit ?? -Infinity) - (a.currentGwProfit ?? -Infinity))[0] ?? null;
    const topSpinTeam = teams
      .slice()
      .sort((a, b) => b.spins - a.spins)[0] ?? null;
    const swingLeader = fixtureGroups
      .flatMap((group) => group.fixtures.map((fixture) => ({
        groupTitle: group.title,
        fixture,
        swing: parseSwingValue(fixture.profitImpact),
      })))
      .filter((entry) => entry.swing !== null)
      .sort((a, b) => Math.abs(b.swing ?? 0) - Math.abs(a.swing ?? 0))[0] ?? null;
    const swingValue = swingLeader?.swing ?? null;
    const swingLabel = typeof swingValue === 'number'
      ? `${Math.abs(swingValue).toFixed(2)} swing`
      : 'No swing data yet';
    const swingFixture = swingLeader?.fixture.fixture ?? 'Awaiting first swing';
    const narration = [
      'Team of the day snapshot.',
      topProfitTeam ? `${topProfitTeam.name} lead profit with ${formatSigned(topProfitTeam.currentGwProfit ?? 0)}.` : 'Profit leader pending.',
      topSpinTeam ? `${topSpinTeam.name} hold the spin volume lead at ${topSpinTeam.spins}.` : 'Spin leader pending.',
      swingLeader ? `Biggest swing: ${swingFixture}.` : 'Biggest swing still loading.',
    ].join(' ');
    return [{
      id: `league-team-of-day-${currentGw}`,
      label: 'Team of the Day',
      durationMs: CARD_DURATION_MS,
      narration,
      tone: 'movement',
      content: (
        <div className="studio-movement-slide studio-team-of-day">
          <span className="studio-kicker">Team of the Day</span>
          <h3>Leaders and biggest swing</h3>
          <p>Quick snapshot of the most influential movers so far.</p>
          <div className="studio-rivalry-grid">
            <article className="studio-rivalry-card">
              <span>Top Profit</span>
              <strong>{topProfitTeam?.name ?? 'Pending'}</strong>
              <span>{topProfitTeam ? formatSigned(topProfitTeam.currentGwProfit ?? 0) : 'No read yet'}</span>
            </article>
            <article className="studio-rivalry-card">
              <span>Spin Volume</span>
              <strong>{topSpinTeam?.name ?? 'Pending'}</strong>
              <span>{topSpinTeam ? `${topSpinTeam.spins} spins` : 'No read yet'}</span>
            </article>
            <article className="studio-rivalry-card">
              <span>Biggest Swing</span>
              <strong>{swingFixture}</strong>
              <span>{swingLabel}</span>
            </article>
          </div>
        </div>
      ),
    }];
  }, [currentGw, fixtureGroups, teams]);

  const shockOfGwSlides = useMemo<StudioSlide[]>(() => {
    const candidates = fixtureGroups
      .flatMap((group) => group.fixtures.map((fixture) => {
        const winner = extractFixtureWinner(fixture.outcome);
        const picks = parsePicksLabel(fixture.picks);
        const swing = parseSwingValue(fixture.profitImpact);
        const isResolved = fixture.statusCode === 'final_confirmed' || fixture.statusCode === 'provisional';
        if (!isResolved || swing === null) {
          return null;
        }
        const isShock = Boolean(winner && picks.jay && picks.computer && winner !== picks.jay && winner !== picks.computer);
        return {
          id: `${group.id}-${fixture.id}`,
          groupTitle: group.title,
          fixture: fixture.fixture,
          outcome: fixture.outcome,
          swing,
          picks,
          winner,
          isShock,
          statusCode: fixture.statusCode,
        };
      }))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    if (candidates.length === 0) {
      return [];
    }
    const shocks = candidates.filter((entry) => entry.isShock);
    const rows = (shocks.length > 0 ? shocks : candidates)
      .slice()
      .sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))
      .slice(0, 3);
    const headline = shocks.length > 0 ? 'Shock of the GW' : 'Biggest swing so far';
    const narration = rows
      .map((row) => `${row.fixture}. ${row.outcome}. Swing ${Math.abs(row.swing).toFixed(2)}.`)
      .join(' ');
    return [{
      id: `fixture-shock-${currentGw}`,
      label: 'Shock of the GW',
      durationMs: CARD_DURATION_MS,
      narration,
      tone: 'fixtures',
      content: (
        <div className="studio-movement-slide studio-shock-board">
          <span className="studio-kicker">{shocks.length > 0 ? 'Shock Radar' : 'Swing Radar'}</span>
          <h3>{headline}</h3>
          <p>{shocks.length > 0 ? 'Results that flipped both prediction cards.' : 'Largest profit swings currently on record.'}</p>
          <div className="studio-fixtures-list">
            {rows.map((row) => (
              <article key={row.id} className="studio-result-item">
                <div className="studio-result-head">
                  <span className="studio-comp-badge">{row.groupTitle}</span>
                  <strong>{row.fixture}</strong>
                  <span className="studio-inline-result pending">{fixtureStatusLabel(row.statusCode)}</span>
                </div>
                <div className="studio-result-meta">
                  <span>{row.outcome}</span>
                  <span className="studio-data-chip">{Math.abs(row.swing).toFixed(2)} swing</span>
                </div>
                <div className="studio-pick-pill-row">
                  <span className="studio-pick-pill jay">Jay {row.picks.jay ?? '—'}</span>
                  <span className="studio-pick-pill computer">Computer {row.picks.computer ?? '—'}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ),
    }];
  }, [currentGw, fixtureGroups]);

  const broadcastStorySignals = useMemo(() => {
    const teamRankByName = new Map(
      tableDivisions.flatMap((division) => (
        division.rows.map((row) => [row.teamName, { rank: row.rank, divisionTitle: division.title, profit: row.profit }] as const)
      )),
    );
    const resolvedFixtures = fixtureGroups
      .flatMap((group) => group.fixtures.map((fixture) => ({ group, fixture })))
      .filter(({ fixture }) => isFixtureStatusResolved(fixture.statusCode));
    const resolvedWithMeta = resolvedFixtures
      .map(({ group, fixture }) => {
        const winner = extractFixtureWinner(fixture.outcome);
        const sides = fixture.fixture.split(/\s+vs\s+/i).map((side) => side.trim());
        const loser = winner && sides.length === 2 ? (sides[0] === winner ? sides[1] : sides[0]) : null;
        const swing = parseSwingValue(fixture.profitImpact);
        const winnerMeta = winner ? teamRankByName.get(winner) ?? null : null;
        const loserMeta = loser ? teamRankByName.get(loser) ?? null : null;
        const rankGap = winnerMeta && loserMeta ? Math.abs(winnerMeta.rank - loserMeta.rank) : null;
        return {
          groupTitle: group.title,
          fixture,
          winner,
          loser,
          swing,
          rankGap,
          winnerMeta,
          loserMeta,
          isShock: Boolean(rankGap !== null && rankGap >= 2 && winner && loser),
        };
      })
      .filter((entry) => entry.winner && entry.loser);

    const shockResult = resolvedWithMeta
      .filter((entry) => entry.isShock)
      .sort((left, right) => (right.rankGap ?? 0) - (left.rankGap ?? 0) || Math.abs(right.swing ?? 0) - Math.abs(left.swing ?? 0))[0]
      ?? resolvedWithMeta
        .slice()
        .sort((left, right) => Math.abs(right.swing ?? 0) - Math.abs(left.swing ?? 0))[0]
      ?? null;

    const topProfitTeam = teams
      .filter((team) => typeof team.currentGwProfit === 'number')
      .slice()
      .sort((left, right) => (right.currentGwProfit ?? 0) - (left.currentGwProfit ?? 0))[0] ?? null;

    const leaders = tableDivisions
      .map((division) => {
        const leader = division.rows[0] ?? null;
        if (!leader) {
          return null;
        }
        return {
          divisionTitle: division.title,
          teamName: leader.teamName,
          points: leader.points,
          profit: leader.profit,
        };
      })
      .filter((leader): leader is NonNullable<typeof leader> => leader !== null)
      .slice(0, 4);

    const pressureTeam = tableDivisions
      .map((division) => {
        const bottom = division.rows[division.rows.length - 1] ?? null;
        const safe = division.rows[division.rows.length - 2] ?? null;
        if (!bottom || !safe) {
          return null;
        }
        return {
          divisionTitle: division.title,
          teamName: bottom.teamName,
          rank: bottom.rank,
          gap: safe.points - bottom.points,
          safetyTeam: safe.teamName,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.gap - right.gap)[0] ?? null;

    const tightTitleRace = tableDivisions
      .map((division) => {
        const leader = division.rows[0] ?? null;
        const challenger = division.rows[1] ?? null;
        if (!leader || !challenger) {
          return null;
        }
        return {
          divisionTitle: division.title,
          leaderName: leader.teamName,
          challengerName: challenger.teamName,
          gap: leader.points - challenger.points,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.gap - right.gap)[0] ?? null;

    const biggestSwing = resolvedWithMeta
      .slice()
      .sort((left, right) => Math.abs(right.swing ?? 0) - Math.abs(left.swing ?? 0))[0] ?? null;

    const lowestProfitTeam = teams
      .filter((team) => typeof team.currentGwProfit === 'number')
      .slice()
      .sort((left, right) => (left.currentGwProfit ?? 0) - (right.currentGwProfit ?? 0))[0] ?? null;

    const cupExit = resolvedWithMeta
      .filter((entry) => /cup/i.test(entry.groupTitle))
      .sort((left, right) => Math.abs(right.swing ?? 0) - Math.abs(left.swing ?? 0))[0] ?? null;

    return {
      shockResult,
      biggestSwing,
      topProfitTeam,
      lowestProfitTeam,
      leaders,
      pressureTeam,
      tightTitleRace,
      cupExit,
    };
  }, [fixtureGroups, tableDivisions, teams]);

  const broadcastHeroSlides = useMemo<StudioSlide[]>(() => {
    const {
      shockResult,
      leaders,
      pressureTeam,
      tightTitleRace,
    } = broadcastStorySignals;

    const slides: StudioSlide[] = [];

    if (shockResult?.winner && shockResult.loser) {
      slides.push({
        id: `broadcast-hero-shock-${currentGw}`,
        label: 'Hero Moment • Shock Result',
        durationMs: 2600,
        narration: `${shockResult.winner} stunned ${shockResult.loser}.`,
        tone: 'fixtures',
        content: (
          <StorylineSlide
            kicker="Hero Moment"
            stamp="SHOCK RESULT"
            headline={`${shockResult.winner} stun ${shockResult.loser}`}
            detail={shockResult.rankGap !== null
              ? `A ${shockResult.rankGap}-place ranking gap was overturned on the day.`
              : 'The expected order was flipped on the day.'}
            tone="warning"
            metrics={[
              { label: 'Rank Gap', value: shockResult.rankGap !== null ? `${shockResult.rankGap}` : 'N/A' },
              { label: 'Swing', value: shockResult.swing !== null ? `${Math.abs(shockResult.swing).toFixed(2)}` : 'N/A' },
            ]}
          />
        ),
      });
    }

    if (officialDivisionSeasonComplete && leaders.length > 0) {
      slides.push({
        id: `broadcast-hero-final-${currentGw}`,
        label: 'Hero Moment • Division Winners',
        durationMs: 2600,
        narration: `${leaders.map((leader) => `${leader.teamName} won ${leader.divisionTitle}`).join('. ')}.`,
        tone: 'movement',
        content: (
          <StorylineSlide
            kicker="Hero Moment"
            stamp="DIVISION WINNERS"
            headline="Final tables are locked"
            detail="The official GW1-GW7 division season is complete and the winners are confirmed."
            tone="positive"
            metrics={leaders.slice(0, 4).map((leader) => ({
              label: leader.divisionTitle,
              value: leader.teamName,
            }))}
          />
        ),
      });
    } else if (tightTitleRace && tightTitleRace.gap <= 2) {
      slides.push({
        id: `broadcast-hero-title-${currentGw}`,
        label: 'Hero Moment • Title Race',
        durationMs: 2600,
        narration: `${tightTitleRace.divisionTitle} is separated by ${tightTitleRace.gap} point${tightTitleRace.gap === 1 ? '' : 's'}.`,
        tone: 'movement',
        content: (
          <StorylineSlide
            kicker="Hero Moment"
            stamp="TITLE RACE"
            headline={`${tightTitleRace.divisionTitle} tightens up`}
            detail={`${tightTitleRace.leaderName} lead ${tightTitleRace.challengerName} by ${tightTitleRace.gap} point${tightTitleRace.gap === 1 ? '' : 's'}.`}
            tone="neutral"
          />
        ),
      });
    }

    if (pressureTeam) {
      slides.push({
        id: `broadcast-hero-pressure-${currentGw}`,
        label: 'Hero Moment • Pressure',
        durationMs: 2600,
        narration: `${pressureTeam.teamName} are under pressure in ${pressureTeam.divisionTitle}.`,
        tone: 'movement',
        content: (
          <StorylineSlide
            kicker="Hero Moment"
            stamp={officialDivisionSeasonComplete ? 'FINAL TABLE' : pressureTeam.gap <= 1 ? 'RELEGATION BATTLE' : 'UNDER PRESSURE'}
            headline={`${pressureTeam.teamName} in trouble`}
            detail={officialDivisionSeasonComplete
              ? `${pressureTeam.teamName} finished behind ${pressureTeam.safetyTeam} in the final table.`
              : `${pressureTeam.teamName} are ${pressureTeam.gap} point${pressureTeam.gap === 1 ? '' : 's'} behind ${pressureTeam.safetyTeam}.`}
            tone="warning"
          />
        ),
      });
    }

    return slides;
  }, [broadcastStorySignals, currentGw, officialDivisionSeasonComplete]);

  const chaosIndexSlides = useMemo<StudioSlide[]>(() => {
    const {
      biggestSwing,
      lowestProfitTeam,
      shockResult,
      topProfitTeam,
    } = broadcastStorySignals;
    if (!biggestSwing && !shockResult && !topProfitTeam && !lowestProfitTeam) {
      return [];
    }
    return [{
      id: `broadcast-chaos-index-${currentGw}`,
      label: 'Chaos Index',
      durationMs: 3200,
      narration: 'Chaos index graphic. Biggest swing, upset, loss, and top profit on one board.',
      tone: 'movement',
      content: (
        <StorylineSlide
          kicker="Chaos Index"
          stamp="QUICK READ"
          headline="This gameweek has teeth"
          detail="Fast read on the four metrics that best describe the tone of the board right now."
          tone="warning"
          metrics={[
            {
              label: 'Biggest Swing',
              value: biggestSwing?.winner && biggestSwing.loser
                ? `${biggestSwing.winner} ${Math.abs(biggestSwing.swing ?? 0).toFixed(2)}`
                : 'Pending',
            },
            {
              label: 'Biggest Upset',
              value: shockResult?.winner && shockResult.loser
                ? `${shockResult.winner} v ${shockResult.loser}`
                : 'Pending',
            },
            {
              label: 'Biggest Loss',
              value: lowestProfitTeam ? `${lowestProfitTeam.name} ${formatSigned(lowestProfitTeam.currentGwProfit ?? 0)}` : 'Pending',
            },
            {
              label: 'Top Profit',
              value: topProfitTeam ? `${topProfitTeam.name} ${formatSigned(topProfitTeam.currentGwProfit ?? 0)}` : 'Pending',
            },
          ]}
        />
      ),
    }];
  }, [broadcastStorySignals, currentGw]);

  const broadcastStorylineSlides = useMemo<StudioSlide[]>(() => {
    const {
      shockResult,
      topProfitTeam,
      leaders,
      pressureTeam,
      cupExit,
    } = broadcastStorySignals;

    const slides: StudioSlide[] = [];

    if (shockResult?.winner && shockResult.loser) {
      slides.push({
        id: `broadcast-story-shock-${currentGw}`,
        label: 'Storyline • Shock Result',
        durationMs: 4200,
        narration: `${shockResult.winner} shocked ${shockResult.loser}. Rank gap ${shockResult.rankGap ?? 0}. Profit margin ${Math.abs(shockResult.swing ?? 0).toFixed(2)}.`,
        tone: 'fixtures',
        content: (
          <StorylineSlide
            kicker="Storyline Engine"
            stamp={shockResult.rankGap && shockResult.rankGap >= 4 ? 'HUGE UPSET' : 'SHOCK RESULT'}
            headline={`${shockResult.winner} stun ${shockResult.loser}`}
            detail={`${shockResult.groupTitle}. ${fixtureStatusLabel(shockResult.fixture.statusCode)} result with the margin built from live profit swings.`}
            tone={shockResult.rankGap && shockResult.rankGap >= 4 ? 'warning' : 'neutral'}
            metrics={[
              { label: 'Rank Gap', value: shockResult.rankGap !== null ? `${shockResult.rankGap}` : 'N/A' },
              { label: 'Swing', value: shockResult.swing !== null ? `${Math.abs(shockResult.swing).toFixed(2)}` : 'N/A' },
            ]}
            aside={(
              <ShockResultCard
                winner={shockResult.winner}
                loser={shockResult.loser}
                rankGap={shockResult.rankGap !== null ? `${shockResult.rankGap} places` : 'N/A'}
                profitMargin={shockResult.swing !== null ? `${Math.abs(shockResult.swing).toFixed(2)}` : 'N/A'}
                detail={shockResult.rankGap !== null
                  ? `${shockResult.winner} overturned a ${shockResult.rankGap}-place table gap.`
                  : 'A result that broke the expected order.'}
              />
            )}
          />
        ),
      });
    }

    if (topProfitTeam) {
      slides.push({
        id: `broadcast-story-profit-${currentGw}`,
        label: 'Storyline • Top Profit',
        durationMs: 4000,
        narration: `${topProfitTeam.name} lead the current profit board with ${formatSigned(topProfitTeam.currentGwProfit ?? 0)}.`,
        tone: 'movement',
        content: (
          <StorylineSlide
            kicker="Storyline Engine"
            stamp="TOP PROFIT"
            headline={`${topProfitTeam.name} set the pace`}
            detail={`${topProfitTeam.name} are delivering the strongest profit return on the current board from ${topProfitTeam.league}.`}
            tone="positive"
            metrics={[
              { label: 'Current Profit', value: formatSigned(topProfitTeam.currentGwProfit ?? 0) },
              { label: 'Division Rank', value: topProfitTeam.rank !== null ? formatRank(topProfitTeam.rank) : 'Pending' },
              { label: 'Season Profit', value: formatSigned(topProfitTeam.seasonProfit) },
            ]}
          />
        ),
      });
    }

    if (leaders.length > 0) {
      slides.push({
        id: `broadcast-story-leaders-${currentGw}`,
        label: 'Storyline • Division Leaders',
        durationMs: 4300,
        narration: officialDivisionSeasonComplete
          ? `${leaders.map((leader) => `${leader.teamName} won ${leader.divisionTitle}`).join('. ')}.`
          : `${leaders.map((leader) => `${leader.teamName} lead ${leader.divisionTitle}`).join('. ')}.`,
        tone: 'movement',
        content: (
          <StorylineSlide
            kicker="Storyline Engine"
            stamp={officialDivisionSeasonComplete ? 'FINAL TABLE' : 'TITLE WATCH'}
            headline={officialDivisionSeasonComplete ? 'Division winners locked in' : 'Division leaders setting the pace'}
            detail={officialDivisionSeasonComplete
              ? 'The official GW1-GW7 season is done, so these table leaders are the confirmed division winners.'
              : 'The lead positions across the divisions are still driving the weekly narrative.'}
            metrics={leaders.map((leader) => ({
              label: leader.divisionTitle,
              value: `${leader.teamName} • ${leader.points} pts`,
            }))}
          />
        ),
      });
    }

    if (pressureTeam) {
      slides.push({
        id: `broadcast-story-pressure-${currentGw}`,
        label: 'Storyline • Pressure',
        durationMs: 4000,
        narration: `${pressureTeam.teamName} are ${pressureTeam.gap} point${pressureTeam.gap === 1 ? '' : 's'} behind ${pressureTeam.safetyTeam}.`,
        tone: 'movement',
        content: (
          <StorylineSlide
            kicker="Storyline Engine"
            stamp={officialDivisionSeasonComplete ? 'FINAL TABLE' : pressureTeam.gap <= 1 ? 'SAFETY FIGHT' : 'RELEGATION PRESSURE'}
            headline={`${pressureTeam.teamName} under pressure`}
            detail={officialDivisionSeasonComplete
              ? `${pressureTeam.teamName} ended below ${pressureTeam.safetyTeam} once the official division season closed.`
              : `${pressureTeam.teamName} are chasing ${pressureTeam.safetyTeam} with the safety line still in sight.`}
            tone="warning"
            metrics={[
              { label: 'Division', value: pressureTeam.divisionTitle },
              { label: 'Gap', value: `${pressureTeam.gap} pts` },
              { label: 'Current Rank', value: formatRank(pressureTeam.rank) },
            ]}
          />
        ),
      });
    }

    if (cupExit?.winner && cupExit.loser) {
      slides.push({
        id: `broadcast-story-cup-exit-${currentGw}`,
        label: 'Storyline • Cup Elimination',
        durationMs: 3900,
        narration: `${cupExit.winner} knocked ${cupExit.loser} out in ${cupExit.groupTitle}.`,
        tone: 'fixtures',
        content: (
          <StorylineSlide
            kicker="Storyline Engine"
            stamp="CUP EXIT"
            headline={`${cupExit.loser} are out`}
            detail={`${cupExit.winner} ended ${cupExit.loser}'s cup run in ${cupExit.groupTitle}.`}
            tone="warning"
            metrics={[
              { label: 'Competition', value: cupExit.groupTitle },
              { label: 'Winner', value: cupExit.winner },
              { label: 'Swing', value: cupExit.swing !== null ? `${Math.abs(cupExit.swing).toFixed(2)}` : 'N/A' },
            ]}
          />
        ),
      });
    }

    return slides;
  }, [broadcastStorySignals, currentGw, officialDivisionSeasonComplete]);

  const broadcastGraphicsSlides = useMemo<StudioSlide[]>(() => {
    if (tableDivisions.length === 0 || teams.length === 0) {
      return [];
    }

    const teamById = new Map(teams.map((team) => [team.id, team]));
    const currentGwNumber = Math.max(1, parseGwNumber(currentGw));
    const recentGwNumbers = Array.from(
      { length: Math.min(3, currentGwNumber) },
      (_, index) => Math.max(1, currentGwNumber - (Math.min(3, currentGwNumber) - 1) + index),
    );
    const momentumRows = tableDivisions.map((division) => {
      const divisionTeams = division.rows
        .map((row) => teamById.get(row.teamId))
        .filter((team): team is SkyStudioTeam => Boolean(team));
      const values = recentGwNumbers.map((gwNumber) => {
        const currentLabel = `GW${gwNumber}`;
        const previousLabel = gwNumber > 1 ? `GW${gwNumber - 1}` : null;
        const deltas = divisionTeams
          .map((team) => {
            const currentValue = team.seasonStory.find((point) => point.gw === currentLabel)?.cumulativeProfit ?? null;
            const previousValue = previousLabel ? team.seasonStory.find((point) => point.gw === previousLabel)?.cumulativeProfit ?? 0 : 0;
            if (currentValue === null) {
              return null;
            }
            return Number((currentValue - previousValue).toFixed(2));
          })
          .filter((value): value is number => value !== null);
        if (deltas.length === 0) {
          return 0;
        }
        return Number((deltas.reduce((sum, value) => sum + value, 0) / deltas.length).toFixed(2));
      });
      return {
        divisionTitle: division.title,
        values,
      };
    });

    const formTableRows = teams
      .map((team) => {
        const lastThreeForm = team.leagueForm.slice(-3);
        const resolvedJourney = (team.currentLeagueJourney ?? []).filter((fixture) => fixture.result !== 'P').slice(-3);
        const profitDelta = resolvedJourney.reduce((sum, fixture) => sum + (fixture.profit ?? 0), 0);
        return {
          teamName: team.name,
          formValue: formPoints(lastThreeForm),
          formScore: `${formPoints(lastThreeForm)}/9`,
          profitChange: formatSigned(Number(profitDelta.toFixed(2))),
        };
      })
      .sort((left, right) => right.formValue - left.formValue || Number(right.profitChange) - Number(left.profitChange))
      .slice(0, 6);

    const raceMeters = tableDivisions.slice(0, 4).map((division) => ({
      divisionTitle: division.title,
      bars: division.rows
        .slice()
        .sort((left, right) => right.points - left.points || right.profit - left.profit)
        .slice(0, 3)
        .map((row) => ({
          teamName: row.teamName,
          value: row.points,
          label: `${row.points} pts`,
        })),
    })).filter((division) => division.bars.length > 0);

    return [
      {
        id: `broadcast-momentum-${currentGw}`,
        label: 'Broadcast • Momentum Desk',
        durationMs: 6200,
        narration: `${momentumRows.map((row) => `${row.divisionTitle} momentum ${row.values[row.values.length - 1] >= 0 ? 'rising' : 'dropping'}`).join('. ')}.`,
        tone: 'movement' as const,
        content: (
          <div className="broadcast-graphics-shell">
            <div className="studio-fixtures-head studio-odds-head">
              <span className="studio-kicker">Broadcast Graphics</span>
              <h3>Momentum Desk</h3>
              <p>Recent division movement and the strongest three-game form across the board.</p>
            </div>
            <div className="broadcast-graphics-grid">
              <div className="broadcast-graphics-card">
                <div className="broadcast-momentum-grid">
                  {momentumRows.map((row) => (
                    <MomentumMeter key={`momentum-${row.divisionTitle}`} label={row.divisionTitle} values={row.values} />
                  ))}
                </div>
              </div>
              <div className="broadcast-graphics-card">
                <FormTable title="Last 3 gameweeks" rows={formTableRows.map((row) => ({
                  teamName: row.teamName,
                  formScore: row.formScore,
                  profitChange: row.profitChange,
                }))} />
              </div>
            </div>
          </div>
        ),
      },
      {
        id: `broadcast-race-meter-${currentGw}`,
        label: 'Broadcast • Race Meter',
        durationMs: 5800,
        narration: `${raceMeters.map((division) => `${division.divisionTitle} led by ${division.bars[0]?.teamName ?? 'pending'}`).join('. ')}.`,
        tone: 'movement' as const,
        content: (
          <div className="broadcast-graphics-shell">
            <div className="studio-fixtures-head studio-odds-head">
              <span className="studio-kicker">Broadcast Graphics</span>
              <h3>Division Race Meter</h3>
              <p>Quick visual read on the top of each division using live points.</p>
            </div>
            <div className="broadcast-race-grid">
              {raceMeters.map((division) => (
                <DivisionRaceMeter key={`race-${division.divisionTitle}`} title={division.divisionTitle} bars={division.bars} />
              ))}
            </div>
          </div>
        ),
      },
    ];
  }, [currentGw, tableDivisions, teams]);

  const momentumHeatSlides = useMemo<StudioSlide[]>(() => {
    if (tableDivisions.length === 0 || teams.length === 0) {
      return [];
    }
    const currentGwNumber = Math.max(1, parseGwNumber(currentGw));
    const gwNumbers: number[] = [];
    for (let gwNum = Math.max(1, currentGwNumber - 2); gwNum <= currentGwNumber; gwNum += 1) {
      gwNumbers.push(gwNum);
    }
    const gwLabels = gwNumbers.map((gwNum) => `GW${gwNum}`);
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const rows = tableDivisions.map((division) => {
      const divisionTeams = division.rows
        .map((row) => teamById.get(row.teamId))
        .filter((team): team is SkyStudioTeam => Boolean(team));
      const deltas = gwLabels.map((gwLabel) => {
        const prevGwNumber = Math.max(0, parseGwNumber(gwLabel) - 1);
        const prevLabel = prevGwNumber > 0 ? `GW${prevGwNumber}` : null;
        const values = divisionTeams
          .map((team) => {
            const current = team.seasonStory?.find((point) => point.gw === gwLabel)?.cumulativeProfit;
            if (current === undefined || current === null || prevLabel === null) {
              return null;
            }
            const previous = team.seasonStory?.find((point) => point.gw === prevLabel)?.cumulativeProfit;
            if (previous === undefined || previous === null) {
              return null;
            }
            return current - previous;
          })
          .filter((value): value is number => value !== null);
        if (values.length === 0) {
          return null;
        }
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        return Number(avg.toFixed(2));
      });
      return { divisionTitle: division.title, deltas };
    });
    const narration = rows
      .map((row) => {
        const lastDelta = row.deltas[row.deltas.length - 1];
        const trend = lastDelta === null
          ? 'flat'
          : lastDelta > 0
            ? 'up'
            : lastDelta < 0
              ? 'down'
              : 'flat';
        return `${row.divisionTitle} trend ${trend}.`;
      })
      .join(' ');
    return [{
      id: `league-momentum-${currentGw}`,
      label: 'Momentum Heat Map',
      durationMs: CARD_DURATION_MS,
      narration,
      tone: 'movement',
      content: (
        <div className="studio-movement-slide studio-heatmap">
          <span className="studio-kicker">Momentum Heat Map</span>
          <h3>Division momentum by gameweek</h3>
          <p>Average profit delta across the last three gameweeks.</p>
          <div className="studio-heatmap-grid" style={{ gridTemplateColumns: `160px repeat(${gwLabels.length}, minmax(0, 1fr))` }}>
            <span className="studio-heatmap-head">Division</span>
            {gwLabels.map((label) => (
              <span key={`heat-head-${label}`} className="studio-heatmap-head">{label}</span>
            ))}
          </div>
          <div className="studio-heatmap-rows">
            {rows.map((row) => (
              <div
                key={`heat-${row.divisionTitle}`}
                className="studio-heatmap-grid studio-heatmap-row"
                style={{ gridTemplateColumns: `160px repeat(${gwLabels.length}, minmax(0, 1fr))` }}
              >
                <span className="studio-heatmap-label">{row.divisionTitle}</span>
                {row.deltas.map((delta, idx) => {
                  const magnitude = delta === null ? 0 : Math.abs(delta);
                  const tone = delta === null
                    ? 'empty'
                    : delta > 0
                      ? magnitude >= 3 ? 'up-strong' : magnitude >= 1 ? 'up' : 'flat'
                      : magnitude >= 3 ? 'down-strong' : magnitude >= 1 ? 'down' : 'flat';
                  return (
                    <span key={`heat-${row.divisionTitle}-${idx}`} className={`studio-heat-cell ${tone}`}>
                      {delta === null ? '—' : delta.toFixed(2)}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ),
    }];
  }, [currentGw, tableDivisions, teams]);

  const cupBracketSlides = useMemo<StudioSlide[]>(() => {
    if (cupFixtures.length === 0) {
      return [];
    }
    const roundGroups = groupCupFixturesByRound(cupFixtures);
    const roadRounds = roundGroups.filter((group) => group.key === 'r32' || group.key === 'r16' || group.key === 'qf');
    const semiRound = roundGroups.find((group) => group.key === 'sf');
    const finalRound = roundGroups.find((group) => group.key === 'f');
    if (semiRound || finalRound) {
      const slides: StudioSlide[] = [];
      if (roadRounds.length > 0) {
        slides.push({
          id: `cup-road-summary-${currentGw}`,
          label: 'Cup Road Summary',
          durationMs: CARD_DURATION_MS,
          narration: `Cup road summary. ${roadRounds.map((round) => `${round.label}: ${round.fixtures.filter((fixture) => fixture.winnerTeam).length} of ${round.fixtures.length} resolved`).join('. ')}.`,
          tone: 'cup',
          content: (
            <div className="studio-movement-slide studio-cup-bracket">
              <span className="studio-kicker">Cup Road</span>
              <h3>{finalRound ? 'Road to the Final' : 'Road to the Semifinals'}</h3>
              <p>Earlier knockout rounds condensed into one board.</p>
              <div className="studio-bracket-grid">
                {roadRounds.map((round) => {
                  const winners = round.fixtures.map((fixture) => fixture.winnerTeam).filter((value): value is string => Boolean(value));
                  return (
                    <div key={`cup-road-${round.key}`} className="studio-bracket-column">
                      <span className="studio-bracket-title">{round.label}</span>
                      <div className="studio-bracket-list">
                        <article className="studio-result-item">
                          <div className="studio-result-head">
                            <strong>{round.fixtures.filter((fixture) => fixture.winnerTeam).length}/{round.fixtures.length} resolved</strong>
                          </div>
                          <div className="studio-result-meta">
                            <span>{winners.length > 0 ? `Winners: ${winners.join(', ')}` : 'Winners pending'}</span>
                          </div>
                        </article>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        });
      }
      if (semiRound) {
        slides.push({
          id: `cup-semifinals-${currentGw}`,
          label: 'Cup Update • Semifinals',
          durationMs: CARD_DURATION_MS,
          narration: `Cup semifinals. ${semiRound.fixtures.map((fixture) => `${cupFixtureTeamsLabel(fixture)}. ${cupFixtureDetailLabel(fixture)}`).join(' ')}`,
          tone: 'cup',
          content: (
            <div className="studio-fixtures-slide">
              <div className="studio-fixtures-head">
                <span className="studio-kicker">Cup Update</span>
                <h3>Semifinals</h3>
                <p>Both semifinal ties on one screen.</p>
              </div>
              <div className="studio-fixtures-list studio-scroll-panel">
                {semiRound.fixtures.map((fixture) => (
                  <article key={`cup-semi-${fixture.id}`} className="studio-fixture-row">
                    <div className="studio-fixture-main">
                      <strong>{cupFixtureTeamsLabel(fixture)}</strong>
                      <span className="studio-comp-badge cup">{fixture.gw}</span>
                    </div>
                    <div className="studio-fixture-meta">
                      <span>{cupFixtureScoreLabel(fixture)}</span>
                      <span>{cupFixtureDetailLabel(fixture)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ),
        });
      }
      if (finalRound) {
        slides.push({
          id: `cup-final-${currentGw}`,
          label: 'Cup Update • Final',
          durationMs: CARD_DURATION_MS,
          narration: `Cup final. ${finalRound.fixtures.map((fixture) => `${cupFixtureTeamsLabel(fixture)}. ${cupFixtureScoreLabel(fixture)}. ${cupFixtureDetailLabel(fixture)}`).join(' ')}`,
          tone: 'cup',
          content: (
            <div className="studio-fixtures-slide">
              <div className="studio-fixtures-head">
                <span className="studio-kicker">Cup Final</span>
                <h3>{finalRound.fixtures[0] ? cupFixtureTeamsLabel(finalRound.fixtures[0]) : 'Final pending'}</h3>
                <p>The showpiece tie with scoreline and outcome on screen.</p>
              </div>
              <div className="studio-fixtures-list">
                {finalRound.fixtures.map((fixture) => (
                  <article key={`cup-final-${fixture.id}`} className="studio-fixture-row rivalry">
                    <div className="studio-fixture-main">
                      <strong>{cupFixtureTeamsLabel(fixture)}</strong>
                      <span className="studio-comp-badge cup">{fixture.gw}</span>
                    </div>
                    <div className="studio-fixture-meta">
                      <span>{cupFixtureScoreLabel(fixture)}</span>
                      <span>{cupFixtureDetailLabel(fixture)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ),
        });
      }
      return slides;
    }
    const currentGwNumber = parseGwNumber(currentGw);
    const currentRoundFixtures = cupFixtures.filter((fixture) => fixture.gw === currentGw);
    const nextRoundGw = cupFixtures
      .map((fixture) => parseGwNumber(fixture.gw))
      .filter((gwNum) => gwNum > currentGwNumber)
      .sort((a, b) => a - b)[0];
    const nextRoundLabel = nextRoundGw ? `GW${nextRoundGw}` : null;
    const nextRoundFixtures = nextRoundLabel
      ? cupFixtures.filter((fixture) => fixture.gw === nextRoundLabel)
      : [];
    const formatTie = (fixture: SkyStudioCupFixture): string => {
      const home = fixture.homeTeam ?? 'TBD';
      const away = fixture.awayTeam ?? 'TBD';
      return `${home} vs ${away}`;
    };
    const narration = [
      currentRoundFixtures.length > 0
        ? `Cup round ${currentRoundFixtures[0]?.roundName ?? currentGw} is in focus.`
        : 'Cup round data is still loading.',
      nextRoundFixtures.length > 0
        ? `Next round preview: ${nextRoundFixtures[0]?.roundName ?? nextRoundLabel}.`
        : 'Next round pairing updates are pending.',
    ].join(' ');
    return [{
      id: `cup-bracket-${currentGw}`,
      label: 'Cup Bracket Spotlight',
      durationMs: CARD_DURATION_MS,
      narration,
      tone: 'cup',
      content: (
        <div className="studio-movement-slide studio-cup-bracket">
          <span className="studio-kicker">Cup Bracket Spotlight</span>
          <h3>Bookie Trophy path check</h3>
          <p>Current round and next round preview.</p>
          <div className="studio-bracket-grid">
            <div className="studio-bracket-column">
              <span className="studio-bracket-title">
                {currentRoundFixtures.length > 0 ? currentRoundFixtures[0]?.roundName ?? currentGw : 'Current Round'}
              </span>
              <div className="studio-bracket-list">
                {(currentRoundFixtures.length > 0 ? currentRoundFixtures : cupFixtures.slice(0, 4)).slice(0, 6).map((fixture) => (
                  <article key={`cup-current-${fixture.id}`} className="studio-result-item">
                    <div className="studio-result-head">
                      <span className="studio-comp-badge cup">{fixture.gw}</span>
                      <strong>{formatTie(fixture)}</strong>
                      <span className={`studio-inline-result ${fixture.winnerTeam ? 'win' : 'pending'}`}>{fixture.winnerTeam ? 'Winner' : 'Pending'}</span>
                    </div>
                    <div className="studio-result-meta">
                      <span>{cupFixtureScoreLabel(fixture)}</span>
                      <span>{cupFixtureDetailLabel(fixture)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="studio-bracket-column">
              <span className="studio-bracket-title">{nextRoundFixtures.length > 0 ? (nextRoundFixtures[0]?.roundName ?? nextRoundLabel) : 'Next Round'}</span>
              <div className="studio-bracket-list">
                {(nextRoundFixtures.length > 0 ? nextRoundFixtures : []).slice(0, 6).map((fixture) => (
                  <article key={`cup-next-${fixture.id}`} className="studio-result-item">
                    <div className="studio-result-head">
                      <span className="studio-comp-badge cup">{fixture.gw}</span>
                      <strong>{formatTie(fixture)}</strong>
                      <span className="studio-inline-result pending">Pending</span>
                    </div>
                    <div className="studio-result-meta">
                      <span>{cupFixtureScoreLabel(fixture)}</span>
                      <span>{cupFixtureDetailLabel(fixture)}</span>
                    </div>
                  </article>
                ))}
                {nextRoundFixtures.length === 0 && (
                  <div className="studio-bracket-empty">Next round fixtures will appear once current ties resolve.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
    }];
  }, [cupFixtures, currentGw]);

  const predictionDeltaSlides = useMemo<StudioSlide[]>(() => {
    const rows = fixtureGroups
      .flatMap((group) => group.fixtures.map((fixture) => {
        const picks = parsePicksLabel(fixture.picks);
        if (!picks.jay || !picks.computer || picks.jay === picks.computer) {
          return null;
        }
        return {
          id: `${group.id}-${fixture.id}`,
          groupTitle: group.title,
          fixture: fixture.fixture,
          picks,
          statusCode: fixture.statusCode,
        };
      }))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    if (rows.length === 0) {
      return [];
    }
    const narration = rows
      .slice(0, 3)
      .map((row) => `${row.fixture}: Jay on ${row.picks.jay}, Computer on ${row.picks.computer}.`)
      .join(' ');
    return [{
      id: `results-prediction-delta-${currentGw}`,
      label: 'Prediction Delta',
      durationMs: CARD_DURATION_MS,
      narration,
      tone: 'results',
      content: (
        <div className="studio-movement-slide studio-prediction-delta">
          <span className="studio-kicker">Prediction Delta</span>
          <h3>Jay vs Computer split board</h3>
          <p>{rows.length} split calls shaping today’s risk profile.</p>
          <div className="studio-fixtures-list">
            {rows.slice(0, 6).map((row) => (
              <article key={`delta-${row.id}`} className="studio-result-item">
                <div className="studio-result-head">
                  <span className="studio-comp-badge">{row.groupTitle}</span>
                  <strong>{row.fixture}</strong>
                  <span className="studio-inline-result pending">{fixtureStatusLabel(row.statusCode)}</span>
                </div>
                <div className="studio-pick-pill-row">
                  <span className="studio-pick-pill jay">Jay {row.picks.jay}</span>
                  <span className="studio-pick-pill computer">Computer {row.picks.computer}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ),
    }];
  }, [currentGw, fixtureGroups]);

  const teamTableSnapshotByName = useMemo(() => {
    const map = new Map<string, {
      divisionTitle: string;
      teamName: string;
      rank: number;
      points: number;
      profit: number;
      wins: number;
      draws: number;
      losses: number;
    }>();
    tableDivisions.forEach((division) => {
      division.rows.forEach((row) => {
        map.set(normalizeTeamKey(row.teamName), {
          divisionTitle: division.title,
          teamName: row.teamName,
          rank: row.rank,
          points: row.points,
          profit: row.profit,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
        });
      });
    });
    return map;
  }, [tableDivisions]);

  const broadcastPackageSlides = useMemo<StudioSlide[]>(() => {
    if (broadcastPackages.length === 0) {
      return [];
    }
    return broadcastPackages.map((pkg, index) => {
      const narrationLines = pkg.lines.slice(0, 3);
      const leadLine = narrationLines[0] ?? pkg.lines[0] ?? pkg.headline;
      const narration = narrationLines.length > 0
        ? `${pkg.headline}. ${narrationLines.join(' ')}`
        : pkg.headline;
      return {
        id: `broadcast-package-${pkg.id}`,
        label: pkg.label,
        durationMs: pkg.durationMs ?? (index === 0 ? 20000 : CARD_DURATION_MS),
        narration,
        tone: pkg.tone ?? 'movement',
        content: (
          pkg.content ?? (
            <div className="studio-movement-slide">
              <span className="studio-kicker">{pkg.alert ?? 'Broadcast Package'}</span>
              <h3>{pkg.headline}</h3>
              <p>{leadLine}</p>
              <div className="studio-rivalry-grid">
                {pkg.lines.slice(0, 3).map((line) => (
                  <article key={`${pkg.id}-${line}`} className="studio-rivalry-card">
                    <strong>{line}</strong>
                  </article>
                ))}
              </div>
            </div>
          )
        ),
      };
    });
  }, [broadcastPackages]);

  const allTimeSegmentData = useMemo(() => {
    if (!allTimeLeagues) {
      return null;
    }
    const rangeLabel = `From ${allTimeLeagues.fromSeason} ${allTimeLeagues.fromGw} to ${allTimeLeagues.toSeason} ${allTimeLeagues.toGw}.`;
    const build = (mode: AllTimeLeagueMode) => {
      const table =
        mode === 'points'
          ? allTimeLeagues.pointsTable
          : mode === 'profit'
            ? allTimeLeagues.profitTable
            : allTimeLeagues.spinsTable;
      const rows = [...table].sort((a, b) => a.rank - b.rank).slice(0, 10);
      const leader = rows[0] ?? null;
      const topFiveNames = rows.slice(0, 5).map((row) => row.teamName).join(', ');
      const metricValue = leader
        ? mode === 'profit'
          ? `${formatSigned(leader.profit)} ${ALL_TIME_MODE_COPY[mode].metric}`
          : mode === 'spins'
            ? `${formatWhole(leader.spins)} ${ALL_TIME_MODE_COPY[mode].metric}`
            : `${formatWhole(leader.points)} ${ALL_TIME_MODE_COPY[mode].metric}`
        : null;
      const leaderLine = leader && metricValue
        ? `${leader.teamName} sit top on ${metricValue}.`
        : `${ALL_TIME_MODE_COPY[mode].title} board is loading.`;
      const topLine = topFiveNames ? `Top five: ${topFiveNames}.` : 'Top five list pending.';
      return {
        rows,
        leader,
        leaderLine,
        topLine,
        topFiveNames,
        rangeLine: rangeLabel,
      };
    };

    return {
      rangeLabel,
      points: build('points'),
      profit: build('profit'),
      spins: build('spins'),
    };
  }, [allTimeLeagues]);

  const allTimeSegmentModes = useMemo<AllTimeLeagueMode[]>(
    () => {
      if (!allTimeSegmentData) {
        return [];
      }
      return ALL_TIME_SEGMENT_ORDER;
    },
    [allTimeSegmentData],
  );

  const buildAllTimeSegmentSlide = useCallback(
    (mode: AllTimeLeagueMode, sequence: number): StudioSlide | null => {
      if (!allTimeSegmentData) {
        return null;
      }
      const segment = allTimeSegmentData[mode];
      if (!segment) {
        return null;
      }
      const rows = segment.rows;
      const leaderValue = segment.leader
        ? mode === 'profit'
          ? formatSigned(segment.leader.profit)
          : mode === 'spins'
            ? formatWhole(segment.leader.spins)
            : formatWhole(segment.leader.points)
        : null;
      const leaderMetricLabel = ALL_TIME_MODE_COPY[mode].metric;
      const narration = [
        `${ALL_TIME_MODE_COPY[mode].title}.`,
        segment.leaderLine,
        segment.topLine,
        segment.rangeLine,
      ]
        .filter(Boolean)
        .join(' ');
      return {
        id: `all-time-segment-${currentGw}-${mode}-${sequence}`,
        label: ALL_TIME_MODE_COPY[mode].title,
        durationMs: ALL_TIME_SEGMENT_DURATION_MS,
        narration,
        tone: 'movement',
        content: (
          <div className="studio-movement-slide studio-alltime-slide">
            <span className="studio-kicker">All-Time League Show</span>
            <h3>{ALL_TIME_MODE_COPY[mode].title}</h3>
            <p>{ALL_TIME_MODE_COPY[mode].subtitle}</p>
            <div className="studio-team-three-col split">
              <div className="studio-scroll-panel">
                {rows.length === 0 ? (
                  <p className="studio-muted">No all-time rows yet.</p>
                ) : (
                  <table className="scoreboard-table master-league-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Team</th>
                        <th>PLD</th>
                        <th>W</th>
                        <th>L</th>
                        <th>D</th>
                        <th>Pts</th>
                        <th>Spins</th>
                        <th>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`all-time-${mode}-${row.teamId}`}>
                          <td>{row.rank}</td>
                          <td>
                            <span className="master-team-cell">
                              <TeamBadge
                                name={row.teamName}
                                ballColor={row.ballColor}
                                ringColor={row.ringColor}
                                textColor={row.textColor}
                                size={20}
                              />
                              {row.teamName}
                            </span>
                          </td>
                          <td>{formatWhole(row.played)}</td>
                          <td>{formatWhole(row.wins)}</td>
                          <td>{formatWhole(row.losses)}</td>
                          <td>{formatWhole(row.draws)}</td>
                          <td>{formatWhole(row.points)}</td>
                          <td>{formatWhole(row.spins)}</td>
                          <td>{formatSigned(row.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="studio-rivalry-grid">
                <article className="studio-rivalry-card">
                  <span>Leader</span>
                  <strong>{segment.leader ? segment.leader.teamName : 'Board loading'}</strong>
                  <span>{leaderValue ? `${leaderValue} ${leaderMetricLabel}` : 'Awaiting table data'}</span>
                </article>
                <article className="studio-rivalry-card">
                  <span>Top Five</span>
                  <strong>{segment.topFiveNames || 'Awaiting list'}</strong>
                </article>
                <article className="studio-rivalry-card">
                  <span>Coverage Window</span>
                  <strong>{segment.rangeLine}</strong>
                </article>
              </div>
            </div>
          </div>
        ),
      };
    },
    [allTimeSegmentData, currentGw],
  );

  const changeBriefSlides = useMemo<StudioSlide[]>(() => {
    if (movements.length === 0) {
      return [];
    }
    const topChanges = movements.slice(0, 6);
    const narration = topChanges
      .slice(0, 3)
      .map((item) => `${item.label}: ${item.headline}`)
      .join('. ');
    return [
      {
        id: `change-brief-${currentGw}`,
        label: `What Changed • ${currentGw}`,
        durationMs: CARD_DURATION_MS,
        narration: `What changed bulletin for ${currentGw}. ${narration}.`,
        tone: 'movement',
        content: (
          <div className="studio-movement-slide">
            <span className="studio-kicker">What Changed</span>
            <h3>{currentGw} Movement Briefing</h3>
            <p>Biggest table and momentum swings since the last update.</p>
            <div className="studio-rivalry-grid">
              {topChanges.map((item) => (
                <article key={`change-${item.id}`} className="studio-rivalry-card">
                  <span>{item.label}</span>
                  <strong>{item.headline}</strong>
                  <span>{item.detail}</span>
                </article>
              ))}
            </div>
          </div>
        ),
      },
    ];
  }, [currentGw, movements]);

  const whyMattersSlides = useMemo<StudioSlide[]>(() => {
    const slides: StudioSlide[] = [];
    const allFixtures = fixtureGroups.flatMap((group) => group.fixtures.map((fixture) => ({ group, fixture })));
    const pending = allFixtures.filter(({ fixture }) => isFixtureStatusPending(fixture.statusCode));
    const inPlay = allFixtures.filter(({ fixture }) => isFixtureStatusInPlay(fixture.statusCode));
    const provisional = allFixtures.filter(({ fixture }) => isFixtureStatusProvisional(fixture.statusCode));
    const confirmed = allFixtures.filter(({ fixture }) => isFixtureStatusFinalConfirmed(fixture.statusCode));
    const resolved = allFixtures.filter(({ fixture }) => isFixtureStatusResolved(fixture.statusCode));
    const cupPending = [...pending, ...inPlay].filter(({ group }) => /cup/i.test(group.title)).length;
    const masterPending = [...pending, ...inPlay].filter(({ group }) => /master league/i.test(group.title)).length;
    const topMovement = movements[0] ?? null;

    if (pending.length > 0 || inPlay.length > 0 || resolved.length > 0 || confirmed.length > 0) {
      slides.push({
        id: `why-matters-fixtures-${currentGw}`,
        label: `Why It Matters • ${currentGw}`,
        durationMs: CARD_DURATION_MS,
        narration: `Why this matters. ${inPlay.length} fixtures are in play, ${provisional.length} are provisional, and ${confirmed.length} are confirmed. ${cupPending > 0 ? `${cupPending} cup ties remain open.` : 'Cup ties are stabilising.'} ${masterPending > 0 ? `${masterPending} master league fixtures can still shift momentum.` : 'Master league momentum is stabilising.'}`,
        tone: 'movement',
        content: (
          <div className="studio-movement-slide">
            <span className="studio-kicker">Why It Matters</span>
            <h3>What Can Still Swing Tonight</h3>
            <p>Use this board to focus the next key stories before full-time.</p>
            <div className="studio-rivalry-grid">
              <article className="studio-rivalry-card">
                <span>Live Board</span>
                <strong>{inPlay.length} in play</strong>
                <span>{pending.length} pending kickoff</span>
              </article>
              <article className="studio-rivalry-card">
                <span>Truth State</span>
                <strong>{provisional.length} provisional</strong>
                <span>{confirmed.length} confirmed</span>
              </article>
              <article className="studio-rivalry-card">
                <span>Cup Watch</span>
                <strong>{cupPending} pending</strong>
                <span>Knockout path still moving</span>
              </article>
              <article className="studio-rivalry-card">
                <span>Master League</span>
                <strong>{masterPending} pending</strong>
                <span>Overall table still exposed</span>
              </article>
              <article className="studio-rivalry-card">
                <span>Priority Story</span>
                <strong>{topMovement?.headline ?? 'Fixture momentum'}</strong>
                <span>{topMovement?.label ?? 'Watch the next two games closely'}</span>
              </article>
            </div>
          </div>
        ),
      });
    }

    const topDivisionLeaders = tableDivisions
      .map((division) => ({
        divisionTitle: division.title,
        leader: division.rows[0],
        challenger: division.rows[1],
      }))
      .filter((row) => !!row.leader)
      .slice(0, 4);

    if (topDivisionLeaders.length > 0) {
      slides.push({
        id: `why-matters-title-race-${currentGw}`,
        label: 'Why It Matters • Title Pressure',
        durationMs: CARD_DURATION_MS,
        narration: `Title pressure board. ${topDivisionLeaders.map((row) => `${row.divisionTitle} leader is ${row.leader?.teamName ?? 'unknown'}`).join('. ')}.`,
        tone: 'movement',
        content: (
          <div className="studio-movement-slide">
            <span className="studio-kicker">Why It Matters</span>
            <h3>Division Pressure Points</h3>
            <p>These leaders can extend control, but the chasing pack is still active.</p>
            <div className="studio-rivalry-grid">
              {topDivisionLeaders.map((row) => (
                <article key={`why-race-${row.divisionTitle}`} className="studio-rivalry-card">
                  <span>{row.divisionTitle}</span>
                  <strong>{row.leader?.teamName ?? '—'}</strong>
                  <span>Closest challenger: {row.challenger?.teamName ?? '—'}</span>
                </article>
              ))}
            </div>
          </div>
        ),
      });
    }

    return slides;
  }, [currentGw, fixtureGroups, movements, tableDivisions]);

  const fixtureStorySlides = useMemo<StudioSlide[]>(() => {
    const stories = fixtureGroups.flatMap((group) => (
      group.fixtures.map((fixture, index) => ({ group, fixture, index }))
    ));
    return stories.map(({ group, fixture, index }) => {
      const teamsInFixture = parseFixtureTeams(fixture.fixture);
      const homeSnapshot = teamsInFixture
        ? teamTableSnapshotByName.get(normalizeTeamKey(teamsInFixture.home))
        : null;
      const awaySnapshot = teamsInFixture
        ? teamTableSnapshotByName.get(normalizeTeamKey(teamsInFixture.away))
        : null;
      const winner = extractOutcomeWinner(fixture.outcome);
      const isResolved = isFixtureStatusResolved(fixture.statusCode);
      const isInPlay = isFixtureStatusInPlay(fixture.statusCode);
      const isProvisional = isFixtureStatusProvisional(fixture.statusCode);
      const isConfirmed = isFixtureStatusFinalConfirmed(fixture.statusCode);
      const isCup = /cup/i.test(group.title);
      const competitionTone = isCup ? 'cup' : 'league';
      const winnerContext = winner
        ? teamTableSnapshotByName.get(normalizeTeamKey(winner))
        : null;
      const scorePair = parseFixtureScorePair(fixture.score);
      const opponentScoreLine = (() => {
        if (!teamsInFixture || !scorePair) {
          return '';
        }
        if (winner && normalizeTeamKey(winner) === normalizeTeamKey(teamsInFixture.home)) {
          return `As it stands, ${teamsInFixture.away} has scored ${formatCommentaryPoints(scorePair.away)} points in their round.`;
        }
        if (winner && normalizeTeamKey(winner) === normalizeTeamKey(teamsInFixture.away)) {
          return `As it stands, ${teamsInFixture.home} has scored ${formatCommentaryPoints(scorePair.home)} points in their round.`;
        }
        return `As it stands, ${teamsInFixture.away} has scored ${formatCommentaryPoints(scorePair.away)} points in their round.`;
      })();
      const rankRaceLine = summarizeFixtureImplication(winner, winnerContext ?? null);
      const tableSplitLine = homeSnapshot && awaySnapshot
        ? `${homeSnapshot.teamName} and ${awaySnapshot.teamName} are both still in this race.`
        : 'Table race context updates as standings refresh.';
      const winnerCall = fixture.statusCode === 'pending'
        ? 'Kick-off shortly.'
        : fixture.statusCode === 'in_play'
          ? winner
            ? `As it stands, ${winner} lead.`
            : 'As it stands, this tie remains level and in play.'
          : fixture.statusCode === 'provisional'
            ? winner
              ? `As it stands, winner was ${winner}.`
              : /draw/i.test(fixture.outcome)
                ? `As it stands, ${fixture.fixture} is level.`
                : 'As it stands, a winner call is pending.'
            : winner
              ? `Confirmed winner was ${winner}.`
              : /draw/i.test(fixture.outcome)
                ? `${fixture.fixture} finished as a confirmed draw.`
                : 'Confirmed result update pending.';
      const introLine = fixture.statusCode === 'pending'
        ? `Coming up in ${group.title}. ${fixture.fixture}.`
        : fixture.statusCode === 'in_play'
          ? `Live now in ${group.title}. ${fixture.fixture}.`
          : `Result update from ${group.title}. ${fixture.fixture}.`;
      const fixtureNarration = `${introLine} ${winnerCall} ${rankRaceLine} ${tableSplitLine} ${opponentScoreLine} ${
        isConfirmed
          ? 'Result is confirmed.'
          : isProvisional
            ? 'Result remains provisional until lock and rollover.'
            : 'Still in play.'
      }`;

      return {
        id: `fixture-story-${group.id}-${fixture.id}`,
        label: `Fixture Story • ${group.title}`,
        durationMs: 9000,
        narration: fixtureNarration,
        tone: 'fixtures' as const,
        content: (
          <div className="studio-fixture-story-card">
            <div className="studio-fixture-story-head">
              <span className={`studio-fixture-story-status ${fixture.statusCode.replace('_', '-')}`}>
                {fixtureStatusLabel(fixture.statusCode)}
              </span>
              <span className={`studio-comp-badge ${competitionTone}`}>{group.title}</span>
            </div>
            <h3>{fixture.fixture}</h3>
            <p>{isResolved ? rankRaceLine : isInPlay ? 'Live story in focus. Calls remain provisional as entries land.' : 'Kick-off story in focus. Winner call follows as this tie develops.'}</p>
            <div className="studio-fixture-story-grid">
              <article className="studio-fixture-story-team">
                <span>{teamsInFixture?.home ?? 'Home'}</span>
                <strong>{homeSnapshot ? `${formatRank(homeSnapshot.rank)} • ${homeSnapshot.points} pts` : 'Standings pending'}</strong>
                <span>{homeSnapshot ? `${formatSigned(homeSnapshot.profit)} profit` : group.title}</span>
              </article>
              <article className="studio-fixture-story-team">
                <span>{teamsInFixture?.away ?? 'Away'}</span>
                <strong>{awaySnapshot ? `${formatRank(awaySnapshot.rank)} • ${awaySnapshot.points} pts` : 'Standings pending'}</strong>
                <span>{awaySnapshot ? `${formatSigned(awaySnapshot.profit)} profit` : fixture.score}</span>
              </article>
            </div>
            <div className="studio-fixture-story-foot">
              <span>{fixture.outcome}</span>
              {renderScoreParts(fixture.score)}
              {winner && <span className="studio-fixture-story-winner">{isConfirmed ? `Confirmed winner: ${winner}` : `As it stands: ${winner}`}</span>}
              {!winner && isConfirmed && <span className="studio-fixture-story-winner">Confirmed result</span>}
              {!winner && isProvisional && <span className="studio-fixture-story-winner">Provisional result</span>}
              {!isResolved && <span className="studio-fixture-story-winner">{isInPlay ? 'Still in play' : `Story ${index + 1} in queue`}</span>}
            </div>
          </div>
        ),
      };
    });
  }, [fixtureGroups, teamTableSnapshotByName]);

  const teamDivisionTitles = useMemo(() => new Set(teams.map((team) => team.league)), [teams]);
  const primaryDivisions = useMemo(
    () => tableDivisions.filter((division) => teamDivisionTitles.has(division.title)),
    [tableDivisions, teamDivisionTitles],
  );
  const ssnDivisionSlides = useMemo<StudioSlide[]>(() => {
    if (!skySportsNewsMode) {
      return [];
    }

    const gwNumber = parseGwNumber(currentGw);
    const effectiveJourneyGw = Math.min(7, Math.max(1, gwNumber));
    const gwNumbers = Array.from({ length: effectiveJourneyGw }, (_, index) => index + 1);
    const previousGwLabel = gwNumber > 1 ? `GW${Math.min(gwNumber - 1, 7)}` : null;
    const seasonNumber = seasonNumberFromLabel(currentSeason ?? '') ?? 0;
    const includeDivisionFour = seasonNumber >= 5
      || tableDivisions.some((division) => ssnDivisionBucket(division.title) === 'div4')
      || teams.some((team) => ssnDivisionBucket(team.league) === 'div4');
    const slides: StudioSlide[] = [];
    const divisionOrderSpec: Array<{ bucket: SsnDivisionBucket; fallbackTitle: string; fallbackId: string }> = [
      { bucket: 'champions', fallbackTitle: 'Champions', fallbackId: 'Champions Bookies' },
      { bucket: 'premier', fallbackTitle: 'Premier', fallbackId: 'Premier Bookies' },
      { bucket: 'div1', fallbackTitle: 'Division 1', fallbackId: 'Average Bookies' },
      { bucket: 'div2', fallbackTitle: 'Division 2', fallbackId: 'Struggling Bookies' },
      { bucket: 'div3', fallbackTitle: 'Division 3', fallbackId: 'Awful Bookies' },
    ];
    if (includeDivisionFour) {
      divisionOrderSpec.push({ bucket: 'div4', fallbackTitle: 'Division 4', fallbackId: 'Division 4 Bookies' });
    }
    const divisionByBucket = new Map<SsnDivisionBucket, SkyStudioTableDivision>();
    divisionOrderSpec.forEach((spec) => {
      const preferredDivision = pickPreferredDivisionForBucket(tableDivisions, spec.bucket);
      if (preferredDivision) {
        divisionByBucket.set(spec.bucket, preferredDivision);
      }
    });
    const orderedDivisions = divisionOrderSpec.map((spec, specIndex) => {
      const sourceDivision = divisionByBucket.get(spec.bucket);
      const teamFallbackRows = teams
        .filter((team) => ssnDivisionBucket(team.league) === spec.bucket)
        .sort((a, b) => {
          const equalStandingsMetrics = (
            a.points === b.points
            && a.seasonProfit === b.seasonProfit
            && a.spins === b.spins
            && a.wins === b.wins
          );
          if (equalStandingsMetrics) {
            return a.name.localeCompare(b.name);
          }
          const rankA = Number(a.rank ?? Number.MAX_SAFE_INTEGER);
          const rankB = Number(b.rank ?? Number.MAX_SAFE_INTEGER);
          if (Number.isFinite(rankA) && Number.isFinite(rankB)) {
            return rankA - rankB || b.points - a.points || a.name.localeCompare(b.name);
          }
          return b.points - a.points || a.name.localeCompare(b.name);
        })
        .map((team, index) => ({
          teamId: team.id,
          teamName: team.name,
          ballColor: team.ballColor ?? null,
          ringColor: team.ringColor ?? null,
          textColor: team.textColor ?? null,
          rank: Number.isFinite(Number(team.rank)) && Number(team.rank) > 0 ? Number(team.rank) : (index + 1),
          played: team.played,
          wins: team.wins,
          draws: team.draws,
          losses: team.losses,
          points: team.points,
          profit: team.seasonProfit,
          spins: team.spins,
          record: `${team.wins}-${team.draws}-${team.losses}`,
          form: team.leagueForm,
          trend: 'flat' as const,
        }));
      const fixtureFallbackRows = (() => {
        const divisionGroup = fixtureGroups.find((group) => group.id.startsWith('division-') && ssnDivisionBucket(group.id.replace(/^division-/, '')) === spec.bucket)
          ?? fixtureGroups.find((group) => /fixtures/i.test(group.title) && ssnDivisionBucket(group.title) === spec.bucket);
        if (!divisionGroup) {
          return [] as SkyStudioTableDivision['rows'];
        }
        const rowByTeamKey = new Map<string, SkyStudioTableDivision['rows'][number]>();
        const registerTeam = (teamName: string) => {
          const normalizedKey = normalizeTeamKey(teamName);
          if (!normalizedKey || rowByTeamKey.has(normalizedKey) || isPlaceholderOpponent(teamName)) {
            return;
          }
          const mappedTeamId = teamIdByTeamKey.get(normalizedKey);
          const mappedTeam = mappedTeamId ? teamById.get(mappedTeamId) : undefined;
          const rowId = mappedTeam?.id ?? -((specIndex + 1) * 10000 + rowByTeamKey.size + 1);
          rowByTeamKey.set(normalizedKey, {
            teamId: rowId,
            teamName,
            ballColor: mappedTeam?.ballColor ?? null,
            ringColor: mappedTeam?.ringColor ?? null,
            textColor: mappedTeam?.textColor ?? null,
            rank: 0,
            played: mappedTeam?.played ?? 0,
            wins: mappedTeam?.wins ?? 0,
            draws: mappedTeam?.draws ?? 0,
            losses: mappedTeam?.losses ?? 0,
            points: mappedTeam?.points ?? 0,
            profit: mappedTeam?.seasonProfit ?? 0,
            spins: mappedTeam?.spins ?? 0,
            record: mappedTeam ? `${mappedTeam.wins}-${mappedTeam.draws}-${mappedTeam.losses}` : '0-0-0',
            form: mappedTeam?.leagueForm ?? [],
            trend: 'flat',
          });
        };
        (divisionGroup.fixtures ?? []).forEach((fixture) => {
          const teamsInFixture = parseFixtureTeams(fixture.fixture);
          if (!teamsInFixture) {
            return;
          }
          registerTeam(teamsInFixture.home);
          registerTeam(teamsInFixture.away);
        });
        return Array.from(rowByTeamKey.values())
          .sort((a, b) => b.points - a.points || b.profit - a.profit || a.teamName.localeCompare(b.teamName))
          .map((row, index) => ({
            ...row,
            rank: index + 1,
          }));
      })();
      const sourceRows = (sourceDivision?.rows ?? []).slice();
      const rowsSeed = sourceRows.length > 0
        ? sourceRows
        : teamFallbackRows.length > 0
          ? teamFallbackRows
          : fixtureFallbackRows.length > 0
            ? fixtureFallbackRows
            : [];
      const rows = (() => {
        const normalizedRows = rowsSeed
          .map((row, index) => ({
            ...row,
            rank: Number.isFinite(Number(row.rank)) && Number(row.rank) > 0 ? Number(row.rank) : (index + 1),
          }))
          .sort(compareTableRowsByRank)
          .slice(0, 4);
        const targetCount = 4;
        if (normalizedRows.length >= targetCount) {
          return normalizedRows;
        }
        const filledRows = normalizedRows.slice();
        for (let index = normalizedRows.length; index < targetCount; index += 1) {
          filledRows.push({
            teamId: -((specIndex + 1) * 10000 + index + 1),
            teamName: `${spec.fallbackTitle} Team ${index + 1}`,
            ballColor: null,
            ringColor: null,
            textColor: null,
            rank: index + 1,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: Math.max(0, targetCount - index - 1),
            profit: 0,
            spins: 0,
            record: '0-0-0',
            form: [] as Array<'W' | 'D' | 'L'>,
            trend: 'flat' as const,
          });
        }
        return filledRows;
      })();
      return {
        id: sourceDivision?.id ?? spec.fallbackId,
        title: sourceDivision?.title ?? spec.fallbackTitle,
        bucket: spec.bucket,
        rows,
      };
    });
    const graphDurationMs = minimumGraphDurationForGw(currentGw);

    orderedDivisions.forEach((division, divisionIndex) => {
      const rowsForDivision = division.rows;
      const orderedRows = rowsForDivision
        .slice()
        .sort(compareTableRowsByRank);
      const leader = orderedRows[0];
      const challenger = orderedRows[1];
      const topName = leader?.teamName ?? 'No side';
      const topPoints = leader?.points ?? 0;
      const gap = leader && challenger ? leader.points - challenger.points : 0;
      const gapLine = !leader || !challenger
        ? 'Table is still settling.'
        : gap <= 0
          ? `${topName} are level at the top with ${challenger.teamName}.`
          : gap === 1
            ? `${topName} are one point clear of ${challenger.teamName}.`
            : `${topName} are ${gap} points clear of ${challenger.teamName}.`;

      const divisionGroup = fixtureGroups.find((group) => group.id === `division-${division.id}`)
        ?? fixtureGroups.find((group) => group.id.startsWith('division-') && ssnDivisionBucket(group.id.replace(/^division-/, '')) === division.bucket)
        ?? fixtureGroups.find((group) => /fixtures/i.test(group.title) && ssnDivisionBucket(group.title) === division.bucket);
      const todaysFixtureRows: SsnDivisionResultRow[] = (divisionGroup?.fixtures ?? [])
        .map((fixture) => ({
          id: fixture.id,
          fixture: fixture.fixture,
          score: fixture.score,
          status: fixtureStatusLabel(fixture.statusCode),
          detail: fixture.outcome,
          badge: currentGw,
        }));
      const seasonComplete = todaysFixtureRows.length === 0;

      const seenDivisionTeamIds = new Set<number>();
      const divisionTeams = orderedRows.flatMap((row) => {
        const rowTeamKey = normalizeTeamKey(row.teamName);
        const directTeam = teamById.get(row.teamId);
        const directNameMatches = Boolean(directTeam) && normalizeTeamKey(directTeam.name) === rowTeamKey;
        const fallbackTeamId = teamIdByTeamKey.get(rowTeamKey);
        const fallbackTeam = fallbackTeamId ? teamById.get(fallbackTeamId) : undefined;
        const resolvedTeam = directNameMatches ? directTeam : (fallbackTeam ?? directTeam);
        if (!resolvedTeam || seenDivisionTeamIds.has(resolvedTeam.id)) {
          return [];
        }
        seenDivisionTeamIds.add(resolvedTeam.id);
        return [resolvedTeam];
      });
      const pastRowsMap = new Map<string, {
        id: string;
        home: string;
        away: string;
        homeProfit: number | null;
        awayProfit: number | null;
      }>();
      if (previousGwLabel) {
        divisionTeams.forEach((team) => {
          const previousMatch = team.currentLeagueJourney?.find((journeyRow) => parseGwNumber(journeyRow.gw) === parseGwNumber(previousGwLabel));
          if (!previousMatch || isPlaceholderOpponent(previousMatch.opponent)) {
            return;
          }
          const home = previousMatch.venue === 'H' ? team.name : previousMatch.opponent;
          const away = previousMatch.venue === 'H' ? previousMatch.opponent : team.name;
          const key = [normalizeTeamKey(home), normalizeTeamKey(away)].sort().join('|');
          const existing = pastRowsMap.get(key) ?? {
            id: `${division.id}-${previousGwLabel}-${key}`,
            home,
            away,
            homeProfit: null,
            awayProfit: null,
          };
          if (previousMatch.venue === 'H') {
            existing.homeProfit = previousMatch.profit;
          } else {
            existing.awayProfit = previousMatch.profit;
          }
          pastRowsMap.set(key, existing);
        });
      }

      const pastRows: SsnDivisionResultRow[] = Array.from(pastRowsMap.values())
        .filter((row) => row.homeProfit !== null && row.awayProfit !== null)
        .map((row) => {
          const homeProfit = row.homeProfit ?? 0;
          const awayProfit = row.awayProfit ?? 0;
          const score = `${homeProfit.toFixed(2)} - ${awayProfit.toFixed(2)}`;
          const detail = homeProfit === awayProfit
            ? 'Draw'
            : homeProfit > awayProfit
              ? `${row.home} won`
              : `${row.away} won`;
          return {
            id: row.id,
            fixture: `${row.home} vs ${row.away}`,
            score,
            status: 'Final',
            detail,
            badge: previousGwLabel ?? 'Past',
          };
        })
        .sort((a, b) => a.fixture.localeCompare(b.fixture));

      const buildResultList = (rows: SsnDivisionResultRow[], emptyLine: string) => (
        rows.length === 0 ? (
          <div className="ssn-division-empty">{emptyLine}</div>
        ) : (
          <div className="ssn-division-result-list">
            {rows.map((row) => (
              <article key={row.id} className="ssn-division-result-row">
                <div className="ssn-division-result-main">
                  <strong>{row.fixture}</strong>
                  {row.badge && <span className="studio-comp-badge league">{row.badge}</span>}
                </div>
                <div className="ssn-division-result-meta">
                  {renderScoreParts(row.score)}
                  <span className="studio-inline-result pending">{row.status}</span>
                </div>
                <p>{row.detail}</p>
              </article>
            ))}
          </div>
        )
      );

      const tracker = divisionTeams.map((team) => ({
        teamId: team.id,
        teamKey: normalizeTeamKey(team.name),
        teamName: team.name,
        ballColor: team.ballColor,
        ringColor: team.ringColor,
        textColor: team.textColor,
        points: 0,
        profit: 0,
        spins: 0,
        wins: 0,
        journeyByGw: new Map((team.currentLeagueJourney ?? []).map((row) => [parseGwNumber(row.gw), row])),
      }));
      const rankHistoryByTeamId = new Map<number, number[]>();
      const rankHistoryByTeamKey = new Map<string, number[]>();
      tracker.forEach((entry) => {
        rankHistoryByTeamId.set(entry.teamId, []);
        rankHistoryByTeamKey.set(entry.teamKey, []);
      });

      gwNumbers.forEach((gw) => {
        const gwLabel = `GW${gw}`;
        tracker.forEach((entry) => {
          const journeyRow = entry.journeyByGw.get(gw);
          if (!journeyRow) {
            return;
          }
          entry.points += resultPoints(journeyRow.result);
          entry.profit += journeyRow.profit ?? 0;
          entry.spins += journeyRow.spins ?? 0;
          if (journeyRow.result === 'W') {
            entry.wins += 1;
          }
        });
        const standings = tracker
          .slice()
          .sort((a, b) => (
            b.points - a.points
            || b.profit - a.profit
            || b.spins - a.spins
            || b.wins - a.wins
            || a.teamName.localeCompare(b.teamName)
          ));
        standings.forEach((entry, index) => {
          const rank = index + 1;
          rankHistoryByTeamId.get(entry.teamId)?.push(rank);
          rankHistoryByTeamKey.get(entry.teamKey)?.push(rank);
        });
      });

      const usedJourneyTeamIds = new Set<number>();
      const journeyTeams: SsnDivisionJourneyTeam[] = orderedRows.map((row, rowIndex) => {
        const safeTableRank = rowIndex + 1;
        const rowTeamKey = normalizeTeamKey(row.teamName);
        const directTeam = teamById.get(row.teamId);
        const directNameMatches = Boolean(directTeam) && normalizeTeamKey(directTeam.name) === rowTeamKey;
        const fallbackTeamId = teamIdByTeamKey.get(rowTeamKey);
        const fallbackTeam = fallbackTeamId ? teamById.get(fallbackTeamId) : undefined;
        const team = directNameMatches ? directTeam : (fallbackTeam ?? directTeam);
        const baseFallbackId = row.teamId > 0 ? row.teamId : -((divisionIndex + 1) * 1000 + (rowIndex + 1));
        let rankKey = team?.id ?? baseFallbackId;
        if (usedJourneyTeamIds.has(rankKey)) {
          rankKey = -((divisionIndex + 1) * 10000 + (rowIndex + 1));
        }
        usedJourneyTeamIds.add(rankKey);
        const seededRanks = rankHistoryByTeamId.get(rankKey)
          ?? rankHistoryByTeamId.get(row.teamId)
          ?? rankHistoryByTeamKey.get(rowTeamKey)
          ?? [];
        const normalizedRanks: number[] = [];
        for (let index = 0; index < gwNumbers.length; index += 1) {
          const raw = seededRanks[index];
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            normalizedRanks.push(Math.max(1, Math.min(orderedRows.length, raw)));
            continue;
          }
          if (index === 0) {
            normalizedRanks.push(safeTableRank);
            continue;
          }
          normalizedRanks.push(normalizedRanks[index - 1] ?? safeTableRank);
        }
        if (normalizedRanks.length > 0) {
          // Lock the final animation frame to the official current table rank.
          normalizedRanks[normalizedRanks.length - 1] = safeTableRank;
        }
        return {
          teamId: rankKey,
          teamName: row.teamName,
          ballColor: team?.ballColor ?? row.ballColor ?? null,
          ringColor: team?.ringColor ?? row.ringColor ?? null,
          textColor: team?.textColor ?? row.textColor ?? null,
          ranks: normalizedRanks.length > 0 ? normalizedRanks : gwNumbers.map(() => safeTableRank),
        };
      });
      const journeyData: SsnDivisionJourney = {
        divisionId: division.id,
        divisionTitle: division.title,
        gwNumbers,
        teams: journeyTeams,
      };
      const journeyDurationMs = graphDurationMs;

      slides.push({
        id: `ssn-division-${divisionIndex}-journey-${currentGw}`,
        label: `DIVISIONS ROUND UP • ${division.title}`,
        durationMs: journeyDurationMs,
        narration: `Division roundup for ${division.title}. Position timeline from gameweek 1 to gameweek ${gwNumbers[gwNumbers.length - 1] ?? 1}.`,
        tone: 'movement',
        content: (
          <div className="studio-fixtures-slide ssn-journey-slide">
            <div className="studio-fixtures-head">
              <span className="studio-kicker ssn-division-roundup-kicker">DIVISIONS ROUND UP</span>
              <h3>{division.title}</h3>
              <p>GW1 to GW{gwNumbers[gwNumbers.length - 1] ?? 1} ranking animation with team bingo balls.</p>
            </div>
            <SsnDivisionJourneyChart teams={journeyData.teams} gwNumbers={journeyData.gwNumbers} divisionTitle={division.title} />
          </div>
        ),
      });

      slides.push({
        id: `ssn-division-${divisionIndex}-roundup-${currentGw}`,
        label: `DIVISIONS ROUND UP • ${division.title}`,
        durationMs: MIN_SLIDE_DURATION_MS,
        narration: `Division roundup for ${division.title}. ${gapLine} ${seasonComplete
          ? 'Season complete.'
          : `${previousGwLabel ? `${previousGwLabel} scores and today's fixtures are on screen.` : `Today's fixtures are on screen.`}`}`,
        tone: 'fixtures',
        content: (
          <div className="studio-fixtures-slide ssn-division-slide">
            <div className="studio-fixtures-head">
              <span className="studio-kicker ssn-division-roundup-kicker">DIVISIONS ROUND UP</span>
              <h3>{division.title}</h3>
              <p>{gapLine}</p>
            </div>
            <div className="ssn-division-columns">
              <section className="ssn-division-column">
                <h4>{previousGwLabel ? `${previousGwLabel} Scores` : 'Previous Scores'}</h4>
                {buildResultList(pastRows, previousGwLabel ? `No settled fixtures found for ${previousGwLabel}.` : 'No previous gameweek scores yet.')}
              </section>
              <section className="ssn-division-column">
                <h4>Today's Fixtures</h4>
                {seasonComplete ? (
                  <div className="ssn-division-empty">SEASON COMPLETE</div>
                ) : (
                  buildResultList(todaysFixtureRows, 'SEASON COMPLETE')
                )}
              </section>
            </div>
          </div>
        ),
      });
    });

    return slides;
  }, [currentGw, currentSeason, fixtureGroups, renderScoreParts, skySportsNewsMode, tableDivisions, teamById, teamIdByTeamKey, teams]);
  const ssnSpotlightBySlideId = useMemo(() => {
    const map = new Map<string, StingerState>();
    if (!skySportsNewsMode) {
      return map;
    }
    return map;
  }, [skySportsNewsMode]);

  const allTimeIntermissionSlide = useMemo(
    () => (allTimeIntermission ? buildAllTimeSegmentSlide(allTimeIntermission.mode, allTimeIntermission.sequence) : null),
    [allTimeIntermission, buildAllTimeSegmentSlide],
  );
  const ssnIsWeekOne = currentGw.trim().toUpperCase() === 'GW1';
  const ssnRoundupSubline = useMemo(() => {
    const seasonNumber = seasonNumberFromLabel(currentSeason ?? '') ?? 0;
    const hasDivisionFour = seasonNumber >= 5 || tableDivisions.some((division) => ssnDivisionBucket(division.title) === 'div4');
    return hasDivisionFour ? SSN_DIVISION_ROUNDUP_SUBLINE_WITH_DIV4 : SSN_DIVISION_ROUNDUP_SUBLINE_BASE;
  }, [currentSeason, tableDivisions]);
  const ssnWelcomeSlide = useMemo<StudioSlide>(() => ({
    id: `ssn-welcome-${currentGw}`,
    label: 'Bookieball Studio • DIVISIONS ROUND UP',
    durationMs: 16000,
    narration: readSsnScript('opening').join(' '),
    tone: 'system',
    content: (
      <div className="studio-movement-slide">
        <span className="studio-kicker">Bookieball Studio</span>
        <h3 className="ssn-division-roundup-title">DIVISIONS ROUND UP</h3>
        <p className="ssn-division-roundup-subline">{ssnRoundupSubline}</p>
      </div>
    ),
  }), [currentGw, ssnRoundupSubline]);
  const ssnCupPreviousWinnersSlide = useMemo<StudioSlide | null>(() => {
    if (!skySportsNewsMode) {
      return null;
    }
    const winnersBySeason = new Map<string, Set<string>>();
    teams.forEach((team) => {
      (team.previousCupRuns ?? []).forEach((run) => {
        if (!/winner|champion/i.test(run.cupFinish)) {
          return;
        }
        const seasonWinners = winnersBySeason.get(run.season) ?? new Set<string>();
        seasonWinners.add(team.name);
        winnersBySeason.set(run.season, seasonWinners);
      });
    });
    const rows = Array.from(winnersBySeason.entries())
      .map(([season, winners]) => ({
        season,
        winners: Array.from(winners.values()),
      }))
      .sort((a, b) => {
        const aNumber = seasonNumberFromLabel(a.season) ?? 0;
        const bNumber = seasonNumberFromLabel(b.season) ?? 0;
        return bNumber - aNumber || b.season.localeCompare(a.season);
      })
      .slice(0, 8);
    return {
      id: `ssn-cup-previous-winners-${currentGw}`,
      label: 'Cup Update • Previous Winners',
      durationMs: 18000,
      narration: rows.length > 0
        ? `Cup previous winners. ${rows.map((row) => `${row.season}: ${row.winners.join(', ')}`).join('. ')}.`
        : 'Cup previous winners archive is still building.',
      tone: 'competition',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Cup Update</span>
          <h3>Previous Cup Winners</h3>
          <p>Recent winners before this season&apos;s knockout story.</p>
          <div className="studio-rivalry-grid">
            {rows.length > 0 ? rows.map((row) => (
              <article key={`ssn-cup-winner-${row.season}`} className="studio-rivalry-card">
                <span>{row.season}</span>
                <strong>{row.winners.join(', ')}</strong>
              </article>
            )) : (
              <article className="studio-rivalry-card">
                <span>Archive</span>
                <strong>Pending</strong>
              </article>
            )}
          </div>
        </div>
      ),
    };
  }, [currentGw, skySportsNewsMode, teams]);
  const ssnCupRoundSlides = useMemo<StudioSlide[]>(() => {
    if (!skySportsNewsMode) {
      return [];
    }
    const roundGroups = groupCupFixturesByRound(cupFixtures);
    const roadRounds = roundGroups.filter((group) => group.key === 'r32' || group.key === 'r16' || group.key === 'qf');
    const semiRound = roundGroups.find((group) => group.key === 'sf');
    const finalRound = roundGroups.find((group) => group.key === 'f');
    if (semiRound || finalRound) {
      const slides: StudioSlide[] = [];
      if (roadRounds.length > 0) {
        slides.push({
          id: `ssn-cup-road-${currentGw}`,
          label: 'Cup Update • Road Summary',
          durationMs: 18000,
          narration: `Jess: The cup story from the early rounds now matters because the field is down to the final few. Sydney: ${roadRounds.map((round) => `${round.label}, ${round.fixtures.filter((fixture) => fixture.winnerTeam).length} resolved from ${round.fixtures.length}`).join('. ')}.`,
          tone: 'competition',
          content: (
            <div className="studio-movement-slide">
              <span className="studio-kicker">Cup Update</span>
              <h3>{finalRound ? 'Road to the Final' : 'Road to the Semifinals'}</h3>
              <p>Earlier knockout rounds summarized on one board.</p>
              <div className="studio-bracket-grid">
                {roadRounds.map((round) => {
                  const winners = round.fixtures.map((fixture) => fixture.winnerTeam).filter((value): value is string => Boolean(value));
                  return (
                    <div key={`ssn-cup-road-${round.key}`} className="studio-bracket-column">
                      <span className="studio-bracket-title">{round.label}</span>
                      <div className="studio-bracket-list">
                        <article className="studio-result-item">
                          <div className="studio-result-head">
                            <strong>{round.fixtures.filter((fixture) => fixture.winnerTeam).length}/{round.fixtures.length} resolved</strong>
                          </div>
                          <div className="studio-result-meta">
                            <span>{winners.length > 0 ? `Winners: ${winners.join(', ')}` : 'Winners pending'}</span>
                          </div>
                        </article>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        });
      }
      if (semiRound) {
        slides.push({
          id: `ssn-cup-semis-${currentGw}`,
          label: 'Cup Update • Semifinals',
          durationMs: 18000,
          narration: `Jess: Both semifinals are on one board. Sydney: ${semiRound.fixtures.map((fixture) => `${cupFixtureTeamsLabel(fixture)}. ${cupFixtureScoreLabel(fixture)}. ${cupFixtureDetailLabel(fixture)}`).join(' ')}`,
          tone: 'fixtures',
          content: (
            <div className="studio-fixtures-slide">
              <div className="studio-fixtures-head">
                <span className="studio-kicker">Cup Update</span>
                <h3>Semifinals</h3>
                <p>Both semifinal ties with scoreline and outcome detail.</p>
              </div>
              <div className="studio-fixtures-list studio-scroll-panel">
                {semiRound.fixtures.map((fixture) => (
                  <article key={`ssn-cup-semi-${fixture.id}`} className="studio-fixture-row">
                    <div className="studio-fixture-main">
                      <strong>{cupFixtureTeamsLabel(fixture)}</strong>
                    </div>
                    <div className="studio-fixture-meta">
                      <span>{cupFixtureScoreLabel(fixture)}</span>
                      <span>{cupFixtureDetailLabel(fixture)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ),
        });
      }
      if (finalRound) {
        slides.push({
          id: `ssn-cup-final-${currentGw}`,
          label: 'Cup Update • Final',
          durationMs: 18000,
          narration: `Jess: This is the cup final in full. Sydney: ${finalRound.fixtures.map((fixture) => `${cupFixtureTeamsLabel(fixture)}. ${cupFixtureScoreLabel(fixture)}. ${cupFixtureDetailLabel(fixture)}`).join(' ')}`,
          tone: 'fixtures',
          content: (
            <div className="studio-fixtures-slide">
              <div className="studio-fixtures-head">
                <span className="studio-kicker">Cup Final</span>
                <h3>{finalRound.fixtures[0] ? cupFixtureTeamsLabel(finalRound.fixtures[0]) : 'Final pending'}</h3>
                <p>The finalists, the scoreline, and how the tie was decided.</p>
              </div>
              <div className="studio-fixtures-list">
                {finalRound.fixtures.map((fixture) => (
                  <article key={`ssn-cup-final-${fixture.id}`} className="studio-fixture-row rivalry">
                    <div className="studio-fixture-main">
                      <strong>{cupFixtureTeamsLabel(fixture)}</strong>
                    </div>
                    <div className="studio-fixture-meta">
                      <span>{cupFixtureScoreLabel(fixture)}</span>
                      <span>{cupFixtureDetailLabel(fixture)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ),
        });
      }
      return slides;
    }

    return roundGroups.map((round, index) => {
      const playedCount = round.fixtures.filter((fixture) => fixture.winnerTeam).length;
      const heading = playedCount === round.fixtures.length ? `${round.label} Results` : `${round.label} Fixtures`;
      const cupBeats = readSsnScriptBeats('current_cup_round');
      const jessBeat = stripSpeakerPrefix(cupBeats[0] ?? 'The cup is where logic gets tested.');
      const sydneyBeat = stripSpeakerPrefix(cupBeats[1] ?? 'Tonight it is asking serious questions.');
      const jessVar = stripSpeakerPrefix(
        pickSeedLine(
          readSsnCommentaryVariation('current_cup_round', 'Jess'),
          `${currentSeason ?? 'S'}-${currentGw}-${round.key}-cup-jess`,
        ),
      );
      const sydneyVar = stripSpeakerPrefix(
        pickSeedLine(
          readSsnCommentaryVariation('current_cup_round', 'Sydney'),
          `${currentSeason ?? 'S'}-${currentGw}-${round.key}-cup-syd`,
        ),
      );
      return {
        id: `ssn-cup-${currentGw}-${round.key}-${index}`,
        label: `Cup Update • ${heading}`,
        durationMs: 18000,
        narration: `Jess: ${jessBeat}${jessVar ? ` ${jessVar}` : ''} Sydney: ${sydneyBeat} ${heading} on screen now.${sydneyVar ? ` ${sydneyVar}` : ''}`,
        tone: 'fixtures' as const,
        content: (
          <div className="studio-fixtures-slide">
            <div className="studio-fixtures-head">
              <span className="studio-kicker">Cup Update</span>
              <h3>{heading}</h3>
              <p>{playedCount === round.fixtures.length ? 'Played ties and winners kept on screen.' : 'Next playable round fixtures highlighted.'}</p>
            </div>
            <div className={`studio-fixtures-list studio-scroll-panel${round.key === 'r32' ? ' ssn-cup-round-grid' : ''}`}>
              {round.fixtures.map((fixture) => (
                <article key={`ssn-cup-${fixture.id}`} className="studio-fixture-row">
                  <div className="studio-fixture-main">
                    <strong>{cupFixtureTeamsLabel(fixture)}</strong>
                    {fixture.decidedBy === 'bye' && <span className="studio-pill-rivalry">BYE</span>}
                  </div>
                  <div className="studio-fixture-meta">
                    <span>{cupFixtureScoreLabel(fixture)}</span>
                    <span>{cupFixtureDetailLabel(fixture)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ),
      };
    });
  }, [currentGw, currentSeason, cupFixtures, skySportsNewsMode]);
  const ssnChampionsSpotlightSlide = useMemo<StudioSlide | null>(() => {
    if (!skySportsNewsMode) {
      return null;
    }
    const championsDivision = tableDivisions.find((division) => /champion/i.test(division.title)) ?? null;
    if (!championsDivision) {
      return null;
    }
    const ordered = championsDivision.rows.slice().sort((a, b) => a.rank - b.rank);
    const leader = ordered[0];
    const second = ordered[1];
    const leaderName = leader?.teamName ?? 'No side';
    const leaderPoints = leader?.points ?? 0;
    const secondName = second?.teamName ?? 'the nearest side';
    const gap = leader && second ? leader.points - second.points : 0;
    const gapLine = officialDivisionSeasonComplete
      ? gap <= 0
        ? `${leaderName} finished level on points with ${secondName}, ahead on the tiebreaks.`
        : gap === 1
          ? `${leaderName} finished one point clear of ${secondName}.`
          : `${leaderName} finished ${gap} points clear of ${secondName}.`
      : gap <= 0
        ? `${leaderName} are level with ${secondName}.`
        : gap === 1
          ? `${leaderName} are one point clear of ${secondName}.`
          : `${leaderName} are ${gap} points clear of ${secondName}.`;
    const championsBeats = readSsnScriptBeats('champions_spotlight');
    const championsSydneyBeat = stripSpeakerPrefix(championsBeats[0] ?? 'Champions Division now.');
    const championsJessBeat = stripSpeakerPrefix(championsBeats[1] ?? 'Someone is setting standards.');
    const championsSydneyVar = stripSpeakerPrefix(
      pickSeedLine(
        readSsnCommentaryVariation('champions_spotlight', 'Sydney'),
        `${currentSeason ?? 'S'}-${currentGw}-champions-syd`,
      ),
    );
    const championsJessVar = stripSpeakerPrefix(
      pickSeedLine(
        readSsnCommentaryVariation('champions_spotlight', 'Jess'),
        `${currentSeason ?? 'S'}-${currentGw}-champions-jess`,
      ),
    );
    return {
      id: `ssn-champions-spotlight-${currentGw}`,
      label: 'Champions Division Spotlight',
      durationMs: 18000,
      narration: officialDivisionSeasonComplete
        ? `Sydney: ${championsSydneyBeat} ${leaderName} won the division on ${leaderPoints} points.${championsSydneyVar ? ` ${championsSydneyVar}` : ''} Jess: ${championsJessBeat} ${gapLine}${championsJessVar ? ` ${championsJessVar}` : ''}`
        : `Sydney: ${championsSydneyBeat} At the top, ${leaderName} have ${leaderPoints} points.${championsSydneyVar ? ` ${championsSydneyVar}` : ''} Jess: ${championsJessBeat} ${gapLine}${championsJessVar ? ` ${championsJessVar}` : ''}`,
      tone: 'team',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Champions Spotlight</span>
          <h3>Champions Division</h3>
          <p>{officialDivisionSeasonComplete ? `${leaderName} won the division on ${leaderPoints} points.` : `${leaderName} lead on ${leaderPoints} points.`}</p>
          <div className="studio-rivalry-grid">
            <article className="studio-rivalry-card">
              <strong>Leader</strong>
              <span>{leaderName} • {leaderPoints} pts</span>
            </article>
            <article className="studio-rivalry-card">
              <strong>Gap</strong>
              <span>{gapLine}</span>
            </article>
          </div>
        </div>
      ),
    };
  }, [currentGw, currentSeason, skySportsNewsMode, tableDivisions, officialDivisionSeasonComplete]);
  const ssnPremierUpdateSlide = useMemo<StudioSlide | null>(() => {
    if (!skySportsNewsMode) {
      return null;
    }
    const premierDivision = tableDivisions.find((division) => /premier/i.test(division.title)) ?? null;
    if (!premierDivision) {
      return null;
    }
    const ordered = premierDivision.rows.slice().sort((a, b) => a.rank - b.rank);
    const leader = ordered[0];
    const second = ordered[1];
    const bottom = ordered[ordered.length - 1];
    const leaderName = leader?.teamName ?? 'No side';
    const leaderPoints = leader?.points ?? 0;
    const secondName = second?.teamName ?? 'nearest challenger';
    const gap = leader && second ? leader.points - second.points : 0;
    const bottomName = bottom?.teamName ?? 'No side';
    const premierBeats = readSsnScriptBeats('premier_update');
    const premierJessBeat = stripSpeakerPrefix(premierBeats[0] ?? 'Premier Division update.');
    const premierSydneyBeat = stripSpeakerPrefix(premierBeats[1] ?? 'Promotion dreams are alive.');
    const premierSydneyVar = stripSpeakerPrefix(
      pickSeedLine(
        readSsnCommentaryVariation('premier_update', 'Sydney'),
        `${currentSeason ?? 'S'}-${currentGw}-premier-syd`,
      ),
    );
    const premierJessVar = stripSpeakerPrefix(
      pickSeedLine(
        readSsnCommentaryVariation('premier_update', 'Jess'),
        `${currentSeason ?? 'S'}-${currentGw}-premier-jess`,
      ),
    );
    return {
      id: `ssn-premier-update-${currentGw}`,
      label: 'Premier Division Update',
      durationMs: 18000,
      narration: officialDivisionSeasonComplete
        ? `Jess: ${premierJessBeat} ${leaderName} won the division on ${leaderPoints} points with ${gap <= 0 ? `level points with ${secondName} and the tiebreak edge` : gap === 1 ? `a one point margin over ${secondName}` : `${gap} points over ${secondName}`}.${premierJessVar ? ` ${premierJessVar}` : ''} Sydney: ${premierSydneyBeat} ${bottomName} finished bottom in the final table.${premierSydneyVar ? ` ${premierSydneyVar}` : ''}`
        : `Jess: ${premierJessBeat} ${leaderName} lead on ${leaderPoints} points with ${gap <= 0 ? `no gap over ${secondName}` : gap === 1 ? `a one point gap over ${secondName}` : `${gap} points over ${secondName}`}.${premierJessVar ? ` ${premierJessVar}` : ''} Sydney: ${premierSydneyBeat} At the foot of the table, ${bottomName} remain in danger.${premierSydneyVar ? ` ${premierSydneyVar}` : ''}`,
      tone: 'movement',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Premier Update</span>
          <h3>Premier Division</h3>
          <p>{officialDivisionSeasonComplete ? `${leaderName} won the division on ${leaderPoints} points.` : `${leaderName} lead on ${leaderPoints} points.`}</p>
          <div className="studio-rivalry-grid">
            <article className="studio-rivalry-card">
              <strong>{officialDivisionSeasonComplete ? 'Winning Margin' : 'Title Race'}</strong>
              <span>{gap <= 0 ? `Level with ${secondName}` : gap === 1 ? `+1 vs ${secondName}` : `+${gap} vs ${secondName}`}</span>
            </article>
            <article className="studio-rivalry-card">
              <strong>{officialDivisionSeasonComplete ? 'Bottom Place' : 'Drop Zone'}</strong>
              <span>{bottomName}</span>
            </article>
          </div>
        </div>
      ),
    };
  }, [currentGw, currentSeason, skySportsNewsMode, tableDivisions, officialDivisionSeasonComplete]);
  const ssnMasterGroup = useMemo(
    () => fixtureGroups.find((group) => group.id.startsWith('master-'))
      ?? fixtureGroups.find((group) => /master league/i.test(group.title)),
    [fixtureGroups],
  );
  const ssnMasterSlide = useMemo<StudioSlide | null>(() => {
    if (!skySportsNewsMode) {
      return null;
    }
    if (!ssnMasterGroup && masterLeagueRows.length === 0) {
      return null;
    }
    const masterFixtures = ssnMasterGroup?.fixtures ?? [];
    const orderedRows = masterLeagueRows.slice().sort((a, b) => a.rank - b.rank);
    const leader = orderedRows[0];
    const bottom = orderedRows[orderedRows.length - 1];
    const headline = orderedRows.length > 0
      ? `Master League table check. ${leader?.teamName ?? 'Leader'} on top, ${bottom?.teamName ?? 'bottom side'} under pressure.`
      : 'Master League snapshot.';
    const masterBeats = readSsnScriptBeats('master_league_update');
    const masterSydneyBeat = stripSpeakerPrefix(masterBeats[0] ?? 'Master League update.');
    const masterJessBeat = stripSpeakerPrefix(masterBeats[1] ?? 'There are sides accelerating fast.');
    const masterSydneyVar = stripSpeakerPrefix(
      pickSeedLine(
        readSsnCommentaryVariation('master_league_update', 'Sydney'),
        `${currentSeason ?? 'S'}-${currentGw}-master-syd`,
      ),
    );
    const masterJessVar = stripSpeakerPrefix(
      pickSeedLine(
        readSsnCommentaryVariation('master_league_update', 'Jess'),
        `${currentSeason ?? 'S'}-${currentGw}-master-jess`,
      ),
    );
    return {
      id: `ssn-master-${currentGw}`,
      label: `Master League • ${currentGw}`,
      durationMs: 20000,
      narration: `Sydney: ${masterSydneyBeat} ${headline}${masterSydneyVar ? ` ${masterSydneyVar}` : ''} Jess: ${masterJessBeat}${masterJessVar ? ` ${masterJessVar}` : ''}`,
      tone: 'fixtures',
      content: (
        <div className="studio-fixtures-slide">
          <div className="studio-fixtures-head">
            <span className="studio-kicker">Master League</span>
            <h3>{currentGw} • Master League</h3>
            <p>Table snapshot on the left, fixtures on the right.</p>
          </div>
          <div className="studio-fixtures-columns studio-scroll-panel">
            <div className="studio-fixtures-list studio-scroll-panel" ref={ssnMasterTableRef}>
              {orderedRows.length === 0 ? (
                <p className="studio-muted">No master league table loaded.</p>
              ) : (
                orderedRows.map((row) => (
                  <article key={`ssn-master-row-${row.teamId}`} className="studio-fixture-row">
                    <div className="studio-fixture-main">
                      <strong>{formatRank(row.rank)} {row.teamName}</strong>
                      <span className="studio-comp-badge master">Master</span>
                    </div>
                    <div className="studio-fixture-meta">
                      <span>{row.points} pts</span>
                      <span>{formatSigned(row.profit)} profit</span>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="studio-fixtures-list">
              {masterFixtures.length > 0 ? (
                masterFixtures.map((fixture) => (
                  <article key={`ssn-master-${fixture.id}`} className="studio-fixture-row">
                    <div className="studio-fixture-main">
                      <strong>{fixture.fixture}</strong>
                      <span className="studio-comp-badge master">Master</span>
                    </div>
                    <div className="studio-fixture-meta">
                      {renderScoreParts(fixture.score)}
                      <span className="studio-inline-result pending">{fixtureStatusLabel(fixture.statusCode)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="studio-muted">No master fixtures loaded.</p>
              )}
            </div>
          </div>
        </div>
      ),
    };
  }, [currentGw, currentSeason, masterLeagueRows, renderScoreParts, skySportsNewsMode, ssnMasterGroup]);
  const ssnAllTimeSlides = useMemo<StudioSlide[]>(() => {
    if (!skySportsNewsMode || allTimeSegmentModes.length === 0) {
      return [];
    }
    const allTimeBeats = readSsnScriptBeats('all_time_leagues');
    const allTimeSydneyBeat = stripSpeakerPrefix(allTimeBeats[0] ?? 'Now to the all-time leagues.');
    const allTimeJessBeat = stripSpeakerPrefix(allTimeBeats[1] ?? 'Tonight the list could change.');
    return allTimeSegmentModes
      .map((mode, index) => {
        const slide = buildAllTimeSegmentSlide(mode, index + 1);
        if (!slide) {
          return null;
        }
          const sydneyVar = stripSpeakerPrefix(
            pickSeedLine(
              readSsnCommentaryVariation('all_time_leagues', 'Sydney'),
              `${currentSeason ?? 'S'}-${currentGw}-${mode}-alltime-syd`,
            ),
          );
          const jessVar = stripSpeakerPrefix(
            pickSeedLine(
              readSsnCommentaryVariation('all_time_leagues', 'Jess'),
              `${currentSeason ?? 'S'}-${currentGw}-${mode}-alltime-jess`,
            ),
          );
        const baseNarration = stripSpeakerPrefix(slide.narration ?? slide.label ?? '');
        return {
          ...slide,
          id: `ssn-${slide.id}`,
          narration: `Sydney: ${allTimeSydneyBeat}${sydneyVar ? ` ${sydneyVar}` : ''} Jess: ${allTimeJessBeat}${jessVar ? ` ${jessVar}` : ''} ${baseNarration}`,
        };
      })
      .filter((slide): slide is StudioSlide => slide !== null);
  }, [allTimeSegmentModes, buildAllTimeSegmentSlide, currentGw, currentSeason, skySportsNewsMode]);
  const ssnTeamSlidesByTeamId = useMemo(() => {
    const map = new Map<number, StudioSlide[]>();
    teamSlides.forEach((slide) => {
      const match = /^team-(\d+)-/.exec(slide.id);
      if (!match?.[1]) {
        return;
      }
      const teamId = Number(match[1]);
      if (!Number.isFinite(teamId)) {
        return;
      }
      const rows = map.get(teamId) ?? [];
      rows.push(slide);
      map.set(teamId, rows);
    });
    return map;
  }, [teamSlides]);
  const ssnDivisionRowsByBucket = useMemo(() => {
    const buckets: Record<SsnDivisionBucket, Array<{ division: StudioTableDivision; row: StudioTableDivision['rows'][number] }>> = {
      champions: [],
      premier: [],
      div1: [],
      div2: [],
      div3: [],
      div4: [],
    };
    primaryDivisions.forEach((division) => {
      const bucket = ssnDivisionBucket(division.title);
      if (!bucket) {
        return;
      }
      division.rows
        .slice()
        .sort(compareTableRowsByRank)
        .forEach((row) => {
          if (row.teamId <= 0) {
            return;
          }
          buckets[bucket].push({ division, row });
        });
    });
    return buckets;
  }, [primaryDivisions]);
  const buildSsnEnhancedSpotlightBlock = useCallback((
    bucket: SsnDivisionBucket,
    blockId: string,
    blockLabel: string,
    passKey: string,
  ): StudioSlide[] => {
    const entries = ssnDivisionRowsByBucket[bucket];
    if (!entries || entries.length === 0) {
      return [];
    }
    return entries.flatMap(({ division, row }, teamIndex) => {
      const team = teamById.get(row.teamId);
      if (!team) {
        return [];
      }
      const sourceSlides = ssnTeamSlidesByTeamId.get(team.id) ?? [];
      const selected: StudioSlide[] = [];
      const usedIds = new Set<string>();
      SSN_ENHANCED_SPOTLIGHT_SPECS.forEach((spec) => {
        const match = sourceSlides.find((slide) => slide.id.includes(spec.suffix));
        if (!match || usedIds.has(match.id)) {
          return;
        }
        selected.push(match);
        usedIds.add(match.id);
      });
      const fallbackSlides = selectTeamSpotlightSlides(sourceSlides, {
        limit: SSN_TEAM_SPOTLIGHT_TARGET_SLIDES,
        priorityNeedles: SSN_SPOTLIGHT_PRIORITY,
      });
      fallbackSlides.forEach((slide) => {
        if (selected.length >= SSN_TEAM_SPOTLIGHT_TARGET_SLIDES || usedIds.has(slide.id)) {
          return;
        }
        selected.push(slide);
        usedIds.add(slide.id);
      });
      if (selected.length === 0) {
        return [{
          id: `ssn-${blockId}-${passKey}-${team.id}-${currentGw}-fallback`,
          label: `${blockLabel} • ${team.name}`,
          durationMs: SSN_TEAM_SPOTLIGHT_PER_SLIDE_CAP_MS,
          narration: `${team.name} spotlight. Team spotlight data is still loading.`,
          tone: 'team',
          content: (
            <div className="studio-movement-slide">
              <span className="studio-kicker">{blockLabel}</span>
              <h3>{team.name}</h3>
              <p>Spotlight package will populate when team cards are available.</p>
            </div>
          ),
        }];
      }
      const spotlightSlides = selected.slice(0, SSN_TEAM_SPOTLIGHT_TARGET_SLIDES);
      const durationMs = Math.max(
        SSN_TEAM_SPOTLIGHT_MIN_DURATION_MS,
        Math.min(
          SSN_TEAM_SPOTLIGHT_PER_SLIDE_CAP_MS,
          Math.floor(SSN_TEAM_SPOTLIGHT_MAX_DURATION_MS / Math.max(1, spotlightSlides.length)),
        ),
      );
      return spotlightSlides.map((slide, index) => {
        const mapped = SSN_ENHANCED_SPOTLIGHT_SPECS.find((spec) => slide.id.includes(spec.suffix));
        const fallbackLabel = slide.label.includes('•')
          ? (slide.label.split('•')[1]?.trim() ?? slide.label)
          : slide.label;
        const cardLabel = mapped?.label ?? fallbackLabel;
        return {
          ...slide,
          id: `ssn-${blockId}-${passKey}-${team.id}-${teamIndex}-${index}-${currentGw}`,
          label: `${blockLabel} • ${team.name} • ${cardLabel}`,
          durationMs,
          narration: `${blockLabel}. ${team.name}. ${cardLabel}. ${slide.narration ?? ''}`.trim(),
          tone: slide.tone ?? 'team',
          content: (
            <div className="studio-team-slide">
              <div className="studio-team-head">
                <span className="studio-kicker">{blockLabel}</span>
                <h3>{team.name}</h3>
                <p>{division.title} • {cardLabel}</p>
              </div>
              {slide.content}
            </div>
          ),
        };
      });
    });
  }, [currentGw, ssnDivisionRowsByBucket, ssnTeamSlidesByTeamId, teamById]);
  const ssnChampionsSpotlightSlides = useMemo(
    () => (skySportsNewsMode ? buildSsnEnhancedSpotlightBlock('champions', 'champions-spotlight', 'Champions Spotlight', 'pass-1') : []),
    [buildSsnEnhancedSpotlightBlock, skySportsNewsMode],
  );
  const ssnPremierSpotlightSlides = useMemo(
    () => (skySportsNewsMode ? buildSsnEnhancedSpotlightBlock('premier', 'premier-spotlight', 'Premier Spotlight', 'pass-1') : []),
    [buildSsnEnhancedSpotlightBlock, skySportsNewsMode],
  );
  const ssnDiv1SpotlightSlides = useMemo(
    () => (skySportsNewsMode ? buildSsnEnhancedSpotlightBlock('div1', 'div1-spotlight', 'Division 1 Spotlight', 'pass-1') : []),
    [buildSsnEnhancedSpotlightBlock, skySportsNewsMode],
  );
  const ssnDiv2SpotlightSlidesPass1 = useMemo(
    () => (skySportsNewsMode ? buildSsnEnhancedSpotlightBlock('div2', 'div2-spotlight', 'Division 2 Spotlight', 'pass-1') : []),
    [buildSsnEnhancedSpotlightBlock, skySportsNewsMode],
  );
  const ssnDiv2SpotlightSlidesPass2 = useMemo(
    () => (skySportsNewsMode ? buildSsnEnhancedSpotlightBlock('div2', 'div2-spotlight', 'Division 2 Spotlight', 'pass-2') : []),
    [buildSsnEnhancedSpotlightBlock, skySportsNewsMode],
  );
  const ssnDiv3SpotlightSlides = useMemo(
    () => (skySportsNewsMode ? buildSsnEnhancedSpotlightBlock('div3', 'div3-spotlight', 'Division 3 Spotlight', 'pass-1') : []),
    [buildSsnEnhancedSpotlightBlock, skySportsNewsMode],
  );
  const ssnDiv4SpotlightSlides = useMemo(
    () => (skySportsNewsMode ? buildSsnEnhancedSpotlightBlock('div4', 'div4-spotlight', 'Division 4 Spotlight', 'pass-1') : []),
    [buildSsnEnhancedSpotlightBlock, skySportsNewsMode],
  );
  const ssnMasterLeagueSlides = useMemo<StudioSlide[]>(() => {
    if (!skySportsNewsMode) {
      return [];
    }
    const masterRows = masterLeagueRows.slice().sort((a, b) => a.rank - b.rank);
    const winnerArchiveRows = teams
      .flatMap((team) => (team.previousSeasons ?? [])
        .filter((season) => season.rank === 1 && /master/i.test(season.division))
        .map((season) => ({
          season: season.season,
          teamName: team.name,
        })))
      .sort((a, b) => {
        const aNumber = seasonNumberFromLabel(a.season) ?? 0;
        const bNumber = seasonNumberFromLabel(b.season) ?? 0;
        return bNumber - aNumber || b.season.localeCompare(a.season);
      })
      .slice(0, 8);
    const winnersSlide: StudioSlide = {
      id: `ssn-master-block-winners-${currentGw}`,
      label: 'Master League • Previous Winners',
      durationMs: 18000,
      narration: winnerArchiveRows.length > 0
        ? `Master League previous winners. ${winnerArchiveRows.map((entry) => `${entry.season}: ${entry.teamName}`).join('. ')}.`
        : 'Master League winners archive is still building.',
      tone: 'competition',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Master League</span>
          <h3>Previous Winners</h3>
          <p>Historic winners before the current master league push.</p>
          <div className="studio-rivalry-grid">
            {winnerArchiveRows.length > 0 ? winnerArchiveRows.map((entry) => (
              <article key={`ssn-master-winner-${entry.season}-${entry.teamName}`} className="studio-rivalry-card">
                <span>{entry.season}</span>
                <strong>{entry.teamName}</strong>
              </article>
            )) : (
              <article className="studio-rivalry-card">
                <span>Archive</span>
                <strong>Pending</strong>
              </article>
            )}
          </div>
        </div>
      ),
    };

    const masterFixtures = (ssnMasterGroup?.fixtures ?? []).slice();
    const resolvedMasterFixtures = masterFixtures.filter((fixture) => isFixtureStatusResolved(fixture.statusCode));
    const upcomingMasterFixtures = masterFixtures.filter((fixture) => !isFixtureStatusResolved(fixture.statusCode));
    const fixtureBoardSlide: StudioSlide = {
      id: `ssn-master-block-fixtures-${currentGw}`,
      label: `Master League • Fixtures & Results`,
      durationMs: 20000,
      narration: `Master League fixtures and results. ${resolvedMasterFixtures.length} resolved and ${upcomingMasterFixtures.length} still to play.`,
      tone: 'fixtures',
      content: (
        <div className="studio-fixtures-slide">
          <div className="studio-fixtures-head">
            <span className="studio-kicker">Master League</span>
            <h3>{currentGw} Fixtures &amp; Results</h3>
            <p>Results already played plus next fixtures still open.</p>
          </div>
          <div className="studio-fixtures-columns studio-scroll-panel">
            <div className="studio-fixtures-list studio-scroll-panel">
              <h4>Results</h4>
              {resolvedMasterFixtures.length > 0 ? resolvedMasterFixtures.map((fixture) => (
                <article key={`ssn-master-result-${fixture.id}`} className="studio-fixture-row">
                  <div className="studio-fixture-main">
                    <strong>{fixture.fixture}</strong>
                    <span className="studio-comp-badge master">Master</span>
                  </div>
                  <div className="studio-fixture-meta">
                    {renderScoreParts(fixture.score)}
                    <span className="studio-inline-result confirmed">{fixtureStatusLabel(fixture.statusCode)}</span>
                  </div>
                </article>
              )) : <p className="studio-muted">No resolved master fixtures yet.</p>}
            </div>
            <div className="studio-fixtures-list studio-scroll-panel">
              <h4>Fixtures</h4>
              {upcomingMasterFixtures.length > 0 ? upcomingMasterFixtures.map((fixture) => (
                <article key={`ssn-master-upcoming-${fixture.id}`} className="studio-fixture-row">
                  <div className="studio-fixture-main">
                    <strong>{fixture.fixture}</strong>
                    <span className="studio-comp-badge master">Master</span>
                  </div>
                  <div className="studio-fixture-meta">
                    {renderScoreParts(fixture.score)}
                    <span className="studio-inline-result pending">{fixtureStatusLabel(fixture.statusCode)}</span>
                  </div>
                </article>
              )) : <p className="studio-muted">No upcoming master fixtures.</p>}
            </div>
          </div>
        </div>
      ),
    };

    const teamByName = new Map<string, SkyStudioTeam>();
    teams.forEach((team) => {
      teamByName.set(normalizeTeamKey(team.name), team);
    });
    const watchList = masterRows
      .map((row) => {
        const team = teamById.get(row.teamId) ?? teamByName.get(normalizeTeamKey(row.teamName)) ?? null;
        const recentFormScore = team ? formPoints(team.leagueForm) : 0;
        const score = row.points * 3 + row.profit + recentFormScore;
        return {
          teamName: row.teamName,
          score,
          formScore: recentFormScore,
          points: row.points,
          profit: row.profit,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const watchListSlide: StudioSlide = {
      id: `ssn-master-block-watch-${currentGw}`,
      label: 'Master League • Watch List',
      durationMs: 18000,
      narration: watchList.length > 0
        ? `Teams to watch in Master League. ${watchList.map((row) => `${row.teamName} on ${row.points} points with ${formatSigned(row.profit)} profit`).join('. ')}.`
        : 'Master League watch list is pending table data.',
      tone: 'movement',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Master League</span>
          <h3>Who To Look Out For</h3>
          <p>Weighted by table points, profit trend, and recent form points.</p>
          <div className="studio-rivalry-grid">
            {watchList.length > 0 ? watchList.map((row) => (
              <article key={`ssn-master-watch-${row.teamName}`} className="studio-rivalry-card">
                <span>{row.teamName}</span>
                <strong>{row.points} pts • {formatSigned(row.profit)}</strong>
                <span>Form score {row.formScore}</span>
              </article>
            )) : (
              <article className="studio-rivalry-card">
                <span>Watch List</span>
                <strong>Pending</strong>
              </article>
            )}
          </div>
        </div>
      ),
    };

    const divisionTierWeight = (divisionTitle: string): number => {
      const bucket = ssnDivisionBucket(divisionTitle);
      if (bucket === 'champions') return 6;
      if (bucket === 'premier') return 5;
      if (bucket === 'div1') return 4;
      if (bucket === 'div2') return 3;
      if (bucket === 'div3') return 2;
      if (bucket === 'div4') return 1;
      return 1;
    };
    const difficultyByTeam = new Map<string, { total: number; count: number }>();
    const fixturesForDifficulty = upcomingMasterFixtures.length > 0 ? upcomingMasterFixtures : masterFixtures;
    fixturesForDifficulty.forEach((fixture) => {
      const matchup = parseFixtureTeams(fixture.fixture);
      if (!matchup) {
        return;
      }
      const homeName = matchup.home;
      const awayName = matchup.away;
      const homeSnapshot = teamTableSnapshotByName.get(normalizeTeamKey(homeName));
      const awaySnapshot = teamTableSnapshotByName.get(normalizeTeamKey(awayName));
      const homeStrength = awaySnapshot
        ? divisionTierWeight(awaySnapshot.divisionTitle) * 10 + Math.max(0, 12 - awaySnapshot.rank)
        : 8;
      const awayStrength = homeSnapshot
        ? divisionTierWeight(homeSnapshot.divisionTitle) * 10 + Math.max(0, 12 - homeSnapshot.rank)
        : 8;
      const homeDifficulty = difficultyByTeam.get(homeName) ?? { total: 0, count: 0 };
      homeDifficulty.total += homeStrength;
      homeDifficulty.count += 1;
      difficultyByTeam.set(homeName, homeDifficulty);
      const awayDifficulty = difficultyByTeam.get(awayName) ?? { total: 0, count: 0 };
      awayDifficulty.total += awayStrength;
      awayDifficulty.count += 1;
      difficultyByTeam.set(awayName, awayDifficulty);
    });
    const difficultyRows = Array.from(difficultyByTeam.entries())
      .map(([teamName, value]) => ({
        teamName,
        difficulty: value.count > 0 ? value.total / value.count : 0,
      }))
      .sort((a, b) => b.difficulty - a.difficulty);
    const toughestRun = difficultyRows.slice(0, 3);
    const easiestRun = difficultyRows.slice(-3).reverse();
    const fixturesDifficultySlide: StudioSlide = {
      id: `ssn-master-block-fixture-difficulty-${currentGw}`,
      label: 'Master League • Fixture Difficulty',
      durationMs: 18000,
      narration: `Master League schedule difficulty. Toughest runs: ${toughestRun.map((row) => row.teamName).join(', ') || 'pending'}. Easiest runs: ${easiestRun.map((row) => row.teamName).join(', ') || 'pending'}.`,
      tone: 'movement',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Master League</span>
          <h3>Toughest And Easiest Runs</h3>
          <p>Difficulty weighted by opponents&apos; division tier and current league rank.</p>
          <div className="studio-rivalry-grid">
            <article className="studio-rivalry-card">
              <span>Toughest Run</span>
              <strong>{toughestRun.length > 0 ? toughestRun.map((row) => row.teamName).join(', ') : 'Pending'}</strong>
            </article>
            <article className="studio-rivalry-card">
              <span>Easiest Run</span>
              <strong>{easiestRun.length > 0 ? easiestRun.map((row) => row.teamName).join(', ') : 'Pending'}</strong>
            </article>
          </div>
        </div>
      ),
    };

    const contextRows = masterRows.slice(0, 6).map((row) => {
      const team = teamById.get(row.teamId) ?? teamByName.get(normalizeTeamKey(row.teamName)) ?? null;
      const allTimePointsRank = allTimeLeagues?.pointsTable.find((entry) => entry.teamId === row.teamId)?.rank ?? null;
      const allTimeProfitRank = allTimeLeagues?.profitTable.find((entry) => entry.teamId === row.teamId)?.rank ?? null;
      const allTimeSpinsRank = allTimeLeagues?.spinsTable.find((entry) => entry.teamId === row.teamId)?.rank ?? null;
      const latestCup = team?.currentCupJourney?.slice().reverse().find((entry) => entry.result !== 'Pending') ?? null;
      return {
        teamName: row.teamName,
        masterRank: row.rank,
        allTimePointsRank,
        allTimeProfitRank,
        allTimeSpinsRank,
        latestCup: latestCup ? `${latestCup.round} ${latestCup.result}` : 'Cup pending',
      };
    });
    const contextSlide: StudioSlide = {
      id: `ssn-master-block-context-${currentGw}`,
      label: 'Master League • Cross-Competition Context',
      durationMs: 18000,
      narration: `Master League context across all-time, cup, and division form.`,
      tone: 'movement',
      content: (
        <div className="studio-fixtures-slide">
          <div className="studio-fixtures-head">
            <span className="studio-kicker">Master League</span>
            <h3>Cross-Competition Context</h3>
            <p>All-time rank, cup route, and master table position combined for each contender.</p>
          </div>
          <div className="studio-fixtures-list studio-scroll-panel">
            {contextRows.length > 0 ? contextRows.map((row) => (
              <article key={`ssn-master-context-${row.teamName}`} className="studio-fixture-row">
                <div className="studio-fixture-main">
                  <strong>{row.teamName}</strong>
                  <span className="studio-comp-badge master">#{row.masterRank}</span>
                </div>
                <div className="studio-fixture-meta">
                  <span>All-time P {row.allTimePointsRank ? `#${row.allTimePointsRank}` : '—'}</span>
                  <span>Profit {row.allTimeProfitRank ? `#${row.allTimeProfitRank}` : '—'}</span>
                  <span>Spins {row.allTimeSpinsRank ? `#${row.allTimeSpinsRank}` : '—'}</span>
                  <span>{row.latestCup}</span>
                </div>
              </article>
            )) : (
              <p className="studio-muted">Cross-competition context is loading.</p>
            )}
          </div>
        </div>
      ),
    };

    const projectionRows = masterRows.map((row) => {
      const team = teamById.get(row.teamId) ?? teamByName.get(normalizeTeamKey(row.teamName)) ?? null;
      const formScore = team ? formPoints(team.leagueForm) : 0;
      const allTimeTableSize = Math.max(
        allTimeLeagues?.pointsTable.length ?? 0,
        allTimeLeagues?.profitTable.length ?? 0,
        allTimeLeagues?.spinsTable.length ?? 0,
        masterRows.length,
        1,
      );
      const pointsRank = allTimeLeagues?.pointsTable.find((entry) => entry.teamId === row.teamId)?.rank ?? allTimeTableSize;
      const profitRank = allTimeLeagues?.profitTable.find((entry) => entry.teamId === row.teamId)?.rank ?? allTimeTableSize;
      const spinsRank = allTimeLeagues?.spinsTable.find((entry) => entry.teamId === row.teamId)?.rank ?? allTimeTableSize;
      const allTimeSignal = ((allTimeTableSize + 2) - pointsRank) + ((allTimeTableSize + 2) - profitRank) + ((allTimeTableSize + 2) - spinsRank);
      const difficulty = difficultyRows.find((entry) => normalizeTeamKey(entry.teamName) === normalizeTeamKey(row.teamName))?.difficulty ?? 10;
      const predictionScore = row.points * 6 + row.profit * 2 + formScore + allTimeSignal - difficulty;
      return {
        teamName: row.teamName,
        predictionScore,
        difficulty,
      };
    }).sort((a, b) => b.predictionScore - a.predictionScore);
    const contenders = projectionRows.slice(0, 4).map((row) => row.teamName);
    const strugglers = projectionRows.slice(-4).map((row) => row.teamName);
    const predictionSlide: StudioSlide = {
      id: `ssn-master-block-prediction-${currentGw}`,
      label: 'Master League • Prediction',
      durationMs: 18000,
      narration: `Master League prediction. Top contenders: ${contenders.join(', ') || 'pending'}. Expected strugglers: ${strugglers.join(', ') || 'pending'}.`,
      tone: 'movement',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Master League</span>
          <h3>Computer Prediction</h3>
          <p>Based on master table strength, all-time profile, form trend, and fixture difficulty.</p>
          <div className="studio-rivalry-grid">
            <article className="studio-rivalry-card">
              <span>Top Contenders</span>
              <strong>{contenders.join(', ') || 'Pending'}</strong>
            </article>
            <article className="studio-rivalry-card">
              <span>Likely Mid-Table</span>
              <strong>{projectionRows.slice(4, Math.max(4, projectionRows.length - 4)).map((row) => row.teamName).join(', ') || 'Pending'}</strong>
            </article>
            <article className="studio-rivalry-card">
              <span>Expected Strugglers</span>
              <strong>{strugglers.join(', ') || 'Pending'}</strong>
            </article>
          </div>
        </div>
      ),
    };

    return [
      fixtureBoardSlide,
      watchListSlide,
      predictionSlide,
    ];
  }, [
    allTimeLeagues,
    currentGw,
    masterLeagueRows,
    renderScoreParts,
    skySportsNewsMode,
    ssnMasterGroup,
    teamById,
    teamTableSnapshotByName,
    teams,
  ]);
  const ssnTrioGroup = useMemo(
    () => fixtureGroups.find((group) => group.id.startsWith('trio-'))
      ?? fixtureGroups.find((group) => /trio league/i.test(group.title)),
    [fixtureGroups],
  );
  const ssnTrioLeagueSlides = useMemo<StudioSlide[]>(() => {
    if (!skySportsNewsMode) {
      return [];
    }

    const trioRows = trioLeagueRows.slice();
    const trioFixtureHistory = trioLeagueFixtures.slice();
    if (trioRows.length === 0 && trioFixtureHistory.length === 0 && !ssnTrioGroup) {
      return [];
    }

    const divisionOrder = Array.from(
      new Set([
        ...trioRows.map((row) => row.division),
        ...trioFixtureHistory.map((fixture) => fixture.division),
      ]),
    ).sort((left, right) => trioDivisionSortValue(left) - trioDivisionSortValue(right));

    const rowsByDivision = new Map<string, SkyStudioTrioRow[]>();
    divisionOrder.forEach((division) => {
      rowsByDivision.set(
        division,
        trioRows
          .filter((row) => row.division === division)
          .slice()
          .sort((left, right) => left.rank - right.rank),
      );
    });

    const trioRulesSlide: StudioSlide = {
      id: `ssn-trio-rules-${currentGw}`,
      label: 'Trio League • Stakes',
      durationMs: 18000,
      narration: 'Trio League stakes. Premier League sends two down. Ligue 1 sends one up automatically, second to fifth into the playoff, and two down. Bundesliga sends one up automatically, second to fifth into the playoff, with no relegation.',
      tone: 'competition',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Trio League</span>
          <h3>How The Trio Ladder Works</h3>
          <p>The three-tier structure and the movement rules that matter most on air.</p>
          <div className="studio-rivalry-grid">
            <article className="studio-rivalry-card">
              <span>Premier League</span>
              <strong>Bottom 2 relegated</strong>
              <span>No promotion places</span>
            </article>
            <article className="studio-rivalry-card">
              <span>Ligue 1</span>
              <strong>1st up, 2nd-5th playoff</strong>
              <span>Bottom 2 relegated</span>
            </article>
            <article className="studio-rivalry-card">
              <span>Bundesliga</span>
              <strong>1st up, 2nd-5th playoff</strong>
              <span>No relegation</span>
            </article>
          </div>
        </div>
      ),
    };

    const trioOverviewSlide: StudioSlide = {
      id: `ssn-trio-overview-${currentGw}`,
      label: 'Trio League • Table Watch',
      durationMs: 18000,
      narration: divisionOrder.length > 0
        ? `Trio League overview. ${divisionOrder.map((division) => {
          const rows = rowsByDivision.get(division) ?? [];
          const leader = rows[0]?.teamName ?? 'pending';
          return `${division}, leader ${leader}`;
        }).join('. ')}.`
        : 'Trio League overview is loading.',
      tone: 'movement',
      content: (
        <div className="studio-fixtures-slide">
          <div className="studio-fixtures-head">
            <span className="studio-kicker">Trio League</span>
            <h3>Table Watch</h3>
            <p>Leaders, playoff lines, and drop zones across the three tiers.</p>
          </div>
          <div className="studio-rivalry-grid">
            {divisionOrder.map((division) => {
              const rows = rowsByDivision.get(division) ?? [];
              const leader = rows[0];
              const second = rows[1];
              const playoffLine = rows.slice(1, 5).map((row) => row.teamName).join(', ') || 'Pending';
              const bottomLine = rows.slice(-2).map((row) => row.teamName).join(', ') || 'Pending';
              return (
                <article key={`ssn-trio-overview-${division}`} className="studio-rivalry-card">
                  <span>{division}</span>
                  <strong>{leader ? `${leader.teamName} lead` : 'Leader pending'}</strong>
                  <span>
                    {division === 'Premier League'
                      ? (second ? `Chasing: ${second.teamName}` : 'Chasing pack pending')
                      : leader
                        ? `Auto up: ${leader.teamName}`
                        : 'Auto promotion pending'}
                  </span>
                  <span>{division === 'Premier League' ? `Drop zone: ${bottomLine}` : `Playoff line: ${playoffLine}`}</span>
                  <span>{division === 'Bundesliga' ? 'No relegation here' : division === 'Ligue 1' ? `Drop zone: ${bottomLine}` : 'Bottom 2 relegated'}</span>
                </article>
              );
            })}
          </div>
        </div>
      ),
    };

    const journeySlides = divisionOrder.flatMap((division, divisionIndex) => {
      const rows = rowsByDivision.get(division) ?? [];
      if (rows.length === 0) {
        return [];
      }
      const regularFixtures = trioFixtureHistory
        .filter((fixture) => fixture.division === division && fixture.stage === 'regular')
        .slice()
        .sort((left, right) => (
          parseGwNumber(left.gw) - parseGwNumber(right.gw)
          || left.groupSlot - right.groupSlot
          || left.id - right.id
        ));
      const gwNumbers = Array.from({ length: 6 }, (_, index) => index + 1);
      const stats = new Map<number, { teamName: string; points: number; profit: number; spins: number; wins: number }>();
      rows.forEach((row) => {
        stats.set(row.teamId, {
          teamName: row.teamName,
          points: 0,
          profit: 0,
          spins: 0,
          wins: 0,
        });
      });
      const rankHistory = new Map<number, number[]>();
      rows.forEach((row) => {
        rankHistory.set(row.teamId, []);
      });

      gwNumbers.forEach((gwNumber) => {
        const gwLabel = `GW${gwNumber}`;
        regularFixtures
          .filter((fixture) => fixture.gw === gwLabel)
          .forEach((fixture) => {
            const home = stats.get(fixture.homeTeamId);
            const away = stats.get(fixture.awayTeamId);
            if (!home || !away) {
              return;
            }
            home.profit += fixture.homeProfit;
            away.profit += fixture.awayProfit;
            home.spins += fixture.homeSpins;
            away.spins += fixture.awaySpins;
            if (fixture.result === 'home') {
              home.points += 3;
              home.wins += 1;
            } else if (fixture.result === 'away') {
              away.points += 3;
              away.wins += 1;
            } else if (fixture.result === 'draw') {
              home.points += 1;
              away.points += 1;
            }
          });
        const standings = rows
          .map((row) => ({
            row,
            stats: stats.get(row.teamId) ?? { teamName: row.teamName, points: 0, profit: 0, spins: 0, wins: 0 },
          }))
          .sort((left, right) => (
            right.stats.points - left.stats.points
            || right.stats.profit - left.stats.profit
            || right.stats.spins - left.stats.spins
            || right.stats.wins - left.stats.wins
            || left.row.teamName.localeCompare(right.row.teamName)
          ));
        standings.forEach((entry, index) => {
          rankHistory.get(entry.row.teamId)?.push(index + 1);
        });
      });

      const journeyTeams: SsnDivisionJourneyTeam[] = rows.map((row, rowIndex) => {
        const seeded = rankHistory.get(row.teamId) ?? [];
        const normalizedRanks = gwNumbers.map((_, index) => seeded[index] ?? Math.min(rows.length, row.rank || rowIndex + 1));
        normalizedRanks[normalizedRanks.length - 1] = Math.min(rows.length, row.rank || rowIndex + 1);
        return {
          teamId: row.teamId,
          teamName: row.teamName,
          ballColor: row.ballColor,
          ringColor: row.ringColor,
          textColor: row.textColor,
          ranks: normalizedRanks,
        };
      });

      return [{
        id: `ssn-trio-journey-${divisionIndex}-${currentGw}`,
        label: `Trio League • ${division} Journey`,
        durationMs: minimumGraphDurationForGw(currentGw),
        narration: `${division} trio ladder. Journey chart from gameweek 1 to gameweek 6 with current ranking positions.`,
        tone: 'movement',
        content: (
          <div className="studio-fixtures-slide ssn-journey-slide">
            <div className="studio-fixtures-head">
              <span className="studio-kicker">Trio League</span>
              <h3>{division} Journey</h3>
              <p>Regular-season ranking animation with bingo balls tracking the table race.</p>
            </div>
            <SsnDivisionJourneyChart teams={journeyTeams} gwNumbers={gwNumbers} startDelayMs={divisionIndex * 300} divisionTitle={division} />
          </div>
        ),
      }];
    });

    const trioBoardFixtures = (ssnTrioGroup?.fixtures ?? []).slice();
    const trioFixturesSlide: StudioSlide = {
      id: `ssn-trio-fixtures-${currentGw}`,
      label: 'Trio League • Fixtures & Results',
      durationMs: 18000,
      narration: trioBoardFixtures.length > 0
        ? `Trio League fixtures and results. ${trioBoardFixtures.map((fixture) => `${fixture.fixture}, ${fixture.outcome}`).slice(0, 4).join('. ')}.`
        : 'Trio League fixture board is loading.',
      tone: 'fixtures',
      content: (
        <div className="studio-fixtures-slide">
          <div className="studio-fixtures-head">
            <span className="studio-kicker">Trio League</span>
            <h3>{currentGw} Fixtures &amp; Results</h3>
            <p>Current trio board with stage and division context on every tie.</p>
          </div>
          <div className="studio-fixtures-list studio-scroll-panel">
            {trioBoardFixtures.length > 0 ? trioBoardFixtures.map((fixture) => (
              <article key={`ssn-trio-fixture-${fixture.id}`} className="studio-fixture-row">
                <div className="studio-fixture-main">
                  <strong>{fixture.fixture}</strong>
                  <span className="studio-comp-badge trio">{fixture.profitImpact.replace(/^Trio League\s*•\s*/i, '')}</span>
                </div>
                <div className="studio-fixture-meta">
                  {renderScoreParts(fixture.score)}
                  <span className="studio-inline-result pending">{fixtureStatusLabel(fixture.statusCode)}</span>
                </div>
              </article>
            )) : (
              <p className="studio-muted">No trio fixtures loaded.</p>
            )}
          </div>
        </div>
      ),
    };

    const playoffFixtures = trioBoardFixtures.filter((fixture) => /playoff/i.test(fixture.profitImpact));
    const trioPlayoffSlide: StudioSlide | null = playoffFixtures.length > 0 ? {
      id: `ssn-trio-playoff-${currentGw}`,
      label: 'Trio League • Playoff Watch',
      durationMs: 18000,
      narration: `Trio playoff watch. ${playoffFixtures.map((fixture) => `${fixture.fixture}, ${fixture.profitImpact}`).join('. ')}.`,
      tone: 'competition',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Trio League</span>
          <h3>Playoff Watch</h3>
          <p>Third to sixth playoff ties deciding the extra promotion place.</p>
          <div className="studio-rivalry-grid">
            {playoffFixtures.map((fixture) => (
              <article key={`ssn-trio-playoff-${fixture.id}`} className="studio-rivalry-card">
                <span>{fixture.profitImpact}</span>
                <strong>{fixture.fixture}</strong>
                <span>{fixture.outcome}</span>
              </article>
            ))}
          </div>
        </div>
      ),
    } : null;

    return [
      trioRulesSlide,
      trioOverviewSlide,
      ...journeySlides,
      trioFixturesSlide,
      ...(trioPlayoffSlide ? [trioPlayoffSlide] : []),
    ];
  }, [
    currentGw,
    renderScoreParts,
    skySportsNewsMode,
    ssnTrioGroup,
    trioLeagueFixtures,
    trioLeagueRows,
  ]);
  const ssnAllTimeChainSlides = useMemo<StudioSlide[]>(() => {
    if (!skySportsNewsMode) {
      return [];
    }
    const cloneAllTimeSlide = (mode: AllTimeLeagueMode, idSuffix: string, labelPrefix: string): StudioSlide | null => {
      const base = buildAllTimeSegmentSlide(mode, 1);
      if (!base) {
        return null;
      }
      return {
        ...base,
        id: `ssn-${idSuffix}-${currentGw}`,
        label: `${labelPrefix} • ${ALL_TIME_MODE_COPY[mode].title}`,
        durationMs: 18000,
      };
    };
    const pickTwoSlides = SSN_ALL_TIME_PICK_TWO_MODES
      .map((mode, index) => cloneAllTimeSlide(mode, `alltime-pick-${mode}-${index + 1}`, 'All-Time League Pick'))
      .filter((slide): slide is StudioSlide => Boolean(slide));
    const pointsSlide = cloneAllTimeSlide('points', 'alltime-points', 'All-Time Points');
    const allTimeSpinsSlide = cloneAllTimeSlide('spins', 'alltime-spins', 'All-Time Spins');
    const allTimeProfitSlide = cloneAllTimeSlide('profit', 'alltime-profit', 'All-Time Profit');
    const divisionByTeamId = new Map<number, string>();
    tableDivisions.forEach((division) => {
      division.rows.forEach((row) => {
        divisionByTeamId.set(row.teamId, division.title);
      });
    });
    const currentSpinsRows = tableDivisions
      .flatMap((division) => (
        division.rows.map((row) => ({
          ...row,
          divisionTitle: division.title,
        }))
      ))
      .filter((row) => row.teamId > 0)
      .sort((a, b) => b.spins - a.spins || b.points - a.points || a.rank - b.rank)
      .slice(0, 10);
    const currentSpinsSlide: StudioSlide = {
      id: `ssn-current-spins-${currentGw}`,
      label: 'Spins Leaderboard • Current Season',
      durationMs: 18000,
      narration: currentSpinsRows.length > 0
        ? `Current season spins leaderboard. ${currentSpinsRows.slice(0, 5).map((row) => `${row.teamName} ${row.spins}`).join('. ')}.`
        : 'Current season spins leaderboard is loading.',
      tone: 'movement',
      content: (
        <div className="studio-fixtures-slide">
          <div className="studio-fixtures-head">
            <span className="studio-kicker">Spins Leaderboard</span>
            <h3>Current Season Spins</h3>
            <p>Spins leaderboard across all active divisions this season.</p>
          </div>
          <div className="studio-fixtures-list studio-scroll-panel">
            {currentSpinsRows.length > 0 ? currentSpinsRows.map((row, index) => (
              <article key={`ssn-current-spins-${row.teamId}`} className="studio-fixture-row">
                <div className="studio-fixture-main">
                  <strong>{index + 1}. {row.teamName}</strong>
                  <span className="studio-comp-badge league">{divisionByTeamId.get(row.teamId) ?? row.divisionTitle}</span>
                </div>
                <div className="studio-fixture-meta">
                  <span>{row.spins} spins</span>
                  <span>{row.points} pts</span>
                  <span>{formatSigned(row.profit)}</span>
                </div>
              </article>
            )) : (
              <p className="studio-muted">Current spins leaderboard unavailable.</p>
            )}
          </div>
        </div>
      ),
    };
    return [
      ...pickTwoSlides,
      ...(pointsSlide ? [pointsSlide] : []),
      currentSpinsSlide,
      ...(allTimeSpinsSlide ? [allTimeSpinsSlide] : []),
      ...(allTimeProfitSlide ? [allTimeProfitSlide] : []),
    ];
  }, [buildAllTimeSegmentSlide, currentGw, skySportsNewsMode, tableDivisions]);
  const ssnRundownSlides = useMemo<StudioSlide[]>(() => {
    if (!skySportsNewsMode) {
      return [];
    }
    return [
      ...broadcastHeroSlides,
      ...ssnDivisionSlides,
      ...broadcastStorylineSlides,
      ...chaosIndexSlides,
      ...broadcastGraphicsSlides,
      ...ssnMasterLeagueSlides,
      ...ssnTrioLeagueSlides,
      ...(ssnCupPreviousWinnersSlide ? [ssnCupPreviousWinnersSlide] : []),
      ...ssnCupRoundSlides,
      ...ssnChampionsSpotlightSlides,
      ...ssnPremierSpotlightSlides,
      ...ssnDiv1SpotlightSlides,
      ...ssnDiv2SpotlightSlidesPass1,
      ...ssnDiv2SpotlightSlidesPass2,
      ...ssnDiv3SpotlightSlides,
      ...ssnDiv4SpotlightSlides,
      ...ssnAllTimeChainSlides,
    ];
  }, [
    broadcastHeroSlides,
    broadcastGraphicsSlides,
    broadcastStorylineSlides,
    chaosIndexSlides,
    skySportsNewsMode,
    ssnAllTimeChainSlides,
    ssnChampionsSpotlightSlides,
    ssnCupPreviousWinnersSlide,
    ssnCupRoundSlides,
    ssnDiv1SpotlightSlides,
    ssnDiv2SpotlightSlidesPass1,
    ssnDiv2SpotlightSlidesPass2,
    ssnDiv3SpotlightSlides,
    ssnDiv4SpotlightSlides,
    ssnDivisionSlides,
    ssnMasterLeagueSlides,
    ssnPremierSpotlightSlides,
    ssnTrioLeagueSlides,
  ]);
  const playoffBracketMatches = isGw8PlayoffWindow ? playoffBracketData.matches : [];
  const showPlayoffPanels = isGw8PlayoffWindow && playoffBracketMatches.length > 0;
  const supportSlides = useMemo<StudioSlide[]>(
    () => {
      if (skySportsNewsMode) {
        return ssnRundownSlides;
      }
      const playoffSlides: StudioSlide[] = !showPlayoffPanels || playoffBracketMatches.length === 0
        ? []
        : [{
          id: `division-playoffs-${currentGw}`,
          label: 'All Division Playoffs',
          durationMs: 18000,
          narration: `All division playoffs. If profit is level, it goes to penalties for Jay to take. ${playoffBracketMatches.map((match) => `${match.fixture}. ${match.penaltyLine}`).join(' ')}`,
          tone: 'fixtures',
          content: (
            <div className="studio-fixtures-slide">
              <div className="studio-fixtures-head">
                <span className="studio-kicker">All Division Playoffs</span>
                <h3>{currentGw} Playoff Desk</h3>
                <p>If profit is level after the tie, it goes to penalties for Jay to take.</p>
              </div>
              <div className="studio-fixtures-list studio-scroll-panel">
                {playoffBracketMatches.map((match) => (
                  <article key={`division-playoff-slide-${match.id}`} className="studio-fixture-row">
                    <div className="studio-fixture-main">
                      <strong>{match.fixture}</strong>
                      <span className="studio-comp-badge league">{match.upperDivision} / {match.lowerDivision}</span>
                    </div>
                    <div className="studio-fixture-meta">
                      {renderScoreParts(match.score)}
                      <span className="studio-inline-result pending">{match.statusLabel}</span>
                    </div>
                    <p>{match.stakesLine}</p>
                    <p>{match.penaltyLine}</p>
                  </article>
                ))}
              </div>
            </div>
          ),
        }];
      const ordered = orderSupportSlides(
        [
          ...broadcastPackageSlides,
          ...broadcastHeroSlides,
          ...broadcastStorylineSlides,
          ...chaosIndexSlides,
          ...broadcastGraphicsSlides,
          ...playoffSlides,
          ...teamOfDaySlides,
          ...shockOfGwSlides,
          ...momentumHeatSlides,
          ...cupBracketSlides,
          ...predictionDeltaSlides,
          ...changeBriefSlides,
          ...fixtureStorySlides,
          ...whyMattersSlides,
          ...leagueFactSlides,
          ...RivalrySlides(rivalries),
          ...LeagueMovementSlides(movements),
        ],
        directorMode,
      );
      const pinned = [pinnedStoryOne, pinnedStoryTwo].filter((value): value is string => Boolean(value));
      if (pinned.length === 0) {
        return ordered;
      }
      const pinnedSet = new Set(pinned);
      const pinnedSlides = ordered.filter((slide) => pinnedSet.has(slide.id));
      const remainingSlides = ordered.filter((slide) => !pinnedSet.has(slide.id));
      return [...pinnedSlides, ...remainingSlides];
    },
    [
      broadcastPackageSlides,
      broadcastGraphicsSlides,
      broadcastHeroSlides,
      broadcastStorylineSlides,
      chaosIndexSlides,
      changeBriefSlides,
      cupBracketSlides,
      directorMode,
      fixtureStorySlides,
      leagueFactSlides,
      momentumHeatSlides,
      movements,
      pinnedStoryOne,
      pinnedStoryTwo,
      predictionDeltaSlides,
      rivalries,
      shockOfGwSlides,
      showPlayoffPanels,
      skySportsNewsMode,
      ssnRundownSlides,
      teamOfDaySlides,
      playoffBracketMatches,
      whyMattersSlides,
      currentGw,
      renderScoreParts,
    ],
  );
  const rotationSupportSlides = useMemo(
    () => {
      if (focusLock) {
        return [];
      }
      if (allTimeIntermissionSlide) {
        return [allTimeIntermissionSlide];
      }
      return supportSlides;
    },
    [allTimeIntermissionSlide, focusLock, supportSlides],
  );
  const ssnLeagueScoreRows = useMemo(() => {
    return fixtureGroups
      .filter((group) => group.id.startsWith('division-'))
      .flatMap((group) => (
        group.fixtures.map((fixture) => ({
          id: `${group.id}-${fixture.id}`,
          fixture: fixture.fixture,
          score: fixture.score,
          statusCode: fixture.statusCode,
          groupTitle: group.title,
        }))
      ));
  }, [fixtureGroups]);
  const coldOpenSlide = useMemo<StudioSlide>(() => {
    if (skySportsNewsMode) {
      return ssnWelcomeSlide;
    }
    const headlines: string[] = [];
    if (broadcastPackages.length > 0) {
      headlines.push(...broadcastPackages.slice(0, 3).map((pkg) => pkg.headline));
    }
    if (movements.length > 0) {
      headlines.push(movements[0]?.headline ?? '');
    }
    if (tickerItems.length > 0) {
      headlines.push(tickerItems[0] ?? '');
    }
    const lines = headlines.filter(Boolean).slice(0, 4);
    return {
      id: `cold-open-${currentGw}`,
      label: 'Tonight On Bookieball',
      durationMs: 20000,
      narration: `Tonight on Bookieball. ${lines.join('. ')}.`,
      tone: 'system',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Cold Open</span>
          <h3>Tonight on Bookieball</h3>
          <p>Headlines before we roll into the live rotation.</p>
          <div className="studio-rivalry-grid">
            {lines.map((line) => (
              <article key={`cold-open-line-${line}`} className="studio-rivalry-card">
                <strong>{line}</strong>
              </article>
            ))}
          </div>
        </div>
      ),
    };
  }, [broadcastPackages, currentGw, movements, ssnWelcomeSlide, skySportsNewsMode, tickerItems]);

  const teamSlidesById = useMemo(() => {
    const grouped = new Map<number, StudioSlide[]>();
    const map = new Map<number, StudioSlide[]>();
    teamSlides.forEach((slide) => {
      const match = /^team-(\d+)-/.exec(slide.id);
      if (!match) {
        return;
      }
      const teamId = Number(match[1]);
      if (!Number.isFinite(teamId)) {
        return;
      }
      const slidesForTeam = grouped.get(teamId) ?? [];
      slidesForTeam.push(slide);
      grouped.set(teamId, slidesForTeam);
    });
    grouped.forEach((slidesForTeam, teamId) => {
      if (focusLock) {
        const focusedTeam = teams.find((team) => team.id === teamId) ?? null;
        if (focusedTeam) {
          map.set(teamId, buildFocusTeamSlides(focusedTeam));
          return;
        }
      }
      const boundedSlides = selectTeamSpotlightSlides(slidesForTeam, {
        limit: skySportsNewsMode ? 2 : TEAM_SPOTLIGHT_SLIDE_LIMIT,
      });
      map.set(
        teamId,
        boundedSlides.map((slide) => ({ ...slide, durationMs: TEAM_SPOTLIGHT_SLIDE_DURATION_MS })),
      );
    });
    return map;
  }, [buildFocusTeamSlides, focusLock, skySportsNewsMode, teamSlides, teams]);

  const ssnSpotlightTeamIds = useMemo(() => {
    const championsPremierDivisionIds = new Set(
      primaryDivisions
        .filter((division) => /champion|premier/i.test(division.title))
        .map((division) => division.id),
    );
    const top = new Set<number>();
    const lower = new Set<number>();

    primaryDivisions.forEach((division) => {
      division.rows.forEach((row) => {
        if (row.teamId <= 0) {
          return;
        }
        if (championsPremierDivisionIds.has(division.id)) {
          top.add(row.teamId);
        } else {
          lower.add(row.teamId);
        }
      });
    });

    if (lower.size === 0) {
      teams.forEach((team) => {
        if (!top.has(team.id)) {
          lower.add(team.id);
        }
      });
    }

    return { top, lower };
  }, [primaryDivisions, teams]);

  const fallbackTeamRunQueue = useMemo(
    () =>
      primaryDivisions.flatMap((division) => (
        [...division.rows]
          .filter((row) => row.teamId > 0)
          .sort((a, b) => a.rank - b.rank)
          .flatMap((row) => {
            const slidesForTeam = teamSlidesById.get(row.teamId);
            if (!slidesForTeam || slidesForTeam.length === 0) {
              return [];
            }
            return [{
              divisionId: division.id,
              teamId: row.teamId,
              slides: slidesForTeam,
            }];
          })
      )),
    [primaryDivisions, teamSlidesById],
  );

  const fixtureOrderedTeamRunQueue = useMemo(() => {
    const teamNameToId = new Map<string, number>();
    teams.forEach((team) => {
      teamNameToId.set(normalizeTeamKey(team.name), team.id);
    });

    const teamIdToDivisionId = new Map<number, string>();
    const divisionTitleToId = new Map<string, string>();
    primaryDivisions.forEach((division) => {
      divisionTitleToId.set(normalizeTeamKey(division.title), division.id);
    });

    teams.forEach((team) => {
      const mappedDivisionId = divisionTitleToId.get(normalizeTeamKey(team.league));
      if (mappedDivisionId) {
        teamIdToDivisionId.set(team.id, mappedDivisionId);
      }
    });

    primaryDivisions.forEach((division) => {
      division.rows.forEach((row) => {
        if (row.teamId > 0 && !teamIdToDivisionId.has(row.teamId)) {
          teamIdToDivisionId.set(row.teamId, division.id);
        }
        if (row.teamId > 0 && !teamNameToId.has(normalizeTeamKey(row.teamName))) {
          teamNameToId.set(normalizeTeamKey(row.teamName), row.teamId);
        }
      });
    });

    const orderedTeamIds: number[] = [];
    const seen = new Set<number>();

    fixtureGroups.forEach((group) => {
      group.fixtures.forEach((fixture) => {
        const matchup = parseFixtureTeams(fixture.fixture);
        if (!matchup) {
          return;
        }
        [matchup.home, matchup.away].forEach((name) => {
          const teamId = teamNameToId.get(normalizeTeamKey(name));
          if (!teamId || seen.has(teamId)) {
            return;
          }
          seen.add(teamId);
          orderedTeamIds.push(teamId);
        });
      });
    });

    if (orderedTeamIds.length === 0) {
      return fallbackTeamRunQueue;
    }

    const fixtureRuns = orderedTeamIds.flatMap((teamId) => {
      const slidesForTeam = teamSlidesById.get(teamId);
      if (!slidesForTeam || slidesForTeam.length === 0) {
        return [];
      }
      const fallbackDivisionId = fallbackTeamRunQueue.find((run) => run.teamId === teamId)?.divisionId;
      return [{
        divisionId: teamIdToDivisionId.get(teamId) ?? fallbackDivisionId,
        teamId,
        slides: slidesForTeam,
      }];
    });

    const appendedFallbackRuns = fallbackTeamRunQueue.filter((run) => !seen.has(run.teamId));
    return [...fixtureRuns, ...appendedFallbackRuns];
  }, [fallbackTeamRunQueue, fixtureGroups, primaryDivisions, teamSlidesById, teams]);
  const teamRunSourceKey = useMemo(
    () => fixtureOrderedTeamRunQueue.map((run) => run.teamId).join('|'),
    [fixtureOrderedTeamRunQueue],
  );

  const teamRunQueue = useMemo<TeamRun[]>(() => {
    if (skySportsNewsMode) {
      return [];
    }
    const bag = buildTeamRunBag(
      fixtureOrderedTeamRunQueue,
      teamShuffleCycle,
      currentGw,
      focusTeamId,
      previousBagTailTeamIdsRef.current,
    );
    if (!focusTeamId) {
      return bag;
    }
    const focused = bag.filter((run) => run.teamId === focusTeamId);
    return focused.length > 0 ? focused : bag;
  }, [currentGw, fixtureOrderedTeamRunQueue, focusTeamId, skySportsNewsMode, teamShuffleCycle]);

  const activeTeamRun = teamRunQueue.length > 0
    ? teamRunQueue[rotationState.teamRunIndex % teamRunQueue.length]
    : null;
  const activeTeamSlides = activeTeamRun?.slides ?? [];
  const activeTeamSlide = activeTeamSlides.length > 0
    ? activeTeamSlides[rotationState.teamSlideIndex % activeTeamSlides.length]
    : null;
  const activeLeagueSlide = useMemo(() => {
    if (rotationSupportSlides.length === 0) {
      return null;
    }
    // Force a clean SSN entry at slide zero so startup cannot flash into a later segment.
    if (skySportsNewsMode && enteringSkySportsNewsMode) {
      return rotationSupportSlides[0] ?? null;
    }
    const normalizedIndex = ((rotationState.leagueSlideIndex % rotationSupportSlides.length) + rotationSupportSlides.length)
      % rotationSupportSlides.length;
    return rotationSupportSlides[normalizedIndex] ?? null;
  }, [enteringSkySportsNewsMode, rotationState.leagueSlideIndex, rotationSupportSlides, skySportsNewsMode]);
  const usingTeamPhase = rotationState.phase === 'teams' && !!activeTeamSlide;
  const rotationActiveSlide = usingTeamPhase ? activeTeamSlide : activeLeagueSlide;
  const presentationActiveSlide = activeInterruptSlide
    ?? (coldOpenPending ? coldOpenSlide : rotationActiveSlide);

  useLayoutEffect(() => {
    setTeamShuffleCycle(0);
    previousBagTailTeamIdsRef.current = [];
    previousRotationRef.current = null;
    previousCycleRef.current = 0;
    previousResolvedCountRef.current = resolvedCount;
    allTimeSpotlightCounterRef.current = 0;
    allTimeModeIndexRef.current = 0;
    allTimeSegmentSequenceRef.current = 0;
    ssnResumeAppliedRef.current = false;
    ssnPostTableQueuedRef.current = false;
    scoreUpdateQueuedRef.current = null;
    allTimeRotationRef.current = null;
    ssnSegmentRef.current = null;
    prevSegmentRef.current = null;
    prevFocusTeamRef.current = null;
    if (stingerTimerRef.current) {
      clearTimeout(stingerTimerRef.current);
      stingerTimerRef.current = null;
    }
    setStinger(null);
    setAllTimeIntermission(null);
    setSsnTableCycleComplete(false);
    setSsnSpotlightGroup('lower');
    setSsnSpotlightActive(false);
    if (skySportsNewsMode) {
      setRotationState({
        phase: 'leagues',
        teamRunIndex: 0,
        teamSlideIndex: 0,
        leagueSlideIndex: 0,
      });
    }
    setColdOpenPending(!focusLock && !skySportsNewsMode);
    setPendingInterruptSlides([]);
    setActiveInterruptSlide(null);
  }, [currentGw, focusLock, focusTeamId, skySportsNewsMode, teamRunSourceKey]);

  useEffect(() => {
    if (!skySportsNewsMode) {
      ssnResumeAppliedRef.current = false;
      return;
    }
    if (ssnResumeAppliedRef.current) {
      return;
    }
    safeLocalStorageRemove(SSN_RESUME_STORAGE_KEY);
    ssnResumeAppliedRef.current = true;
  }, [skySportsNewsMode]);

  useEffect(() => {
    if (!skySportsNewsMode) {
      setSsnSpotlightActive(true);
      return;
    }
    if (!ssnTableCycleComplete) {
      setSsnSpotlightActive(false);
      return;
    }
    if (!ssnPostTableQueuedRef.current) {
      return;
    }
    if (pendingInterruptSlides.length === 0 && !activeInterruptSlide) {
      setSsnSpotlightActive(true);
    }
  }, [activeInterruptSlide, pendingInterruptSlides.length, skySportsNewsMode, ssnTableCycleComplete]);

  useEffect(() => {
    if (!skySportsNewsMode) {
      return;
    }
    if (ssnTableCycleComplete) {
      return;
    }
    if (ssnDivisionSlides.length === 0) {
      setSsnTableCycleComplete(true);
      return;
    }
    setSsnTableCycleComplete(true);
  }, [skySportsNewsMode, ssnDivisionSlides.length, ssnTableCycleComplete]);

  const ssnPostTableSlides = useMemo<StudioSlide[]>(() => {
    if (!skySportsNewsMode) {
      return [];
    }
    return [];
  }, [skySportsNewsMode]);

  useEffect(() => {
    if (!skySportsNewsMode || !ssnTableCycleComplete) {
      return;
    }
    if (ssnPostTableQueuedRef.current) {
      return;
    }
    const postTableSlides = ssnPostTableSlides;
    if (postTableSlides.length === 0) {
      ssnPostTableQueuedRef.current = true;
      setSsnSpotlightActive(true);
      return;
    }
    ssnPostTableQueuedRef.current = true;
    setPendingInterruptSlides((queue) => {
      const existingIds = new Set(queue.map((slide) => slide.id));
      const additions = postTableSlides.filter((slide) => !existingIds.has(slide.id));
      if (additions.length === 0) {
        return queue;
      }
      return [...queue, ...additions];
    });
  }, [skySportsNewsMode, ssnPostTableSlides, ssnTableCycleComplete]);

  useEffect(() => {
    if (!scoreUpdateAlert) {
      return;
    }
    if (scoreUpdateQueuedRef.current === scoreUpdateAlert.id) {
      return;
    }
    scoreUpdateQueuedRef.current = scoreUpdateAlert.id;
    const alertSlide: StudioSlide = {
      id: `score-update-${scoreUpdateAlert.id}`,
      label: scoreUpdateAlert.headline,
      durationMs: 14000,
      narration: `${scoreUpdateAlert.headline}. ${scoreUpdateAlert.lines.join(' ')}`.trim(),
      tone: 'results',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">{scoreUpdateAlert.headline}</span>
          <h3>Score Update</h3>
          <div className="studio-rivalry-grid">
            {scoreUpdateAlert.lines.map((line) => (
              <article key={`${scoreUpdateAlert.id}-${line}`} className="studio-rivalry-card">
                <strong>{line}</strong>
              </article>
            ))}
          </div>
        </div>
      ),
    };
    setPendingInterruptSlides((queue) => [...queue, alertSlide]);
  }, [scoreUpdateAlert]);

  useEffect(() => {
    const previous = previousRotationRef.current;
    if (previous && teamRunQueue.length > 1) {
      const wrappedToNewBag =
        previous.phase === 'teams'
        && rotationState.phase === 'leagues'
        && previous.teamRunIndex === teamRunQueue.length - 1
        && rotationState.teamRunIndex === 0;
      if (wrappedToNewBag) {
        previousBagTailTeamIdsRef.current = teamRunQueue
          .slice(Math.max(0, teamRunQueue.length - TEAM_REPEAT_HARD_LOCK_COUNT))
          .map((run) => run.teamId);
        setTeamShuffleCycle((cycle) => cycle + 1);
      }
    }
    previousRotationRef.current = rotationState;
  }, [rotationState, teamRunQueue]);

  useEffect(() => {
    if (!activeTeamRun?.divisionId) {
      return;
    }
    setLastSpotlightDivisionId(activeTeamRun.divisionId);
    setLastSpotlightTeamId(activeTeamRun.teamId);
  }, [activeTeamRun?.divisionId, activeTeamRun?.teamId]);

  useEffect(() => {
    setRotationState((prev) => {
      const normalized = normalizeStudioRotationState({
        state: prev,
        teamRunCount: teamRunQueue.length,
        activeTeamSlideCount: activeTeamSlides.length,
        supportSlideCount: rotationSupportSlides.length,
      });
      if (
        normalized.phase === prev.phase
        && normalized.teamRunIndex === prev.teamRunIndex
        && normalized.teamSlideIndex === prev.teamSlideIndex
        && normalized.leagueSlideIndex === prev.leagueSlideIndex
      ) {
        return prev;
      }
      studioLog('rotation', 'normalized', normalized);
      return normalized;
    });
  }, [activeTeamSlides.length, rotationSupportSlides.length, teamRunQueue.length]);

  useEffect(() => {
    if (!focusTeamId) {
      return;
    }
    setRotationState((prev) => ({
      ...prev,
      phase: 'teams',
      teamRunIndex: 0,
      teamSlideIndex: 0,
    }));
  }, [focusTeamId]);

  const advanceRotation = useCallback((reason: 'timer') => {
    setRotationState((prev) => {
      const next = nextStudioRotationState({
        state: prev,
        teamRunCount: teamRunQueue.length,
        activeTeamSlideCount: activeTeamSlides.length,
        supportSlideCount: rotationSupportSlides.length,
        focusTeamId,
      });
      if (
        next.phase !== prev.phase
        || next.teamRunIndex !== prev.teamRunIndex
        || next.teamSlideIndex !== prev.teamSlideIndex
        || next.leagueSlideIndex !== prev.leagueSlideIndex
      ) {
        studioLog('rotation', reason, {
          phase: next.phase,
          teamRunIndex: next.teamRunIndex,
          teamSlideIndex: next.teamSlideIndex,
          leagueSlideIndex: next.leagueSlideIndex,
        });
      }
      return next;
    });
  }, [activeTeamSlides.length, focusTeamId, rotationSupportSlides.length, teamRunQueue.length]);

  const advancePresentation = useCallback((reason: 'timer') => {
    const queueNextInterrupt = (): boolean => {
      if (pendingInterruptSlides.length === 0) {
        return false;
      }
      const [next, ...rest] = pendingInterruptSlides;
      if (!next) {
        return false;
      }
      setPendingInterruptSlides(rest);
      setActiveInterruptSlide(next);
      studioLog('rotation', 'interrupt-start', {
        reason,
        slideId: next.id,
        remaining: rest.length,
      });
      return true;
    };

    if (activeInterruptSlide) {
      studioLog('rotation', 'interrupt-finish', {
        reason,
        slideId: activeInterruptSlide.id,
      });
      if (!queueNextInterrupt()) {
        setActiveInterruptSlide(null);
      }
      return;
    }

    if (coldOpenPending) {
      setColdOpenPending(false);
      studioLog('rotation', 'cold-open-finish', { reason, slideId: coldOpenSlide.id });
      if (queueNextInterrupt()) {
        return;
      }
      return;
    }

    if (queueNextInterrupt()) {
      return;
    }

    advanceRotation(reason);
  }, [activeInterruptSlide, advanceRotation, coldOpenPending, coldOpenSlide.id, pendingInterruptSlides]);

  const attemptAdvance = useCallback(() => {
    advancePresentation('timer');
  }, [advancePresentation]);
  useEffect(() => {
    attemptAdvanceRef.current = attemptAdvance;
  }, [attemptAdvance]);
  useEffect(() => {
    const nextSlideId = presentationActiveSlide?.id ?? null;
    if (activeSlideIdRef.current !== nextSlideId) {
      narrationAdvanceQueuedSlideIdRef.current = null;
    }
    activeSlideIdRef.current = nextSlideId;
  }, [presentationActiveSlide?.id]);

  useEffect(() => {
    const slideId = presentationActiveSlide?.id ?? null;
    if (!slideId) {
      return;
    }
    if (activeInterruptSlide || coldOpenPending) {
      // Overlay slides already include their own pacing and must finish before returning to rotation.
    } else if (usingTeamPhase && (activeTeamSlides.length === 0 || teamRunQueue.length === 0)) {
      return;
    }
    const minimumDurationMs = minimumDurationForSlideId(slideId, currentGw);
    const delayMs = Math.max(presentationActiveSlide?.durationMs ?? DEFAULT_SLIDE_DURATION_MS, minimumDurationMs);
    const isSsnDivisionJourneySlide = isGraphSlideId(slideId);
    const timer = window.setTimeout(() => {
      if (activeSlideIdRef.current !== slideId) {
        return;
      }
      if (narrationAdvanceQueuedSlideIdRef.current === slideId) {
        narrationAdvanceQueuedSlideIdRef.current = null;
        attemptAdvance();
        return;
      }
      if (
        voiceEnabled
        && narrationInProgressRef.current
        && narrationSlideIdRef.current === slideId
        && !skySportsNewsMode
        && !isSsnDivisionJourneySlide
      ) {
        narrationWaitingAdvanceRef.current = true;
        return;
      }
      attemptAdvance();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    activeInterruptSlide,
    activeTeamSlides.length,
    coldOpenPending,
    attemptAdvance,
    presentationActiveSlide?.durationMs,
    presentationActiveSlide?.id,
    currentGw,
    skySportsNewsMode,
    teamRunQueue.length,
    usingTeamPhase,
    voiceEnabled,
  ]);

  useEffect(() => {
    if (!skySportsNewsMode) {
      return;
    }
    if (!presentationActiveSlide || presentationActiveSlide.id !== `ssn-master-${currentGw}`) {
      return;
    }
    const panel = ssnMasterTableRef.current;
    if (!panel) {
      return;
    }
    panel.scrollTop = 0;
    if (panel.scrollHeight <= panel.clientHeight) {
      return;
    }
    const interval = window.setInterval(() => {
      if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2) {
        window.clearInterval(interval);
        return;
      }
      panel.scrollTop += 1;
    }, 35);
    return () => {
      window.clearInterval(interval);
    };
  }, [currentGw, presentationActiveSlide, skySportsNewsMode]);

  useEffect(() => {
    if (!skySportsNewsMode) {
      return;
    }
    const payload: SsnResumeState = {
      season: currentSeason,
      gw: currentGw,
      rotationState,
      ssnTableCycleComplete,
      ssnSpotlightGroup,
      ssnSpotlightActive,
      teamShuffleCycle,
      postTableQueued: ssnPostTableQueuedRef.current,
      activeSlideId: presentationActiveSlide?.id ?? null,
    };
    safeLocalStorageWrite(SSN_RESUME_STORAGE_KEY, JSON.stringify(payload));
  }, [
    currentGw,
    currentSeason,
    presentationActiveSlide?.id,
    rotationState,
    skySportsNewsMode,
    ssnSpotlightActive,
    ssnSpotlightGroup,
    ssnTableCycleComplete,
    teamShuffleCycle,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !autoScrollEnabled) {
      return;
    }
    const panel = studioPanelRef.current;
    if (!panel) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 0;
    const sufficientlyVisible = rect.top <= viewportHeight * 0.18 && rect.bottom >= viewportHeight * 0.55;
    if (sufficientlyVisible) {
      return;
    }
    window.requestAnimationFrame(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [presentationActiveSlide?.id, autoScrollEnabled]);

  useEffect(() => {
    if (!skySportsNewsMode) {
      return;
    }
    if (!presentationActiveSlide) {
      return;
    }
    const slideId = presentationActiveSlide.id;
    if (
      enteringSkySportsNewsMode
      && !/^ssn-division-\d+-(?:journey|roundup)-/.test(slideId)
    ) {
      return;
    }
    const currentSlideKey = `slide:${slideId}`;
    if (ssnSegmentRef.current === currentSlideKey) {
      return;
    }
    const spotlightStinger = ssnSpotlightBySlideId.get(slideId);
    if (spotlightStinger) {
      triggerStinger(spotlightStinger);
      ssnSegmentRef.current = currentSlideKey;
      return;
    }
    const segmentMap: Array<{
      pattern: RegExp;
      label: string;
      subline: string;
      key: string;
      oncePerGroup?: boolean;
    }> = [
      { pattern: /^ssn-champions-spotlight-/, label: 'CHAMPIONS SPOTLIGHT', subline: 'Enhanced Team Spotlight', key: 'spotlight-champions', oncePerGroup: true },
      { pattern: /^ssn-cup-/, label: 'CUP UPDATE', subline: 'Winners, Results, And Fixtures', key: 'cup' },
      { pattern: /^ssn-premier-spotlight-/, label: 'PREMIER SPOTLIGHT', subline: 'Enhanced Team Spotlight', key: 'spotlight-premier', oncePerGroup: true },
      { pattern: /^ssn-trio-/, label: 'TRIO LEAGUE', subline: 'Structure, Stakes, And Race Graphics', key: 'trio' },
      { pattern: /^ssn-master-block-/, label: 'MASTER LEAGUE', subline: 'Detailed Coverage Block', key: 'master' },
      { pattern: /^ssn-div1-spotlight-/, label: 'DIVISION 1 SPOTLIGHT', subline: 'Enhanced Team Spotlight', key: 'spotlight-div1', oncePerGroup: true },
      { pattern: /^ssn-alltime-/, label: 'ALL-TIME LEAGUES', subline: 'Points, Profit, And Spins', key: 'alltime' },
      { pattern: /^ssn-current-spins-/, label: 'SPINS LEADERBOARD', subline: 'Current Season Spins', key: 'current-spins' },
      { pattern: /^ssn-div2-spotlight-/, label: 'DIVISION 2 SPOTLIGHT', subline: 'Enhanced Team Spotlight', key: 'spotlight-div2', oncePerGroup: true },
      { pattern: /^ssn-div3-spotlight-/, label: 'DIVISION 3 SPOTLIGHT', subline: 'Enhanced Team Spotlight', key: 'spotlight-div3', oncePerGroup: true },
      { pattern: /^ssn-div4-spotlight-/, label: 'DIVISION 4 SPOTLIGHT', subline: 'Enhanced Team Spotlight', key: 'spotlight-div4', oncePerGroup: true },
    ];
    const matched = segmentMap.find((entry) => entry.pattern.test(slideId));
    if (matched) {
      const currentSegmentKey = `segment:${matched.key}`;
      if (matched.oncePerGroup && ssnSegmentRef.current === currentSegmentKey) {
        return;
      }
      triggerStinger({ label: matched.label, subline: matched.subline });
      ssnSegmentRef.current = currentSegmentKey;
      return;
    }
    ssnSegmentRef.current = currentSlideKey;
  }, [enteringSkySportsNewsMode, presentationActiveSlide, skySportsNewsMode, ssnSpotlightBySlideId, triggerStinger]);

  const rotatingSlides = useMemo<StudioSlide[]>(
    () => [
      ...teamSlides,
      ...rotationSupportSlides,
    ],
    [rotationSupportSlides, teamSlides],
  );

  const fallbackSlides: StudioSlide[] = rotatingSlides.length > 0
    ? rotatingSlides.slice(0, 1)
    : [
      {
        id: 'studio-fallback',
        label: 'Studio Loading',
        durationMs: DEFAULT_SLIDE_DURATION_MS,
        narration: 'Studio feed preparing. Waiting for fixtures, standings, and rivalry stories to load.',
        tone: 'system',
        content: (
          <div className="studio-system-slide">
            <h3>Studio feed preparing</h3>
            <p>Waiting for fixtures, standings, and rivalry stories to load.</p>
          </div>
        ),
      },
    ];

  const activeSlide = presentationActiveSlide ?? fallbackSlides[0] ?? null;
  const deckSlides = activeSlide ? [activeSlide] : fallbackSlides;
  const isStorySlideActive = Boolean(usingTeamPhase && !activeInterruptSlide && !coldOpenPending);
  const bagPosition = teamRunQueue.length > 0
    ? ((rotationState.teamRunIndex % teamRunQueue.length) + teamRunQueue.length) % teamRunQueue.length + 1
    : 0;
  const bagIndicatorLabel = teamRunQueue.length > 0
    ? `${bagPosition}/${teamRunQueue.length}`
    : '0/0';
  const bagCycleLabel = `Cycle ${teamShuffleCycle + 1}`;
  const phaseDivisionId = usingTeamPhase ? activeTeamRun?.divisionId : undefined;
  const activeDivisionId = tableFocusMode === 'spotlight'
    ? phaseDivisionId ?? lastSpotlightDivisionId
    : phaseDivisionId;
  const highlightedTeamId = usingTeamPhase ? activeTeamRun?.teamId ?? null : null;
  const tableHighlightedTeamId = usingTeamPhase
    ? activeTeamRun?.teamId ?? null
    : tableFocusMode === 'spotlight'
      ? lastSpotlightTeamId
      : null;
  const boardHighlightedTeamId = highlightedTeamId ?? tableHighlightedTeamId ?? null;
  const highlightedTeamName = highlightedTeamId === null
    ? null
    : teams.find((team) => team.id === highlightedTeamId)?.name ?? null;
  const commentaryTeamId = useMemo(() => {
    const activeId = activeSlide?.id ?? '';
    const slideMatch = /^team-(\d+)-/.exec(activeId);
    if (slideMatch) {
      const parsed = Number(slideMatch[1]);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (usingTeamPhase) {
      return activeTeamRun?.teamId ?? null;
    }
    return null;
  }, [activeSlide?.id, activeTeamRun?.teamId, usingTeamPhase]);
  const commentaryTeamName = commentaryTeamId === null
    ? null
    : teams.find((team) => team.id === commentaryTeamId)?.name ?? null;
  const highlightedTeamKey = highlightedTeamName ? normalizeTeamKey(highlightedTeamName) : null;
  const highlightedTeamRow = highlightedTeamId === null
    ? null
    : tableDivisions
      .flatMap((division) => division.rows)
      .find((row) => row.teamId === highlightedTeamId) ?? null;
  const isPlayoffBracketMatchHighlighted = (match: PlayoffBracketMatch | null): boolean => {
    if (!match || !highlightedTeamKey) {
      return false;
    }
    return [match.upperTeam, match.lowerTeam, match.winner]
      .filter((name): name is string => Boolean(name))
      .some((name) => normalizeTeamKey(name) === highlightedTeamKey);
  };
  const highlightedOpponentScoreCallout = useMemo(() => {
    if (highlightedTeamId === null) {
      return '';
    }
    const team = teams.find((entry) => entry.id === highlightedTeamId);
    if (!team?.weeklyFixtures?.length) {
      return '';
    }
    for (const fixture of team.weeklyFixtures) {
      const opponentScore = parseScoreForCommentary(fixture.opponentScore);
      if (opponentScore === null) {
        continue;
      }
      const fallbackTeams = parseFixtureTeams(fixture.fixture);
      const fallbackOpponent = fallbackTeams
        ? normalizeTeamKey(fallbackTeams.home) === normalizeTeamKey(team.name)
          ? fallbackTeams.away
          : fallbackTeams.home
        : 'the opponent';
      const opponentName = fixture.opponentName?.trim() || fallbackOpponent;
      if (!opponentName || ['BYE', 'TBD'].includes(opponentName.toUpperCase())) {
        continue;
      }
      return `As it stands, ${opponentName} has scored ${formatCommentaryPoints(opponentScore)} points in their round.`;
    }
    return '';
  }, [highlightedTeamId, teams]);
  const cameraMode = cameraModeFromTone(activeSlide?.tone);
  const cameraLabel = cameraModeLabel(cameraMode);
  const fixtureSummary = useMemo(() => {
    const flattened = fixtureGroups.flatMap((group) => (
      group.fixtures.map((fixture) => ({
        groupTitle: group.title,
        fixture,
      }))
    ));
    const pending = flattened.filter(({ fixture }) => isFixtureStatusPending(fixture.statusCode));
    const inPlay = flattened.filter(({ fixture }) => isFixtureStatusInPlay(fixture.statusCode));
    const provisional = flattened.filter(({ fixture }) => isFixtureStatusProvisional(fixture.statusCode));
    const confirmed = flattened.filter(({ fixture }) => isFixtureStatusFinalConfirmed(fixture.statusCode));
    const resolved = flattened.filter(({ fixture }) => isFixtureStatusResolved(fixture.statusCode));
    const cupPending = [...pending, ...inPlay].filter(({ groupTitle }) => /cup/i.test(groupTitle)).length;
    const masterPending = [...pending, ...inPlay].filter(({ groupTitle }) => /master league/i.test(groupTitle)).length;
    const nextFixture = pending[0] ?? inPlay[0] ?? null;
    const latestResult = [...provisional, ...confirmed, ...resolved][0] ?? null;
    const statusCue: 'LIVE' | 'PROVISIONAL' | 'CONFIRMED' =
      confirmed.length === flattened.length && flattened.length > 0
        ? 'CONFIRMED'
        : provisional.length > 0
          ? 'PROVISIONAL'
          : 'LIVE';
    return {
      pendingCount: pending.length,
      inPlayCount: inPlay.length,
      provisionalCount: provisional.length,
      confirmedCount: confirmed.length,
      resolvedCount: resolved.length,
      cupPending,
      masterPending,
      nextFixture,
      latestResult,
      statusCue,
    };
  }, [fixtureGroups]);
  useEffect(() => {
    if (focusLock) {
      previousResolvedCountRef.current = resolvedCount;
      return;
    }
    const previousResolvedCount = previousResolvedCountRef.current;
    if (resolvedCount <= previousResolvedCount) {
      previousResolvedCountRef.current = resolvedCount;
      return;
    }
    const latestResolved = fixtureGroups
      .flatMap((group) => group.fixtures.map((fixture) => ({ group, fixture })))
      .filter(({ fixture }) => isFixtureStatusResolved(fixture.statusCode))
      .slice(-1)[0];
    if (latestResolved) {
      const statusCode = latestResolved.fixture.statusCode;
      const winner = extractOutcomeWinner(latestResolved.fixture.outcome);
      const winnerLine = winner
        ? statusCode === 'final_confirmed'
          ? `Confirmed winner was ${winner}.`
          : `As it stands, winner was ${winner}.`
        : statusCode === 'final_confirmed'
          ? 'Confirmed result update just landed.'
          : 'Provisional result update just landed.';
      const headline = winner
        ? `${statusCode === 'final_confirmed' ? 'Breaking confirmed' : 'Breaking live'}: ${winner}`
        : `Breaking story: ${latestResolved.fixture.outcome}`;
      const interruptSlide: StudioSlide = {
        id: `breaking-${currentGw}-${latestResolved.fixture.id}-${resolvedCount}`,
        label: 'Breaking Story',
        durationMs: 9000,
        narration: `Breaking story update. ${latestResolved.fixture.fixture}. ${winnerLine}`,
        tone: 'fixtures',
        content: (
          <div className="studio-fixture-story-card">
            <div className="studio-fixture-story-head">
              <span className={`studio-fixture-story-status ${statusCode === 'final_confirmed' ? 'final-confirmed' : 'provisional'}`}>
                {statusCode === 'final_confirmed' ? 'Confirmed' : 'Provisional'}
              </span>
              <span className="studio-comp-badge cup">{latestResolved.group.title}</span>
            </div>
            <h3>{headline}</h3>
            <p>{latestResolved.fixture.fixture}</p>
            <div className="studio-fixture-story-foot">
              <span>{latestResolved.fixture.outcome}</span>
              {renderScoreParts(latestResolved.fixture.score)}
            </div>
          </div>
        ),
      };
      setPendingInterruptSlides((queue) => {
        if (queue.some((slide) => slide.id === interruptSlide.id)) {
          return queue;
        }
        return [...queue.slice(-3), interruptSlide];
      });
    }
    previousResolvedCountRef.current = resolvedCount;
  }, [currentGw, fixtureGroups, focusLock, resolvedCount]);
  useEffect(() => {
    if (focusLock || skySportsNewsMode) {
      previousCycleRef.current = teamShuffleCycle;
      return;
    }
    if (teamShuffleCycle <= previousCycleRef.current) {
      return;
    }
    previousCycleRef.current = teamShuffleCycle;
    const recapLead = movements[0]?.headline ?? 'Momentum board still moving';
    const recapSlide: StudioSlide = {
      id: `mini-recap-${currentGw}-cycle-${teamShuffleCycle}`,
      label: 'Mini Recap',
      durationMs: 9000,
      narration: `Mini recap package. ${recapLead}. ${resolvedCount} of ${fixtureCount} fixtures are settled so far.`,
      tone: 'movement',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">Mini Recap</span>
          <h3>What We Just Learned</h3>
          <p>{recapLead}</p>
          <div className="studio-rivalry-grid">
            <article className="studio-rivalry-card">
              <span>Fixtures Settled</span>
              <strong>{resolvedCount}/{fixtureCount}</strong>
            </article>
            <article className="studio-rivalry-card">
              <span>Cycle</span>
              <strong>{teamShuffleCycle + 1}</strong>
            </article>
          </div>
        </div>
      ),
    };
    setPendingInterruptSlides((queue) => [...queue.slice(-2), recapSlide]);
  }, [currentGw, fixtureCount, focusLock, movements, resolvedCount, skySportsNewsMode, teamShuffleCycle]);

  useEffect(() => {
    if (focusLock || skySportsNewsMode || allTimeSegmentModes.length === 0 || allTimeIntermission) {
      return;
    }
    if (!usingTeamPhase || activeTeamSlides.length === 0) {
      return;
    }
    if (rotationState.teamSlideIndex !== activeTeamSlides.length - 1) {
      return;
    }
    const nextCount = allTimeSpotlightCounterRef.current + 1;
    if (nextCount % ALL_TIME_SEGMENT_TEAM_BATCH !== 0) {
      return;
    }
    const mode = allTimeSegmentModes[allTimeModeIndexRef.current % allTimeSegmentModes.length];
    const nextSequence = allTimeSegmentSequenceRef.current + 1;
    setAllTimeIntermission({ mode, sequence: nextSequence });
  }, [
    activeTeamSlides.length,
    allTimeIntermission,
    allTimeSegmentModes,
    focusLock,
    rotationState.teamSlideIndex,
    skySportsNewsMode,
    usingTeamPhase,
  ]);

  useEffect(() => {
    const snapshot = {
      phase: rotationState.phase,
      teamSlideIndex: rotationState.teamSlideIndex,
      teamSlideCount: activeTeamSlides.length,
    };
    const previous = allTimeRotationRef.current;
    allTimeRotationRef.current = snapshot;
    if (!previous) {
      return;
    }
    const completedTeam =
      previous.phase === 'teams'
      && snapshot.phase === 'leagues'
      && previous.teamSlideCount > 0
      && previous.teamSlideIndex === previous.teamSlideCount - 1;
    if (completedTeam) {
      allTimeSpotlightCounterRef.current += 1;
    }
    if (previous.phase === 'leagues' && snapshot.phase === 'teams' && allTimeIntermission) {
      allTimeSegmentSequenceRef.current = allTimeIntermission.sequence;
      allTimeModeIndexRef.current += 1;
      setAllTimeIntermission(null);
    }
  }, [
    activeTeamSlides.length,
    allTimeIntermission,
    rotationState.phase,
    rotationState.teamSlideIndex,
  ]);
  const storyProgressLabels = useMemo(() => {
    if (!isStorySlideActive) {
      return [] as string[];
    }
    const labels = activeSlide?.narration ? extractStoryArcLabels(activeSlide.narration) : [];
    return labels.length > 0 ? labels : STORY_PROGRESS_STAGES;
  }, [activeSlide?.id, activeSlide?.narration, isStorySlideActive]);
  const storyProgressIndex = storyProgressLabels.length > 0 ? 0 : -1;
  const studioTruthCue: 'LIVE' | 'PROVISIONAL' | 'CONFIRMED' = fixtureSummary.statusCue
    ?? (gwLocked
      ? 'PROVISIONAL'
      : truthLabel === 'CONFIRMED'
        ? 'CONFIRMED'
        : 'LIVE');
  const nextFixtureHeadline = fixtureSummary.nextFixture
    ? fixtureSummary.nextFixture.fixture.fixture
    : studioTruthCue === 'CONFIRMED'
      ? 'All fixtures confirmed'
      : 'No pending kickoff';
  const latestResultHeadline = fixtureSummary.latestResult
    ? (() => {
      const winner = extractOutcomeWinner(fixtureSummary.latestResult.fixture.outcome);
      if (!winner) {
        return fixtureSummary.latestResult.fixture.outcome;
      }
      return fixtureSummary.latestResult.fixture.statusCode === 'final_confirmed'
        ? `Confirmed winner: ${winner}`
        : `As it stands: ${winner}`;
    })()
    : 'Awaiting first live result';
  const studioSlideDeck = (
    <SlideDeck
      slides={deckSlides}
      defaultDurationMs={activeSlide?.durationMs ?? DEFAULT_SLIDE_DURATION_MS}
    />
  );
  const activeStoryLine = useMemo(() => {
    const base = activeSlide?.narration ?? activeSlide?.label ?? 'Studio desk update in progress.';
    const [lead] = splitSentences(base);
    return truncateLine(lead ?? base, 150);
  }, [activeSlide?.id, activeSlide?.label, activeSlide?.narration]);
  const lowerThirdLine = highlightedOpponentScoreCallout
    ? `${activeStoryLine} ${highlightedOpponentScoreCallout}`.trim()
    : activeStoryLine;
  const highlightedPlayoffContext = highlightedTeamId === null
    ? null
    : playoffContextByTeamId.get(highlightedTeamId) ?? null;
  const spotlightSummary = highlightedTeamName
    ? highlightedTeamRow
      ? `${formatRank(highlightedTeamRow.rank)} • ${highlightedTeamRow.points} pts • ${formatSigned(highlightedTeamRow.profit)}${highlightedPlayoffContext ? ` • ${highlightedPlayoffContext.outlookLabel}` : ''}${highlightedOpponentScoreCallout ? ` • ${highlightedOpponentScoreCallout}` : ''}`
      : `${highlightedTeamName} are currently in the studio spotlight.`
    : 'League desk coverage is cycling through divisions, cups, and master league.';
  const commentaryData = useMemo(() => {
    if (commentaryTeamId === null) {
      const base = activeSlide?.narration ?? activeSlide?.label ?? '';
      const tableLead = activeTableDivision?.rows?.length
        ? (() => {
          const ordered = activeTableDivision.rows.slice().sort((a, b) => a.rank - b.rank);
          const leader = ordered[0];
          const bottom = ordered[ordered.length - 1];
          if (!leader || !bottom) {
            return '';
          }
          return `${activeTableDivision.title} table. ${leader.teamName} lead, ${bottom.teamName} bottom.`;
        })()
        : '';
      const isSsnStructuredSlide = skySportsNewsMode && /^ssn-/.test(activeSlide?.id ?? '');
      const sentences = [
        ...splitSentences(isSsnStructuredSlide ? '' : tableLead),
        ...splitSentences(base),
      ].filter(Boolean).slice(0, isSsnStructuredSlide ? 3 : 5);
      return {
        headline: activeSlide?.label ?? 'Studio Desk',
        lines: sentences,
      };
    }
    const team = teams.find((entry) => entry.id === commentaryTeamId) ?? null;
    if (!team) {
      return {
        headline: activeSlide?.label ?? 'Studio Desk',
        lines: [],
      };
    }
    const weeklyFixtures = team.weeklyFixtures ?? [];
    const leagueFixture = weeklyFixtures.find((fixture) => fixture.competition.startsWith('League')) ?? null;
    const cupFixture = weeklyFixtures.find((fixture) => fixture.competition.startsWith('Cup')) ?? null;
    const trioFixture = weeklyFixtures.find((fixture) => fixture.competition.startsWith('Trio League')) ?? null;
    const masterFixture = weeklyFixtures.find((fixture) => fixture.competition === 'Master League') ?? null;
    const withPeriod = (value: string): string => (/[.!?]$/.test(value) ? value : `${value}.`);
    const scoreReady = (fixture: NonNullable<typeof leagueFixture>): boolean => (
      !/pending|bye/i.test(fixture.teamScore)
      && !/pending|bye/i.test(fixture.opponentScore)
    );
    const fixtureDeskLine = (label: string, fixture: typeof leagueFixture): string => {
      if (!fixture) {
        return `${label}: no live card listed yet.`;
      }
      const statusPart = fixture.status ? withPeriod(fixture.status.trim()) : 'Pending.';
      const opponentName = fixture.opponentName || 'opposition';
      if (scoreReady(fixture)) {
        return `${label}: ${fixture.fixture}. ${team.name} ${fixture.teamScore}, ${opponentName} ${fixture.opponentScore}. ${statusPart}`;
      }
      return `${label}: ${fixture.fixture}. ${statusPart}`;
    };
    const fixtureStateTag = (fixture: typeof leagueFixture): string => {
      if (!fixture) {
        return 'pending';
      }
      if (fixture.statusCode === 'in_play') {
        return 'live';
      }
      if (fixture.statusCode === 'pending') {
        return 'pending';
      }
      if (fixture.statusCode === 'draw') {
        return 'level';
      }
      if (fixture.statusCode === 'won' || fixture.statusCode === 'advanced' || fixture.statusCode === 'bye') {
        return 'ahead';
      }
      return 'behind';
    };
    if (focusLock) {
      const leaguePanels = buildFocusLeaguePanels(team);
      const leagueLines = leaguePanels.map((panel) => {
        const highlighted = panel.rows.find((row) => row.teamId === team.id) ?? null;
        return highlighted
          ? `${panel.title}: ${formatRank(highlighted.rank)} on ${highlighted.points} points with ${formatSigned(highlighted.profit)} profit.`
          : `${panel.title}: position pending.`;
      });
      const fixtureLines = weeklyFixtures.map((fixture) => {
        const scoreBits = [fixture.teamScore, fixture.opponentScore]
          .filter((value) => value && value !== 'Pending')
          .join(' - ');
        return `${fixture.competition}: ${fixture.fixture}. ${fixture.status}${scoreBits ? ` • ${scoreBits}` : ''}.`;
      });
      return {
        headline: `${team.name} Team Board`,
        lines: [
          ...leagueLines,
          ...fixtureLines,
          `${currentGw} round-up for ${team.name}: league ${fixtureStateTag(leagueFixture)}, cup ${fixtureStateTag(cupFixture)}, trio ${fixtureStateTag(trioFixture)}, master ${fixtureStateTag(masterFixture)}.`,
        ],
      };
    }
    const lines: string[] = [];
    if (team.lastSeasonSummary) {
      const lastSeasonLabel = seasonOrdinalLabel(team.lastSeasonSummary.season);
      lines.push(
        `Sydney: In their ${lastSeasonLabel}, they finished ${team.lastSeasonSummary.division} #${team.lastSeasonSummary.rank} with ${team.lastSeasonSummary.points} points and ${formatSigned(team.lastSeasonSummary.profit)} profit.`,
      );
    } else {
      lines.push('Sydney: Last season has no archived league record.');
    }
    const divisionLine = team.rank !== null
      ? `Sydney: Division table status: ${team.name} are ${formatRank(team.rank)} in ${team.league} with ${team.points} points and ${formatSigned(team.seasonProfit)} profit.`
      : `Sydney: Division table status: ${team.name} rank pending in ${team.league}.`;
    lines.push(divisionLine);
    lines.push(`Sydney: ${fixtureDeskLine('League round', leagueFixture)}`);
    const formLine = team.leagueForm.length > 0
      ? `Sydney: Recent league form is ${team.leagueForm.join('-')} with ${team.streak}.`
      : 'Sydney: Recent league form is still building.';
    lines.push(formLine);
    lines.push('Sydney: Handing over now.');
    const currentCupJourney = team.currentCupJourney ?? [];
    const latestCup = currentCupJourney.slice().reverse().find((row) => row.result !== 'Pending');
    const pendingCup = currentCupJourney.slice().reverse().find((row) => row.result === 'Pending');
    const lastSeasonCup = team.lastSeasonSummary?.cupFinish ?? null;
    let cupRunLine = 'Jess: Cup run update pending.';
    if (latestCup) {
      if (latestCup.result === 'Advanced') {
        cupRunLine = `Jess: Cup run this season: ${latestCup.round}, advanced past ${latestCup.opponent}.`;
      } else if (latestCup.result === 'Out') {
        cupRunLine = `Jess: Cup run this season: out in ${latestCup.round} against ${latestCup.opponent}.`;
      } else if (latestCup.result === 'Bye') {
        cupRunLine = `Jess: Cup run this season: ${latestCup.round} bye completed.`;
      }
    } else if (pendingCup) {
      cupRunLine = `Jess: Cup run this season: ${pendingCup.round} vs ${pendingCup.opponent}, still live.`;
    } else if (lastSeasonCup) {
      cupRunLine = `Jess: Cup run last season: ${lastSeasonCup}.`;
    }
    lines.push(cupRunLine);
    lines.push(`Jess: ${fixtureDeskLine('Cup round', cupFixture)}`);
    lines.push('Jess: Over to the wider gameweek read.');
    const masterRow = masterLeagueRows.find((row) => row.teamId === team.id);
    const trioRow = trioLeagueRows.find((row) => row.teamId === team.id) ?? null;
    const trioLine = trioRow
      ? `Miles: Trio League position: ${trioRow.division} ${formatRank(trioRow.rank)} with ${trioRow.points} points and ${formatSigned(trioRow.profit)} profit.`
      : 'Miles: Trio League position pending.';
    const masterLine = masterRow
      ? `Miles: Master League position: ${formatRank(masterRow.rank)} with ${masterRow.points} points and ${formatSigned(masterRow.profit)} profit.`
      : 'Miles: Master League position pending.';
    lines.push(trioLine);
    lines.push(`Miles: ${fixtureDeskLine('Trio round', trioFixture)}`);
    lines.push(masterLine);
    lines.push(`Miles: ${fixtureDeskLine('Master round', masterFixture)}`);
    const allTimePointsRank = allTimeLeagues?.pointsTable.find((row) => row.teamId === team.id)?.rank ?? null;
    const allTimeProfitRank = allTimeLeagues?.profitTable.find((row) => row.teamId === team.id)?.rank ?? null;
    const allTimeSpinsRank = allTimeLeagues?.spinsTable.find((row) => row.teamId === team.id)?.rank ?? null;
    const allTimeLine = allTimePointsRank || allTimeProfitRank || allTimeSpinsRank
      ? `Miles: All-time leagues - Points ${allTimePointsRank ? formatRank(allTimePointsRank) : 'pending'}, Profit ${allTimeProfitRank ? formatRank(allTimeProfitRank) : 'pending'}, Spins ${allTimeSpinsRank ? formatRank(allTimeSpinsRank) : 'pending'}.`
      : 'Miles: All-time leagues update pending.';
    lines.push(allTimeLine);
    const remainingJessVar = stripSpeakerPrefix(
      pickSeedLine(
        readSsnCommentaryVariation('remaining_spotlights', 'Jess'),
        `${currentSeason ?? 'S'}-${currentGw}-${team.id}-remaining-jess`,
      ),
    );
    const remainingSydneyVar = stripSpeakerPrefix(
      pickSeedLine(
        readSsnCommentaryVariation('remaining_spotlights', 'Sydney'),
        `${currentSeason ?? 'S'}-${currentGw}-${team.id}-remaining-syd`,
      ),
    );
    if (remainingJessVar) {
      lines.push(`Jess: ${remainingJessVar}`);
    }
    if (remainingSydneyVar) {
      lines.push(`Sydney: ${remainingSydneyVar}`);
    }
    lines.push(
      `Miles: ${currentGw} round-up for ${team.name}: league ${fixtureStateTag(leagueFixture)}, cup ${fixtureStateTag(cupFixture)}, trio ${fixtureStateTag(trioFixture)}, master ${fixtureStateTag(masterFixture)}.`,
    );
    return {
      headline: `${team.name} Desk Read`,
      lines,
    };
  }, [activeSlide?.id, activeSlide?.label, activeSlide?.narration, activeTableDivision, allTimeLeagues, buildFocusLeaguePanels, commentaryTeamId, currentGw, currentSeason, focusLock, masterLeagueRows, skySportsNewsMode, teams, trioLeagueRows]);
  const voiceSegments = useMemo<NarrationSegment[]>(() => {
    if (!activeSlide) {
      return [];
    }
    const takeoverActive = Boolean(allTimeIntermissionSlide)
      || (skySportsNewsMode && /ssn-(cup|champions|premier|trio|master|all-?time|alltime|current-spins|div2|div3|div1|div4)/.test(activeSlide.id ?? ''));
    const tableVoiceLine = activeTableDivision?.rows?.length && skySportsNewsMode && !takeoverActive
      ? (() => {
        const ordered = activeTableDivision.rows.slice().sort((a, b) => a.rank - b.rank);
        const leader = ordered[0];
        const bottom = ordered[ordered.length - 1];
        if (!leader || !bottom) {
          return '';
        }
        return officialDivisionSeasonComplete
          ? `${activeTableDivision.title} final table. ${leader.teamName} won it on ${leader.points} points, while ${bottom.teamName} finished bottom.`
          : `${activeTableDivision.title} table update. ${leader.teamName} lead on ${leader.points} points, ${bottom.teamName} struggling at the bottom.`;
      })()
      : '';
    const baseLines = commentaryData.lines.length > 0
      ? commentaryData.lines
      : activeSlide.narration
        ? splitSentences(activeSlide.narration)
        : [activeSlide.label ?? ''];
    const segmentFeed: NarrationSegment[] = [];
    if (tableVoiceLine) {
      const cleanTableLine = sanitizeSpokenText(tableVoiceLine);
      if (cleanTableLine) {
        segmentFeed.push({ speaker: 'narrator', text: cleanTableLine });
      }
    }
    baseLines.forEach((line) => {
      segmentFeed.push(...splitNarrationSegments(line));
    });
    return compactNarrationSegments(segmentFeed);
  }, [activeSlide, activeSlide?.label, activeSlide?.narration, activeTableDivision, allTimeIntermissionSlide, commentaryData.lines, skySportsNewsMode, officialDivisionSeasonComplete]);
  const voiceNarration = useMemo(() => {
    const merged = voiceSegments.map((segment) => segment.text).join(' ').trim();
    if (!merged) {
      return '';
    }
    return buildNarrationText(merged, skySportsNewsMode ? 'desk' : 'brief');
  }, [skySportsNewsMode, voiceSegments]);
  const voiceNarrationKey = useMemo(
    () => voiceSegments.map((segment) => `${segment.speaker}:${segment.text}`).join('|'),
    [voiceSegments],
  );
  const spotlightSideCards = useMemo<ProducerCard[]>(() => {
    if (highlightedTeamId === null) {
      return [];
    }
    const team = teams.find((entry) => entry.id === highlightedTeamId) ?? null;
    if (!team) {
      return [];
    }
    if (focusLock) {
      const leaguePanels = buildFocusLeaguePanels(team);
      const weeklyFixtures = team.weeklyFixtures ?? [];
      const leagueDetail = leaguePanels.length > 0
        ? leaguePanels
          .map((panel) => {
            const highlighted = panel.rows.find((row) => row.teamId === team.id) ?? null;
            return highlighted ? `${panel.title} ${formatRank(highlighted.rank)}` : `${panel.title} pending`;
          })
          .join(' • ')
        : 'No league tables loaded yet.';
      const fixtureDetail = weeklyFixtures.length > 0
        ? weeklyFixtures.map((fixture) => `${fixture.competition}: ${fixture.fixture}`).join(' • ')
        : `No fixtures loaded for ${currentGw}.`;
      const liveCount = weeklyFixtures.filter((fixture) => fixture.statusCode === 'in_play').length;
      return [
        {
          id: `spotlight-leagues-${team.id}`,
          label: 'League Positions',
          headline: `${leaguePanels.length} league${leaguePanels.length === 1 ? '' : 's'} on screen`,
          detail: leagueDetail,
          tone: 'team',
        },
        {
          id: `spotlight-fixtures-${team.id}`,
          label: `${currentGw} Fixtures`,
          headline: `${weeklyFixtures.length} fixture${weeklyFixtures.length === 1 ? '' : 's'} tracked`,
          detail: fixtureDetail,
          tone: 'fixtures',
        },
        {
          id: `spotlight-live-${team.id}`,
          label: 'Live Status',
          headline: liveCount > 0 ? `${liveCount} fixture${liveCount === 1 ? '' : 's'} live now` : 'Awaiting the next score move',
          detail: `${team.name} remain highlighted across every competition board they are active in.`,
          tone: liveCount > 0 ? 'live' : 'fixtures',
        },
      ];
    }
    const cards: ProducerCard[] = [];
    const previousSeasons = (team.previousSeasons ?? [])
      .slice()
      .sort((left, right) => {
        const leftSeason = seasonNumberFromLabel(left.season) ?? 0;
        const rightSeason = seasonNumberFromLabel(right.season) ?? 0;
        return leftSeason - rightSeason;
      });
    const journeyParts = previousSeasons.map((season) => (
      `${seasonOrdinalLabel(season.season)}: ${season.division} #${season.rank}`
    ));
    const currentSeasonLabel = currentSeason ? seasonOrdinalLabel(currentSeason) : 'current season';
    const currentRank = team.rank !== null ? `#${team.rank}` : 'rank pending';
    journeyParts.push(`${currentSeasonLabel}: ${team.league} ${currentRank}`);
    const journeyDetail = journeyParts.join(' • ');
    const archiveSeasonsTracked = journeyParts.length;
    const archiveTitles = archiveTitleCount(previousSeasons);
    const archiveCupWins = archiveCupWinCount(previousSeasons);
    const archiveBestRank = archiveBestFinish(previousSeasons);
    const latestTitle = previousSeasons
      .slice()
      .reverse()
      .find((season) => season.rank === 1) ?? null;
    cards.push({
      id: `spotlight-journey-${team.id}`,
      label: 'Season Journey',
      headline: `${team.name} across ${archiveSeasonsTracked} seasons`,
      detail: journeyDetail || 'Season trail building.',
      tone: 'team',
    });
    cards.push({
      id: `spotlight-division-${team.id}`,
      label: 'Division Track',
      headline: `${team.divisionMovement} • ${team.zoneLabel}`,
      detail: `${team.points} points • ${team.wins}W ${team.draws}D ${team.losses}L`,
      tone: 'movement',
    });
    const bestProfitLabel = team.analytics?.bestGwProfit !== null && team.analytics?.bestGw
      ? `Best ${team.analytics.bestGw}: ${formatSigned(team.analytics.bestGwProfit)}`
      : team.analytics?.bestMatchLabel
        ? `Best match: ${team.analytics.bestMatchLabel}`
        : 'Best profit pending';
    const profitDetail = `Season profit ${formatSigned(team.seasonProfit)}.`;
    cards.push({
      id: `spotlight-profit-${team.id}`,
      label: 'Profit Peak',
      headline: bestProfitLabel,
      detail: profitDetail,
      tone: 'results',
    });
    const pendingCup = team.currentCupJourney?.find((row) => row.result === 'Pending');
    const latestCup = team.currentCupJourney?.slice().reverse().find((row) => row.result !== 'Pending');
    let cupHeadline = 'Cup path pending';
    if (pendingCup) {
      cupHeadline = `Cup ${pendingCup.round}: vs ${pendingCup.opponent}`;
    } else if (latestCup) {
      cupHeadline = `Cup ${latestCup.round}: ${latestCup.result}`;
    }
    const honoursParts = [
      `${archiveTitles} division title${archiveTitles === 1 ? '' : 's'}`,
      `${archiveCupWins} cup win${archiveCupWins === 1 ? '' : 's'}`,
      archiveBestRank === null ? 'best finish N/A' : `best finish #${archiveBestRank}`,
    ];
    const latestTitleLine = latestTitle
      ? `Latest title: ${seasonOrdinalLabel(latestTitle.season)} in ${latestTitle.division}.`
      : 'No archived title yet.';
    const cupDetail = `${honoursParts.join(' • ')}. ${latestTitleLine}`;
    cards.push({
      id: `spotlight-honours-${team.id}`,
      label: 'Cup & Honours',
      headline: cupHeadline,
      detail: cupDetail,
      tone: 'competition',
    });
    return cards.slice(0, 4);
  }, [buildFocusLeaguePanels, currentGw, currentSeason, focusLock, highlightedTeamId, teams]);
  const commentaryTone: ProducerCard['tone'] = commentaryTeamId
    ? 'team'
    : activeSlide?.tone === 'fixtures'
      ? 'fixtures'
      : activeSlide?.tone === 'results'
        ? 'results'
        : activeSlide?.tone === 'movement'
          ? 'movement'
          : 'live';
  const commentaryCard = commentaryData.lines.length > 0 ? (
    <article className={`studio-producer-card studio-commentary-card tone-${commentaryTone}`}>
      <div className="studio-producer-card-head">
        <span className="studio-producer-label">Desk Commentary</span>
        {commentaryTeamName && <span className="studio-producer-alert">Spotlight</span>}
      </div>
      <strong>{commentaryData.headline}</strong>
      {commentaryData.lines.map((line, index) => (
        <p key={`commentary-line-${index}`}>{line}</p>
      ))}
    </article>
  ) : null;

  useEffect(() => {
    if (!skySportsNewsMode || !voiceEnabled || !voiceInteractionReady || !activeSlide || voiceSegments.length === 0 || !voiceNarration) {
      return;
    }
    if (
      typeof window === 'undefined'
      || !('speechSynthesis' in window)
      || typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      return;
    }
    if (lastSpokenSlideRef.current === activeSlide.id && lastSpokenTextRef.current === voiceNarrationKey) {
      return;
    }
    const spokenSlideId = activeSlide.id;
    let finished = false;
    const finishNarration = (fromEndEvent: boolean) => {
      if (finished) {
        return;
      }
      finished = true;
      if (narrationFallbackTimerRef.current !== null) {
        window.clearTimeout(narrationFallbackTimerRef.current);
        narrationFallbackTimerRef.current = null;
      }
      const stillOnSameSlide = activeSlideIdRef.current === spokenSlideId;
      const wasWaitingForTimer = narrationWaitingAdvanceRef.current;
      if (narrationSlideIdRef.current === spokenSlideId) {
        narrationInProgressRef.current = false;
      }
      narrationWaitingAdvanceRef.current = false;
      if ((fromEndEvent && stillOnSameSlide) || wasWaitingForTimer) {
        narrationAdvanceQueuedSlideIdRef.current = spokenSlideId;
        window.requestAnimationFrame(() => {
          attemptAdvanceRef.current();
        });
      }
    };
    const voiceForSpeaker = (speaker: NarrationSpeaker, voiceMap: Record<NarrationSpeaker, SpeechSynthesisVoice | null>): SpeechSynthesisVoice | null => {
      if (speaker === 'sydney') {
        return voiceMap.sydney;
      }
      if (speaker === 'jess') {
        return voiceMap.jess;
      }
      if (speaker === 'miles') {
        return voiceMap.miles;
      }
      return voiceMap.narrator;
    };
    const speakSegmentQueue = (
      segments: NarrationSegment[],
      index: number,
      voiceMap: Record<NarrationSpeaker, SpeechSynthesisVoice | null>,
    ) => {
      if (finished) {
        return;
      }
      if (index >= segments.length) {
        finishNarration(true);
        return;
      }
      const segment = segments[index];
      if (!segment || !segment.text.trim()) {
        speakSegmentQueue(segments, index + 1, voiceMap);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      const selectedVoice = voiceForSpeaker(segment.speaker, voiceMap);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }
      utterance.onend = () => {
        speakSegmentQueue(segments, index + 1, voiceMap);
      };
      utterance.onerror = () => {
        speakSegmentQueue(segments, index + 1, voiceMap);
      };
      window.speechSynthesis.speak(utterance);
    };
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      if (narrationFallbackTimerRef.current !== null) {
        window.clearTimeout(narrationFallbackTimerRef.current);
        narrationFallbackTimerRef.current = null;
      }
      narrationInProgressRef.current = true;
      narrationWaitingAdvanceRef.current = false;
      narrationSlideIdRef.current = spokenSlideId;
      const voiceMap = pickPresenterVoices(window.speechSynthesis.getVoices());
      speakSegmentQueue(voiceSegments, 0, voiceMap);
      // Fallback in case browser TTS never emits onend/onerror.
      const wordCount = voiceNarration.trim().split(/\s+/).filter(Boolean).length;
      const estimatedMs = Math.max(9000, Math.min(38000, 2200 + wordCount * 360));
      narrationFallbackTimerRef.current = window.setTimeout(() => {
        finishNarration(true);
      }, estimatedMs);
      lastSpokenSlideRef.current = spokenSlideId;
      lastSpokenTextRef.current = voiceNarrationKey;
    } catch (error) {
      if (narrationFallbackTimerRef.current !== null) {
        window.clearTimeout(narrationFallbackTimerRef.current);
        narrationFallbackTimerRef.current = null;
      }
      narrationAdvanceQueuedSlideIdRef.current = null;
      narrationInProgressRef.current = false;
      narrationWaitingAdvanceRef.current = false;
      narrationSlideIdRef.current = null;
      // Avoid crashing the render loop on speech errors.
      console.warn('Studio voice narration failed', error);
    }
  }, [activeSlide, skySportsNewsMode, voiceEnabled, voiceInteractionReady, voiceNarration, voiceNarrationKey, voiceSegments]);
  useEffect(() => {
    if (voiceEnabled && skySportsNewsMode) {
      return;
    }
    if (narrationFallbackTimerRef.current !== null) {
      window.clearTimeout(narrationFallbackTimerRef.current);
      narrationFallbackTimerRef.current = null;
    }
    narrationAdvanceQueuedSlideIdRef.current = null;
    narrationInProgressRef.current = false;
    narrationWaitingAdvanceRef.current = false;
    narrationSlideIdRef.current = null;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.warn('Studio voice stop failed', error);
    }
  }, [skySportsNewsMode, voiceEnabled]);
  useEffect(() => {
    return () => {
      if (narrationFallbackTimerRef.current !== null) {
        window.clearTimeout(narrationFallbackTimerRef.current);
        narrationFallbackTimerRef.current = null;
      }
      narrationAdvanceQueuedSlideIdRef.current = null;
      narrationInProgressRef.current = false;
      narrationWaitingAdvanceRef.current = false;
      narrationSlideIdRef.current = null;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
      } catch (error) {
        console.warn('Studio voice stop failed', error);
      }
    };
  }, []);

  const fixtureVoiceSummary = useMemo(() => {
    const liveGroups = fixtureGroups
      .map((group) => ({
        title: group.title,
        fixtures: group.fixtures.filter((fixture) => fixture.statusCode === 'in_play' || fixture.statusCode === 'provisional'),
      }))
      .filter((group) => group.fixtures.length > 0);

    if (liveGroups.length === 0) {
      return '';
    }

    const closingNote = /closing/i.test(dayPhaseLabel ?? '') || /urgency/i.test(dayPhaseLine ?? '')
      ? 'Not long to go now. '
      : '';

    const lines = liveGroups.flatMap((group) => {
      return group.fixtures.map((fixture) => {
        const outcome = fixture.outcome ?? '';
        const isLevel = /draw|level/i.test(outcome);
        if (isLevel) {
          return `${group.title}: ${fixture.fixture} is level as it stands.`;
        }
        const fixtureTeams = parseFixtureTeams(fixture.fixture);
        const scoreMatch = fixture.score.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
        const scoreLeader = (() => {
          if (!fixtureTeams || !scoreMatch?.[1] || !scoreMatch?.[2]) {
            return null;
          }
          const homeScore = Number(scoreMatch[1]);
          const awayScore = Number(scoreMatch[2]);
          if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore === awayScore) {
            return null;
          }
          return homeScore > awayScore ? fixtureTeams.home : fixtureTeams.away;
        })();
        const leader = extractOutcomeLeader(outcome) ?? scoreLeader;
        const hasBye = /bye/i.test(fixture.fixture);
        if (leader && hasBye) {
          return `${group.title}: ${fixture.fixture}, ${leader} advance on a bye.`;
        }
        const margin = parseScoreMargin(fixture.score);
        if (leader && margin !== null) {
          const edgeLabel = margin <= 0.5 ? 'slight' : margin <= 1.5 ? 'narrow' : 'clear';
          return `${group.title}: ${fixture.fixture}, ${leader} lead with a ${edgeLabel} edge of ${margin.toFixed(2)}.`;
        }
        if (leader) {
          return `${group.title}: ${fixture.fixture}, ${leader} lead for now.`;
        }
        if (fixture.statusCode === 'in_play') {
          return `${group.title}: ${fixture.fixture} is live, no clear leader yet.`;
        }
        return `${group.title}: ${fixture.fixture} leader pending.`;
      });
    });

    return `${closingNote}Fixture check. ${lines.join(' ')}`.trim();
  }, [dayPhaseLabel, dayPhaseLine, fixtureGroups]);
  const cupDrawSummary = useMemo(() => {
    const playable = cupFixtures
      .filter((fixture) => fixture.homeTeam && fixture.awayTeam)
      .map((fixture) => ({
        ...fixture,
        gwNumber: parseGwNumber(fixture.gw),
      }));
    if (playable.length === 0) {
      return '';
    }
    const earliestGw = Math.min(...playable.map((fixture) => fixture.gwNumber));
    const earliestFixtures = playable
      .filter((fixture) => fixture.gwNumber === earliestGw)
      .sort((a, b) => a.id - b.id);
    if (earliestFixtures.length === 0) {
      return '';
    }
    const roundName = earliestFixtures[0]?.roundName ?? 'Cup Draw';
    const pairs = earliestFixtures.slice(0, 6).map((fixture) => `${fixture.homeTeam} vs ${fixture.awayTeam}`);
    const remaining = Math.max(0, earliestFixtures.length - pairs.length);
    const remainderLine = remaining > 0 ? ` ${remaining} more ties confirmed.` : '';
    return `Cup draw confirmed for ${roundName}. ${pairs.join('. ')}.${remainderLine}`.trim();
  }, [cupFixtures]);
  const playoffPhaseLabel = useMemo(() => {
    if (showPlayoffPanels) {
      return `${currentGw} Playoff Showdown`;
    }
    if (gwNumber >= 6) {
      return 'Run-In';
    }
    return 'Regular Season';
  }, [currentGw, gwNumber, showPlayoffPanels]);
  const playoffRaceCards = useMemo<PlayoffRaceCard[]>(() => {
    if (!showPlayoffPanels) {
      return [];
    }
    return playoffBracketMatches.map((match) => {
      const upperKey = normalizeTeamKey(match.upperTeam);
      const lowerKey = normalizeTeamKey(match.lowerTeam);
      const upperTeamId = teamIdByTeamKey.get(upperKey) ?? null;
      const lowerTeamId = teamIdByTeamKey.get(lowerKey) ?? null;
      const winnerKey = match.winner ? normalizeTeamKey(match.winner) : '';
      const lowerWinning = winnerKey.length > 0 && winnerKey === lowerKey;
      const upperWinning = winnerKey.length > 0 && winnerKey === upperKey;
      const detail = match.statusCode === 'pending'
        ? `Kick-off pending. ${match.penaltyLine} ${match.stakesLine}`
        : match.statusCode === 'in_play'
          ? `${match.levelOnProfit ? 'As it stands this tie is level on profit.' : 'As it stands this tie is live.'} ${match.penaltyLine} ${match.stakesLine}`
          : match.statusCode === 'provisional'
            ? `${match.levelOnProfit ? 'As it stands this tie is level on profit and awaits penalties.' : (match.winner ? `As it stands, winner was ${match.winner}.` : 'As it stands, winner call pending.')} ${match.penaltyLine} ${match.stakesLine}`
            : `${match.levelOnProfit ? 'Confirmed result is level on profit and needs penalties.' : (match.winner ? `Confirmed winner was ${match.winner}.` : 'Confirmed result pending.')} ${match.penaltyLine} ${match.stakesLine}`;
      const tone: PlayoffRaceCardTone = match.statusCode === 'pending'
        ? 'flat'
        : match.statusCode === 'in_play'
          ? 'watch'
          : lowerWinning
            ? 'up'
            : upperWinning
              ? 'down'
              : 'flat';
      return {
        id: `playoff-race-${match.id}`,
        title: `${match.upperDivision} vs ${match.lowerDivision}`,
        teamId: upperTeamId ?? lowerTeamId,
        teamIds: [upperTeamId, lowerTeamId].filter((value): value is number => value !== null),
        teamName: `${match.upperTeam} vs ${match.lowerTeam}`,
        detail,
        tone,
      };
    }).slice(0, 4);
  }, [playoffBracketMatches, showPlayoffPanels, teamIdByTeamKey]);
  const upsetRadarItems = useMemo<UpsetRadarItem[]>(() => {
    const items: UpsetRadarItem[] = [];
    fixtureGroups.forEach((group) => {
      group.fixtures.forEach((fixture) => {
        if (!isFixtureStatusResolved(fixture.statusCode)) {
          return;
        }
        const winner = extractOutcomeWinner(fixture.outcome);
        if (!winner) {
          return;
        }
        const picks = parsePicksLabel(fixture.picks);
        const expectedPicks = [picks.jay, picks.computer].filter((value): value is string => Boolean(value));
        if (expectedPicks.length === 0) {
          return;
        }
        const winnerKey = normalizeTeamKey(winner);
        const expectedKeys = Array.from(new Set(expectedPicks.map((pick) => normalizeTeamKey(pick))));
        if (expectedKeys.includes(winnerKey)) {
          return;
        }
        items.push({
          id: `upset-${group.id}-${fixture.id}`,
          fixture: fixture.fixture,
          winner,
          expected: expectedPicks.join(' / '),
          level: expectedKeys.length <= 1 ? 'huge' : 'watch',
          statusCode: fixture.statusCode,
        });
      });
    });
    return items.slice(0, 4);
  }, [fixtureGroups]);
  const raceTensionMeters = useMemo<RaceTensionMeter[]>(() => {
    const contexts = Array.from(playoffContextByTeamId.values());
    if (contexts.length === 0) {
      return [];
    }
    const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));
    const promotionCandidates = contexts.filter((context) => typeof context.promotionGap === 'number');
    const promotionTightCount = promotionCandidates.filter((context) => (context.promotionGap ?? 99) <= 2).length;
    const promotionPressure = promotionCandidates.length > 0
      ? clamp((promotionTightCount / promotionCandidates.length) * 100)
      : 0;

    const safetyCandidates = contexts.filter((context) => typeof context.safetyGap === 'number');
    const safetyTightCount = safetyCandidates.filter((context) => (context.safetyGap ?? 99) <= 2).length;
    const relegationPressure = safetyCandidates.length > 0
      ? clamp((safetyTightCount / safetyCandidates.length) * 100)
      : 0;

    const titlePressureValues = tableDivisions.map((division) => {
      const leader = division.rows[0];
      const challenger = division.rows[1];
      if (!leader || !challenger) {
        return 0;
      }
      const gap = leader.points - challenger.points;
      if (gap <= 1) {
        return 92;
      }
      if (gap <= 2) {
        return 76;
      }
      if (gap <= 3) {
        return 58;
      }
      return 32;
    });
    const titlePressure = titlePressureValues.length > 0
      ? clamp(titlePressureValues.reduce((sum, value) => sum + value, 0) / titlePressureValues.length)
      : 0;

    return [
      { id: 'promotion', label: 'Promotion Race', value: promotionPressure },
      { id: 'relegation', label: 'Drop Fight', value: relegationPressure },
      { id: 'title', label: 'Title Heat', value: titlePressure },
    ];
  }, [playoffContextByTeamId, tableDivisions]);
  const trendCacheCards = useMemo<TrendCacheCard[]>(() => {
    const rows = teams
      .map((team) => ({
        team,
        cache: team.trendCache ?? null,
      }))
      .filter((entry): entry is { team: SkyStudioTeam; cache: NonNullable<SkyStudioTeam['trendCache']> } => entry.cache !== null)
      .sort((a, b) => (
        (Math.abs(b.cache.rankDelta) + Math.abs(b.cache.pointsDelta) + Math.abs(b.cache.profitDelta))
        - (Math.abs(a.cache.rankDelta) + Math.abs(a.cache.pointsDelta) + Math.abs(a.cache.profitDelta))
      ));
    return rows.slice(0, 4).map(({ team, cache }) => {
      const rankLine = cache.rankDelta > 0
        ? `Up ${cache.rankDelta} place${cache.rankDelta === 1 ? '' : 's'}`
        : cache.rankDelta < 0
          ? `Down ${Math.abs(cache.rankDelta)} place${Math.abs(cache.rankDelta) === 1 ? '' : 's'}`
          : 'No rank change';
      const pointsLine = cache.pointsDelta >= 0
        ? `+${cache.pointsDelta} pts`
        : `${cache.pointsDelta} pts`;
      const versusLine = cache.pointsDeltaVsPreviousWindow === null
        ? 'No prior-window comparison'
        : cache.pointsDeltaVsPreviousWindow >= 0
          ? `+${cache.pointsDeltaVsPreviousWindow} pts vs previous window`
          : `${cache.pointsDeltaVsPreviousWindow} pts vs previous window`;
      return {
        id: `trend-cache-${team.id}`,
        teamId: team.id,
        teamName: team.name,
        lineOne: `${rankLine} • ${pointsLine} • ${formatSigned(cache.profitDelta)} profit`,
        lineTwo: `${cache.fromGw} -> ${cache.toGw} • ${versusLine}`,
      };
    });
  }, [teams]);
  const producerCards = useMemo<ProducerCard[]>(() => {
    const cards: ProducerCard[] = [
      {
        id: 'live-desk',
        label: 'Live Desk',
        headline: `${fixtureSummary.resolvedCount}/${fixtureCount} fixtures updated`,
        detail: `${fixtureSummary.inPlayCount} in play • ${fixtureSummary.provisionalCount} provisional • ${fixtureSummary.confirmedCount} confirmed`,
        tone: 'live',
        alert: fixtureSummary.statusCue,
      },
      {
        id: 'spotlight-team',
        label: 'Spotlight Team',
        headline: highlightedTeamName ?? 'League Rotation',
        detail: spotlightSummary,
        tone: 'team',
      },
    ];

    cards.push({
      id: 'why-matters',
      label: 'Why It Matters',
      headline: fixtureSummary.statusCue === 'LIVE'
        ? `${fixtureSummary.inPlayCount + fixtureSummary.pendingCount} fixtures can still shift tables`
        : fixtureSummary.statusCue === 'PROVISIONAL'
          ? `${fixtureSummary.provisionalCount} results are in but still provisional`
          : 'Board confirmed and next gameweek pressure starts now',
      detail: `${dayPhaseLine} ${movements[0]?.headline ?? 'Watch title, survival, and cup pressure lines.'}`,
      tone: 'movement',
      alert: fixtureSummary.statusCue === 'LIVE' ? 'SWING POINT' : fixtureSummary.statusCue === 'PROVISIONAL' ? 'AS IT STANDS' : 'LOCKED IN',
    });

    if (upsetRadarItems.length > 0) {
      const leadUpset = upsetRadarItems[0];
      const upsetStatus = leadUpset?.statusCode ?? 'provisional';
      const upsetLeadLine = upsetStatus === 'final_confirmed'
        ? `${leadUpset?.winner ?? 'Result'} shocked the picks board`
        : `${leadUpset?.winner ?? 'Result'} is shocking the picks board as it stands`;
      cards.push({
        id: 'upset-radar',
        label: 'Upset Radar',
        headline: upsetLeadLine,
        detail: leadUpset?.fixture ?? 'Latest upset stories are active.',
        tone: 'results',
        alert: leadUpset?.level === 'huge' ? 'HUGE UPSET' : 'UPSET WATCH',
      });
    }

    if (fixtureSummary.nextFixture) {
      cards.push({
        id: 'next-fixture',
        label: fixtureSummary.statusCue === 'LIVE' ? 'Coming Up' : 'Live Queue',
        headline: fixtureSummary.nextFixture.fixture.fixture,
        detail: `${fixtureSummary.nextFixture.groupTitle} • ${fixtureStatusLabel(fixtureSummary.nextFixture.fixture.statusCode)}`,
        tone: 'fixtures',
        alert: fixtureSummary.statusCue,
      });
    }

    if (fixtureSummary.latestResult) {
      const winner = extractOutcomeWinner(fixtureSummary.latestResult.fixture.outcome);
      cards.push({
        id: 'latest-result',
        label: 'Latest Result',
        headline: winner
          ? fixtureSummary.latestResult.fixture.statusCode === 'final_confirmed'
            ? `Confirmed winner: ${winner}`
            : `As it stands: ${winner}`
          : fixtureSummary.latestResult.fixture.outcome,
        detail: fixtureSummary.latestResult.fixture.score,
        tone: 'results',
        alert: fixtureSummary.latestResult.fixture.statusCode === 'final_confirmed' ? 'CONFIRMED' : 'PROVISIONAL',
      });
    }

    if (fixtureSummary.cupPending > 0 || fixtureSummary.masterPending > 0) {
      cards.push({
        id: 'competition-watch',
        label: 'Competition Watch',
        headline: `${fixtureSummary.cupPending} Cup • ${fixtureSummary.masterPending} Master pending`,
        tone: 'competition',
      });
    }

    if (movements.length > 0) {
      const movement = movements[0];
      cards.push({
        id: `movement-${movement.id}`,
        label: 'Table Shift',
        headline: movement.headline,
        detail: movement.label,
        tone: 'movement',
      });
    }

    return cards.slice(0, 4);
  }, [
    dayPhaseLine,
    fixtureCount,
    fixtureSummary,
    highlightedTeamName,
    movements,
    upsetRadarItems,
    spotlightSummary,
  ]);
  const tableModeCards = useMemo(() => producerCards.slice(0, 2), [producerCards]);
  const effectiveLayoutMode: StudioLayoutMode = leanMode ? 'table' : layoutMode;
  const effectiveGraphicsMode: StudioGraphicsMode = leanMode ? 'clean' : graphicsMode;
  const kickoffGw8NoTables = !skySportsNewsMode && currentGw.trim().toUpperCase() === 'GW8';
  const allTimeTakeover = Boolean(allTimeIntermissionSlide);
  const ssnTakeover = skySportsNewsMode
    && Boolean(presentationActiveSlide?.id)
    && /ssn-(cup|champions|premier|master|all-time)/.test(presentationActiveSlide?.id ?? '');
  const fullScreenTakeover = allTimeTakeover || ssnTakeover;
  const ssnTeamSpotlightActive = /^team-/.test(presentationActiveSlide?.id ?? '');
  const ssnShowLiveScores = false;
  const ssnTableDivisionIdByBucket = useMemo(() => {
    const byBucket = new Map<SsnDivisionBucket, string>();
    SSN_DIVISION_BUCKET_ORDER.forEach((bucket) => {
      const preferredDivision = pickPreferredDivisionForBucket(tableDivisions, bucket);
      if (preferredDivision) {
        byBucket.set(bucket, preferredDivision.id);
      }
    });
    return byBucket;
  }, [tableDivisions]);
  const ssnDivisionActiveId = useMemo(() => {
    if (!skySportsNewsMode || !presentationActiveSlide?.id) {
      return undefined;
    }
    const match = presentationActiveSlide.id.match(/^ssn-division-(\d+)-(?:roundup|journey)-/);
    if (!match?.[1]) {
      return undefined;
    }
    const divisionIndex = Number(match[1]);
    if (!Number.isFinite(divisionIndex)) {
      return undefined;
    }
    const bucket = SSN_DIVISION_BUCKET_ORDER[divisionIndex];
    if (bucket) {
      const mapped = ssnTableDivisionIdByBucket.get(bucket);
      if (mapped) {
        return mapped;
      }
    }
    return tableDivisions[divisionIndex]?.id;
  }, [presentationActiveSlide?.id, skySportsNewsMode, ssnTableDivisionIdByBucket, tableDivisions]);
  const tableActiveDivisionId = skySportsNewsMode
    ? (ssnDivisionActiveId ?? activeDivisionId)
    : activeDivisionId;
  const tableCycleHandler = undefined;
  const ssnLiveScoresPanel = useMemo(() => {
    if (!ssnShowLiveScores) {
      return null;
    }
    const splitIndex = Math.ceil(ssnLeagueScoreRows.length / 2);
    const leftRows = ssnLeagueScoreRows.slice(0, splitIndex);
    const rightRows = ssnLeagueScoreRows.slice(splitIndex);
    return (
      <div className="studio-fixtures-slide studio-live-scores-slide">
        <div className="studio-fixtures-head">
          <span className="studio-kicker">Live League Scores</span>
          <h3>{currentGw} League Scores</h3>
          <p>Live and provisional scores across the divisions.</p>
        </div>
        {ssnLeagueScoreRows.length === 0 ? (
          <div className="studio-fixtures-list">
            <p className="studio-muted">No live league fixtures loaded.</p>
          </div>
        ) : (
          <div className="studio-fixtures-columns studio-scroll-panel">
            <div className="studio-fixtures-list">
              {leftRows.map((row) => (
                <article key={row.id} className="studio-fixture-row">
                  <div className="studio-fixture-main">
                    <strong>{row.fixture}</strong>
                    <span className="studio-comp-badge league">{row.groupTitle}</span>
                  </div>
                  <div className="studio-fixture-meta">
                    {renderScoreParts(row.score)}
                    <span className="studio-inline-result pending">{fixtureStatusLabel(row.statusCode)}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="studio-fixtures-list">
              {rightRows.map((row) => (
                <article key={row.id} className="studio-fixture-row">
                  <div className="studio-fixture-main">
                    <strong>{row.fixture}</strong>
                    <span className="studio-comp-badge league">{row.groupTitle}</span>
                  </div>
                  <div className="studio-fixture-meta">
                    {renderScoreParts(row.score)}
                    <span className="studio-inline-result pending">{fixtureStatusLabel(row.statusCode)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }, [currentGw, ssnLeagueScoreRows, ssnShowLiveScores]);
  const broadcastCards = useMemo(() => {
    if (leanMode) {
      return producerCards.slice(0, 1);
    }
    if (effectiveGraphicsMode === 'clean') {
      return producerCards.slice(0, 2);
    }
    if (effectiveGraphicsMode === 'classic') {
      return producerCards.slice(0, 3);
    }
    return producerCards;
  }, [effectiveGraphicsMode, leanMode, producerCards]);
  const tableRailCards = useMemo(
    () => (leanMode ? tableModeCards.slice(0, 1) : tableModeCards),
    [leanMode, tableModeCards],
  );
  const studioAlertItems = useMemo<LowerThirdAlertItem[]>(() => {
    const verifiedAlerts = verifiedFactRailItems.slice(0, 4).map((item) => ({
      id: `verified-${item.id}`,
      label: item.label,
      headline: item.headline,
      tone: item.tone,
    }));
    if (verifiedAlerts.length > 0) {
      return verifiedAlerts;
    }
    return producerCards.slice(0, 4).map((card) => ({
      id: `producer-${card.id}`,
      label: card.label,
      headline: card.headline,
      tone: card.tone,
    }));
  }, [producerCards, verifiedFactRailItems]);
  const storyRundownItems = useMemo<StoryRundownItem[]>(() => {
    if (teamRunQueue.length === 0 && rotationSupportSlides.length === 0 && pendingInterruptSlides.length === 0) {
      return [];
    }
    const items: StoryRundownItem[] = [];
    if (coldOpenPending) {
      items.push({
        id: `rundown-cold-open-${coldOpenSlide.id}`,
        phase: 'leagues',
        label: coldOpenSlide.label,
        tone: coldOpenSlide.tone ?? 'system',
      });
    } else if (activeInterruptSlide) {
      items.push({
        id: `rundown-interrupt-${activeInterruptSlide.id}`,
        phase: 'leagues',
        label: activeInterruptSlide.label,
        tone: activeInterruptSlide.tone ?? 'system',
      });
    }
    pendingInterruptSlides.slice(0, 2).forEach((slide, index) => {
      items.push({
        id: `rundown-pending-interrupt-${slide.id}-${index}`,
        phase: 'leagues',
        label: slide.label,
        tone: slide.tone ?? 'system',
      });
    });
    let simulatedState = rotationState;
    for (let index = 0; index < 6; index += 1) {
      if (items.length >= 4) {
        break;
      }
      simulatedState = nextRundownState(simulatedState, teamRunQueue, rotationSupportSlides);
      const slide = activeSlideFromState(simulatedState, teamRunQueue, rotationSupportSlides);
      if (!slide) {
        continue;
      }
      items.push({
        id: `${simulatedState.phase}-${slide.id}-${index}`,
        phase: simulatedState.phase,
        label: slide.label,
        tone: slide.tone,
      });
    }
    return items.slice(0, 4);
  }, [activeInterruptSlide, coldOpenPending, coldOpenSlide.id, coldOpenSlide.label, coldOpenSlide.tone, pendingInterruptSlides, rotationState, rotationSupportSlides, teamRunQueue]);
  const stingerStyle = useMemo<CSSProperties | undefined>(() => {
    if (!stinger) {
      return undefined;
    }
    const style: CSSProperties & Record<string, string> = {};
    if (stinger.ballColor) {
      style['--stinger-accent'] = stinger.ballColor;
    }
    if (stinger.ringColor) {
      style['--stinger-ring'] = stinger.ringColor;
    }
    if (stinger.textColor) {
      style['--stinger-text'] = stinger.textColor;
    }
    return style;
  }, [stinger]);

  return (
    <section
      ref={studioPanelRef}
      className={`studio-panel camera-${cameraMode} layout-${effectiveLayoutMode} graphics-${effectiveGraphicsMode}${leanMode ? ' mode-lean' : ''}`}
    >
      <header className="studio-header-bar">
        <div className="studio-header-copy">
          <span className="studio-breaking-label">Breaking News</span>
          <span className="studio-gw-pill">{currentGw} Update</span>
          <span className="studio-header-summary">
            {fixtureCount} fixtures • {fixtureSummary.inPlayCount} live • {fixtureSummary.provisionalCount} provisional • {fixtureSummary.confirmedCount} confirmed
          </span>
          <span className="studio-gw-pill">{dayPhaseLabel}</span>
          {highlightedTeamName && (
            <span className="studio-focus-pill">Spotlight: {highlightedTeamName}</span>
          )}
        </div>
        <div className="studio-header-status">
          <span className={`studio-live-pill state-${studioTruthCue.toLowerCase()}`}>
            <span className="studio-live-dot" aria-hidden="true" />
            {studioTruthCue}
          </span>
          <span className="studio-camera-pill">{cameraLabel}</span>
        </div>
      </header>

      <div className="studio-main-screen">
        <div
          className={`studio-main-grid${effectiveLayoutMode === 'table' ? ' table-first' : ''}${fullScreenTakeover ? ' alltime-takeover' : ''}${skySportsNewsMode ? ' ssn-mode' : ''}`}
        >
          {effectiveLayoutMode === 'table' ? (
            <>
              <div className={`studio-table-first-main${fullScreenTakeover ? ' alltime-takeover' : ''}`}>
                {fullScreenTakeover ? (
                  studioSlideDeck
                ) : ssnShowLiveScores ? (
                  ssnLiveScoresPanel
                ) : kickoffGw8NoTables ? (
                  studioSlideDeck
                ) : (
                  <StudioTableCarousel
                    divisions={tableDivisions}
                    masterRows={masterLeagueRows}
                    intervalMs={TABLE_CAROUSEL_INTERVAL_MS}
                    activeDivisionId={tableActiveDivisionId}
                    highlightedTeamId={tableHighlightedTeamId}
                    onCycleComplete={tableCycleHandler}
                    onActiveDivisionChange={setActiveTableDivision}
                    presentationMode={effectiveGraphicsMode === 'clean' ? 'clean' : effectiveGraphicsMode === 'classic' ? 'classic' : 'full'}
                    readabilityMode={tableReadabilityMode}
                  />
                )}
              </div>
              {!fullScreenTakeover && (
                skySportsNewsMode ? (
                  <aside className="studio-table-first-side ssn-table-first-side">
                    {verifiedFactRailItems.length > 0 && (
                      <VerifiedFactRail items={verifiedFactRailItems} />
                    )}
                    {studioSlideDeck}
                  </aside>
                ) : (
                  <aside className="studio-table-first-side">
                    {commentaryCard}
                    {verifiedFactRailItems.length > 0 && (
                      <VerifiedFactRail items={verifiedFactRailItems} />
                    )}
                    {(highlightedTeamId ? spotlightSideCards : tableRailCards).map((card) => (
                      <article key={`table-${card.id}`} className={`studio-producer-card tone-${card.tone}`}>
                        <div className="studio-producer-card-head">
                          <span className="studio-producer-label">{card.label}</span>
                          {card.alert && <span className="studio-producer-alert">{card.alert}</span>}
                        </div>
                        <strong>{card.headline}</strong>
                        {card.detail && <p>{card.detail}</p>}
                      </article>
                    ))}
                  </aside>
                )
              )}
              {!fullScreenTakeover && !skySportsNewsMode && !kickoffGw8NoTables && (
                <div className="studio-hidden-slide-deck" aria-hidden="true">
                  {studioSlideDeck}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="studio-slide-rail">
                {studioSlideDeck}
              </div>
              <aside className={`studio-side-rail${kickoffGw8NoTables ? ' no-table' : ''}`}>
                {!kickoffGw8NoTables && (
                  <div className="studio-table-rail">
                    {ssnShowLiveScores ? (
                      ssnLiveScoresPanel
                    ) : (
                      <StudioTableCarousel
                        divisions={tableDivisions}
                        masterRows={masterLeagueRows}
                        intervalMs={TABLE_CAROUSEL_INTERVAL_MS}
                        activeDivisionId={tableActiveDivisionId}
                        highlightedTeamId={tableHighlightedTeamId}
                        onCycleComplete={tableCycleHandler}
                        onActiveDivisionChange={setActiveTableDivision}
                        presentationMode={effectiveGraphicsMode === 'clean' ? 'clean' : effectiveGraphicsMode === 'classic' ? 'classic' : 'full'}
                        readabilityMode={tableReadabilityMode}
                      />
                    )}
                  </div>
                )}
                <div className="studio-producer-stack" aria-label="Producer insights">
                  {commentaryCard}
                  {verifiedFactRailItems.length > 0 && (
                    <VerifiedFactRail items={verifiedFactRailItems} />
                  )}
                  {broadcastCards.map((card) => (
                    <article key={card.id} className={`studio-producer-card tone-${card.tone}`}>
                      <div className="studio-producer-card-head">
                        <span className="studio-producer-label">{card.label}</span>
                        {card.alert && <span className="studio-producer-alert">{card.alert}</span>}
                      </div>
                      <strong>{card.headline}</strong>
                      {card.detail && <p>{card.detail}</p>}
                    </article>
                  ))}
                </div>
              </aside>
            </>
          )}
        </div>
      </div>

      {!skySportsNewsMode && (
        <div className="studio-lower-third" aria-live="polite">
          <div className="studio-lower-third-copy">
            <span className="studio-lower-third-tag">Studio Desk</span>
            <strong>{activeSlide?.label ?? 'Studio Update'}</strong>
            <p>{truncateLine(lowerThirdLine, 190)}</p>
          </div>
          <div className="studio-lower-third-meta">
            <span>{highlightedTeamName ? `Spotlight: ${highlightedTeamName}` : 'General League Desk'}</span>
            <span>{cameraLabel}</span>
          </div>
        </div>
      )}

      {skySportsNewsMode && studioAlertItems.length > 0 && (
        <LowerThirdAlertRail items={studioAlertItems} label="SSN Alerts" />
      )}

      {!skySportsNewsMode && (
      <div className="studio-data-stack">
      {!leanMode && (
      <div className="studio-scene-strip" aria-live="polite">
        <article className="studio-scene-chip now">
          <span>Now</span>
          <strong>{activeSlide?.label ?? 'Studio Update'}</strong>
        </article>
        <article className="studio-scene-chip">
          <span>Spotlight</span>
          <strong>{highlightedTeamName ?? 'League rotation desk'}</strong>
        </article>
        <article className="studio-scene-chip">
          <span>Next Fixture</span>
          <strong>{nextFixtureHeadline}</strong>
        </article>
        <article className="studio-scene-chip">
          <span>Latest Result</span>
          <strong>{latestResultHeadline}</strong>
        </article>
        <article className="studio-scene-chip">
          <span>Board State</span>
          <strong>{studioTruthCue} • {dayPhaseLabel} • {bagIndicatorLabel} {bagCycleLabel}</strong>
        </article>
      </div>
      )}

      {!leanMode && showPlayoffPanels && playoffRaceCards.length > 0 && (
        <div className="studio-playoff-board" aria-label="Playoff race board">
          <div className="studio-playoff-board-head">
            <span>Playoff Race Board</span>
            <strong>{playoffPhaseLabel}</strong>
          </div>
          <p className="studio-playoff-board-note">If profit is level, it goes to penalties for Jay to take.</p>
          <div className="studio-playoff-board-grid">
            {playoffRaceCards.map((card) => (
              <article
                key={card.id}
                className={`studio-playoff-card tone-${card.tone}${boardHighlightedTeamId !== null && card.teamIds.includes(boardHighlightedTeamId) ? ' active' : ''}`}
              >
                <span>{card.title}</span>
                <strong>{card.teamName}</strong>
                <p>{truncateLine(card.detail, 120)}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {!leanMode && showPlayoffPanels && playoffBracketMatches.length > 0 && (
        <div className="studio-bracket-board" aria-label="Playoff bracket">
          <div className="studio-playoff-board-head">
            <span>Playoff Bracket</span>
            <strong>{currentGw} tie paths</strong>
          </div>
          <p className="studio-playoff-board-note">Level on profit means the tie goes to penalties for Jay to take.</p>
          <div className="studio-bracket-grid">
            {playoffBracketMatches.map((match) => (
              <article key={match.id} className={`studio-bracket-card${isPlayoffBracketMatchHighlighted(match) ? ' active' : ''}`}>
                <span>{match.upperDivision} vs {match.lowerDivision}</span>
                <strong>{match.fixture}</strong>
                <p>{match.competition} • {match.statusLabel}</p>
                <p>
                  {match.statusCode === 'pending'
                    ? 'Kick-off pending.'
                    : match.statusCode === 'in_play'
                      ? (match.levelOnProfit ? 'As it stands, this tie is level on profit.' : (match.winner ? `As it stands, ${match.winner} lead this tie.` : 'As it stands, this tie is still in play.'))
                      : match.statusCode === 'provisional'
                        ? (match.levelOnProfit ? 'As it stands, this tie is level on profit and awaits penalties.' : (match.winner ? `As it stands, winner was ${match.winner}.` : 'As it stands, winner call pending.'))
                        : (match.levelOnProfit ? 'Confirmed result is level on profit and needs penalties.' : (match.winner ? `Confirmed winner: ${match.winner}.` : 'Confirmed winner call pending.'))}
                </p>
                <p>{truncateLine(match.penaltyLine, 120)}</p>
                <p>{truncateLine(match.stakesLine, 120)}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {!leanMode && trendCacheCards.length > 0 && (
        <div className="studio-trend-cache-strip" aria-label="Multi-gameweek trend cache">
          <span className="studio-rundown-title">Multi-GW Trend Cache</span>
          <div className="studio-trend-cache-items">
            {trendCacheCards.map((card) => (
              <article
                key={card.id}
                className={`studio-trend-cache-item${boardHighlightedTeamId === card.teamId ? ' active' : ''}`}
              >
                <strong>{card.teamName}</strong>
                <p>{card.lineOne}</p>
                <span>{card.lineTwo}</span>
              </article>
            ))}
          </div>
        </div>
      )}

      {!leanMode && raceTensionMeters.length > 0 && (
        <div className="studio-race-tension-strip" aria-label="Race tension meter">
          {raceTensionMeters.map((meter) => (
            <article key={meter.id} className="studio-race-meter-card">
              <span>{meter.label}</span>
              <div className="studio-race-meter-track" aria-hidden="true">
                <span className="studio-race-meter-fill" style={{ width: `${meter.value}%` }} />
              </div>
              <strong>{meter.value}%</strong>
            </article>
          ))}
        </div>
      )}

      {!leanMode && upsetRadarItems.length > 0 && (
        <div className="studio-upset-radar-strip" aria-label="Upset radar">
          <span className="studio-rundown-title">Upset Radar</span>
          <div className="studio-upset-radar-items">
            {upsetRadarItems.map((item) => (
              <article key={item.id} className={`studio-upset-radar-item level-${item.level}`}>
                <span>{item.level === 'huge' ? 'Huge Upset' : 'Upset Watch'}</span>
                <strong>{item.fixture}</strong>
                <p>
                  {item.statusCode === 'final_confirmed'
                    ? `Confirmed winner was ${item.winner}. Picks leaned to ${item.expected}.`
                    : `As it stands, winner was ${item.winner}. Picks leaned to ${item.expected}.`}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {!leanMode && isStorySlideActive && storyProgressLabels.length > 0 && (
        <div className="studio-story-progress-strip" aria-label="Team story progress">
          {storyProgressLabels.map((label, index) => (
            <span
              key={`story-progress-${label}-${index}`}
              className={`studio-story-progress-step${index < storyProgressIndex ? ' done' : ''}${index === storyProgressIndex ? ' active' : ''}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="studio-rundown-strip" aria-label="Producer rundown">
        <span className="studio-rundown-title">Up Next</span>
        <div className="studio-rundown-items">
          {storyRundownItems.length > 0 ? (
            storyRundownItems.map((item) => (
              <article key={item.id} className={`studio-rundown-item phase-${item.phase} tone-${item.tone ?? 'system'}`}>
                <span>{item.phase === 'teams' ? 'Team' : 'Desk'}</span>
                <strong>{item.label}</strong>
              </article>
            ))
          ) : (
            <span className="studio-rundown-empty">Rundown queue is preparing.</span>
          )}
        </div>
      </div>
      </div>
      )}

      <TickerBar items={tickerItems} />
      {/* Stinger overlay for segment transitions and team spotlights */}
      {stinger && (
        <div className={`stinger-overlay${stinger.variant ? ` variant-${stinger.variant}` : ''}`} style={stingerStyle}>
          <div className="stinger-content">
            <h2 className="stinger-title">{stinger.label}</h2>
            {stinger.teamName && (
              <h3 className="stinger-team">{stinger.teamName}</h3>
            )}
            <p className="stinger-subline">{stinger.subline}</p>
            {stinger.detailLine && (
              <p className="stinger-detail">{stinger.detailLine}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
