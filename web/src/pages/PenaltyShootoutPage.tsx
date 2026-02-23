import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { PenaltyShootoutBoard, type PenaltyTeam } from '../components/PenaltyShootoutBoard';

export function PenaltyShootoutPage() {
  const [teams, setTeams] = useState<PenaltyTeam[]>([]);
  const [homeTeamId, setHomeTeamId] = useState<number | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    api.teams()
      .then((rows) => {
        if (!active) {
          return;
        }
        setTeams(rows.map((team) => ({
          id: team.id,
          name: team.name,
          ballColor: team.ballColor ?? null,
          ringColor: team.ringColor ?? null,
        })));
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
    <section className="page">
      <h1>Penalty Shootout</h1>
      <p className="muted">Sandbox shootout simulator. This does not affect any real fixtures.</p>

      <div className="panel">
        <div className="grid-row">
          <label className="inline-field">
            <span className="muted">Home team</span>
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
          <label className="inline-field">
            <span className="muted">Away team</span>
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
            resetKey={`${homeTeam.id}-${awayTeam.id}`}
            startLabel="Take penalties"
            showReset
          />
        ) : (
          <p className="muted">Select both teams to start a shootout.</p>
        )}
      </div>
    </section>
  );
}
