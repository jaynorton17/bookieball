import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];

type Scoreboard = Awaited<ReturnType<typeof api.predictionScoreboard>>;
type PredictionResponse = Awaited<ReturnType<typeof api.predictions>>;
type Prediction = PredictionResponse['predictions'][number];
type H2H = Awaited<ReturnType<typeof api.headToHeadAllTime>>;

type FixtureInfo = {
  key: string;
  label: string;
  homeTeam: string;
  awayTeam: string;
  result: 'home' | 'away' | 'draw' | 'pending';
  homeProfit: number;
  awayProfit: number;
};

type ResultRow = FixtureInfo & {
  jayPick: string;
  computerPick: string;
  jayCorrect: boolean;
  computerCorrect: boolean;
};

type SeasonChampion = {
  season: string;
  winner: string;
  points: number;
  runnerUp: string;
  runnerUpPoints: number;
};

type BroadcastData = {
  season: string;
  previousSeason: string;
  previousGw: string;
  currentScoreboard: Scoreboard;
  previousScoreboard: Scoreboard | null;
  previousRows: ResultRow[];
  currentPredictions: PredictionResponse;
  currentFixtureLabels: Map<string, string>;
  champions: SeasonChampion[];
  h2hByFixtureKey: Map<string, H2H>;
};

type Slide = {
  id: string;
  kicker: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  tone?: 'gold' | 'blue' | 'red' | 'green';
};

function seasonNumber(season: string) {
  const value = Number(season.replace(/\D/g, ''));
  return Number.isFinite(value) ? value : 1;
}

function pickLabel(row: Prediction | undefined) {
  if (!row) return '—';
  return row.pickOutcome === 'draw' ? 'Draw' : row.pickTeamName;
}

function actualWinner(info: FixtureInfo) {
  if (info.result === 'draw') return 'Draw';
  if (info.result === 'home') return info.homeTeam;
  if (info.result === 'away') return info.awayTeam;
  return 'Pending';
}

function isCorrect(row: Prediction | undefined, info: FixtureInfo) {
  if (!row || info.result === 'pending') return false;
  if (row.pickOutcome === 'draw') return info.result === 'draw';
  return row.pickTeamName === actualWinner(info);
}

function profitLabel(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

async function fixtureMap(season: string, gw: string): Promise<Map<string, FixtureInfo>> {
  const [league, cup, master, masterCup, trio, tier] = await Promise.all([
    api.leagueFixtures(gw, false, season).catch(() => []),
    api.cup(gw, season).catch(() => []),
    api.masterLeagueFixtures(gw, false, season).catch(() => []),
    api.masterCupFixtures(gw, false, season).catch(() => []),
    api.trioLeagueFixtures(gw, false, season).catch(() => []),
    api.tierLeagueFixtures(gw, false, season).catch(() => []),
  ]);

  const map = new Map<string, FixtureInfo>();
  league.forEach((f) => map.set(`league-${f.id}`, {
    key: `league-${f.id}`, label: `League · ${f.division}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam,
    result: f.result, homeProfit: f.homeProfit ?? 0, awayProfit: f.awayProfit ?? 0,
  }));
  cup.forEach((f) => {
    if (!f.homeTeam || !f.awayTeam) return;
    const result: FixtureInfo['result'] = !f.winnerTeam ? 'pending' : f.winnerTeam === f.homeTeam ? 'home' : f.winnerTeam === f.awayTeam ? 'away' : 'pending';
    map.set(`cup-${f.id}`, {
      key: `cup-${f.id}`, label: `BookieBall Cup · ${f.roundName}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam,
      result, homeProfit: f.homeProfit ?? 0, awayProfit: f.awayProfit ?? 0,
    });
  });
  master.forEach((f) => map.set(`master-${f.id}`, {
    key: `master-${f.id}`, label: 'Master League', homeTeam: f.homeTeam, awayTeam: f.awayTeam,
    result: f.result, homeProfit: f.homeProfit ?? 0, awayProfit: f.awayProfit ?? 0,
  }));
  masterCup.forEach((f) => {
    if (!f.homeTeam || !f.awayTeam) return;
    const result: FixtureInfo['result'] = !f.winnerTeam ? 'pending' : f.winnerTeam === f.homeTeam ? 'home' : f.winnerTeam === f.awayTeam ? 'away' : 'pending';
    map.set(`master_cup-${f.id}`, {
      key: `master_cup-${f.id}`, label: `Master Cup · ${f.roundName}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam,
      result, homeProfit: f.homeProfit ?? 0, awayProfit: f.awayProfit ?? 0,
    });
  });
  trio.forEach((f) => map.set(`trio-${f.id}`, {
    key: `trio-${f.id}`, label: `Trio League · ${f.division}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam,
    result: f.result, homeProfit: f.homeProfit ?? 0, awayProfit: f.awayProfit ?? 0,
  }));
  tier.forEach((f) => map.set(`tier-${f.id}`, {
    key: `tier-${f.id}`, label: `Tier League · ${f.division}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam,
    result: f.result, homeProfit: f.homeProfit ?? 0, awayProfit: f.awayProfit ?? 0,
  }));
  return map;
}

function weekWinner(scoreboard: Scoreboard, gw: string): 'Jay' | 'Computer' | 'Draw' | null {
  const rows = scoreboard.weeks.filter((row) => row.gw === gw);
  const jay = rows.find((row) => row.picker === 'Jay');
  const computer = rows.find((row) => row.picker === 'Computer');
  if (!jay || !computer) return null;
  if (jay.points === computer.points) return 'Draw';
  return jay.points > computer.points ? 'Jay' : 'Computer';
}

function form(scoreboard: Scoreboard, picker: 'Jay' | 'Computer'): Array<'W' | 'D' | 'L'> {
  return GAMEWEEKS
    .map((gw) => weekWinner(scoreboard, gw))
    .filter((winner): winner is 'Jay' | 'Computer' | 'Draw' => Boolean(winner))
    .slice(-5)
    .map((winner) => winner === 'Draw' ? 'D' : winner === picker ? 'W' : 'L');
}

function FormDots({ values }: { values: Array<'W' | 'D' | 'L'> }) {
  return <div className="prediction-form-dots">{values.map((value, index) => <span key={`${value}-${index}`} className={value.toLowerCase()}>{value}</span>)}</div>;
}

function PredictionMiniShow({ data }: { data: BroadcastData }) {
  const [index, setIndex] = useState(0);
  const totals = new Map(data.currentScoreboard.totals.map((row) => [row.picker, row]));
  const jayTotal = totals.get('Jay') ?? { picker: 'Jay', points: 0, correct: 0, total: 0, perfectWeeks: 0 };
  const computerTotal = totals.get('Computer') ?? { picker: 'Computer', points: 0, correct: 0, total: 0, perfectWeeks: 0 };
  const previousWeeks = data.previousScoreboard?.weeks ?? [];
  const prevJay = previousWeeks.find((row) => row.gw === data.previousGw && row.picker === 'Jay');
  const prevComputer = previousWeeks.find((row) => row.gw === data.previousGw && row.picker === 'Computer');
  const previousWinner = !prevJay || !prevComputer ? 'No result' : prevJay.points === prevComputer.points ? 'Draw' : prevJay.points > prevComputer.points ? 'Jay' : 'Computer';
  const jayForm = form(data.currentScoreboard, 'Jay');
  const computerForm = form(data.currentScoreboard, 'Computer');

  const slides: Slide[] = [
    {
      id: 'tile-1', kicker: 'TILE 1 · LAST WEEK', title: `${prevJay?.points ?? 0} — ${prevComputer?.points ?? 0}`,
      subtitle: previousWinner === 'Draw' ? 'Jay and Computer finished level' : `${previousWinner} won the prediction round`,
      tone: previousWinner === 'Jay' ? 'gold' : previousWinner === 'Computer' ? 'blue' : 'green',
      content: <div className="prediction-versus"><div><span>JAY</span><strong>{prevJay?.correct ?? 0}/{prevJay?.total ?? 0}</strong><small>correct</small></div><b>VS</b><div><span>COMPUTER</span><strong>{prevComputer?.correct ?? 0}/{prevComputer?.total ?? 0}</strong><small>correct</small></div></div>,
    },
    {
      id: 'tile-2', kicker: 'TILE 2 · SEASON RACE', title: `${jayTotal.points} — ${computerTotal.points}`,
      subtitle: `${data.season} prediction championship · ${Math.abs(jayTotal.points - computerTotal.points)} point gap`, tone: 'gold',
      content: <div className="prediction-stat-grid"><div><span>Jay</span><strong>{jayTotal.points}</strong><small>{jayTotal.correct}/{jayTotal.total} correct · {jayTotal.perfectWeeks} perfect weeks</small></div><div><span>Computer</span><strong>{computerTotal.points}</strong><small>{computerTotal.correct}/{computerTotal.total} correct · {computerTotal.perfectWeeks} perfect weeks</small></div></div>,
    },
    {
      id: 'tile-3', kicker: 'TILE 3 · FORM & CHAMPIONS', title: 'Who has the edge?', subtitle: 'Recent prediction form and previous season champions', tone: 'red',
      content: <div className="prediction-tile-three"><div className="prediction-form-board"><div><strong>JAY</strong><FormDots values={jayForm} /></div><div><strong>COMPUTER</strong><FormDots values={computerForm} /></div></div><div className="prediction-champions prediction-champions-compact">{data.champions.slice(-3).reverse().map((row) => <div key={row.season}><span>{row.season}</span><strong>🏆 {row.winner}</strong><b>{row.points} pts</b></div>)}</div></div>,
    },
    ...data.previousRows.slice(0, 10).map((row, gameIndex): Slide => {
      const h2h = data.h2hByFixtureKey.get(row.key) ?? null;
      const actual = actualWinner(row);
      const lastMeeting = h2h?.lastMeeting ?? null;
      return {
        id: `game-${gameIndex + 1}`,
        kicker: `GAME ${gameIndex + 1} OF 10 · ${row.label}`,
        title: `${row.homeTeam} vs ${row.awayTeam}`,
        subtitle: `Actual: ${actual} · ${profitLabel(row.homeProfit)} vs ${profitLabel(row.awayProfit)}`,
        tone: row.jayCorrect && row.computerCorrect ? 'green' : row.jayCorrect ? 'gold' : row.computerCorrect ? 'blue' : 'red',
        content: <div className="prediction-game-recap">
          <div className="prediction-game-picks">
            <article className={row.jayCorrect ? 'correct' : 'missed'}><span>JAY PREDICTED</span><strong>{row.jayPick}</strong><b>{row.jayCorrect ? '✓ CORRECT' : '✕ MISSED'}</b></article>
            <article className={row.computerCorrect ? 'correct' : 'missed'}><span>COMPUTER PREDICTED</span><strong>{row.computerPick}</strong><b>{row.computerCorrect ? '✓ CORRECT' : '✕ MISSED'}</b></article>
          </div>
          <div className="prediction-game-score"><span>ACTUAL SCORE</span><strong>{row.homeTeam} {profitLabel(row.homeProfit)} <em>VS</em> {profitLabel(row.awayProfit)} {row.awayTeam}</strong></div>
          {h2h ? <div className="prediction-game-h2h">
            <span>ALL-TIME HEAD TO HEAD · {h2h.played} MEETINGS</span>
            <div><strong>{h2h.teamA.name}</strong><b>{h2h.teamAWins}</b><em>W</em><i>{h2h.draws} draws</i><em>W</em><b>{h2h.teamBWins}</b><strong>{h2h.teamB.name}</strong></div>
            {lastMeeting ? <small>Last meeting: {lastMeeting.season} {lastMeeting.gw} · {lastMeeting.homeTeam} {profitLabel(lastMeeting.homeProfit)} vs {profitLabel(lastMeeting.awayProfit)} {lastMeeting.awayTeam}</small> : null}
          </div> : <div className="prediction-game-h2h"><span>HEAD TO HEAD</span><small>No historical H2H record found for this pairing.</small></div>}
        </div>,
      };
    }),
  ];

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % slides.length), 10000);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  useEffect(() => { if (index >= slides.length) setIndex(0); }, [index, slides.length]);

  const active = slides[index] ?? slides[0];
  if (!active) return null;
  return <section className={`prediction-mini-show tone-${active.tone ?? 'blue'}`}>
    <div className="prediction-mini-show-top"><div><span>{active.kicker}</span><h2>{active.title}</h2>{active.subtitle && <p>{active.subtitle}</p>}</div><div className="prediction-mini-controls"><button type="button" onClick={() => setIndex((index - 1 + slides.length) % slides.length)}>←</button><span>{index + 1}/{slides.length}</span><button type="button" onClick={() => setIndex((index + 1) % slides.length)}>→</button></div></div>
    <div key={active.id} className="prediction-mini-stage">{active.content}</div>
  </section>;
}

function LockedPicksDrama({ data }: { data: BroadcastData }) {
  const byKey = new Map<string, Record<string, Prediction>>();
  data.currentPredictions.predictions.forEach((row) => {
    const key = `${row.competition}-${row.fixtureId}`;
    const slot = byKey.get(key) ?? {};
    slot[row.picker] = row;
    byKey.set(key, slot);
  });
  const rows = data.currentPredictions.slate.map((entry) => {
    const key = `${entry.competition}-${entry.fixtureId}`;
    const picks = byKey.get(key) ?? {};
    return { key, fixture: data.currentFixtureLabels.get(key) ?? `Fixture ${entry.fixtureId}`, jay: pickLabel(picks.Jay), computer: pickLabel(picks.Computer) };
  }).filter((row) => row.jay !== '—' && row.computer !== '—');
  if (!rows.length) return null;
  const disagreements = rows.filter((row) => row.jay !== row.computer);
  return <section className="prediction-locked-drama"><div><span>PICKS LOCKED</span><strong>{disagreements.length ? 'YOU VS THE MACHINE' : 'UNANIMOUS CARD'}</strong><small>{disagreements.length} split calls · {rows.length - disagreements.length} agreements</small></div>{disagreements.slice(0, 2).map((row) => <article key={row.key}><small>{row.fixture}</small><b>{row.jay}</b><em>VS</em><b>{row.computer}</b></article>)}</section>;
}

async function buildBroadcastData(): Promise<BroadcastData> {
  const state = await api.state();
  const previous = await api.lastCompletedGameweek().catch(() => ({ currentSeason: state.currentSeason, currentGw: state.currentGw, lastCompleted: null }));
  const previousSeason = previous.lastCompleted?.season ?? state.currentSeason;
  const previousGw = previous.lastCompleted?.gw ?? '';
  const [currentScoreboard, currentPredictions, currentFixtures, previousScoreboard, previousPredictions, previousFixtures, teams] = await Promise.all([
    api.predictionScoreboard(state.currentSeason).catch(() => ({ totals: [], weeks: [] })),
    api.predictions(state.currentGw, state.currentSeason).catch(() => ({ season: state.currentSeason, gw: state.currentGw, locked: false, slate: [], predictions: [] })),
    fixtureMap(state.currentSeason, state.currentGw),
    previousGw ? api.predictionScoreboard(previousSeason).catch(() => null) : Promise.resolve(null),
    previousGw ? api.predictions(previousGw, previousSeason).catch(() => ({ season: previousSeason, gw: previousGw, locked: true, slate: [], predictions: [] })) : Promise.resolve({ season: previousSeason, gw: previousGw, locked: true, slate: [], predictions: [] }),
    previousGw ? fixtureMap(previousSeason, previousGw) : Promise.resolve(new Map<string, FixtureInfo>()),
    api.teams().catch(() => []),
  ]);

  const previousByKey = new Map<string, Record<string, Prediction>>();
  previousPredictions.predictions.forEach((row) => {
    const key = `${row.competition}-${row.fixtureId}`;
    const slot = previousByKey.get(key) ?? {};
    slot[row.picker] = row;
    previousByKey.set(key, slot);
  });
  const previousRows = previousPredictions.slate.map((entry) => {
    const key = `${entry.competition}-${entry.fixtureId}`;
    const fixture = previousFixtures.get(key);
    if (!fixture) return null;
    const picks = previousByKey.get(key) ?? {};
    return { ...fixture, jayPick: pickLabel(picks.Jay), computerPick: pickLabel(picks.Computer), jayCorrect: isCorrect(picks.Jay, fixture), computerCorrect: isCorrect(picks.Computer, fixture) };
  }).filter((row): row is ResultRow => Boolean(row));

  const currentFixtureLabels = new Map<string, string>();
  currentFixtures.forEach((fixture, key) => currentFixtureLabels.set(key, `${fixture.homeTeam} vs ${fixture.awayTeam}`));

  const currentNo = seasonNumber(state.currentSeason);
  const first = Math.max(1, currentNo - 5);
  const seasonIds = Array.from({ length: Math.max(0, currentNo - first) }, (_, index) => `S${first + index}`);
  const championScoreboards = await Promise.all(seasonIds.map((season) => api.predictionScoreboard(season).then((scoreboard) => ({ season, scoreboard })).catch(() => null)));
  const champions = championScoreboards
    .filter((row): row is { season: string; scoreboard: Scoreboard } => Boolean(row && row.scoreboard.totals.length))
    .map(({ season, scoreboard }) => {
      const ranked = scoreboard.totals.slice().sort((a, b) => b.points - a.points || b.correct - a.correct || a.picker.localeCompare(b.picker));
      return { season, winner: ranked[0]?.picker ?? '—', points: ranked[0]?.points ?? 0, runnerUp: ranked[1]?.picker ?? '—', runnerUpPoints: ranked[1]?.points ?? 0 };
    });

  const teamByName = new Map(teams.map((team) => [team.name.toLowerCase(), team]));
  const h2hPairs = await Promise.all(previousRows.slice(0, 10).map(async (fixture) => {
    const home = teamByName.get(fixture.homeTeam.toLowerCase());
    const away = teamByName.get(fixture.awayTeam.toLowerCase());
    if (!home || !away) return null;
    const h2h = await api.headToHeadAllTime(home.id, away.id).catch(() => null);
    return h2h ? { key: fixture.key, h2h } : null;
  }));
  const h2hByFixtureKey = new Map<string, H2H>();
  h2hPairs.forEach((row) => { if (row) h2hByFixtureKey.set(row.key, row.h2h); });

  return { season: state.currentSeason, previousSeason, previousGw, currentScoreboard, previousScoreboard, previousRows, currentPredictions, currentFixtureLabels, champions, h2hByFixtureKey };
}

export function PredictionBroadcastEnhancements() {
  const location = useLocation();
  const [data, setData] = useState<BroadcastData | null>(null);
  const [resultsTarget, setResultsTarget] = useState<Element | null>(null);
  const [picksTarget, setPicksTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (location.pathname !== '/gameshow') { setResultsTarget(null); setPicksTarget(null); return; }
    const sync = () => {
      setResultsTarget(document.querySelector('.kickoff-flow-shell-results .kickoff-grid-results'));
      setPicksTarget(document.querySelector('.kickoff-flow-shell:not(.kickoff-flow-shell-results) .kickoff-grid-picks'));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/gameshow' || !resultsTarget || data) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void buildBroadcastData().then((payload) => { if (active) setData(payload); }).catch(() => { if (active) setData(null); });
    }, 800);
    return () => { active = false; window.clearTimeout(timer); };
  }, [location.pathname, resultsTarget, data]);

  if (!data) return null;
  return <>{resultsTarget ? createPortal(<PredictionMiniShow data={data} />, resultsTarget) : null}{picksTarget && data.currentPredictions.locked ? createPortal(<LockedPicksDrama data={data} />, picksTarget) : null}</>;
}
