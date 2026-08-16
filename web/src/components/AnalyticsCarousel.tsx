import { useEffect, useMemo, useRef, useState } from 'react';

type RatingRow = {
  teamId: number; teamName: string; entries: number; wins: number;
  profit: number; avgProfit: number; winRate: number; rating: number;
};

type DivisionStanding = {
  teamId: number; teamName: string; division: string;
  played: number; wins: number; draws: number; losses: number;
  points: number; profit: number; spins: number; rank: number;
};

type Storyline = {
  id: string; headline: string; detail: string;
  tone: 'positive' | 'warning' | 'neutral'; metric?: string;
};

type Achiev = { key: string; label: string; teamName: string; value: string };

type AllTimeTable = Array<{ teamId: number; teamName: string; points: number; profit: number; spins: number; rank: number }>;

type FixtureResult = {
  id: number; gw: string; division: string;
  homeTeam: string; awayTeam: string;
  homeProfit: number; awayProfit: number;
  result: 'home' | 'away' | 'draw' | 'pending';
};

type Rivalry = {
  id: string; matchup: string; record: string;
  edge: string; avgMargin: string; nextMeeting: string; narrative: string;
};

type PredScore = {
  picker: string; points: number; correct: number; total: number; perfectWeeks: number;
};

type BookieDorHolder = {
  teamId: number; teamName: string; division: string; score: number;
  leagueScore: number; cupScore: number; masterScore: number; consistencyScore: number;
  weightedLeagueScore: number; weightedCupScore: number; weightedMasterScore: number; weightedConsistencyScore: number;
};

type TrophyRoom = {
  cup: Array<{ season: string; teamName: string }>;
  superCup: Array<{ season: string; teamName: string }>;
  masterCup: Array<{ season: string; teamName: string }>;
  bookieDor: Array<{ season: string; teamName: string }>;
  masterLeague: Array<{ season: string; teamName: string }>;
  divisions: Record<string, Array<{ season: string; teamName: string }>>;
};

type TeamTrend = {
  teamId: number; rankDelta: number; pointsDelta: number; profitDelta: number;
  pointsDeltaVsPreviousWindow: number | null; profitDeltaVsPreviousWindow: number | null;
};

type SnippetCard = {
  id: string;
  category: 'team' | 'division' | 'history' | 'achievement' | 'storyline' | 'rivalry' | 'shock' | 'trend' | 'prediction' | 'mvp' | 'trophy' | 'momentum';
  icon: string;
  label: string;
  headline: string;
  detail: string;
  tone?: 'positive' | 'warning' | 'neutral';
  metric?: string;
};

function pickShuffled<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function buildCards(
  ratings: RatingRow[],
  leagueTable: Record<string, DivisionStanding[]>,
  allTime: { pointsTable: AllTimeTable; profitTable: AllTimeTable; spinsTable: AllTimeTable } | null,
  achievements: Achiev[],
  storylines: Storyline[],
  fixtures: FixtureResult[],
  tickerItems: string[],
  rivalries: Rivalry[],
  predScores: PredScore[],
  bookieDorHolder: BookieDorHolder | null,
  bookieDorLeaderboard: BookieDorHolder[],
  trophyRoom: TrophyRoom | null,
  teamTrends: TeamTrend[],
  teams: Array<{ id: number; name: string }>,
): SnippetCard[] {
  const cards: SnippetCard[] = [];
  let id = 0;
  const nextId = () => `snippet-${++id}`;

  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  const sortedByRating = [...ratings].sort((a, b) => b.rating - a.rating);
  const sortedByProfit = [...ratings].sort((a, b) => b.profit - a.profit);
  const sortedByWinRate = [...ratings].filter((r) => r.wins + r.losses + r.draws > 0).sort((a, b) => b.winRate - a.winRate);
  const sortedByWorstWinRate = [...ratings].filter((r) => r.wins + r.losses + r.draws > 0).sort((a, b) => a.winRate - b.winRate);
  const sortedByLowestProfit = [...ratings].sort((a, b) => a.profit - b.profit);
  const sortedBySpins = [...ratings].sort((a, b) => b.entries - a.entries);

  if (sortedByRating.length > 0) {
    const best = sortedByRating[0];
    cards.push({ id: nextId(), category: 'team', icon: 'T', label: 'The Good', headline: `${best.teamName}`, detail: `Top of the power ratings with ${best.rating >= 0 ? '+' : ''}${best.rating.toFixed(3)} — the team to beat this season`, tone: 'positive', metric: `${best.rating >= 0 ? '+' : ''}${best.rating.toFixed(3)}` });
  }
  if (sortedByProfit.length > 0) {
    const best = sortedByProfit[0];
    cards.push({ id: nextId(), category: 'team', icon: 'P', label: 'Profit King', headline: `${best.teamName}`, detail: `Leading the profit charts with +£${best.profit.toFixed(2)} — pure betting brilliance`, tone: 'positive', metric: `+£${best.profit.toFixed(2)}` });
  }
  if (sortedByWinRate.length > 0) {
    const best = sortedByWinRate[0];
    cards.push({ id: nextId(), category: 'team', icon: 'W', label: 'Sharpshooter', headline: `${best.teamName}`, detail: `Best win rate in the book at ${(best.winRate * 100).toFixed(1)}% — finding winners consistently`, tone: 'positive', metric: `${(best.winRate * 100).toFixed(1)}%` });
  }
  if (sortedByWorstWinRate.length > 0 && sortedByWorstWinRate[0] !== sortedByWinRate[0]) {
    const worst = sortedByWorstWinRate[0];
    cards.push({ id: nextId(), category: 'team', icon: 'U', label: 'The Ugly', headline: `${worst.teamName}`, detail: `Rock-bottom win rate at ${(worst.winRate * 100).toFixed(1)}% — rough run of form`, tone: 'warning', metric: `${(worst.winRate * 100).toFixed(1)}%` });
  }
  if (sortedByLowestProfit.length > 0 && sortedByLowestProfit[0] !== sortedByProfit[0]) {
    const worst = sortedByLowestProfit[0];
    cards.push({ id: nextId(), category: 'team', icon: 'B', label: 'The Bad', headline: `${worst.teamName}`, detail: `Deepest in the red at £${worst.profit.toFixed(2)} — tough season at the books`, tone: 'warning', metric: `£${worst.profit.toFixed(2)}` });
  }
  if (sortedBySpins.length > 0) {
    const spinner = sortedBySpins[0];
    cards.push({ id: nextId(), category: 'team', icon: 'S', label: 'Spin King', headline: `${spinner.teamName}`, detail: `Taken ${spinner.entries} spins total — living on the edge every gameweek`, tone: 'neutral', metric: `${spinner.entries} spins` });
  }

  const divisions = Object.entries(leagueTable);
  divisions.forEach(([divName, rows]) => {
    const sorted = [...rows].sort((a, b) => a.rank - b.rank);
    if (sorted.length < 2) return;
    const leader = sorted[0];
    const second = sorted[1];
    const last = sorted[sorted.length - 1];
    const gap = leader.points - second.points;
    if (gap === 0) {
      cards.push({ id: nextId(), category: 'division', icon: 'D', label: 'Dead Heat', headline: `${divName}`, detail: `${leader.teamName} and ${second.teamName} are tied on ${leader.points} points at the top — it's neck and neck`, tone: 'neutral', metric: `${leader.points} pts` });
    } else {
      cards.push({ id: nextId(), category: 'division', icon: 'L', label: 'Division Leaders', headline: `${leader.teamName}`, detail: `Lead ${divName} by ${gap} point${gap === 1 ? '' : 's'} with ${leader.points} points from ${leader.played} games`, tone: 'positive', metric: `${gap}pt gap` });
    }
    const spread = leader.points - last.points;
    if (spread <= 3 && sorted.length > 2) {
      cards.push({ id: nextId(), category: 'division', icon: 'R', label: 'Tight Race', headline: `${divName}`, detail: `Only ${spread} point${spread === 1 ? '' : 's'} separate 1st from ${sorted.length}th — anyone's game`, tone: 'neutral', metric: `${spread}pt spread` });
    }
  });

  if (allTime) {
    const atPoints = allTime.pointsTable;
    const atProfit = allTime.profitTable;
    if (atPoints.length > 0) {
      cards.push({ id: nextId(), category: 'history', icon: 'A', label: 'All-Time Greats', headline: `${atPoints[0].teamName}`, detail: `All-time points leader with ${atPoints[0].points} points`, tone: 'positive', metric: `${atPoints[0].points} pts` });
    }
    if (atProfit.length > 0) {
      cards.push({ id: nextId(), category: 'history', icon: '£', label: 'All-Time Profit', headline: `${atProfit[0].teamName}`, detail: `Biggest all-time earner with +£${atProfit[0].profit.toFixed(2)} profit`, tone: 'positive', metric: `+£${atProfit[0].profit.toFixed(2)}` });
    }
  }

  achievements.forEach((a) => {
    cards.push({ id: nextId(), category: 'achievement', icon: '★', label: 'Milestone', headline: `${a.teamName}`, detail: `${a.label}: ${a.value}`, tone: 'positive', metric: a.value });
  });

  storylines.forEach((s) => {
    cards.push({ id: nextId(), category: 'storyline', icon: '!', label: 'Storyline', headline: s.headline, detail: s.detail, tone: s.tone });
  });

  tickerItems.forEach((item, i) => {
    if (i >= 6) return;
    cards.push({ id: nextId(), category: 'trend', icon: '›', label: 'In The News', headline: item, detail: item, tone: 'neutral' });
  });

  const resolved = fixtures.filter((f) => f.result !== 'pending');
  const shocks: SnippetCard[] = [];
  resolved.forEach((f) => {
    if (f.homeProfit > 3 && f.result === 'away') {
      shocks.push({ id: nextId(), category: 'shock', icon: '⚡', label: 'Shock Result', headline: `${f.awayTeam} beat ${f.homeTeam}`, detail: `${f.homeTeam} had +£${f.homeProfit.toFixed(2)} profit but lost to ${f.awayTeam} (${f.awayProfit >= 0 ? '+' : ''}£${f.awayProfit.toFixed(2)}) — massive upset in ${f.division}`, tone: 'warning', metric: `${f.division}` });
    }
    if (f.awayProfit > 3 && f.result === 'home') {
      shocks.push({ id: nextId(), category: 'shock', icon: '⚡', label: 'Shock Result', headline: `${f.homeTeam} beat ${f.awayTeam}`, detail: `${f.awayTeam} had +£${f.awayProfit.toFixed(2)} profit but lost to ${f.homeTeam} (${f.homeProfit >= 0 ? '+' : ''}£${f.homeProfit.toFixed(2)}) — huge surprise in ${f.division}`, tone: 'warning', metric: `${f.division}` });
    }
  });
  pickShuffled(shocks, 4).forEach((s) => cards.push(s));

  /* ── Rivalry Cards ── */
  rivalries.forEach((r) => {
    cards.push({ id: nextId(), category: 'rivalry', icon: '⚔', label: 'Rivalry', headline: r.matchup, detail: `${r.record} — ${r.narrative}`, tone: 'neutral', metric: r.edge });
  });

  /* ── Prediction Contest Cards ── */
  if (predScores.length >= 2) {
    const sortedScores = [...predScores].sort((a, b) => b.points - a.points);
    const leader = sortedScores[0];
    const second = sortedScores[1];
    const diff = leader.points - second.points;
    cards.push({ id: nextId(), category: 'prediction', icon: '🎯', label: 'Prediction Race', headline: `${leader.picker} leads with ${leader.points} pts`, detail: `${leader.picker}: ${leader.correct}/${leader.total} correct (${leader.picker === 'Jay' ? 'Human' : 'CPU'}) — ${second.picker} trails by ${diff} pt${diff === 1 ? '' : 's'}`, tone: 'positive', metric: `${leader.points} pts` });
    const perfectWeeks = predScores.filter((p) => p.perfectWeeks > 0);
    if (perfectWeeks.length > 0) {
      const pw = perfectWeeks[0];
      cards.push({ id: nextId(), category: 'prediction', icon: '🎯', label: 'Perfect Week', headline: `${pw.picker} hit a perfect week!`, detail: `${pw.picker} went ${pw.correct}/${pw.total} — flawless predictions`, tone: 'positive', metric: `${pw.correct}/${pw.total}` });
    }
  }

  /* ── BookieDor MVP Cards ── */
  if (bookieDorHolder) {
    cards.push({ id: nextId(), category: 'mvp', icon: '🏆', label: 'BookieDor MVP', headline: `${bookieDorHolder.teamName}`, detail: `Current BookieDor holder with a weighted score of ${bookieDorHolder.score.toFixed(1)} — leading the MVP race across league, cup and master league`, tone: 'positive', metric: `${bookieDorHolder.score.toFixed(1)} pts` });
  }
  if (bookieDorLeaderboard.length >= 2) {
    const top3 = bookieDorLeaderboard.slice(0, 3);
    const gap = top3[0].score - (top3[1]?.score ?? 0);
    cards.push({ id: nextId(), category: 'mvp', icon: '🏆', label: 'MVP Race', headline: `${top3[0].teamName} leads the MVP race`, detail: `${top3.map((t, i) => `#${i + 1} ${t.teamName} (${t.score.toFixed(1)})`).join(' • ')} — ${gap.toFixed(1)} point gap at the top`, tone: 'positive', metric: `${gap.toFixed(1)}pt gap` });
  }

  /* ── Trophy History Cards ── */
  if (trophyRoom) {
    if (trophyRoom.cup.length > 0) {
      const lastWinner = trophyRoom.cup[trophyRoom.cup.length - 1];
      cards.push({ id: nextId(), category: 'trophy', icon: '👑', label: 'Cup Champions', headline: `${lastWinner.teamName} — BookieBall Cup ${lastWinner.season}`, detail: `Most recent BookieBall Cup winner. ${trophyRoom.cup.length} seasons of cup history.`, tone: 'positive', metric: `Season ${lastWinner.season}` });
    }
    if (trophyRoom.superCup.length > 0) {
      const last = trophyRoom.superCup[trophyRoom.superCup.length - 1];
      cards.push({ id: nextId(), category: 'trophy', icon: '⭐', label: 'Super Cup', headline: `${last.teamName} — Super Cup ${last.season}`, detail: `Reigning Super Cup champions. ${trophyRoom.superCup.length} Super Cups contested.`, tone: 'positive', metric: `Season ${last.season}` });
    }
    const allTitles = new Map<string, number>();
    Object.values(trophyRoom.divisions).forEach((seasons) => {
      seasons.forEach((s) => {
        allTitles.set(s.teamName, (allTitles.get(s.teamName) ?? 0) + 1);
      });
    });
    if (allTitles.size > 0) {
      const mostDecorated = [...allTitles.entries()].sort((a, b) => b[1] - a[1])[0];
      if (mostDecorated && mostDecorated[1] > 1) {
        cards.push({ id: nextId(), category: 'trophy', icon: '🏅', label: 'Most Decorated', headline: `${mostDecorated[0]} — ${mostDecorated[1]} division titles`, detail: `The most successful team in league history with ${mostDecorated[1]} division championship${mostDecorated[1] === 1 ? '' : 's'}`, tone: 'positive', metric: `${mostDecorated[1]} titles` });
      }
    }
    if (trophyRoom.bookieDor.length > 0) {
      const recent = trophyRoom.bookieDor[trophyRoom.bookieDor.length - 1];
      cards.push({ id: nextId(), category: 'trophy', icon: '🏆', label: 'BookieDor History', headline: `${recent.teamName} — BookieDor ${recent.season}`, detail: `Previous BookieDor winner. The ultimate all-round performance award.`, tone: 'positive', metric: `Season ${recent.season}` });
    }
  }

  /* ── Momentum / Trend Cards ── */
  const hotStreaks = teamTrends.filter((t) => (t.pointsDeltaVsPreviousWindow ?? 0) > 0).sort((a, b) => (b.pointsDeltaVsPreviousWindow ?? 0) - (a.pointsDeltaVsPreviousWindow ?? 0));
  const coldStreaks = teamTrends.filter((t) => (t.pointsDeltaVsPreviousWindow ?? 0) < 0).sort((a, b) => (a.pointsDeltaVsPreviousWindow ?? 0) - (b.pointsDeltaVsPreviousWindow ?? 0));
  const risers = teamTrends.filter((t) => t.rankDelta < 0).sort((a, b) => a.rankDelta - b.rankDelta);
  const fallers = teamTrends.filter((t) => t.rankDelta > 0).sort((a, b) => b.rankDelta - a.rankDelta);

  pickShuffled(hotStreaks, 2).forEach((t) => {
    const name = teamNameById.get(t.teamId) ?? `Team #${t.teamId}`;
    const delta = t.pointsDeltaVsPreviousWindow ?? 0;
    cards.push({ id: nextId(), category: 'momentum', icon: '🔥', label: 'On Fire', headline: `${name} is heating up`, detail: `Earned ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} more points in recent games compared to before — red-hot form`, tone: 'positive', metric: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts` });
  });
  pickShuffled(coldStreaks, 2).forEach((t) => {
    const name = teamNameById.get(t.teamId) ?? `Team #${t.teamId}`;
    const delta = t.pointsDeltaVsPreviousWindow ?? 0;
    cards.push({ id: nextId(), category: 'momentum', icon: '🥶', label: 'Cold Spell', headline: `${name} has gone cold`, detail: `${delta.toFixed(1)} points fewer in recent games — a worrying slide in form`, tone: 'warning', metric: `${delta} pts` });
  });
  pickShuffled(risers, 2).forEach((t) => {
    const name = teamNameById.get(t.teamId) ?? `Team #${t.teamId}`;
    const delta = Math.abs(t.rankDelta);
    cards.push({ id: nextId(), category: 'momentum', icon: '⬆', label: 'On The Rise', headline: `${name} climbed ${delta} place${delta === 1 ? '' : 's'}!`, detail: `Surged up the standings by ${delta} position${delta === 1 ? '' : 's'} — momentum is building`, tone: 'positive', metric: `+${delta} places` });
  });
  pickShuffled(fallers, 2).forEach((t) => {
    const name = teamNameById.get(t.teamId) ?? `Team #${t.teamId}`;
    const delta = Math.abs(t.rankDelta);
    cards.push({ id: nextId(), category: 'momentum', icon: '⬇', label: 'Slipping', headline: `${name} dropped ${delta} place${delta === 1 ? '' : 's'}`, detail: `Fell ${delta} position${delta === 1 ? '' : 's'} in the rankings — need to turn things around`, tone: 'warning', metric: `-${delta} places` });
  });

  pickShuffled(cards, cards.length);
  return cards;
}

export function AnalyticsCarousel({
  ratings, leagueTable, allTime, achievements, storylines, fixtures, tickerItems,
  rivalries, predScores, bookieDorHolder, bookieDorLeaderboard, trophyRoom, teamTrends, teams,
}: {
  ratings: RatingRow[];
  leagueTable: Record<string, DivisionStanding[]>;
  allTime: { pointsTable: AllTimeTable; profitTable: AllTimeTable; spinsTable: AllTimeTable } | null;
  achievements: Achiev[];
  storylines: Storyline[];
  fixtures: FixtureResult[];
  tickerItems: string[];
  rivalries: Rivalry[];
  predScores: PredScore[];
  bookieDorHolder: BookieDorHolder | null;
  bookieDorLeaderboard: BookieDorHolder[];
  trophyRoom: TrophyRoom | null;
  teamTrends: TeamTrend[];
  teams: Array<{ id: number; name: string }>;
}) {
  const cards = useMemo(() => buildCards(
    ratings, leagueTable, allTime, achievements, storylines, fixtures, tickerItems,
    rivalries, predScores, bookieDorHolder, bookieDorLeaderboard, trophyRoom, teamTrends, teams,
  ), [ratings, leagueTable, allTime, achievements, storylines, fixtures, tickerItems,
      rivalries, predScores, bookieDorHolder, bookieDorLeaderboard, trophyRoom, teamTrends, teams]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cards.length <= 1 || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % cards.length);
    }, 7000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cards.length, paused]);

  if (cards.length === 0) return null;

  const current = cards[index];
  if (!current) return null;

  const toneColors: Record<string, { border: string; bg: string; text: string; badge: string }> = {
    positive: { border: 'rgba(100,220,100,0.25)', bg: 'rgba(20,50,20,0.25)', text: '#8fda8f', badge: 'rgba(100,220,100,0.2)' },
    warning: { border: 'rgba(255,200,50,0.25)', bg: 'rgba(50,40,10,0.25)', text: '#f0d060', badge: 'rgba(255,200,50,0.2)' },
    neutral: { border: 'rgba(150,180,220,0.15)', bg: 'rgba(10,20,35,0.35)', text: '#a0b8d0', badge: 'rgba(150,180,220,0.15)' },
  };

  const tc = toneColors[current.tone ?? 'neutral'];

  return (
    <div
      className="analytics-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="analytics-carousel-card" style={{ borderColor: tc.border, background: tc.bg }}>
        <div className="analytics-carousel-top">
          <span className="analytics-carousel-badge" style={{ background: tc.badge, color: tc.text }}>
            {current.icon} {current.label}
          </span>
          <span className="analytics-carousel-count">{index + 1} / {cards.length}</span>
        </div>

        <div className="analytics-carousel-body">
          <div className="analytics-carousel-category-icon" style={{ color: tc.text }}>
            {current.icon}
          </div>
          <div className="analytics-carousel-text">
            <strong className="analytics-carousel-headline">{current.headline}</strong>
            <p className="analytics-carousel-detail">{current.detail}</p>
          </div>
        </div>

        {current.metric && (
          <div className="analytics-carousel-metric" style={{ borderTopColor: tc.border, color: tc.text }}>
            {current.metric}
          </div>
        )}
      </div>

      <div className="analytics-carousel-dots">
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`analytics-carousel-dot${i === index ? ' active' : ''}`}
            style={i === index ? { background: tc.text } : undefined}
            onClick={() => setIndex(i)}
            aria-label={`Go to snippet ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
