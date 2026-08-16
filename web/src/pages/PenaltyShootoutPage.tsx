import { useEffect, useMemo, useState } from 'react';
import { PenaltyShootoutBoard, type PenaltyTeam } from '../components/PenaltyShootoutBoard';
import { api } from '../lib/api';

export function PenaltyShootoutPage() {
  const [teams, setTeams] = useState<PenaltyTeam[]>([]);
  const [homeTeamId, setHomeTeamId] = useState<number | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    api
      .teams()
      .then((rows) => {
        if (!active) {
          return;
        }
        setTeams(
          rows.map((team) => ({
            id: team.id,
            name: team.name,
            ballColor: team.ballColor ?? null,
            ringColor: team.ringColor ?? null,
          })),
        );
      })
      .catch(() => {
        if (active) {
          setTeams([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const homeTeam = useMemo(
    () => teams.find((team) => team.id === homeTeamId) ?? null,
    [homeTeamId, teams],
  );
  const awayTeam = useMemo(
    () => teams.find((team) => team.id === awayTeamId) ?? null,
    [awayTeamId, teams],
  );

  return (
    <section className={`page page-dashboard penalty-page${homeTeam && awayTeam ? ' penalty-page-live' : ''}`}>
      <div className="penalty-page-hero">
        <div>
          <span className="hub-showcase-kicker">Shootout Studio</span>
          <h1>Penalty Shootout</h1>
        </div>
      </div>

      <div className="penalty-selector-panel">
        <label>
          <span>Home team</span>
          <select
            value={homeTeamId ?? ''}
            onChange={(event) => setHomeTeamId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Away team</span>
          <select
            value={awayTeamId ?? ''}
            onChange={(event) => setAwayTeamId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {homeTeam && awayTeam ? (
        <PenaltyShootoutBoard
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          autoStart={false}
          startLabel="Start shootout"
          confirmLabel="Confirm winner"
          showReset
        />
      ) : (
        <p className="muted penalty-empty-state">Select both teams to start a shootout.</p>
      )}
    </section>
  );
}
