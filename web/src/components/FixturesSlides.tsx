import { motion } from 'framer-motion';
import type { StudioSlide } from './SlideDeck';
import type { FixtureSlideStatusCode } from '../lib/statusCodes';

export type FixtureSlideRow = {
  id: string;
  fixture: string;
  statusCode: FixtureSlideStatusCode;
  score: string;
  outcome: string;
  profitImpact: string;
  picks: string;
  rivalry: boolean;
};

export type FixtureSlideGroup = {
  id: string;
  title: string;
  subtitle?: string;
  fixtures: FixtureSlideRow[];
};

function pickBySeed(seed: string, variants: string[]): string {
  if (variants.length === 0) {
    return '';
  }
  let hash = 0;
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash = (hash * 31 + seed.charCodeAt(idx)) % 2147483647;
  }
  return variants[Math.abs(hash) % variants.length] ?? variants[0];
}

function extractWinnerName(fixture: FixtureSlideRow): string | null {
  const outcome = fixture.outcome.trim();
  if (!outcome || /pending/i.test(outcome) || /draw/i.test(outcome)) {
    return null;
  }
  const winnerOutcome = outcome.match(/^(.+?)\s+(won|advanced)\b/i);
  if (winnerOutcome?.[1]) {
    return winnerOutcome[1].trim();
  }
  const winnerScore = fixture.score.match(/winner:\s*(.+)$/i);
  if (winnerScore?.[1]) {
    return winnerScore[1].trim();
  }
  return null;
}

function fixtureStateLabel(statusCode: FixtureSlideStatusCode): string {
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

function splitScoreParts(score: string): { left: string; right: string } | null {
  const match = score.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  return { left: match[1], right: match[2] };
}

function buildFixtureNarration(group: FixtureSlideGroup): string {
  const fixtureCalls = group.fixtures
    .map((fixture) => {
      if (fixture.statusCode === 'pending') {
        return `Coming up: ${fixture.fixture}.`;
      }
      if (fixture.statusCode === 'in_play') {
        return `Live now: ${fixture.fixture} is still in play.`;
      }
      const outcome = fixture.outcome.trim();
      if (!outcome || /pending/i.test(outcome)) {
        return null;
      }
      if (fixture.statusCode === 'provisional') {
        if (/draw/i.test(outcome)) {
          return `As it stands, ${fixture.fixture} is level.`;
        }
        const winnerName = extractWinnerName(fixture);
        if (winnerName) {
          return `As it stands, winner was ${winnerName} in ${fixture.fixture}.`;
        }
        return `As it stands, ${fixture.fixture} is moving toward a winner call.`;
      }
      if (/draw/i.test(outcome)) {
        return `Result: ${fixture.fixture} finished as a draw.`;
      }
      const winnerName = extractWinnerName(fixture);
      if (winnerName) {
        return `Confirmed: ${fixture.fixture}. Winner was ${winnerName}.`;
      }
      return `Confirmed result update: ${fixture.fixture}.`;
    })
    .filter((line): line is string => Boolean(line));

  const confirmedCount = group.fixtures.filter((fixture) => fixture.statusCode === 'final_confirmed').length;
  const liveCount = group.fixtures.length - confirmedCount;

  return `${pickBySeed(group.id, [
    `Fixture desk for ${group.title}.`,
    `${group.title} quick read.`,
    `Studio fixture snapshot: ${group.title}.`,
  ])} ${fixtureCalls.length > 0 ? fixtureCalls.join(' ') : 'Fixtures are still live with no final winner call yet.'} ${liveCount > 0 ? `${liveCount} fixtures are still live or provisional.` : `${confirmedCount} fixtures are now confirmed.`}`;
}

export function FixturesSlides(groups: FixtureSlideGroup[]): StudioSlide[] {
  return groups.map((group, groupIndex) => ({
    id: `fixtures-${group.id}`,
    label: group.title,
    durationMs: 12000,
    narration: buildFixtureNarration(group),
    tone: 'fixtures',
    content: (
      <div className="studio-fixtures-slide">
        <div className="studio-fixtures-head">
          <span className="studio-kicker">Fixtures & Results</span>
          <h3>{group.title}</h3>
          <p>{group.subtitle ?? 'Broadcast fixture board'}</p>
        </div>
        <div className="studio-fixtures-list studio-scroll-panel">
          {group.fixtures.map((fixture, fixtureIndex) => (
            <motion.article
              key={fixture.id}
              className={`studio-fixture-row${fixture.rivalry ? ' rivalry' : ''}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: groupIndex * 0.04 + fixtureIndex * 0.08 }}
            >
              <div className="studio-fixture-main">
                <strong>{fixture.fixture}</strong>
                {fixture.rivalry && <span className="studio-pill-rivalry">Rivalry</span>}
              </div>
              <div className="studio-fixture-meta">
                <span className={`studio-fixture-state-chip state-${fixture.statusCode.replace('_', '-')}`}>
                  {fixtureStateLabel(fixture.statusCode)}
                </span>
                {(() => {
                  const parts = splitScoreParts(fixture.score);
                  if (!parts) {
                    return (
                      <motion.span
                        className="studio-score"
                        initial={{ scale: 0.9, opacity: 0.3 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.45 }}
                      >
                        {fixture.score}
                      </motion.span>
                    );
                  }
                  return (
                    <motion.span
                      className="studio-score-split"
                      initial={{ scale: 0.9, opacity: 0.3 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.45 }}
                    >
                      <span className="studio-score-part">{parts.left}</span>
                      <span className="studio-score-divider">-</span>
                      <span className="studio-score-part">{parts.right}</span>
                    </motion.span>
                  );
                })()}
                <span>{fixture.outcome}</span>
                <span>{fixture.profitImpact}</span>
              </div>
              <div className="studio-fixture-picks">{fixture.picks}</div>
            </motion.article>
          ))}
        </div>
      </div>
    ),
  }));
}
