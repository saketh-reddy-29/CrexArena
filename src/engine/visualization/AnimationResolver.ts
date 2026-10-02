import * as THREE from 'three';

export interface BowlingAnimationAliases {
  RUN_UP: string[];
  GATHER: string[];
  DELIVERY_STRIDE: string[];
  ARM_ROTATION: string[];
  RELEASE: string[];
  FOLLOW_THROUGH: string[];
}

export const BOWLING_ANIMATION_ALIASES: Record<string, string[]> = {
  RUN_UP: ['RUN_UP', 'RUNUP', 'BOWLER_RUN', 'BOWLING_RUNUP', 'run', 'sprint'],
  GATHER: ['GATHER', 'BOWLER_GATHER', 'gather', 'jump'],
  DELIVERY_STRIDE: ['DELIVERY_STRIDE', 'DELIVERY', 'delivery_stride', 'stride'],
  ARM_ROTATION: ['ARM_ROTATION', 'ARM_ACTION', 'BOWLING_ACTION', 'bowling', 'bowl', 'windmill'],
  RELEASE: ['RELEASE', 'BALL_RELEASE', 'release', 'deliver'],
  FOLLOW_THROUGH: ['FOLLOW_THROUGH', 'FOLLOWTHROUGH', 'BOWLER_FOLLOW_THROUGH', 'follow_through'],
};

/**
 * Resolves an animation clip name against available clips in a GLTF model
 * Supports aliases and fallback detection.
 */
export function resolveBowlingAnimation(
  availableClips: (THREE.AnimationClip | string)[],
  requestedName: string
): { clipName: string | null; isExact: boolean; isFallback: boolean; warning?: string } {
  const clipNames = availableClips.map((c) => (typeof c === 'string' ? c : c.name));

  if (clipNames.length === 0) {
    return {
      clipName: null,
      isExact: false,
      isFallback: true,
      warning: 'BOWLING ANIMATION CLIP MISSING: No animation clips found in model. Procedural rig active.',
    };
  }

  // 1. Exact match
  if (clipNames.includes(requestedName)) {
    return { clipName: requestedName, isExact: true, isFallback: false };
  }

  // 2. Case-insensitive match
  const lowerReq = requestedName.toLowerCase().replace(/[_\s-]/g, '');
  const foundExact = clipNames.find((name) => name.toLowerCase().replace(/[_\s-]/g, '') === lowerReq);
  if (foundExact) {
    return { clipName: foundExact, isExact: true, isFallback: false };
  }

  // 3. Alias match
  const aliases = BOWLING_ANIMATION_ALIASES[requestedName] || [];
  for (const alias of aliases) {
    const lowerAlias = alias.toLowerCase().replace(/[_\s-]/g, '');
    const foundAlias = clipNames.find((name) => name.toLowerCase().replace(/[_\s-]/g, '').includes(lowerAlias));
    if (foundAlias) {
      return { clipName: foundAlias, isExact: false, isFallback: false };
    }
  }

  // 4. Fallback to generic bowling action if any exists
  const bowlingGeneric = clipNames.find((name) => {
    const l = name.toLowerCase();
    return l.includes('bowl') || l.includes('action') || l.includes('pitch');
  });

  if (bowlingGeneric) {
    return {
      clipName: bowlingGeneric,
      isExact: false,
      isFallback: true,
      warning: `BOWLING ANIMATION CLIP MISSING: Exact clip "${requestedName}" not found. Using fallback "${bowlingGeneric}".`,
    };
  }

  return {
    clipName: clipNames[0] || null,
    isExact: false,
    isFallback: true,
    warning: `BOWLING ANIMATION CLIP MISSING: No bowling clip found for "${requestedName}". Available clips: [${clipNames.join(', ')}].`,
  };
}

/**
 * Three.js AnimationMixer Manager for animated 3D characters
 * Ensures:
 * - One mixer per player model
 * - Animations never restarted every render frame
 * - Transitions only occur on state change
 * - Actions properly crossfade with fadeIn
 */
export class PlayerAnimationManager {
  private mixer: THREE.AnimationMixer;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private currentClipName: string | null = null;
  public readonly playerId: string;

  constructor(playerId: string, root: THREE.Object3D, clips: THREE.AnimationClip[] = []) {
    this.playerId = playerId;
    this.mixer = new THREE.AnimationMixer(root);

    // Pre-create actions for all available clips
    clips.forEach((clip) => {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    });

    if (clips.length === 0) {
      console.info(`[PlayerAnimationManager] Player ${playerId}: No GLTF clips provided, operating with procedural animations.`);
    }
  }

  /**
   * Transitions to a new animation clip if changed.
   * NEVER restarts if currentAction is already playing the same clip.
   */
  public playPlayerAnimation(
    requestedName: string,
    options: { fadeIn?: number; loop?: boolean; timeScale?: number } = {}
  ): { success: boolean; clipName: string | null; warning?: string } {
    const { fadeIn = 0.12, loop = false, timeScale = 1.0 } = options;

    const availableNames = Array.from(this.actions.keys());
    const resolution = resolveBowlingAnimation(availableNames, requestedName);

    if (!resolution.clipName) {
      return { success: false, clipName: null, warning: resolution.warning };
    }

    // Do NOT restart if already playing this clip
    if (this.currentClipName === resolution.clipName && this.currentAction && this.currentAction.isRunning()) {
      return { success: true, clipName: resolution.clipName };
    }

    const nextAction = this.actions.get(resolution.clipName);
    if (!nextAction) {
      return { success: false, clipName: null, warning: 'Action not found in mixer map' };
    }

    nextAction.reset();
    nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    nextAction.clampWhenFinished = !loop;
    nextAction.timeScale = timeScale;

    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.crossFadeTo(nextAction, fadeIn, true);
    }

    nextAction.play();
    this.currentAction = nextAction;
    this.currentClipName = resolution.clipName;

    return { success: true, clipName: resolution.clipName, warning: resolution.warning };
  }

  /**
   * Updates mixer per frame with delta seconds
   */
  public update(deltaSeconds: number): void {
    if (this.mixer) {
      this.mixer.update(deltaSeconds);
    }
  }

  public getCurrentClipName(): string | null {
    return this.currentClipName;
  }

  public stop(): void {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
      this.currentClipName = null;
    }
  }

  public dispose(): void {
    this.stop();
    this.mixer.stopAllAction();
    this.actions.clear();
  }
}
