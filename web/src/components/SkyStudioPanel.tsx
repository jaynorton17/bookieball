import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type FixtureSlideGroup } from './FixturesSlides';
import { LeagueMovementSlides, type LeagueMovementData } from './LeagueMovementSlides';
import { RivalrySlides, type RivalrySlideData } from './RivalrySlides';
import { SlideDeck, type StudioSlide } from './SlideDeck';
import { StudioTableCarousel, type StudioTableDivision } from './StudioTableCarousel';
import { TeamBadge } from './TeamBadge';
import {
  TeamSpotlightSlides,
  type TeamPlayoffContext,
  type TeamPlayoffOutlook,
  type TeamSpotlightData,
} from './TeamSpotlightSlides';
import { TickerBar } from './TickerBar';
import { extractStoryArcLabels, splitSentences } from '../lib/studioNarration';
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
} from '../lib/statusCodes';

export type SkyStudioTeam = TeamSpotlightData;
export type SkyStudioFixtureGroup = FixtureSlideGroup;
export type SkyStudioCupFixture = {
  id: number;
  gw: string;
  roundName: string;
  homeTeam: string | null;
  awayTeam: string | null;
  winnerTeam: string | null;
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
};
type AllTimeLeagueMode = 'points' | 'profit' | 'spins';
type AllTimeLeagueRow = {
  teamId: number;
  teamName: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
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

const CARD_DURATION_MS = 12000;
const DEFAULT_SLIDE_DURATION_MS = CARD_DURATION_MS;
const TABLE_CAROUSEL_INTERVAL_MS = 10000;
const TEAM_SPOTLIGHT_SLIDE_LIMIT = 3;
const TEAM_SPOTLIGHT_SLIDE_DURATION_MS = 10000;
const TEAM_REPEAT_HARD_LOCK_COUNT = 3;
const ALL_TIME_SEGMENT_TEAM_BATCH = 5;
const ALL_TIME_SEGMENT_DURATION_MS = 120000;
const ALL_TIME_SEGMENT_ORDER: AllTimeLeagueMode[] = ['spins', 'points', 'profit'];
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
  "Sydney: If this is a table round, you’re thinking about points, goal difference, the run-in.",
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
type SupportSlideBucket = 'fixtures' | 'results' | 'cup' | 'master' | 'league';

type SkyStudioPanelProps = {
  currentGw: string;
  currentSeason?: string;
  gwLocked?: boolean;
  fixtureCount: number;
  resolvedCount: number;
  teams: SkyStudioTeam[];
  tableDivisions: SkyStudioTableDivision[];
  masterLeagueRows: SkyStudioTableDivision['rows'];
  fixtureGroups: SkyStudioFixtureGroup[];
  cupFixtures?: SkyStudioCupFixture[];
  allTimeLeagues?: AllTimeLeaguesPayload | null;
  rivalries: SkyStudioRivalry[];
  movements: SkyStudioMovement[];
  tickerItems: string[];
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
  upperDivision: string;
  lowerDivision: string;
  upperTeam: string;
  lowerTeam: string;
  winner: string | null;
  statusCode: FixtureSlideStatusCode;
  statusLabel: string;
  stakesLine: string;
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

const STORY_PROGRESS_STAGES = ['Intro', 'League', 'Cup', 'Verdict', 'Next'];
const PLAYOFF_DIVISION_ORDER = ['Champions Bookies', 'Premier Bookies', 'Average Bookies', 'Struggling Bookies', 'Awful Bookies'];

function parseGwNumber(value: string): number {
  const match = value.match(/(\d+)/);
  if (!match) {
    return 0;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
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

function truncateLine(value: string, maxLength = 140): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeVoiceText(value: string): string {
  const expandSeasonCode = (text: string): string =>
    text.replace(/\bS\s*(\d+)\b/gi, (_match, num) => {
      const valueNum = Number(num);
      if (!Number.isFinite(valueNum)) {
        return `season ${num}`;
      }
      return `${ordinalWord(valueNum)} season`;
    });
  return expandSeasonCode(value)
    .replace(/\bGW\s*(\d+)\b/gi, 'game week $1')
    .replace(/pts(\d+)/gi, 'points $1')
    .replace(/(\d+)\s*pts\b/gi, '$1 points')
    .replace(/\bpts\b/gi, 'points')
    .replace(/\bpft\b/gi, 'profit')
    .replace(/\b(?:\+|-)0\.00\b/gi, 'zero')
    .replace(/\b0\.00\b/gi, 'zero')
    .replace(/(\d+)\s*W\b/gi, '$1 wins')
    .replace(/(\d+)\s*D\b/gi, '$1 draws')
    .replace(/(\d+)\s*L\b/gi, '$1 losses')
    .replace(/\bW\b/g, 'win')
    .replace(/\bD\b/g, 'draw')
    .replace(/\bL\b/g, 'loss');
}

function normalizeTeamKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
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
      ? ['fixtures', 'results', 'cup', 'master', 'league']
      : mode === 'team-focus'
        ? ['league', 'fixtures', 'results', 'cup', 'master']
        : ['fixtures', 'results', 'cup', 'master', 'league'];

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
  fixtureGroups,
  cupFixtures = [],
  allTimeLeagues = null,
  rivalries,
  movements,
  tickerItems,
  broadcastPackages = [],
  spotlightPulse = null,
  scoreUpdateAlert = null,
  focusTeamId = null,
  skySportsNews = false,
  dayPhaseLabel = 'Live Phase',
  dayPhaseLine = 'Live desk coverage is active.',
  truthLabel = 'LIVE',
  presentationMode = 'full',
}: SkyStudioPanelProps) {
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [layoutMode, setLayoutMode] = useState<StudioLayoutMode>('broadcast');
  const [graphicsMode, setGraphicsMode] = useState<StudioGraphicsMode>('sky');
  const [directorMode, setDirectorMode] = useState<StudioDirectorMode>('auto');
  const [tableReadabilityMode, setTableReadabilityMode] = useState<StudioTableReadabilityMode>('comfortable');
  const [tableFocusMode, setTableFocusMode] = useState<StudioTableFocusMode>('auto');
  const [pinnedStoryOne, setPinnedStoryOne] = useState('');
  const [pinnedStoryTwo, setPinnedStoryTwo] = useState('');
  const [allTimeIntermission, setAllTimeIntermission] = useState<{ mode: AllTimeLeagueMode; sequence: number } | null>(null);
  const [ssnTableCycleComplete, setSsnTableCycleComplete] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'auto' | 'default'>('auto');
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceUnlocked, setVoiceUnlocked] = useState(false);
  const [voiceRoster, setVoiceRoster] = useState<{ jess: SpeechSynthesisVoice | null; sydney: SpeechSynthesisVoice | null }>({
    jess: null,
    sydney: null,
  });
  const [rotationState, setRotationState] = useState<StudioRotationState>({
    phase: 'teams',
    teamRunIndex: 0,
    teamSlideIndex: 0,
    leagueSlideIndex: 0,
  });
  const [coldOpenPending, setColdOpenPending] = useState(true);
  const [pendingInterruptSlides, setPendingInterruptSlides] = useState<StudioSlide[]>([]);
  const [activeInterruptSlide, setActiveInterruptSlide] = useState<StudioSlide | null>(null);
  const previousRotationRef = useRef<StudioRotationState | null>(null);
  const previousBagTailTeamIdsRef = useRef<number[]>([]);
  const previousResolvedCountRef = useRef(resolvedCount);
  const previousCycleRef = useRef(0);
  const voiceKeyRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const spotlightPulseIdRef = useRef<number | null>(null);
  const allTimeSpotlightCounterRef = useRef(0);
  const allTimeModeIndexRef = useRef(0);
  const allTimeSegmentSequenceRef = useRef(0);
  const ssnPostTableQueuedRef = useRef(false);
  const scoreUpdateQueuedRef = useRef<number | null>(null);
  const allTimeRotationRef = useRef<{
    phase: StudioPhase;
    teamSlideIndex: number;
    teamSlideCount: number;
  } | null>(null);
  const studioPanelRef = useRef<HTMLElement | null>(null);
  const [lastSpotlightDivisionId, setLastSpotlightDivisionId] = useState<string | undefined>(undefined);
  const [lastSpotlightTeamId, setLastSpotlightTeamId] = useState<number | null>(null);
  const [teamShuffleCycle, setTeamShuffleCycle] = useState(0);
  const leanMode = presentationMode === 'lean';
  const focusLock = Boolean(focusTeamId);
  const skySportsNewsMode = Boolean(skySportsNews);
  const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
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
  const handleSsnTableCycleComplete = useCallback(() => {
    if (!skySportsNewsMode) {
      return;
    }
    setSsnTableCycleComplete((prev) => (prev ? prev : true));
  }, [skySportsNewsMode]);

  useEffect(() => {
    if (!voiceSupported) {
      return;
    }
    const pickVoiceByKeywords = (voices: SpeechSynthesisVoice[], keywords: string[]): SpeechSynthesisVoice | null => {
      const lowered = keywords.map((keyword) => keyword.toLowerCase());
      return voices.find((voice) => lowered.some((keyword) => (
        voice.name.toLowerCase().includes(keyword)
        || voice.voiceURI.toLowerCase().includes(keyword)
      ))) ?? null;
    };
    const selectVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        return;
      }
      const english = voices.filter((voice) => /^en[-_]/i.test(voice.lang));
      const female = pickVoiceByKeywords(english, ['female', 'woman', 'girl']);
      const male = pickVoiceByKeywords(english, ['male', 'man', 'boy']);
      const fallbackPrimary = english[0] ?? voices[0] ?? null;
      const sydneyVoice = male ?? fallbackPrimary;
      const jessVoice = female ?? english.find((voice) => voice.name !== sydneyVoice?.name) ?? voices.find((voice) => voice.name !== sydneyVoice?.name) ?? sydneyVoice;
      setVoiceRoster({ jess: jessVoice, sydney: sydneyVoice });
    };
    selectVoices();
    window.speechSynthesis.onvoiceschanged = selectVoices;
    return () => {
      if (window.speechSynthesis.onvoiceschanged === selectVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [voiceMode, voiceSupported]);

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
    const storedPinnedStoryOne = safeLocalStorageRead('bookieball_producer_pin_one');
    const storedPinnedStoryTwo = safeLocalStorageRead('bookieball_producer_pin_two');
    if (storedPinnedStoryOne) {
      setPinnedStoryOne(storedPinnedStoryOne);
    }
    if (storedPinnedStoryTwo) {
      setPinnedStoryTwo(storedPinnedStoryTwo);
    }
    const storedVoiceEnabled = safeLocalStorageRead('bookieball_voice_enabled');
    if (storedVoiceEnabled === '1') {
      setVoiceEnabled(true);
    }
    const storedVoiceMode = safeLocalStorageRead('bookieball_voice_mode');
    if (storedVoiceMode === 'default' || storedVoiceMode === 'auto') {
      setVoiceMode(storedVoiceMode);
    }
  }, []);

  useEffect(() => {
    safeLocalStorageWrite('bookieball_auto_scroll_enabled', autoScrollEnabled ? '1' : '0');
  }, [autoScrollEnabled]);

  useEffect(() => {
    safeLocalStorageWrite('bookieball_voice_mode', voiceMode);
  }, [voiceMode]);

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
    safeLocalStorageWrite('bookieball_voice_enabled', voiceEnabled ? '1' : '0');
  }, [voiceEnabled]);

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
  const isGw8PlayoffWindow = gwNumber === 8;

  const playoffTieBlueprint = useMemo<PlayoffTieBlueprint[]>(() => {
    if (!isGw8PlayoffWindow) {
      return [];
    }
    const divisionById = new Map(tableDivisions.map((division) => [division.id, division]));
    const ties: PlayoffTieBlueprint[] = [];
    for (let index = 0; index < PLAYOFF_DIVISION_ORDER.length - 1; index += 1) {
      const upperDivisionId = PLAYOFF_DIVISION_ORDER[index];
      const lowerDivisionId = PLAYOFF_DIVISION_ORDER[index + 1];
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
  }, [isGw8PlayoffWindow, tableDivisions]);

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
      const statusLine = statusCode === 'pending'
        ? 'Kick-off pending.'
        : statusCode === 'in_play'
          ? `As it stands, ${winner ? `${winner} lead this tie.` : 'this tie is level and still in play.'}`
          : statusCode === 'provisional'
            ? `As it stands, ${winner ? `winner was ${winner}.` : 'winner call is pending.'} This remains provisional until rollover.`
            : `${winner ? `Confirmed winner was ${winner}.` : 'Confirmed result is pending final publication.'}`;
      const stakesLine = `If ${tie.upperTeamName} win, they keep their place in ${tie.upperDivisionTitle}. If ${tie.lowerTeamName} win, they take that place.`;
      const fixtureLabel = fixture?.fixture ?? `${tie.upperTeamName} vs ${tie.lowerTeamName}`;
      matches.push({
        id: `playoff-bracket-${tie.id}`,
        competition: fixtureMatch?.groupTitle ?? 'Playoff',
        fixture: fixtureLabel,
        upperDivision: tie.upperDivisionTitle,
        lowerDivision: tie.lowerDivisionTitle,
        upperTeam: tie.upperTeamName,
        lowerTeam: tie.lowerTeamName,
        winner,
        statusCode,
        statusLabel: fixtureStatusLabel(statusCode),
        stakesLine,
        source: fixture ? 'fixture' : 'expected',
      });
      const line = `${fixtureLabel}. ${statusLine} ${stakesLine}`;
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
    const topDivisionId = PLAYOFF_DIVISION_ORDER[0] ?? null;
    const bottomDivisionId = PLAYOFF_DIVISION_ORDER[PLAYOFF_DIVISION_ORDER.length - 1] ?? null;
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
    playoffTieBlueprint,
    tableDivisions,
    teamById,
    teams,
    truthLabel,
  ]);

  const spotlightTeams = useMemo<SkyStudioTeam[]>(
    () => teams.map((team) => ({
      ...team,
      playoffContext: playoffContextByTeamId.get(team.id) ?? null,
    })),
    [playoffContextByTeamId, teams],
  );

  const teamSlides = useMemo(() => TeamSpotlightSlides(spotlightTeams), [spotlightTeams]);

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
              row.rank === 1
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

    const slides: StudioSlide[] = [];

    slides.push({
      id: 'league-facts-leaders',
      label: `Division Leaders • ${currentGw}`,
      durationMs: CARD_DURATION_MS,
      narration: `Division leader check. ${divisionLeaders.slice(0, 3).map((leader) => `${leader.divisionTitle} led by ${leader.teamName}`).join('. ')}${divisionLeaders.length > 3 ? '. Additional divisions are on screen' : ''}.`,
      tone: 'movement',
      content: (
        <div className="studio-movement-slide">
          <span className="studio-kicker">League Overview</span>
          <h3>Division Leaders</h3>
          <p>Who is setting the pace in each division right now.</p>
          <div className="studio-rivalry-grid">
            {divisionLeaders.map((leader) => (
              <article key={`leader-${leader.divisionTitle}`} className="studio-rivalry-card">
                <span>{leader.divisionTitle}</span>
                <strong>{leader.teamName}</strong>
                <strong>{leader.points} pts</strong>
                <span>{formatSigned(leader.profit)} profit</span>
              </article>
            ))}
          </div>
        </div>
      ),
    });

    if (pressureZones.length > 0) {
      slides.push({
        id: 'league-facts-pressure',
        label: 'Pressure Zones',
        durationMs: CARD_DURATION_MS,
        narration: `Pressure zone update. ${pressureZones.map((pressure) => `${pressure.relegationTeam} are chasing ${pressure.safetyTeam}`).join('. ')}.`,
        tone: 'movement',
        content: (
          <div className="studio-movement-slide">
            <span className="studio-kicker">League Overview</span>
            <h3>Pressure Zones</h3>
            <p>Relegation-line pressure by division.</p>
            <div className="studio-rivalry-grid">
              {pressureZones.map((pressure) => (
                <article key={`pressure-${pressure.divisionTitle}`} className="studio-rivalry-card">
                  <span>{pressure.divisionTitle}</span>
                  <strong>{pressure.relegationTeam}</strong>
                  <span>Chasing {pressure.safetyTeam}</span>
                  <strong>{pressure.gap} pts</strong>
                </article>
              ))}
            </div>
          </div>
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
            <p>Every team check-in with points, profit, and current race context.</p>
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
  }, [currentGw, fixtureCount, fixtureGroups, resolvedCount, tableDivisions]);

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
                      <span className="studio-inline-result pending">{fixture.winnerTeam ? 'Winner' : 'Pending'}</span>
                    </div>
                    <div className="studio-result-meta">
                      <span>{fixture.winnerTeam ? `Winner: ${fixture.winnerTeam}` : 'Awaiting result'}</span>
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
                      <span>{fixture.winnerTeam ? `Winner: ${fixture.winnerTeam}` : 'Pairing pending'}</span>
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
        durationMs: index === 0 ? 20000 : CARD_DURATION_MS,
        narration,
        tone: pkg.tone ?? 'movement',
        content: (
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
                        <th>Pts</th>
                        <th>Profit</th>
                        <th>Spins</th>
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
                          <td>{formatWhole(row.points)}</td>
                          <td>{formatSigned(row.profit)}</td>
                          <td>{formatWhole(row.spins)}</td>
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

  const supportSlides = useMemo<StudioSlide[]>(
    () => {
      const ordered = orderSupportSlides(
        [
          ...broadcastPackageSlides,
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
      changeBriefSlides,
      cupBracketSlides,
      directorMode,
      fixtureStorySlides,
      leagueFactSlides,
      momentumHeatSlides,
      movements,
      predictionDeltaSlides,
      pinnedStoryOne,
      pinnedStoryTwo,
      rivalries,
      shockOfGwSlides,
      teamOfDaySlides,
      whyMattersSlides,
    ],
  );
  const allTimeIntermissionSlide = useMemo(
    () => (allTimeIntermission ? buildAllTimeSegmentSlide(allTimeIntermission.mode, allTimeIntermission.sequence) : null),
    [allTimeIntermission, buildAllTimeSegmentSlide],
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
  const ssnCupFixtures = useMemo(() => {
    const current = cupFixtures.filter((fixture) => fixture.gw === currentGw && (fixture.homeTeam || fixture.awayTeam));
    if (current.length > 0) {
      return current;
    }
    return cupFixtures.filter((fixture) => fixture.homeTeam || fixture.awayTeam);
  }, [cupFixtures, currentGw]);
  const ssnCupGroup = useMemo(
    () => fixtureGroups.find((group) => group.id === `cup-${currentGw}`)
      ?? fixtureGroups.find((group) => /cup/i.test(group.title)),
    [currentGw, fixtureGroups],
  );
  const ssnCupRoundLabel = ssnCupFixtures[0]?.roundName ?? 'Cup Round';
  const ssnCupGwLabel = ssnCupFixtures[0]?.gw
    ? formatGameWeekLabel(ssnCupFixtures[0].gw)
    : formatGameWeekLabel(currentGw);
  const ssnIsWeekOne = currentGw.trim().toUpperCase() === 'GW1';
  const ssnWelcomeSlide = useMemo<StudioSlide>(() => ({
    id: `ssn-welcome-${currentGw}`,
    label: 'Sky Sports News • Welcome',
    durationMs: 16000,
    narration: 'Welcome to Bookieball on Sky Sports News, we will be catching up on all the division and cup action today as well as taking a look at who is making waves in those all time leagues.',
    tone: 'system',
    content: (
      <div className="studio-movement-slide">
        <span className="studio-kicker">Sky Sports News</span>
        <h3>Welcome to Bookieball</h3>
        <p>Division and cup action, plus the all-time league movers, all on deck.</p>
      </div>
    ),
  }), [currentGw]);
  const ssnCupSlide = useMemo<StudioSlide | null>(() => {
    if (!skySportsNewsMode || ssnCupFixtures.length === 0) {
      return null;
    }
    const screenLine = ssnIsWeekOne
      ? 'Confirmed fixtures for tomorrow.'
      : `On your screen we have ${ssnCupGwLabel} ${ssnCupRoundLabel}.`;
    const ssnCupRows = ssnCupGroup?.fixtures?.map((fixture) => ({
      id: fixture.id,
      fixture: fixture.fixture,
      score: fixture.score,
      hasBye: /bye/i.test(fixture.fixture),
    })) ?? ssnCupFixtures.map((fixture) => {
      const home = fixture.homeTeam ?? 'BYE';
      const away = fixture.awayTeam ?? 'BYE';
      return {
        id: `cup-${fixture.id}`,
        fixture: `${home} vs ${away}`,
        score: '',
        hasBye: home === 'BYE' || away === 'BYE',
      };
    });
    return {
      id: `ssn-cup-${currentGw}`,
      label: `Cup Board • ${currentGw}`,
      durationMs: 20000,
      narration: screenLine,
      tone: 'fixtures',
      content: (
        <div className="studio-fixtures-slide">
          <div className="studio-fixtures-head">
            <span className="studio-kicker">Bookie Cup</span>
            <h3>{ssnCupGwLabel} • {ssnCupRoundLabel}</h3>
            <p>{screenLine}</p>
          </div>
          <div className="studio-fixtures-list studio-scroll-panel">
            {ssnCupRows.map((fixture) => {
              return (
                <article key={`ssn-cup-${fixture.id}`} className="studio-fixture-row">
                  <div className="studio-fixture-main">
                    <strong>{fixture.fixture}</strong>
                    {fixture.hasBye && <span className="studio-pill-rivalry">BYE</span>}
                  </div>
                  {!ssnIsWeekOne && fixture.score && (
                    <div className="studio-fixture-meta">
                      {renderScoreParts(fixture.score)}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ),
    };
  }, [currentGw, skySportsNewsMode, ssnCupFixtures, ssnCupGroup, ssnCupGwLabel, ssnCupRoundLabel, ssnIsWeekOne]);
  const ssnAllTimeSlides = useMemo<StudioSlide[]>(() => {
    if (!skySportsNewsMode || allTimeSegmentModes.length === 0) {
      return [];
    }
    return allTimeSegmentModes
      .map((mode, index) => {
        const slide = buildAllTimeSegmentSlide(mode, index + 1);
        if (!slide) {
          return null;
        }
        return {
          ...slide,
          id: `ssn-${slide.id}`,
        };
      })
      .filter((slide): slide is StudioSlide => slide !== null);
  }, [allTimeSegmentModes, buildAllTimeSegmentSlide, skySportsNewsMode]);
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
      const boundedSlides = selectTeamSpotlightSlides(slidesForTeam, {
        limit: TEAM_SPOTLIGHT_SLIDE_LIMIT,
      });
      map.set(
        teamId,
        boundedSlides.map((slide) => ({ ...slide, durationMs: TEAM_SPOTLIGHT_SLIDE_DURATION_MS })),
      );
    });
    return map;
  }, [teamSlides]);

  const teamDivisionTitles = useMemo(() => new Set(teams.map((team) => team.league)), [teams]);
  const primaryDivisions = useMemo(
    () => tableDivisions.filter((division) => teamDivisionTitles.has(division.title)),
    [tableDivisions, teamDivisionTitles],
  );

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
  }, [currentGw, fixtureOrderedTeamRunQueue, focusTeamId, teamShuffleCycle]);

  useEffect(() => {
    setTeamShuffleCycle(0);
    previousBagTailTeamIdsRef.current = [];
    previousRotationRef.current = null;
    previousCycleRef.current = 0;
    previousResolvedCountRef.current = resolvedCount;
    allTimeSpotlightCounterRef.current = 0;
    allTimeModeIndexRef.current = 0;
    allTimeSegmentSequenceRef.current = 0;
    ssnPostTableQueuedRef.current = false;
    scoreUpdateQueuedRef.current = null;
    allTimeRotationRef.current = null;
    setAllTimeIntermission(null);
    setSsnTableCycleComplete(false);
    setColdOpenPending(!focusLock);
    setPendingInterruptSlides([]);
    setActiveInterruptSlide(null);
  }, [currentGw, focusLock, focusTeamId, teamRunSourceKey]);

  useEffect(() => {
    if (!skySportsNewsMode || !ssnTableCycleComplete) {
      return;
    }
    if (ssnPostTableQueuedRef.current) {
      return;
    }
    const postTableSlides = [ssnCupSlide, ...ssnAllTimeSlides].filter(
      (slide): slide is StudioSlide => Boolean(slide),
    );
    if (postTableSlides.length === 0) {
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
  }, [skySportsNewsMode, ssnAllTimeSlides, ssnCupSlide, ssnTableCycleComplete]);

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

  const activeTeamRun = teamRunQueue.length > 0
    ? teamRunQueue[rotationState.teamRunIndex % teamRunQueue.length]
    : null;
  const activeTeamSlides = activeTeamRun?.slides ?? [];

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

  const activeTeamSlide = activeTeamSlides.length > 0
    ? activeTeamSlides[rotationState.teamSlideIndex % activeTeamSlides.length]
    : null;
  const activeLeagueSlide = rotationSupportSlides.length > 0
    ? rotationSupportSlides[rotationState.leagueSlideIndex % rotationSupportSlides.length]
    : null;
  const usingTeamPhase = rotationState.phase === 'teams' && !!activeTeamSlide;
  const rotationActiveSlide = usingTeamPhase ? activeTeamSlide : activeLeagueSlide;
  const presentationActiveSlide = activeInterruptSlide
    ?? (coldOpenPending ? coldOpenSlide : rotationActiveSlide);

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
    if (!presentationActiveSlide) {
      return;
    }
    if (activeInterruptSlide || coldOpenPending) {
      // Overlay slides already include their own pacing and must finish before returning to rotation.
    } else if (usingTeamPhase && (activeTeamSlides.length === 0 || teamRunQueue.length === 0)) {
      return;
    }
    const delayMs = presentationActiveSlide.durationMs ?? DEFAULT_SLIDE_DURATION_MS;
    const timer = window.setTimeout(() => {
      attemptAdvance();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    activeInterruptSlide,
    activeTeamSlides.length,
    coldOpenPending,
    attemptAdvance,
    presentationActiveSlide,
    teamRunQueue.length,
    usingTeamPhase,
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
  const highlightedTeamKey = highlightedTeamName ? normalizeTeamKey(highlightedTeamName) : null;
  const highlightedTeamRow = highlightedTeamId === null
    ? null
    : tableDivisions
      .flatMap((division) => division.rows)
      .find((row) => row.teamId === highlightedTeamId) ?? null;
  const playoffBracketMatches = isGw8PlayoffWindow ? playoffBracketData.matches : [];
  const showPlayoffPanels = isGw8PlayoffWindow && playoffBracketMatches.length > 0;
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
      if (!opponentName || opponentName.toUpperCase() === 'BYE') {
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
    if (focusLock) {
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
  }, [currentGw, fixtureCount, focusLock, movements, resolvedCount, teamShuffleCycle]);

  useEffect(() => {
    if (focusLock || allTimeSegmentModes.length === 0 || allTimeIntermission) {
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
    if (highlightedTeamId === null) {
      const base = activeSlide?.narration ?? activeSlide?.label ?? '';
      const sentences = splitSentences(base).filter(Boolean).slice(0, 3);
      return {
        headline: activeSlide?.label ?? 'Studio Desk',
        lines: sentences,
      };
    }
    const team = teams.find((entry) => entry.id === highlightedTeamId) ?? null;
    if (!team) {
      return {
        headline: activeSlide?.label ?? 'Studio Desk',
        lines: [],
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
    lines.push('Sydney: I am going to pass you to Jess.');
    const rankLabel = team.rank !== null ? formatRank(team.rank) : 'Rank pending';
    const currentSeasonLabel = currentSeason ? seasonOrdinalLabel(currentSeason) : null;
    const currentSeasonPrefix = currentSeasonLabel
      ? `This season (${currentSeasonLabel})`
      : 'This season';
    lines.push(
      `Jess: ${currentSeasonPrefix}, ${rankLabel} in ${team.league} with ${team.points} points and ${formatSigned(team.seasonProfit)} profit.`,
    );
    const cupForm = team.cupForm ?? [];
    const cupCounts = cupForm.reduce(
      (acc, result) => {
        if (result === 'W') acc.wins += 1;
        else if (result === 'D') acc.draws += 1;
        else if (result === 'L') acc.losses += 1;
        else if (result === 'B') acc.byes += 1;
        return acc;
      },
      { wins: 0, draws: 0, losses: 0, byes: 0 },
    );
    const cupParts = [
      cupCounts.wins > 0 ? `${cupCounts.wins} win${cupCounts.wins === 1 ? '' : 's'}` : null,
      cupCounts.draws > 0 ? `${cupCounts.draws} draw${cupCounts.draws === 1 ? '' : 's'}` : null,
      cupCounts.losses > 0 ? `${cupCounts.losses} loss${cupCounts.losses === 1 ? '' : 'es'}` : null,
      cupCounts.byes > 0 ? `${cupCounts.byes} bye${cupCounts.byes === 1 ? '' : 's'}` : null,
    ].filter(Boolean);
    const cupFormLine = cupParts.length > 0 ? cupParts.join(', ') : 'pending';
    lines.push(`Jess: Cup form reads ${cupFormLine}.`);
    const spotlightSeed = `${currentGw}-${team.id}-${teamShuffleCycle}`;
    lines.push(...pickSpotlightBankLines(spotlightSeed, 2));
    return {
      headline: `${team.name} Desk Read`,
      lines,
    };
  }, [activeSlide?.label, activeSlide?.narration, currentGw, currentSeason, highlightedTeamId, teamShuffleCycle, teams]);
  const spotlightSideCards = useMemo<ProducerCard[]>(() => {
    if (highlightedTeamId === null) {
      return [];
    }
    const team = teams.find((entry) => entry.id === highlightedTeamId) ?? null;
    if (!team) {
      return [];
    }
    const cards: ProducerCard[] = [];
    const previousSeasons = (team.previousSeasons ?? []).slice(0, 2).reverse();
    const journeyParts = previousSeasons.map((season) => (
      `${seasonOrdinalLabel(season.season)}: ${season.division} #${season.rank}`
    ));
    const currentSeasonLabel = currentSeason ? seasonOrdinalLabel(currentSeason) : 'current season';
    const currentRank = team.rank !== null ? `#${team.rank}` : 'rank pending';
    journeyParts.push(`${currentSeasonLabel}: ${team.league} ${currentRank}`);
    const journeyDetail = journeyParts.join(' • ');
    cards.push({
      id: `spotlight-journey-${team.id}`,
      label: 'Season Journey',
      headline: `${team.name} across three seasons`,
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
    const lastCup = team.previousCupRuns?.[0] ?? null;
    const cupDetail = lastCup
      ? `${seasonOrdinalLabel(lastCup.season)} cup: ${lastCup.cupFinish}.`
      : 'No cup archive yet.';
    cards.push({
      id: `spotlight-cup-${team.id}`,
      label: 'Cup Run',
      headline: cupHeadline,
      detail: cupDetail,
      tone: 'competition',
    });
    return cards.slice(0, 4);
  }, [currentSeason, highlightedTeamId, teams]);
  const commentaryTone: ProducerCard['tone'] = highlightedTeamId
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
        {highlightedTeamName && <span className="studio-producer-alert">Spotlight</span>}
      </div>
      <strong>{commentaryData.headline}</strong>
      {commentaryData.lines.map((line, index) => (
        <p key={`commentary-line-${index}`}>{line}</p>
      ))}
    </article>
  ) : null;
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
  type StudioVoiceSpeaker = 'sydney' | 'jess' | 'anchor';
  const voiceSegments = useMemo(() => {
    const segments: Array<{ speaker: StudioVoiceSpeaker; text: string }> = [];
    const parseLine = (line: string) => {
      const trimmed = line.trim();
      const match = /^(Sydney|Jess):\s*(.+)$/i.exec(trimmed);
      if (match?.[1] && match?.[2]) {
        return { speaker: match[1].toLowerCase() === 'jess' ? 'jess' : 'sydney', text: match[2] };
      }
      if (trimmed.length > 0) {
        return { speaker: 'anchor', text: trimmed };
      }
      return null;
    };
    if (highlightedTeamId !== null) {
      commentaryData.lines.forEach((line) => {
        const segment = parseLine(line);
        if (segment) {
          segments.push(segment);
        }
      });
      if (focusLock && fixtureVoiceSummary) {
        segments.push({ speaker: 'sydney', text: fixtureVoiceSummary });
      }
      if (focusLock && cupDrawSummary) {
        segments.push({ speaker: 'sydney', text: cupDrawSummary });
      }
      return segments;
    }
    const fallback = (activeSlide?.narration ?? activeSlide?.label ?? '').trim();
    if (fallback) {
      segments.push({ speaker: 'anchor', text: fallback });
    }
    return segments;
  }, [activeSlide?.label, activeSlide?.narration, commentaryData.lines, cupDrawSummary, fixtureVoiceSummary, focusLock, highlightedTeamId]);
  const voiceText = useMemo(
    () => voiceSegments.map((segment) => segment.text).join(' ').trim(),
    [voiceSegments],
  );
  const voiceKey = highlightedTeamId !== null
    ? `spotlight-${highlightedTeamId}-${voiceSegments.map((segment) => `${segment.speaker}:${segment.text}`).join('|')}`
    : `slide-${activeSlide?.id ?? 'none'}`;
  const speakQueue = useCallback((segments: Array<{ speaker: StudioVoiceSpeaker; text: string }>, options?: { interrupt?: boolean; force?: boolean }) => {
    if (!voiceSupported) {
      return;
    }
    const normalizedSegments = segments
      .map((segment) => ({
        speaker: segment.speaker,
        text: normalizeVoiceText(segment.text).replace(/\s+/g, ' ').trim(),
      }))
      .filter((segment) => segment.text.length > 0);
    if (normalizedSegments.length === 0 || typeof SpeechSynthesisUtterance === 'undefined') {
      return;
    }
    const synthesis = window.speechSynthesis;
    if (synthesis.paused) {
      synthesis.resume();
    }
    const shouldInterrupt = options?.interrupt === true;
    const force = options?.force === true;
    if (!force) {
      if (!voiceEnabled || !voiceUnlocked) {
        return;
      }
      if (synthesis.speaking || synthesis.pending) {
        return;
      }
    }
    if (shouldInterrupt && (synthesis.speaking || synthesis.pending)) {
      synthesis.cancel();
    }
    let index = 0;
    const speakNext = () => {
      const segment = normalizedSegments[index];
      if (!segment) {
        setVoiceSpeaking(false);
        return;
      }
      index += 1;
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.rate = 1;
      utterance.volume = 1;
      const isJess = segment.speaker === 'jess';
      utterance.pitch = isJess ? 1.05 : 0.95;
      if (voiceMode === 'auto') {
        const voice = isJess ? voiceRoster.jess : voiceRoster.sydney;
        if (voice) {
          utterance.voice = voice;
        }
      }
      utterance.onstart = () => setVoiceSpeaking(true);
      utterance.onend = speakNext;
      utterance.onerror = speakNext;
      synthesis.speak(utterance);
    };
    speakNext();
  }, [voiceEnabled, voiceMode, voiceRoster.jess, voiceRoster.sydney, voiceSupported, voiceUnlocked]);
  useEffect(() => {
    if (!voiceEnabled || !voiceUnlocked) {
      return;
    }
    if (!voiceText) {
      return;
    }
    if (voiceKeyRef.current === voiceKey) {
      return;
    }
    voiceKeyRef.current = voiceKey;
    speakQueue(voiceSegments);
  }, [voiceEnabled, voiceKey, voiceSegments, voiceText, voiceUnlocked, speakQueue]);
  useEffect(() => {
    if (!spotlightPulse || !voiceEnabled || !voiceUnlocked) {
      return;
    }
    if (highlightedTeamId === null) {
      return;
    }
    if (spotlightPulse.teamId && spotlightPulse.teamId !== highlightedTeamId) {
      return;
    }
    if (spotlightPulseIdRef.current === spotlightPulse.id) {
      return;
    }
    spotlightPulseIdRef.current = spotlightPulse.id;
    speakQueue([{ speaker: 'sydney', text: spotlightPulse.message }]);
  }, [highlightedTeamId, spotlightPulse, voiceEnabled, voiceUnlocked, speakQueue]);
  const voiceState = !voiceSupported
    ? 'unavailable'
    : !voiceEnabled
      ? 'muted'
      : voiceSpeaking
        ? 'speaking'
        : 'awaiting';
  const handleVoiceToggle = () => {
    if (!voiceSupported) {
      return;
    }
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (next) {
        voiceKeyRef.current = '';
        setVoiceUnlocked(true);
        speakQueue([{ speaker: 'sydney', text: 'Voice is on.' }], { interrupt: true, force: true });
      } else {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
        setVoiceSpeaking(false);
      }
      return next;
    });
  };
  const handleSpeakNow = () => {
    if (!voiceSupported) {
      return;
    }
    setVoiceUnlocked(true);
    voiceKeyRef.current = '';
    if (!voiceEnabled) {
      setVoiceEnabled(true);
    }
    if (!voiceText) {
      speakQueue([{ speaker: 'sydney', text: 'Studio audio check.' }], { interrupt: true, force: true });
      return;
    }
    speakQueue(voiceSegments, { interrupt: true, force: true });
  };
  const handleBeep = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextCtor();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.18);
    } catch {
      // ignore
    }
  };
  const handleTtsTest = () => {
    if (!voiceSupported) {
      return;
    }
    try {
      const synthesis = window.speechSynthesis;
      if (synthesis.paused) {
        synthesis.resume();
      }
      if (synthesis.speaking || synthesis.pending) {
        synthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance('This is a studio audio test.');
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onstart = () => setVoiceSpeaking(true);
      const finish = () => setVoiceSpeaking(false);
      utterance.onend = finish;
      utterance.onerror = finish;
      synthesis.speak(utterance);
      setVoiceUnlocked(true);
    } catch {
      // ignore
    }
  };
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
        ? `Kick-off pending. ${match.stakesLine}`
        : match.statusCode === 'in_play'
          ? `As it stands this tie is live. ${match.stakesLine}`
          : match.statusCode === 'provisional'
            ? `${match.winner ? `As it stands, winner was ${match.winner}.` : 'As it stands, winner call pending.'} ${match.stakesLine}`
            : `${match.winner ? `Confirmed winner was ${match.winner}.` : 'Confirmed result pending.'} ${match.stakesLine}`;
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
  const allTimeTakeover = Boolean(allTimeIntermissionSlide);
  const ssnTakeover = skySportsNewsMode && Boolean(presentationActiveSlide?.id?.startsWith('ssn-'));
  const fullScreenTakeover = allTimeTakeover || ssnTakeover;
  const ssnShowLiveScores = skySportsNewsMode && ssnTableCycleComplete;
  const tableActiveDivisionId = skySportsNewsMode && !ssnTableCycleComplete ? undefined : activeDivisionId;
  const tableCycleHandler = skySportsNewsMode && !ssnTableCycleComplete ? handleSsnTableCycleComplete : undefined;
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
          {voiceSupported ? (
            <>
                <button
                  type="button"
                  className={`studio-camera-pill studio-voice-pill state-${voiceState}`}
                  onClick={handleVoiceToggle}
                  aria-pressed={voiceEnabled}
                  title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
                >
                  {voiceEnabled ? (voiceSpeaking ? 'Voice Live' : 'Voice On') : 'Voice Off'}
                </button>
                <button
                  type="button"
                  className="studio-camera-pill studio-voice-pill"
                  onClick={handleSpeakNow}
                  disabled={!voiceSupported}
                  title="Replay commentary"
                >
                  Replay
                </button>
              <button
                type="button"
                className="studio-camera-pill studio-voice-pill"
                onClick={handleBeep}
                title="Audio beep test"
              >
                Beep
              </button>
              <button
                type="button"
                className="studio-camera-pill studio-voice-pill"
                onClick={handleTtsTest}
                title="TTS test"
              >
                TTS Test
              </button>
                <button
                  type="button"
                  className="studio-camera-pill studio-voice-pill"
                  onClick={() => setVoiceMode((prev) => (prev === 'auto' ? 'default' : 'auto'))}
                  title="Toggle voice mode"
                >
                  Voice {voiceMode === 'auto' ? 'Auto' : 'Default'}
                </button>
            </>
          ) : (
            <span className="studio-camera-pill state-unavailable">Voice N/A</span>
          )}
        </div>
      </header>

      <div className="studio-main-screen">
        <div
          className={`studio-main-grid${effectiveLayoutMode === 'table' ? ' table-first' : ''}${fullScreenTakeover ? ' alltime-takeover' : ''}`}
        >
          {effectiveLayoutMode === 'table' ? (
            <>
              <div className={`studio-table-first-main${fullScreenTakeover ? ' alltime-takeover' : ''}`}>
                {fullScreenTakeover ? (
                  studioSlideDeck
                ) : ssnShowLiveScores ? (
                  ssnLiveScoresPanel
                ) : (
                  <StudioTableCarousel
                    divisions={tableDivisions}
                    masterRows={masterLeagueRows}
                    intervalMs={TABLE_CAROUSEL_INTERVAL_MS}
                    activeDivisionId={tableActiveDivisionId}
                    highlightedTeamId={tableHighlightedTeamId}
                    onCycleComplete={tableCycleHandler}
                    presentationMode={effectiveGraphicsMode === 'clean' ? 'clean' : effectiveGraphicsMode === 'classic' ? 'classic' : 'full'}
                    readabilityMode={tableReadabilityMode}
                  />
                )}
              </div>
              {!fullScreenTakeover && (
                <aside className="studio-table-first-side">
                  {commentaryCard}
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
              )}
              {!fullScreenTakeover && (
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
              <aside className="studio-side-rail">
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
                      presentationMode={effectiveGraphicsMode === 'clean' ? 'clean' : effectiveGraphicsMode === 'classic' ? 'classic' : 'full'}
                      readabilityMode={tableReadabilityMode}
                    />
                  )}
                </div>
                <div className="studio-producer-stack" aria-label="Producer insights">
                  {commentaryCard}
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
                      ? (match.winner ? `As it stands, ${match.winner} lead this tie.` : 'As it stands, this tie is level and still in play.')
                      : match.statusCode === 'provisional'
                        ? (match.winner ? `As it stands, winner was ${match.winner}.` : 'As it stands, winner call pending.')
                        : (match.winner ? `Confirmed winner: ${match.winner}.` : 'Confirmed winner call pending.')}
                </p>
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

      <TickerBar items={tickerItems} />
    </section>
  );
}
