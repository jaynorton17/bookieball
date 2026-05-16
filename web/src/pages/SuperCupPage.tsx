import { useEffect, useMemo, useState } from 'react';
import { CupTabs } from '../components/CompetitionTabs';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';

type TeamMeta = Awaited<ReturnType<typeof api.teams>>[number];
type SuperCupFixture = Awaited<ReturnType<typeof api.superCup>>[number];
type SuperCupArchiveRow = Awaited<ReturnType<typeof api.superCupArchive>>[number];

function pairingLabel(reason: SuperCupFixture['pairingReason']): string {
  if (reason === 'winners_vs_winners') {
    return 'Winners vs Winners';
  }
  if (reason === 'double_winner_vs_bookieball_runner_up') {
    return 'Double Winner vs BookieBall Runner-up';
  }
  return 'Double Winner vs Master Cup Runner-up';
}

function decidedByLabel(value: SuperCupFixture['decidedBy'] | SuperCupArchiveRow['decidedBy']): string {
  if (value === 'penalties') {
    return 'penalties';
  }
  if (value === 'team_id') {
    return 'lower team id';
  }
  if (value === 'pending') {
    return 'pending';
  }
  return value;
}

export function SuperCupPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);
  const [teams, setTeams] = useState<TeamMeta[]>([]);
  const [currentFixture, setCurrentFixture] = useState<SuperCupFixture | null>(null);
  const [history, setHistory] = useState<SuperCupArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [nextState, teamRows, currentRows, archiveRows] = await Promise.all([
          api.state(),
          api.teams().catch(() => [] as TeamMeta[]),
          api.superCup(),
          api.superCupArchive().catch(() => [] as SuperCupArchiveRow[]),
        ]);
        if (!active) {
          return;
        }
        setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw });
        setTeams(teamRows);
        setCurrentFixture(currentRows[0] ?? null);
        setHistory(archiveRows.slice().reverse());
        setMessage('');
      } catch (error) {
        if (!active) {
          return;
        }
        setMessage(error instanceof Error ? error.message : 'Unable to load the Super Cup.');
        setCurrentFixture(null);
        setHistory([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  return (
    <section className="page page-wide">
      <h1>Super Cup</h1>
      <p className="muted">
        {state
          ? `${state.currentSeason} ${state.currentGw} • Standalone GW1 curtain-raiser between the previous season's cup standard-bearers. No Bookie d'Or weighting applies.`
          : 'Loading Super Cup...'}
      </p>

      <CupTabs activeId="super-cup" />

      {message ? (
        <div className="panel">
          <p className="muted">{message}</p>
        </div>
      ) : null}

      <div className="panel">
        <h3>{state?.currentSeason ?? 'Current'} Super Cup</h3>
        {loading ? (
          <p className="muted">Loading Super Cup fixture...</p>
        ) : !currentFixture ? (
          <p className="muted">No Super Cup fixture is available for this season yet.</p>
        ) : (
          <div className="master-fixture-groups">
            <div className="master-fixture-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                <div>
                  <strong>{pairingLabel(currentFixture.pairingReason)}</strong>
                  <p className="muted" style={{ margin: '0.35rem 0 0' }}>{currentFixture.pairingExplanation}</p>
                </div>
                <div className="muted">{currentFixture.sourceSeason} cup results • Prestige opener only • No Bookie d'Or weighting</div>
              </div>

              <div className="master-fixture-row" style={{ alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem' }}>
                  <TeamBadge
                    name={currentFixture.homeTeam}
                    ballColor={teamById.get(currentFixture.homeTeamId)?.ballColor ?? null}
                    ringColor={teamById.get(currentFixture.homeTeamId)?.ringColor ?? null}
                    textColor={teamById.get(currentFixture.homeTeamId)?.textColor ?? null}
                    size={30}
                  />
                  {currentFixture.homeTeam}
                </span>
                <strong>
                  {currentFixture.played
                    ? `${currentFixture.homeProfit.toFixed(2)} - ${currentFixture.awayProfit.toFixed(2)}`
                    : 'GW1 Fixture'}
                </strong>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', justifyContent: 'flex-end' }}>
                  {currentFixture.awayTeam}
                  <TeamBadge
                    name={currentFixture.awayTeam}
                    ballColor={teamById.get(currentFixture.awayTeamId)?.ballColor ?? null}
                    ringColor={teamById.get(currentFixture.awayTeamId)?.ringColor ?? null}
                    textColor={teamById.get(currentFixture.awayTeamId)?.textColor ?? null}
                    size={30}
                  />
                </span>
              </div>

              <div className="grid-row" style={{ marginTop: '0.85rem' }}>
                <span className="muted">BookieBall Cup slot: {currentFixture.bookieballWinnerTeam}</span>
                <span className="muted">Master Cup slot: {currentFixture.masterCupWinnerTeam}</span>
                <span className="muted">
                  {currentFixture.winnerTeam
                    ? `Winner: ${currentFixture.winnerTeam} (${decidedByLabel(currentFixture.decidedBy)})`
                    : 'Awaiting GW1 result'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Super Cup Archive</h3>
        {loading ? (
          <p className="muted">Loading history...</p>
        ) : history.length === 0 ? (
          <p className="muted">No completed Super Cups yet.</p>
        ) : (
          <div className="master-fixture-groups">
            {history.map((row) => (
              <div key={`super-cup-history-${row.season}`} className="master-fixture-group">
                <h4>{row.season}</h4>
                <div className="master-fixture-row">
                  <span>{row.winnerTeam ?? 'TBD'}</span>
                  <span>{row.homeProfit.toFixed(2)} - {row.awayProfit.toFixed(2)}</span>
                  <span>{row.runnerUpTeam ?? 'TBD'}</span>
                </div>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  {pairingLabel(row.pairingReason)} • {row.pairingExplanation} • Decided by {decidedByLabel(row.decidedBy)}.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
