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
  h2hSpotlight: { fixture: FixtureInfo; h2h: H2H } | null;
};

type Slide = {
  id: string;
  kicker: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  tone?: 'gold' | 'blue' | 'red' | 'green';
};

function seasonNumber(season: string): number {
  const value = Number(season.replace(/\D/g, ''));
  return Number.isFinite(value) ? value : 1;
}

function pickLabel(row: Prediction | undefined): string {
  if (!row) return '—';
  return row.pickOutcome === 'draw' ? 'Draw' : row.pickTeamName;
}

function actualWinner(info: FixtureInfo): string {
  if (info.result === 'draw') return 'Draw';
  if (info.result === 'home') return info.homeTeam;
  if (info.result === 'away') return info.awayTeam;
  return 'Pending';
}

function isCorrect(row: Prediction | undefined, info: FixtureInfo): boolean {
  if (!row || info.result === 'pending') return false;
  if (row.pickOutcome === 'draw') return info.result === 'draw';
  return row.pickTeamName === actualWinner(info);
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
  league.forEach((f) => map.set(`league-${f.id}`, { key: `league-${f.id}`, label: `League · ${f.division}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam, result: f.result }));
  cup.forEach((f) => {
    if (!f.homeTeam || !f.awayTeam) return;
    const result: FixtureInfo['result'] = !f.winnerTeam ? 'pending' : f.winnerTeam === f.homeTeam ? 'home' : f.winnerTeam === f.awayTeam ? 'away' : 'pending';
    map.set(`cup-${f.id}`, { key: `cup-${f.id}`, label: `BookieBall Cup · ${f.roundName}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam, result });
  });
  master.forEach((f) => map.set(`master-${f.id}`, { key: `master-${f.id}`, label: 'Master League', homeTeam: f.homeTeam, awayTeam: f.awayTeam, result: f.result }));
  masterCup.forEach((f) => {
    if (!f.homeTeam || !f.awayTeam) return;
    const result: FixtureInfo['result'] = !f.winnerTeam ? 'pending' : f.winnerTeam === f.homeTeam ? 'home' : f.winnerTeam === f.awayTeam ? 'away' : 'pending';
    map.set(`master_cup-${f.id}`, { key: `master_cup-${f.id}`, label: `Master Cup · ${f.roundName}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam, result });
  });
  trio.forEach((f) => map.set(`trio-${f.id}`, { key: `trio-${f.id}`, label: `Trio League · ${f.division}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam, result: f.result }));
  tier.forEach((f) => map.set(`tier-${f.id}`, { key: `tier-${f.id}`, label: `Tier League · ${f.division}`, homeTeam: f.homeTeam, awayTeam: f.awayTeam, result: f.result }));
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

function streak(scoreboard: Scoreboard): { winner: string; count: number } | null {
  const winners = GAMEWEEKS.map((gw) => weekWinner(scoreboard, gw)).filter((winner): winner is 'Jay' | 'Computer' | 'Draw' => Boolean(winner));
  if (!winners.length) return null;
  const last = winners[winners.length - 1];
  if (last === 'Draw') return { winner: 'Honours even', count: 1 };
  let count = 0;
  for (let i = winners.length - 1; i >= 0 && winners[i] === last; i -= 1) count += 1;
  return { winner: last, count };
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
  const currentByKey = new Map<string, Record<string, Prediction>>();
  data.currentPredictions.predictions.forEach((row) => {
    const key = `${row.competition}-${row.fixtureId}`;
    const slot = currentByKey.get(key) ?? {};
    slot[row.picker] = row;
    currentByKey.set(key, slot);
  });
  const comparisons = data.currentPredictions.slate.map((row) => {
    const key = `${row.competition}-${row.fixtureId}`;
    const picks = currentByKey.get(key) ?? {};
    return { key, fixture: data.currentFixtureLabels.get(key) ?? `Fixture ${row.fixtureId}`, jay: pickLabel(picks.Jay), computer: pickLabel(picks.Computer) };
  }).filter((row) => row.jay !== '—' && row.computer !== '—');
  const disagreements = comparisons.filter((row) => row.jay !== row.computer);
  const agreements = comparisons.filter((row) => row.jay === row.computer);
  const lastWeekAgreements = data.previousRows.filter((row) => row.jayPick === row.computerPick && row.jayPick !== '—');
  const agreementCorrect = lastWeekAgreements.filter((row) => row.jayCorrect && row.computerCorrect).length;
  const agreementRate = lastWeekAgreements.length ? Math.round((agreementCorrect / lastWeekAgreements.length) * 100) : 0;
  const currentStreak = streak(data.currentScoreboard);
  const jayForm = form(data.currentScoreboard, 'Jay');
  const computerForm = form(data.currentScoreboard, 'Computer');

  const upset = useMemo(() => {
    if (!data.h2hSpotlight) return null;
    const { fixture, h2h } = data.h2hSpotlight;
    const total = Math.max(1, h2h.played);
    const aShare = h2h.teamAWins / total;
    const bShare = h2h.teamBWins / total;
    const drawShare = h2h.draws / total;
    const actual = actualWinner(fixture);
    const share = actual === 'Draw' ? drawShare : actual === h2h.teamA.name ? aShare : bShare;
    return { actual, share, fixture };
  }, [data.h2hSpotlight]);

  const slides: Slide[] = [
    {
      id: 'last-week', kicker: 'LAST WEEK · FINAL SCORE', title: `${prevJay?.points ?? 0} — ${prevComputer?.points ?? 0}`, subtitle: previousWinner === 'Draw' ? 'Jay and Computer finished level' : `${previousWinner} won the prediction round`, tone: previousWinner === 'Jay' ? 'gold' : previousWinner === 'Computer' ? 'blue' : 'green',
      content: <div className="prediction-versus"><div><span>JAY</span><strong>{prevJay?.correct ?? 0}/{prevJay?.total ?? 0}</strong><small>correct</small></div><b>VS</b><div><span>COMPUTER</span><strong>{prevComputer?.correct ?? 0}/{prevComputer?.total ?? 0}</strong><small>correct</small></div></div>,
    },
    {
      id: 'championship', kicker: 'THE PREDICTION RACE', title: `${jayTotal.points} — ${computerTotal.points}`, subtitle: `${data.season} championship · ${Math.abs(jayTotal.points - computerTotal.points)} point gap`, tone: 'gold',
      content: <div className="prediction-stat-grid"><div><span>Jay</span><strong>{jayTotal.points}</strong><small>{jayTotal.correct}/{jayTotal.total} correct · {jayTotal.perfectWeeks} perfect weeks</small></div><div><span>Computer</span><strong>{computerTotal.points}</strong><small>{computerTotal.correct}/{computerTotal.total} correct · {computerTotal.perfectWeeks} perfect weeks</small></div></div>,
    },
    {
      id: 'champions', kicker: 'HALL OF CHAMPIONS', title: 'Previous Prediction Champions', subtitle: 'Season winners from the BookieBall archive', tone: 'gold',
      content: <div className="prediction-champions">{data.champions.length ? data.champions.slice(-6).reverse().map((row) => <div key={row.season}><span>{row.season}</span><strong>🏆 {row.winner}</strong><b>{row.points} pts</b><small>{row.runnerUp} {row.runnerUpPoints}</small></div>) : <p>Historical prediction titles will appear as completed seasons are found.</p>}</div>,
    },
    {
      id: 'streak', kicker: 'FORM WATCH', title: currentStreak ? `${currentStreak.winner}${currentStreak.winner === 'Honours even' ? '' : ` · ${currentStreak.count} straight`}` : 'Season just getting started', subtitle: 'Weekly prediction-round momentum', tone: 'red',
      content: <div className="prediction-form-board"><div><strong>JAY</strong><FormDots values={jayForm} /></div><div><strong>COMPUTER</strong><FormDots values={computerForm} /></div></div>,
    },
    ...(data.h2hSpotlight ? [{
      id: 'h2h', kicker: 'LAST WEEK · HEAD TO HEAD', title: `${data.h2hSpotlight.fixture.homeTeam} vs ${data.h2hSpotlight.fixture.awayTeam}`, subtitle: `${data.h2hSpotlight.h2h.played} all-time meetings`, tone: 'blue' as const,
      content: <div className="prediction-h2h"><div><strong>{data.h2hSpotlight.h2h.teamA.name}</strong><span>{data.h2hSpotlight.h2h.teamAWins} wins</span></div><b>{data.h2hSpotlight.h2h.teamAWins} — {data.h2hSpotlight.h2h.draws} — {data.h2hSpotlight.h2h.teamBWins}</b><div><strong>{data.h2hSpotlight.h2h.teamB.name}</strong><span>{data.h2hSpotlight.h2h.teamBWins} wins</span></div></div>,
    }, {
      id: 'probability', kicker: 'ARCHIVE PROBABILITY', title: `${data.h2hSpotlight.fixture.homeTeam} vs ${data.h2hSpotlight.fixture.awayTeam}`, subtitle: 'Smoothed from all recorded H2H meetings', tone: 'green' as const,
      content: (() => { const h = data.h2hSpotlight!.h2h; const total = h.played + 3; const home = Math.round(((h.teamAWins + 1) / total) * 100); const draw = Math.round(((h.draws + 1) / total) * 100); const away = Math.max(0, 100 - home - draw); return <div className="prediction-probability"><div><span>{h.teamA.name}</span><i><em style={{ width: `${home}%` }} /></i><strong>{home}%</strong></div><div><span>Draw</span><i><em style={{ width: `${draw}%` }} /></i><strong>{draw}%</strong></div><div><span>{h.teamB.name}</span><i><em style={{ width: `${away}%` }} /></i><strong>{away}%</strong></div></div>; })(),
    }] : []),
    ...(upset && upset.actual !== 'Pending' ? [{
      id: 'upset', kicker: 'BIGGEST ARCHIVE SURPRISE', title: upset.actual, subtitle: `Won despite only a ${Math.round(upset.share * 100)}% all-time H2H win share in this matchup`, tone: 'red' as const,
      content: <div className="prediction-upset"><span>{upset.fixture.homeTeam}</span><b>⚡ UPSET ⚡</b><span>{upset.fixture.awayTeam}</span></div>,
    }] : []),
    {
      id: 'disagreement', kicker: 'YOU VS THE MACHINE', title: disagreements.length ? `${disagreements.length} disagreement${disagreements.length === 1 ? '' : 's'} this week` : 'No disagreements yet', subtitle: disagreements.length ? 'These are the calls that decide the prediction battle' : 'Lock both cards to reveal the split calls', tone: 'red',
      content: <div className="prediction-disagreements">{disagreements.slice(0, 3).map((row) => <div key={row.key}><small>{row.fixture}</small><span><b>JAY</b> {row.jay}</span><strong>VS</strong><span><b>CPU</b> {row.computer}</span></div>)}</div>,
    },
    {
      id: 'agreement', kicker: 'UNANIMOUS', title: `${agreements.length} agreement pick${agreements.length === 1 ? '' : 's'} this week`, subtitle: lastWeekAgreements.length ? `Last week, shared picks were right ${agreementRate}% of the time` : 'Shared-pick accuracy will build as results arrive', tone: 'green',
      content: <div className="prediction-agreements"><strong>JAY 🤝 COMPUTER</strong>{agreements.slice(0, 4).map((row) => <span key={row.key}>{row.fixture} · {row.jay}</span>)}</div>,
    },
  ];

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % slides.length), 5600);
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

  const priorCount = Math.max(0, seasonNumber(state.currentSeason) - 1);
  const championScoreboards = await Promise.all(Array.from({ length: priorCount }, (_, index) => {
    const season = `S${index + 1}`;
    return api.predictionScoreboard(season).then((scoreboard) => ({ season, scoreboard })).catch(() => null);
  }));
  const champions = championScoreboards.filter((row): row is { season: string; scoreboard: Scoreboard } => Boolean(row && row.scoreboard.totals.length)).map(({ season, scoreboard }) => {
    const ranked = scoreboard.totals.slice().sort((a, b) => b.points - a.points || b.correct - a.correct || a.picker.localeCompare(b.picker));
    return { season, winner: ranked[0]?.picker ?? '—', points: ranked[0]?.points ?? 0, runnerUp: ranked[1]?.picker ?? '—', runnerUpPoints: ranked[1]?.points ?? 0 };
  });

  const teamByName = new Map(teams.map((team) => [team.name.toLowerCase(), team]));
  const h2hCandidates = await Promise.all(previousRows.slice(0, 10).map(async (fixture) => {
    const home = teamByName.get(fixture.homeTeam.toLowerCase());
    const away = teamByName.get(fixture.awayTeam.toLowerCase());
    if (!home || !away) return null;
    const h2h = await api.headToHeadAllTime(home.id, away.id).catch(() => null);
    return h2h ? { fixture, h2h } : null;
  }));
  const h2hSpotlight = h2hCandidates.filter((row): row is NonNullable<typeof row> => Boolean(row)).sort((a, b) => b.h2h.played - a.h2h.played)[0] ?? null;

  return { season: state.currentSeason, previousSeason, previousGw, currentScoreboard, previousScoreboard, previousRows, currentPredictions, currentFixtureLabels, champions, h2hSpotlight };
}

export function PredictionBroadcastEnhancements() {
  const location = useLocation();
  const [data, setData] = useState<BroadcastData | null>(null);
  const [resultsTarget, setResultsTarget] = useState<Element | null>(null);
  const [picksTarget, setPicksTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (location.pathname !== '/gameshow') return;
    let active = true;
    const timer = window.setTimeout(() => {
      void buildBroadcastData().then((payload) => { if (active) setData(payload); }).catch(() => { if (active) setData(null); });
    }, 900);
    return () => { active = false; window.clearTimeout(timer); };
  }, [location.pathname]);

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

  if (!data) return null;
  return <>{resultsTarget ? createPortal(<PredictionMiniShow data={data} />, resultsTarget) : null}{picksTarget && data.currentPredictions.locked ? createPortal(<LockedPicksDrama data={data} />, picksTarget) : null}</>;
}
