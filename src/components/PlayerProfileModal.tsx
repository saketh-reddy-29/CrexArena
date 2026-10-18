import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Globe, TrendingUp, TrendingDown, Minus, Activity, Award, Shield, Zap, Target, AlertTriangle, Compass } from 'lucide-react';
import { Player } from '../types/common';
import JerseyPlayerImage from './JerseyPlayerImage';
import { getFormatSpecificProfile, getPlayerRating, getPlayerForm } from '../lib/ratingEngine';
import { useGameStore, ArenaFormat } from '../stores/useGameStore';
import { cn } from '../lib/utils';
import { BatterScoringMemory, CANONICAL_ZONES, CANONICAL_ZONE_LIST } from '../engine/analytics/BatterScoringMemory';

type ProfileTab = 
  | 'OVERVIEW' 
  | 'SCORING_ZONES'
  | 'CAREER' 
  | 'SEASON' 
  | 'COMPETITION' 
  | 'RECENT_FORM' 
  | 'RATING' 
  | 'MATCH_HISTORY' 
  | 'BATTING' 
  | 'BOWLING' 
  | 'FIELDING' 
  | 'DEVELOPMENT' 
  | 'TEST_STATS';

const ProgressBar = ({ label, value, colorClass = "text-cyan-400" }: { label: string; value: number; colorClass?: string }) => {
  const blocks = 20;
  const filled = Math.round((Math.min(100, Math.max(0, value)) / 100) * blocks);
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="w-28 sm:w-32 text-white/80 font-medium">{label}</span>
      <div className={`flex-1 font-mono tracking-tighter text-sm ${colorClass}`}>
        {'█'.repeat(filled)}<span className="opacity-30">{'░'.repeat(blocks - filled)}</span>
      </div>
      <span className="w-8 text-right font-black text-white">{value}</span>
    </div>
  );
};

interface PlayerProfileModalProps {
  player: Player | null;
  franchiseId?: string;
  onClose: () => void;
}

export default function PlayerProfileModal({ player, franchiseId, onClose }: PlayerProfileModalProps) {
  const { selectedFormat, activeArenaId, arenaPlayerStates, getArenaPlayerState } = useGameStore();
  const [activeFormat, setActiveFormat] = useState<ArenaFormat>(selectedFormat || 'IPL');
  const [activeTab, setActiveTab] = useState<ProfileTab>('OVERVIEW');
  const [zoneFormat, setZoneFormat] = useState<'ALL' | ArenaFormat>('ALL');
  const [zoneBowling, setZoneBowling] = useState<'ALL' | 'PACE' | 'SPIN'>('ALL');

  if (!player) return null;

  const playerState = getArenaPlayerState(player.id, activeFormat);
  const baseAbility = player.baseAbility || player.rating || 75;
  const currentRating = playerState ? playerState.currentRating : getPlayerRating(player, activeFormat);
  const formStatus = getPlayerForm(player, activeFormat, playerState);
  const details = getFormatSpecificProfile(player, activeFormat, playerState);

  const isTest = activeFormat === 'TEST';
  const recentMatches = playerState?.recentMatches || [];

  const scoringProfile = player ? BatterScoringMemory.getBatterProfile(player.id, {
    format: zoneFormat,
    bowlingType: zoneBowling,
  }) : null;

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'OVERVIEW', label: 'Overview' },
    { id: 'SCORING_ZONES', label: 'Scoring Zones' },
    { id: 'RECENT_FORM', label: 'Recent Form' },
    { id: 'RATING', label: 'Rating' },
    { id: 'DEVELOPMENT', label: 'Development' },
    { id: 'CAREER', label: 'Career' },
    { id: 'SEASON', label: 'Season' },
    { id: 'MATCH_HISTORY', label: 'Match History' },
    { id: 'BATTING', label: 'Batting' },
    { id: 'BOWLING', label: 'Bowling' },
    { id: 'FIELDING', label: 'Fielding' },
    ...(isTest ? [{ id: 'TEST_STATS' as ProfileTab, label: 'Test Specifics' }] : []),
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[95vw] max-w-[620px] max-h-[92vh] flex flex-col"
      >
        <div className="bg-[#080d1a] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.9)] relative flex flex-col max-h-[92vh]">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Visual Banner */}
          <div className="relative h-[180px] shrink-0 bg-gradient-to-b from-[#111e38] via-[#0b1426] to-[#080d1a] flex items-center px-6">
            <div className="w-28 h-28 shrink-0 relative mr-4">
              <JerseyPlayerImage
                player={player}
                franchiseId={franchiseId}
                className="w-full h-full object-contain"
                imageClassName="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-[9px] font-black uppercase text-cyan-300">
                  {player.role}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-bold text-white/60 uppercase">
                  {player.nationality === 'Indian' ? '🇮🇳 Indian' : '🌐 Overseas'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white truncate tracking-tight">{player.name}</h2>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-white/70">
                <span>Base Price: <strong className="text-cyan-400">₹{(player.basePrice / 10000000).toFixed(2)} Cr</strong></span>
              </div>
            </div>
          </div>

          {/* Format Selector Bar */}
          <div className="px-6 py-2 bg-[#0d1527] border-y border-white/5 flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-white/40 mr-2 tracking-wider">Format:</span>
            {(['TEST', 'ODI', 'T20', 'IPL'] as ArenaFormat[]).map(fmt => (
              <button
                key={fmt}
                onClick={() => setActiveFormat(fmt)}
                className={cn(
                  "px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                  activeFormat === fmt ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "bg-white/5 text-white/60 hover:text-white"
                )}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-4 gap-2 px-6 py-3 bg-[#0a1020]/90 border-b border-white/5 text-center">
            <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
              <div className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Base Ability</div>
              <div className="text-sm font-black text-white/80 mt-0.5">{baseAbility}</div>
            </div>
            <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
              <div className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">Format Rating</div>
              <div className="text-sm font-black text-cyan-300 mt-0.5">{currentRating}</div>
            </div>
            <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
              <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Form</div>
              <div className="text-sm font-black text-amber-300 mt-0.5 flex items-center justify-center gap-1">
                {playerState && playerState.hasRecentMatches && playerState.recentMatchCount > 0 && playerState.recentForm > 0 ? (
                  <>
                    <span>{playerState.recentForm}</span>
                    {formStatus.trend === 'IMPROVING' && <TrendingUp className="w-3 h-3 text-green-400" />}
                    {formStatus.trend === 'DECLINING' && <TrendingDown className="w-3 h-3 text-red-400" />}
                    {formStatus.trend === 'NEUTRAL' && <Minus className="w-3 h-3 text-white/40" />}
                  </>
                ) : (
                  <span className="text-[10px] text-white/50 font-bold">New / No Data</span>
                )}
              </div>
            </div>
            <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
              <div className="text-[9px] font-bold text-green-400 uppercase tracking-wider">Recent Games</div>
              <div className="text-sm font-black text-white mt-0.5">{playerState?.recentMatchCount || 0}</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 border-b border-white/5 flex gap-1 overflow-x-auto custom-scrollbar shrink-0 py-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg whitespace-nowrap transition-all",
                  activeTab === tab.id 
                    ? "bg-white text-black font-black" 
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Area */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 text-white">
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-4">
                <div className="bg-[#101a2e] p-4 rounded-2xl border border-white/5">
                  <h4 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Core Performance Stats ({activeFormat})
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-black/30 p-2.5 rounded-xl">
                      <div className="text-[9px] text-white/40 uppercase">Recent Runs</div>
                      <div className="text-lg font-black text-white">{playerState?.recentRuns || 0}</div>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-xl">
                      <div className="text-[9px] text-white/40 uppercase">Recent Wickets</div>
                      <div className="text-lg font-black text-white">{playerState?.recentWickets || 0}</div>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-xl">
                      <div className="text-[9px] text-white/40 uppercase">Recent Catches</div>
                      <div className="text-lg font-black text-white">{playerState?.recentCatches || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#101a2e] p-4 rounded-2xl border border-white/5 space-y-2">
                  <h4 className="text-xs font-black uppercase text-white/70 tracking-wider mb-2">Attribute Distribution</h4>
                  <ProgressBar label="Technique" value={details.batting.technique} />
                  <ProgressBar label="Consistency" value={details.batting.consistency} />
                  <ProgressBar label="Power / Pace" value={details.batting.power} />
                  <ProgressBar label="Concentration" value={details.mental.concentration} colorClass="text-purple-400" />
                  <ProgressBar label="Fielding Reflexes" value={details.fielding.fielding} colorClass="text-green-400" />
                  <ProgressBar label="Stamina / Fitness" value={details.form.fitness} colorClass="text-amber-400" />
                </div>
              </div>
            )}

            {activeTab === 'RECENT_FORM' && (
              <div className="space-y-3">
                <div className="bg-[#101a2e] p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-white/60 uppercase">Rolling Form Status</span>
                    <span className="text-xs font-black text-amber-400 uppercase">{formStatus.label}</span>
                  </div>
                  {playerState?.hasRecentMatches ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs py-1 border-b border-white/5">
                        <span className="text-white/60">Form Rating</span>
                        <span className="font-bold">{playerState.formRating} / 100</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-white/5">
                        <span className="text-white/60">Recent Strike Rate</span>
                        <span className="font-bold">{playerState.recentStrikeRate}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-white/5">
                        <span className="text-white/60">Recent Economy</span>
                        <span className="font-bold">{playerState.recentEconomy}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-white/5">
                        <span className="text-white/60">Confidence</span>
                        <span className="font-bold">{playerState.confidence}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-white/60">Fatigue Level</span>
                        <span className="font-bold text-red-400">{playerState.fatigue}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-white/40 text-xs">
                      No matches played in this Arena yet. Form will calculate dynamically after the first match.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'SCORING_ZONES' && (
              <div className="space-y-3">
                {/* Confidence & Filter Bar */}
                <div className="bg-[#101a2e] p-3 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-white">
                      <Target className="w-4 h-4 text-cyan-400" />
                      <span>Historical Scoring Zones</span>
                    </div>

                    <div className={cn(
                      "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 border",
                      scoringProfile?.sampleSizeConfidence === 'HIGH'
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : scoringProfile?.sampleSizeConfidence === 'MEDIUM'
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                        : scoringProfile?.sampleSizeConfidence === 'LOW'
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    )}>
                      <Shield className="w-2.5 h-2.5" />
                      <span>{scoringProfile?.sampleSizeConfidence || 'INSUFFICIENT'} DATA</span>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="text-white/40 font-bold uppercase">Format:</span>
                      {(['ALL', 'T20', 'ODI', 'TEST'] as Array<'ALL' | ArenaFormat>).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setZoneFormat(fmt)}
                          className={cn(
                            "px-2 py-0.5 rounded-md font-bold transition-colors",
                            zoneFormat === fmt
                              ? "bg-cyan-500 text-slate-950"
                              : "bg-white/5 text-white/50 hover:text-white"
                          )}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-white/40 font-bold uppercase">Vs:</span>
                      {(['ALL', 'PACE', 'SPIN'] as const).map((bType) => (
                        <button
                          key={bType}
                          onClick={() => setZoneBowling(bType)}
                          className={cn(
                            "px-2 py-0.5 rounded-md font-bold transition-colors",
                            zoneBowling === bType
                              ? "bg-cyan-500 text-slate-950"
                              : "bg-white/5 text-white/50 hover:text-white"
                          )}
                        >
                          {bType}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Aggregate Summary */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  <div className="bg-[#101a2e] p-2 rounded-xl border border-white/5">
                    <div className="text-[9px] text-white/40">Balls</div>
                    <div className="font-bold text-white">{scoringProfile?.totalBalls || 0}</div>
                  </div>
                  <div className="bg-[#101a2e] p-2 rounded-xl border border-white/5">
                    <div className="text-[9px] text-white/40">Runs</div>
                    <div className="font-bold text-cyan-400">{scoringProfile?.totalRuns || 0}</div>
                  </div>
                  <div className="bg-[#101a2e] p-2 rounded-xl border border-white/5">
                    <div className="text-[9px] text-white/40">Boundaries</div>
                    <div className="font-bold text-amber-400">{scoringProfile?.totalBoundaries || 0}</div>
                  </div>
                  <div className="bg-[#101a2e] p-2 rounded-xl border border-white/5">
                    <div className="text-[9px] text-white/40">Dots</div>
                    <div className="font-bold text-slate-300">{scoringProfile?.totalDots || 0}</div>
                  </div>
                  <div className="bg-[#101a2e] p-2 rounded-xl border border-white/5">
                    <div className="text-[9px] text-white/40">Strike Rate</div>
                    <div className="font-bold text-white">{scoringProfile?.strikeRate || 0}</div>
                  </div>
                  <div className="bg-[#101a2e] p-2 rounded-xl border border-white/5">
                    <div className="text-[9px] text-white/40">Dismissals</div>
                    <div className="font-bold text-rose-400">{scoringProfile?.totalDismissals || 0}</div>
                  </div>
                </div>

                {scoringProfile?.insufficientDataWarning && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-center gap-2 text-amber-300 text-[10px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{scoringProfile.insufficientDataWarning}</span>
                  </div>
                )}

                {/* Canonical 16-Zone Cards */}
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {CANONICAL_ZONE_LIST.map((zKey) => {
                    const def = CANONICAL_ZONES[zKey];
                    const metric = scoringProfile?.zones[zKey];
                    return (
                      <div
                        key={zKey}
                        className={cn(
                          "bg-[#101a2e] p-2.5 rounded-xl border flex flex-col justify-between",
                          metric && metric.isDangerousBoundaryZone
                            ? "border-rose-500/40 bg-rose-500/5"
                            : metric && metric.isDismissalVulnerability
                            ? "border-amber-500/40 bg-amber-500/5"
                            : "border-white/5"
                        )}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-white">
                          <span>{def.name}</span>
                          <span className="text-[9px] text-white/40 font-mono">{def.side}</span>
                        </div>
                        <div className="text-[9px] text-white/40 mt-0.5">{def.description}</div>
                        <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px]">
                          <span>Runs: <strong className="text-cyan-300">{metric?.runsScored || 0}</strong> ({metric?.ballsFaced || 0}b)</span>
                          <span>Bound: <strong className="text-amber-400">{metric?.boundaryCount || 0}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'DEVELOPMENT' && (
              <div className="space-y-3">
                <div className="bg-[#101a2e] p-4 rounded-2xl border border-white/5">
                  <h4 className="text-xs font-black uppercase text-green-400 tracking-wider mb-3 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" /> Long-Term Development Categories
                  </h4>
                  <div className="space-y-2">
                    <ProgressBar label="Batting Skill" value={playerState?.development?.bat || baseAbility} />
                    <ProgressBar label="Bowling Skill" value={playerState?.development?.bowl || 40} colorClass="text-blue-400" />
                    <ProgressBar label="Fielding" value={playerState?.development?.field || 75} colorClass="text-green-400" />
                    <ProgressBar label="Technique" value={playerState?.development?.technique || baseAbility} />
                    <ProgressBar label="Mental Temperament" value={playerState?.development?.mental || 75} colorClass="text-purple-400" />
                    <ProgressBar label="Fitness" value={playerState?.development?.fitness || 85} colorClass="text-amber-400" />
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-white/50">
                    Player Potential Cap: <strong className="text-white">{playerState?.potential || baseAbility + 5}</strong>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'CAREER' && (
              <div className="bg-[#101a2e] p-4 rounded-2xl border border-white/5 space-y-2">
                <h4 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-2">Arena Career Statistics ({activeFormat})</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">Matches</div><div className="font-bold">{playerState?.careerStats?.matches || 0}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">Runs</div><div className="font-bold">{playerState?.careerStats?.runs || 0}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">Wickets</div><div className="font-bold">{playerState?.careerStats?.wickets || 0}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">Highest</div><div className="font-bold">{playerState?.careerStats?.highestScore || 0}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">50s / 100s</div><div className="font-bold">{playerState?.careerStats?.fifties || 0} / {playerState?.careerStats?.hundreds || 0}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">Best Bowling</div><div className="font-bold">{playerState?.careerStats?.bestBowling || '0/0'}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">4s / 6s</div><div className="font-bold">{playerState?.careerStats?.fours || 0} / {playerState?.careerStats?.sixes || 0}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">Catches</div><div className="font-bold">{playerState?.careerStats?.catches || 0}</div></div>
                </div>
              </div>
            )}

            {activeTab === 'MATCH_HISTORY' && (
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-white/60 tracking-wider mb-2">Rolling Recent Matches (Last 20)</h4>
                {recentMatches.length > 0 ? (
                  recentMatches.map((m, idx) => (
                    <div key={idx} className="bg-[#101a2e] p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-cyan-300 mr-2">{m.runs} runs ({m.balls}b)</span>
                        {m.wickets > 0 && <span className="font-bold text-amber-300 mr-2">{m.wickets} wkts</span>}
                        <span className="text-white/40 text-[10px]">{m.oppositionName || 'Opposition'}</span>
                      </div>
                      <div className="text-right">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", m.ratingDelta >= 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10")}>
                          {m.ratingDelta >= 0 ? `+${m.ratingDelta}` : m.ratingDelta}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-white/40 text-xs">No match history in this Arena yet.</div>
                )}
              </div>
            )}

            {activeTab === 'TEST_STATS' && isTest && (
              <div className="bg-[#101a2e] p-4 rounded-2xl border border-white/5 space-y-2 text-xs">
                <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider mb-2">Test Specific Metrics</h4>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">Balls Survived</div><div className="font-bold">{playerState?.careerStats?.ballsSurvived || 0}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">Dot Balls</div><div className="font-bold">{playerState?.careerStats?.dots || 0}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">4th Innings Runs</div><div className="font-bold">{playerState?.careerStats?.fourthInningsRuns || 0}</div></div>
                  <div className="bg-black/30 p-2 rounded-lg"><div className="text-[9px] text-white/40">New Ball Wickets</div><div className="font-bold">{playerState?.careerStats?.newBallWickets || 0}</div></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
