// collision.ts
// This module exposes helper routines for collision detection between the ball
// and the goalkeeper during a penalty shootout. A minimal physics model is
// implemented using simple circular colliders for the keeper's body parts and
// the ball itself. When the ball intersects any keeper collider at the goal
// plane, a save is registered.

export interface Vector2 {
  x: number;
  y: number;
}

export interface BallState {
  position: Vector2;
  radius: number;
}

// A circular collider representing part of the keeper's body or gloves
export interface CircleCollider {
  center: Vector2;
  radius: number;
}

export type DiveDirection = 'left' | 'center' | 'right';

// Dimensions of the goal mouth (in canvas units). The origin (0,0) is the
// bottom-left of the canvas when viewed from the striker's perspective. The
// goalLineY defines the y-coordinate where the goal line sits.
export interface GoalDimensions {
  width: number;
  height: number;
  goalLineY: number;
}

/**
 * Compute the keeper's collision shapes at a given time into the dive. The
 * shapes are circles representing the keeper's head, torso, and hands.
 * The positions depend on the dive direction and a normalized dive progress
 * value between 0 and 1. When progress is 0 the keeper stands centered;
 * when progress is 1 the keeper reaches full stretch.
 */
export function computeKeeperPose(
  diveDir: DiveDirection,
  progress: number,
  goal: GoalDimensions
): CircleCollider[] {
  // Clamp progress into [0, 1]
  const p = Math.min(1, Math.max(0, progress));
  // Starting (centered) positions for the keeper at the goal line
  const torsoStart: Vector2 = {
    x: goal.width / 2,
    y: goal.goalLineY + goal.height * 0.25,
  };
  const headStart: Vector2 = {
    x: torsoStart.x,
    y: torsoStart.y + 40,
  };
  const leftHandStart: Vector2 = {
    x: torsoStart.x - 30,
    y: torsoStart.y + 20,
  };
  const rightHandStart: Vector2 = {
    x: torsoStart.x + 30,
    y: torsoStart.y + 20,
  };
  // Determine lateral direction multiplier (-1 for left, 0 for center, 1 for right)
  let dx = 0;
  if (diveDir === 'left') dx = -1;
  else if (diveDir === 'right') dx = 1;
  // Translate positions according to dive progress
  const lateralShift = (goal.width * 0.3) * p * dx;
  const verticalShift = -20 * p; // slight drop during dive
  function shift(pos: Vector2): Vector2 {
    return {
      x: pos.x + lateralShift,
      y: pos.y + verticalShift,
    };
  }
  return [
    { center: shift(headStart), radius: 18 },
    { center: shift(torsoStart), radius: 25 },
    { center: shift(leftHandStart), radius: 15 },
    { center: shift(rightHandStart), radius: 15 },
  ];
}

/**
 * Check whether the ball collides with any of the keeper's colliders when
 * reaching the goal line. The ball is assumed to be at the goal line when
 * this function is called. If a collision occurs, returns the point of
 * contact, otherwise returns null.
 */
export function checkSave(
  ball: BallState,
  colliders: CircleCollider[]
): { saved: boolean; contact?: Vector2 } {
  for (const collider of colliders) {
    const dx = ball.position.x - collider.center.x;
    const dy = ball.position.y - collider.center.y;
    const distSq = dx * dx + dy * dy;
    const radii = ball.radius + collider.radius;
    if (distSq <= radii * radii) {
      // Collision detected
      return { saved: true, contact: { x: collider.center.x, y: collider.center.y } };
    }
  }
  return { saved: false };
}