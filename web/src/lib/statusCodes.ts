export type WeeklyFixtureStatusCode =
  | 'pending'
  | 'in_play'
  | 'draw'
  | 'won'
  | 'lost'
  | 'advanced'
  | 'out'
  | 'bye';

export type FixtureSlideStatusCode =
  | 'pending'
  | 'in_play'
  | 'provisional'
  | 'final_confirmed';

export function isWeeklyStatusResolved(statusCode: WeeklyFixtureStatusCode): boolean {
  return statusCode === 'draw'
    || statusCode === 'won'
    || statusCode === 'lost'
    || statusCode === 'advanced'
    || statusCode === 'out'
    || statusCode === 'bye';
}

export function isWeeklyStatusInPlay(statusCode: WeeklyFixtureStatusCode): boolean {
  return statusCode === 'in_play';
}

export function weeklyStatusTone(statusCode: WeeklyFixtureStatusCode): 'win' | 'draw' | 'loss' | 'pending' {
  if (statusCode === 'won' || statusCode === 'advanced' || statusCode === 'bye') {
    return 'win';
  }
  if (statusCode === 'draw') {
    return 'draw';
  }
  if (statusCode === 'lost' || statusCode === 'out') {
    return 'loss';
  }
  return 'pending';
}

export function isFixtureStatusResolved(statusCode: FixtureSlideStatusCode): boolean {
  return statusCode === 'provisional' || statusCode === 'final_confirmed';
}

export function isFixtureStatusPending(statusCode: FixtureSlideStatusCode): boolean {
  return statusCode === 'pending';
}

export function isFixtureStatusInPlay(statusCode: FixtureSlideStatusCode): boolean {
  return statusCode === 'in_play';
}

export function isFixtureStatusProvisional(statusCode: FixtureSlideStatusCode): boolean {
  return statusCode === 'provisional';
}

export function isFixtureStatusFinalConfirmed(statusCode: FixtureSlideStatusCode): boolean {
  return statusCode === 'final_confirmed';
}

export function isFixtureStatusLive(statusCode: FixtureSlideStatusCode): boolean {
  return statusCode === 'in_play' || statusCode === 'provisional';
}
