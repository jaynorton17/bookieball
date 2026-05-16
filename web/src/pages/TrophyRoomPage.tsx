import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';
import { sortWinnersMostRecent } from '../lib/formUtils';

const TIER_LEAGUE_ORDER = ['Legendary', 'Masters', 'Elite', 'Superior', 'Standard', 'Average', 'Poor', 'Awful'] as const;

type TrophyWinner = { season: string; teamName: string };

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
  icon: string;
  winners: TrophyWinner[];
};

export function TrophyRoomPage() {
  const [trophyRoom, setTrophyRoom] = useState<TrophyRoomData>({
    cup: [],
    divisions: {},
    goalsOfSeason: {},
    bookieDor: [],
    masterLeague: [],
    masterCup: [],
    superCup: [],
    tierLeagues: {},
  });

  useEffect(() => {
    api.trophyRoom().then((payload) => {
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
    }).catch(() => {
      setTrophyRoom({
        cup: [],
        divisions: {},
        goalsOfSeason: {},
        bookieDor: [],
        masterLeague: [],
        masterCup: [],
        superCup: [],
        tierLeagues: {},
      });
    });
  }, []);

  const cards = useMemo<TrophyCard[]>(() => {
    const coreCards: TrophyCard[] = [
      { key: 'bookie-dor', title: "Bookie d'Or", icon: '👑', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.bookieDor) ? trophyRoom.bookieDor : []) },
      { key: 'super-cup', title: 'Super Cup', icon: '✨', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.superCup) ? trophyRoom.superCup : []) },
      { key: 'cup', title: 'Bookie Ball Cup', icon: '🏆', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.cup) ? trophyRoom.cup : []) },
      { key: 'master-league', title: 'Master League', icon: '🎯', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.masterLeague) ? trophyRoom.masterLeague : []) },
      { key: 'master-cup', title: 'Master Cup', icon: '🥇', winners: sortWinnersMostRecent(Array.isArray(trophyRoom.masterCup) ? trophyRoom.masterCup : []) },
    ];
    const tierCards = TIER_LEAGUE_ORDER.map((division) => ({
      key: `tier-${division}`,
      title: `Tier League: ${division}`,
      icon: '🪜',
      winners: sortWinnersMostRecent(Array.isArray(trophyRoom.tierLeagues?.[division]) ? trophyRoom.tierLeagues[division] : []),
    }));
    const divisionCards = Object.entries(trophyRoom.divisions ?? {}).map(([division, winners]) => ({
      key: division,
      title: displayDivisionName(division),
      icon: '🏅',
      winners: sortWinnersMostRecent(Array.isArray(winners) ? winners : []),
    }));
    return [...coreCards, ...tierCards, ...divisionCards];
  }, [trophyRoom]);

  return (
    <section className="page page-dashboard">
      <h1>Trophy Room</h1>
      <p className="muted">Winners archive for the live competitions and the home of Bookie d&apos;Or.</p>

      <div className="panel">
        <h3>Season Finale</h3>
        <p className="muted">Open the end-of-season presentation deck from here.</p>
        <Link className="action" to="/season-finale">Open Season Finale</Link>
      </div>

      <div className="tile-grid">
        {cards.map((card) => (
          <div key={card.key} className="panel">
            <h3 className="trophy-title">
              <span className="trophy-icon">{card.icon}</span> {card.title}
            </h3>
            {card.winners.length === 0 ? (
              <p className="muted">No winners yet.</p>
            ) : (
              card.winners.map((winner, index) => (
                <div key={`${card.key}-${winner.season}-${winner.teamName}-${index}`}>
                  {winner.season}: {winner.teamName}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
