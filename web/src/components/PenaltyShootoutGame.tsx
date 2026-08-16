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
  /** Keeper dive direction selected by the AI */
  keeperDir: DiveDirection;
}

export interface PenaltyShootoutGameProps {
  /** Colour used to fill the ball */
  ballColour?: string;
  /** Primary colour for the keeper kit */
  keeperPrimary?: string;
  /** Trim colour for the keeper kit */
  keeperTrim?: string;
  /** Current taker label shown in the broadcast canvas */
  shooterName?: string;
  /** Current keeper label shown in the broadcast canvas */
  keeperName?: string;
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
  trail: Array<{ x: number; y: number }>;
  /** Player's chosen direction (left/center/right) */
  targetDir: DiveDirection;
}

export const PenaltyShootoutGame: React.FC<PenaltyShootoutGameProps> = ({
  ballColour = '#ffffff',
  keeperPrimary = '#009688',
  keeperTrim = '#004d40',
  shooterName = 'Taker',
  keeperName = 'Keeper',
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
  const canvasWidth = 720;
  const canvasHeight = 430;
  // Define goal mouth dimensions relative to canvas
  const goalWidth = canvasWidth * 0.58;
  const goalHeight = 108;
  const goalLineY = 136;
  const goalXStart = (canvasWidth - goalWidth) / 2;
  const penaltySpotX = canvasWidth / 2;
  const penaltySpotY = canvasHeight - 58;

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
      const flightDuration = 0.95;
      // Compute velocities so that the ball reaches the chosen (x,y) point on the goal plane
      const destY = goalLineY + 8; // aim just inside the net
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
        trail: [{ x: penaltySpotX, y: penaltySpotY }],
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
      drawStadium(ctx, timestamp, graphicsQuality);
      drawPitch(ctx);
      drawGoal(ctx);
      // Update and render active shot
      if (activeShot) {
        updateShot(activeShot, dt, ctx, timestamp);
      } else {
        const idleColliders = offsetColliders(computeKeeperPose('center', 0, goalDims));
        drawKeeper(ctx, idleColliders, 'center', 0, timestamp);
        drawRestingBall(ctx);
      }
      drawCanvasHud(ctx);
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
      shot.trail.push({ x: shot.ball.position.x, y: shot.ball.position.y });
      if (shot.trail.length > 12) {
        shot.trail.shift();
      }
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
      const colliders = offsetColliders(collidersBase);
      // Draw keeper
      drawKeeper(ctx, colliders, shot.keeperDir, diveProgress, timestamp);
      drawBallTrail(ctx, shot.trail);
      drawBall(ctx, shot.ball.position.x, shot.ball.position.y, shot.ball.radius);
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
          ctx.fillStyle = 'rgba(255,255,255,0.72)';
          ctx.beginPath();
          ctx.arc(result.contact!.x, result.contact!.y, 18, 0, Math.PI * 2);
          ctx.fill();
        }
        // Inform parent component
        onShotComplete?.({
          scored: !result.saved,
          saved: result.saved,
          targetDir: shot.targetDir,
          keeperDir: shot.keeperDir,
        });
        // Remove active shot after short delay
        setTimeout(() => {
          setActiveShot(null);
        }, 800);
      }
    },
    [debug, goalLineY, goalXStart, keeperPrimary, keeperTrim, onShotComplete, penaltySpotX, penaltySpotY]
  );

  function offsetColliders(colliders: CircleCollider[]): CircleCollider[] {
    return colliders.map((collider) => ({
      center: { x: collider.center.x + goalXStart, y: collider.center.y },
      radius: collider.radius,
    }));
  }

  function drawStadium(
    ctx: CanvasRenderingContext2D,
    timestamp: number,
    quality: 'low' | 'medium' | 'high',
  ) {
    const sky = ctx.createLinearGradient(0, 0, 0, goalLineY + 30);
    sky.addColorStop(0, '#071225');
    sky.addColorStop(0.48, '#102a48');
    sky.addColorStop(1, '#163d56');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvasWidth, goalLineY + 48);

    ctx.fillStyle = 'rgba(255, 238, 186, 0.18)';
    ctx.fillRect(0, 0, canvasWidth, 8);
    ctx.fillStyle = 'rgba(2, 8, 17, 0.6)';
    ctx.fillRect(0, 72, canvasWidth, 56);

    const rows = quality === 'high' ? 4 : 2;
    const columns = quality === 'high' ? 46 : 24;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const x = (col + 0.5) * (canvasWidth / columns);
        const y = 82 + row * 10 + Math.sin((timestamp / 260) + col * 0.55) * 1.8;
        const hue = (col * 18 + row * 38 + timestamp / 80) % 360;
        ctx.fillStyle = `hsla(${hue}, 72%, 62%, 0.48)`;
        ctx.beginPath();
        ctx.arc(x, y, row % 2 === 0 ? 2.7 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, 126, canvasWidth, 4);
  }

  function drawPitch(ctx: CanvasRenderingContext2D) {
    const pitch = ctx.createLinearGradient(0, goalLineY, 0, canvasHeight);
    pitch.addColorStop(0, '#14914e');
    pitch.addColorStop(0.45, '#0f7e43');
    pitch.addColorStop(1, '#085f32');
    ctx.fillStyle = pitch;
    ctx.fillRect(0, goalLineY, canvasWidth, canvasHeight - goalLineY);

    for (let i = 0; i < 9; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
      const y = goalLineY + i * 36;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y - 12);
      ctx.lineTo(canvasWidth, y + 26);
      ctx.lineTo(0, y + 38);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(244, 255, 250, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(goalXStart - 52, goalLineY);
    ctx.lineTo(goalXStart - 120, canvasHeight - 18);
    ctx.moveTo(goalXStart + goalWidth + 52, goalLineY);
    ctx.lineTo(goalXStart + goalWidth + 120, canvasHeight - 18);
    ctx.moveTo(goalXStart - 46, goalLineY + 92);
    ctx.lineTo(goalXStart + goalWidth + 46, goalLineY + 92);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(penaltySpotX, penaltySpotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(penaltySpotX, goalLineY + 120, 76, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = 'rgba(244,255,250,0.48)';
    ctx.stroke();
  }

  function drawGoal(ctx: CanvasRenderingContext2D) {
    const goalTop = goalLineY - goalHeight;
    ctx.save();
    ctx.shadowColor = 'rgba(190, 225, 255, 0.56)';
    ctx.shadowBlur = 12;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f5fbff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(goalXStart, goalLineY);
    ctx.lineTo(goalXStart, goalTop);
    ctx.lineTo(goalXStart + goalWidth, goalTop);
    ctx.lineTo(goalXStart + goalWidth, goalLineY);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 1;
    const netSpacing = 18;
    for (let x = goalXStart; x <= goalXStart + goalWidth; x += netSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, goalTop + 4);
      ctx.lineTo(x + (x - penaltySpotX) * 0.08, goalLineY);
      ctx.stroke();
    }
    for (let y = goalTop + netSpacing; y < goalLineY; y += netSpacing) {
      ctx.beginPath();
      ctx.moveTo(goalXStart, y);
      ctx.lineTo(goalXStart + goalWidth, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(goalXStart - 6, goalLineY + 2, goalWidth + 12, 8);
  }

  function drawKeeper(
    ctx: CanvasRenderingContext2D,
    colliders: CircleCollider[],
    diveDir: DiveDirection,
    progress: number,
    timestamp: number,
  ) {
    const [head, torso, leftHand, rightHand] = colliders;
    const lean = diveDir === 'left' ? -progress : diveDir === 'right' ? progress : 0;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = keeperTrim;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(leftHand.center.x, leftHand.center.y);
    ctx.quadraticCurveTo(torso.center.x - 18 + lean * 18, torso.center.y + 4, torso.center.x, torso.center.y + 8);
    ctx.quadraticCurveTo(torso.center.x + 18 + lean * 18, torso.center.y + 4, rightHand.center.x, rightHand.center.y);
    ctx.stroke();

    ctx.fillStyle = keeperPrimary;
    ctx.beginPath();
    ctx.ellipse(torso.center.x + lean * 8, torso.center.y + 6, 23, 31, lean * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#f4d1aa';
    ctx.beginPath();
    ctx.arc(head.center.x + lean * 4, head.center.y, head.radius * 0.82, 0, Math.PI * 2);
    ctx.fill();

    [leftHand, rightHand].forEach((hand, index) => {
      ctx.fillStyle = index === 0 ? '#f8fbff' : '#d9f2ff';
      ctx.beginPath();
      ctx.arc(hand.center.x, hand.center.y, hand.radius * 0.82, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.ellipse(torso.center.x, torso.center.y + 54, 46 + Math.sin(timestamp / 220) * 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBallTrail(ctx: CanvasRenderingContext2D, trail: Array<{ x: number; y: number }>) {
    trail.forEach((point, index) => {
      const alpha = (index + 1) / trail.length;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + alpha * 0.22})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3 + alpha * 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.72)';
    ctx.shadowBlur = 12;
    const ball = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, 1, x, y, radius * 1.6);
    ball.addColorStop(0, '#ffffff');
    ball.addColorStop(0.38, ballColour);
    ball.addColorStop(1, '#102033');
    ctx.fillStyle = ball;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(4, 12, 24, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawRestingBall(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(penaltySpotX, penaltySpotY + 12, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    drawBall(ctx, penaltySpotX, penaltySpotY, 10);
  }

  function drawCanvasHud(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 10, 22, 0.62)';
    ctx.fillRect(18, canvasHeight - 48, canvasWidth - 36, 30);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeRect(18, canvasHeight - 48, canvasWidth - 36, 30);
    ctx.fillStyle = 'rgba(230, 241, 255, 0.86)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(`${shooterName} vs ${keeperName}`, 32, canvasHeight - 28);
    ctx.fillStyle = 'rgba(255, 224, 138, 0.9)';
    ctx.textAlign = 'right';
    ctx.fillText('BOOKIEBALL PENALTIES', canvasWidth - 32, canvasHeight - 28);
    ctx.restore();
  }

  return (
    <div className="penalty-canvas-game">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      {debug && (
        <div style={{ color: '#f44336', marginTop: '8px' }}>
          Debug: press 'd' to toggle
        </div>
      )}
    </div>
  );
};
