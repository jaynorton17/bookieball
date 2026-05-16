// PenaltyShootoutGame.tsx
// A striker‑perspective penalty shootout mini‑game rendered on an HTML canvas.
// This component renders a penalty pitch, ball and goalkeeper, handles user
// input to aim and kick the ball, and resolves collisions using simple
// physics. A callback notifies the parent of each shot's outcome. A debug
// overlay can be toggled by pressing 'd' on the keyboard.

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { chooseDiveDirection, DiveDirection } from './keeperAI';
import {
  computeKeeperPose,
  checkSave,
  BallState,
  GoalDimensions,
  CircleCollider,
} from './collision';

export interface ShotResult {
  /** Whether the shot resulted in a goal */
  scored: boolean;
  /** Whether the shot was saved by the keeper */
  saved: boolean;
  /** High‑level target direction chosen by the player */
  targetDir: DiveDirection;
}

export interface PenaltyShootoutGameProps {
  /** Colour used to fill the ball */
  ballColour?: string;
  /** Primary colour for the keeper kit */
  keeperPrimary?: string;
  /** Trim colour for the keeper kit */
  keeperTrim?: string;
  /** Callback invoked when a shot completes */
  onShotComplete?: (result: ShotResult) => void;
  /** AI difficulty between 0 and 1 (keeper accuracy) */
  difficulty?: number;
  /** Graphics quality level */
  graphicsQuality?: 'low' | 'medium' | 'high';
  /** Optional requested shot direction for button-based controls */
  shotRequest?: { dir: DiveDirection; id: number } | null;
  /** Allow pointer clicks to aim (default true) */
  allowPointerShots?: boolean;
}

interface ActiveShot {
  ball: BallState;
  vx: number;
  vy: number;
  keeperDir: DiveDirection;
  keeperStartTime: number;
  reactionDelay: number;
  diveIntensity: number;
  handednessBias: number;
  completed: boolean;
  contact?: { x: number; y: number };
  /** Player's chosen direction (left/center/right) */
  targetDir: DiveDirection;
}

export const PenaltyShootoutGame: React.FC<PenaltyShootoutGameProps> = ({
  ballColour = '#ffffff',
  keeperPrimary = '#009688',
  keeperTrim = '#004d40',
  onShotComplete,
  difficulty = 0.85,
  graphicsQuality = 'medium',
  shotRequest = null,
  allowPointerShots = true,
}) => {
  // Canvas reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Active shot state (null when no shot is in flight)
  const [activeShot, setActiveShot] = useState<ActiveShot | null>(null);
  // Debug overlay toggle
  const [debug, setDebug] = useState<boolean>(false);
  // Size constants – adjust for different screen sizes as needed
  const canvasWidth = 600;
  const canvasHeight = 400;
  // Define goal mouth dimensions relative to canvas
  const goalWidth = canvasWidth * 0.6;
  const goalHeight = 120;
  const goalLineY = 80;
  const goalXStart = (canvasWidth - goalWidth) / 2;
  const penaltySpotX = canvasWidth / 2;
  const penaltySpotY = canvasHeight - 60;

  // Derived goal dimensions object for collision module
  const goalDims: GoalDimensions = {
    width: goalWidth,
    height: goalHeight,
    goalLineY,
  };
  const lastRequestIdRef = useRef<number | null>(null);

  // Kick handler – compute direction and velocities
  const kickBall = useCallback(
    (targetX: number, targetY: number) => {
      if (activeShot) {
        // Ignore if a shot is already active
        return;
      }
      // Determine high‑level target direction (left/center/right) based on horizontal third
      let targetDir: DiveDirection;
      const relativeX = (targetX - goalXStart) / goalWidth;
      if (relativeX < 0.33) targetDir = 'left';
      else if (relativeX > 0.66) targetDir = 'right';
      else targetDir = 'center';
      // Choose dive outcome from AI
      const aiOutcome = chooseDiveDirection(targetDir, difficulty);
      // Ball initial state
      const ball: BallState = {
        position: { x: penaltySpotX, y: penaltySpotY },
        radius: 8,
      };
      // Flight duration to goal line (in seconds)
      const flightDuration = 1.0;
      // Compute velocities so that the ball reaches the chosen (x,y) point on the goal plane
      const destY = goalLineY + 30; // aim slightly inside the net
      const destX = targetX;
      const vx = (destX - penaltySpotX) / flightDuration;
      const vy = (destY - penaltySpotY) / flightDuration;
      const now = performance.now();
      const newShot: ActiveShot = {
        ball,
        vx,
        vy,
        keeperDir: aiOutcome.diveDir,
        reactionDelay: aiOutcome.reactionDelayMs,
        diveIntensity: aiOutcome.diveIntensity,
        handednessBias: aiOutcome.handednessBias ?? 0,
        keeperStartTime: now,
        completed: false,
        targetDir,
      };
      setActiveShot(newShot);
    },
    [activeShot, difficulty]
  );

  const targetXForDir = useCallback(
    (dir: DiveDirection) => {
      if (dir === 'left') return goalXStart + goalWidth * 0.22;
      if (dir === 'right') return goalXStart + goalWidth * 0.78;
      return goalXStart + goalWidth * 0.5;
    },
    [goalWidth, goalXStart]
  );

  // Handle pointer events on the canvas
  useEffect(() => {
    if (!allowPointerShots) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      kickBall(x, y);
    };
    canvas.addEventListener('click', handleClick);
    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [allowPointerShots, kickBall]);

  useEffect(() => {
    if (!shotRequest) {
      return;
    }
    if (lastRequestIdRef.current === shotRequest.id) {
      return;
    }
    if (activeShot) {
      return;
    }
    lastRequestIdRef.current = shotRequest.id;
    const targetX = targetXForDir(shotRequest.dir);
    const targetY = goalLineY + 10;
    kickBall(targetX, targetY);
  }, [activeShot, goalLineY, kickBall, shotRequest, targetXForDir]);

  // Toggle debug overlay via keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setDebug((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Main animation loop
  useEffect(() => {
    let animationFrame: number;
    let lastTimestamp: number | null = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (timestamp: number) => {
      if (!ctx) return;
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const dt = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;
      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      // Draw pitch background
      drawPitch(ctx);
      // Draw goal frame
      drawGoal(ctx);
      // Draw fans (quality dependent)
      drawCrowd(ctx, graphicsQuality);
      // Draw penalty spot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(penaltySpotX, penaltySpotY, 3, 0, Math.PI * 2);
      ctx.fill();
      // Update and render active shot
      if (activeShot) {
        updateShot(activeShot, dt, ctx, timestamp);
      }
      // Request next frame
      animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeShot, graphicsQuality]);

  /**
   * Update the ball and keeper for the current shot, draw them and check for
   * collisions when the ball reaches the goal line. When the shot finishes,
   * call the onShotComplete callback.
   */
  const updateShot = useCallback(
    (
      shot: ActiveShot,
      dt: number,
      ctx: CanvasRenderingContext2D,
      timestamp: number
    ) => {
      if (shot.completed) return;
      // Advance ball
      shot.ball.position.x += shot.vx * dt;
      shot.ball.position.y += shot.vy * dt;
      // Draw ball
      ctx.fillStyle = ballColour;
      ctx.beginPath();
      ctx.arc(shot.ball.position.x, shot.ball.position.y, shot.ball.radius, 0, Math.PI * 2);
      ctx.fill();
      // Determine dive progress
      const tSinceStart = timestamp - shot.keeperStartTime;
      let diveProgress = 0;
      if (tSinceStart > shot.reactionDelay) {
        const diveTime = tSinceStart - shot.reactionDelay;
        diveProgress = Math.min(diveTime / 450, 1) * shot.diveIntensity;
      }
      // Compute keeper colliders
      const collidersBase = computeKeeperPose(shot.keeperDir, diveProgress, goalDims);
      // Shift colliders into canvas coordinates (goalXStart offset)
      const colliders: CircleCollider[] = collidersBase.map((c) => ({
        center: { x: c.center.x + goalXStart, y: c.center.y },
        radius: c.radius,
      }));
      // Draw keeper
      colliders.forEach((c, index) => {
        ctx.fillStyle = index < 2 ? keeperPrimary : keeperTrim;
        ctx.beginPath();
        ctx.arc(c.center.x, c.center.y, c.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      // Draw debug overlay if enabled
      if (debug) {
        ctx.strokeStyle = 'rgba(255,0,0,0.6)';
        ctx.lineWidth = 1;
        colliders.forEach((c) => {
          ctx.beginPath();
          ctx.arc(c.center.x, c.center.y, c.radius, 0, Math.PI * 2);
          ctx.stroke();
        });
        // Draw ball vector
        ctx.strokeStyle = 'rgba(0,255,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(penaltySpotX, penaltySpotY);
        ctx.lineTo(
          penaltySpotX + shot.vx * 0.5,
          penaltySpotY + shot.vy * 0.5
        );
        ctx.stroke();
      }
      // Check collision when ball reaches goal line
      if (
        shot.ball.position.y - shot.ball.radius <= goalLineY &&
        !shot.completed
      ) {
        const savedByGuess = shot.keeperDir === shot.targetDir;
        const result = savedByGuess
          ? { saved: true, contact: { x: shot.ball.position.x, y: shot.ball.position.y } }
          : checkSave(shot.ball, colliders);
        shot.completed = true;
        if (result.saved) {
          shot.contact = result.contact;
          // Draw impact effect (a simple flash)
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.beginPath();
          ctx.arc(result.contact!.x, result.contact!.y, 12, 0, Math.PI * 2);
          ctx.fill();
        }
        // Inform parent component
        onShotComplete?.({
          scored: !result.saved,
          saved: result.saved,
          targetDir: shot.targetDir,
        });
        // Remove active shot after short delay
        setTimeout(() => {
          setActiveShot(null);
        }, 800);
      }
    },
    [debug, goalLineY, goalXStart, keeperPrimary, keeperTrim, onShotComplete, penaltySpotX, penaltySpotY]
  );

  // Draw the pitch (grass + markings)
  const drawPitch = (ctx: CanvasRenderingContext2D) => {
    // Grass background
    ctx.fillStyle = '#107e3e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    // Mowing stripes
    const stripeCount = 8;
    const stripeHeight = canvasHeight / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = '#0f7038';
        ctx.fillRect(0, i * stripeHeight, canvasWidth, stripeHeight);
      }
    }
    // Penalty box & arc
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    // Goal line
    ctx.beginPath();
    ctx.moveTo(goalXStart, goalLineY);
    ctx.lineTo(goalXStart + goalWidth, goalLineY);
    ctx.stroke();
    // Box
    const boxHeight = 100;
    ctx.strokeRect(goalXStart - 40, goalLineY, goalWidth + 80, boxHeight);
    // Penalty arc
    ctx.beginPath();
    ctx.arc(penaltySpotX, goalLineY + 20, 60, Math.PI * 0.85, Math.PI * 0.15, true);
    ctx.stroke();
  };

  // Draw the goal frame and net
  const drawGoal = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 4;
    // Left post
    ctx.beginPath();
    ctx.moveTo(goalXStart, goalLineY);
    ctx.lineTo(goalXStart, goalLineY - goalHeight);
    ctx.stroke();
    // Right post
    ctx.beginPath();
    ctx.moveTo(goalXStart + goalWidth, goalLineY);
    ctx.lineTo(goalXStart + goalWidth, goalLineY - goalHeight);
    ctx.stroke();
    // Crossbar
    ctx.beginPath();
    ctx.moveTo(goalXStart, goalLineY - goalHeight);
    ctx.lineTo(goalXStart + goalWidth, goalLineY - goalHeight);
    ctx.stroke();
    // Simple net pattern (vertical lines)
    if (graphicsQuality !== 'low') {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      const netSpacing = 15;
      for (let x = goalXStart; x <= goalXStart + goalWidth; x += netSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, goalLineY);
        ctx.lineTo(x, goalLineY - goalHeight);
        ctx.stroke();
      }
      // Horizontal lines
      for (let y = goalLineY; y >= goalLineY - goalHeight; y -= netSpacing) {
        ctx.beginPath();
        ctx.moveTo(goalXStart, y);
        ctx.lineTo(goalXStart + goalWidth, y);
        ctx.stroke();
      }
    }
  };

  // Draw fans behind the goal as animated bands of colour
  const drawCrowd = (
    ctx: CanvasRenderingContext2D,
    quality: 'low' | 'medium' | 'high'
  ) => {
    const crowdTop = goalLineY - goalHeight - 10;
    const crowdHeight = 60;
    const bandCount = quality === 'high' ? 10 : 5;
    const bandWidth = canvasWidth / bandCount;
    for (let i = 0; i < bandCount; i++) {
      const hue = (i * 40 + (Date.now() / 50) % 360) % 360;
      ctx.fillStyle = `hsl(${hue}, 60%, 40%)`;
      ctx.fillRect(i * bandWidth, crowdTop, bandWidth, crowdHeight);
    }
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ border: '1px solid #888', maxWidth: '100%', height: 'auto' }}
      />
      {debug && (
        <div style={{ color: '#f44336', marginTop: '8px' }}>
          Debug: press 'd' to toggle
        </div>
      )}
    </div>
  );
};
