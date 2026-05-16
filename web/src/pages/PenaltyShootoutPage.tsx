// PenaltyShootoutPage.tsx
// Entry point page for the penalty shootout simulator. Loads team data via
// API, allows the user to pick home and away teams and then renders the
// PenaltyShootoutBoard. This page mirrors the original but uses the
// upgraded game and board components.

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  PenaltyShootoutBoard,
  PenaltyTeam,
} from '../components/PenaltyShootoutBoard';

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
          rows.map((team: any) => ({
            id: team.id,
            name: team.name,
            ballColor: team.ballColor ?? null,
            ringColor: team.ringColor ?? null,
          }))
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
    [homeTeamId, teams]
  );
  const awayTeam = useMemo(
    () => teams.find((team) => team.id === awayTeamId) ?? null,
    [awayTeamId, teams]
  );
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Penalty Shootout</h2>
      <p>Sandbox shootout simulator. This does not affect any real fixtures.</p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <label>
          Home team
          <select
            value={homeTeamId ?? ''}
            onChange={(event) =>
              setHomeTeamId(
                event.target.value ? Number(event.target.value) : null
              )
            }
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
          Away team
          <select
            value={awayTeamId ?? ''}
            onChange={(event) =>
              setAwayTeamId(
                event.target.value ? Number(event.target.value) : null
              )
            }
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
        <p style={{ marginTop: '1rem' }}>Select both teams to start a shootout.</p>
      )}
    </div>
  );
}