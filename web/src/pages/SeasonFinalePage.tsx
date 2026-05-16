import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';

type TeamMeta = Awaited<ReturnType<typeof api.teams>>[number];
type AppState = Awaited<ReturnType<typeof api.state>>;
type LeagueTableMap = Record<
  string,
  Array<{
    teamId: number;
    teamName: string;
    division: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    profit: number;
    spins: number;
    rank: number;
  }>
>;

type LeagueFixture = Awaited<ReturnType<typeof api.leagueFixtures>>[number];

type SeasonFinalePayload = {
  season: string;
  leagueWinners: Array<{ division: string; teamId: number; teamName: string }>;
  divisionTables?: Record<string, Array<{
    teamId: number;
    teamName: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    profit: number;
    spins: number;
    rank: number;
  }>>;
  masterLeague?: {
    winner: { teamId: number; teamName: string } | null;
    table: Array<{
      teamId: number;
      teamName: string;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      points: number;
      profit: number;
      spins: number;
      rank: number;
    }>;
  } | null;
  trioLeague?: {
    enabled: boolean;
    table: Array<{
      division: string;
      teamId: number;
      teamName: string;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      points: number;
      profit: number;
      spins: number;
      rank: number;
    }>;
  } | null;
  tierLeague?: {
    enabled: boolean;
    started: boolean;
    table: Array<{
      division: string;
      teamId: number;
      teamName: string;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      points: number;
      profit: number;
      spins: number;
      rank: number;
    }>;
  } | null;
  bestProfits: {
    overall: { teamId: number; teamName: string; profit: number } | null;
    byDivision: Array<{ division: string; teamId: number; teamName: string; profit: number }>;
  };
  promotions: Array<{ teamId: number; teamName: string; from: string; to: string }>;
  relegations: Array<{ teamId: number; teamName: string; from: string; to: string }>;
  playoffResults: Array<{
    upperTeamId: number;
    upperTeamName: string;
    lowerTeamId: number;
    lowerTeamName: string;
    upperDivision: string;
    lowerDivision: string;
    winnerTeamId: number | null;
    winnerTeamName: string | null;
    swapped: boolean;
  }>;
  cupWinner: { teamId: number; teamName: string } | null;
  superCup: {
    sourceSeason: string;
    pairingReason: 'winners_vs_winners' | 'double_winner_vs_bookieball_runner_up' | 'double_winner_vs_master_cup_runner_up';
    pairingExplanation: string;
    winner: { teamId: number; teamName: string } | null;
    runnerUp: { teamId: number; teamName: string } | null;
  } | null;
  standout: Array<{ label: string; value: string }>;
  goalsOfSeason: Array<{ division: string; teamId: number; teamName: string; profit: number }>;
  bookieBallCup?: {
    winner: { teamId: number; teamName: string } | null;
    runnerUp: { teamId: number; teamName: string } | null;
    final: {
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
    } | null;
  } | null;
  masterCup?: {
    winner: { teamId: number; teamName: string } | null;
    runnerUp: { teamId: number; teamName: string } | null;
    final: {
      homeTeam: string | null;
      awayTeam: string | null;
      winnerTeam: string | null;
      homeProfit: number;
      awayProfit: number;
      homeSpins: number;
      awaySpins: number;
      played: boolean;
      result: 'home' | 'away' | 'draw' | 'pending';
      decidedBy: 'profit' | 'spins' | 'penalties' | 'aggregate_profit' | 'aggregate_spins' | 'aggregate_penalties' | 'pending';
    } | null;
  } | null;
  upcomingSuperCup?: {
    season: string;
    sourceSeason: string;
    pairingReason: 'winners_vs_winners' | 'double_winner_vs_bookieball_runner_up' | 'double_winner_vs_master_cup_runner_up';
    pairingExplanation: string;
    homeTeamId: number;
    awayTeamId: number;
    homeTeam: string;
    awayTeam: string;
  } | null;
  bookieDor: {
    weights: { league: number; cup: number; master: number; consistency: number };
    winner: {
      teamId: number;
      teamName: string;
      division: string;
      score: number;
      leagueScore: number;
      cupScore: number;
      masterScore: number;
      consistencyScore: number;
      weightedLeagueScore: number;
      weightedCupScore: number;
      weightedMasterScore: number;
      weightedConsistencyScore: number;
      leagueRank: number;
      cupFinish: string;
    };
    leaderboard: Array<{
      teamId: number;
      teamName: string;
      division: string;
      score: number;
      leagueScore: number;
      cupScore: number;
      masterScore: number;
      consistencyScore: number;
      weightedLeagueScore: number;
      weightedCupScore: number;
      weightedMasterScore: number;
      weightedConsistencyScore: number;
    }>;
  } | null;
};

type SeasonFinaleResponse =
  | { pending: false }
  | {
      season: string;
      payload: SeasonFinalePayload;
    };

type SeasonFinaleData = {
  season: string;
  payload: SeasonFinalePayload;
};

type TeamPalette = {
  ballColor: string;
  ringColor: string;
  textColor: string;
};

type DivisionJourneyTeam = {
  teamId: number;
  teamName: string;
  palette: TeamPalette;
  ranks: number[];
  startRank: number;
  finalRank: number;
  highlighted: boolean;
};

type PanelTone = 'gold' | 'steel' | 'blue' | 'red' | 'onyx';

type TitleRaceRow = {
  teamId: number | null;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  profit: number;
  points: number;
  status: 'champion' | 'playoff' | 'danger' | 'steady';
  palette: TeamPalette;
};

type StandingsSummaryRow = {
  teamId: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

type SlideDefinition = {
  id: string;
  label: string;
  node: ReactNode;
};

const FALLBACK_FINALE_PAYLOAD: SeasonFinalePayload = {
  season: 'S4',
  leagueWinners: [
    { division: 'Champions Bookies', teamId: 20, teamName: '888 Casino' },
    { division: 'Premier Bookies', teamId: 11, teamName: 'Paddy Power' },
    { division: 'Average Bookies', teamId: 5, teamName: 'Coral' },
    { division: 'Struggling Bookies', teamId: 17, teamName: 'Bally Casino' },
    { division: 'Awful Bookies', teamId: 4, teamName: 'Foxy Bingo' },
  ],
  bestProfits: {
    overall: { teamId: 20, teamName: '888 Casino', profit: 28.4 },
    byDivision: [
      { division: 'Champions Bookies', teamId: 20, teamName: '888 Casino', profit: 28.4 },
      { division: 'Premier Bookies', teamId: 11, teamName: 'Paddy Power', profit: 21.1 },
      { division: 'Average Bookies', teamId: 5, teamName: 'Coral', profit: 16.2 },
      { division: 'Struggling Bookies', teamId: 17, teamName: 'Bally Casino', profit: 11.6 },
      { division: 'Awful Bookies', teamId: 4, teamName: 'Foxy Bingo', profit: 7.3 },
    ],
  },
  promotions: [
    { teamId: 11, teamName: 'Paddy Power', from: 'Premier Bookies', to: 'Champions Bookies' },
    { teamId: 5, teamName: 'Coral', from: 'Average Bookies', to: 'Premier Bookies' },
    { teamId: 17, teamName: 'Bally Casino', from: 'Struggling Bookies', to: 'Average Bookies' },
  ],
  relegations: [
    { teamId: 9, teamName: 'Sky Bet', from: 'Champions Bookies', to: 'Premier Bookies' },
    { teamId: 12, teamName: 'Virgin Games', from: 'Premier Bookies', to: 'Average Bookies' },
    { teamId: 18, teamName: 'Tombola', from: 'Average Bookies', to: 'Struggling Bookies' },
  ],
  playoffResults: [
    {
      upperTeamId: 6,
      upperTeamName: 'Ladbrokes',
      lowerTeamId: 5,
      lowerTeamName: 'Coral',
      upperDivision: 'Premier Bookies',
      lowerDivision: 'Average Bookies',
      winnerTeamId: 5,
      winnerTeamName: 'Coral',
      swapped: true,
    },
    {
      upperTeamId: 1,
      upperTeamName: 'Midnite',
      lowerTeamId: 17,
      lowerTeamName: 'Bally Casino',
      upperDivision: 'Average Bookies',
      lowerDivision: 'Struggling Bookies',
      winnerTeamId: 1,
      winnerTeamName: 'Midnite',
      swapped: false,
    },
  ],
  cupWinner: { teamId: 8, teamName: 'Bwin' },
  superCup: {
    sourceSeason: 'S3',
    pairingReason: 'winners_vs_winners',
    pairingExplanation: 'Bwin earned the BookieBall Cup slot and 888 Casino earned the Master Cup slot.',
    winner: { teamId: 20, teamName: '888 Casino' },
    runnerUp: { teamId: 8, teamName: 'Bwin' },
  },
  standout: [
    { label: 'Cup Winner', value: 'Bwin' },
    { label: 'Super Cup Winner', value: '888 Casino' },
    { label: 'Best Total Profit', value: '888 Casino (+28.40)' },
    { label: 'Best Single Profit', value: '888 Casino (+12.80)' },
  ],
  goalsOfSeason: [
    { division: 'Champions Bookies', teamId: 20, teamName: '888 Casino', profit: 12.8 },
    { division: 'Premier Bookies', teamId: 11, teamName: 'Paddy Power', profit: 9.1 },
    { division: 'Average Bookies', teamId: 5, teamName: 'Coral', profit: 6.6 },
  ],
  bookieDor: {
    weights: { league: 0.4, cup: 0.28, master: 0.32, consistency: 0 },
    winner: {
      teamId: 20,
      teamName: '888 Casino',
      division: 'Champions Bookies',
      score: 69.4,
      leagueScore: 36,
      cupScore: 3,
      masterScore: 30.4,
      consistencyScore: 0,
      weightedLeagueScore: 36,
      weightedCupScore: 3,
      weightedMasterScore: 30.4,
      weightedConsistencyScore: 0,
      leagueRank: 1,
      cupFinish: 'BookieBall Cup finalist',
    },
    leaderboard: [
      {
        teamId: 20,
        teamName: '888 Casino',
        division: 'Champions Bookies',
        score: 69.4,
        leagueScore: 36,
        cupScore: 3,
        masterScore: 30.4,
        consistencyScore: 0,
        weightedLeagueScore: 36,
        weightedCupScore: 3,
        weightedMasterScore: 30.4,
        weightedConsistencyScore: 0,
      },
      {
        teamId: 8,
        teamName: 'Bwin',
        division: 'Champions Bookies',
        score: 61.2,
        leagueScore: 30,
        cupScore: 6,
        masterScore: 25.2,
        consistencyScore: 0,
        weightedLeagueScore: 30,
        weightedCupScore: 6,
        weightedMasterScore: 25.2,
        weightedConsistencyScore: 0,
      },
      {
        teamId: 11,
        teamName: 'Paddy Power',
        division: 'Premier Bookies',
        score: 56.8,
        leagueScore: 24,
        cupScore: 3,
        masterScore: 29.8,
        consistencyScore: 0,
        weightedLeagueScore: 24,
        weightedCupScore: 3,
        weightedMasterScore: 29.8,
        weightedConsistencyScore: 0,
      },
      {
        teamId: 5,
        teamName: 'Coral',
        division: 'Average Bookies',
        score: 44.7,
        leagueScore: 18,
        cupScore: 1,
        masterScore: 25.7,
        consistencyScore: 0,
        weightedLeagueScore: 18,
        weightedCupScore: 1,
        weightedMasterScore: 25.7,
        weightedConsistencyScore: 0,
      },
    ],
  },
};

const DEFAULT_TEAM_PALETTE: TeamPalette = {
  ballColor: '#d6e9ff',
  ringColor: '#91c7ff',
  textColor: '#0f1b2d',
};

const PANEL_THEMES: Record<
  PanelTone,
  { rim: string; glow: string; header: string; body: string; text: string; panelGlow: string }
> = {
  gold: {
    rim: '#e7c56f',
    glow: 'rgba(255, 223, 128, 0.22)',
    header: 'linear-gradient(180deg, #f2db8d 0%, #c89b32 52%, #6a4b18 100%)',
    body: 'linear-gradient(180deg, rgba(31, 44, 68, 0.98), rgba(9, 16, 30, 0.99))',
    text: '#fff5d0',
    panelGlow: 'rgba(255, 219, 119, 0.18)',
  },
  steel: {
    rim: '#cbd4e7',
    glow: 'rgba(210, 222, 243, 0.18)',
    header: 'linear-gradient(180deg, #eef2f7 0%, #afb9cd 46%, #59667e 100%)',
    body: 'linear-gradient(180deg, rgba(34, 45, 66, 0.98), rgba(8, 14, 24, 0.99))',
    text: '#f8fbff',
    panelGlow: 'rgba(217, 228, 244, 0.14)',
  },
  blue: {
    rim: '#90bbff',
    glow: 'rgba(125, 177, 255, 0.2)',
    header: 'linear-gradient(180deg, #64a6ff 0%, #285fbd 52%, #11326e 100%)',
    body: 'linear-gradient(180deg, rgba(22, 40, 77, 0.98), rgba(8, 14, 28, 0.99))',
    text: '#f0f7ff',
    panelGlow: 'rgba(107, 165, 255, 0.18)',
  },
  red: {
    rim: '#ff9d96',
    glow: 'rgba(255, 120, 110, 0.18)',
    header: 'linear-gradient(180deg, #ef7369 0%, #b42624 52%, #5a1016 100%)',
    body: 'linear-gradient(180deg, rgba(63, 22, 28, 0.97), rgba(20, 8, 11, 0.99))',
    text: '#fff0ea',
    panelGlow: 'rgba(255, 109, 96, 0.16)',
  },
  onyx: {
    rim: '#d6bf7e',
    glow: 'rgba(214, 191, 126, 0.15)',
    header: 'linear-gradient(180deg, #3a3f4d 0%, #151922 52%, #05070b 100%)',
    body: 'linear-gradient(180deg, rgba(28, 30, 36, 0.98), rgba(7, 8, 12, 0.99))',
    text: '#f5e3a7',
    panelGlow: 'rgba(214, 191, 126, 0.14)',
  },
};

const slideTransition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1],
} as const;

function formatDivisionName(division: string): string {
  return displayDivisionName(division);
}

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatOrdinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function parseProfitFromValue(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function uppercaseName(value: string): string {
  return value.toUpperCase();
}

function initials(name: string): string {
  const words = name.split(' ').filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function createPalette(meta?: Partial<TeamMeta> | null): TeamPalette {
  return {
    ballColor: meta?.ballColor ?? DEFAULT_TEAM_PALETTE.ballColor,
    ringColor: meta?.ringColor ?? DEFAULT_TEAM_PALETTE.ringColor,
    textColor: meta?.textColor ?? DEFAULT_TEAM_PALETTE.textColor,
  };
}

function uniqueTeamEntries(entries: Array<{ teamId: number | null; teamName: string }>): Array<{ teamId: number | null; teamName: string }> {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.teamName.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function resolveStatus(index: number, total: number): TitleRaceRow['status'] {
  if (index === 0) {
    return 'champion';
  }
  if (total >= 4 && index === 2) {
    return 'playoff';
  }
  if (index === total - 1) {
    return 'danger';
  }
  return 'steady';
}

function summarizeCupResult(decidedBy: string | null | undefined, played: boolean, winnerTeam: string | null | undefined): string {
  if (!played) {
    return 'Awaiting final';
  }
  if (!winnerTeam) {
    return 'Final unresolved';
  }
  switch (decidedBy) {
    case 'penalties':
    case 'aggregate_penalties':
      return `Won on penalties`;
    case 'spins':
    case 'aggregate_spins':
      return 'Won on spins';
    case 'aggregate_profit':
      return 'Won on aggregate';
    case 'profit':
    default:
      return 'Won in regulation';
  }
}

function groupByDivision<T extends { division: string }>(rows: T[]): Array<{ division: string; rows: T[] }> {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    const list = grouped.get(row.division) ?? [];
    list.push(row);
    grouped.set(row.division, list);
  });
  return Array.from(grouped.entries()).map(([division, divisionRows]) => ({ division, rows: divisionRows }));
}

function joinNames(names: string[]): string {
  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return names[0] ?? '';
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function isOfficialDivisionFixtureRecord(fixture: LeagueFixture): boolean {
  return fixture.division !== 'Playoff' && fixture.division !== 'Friendly' && fixture.gw !== 'GW8';
}

function fixtureResultForTeam(fixture: LeagueFixture, teamName: string): 'W' | 'D' | 'L' | null {
  if (fixture.result === 'pending') {
    return null;
  }
  if (fixture.homeTeam !== teamName && fixture.awayTeam !== teamName) {
    return null;
  }
  if (fixture.result === 'draw') {
    return 'D';
  }
  if (fixture.homeTeam === teamName) {
    return fixture.result === 'home' ? 'W' : 'L';
  }
  return fixture.result === 'away' ? 'W' : 'L';
}

function formString(results: Array<'W' | 'D' | 'L'>): string {
  return results.length > 0 ? results.join('-') : 'No form';
}

function formPoints(results: Array<'W' | 'D' | 'L'>): number {
  return results.reduce((sum, result) => sum + (result === 'W' ? 3 : result === 'D' ? 1 : 0), 0);
}

function TeamOrb({
  name,
  palette,
  size = 64,
  champion = false,
}: {
  name: string;
  palette: TeamPalette;
  size?: number;
  champion?: boolean;
}) {
  const outerStyle: CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: `radial-gradient(circle at 28% 24%, rgba(255,255,255,0.32), rgba(255,255,255,0.02) 42%, transparent 64%), ${palette.ballColor}`,
    border: `3px solid ${palette.ringColor}`,
    boxShadow: champion
      ? `0 0 0 6px rgba(255,255,255,0.05), 0 0 24px ${palette.ringColor}66, inset 0 12px 18px rgba(255,255,255,0.18)`
      : `0 0 0 4px rgba(255,255,255,0.05), inset 0 10px 16px rgba(255,255,255,0.14)`,
    overflow: 'hidden',
    flexShrink: 0,
  };

  return (
    <div style={outerStyle} title={name}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 46%, rgba(0,0,0,0.14) 100%)',
        }}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: size * 0.32,
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: palette.textColor,
          textShadow: '0 2px 6px rgba(255,255,255,0.22)',
        }}
      >
        {initials(name)}
      </span>
    </div>
  );
}

function SlideCanvas({ children, accent = 'gold' }: { children: ReactNode; accent?: PanelTone }) {
  const theme = PANEL_THEMES[accent];
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '30px',
        background: 'linear-gradient(180deg, #122241 0%, #09121f 62%, #05070c 100%)',
        border: `1px solid ${theme.rim}33`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 30px 70px rgba(0,0,0,0.46), 0 0 0 1px ${theme.rim}16`,
      }}
    >
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'radial-gradient(circle at 50% 112%, rgba(8, 25, 42, 0.86), rgba(3, 7, 12, 0.98) 48%)',
            'linear-gradient(180deg, rgba(16, 38, 71, 0.55), rgba(7, 12, 19, 0.9))',
          ].join(', '),
        }}
        animate={{ scale: [1, 1.025, 1], y: [0, 8, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'radial-gradient(circle at 15% 20%, rgba(128, 186, 255, 0.22), transparent 19%)',
            'radial-gradient(circle at 84% 18%, rgba(255, 226, 149, 0.18), transparent 18%)',
            'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08), transparent 22%)',
          ].join(', '),
          pointerEvents: 'none',
        }}
      />
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-8%',
          width: '48%',
          height: '78%',
          background: 'radial-gradient(circle at 20% 24%, rgba(130,190,255,0.28), rgba(130,190,255,0.12) 24%, transparent 56%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
        animate={{ opacity: [0.82, 1, 0.82] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-22%',
          right: '-10%',
          width: '52%',
          height: '82%',
          background: `radial-gradient(circle at 78% 26%, ${theme.glow}, transparent 58%)`,
          filter: 'blur(22px)',
          pointerEvents: 'none',
        }}
        animate={{ opacity: [0.76, 0.96, 0.76] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 18%, rgba(0,0,0,0.18) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '12px',
          borderRadius: '24px',
          border: `1px solid ${theme.rim}22`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${theme.rim}10`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '30px',
          gap: '18px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function HeaderBar({
  kicker,
  title,
  subtitle,
  accent = 'gold',
  tag,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  accent?: PanelTone;
  tag?: string;
}) {
  const theme = PANEL_THEMES[accent];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'flex-start' }}>
      <div style={{ display: 'grid', gap: '10px' }}>
        <span
          style={{
            display: 'inline-flex',
            width: 'fit-content',
            padding: '0.42rem 0.78rem',
            borderRadius: '999px',
            border: `1px solid ${theme.rim}33`,
            background: 'linear-gradient(180deg, rgba(44,62,93,0.78), rgba(12,20,32,0.78))',
            color: theme.text,
            fontSize: '0.74rem',
            fontWeight: 900,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </span>
        <div style={{ display: 'grid', gap: '8px' }}>
          <h1
            style={{
              margin: 0,
              color: '#f8fbff',
              fontSize: 'clamp(2.2rem, 4vw, 4.3rem)',
              lineHeight: 0.94,
              letterSpacing: '-0.05em',
              fontWeight: 950,
              textTransform: 'uppercase',
              textShadow: '0 12px 30px rgba(0,0,0,0.35)',
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              style={{
                margin: 0,
                maxWidth: '720px',
                color: 'rgba(228, 238, 255, 0.78)',
                fontSize: '1rem',
                letterSpacing: '0.03em',
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {tag ? (
        <div
          style={{
            padding: '0.65rem 0.9rem',
            minWidth: '120px',
            borderRadius: '18px',
            border: `1px solid ${theme.rim}33`,
            background: 'linear-gradient(180deg, rgba(42,58,88,0.88), rgba(9,16,27,0.88))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
            color: theme.text,
            fontWeight: 800,
            textAlign: 'right',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            flexShrink: 0,
          }}
        >
          {tag}
        </div>
      ) : null}
    </div>
  );
}

function BroadcastPanel({
  title,
  subtitle,
  accent = 'gold',
  children,
  style,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  accent?: PanelTone;
  children: ReactNode;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
}) {
  const theme = PANEL_THEMES[accent];

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '22px',
        border: `1px solid ${theme.rim}30`,
        background: theme.body,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -18px 28px rgba(0,0,0,0.18), 0 18px 28px rgba(0,0,0,0.18), 0 0 0 1px ${theme.panelGlow}`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 20%)',
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.018) 0 2px, rgba(255,255,255,0) 2px 8px)',
          ].join(', '),
          pointerEvents: 'none',
        }}
      />
      {title ? (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '0.7rem 1rem',
            borderBottom: `1px solid ${theme.rim}22`,
            background: theme.header,
            color: theme.text,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -10px 12px rgba(0,0,0,0.12)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '0.75rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              fontSize: '0.8rem',
            }}
          >
            <span>{title}</span>
            {subtitle ? <span style={{ opacity: 0.88, fontSize: '0.7rem' }}>{subtitle}</span> : null}
          </div>
        </div>
      ) : null}
      <div style={{ position: 'relative', zIndex: 1, padding: '1rem', ...contentStyle }}>{children}</div>
    </div>
  );
}

function StatTile({
  label,
  value,
  note,
  accent = 'gold',
}: {
  label: string;
  value: string;
  note?: string;
  accent?: PanelTone;
}) {
  const theme = PANEL_THEMES[accent];
  return (
    <BroadcastPanel accent={accent}>
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        <span
          style={{
            color: 'rgba(221,232,248,0.72)',
            fontSize: '0.72rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
          }}
        >
          {label}
        </span>
        <strong
          style={{
            fontSize: 'clamp(1.8rem, 2.5vw, 2.8rem)',
            lineHeight: 0.92,
            letterSpacing: '-0.06em',
            fontWeight: 950,
            color: theme.text,
            textShadow: '0 8px 20px rgba(0,0,0,0.28)',
          }}
        >
          {value}
        </strong>
        {note ? (
          <span style={{ color: 'rgba(235, 242, 255, 0.72)', fontSize: '0.82rem' }}>{note}</span>
        ) : null}
      </div>
    </BroadcastPanel>
  );
}

function ShowcaseHeroPanel({
  accent = 'gold',
  eyebrow,
  headline,
  copy,
  teamName,
  palette,
  chips,
}: {
  accent?: PanelTone;
  eyebrow: string;
  headline: string;
  copy: string;
  teamName: string;
  palette: TeamPalette;
  chips: Array<{ label: string; value: string }>;
}) {
  return (
    <BroadcastPanel accent={accent} style={{ minHeight: '100%' }}>
      <div style={{ display: 'grid', gap: '1rem', minHeight: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'center' }}>
          <TeamOrb name={teamName} palette={palette} size={78} champion />
          <div style={{ display: 'grid', gap: '0.42rem' }}>
            <span
              style={{
                color: PANEL_THEMES[accent].rim,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                fontSize: '0.72rem',
                fontWeight: 900,
              }}
            >
              {eyebrow}
            </span>
            <strong
              style={{
                color: '#f8fbff',
                fontSize: 'clamp(1.9rem, 3vw, 3.2rem)',
                lineHeight: 0.92,
                letterSpacing: '-0.06em',
                textTransform: 'uppercase',
                fontWeight: 950,
              }}
            >
              {headline}
            </strong>
          </div>
        </div>
        <p
          style={{
            margin: 0,
            color: 'rgba(231,240,255,0.84)',
            lineHeight: 1.58,
            fontSize: '0.96rem',
          }}
        >
          {copy}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(chips.length, 1)}, minmax(0, 1fr))`, gap: '0.75rem' }}>
          {chips.map((chip) => (
            <div
              key={`${headline}-${chip.label}`}
              style={{
                display: 'grid',
                gap: '0.32rem',
                padding: '0.72rem 0.78rem',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <span
                style={{
                  color: 'rgba(224,235,252,0.68)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                }}
              >
                {chip.label}
              </span>
              <strong
                style={{
                  color: '#f8fbff',
                  fontSize: '1.08rem',
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  fontWeight: 900,
                }}
              >
                {chip.value}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </BroadcastPanel>
  );
}

function DivisionJourneyPanel({
  division,
  teams,
  gwLabels,
}: {
  division: string;
  teams: DivisionJourneyTeam[];
  gwLabels: string[];
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const maxFrame = Math.max(0, gwLabels.length - 1);
    if (maxFrame === 0) {
      setProgress(0);
      return;
    }
    setProgress(0);
    let frame = 0;
    const durationMs = 7600;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(elapsed / durationMs, 1);
      const eased = 1 - ((1 - ratio) ** 3);
      setProgress(eased * maxFrame);
      if (ratio < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [division, gwLabels]);

  const width = 900;
  const height = 360;
  const margin = { top: 28, right: 132, bottom: 48, left: 70 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const teamCount = Math.max(teams.length, 1);
  const maxFrame = Math.max(0, gwLabels.length - 1);
  const clampedProgress = Math.max(0, Math.min(progress, maxFrame));
  const lowerIndex = Math.floor(clampedProgress);
  const upperIndex = Math.min(maxFrame, lowerIndex + 1);
  const frameProgress = clampedProgress - lowerIndex;
  const spotlightX = margin.left + (maxFrame > 0 ? (plotWidth / maxFrame) * clampedProgress : plotWidth / 2);
  const activeGwLabel = gwLabels[Math.min(maxFrame, Math.round(clampedProgress))] ?? gwLabels[gwLabels.length - 1] ?? 'GW1';

  const xForIndex = (index: number) => (
    maxFrame > 0
      ? margin.left + (plotWidth / maxFrame) * index
      : margin.left + plotWidth / 2
  );
  const yForRank = (rank: number) => (
    margin.top + (plotHeight / Math.max(teamCount - 1, 1)) * (rank - 1)
  );

  const linePath = (ranks: number[], reveal: boolean) => {
    if (ranks.length === 0) {
      return '';
    }
    const finalIndex = reveal ? upperIndex : ranks.length - 1;
    const points: Array<{ x: number; y: number }> = [];
    for (let index = 0; index <= finalIndex; index += 1) {
      const rank = ranks[Math.min(index, ranks.length - 1)] ?? ranks[ranks.length - 1] ?? 1;
      points.push({ x: xForIndex(index), y: yForRank(rank) });
    }
    if (reveal && upperIndex > lowerIndex) {
      const startRank = ranks[Math.min(lowerIndex, ranks.length - 1)] ?? ranks[ranks.length - 1] ?? 1;
      const endRank = ranks[Math.min(upperIndex, ranks.length - 1)] ?? ranks[ranks.length - 1] ?? startRank;
      const interpolatedRank = startRank + ((endRank - startRank) * frameProgress);
      points[points.length - 1] = { x: spotlightX, y: yForRank(interpolatedRank) };
    }
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  };

  const positionedTeams = teams.map((team) => {
    const currentStartRank = team.ranks[Math.min(lowerIndex, team.ranks.length - 1)] ?? team.finalRank;
    const currentEndRank = team.ranks[Math.min(upperIndex, team.ranks.length - 1)] ?? currentStartRank;
    const currentRank = currentStartRank + ((currentEndRank - currentStartRank) * frameProgress);
    return {
      ...team,
      currentRank,
      currentX: spotlightX,
      currentY: yForRank(currentRank),
      visiblePath: linePath(team.ranks, true),
      fullPath: linePath(team.ranks, false),
    };
  });

  return (
    <BroadcastPanel
      title={`${formatDivisionName(division)} Journey`}
      subtitle={`${gwLabels[0] ?? 'GW1'} to ${gwLabels[gwLabels.length - 1] ?? 'GW7'}`}
      accent="blue"
      style={{ minHeight: '100%' }}
      contentStyle={{ padding: '0.95rem 1rem 1rem' }}
    >
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ color: 'rgba(227,236,251,0.74)', fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 800 }}>
            Regular season table movement, week by week
          </div>
          <div
            style={{
              padding: '0.42rem 0.74rem',
              borderRadius: '999px',
              border: '1px solid rgba(140,193,255,0.28)',
              background: 'linear-gradient(180deg, rgba(41,69,114,0.6), rgba(13,22,38,0.72))',
              color: '#d7ecff',
              fontSize: '0.74rem',
              fontWeight: 900,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            {activeGwLabel}
          </div>
        </div>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '18px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(15,26,42,0.95), rgba(6,12,22,0.98))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label={`${formatDivisionName(division)} week-by-week league journey`}>
            <defs>
              <linearGradient id="finale-journey-spotlight" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(149,202,255,0.18)" />
                <stop offset="100%" stopColor="rgba(149,202,255,0.02)" />
              </linearGradient>
            </defs>

            <rect x={Math.max(margin.left - 18, spotlightX - 34)} y={margin.top - 12} width={68} height={plotHeight + 20} fill="url(#finale-journey-spotlight)" rx={18} />

            {Array.from({ length: teamCount }, (_, index) => {
              const rank = index + 1;
              const y = yForRank(rank);
              return (
                <g key={`journey-rank-${rank}`}>
                  <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="rgba(177,205,244,0.12)" strokeWidth={1.2} />
                  <text x={margin.left - 12} y={y + 4} textAnchor="end" fill="rgba(215,231,255,0.7)" fontSize="12" fontWeight="800">
                    #{rank}
                  </text>
                </g>
              );
            })}

            {gwLabels.map((gwLabel, index) => {
              const x = xForIndex(index);
              return (
                <g key={`journey-gw-${gwLabel}`}>
                  <line x1={x} y1={margin.top - 6} x2={x} y2={height - margin.bottom} stroke="rgba(158,191,240,0.14)" strokeWidth={1.1} />
                  <text x={x} y={height - 16} textAnchor="middle" fill="rgba(222,235,255,0.74)" fontSize="12" fontWeight="800">
                    {gwLabel}
                  </text>
                </g>
              );
            })}

            {positionedTeams.map((team) => (
              <path
                key={`journey-track-${team.teamId}`}
                d={team.fullPath}
                fill="none"
                stroke={team.highlighted ? 'rgba(255,221,146,0.2)' : 'rgba(190,212,246,0.12)'}
                strokeWidth={team.highlighted ? 5 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {positionedTeams.map((team) => (
              <motion.path
                key={`journey-live-${team.teamId}`}
                d={team.visiblePath}
                fill="none"
                stroke={team.highlighted ? '#f5d78d' : team.palette.ringColor}
                strokeWidth={team.highlighted ? 5.5 : 3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0.3 }}
                animate={{ pathLength: 1, opacity: team.highlighted ? 1 : 0.88 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                style={{
                  filter: team.highlighted
                    ? 'drop-shadow(0 0 10px rgba(245,215,141,0.38))'
                    : 'drop-shadow(0 0 5px rgba(121,169,240,0.16))',
                }}
              />
            ))}

            {positionedTeams.map((team) => (
              <g key={`journey-marker-${team.teamId}`} transform={`translate(${team.currentX}, ${team.currentY})`}>
                <circle
                  r={team.highlighted ? 11 : 8}
                  fill={team.highlighted ? '#f4d68a' : team.palette.ballColor}
                  stroke={team.highlighted ? '#fff0bf' : team.palette.ringColor}
                  strokeWidth={team.highlighted ? 3 : 2.4}
                  style={{
                    filter: team.highlighted
                      ? 'drop-shadow(0 0 12px rgba(245,215,141,0.42))'
                      : 'drop-shadow(0 0 7px rgba(0,0,0,0.28))',
                  }}
                />
                <text
                  x="0"
                  y="1"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={team.highlighted ? '#172033' : team.palette.textColor}
                  fontSize={team.highlighted ? '10.5' : '9.5'}
                  fontWeight="900"
                >
                  {(team.teamName.trim().charAt(0) || '?').toUpperCase()}
                </text>
              </g>
            ))}

            {positionedTeams.map((team) => (
              <g key={`journey-finish-${team.teamId}`} transform={`translate(${width - margin.right + 16}, ${yForRank(team.finalRank)})`}>
                <line x1="-16" y1="0" x2="-4" y2="0" stroke={team.highlighted ? '#f5d78d' : 'rgba(214,229,251,0.38)'} strokeWidth={2} />
                <text
                  x="0"
                  y="-1"
                  fill={team.highlighted ? '#fff0c3' : '#f3f8ff'}
                  fontSize="12"
                  fontWeight={team.highlighted ? '900' : '800'}
                >
                  #{team.finalRank} {team.teamName}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </BroadcastPanel>
  );
}

function TickerBar({ items, accent = 'gold' }: { items: string[]; accent?: PanelTone }) {
  const repeated = [...items, ...items];
  return (
    <BroadcastPanel accent={accent} style={{ minHeight: '72px' }} contentStyle={{ padding: '0.7rem 1rem' }}>
      <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <motion.div
          style={{ display: 'inline-flex', gap: '1.5rem', width: 'max-content', alignItems: 'center' }}
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 18, ease: 'linear', repeat: Infinity }}
        >
          {repeated.map((item, idx) => (
            <span
              key={`ticker-${idx}-${item}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.8rem',
                color: '#f7fbff',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontSize: '0.78rem',
              }}
            >
              <span style={{ color: PANEL_THEMES[accent].rim }}>•</span>
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </BroadcastPanel>
  );
}

function LeagueTable({
  title,
  rows,
}: {
  title: string;
  rows: TitleRaceRow[];
}) {
  return (
    <BroadcastPanel title={title} subtitle="Final Standings" accent="blue" style={{ minHeight: '100%' }}>
      <div style={{ display: 'grid', gap: '0.55rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.4fr repeat(6, minmax(46px, 0.65fr))',
            gap: '0.4rem',
            padding: '0 0.6rem',
            color: 'rgba(223,236,255,0.72)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            fontWeight: 800,
            fontSize: '0.68rem',
          }}
        >
          <span>Club</span>
          <span>P</span>
          <span>W</span>
          <span>D</span>
          <span>L</span>
          <span>Profit</span>
          <span>Pts</span>
        </div>

        {rows.map((row, index) => {
          const rowAccent =
            row.status === 'champion'
              ? 'linear-gradient(180deg, rgba(249,221,145,0.22), rgba(121,78,18,0.18))'
              : row.status === 'playoff'
                ? 'linear-gradient(180deg, rgba(105,162,255,0.22), rgba(18,64,138,0.18))'
                : row.status === 'danger'
                  ? 'linear-gradient(180deg, rgba(233,100,92,0.22), rgba(97,18,24,0.18))'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))';

          const chipLabel =
            row.status === 'champion'
              ? 'Champion'
              : row.status === 'playoff'
                ? 'Playoff'
                : row.status === 'danger'
                  ? 'Danger'
                  : null;

          return (
            <div
              key={`${row.teamName}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '2.4fr repeat(6, minmax(46px, 0.65fr))',
                gap: '0.4rem',
                alignItems: 'center',
                padding: '0.72rem 0.8rem',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: rowAccent,
                boxShadow:
                  row.status === 'champion'
                    ? 'inset 0 1px 0 rgba(255,255,255,0.14), 0 12px 26px rgba(0,0,0,0.18)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <span
                  style={{
                    width: '24px',
                    color: row.status === 'champion' ? '#f9d673' : 'rgba(235,243,255,0.76)',
                    fontWeight: 900,
                    fontSize: '0.88rem',
                    textAlign: 'center',
                  }}
                >
                  {index + 1}
                </span>
                <TeamOrb name={row.teamName} palette={row.palette} size={38} champion={row.status === 'champion'} />
                <div style={{ minWidth: 0, display: 'grid', gap: '0.2rem' }}>
                  <strong
                    style={{
                      color: '#f8fbff',
                      fontSize: '0.92rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.teamName}
                  </strong>
                  {chipLabel ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        width: 'fit-content',
                        padding: '0.14rem 0.42rem',
                        borderRadius: '999px',
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color:
                          row.status === 'champion'
                            ? '#1a1504'
                            : row.status === 'playoff'
                              ? '#edf6ff'
                              : '#fff3f2',
                        background:
                          row.status === 'champion'
                            ? 'linear-gradient(180deg, #f4dc92, #d49d31)'
                            : row.status === 'playoff'
                              ? 'linear-gradient(180deg, #6caaff, #2159b5)'
                              : 'linear-gradient(180deg, #ef7469, #8e1d21)',
                      }}
                    >
                      {chipLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <span style={{ color: '#f8fbff', fontWeight: 800 }}>{row.played}</span>
              <span style={{ color: '#f8fbff', fontWeight: 800 }}>{row.wins}</span>
              <span style={{ color: '#f8fbff', fontWeight: 800 }}>{row.draws}</span>
              <span style={{ color: '#f8fbff', fontWeight: 800 }}>{row.losses}</span>
              <span style={{ color: '#f6e6aa', fontWeight: 900 }}>{formatSigned(row.profit)}</span>
              <span style={{ color: '#f8fbff', fontWeight: 950, fontSize: '1rem' }}>{row.points}</span>
            </div>
          );
        })}
      </div>
    </BroadcastPanel>
  );
}

function CompactStandingsBoard({
  title,
  rows,
  accent = 'steel',
  subtitle,
}: {
  title: string;
  rows: TitleRaceRow[];
  accent?: PanelTone;
  subtitle?: string;
}) {
  return (
    <BroadcastPanel title={title} subtitle={subtitle ?? 'Final order'} accent={accent} style={{ minHeight: '100%' }}>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {rows.map((row, index) => (
          <div
            key={`${title}-${row.teamName}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px auto 1fr auto',
              gap: '0.7rem',
              alignItems: 'center',
              padding: '0.62rem 0.72rem',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: row.status === 'champion'
                ? 'linear-gradient(180deg, rgba(249,221,145,0.2), rgba(121,78,18,0.16))'
                : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
            }}
          >
            <span style={{ color: row.status === 'champion' ? '#f5d38f' : '#f8fbff', fontWeight: 900, textAlign: 'center' }}>
              {index + 1}
            </span>
            <TeamOrb name={row.teamName} palette={row.palette} size={32} champion={row.status === 'champion'} />
            <div style={{ display: 'grid', gap: '0.18rem', minWidth: 0 }}>
              <strong
                style={{
                  color: '#f8fbff',
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.teamName}
              </strong>
              <span style={{ color: 'rgba(223,236,255,0.7)', fontSize: '0.74rem' }}>
                {formatSigned(row.profit)} • {row.points} pts
              </span>
            </div>
            <span style={{ color: '#f8fbff', fontWeight: 900 }}>{row.played}P</span>
          </div>
        ))}
      </div>
    </BroadcastPanel>
  );
}

function TrophyMark({ accent }: { accent: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '160px',
        height: '190px',
        display: 'grid',
        placeItems: 'center',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '18px 32px 58px',
          borderRadius: '44px 44px 52px 52px',
          background: 'linear-gradient(180deg, #f7e4a7 0%, #d6a73b 42%, #6d4811 100%)',
          boxShadow: `0 0 30px ${accent}55, inset 0 10px 16px rgba(255,255,255,0.22)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '42px',
          left: '18px',
          width: '36px',
          height: '72px',
          borderRadius: '18px 0 0 18px',
          border: '8px solid #d7ab42',
          borderRight: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '42px',
          right: '18px',
          width: '36px',
          height: '72px',
          borderRadius: '0 18px 18px 0',
          border: '8px solid #d7ab42',
          borderLeft: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '52px',
          width: '38px',
          height: '42px',
          background: 'linear-gradient(180deg, #e9c361, #8f601c)',
          borderRadius: '14px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          width: '88px',
          height: '24px',
          borderRadius: '12px',
          background: 'linear-gradient(180deg, #edd390, #8b6120)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle, ${accent}44, transparent 66%)`,
          filter: 'blur(16px)',
        }}
      />
    </div>
  );
}

function SeasonFinalePage() {
  const [finale, setFinale] = useState<SeasonFinaleData | null>(null);
  const [teams, setTeams] = useState<TeamMeta[]>([]);
  const [liveState, setLiveState] = useState<AppState | null>(null);
  const [liveLeagueTable, setLiveLeagueTable] = useState<LeagueTableMap | null>(null);
  const [seasonLeagueFixtures, setSeasonLeagueFixtures] = useState<LeagueFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.seasonFinale().catch(() => ({ pending: false } as SeasonFinaleResponse)),
      api.teams().catch(() => [] as TeamMeta[]),
      api.state().catch(() => null as AppState | null),
      api.leagueTable().catch(() => null as LeagueTableMap | null),
    ])
      .then(([seasonFinaleResponse, nextTeams, nextState, nextLeagueTable]) => {
        if (!active) {
          return;
        }
        if ('pending' in seasonFinaleResponse && seasonFinaleResponse.pending === false) {
          setFinale(null);
        } else {
          setFinale(seasonFinaleResponse as SeasonFinaleData);
        }
        setTeams(nextTeams);
        setLiveState(nextState);
        setLiveLeagueTable(nextLeagueTable);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const payload = finale?.payload ?? FALLBACK_FINALE_PAYLOAD;
  const previewMode = !finale;

  useEffect(() => {
    let active = true;
    api.leagueFixtures(undefined, true, payload.season)
      .then((fixtures) => {
        if (active) {
          setSeasonLeagueFixtures(fixtures);
        }
      })
      .catch(() => {
        if (active) {
          setSeasonLeagueFixtures([]);
        }
      });
    return () => {
      active = false;
    };
  }, [payload.season]);

  const paletteByTeamId = useMemo(() => {
    return new Map(teams.map((team) => [team.id, createPalette(team)]));
  }, [teams]);

  const paletteByName = useMemo(() => {
    return new Map(teams.map((team) => [team.name.toLowerCase(), createPalette(team)]));
  }, [teams]);

  const topDivisionChampion = useMemo(() => {
    return payload.leagueWinners.find((row) => /champions/i.test(row.division)) ?? payload.leagueWinners[0] ?? null;
  }, [payload]);

  const resolvePalette = (teamId: number | null | undefined, teamName: string): TeamPalette => {
    return (teamId ? paletteByTeamId.get(teamId) : null)
      ?? paletteByName.get(teamName.toLowerCase())
      ?? DEFAULT_TEAM_PALETTE;
  };

  const mapStandingsRows = (rows: StandingsSummaryRow[]): TitleRaceRow[] => {
    return rows
      .slice()
      .sort((left, right) => left.rank - right.rank)
      .map((row, index, ordered) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        points: row.points,
        profit: row.profit,
        status: resolveStatus(index, ordered.length),
        palette: resolvePalette(row.teamId, row.teamName),
      }));
  };

  const divisionTableMap = useMemo(() => {
    return payload.divisionTables
      ?? ((liveState?.currentSeason === payload.season && liveLeagueTable) ? liveLeagueTable : {});
  }, [liveLeagueTable, liveState?.currentSeason, payload.divisionTables, payload.season]);

  const divisionStoryByDivision = useMemo(() => {
    const stories = new Map<string, {
      earlyLeader: { teamId: number; teamName: string } | null;
      hotRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null;
      coldRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null;
      openingRanks: Record<number, number>;
      journeyTeams: DivisionJourneyTeam[];
      gwLabels: string[];
    }>();

    Object.entries(divisionTableMap).forEach(([division, rows]) => {
      const orderedRows = [...rows].sort((left, right) => left.rank - right.rank || left.teamName.localeCompare(right.teamName));
      const gwLabels = Array.from({ length: 7 }, (_, index) => `GW${index + 1}`);
      if (orderedRows.length === 0) {
        stories.set(division, {
          earlyLeader: null,
          hotRun: null,
          coldRun: null,
          openingRanks: {},
          journeyTeams: [],
          gwLabels,
        });
        return;
      }

      const officialFixtures = seasonLeagueFixtures
        .filter((fixture) => fixture.division === division && isOfficialDivisionFixtureRecord(fixture))
        .slice()
        .sort((left, right) => Number(left.gw.replace('GW', '')) - Number(right.gw.replace('GW', '')) || left.id - right.id);

      const stats = new Map<number, { points: number; profit: number; spins: number; wins: number }>();
      const resultsByTeamId = new Map<number, Array<{ gw: string; result: 'W' | 'D' | 'L' }>>();
      const ranksByTeamId = new Map<number, number[]>();
      const openingRanks: Record<number, number> = {};

      orderedRows.forEach((row) => {
        stats.set(row.teamId, { points: 0, profit: 0, spins: 0, wins: 0 });
        resultsByTeamId.set(row.teamId, []);
        ranksByTeamId.set(row.teamId, []);
      });

      for (let gwNumber = 1; gwNumber <= 7; gwNumber += 1) {
        const gwLabel = `GW${gwNumber}`;
        officialFixtures
          .filter((fixture) => fixture.gw === gwLabel && fixture.result !== 'pending')
          .forEach((fixture) => {
            const home = orderedRows.find((row) => row.teamName === fixture.homeTeam);
            const away = orderedRows.find((row) => row.teamName === fixture.awayTeam);
            if (!home || !away) {
              return;
            }
            const homeStats = stats.get(home.teamId);
            const awayStats = stats.get(away.teamId);
            if (!homeStats || !awayStats) {
              return;
            }
            homeStats.profit += fixture.homeProfit;
            awayStats.profit += fixture.awayProfit;
            homeStats.spins += fixture.homeSpins;
            awayStats.spins += fixture.awaySpins;

            const homeResult = fixtureResultForTeam(fixture, home.teamName);
            const awayResult = fixtureResultForTeam(fixture, away.teamName);
            if (homeResult) {
              resultsByTeamId.get(home.teamId)?.push({ gw: fixture.gw, result: homeResult });
            }
            if (awayResult) {
              resultsByTeamId.get(away.teamId)?.push({ gw: fixture.gw, result: awayResult });
            }

            if (fixture.result === 'home') {
              homeStats.points += 3;
              homeStats.wins += 1;
            } else if (fixture.result === 'away') {
              awayStats.points += 3;
              awayStats.wins += 1;
            } else if (fixture.result === 'draw') {
              homeStats.points += 1;
              awayStats.points += 1;
            }
          });

        const standings = orderedRows
          .map((row) => ({
            row,
            stats: stats.get(row.teamId) ?? { points: 0, profit: 0, spins: 0, wins: 0 },
          }))
          .sort((left, right) => (
            right.stats.points - left.stats.points
            || right.stats.profit - left.stats.profit
            || right.stats.spins - left.stats.spins
            || right.stats.wins - left.stats.wins
            || left.row.teamName.localeCompare(right.row.teamName)
          ));

        if (gwNumber === 1) {
          standings.forEach((entry, index) => {
            openingRanks[entry.row.teamId] = index + 1;
          });
        }
        standings.forEach((entry, index) => {
          ranksByTeamId.get(entry.row.teamId)?.push(index + 1);
        });
      }

      const earlyLeaderRow = orderedRows.find((row) => openingRanks[row.teamId] === 1) ?? null;
      const evaluateWindow = (
        rowsForTeam: Array<{ gw: string; result: 'W' | 'D' | 'L' }>,
        comparator: (candidate: { points: number; wins: number; draws: number }, best: { points: number; wins: number; draws: number }) => boolean,
      ) => {
        let bestWindow: { form: string; points: number; range: string; wins: number; draws: number } | null = null;
        const windowSize = Math.min(3, rowsForTeam.length);
        if (windowSize === 0) {
          return null;
        }
        for (let start = 0; start <= rowsForTeam.length - windowSize; start += 1) {
          const slice = rowsForTeam.slice(start, start + windowSize);
          const wins = slice.filter((row) => row.result === 'W').length;
          const draws = slice.filter((row) => row.result === 'D').length;
          const points = formPoints(slice.map((row) => row.result));
          const candidate = {
            form: formString(slice.map((row) => row.result)),
            points,
            range: slice.length > 1 ? `${slice[0]?.gw} to ${slice[slice.length - 1]?.gw}` : `${slice[0]?.gw}`,
            wins,
            draws,
          };
          if (!bestWindow || comparator(candidate, bestWindow)) {
            bestWindow = candidate;
          }
        }
        return bestWindow;
      };

      let hotRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null = null;
      let coldRun: { teamId: number; teamName: string; form: string; points: number; range: string } | null = null;

      orderedRows.forEach((row) => {
        const formRows = resultsByTeamId.get(row.teamId) ?? [];
        const bestWindow = evaluateWindow(formRows, (candidate, best) => (
          candidate.points > best.points
          || (candidate.points === best.points && candidate.wins > best.wins)
          || (candidate.points === best.points && candidate.wins === best.wins && candidate.draws > best.draws)
        ));
        const worstWindow = evaluateWindow(formRows, (candidate, best) => (
          candidate.points < best.points
          || (candidate.points === best.points && candidate.wins < best.wins)
          || (candidate.points === best.points && candidate.wins === best.wins && candidate.draws < best.draws)
        ));

        if (bestWindow && (!hotRun
          || bestWindow.points > hotRun.points
          || (bestWindow.points === hotRun.points && row.rank < (orderedRows.find((entry) => entry.teamId === hotRun?.teamId)?.rank ?? Number.MAX_SAFE_INTEGER))
        )) {
          hotRun = {
            teamId: row.teamId,
            teamName: row.teamName,
            form: bestWindow.form,
            points: bestWindow.points,
            range: bestWindow.range,
          };
        }

        if (worstWindow && (!coldRun
          || worstWindow.points < coldRun.points
          || (worstWindow.points === coldRun.points && row.rank > (orderedRows.find((entry) => entry.teamId === coldRun?.teamId)?.rank ?? 0))
        )) {
          coldRun = {
            teamId: row.teamId,
            teamName: row.teamName,
            form: worstWindow.form,
            points: worstWindow.points,
            range: worstWindow.range,
          };
        }
      });

      const journeyTeams = orderedRows.map((row) => {
        const rawRanks = ranksByTeamId.get(row.teamId) ?? [];
        const fallbackRank = row.rank || orderedRows.findIndex((entry) => entry.teamId === row.teamId) + 1 || 1;
        const filledRanks = officialFixtures.length === 0
          ? gwLabels.map(() => fallbackRank)
          : gwLabels.map((_, index) => rawRanks[index] ?? rawRanks[rawRanks.length - 1] ?? fallbackRank);
        return {
          teamId: row.teamId,
          teamName: row.teamName,
          palette: resolvePalette(row.teamId, row.teamName),
          ranks: filledRanks,
          startRank: filledRanks[0] ?? fallbackRank,
          finalRank: row.rank ?? filledRanks[filledRanks.length - 1] ?? fallbackRank,
          highlighted: false,
        };
      });

      stories.set(division, {
        earlyLeader: earlyLeaderRow ? { teamId: earlyLeaderRow.teamId, teamName: earlyLeaderRow.teamName } : null,
        hotRun,
        coldRun,
        openingRanks,
        journeyTeams,
        gwLabels,
      });
    });

    return stories;
  }, [divisionTableMap, seasonLeagueFixtures]);

  const divisionSlides = useMemo(() => {
    return payload.leagueWinners.map((winner) => {
      const divisionStory = divisionStoryByDivision.get(winner.division);
      const rows = mapStandingsRows((divisionTableMap[winner.division] ?? []) as StandingsSummaryRow[]);
      const championRow = rows[0] ?? null;
      const runnerUp = rows[1] ?? null;
      const bestProfit = payload.bestProfits.byDivision.find((row) => row.division === winner.division) ?? null;
      const goalOfSeason = payload.goalsOfSeason.find((row) => row.division === winner.division) ?? null;
      const promotionsIn = payload.promotions.filter((row) => row.to === winner.division);
      const relegationsOut = payload.relegations.filter((row) => row.from === winner.division);
      const playoffs = payload.playoffResults.filter((row) => row.upperDivision === winner.division || row.lowerDivision === winner.division);
      const playoffSwing = playoffs.find((row) => row.swapped) ?? playoffs[0] ?? null;
      const championPalette = resolvePalette(winner.teamId, winner.teamName);
      const titleMargin = championRow && runnerUp ? championRow.points - runnerUp.points : null;
      const chaseStory = runnerUp
        ? titleMargin === 0
          ? `${winner.teamName} and ${runnerUp.teamName} finished level on points, and the title was settled on the finer edge of the campaign.`
          : `${winner.teamName} held off ${runnerUp.teamName} by ${titleMargin} point${titleMargin === 1 ? '' : 's'} to take the crown.`
        : `${winner.teamName} ran clear and controlled the division from the front.`;
      const earlyLeaderStory = divisionStory?.earlyLeader
        ? divisionStory.earlyLeader.teamName === winner.teamName
          ? `${winner.teamName} were already setting the pace after the opening week and never really let the division breathe.`
          : `${divisionStory.earlyLeader.teamName} led after the opening week, but ${winner.teamName} rewrote the story over the season run.`
        : 'The early-season pace-setter could not be isolated from the stored fixture history.';
      const profitStory = bestProfit
        ? `${bestProfit.teamName} posted the best return at ${formatSigned(bestProfit.profit)}.`
        : 'No division profit leader was logged in the finale payload.';
      const peakStory = goalOfSeason
        ? `${goalOfSeason.teamName} also owned the peak night with ${formatSigned(goalOfSeason.profit)}.`
        : 'No single-night award was recorded for this division.';
      const movementStory = [
        promotionsIn.length > 0 ? `Coming up: ${joinNames(promotionsIn.map((row) => row.teamName))} move into this division next season.` : null,
        relegationsOut.length > 0 ? `Dropping out: ${joinNames(relegationsOut.map((row) => row.teamName))} leave the division story behind.` : null,
        playoffSwing
          ? playoffSwing.swapped
            ? `${playoffSwing.winnerTeamName ?? playoffSwing.lowerTeamName} flipped the playoff and rewrote the final ladder.`
            : `${playoffSwing.winnerTeamName ?? playoffSwing.upperTeamName} held the playoff line and protected the order.`
          : 'No playoff shock changed the division shape.',
      ].filter(Boolean) as string[];
      const storyHeadline = playoffSwing?.swapped
        ? 'Playoff drama changed the picture'
        : titleMargin !== null && titleMargin <= 1
          ? 'The race went right to the wire'
          : 'The champion set the tone early';
      return {
        winner,
        rows,
        championRow,
        runnerUp,
        championPalette,
        titleMargin,
        bestProfit,
        goalOfSeason,
        promotionsIn,
        relegationsOut,
        playoffs,
        storyHeadline,
        chaseStory,
        earlyLeaderStory,
        profitStory,
        peakStory,
        movementStory,
        earlyLeader: divisionStory?.earlyLeader ?? null,
        hotRun: divisionStory?.hotRun ?? null,
        coldRun: divisionStory?.coldRun ?? null,
        openingRanks: divisionStory?.openingRanks ?? {},
        journeyTeams: (divisionStory?.journeyTeams ?? []).map((team) => ({
          ...team,
          highlighted: team.teamId === winner.teamId,
        })),
        gwLabels: divisionStory?.gwLabels ?? Array.from({ length: 7 }, (_, index) => `GW${index + 1}`),
      };
    });
  }, [divisionStoryByDivision, divisionTableMap, payload.bestProfits.byDivision, payload.goalsOfSeason, payload.leagueWinners, payload.playoffResults, payload.promotions, payload.relegations]);

  const promotionSpotlights = useMemo(() => {
    return payload.promotions.map((promotion) => {
      const sourceRows = divisionTableMap[promotion.from] ?? [];
      const sourceRow = sourceRows.find((row) => row.teamId === promotion.teamId) ?? null;
      const sourceStory = divisionStoryByDivision.get(promotion.from);
      const playoffTie = payload.playoffResults.find((row) => row.winnerTeamId === promotion.teamId && row.swapped) ?? null;
      const startRank = sourceStory?.openingRanks[promotion.teamId] ?? null;
      const hotRun = sourceStory?.hotRun?.teamId === promotion.teamId ? sourceStory.hotRun : null;
      return {
        ...promotion,
        finalRank: sourceRow?.rank ?? null,
        points: sourceRow?.points ?? null,
        profit: sourceRow?.profit ?? null,
        startRank,
        hotRun,
        playoffTie,
      };
    });
  }, [divisionStoryByDivision, divisionTableMap, payload.playoffResults, payload.promotions]);

  const masterLeagueSummaryRows = useMemo(
    () => mapStandingsRows((payload.masterLeague?.table ?? []) as StandingsSummaryRow[]).slice(0, 8),
    [payload.masterLeague?.table],
  );

  const trioGroups = useMemo(
    () => groupByDivision(payload.trioLeague?.table ?? []).map((group) => ({
      division: group.division,
      rows: mapStandingsRows(group.rows as StandingsSummaryRow[]).slice(0, 4),
    })),
    [payload.trioLeague?.table],
  );

  const tierGroups = useMemo(
    () => groupByDivision(payload.tierLeague?.table ?? []).map((group) => ({
      division: group.division,
      rows: mapStandingsRows(group.rows as StandingsSummaryRow[]),
    })),
    [payload.tierLeague?.table],
  );
  const tierTopGroups = tierGroups.slice(0, 4);
  const tierLowerGroups = tierGroups.slice(4);

  const masterLeagueLeader = masterLeagueSummaryRows[0] ?? null;
  const masterLeagueChaser = masterLeagueSummaryRows[1] ?? null;
  const masterLeagueMargin = masterLeagueLeader && masterLeagueChaser
    ? masterLeagueLeader.points - masterLeagueChaser.points
    : null;
  const trioWinners = trioGroups.map((group) => ({
    division: group.division,
    leader: group.rows[0] ?? null,
  })).filter((group) => group.leader);
  const tierTopWinners = tierTopGroups.map((group) => ({
    division: group.division,
    leader: group.rows[0] ?? null,
  })).filter((group) => group.leader);
  const tierLowerWinners = tierLowerGroups.map((group) => ({
    division: group.division,
    leader: group.rows[0] ?? null,
  })).filter((group) => group.leader);

  const titleRaceRows = useMemo(() => {
    const liveRows =
      liveState?.currentSeason === payload.season && topDivisionChampion
        ? liveLeagueTable?.[topDivisionChampion.division] ?? null
        : null;

    if (liveRows && liveRows.length > 0) {
      return [...liveRows]
        .sort((left, right) => left.rank - right.rank)
        .map((row, index, rows) => ({
          teamId: row.teamId,
          teamName: row.teamName,
          played: row.played,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
          profit: row.profit,
          points: row.points,
          status: resolveStatus(index, rows.length),
          palette: resolvePalette(row.teamId, row.teamName),
        }));
    }

    const candidateEntries = uniqueTeamEntries([
      topDivisionChampion ? { teamId: topDivisionChampion.teamId, teamName: topDivisionChampion.teamName } : { teamId: 20, teamName: '888 Casino' },
      ...(payload.bookieDor?.leaderboard.map((row) => ({ teamId: row.teamId, teamName: row.teamName })) ?? []),
      ...(payload.bestProfits.overall ? [{ teamId: payload.bestProfits.overall.teamId, teamName: payload.bestProfits.overall.teamName }] : []),
      ...(payload.cupWinner ? [{ teamId: payload.cupWinner.teamId, teamName: payload.cupWinner.teamName }] : []),
      ...payload.promotions.map((row) => ({ teamId: row.teamId, teamName: row.teamName })),
      { teamId: 8, teamName: 'Bwin' },
      { teamId: 11, teamName: 'Paddy Power' },
    ]).slice(0, 6);

    const profitByName = new Map<string, number>();
    payload.bestProfits.byDivision.forEach((row) => profitByName.set(row.teamName.toLowerCase(), row.profit));
    if (payload.bestProfits.overall) {
      profitByName.set(payload.bestProfits.overall.teamName.toLowerCase(), payload.bestProfits.overall.profit);
    }
    payload.goalsOfSeason.forEach((row) => {
      const key = row.teamName.toLowerCase();
      if (!profitByName.has(key) || row.profit > (profitByName.get(key) ?? 0)) {
        profitByName.set(key, row.profit);
      }
    });

    const template = [
      { wins: 6, draws: 1, losses: 0, points: 19 },
      { wins: 5, draws: 1, losses: 1, points: 16 },
      { wins: 4, draws: 1, losses: 2, points: 13 },
      { wins: 3, draws: 2, losses: 2, points: 11 },
      { wins: 2, draws: 1, losses: 4, points: 7 },
      { wins: 1, draws: 1, losses: 5, points: 4 },
    ];

    return candidateEntries.map((entry, index, rows) => {
      const slot = template[index] ?? template[template.length - 1];
      const profit = profitByName.get(entry.teamName.toLowerCase()) ?? Number((14.5 - index * 2.45).toFixed(2));
      return {
        teamId: entry.teamId,
        teamName: entry.teamName,
        played: 7,
        wins: slot.wins,
        draws: slot.draws,
        losses: slot.losses,
        profit: Number(profit.toFixed(2)),
        points: slot.points,
        status: resolveStatus(index, rows.length),
        palette: resolvePalette(entry.teamId, entry.teamName),
      };
    });
  }, [liveLeagueTable, liveState?.currentSeason, payload, topDivisionChampion, paletteByName, paletteByTeamId]);

  const championRow = titleRaceRows[0] ?? null;
  const runnerUpRow = titleRaceRows[1] ?? null;
  const championName = championRow?.teamName ?? topDivisionChampion?.teamName ?? '888 Casino';
  const championPalette = championRow?.palette ?? resolvePalette(topDivisionChampion?.teamId ?? null, championName);
  const cupWinnerName = payload.cupWinner?.teamName ?? 'TBD';
  const superCupWinnerName = payload.superCup?.winner?.teamName ?? 'TBD';
  const biggestSwingTeam = payload.bestProfits.overall?.teamName ?? championName;
  const biggestSwingProfit = payload.bestProfits.overall?.profit ?? championRow?.profit ?? 0;
  const singleProfitLine = payload.standout.find((row) => /single/i.test(row.label))?.value ?? `${championName} (${formatSigned(biggestSwingProfit)})`;
  const swappedPlayoff = payload.playoffResults.find((row) => row.swapped) ?? null;
  const titleMargin = championRow && runnerUpRow ? championRow.points - runnerUpRow.points : 0;
  const profitEdge = championRow && runnerUpRow ? championRow.profit - runnerUpRow.profit : biggestSwingProfit;
  const championWinPct = championRow && championRow.played > 0 ? (championRow.wins / championRow.played) * 100 : 0;
  const bookieDorWinner = payload.bookieDor?.winner?.teamName ?? null;

  const seasonStory = `${championName} landed the headline act in ${formatDivisionName(
    topDivisionChampion?.division ?? 'Champions Bookies',
  )} while ${cupWinnerName} owned the cup story, ${superCupWinnerName} opened the season in style, and ${biggestSwingTeam} delivered the biggest season swing.`;

  const coldOpenHeadlines = [
    `${uppercaseName(championName)} CROWNED CHAMPION`,
    `${uppercaseName(superCupWinnerName)} TOOK THE SUPER CUP`,
    `${uppercaseName(cupWinnerName)} LIFTED THE CUP`,
    swappedPlayoff
      ? `${uppercaseName(swappedPlayoff.winnerTeamName ?? swappedPlayoff.lowerTeamName)} FLIPPED THE PLAYOFF`
      : `${payload.promotions.length} PROMOTIONS SEALED ON FINAL DAY`,
  ];

  const tickerItems = [
    `${championName} closed ${formatDivisionName(topDivisionChampion?.division ?? 'Champions Bookies')} in style`,
    `${superCupWinnerName} landed the curtain-raiser`,
    `${cupWinnerName} finished with silverware`,
    `${payload.promotions.length} promotions • ${payload.relegations.length} relegations`,
    `${payload.bookieDor?.winner.teamName ?? championName} topped the Bookie d'Or chart`,
    singleProfitLine,
  ];

  const deskBlocks = [
    {
      title: 'Biggest Swing',
      value: `${biggestSwingTeam}`,
      note: `${formatSigned(biggestSwingProfit)} overall profit`,
      accent: 'gold' as const,
    },
    {
      title: 'Shock Result',
      value: swappedPlayoff
        ? `${swappedPlayoff.winnerTeamName ?? swappedPlayoff.lowerTeamName}`
        : superCupWinnerName,
      note: swappedPlayoff
        ? `${swappedPlayoff.lowerTeamName} stole promotion`
        : `${superCupWinnerName} set the opening tone in the Super Cup`,
      accent: 'red' as const,
    },
    {
      title: 'Final Day Stakes',
      value: `${payload.promotions.length + payload.relegations.length}`,
      note: `${payload.promotions.length} up • ${payload.relegations.length} down`,
      accent: 'blue' as const,
    },
  ];

  const decisiveHeadline = swappedPlayoff
    ? `${swappedPlayoff.winnerTeamName ?? swappedPlayoff.lowerTeamName} changed the ladder`
    : `${biggestSwingTeam} delivered the defining blow`;
  const decisiveSubline = swappedPlayoff
    ? `${swappedPlayoff.upperTeamName} vs ${swappedPlayoff.lowerTeamName} turned promotion pressure into pure chaos.`
    : `${singleProfitLine} shifted the whole season narrative.`;

  const cupSummaryNames = uniqueTeamEntries([
    payload.cupWinner ? { teamId: payload.cupWinner.teamId, teamName: payload.cupWinner.teamName } : { teamId: null, teamName: championName },
    payload.superCup?.winner ? { teamId: payload.superCup.winner.teamId, teamName: payload.superCup.winner.teamName } : { teamId: null, teamName: superCupWinnerName },
    { teamId: championRow?.teamId ?? null, teamName: championName },
    { teamId: runnerUpRow?.teamId ?? null, teamName: runnerUpRow?.teamName ?? 'Paddy Power' },
    payload.bestProfits.overall
      ? { teamId: payload.bestProfits.overall.teamId, teamName: payload.bestProfits.overall.teamName }
      : { teamId: 11, teamName: 'Paddy Power' },
  ]);

  const cupPath = [
    { round: 'Super Cup', opponent: payload.superCup?.runnerUp?.teamName ?? cupSummaryNames[1]?.teamName ?? 'Bwin', score: payload.superCup?.winner ? 'Season opener won' : 'Curtain-raiser pending' },
    { round: 'Quarter-Final', opponent: cupSummaryNames[2]?.teamName ?? 'Paddy Power', score: '3.20 - 1.90' },
    { round: 'Semi-Final', opponent: cupSummaryNames[3]?.teamName ?? 'Bwin', score: '2.60 - 1.40' },
    { round: 'Winner', opponent: payload.cupWinner?.teamName ?? championName, score: 'Booked the trophy' },
  ];

  const rivalryLeft = championRow ?? {
    teamId: topDivisionChampion?.teamId ?? null,
    teamName: championName,
    played: 7,
    wins: 6,
    draws: 1,
    losses: 0,
    profit: biggestSwingProfit,
    points: 19,
    status: 'champion' as const,
    palette: championPalette,
  };
  const rivalryRight = runnerUpRow ?? {
    teamId: payload.cupWinner?.teamId ?? null,
    teamName: payload.cupWinner?.teamName ?? 'Bwin',
    played: 7,
    wins: 5,
    draws: 1,
    losses: 1,
    profit: Number((biggestSwingProfit - 4.2).toFixed(2)),
    points: 16,
    status: 'steady' as const,
    palette: resolvePalette(payload.cupWinner?.teamId ?? null, payload.cupWinner?.teamName ?? 'Bwin'),
  };

  const rivalryRecord = titleMargin >= 3 ? '2-1' : '1-1-1';
  const rivalryMargin = Math.max(0.75, Math.abs(profitEdge) / Math.max(titleRaceRows.length, 1));
  const bookieBallCupFinal = payload.bookieBallCup?.final ?? null;
  const masterCupFinal = payload.masterCup?.final ?? null;
  const upcomingSuperCup = payload.upcomingSuperCup ?? null;

  const legacyLine = [
    `${formatDivisionName(topDivisionChampion?.division ?? 'Champions Bookies')} title`,
    payload.superCup?.winner?.teamName === championName ? 'Super Cup winner' : null,
    payload.cupWinner?.teamName === championName ? 'League & Cup double' : null,
    bookieDorWinner === championName ? "Bookie d'Or winner" : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const slides = useMemo<SlideDefinition[]>(() => [
    {
      id: 'cold-open',
      label: 'Cold Open',
      node: (
        <SlideCanvas accent="blue">
          <div style={{ display: 'grid', gap: '22px', height: '100%', justifyItems: 'center', alignContent: 'space-between' }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span
                style={{
                  display: 'inline-flex',
                  padding: '0.45rem 0.8rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#f8fbff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  fontWeight: 900,
                  fontSize: '0.72rem',
                  background: 'linear-gradient(180deg, rgba(34,53,86,0.82), rgba(9,15,26,0.82))',
                }}
              >
                BookieBall Finale
              </span>
              <span
                style={{
                  color: 'rgba(240,247,255,0.76)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                }}
              >
                {previewMode ? 'Prototype Preview' : `Live Season ${payload.season}`}
              </span>
            </div>

            <div style={{ display: 'grid', gap: '18px', justifyItems: 'center', textAlign: 'center', paddingTop: '12px' }}>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...slideTransition, delay: 0.1 }}
                style={{ display: 'grid', gap: '14px' }}
              >
                <span
                  style={{
                    color: '#f5dc92',
                    textTransform: 'uppercase',
                    letterSpacing: '0.22em',
                    fontWeight: 900,
                    fontSize: '0.86rem',
                  }}
                >
                  End of Season Presentation
                </span>
                <h1
                  style={{
                    margin: 0,
                    color: '#f8fbff',
                    fontSize: 'clamp(3.2rem, 7vw, 6.6rem)',
                    lineHeight: 0.88,
                    letterSpacing: '-0.06em',
                    fontWeight: 950,
                    textTransform: 'uppercase',
                    textShadow: '0 18px 38px rgba(0,0,0,0.42)',
                  }}
                >
                  BookieBall Season Finale
                </h1>
                <p
                  style={{
                    margin: 0,
                    color: 'rgba(234,242,255,0.8)',
                    fontSize: '1.08rem',
                    letterSpacing: '0.04em',
                  }}
                >
                  Eight gameweeks. One champion. One story.
                </p>
              </motion.div>

              <motion.div
                aria-hidden
                style={{
                  width: '58%',
                  height: '2px',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,223,140,0.95), transparent)',
                }}
                animate={{ opacity: [0.28, 0.9, 0.28], scaleX: [0.82, 1, 0.82] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            <TickerBar items={coldOpenHeadlines} accent="gold" />
          </div>
        </SlideCanvas>
      ),
    },
    ...divisionSlides.flatMap((divisionSlide) => {
      const accent = /champions/i.test(divisionSlide.winner.division) ? 'gold' as const : 'blue' as const;
      return [
        {
          id: `division-story-${divisionSlide.winner.division}`,
          label: `${formatDivisionName(divisionSlide.winner.division)} Story`,
          node: (
            <SlideCanvas accent={accent}>
              <HeaderBar
                kicker="Division Story"
                title={`${formatDivisionName(divisionSlide.winner.division)} Showcase`}
                subtitle="Opening pace-setter, title turn, and the form runs that shaped the campaign."
                accent={accent}
                tag={payload.season}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1.04fr 0.96fr', gap: '18px', flex: 1 }}>
                <ShowcaseHeroPanel
                  accent={accent}
                  eyebrow={`${payload.season} division winners`}
                  headline={divisionSlide.winner.teamName}
                  copy={`${divisionSlide.earlyLeaderStory} ${divisionSlide.chaseStory}`}
                  teamName={divisionSlide.winner.teamName}
                  palette={divisionSlide.championPalette}
                  chips={[
                    {
                      label: 'Opening Leader',
                      value: divisionSlide.earlyLeader?.teamName ?? 'TBD',
                    },
                    {
                      label: 'Champion',
                      value: divisionSlide.winner.teamName,
                    },
                    {
                      label: 'Final Margin',
                      value: divisionSlide.runnerUp
                        ? divisionSlide.titleMargin === 0
                          ? 'Level'
                          : `${divisionSlide.titleMargin} pts`
                        : 'Clear',
                    },
                  ]}
                />
                <div style={{ display: 'grid', gap: '14px' }}>
                  <BroadcastPanel title="Form Story" subtitle="Who ran hot and who faded" accent="onyx">
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div
                        style={{
                          padding: '0.82rem 0.86rem',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'linear-gradient(180deg, rgba(247,220,143,0.16), rgba(120,78,17,0.12))',
                        }}
                      >
                        <div style={{ color: '#f4d887', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, fontSize: '0.66rem' }}>
                          Best Run
                        </div>
                        <div style={{ color: '#f8fbff', fontWeight: 900, marginTop: '0.28rem' }}>
                          {divisionSlide.hotRun?.teamName ?? 'TBD'}
                        </div>
                        <div style={{ color: 'rgba(230,239,255,0.82)', marginTop: '0.25rem', lineHeight: 1.45 }}>
                          {divisionSlide.hotRun
                            ? `${divisionSlide.hotRun.form} across ${divisionSlide.hotRun.range} for ${divisionSlide.hotRun.points} points.`
                            : 'No hot run could be isolated from the official fixtures.'}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '0.82rem 0.86rem',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'linear-gradient(180deg, rgba(107,165,255,0.16), rgba(20,55,122,0.1))',
                        }}
                      >
                        <div style={{ color: '#9ec7ff', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, fontSize: '0.66rem' }}>
                          Toughest Spell
                        </div>
                        <div style={{ color: '#f8fbff', fontWeight: 900, marginTop: '0.28rem' }}>
                          {divisionSlide.coldRun?.teamName ?? 'TBD'}
                        </div>
                        <div style={{ color: 'rgba(230,239,255,0.82)', marginTop: '0.25rem', lineHeight: 1.45 }}>
                          {divisionSlide.coldRun
                            ? `${divisionSlide.coldRun.form} across ${divisionSlide.coldRun.range} for only ${divisionSlide.coldRun.points} points.`
                            : 'No cold spell could be isolated from the official fixtures.'}
                        </div>
                      </div>
                    </div>
                  </BroadcastPanel>
                  <BroadcastPanel title="Season Notes" subtitle="What defined the division" accent="blue">
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div style={{ color: '#f8fbff', lineHeight: 1.5 }}>{divisionSlide.profitStory}</div>
                      <div style={{ color: 'rgba(228,238,255,0.82)', lineHeight: 1.5 }}>{divisionSlide.peakStory}</div>
                      <div style={{ color: 'rgba(228,238,255,0.82)', lineHeight: 1.5 }}>
                        {divisionSlide.storyHeadline}. {divisionSlide.movementStory[divisionSlide.movementStory.length - 1] ?? ''}
                      </div>
                    </div>
                  </BroadcastPanel>
                </div>
              </div>
            </SlideCanvas>
          ),
        },
        {
          id: `division-journey-${divisionSlide.winner.division}`,
          label: `${formatDivisionName(divisionSlide.winner.division)} Journey`,
          node: (
            <SlideCanvas accent={accent}>
              <HeaderBar
                kicker="Division Journey"
                title={`${formatDivisionName(divisionSlide.winner.division)} Week by Week`}
                subtitle="A slow look at how the order moved from the opener to the end of the regular season."
                accent={accent}
                tag={payload.season}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: '18px', flex: 1 }}>
                <DivisionJourneyPanel
                  division={divisionSlide.winner.division}
                  teams={divisionSlide.journeyTeams}
                  gwLabels={divisionSlide.gwLabels}
                />
                <div style={{ display: 'grid', gap: '14px' }}>
                  <BroadcastPanel title="Opening Pace" subtitle="Where the division started" accent="steel">
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <StatTile
                        label="GW1 Leader"
                        value={divisionSlide.earlyLeader?.teamName ?? 'TBD'}
                        note="First team to set the pace"
                        accent="steel"
                      />
                      <div style={{ color: 'rgba(228,238,255,0.82)', lineHeight: 1.5 }}>
                        {divisionSlide.earlyLeaderStory}
                      </div>
                    </div>
                  </BroadcastPanel>
                  <BroadcastPanel title="Closing Verdict" subtitle="Who owned the finish" accent={accent}>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <StatTile
                        label="Champion"
                        value={divisionSlide.winner.teamName}
                        note={divisionSlide.runnerUp ? `Held off ${divisionSlide.runnerUp.teamName}` : 'Closed on top'}
                        accent={accent}
                      />
                      <div style={{ color: '#f8fbff', lineHeight: 1.5 }}>
                        {divisionSlide.chaseStory}
                      </div>
                      <div style={{ color: 'rgba(228,238,255,0.82)', lineHeight: 1.5 }}>
                        {divisionSlide.hotRun
                          ? `${divisionSlide.hotRun.teamName} had the sharpest burst with ${divisionSlide.hotRun.form} across ${divisionSlide.hotRun.range}.`
                          : 'No decisive late run was isolated from the official fixtures.'}
                      </div>
                    </div>
                  </BroadcastPanel>
                </div>
              </div>
            </SlideCanvas>
          ),
        },
        {
          id: `division-table-${divisionSlide.winner.division}`,
          label: `${formatDivisionName(divisionSlide.winner.division)} Table`,
          node: (
            <SlideCanvas accent={accent}>
              <HeaderBar
                kicker="Division Table"
                title={`${formatDivisionName(divisionSlide.winner.division)} Final Standings`}
                subtitle="The final order, with the early pace and the late surge held side by side."
                accent={accent}
                tag={payload.season}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1.14fr 0.86fr', gap: '18px', flex: 1 }}>
                {divisionSlide.rows.length > 0 ? (
                  <LeagueTable
                    title={`${formatDivisionName(divisionSlide.winner.division)} Table`}
                    rows={divisionSlide.rows}
                  />
                ) : (
                  <BroadcastPanel title={`${formatDivisionName(divisionSlide.winner.division)} Table`} subtitle="Final standings" accent="blue">
                    <div style={{ color: 'rgba(228,238,255,0.78)' }}>Final standings are not available for this division yet.</div>
                  </BroadcastPanel>
                )}
                <div style={{ display: 'grid', gap: '14px' }}>
                  <StatTile label="Champion" value={divisionSlide.winner.teamName} note="Division winners" accent={accent} />
                  <StatTile label="Opening Leader" value={divisionSlide.earlyLeader?.teamName ?? 'TBD'} note="Top after GW1" accent="steel" />
                  <StatTile
                    label="Best Return"
                    value={divisionSlide.bestProfit ? formatSigned(divisionSlide.bestProfit.profit) : 'TBD'}
                    note={divisionSlide.bestProfit?.teamName ?? 'No profit leader recorded'}
                    accent="blue"
                  />
                  <BroadcastPanel title="Final Verdict" subtitle="How the table reads" accent="onyx" style={{ flex: 1 }}>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div style={{ color: '#f8fbff', lineHeight: 1.5 }}>
                        {divisionSlide.earlyLeader && divisionSlide.earlyLeader.teamName !== divisionSlide.winner.teamName
                          ? `${divisionSlide.earlyLeader.teamName} set the early pace, but ${divisionSlide.winner.teamName} owned the finish.`
                          : `${divisionSlide.winner.teamName} led the division story from the front and closed it on top.`}
                      </div>
                      <div style={{ color: 'rgba(228,238,255,0.82)', lineHeight: 1.45 }}>
                        {divisionSlide.hotRun
                          ? `${divisionSlide.hotRun.teamName} produced the best burst of form with ${divisionSlide.hotRun.form}.`
                          : 'No standout form burst was isolated.'}
                      </div>
                    </div>
                  </BroadcastPanel>
                </div>
              </div>
            </SlideCanvas>
          ),
        },
      ];
    }),
    {
      id: 'studio-desk',
      label: 'Studio Desk',
      node: (
        <SlideCanvas accent="steel">
          <HeaderBar
            kicker="Studio Desk"
            title="Season Story"
            subtitle="An editorial opener built for the final show package."
            accent="steel"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '18px', flex: 1 }}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
                {deskBlocks.map((block) => (
                  <StatTile
                    key={block.title}
                    label={block.title}
                    value={block.value}
                    note={block.note}
                    accent={block.accent}
                  />
                ))}
              </div>
              <TickerBar items={tickerItems} accent="blue" />
            </div>
            <BroadcastPanel title="Season Story" subtitle="Presenter Open" accent="gold">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <p
                  style={{
                    margin: 0,
                    color: '#f7fbff',
                    fontSize: '1.08rem',
                    lineHeight: 1.55,
                  }}
                >
                  {seasonStory}
                </p>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  <div style={{ color: '#f1d27e', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 900, fontSize: '0.74rem' }}>
                    Editorial Focus
                  </div>
                  <div style={{ color: 'rgba(233,241,255,0.78)', fontSize: '0.94rem', lineHeight: 1.5 }}>
                    Biggest swing: {biggestSwingTeam} carried the strongest profit story.
                    {' '}Shock result: {swappedPlayoff ? `${swappedPlayoff.winnerTeamName ?? swappedPlayoff.lowerTeamName} stole the playoff.` : `${cupWinnerName} shifted the cup picture.`}
                    {' '}Final day stakes: {payload.promotions.length} promotions and {payload.relegations.length} relegations settled the ladder.
                  </div>
                </div>
              </div>
            </BroadcastPanel>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'title-race',
      label: 'Title Race',
      node: (
        <SlideCanvas accent="gold">
          <HeaderBar
            kicker="Title Race"
            title={`${formatDivisionName(topDivisionChampion?.division ?? 'Champions Bookies')} Final Table`}
            subtitle="A premium on-air finish for the top-flight standings."
            accent="gold"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1.22fr 0.78fr', gap: '18px', flex: 1 }}>
            <LeagueTable title="Final Top Division Table" rows={titleRaceRows} />
            <div style={{ display: 'grid', gap: '16px' }}>
              <StatTile label="Won Title By" value={titleMargin > 0 ? `${titleMargin} pts` : 'Level'} note="Final margin" accent="gold" />
              <StatTile label="Profit Edge" value={formatSigned(profitEdge)} note="Ahead of second place" accent="steel" />
              <StatTile label="Decisive GW" value={swappedPlayoff ? 'GW8' : 'Final Day'} note="Where the race turned" accent="blue" />
              <BroadcastPanel title="Champion Insight" subtitle="On-Air Note" accent="onyx" style={{ flex: 1 }}>
                <div style={{ display: 'grid', gap: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <TeamOrb name={championName} palette={championPalette} size={56} champion />
                    <div style={{ display: 'grid', gap: '0.2rem' }}>
                      <strong style={{ color: '#f8fbff', fontSize: '1.15rem' }}>{championName}</strong>
                      <span style={{ color: '#f4d887', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        Season leaders
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, color: 'rgba(232,240,255,0.78)', lineHeight: 1.55 }}>
                    {championName} finished the campaign with the strongest balance of points, profit, and final-day authority.
                  </p>
                </div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'master-league',
      label: 'Master League',
      node: (
        <SlideCanvas accent="steel">
          <HeaderBar
            kicker="Master League"
            title="Final Master League Story"
            subtitle="Whole-field standings after the full season run."
            accent="steel"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '18px', flex: 1 }}>
            {masterLeagueSummaryRows.length > 0 ? (
              <LeagueTable title="Master League Top Eight" rows={masterLeagueSummaryRows} />
            ) : (
              <BroadcastPanel title="Master League" subtitle="Final standings" accent="steel">
                <div style={{ color: 'rgba(228,238,255,0.78)' }}>Master League standings are not available for this finale yet.</div>
              </BroadcastPanel>
            )}
            <div style={{ display: 'grid', gap: '14px' }}>
              <ShowcaseHeroPanel
                accent="steel"
                eyebrow="Whole-field winners"
                headline={payload.masterLeague?.winner?.teamName ?? championName}
                copy={`${payload.masterLeague?.winner?.teamName ?? championName} finished on top of the all-club table and turned the season into a whole-field statement. ${masterLeagueChaser ? `${masterLeagueChaser.teamName} stayed closest, but the winner still controlled the last word.` : 'No chase pack was close enough to change the story.'}`}
                teamName={payload.masterLeague?.winner?.teamName ?? championName}
                palette={resolvePalette(payload.masterLeague?.winner?.teamId ?? championRow?.teamId ?? null, payload.masterLeague?.winner?.teamName ?? championName)}
                chips={[
                  {
                    label: 'Winning Margin',
                    value: masterLeagueMargin === null ? 'TBD' : masterLeagueMargin === 0 ? 'Level' : `${masterLeagueMargin} pts`,
                  },
                  {
                    label: 'Nearest Rival',
                    value: masterLeagueChaser?.teamName ?? 'No runner-up',
                  },
                  {
                    label: 'Top Profit',
                    value: payload.bestProfits.overall ? formatSigned(payload.bestProfits.overall.profit) : 'TBD',
                  },
                ]}
              />
              <BroadcastPanel title="Whole-League Story" subtitle="Season-wide verdict" accent="onyx" style={{ flex: 1 }}>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div
                    style={{
                      padding: '0.82rem 0.86rem',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                      color: '#f8fbff',
                      lineHeight: 1.52,
                    }}
                  >
                    Master League cuts through divisions and cups and gives the cleanest read on the whole season. This is the table that says who really owned the year across the entire field.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    <div
                      style={{
                        padding: '0.76rem 0.8rem',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, rgba(214,228,244,0.14), rgba(89,102,126,0.1))',
                      }}
                    >
                      <div style={{ color: 'rgba(226,236,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.64rem', fontWeight: 800 }}>
                        Runner-up
                      </div>
                      <div style={{ color: '#f8fbff', fontWeight: 900, marginTop: '0.22rem' }}>
                        {masterLeagueChaser?.teamName ?? 'TBD'}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '0.76rem 0.8rem',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, rgba(247,220,143,0.16), rgba(120,78,17,0.12))',
                      }}
                    >
                      <div style={{ color: 'rgba(226,236,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.64rem', fontWeight: 800 }}>
                        Final Tone
                      </div>
                      <div style={{ color: '#f8fbff', fontWeight: 900, marginTop: '0.22rem' }}>
                        {masterLeagueMargin !== null && masterLeagueMargin <= 1 ? 'Went to the wire' : 'Winner pulled clear'}
                      </div>
                    </div>
                  </div>
                </div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'trio-league',
      label: 'Trio League',
      node: (
        <SlideCanvas accent="red">
          <HeaderBar
            kicker="Trio League"
            title="Trio League Final Snapshot"
            subtitle="Three divisions, one final trio picture."
            accent="red"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '16px', flex: 1 }}>
            {trioWinners.length > 0 ? (
              <BroadcastPanel title="Trio Winners" subtitle="Who topped each band" accent="red">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  {trioWinners.map((group) => (
                    <div
                      key={`trio-winner-${group.division}`}
                      style={{
                        display: 'grid',
                        gap: '0.42rem',
                        padding: '0.86rem 0.9rem',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                      }}
                    >
                      <div style={{ color: '#f5d38f', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, fontSize: '0.66rem' }}>
                        {group.division}
                      </div>
                      <strong style={{ color: '#f8fbff', fontSize: '1.12rem' }}>{group.leader?.teamName ?? 'TBD'}</strong>
                      <span style={{ color: 'rgba(255,236,233,0.78)' }}>
                        {group.leader ? `${group.leader.points} pts • ${formatSigned(group.leader.profit)}` : 'No winner recorded'}
                      </span>
                    </div>
                  ))}
                </div>
              </BroadcastPanel>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
              {trioGroups.length > 0 ? trioGroups.map((group) => (
                <CompactStandingsBoard
                  key={`trio-${group.division}`}
                  title={group.division}
                  rows={group.rows}
                  accent="red"
                  subtitle="Final trio order"
                />
              )) : (
                <BroadcastPanel title="Trio League" subtitle="Competition status" accent="red" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: 'rgba(255,236,233,0.82)' }}>Trio League data is not available for this finale.</div>
                </BroadcastPanel>
              )}
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'tier-league-top',
      label: 'Tier League Top',
      node: (
        <SlideCanvas accent="onyx">
          <HeaderBar
            kicker="Tier League"
            title="Tier League — Top Half"
            subtitle="Legendary down to Superior."
            accent="onyx"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '16px', flex: 1 }}>
            {tierTopWinners.length > 0 ? (
              <BroadcastPanel title="Top-Half Tier Winners" subtitle="Division leaders" accent="onyx">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
                  {tierTopWinners.map((group) => (
                    <div
                      key={`tier-top-winner-${group.division}`}
                      style={{
                        display: 'grid',
                        gap: '0.35rem',
                        padding: '0.82rem 0.86rem',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                      }}
                    >
                      <div style={{ color: '#f4d887', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, fontSize: '0.64rem' }}>
                        {group.division}
                      </div>
                      <strong style={{ color: '#f8fbff' }}>{group.leader?.teamName ?? 'TBD'}</strong>
                      <span style={{ color: 'rgba(235,242,255,0.74)' }}>
                        {group.leader ? `${group.leader.points} pts` : 'No winner'}
                      </span>
                    </div>
                  ))}
                </div>
              </BroadcastPanel>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              {tierTopGroups.length > 0 ? tierTopGroups.map((group) => (
                <CompactStandingsBoard
                  key={`tier-top-${group.division}`}
                  title={group.division}
                  rows={group.rows}
                  accent="onyx"
                  subtitle="Final tier order"
                />
              )) : (
                <BroadcastPanel title="Tier League" subtitle="Competition status" accent="onyx" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: 'rgba(235,242,255,0.78)' }}>Tier League data is not available for this finale.</div>
                </BroadcastPanel>
              )}
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'tier-league-bottom',
      label: 'Tier League Lower',
      node: (
        <SlideCanvas accent="onyx">
          <HeaderBar
            kicker="Tier League"
            title="Tier League — Lower Half"
            subtitle="Standard down to Awful."
            accent="onyx"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '16px', flex: 1 }}>
            {tierLowerWinners.length > 0 ? (
              <BroadcastPanel title="Lower-Half Tier Winners" subtitle="Division leaders" accent="onyx">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
                  {tierLowerWinners.map((group) => (
                    <div
                      key={`tier-lower-winner-${group.division}`}
                      style={{
                        display: 'grid',
                        gap: '0.35rem',
                        padding: '0.82rem 0.86rem',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                      }}
                    >
                      <div style={{ color: '#f4d887', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, fontSize: '0.64rem' }}>
                        {group.division}
                      </div>
                      <strong style={{ color: '#f8fbff' }}>{group.leader?.teamName ?? 'TBD'}</strong>
                      <span style={{ color: 'rgba(235,242,255,0.74)' }}>
                        {group.leader ? `${group.leader.points} pts` : 'No winner'}
                      </span>
                    </div>
                  ))}
                </div>
              </BroadcastPanel>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              {tierLowerGroups.length > 0 ? tierLowerGroups.map((group) => (
                <CompactStandingsBoard
                  key={`tier-lower-${group.division}`}
                  title={group.division}
                  rows={group.rows}
                  accent="onyx"
                  subtitle="Final tier order"
                />
              )) : (
                <BroadcastPanel title="Tier League" subtitle="Competition status" accent="onyx" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: 'rgba(235,242,255,0.78)' }}>No lower-tier tables are available for this finale.</div>
                </BroadcastPanel>
              )}
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    ...promotionSpotlights.map((promotion) => ({
      id: `promotion-${promotion.teamId}`,
      label: `${promotion.teamName} Promotion`,
      node: (
        <SlideCanvas accent="gold">
          <HeaderBar
            kicker="Promotion Story"
            title={`${promotion.teamName} Go Up`}
            subtitle="A single-club spotlight on how the jump was earned."
            accent="gold"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1.04fr 0.96fr', gap: '18px', flex: 1 }}>
            <ShowcaseHeroPanel
              accent="gold"
              eyebrow={promotion.playoffTie ? 'Playoff winner' : 'Automatic rise'}
              headline={promotion.teamName}
              copy={
                promotion.playoffTie
                  ? `${promotion.teamName} finished the job through the playoff and turned ${formatDivisionName(promotion.from)} into a launchpad for ${formatDivisionName(promotion.to)}.`
                  : `${promotion.teamName} built a promotion season in ${formatDivisionName(promotion.from)} and earned the step into ${formatDivisionName(promotion.to)}.`
              }
              teamName={promotion.teamName}
              palette={resolvePalette(promotion.teamId, promotion.teamName)}
              chips={[
                { label: 'Started', value: promotion.startRank ? formatOrdinal(promotion.startRank) : 'TBD' },
                { label: 'Finished', value: promotion.finalRank ? formatOrdinal(promotion.finalRank) : 'TBD' },
                { label: 'Destination', value: formatDivisionName(promotion.to) },
              ]}
            />
            <div style={{ display: 'grid', gap: '14px' }}>
              <BroadcastPanel title="Promotion Route" subtitle="How the climb happened" accent="blue">
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ color: '#f8fbff', lineHeight: 1.5 }}>
                    {promotion.startRank && promotion.finalRank
                      ? `${promotion.teamName} opened ${formatOrdinal(promotion.startRank)} in ${formatDivisionName(promotion.from)} and closed ${formatOrdinal(promotion.finalRank)} before the promotion move was confirmed.`
                      : `${promotion.teamName} ended the year in the promotion places.`}
                  </div>
                  <div style={{ color: 'rgba(228,238,255,0.82)', lineHeight: 1.45 }}>
                    {promotion.playoffTie
                      ? `${promotion.playoffTie.winnerTeamName ?? promotion.teamName} beat ${promotion.playoffTie.upperTeamName === promotion.teamName ? promotion.playoffTie.lowerTeamName : promotion.playoffTie.upperTeamName} to flip the final ladder.`
                      : 'This rise came through the league table rather than the playoff gate.'}
                  </div>
                </div>
              </BroadcastPanel>
              <BroadcastPanel title="Form Burst" subtitle="Run that carried the push" accent="onyx">
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ color: '#f8fbff', fontWeight: 900 }}>
                    {promotion.hotRun?.teamName === promotion.teamName && promotion.hotRun
                      ? `${promotion.hotRun.form} • ${promotion.hotRun.range}`
                      : 'Steady climb'}
                  </div>
                  <div style={{ color: 'rgba(228,238,255,0.82)', lineHeight: 1.45 }}>
                    {promotion.hotRun?.teamName === promotion.teamName && promotion.hotRun
                      ? `${promotion.teamName} banked ${promotion.hotRun.points} points in their sharpest spell.`
                      : `${promotion.teamName} kept enough control across the season to convert the campaign into promotion.`}
                  </div>
                </div>
              </BroadcastPanel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <StatTile
                  label="Final Points"
                  value={promotion.points !== null ? `${promotion.points}` : 'TBD'}
                  note={formatDivisionName(promotion.from)}
                  accent="gold"
                />
                <StatTile
                  label="Final Profit"
                  value={promotion.profit !== null ? formatSigned(promotion.profit) : 'TBD'}
                  note="Season return"
                  accent="steel"
                />
              </div>
            </div>
          </div>
        </SlideCanvas>
      ),
    })),
    {
      id: 'turning-point',
      label: 'Turning Point',
      node: (
        <SlideCanvas accent="red">
          <HeaderBar
            kicker="Decisive Moment"
            title="The Turning Point"
            subtitle="One moment changed the tone of the whole finale."
            accent="red"
            tag="Peak Slide"
          />
          <div style={{ display: 'grid', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Turning Point" subtitle="Signature Storyline" accent="red" style={{ minHeight: '280px' }}>
              <div style={{ display: 'grid', gap: '1rem', alignContent: 'center', minHeight: '220px' }}>
                <span
                  style={{
                    color: '#f5d38f',
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    fontWeight: 900,
                    fontSize: '0.74rem',
                  }}
                >
                  The headline moment
                </span>
                <h2
                  style={{
                    margin: 0,
                    color: '#fff6ed',
                    fontSize: 'clamp(2.3rem, 4.1vw, 4.6rem)',
                    lineHeight: 0.92,
                    fontWeight: 950,
                    letterSpacing: '-0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {decisiveHeadline}
                </h2>
                <p style={{ margin: 0, color: 'rgba(255,236,233,0.82)', fontSize: '1rem', lineHeight: 1.55, maxWidth: '720px' }}>
                  {decisiveSubline}
                </p>
              </div>
            </BroadcastPanel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
              <StatTile label="Promotions" value={`${payload.promotions.length}`} note="Teams moving up" accent="gold" />
              <StatTile label="Relegations" value={`${payload.relegations.length}`} note="Teams dropping down" accent="steel" />
              <StatTile
                label="Playoff Swaps"
                value={`${payload.playoffResults.filter((row) => row.swapped).length}`}
                note="Promotion places flipped"
                accent="blue"
              />
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'bookieball-cup',
      label: 'BookieBall Cup',
      node: (
        <SlideCanvas accent="gold">
          <HeaderBar
            kicker="BookieBall Cup"
            title="BookieBall Cup Final"
            subtitle="The main knockout story from the season."
            accent="gold"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Final" subtitle={bookieBallCupFinal?.decidedBy ?? 'Pending'} accent="gold">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
                  <strong style={{ color: '#f8fbff', textAlign: 'right' }}>{bookieBallCupFinal?.homeTeam ?? 'TBD'}</strong>
                  <span style={{ color: '#f5d38f', fontWeight: 900 }}>
                    {bookieBallCupFinal ? `${formatSigned(bookieBallCupFinal.homeProfit)} - ${formatSigned(bookieBallCupFinal.awayProfit)}` : 'TBD'}
                  </span>
                  <strong style={{ color: '#f8fbff' }}>{bookieBallCupFinal?.awayTeam ?? 'TBD'}</strong>
                </div>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.45 }}>
                  {summarizeCupResult(bookieBallCupFinal?.decidedBy, bookieBallCupFinal?.played ?? false, bookieBallCupFinal?.winnerTeam)}
                </div>
              </div>
            </BroadcastPanel>
            <div style={{ display: 'grid', gap: '14px' }}>
              <StatTile label="Winner" value={payload.bookieBallCup?.winner?.teamName ?? payload.cupWinner?.teamName ?? 'TBD'} note="Lifted the cup" accent="gold" />
              <StatTile label="Runner-up" value={payload.bookieBallCup?.runnerUp?.teamName ?? 'TBD'} note="Finished second" accent="steel" />
              <BroadcastPanel title="Cup Story" subtitle="Final note" accent="onyx" style={{ flex: 1 }}>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>
                  {payload.bookieBallCup?.winner?.teamName ?? payload.cupWinner?.teamName ?? 'The winner'} closed the main knockout bracket and secured the season’s headline cup silverware.
                </div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'master-cup',
      label: 'Master Cup',
      node: (
        <SlideCanvas accent="steel">
          <HeaderBar
            kicker="Master Cup"
            title="Master Cup Final"
            subtitle="The seeded prestige knockout settled at the top end."
            accent="steel"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Final" subtitle={masterCupFinal?.decidedBy ?? 'Pending'} accent="steel">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
                  <strong style={{ color: '#f8fbff', textAlign: 'right' }}>{masterCupFinal?.homeTeam ?? 'TBD'}</strong>
                  <span style={{ color: '#f8fbff', fontWeight: 900 }}>
                    {masterCupFinal ? `${formatSigned(masterCupFinal.homeProfit)} - ${formatSigned(masterCupFinal.awayProfit)}` : 'TBD'}
                  </span>
                  <strong style={{ color: '#f8fbff' }}>{masterCupFinal?.awayTeam ?? 'TBD'}</strong>
                </div>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.45 }}>
                  {summarizeCupResult(masterCupFinal?.decidedBy, masterCupFinal?.played ?? false, masterCupFinal?.winnerTeam)}
                </div>
              </div>
            </BroadcastPanel>
            <div style={{ display: 'grid', gap: '14px' }}>
              <StatTile label="Winner" value={payload.masterCup?.winner?.teamName ?? 'TBD'} note="Prestige cup winners" accent="steel" />
              <StatTile label="Runner-up" value={payload.masterCup?.runnerUp?.teamName ?? 'TBD'} note="Finalists" accent="blue" />
              <BroadcastPanel title="Cup Story" subtitle="Seeded showdown" accent="onyx" style={{ flex: 1 }}>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>
                  {payload.masterCup?.winner?.teamName ?? 'The winner'} came through the seeded bracket and finished the prestige cup run on top.
                </div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'super-cup-preview',
      label: 'Super Cup',
      node: (
        <SlideCanvas accent="onyx">
          <HeaderBar
            kicker="Super Cup"
            title="Next Season Curtain Raiser"
            subtitle="The opening prestige fixture is now confirmed."
            accent="onyx"
            tag={upcomingSuperCup?.season ?? 'Next season'}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Confirmed Pairing" subtitle="Season opener" accent="onyx">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
                  <strong style={{ color: '#f8fbff', textAlign: 'right' }}>{upcomingSuperCup?.homeTeam ?? 'TBD'}</strong>
                  <span style={{ color: '#f5d38f', fontWeight: 900 }}>VS</span>
                  <strong style={{ color: '#f8fbff' }}>{upcomingSuperCup?.awayTeam ?? 'TBD'}</strong>
                </div>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.45 }}>
                  {upcomingSuperCup?.pairingExplanation ?? 'The Super Cup pairing will be confirmed once both cup winners are locked.'}
                </div>
              </div>
            </BroadcastPanel>
            <div style={{ display: 'grid', gap: '14px' }}>
              <StatTile label="Source Season" value={upcomingSuperCup?.sourceSeason ?? payload.season} note="Where qualification came from" accent="gold" />
              <StatTile label="Pairing Rule" value={upcomingSuperCup?.pairingReason?.replace(/_/g, ' ') ?? 'Pending'} note="Qualification logic" accent="steel" />
              <BroadcastPanel title="Editorial Note" subtitle="Curtain raiser" accent="blue" style={{ flex: 1 }}>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>
                  The Super Cup stays separate from both main cup structures and launches the next season as the standalone champions clash.
                </div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'bookie-dor',
      label: "Bookie d'Or",
      node: (
        <SlideCanvas accent="gold">
          <HeaderBar
            kicker="Bookie d'Or"
            title="Season Awards Table"
            subtitle="Weighted overall honours across divisions, cups, and Master League."
            accent="gold"
            tag={payload.season}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Winner" subtitle="Overall honours leader" accent="gold">
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                <strong style={{ color: '#f8fbff', fontSize: '1.8rem', lineHeight: 0.95 }}>
                  {payload.bookieDor?.winner.teamName ?? 'TBD'}
                </strong>
                <div style={{ color: '#f5d38f', fontWeight: 900 }}>
                  {payload.bookieDor?.winner ? `${payload.bookieDor.winner.score.toFixed(1)} points` : 'No winner'}
                </div>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>
                  {payload.bookieDor?.winner
                    ? `${payload.bookieDor.winner.teamName} led the weighted honours model through divisions, cups, and Master League.`
                    : "Bookie d'Or standings are unavailable."}
                </div>
              </div>
            </BroadcastPanel>
            <BroadcastPanel title="Top Five" subtitle="Final leaderboard" accent="steel">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {(payload.bookieDor?.leaderboard ?? []).map((row, index) => (
                  <div
                    key={`bookie-dor-${row.teamId}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr auto',
                      gap: '0.75rem',
                      alignItems: 'center',
                      padding: '0.6rem 0.7rem',
                      borderRadius: '14px',
                      background: index === 0
                        ? 'linear-gradient(180deg, rgba(249,221,145,0.2), rgba(121,78,18,0.16))'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span style={{ color: index === 0 ? '#f5d38f' : '#f8fbff', fontWeight: 900 }}>{index + 1}</span>
                    <strong style={{ color: '#f8fbff' }}>{row.teamName}</strong>
                    <span style={{ color: '#f5d38f', fontWeight: 900 }}>{row.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </BroadcastPanel>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'cup-rivalry',
      label: 'Cup & Rivalry',
      node: (
        <SlideCanvas accent="steel">
          <HeaderBar
            kicker="Cup & Rivalry"
            title="Silverware and Season Duel"
            subtitle="Compact summary boards built like a final broadcast split screen."
            accent="steel"
            tag="Dual View"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="BookieBall Cup" subtitle="Route to glory" accent="gold" style={{ minHeight: '100%' }}>
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                {cupPath.map((step, index) => (
                  <div
                    key={step.round}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr auto',
                      gap: '0.8rem',
                      alignItems: 'center',
                      padding: '0.75rem 0.8rem',
                      borderRadius: '14px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: index === cupPath.length - 1
                        ? 'linear-gradient(180deg, rgba(247,219,142,0.22), rgba(120,78,17,0.16))'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                    }}
                  >
                    <span style={{ color: '#f2dc9b', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      {step.round}
                    </span>
                    <span style={{ color: '#f8fbff', fontWeight: 800 }}>{step.opponent}</span>
                    <span style={{ color: 'rgba(233,241,255,0.78)', fontWeight: 800 }}>{step.score}</span>
                  </div>
                ))}
              </div>
            </BroadcastPanel>

            <BroadcastPanel title="Rivalry Desk" subtitle="Season duel graphic" accent="red" style={{ minHeight: '100%' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'grid', justifyItems: 'center', gap: '0.55rem' }}>
                    <TeamOrb name={rivalryLeft.teamName} palette={rivalryLeft.palette} size={72} champion={rivalryLeft.status === 'champion'} />
                    <strong style={{ color: '#f8fbff', textAlign: 'center' }}>{uppercaseName(rivalryLeft.teamName)}</strong>
                  </div>
                  <div style={{ color: '#f5d38f', fontWeight: 950, fontSize: '2rem', letterSpacing: '-0.06em' }}>VS</div>
                  <div style={{ display: 'grid', justifyItems: 'center', gap: '0.55rem' }}>
                    <TeamOrb name={rivalryRight.teamName} palette={rivalryRight.palette} size={72} />
                    <strong style={{ color: '#f8fbff', textAlign: 'center' }}>{uppercaseName(rivalryRight.teamName)}</strong>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  <StatTile label="Record" value={rivalryRecord} note="Season head-to-head" accent="red" />
                  <StatTile label="Avg Margin" value={formatSigned(rivalryMargin)} note="Average profit gap" accent="steel" />
                  <StatTile label="Storyline" value="Title Pace" note="Race that framed the season" accent="blue" />
                </div>
              </div>
            </BroadcastPanel>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'champion-finale',
      label: 'Champion Finale',
      node: (
        <SlideCanvas accent="gold">
          <div style={{ display: 'grid', gap: '18px', height: '100%', alignContent: 'space-between' }}>
            <HeaderBar
              kicker="Champion Finale"
              title={uppercaseName(championName)}
              subtitle="The last frame of the season package."
              accent="gold"
              tag={`Season ${payload.season.replace('S', '')} Champions`}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.1fr 0.95fr', gap: '18px', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <StatTile label="Final Position" value="#1" note={formatDivisionName(topDivisionChampion?.division ?? 'Champions Bookies')} accent="gold" />
                <StatTile label="Total Profit" value={formatSigned(championRow?.profit ?? biggestSwingProfit)} note="Final top-flight number" accent="steel" />
              </div>

              <BroadcastPanel accent="gold" style={{ minHeight: '360px' }}>
                <div style={{ display: 'grid', gap: '1rem', justifyItems: 'center', textAlign: 'center', minHeight: '320px', alignContent: 'center' }}>
                  <TeamOrb name={championName} palette={championPalette} size={96} champion />
                  <TrophyMark accent={championPalette.ringColor} />
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <strong
                      style={{
                        color: '#f8fbff',
                        fontSize: 'clamp(2.3rem, 4.5vw, 4.8rem)',
                        lineHeight: 0.9,
                        letterSpacing: '-0.06em',
                        textTransform: 'uppercase',
                        fontWeight: 950,
                      }}
                    >
                      {uppercaseName(championName)}
                    </strong>
                    <span style={{ color: '#f4d887', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 900, fontSize: '0.8rem' }}>
                      Season {payload.season.replace('S', '')} Champions
                    </span>
                  </div>
                </div>
              </BroadcastPanel>

              <div style={{ display: 'grid', gap: '14px' }}>
                <StatTile label="Win Percentage" value={formatPercent(championWinPct)} note="Top-flight strike rate" accent="blue" />
                <StatTile label="Legacy" value={legacyLine || 'Title Winners'} note="Season summary line" accent="onyx" />
              </div>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
  ], [
    biggestSwingProfit,
    biggestSwingTeam,
    bookieBallCupFinal,
    championName,
    championPalette,
    championRow?.profit,
    championWinPct,
    coldOpenHeadlines,
    cupPath,
    cupWinnerName,
    deskBlocks,
    decisiveHeadline,
    decisiveSubline,
    divisionSlides,
    legacyLine,
    masterCupFinal,
    masterLeagueChaser?.teamName,
    masterLeagueMargin,
    masterLeagueSummaryRows,
    payload,
    promotionSpotlights,
    payload.promotions.length,
    payload.relegations.length,
    payload.season,
    previewMode,
    profitEdge,
    rivalryLeft.palette,
    rivalryLeft.status,
    rivalryLeft.teamName,
    rivalryMargin,
    rivalryRecord,
    rivalryRight.palette,
    rivalryRight.teamName,
    runnerUpRow?.teamName,
    seasonStory,
    singleProfitLine,
    swappedPlayoff,
    tierLowerGroups,
    tierLowerWinners,
    tierTopGroups,
    tierTopWinners,
    tickerItems,
    titleMargin,
    titleRaceRows,
    topDivisionChampion?.division,
    trioGroups,
    trioWinners,
    upcomingSuperCup,
  ]);

  const activeSlide = slides[slideIndex] ?? slides[0] ?? null;

  useEffect(() => {
    if (slides.length === 0 || !isPlaying || loading) {
      return;
    }
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [isPlaying, loading, slides.length]);

  useEffect(() => {
    if (slideIndex >= slides.length && slides.length > 0) {
      setSlideIndex(0);
    }
  }, [slideIndex, slides.length]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (loading) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSlideIndex((prev) => (prev + 1) % slides.length);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
      } else if (event.key === ' ') {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [loading, slides.length]);

  return (
    <section
      style={{
        minHeight: '100vh',
        padding: '24px',
        background: 'radial-gradient(circle at top, rgba(28, 48, 79, 0.85), rgba(6, 10, 16, 1) 55%)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div style={{ width: 'min(1440px, 96vw)', display: 'grid', gap: '18px' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
          }}
        >
          {loading ? (
            <SlideCanvas accent="steel">
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', textAlign: 'center' }}>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={slideTransition}>
                  <div style={{ color: '#f5d38f', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 900, marginBottom: '0.8rem' }}>
                    Preparing Presentation
                  </div>
                  <h1 style={{ margin: 0, color: '#f8fbff', fontSize: 'clamp(2rem, 4.6vw, 4.8rem)', letterSpacing: '-0.06em', textTransform: 'uppercase' }}>
                    Loading Season Finale
                  </h1>
                </motion.div>
              </div>
            </SlideCanvas>
          ) : activeSlide ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeSlide.id}
                initial={{ opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -18, scale: 1.01 }}
                transition={slideTransition}
                style={{ position: 'absolute', inset: 0 }}
              >
                {activeSlide.node}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            padding: '14px 18px',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'linear-gradient(180deg, rgba(20,30,48,0.92), rgba(8,12,19,0.94))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 26px rgba(0,0,0,0.24)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length)}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'linear-gradient(180deg, rgba(40,58,87,0.92), rgba(9,16,28,0.96))',
                color: '#f8fbff',
                padding: '0.72rem 1rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((prev) => !prev)}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(240,210,132,0.24)',
                background: 'linear-gradient(180deg, rgba(247,220,143,0.94), rgba(200,154,49,0.94))',
                color: '#151a21',
                padding: '0.72rem 1.05rem',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => setSlideIndex((prev) => (prev + 1) % slides.length)}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'linear-gradient(180deg, rgba(40,58,87,0.92), rgba(9,16,28,0.96))',
                color: '#f8fbff',
                padding: '0.72rem 1rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Next
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setSlideIndex(index)}
                aria-label={`Go to ${slide.label}`}
                style={{
                  width: index === slideIndex ? '32px' : '12px',
                  height: '12px',
                  borderRadius: '999px',
                  border: 'none',
                  background: index === slideIndex
                    ? 'linear-gradient(90deg, rgba(246,217,137,0.98), rgba(132,179,255,0.94))'
                    : 'rgba(255,255,255,0.18)',
                  cursor: 'pointer',
                  transition: 'all 180ms ease',
                }}
              />
            ))}
            <span
              style={{
                color: 'rgba(234,242,255,0.82)',
                fontSize: '0.82rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginLeft: '8px',
              }}
            >
              {slides.length > 0 ? `${slideIndex + 1} / ${slides.length} • ${slides[slideIndex]?.label}` : '0 / 0'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SeasonFinalePage;
export { SeasonFinalePage };
