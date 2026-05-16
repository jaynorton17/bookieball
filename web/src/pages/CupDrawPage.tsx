import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CupTabs } from '../components/CompetitionTabs';
import { api } from '../lib/api';
import { TeamBadge } from '../components/TeamBadge';
import { displayDivisionName, getDivisionOrderForSeason } from '../lib/divisionLabels';
import { classifyUpset, type TeamRating } from '../lib/leagueUtils';

type SlotBall = {
  label: string;
  division: string | null;
  ballColor: string;
  ringColor: string;
  textColor: string;
};

type CupFixture = {
  id: number;
  round: number;
  matchNumber: number;
  gw: string;
  roundName: string;
  homeTeam: string | null;
  homeDivision: string | null;
  awayTeam: string | null;
  awayDivision: string | null;
  sourceMatchA: number | null;
  sourceMatchB: number | null;
  winnerTeam: string | null;
};

type CupRoundStatus = {
  gw: string;
  roundName: string;
  totalFixtures: number;
  playableFixtures: number;
  resolvedFixtures: number;
  complete: boolean;
  locked: boolean;
};

type CupDebug = {
  tieBreakMode: 'random' | 'lower_team_id';
  roundStatus: CupRoundStatus[];
  recentAudit: Array<{
    id: number;
    gw: string;
    matchNumber: number;
    action: string;
    reason: string;
    oldWinner: string | null;
    newWinner: string | null;
    createdAt: string;
  }>;
};

type DrawPair = {
  matchNumber: number;
  home: SlotBall;
  away: SlotBall;
};

type CupGraphicsMode = 'studio' | 'classic';

const LEFT_ROW_STARTS: Record<number, number[]> = {
  8: [2, 4, 6, 8, 10, 12, 14, 16],
  4: [3, 7, 11, 15],
  2: [5, 13],
  1: [9],
};

const BYE_BALL: SlotBall = {
  label: 'BYE',
  division: null,
  ballColor: '#f1f1f1',
  ringColor: '#333333',
  textColor: '#111111',
};
const TBD_BALL: SlotBall = {
  label: 'TBD',
  division: null,
  ballColor: '#c9d6e6',
  ringColor: '#2a3a4d',
  textColor: '#102136',
};

const GW_ORDER = ['GW2', 'GW3', 'GW4', 'GW5', 'GW6'] as const;

function mapFixtureBall(
  teamName: string | null,
  division: string | null,
  teamMap: Map<string, { ballColor: string; ringColor: string; textColor: string }>,
  allowBye: boolean,
): SlotBall {
  if (!teamName) {
    return allowBye ? BYE_BALL : TBD_BALL;
  }
  return {
    label: teamName,
    division,
    ballColor: teamMap.get(teamName)?.ballColor ?? '#77efdb',
    ringColor: teamMap.get(teamName)?.ringColor ?? '#0f2b36',
    textColor: teamMap.get(teamName)?.textColor ?? '#0f2b36',
  };
}

function formatDivision(division: string | null): string {
  if (!division) {
    return '';
  }
  return displayDivisionName(division);
}

function matchLabel(fixture: CupFixture): string {
  const allowBye = fixture.gw === 'GW2';
  if (fixture.homeTeam && fixture.awayTeam) {
    return `Match ${fixture.matchNumber}: ${fixture.homeTeam} vs ${fixture.awayTeam}`;
  }
  if (allowBye) {
    return `Match ${fixture.matchNumber}: ${fixture.homeTeam ?? 'BYE'} vs ${fixture.awayTeam ?? 'BYE'}`;
  }
  const homeLabel = fixture.homeTeam ?? `Winner of Match ${fixture.sourceMatchA ?? '?'}`;
  const awayLabel = fixture.awayTeam ?? `Winner of Match ${fixture.sourceMatchB ?? '?'}`;
  return `Match ${fixture.matchNumber}: ${homeLabel} vs ${awayLabel}`;
}

function shortTeamName(name: string): string {
  if (name === 'BYE' || name === 'TBD') {
    return name;
  }
  if (name.length <= 12) {
    return name;
  }
  const words = name.split(' ').filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]} ${words[1][0]}.`;
  }
  return `${name.slice(0, 10)}..`;
}

function divisionRank(division: string | null, season: string): number {
  const order = getDivisionOrderForSeason(season);
  const idx = division ? order.indexOf(division) : -1;
  return idx >= 0 ? idx : 99;
}

function fixtureKey(gw: string, matchNumber: number): string {
  return `${gw}-${matchNumber}`;
}

function previousGw(gw: string): string | null {
  const idx = GW_ORDER.indexOf(gw as (typeof GW_ORDER)[number]);
  return idx > 0 ? GW_ORDER[idx - 1] : null;
}

export function CupDrawPage() {
  const [currentGw, setCurrentGw] = useState('GW1');
  const [cupDrawStarted, setCupDrawStarted] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [activeBall, setActiveBall] = useState<SlotBall | null>(null);
  const [activePair, setActivePair] = useState<DrawPair | null>(null);
  const [activeMatchNumber, setActiveMatchNumber] = useState<number | null>(null);
  const [leftWheel, setLeftWheel] = useState('...');
  const [rightWheel, setRightWheel] = useState('...');
  const [leftLocked, setLeftLocked] = useState(false);
  const [rightLocked, setRightLocked] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [revealedPairs, setRevealedPairs] = useState<DrawPair[]>([]);
  const [cupFixtures, setCupFixtures] = useState<CupFixture[]>([]);
  const [teams, setTeams] = useState<Array<{
    id: number;
    name: string;
    division: string;
    ballColor: string | null;
    ringColor: string | null;
    textColor: string | null;
  }>>([]);
  const [roundStatus, setRoundStatus] = useState<CupRoundStatus[]>([]);
  const [cupDebug, setCupDebug] = useState<CupDebug | null>(null);
  const [tieBreakMode, setTieBreakMode] = useState<'random' | 'lower_team_id'>('lower_team_id');
  const [overrideGw, setOverrideGw] = useState('GW2');
  const [overrideFixtureId, setOverrideFixtureId] = useState<number>(0);
  const [overrideWinner, setOverrideWinner] = useState<'clear' | 'home' | 'away'>('clear');
  const [resetRoundGw, setResetRoundGw] = useState('GW3');
  const [compactNames, setCompactNames] = useState(true);
  const [zoomPct, setZoomPct] = useState(100);
  const [ratings, setRatings] = useState<TeamRating[]>([]);
  const [graphicsMode, setGraphicsMode] = useState<CupGraphicsMode>('studio');
  const [currentEntries, setCurrentEntries] = useState<Array<{
    id: number;
    gw: string;
    teamId: number;
    teamName: string;
    profit: number;
    spins: number | null;
  }>>([]);
  const [currentSeason, setCurrentSeason] = useState('S1');

  const reloadCupMeta = async (gwOverride?: string) => {
    const gwTarget = gwOverride ?? currentGw;
    const [cup, status, debug, entries] = await Promise.all([
      api.cup(),
      api.cupStatus().catch(() => [] as CupRoundStatus[]),
      api.cupDebug().catch(() => null),
      api.entries({ gw: gwTarget, limit: 1000 }).catch(() => []),
    ]);
    setCupFixtures(cup);
    setRoundStatus(status);
    setCupDebug(debug);
    setCurrentEntries(entries);
    if (debug) {
      setTieBreakMode(debug.tieBreakMode);
    }
  };

  const getUpsetInfo = (fixture: CupFixture) => classifyUpset(fixture.homeTeam, fixture.awayTeam, ratings);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedGraphicsMode = window.localStorage.getItem('bookieball_cup_draw_graphics_mode');
    if (storedGraphicsMode === 'studio' || storedGraphicsMode === 'classic') {
      setGraphicsMode(storedGraphicsMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('bookieball_cup_draw_graphics_mode', graphicsMode);
  }, [graphicsMode]);


  useEffect(() => {
    let active = true;
    const load = async () => {
      const state = await api.state();
      const [fetchedTeams, cup, ratings, entries, status, debug] = await Promise.all([
        api.teams(),
        api.cup(),
        api.teamRatings().catch(() => [] as TeamRating[]),
        api.entries({ gw: state.currentGw, limit: 1000 }).catch(() => []),
        api.cupStatus().catch(() => [] as CupRoundStatus[]),
        api.cupDebug().catch(() => null),
      ]);
      if (!active) {
        return;
      }
      setCurrentGw(state.currentGw);
      setCurrentSeason(state.currentSeason);
      setCupDrawStarted(state.cupDrawStarted);
      setCupFixtures(cup);
      setTeams(
        fetchedTeams.map((team) => ({
          id: team.id,
          name: team.name,
          division: team.division,
          ballColor: team.ballColor ?? null,
          ringColor: team.ringColor ?? null,
          textColor: team.textColor ?? null,
        })),
      );
      setRoundStatus(status);
      setCupDebug(debug);
      setRatings(ratings);
      setCurrentEntries(entries);
      if (debug) {
        setTieBreakMode(debug.tieBreakMode);
      }
      if (!state.cupDrawStarted) {
        return;
      }

      const teamMap = new Map(
        fetchedTeams.map((team) => [
          team.name,
          {
            ballColor: team.ballColor ?? '#77efdb',
            ringColor: team.ringColor ?? '#0f2b36',
            textColor: team.textColor ?? '#0f2b36',
          },
        ]),
      );

      const gw2 = cup.filter((f) => f.gw === 'GW2');
      const pairs = gw2.map((fixture) => ({
        matchNumber: fixture.matchNumber,
        home: mapFixtureBall(fixture.homeTeam, fixture.homeDivision, teamMap, fixture.gw === 'GW2'),
        away: mapFixtureBall(fixture.awayTeam, fixture.awayDivision, teamMap, fixture.gw === 'GW2'),
      }));
      setRevealedPairs(pairs);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const refreshLiveCupState = async () => {
      try {
        const state = await api.state();
        if (!active) {
          return;
        }
        setCurrentGw(state.currentGw);
        setCurrentSeason(state.currentSeason);
        setCupDrawStarted(state.cupDrawStarted);
        await reloadCupMeta(state.currentGw);
      } catch {
        // Keep the current cup view stable if polling fails transiently.
      }
    };

    const timer = window.setInterval(() => {
      void refreshLiveCupState();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void reloadCupMeta(currentGw);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [currentGw]);

  const startDraw = async () => {
    const [state, fetchedTeams, draw] = await Promise.all([api.state(), api.teams(), api.startCupDraw()]);
    setCurrentGw(state.currentGw);
    if (state.currentGw !== 'GW1') {
      return;
    }

    const teamMap = new Map(
      fetchedTeams.map((team) => [
        team.name,
        {
          ballColor: team.ballColor ?? '#77efdb',
          ringColor: team.ringColor ?? '#0f2b36',
          textColor: team.textColor ?? '#0f2b36',
        },
      ]),
    );

    const gw2 = draw.fixtures.filter((fixture) => fixture.gw === 'GW2');

    setDrawing(true);
    setSpinning(false);
    setLeftWheel('...');
    setRightWheel('...');
    setLeftLocked(false);
    setRightLocked(false);
    setActiveMatchNumber(null);
    setRevealedPairs([]);
    setActivePair(null);
    const byeCount = Math.max(0, 32 - fetchedTeams.length);
    const spinnerPool = [...fetchedTeams.map((team) => team.name), ...Array.from({ length: byeCount }, () => 'BYE')];

    for (const fixture of gw2) {
      const allowBye = fixture.gw === 'GW2';
      const home = mapFixtureBall(fixture.homeTeam, fixture.homeDivision, teamMap, allowBye);
      const away = mapFixtureBall(fixture.awayTeam, fixture.awayDivision, teamMap, allowBye);
      setActiveMatchNumber(fixture.matchNumber);

      setSpinning(true);
      setLeftLocked(false);
      setRightLocked(false);
      const bothSpinInterval = window.setInterval(() => {
        setLeftWheel(pickOne(spinnerPool));
        setRightWheel(pickOne(spinnerPool));
      }, 90);
      await new Promise((resolve) => window.setTimeout(resolve, 2200));
      window.clearInterval(bothSpinInterval);

      // Left side stops first.
      setLeftWheel(home.label);
      setLeftLocked(true);
      setActiveBall(home);
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      setActiveBall(null);

      // Right side keeps spinning, then stops second.
      const rightSpinInterval = window.setInterval(() => {
        setRightWheel(pickOne(spinnerPool));
      }, 90);
      await new Promise((resolve) => window.setTimeout(resolve, 1400));
      window.clearInterval(rightSpinInterval);
      setRightWheel(away.label);
      setRightLocked(true);
      setActiveBall(away);
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      setActiveBall(null);
      setSpinning(false);

      const pair: DrawPair = {
        matchNumber: fixture.matchNumber,
        home,
        away,
      };
      setActivePair(pair);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      setRevealedPairs((prev) => [...prev, pair]);
      setActivePair(null);
      setLeftWheel('...');
      setRightWheel('...');
      setLeftLocked(false);
      setRightLocked(false);
      setActiveMatchNumber(null);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    await reloadCupMeta();
    setCupDrawStarted(true);
    setDrawing(false);
  };

  const rounds = useMemo(() => {
    const byGw = new Map<string, CupFixture[]>();
    for (const fixture of cupFixtures) {
      const list = byGw.get(fixture.gw) ?? [];
      list.push(fixture);
      byGw.set(fixture.gw, list);
    }
    const gw2 = byGw.get('GW2') ?? [];
    const gw3 = byGw.get('GW3') ?? [];
    const gw4 = byGw.get('GW4') ?? [];
    const gw5 = byGw.get('GW5') ?? [];
    const gw6 = byGw.get('GW6') ?? [];
    return {
      left: {
        gw2: gw2.slice(0, 8),
        gw3: gw3.slice(0, 4),
        gw4: gw4.slice(0, 2),
        gw5: gw5.slice(0, 1),
      },
      right: {
        gw2: gw2.slice(8),
        gw3: gw3.slice(4),
        gw4: gw4.slice(2),
        gw5: gw5.slice(1),
      },
      final: gw6[0] ?? null,
    };
  }, [cupFixtures]);

  const fixtureLookup = useMemo(() => {
    const map = new Map<string, CupFixture>();
    for (const fixture of cupFixtures) {
      map.set(fixtureKey(fixture.gw, fixture.matchNumber), fixture);
    }
    return map;
  }, [cupFixtures]);

  const resolveCupSideName = useCallback(
    (fixture: CupFixture, side: 'home' | 'away'): string | null => {
      const allowBye = fixture.gw === 'GW2';
      const direct = side === 'home' ? fixture.homeTeam : fixture.awayTeam;
      if (direct) {
        return direct;
      }
      if (allowBye) {
        const other = side === 'home' ? fixture.awayTeam : fixture.homeTeam;
        if (other) {
          return 'BYE';
        }
      }
      const sourceId = side === 'home' ? fixture.sourceMatchA : fixture.sourceMatchB;
      if (!sourceId) {
        return null;
      }
      const sourceGw = previousGw(fixture.gw);
      const sourceFixture = sourceGw ? fixtureLookup.get(fixtureKey(sourceGw, sourceId)) : null;
      if (!sourceFixture) {
        return null;
      }
      return sourceFixture.winnerTeam ?? null;
    },
    [fixtureLookup],
  );

  const sourceSideLabel = useCallback(
    (fixture: CupFixture, side: 'home' | 'away'): string | null => {
      const sourceMatch = side === 'home' ? fixture.sourceMatchA : fixture.sourceMatchB;
      const sourceGw = previousGw(fixture.gw);
      if (!sourceMatch || !sourceGw) {
        return null;
      }
      const sourceFixture = fixtureLookup.get(fixtureKey(sourceGw, sourceMatch));
      if (!sourceFixture) {
        return `Winner of M${sourceMatch}`;
      }
      const allowBye = sourceFixture.gw === 'GW2';
      const home = sourceFixture.homeTeam ?? (allowBye && sourceFixture.awayTeam ? 'BYE' : 'TBD');
      const away = sourceFixture.awayTeam ?? (allowBye && sourceFixture.homeTeam ? 'BYE' : 'TBD');
      return `Winner of ${home} vs ${away}`;
    },
    [fixtureLookup],
  );

  const highlightedRoutes = useMemo(() => {
    const left = new Set<string>();
    const right = new Set<string>();
    const finalFixture = rounds.final;

    const collect = (gw: string, matchNumber: number, target: Set<string>) => {
      const key = fixtureKey(gw, matchNumber);
      if (target.has(key)) {
        return;
      }
      const fixture = fixtureLookup.get(key);
      if (!fixture) {
        return;
      }
      target.add(key);
      const prev = previousGw(gw);
      if (!prev) {
        return;
      }
      if (fixture.sourceMatchA) {
        collect(prev, fixture.sourceMatchA, target);
      }
      if (fixture.sourceMatchB) {
        collect(prev, fixture.sourceMatchB, target);
      }
    };

    if (finalFixture?.sourceMatchA) {
      collect('GW5', finalFixture.sourceMatchA, left);
    }
    if (finalFixture?.sourceMatchB) {
      collect('GW5', finalFixture.sourceMatchB, right);
    }
    return { left, right };
  }, [fixtureLookup, rounds.final]);

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((a, b) => {
        const divisionDiff = divisionRank(a.division, currentSeason) - divisionRank(b.division, currentSeason);
        if (divisionDiff !== 0) {
          return divisionDiff;
        }
        return a.name.localeCompare(b.name);
      }),
    [teams],
  );
  const teamStyleByName = useMemo(() => (
    new Map(
      teams.map((team) => [
        team.name,
        {
          ballColor: team.ballColor ?? '#77efdb',
          ringColor: team.ringColor ?? '#0f2b36',
          textColor: team.textColor ?? '#0f2b36',
        },
      ]),
    )
  ), [teams]);

  const currentCupFixtures = useMemo(
    () => cupFixtures.filter((fixture) => fixture.gw === currentGw),
    [cupFixtures, currentGw],
  );
  const currentCupRound = currentCupFixtures[0]?.roundName ?? 'Cup Round';
  const cupScoreByTeamName = useMemo(() => {
    const map = new Map<string, number>();
    currentEntries.forEach((entry) => {
      map.set(entry.teamName, (map.get(entry.teamName) ?? 0) + entry.profit);
    });
    return map;
  }, [currentEntries]);

  const eliminatedTeams = useMemo(() => {
    const eliminated = new Set<string>();
    cupFixtures.forEach((fixture) => {
      if (!fixture.winnerTeam) {
        return;
      }
      if (fixture.homeTeam && fixture.winnerTeam !== fixture.homeTeam) {
        eliminated.add(fixture.homeTeam);
      }
      if (fixture.awayTeam && fixture.winnerTeam !== fixture.awayTeam) {
        eliminated.add(fixture.awayTeam);
      }
    });
    return eliminated;
  }, [cupFixtures]);
  const displayMatchLabel = (fixture: CupFixture): string => {
    const allowBye = fixture.gw === 'GW2';
    const resolvedHome = resolveCupSideName(fixture, 'home');
    const resolvedAway = resolveCupSideName(fixture, 'away');
    if (resolvedHome && resolvedAway) {
      const homeText = compactNames ? shortTeamName(resolvedHome) : resolvedHome;
      const awayText = compactNames ? shortTeamName(resolvedAway) : resolvedAway;
      return `M${fixture.matchNumber}: ${homeText} vs ${awayText}`;
    }
    if (allowBye) {
      const home = resolvedHome ?? fixture.homeTeam ?? 'BYE';
      const away = resolvedAway ?? fixture.awayTeam ?? 'BYE';
      const homeText = compactNames ? shortTeamName(home) : home;
      const awayText = compactNames ? shortTeamName(away) : away;
      return `M${fixture.matchNumber}: ${homeText} vs ${awayText}`;
    }
    const homeLabel = resolvedHome ?? fixture.homeTeam ?? `W${fixture.sourceMatchA ?? '?'}`;
    const awayLabel = resolvedAway ?? fixture.awayTeam ?? `W${fixture.sourceMatchB ?? '?'}`;
    const homeText = compactNames ? shortTeamName(homeLabel) : homeLabel;
    const awayText = compactNames ? shortTeamName(awayLabel) : awayLabel;
    return `M${fixture.matchNumber}: ${homeText} vs ${awayText}`;
  };


  const matchTooltip = (fixture: CupFixture): string => {
    const base = matchLabel(fixture);
    const upset = getUpsetInfo(fixture);
    const upsetText = upset ? `${upset.level === 'huge' ? 'Huge Upset' : 'Upset Watch'}: ${upset.underdog} over ${upset.favorite}` : '';
    if (fixture.gw === 'GW2') {
      return `${base}${fixture.winnerTeam ? ` | Winner: ${fixture.winnerTeam}` : ''}${upsetText ? ` | ${upsetText}` : ''}`;
    }
    const prev = previousGw(fixture.gw);
    const path = prev ? `Path: ${fixture.gw} M${fixture.matchNumber} <- ${prev} M${fixture.sourceMatchA ?? '?'} / M${fixture.sourceMatchB ?? '?'}` : '';
    return `${base}${path ? ` | ${path}` : ''}${fixture.winnerTeam ? ` | Winner: ${fixture.winnerTeam}` : ''}${upsetText ? ` | ${upsetText}` : ''}`;
  };

  const bracketScaleStyle: CSSProperties = {
    ['--bracket-scale' as string]: `${zoomPct / 100}`,
  };

  const matchClasses = (fixture: CupFixture, side: 'left' | 'right', col: number, fixtureIndex: number): string => {
    const classes = ['bracket-match', side === 'left' ? 'side-left' : 'side-right', `col-${col}`, fixtureIndex % 2 === 0 ? 'pair-top' : 'pair-bottom'];
    const key = fixtureKey(fixture.gw, fixture.matchNumber);
    if (fixture.winnerTeam) {
      classes.push('resolved');
    }
    if (fixture.gw === 'GW2' && (!fixture.homeTeam || !fixture.awayTeam)) {
      classes.push('bye-fixture');
    }
    const inLeft = highlightedRoutes.left.has(key);
    const inRight = highlightedRoutes.right.has(key);
    if (inLeft && inRight) {
      classes.push('path-both');
    } else if (inLeft) {
      classes.push('path-left');
    } else if (inRight) {
      classes.push('path-right');
    }
    return classes.join(' ');
  };

  useEffect(() => {
    const firstForGw = cupFixtures.find((fixture) => fixture.gw === overrideGw);
    if (firstForGw) {
      setOverrideFixtureId(firstForGw.id);
      setOverrideWinner('clear');
    }
  }, [overrideGw, cupFixtures]);

  const overrideFixtures = cupFixtures.filter((fixture) => fixture.gw === overrideGw);
  const selectedOverrideFixture = cupFixtures.find((fixture) => fixture.id === overrideFixtureId) ?? null;
  const gw2Fixtures = useMemo(() => cupFixtures.filter((fixture) => fixture.gw === 'GW2'), [cupFixtures]);
  const drawSummary = useMemo(() => {
    const byeMatches = gw2Fixtures.filter((fixture) => !fixture.homeTeam || !fixture.awayTeam).length;
    const sameDivision = gw2Fixtures.filter(
      (fixture) => fixture.homeDivision && fixture.awayDivision && fixture.homeDivision === fixture.awayDivision,
    ).length;
    const crossDivision = gw2Fixtures.filter(
      (fixture) => fixture.homeDivision && fixture.awayDivision && fixture.homeDivision !== fixture.awayDivision,
    ).length;
    const resolvedWinners = gw2Fixtures.filter((fixture) => fixture.winnerTeam).length;
    return {
      total: gw2Fixtures.length,
      byeMatches,
      sameDivision,
      crossDivision,
      resolvedWinners,
    };
  }, [gw2Fixtures]);

  const applyTieBreakMode = async () => {
    await api.setCupTieBreakMode(tieBreakMode);
    await reloadCupMeta();
  };

  const applyWinnerOverride = async () => {
    if (!selectedOverrideFixture) {
      return;
    }
    const winnerTeamId =
      overrideWinner === 'home'
        ? teams.find((team) => team.name === selectedOverrideFixture.homeTeam)?.id ?? null
        : overrideWinner === 'away'
          ? teams.find((team) => team.name === selectedOverrideFixture.awayTeam)?.id ?? null
          : null;
    await api.setCupWinner(selectedOverrideFixture.id, winnerTeamId);
    await reloadCupMeta();
  };

  const applyRoundReset = async () => {
    if (!window.confirm(`Reset cup progression from ${resetRoundGw}?`)) {
      return;
    }
    await api.resetCupRound(resetRoundGw);
    await reloadCupMeta();
  };

  return (
    <section className={`page page-wide cup-page cup-graphics-${graphicsMode}`}>
      <h1>Bookie Trophy Draw Studio</h1>
      <p className="muted">Draw pool: {teams.length} teams + {Math.max(0, 32 - teams.length)} BYE balls.</p>

      <CupTabs activeId="bookieball-cup" />

      <div className="cup-studio-hero">
        <article className="cup-hero-card">
          <span>GW</span>
          <strong>{currentGw}</strong>
          <p>{currentGw === 'GW1' ? 'Draw window open' : 'Draw locked outside GW1'}</p>
        </article>
        <article className="cup-hero-card">
          <span>Pairings</span>
          <strong>{revealedPairs.length}/{drawSummary.total || 16}</strong>
          <p>{drawSummary.byeMatches} bye ties in the opening round</p>
        </article>
        <article className="cup-hero-card">
          <span>Division Mix</span>
          <strong>{drawSummary.crossDivision}</strong>
          <p>{drawSummary.sameDivision} same-division tie{drawSummary.sameDivision === 1 ? '' : 's'}</p>
        </article>
        <article className="cup-hero-card">
          <span>Winners Set</span>
          <strong>{drawSummary.resolvedWinners}</strong>
          <p>GW2 winner slots confirmed</p>
        </article>
      </div>

      {roundStatus.length > 0 && (
        <div className="cup-round-progress-strip">
          {roundStatus.map((round) => {
            const pct = round.totalFixtures > 0 ? Math.round((round.resolvedFixtures / round.totalFixtures) * 100) : 0;
            return (
              <article key={`progress-${round.gw}`} className={`cup-round-progress-card${round.complete ? ' complete' : ''}`}>
                <div className="cup-round-progress-head">
                  <strong>{round.gw}</strong>
                  <span>{round.roundName}</span>
                </div>
                <div className="cup-round-progress-track">
                  <span className="cup-round-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p>{round.resolvedFixtures}/{round.totalFixtures} resolved</p>
              </article>
            );
          })}
        </div>
      )}

      {currentGw === 'GW1' && !cupDrawStarted && (
        <button className="action" onClick={startDraw} disabled={drawing}>
          {drawing ? 'Drawing...' : 'Run Cup Draw (GW1)'}
        </button>
      )}
      {currentGw === 'GW1' && cupDrawStarted && <p className="muted">Cup draw complete.</p>}
      {currentGw !== 'GW1' && !cupDrawStarted && (
        <p className="muted">Cup draw can only be started in GW1. Current GW: {currentGw}. You can still view the cup view below.</p>
      )}

      {((currentGw === 'GW1' && !cupDrawStarted) || drawing) && (
        <div className="panel cup-live-panel">
          <h3>Live Draw</h3>
          {activeMatchNumber !== null && <div className="match-banner">Match {activeMatchNumber}</div>}
          {(spinning || leftLocked || rightLocked) && (
            <div className="live-stage">
              <div className="live-spin-row">
                <div className={`slot-wheel ${spinning && !leftLocked ? 'spin-active' : ''} ${leftLocked ? 'wheel-locked' : ''}`}>
                  <div className="wheel-name">{leftWheel}</div>
                </div>
                <span className="spin-vs">VS</span>
                <div className={`slot-wheel ${spinning && !rightLocked ? 'spin-active' : ''} ${rightLocked ? 'wheel-locked' : ''}`}>
                  <div className="wheel-name">{rightWheel}</div>
                </div>
              </div>
            </div>
          )}
          {activeBall && (
            <div className="selected-ball" style={{ background: activeBall.ballColor, border: `4px solid ${activeBall.ringColor}`, color: activeBall.textColor }}>
              {activeBall.label}
              {activeBall.division ? ` (${formatDivision(activeBall.division)})` : ''}
            </div>
          )}
          {activePair && (
            <div className="fixture-row live-pair-lock">
              <span className="cup-pair-match-chip">Match {activePair.matchNumber}</span>
              <strong>{activePair.home.label}</strong>
              {activePair.home.division ? ` (${formatDivision(activePair.home.division)})` : ''}
              {' vs '}
              <strong>{activePair.away.label}</strong>
              {activePair.away.division ? ` (${formatDivision(activePair.away.division)})` : ''}
            </div>
          )}
          <div className="cup-pair-list">
            {revealedPairs.map((pair) => (
              <article key={`pair-${pair.matchNumber}-${pair.home.label}-${pair.away.label}`} className="cup-draw-pair-card">
                <div className="cup-draw-pair-head">
                  <span className="cup-pair-match-chip">Match {pair.matchNumber}</span>
                  <span>{pair.home.division ? formatDivision(pair.home.division) : 'BYE'} vs {pair.away.division ? formatDivision(pair.away.division) : 'BYE'}</span>
                </div>
                <strong>{pair.home.label} vs {pair.away.label}</strong>
              </article>
            ))}
            {revealedPairs.length === 0 && <p className="muted">Press Start Cup Draw to reveal matchups.</p>}
          </div>
        </div>
      )}

      <div className="cup-visual-stack">
        <div className="panel cup-ball-panel">
            <div className="panel-header">
              <h3>Ball Numbers</h3>
              <span className="muted">{sortedTeams.length} balls</span>
            </div>
            <div className="cup-ball-grid">
              {sortedTeams.map((team, index) => (
                <div key={team.id} className={`cup-ball-card${eliminatedTeams.has(team.name) ? ' eliminated' : ''}`}>
                  <div className="ball-number-chip">#{index + 1}</div>
                  <TeamBadge
                    name={team.name}
                    ballColor={team.ballColor}
                    ringColor={team.ringColor}
                    textColor={team.textColor}
                    size={30}
                  />
                  <div className="cup-ball-meta">
                    <strong className="cup-ball-name">{team.name}</strong>
                    <span className="muted">{displayDivisionName(team.division)}</span>
                  </div>
                </div>
              ))}
              {sortedTeams.length === 0 && <p className="muted">Loading teams…</p>}
            </div>
          </div>

        <div className="panel cup-current-fixtures-panel">
          <div className="panel-header">
            <h3>Bookie Cup • {currentSeason} {currentGw}</h3>
            <span className="muted">{currentCupRound} • Live scores</span>
          </div>
          {currentCupFixtures.length === 0 ? (
            <p className="muted">No cup fixtures loaded for {currentGw}.</p>
          ) : (
            <div className="trophy-cup-list">
              {currentCupFixtures.map((fixture) => {
                const allowBye = fixture.gw === 'GW2';
                const resolvedHome = resolveCupSideName(fixture, 'home');
                const resolvedAway = resolveCupSideName(fixture, 'away');
                const homeName =
                  resolvedHome ?? fixture.homeTeam ?? sourceSideLabel(fixture, 'home') ?? (allowBye && fixture.awayTeam ? 'BYE' : 'TBD');
                const awayName =
                  resolvedAway ?? fixture.awayTeam ?? sourceSideLabel(fixture, 'away') ?? (allowBye && fixture.homeTeam ? 'BYE' : 'TBD');
                const homeMeta = teamStyleByName.get(homeName);
                const awayMeta = teamStyleByName.get(awayName);
                const homeScore = cupScoreByTeamName.get(homeName);
                const awayScore = cupScoreByTeamName.get(awayName);
                const score =
                  homeScore !== undefined && awayScore !== undefined
                    ? `${homeScore.toFixed(2)} - ${awayScore.toFixed(2)}`
                    : homeName === 'BYE' || awayName === 'BYE'
                      ? 'BYE'
                      : 'Pending';
                return (
                  <article key={`cup-live-${fixture.id}`} className="trophy-cup-row">
                    <div className="trophy-cup-team">
                      {homeMeta ? (
                        <TeamBadge
                          name={homeName}
                          ballColor={homeMeta.ballColor}
                          ringColor={homeMeta.ringColor}
                          textColor={homeMeta.textColor}
                          size={30}
                        />
                      ) : (
                        <span className="trophy-cup-placeholder">•</span>
                      )}
                      <span>{homeName}</span>
                    </div>
                    <div className="trophy-cup-score">{score}</div>
                    <div className="trophy-cup-team">
                      {awayMeta ? (
                        <TeamBadge
                          name={awayName}
                          ballColor={awayMeta.ballColor}
                          ringColor={awayMeta.ringColor}
                          textColor={awayMeta.textColor}
                          size={30}
                        />
                      ) : (
                        <span className="trophy-cup-placeholder">•</span>
                      )}
                      <span>{awayName}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel cup-bracket-panel">
            <div className="panel-header">
              <h3>Cup Bracket Tree</h3>
              <div className="bracket-zoom-controls">
                <span className="muted">Zoom</span>
                {[90, 100, 110].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`zoom-chip ${zoomPct === value ? 'active' : ''}`}
                    onClick={() => setZoomPct(value)}
                  >
                    {value}%
                  </button>
                ))}
                <label className="compact-toggle">
                  <input type="checkbox" checked={compactNames} onChange={(e) => setCompactNames(e.target.checked)} />
                  Compact names
                </label>
              </div>
            </div>
            <div className="bracket-zoom-canvas" style={bracketScaleStyle}>
              <div className="bracket-vs-layout">
                <div className="bracket-wing bracket-wing-grid">
                  {[rounds.left.gw2, rounds.left.gw3, rounds.left.gw4, rounds.left.gw5].map((roundFixtures, roundIndex) => {
                    const label = `GW${roundIndex + 2}`;
                    const rows = LEFT_ROW_STARTS[roundFixtures.length] ?? [];
                    return (
                      <Fragment key={label}>
                        <h4 className="bracket-round-title" style={{ gridColumn: roundIndex + 1, gridRow: 1 }}>{label}</h4>
                        {roundFixtures.map((fixture, fixtureIndex) => (
                          <div
                            key={fixture.id}
                            className={matchClasses(fixture, 'left', roundIndex, fixtureIndex)}
                            style={{ gridColumn: roundIndex + 1, gridRow: `${rows[fixtureIndex] ?? 1} / span 1` }}
                            title={matchTooltip(fixture)}
                          >
                            <div>{displayMatchLabel(fixture)}</div>
                          </div>
                        ))}
                      </Fragment>
                    );
                  })}
                </div>

                <div className="bracket-final">
                  <h4>GW6 Final</h4>
                  <div className={`bracket-match final-match ${rounds.final?.winnerTeam ? 'resolved' : ''}`} title={rounds.final ? matchTooltip(rounds.final) : 'Final not available yet'}>
                    <div>{rounds.final ? displayMatchLabel(rounds.final) : 'M1: W? vs W?'}</div>
                    <div className="muted">Winner: {rounds.final?.winnerTeam ?? 'TBD'}</div>
                  </div>
                </div>

                <div className="bracket-wing bracket-wing-grid bracket-wing-right">
                  {[rounds.right.gw5, rounds.right.gw4, rounds.right.gw3, rounds.right.gw2].map((roundFixtures, roundIndex) => {
                    const label = `GW${5 - roundIndex}`;
                    const rows = LEFT_ROW_STARTS[roundFixtures.length] ?? [];
                    return (
                      <Fragment key={label}>
                        <h4 className="bracket-round-title" style={{ gridColumn: roundIndex + 1, gridRow: 1 }}>{label}</h4>
                        {roundFixtures.map((fixture, fixtureIndex) => (
                          <div
                            key={fixture.id}
                            className={matchClasses(fixture, 'right', roundIndex, fixtureIndex)}
                            style={{ gridColumn: roundIndex + 1, gridRow: `${rows[fixtureIndex] ?? 1} / span 1` }}
                            title={matchTooltip(fixture)}
                          >
                            <div>{displayMatchLabel(fixture)}</div>
                          </div>
                        ))}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
        </div>
      </div>

      <details className="cup-admin-details">
        <summary>Admin &amp; Debug</summary>
        <div className="panel">
          <h3>Cup Controls</h3>
          <div className="grid-row">
            <label>
              Tie-break mode
              <select value={tieBreakMode} onChange={(e) => setTieBreakMode(e.target.value as 'random' | 'lower_team_id')}>
                <option value="lower_team_id">Deterministic (lower team id)</option>
                <option value="random">Random coin flip</option>
              </select>
            </label>
            <button className="secondary" onClick={applyTieBreakMode}>Save Tie-break</button>
            <label>
              Round
              <select value={overrideGw} onChange={(e) => setOverrideGw(e.target.value)}>
                {['GW2', 'GW3', 'GW4', 'GW5', 'GW6'].map((gw) => <option key={gw} value={gw}>{gw}</option>)}
              </select>
            </label>
            <label>
              Fixture
              <select value={overrideFixtureId} onChange={(e) => setOverrideFixtureId(Number(e.target.value))}>
                {overrideFixtures.map((fixture) => (
                  <option key={fixture.id} value={fixture.id}>
                    {matchLabel(fixture)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Winner
              <select value={overrideWinner} onChange={(e) => setOverrideWinner(e.target.value as 'clear' | 'home' | 'away')}>
                <option value="clear">Clear winner</option>
                {selectedOverrideFixture?.homeTeam && <option value="home">{selectedOverrideFixture.homeTeam}</option>}
                {selectedOverrideFixture?.awayTeam && <option value="away">{selectedOverrideFixture.awayTeam}</option>}
              </select>
            </label>
            <button className="secondary" onClick={applyWinnerOverride} disabled={!selectedOverrideFixture}>Apply Winner Override</button>
            <label>
              Reset from round
              <select value={resetRoundGw} onChange={(e) => setResetRoundGw(e.target.value)}>
                {['GW2', 'GW3', 'GW4', 'GW5', 'GW6'].map((gw) => <option key={gw} value={gw}>{gw}</option>)}
              </select>
            </label>
            <button className="secondary" onClick={applyRoundReset}>Reset Round + Future</button>
          </div>
        </div>

        <div className="panel">
          <h3>Round Status</h3>
          <div className="fixture-list">
            {roundStatus.map((round) => (
              <div key={round.gw} className="fixture-row">
                <strong>{round.gw}</strong> {round.roundName} - {round.locked ? 'Locked' : 'Open'} - {round.resolvedFixtures}/{round.totalFixtures} resolved
              </div>
            ))}
            {cupDebug?.recentAudit.slice(0, 6).map((row) => (
              <div key={row.id} className="fixture-row">
                {row.gw} M{row.matchNumber} {row.action} ({row.reason}): {row.oldWinner ?? 'None'} -&gt; {row.newWinner ?? 'None'}
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3>Cup Preview Show</h3>
          {cupFixtures.filter((fixture) => fixture.gw === currentGw && fixture.homeTeam && fixture.awayTeam).length === 0 ? (
            <p className="muted">No cup fixtures ready for {currentGw}.</p>
          ) : (
            cupFixtures
              .filter((fixture) => fixture.gw === currentGw && fixture.homeTeam && fixture.awayTeam)
              .map((fixture) => {
                const upset = classifyUpset(fixture.homeTeam, fixture.awayTeam, ratings);
                return (
                  <div key={`preview-${fixture.id}`} className="fixture-row">
                    <strong>M{fixture.matchNumber}</strong> {fixture.homeTeam} vs {fixture.awayTeam}
                    {upset && (
                      <span className={`upset-chip ${upset.level === 'huge' ? 'upset-huge' : 'upset-watch'}`}>
                        {upset.level === 'huge' ? 'Huge upset' : 'Upset watch'}: {upset.underdog} over {upset.favorite} (gap {upset.gap})
                      </span>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </details>

      <Link to="/gameshow" className="action-link">Go To The Kick-Off Show</Link>
    </section>
  );
}
