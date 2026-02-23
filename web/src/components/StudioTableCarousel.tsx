import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TeamBadge } from './TeamBadge';

export type StudioTableRow = {
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  record: string;
  form?: Array<'W' | 'D' | 'L'>;
  trend: 'up' | 'down' | 'flat';
  isChampion?: boolean;
  isRelegated?: boolean;
};

export type StudioTableDivision = {
  id: string;
  title: string;
  subtitle: string;
  crest: string;
  rows: StudioTableRow[];
};

export type StudioTablePresentationMode = 'clean' | 'full' | 'classic';
export type StudioTableReadabilityMode = 'compact' | 'comfortable';

type StudioTableCarouselProps = {
  divisions: StudioTableDivision[];
  masterRows?: StudioTableRow[];
  intervalMs?: number;
  activeDivisionId?: string;
  highlightedTeamId?: number | null;
  onCycleComplete?: () => void;
  presentationMode?: StudioTablePresentationMode;
  readabilityMode?: StudioTableReadabilityMode;
};

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

type TableView = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  crest: string;
  rows: StudioTableRow[];
};

export function StudioTableCarousel({
  divisions,
  intervalMs = 10000,
  activeDivisionId,
  highlightedTeamId = null,
  onCycleComplete,
  presentationMode = 'clean',
  readabilityMode = 'comfortable',
}: StudioTableCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const isCleanMode = presentationMode === 'clean';
  const showExtendedColumns = !isCleanMode && readabilityMode === 'compact';

  useEffect(() => {
    if (activeDivisionId || divisions.length < 2) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % divisions.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [activeDivisionId, divisions.length, intervalMs]);

  useEffect(() => {
    if (!activeDivisionId) {
      return;
    }
    const nextIndex = divisions.findIndex((division) => division.id === activeDivisionId);
    if (nextIndex < 0) {
      return;
    }
    setActiveIndex((prev) => (prev === nextIndex ? prev : nextIndex));
  }, [activeDivisionId, divisions]);

  useEffect(() => {
    if (activeIndex >= divisions.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, divisions.length]);

  const previousIndexRef = useRef(activeIndex);
  useEffect(() => {
    const lastIndex = divisions.length - 1;
    const autoCycling = !activeDivisionId && divisions.length > 1;
    if (autoCycling && previousIndexRef.current === lastIndex && activeIndex === 0) {
      onCycleComplete?.();
    }
    previousIndexRef.current = activeIndex;
  }, [activeDivisionId, activeIndex, divisions.length, onCycleComplete]);

  const activeDivision = divisions[activeIndex];
  const tableViews = useMemo<TableView[]>(() => {
    if (!activeDivision) {
      return [];
    }
    const divisionRows = activeDivision.rows.slice().sort((a, b) => a.rank - b.rank);
    const views: TableView[] = [
      {
        id: `division-${activeDivision.id}`,
        kicker: 'Division Table',
        title: activeDivision.title,
        subtitle: activeDivision.subtitle,
        crest: activeDivision.crest,
        rows: divisionRows,
      },
    ];
    return views;
  }, [activeDivision]);

  useEffect(() => {
    if (activeViewIndex >= tableViews.length) {
      setActiveViewIndex(0);
    }
  }, [activeViewIndex, tableViews.length]);

  useEffect(() => {
    setActiveViewIndex(0);
  }, [activeDivisionId, activeIndex, highlightedTeamId]);

  useEffect(() => {
    if (tableViews.length < 2) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveViewIndex((prev) => (prev + 1) % tableViews.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, tableViews.length]);

  const active = tableViews.length > 0 ? tableViews[activeViewIndex % tableViews.length] : null;
  const featuredRow = active
    ? active.rows.find((row) => row.teamId > 0 && row.teamId === highlightedTeamId)
      ?? active.rows.find((row) => row.teamId > 0)
      ?? active.rows[0]
    : undefined;
  const indexLabel = tableViews.length > 1
    ? `${activeViewIndex + 1}/${tableViews.length}`
    : divisions.length > 0
      ? `${activeIndex + 1}/${divisions.length}`
      : '0/0';
  const dotItems = tableViews.length > 1
    ? tableViews.map((view) => view.id)
    : divisions.map((division) => division.id);
  const activeDotIndex = tableViews.length > 1 ? activeViewIndex : activeIndex;

  return (
    <section className={`studio-table-carousel mode-${presentationMode} readability-${readabilityMode}`}>
      <header className="studio-table-head">
        <span className="studio-kicker">{active?.kicker ?? 'League Table Carousel'}</span>
        <span className="studio-table-index">
          {indexLabel}
        </span>
      </header>

      <div className="studio-table-stage">
        <AnimatePresence mode="wait">
          {active ? (
            <motion.article
              key={active.id}
              className="studio-table-slide"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="studio-table-title-row">
                {featuredRow ? (
                  <span className="studio-title-team-icon">
                    {featuredRow.isChampion && <span className="champion-c-badge" title="Mathematical champion">C</span>}
                    <TeamBadge
                      name={featuredRow.teamName}
                      ballColor={featuredRow.ballColor}
                      ringColor={featuredRow.ringColor}
                      textColor={featuredRow.textColor}
                      size={34}
                    />
                  </span>
                ) : (
                  <span className="studio-table-crest">{active.crest}</span>
                )}
                <div>
                  <h4>{active.title}</h4>
                  <p>{active.subtitle}</p>
                </div>
              </div>

              <div className="studio-table-columns">
                <span>Team</span>
                <span className="studio-table-num-head num">P</span>
                {showExtendedColumns && <span className="studio-table-num-head num">W</span>}
                {showExtendedColumns && <span className="studio-table-num-head num">D</span>}
                {showExtendedColumns && <span className="studio-table-num-head num">L</span>}
                <span className="studio-table-num-head num">Pts</span>
                <span className="studio-table-num-head num">Profit</span>
                <span className="studio-table-form-head">Form</span>
              </div>

              <div className="studio-table-rows">
                {active.rows.map((row) => {
                  const isHighlighted = row.teamId > 0 && row.teamId === highlightedTeamId;
                  const isTopZone = row.rank === 1;
                  const isDropZone = row.rank === active.rows.length;
                  const statusBadgeClass = row.isChampion ? 'champion-c-badge' : 'status-badge-placeholder';
                  const statusBadgeLabel = row.isChampion ? 'C' : '';
                  const statusBadgeTitle = row.isChampion
                    ? 'Mathematical champion'
                    : undefined;
                  const formEntries = row.form?.slice(-5) ?? [];
                  return (
                    <div
                      key={`${active.id}-${row.teamId}`}
                      className={`studio-table-row${isHighlighted ? ' is-highlighted' : ''}${isTopZone ? ' zone-top' : ''}${isDropZone ? ' zone-drop' : ''}`}
                      aria-current={isHighlighted ? 'true' : undefined}
                    >
                      <span className="studio-row-team teamCell">
                        <span className="studio-row-team-icons" aria-hidden="true">
                          <span className="studio-team-icon-wrap teamIconWrap">
                            <TeamBadge
                              name={row.teamName}
                              ballColor={row.ballColor}
                              ringColor={row.ringColor}
                              textColor={row.textColor}
                              size={20}
                            />
                          </span>
                          {(!isCleanMode || row.isChampion) && (
                            <span className="studio-team-icon-wrap teamIconWrap">
                              <span className={statusBadgeClass} title={statusBadgeTitle}>
                                {statusBadgeLabel}
                              </span>
                            </span>
                          )}
                          {showExtendedColumns && (
                            <span className="studio-team-icon-wrap teamIconWrap">
                              <span className={`studio-trend-pill trend-${row.trend}`}>
                                {row.trend === 'up' ? '↑' : row.trend === 'down' ? '↓' : '→'}
                              </span>
                            </span>
                          )}
                        </span>
                        <span className="studio-row-team-name teamName">
                          <span className="studio-row-rank-mini">{row.rank}.</span>
                          {row.teamName}
                          {row.isRelegated && <span className="relegation-r-inline"> R</span>}
                          {isTopZone && <span className="studio-zone-chip top">Top</span>}
                          {isDropZone && <span className="studio-zone-chip drop">Drop</span>}
                        </span>
                      </span>
                      <span className="studio-table-cell-num num">{row.played}</span>
                      {showExtendedColumns && <span className="studio-table-cell-num num">{row.wins}</span>}
                      {showExtendedColumns && <span className="studio-table-cell-num num">{row.draws}</span>}
                      {showExtendedColumns && <span className="studio-table-cell-num num">{row.losses}</span>}
                      <span className="studio-table-cell-num num">{row.points}</span>
                      <span className="studio-table-cell-num num">{formatSigned(row.profit)}</span>
                      <span className="studio-table-cell-form">
                        {formEntries.length > 0 ? (
                          formEntries.map((result, index) => (
                            <span key={`${row.teamId}-form-${index}`} className={`studio-form-pill ${result.toLowerCase()}`}>
                              {result}
                            </span>
                          ))
                        ) : (
                          <span className="studio-form-pill empty">—</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.article>
          ) : (
            <motion.article
              key="studio-table-empty"
              className="studio-table-slide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h4>No table data</h4>
              <p className="studio-muted">Standings will appear when league rows are available.</p>
            </motion.article>
          )}
        </AnimatePresence>
      </div>

      <div className="studio-table-dots" aria-hidden="true">
        {dotItems.map((dotId, idx) => (
          <span key={dotId} className={`studio-table-dot${idx === activeDotIndex ? ' active' : ''}`} />
        ))}
      </div>
    </section>
  );
}
