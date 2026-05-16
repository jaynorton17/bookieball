// keeperAI.ts
// This module encapsulates simple goalkeeper AI logic for a penalty shootout.
// The AI chooses which way to dive based on the player's intended target and
// returns timing and intensity information to drive animations. Difficulty
// settings adjust how often the keeper guesses correctly.

export type DiveDirection = 'left' | 'center' | 'right';

export interface DiveOutcome {
  /** Direction the keeper will dive toward */
  diveDir: DiveDirection;
  /** Reaction delay in milliseconds before starting the dive */
  reactionDelayMs: number;
  /** How strong the dive should be (1 = full stretch) */
  diveIntensity: number;
  /** Optional handedness bias (positive values bias to the right) */
  handednessBias?: number;
}

/**
 * Choose a dive direction for the keeper given the target direction. The
 * difficulty parameter controls how frequently the keeper guesses correctly.
 *
 * @param target The player's chosen target direction
 * @param difficulty A value between 0 and 1; higher values mean the keeper
 *                  guesses correctly more often. Default is 0.85 (85%).
 */
export function chooseDiveDirection(
  target: DiveDirection,
  difficulty: number = 0.85
): DiveOutcome {
  // Validate difficulty and clamp into range
  const diff = Math.min(1, Math.max(0, difficulty));
  // Determine if the keeper guesses correctly
  const guessesCorrectly = Math.random() < diff;
  let diveDir: DiveDirection = target;
  if (!guessesCorrectly) {
    // Choose a wrong direction uniformly from the other two options
    const alternatives: DiveDirection[] = ['left', 'center', 'right'].filter(
      (d) => d !== target
    ) as DiveDirection[];
    diveDir = alternatives[Math.floor(Math.random() * alternatives.length)];
  }
  // Reaction delay is in the range 120–220ms to feel human
  const reactionDelayMs = 120 + Math.random() * 100;
  // Dive intensity varies slightly between 0.9 and 1.0
  const diveIntensity = 0.9 + Math.random() * 0.1;
  // Handedness bias adds subtle realism – negative values bias left
  const handednessBias = Math.random() * 0.2 - 0.1;
  return { diveDir, reactionDelayMs, diveIntensity, handednessBias };
}