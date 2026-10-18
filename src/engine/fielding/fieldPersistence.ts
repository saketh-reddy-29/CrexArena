import type { FieldConfiguration } from '../strategy/BowlerFieldStrategyEngine';

/**
 * The slice of live-match state that carries the active field formation across
 * a refresh or a match resumption (§9). Kept as a plain, JSON-serialisable
 * object so it can live inside the persisted store's `liveMatchState`.
 *
 * Persisting the resolved configuration (and not just the preset key) is what
 * guarantees the *same* legal formation is restored — regenerating from a key
 * would re-roll catcher placement and could produce a different/invalid field.
 */
export interface FieldPersistenceState {
  fieldPresetKey: string | null;
  liveFieldConfiguration: FieldConfiguration | null;
}

export interface FieldPersistenceSource {
  currentMatchId?: unknown;
  fieldPresetKey?: unknown;
  liveFieldConfiguration?: unknown;
}

/**
 * Extracts the restorable field state from a persisted live-match record.
 * Returns `null` when there is nothing to restore, or when the record belongs
 * to a different match — a stale formation must never leak into a new game.
 */
export function restoreFieldState(
  liveMatchState: FieldPersistenceSource | null | undefined,
  currentMatchId: string | null | undefined,
): FieldPersistenceState | null {
  if (!liveMatchState) return null;
  if (!currentMatchId || liveMatchState.currentMatchId !== currentMatchId) return null;

  const preset = liveMatchState.fieldPresetKey;
  const config = liveMatchState.liveFieldConfiguration;
  return {
    fieldPresetKey: typeof preset === 'string' ? preset : null,
    liveFieldConfiguration: config && typeof config === 'object' ? (config as FieldConfiguration) : null,
  };
}

/**
 * Builds the field slice to merge into the persisted live-match record.
 * Always returns both keys (nulls included) so a cleared formation overwrites
 * any stale persisted formation rather than leaving it behind.
 */
export function serializeFieldState(state: FieldPersistenceState): FieldPersistenceState {
  return {
    fieldPresetKey: state.fieldPresetKey ?? null,
    liveFieldConfiguration: state.liveFieldConfiguration ?? null,
  };
}
