import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CompetitionTrophyMark } from '../components/CompetitionTrophyMark';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';
import { sortWinnersMostRecent } from '../lib/formUtils';

const TIER_LEAGUE_ORDER = ['Legendary', 'Masters', 'Elite', 'Superior', 'Standard', 'Average', 'Poor', 'Awful'] as const;

type TrophyWinner = { season: string; teamName: string };
type TeamMeta = Awaited<ReturnType<typeof api.teams>>[number];

type TrophyRoomData = {
  cup: TrophyWinner[];
  divisions: Record<string, TrophyWinner[]>;
  goalsOfSeason: Record<string, TrophyWinner[]>;
  bookieDor: TrophyWinner[];
  masterLeague: TrophyWinner[];
  masterCup: TrophyWinner[];
  superCup: TrophyWinner[];
  tierLeagues: Record<string, TrophyWinner[]>;
};

type TrophyCard = {
  key: string;
  title: string;
  trophy: 'cup' | 'super' | 'master';
  tone: 'cup' | 'super' | 'master' | 'league';
  winners: TrophyWinner[];
};

const EMPTY_TROPHY_ROOM: TrophyRoomData = {
  cup: [],
  divisions: {},
  goalsOfSeason: {},
  bookieDor: [],
  masterLeague: [],
  masterCup: [],
  superCup: [],
  tierLeagues: {},
};

export function TrophyRoomPage() {
  const [trophyRoom, setTrophyRoom] = useState<TrophyRoomData>(EMPTY_TROPHY_ROOM);
  const [teams, setTeams] = useState<TeamMeta[]>([]);

  useEffect(() => {
    Promise.all([
      api.trophyRoom().catch(() => null),
      api.teams().catch(() => [] as TeamMeta[]),
    ]).then(([payload, teamRows]) => {
      setTeams(teamRows);
      if (!payload) {
        setTrophyRoom(EMPTY_TROPHY_ROOM);
        return;
      }
      setTrophyRoom({
        cup: Array.isArray(payload?.cup) ? payload.cup : [],
        divisions: payload?.divisions && typeof payload.divisions === 'object' ? payload.divisions : {},
        goalsOfSeason: payload?.goalsOfSeason && typeof payload.goalsOfSeason === 'object' ? payload.goalsOfSeason : {},
        bookieDor: Array.isArray(payload?.bookieDor) ? payload.bookieDor : [],
        masterLeague: Array.isArray(payload?.masterLeague) ? payload.masterLeague : [],
        masterCup: Array.isArray(payload?.masterCup) ? payload.masterCup : [],
        superCup: Array.isArray(payload?.superCup) ? payload.superCup : [],
        tierLeagues: payload?.tierLeagues && typeof payload.tierLeagues === 'object' ? payload.tierLeagues : {},
      });
    });
  }, []);

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);

  const cards = useMemo<TrophyCard[]>(() => {
    const coreCards: TrophyCard[] = [
      { key: 'bookie-dor', title: "Bookie d'Or", trophy: 'super', tone: 'super', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.bookieDor) ? trophyRoom.bookieDor : []) },
      { key: 'super-cup', title: 'Super Cup', trophy: 'super', tone: 'super', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.superCup) ? trophyRoom.superCup : []) },
      { key: 'cup', title: 'BookieBall Cup', trophy: 'cup', tone: 'cup', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.cup) ? trophyRoom.cup : []) },
      { key: 'master-league', title: 'Master League', trophy: 'master', tone: 'league', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.masterLeague) ? trophyRoom.masterLeague : []) },
      { key: 'master-cup', title: 'Master Cup', trophy: 'master', tone: 'master', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.masterCup) ? trophyRoom.masterCup : []) },
    ];
    const tierCards = TIER_LEAGUE_ORDER.map((division) => ({
      key: `tier-${division}`,
      title: `Tier League: ${division}`,
      trophy: 'master' as const,
      tone: 'league' as const,
      winners: sortWinnersMostRecent(Array.isArray(trophyRoom.tierLeagues?.[division]) ? trophyRoom.tierLeagues[division] : []),
    }));
    const divisionCards = Object.entries(trophyRoom.divisions ?? {}).map(([division, winners]) => ({
      key: division,
      title: displayDivisionName(division),
      trophy: 'cup' as const,
      tone: 'league' as const,
      winners: sortWinnersMostRecent(Array.isArray(winners) ? winners : []),
    }));
    return [...coreCards, ...tierCards, ...divisionCards];
  }, [trophyRoom]);

  const totalAwardSets = cards.length;
  const totalRecordedWinners = cards.reduce((sum, card) => sum + card.winners.length, 0);

  return (
    <section className="page page-dashboard competition-page competition-page-trophy">
      <div className="competition-page-shell">
        <header className="competition-page-hero competition-page-hero-trophy">
          <div className="competition-page-hero-head">
            <div className="competition-page-hero-copy">
              <span className="competition-page-kicker">Honours Board</span>
              <h1>Trophy Room</h1>
              <p>
                Winners archive for the live competitions, seeded cups, and the home of Bookie d&apos;Or.
                Team badges now carry through the record books so the honours board feels part of the same world.
              </p>
            </div>
            <div className="competition-hero-art competition-hero-art-triple" aria-hidden="true">
              <CompetitionTrophyMark variant="super" className="competition-hero-trophy trophy-super" />
              <CompetitionTrophyMark variant="cup" className="competition-hero-trophy trophy-cup" />
              <CompetitionTrophyMark variant="master" className="competition-hero-trophy trophy-master" />
            </div>
          </div>

          <div className="competition-metric-row">
            <article className="competition-metric-card">
              <span>Award Sets</span>
              <strong>{totalAwardSets}</strong>
              <p>Core cups, divisions, and tier leagues in one room.</p>
            </article>
            <article className="competition-metric-card">
              <span>Recorded Winners</span>
              <strong>{totalRecordedWinners}</strong>
              <p>Total winner entries currently archived.</p>
            </article>
            <article className="competition-metric-card">
              <span>Finale Deck</span>
              <strong>Ready</strong>
              <p>Open the end-of-season presentation from this page.</p>
            </article>
          </div>
        </header>

        <div className="panel competition-panel competition-panel-inline">
          <div className="panel-header">
            <div>
              <h3>Season Finale</h3>
              <p className="muted">Open the presentation deck used to close out the season.</p>
            </div>
            <Link className="action" to="/season-finale">Open Season Finale</Link>
          </div>
        </div>

        <div className="competition-trophy-grid">
          {cards.map((card) => (
            <article key={card.key} className={`competition-trophy-card tone-${card.tone}`}>
              <div className="competition-trophy-card-head">
                <CompetitionTrophyMark variant={card.trophy} className="competition-trophy-card-mark" />
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.winners.length > 0 ? `${card.winners.length} recorded winners` : 'No winners yet'}</p>
                </div>
              </div>
              {card.winners.length === 0 ? (
                <p className="muted">No winners yet.</p>
              ) : (
                <div className="competition-winner-list">
                  {card.winners.map((winner, index) => {
                    const team = teamByName.get(winner.teamName);
                    return (
                      <div key={`${card.key}-${winner.season}-${winner.teamName}-${index}`} className="competition-winner-row">
                        <span className="competition-winner-season">{winner.season}</span>
                        <div className="competition-winner-team">
                          <TeamBadge
                            name={winner.teamName}
                            ballColor={team?.ballColor ?? null}
                            ringColor={team?.ringColor ?? null}
                            textColor={team?.textColor ?? null}
                            size={26}
                          />
                          <strong>{winner.teamName}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
