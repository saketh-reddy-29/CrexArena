import React from 'react';
import { 
  Award, Trophy, CheckCircle2, Lock, Flame, Star, Shield, 
  Target, Sparkles, Zap, Users, Crown 
} from 'lucide-react';
import { useGameStore } from '../../stores/useGameStore';
import { cn } from '../../lib/utils';

interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: 'MATCH' | 'BATTING' | 'BOWLING' | 'MANAGEMENT';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isUnlocked: boolean;
  progressText: string;
}

export default function AchievementsView() {
  const { 
    fixtures, 
    standings, 
    selectedFranchiseId, 
    franchises, 
    playerSeasonStats 
  } = useGameStore();

  const achievements = React.useMemo<AchievementDef[]>(() => {
    const userTeam = franchises.find(f => f.id === selectedFranchiseId);
    const completedMatches = fixtures.filter(f => f.status === 'COMPLETED');
    const userCompletedMatches = completedMatches.filter(
      f => f.team1Id === selectedFranchiseId || f.team2Id === selectedFranchiseId
    );

    // Batting feats
    let hasFifty = false;
    let hasCentury = false;
    let hasFiveWickets = false;
    let has200Total = false;

    completedMatches.forEach(f => {
      const sc = f.scorecard;
      if (!sc) return;

      [sc.innings1, sc.innings2].forEach(inn => {
        if (!inn) return;
        if (inn.runs >= 200) has200Total = true;

        Object.values(inn.battingStats || {}).forEach((b: any) => {
          if (b.runs >= 100) hasCentury = true;
          if (b.runs >= 50) hasFifty = true;
        });

        Object.values(inn.bowlingStats || {}).forEach((bw: any) => {
          if (bw.wickets >= 5) hasFiveWickets = true;
        });
      });
    });

    // Check squad capacity
    const hasFullSquad = Boolean(userTeam && userTeam.squad.length >= 15);
    const hasWonTournament = Boolean(
      standings.length > 0 && standings[0]?.teamId === selectedFranchiseId && userCompletedMatches.length >= 5
    );

    return [
      {
        id: 'first_match',
        title: 'Debut in the Arena',
        description: 'Complete your first official match in any competition format.',
        category: 'MATCH',
        icon: Trophy,
        color: 'text-blue-400',
        isUnlocked: userCompletedMatches.length >= 1,
        progressText: `${userCompletedMatches.length}/1 matches completed`,
      },
      {
        id: 'first_fifty',
        title: 'Half-Century Maestro',
        description: 'Have a batter score 50 or more runs in a single innings.',
        category: 'BATTING',
        icon: Flame,
        color: 'text-amber-400',
        isUnlocked: hasFifty,
        progressText: hasFifty ? 'Unlocked' : '0/1 fifties',
      },
      {
        id: 'first_century',
        title: 'Centurion of Glory',
        description: 'Have a batter craft a magnificent century (100+ runs).',
        category: 'BATTING',
        icon: Crown,
        color: 'text-[#F5B82E]',
        isUnlocked: hasCentury,
        progressText: hasCentury ? 'Unlocked' : '0/1 centuries',
      },
      {
        id: 'fifer',
        title: 'Five-Star Demolition',
        description: 'Claim 5 wickets in an innings with a single bowler.',
        category: 'BOWLING',
        icon: Target,
        color: 'text-purple-400',
        isUnlocked: hasFiveWickets,
        progressText: hasFiveWickets ? 'Unlocked' : '0/1 5-wicket hauls',
      },
      {
        id: 'double_ton_team',
        title: 'Explosive Arsenal',
        description: 'Score 200 or more runs in a single team innings.',
        category: 'BATTING',
        icon: Zap,
        color: 'text-cyan-400',
        isUnlocked: has200Total,
        progressText: has200Total ? 'Unlocked' : 'Target: 200+ runs',
      },
      {
        id: 'squad_builder',
        title: 'Master Strategist',
        description: 'Assemble a balanced tournament squad of at least 15 players.',
        category: 'MANAGEMENT',
        icon: Users,
        color: 'text-emerald-400',
        isUnlocked: hasFullSquad,
        progressText: `${userTeam?.squad.length || 0}/15 players`,
      },
      {
        id: 'champion',
        title: 'League Champions',
        description: 'Finish at the top of the league table and secure tournament gold.',
        category: 'MANAGEMENT',
        icon: Star,
        color: 'text-[#F5B82E]',
        isUnlocked: hasWonTournament,
        progressText: hasWonTournament ? 'Unlocked' : 'Rank #1 required',
      },
      {
        id: 'season_veteran',
        title: 'Season Veteran',
        description: 'Complete 10 matches across your career campaign.',
        category: 'MATCH',
        icon: Shield,
        color: 'text-indigo-400',
        isUnlocked: userCompletedMatches.length >= 10,
        progressText: `${userCompletedMatches.length}/10 matches`,
      },
    ];
  }, [fixtures, standings, selectedFranchiseId, franchises]);

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-widest text-[#F5B82E] uppercase">
              Trophies & Milestones
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Award className="w-7 h-7 text-[#F5B82E]" />
            Career Achievements
          </h1>
        </div>

        {/* Progress Badge */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#10233D] border border-white/10 shadow-lg">
          <Sparkles className="w-5 h-5 text-[#F5B82E]" />
          <div>
            <div className="text-[10px] text-[#9DAEC4] uppercase font-bold">Unlocked</div>
            <div className="text-base font-black text-white">
              {unlockedCount} / {achievements.length} Completed
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {achievements.map(ach => {
          const Icon = ach.icon;
          return (
            <div
              key={ach.id}
              className={cn(
                "glass-card rounded-2xl p-5 border relative overflow-hidden transition-all flex flex-col justify-between",
                ach.isUnlocked
                  ? "border-[#F5B82E]/40 bg-gradient-to-b from-[#152C4D] to-[#0D1C32] shadow-xl"
                  : "border-white/5 opacity-70 bg-[#071426]/60"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center p-2 border",
                    ach.isUnlocked
                      ? "bg-[#F5B82E]/20 border-[#F5B82E]/40 shadow-sm"
                      : "bg-white/5 border-white/10 text-zinc-500"
                  )}>
                    <Icon className={cn("w-5 h-5", ach.isUnlocked ? ach.color : "text-zinc-500")} />
                  </div>

                  {ach.isUnlocked ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> UNLOCKED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> LOCKED
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-black text-white mb-1">{ach.title}</h3>
                <p className="text-xs text-[#9DAEC4] leading-relaxed mb-4">{ach.description}</p>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-[#9DAEC4] font-medium">Status</span>
                <span className={cn("font-bold", ach.isUnlocked ? "text-emerald-400" : "text-zinc-500")}>
                  {ach.progressText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
