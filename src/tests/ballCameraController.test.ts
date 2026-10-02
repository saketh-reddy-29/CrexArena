import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { BallCameraController } from '../components/BallCameraController';
import { adaptDeliveryTo3DSequence } from '../components/Delivery3DActionAdapter';

describe('BallCameraController', () => {
  let controller: BallCameraController;
  let camera: THREE.PerspectiveCamera;

  beforeEach(() => {
    controller = new BallCameraController();
    camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.5, 300);
    camera.position.set(0, 32, 42);
    camera.lookAt(0, 0, 0);
  });

  it('initializes in BROADCAST state and not complete', () => {
    expect(controller.getState()).toBe('BROADCAST');
    expect(controller.isComplete()).toBe(false);
  });

  it('tracks bowler runup in BOWLER_TRACK state', () => {
    const seq = adaptDeliveryTo3DSequence({ runs: 4 });
    const ballPos = new THREE.Vector3(0, 1.8, -18);

    const res = controller.update(camera, 0.05, seq, ballPos);
    expect(res.state).toBe('BOWLER_TRACK');
    expect(controller.getState()).toBe('BOWLER_TRACK');
  });

  it('tracks ball flight from release to bounce in BALL_TO_BATTER state', () => {
    const seq = adaptDeliveryTo3DSequence({ runs: 1 });
    const ballPos = new THREE.Vector3(0, 1.2, 0);

    const res = controller.update(camera, 0.45, seq, ballPos);
    expect(res.state).toBe('BALL_TO_BATTER');
  });

  it('tracks high aerial trajectory on a SIX in AIR_TRACK state', () => {
    const seq = adaptDeliveryTo3DSequence({ runs: 6 });
    const ballPos = new THREE.Vector3(15, 8.5, 25);

    const res = controller.update(camera, 0.72, seq, ballPos);
    expect(res.state).toBe('AIR_TRACK');
  });

  it('tracks ground rolling trajectory on a FOUR in GROUND_TRACK state', () => {
    const seq = adaptDeliveryTo3DSequence({ runs: 4 });
    const ballPos = new THREE.Vector3(-20, 0.1, 28);

    const res = controller.update(camera, 0.72, seq, ballPos);
    expect(res.state).toBe('GROUND_TRACK');
  });

  it('tracks catch with fielder interpolation in CATCH_TRACK state', () => {
    const seq = adaptDeliveryTo3DSequence({ runs: 0, isWicket: true, wicketType: 'Caught by Long On' });
    const ballPos = new THREE.Vector3(12, 2.5, 24);
    const fielderPos = new THREE.Vector3(14, 0, 26);

    const res = controller.update(camera, 0.75, seq, ballPos, fielderPos);
    expect(res.state).toBe('CATCH_TRACK');
    expect(res.lookAt).toBeDefined();
  });

  it('tracks bowled wicket impact in WICKET_TRACK state', () => {
    const seq = adaptDeliveryTo3DSequence({ runs: 0, isWicket: true, wicketType: 'Bowled' });
    const ballPos = new THREE.Vector3(0, 0.6, 10.1);

    const res = controller.update(camera, 0.72, seq, ballPos);
    expect(res.state).toBe('WICKET_TRACK');
  });

  it('transitions to CELEBRATION during emotion phase and RESULT upon completion', () => {
    const seq = adaptDeliveryTo3DSequence({ runs: 6 });
    const ballPos = new THREE.Vector3(25, 0.1, 38);

    // Emotion phase
    const emotionRes = controller.update(camera, 0.88, seq, ballPos);
    expect(emotionRes.state).toBe('CELEBRATION');

    // Final result phase
    const resultRes = controller.update(camera, 0.98, seq, ballPos);
    expect(resultRes.state).toBe('RESULT');
    expect(controller.isComplete()).toBe(true);
  });

  it('resets cleanly to BROADCAST state', () => {
    const seq = adaptDeliveryTo3DSequence({ runs: 6 });
    controller.update(camera, 0.98, seq, new THREE.Vector3(0, 0, 0));
    expect(controller.isComplete()).toBe(true);

    controller.reset(camera);
    expect(controller.getState()).toBe('BROADCAST');
    expect(controller.isComplete()).toBe(false);
  });
});
