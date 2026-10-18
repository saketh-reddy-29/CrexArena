/**
 * FieldSetupDashboard.tsx
 *
 * Interactive Field Setup dashboard — Cricket Arena.
 * AI automatically selects the best formation every render based on:
 *   • Current match phase (powerplay / middle / death / session)
 *   • Active bowler type (pace / spin)
 *   • Match situation (wickets fallen, partnership, target pressure)
 *   • Historical batter scoring-zone tendencies (BatterScoringMemory)
 *
 * Humans can override by clicking any card. Override persists until format/phase changes.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Shield, Cpu, User } from 'lucide-react';
import {
  BowlerFieldStrategyEngine,
  CANONICAL_POSITIONS,
  type FieldPositionDef,
} from '../engine/strategy/BowlerFieldStrategyEngine';
import { BatterScoringMemory } from '../engine/analytics/BatterScoringMemory';
import { useGameStore } from '../stores/useGameStore';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type FormatTab = 'T20' | 'ODI' | 'TEST';
type PhaseKey  = 'POWERPLAY' | 'MIDDLE' | 'DEATH' | 'NEW_BALL' | 'SPIN' | 'LATE';

interface Formation {
  formationId: string;
  key: string;
  name: string;
  intent: string;
  positionKeys: string[];
  format: FormatTab;
  phase: PhaseKey;
}

// ─── Deterministic fingerprint (djb2) ────────────────────────────────────────

function djb2(format: string, key: string, positionKeys: string[]): string {
  const raw = `${format}:${key}:${[...positionKeys].sort().join(',')}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = (((h << 5) + h) ^ raw.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(7, '0');
}

// ─── Phase maps ───────────────────────────────────────────────────────────────

const T20_PHASE_MAP: Record<string, PhaseKey> = {
  T20_PP_PACE: 'POWERPLAY', T20_PP_LEFT_ARM_PACE: 'POWERPLAY',
  T20_PP_SPIN_RIGHT: 'POWERPLAY', T20_PP_SPIN_LEFT: 'POWERPLAY',
  T20_PP_DEFENSIVE: 'POWERPLAY', ATTACKING_SLIP_CORDON: 'POWERPLAY',
  T20_MID_PACE_ATTACK: 'MIDDLE', T20_MID_PACE_DEFENSIVE: 'MIDDLE',
  T20_MID_SPIN_ATTACK: 'MIDDLE', T20_MID_SPIN_DEFENSIVE: 'MIDDLE',
  T20_MID_AGGRESSIVE_BATTER: 'MIDDLE', BALANCED_RING: 'MIDDLE',
  SPIN_TRAP_WEB: 'MIDDLE', SHORT_BALL_AMBUSH: 'MIDDLE',
  T20_DEATH_YORKER: 'DEATH', T20_DEATH_SLOWER_BALL: 'DEATH',
  T20_DEATH_SPIN: 'DEATH', T20_DEATH_LEFT_HAND: 'DEATH',
  T20_DEATH_LEG_SIDE_HEAVY: 'DEATH', DEATH_YORKER_SHIELD: 'DEATH',
};
const ODI_PHASE_MAP: Record<string, PhaseKey> = {
  ODI_PP_PACE: 'POWERPLAY', ODI_PP_LEFT_ARM_PACE: 'POWERPLAY',
  ODI_PP_SWING: 'POWERPLAY', ODI_PP_SPIN: 'POWERPLAY',
  ODI_PP_DEFENSIVE: 'POWERPLAY',
  ODI_MID_PACE_BALANCED: 'MIDDLE', ODI_MID_SPIN_ATTACK: 'MIDDLE',
  ODI_MID_BLOCK_HOLES: 'MIDDLE', ODI_MID_PARTNERSHIP_BREAKER: 'MIDDLE',
  ODI_MID_LEFT_HAND_BATTER: 'MIDDLE',
  ODI_DEATH_STANDARD: 'DEATH', ODI_DEATH_YORKER: 'DEATH',
  ODI_DEATH_SLOWER_BALL: 'DEATH', ODI_DEATH_AGGRESSIVE_BATTER: 'DEATH',
  ODI_DEATH_DEFENDING_TOTAL: 'DEATH',
};
const TEST_PHASE_MAP: Record<string, PhaseKey> = {
  TEST_NEW_BALL_PACE: 'NEW_BALL', TEST_NEW_BALL_LEFT_ARM: 'NEW_BALL',
  TEST_NEW_BALL_SWING: 'NEW_BALL', TEST_NEW_BALL_BOUNCY: 'NEW_BALL',
  TEST_NEW_BALL_OVERSEAS: 'NEW_BALL',
  TEST_SPIN_OFF_SPIN: 'SPIN', TEST_SPIN_LEFT_ARM: 'SPIN',
  TEST_SPIN_DRY_TURNING: 'SPIN', TEST_SPIN_LEFT_HAND: 'SPIN',
  TEST_SPIN_DEFENSIVE: 'SPIN',
  TEST_LATE_ATTACKING: 'LATE', TEST_LATE_DEFENSIVE: 'LATE',
  TEST_LATE_TAILENDERS: 'LATE', TEST_LATE_PROTECT_LEAD: 'LATE',
  TEST_LATE_FORCE_DECISION: 'LATE',
};

// ─── Formation library ────────────────────────────────────────────────────────

interface PhaseGroup { phase: PhaseKey; formations: Formation[]; }

function buildGroups(format: FormatTab, phaseMap: Record<string, PhaseKey>, phases: PhaseKey[]): PhaseGroup[] {
  const PRESETS = BowlerFieldStrategyEngine.PRESET_OVERLAYS;
  const groups: PhaseGroup[] = phases.map(phase => ({ phase, formations: [] }));
  const seen = new Set<string>();
  Object.entries(phaseMap).forEach(([key, phase]) => {
    const preset = PRESETS[key];
    if (!preset) return;
    const fid = djb2(format, key, preset.keys);
    if (seen.has(fid)) return;
    seen.add(fid);
    groups.find(g => g.phase === phase)?.formations.push({
      formationId: fid, key, name: preset.name, intent: preset.intent,
      positionKeys: preset.keys, format, phase,
    });
  });
  return groups;
}

const LIBRARY = {
  T20:  buildGroups('T20',  T20_PHASE_MAP,  ['POWERPLAY', 'MIDDLE', 'DEATH']),
  ODI:  buildGroups('ODI',  ODI_PHASE_MAP,  ['POWERPLAY', 'MIDDLE', 'DEATH']),
  TEST: buildGroups('TEST', TEST_PHASE_MAP, ['NEW_BALL',  'SPIN',   'LATE']),
};

// ─── AI Formation Selector ────────────────────────────────────────────────────
//
// Returns the preset key that best matches the current match situation.
// Pure function — no side-effects. Called every time match context changes.

interface AIFormationInput {
  format: FormatTab;
  over: number;
  isSpinner: boolean;
  isLeftHander: boolean;
  wickets: number;
  /** Partnership runs in this stand */
  partnershipRuns?: number;
  /** Batter ID for historical zone lookup */
  batterId?: string;
  /** 'Aggressive' | 'Defensive' | 'Balanced' */
  batterStyle?: string;
  /** Whether batting team is chasing and needs > 2 rpo above current rate */
  highRequiredRate?: boolean;
}

function getAIFormationKey(input: AIFormationInput): { key: string; reason: string } {
  const { format, over, isSpinner, isLeftHander, wickets, batterId } = input;

  // Look up historical batter tendency once
  const profile = batterId ? BatterScoringMemory.getBatterProfile(batterId) : null;
  const topBoundary = profile?.topBoundaryZones?.[0] ?? null;
  const isAggressiveBatter =
    (profile?.sampleSizeConfidence !== 'INSUFFICIENT' && (profile?.totalBoundaries ?? 0) > 5) ||
    input.batterStyle === 'Aggressive';

  // ── T20 / IPL ──────────────────────────────────────────────────────────────
  if (format === 'T20') {
    // POWERPLAY (overs 0-5)
    if (over < 6) {
      if (isSpinner) return { key: isLeftHander ? 'T20_PP_SPIN_LEFT' : 'T20_PP_SPIN_RIGHT', reason: 'Spin in powerplay — bat-pad ring' };
      if (over <= 1 && wickets === 0) return { key: 'T20_PP_LEFT_ARM_PACE', reason: 'Opening attack — maximum pressure' };
      return { key: 'T20_PP_PACE', reason: 'Powerplay pace attack with slip and ring' };
    }
    // DEATH (overs 15-19)
    if (over >= 15) {
      if (isSpinner) return { key: 'T20_DEATH_SPIN', reason: 'Spin death — straight boundary protection' };
      if (isLeftHander) return { key: 'T20_DEATH_LEFT_HAND', reason: 'Death vs left-hander — realigned boundary ropes' };
      if (isAggressiveBatter) return { key: 'T20_DEATH_SLOWER_BALL', reason: 'Slower ball plan vs power hitter' };
      return { key: 'T20_DEATH_YORKER', reason: 'Yorker plan — 5 deep boundary guards' };
    }
    // MIDDLE (overs 6-14)
    if (isSpinner) {
      if (wickets <= 2 && isAggressiveBatter) return { key: 'T20_MID_SPIN_ATTACK', reason: 'Spin attacking field — invite the big shot' };
      if (topBoundary === 'COW_CORNER' || topBoundary === 'MID_WICKET') return { key: 'T20_MID_AGGRESSIVE_BATTER', reason: "Cover leg-side zones (batter's hot zone)" };
      return { key: 'T20_MID_SPIN_DEFENSIVE', reason: 'Spin middle — 5 deep containing field' };
    }
    if (wickets >= 4) return { key: 'SHORT_BALL_AMBUSH', reason: 'Tail in — bouncer trap with deep square' };
    if (isAggressiveBatter) return { key: 'T20_MID_AGGRESSIVE_BATTER', reason: 'Plugging boundaries vs aggressive batter' };
    return { key: 'T20_MID_PACE_DEFENSIVE', reason: 'Middle-overs pace squeeze — 5 deep sentries' };
  }

  // ── ODI ────────────────────────────────────────────────────────────────────
  if (format === 'ODI') {
    if (over < 10) {
      if (isSpinner) return { key: 'ODI_PP_SPIN', reason: 'Spin in powerplay — ring choke' };
      if (wickets === 0 && over <= 2) return { key: 'ODI_PP_SWING', reason: 'New ball swing in powerplay' };
      return { key: 'ODI_PP_PACE', reason: 'Powerplay pace — 2 outside ring' };
    }
    if (over >= 40) {
      if (isAggressiveBatter) return { key: 'ODI_DEATH_AGGRESSIVE_BATTER', reason: 'All-out boundary protection vs power hitter' };
      if (input.highRequiredRate) return { key: 'ODI_DEATH_DEFENDING_TOTAL', reason: 'Defending total — squeeze required rate' };
      if (isSpinner) return { key: 'ODI_DEATH_SLOWER_BALL', reason: 'Slower ball death overs' };
      return { key: 'ODI_DEATH_YORKER', reason: 'Yorker plan at death' };
    }
    // Middle overs
    if (wickets >= 5) return { key: 'ODI_MID_PARTNERSHIP_BREAKER', reason: 'Partnership breaker — aggressive close catchers' };
    if (isLeftHander) return { key: 'ODI_MID_LEFT_HAND_BATTER', reason: 'Realigned field for left-hand batter' };
    if (isSpinner) return { key: 'ODI_MID_SPIN_ATTACK', reason: 'Spin attack — slip and short leg' };
    if ((input.partnershipRuns ?? 0) >= 60) return { key: 'ODI_MID_PARTNERSHIP_BREAKER', reason: 'Long partnership — force a mistake' };
    return { key: 'ODI_MID_PACE_BALANCED', reason: 'Balanced middle-overs field' };
  }

  // ── TEST ───────────────────────────────────────────────────────────────────
  if (isSpinner) {
    if (isLeftHander) return { key: 'TEST_SPIN_LEFT_HAND', reason: 'Off-spin into left-hander with bat-pad cordon' };
    if (wickets >= 7) return { key: 'TEST_LATE_TAILENDERS', reason: 'Tail — bouncer trap with helmet catchers' };
    return { key: 'TEST_SPIN_OFF_SPIN', reason: 'Off-spin bat-pad trap' };
  }
  if (over < 16) {
    if (over <= 5) return { key: 'TEST_NEW_BALL_SWING', reason: 'Brand new ball — heavy swing cordon' };
    return { key: 'TEST_NEW_BALL_PACE', reason: 'New ball pace — 3 slips and gully' };
  }
  if (wickets >= 7) return { key: 'TEST_LATE_TAILENDERS', reason: 'Tail attack — close catchers' };
  if ((input.partnershipRuns ?? 0) >= 80) return { key: 'TEST_LATE_FORCE_DECISION', reason: 'Force a decision — ultra-aggressive ring' };
  return { key: 'TEST_LATE_DEFENSIVE', reason: 'Contain settled partnership' };
}

// ─── Phase info metadata ─────────────────────────────────────────────────────

interface PhaseInfo {
  label: string; overs: string; maxOutside: number | null;
  dotColor: string; headerGradient: string; tabBadge: string;
}

const PHASE_INFO: Record<FormatTab, Partial<Record<PhaseKey, PhaseInfo>>> = {
  T20: {
    POWERPLAY: { label: 'Powerplay', overs: 'Overs 1–6', maxOutside: 2, dotColor: 'bg-blue-400', headerGradient: 'from-blue-950/80 to-blue-900/40', tabBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    MIDDLE:    { label: 'Middle Overs', overs: 'Overs 7–15', maxOutside: 5, dotColor: 'bg-indigo-400', headerGradient: 'from-indigo-950/80 to-indigo-900/40', tabBadge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
    DEATH:     { label: 'Death Overs', overs: 'Overs 16–20', maxOutside: 5, dotColor: 'bg-violet-400', headerGradient: 'from-violet-950/80 to-violet-900/40', tabBadge: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
  },
  ODI: {
    POWERPLAY: { label: 'Powerplay', overs: 'Overs 1–10', maxOutside: 2, dotColor: 'bg-sky-400', headerGradient: 'from-sky-950/80 to-sky-900/40', tabBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
    MIDDLE:    { label: 'Middle Overs', overs: 'Overs 11–40', maxOutside: 4, dotColor: 'bg-cyan-400', headerGradient: 'from-cyan-950/80 to-cyan-900/40', tabBadge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
    DEATH:     { label: 'Death Overs', overs: 'Overs 41–50', maxOutside: 5, dotColor: 'bg-teal-400', headerGradient: 'from-teal-950/80 to-teal-900/40', tabBadge: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  },
  TEST: {
    NEW_BALL: { label: 'New Ball Attack', overs: 'Overs 1–15', maxOutside: null, dotColor: 'bg-rose-400', headerGradient: 'from-rose-950/80 to-rose-900/40', tabBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    SPIN:     { label: 'Spin Attack', overs: 'Any Session', maxOutside: null, dotColor: 'bg-orange-400', headerGradient: 'from-orange-950/80 to-orange-900/40', tabBadge: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
    LATE:     { label: 'Wear & Tear', overs: 'Situation Based', maxOutside: null, dotColor: 'bg-red-400', headerGradient: 'from-red-950/80 to-red-900/40', tabBadge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  },
};

// ─── SVG Miniature Ground ─────────────────────────────────────────────────────

interface MiniGroundProps { positionKeys: string[]; size?: number; selected?: boolean; aiSelected?: boolean; }

function MiniGround({ positionKeys, size = 120, selected = false, aiSelected = false }: MiniGroundProps) {
  const h = Math.round(size * 0.95);
  const cx = size / 2, cy = h / 2;
  const bRx = cx * 0.90, bRy = cy * 0.90;
  const iRx = bRx * 0.60, iRy = bRy * 0.60;
  const toX = (x: number) => (x / 600) * size;
  const toY = (y: number) => (y / 600) * h;
  const dotR = Math.max(2.6, size * 0.023);
  const bigR = Math.max(3.0, size * 0.027);
  const ringColor = aiSelected ? '#a78bfa' : selected ? '#60a5fa' : '#4ade80';

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className="overflow-visible block" aria-hidden>
      <ellipse cx={cx} cy={cy} rx={bRx} ry={bRy} fill="#1a6b2f" stroke="#22c55e" strokeWidth={1.5} />
      <ellipse cx={cx} cy={cy} rx={iRx} ry={iRy} fill="none"
        stroke={ringColor} strokeWidth={0.8} strokeDasharray="3 2" opacity={0.7} />
      <rect x={toX(294)} y={toY(172)} width={toX(12)} height={toY(238)} rx={1}
        fill="#c4a35a" stroke="#a0784a" strokeWidth={0.6} />
      <line x1={toX(294) - 5} y1={toY(410)} x2={toX(294) + toX(12) + 5} y2={toY(410)}
        stroke="#fff" strokeWidth={0.9} opacity={0.9} />
      <line x1={toX(294) - 3} y1={toY(190)} x2={toX(294) + toX(12) + 3} y2={toY(190)}
        stroke="#fff" strokeWidth={0.6} opacity={0.65} />
      {[-2.5, 0, 2.5].map((o, i) => (
        <rect key={`sb${i}`} x={cx + toX(o) - 0.6} y={toY(410)} width={1.2} height={toY(10)} fill="#f9fafb" />
      ))}
      {[-2.5, 0, 2.5].map((o, i) => (
        <rect key={`sw${i}`} x={cx + toX(o) - 0.6} y={toY(182)} width={1.2} height={toY(10)} fill="#f9fafb" />
      ))}
      {positionKeys.map(key => {
        const pos: FieldPositionDef | undefined = CANONICAL_POSITIONS[key];
        if (!pos) return null;
        return (
          <circle key={key} cx={toX(pos.x)} cy={toY(pos.y)} r={dotR}
            fill={pos.isOutsideCircle ? '#f59e0b' : '#3b82f6'}
            stroke={pos.isOutsideCircle ? '#92400e' : '#1d4ed8'} strokeWidth={0.8} />
        );
      })}
      {(() => { const bp = CANONICAL_POSITIONS['BOWLER'];
        return <circle cx={toX(bp.x)} cy={toY(bp.y)} r={bigR} fill="#ef4444" stroke="#991b1b" strokeWidth={0.9} />;
      })()}
      {(() => { const kp = CANONICAL_POSITIONS['WICKETKEEPER'];
        return <circle cx={toX(kp.x)} cy={toY(kp.y)} r={bigR} fill="#a855f7" stroke="#6b21a8" strokeWidth={0.9} />;
      })()}
    </svg>
  );
}

// ─── Formation Card ───────────────────────────────────────────────────────────

interface FormationCardProps {
  formation: Formation;
  isSelected: boolean;
  isAISelected: boolean;
  isManualOverride: boolean;
  onSelect: (key: string) => void;
}

function FormationCard({ formation, isSelected, isAISelected, isManualOverride, onSelect }: FormationCardProps) {
  const outsideCount = formation.positionKeys.filter(k => CANONICAL_POSITIONS[k]?.isOutsideCircle).length;
  const highlight = isAISelected || isSelected;

  return (
    <button
      onClick={() => onSelect(formation.key)}
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border p-1.5 sm:p-2 w-full text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
        isAISelected && !isManualOverride
          ? 'border-violet-500 bg-violet-950/50 ring-2 ring-violet-500/40 shadow-lg shadow-violet-900/30'
          : isSelected
          ? 'border-blue-500 bg-blue-950/50 ring-2 ring-blue-500/30 shadow-lg shadow-blue-900/30'
          : 'border-slate-700/50 bg-slate-900/60 hover:border-slate-500/70 hover:bg-slate-800/60'
      )}
      title={formation.intent}
      aria-pressed={highlight}
      aria-label={formation.name}
    >
      <div className="relative w-full flex justify-center">
        <MiniGround
          positionKeys={formation.positionKeys}
          size={110}
          selected={isSelected && !isAISelected}
          aiSelected={isAISelected && !isManualOverride}
        />
        {isAISelected && !isManualOverride && (
          <span className="absolute top-0.5 left-0.5 flex items-center gap-0.5 text-[7px] font-black text-violet-100 bg-violet-600/90 px-1 py-0.5 rounded leading-none uppercase">
            <Cpu className="w-2 h-2" /> AI
          </span>
        )}
        {isSelected && isManualOverride && (
          <span className="absolute top-0.5 left-0.5 flex items-center gap-0.5 text-[7px] font-black text-blue-100 bg-blue-600/90 px-1 py-0.5 rounded leading-none uppercase">
            <User className="w-2 h-2" /> You
          </span>
        )}
      </div>
      <div className="w-full min-w-0 px-0.5">
        <p className={cn(
          'text-[9.5px] sm:text-[10px] font-bold leading-tight line-clamp-2 min-h-[2.5em]',
          isAISelected && !isManualOverride ? 'text-violet-200' :
          isSelected ? 'text-blue-200' : 'text-slate-200'
        )}>
          {formation.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className="text-[8px] text-amber-400 font-semibold">{outsideCount}×deep</span>
          <span className="text-slate-600 text-[8px]">·</span>
          <span className="text-[8px] text-blue-400 font-semibold">{formation.positionKeys.length - outsideCount}×ring</span>
        </div>
      </div>
    </button>
  );
}

// ─── Formation Detail Panel ───────────────────────────────────────────────────

function FormationDetailPanel({ presetKey, aiReason, onClose }: { presetKey: string; aiReason?: string; onClose: () => void }) {
  const preset = BowlerFieldStrategyEngine.PRESET_OVERLAYS[presetKey];
  if (!preset) return null;
  const outside = preset.keys.filter(k => CANONICAL_POSITIONS[k]?.isOutsideCircle).length;
  const allKeys = ['BOWLER', 'WICKETKEEPER', ...preset.keys];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden />
      <div className="fixed bottom-0 inset-x-0 sm:inset-auto sm:right-4 sm:bottom-4 sm:w-80 z-50
                      bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl
                      shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-700/60 shrink-0">
          <div className="min-w-0">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Formation Detail</p>
            <h3 className="text-sm font-black text-white leading-tight mt-0.5 pr-2">{preset.name}</h3>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white shrink-0 text-xs transition-colors">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <div className="flex justify-center">
            <MiniGround positionKeys={preset.keys} size={200} selected aiSelected />
          </div>

          {/* AI reason */}
          {aiReason && (
            <div className="flex items-start gap-2 bg-violet-950/50 border border-violet-700/40 rounded-lg px-3 py-2">
              <Cpu className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-violet-200 leading-snug">{aiReason}</p>
            </div>
          )}

          <p className="text-xs text-slate-300 leading-relaxed">{preset.intent}</p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { val: outside, label: 'Outside', color: 'text-amber-400' },
              { val: preset.keys.length - outside, label: 'Ring', color: 'text-blue-400' },
              { val: 11, label: 'Total', color: 'text-white' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800 rounded-lg p-2 text-center">
                <p className={cn('text-xl font-black', s.color)}>{s.val}</p>
                <p className="text-[9px] text-slate-400 uppercase font-semibold">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-1">All Positions</p>
            {allKeys.map((key, i) => {
              const pos = CANONICAL_POSITIONS[key];
              if (!pos) return null;
              const dc = key === 'BOWLER' ? 'bg-red-500' : key === 'WICKETKEEPER' ? 'bg-purple-500' :
                pos.isOutsideCircle ? 'bg-amber-400' : 'bg-blue-500';
              return (
                <div key={`${key}-${i}`} className="flex items-center gap-2 py-0.5">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dc)} />
                  <span className="text-[11px] text-slate-200 font-semibold flex-1">{pos.name}</span>
                  <span className="text-[9px] text-slate-500 text-right leading-tight max-w-[120px] truncate">{pos.tacticalRole}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {[
        { color: 'bg-red-500', label: 'Bowler' },
        { color: 'bg-purple-500', label: 'Wicketkeeper' },
        { color: 'bg-blue-500', label: 'Ring fielder' },
        { color: 'bg-amber-400', label: 'Boundary fielder' },
      ].map(item => (
        <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', item.color)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ─── Phase Column ─────────────────────────────────────────────────────────────

interface PhaseColumnProps {
  format: FormatTab;
  group: PhaseGroup;
  aiKey: string | null;
  selectedKey: string | null;
  isManualOverride: boolean;
  onSelect: (key: string) => void;
}

function PhaseColumn({ format, group, aiKey, selectedKey, isManualOverride, onSelect }: PhaseColumnProps) {
  const info = PHASE_INFO[format]?.[group.phase];
  if (!info) return null;

  return (
    <div className="flex flex-col rounded-xl border border-slate-700/50 overflow-hidden bg-slate-900/70">
      <div className={cn('px-4 py-3 bg-gradient-to-b', info.headerGradient, 'border-b border-slate-700/50')}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('w-2 h-2 rounded-full shrink-0', info.dotColor)} />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            {format === 'TEST' ? 'Test Cricket' : format === 'ODI' ? 'ODI' : 'T20 / IPL'}
          </span>
        </div>
        <h3 className="text-sm sm:text-base font-black text-white leading-none">{info.label}</h3>
        <div className={cn('inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold', info.tabBadge)}>
          <span>{info.overs}</span>
          {info.maxOutside !== null && (
            <><span className="opacity-40">·</span><span>Max {info.maxOutside} outside</span></>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 bg-slate-950/80">
        {group.formations.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {group.formations.map(f => (
              <FormationCard
                key={f.formationId}
                formation={f}
                isAISelected={f.key === aiKey}
                isSelected={f.key === selectedKey}
                isManualOverride={isManualOverride}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 text-slate-600 text-xs">No formations defined.</div>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-slate-800/60 bg-slate-900/60 flex items-center justify-between">
        <span className="text-[9px] text-slate-600 font-medium">
          {group.formations.length} formation{group.formations.length !== 1 ? 's' : ''}
        </span>
        {group.formations.some(f => f.key === aiKey) && (
          <span className="flex items-center gap-1 text-[9px] text-violet-400 font-black">
            <Cpu className="w-2.5 h-2.5" /> AI active
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export interface FieldSetupDashboardProps {
  currentFormat?: 'T20' | 'ODI' | 'TEST' | 'IPL';
  currentOver?: number;
  currentBall?: number;
  fieldSettled?: boolean;
  teamA?: string;
  teamB?: string;
  /** Live match context for richer AI decisions */
  liveContext?: {
    isSpinner?: boolean;
    isLeftHander?: boolean;
    wickets?: number;
    partnershipRuns?: number;
    batterId?: string;
    batterStyle?: string;
    highRequiredRate?: boolean;
    bowlerName?: string;
    batterName?: string;
  };
  onFormationSelect?: (presetKey: string, format: FormatTab) => void;
}

export default function FieldSetupDashboard({
  currentFormat,
  currentOver = 0,
  currentBall = 0,
  fieldSettled = false,
  teamA,
  teamB = 'Opponent',
  liveContext,
  onFormationSelect,
}: FieldSetupDashboardProps) {
  // Pull from game store for live match context when not provided as props
  const { selectedFormat, liveMatchState, franchises, selectedFranchiseId } = useGameStore();

  const userTeam  = franchises.find(f => f.id === selectedFranchiseId);
  const teamAName = teamA ?? userTeam?.shortName ?? userTeam?.name ?? 'Team A';

  // Resolve format for tab
  const resolvedFormat = currentFormat ?? selectedFormat ?? 'T20';
  const initTab: FormatTab =
    resolvedFormat === 'IPL' ? 'T20' :
    resolvedFormat === 'TEST' ? 'TEST' :
    resolvedFormat === 'ODI' ? 'ODI' : 'T20';

  const [activeFormat, setActiveFormat] = useState<FormatTab>(initTab);

  // --- AI auto-selection state ---
  const [aiKey,      setAiKey]      = useState<string | null>(null);
  const [aiReason,   setAiReason]   = useState<string>('');
  // Human override: once the user manually clicks, we remember their pick
  // but still track which key the AI would choose
  const [manualKey,  setManualKey]  = useState<string | null>(null);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [detailKey,  setDetailKey]  = useState<string | null>(null);

  // Derive live context from store when not explicitly passed
  const resolvedCtx = useMemo(() => {
    const ls = liveMatchState ?? {};
    return {
      isSpinner:       liveContext?.isSpinner       ?? ls.currentBowlerIsSpin ?? false,
      isLeftHander:    liveContext?.isLeftHander     ?? ls.strikerIsLeftHand   ?? false,
      wickets:         liveContext?.wickets          ?? ls.wickets              ?? 0,
      partnershipRuns: liveContext?.partnershipRuns  ?? ls.partnershipRuns      ?? 0,
      batterId:        liveContext?.batterId         ?? ls.strikerId             ?? undefined,
      batterStyle:     liveContext?.batterStyle      ?? ls.strikerStyle          ?? undefined,
      highRequiredRate:liveContext?.highRequiredRate ?? (ls.requiredRate && ls.currentRunRate && ls.requiredRate > ls.currentRunRate + 2) ?? false,
      bowlerName:      liveContext?.bowlerName       ?? ls.currentBowlerName     ?? undefined,
      batterName:      liveContext?.batterName       ?? ls.strikerName           ?? undefined,
    };
  }, [liveContext, liveMatchState]);

  // ── AI auto-selection effect ──
  // Recalculates whenever format, over, or live context changes.
  // Resets manual override when phase shifts.
  useEffect(() => {
    const result = getAIFormationKey({
      format: activeFormat,
      over: currentOver,
      isSpinner:        resolvedCtx.isSpinner,
      isLeftHander:     resolvedCtx.isLeftHander,
      wickets:          resolvedCtx.wickets,
      partnershipRuns:  resolvedCtx.partnershipRuns,
      batterId:         resolvedCtx.batterId,
      batterStyle:      resolvedCtx.batterStyle,
      highRequiredRate: resolvedCtx.highRequiredRate,
    });

    // If AI picked a different key, clear any stale manual override
    if (result.key !== aiKey) {
      setIsManualOverride(false);
      setManualKey(null);
    }

    setAiKey(result.key);
    setAiReason(result.reason);

    // Automatically report AI's selection to parent if not manually overridden
    if (result.key && onFormationSelect) {
      onFormationSelect(result.key, activeFormat);
    }
  }, [activeFormat, currentOver, resolvedCtx.isSpinner, resolvedCtx.isLeftHander,
      resolvedCtx.wickets, resolvedCtx.batterId, onFormationSelect]);

  // ── User selects a formation manually ──
  const handleSelect = (key: string) => {
    if (key === aiKey && !isManualOverride) {
      // Clicking the AI-selected card opens detail only
      setDetailKey(key);
      return;
    }
    setManualKey(key);
    setIsManualOverride(true);
    setDetailKey(key);
    onFormationSelect?.(key, activeFormat);
  };

  // ── Reset to AI ──
  const resetToAI = () => {
    setIsManualOverride(false);
    setManualKey(null);
    if (aiKey) {
      setDetailKey(aiKey);
      onFormationSelect?.(aiKey, activeFormat);
    }
  };

  // Active displayed key (manual override wins, else AI)
  const activeKey = isManualOverride ? manualKey : aiKey;

  const groups = LIBRARY[activeFormat];

  const overLabel  = `${currentOver}.${currentBall}`;
  const phaseLabel = useMemo(() => {
    if (activeFormat === 'T20') {
      if (currentOver < 6)  return 'Powerplay';
      if (currentOver < 15) return 'Middle Overs';
      return 'Death Overs';
    }
    if (activeFormat === 'ODI') {
      if (currentOver < 10) return 'Powerplay';
      if (currentOver < 40) return 'Middle Overs';
      return 'Death Overs';
    }
    return 'In Session';
  }, [activeFormat, currentOver]);

  const FORMAT_TABS = [
    { id: 'T20' as FormatTab,  label: 'T20',  activeClass: 'bg-blue-600 text-white' },
    { id: 'ODI' as FormatTab,  label: 'ODI',  activeClass: 'bg-sky-600 text-white' },
    { id: 'TEST' as FormatTab, label: 'TEST', activeClass: 'bg-rose-700 text-white' },
  ];

  const activePreset = activeKey ? BowlerFieldStrategyEngine.PRESET_OVERLAYS[activeKey] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* ── HEADER ── */}
      <div className="shrink-0 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">

            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-900/50">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-none">FIELD SETUP</h1>
                <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest">AI Formation Library</p>
              </div>
            </div>

            {/* Format tabs */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700/60 rounded-lg p-1 sm:ml-4 w-fit">
              {FORMAT_TABS.map(tab => (
                <button key={tab.id} onClick={() => { setActiveFormat(tab.id); setIsManualOverride(false); setManualKey(null); }}
                  className={cn(
                    'px-4 py-1.5 text-xs font-black uppercase tracking-wide rounded-md transition-all duration-150 min-w-[48px]',
                    activeFormat === tab.id ? tab.activeClass : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
                  )}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Match info */}
            <div className="sm:ml-auto flex flex-wrap items-center gap-2 text-[11px]">
              {resolvedCtx.batterName && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                  🏏 {resolvedCtx.batterName}
                </span>
              )}
              {resolvedCtx.bowlerName && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                  ⚡ {resolvedCtx.bowlerName}
                </span>
              )}
              <span className="font-black text-slate-200 text-xs">{teamAName} <span className="text-slate-500 font-medium">vs</span> {teamB}</span>
              {(currentOver > 0 || currentBall > 0) && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                  Over {overLabel} · {phaseLabel}
                </span>
              )}
              <span className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border',
                fieldSettled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              )}>
                {fieldSettled ? '● FIELD SETTLED' : '○ FIELD NOT SET'}
              </span>
            </div>
          </div>

          {/* AI selection bar */}
          {aiKey && (
            <div className="pb-3">
              <div className={cn(
                'flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 rounded-lg border text-[11px]',
                isManualOverride
                  ? 'bg-blue-950/30 border-blue-700/40'
                  : 'bg-violet-950/40 border-violet-700/40'
              )}>
                <div className="flex items-center gap-2 shrink-0">
                  <Cpu className={cn('w-3.5 h-3.5', isManualOverride ? 'text-slate-500' : 'text-violet-400')} />
                  <span className={cn('font-black uppercase tracking-widest text-[9px]', isManualOverride ? 'text-slate-500' : 'text-violet-400')}>
                    AI Recommendation
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className={cn('font-bold', isManualOverride ? 'text-slate-400 line-through' : 'text-violet-200')}>
                    {BowlerFieldStrategyEngine.PRESET_OVERLAYS[aiKey]?.name}
                  </span>
                  <span className={cn('ml-2 text-[10px]', isManualOverride ? 'text-slate-600' : 'text-slate-400')}>
                    — {aiReason}
                  </span>
                </div>
                {isManualOverride && (
                  <button onClick={resetToAI}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-700/50 hover:bg-violet-600/60 border border-violet-600/40 text-violet-200 text-[10px] font-black uppercase tracking-wide transition-colors">
                    <Cpu className="w-2.5 h-2.5" /> Reset to AI
                  </button>
                )}
                {!isManualOverride && (
                  <span className="shrink-0 flex items-center gap-1 text-[9px] text-emerald-300 font-black">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Auto-selected
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── LEGEND ── */}
      <div className="shrink-0 bg-slate-900/50 border-b border-slate-800/40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Legend />
            <div className="flex items-center gap-3 text-[9px]">
              <span className="flex items-center gap-1 text-violet-400">
                <span className="w-2 h-2 rounded bg-violet-600 flex items-center justify-center">
                  <Cpu className="w-1.5 h-1.5 text-white" />
                </span>
                AI picked
              </span>
              <span className="flex items-center gap-1 text-blue-400">
                <span className="w-2 h-2 rounded bg-blue-600 flex items-center justify-center">
                  <User className="w-1.5 h-1.5 text-white" />
                </span>
                Your pick
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FORMATION COLUMNS ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <PhaseColumn
                key={group.phase}
                format={activeFormat}
                group={group}
                aiKey={aiKey}
                selectedKey={activeKey}
                isManualOverride={isManualOverride}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {/* Active formation summary bar */}
          {activePreset && (
            <div className={cn(
              'mt-4 rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4',
              isManualOverride
                ? 'bg-blue-950/30 border-blue-700/40'
                : 'bg-violet-950/30 border-violet-700/40'
            )}>
              <div className="flex items-center gap-2">
                {isManualOverride
                  ? <User className="w-3.5 h-3.5 text-blue-400" />
                  : <Cpu className="w-3.5 h-3.5 text-violet-400 animate-pulse" />}
                <span className={cn('text-[10px] font-black uppercase tracking-widest', isManualOverride ? 'text-blue-400' : 'text-violet-400')}>
                  {isManualOverride ? 'Manual Formation' : 'AI Formation'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate">{activePreset.name}</p>
                <p className="text-[10px] text-slate-400 line-clamp-1">{activePreset.intent}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {(() => {
                  const out = activePreset.keys.filter(k => CANONICAL_POSITIONS[k]?.isOutsideCircle).length;
                  return (
                    <>
                      <span className="text-[10px] text-amber-400 font-bold">{out}×deep</span>
                      <span className="text-[10px] text-blue-400 font-bold">{activePreset.keys.length - out}×ring</span>
                    </>
                  );
                })()}
                <button onClick={() => setDetailKey(activeKey)}
                  className="px-3 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600 text-slate-200 text-[10px] font-black uppercase tracking-wide transition-colors">
                  Details
                </button>
                {isManualOverride && (
                  <button onClick={resetToAI}
                    className="px-3 py-1 rounded-lg bg-violet-700/50 hover:bg-violet-600/60 border border-violet-600/40 text-violet-200 text-[10px] font-black uppercase tracking-wide transition-colors flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5" /> AI
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {detailKey && (
        <FormationDetailPanel
          presetKey={detailKey}
          aiReason={detailKey === aiKey ? aiReason : undefined}
          onClose={() => setDetailKey(null)}
        />
      )}
    </div>
  );
}
