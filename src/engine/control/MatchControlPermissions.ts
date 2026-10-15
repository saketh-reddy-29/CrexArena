// ─────────────────────────────────────────────────────────────────────────────
// MATCH CONTROL PERMISSIONS — single authoritative source of truth for *who*
// is allowed to make *which* decision during a live match.
//
// Product rules:
//   • The user only ever controls their OWN team's batting decisions
//     (opening batters, batting order and the incoming batter after a wicket,
//      plus batting intent).
//   • ALL bowling, bowling-plan and fielding decisions are controlled by the
//     bowling team's AI captain — never by the user, regardless of which team
//     the user owns.
//   • The opponent team always controls its own batting automatically.
//
// This module is intentionally pure (no React, no store imports) so it can be
// unit-tested and reused by the authoritative application layer. The UI must
// consult `canPerformAction` before rendering or honouring any command — the
// engine layer never trusts the UI to hide a control.
// ─────────────────────────────────────────────────────────────────────────────

export type MatchRole = 'BATTING' | 'BOWLING' | 'WATCHING';

export type ControlOwner = 'USER' | 'AI';

export type InningsPhase = 'PRE_INNINGS' | 'IN_INNINGS' | 'INNINGS_BREAK' | 'MATCH_COMPLETE';

export type ControlAction =
  | 'SELECT_OPENING_BATTERS'
  | 'SELECT_INCOMING_BATTER'
  | 'SET_BATTING_INTENT'
  | 'SELECT_BOWLER'
  | 'SET_BOWLING_PLAN'
  | 'SET_FIELD'
  | 'MOVE_FIELDER'
  | 'MANAGE_OPPONENT_LINEUP';

export interface MatchControlContext {
  userTeamId?: string | null;
  battingTeamId?: string | null;
  bowlingTeamId?: string | null;
  /** Innings lifecycle phase. Defaults to 'IN_INNINGS'. */
  phase?: InningsPhase;
}

export interface ControlPermission {
  allowed: boolean;
  owner: ControlOwner;
  reason: string;
}

export interface MatchControlPermissions {
  userTeamId: string | null;
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  /** What the user's team is doing right now. */
  userRole: MatchRole;
  /** Who may make batting decisions for the current innings. */
  battingOwner: ControlOwner;
  /** Who owns bowling decisions (always the AI captain). */
  bowlingOwner: ControlOwner;
  /** Who owns field placement decisions (always the AI captain). */
  fieldingOwner: ControlOwner;
  phase: InningsPhase;
  permissions: Record<ControlAction, ControlPermission>;
}

export const CONTROL_ACTION_LABEL: Record<ControlAction, string> = {
  SELECT_OPENING_BATTERS: 'Select opening batters',
  SELECT_INCOMING_BATTER: 'Select incoming batter',
  SET_BATTING_INTENT: 'Set batting intent',
  SELECT_BOWLER: 'Select bowler',
  SET_BOWLING_PLAN: 'Select bowling plan',
  SET_FIELD: 'Set field',
  MOVE_FIELDER: 'Move fielders',
  MANAGE_OPPONENT_LINEUP: 'Manage opponent lineup',
};

/** Actions that only ever belong to the (always autonomous) AI captain. */
const AI_ONLY_ACTIONS: ControlAction[] = [
  'SELECT_BOWLER',
  'SET_BOWLING_PLAN',
  'SET_FIELD',
  'MOVE_FIELDER',
  'MANAGE_OPPONENT_LINEUP',
];

const AI_ONLY_REASON: Record<string, string> = {
  SELECT_BOWLER: 'Bowling changes are controlled automatically by the bowling team\'s AI captain.',
  SET_BOWLING_PLAN: 'Bowling plans are controlled automatically by the bowling team\'s AI captain.',
  SET_FIELD: 'Field placements are controlled automatically by the bowling team\'s AI captain.',
  MOVE_FIELDER: 'Fielders are positioned automatically by the bowling team\'s AI captain.',
  MANAGE_OPPONENT_LINEUP: 'The opponent team controls its own lineup automatically.',
};

function normId(id?: string | null): string | null {
  return id && id.length > 0 ? id : null;
}

/** Resolves what the user's team is doing in the current innings. */
export function resolveTeamRole(userTeamId: string | null, context: MatchControlContext): MatchRole {
  if (!userTeamId) return 'WATCHING';
  if (normId(context.battingTeamId) === userTeamId) return 'BATTING';
  if (normId(context.bowlingTeamId) === userTeamId) return 'BOWLING';
  return 'WATCHING';
}

/** Batting decisions belong to the user only while their team is batting. */
export function resolveBattingOwner(context: MatchControlContext): ControlOwner {
  const user = normId(context.userTeamId);
  if (user && normId(context.battingTeamId) === user) return 'USER';
  return 'AI';
}

/** Bowling (and, by extension, fielding) decisions are always AI-controlled. */
export function resolveBowlingOwner(): ControlOwner {
  return 'AI';
}

export function resolveFieldingOwner(): ControlOwner {
  return 'AI';
}

function makePermission(
  action: ControlAction,
  allowed: boolean,
  owner: ControlOwner,
  reason: string,
): ControlPermission {
  return { allowed, owner, reason };
}

/**
 * Builds the complete permission matrix for a match context. This is the value
 * the application layer should compute once per render and consult for every
 * user-initiated command.
 */
export function computeControlPermissions(context: MatchControlContext): MatchControlPermissions {
  const userTeamId = normId(context.userTeamId);
  const battingTeamId = normId(context.battingTeamId);
  const bowlingTeamId = normId(context.bowlingTeamId);
  const phase: InningsPhase = context.phase ?? 'IN_INNINGS';

  const userRole = resolveTeamRole(userTeamId, { battingTeamId, bowlingTeamId });
  const battingOwner = resolveBattingOwner({ userTeamId, battingTeamId });
  const bowlingOwner = resolveBowlingOwner();
  const fieldingOwner = resolveFieldingOwner();

  const userBats = userRole === 'BATTING' && phase !== 'MATCH_COMPLETE';
  const battingReason = userBats
    ? 'Your team is batting — you control the batting lineup.'
    : battingOwner === 'AI'
      ? 'The opposing team controls its own batting automatically.'
      : 'Batting decisions are not available right now.';

  const permissions: Record<ControlAction, ControlPermission> = {
    SELECT_OPENING_BATTERS: makePermission(
      'SELECT_OPENING_BATTERS',
      userBats,
      battingOwner,
      battingReason,
    ),
    SELECT_INCOMING_BATTER: makePermission(
      'SELECT_INCOMING_BATTER',
      userBats,
      battingOwner,
      battingReason,
    ),
    SET_BATTING_INTENT: makePermission(
      'SET_BATTING_INTENT',
      userBats,
      battingOwner,
      battingReason,
    ),
    SELECT_BOWLER: makePermission('SELECT_BOWLER', false, 'AI', AI_ONLY_REASON.SELECT_BOWLER),
    SET_BOWLING_PLAN: makePermission('SET_BOWLING_PLAN', false, 'AI', AI_ONLY_REASON.SET_BOWLING_PLAN),
    SET_FIELD: makePermission('SET_FIELD', false, 'AI', AI_ONLY_REASON.SET_FIELD),
    MOVE_FIELDER: makePermission('MOVE_FIELDER', false, 'AI', AI_ONLY_REASON.MOVE_FIELDER),
    MANAGE_OPPONENT_LINEUP: makePermission(
      'MANAGE_OPPONENT_LINEUP',
      false,
      'AI',
      AI_ONLY_REASON.MANAGE_OPPONENT_LINEUP,
    ),
  };

  return {
    userTeamId,
    battingTeamId,
    bowlingTeamId,
    userRole,
    battingOwner,
    bowlingOwner,
    fieldingOwner,
    phase,
    permissions,
  };
}

/** Convenience: is the given action permitted for the user? */
export function canPerformAction(perms: MatchControlPermissions, action: ControlAction): boolean {
  return perms.permissions[action]?.allowed ?? false;
}

/** Convenience: full permission record (allowed + reason + owner). */
export function getPermission(
  perms: MatchControlPermissions,
  action: ControlAction,
): ControlPermission {
  return (
    perms.permissions[action] ?? {
      allowed: false,
      owner: 'AI',
      reason: 'Unknown control action.',
    }
  );
}

/** True when the user is allowed to pick the incoming batter (their own innings). */
export function userControlsBatting(perms: MatchControlPermissions): boolean {
  return perms.battingOwner === 'USER';
}

/** True when the user may change batting intent right now. */
export function userControlsBattingIntent(perms: MatchControlPermissions): boolean {
  return canPerformAction(perms, 'SET_BATTING_INTENT');
}

/** A stable truthy check used by both UI and engine guards. */
export function isUserTeamBatting(perms: MatchControlPermissions): boolean {
  return perms.userRole === 'BATTING';
}

/**
 * The only set of controls that should ever be rendered as interactive for the
 * user. Everything else must be disabled or hidden.
 */
export function getUserInteractiveActions(perms: MatchControlPermissions): ControlAction[] {
  return (Object.keys(perms.permissions) as ControlAction[]).filter((action) =>
    canPerformAction(perms, action),
  );
}

/** Human-readable summary of the current control split (for the match header). */
export function describeControlOwnership(perms: MatchControlPermissions): string {
  switch (perms.userRole) {
    case 'BATTING':
      return 'You control your batting · AI controls bowling & fielding';
    case 'BOWLING':
      return 'AI batting, bowling & fielding · sit back and watch';
    default:
      return 'AI controls all on-field decisions';
  }
}

/** All control actions that are permanently AI-owned (never user-interactive). */
export function getAiOwnedActions(): ControlAction[] {
  return [...AI_ONLY_ACTIONS];
}
