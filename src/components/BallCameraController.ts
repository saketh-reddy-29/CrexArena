import * as THREE from 'three';
import { Action3DSequence } from './Delivery3DActionAdapter';

export type BallCameraState =
  | 'BROADCAST'
  | 'BOWLING_TRACK'
  | 'BALL_TO_BATTER'
  | 'BALL_AFTER_CONTACT'
  | 'GROUND_TRACK'
  | 'AIR_TRACK'
  | 'FIELDER_TRACK'
  | 'CATCH_TRACK'
  | 'KEEPER_TRACK'
  | 'WICKET_TRACK'
  | 'BOUNDARY_TRACK'
  | 'RESULT'
  | 'CELEBRATION'
  | 'RESET';

export interface BallCameraConfig {
  baseDistance: number;
  minDistance: number;
  maxDistance: number;
  lookAheadDistance: number;
  velocityFactor: number;
  posLerpSpeed: number;
  lookLerpSpeed: number;
}

export const DEFAULT_CAMERA_CONFIG: BallCameraConfig = {
  baseDistance: 14.0,
  minDistance: 7.0,
  maxDistance: 32.0,
  lookAheadDistance: 3.5,
  velocityFactor: 0.25,
  posLerpSpeed: 0.08,
  lookLerpSpeed: 0.12,
};

export class BallCameraController {
  private currentState: BallCameraState = 'BROADCAST';
  private config: BallCameraConfig;

  // Smoothing buffers
  private currentCameraPos = new THREE.Vector3(0, 32, 42);
  private currentLookAt = new THREE.Vector3(0, 0, 0);
  private targetLookAt = new THREE.Vector3(0, 0, 0);
  private desiredCameraPos = new THREE.Vector3(0, 32, 42);

  // Velocity tracking
  private prevBallPos = new THREE.Vector3(0, 1.8, -10);
  private ballVelocity = new THREE.Vector3(0, 0, 0);

  // Status flags
  private isDeliveryComplete = false;

  constructor(config: Partial<BallCameraConfig> = {}) {
    this.config = { ...DEFAULT_CAMERA_CONFIG, ...config };
  }

  public getState(): BallCameraState {
    return this.currentState;
  }

  public isComplete(): boolean {
    return this.isDeliveryComplete;
  }

  public reset(camera?: THREE.Camera) {
    this.currentState = 'BROADCAST';
    this.isDeliveryComplete = false;
    this.prevBallPos.set(0, 1.8, -10);
    this.ballVelocity.set(0, 0, 0);

    if (camera) {
      this.currentCameraPos.copy(camera.position);
    } else {
      this.currentCameraPos.set(0, 32, 42);
    }
    this.currentLookAt.set(0, 0, 0);
    this.targetLookAt.set(0, 0, 0);
    this.desiredCameraPos.set(0, 32, 42);
  }

  /**
   * Evaluates delivery timeline progress and transitions ball camera state
   */
  public update(
    camera: THREE.PerspectiveCamera,
    progress: number,
    seq: Action3DSequence,
    ballPosition: THREE.Vector3,
    fielderPosition?: THREE.Vector3 | null,
    delta: number = 0.016
  ): { state: BallCameraState; lookAt: THREE.Vector3; position: THREE.Vector3 } {
    const { phases } = seq;

    // 1. Calculate Ball Velocity & Look-Ahead Vector
    if (delta > 0) {
      this.ballVelocity.subVectors(ballPosition, this.prevBallPos).divideScalar(delta);
    }
    this.prevBallPos.copy(ballPosition);

    const speed = this.ballVelocity.length();
    const velocityDir = speed > 0.001 ? this.ballVelocity.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const lookAheadDist = Math.min(this.config.lookAheadDistance, Math.max(1.0, speed * 0.12));
    const lookAheadPos = ballPosition.clone().add(velocityDir.clone().multiplyScalar(lookAheadDist));

    // Dynamic Distance based on speed
    const dynamicDist = THREE.MathUtils.clamp(
      this.config.baseDistance + speed * this.config.velocityFactor,
      this.config.minDistance,
      this.config.maxDistance
    );

    // 2. State Machine Transitions driven by real delivery events
    const ballReleased = progress >= phases.runupEnd;
    const ballBounced = progress >= phases.bounceEnd;
    const ballHitBat = progress >= phases.contactEnd;
    const ballReachedDestination = progress >= phases.fieldingEnd;
    const emotionStage = progress >= phases.fieldingEnd && progress < phases.emotionEnd;
    const finalStage = progress >= phases.emotionEnd;

    if (!ballReleased) {
      this.currentState = 'BOWLER_TRACK';
      // Follow bowler during run-up towards bowling crease
      this.desiredCameraPos.set(0, 14, -28);
      this.targetLookAt.set(0, 1.2, -10);
    } else if (ballReleased && !ballHitBat) {
      this.currentState = 'BALL_TO_BATTER';
      // Elevated tracking camera following ball from bowler to pitch bounce to batter
      const camY = Math.max(5.5, ballPosition.y + 4.5);
      const camZ = Math.min(ballPosition.z - 8.5, -2.0);
      this.desiredCameraPos.set(ballPosition.x * 0.4, camY, camZ);
      this.targetLookAt.copy(lookAheadPos);
    } else if (ballHitBat && !ballReachedDestination) {
      // Ball is in active play after bat contact
      if (seq.isSix) {
        this.currentState = 'AIR_TRACK';
        // Follow high ball arc with smooth wide camera tracking the flight to boundary
        const camY = Math.max(9.0, ballPosition.y * 0.6 + 6.0);
        const camZ = ballPosition.z * 0.35 + 16.0;
        const camX = ballPosition.x * 0.45;
        this.desiredCameraPos.set(camX, camY, camZ);
        this.targetLookAt.copy(lookAheadPos);
      } else if (seq.isFour) {
        this.currentState = 'GROUND_TRACK';
        // Follow ground boundary trajectory
        const camY = 7.5;
        const camZ = ballPosition.z * 0.5 + 12.0;
        const camX = ballPosition.x * 0.5;
        this.desiredCameraPos.set(camX, camY, camZ);
        this.targetLookAt.copy(lookAheadPos);
      } else if (seq.isCaught) {
        this.currentState = 'CATCH_TRACK';
        if (fielderPosition) {
          // As ball approaches fielder, blend lookAt to include both ball and fielder
          const distToFielder = ballPosition.distanceTo(fielderPosition);
          const blend = THREE.MathUtils.clamp(1.0 - (distToFielder / 18.0), 0, 1);
          const target = new THREE.Vector3().lerpVectors(ballPosition, fielderPosition, blend * 0.6);
          target.y = Math.max(1.2, ballPosition.y * 0.5 + 0.8);
          this.targetLookAt.copy(target);

          this.desiredCameraPos.set(
            target.x * 0.6,
            Math.max(6.5, ballPosition.y * 0.4 + 4.5),
            target.z * 0.6 + 10.0
          );
        } else {
          this.targetLookAt.copy(lookAheadPos);
          this.desiredCameraPos.set(ballPosition.x * 0.5, 7.5, ballPosition.z * 0.5 + 12.0);
        }
      } else if (seq.isBowled) {
        this.currentState = 'WICKET_TRACK';
        // Focus on ball crashing into stumps and flying bails
        this.desiredCameraPos.set(1.8, 3.2, 14.5);
        this.targetLookAt.set(0, 0.7, 10.1);
      } else if (seq.isLBW) {
        this.currentState = 'WICKET_TRACK';
        // Focus on pad impact & appeal
        this.desiredCameraPos.set(-2.0, 3.0, 13.5);
        this.targetLookAt.set(0, 0.8, 9.5);
      } else if (seq.isStumped) {
        this.currentState = 'KEEPER_TRACK';
        // Focus on keeper breaking stumps
        this.desiredCameraPos.set(-1.5, 2.8, 14.0);
        this.targetLookAt.set(0, 0.7, 10.1);
      } else if (seq.isRunOut) {
        this.currentState = 'WICKET_TRACK';
        // Follow throw to stumps
        this.desiredCameraPos.set(ballPosition.x * 0.3, 5.5, ballPosition.z * 0.3 + 12.0);
        this.targetLookAt.copy(lookAheadPos);
      } else {
        // Standard in-play ball follow for 1, 2, 3 runs or dot balls
        this.currentState = 'BALL_AFTER_CONTACT';
        const camY = 7.0;
        const camZ = ballPosition.z * 0.5 + 12.0;
        const camX = ballPosition.x * 0.5;
        this.desiredCameraPos.set(camX, camY, camZ);
        this.targetLookAt.copy(lookAheadPos);
      }
    } else if (emotionStage) {
      // Ball has reached destination! Camera now focuses on celebration / emotions
      this.currentState = 'CELEBRATION';
      if (seq.isMatchWinning || seq.milestone) {
        // Focus on celebrating batter raising bat/helmet
        this.desiredCameraPos.set(-2.6, 2.6, 6.2);
        this.targetLookAt.set(0, 1.2, 9.4);
      } else if (seq.isWicket) {
        // Focus on bowler / team celebration
        if (seq.isBowled || seq.isLBW) {
          this.desiredCameraPos.set(2.4, 2.6, -14.0);
          this.targetLookAt.set(0, 1.2, -10.0);
        } else {
          this.desiredCameraPos.set(-2.0, 2.5, 6.5);
          this.targetLookAt.set(0, 1.1, 9.4);
        }
      } else if (seq.isBoundary) {
        // Batter confident walk / fist pump
        this.desiredCameraPos.set(-2.5, 2.6, 6.0);
        this.targetLookAt.set(0, 1.2, 9.4);
      } else {
        // Wide stadium angle
        this.desiredCameraPos.set(0, 18, 30);
        this.targetLookAt.set(0, 1, 0);
      }
    } else if (finalStage) {
      this.currentState = 'RESULT';
      this.isDeliveryComplete = true;
      // Smoothly zoom out to broadcast wide
      this.desiredCameraPos.set(0, 26, 38);
      this.targetLookAt.set(0, 1, 0);
    }

    // 3. Smooth Lerp & Damping (Ensures no camera teleportation)
    const posLerp = emotionStage || finalStage ? 0.08 : this.config.posLerpSpeed;
    const lookLerp = this.config.lookLerpSpeed;

    this.currentCameraPos.lerp(this.desiredCameraPos, posLerp);
    this.currentLookAt.lerp(this.targetLookAt, lookLerp);

    camera.position.copy(this.currentCameraPos);
    camera.lookAt(this.currentLookAt);

    return {
      state: this.currentState,
      lookAt: this.currentLookAt.clone(),
      position: this.currentCameraPos.clone(),
    };
  }
}
