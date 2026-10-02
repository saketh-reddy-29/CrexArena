import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { adaptDeliveryTo3DSequence, Action3DSequence } from '../components/Delivery3DActionAdapter';
import { createCricketCharacter, CricketPlayer3DInstance } from '../components/CricketPlayer3D';
import { resolveBowlingAnimation, BOWLING_ANIMATION_ALIASES } from '../engine/visualization/AnimationResolver';
import { assertPreDelivery, DeliveryCompletionTracker } from '../engine/rules/deliveryAssertions';
import { isEligibleBowler } from '../engine/rules/bowlerEligibility';
import { Player } from '../types/common';

describe('Critical 3D Cricket Action Recovery — 10 Deterministic Deliveries Lifecycle', () => {
  const dummyBowler: Player = {
    id: 'b1',
    name: 'Jasprit Bumrah',
    role: 'Bowler',
    bowlingStyle: 'Fast',
    rating: 92,
    bowlingRating: 94,
  };

  const dummyStriker: Player = {
    id: 'bat1',
    name: 'Virat Kohli',
    role: 'Batter',
    battingStyle: 'Right-hand bat',
    rating: 92,
    technique: 95,
  };

  const dummyNonStriker: Player = {
    id: 'bat2',
    name: 'Rohit Sharma',
    role: 'Batter',
    battingStyle: 'Right-hand bat',
    rating: 90,
  };

  const tenDeliveries = [
    { num: 1, runs: 0, isWicket: false, wicketType: undefined, label: 'dot' },
    { num: 2, runs: 1, isWicket: false, wicketType: undefined, label: 'single' },
    { num: 3, runs: 4, isWicket: false, wicketType: undefined, label: 'four' },
    { num: 4, runs: 2, isWicket: false, wicketType: undefined, label: 'two' },
    { num: 5, runs: 0, isWicket: false, wicketType: undefined, label: 'defence' },
    { num: 6, runs: 6, isWicket: false, wicketType: undefined, label: 'six' },
    { num: 7, runs: 1, isWicket: false, wicketType: undefined, label: 'single' },
    { num: 8, runs: 0, isWicket: true, wicketType: 'CAUGHT', label: 'caught' },
    { num: 9, runs: 0, isWicket: false, wicketType: undefined, label: 'dot' },
    { num: 10, runs: 0, isWicket: true, wicketType: 'BOWLED', label: 'bowled' },
  ];

  it('verifies strict bowler eligibility invariants before deliveries', () => {
    expect(isEligibleBowler(dummyBowler)).toBe(true);
    expect(isEligibleBowler(dummyStriker)).toBe(false);
    expect(isEligibleBowler(dummyNonStriker)).toBe(false);

    expect(() => {
      assertPreDelivery({
        bowler: dummyStriker, // Pure batter must throw
        striker: dummyStriker,
        totalRuns: 0,
        batterRuns: 0,
        extraRuns: 0,
      });
    }).toThrow(/Ineligible player/);
  });

  it('verifies animation clip resolver and aliases for missing/fallback clips', () => {
    const availableClips = ['Idle', 'Walk', 'Run', 'Bowling_Action', 'Field_Catch'];

    // Alias resolution
    const runRes = resolveBowlingAnimation(availableClips, 'RUN_UP');
    expect(runRes.clipName).toBe('Run');
    expect(runRes.isFallback).toBe(false);

    const actionRes = resolveBowlingAnimation(availableClips, 'ARM_ROTATION');
    expect(actionRes.clipName).toBe('Bowling_Action');
    expect(actionRes.isFallback).toBe(false);

    // Missing clip fallback warning
    const missingRes = resolveBowlingAnimation([], 'BOWLER_GATHER');
    expect(missingRes.isFallback).toBe(true);
    expect(missingRes.warning).toContain('BOWLING ANIMATION CLIP MISSING');
  });

  tenDeliveries.forEach((d) => {
    it(`executes full 3D delivery lifecycle for Delivery ${d.num}: ${d.label}`, () => {
      // 1. Pre-delivery validation
      expect(() => {
        assertPreDelivery({
          bowler: dummyBowler,
          striker: dummyStriker,
          totalRuns: d.runs,
          batterRuns: d.runs,
          extraRuns: 0,
          trajectory: {
            startPos: { x: -0.8, y: 1.8, z: -18 },
            bouncePos: { x: 0.2, y: 0.04, z: 4.2 },
            contactPos: { x: 0, y: 0.55, z: 9.5 },
            targetPos: { x: 12, y: 0.08, z: 15 },
          },
        });
      }).not.toThrow();

      // 2. Adapt to 3D Action Sequence
      const seq: Action3DSequence = adaptDeliveryTo3DSequence(
        {
          runs: d.runs,
          isWicket: d.isWicket,
          wicketType: d.wicketType,
          isExtra: false,
          bowlingTactic: 'OUTSWING',
        } as any,
        'OUTSWING',
        {
          strikerScore: 10 + d.runs,
          strikerName: dummyStriker.name,
          bowlerWickets: d.isWicket ? 1 : 0,
          bowlerName: dummyBowler.name,
          currentScore: 40 + d.runs,
          isTestFormat: true,
        }
      );

      // Verify pipeline stage timing order
      const { phases } = seq;
      expect(phases.readyEnd).toBeLessThan(phases.runupEnd);
      expect(phases.runupEnd).toBeLessThan(phases.gatherEnd);
      expect(phases.gatherEnd).toBeLessThan(phases.strideEnd);
      expect(phases.strideEnd).toBeLessThan(phases.rotationEnd);
      expect(phases.rotationEnd).toBeLessThanOrEqual(phases.releaseEnd);
      expect(phases.releaseEnd).toBeLessThan(phases.bounceEnd);
      expect(phases.bounceEnd).toBeLessThan(phases.contactEnd);
      expect(phases.contactEnd).toBeLessThan(phases.fieldingEnd);
      expect(phases.fieldingEnd).toBeLessThan(phases.emotionEnd);
      expect(phases.emotionEnd).toBeLessThanOrEqual(phases.resultEnd);

      // Verify procedural character execution across lifecycle
      const bowlerChar: CricketPlayer3DInstance = createCricketCharacter({
        id: dummyBowler.id,
        name: dummyBowler.name,
        role: 'BOWLER',
        isTestFormat: true,
      });

      const strikerChar: CricketPlayer3DInstance = createCricketCharacter({
        id: dummyStriker.id,
        name: dummyStriker.name,
        role: 'BATTER',
        isTestFormat: true,
      });

      // Step A: Bowler Ready (holding ball in hand)
      bowlerChar.updateAnimation('BOWLING_READY', 0);
      const handPosReady = bowlerChar.getHandWorldPosition();
      expect(Number.isFinite(handPosReady.x)).toBe(true);
      expect(Number.isFinite(handPosReady.y)).toBe(true);

      // Step B: Bowler Run-Up Sprint
      bowlerChar.updateAnimation('BOWLER_RUNUP', 0.5);

      // Step C: Bowler Gather & Leap
      bowlerChar.updateAnimation('BOWLER_GATHER', 0.5);

      // Step D: Delivery Stride
      bowlerChar.updateAnimation('DELIVERY_STRIDE', 0.8);

      // Step E: Arm Rotation (Windmill)
      bowlerChar.updateAnimation('ARM_ROTATION', 0.9);
      const handPosApex = bowlerChar.getHandWorldPosition();
      expect(Number.isFinite(handPosApex.z)).toBe(true);

      // Step F: Ball Release
      bowlerChar.updateAnimation('RELEASE', 1.0);

      // Step G: Ball Flight & Bounce (bounce reaches pitch level)
      expect(seq.ballTrajectory.bouncePos.y).toBeLessThanOrEqual(0.06);

      // Step H: Batter Action & Contact
      strikerChar.updateAnimation(seq.batterAnim, 0.5);

      // Step I: Ball Travel to Final Destination
      expect(Number.isFinite(seq.ballTrajectory.targetPos.x)).toBe(true);
      expect(Number.isFinite(seq.ballTrajectory.targetPos.z)).toBe(true);

      // Step J: Lifecycle Completion Tracking (Score updated exactly once, delivery complete exactly once)
      const tracker = new DeliveryCompletionTracker();
      tracker.markScoreUpdated();
      tracker.markDeliverySaved();
      tracker.markDeliveryComplete();
      expect(() => tracker.assertCompletion()).not.toThrow();
    });
  });
});
