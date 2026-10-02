import * as THREE from 'three';
import { CompleteBallFlightPlan, BallTrajectoryCalculator } from './BallTrajectory';

export class BallFlightEngine {
  private ballMesh: THREE.Mesh | null = null;
  private ballShadowMesh: THREE.Mesh | null = null;
  private trailLine: THREE.Line | null = null;
  private trailPositions: Float32Array;
  private trailCount: number = 24;
  private currentPlan: CompleteBallFlightPlan | null = null;
  private activePos: THREE.Vector3 = new THREE.Vector3();

  constructor() {
    this.trailPositions = new Float32Array(this.trailCount * 3);
  }

  /**
   * Initializes 3D Mesh and subtle trail line into Three.js Scene
   */
  public init(scene: THREE.Scene, isTest: boolean = false): void {
    // 1. Cricket Ball Mesh
    const ballColor = isTest ? 0x991b1b : 0xf8fafc; // Red for Test, White for Limited Overs
    const ballGeo = new THREE.SphereGeometry(0.09, 20, 20);
    const ballMat = new THREE.MeshStandardMaterial({
      color: ballColor,
      roughness: 0.35,
      metalness: 0.15,
    });
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.visible = false;
    scene.add(this.ballMesh);

    // 2. Dynamic Ground Shadow
    const shadowGeo = new THREE.CircleGeometry(0.12, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.ballShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.ballShadowMesh.rotation.x = -Math.PI / 2;
    this.ballShadowMesh.position.y = 0.02;
    this.ballShadowMesh.visible = false;
    scene.add(this.ballShadowMesh);

    // 3. Subtle Ribbon Trail
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: isTest ? 0xef4444 : 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      linewidth: 2,
    });
    this.trailLine = new THREE.Line(trailGeo, trailMat);
    this.trailLine.visible = false;
    scene.add(this.trailLine);
  }

  public setFlightPlan(plan: CompleteBallFlightPlan): void {
    this.currentPlan = plan;
    this.resetTrail();
  }

  public resetTrail(): void {
    if (!this.currentPlan) return;
    const start = this.currentPlan.releasePos;
    for (let i = 0; i < this.trailCount; i++) {
      this.trailPositions[i * 3] = start.x;
      this.trailPositions[i * 3 + 1] = start.y;
      this.trailPositions[i * 3 + 2] = start.z;
    }
    if (this.trailLine) {
      this.trailLine.geometry.attributes.position.needsUpdate = true;
    }
  }

  /**
   * Evaluates and updates ball 3D transform and trail at normalized delivery progress (0.0 to 1.0)
   */
  public update(progress: number): THREE.Vector3 {
    if (!this.currentPlan || !this.ballMesh) {
      return this.activePos;
    }

    // Evaluate exact ballistic / Bezier coordinates
    BallTrajectoryCalculator.sampleBallPosition(progress, this.currentPlan, this.activePos);

    // Visibility rules: visible from gather/runup through celebration
    const isVisible = progress >= 0.15 && progress <= 0.98;
    this.ballMesh.visible = isVisible;
    this.ballMesh.position.copy(this.activePos);

    // Update Ground Shadow
    if (this.ballShadowMesh) {
      this.ballShadowMesh.visible = isVisible;
      this.ballShadowMesh.position.x = this.activePos.x;
      this.ballShadowMesh.position.z = this.activePos.z;
      // Shadow scales and fades with altitude
      const alt = Math.max(0, this.activePos.y - 0.05);
      const scale = Math.max(0.4, 1.0 - alt * 0.04);
      this.ballShadowMesh.scale.set(scale, scale, 1);
      (this.ballShadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.45 - alt * 0.03);
    }

    // Shift trail points
    if (this.trailLine && isVisible && progress >= 0.38 && progress <= 0.80) {
      this.trailLine.visible = true;
      for (let i = this.trailCount - 1; i > 0; i--) {
        this.trailPositions[i * 3] = this.trailPositions[(i - 1) * 3];
        this.trailPositions[i * 3 + 1] = this.trailPositions[(i - 1) * 3 + 1];
        this.trailPositions[i * 3 + 2] = this.trailPositions[(i - 1) * 3 + 2];
      }
      this.trailPositions[0] = this.activePos.x;
      this.trailPositions[1] = this.activePos.y;
      this.trailPositions[2] = this.activePos.z;
      this.trailLine.geometry.attributes.position.needsUpdate = true;
    } else if (this.trailLine) {
      this.trailLine.visible = false;
    }

    return this.activePos;
  }

  public getPosition(): THREE.Vector3 {
    return this.activePos;
  }
}

export const ballFlightEngine = new BallFlightEngine();
