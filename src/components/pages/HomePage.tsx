import React from 'react';
import { 
  Play, Radio, Trophy, Calendar, Users, Gavel, BarChart3, 
  ArrowRight, Sparkles, Shield, Clock, Award, Star, Activity, ChevronRight 
} from 'lucide-react';
import { useGameStore, GameState } from '../../stores/useGameStore';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';
import { getPlayerImage } from '../../lib/playerImages';
import MatchRecoveryBanner from '../common/MatchRecoveryBanner';
import JerseyPlayerImage from '../JerseyPlayerImage';
import { cn } from '../../lib/utils';

export default function HomePage() {
  const { 
    franchises, 
    selectedFranchiseId, 
    selectedFormat, 
    fixtures, 
    standings, 
    playerSeasonStats, 
    players,
    liveMatchState,
    currentMatchId,
    setGameState, 
    setActiveTab,
    setCurrentMatch,
    setViewedPlayer,
  } = useGameStore();

  const userTeam = franchises.find(f => f.id === selectedFranchiseId);

  // Derive next scheduled fixture for user team
  const userFixtures = fixtures.filter(
    f => f.team1Id === selectedFranchiseId || f.team2Id === selectedFranchiseId
  );
  const nextMatch = userFixtures.find(f => f.status !== 'COMPLETED');
  const recentCompletedMatches = fixtures.filter(f => f.status === 'COMPLETED').slice(-4).reverse();

  const opponentTeam = nextMatch
    ? franchises.find(f => f.id === (nextMatch.team1Id === selectedFranchiseId ? nextMatch.team2Id : nextMatch.team1Id))
    : null;

  // Derive user team standing
  const userStanding = standings.find(s => s.teamId === selectedFranchiseId);

  // Top performers
  const topRunScorer = React.useMemo(() => {
    let top: { player: any; runs: number } | null = null;
    Object.entries(playerSeasonStats).forEach(([id, stats]) => {
      if (!top || stats.runs > top.runs) {
        const p = players.find(pl => pl.id === id);
        if (p) top = { player: p, runs: stats.runs };
      }
    });
    return top;
  }, [playerSeasonStats, players]);

  const topWicketTaker = React.useMemo(() => {
    let top: { player: any; wickets: number } | null = null;
    Object.entries(playerSeasonStats).forEach(([id, stats]) => {
      if (!top || stats.wickets > top.wickets) {
        const p = players.find(pl => pl.id === id);
        if (p) top = { player: p, wickets: stats.wickets };
      }
    });
    return top;
  }, [playerSeasonStats, players]);

  const handlePlayNow = () => {
    if (liveMatchState && currentMatchId) {
      setGameState(GameState.MATCH_SIMULATION);
      return;
    }
    if (nextMatch) {
      setCurrentMatch(nextMatch.id);
      setGameState(GameState.PRE_MATCH);
    } else {
      setGameState(GameState.ARENA_HUB);
      setActiveTab('MATCHES');
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Active Match In Progress Recovery Card */}
      <MatchRecoveryBanner />

      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0D1C32] via-[#10233D] to-[#071426] p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-[#F5B82E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-black uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-[#F5B82E]" />
              <span>{selectedFormat || 'IPL 2026'} Championship</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
              Lead Your Team To <span className="gold-gradient-text">Cricket Glory</span>
            </h1>

            <p className="text-base text-[#9DAEC4] max-w-xl font-medium leading-relaxed">
              Experience the pinnacle of cricket management and real-time 3D match simulation. Build your elite squad, execute aggressive field tactics, and dominate the league.
            </p>

            {/* Quick Hero Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handlePlayNow}
                className="px-6 py-3.5 rounded-2xl bg-[#258BFF] hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider btn-glow flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{liveMatchState && currentMatchId ? 'Resume In-Progress Match' : 'Play Next Match'}</span>
              </button>

              <button
                onClick={() => {
                  setGameState(GameState.ARENA_HUB);
                  setActiveTab('OVERVIEW');
                }}
                className="px-6 py-3.5 rounded-2xl bg-[#10233D] hover:bg-white/10 text-white border border-white/15 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Career Hub</span>
              </button>

              <button
                onClick={() => {
                  setGameState(GameState.FIXTURES);
                  setActiveTab('MATCHES');
                }}
                className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-[#9DAEC4] hover:text-white border border-white/10 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
              >
                <Calendar className="w-4 h-4" />
                <span>Fixtures</span>
              </button>
            </div>
          </div>

          {/* Hero Right: Next Match Card or Career Spotlight */}
          <div className="lg:col-span-5">
            {nextMatch && userTeam && opponentTeam ? (
              <div className="glass-card rounded-2xl p-6 border border-white/15 relative overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between text-xs text-[#9DAEC4] font-bold uppercase tracking-wider mb-4">
                  <span>UPCOMING FIXTURE</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Match {nextMatch.matchNumber || 1}
                  </span>
                </div>

                {/* Team vs Opponent */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex flex-col items-center text-center w-28">
                    <img 
                      src={resolveTeamLogoUrl(userTeam.shortName, userTeam.logo)} 
                      alt={userTeam.name} 
                      className="w-14 h-14 object-contain drop-shadow-md"
                    />
                    <div className="font-black text-sm text-white mt-2 leading-tight">{userTeam.shortName}</div>
                    <div className="text-[10px] text-[#9DAEC4]">Your Team</div>
                  </div>

                  <div className="flex flex-col items-center text-center px-2">
                    <div className="text-xl font-black text-[#F5B82E] italic">VS</div>
                    <div className="text-[10px] text-[#9DAEC4] mt-1 font-bold">Wankhede Stadium</div>
                  </div>

                  <div className="flex flex-col items-center text-center w-28">
                    <img 
                      src={resolveTeamLogoUrl(opponentTeam.shortName, opponentTeam.logo)} 
                      alt={opponentTeam.name} 
                      className="w-14 h-14 object-contain drop-shadow-md"
                    />
                    <div className="font-black text-sm text-white mt-2 leading-tight">{opponentTeam.shortName}</div>
                    <div className="text-[10px] text-[#9DAEC4]">Opponent</div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-[#9DAEC4] uppercase font-bold">Match Format</div>
                    <div className="text-xs font-black text-white">{nextMatch.format || selectedFormat || 'T20'}</div>
                  </div>
                  <button
                    onClick={handlePlayNow}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#258BFF] to-[#13A875] text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-md"
                  >
                    <span>Match Center</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : userTeam ? (
              <div className="glass-card rounded-2xl p-6 border border-white/15 text-center">
                <img 
                  src={resolveTeamLogoUrl(userTeam.shortName, userTeam.logo)} 
                  alt={userTeam.name} 
                  className="w-16 h-16 object-contain mx-auto mb-3"
                />
                <h3 className="text-lg font-black text-white">{userTeam.name}</h3>
                <p className="text-xs text-[#9DAEC4] mt-1">Squad: {userTeam.squad?.length || 0} Players • Purse: ₹{(((userTeam.purse ?? 0) / 10000000)).toFixed(1)} Cr</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    onClick={() => {
                      setGameState(GameState.ARENA_HUB);
                      setActiveTab('OVERVIEW');
                    }}
                    className="px-4 py-2 rounded-xl bg-[#258BFF] text-white text-xs font-bold"
                  >
                    Open Career Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-8 border border-white/15 text-center">
                <Trophy className="w-12 h-12 text-[#F5B82E] mx-auto mb-3" />
                <h3 className="text-lg font-black text-white">Start a New Career</h3>
                <p className="text-xs text-[#9DAEC4] mt-1 max-w-xs mx-auto mb-4">
                  Choose your format and franchise to begin competing for the championship.
                </p>
                <button
                  onClick={() => setGameState(GameState.TEAM_SELECTION)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#258BFF] to-[#13A875] text-white text-xs font-black uppercase tracking-wider"
                >
                  Select Team
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: My Career & Tournament Standings (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* My Career Card */}
          {userTeam && (
            <div className="glass-card rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  My Career Overview
                </h2>
                <button
                  onClick={() => {
                    setGameState(GameState.ARENA_HUB);
                    setActiveTab('SQUAD');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                >
                  Manage Squad <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#071426]/70 border border-white/5">
                  <div className="text-[10px] text-[#9DAEC4] font-bold uppercase">Squad Size</div>
                  <div className="text-lg font-black text-white mt-0.5">{userTeam.squad.length} / 25</div>
                </div>
                <div className="p-3 rounded-xl bg-[#071426]/70 border border-white/5">
                  <div className="text-[10px] text-[#9DAEC4] font-bold uppercase">Overseas</div>
                  <div className="text-lg font-black text-white mt-0.5">{userTeam.overseasCount} / 8</div>
                </div>
                <div className="p-3 rounded-xl bg-[#071426]/70 border border-white/5">
                  <div className="text-[10px] text-[#9DAEC4] font-bold uppercase">Points</div>
                  <div className="text-lg font-black text-[#F5B82E] mt-0.5">{userStanding?.points ?? 0} pts</div>
                </div>
                <div className="p-3 rounded-xl bg-[#071426]/70 border border-white/5">
                  <div className="text-[10px] text-[#9DAEC4] font-bold uppercase">Table Rank</div>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    #{standings.findIndex(s => s.teamId === selectedFranchiseId) + 1 || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tournament Points Table */}
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#F5B82E]" />
                Tournament Standings
              </h2>
              <button
                onClick={() => {
                  setGameState(GameState.ARENA_HUB);
                  setActiveTab('TABLE');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
              >
                Full Standings <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[#9DAEC4] uppercase text-[10px] font-bold">
                    <th className="pb-2">Pos</th>
                    <th className="pb-2">Team</th>
                    <th className="pb-2 text-center">P</th>
                    <th className="pb-2 text-center">W</th>
                    <th className="pb-2 text-center">L</th>
                    <th className="pb-2 text-center">NRR</th>
                    <th className="pb-2 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {standings.slice(0, 6).map((standing, index) => {
                    const franchise = franchises.find(f => f.id === standing.teamId);
                    const isUser = standing.teamId === selectedFranchiseId;
                    return (
                      <tr 
                        key={standing.teamId}
                        className={cn(
                          "transition-colors",
                          isUser ? "bg-blue-500/10 font-bold" : "hover:bg-white/5"
                        )}
                      >
                        <td className="py-2.5 font-bold text-[#9DAEC4]">{index + 1}</td>
                        <td className="py-2.5 flex items-center gap-2">
                          <img
                            src={resolveTeamLogoUrl(franchise?.shortName, franchise?.logo)}
                            alt={franchise?.name}
                            className="w-5 h-5 object-contain"
                          />
                          <span className="font-bold text-white truncate max-w-[140px] sm:max-w-none">
                            {franchise?.name || standing.teamId}
                          </span>
                          {isUser && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-center text-[#9DAEC4]">{standing.played}</td>
                        <td className="py-2.5 text-center text-emerald-400 font-bold">{standing.won}</td>
                        <td className="py-2.5 text-center text-rose-400 font-bold">{standing.lost}</td>
                        <td className="py-2.5 text-center text-[#9DAEC4]">
                          {(() => {
                            const nrr = typeof standing.netRunRate === 'number' ? standing.netRunRate : 0;
                            return nrr > 0 ? `+${nrr.toFixed(3)}` : nrr.toFixed(3);
                          })()}
                        </td>
                        <td className="py-2.5 text-right font-black text-[#F5B82E]">{standing.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Completed Match Results */}
          {recentCompletedMatches.length > 0 && (
            <div className="glass-card rounded-2xl p-6 border border-white/10">
              <h2 className="text-base font-black text-white flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-cyan-400" />
                Recent Match Results
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentCompletedMatches.map(match => {
                  const t1 = franchises.find(f => f.id === match.team1Id);
                  const t2 = franchises.find(f => f.id === match.team2Id);
                  return (
                    <div 
                      key={match.id}
                      className="p-3 rounded-xl bg-[#071426]/70 border border-white/5 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#9DAEC4] font-bold">
                        <span>MATCH {match.matchNumber || 1}</span>
                        <span className="text-emerald-400">COMPLETED</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <img src={resolveTeamLogoUrl(t1?.shortName, t1?.logo)} alt={t1?.name} className="w-4 h-4 object-contain" />
                          <span>{t1?.shortName}</span>
                        </div>
                        <span className="font-mono text-[#9DAEC4]">vs</span>
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span>{t2?.shortName}</span>
                          <img src={resolveTeamLogoUrl(t2?.shortName, t2?.logo)} alt={t2?.name} className="w-4 h-4 object-contain" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Top Performers & Quick Access Hub (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Top Performers Spotlight */}
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h2 className="text-base font-black text-white flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-[#F5B82E]" />
              Tournament Leaders
            </h2>

            <div className="space-y-4">
              {/* Leading Run Scorer */}
              {topRunScorer && (
                <div 
                  onClick={() => setViewedPlayer(topRunScorer?.player.id)}
                  className="p-3 rounded-xl bg-[#071426]/70 border border-white/5 flex items-center gap-3 cursor-pointer hover:border-amber-500/40 transition-all"
                >
                  <img
                    src={getPlayerImage(topRunScorer.player)}
                    alt={topRunScorer.player.name}
                    className="w-12 h-12 rounded-xl object-cover bg-white/5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-[#F5B82E] uppercase">Orange Cap (Most Runs)</div>
                    <div className="text-sm font-black text-white truncate">{topRunScorer.player.name}</div>
                    <div className="text-xs font-bold text-[#9DAEC4] mt-0.5">{topRunScorer.runs} Runs</div>
                  </div>
                </div>
              )}

              {/* Leading Wicket Taker */}
              {topWicketTaker && (
                <div 
                  onClick={() => setViewedPlayer(topWicketTaker?.player.id)}
                  className="p-3 rounded-xl bg-[#071426]/70 border border-white/5 flex items-center gap-3 cursor-pointer hover:border-purple-500/40 transition-all"
                >
                  <img
                    src={getPlayerImage(topWicketTaker.player)}
                    alt={topWicketTaker.player.name}
                    className="w-12 h-12 rounded-xl object-cover bg-white/5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-purple-400 uppercase">Purple Cap (Most Wickets)</div>
                    <div className="text-sm font-black text-white truncate">{topWicketTaker.player.name}</div>
                    <div className="text-xs font-bold text-[#9DAEC4] mt-0.5">{topWicketTaker.wickets} Wickets</div>
                  </div>
                </div>
              )}

              {!topRunScorer && !topWicketTaker && (
                <div className="text-xs text-[#9DAEC4] py-4 text-center italic">
                  Complete matches to unlock player performance leaderboards.
                </div>
              )}
            </div>
          </div>

          {/* Quick Access Grid */}
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h2 className="text-base font-black text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-[#258BFF]" />
              Quick Navigation
            </h2>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setGameState(GameState.PLAYERS)}
                className="p-3 rounded-xl bg-[#071426]/70 border border-white/5 hover:border-blue-500/40 text-left transition-all group"
              >
                <Users className="w-5 h-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-black text-white">All Players</div>
                <div className="text-[10px] text-[#9DAEC4]">Rosters & Stats</div>
              </button>

              <button
                onClick={() => setGameState(GameState.TEAMS)}
                className="p-3 rounded-xl bg-[#071426]/70 border border-white/5 hover:border-emerald-500/40 text-left transition-all group"
              >
                <Shield className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-black text-white">All Squads</div>
                <div className="text-[10px] text-[#9DAEC4]">10 Franchises</div>
              </button>

              <button
                onClick={() => setGameState(GameState.AUCTION)}
                className="p-3 rounded-xl bg-[#071426]/70 border border-white/5 hover:border-amber-500/40 text-left transition-all group"
              >
                <Gavel className="w-5 h-5 text-[#F5B82E] mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-black text-white">Auction Room</div>
                <div className="text-[10px] text-[#9DAEC4]">Purse & Bidding</div>
              </button>

              <button
                onClick={() => setGameState(GameState.RECORDS)}
                className="p-3 rounded-xl bg-[#071426]/70 border border-white/5 hover:border-purple-500/40 text-left transition-all group"
              >
                <Award className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-black text-white">Records & Caps</div>
                <div className="text-[10px] text-[#9DAEC4]">Historical Best</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
