import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { TeamBadge } from './TeamBadge';
import { displayDivisionName } from '../lib/divisionLabels';

export type H2HTeam = { id: number; name: string; ballColor: string | null; ringColor: string | null; textColor: string | null };

type H2HData = Awaited<ReturnType<typeof api.headToHeadAllTime>>;

type Props = {
  teamA: H2HTeam;
  teamB: H2HTeam;
  context?: string;
  onClose: () => void;
};

function signed(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function meetingScore(m: { homeProfit: number; awayProfit: number }): string {
  return `${signed(m.homeProfit)} : ${signed(m.awayProfit)}`;
}

function meetingLabel(m: { season: string; division: string }): string {
  return `${m.season} • ${displayDivisionName(m.division)}`;
}

function resultForA(m: { homeTeam: string; awayTeam: string; result: string }, aName: string): 'W' | 'L' | 'D' | 'TBD' {
  if (m.result === 'pending') {
    return 'TBD';
  }
  if (m.result === 'draw') {
    return 'D';
  }
  const aWon = (m.result === 'home' && m.homeTeam === aName) || (m.result === 'away' && m.awayTeam === aName);
  return aWon ? 'W' : 'L';
}

export function HeadToHeadModal({ teamA, teamB, context, onClose }: Props) {
  const [data, setData] = useState<H2HData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .headToHeadAllTime(teamA.id, teamB.id)
      .then((next) => {
        if (active) {
          setData(next);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [teamA.id, teamB.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const awinsPct = data && data.played > 0 ? (data.teamAWins / data.played) * 100 : 0;
  const drawsPct = data && data.played > 0 ? (data.draws / data.played) * 100 : 0;
  const bwinsPct = data && data.played > 0 ? (data.teamBWins / data.played) * 100 : 0;
  const sideName = (side: 'A' | 'B' | null): string => (side === 'A' ? teamA.name : side === 'B' ? teamB.name : 'Nobody');

  return (
    <div className="overlay" onClick={onClose}>
      <div className="penalty-modal-card h2h-modal" onClick={(event) => event.stopPropagation()}>
        <div className="penalty-modal-header">
          <div>
            <h3>Head to Head</h3>
            {context && <p className="muted h2h-context">{context}</p>}
          </div>
          <button type="button" className="h2h-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="competition-versus-layout">
          <div className="competition-team-card">
            <span className="competition-team-label">{teamA.name}</span>
            <h4 className="h2h-team-name">
              <TeamBadge
                name={teamA.name}
                ballColor={teamA.ballColor}
                ringColor={teamA.ringColor}
                textColor={teamA.textColor}
                size={30}
              />
              <span>{teamA.name}</span>
            </h4>
            <p>
              {data ? `${data.teamAWins} win${data.teamAWins === 1 ? '' : 's'} vs ${teamB.name}` : 'Loading...'}
            </p>
          </div>
          <div className="competition-score-badge">
            <span>All Time</span>
            <strong>{data ? data.played : '…'}</strong>
            <p>meetings</p>
          </div>
          <div className="competition-team-card">
            <span className="competition-team-label">{teamB.name}</span>
            <h4 className="h2h-team-name">
              <TeamBadge
                name={teamB.name}
                ballColor={teamB.ballColor}
                ringColor={teamB.ringColor}
                textColor={teamB.textColor}
                size={30}
              />
              <span>{teamB.name}</span>
            </h4>
            <p>
              {data ? `${data.teamBWins} win${data.teamBWins === 1 ? '' : 's'} vs ${teamA.name}` : 'Loading...'}
            </p>
          </div>
        </div>

        {!data && !failed && <p className="muted h2h-status">Crunching the numbers from season 1...</p>}
        {failed && <p className="muted h2h-status">Could not load head-to-head data.</p>}

        {data && data.played === 0 && (
          <p className="h2h-first-meeting">
            These two have never met in a division game — this could be their first ever meeting!
          </p>
        )}

        {data && data.played > 0 && (
          <>
            <div className="h2h-record">
              <div className="h2h-record-side">
                <strong>{data.teamAWins}</strong>
                <span>{teamA.name}</span>
              </div>
              <div className="h2h-record-center">
                <strong>{data.draws}</strong>
                <span>Draws</span>
              </div>
              <div className="h2h-record-side">
                <strong>{data.teamBWins}</strong>
                <span>{teamB.name}</span>
              </div>
            </div>
            <div className="h2h-bar" aria-hidden="true">
              <span className="h2h-bar-a" style={{ width: `${awinsPct}%` }} />
              <span className="h2h-bar-d" style={{ width: `${drawsPct}%` }} />
              <span className="h2h-bar-b" style={{ width: `${bwinsPct}%` }} />
            </div>

            <div className="h2h-facts">
              <div className="h2h-fact">
                <span className="h2h-fact-label">Career profit vs them</span>
                <span className="h2h-fact-value">{signed(data.teamAProfit)} <span className="h2h-fact-sub">· {signed(data.teamBProfit)}</span></span>
              </div>
              {data.biggestMargin && (
                <div className="h2h-fact">
                  <span className="h2h-fact-label">Biggest winning margin</span>
                  <span className="h2h-fact-value">{sideName(data.biggestMargin.side)}</span>
                  <span className="h2h-fact-sub">
                    {meetingLabel(data.biggestMargin)} · {meetingScore(data.biggestMargin)} (margin {signed(data.biggestMargin.margin)})
                  </span>
                </div>
              )}
              {data.highestScoring && (
                <div className="h2h-fact">
                  <span className="h2h-fact-label">Highest-scoring meeting</span>
                  <span className="h2h-fact-value">{meetingScore(data.highestScoring)}</span>
                  <span className="h2h-fact-sub">
                    {meetingLabel(data.highestScoring)} · combined {signed(data.highestScoring.total)}
                  </span>
                </div>
              )}
              {data.firstMeeting && (
                <div className="h2h-fact">
                  <span className="h2h-fact-label">First meeting</span>
                  <span className="h2h-fact-value">{data.firstMeeting.season}</span>
                  <span className="h2h-fact-sub">
                    {data.firstMeeting.homeTeam} {meetingScore(data.firstMeeting)} {data.firstMeeting.awayTeam}
                  </span>
                </div>
              )}
              {data.lastMeeting && (
                <div className="h2h-fact">
                  <span className="h2h-fact-label">Most recent</span>
                  <span className="h2h-fact-value">{data.lastMeeting.season}</span>
                  <span className="h2h-fact-sub">
                    {data.lastMeeting.homeTeam} {meetingScore(data.lastMeeting)} {data.lastMeeting.awayTeam}
                  </span>
                </div>
              )}
              <div className="h2h-fact">
                <span className="h2h-fact-label">Current streak</span>
                <span className="h2h-fact-value">
                  {data.currentStreak.count > 0 ? `${sideName(data.currentStreak.side)} — ${data.currentStreak.count}` : 'All square'}
                </span>
                <span className="h2h-fact-sub">
                  {data.currentStreak.count > 0 ? `last ${data.currentStreak.count} meeting${data.currentStreak.count === 1 ? '' : 's'}` : 'last meeting was a draw'}
                </span>
              </div>
              <div className="h2h-fact">
                <span className="h2h-fact-label">Longest streak</span>
                <span className="h2h-fact-value">
                  {data.longestStreak.count > 0 ? `${sideName(data.longestStreak.side)} — ${data.longestStreak.count}` : '—'}
                </span>
                <span className="h2h-fact-sub">consecutive wins all time</span>
              </div>
              <div className="h2h-fact">
                <span className="h2h-fact-label">{teamA.name} form vs them</span>
                <span className="h2h-form">
                  {data.formA.length === 0 ? '—' : data.formA.map((result, index) => (
                    <span key={`h2h-form-${index}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>
                      {result}
                    </span>
                  ))}
                </span>
                <span className="h2h-fact-sub">last {data.formA.length} meetings</span>
              </div>
            </div>

            <div className="h2h-meetings">
              {data.meetings.length === 0 && <p className="muted h2h-status">No division meetings on record.</p>}
              {data.meetings.map((meeting, index) => {
                const forA = resultForA(meeting, teamA.name);
                const chipClass = forA === 'W' ? 'h2h-win-a' : forA === 'L' ? 'h2h-win-b' : forA === 'D' ? 'h2h-draw' : 'h2h-pending';
                return (
                  <div key={`h2h-meeting-${meeting.season}-${meeting.gw}-${index}`} className="h2h-meeting">
                    <span className="h2h-meeting-season">{meetingLabel(meeting)}</span>
                    <span className="h2h-meeting-teams">
                      <strong>{meeting.homeTeam}</strong> vs <strong>{meeting.awayTeam}</strong>
                    </span>
                    <span className={`h2h-meeting-score ${meeting.result === 'pending' ? 'h2h-pending' : ''}`}>
                      {meeting.result === 'pending' ? 'vs' : meetingScore(meeting)}
                    </span>
                    <span className={`h2h-meeting-result ${chipClass}`}>{forA}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
