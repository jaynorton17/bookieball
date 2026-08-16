import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { TeamBadge } from './TeamBadge';

export type VerifiedFactRailItem = {
  id: string;
  label: string;
  headline: string;
  detail: string;
  tone?: 'live' | 'team' | 'fixtures' | 'results' | 'competition' | 'movement';
};

export type BroadcastBattleCard = {
  id: string;
  label: string;
  headline: string;
  detail: string;
  metric?: string;
  stamp?: string;
  tone?: 'live' | 'team' | 'fixtures' | 'results' | 'competition' | 'movement' | 'warning' | 'positive';
  trend?: number[];
};

export type LowerThirdAlertItem = {
  id: string;
  label: string;
  headline: string;
  tone?: 'live' | 'team' | 'fixtures' | 'results' | 'competition' | 'movement' | 'warning' | 'positive';
};

export type CompetitionBracketParticipant = {
  teamName: string;
  score?: string | null;
  winner?: boolean;
  teamId?: number;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
};

export type CompetitionBracketTie = {
  id: string;
  title?: string;
  detail?: string;
  statusLabel?: string;
  active?: boolean;
  resolved?: boolean;
  winnerPath?: boolean;
  home: CompetitionBracketParticipant;
  away: CompetitionBracketParticipant;
};

export type CompetitionBracketRound = {
  key: string;
  label: string;
  ties: CompetitionBracketTie[];
};

type CompetitionBracketTreeProps = {
  kicker?: string;
  title: string;
  subtitle: string;
  rounds: CompetitionBracketRound[];
  summary?: string[];
  sideMatch?: CompetitionBracketTie | null;
  sideMatchLabel?: string;
  fullNames?: boolean;
  showMeta?: boolean;
};

type LiveOddsMeterProps = {
  probability: number;
  fillStyle?: CSSProperties;
  compact?: boolean;
  draw?: boolean;
};

type CompetitionBracketBoardProps = {
  kicker?: string;
  title: string;
  subtitle: string;
  rounds: CompetitionBracketRound[];
  summary?: string[];
};

type VerifiedFactRailProps = {
  title?: string;
  items: VerifiedFactRailItem[];
  intervalMs?: number;
};

type BroadcastBattleBoardProps = {
  kicker?: string;
  title: string;
  subtitle: string;
  cards: BroadcastBattleCard[];
};

type LowerThirdAlertRailProps = {
  items: LowerThirdAlertItem[];
  label?: string;
  intervalMs?: number;
};

type OddsMovement = 'steady' | 'shortening' | 'drifting';

function formatDeltaLabel(delta: number): string {
  const points = Math.abs(delta * 100);
  const display = points >= 10 ? points.toFixed(0) : points.toFixed(1);
  return `${display} pts`;
}

function toneGlyph(tone: VerifiedFactRailItem['tone'] | BroadcastBattleCard['tone'] | LowerThirdAlertItem['tone']): string {
  switch (tone) {
    case 'results':
      return 'FT';
    case 'fixtures':
      return 'VS';
    case 'competition':
      return 'KO';
    case 'team':
      return 'TM';
    case 'movement':
      return 'UP';
    case 'warning':
      return '!';
    case 'positive':
      return '+';
    case 'live':
    default:
      return 'LIVE';
  }
}

function buildTrendPath(values: number[]): string {
  if (values.length <= 1) {
    return '';
  }
  const width = 120;
  const height = 28;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue || 1;
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - minValue) / span) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function LiveOddsMeter({ probability, fillStyle, compact = false, draw = false }: LiveOddsMeterProps) {
  const previousProbabilityRef = useRef(probability);
  const resetTimerRef = useRef<number | null>(null);
  const [movement, setMovement] = useState<OddsMovement>('steady');
  const [label, setLabel] = useState('Steady');

  useEffect(() => {
    const previousProbability = previousProbabilityRef.current;
    const delta = probability - previousProbability;
    if (Math.abs(delta) < 0.002) {
      previousProbabilityRef.current = probability;
      return;
    }

    const nextMovement: OddsMovement = delta > 0 ? 'shortening' : 'drifting';
    setMovement(nextMovement);
    setLabel(`${nextMovement === 'shortening' ? 'Shorter' : 'Drifted'} ${formatDeltaLabel(delta)}`);
    previousProbabilityRef.current = probability;

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setMovement('steady');
      setLabel('Steady');
      resetTimerRef.current = null;
    }, 2200);

    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [probability]);

  return (
    <div className={`studio-live-odds-wrap${compact ? ' compact' : ''}`}>
      <div className={`studio-odds-meter${compact ? ' compact' : ''}${movement !== 'steady' ? ` is-${movement}` : ''}`}>
        <span
          className={`studio-odds-meter-fill${draw ? ' draw' : ''}${movement !== 'steady' ? ` ${movement}` : ''}`}
          style={{
            width: `${probability * 100}%`,
            ...fillStyle,
          }}
        />
      </div>
      <span className={`studio-odds-move-chip ${movement}`}>{label}</span>
    </div>
  );
}

const TREE_ROW_STARTS: Record<number, number[]> = {
  8: [2, 4, 6, 8, 10, 12, 14, 16],
  4: [3, 7, 11, 15],
  2: [5, 13],
  1: [9],
};

function shortBracketName(name: string): string {
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

function bracketMatchClasses(tie: CompetitionBracketTie, side: 'left' | 'right', col: number, fixtureIndex: number): string {
  const classes = [
    'bracket-match',
    side === 'left' ? 'side-left' : 'side-right',
    `col-${col}`,
    fixtureIndex % 2 === 0 ? 'pair-top' : 'pair-bottom',
  ];
  if (tie.resolved) {
    classes.push('resolved');
  }
  if (tie.winnerPath) {
    classes.push(side === 'left' ? 'path-left' : 'path-right');
  }
  return classes.join(' ');
}

function renderTreeMatch(tie: CompetitionBracketTie, fullNames = false, showMeta = false) {
  const metaText = showMeta
    ? [tie.statusLabel, tie.detail].filter(Boolean).join(' • ')
    : '';

  return (
    <div>
      {[tie.home, tie.away].map((side, sideIndex) => (
        <div key={`${tie.id}-${sideIndex}-${side.teamName}`} className={`studio-bracket-tree-team${side.winner ? ' winner' : ''}`}>
          <div className="studio-bracket-tree-team-name">
            <TeamBadge
              name={side.teamName}
              ballColor={side.ballColor}
              ringColor={side.ringColor}
              textColor={side.textColor}
              size={16}
            />
            <span>{fullNames ? side.teamName : shortBracketName(side.teamName)}</span>
          </div>
          <strong>{side.score ?? '—'}</strong>
        </div>
      ))}
      {metaText ? (
        <div
          style={{
            marginTop: 6,
            fontSize: '0.62rem',
            lineHeight: 1.15,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: tie.resolved ? '#f6e7aa' : tie.active ? '#eef5ff' : 'rgba(232, 239, 255, 0.74)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {metaText}
        </div>
      ) : null}
    </div>
  );
}

export function CompetitionBracketTree({
  kicker = 'Bracket',
  title,
  subtitle,
  rounds,
  summary = [],
  sideMatch = null,
  sideMatchLabel,
  fullNames = false,
  showMeta = false,
}: CompetitionBracketTreeProps) {
  const finalRound = rounds[rounds.length - 1] ?? null;
  const finalTie = finalRound?.ties[0] ?? null;
  const wingRounds = rounds.slice(0, -1);
  const leftRounds = wingRounds.map((round) => ({
    label: round.label,
    ties: round.ties.slice(0, Math.ceil(round.ties.length / 2)),
  }));
  const rightRounds = wingRounds.map((round) => ({
    label: round.label,
    ties: round.ties.slice(Math.ceil(round.ties.length / 2)),
  })).reverse();

  return (
    <div className="studio-competition-bracket studio-bracket-tree">
      <div className="studio-fixtures-head studio-odds-head">
        <span className="studio-kicker">{kicker}</span>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {summary.length > 0 && (
        <div className="studio-odds-summary-strip">
          {summary.map((item) => (
            <span key={item} className="studio-odds-summary-pill accent">{item}</span>
          ))}
        </div>
      )}
      <div className="studio-bracket-tree-canvas">
        <div
          className="bracket-vs-layout studio-bracket-tree-layout"
          style={{ ['--bracket-tree-columns' as string]: `${Math.max(1, wingRounds.length)}` }}
        >
          <div className="bracket-wing bracket-wing-grid studio-bracket-tree-wing">
            {leftRounds.map((round, roundIndex) => {
              const rows = TREE_ROW_STARTS[round.ties.length] ?? [];
              return (
                <Fragment key={`left-${round.label}`}>
                  <h4 className="bracket-round-title" style={{ gridColumn: roundIndex + 1, gridRow: 1 }}>{round.label}</h4>
                  {round.ties.map((tie, fixtureIndex) => (
                    <div
                      key={tie.id}
                      className={bracketMatchClasses(tie, 'left', roundIndex, fixtureIndex)}
                      style={{ gridColumn: roundIndex + 1, gridRow: `${rows[fixtureIndex] ?? 1} / span 1` }}
                      title={tie.detail ?? tie.title ?? tie.id}
                    >
                      {renderTreeMatch(tie, fullNames, showMeta)}
                    </div>
                  ))}
                </Fragment>
              );
            })}
          </div>

          <div className="bracket-final studio-bracket-tree-final">
            <h4>{finalRound?.label ?? 'Final'}</h4>
            <div
              className={`bracket-match final-match${finalTie?.resolved ? ' resolved' : ''}${finalTie?.active ? ' active' : ''}${finalTie?.winnerPath ? ' winner-path' : ''}`}
              title={finalTie?.detail ?? 'Final'}
            >
              {finalTie ? renderTreeMatch(finalTie, fullNames, showMeta) : <div>Final pending</div>}
            </div>
            {sideMatch ? (
              <div className="studio-bracket-side-match">
                <span>{sideMatchLabel ?? 'Additional Tie'}</span>
                <div
                  className={`bracket-match${sideMatch.resolved ? ' resolved' : ''}${sideMatch.active ? ' active' : ''}${sideMatch.winnerPath ? ' winner-path' : ''}`}
                  title={sideMatch.detail ?? sideMatch.id}
                >
                  {renderTreeMatch(sideMatch, fullNames, showMeta)}
                </div>
              </div>
            ) : null}
          </div>

          <div className="bracket-wing bracket-wing-grid bracket-wing-right studio-bracket-tree-wing">
            {rightRounds.map((round, roundIndex) => {
              const rows = TREE_ROW_STARTS[round.ties.length] ?? [];
              return (
                <Fragment key={`right-${round.label}`}>
                  <h4 className="bracket-round-title" style={{ gridColumn: roundIndex + 1, gridRow: 1 }}>{round.label}</h4>
                  {round.ties.map((tie, fixtureIndex) => (
                    <div
                      key={tie.id}
                      className={bracketMatchClasses(tie, 'right', roundIndex, fixtureIndex)}
                      style={{ gridColumn: roundIndex + 1, gridRow: `${rows[fixtureIndex] ?? 1} / span 1` }}
                      title={tie.detail ?? tie.title ?? tie.id}
                    >
                      {renderTreeMatch(tie, fullNames, showMeta)}
                    </div>
                  ))}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompetitionBracketBoard({
  kicker = 'Bracket',
  title,
  subtitle,
  rounds,
  summary = [],
}: CompetitionBracketBoardProps) {
  return (
    <div className="studio-competition-bracket">
      <div className="studio-fixtures-head studio-odds-head">
        <span className="studio-kicker">{kicker}</span>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {summary.length > 0 && (
        <div className="studio-odds-summary-strip">
          {summary.map((item) => (
            <span key={item} className="studio-odds-summary-pill accent">{item}</span>
          ))}
        </div>
      )}
      <div
        className={`studio-competition-bracket-grid columns-${Math.max(1, Math.min(5, rounds.length))}`}
        style={{ ['--competition-bracket-columns' as string]: `${Math.max(1, Math.min(5, rounds.length))}` }}
      >
        {rounds.map((round) => (
          <section key={round.key} className="studio-competition-bracket-round">
            <span className="studio-bracket-title">{round.label}</span>
            <div className="studio-competition-bracket-list">
              {round.ties.length === 0 ? (
                <div className="studio-bracket-empty">No ties available yet.</div>
              ) : (
                round.ties.map((tie) => (
                  <article
                    key={tie.id}
                    className={`studio-competition-bracket-card${tie.active ? ' active' : ''}${tie.resolved ? ' resolved' : ''}${tie.winnerPath ? ' winner-path' : ''}`}
                  >
                    <div className="studio-competition-bracket-card-head">
                      <div className="studio-competition-bracket-copy">
                        {tie.title ? <span>{tie.title}</span> : null}
                        {tie.detail ? <strong>{tie.detail}</strong> : null}
                      </div>
                      {tie.statusLabel ? (
                        <span className={`studio-story-stamp tone-${tie.resolved ? 'positive' : tie.active ? 'movement' : 'fixtures'}`}>
                          {tie.statusLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="studio-competition-bracket-teams">
                      {[tie.home, tie.away].map((side, sideIndex) => (
                        <div
                          key={`${tie.id}-${sideIndex}-${side.teamName}`}
                          className={`studio-competition-bracket-team${side.winner ? ' winner' : ''}`}
                        >
                          <div className="team-name">
                            <TeamBadge
                              name={side.teamName}
                              ballColor={side.ballColor}
                              ringColor={side.ringColor}
                              textColor={side.textColor}
                              size={22}
                            />
                            <strong>{side.teamName}</strong>
                          </div>
                          <span>{side.score ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function BroadcastBattleBoard({
  kicker = 'Race Board',
  title,
  subtitle,
  cards,
}: BroadcastBattleBoardProps) {
  return (
    <div className="studio-battle-board">
      <div className="studio-fixtures-head studio-odds-head">
        <span className="studio-kicker">{kicker}</span>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className={`studio-battle-grid cards-${Math.max(1, Math.min(4, cards.length))}`}>
        {cards.map((card) => {
          const trendPath = card.trend && card.trend.length > 1 ? buildTrendPath(card.trend) : '';
          return (
            <article key={card.id} className={`studio-battle-card tone-${card.tone ?? 'movement'}`}>
              <div className="studio-battle-card-head">
                <div className="studio-battle-copy">
                  <span>{card.label}</span>
                  <strong>{card.headline}</strong>
                </div>
                <span className={`studio-story-stamp tone-${card.tone ?? 'movement'}`}>{card.stamp ?? toneGlyph(card.tone)}</span>
              </div>
              <p>{card.detail}</p>
              <div className="studio-battle-card-foot">
                {card.metric ? <span className="studio-battle-metric">{card.metric}</span> : <span className="studio-battle-metric">Live board</span>}
                {trendPath ? (
                  <svg className="studio-battle-trend" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
                    <path d={trendPath} />
                  </svg>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function VerifiedFactRail({ title = 'Verified Fact Rail', items, intervalMs = 5500 }: VerifiedFactRailProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) {
      setActiveIndex(0);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % items.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, items.length]);

  const visibleItems = useMemo(() => {
    if (items.length === 0) {
      return [];
    }
    const count = Math.min(3, items.length);
    return Array.from({ length: count }, (_, offset) => items[(activeIndex + offset) % items.length]);
  }, [activeIndex, items]);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section className="studio-verified-fact-rail">
      <div className="studio-producer-card-head">
        <span className="studio-producer-label">{title}</span>
        <span className="studio-producer-alert">DB ONLY</span>
      </div>
      <div className="studio-verified-fact-items">
        {visibleItems.map((item) => (
          <article key={item.id} className={`studio-verified-fact-card tone-${item.tone ?? 'movement'}`}>
            <span className="studio-verified-fact-topline">
              <em>{toneGlyph(item.tone)}</em>
              <strong>{item.label}</strong>
            </span>
            <strong>{item.headline}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LowerThirdAlertRail({ items, label = 'Live Alerts', intervalMs = 4200 }: LowerThirdAlertRailProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) {
      setActiveIndex(0);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % items.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, items.length]);

  if (items.length === 0) {
    return null;
  }

  const visible = Array.from({ length: Math.min(3, items.length) }, (_, offset) => items[(activeIndex + offset) % items.length]);

  return (
    <div className="studio-alert-rail" aria-live="polite">
      <span className="studio-alert-rail-label">{label}</span>
      <div className="studio-alert-rail-track">
        {visible.map((item) => (
          <article key={item.id} className={`studio-alert-chip tone-${item.tone ?? 'movement'}`}>
            <em>{toneGlyph(item.tone)}</em>
            <span>{item.label}</span>
            <strong>{item.headline}</strong>
          </article>
        ))}
      </div>
    </div>
  );
}

