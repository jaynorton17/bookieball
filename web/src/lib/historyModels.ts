import type { CompetitionKey } from './competitionRegistry';

export type CompetitionFinish = {
  competition: CompetitionKey;
  entered: boolean;
  label: string;
  rank?: number | null;
  total?: number | null;
  stage?: string | null;
  divisionLevel?: number | null;
  winner?: boolean;
  runnerUp?: boolean;
};

export type TeamSeasonCareer = {
  season: string;
  teamId: number;
  teamName: string;
  competitions: Record<CompetitionKey, CompetitionFinish>;
};

export type KnockoutJourneyStep = {
  competition: Extract<CompetitionKey, 'bookieball_cup' | 'master_cup' | 'super_cup'>;
  season: string;
  round: string;
  fixtureId: number | null;
  opponentTeamId: number | null;
  opponentTeamName: string | null;
  outcome: 'advanced' | 'eliminated' | 'winner' | 'runner_up' | 'pending' | 'bye';
};

export type TeamCareer = {
  teamId: number;
  teamName: string;
  seasons: TeamSeasonCareer[];
  knockoutJourney: KnockoutJourneyStep[];
};
