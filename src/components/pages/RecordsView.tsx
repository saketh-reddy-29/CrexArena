import React from 'react';
import { 
  BookmarkCheck, Trophy, Flame, Target, Zap, Shield, Award, 
  TrendingUp, Users, Star, ArrowLeft 
} from 'lucide-react';
import { useGameStore, GameState } from '../../stores/useGameStore';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';
import { getPlayerImage } from '../../lib/playerImages';
import { cn } from '../../lib/utils';

export default function RecordsView() {
  const { 
    fixtures, 
    players, 
    franchises, 
    playerSeasonStats, 
    setGameState, 
    setViewedPlayer 
  } = useGameStore();

  // Aggregate records dynamically from completed fixture scorecards and player stats
  const records = React.useMemo(() => {
    let highestTotal = { runs: 0, wickets: 0, team: '', opponent: '', match: '' };
    let lowestTotal = { runs: 9999, wickets: 0, team: '', opponent: '', match: '' };
    let highestIndividualScore = { runs: 0, balls: 0, playerName: '', playerId: '', team: '' };
    let bestBowlingFigures = { wickets: 0, runs: 999, bowlerName: '', bowlerId: '', team: '' };
    let mostSixesInSeason = { count: 0, playerName: '', playerId: '' };
    let mostFoursInSeason = { count: 0, playerName: '', playerId: '' };

    const completedFixtures = fixtures.filter(f => f.status === 'COMPLETED' && f.scorecard);

    completedFixtures.forEach(fix => {
      const sc = fix.scorecard!;
      const t1 = franchises.find(f => f.id === fix.team1Id)?.name || 'Team 1';
      const t2 = franchises.find(f => f.id === fix.team2Id)?.name || 'Team 2';

      // Check Innings 1
      if (sc.innings1) {
        if (sc.innings1.runs > highestTotal.runs) {
          highestTotal = {
            runs: sc.innings1.runs,
            wickets: sc.innings1.wickets,
            team: t1,
            opponent: t2,
            match: `Match ${fix.matchNumber || 1}`,
          };
        }
        if (sc.innings1.runs < lowestTotal.runs && sc.innings1.overs > 5) {
          lowestTotal = {
            runs: sc.innings1.runs,
            wickets: sc.innings1.wickets,
            team: t1,
            opponent: t2,
            match: `Match ${fix.matchNumber || 1}`,
          };
        }

        // Batters
        Object.values(sc.innings1.battingStats || {}).forEach((b: any) => {
          if (b.runs > highestIndividualScore.runs) {
            highestIndividualScore = {
              runs: b.runs,
              balls: b.balls,
              playerName: b.name || 'Batter',
              playerId: b.playerId || '',
              team: t1,
            };
          }
        });

        // Bowlers
        Object.values(sc.innings1.bowlingStats || {}).forEach((bw: any) => {
          if (
            bw.wickets > bestBowlingFigures.wickets ||
            (bw.wickets === bestBowlingFigures.wickets && bw.runs < bestBowlingFigures.runs && bw.wickets > 0)
          ) {
            bestBowlingFigures = {
              wickets: bw.wickets,
              runs: bw.runs,
              bowlerName: bw.name || 'Bowler',
              bowlerId: bw.playerId || '',
              team: t2,
            };
          }
        });
      }

      // Check Innings 2
      if (sc.innings2) {
        if (sc.innings2.runs > highestTotal.runs) {
          highestTotal = {
            runs: sc.innings2.runs,
            wickets: sc.innings2.wickets,
            team: t2,
            opponent: t1,
            match: `Match ${fix.matchNumber || 1}`,
          };
        }
        if (sc.innings2.runs < lowestTotal.runs && sc.innings2.overs > 5) {
          lowestTotal = {
            runs: sc.innings2.runs,
            wickets: sc.innings2.wickets,
            team: t2,
            opponent: t1,
            match: `Match ${fix.matchNumber || 1}`,
          };
        }

        Object.values(sc.innings2.battingStats || {}).forEach((b: any) => {
          if (b.runs > highestIndividualScore.runs) {
            highestIndividualScore = {
              runs: b.runs,
              balls: b.balls,
              playerName: b.name || 'Batter',
              playerId: b.playerId || '',
              team: t2,
            };
          }
        });

        Object.values(sc.innings2.bowlingStats || {}).forEach((bw: any) => {
          if (
            bw.wickets > bestBowlingFigures.wickets ||
            (bw.wickets === bestBowlingFigures.wickets && bw.runs < bestBowlingFigures.runs && bw.wickets > 0)
          ) {
            bestBowlingFigures = {
              wickets: bw.wickets,
              runs: bw.runs,
              bowlerName: bw.name || 'Bowler',
              bowlerId: bw.playerId || '',
              team: t1,
            };
          }
        });
      }
    });

    // Check season aggregate boundary counters
    Object.entries(playerSeasonStats).forEach(([id, st]) => {
      const p = players.find(pl => pl.id === id);
      if (st.sixes && st.sixes > mostSixesInSeason.count) {
        mostSixesInSeason = { count: st.sixes, playerName: p?.name || id, playerId: id };
      }
      if (st.fours && st.fours > mostFoursInSeason.count) {
        mostFoursInSeason = { count: st.fours, playerName: p?.name || id, playerId: id };
      }
    });

    return {
      highestTotal: highestTotal.runs > 0 ? highestTotal : null,
      lowestTotal: lowestTotal.runs < 9999 ? lowestTotal : null,
      highestIndividualScore: highestIndividualScore.runs > 0 ? highestIndividualScore : null,
      bestBowlingFigures: bestBowlingFigures.wickets > 0 ? bestBowlingFigures : null,
      mostSixesInSeason: mostSixesInSeason.count > 0 ? mostSixesInSeason : null,
      mostFoursInSeason: mostFoursInSeason.count > 0 ? mostFoursInSeason : null,
    };
  }, [fixtures, players, franchises, playerSeasonStats]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-widest text-[#F5B82E] uppercase">
              Hall of Fame & Statistics
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <BookmarkCheck className="w-7 h-7 text-[#F5B82E]" />
            Cricket Arena Records
          </h1>
        </div>
      </div>

      {/* Record Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Highest Team Score */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#9DAEC4] font-bold uppercase tracking-wider mb-2">
            <span>Highest Team Total</span>
            <Trophy className="w-4 h-4 text-[#F5B82E]" />
          </div>

          {records.highestTotal ? (
            <div>
              <div className="text-3xl font-black text-[#F5B82E]">
                {records.highestTotal.runs}/{records.highestTotal.wickets}
              </div>
              <div className="text-sm font-bold text-white mt-1">{records.highestTotal.team}</div>
              <div className="text-xs text-[#9DAEC4] mt-0.5">vs {records.highestTotal.opponent} • {records.highestTotal.match}</div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#9DAEC4] italic">
              Play tournament matches to establish highest team records.
            </div>
          )}
        </div>

        {/* Highest Individual Score */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#9DAEC4] font-bold uppercase tracking-wider mb-2">
            <span>Highest Individual Score</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>

          {records.highestIndividualScore ? (
            <div 
              onClick={() => records.highestIndividualScore?.playerId && setViewedPlayer(records.highestIndividualScore.playerId)}
              className="cursor-pointer group"
            >
              <div className="text-3xl font-black text-orange-400">
                {records.highestIndividualScore.runs}* <span className="text-sm text-white/60">({records.highestIndividualScore.balls}b)</span>
              </div>
              <div className="text-sm font-black text-white mt-1 group-hover:text-blue-400 transition-colors">
                {records.highestIndividualScore.playerName}
              </div>
              <div className="text-xs text-[#9DAEC4] mt-0.5">{records.highestIndividualScore.team}</div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#9DAEC4] italic">
              Complete matches to record top individual batting feats.
            </div>
          )}
        </div>

        {/* Best Bowling Figures */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#9DAEC4] font-bold uppercase tracking-wider mb-2">
            <span>Best Bowling Spell</span>
            <Target className="w-4 h-4 text-purple-400" />
          </div>

          {records.bestBowlingFigures ? (
            <div 
              onClick={() => records.bestBowlingFigures?.bowlerId && setViewedPlayer(records.bestBowlingFigures.bowlerId)}
              className="cursor-pointer group"
            >
              <div className="text-3xl font-black text-purple-400">
                {records.bestBowlingFigures.wickets}/{records.bestBowlingFigures.runs}
              </div>
              <div className="text-sm font-black text-white mt-1 group-hover:text-purple-300 transition-colors">
                {records.bestBowlingFigures.bowlerName}
              </div>
              <div className="text-xs text-[#9DAEC4] mt-0.5">{records.bestBowlingFigures.team}</div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#9DAEC4] italic">
              Wickets taken in simulation will record best bowling spells here.
            </div>
          )}
        </div>

        {/* Most Sixes in Season */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#9DAEC4] font-bold uppercase tracking-wider mb-2">
            <span>Maximum Sixes</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>

          {records.mostSixesInSeason ? (
            <div>
              <div className="text-3xl font-black text-cyan-400">
                {records.mostSixesInSeason.count} <span className="text-sm text-white/60">Sixes</span>
              </div>
              <div className="text-sm font-bold text-white mt-1">{records.mostSixesInSeason.playerName}</div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#9DAEC4] italic">
              Sixes smashed during live and simulated overs appear here.
            </div>
          )}
        </div>

        {/* Most Fours in Season */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#9DAEC4] font-bold uppercase tracking-wider mb-2">
            <span>Maximum Fours</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>

          {records.mostFoursInSeason ? (
            <div>
              <div className="text-3xl font-black text-emerald-400">
                {records.mostFoursInSeason.count} <span className="text-sm text-white/60">Fours</span>
              </div>
              <div className="text-sm font-bold text-white mt-1">{records.mostFoursInSeason.playerName}</div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#9DAEC4] italic">
              Boundaries scored in matches will populate this record.
            </div>
          )}
        </div>

        {/* Lowest Team Total */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#9DAEC4] font-bold uppercase tracking-wider mb-2">
            <span>Lowest Defended Score</span>
            <Shield className="w-4 h-4 text-rose-400" />
          </div>

          {records.lowestTotal ? (
            <div>
              <div className="text-3xl font-black text-rose-400">
                {records.lowestTotal.runs}/{records.lowestTotal.wickets}
              </div>
              <div className="text-sm font-bold text-white mt-1">{records.lowestTotal.team}</div>
              <div className="text-xs text-[#9DAEC4] mt-0.5">vs {records.lowestTotal.opponent}</div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#9DAEC4] italic">
              Defended match scores will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
