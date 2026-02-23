import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';

type TrophyRoomData = {
  cup: Array<{ season: string; teamName: string }>;
  divisions: Record<string, Array<{ season: string; teamName: string }>>;
  goalsOfSeason: Record<string, Array<{ season: string; teamName: string }>>;
  bookieDor: Array<{ season: string; teamName: string }>;
  masterLeague: Array<{ season: string; teamName: string }>;
};

export function TrophyRoomPage() {
  const [trophyRoom, setTrophyRoom] = useState<TrophyRoomData>({
    cup: [],
    divisions: {},
    goalsOfSeason: {},
    bookieDor: [],
    masterLeague: [],
  });

  useEffect(() => {
    api.trophyRoom().then(setTrophyRoom);
  }, []);

  const divisionTrophy = (division: string): { icon: string; className: string } => {
    switch (division) {
      case 'Champions Bookies':
        return { icon: '🏆', className: 'trophy-gold' };
      case 'Premier Bookies':
        return { icon: '🥈', className: 'trophy-silver' };
      case 'Average Bookies':
        return { icon: '🥉', className: 'trophy-bronze' };
      case 'Struggling Bookies':
        return { icon: '🏅', className: 'trophy-green' };
      case 'Awful Bookies':
        return { icon: '🎖️', className: 'trophy-blue' };
      default:
        return { icon: '🏆', className: 'trophy-gold' };
    }
  };

  return (
    <section className="page">
      <h1>Trophy Room</h1>
      <div className="panel">
        <h3 className="trophy-title"><span className="trophy-icon trophy-cup">🏆</span> Cup Trophy</h3>
        {trophyRoom.cup.length === 0 ? (
          <p className="muted">No winners yet.</p>
        ) : (
          trophyRoom.cup.map((item, idx) => <div key={`${item.season}-${item.teamName}-${idx}`}>{item.season}: {item.teamName}</div>)
        )}
      </div>

      <div className="panel">
        <h3 className="trophy-title"><span className="trophy-icon trophy-dor">👑</span> Bookie d&apos;Or</h3>
        {trophyRoom.bookieDor.length === 0 ? (
          <p className="muted">No winners yet.</p>
        ) : (
          trophyRoom.bookieDor.map((item, idx) => <div key={`${item.season}-${item.teamName}-${idx}`}>{item.season}: {item.teamName}</div>)
        )}
      </div>

      <div className="panel">
        <h3 className="trophy-title"><span className="trophy-icon trophy-green">🎯</span> Master League Trophy</h3>
        {trophyRoom.masterLeague.length === 0 ? (
          <p className="muted">No winners yet.</p>
        ) : (
          trophyRoom.masterLeague.map((item, idx) => <div key={`master-${item.season}-${item.teamName}-${idx}`}>{item.season}: {item.teamName}</div>)
        )}
      </div>

      <div className="tile-grid">
        {Object.entries(trophyRoom.divisions).map(([division, winners]) => (
          <div key={division} className="panel">
            {(() => {
              const t = divisionTrophy(division);
              return (
                <h3 className="trophy-title">
                  <span className={`trophy-icon ${t.className}`}>{t.icon}</span> {displayDivisionName(division)} Trophy
                </h3>
              );
            })()}
            {winners.length === 0 ? (
              <p className="muted">No winners yet.</p>
            ) : (
              winners.map((item, idx) => <div key={`${division}-${item.season}-${item.teamName}-${idx}`}>{item.season}: {item.teamName}</div>)
            )}
          </div>
        ))}
      </div>

      <div className="tile-grid">
        {Object.entries(trophyRoom.goalsOfSeason).map(([division, winners]) => (
          <div key={division} className="panel">
            <h3 className="trophy-title"><span className="trophy-icon trophy-goal">⚽</span> {displayDivisionName(division)} Goal of the Season</h3>
            {winners.length === 0 ? (
              <p className="muted">No winners yet.</p>
            ) : (
              winners.map((item, idx) => <div key={`${division}-goal-${item.season}-${item.teamName}-${idx}`}>{item.season}: {item.teamName}</div>)
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
