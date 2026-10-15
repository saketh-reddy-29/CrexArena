import { describe, it, expect } from 'vitest';
import {
  computeControlPermissions,
  canPerformAction,
  resolveBattingOwner,
  resolveBowlingOwner,
  resolveTeamRole,
  userControlsBatting,
  getAiOwnedActions,
  describeControlOwnership,
  type ControlAction,
} from '../engine/control/MatchControlPermissions';

const USER = 'team-user';
const OPP = 'team-opp';

describe('MatchControlPermissions — central control authority', () => {
  it('grants the user batting controls (and only those) while their team bats', () => {
    const perms = computeControlPermissions({
      userTeamId: USER,
      battingTeamId: USER,
      bowlingTeamId: OPP,
      phase: 'IN_INNINGS',
    });

    expect(perms.userRole).toBe('BATTING');
    expect(perms.battingOwner).toBe('USER');
    expect(perms.bowlingOwner).toBe('AI');
    expect(perms.fieldingOwner).toBe('AI');

    expect(canPerformAction(perms, 'SELECT_OPENING_BATTERS')).toBe(true);
    expect(canPerformAction(perms, 'SELECT_INCOMING_BATTER')).toBe(true);
    expect(canPerformAction(perms, 'SET_BATTING_INTENT')).toBe(true);
    expect(userControlsBatting(perms)).toBe(true);
  });

  it('never lets the user control bowling, fielding or the opponent lineup', () => {
    const batting = computeControlPermissions({
      userTeamId: USER,
      battingTeamId: USER,
      bowlingTeamId: OPP,
      phase: 'IN_INNINGS',
    });
    const bowling = computeControlPermissions({
      userTeamId: USER,
      battingTeamId: OPP,
      bowlingTeamId: USER,
      phase: 'IN_INNINGS',
    });

    const aiOnly: ControlAction[] = [
      'SELECT_BOWLER',
      'SET_BOWLING_PLAN',
      'SET_FIELD',
      'MOVE_FIELDER',
      'MANAGE_OPPONENT_LINEUP',
    ];
    for (const perms of [batting, bowling]) {
      for (const action of aiOnly) {
        expect(canPerformAction(perms, action)).toBe(false);
        expect(perms.permissions[action].owner).toBe('AI');
      }
    }
  });

  it('gives the user no batting controls while their team is fielding', () => {
    const perms = computeControlPermissions({
      userTeamId: USER,
      battingTeamId: OPP,
      bowlingTeamId: USER,
      phase: 'IN_INNINGS',
    });

    expect(perms.userRole).toBe('BOWLING');
    expect(perms.battingOwner).toBe('AI');
    expect(canPerformAction(perms, 'SELECT_INCOMING_BATTER')).toBe(false);
    expect(canPerformAction(perms, 'SET_BATTING_INTENT')).toBe(false);
  });

  it('treats the opponent batting as AI-owned', () => {
    expect(resolveBattingOwner({ userTeamId: USER, battingTeamId: OPP })).toBe('AI');
    expect(resolveBattingOwner({ userTeamId: USER, battingTeamId: USER })).toBe('USER');
    expect(resolveBowlingOwner()).toBe('AI');
  });

  it('is watch-only when no user team is set (nothing is permitted)', () => {
    const perms = computeControlPermissions({
      userTeamId: null,
      battingTeamId: USER,
      bowlingTeamId: OPP,
      phase: 'IN_INNINGS',
    });
    expect(perms.userRole).toBe('WATCHING');
    const actions = Object.keys(perms.permissions) as ControlAction[];
    expect(actions.every((a) => canPerformAction(perms, a) === false)).toBe(true);
  });

  it('revokes batting controls once the match is complete', () => {
    const perms = computeControlPermissions({
      userTeamId: USER,
      battingTeamId: USER,
      bowlingTeamId: OPP,
      phase: 'MATCH_COMPLETE',
    });
    expect(canPerformAction(perms, 'SELECT_INCOMING_BATTER')).toBe(false);
    expect(canPerformAction(perms, 'SET_BATTING_INTENT')).toBe(false);
  });

  it('resolves team role correctly and keeps AI-owned actions permanent', () => {
    expect(resolveTeamRole(USER, { battingTeamId: USER, bowlingTeamId: OPP })).toBe('BATTING');
    expect(resolveTeamRole(USER, { battingTeamId: OPP, bowlingTeamId: USER })).toBe('BOWLING');
    expect(resolveTeamRole(USER, { battingTeamId: 'x', bowlingTeamId: 'y' })).toBe('WATCHING');
    expect(getAiOwnedActions()).toContain('SELECT_BOWLER');
    expect(getAiOwnedActions()).toContain('MANAGE_OPPONENT_LINEUP');
    expect(typeof describeControlOwnership(computeControlPermissions({ userTeamId: USER, battingTeamId: USER, bowlingTeamId: OPP }))).toBe('string');
  });
});
