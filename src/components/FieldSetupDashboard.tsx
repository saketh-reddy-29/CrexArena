/**
 * FieldSetupDashboard.tsx
 *
 * Interactive Field Setup dashboard — Cricket Arena.
 * Renders real miniature 2D grounds from PRESET_OVERLAYS + CANONICAL_POSITIONS.
 * 3-column phase layout: Powerplay / Middle / Death (T20/ODI) and
 * New Ball / Spin / Wear & Tear (Test).
 * Formation deduplication via deterministic djb2 fingerprint.
 * Fully mobile-responsive.
 */

import React, { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import {
  BowlerFieldStrategyEngine,
  CANONICAL_POSITIONS,
  type FieldPositionDef,
} from '../engine/strategy/BowlerFieldStrategyEngine';
import { cn } from '../lib/utils';

// ─── Format / Phase Types ─────────────────────────────────────────────────────

type FormatTab = 'T20' | 'ODI' | 'TEST';
type PhaseKey = 'POWERPLAY' | 'MIDDLE' | 'DEATH' | 'NEW_BALL' | 'SPIN' | 'LATE';

// ─── Formation descriptor ─────────────────────────────────────────────────────

interface Formation {
  /** Stable deduplication fingerprint (djb2 of format+key+sortedPositions) */
  formationId: string;
  key: string;
  name: string;
  intent: string;
  positionKeys: string[];
  format: FormatTab;
  phase: PhaseKey;
}

// ─── Deterministic formation fingerprint (djb2) ───────────────────────────────

function deriveFormationId(format: string, key: string, positionKeys: string[]): string {
  const raw = `${format}:${key}:${[...positionKeys].sort().join(',')}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = (((h << 5) + h) ^ raw.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

// ─── Preset → phase mapping ───────────────────────────────────────────────────

const T20_PHASE_MAP: Record<string, PhaseKey> = {
  T20_PP_PACE: 'POWERPLAY',
  T20_PP_LEFT_ARM_PACE: 'POWERPLAY',
  T20_PP_SPIN_RIGHT: 'POWERPLAY',
  T20_PP_SPIN_LEFT: 'POWERPLAY',
  T20_PP_DEFENSIVE: 'POWERPLAY',
  ATTACKING_SLIP_CORDON: 'POWERPLAY',
  T20_MID_PACE_ATTACK: 'MIDDLE',
  T20_MID_PACE_DEFENSIVE: 'MIDDLE',
  T20_MID_SPIN_ATTACK: 'MIDDLE',
  T20_MID_SPIN_DEFENSIVE: 'MIDDLE',
  T20_MID_AGGRESSIVE_BATTER: 'MIDDLE',
  BALANCED_RING: 'MIDDLE',
  SPIN_TRAP_WEB: 'MIDDLE',
  SHORT_BALL_AMBUSH: 'MIDDLE',
  T20_DEATH_YORKER: 'DEATH',
  T20_DEATH_SLOWER_BALL: 'DEATH',
  T20_DEATH_SPIN: 'DEATH',
  T20_DEATH_LEFT_HAND: 'DEATH',
  T20_DEATH_LEG_SIDE_HEAVY: 'DEATH',
  DEATH_YORKER_SHIELD: 'DEATH',
};

const ODI_PHASE_MAP: Record<string, PhaseKey> = {
  ODI_PP_PACE: 'POWERPLAY',
  ODI_PP_LEFT_ARM_PACE: 'POWERPLAY',
  ODI_PP_SWING: 'POWERPLAY',
  ODI_PP_SPIN: 'POWERPLAY',
  ODI_PP_DEFENSIVE: 'POWERPLAY',
  ODI_MID_PACE_BALANCED: 'MIDDLE',
  ODI_MID_SPIN_ATTACK: 'MIDDLE',
  ODI_MID_BLOCK_HOLES: 'MIDDLE',
  ODI_MID_PARTNERSHIP_BREAKER: 'MIDDLE',
  ODI_MID_LEFT_HAND_BATTER: 'MIDDLE',
  ODI_DEATH_STANDARD: 'DEATH',
  ODI_DEATH_YORKER: 'DEATH',
  ODI_DEATH_SLOWER_BALL: 'DEATH',
  ODI_DEATH_AGGRESSIVE_BATTER: 'DEATH',
  ODI_DEATH_DEFENDING_TOTAL: 'DEATH',
};

const TEST_PHASE_MAP: Record<string, PhaseKey> = {
  TEST_NEW_BALL_PACE: 'NEW_BALL',
  TEST_NEW_BALL_LEFT_ARM: 'NEW_BALL',
  TEST_NEW_BALL_SWING: 'NEW_BALL',
  TEST_NEW_BALL_BOUNCY: 'NEW_BALL',
  TEST_NEW_BALL_OVERSEAS: 'NEW_BALL',
  TEST_SPIN_OFF_SPIN: 'SPIN',
  TEST_SPIN_LEFT_ARM: 'SPIN',
  TEST_SPIN_DRY_TURNING: 'SPIN',
  TEST_SPIN_LEFT_HAND: 'SPIN',
  TEST_SPIN_DEFENSIVE: 'SPIN',
  TEST_LATE_ATTACKING: 'LATE',
  TEST_LATE_DEFENSIVE: 'LATE',
  TEST_LATE_TAILENDERS: 'LATE',
  TEST_LATE_PROTECT_LEAD: 'LATE',
  TEST_LATE_FORCE_DECISION: 'LATE',
};

// ─── Build formation library once ────────────────────────────────────────────

interface PhaseGroup {
  phase: PhaseKey;
  formations: Formation[];
}

function buildGroups(format: FormatTab, phaseMap: Record<string, PhaseKey>, phases: PhaseKey[]): PhaseGroup[] {
  const PRESETS = BowlerFieldStrategyEngine.PRESET_OVERLAYS;
  const groups: PhaseGroup[] = phases.map(phase => ({ phase, formations: [] }));
  // Deduplicate by formationId within format
  const seenIds = new Set<string>();
  Object.entries(phaseMap).forEach(([key, phase]) => {
    const preset = PRESETS[key];
    if (!preset) return;
    const fid = deriveFormationId(format, key, preset.keys);
    if (seenIds.has(fid)) return;
    seenIds.add(fid);
    const group = groups.find(g => g.phase === phase);
    if (group) {
      group.formations.push({
        formationId: fid,
        key,
        name: preset.name,
        intent: preset.intent,
        positionKeys: preset.keys,
        format,
        phase,
      });
    }
  });
  return groups;
}

const LIBRARY = {
  T20: buildGroups('T20', T20_PHASE_MAP, ['POWERPLAY', 'MIDDLE', 'DEATH']),
  ODI: buildGroups('ODI', ODI_PHASE_MAP, ['POWERPLAY', 'MIDDLE', 'DEATH']),
  TEST: buildGroups('TEST', TEST_PHASE_MAP, ['NEW_BALL', 'SPIN', 'LATE']),
};

// ─── Phase metadata ───────────────────────────────────────────────────────────

interface PhaseInfo {
  label: string;
  overs: string;
  maxOutside: number | null;
  dotColor: string;
  headerGradient: string;
  tabActive: string;
  tabBadge: string;
}

const PHASE_INFO: Record<FormatTab, Record<PhaseKey, PhaseInfo>> = {
  T20: {
    POWERPLAY: { label: 'Powerplay', overs: 'Overs 1–6', maxOutside: 2, dotColor: 'bg-blue-400', headerGradient: 'from-blue-950/80 to-blue-900/40', tabActive: 'bg-blue-600 text-white', tabBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    MIDDLE:    { label: 'Middle Overs', overs: 'Overs 7–15', maxOutside: 5, dotColor: 'bg-indigo-400', headerGradient: 'from-indigo-950/80 to-indigo-900/40', tabActive: 'bg-indigo-600 text-white', tabBadge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
    DEATH:     { label: 'Death Overs', overs: 'Overs 16–20', maxOutside: 5, dotColor: 'bg-violet-400', headerGradient: 'from-violet-950/80 to-violet-900/40', tabActive: 'bg-violet-700 text-white', tabBadge: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
    NEW_BALL: { label: '', overs: '', maxOutside: null, dotColor: '', headerGradient: '', tabActive: '', tabBadge: '' },
    SPIN:     { label: '', overs: '', maxOutside: null, dotColor: '', headerGradient: '', tabActive: '', tabBadge: '' },
    LATE:     { label: '', overs: '', maxOutside: null, dotColor: '', headerGradient: '', tabActive: '', tabBadge: '' },
  },
  ODI: {
    POWERPLAY: { label: 'Powerplay', overs: 'Overs 1–10', maxOutside: 2, dotColor: 'bg-sky-400', headerGradient: 'from-sky-950/80 to-sky-900/40', tabActive: 'bg-sky-600 text-white', tabBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
    MIDDLE:    { label: 'Middle Overs', overs: 'Overs 11–40', maxOutside: 4, dotColor: 'bg-cyan-400', headerGradient: 'from-cyan-950/80 to-cyan-900/40', tabActive: 'bg-cyan-600 text-white', tabBadge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
    DEATH:     { label: 'Death Overs', overs: 'Overs 41–50', maxOutside: 5, dotColor: 'bg-teal-400', headerGradient: 'from-teal-950/80 to-teal-900/40', tabActive: 'bg-teal-700 text-white', tabBadge: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
    NEW_BALL: { label: '', overs: '', maxOutside: null, dotColor: '', headerGradient: '', tabActive: '', tabBadge: '' },
    SPIN:     { label: '', overs: '', maxOutside: null, dotColor: '', headerGradient: '', tabActive: '', tabBadge: '' },
    LATE:     { label: '', overs: '', maxOutside: null, dotColor: '', headerGradient: '', tabActive: '', tabBadge: '' },
  },
  TEST: {
    POWERPLAY: { label: '', overs: '', maxOutside: null, dotColor: '', headerGradient: '', tabActive: '', tabBadge: '' },
    MIDDLE:    { label: '', overs: '', maxOutside: null, dotColor: '', headerGradient: '', tabActive: '', tabBadge: '' },
    DEATH:     { label: '', overs: '', maxOutside: null, dotColor: '', headerGradient: '', tabActive: '', tabBadge: '' },
    NEW_BALL: { label: 'New Ball Attack', overs: 'Overs 1–15', maxOutside: null, dotColor: 'bg-rose-400', headerGradient: 'from-rose-950/80 to-rose-900/40', tabActive: 'bg-rose-600 text-white', tabBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    SPIN:     { label: 'Spin Attack', overs: 'Any Session', maxOutside: null, dotColor: 'bg-orange-400', headerGradient: 'from-orange-950/80 to-orange-900/40', tabActive: 'bg-orange-600 text-white', tabBadge: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
    LATE:     { label: 'Wear & Tear', overs: 'Situation Based', maxOutside: null, dotColor: 'bg-red-400', headerGradient: 'from-red-950/80 to-red-900/40', tabActive: 'bg-red-700 text-white', tabBadge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  },
};

// ─── SVG Miniature Ground ─────────────────────────────────────────────────────

interface MiniGroundProps {
  positionKeys: string[];
  size?: number;
  selected?: boolean;
}

function MiniGround({ positionKeys, size = 128, selected = false }: MiniGroundProps) {
  // Ground coordinate space: 600 × 600; batter crease = (300, 410)
  const h = Math.round(size * 0.95);
  const cx = size / 2;
  const cy = h / 2;
  const bRx = cx * 0.90;
  const bRy = cy * 0.90;
  const iRx = bRx * 0.60;
  const iRy = bRy * 0.60;

  const toX = (x: number) => (x / 600) * size;
  const toY = (y: number) => (y / 600) * h;

  const pitchX  = toX(294);
  const pitchW  = toX(12);
  const pitchY  = toY(172);
  const pitchH  = toY(238);

  const dotR   = Math.max(2.8, size * 0.023);
  const bigR   = Math.max(3.2, size * 0.027);

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className="overflow-visible block" aria-hidden>
      {/* Outfield */}
      <ellipse cx={cx} cy={cy} rx={bRx} ry={bRy} fill="#1a6b2f" stroke="#22c55e" strokeWidth={1.5} />
      {/* Restriction circle */}
      <ellipse cx={cx} cy={cy} rx={iRx} ry={iRy} fill="none"
        stroke={selected ? '#60a5fa' : '#4ade80'}
        strokeWidth={0.7} strokeDasharray="3 2" opacity={0.65} />
      {/* Pitch */}
      <rect x={pitchX} y={pitchY} width={pitchW} height={pitchH} rx={1}
        fill="#c4a35a" stroke="#a0784a" strokeWidth={0.6} />
      {/* Batting crease */}
      <line x1={pitchX - 5} y1={toY(410)} x2={pitchX + pitchW + 5} y2={toY(410)}
        stroke="#ffffff" strokeWidth={0.9} opacity={0.9} />
      {/* Bowling crease */}
      <line x1={pitchX - 3} y1={toY(190)} x2={pitchX + pitchW + 3} y2={toY(190)}
        stroke="#ffffff" strokeWidth={0.6} opacity={0.65} />
      {/* Stumps – batting end */}
      {[-2.5, 0, 2.5].map((o, i) => (
        <rect key={`sb${i}`} x={cx + toX(o) - 0.6} y={toY(410)} width={1.2} height={toY(10)}
          fill="#f9fafb" />
      ))}
      {/* Stumps – bowling end */}
      {[-2.5, 0, 2.5].map((o, i) => (
        <rect key={`sw${i}`} x={cx + toX(o) - 0.6} y={toY(182)} width={1.2} height={toY(10)}
          fill="#f9fafb" />
      ))}

      {/* Fielder dots (9 outfielders from positionKeys) */}
      {positionKeys.map(key => {
        const pos: FieldPositionDef | undefined = CANONICAL_POSITIONS[key];
        if (!pos) return null;
        return (
          <circle key={key}
            cx={toX(pos.x)} cy={toY(pos.y)} r={dotR}
            fill={pos.isOutsideCircle ? '#f59e0b' : '#3b82f6'}
            stroke={pos.isOutsideCircle ? '#92400e' : '#1d4ed8'}
            strokeWidth={0.8}
          />
        );
      })}

      {/* Bowler (red) */}
      {(() => {
        const bp = CANONICAL_POSITIONS['BOWLER'];
        return <circle cx={toX(bp.x)} cy={toY(bp.y)} r={bigR}
          fill="#ef4444" stroke="#991b1b" strokeWidth={0.9} />;
      })()}
      {/* Wicketkeeper (purple) */}
      {(() => {
        const kp = CANONICAL_POSITIONS['WICKETKEEPER'];
        return <circle cx={toX(kp.x)} cy={toY(kp.y)} r={bigR}
          fill="#a855f7" stroke="#6b21a8" strokeWidth={0.9} />;
      })()}
    </svg>
  );
}

// ─── Formation Card ───────────────────────────────────────────────────────────

interface FormationCardProps {
  formation: Formation;
  isSelected: boolean;
  onSelect: (key: string) => void;
}

function FormationCard({ formation, isSelected, onSelect }: FormationCardProps) {
  const outsideCount = formation.positionKeys.filter(k => CANONICAL_POSITIONS[k]?.isOutsideCircle).length;

  return (
    <button
      onClick={() => onSelect(formation.key)}
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border p-1.5 sm:p-2 w-full text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        isSelected
          ? 'border-blue-500 bg-blue-950/50 ring-2 ring-blue-500/30 shadow-lg shadow-blue-900/30'
          : 'border-slate-700/50 bg-slate-900/60 hover:border-slate-500/70 hover:bg-slate-800/60'
      )}
      title={formation.intent}
      aria-pressed={isSelected}
      aria-label={formation.name}
    >
      {/* Ground preview */}
      <div className="relative w-full flex justify-center">
        <MiniGround positionKeys={formation.positionKeys} size={112} selected={isSelected} />
        {isSelected && (
          <span className="absolute top-0.5 right-0.5 text-[7px] font-black text-blue-200 bg-blue-700/90 px-1 py-0.5 rounded leading-none uppercase">
            ✓ Active
          </span>
        )}
      </div>

      {/* Name + stats */}
      <div className="w-full min-w-0 px-0.5">
        <p className={cn(
          'text-[9.5px] sm:text-[10px] font-bold leading-tight line-clamp-2 min-h-[2.5em]',
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

// ─── Detail Side-Panel ────────────────────────────────────────────────────────

function FormationDetailPanel({ presetKey, onClose }: { presetKey: string; onClose: () => void }) {
  const PRESETS = BowlerFieldStrategyEngine.PRESET_OVERLAYS;
  const preset = PRESETS[presetKey];
  if (!preset) return null;

  const outsideCount = preset.keys.filter(k => CANONICAL_POSITIONS[k]?.isOutsideCircle).length;
  const ringCount    = preset.keys.length - outsideCount;
  const allKeys      = ['BOWLER', 'WICKETKEEPER', ...preset.keys];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden />
      {/* Panel */}
      <div className="fixed bottom-0 inset-x-0 sm:inset-auto sm:right-4 sm:bottom-4 sm:w-80 z-50
                      bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl
                      shadow-2xl shadow-black/60 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
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
          {/* Large ground preview */}
          <div className="flex justify-center">
            <MiniGround positionKeys={preset.keys} size={200} selected />
          </div>

          {/* Intent */}
          <p className="text-xs text-slate-300 leading-relaxed">{preset.intent}</p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: outsideCount, label: 'Outside', color: 'text-amber-400' },
              { val: ringCount,    label: 'Ring',    color: 'text-blue-400' },
              { val: 11,           label: 'Total',   color: 'text-white' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800 rounded-lg p-2 text-center">
                <p className={cn('text-xl font-black', s.color)}>{s.val}</p>
                <p className="text-[9px] text-slate-400 uppercase font-semibold">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Position list */}
          <div className="space-y-1">
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-1">Players & Positions</p>
            {allKeys.map((key, i) => {
              const pos = CANONICAL_POSITIONS[key];
              if (!pos) return null;
              const dotColor =
                key === 'BOWLER' ? 'bg-red-500' :
                key === 'WICKETKEEPER' ? 'bg-purple-500' :
                pos.isOutsideCircle ? 'bg-amber-400' : 'bg-blue-500';
              return (
                <div key={`${key}-${i}`} className="flex items-center gap-2 py-0.5">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotColor)} />
                  <span className="text-[11px] text-slate-200 font-semibold flex-1">{pos.name}</span>
                  <span className="text-[9px] text-slate-500 text-right leading-tight max-w-[120px] truncate">
                    {pos.tacticalRole}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Ground Legend ────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: 'bg-red-500', label: 'Bowler' },
    { color: 'bg-purple-500', label: 'Wicketkeeper' },
    { color: 'bg-blue-500', label: 'Ring fielder' },
    { color: 'bg-amber-400', label: 'Boundary fielder' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', item.color)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ─── Phase column (one of three per format) ───────────────────────────────────

interface PhaseColumnProps {
  format: FormatTab;
  group: PhaseGroup;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  columnIndex: number;
}

function PhaseColumn({ format, group, selectedKey, onSelect, columnIndex }: PhaseColumnProps) {
  const info = PHASE_INFO[format]?.[group.phase];
  if (!info || !info.label) return null;

  return (
    <div className="flex flex-col rounded-xl border border-slate-700/50 overflow-hidden bg-slate-900/70">
      {/* Column header */}
      <div className={cn('px-4 py-3 bg-gradient-to-b', info.headerGradient, 'border-b border-slate-700/50')}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('w-2 h-2 rounded-full shrink-0', info.dotColor)} />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            {format === 'TEST' ? 'Test Cricket' : format === 'ODI' ? 'ODI' : 'T20 / IPL'}
          </span>
        </div>
        <h3 className="text-sm sm:text-base font-black text-white leading-none">{info.label}</h3>
        <div className={cn(
          'inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold',
          info.tabBadge
        )}>
          <span>{info.overs}</span>
          {info.maxOutside !== null && (
            <><span className="opacity-40">·</span><span>Max {info.maxOutside} outside</span></>
          )}
        </div>
      </div>

      {/* Formation grid */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3">
        {group.formations.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {group.formations.map(f => (
              <FormationCard
                key={f.formationId}
                formation={f}
                isSelected={selectedKey === f.key}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 text-slate-600 text-xs">
            No formations defined.
          </div>
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-1.5 border-t border-slate-800/60 bg-slate-950/50 flex items-center justify-between">
        <span className="text-[9px] text-slate-600 font-medium">
          {group.formations.length} formation{group.formations.length !== 1 ? 's' : ''}
        </span>
        {group.formations.some(f => f.key === selectedKey) && (
          <span className="text-[9px] text-emerald-400 font-black">✓ Selected</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export interface FieldSetupDashboardProps {
  /** Current match format — pre-selects the correct format tab (IPL maps to T20) */
  currentFormat?: 'T20' | 'ODI' | 'TEST' | 'IPL';
  /** 0-indexed current over */
  currentOver?: number;
  /** Balls in current over */
  currentBall?: number;
  /** Field-settled status from the match engine */
  fieldSettled?: boolean;
  teamA?: string;
  teamB?: string;
  /** Called when user picks a formation */
  onFormationSelect?: (presetKey: string, format: FormatTab) => void;
}

export default function FieldSetupDashboard({
  currentFormat,
  currentOver = 0,
  currentBall = 0,
  fieldSettled = false,
  teamA = 'Team A',
  teamB = 'Team B',
  onFormationSelect,
}: FieldSetupDashboardProps) {
  const initTab: FormatTab =
    !currentFormat ? 'T20'
    : currentFormat === 'IPL' ? 'T20'
    : currentFormat === 'TEST' ? 'TEST'
    : currentFormat === 'ODI' ? 'ODI'
    : 'T20';

  const [activeFormat, setActiveFormat] = useState<FormatTab>(initTab);
  const [selectedKey, setSelectedKey]   = useState<string | null>(null);
  const [detailKey,   setDetailKey]     = useState<string | null>(null);

  const handleSelect = (key: string) => {
    setSelectedKey(prev => (prev === key ? null : key));
    setDetailKey(key);
    onFormationSelect?.(key, activeFormat);
  };

  const groups = LIBRARY[activeFormat];

  const overLabel = `${currentOver}.${currentBall}`;
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

  const FORMAT_TABS: { id: FormatTab; label: string; activeClass: string }[] = [
    { id: 'T20',  label: 'T20',  activeClass: 'bg-blue-600 text-white' },
    { id: 'ODI',  label: 'ODI',  activeClass: 'bg-sky-600 text-white' },
    { id: 'TEST', label: 'TEST', activeClass: 'bg-rose-700 text-white' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* ── TOP HEADER ── */}
      <div className="shrink-0 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">

            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-900/50">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-none">
                  FIELD SETUP
                </h1>
                <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest">
                  Formation Library
                </p>
              </div>
            </div>

            {/* Format tabs */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700/60 rounded-lg p-1 sm:ml-4 w-fit">
              {FORMAT_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFormat(tab.id)}
                  className={cn(
                    'px-4 py-1.5 text-xs font-black uppercase tracking-wide rounded-md transition-all duration-150 min-w-[48px]',
                    activeFormat === tab.id ? tab.activeClass : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Match context + field-settled badge */}
            <div className="sm:ml-auto flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-black text-slate-200 text-xs">
                {teamA} <span className="text-slate-500 font-medium">vs</span> {teamB}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                {currentFormat ?? activeFormat}
              </span>
              {(currentOver > 0 || currentBall > 0) && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                  Over {overLabel} &middot; {phaseLabel}
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
        </div>
      </div>

      {/* ── LEGEND BAR ── */}
      <div className="shrink-0 bg-slate-900/50 border-b border-slate-800/40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-2">
          <Legend />
        </div>
      </div>

      {/* ── FORMATION COLUMNS ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group, idx) => (
              <PhaseColumn
                key={group.phase}
                format={activeFormat}
                group={group}
                selectedKey={selectedKey}
                onSelect={handleSelect}
                columnIndex={idx}
              />
            ))}
          </div>

          {/* Selected formation summary bar */}
          {selectedKey && (() => {
            const preset = BowlerFieldStrategyEngine.PRESET_OVERLAYS[selectedKey];
            if (!preset) return null;
            const outside = preset.keys.filter(k => CANONICAL_POSITIONS[k]?.isOutsideCircle).length;
            return (
              <div className="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    Selected Formation
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">{preset.name}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{preset.intent}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-amber-400 font-bold">{outside}×deep</span>
                  <span className="text-[10px] text-blue-400 font-bold">{preset.keys.length - outside}×ring</span>
                  <button
                    onClick={() => setDetailKey(selectedKey)}
                    className="px-3 py-1 rounded-lg bg-emerald-700/50 hover:bg-emerald-600/60 border border-emerald-600/40 text-emerald-200 text-[10px] font-black uppercase tracking-wide transition-colors"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => { setSelectedKey(null); setDetailKey(null); }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 text-[10px] font-black uppercase tracking-wide transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Formation detail panel */}
      {detailKey && (
        <FormationDetailPanel presetKey={detailKey} onClose={() => setDetailKey(null)} />
      )}
    </div>
  );
}
