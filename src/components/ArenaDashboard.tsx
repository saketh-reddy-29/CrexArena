import React, { useMemo } from 'react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { Shield, ArrowLeft, Users, Trophy, ChevronRight, Calendar, BarChart3, Activity, Zap, Globe } from 'lucide-react';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import { MatchStatus } from '../types/match';

const FORMAT_CONFIG: Record<string, { label: string; badge: string; accent: string; accentBorder: string; accentGlow: string; accentText: string; matchLabel: string; isTest: boolean }> = {
  IPL:  { label: 'IPL 2026',          badge: '🏏 FRANCHISE',        accent: 'from-blue-900/50 to-indigo-950/30',   accentBorder: 'border-blue-500/20',    accentGlow: 'bg-blue-600/10',    accentText: 'text-blue-400',    matchLabel: 'League Match',       isTest: false },
  T20:  { label: 'T20I 2026',          badge: '⚡ T20 INTERNATIONAL', accent: 'from-emerald-900/40 to-teal-950/20', accentBorder: 'border-emerald-500/20', accentGlow: 'bg-emerald-600/10', accentText: 'text-emerald-400', matchLabel: 'T20 International', isTest: false },
  ODI:  { label: 'ODI 2026',           badge: '🌍 ODI INTERNATIONAL', accent: 'from-sky-900/40 to-blue-950/20',     accentBorder: 'border-sky-500/20',     accentGlow: 'bg-sky-600/10',     accentText: 'text-sky-400',     matchLabel: 'ODI International', isTest: false },
  TEST: { label: 'TEST SERIES 2026',   badge: '🏆 TEST MATCH',        accent: 'from-rose-900/40 to-red-950/20',    accentBorder: 'border-rose-500/20',    accentGlow: 'bg-rose-600/10',    accentText: 'text-rose-400',    matchLabel: 'Test Match',        isTest: true  },
};

const IPL_LOGOS: Record<string, string> = {
  MI:   'https://cricketvectors.akamaized.net/Teams/F.png',
  CSK:  'https://cricketvectors.akamaized.net/Teams/G.png',
  RCB:  'https://cricketvectors.akamaized.net/Teams/K.png',
  KKR:  'https://cricketvectors.akamaized.net/Teams/J.png',
  GT:   'https://cricketvectors.akamaized.net/Teams/KB.png',
  RR:   'https://cricketvectors.akamaized.net/Teams/M.png',
  DC:   'https://cricketvectors.akamaized.net/Teams/H.png',
  LSG:  'https://cricketvectors.akamaized.net/Teams/KC.png',
  SRH:  'https://cricketvectors.akamaized.net/Teams/L.png',
  PBKS: 'https://cricketvectors.akamaized.net/Teams/I.png',
};

function getTeamLogo(team?: { shortName: string; logo?: string } | null): string | null {
  if (!team) return null;
  return getIntlTeamLogoUrl(team.shortName) || IPL_LOGOS[team.shortName] || team.logo || null;
}

const DETAILED_RULES: Record<string, { title: string; desc: string; rules: string[] }> = {
  IPL: {
    title: 'How the Match is Played',
    desc: 'An Indian Premier League (IPL) T20 match is a fast-paced cricket game where two teams of 11 players compete, each getting a maximum of 20 overs (120 legal balls) to bat and score as many runs as possible.',
    rules: [
      'The Toss: The winner decides whether to bat or bowl first.',
      'Innings: The first team bats for 20 overs (or 10 wickets) to set a target.',
      'Powerplay: The first 6 overs feature fielding restrictions (only 2 fielders outside the 30-yard circle).',
      'Impact Player: Teams can use one tactical substitute per match.',
    ]
  },
  ODI: {
    title: 'How ODI Matches Are Played',
    desc: 'A One Day International (ODI) cricket match is a limited-overs game designed to be completed in a single day over a maximum of 50 overs per side (300 legal balls).',
    rules: [
      'Innings: Each team gets one turn to bat, limited to a max of 50 overs or 10 wickets.',
      'Bowler Limits: No single bowler can bowl more than 10 overs.',
      'Powerplay 1 (1–10 overs): Max 2 fielders outside 30-yard circle.',
      'Powerplay 2 (11–40 overs): Max 4 fielders outside 30-yard circle.',
      'Powerplay 3 (41–50 overs): Max 5 fielders outside 30-yard circle.',
    ]
  },
  T20: {
    title: 'How a T20 Match is Played',
    desc: 'A T20 cricket match is a fast-paced game where each team gets one innings of 20 overs (120 legal balls) to score the most runs.',
    rules: [
      'Innings: Team batting first sets a target. Team batting second chases within 20 overs.',
      'Powerplay: The first 6 overs restrict fielders outside the 30-yard circle.',
      'Outs: An innings ends if a team loses 10 wickets or uses all 120 balls.',
      'Winning: Team with most runs wins. Ties are broken by a Super Over.'
    ]
  },
  TEST: {
    title: 'How Test Matches Are Played',
    desc: 'Test matches are played over five days with each team getting up to two innings to score the most runs and dismiss the opposing team.',
    rules: [
      'Duration: Scheduled for up to five days, with about 90 overs of play each day.',
      'Innings Structure: Each team can bat and bowl twice. No maximum limit on overs.',
      'Ending an Innings: Ends when 10 batters are out or the captain declares.',
      'Winning/Drawing: Team with most runs after all innings wins. Ends in a draw if time runs out.'
    ]
  }
};

function RulesBar({ format }: { format: string }) {
  const colors: Record<string, string> = { IPL: 'bg-blue-500', ODI: 'bg-sky-500', T20: 'bg-emerald-500', TEST: 'bg-rose-500' };
  const r = DETAILED_RULES[format] || DETAILED_RULES.T20;
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-3xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-1.5 h-6 rounded-full shrink-0 ${colors[format] || 'bg-zinc-500'}`} />
        <h3 className="text-base font-black text-white tracking-tight">{r.title}</h3>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed mb-4">{r.desc}</p>
      <ul className="space-y-2">
        {r.rules.map((rule, idx) => {
          const split = rule.split(':');
          return (
            <li key={idx} className="text-sm flex gap-2">
              <span className="text-zinc-500 mt-1 shrink-0">•</span>
              <span className="text-zinc-300">
                <strong className="text-white font-bold">{split[0]}:</strong> {split.slice(1).join(':')}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ArenaDashboard() {
  const { setGameState, setActiveTab, selectedFormat, selectedFranchiseId, franchises, players, selectedSquadIds, fixtures, standings } = useGameStore();
  const fmt = FORMAT_CONFIG[selectedFormat || 'T20'] || FORMAT_CONFIG.T20;
  const isIPL  = selectedFormat === 'IPL';
  const isTest = selectedFormat === 'TEST';

  const team     = franchises.find(f => f.id === selectedFranchiseId);
  const squad    = players.filter(p => selectedSquadIds.includes(p.id));
  const teamLogo = team ? getTeamLogo(team) : null;

  const teamStrength = useMemo(() => {
    if (squad.length === 0) return 0;
    return squad.reduce((acc, p) => acc + p.rating, 0) / squad.length;
  }, [squad]);

  const nextMatch = useMemo(() =>
    fixtures.find(f => (f.team1Id === selectedFranchiseId || f.team2Id === selectedFranchiseId) && f.status === MatchStatus.UPCOMING),
    [fixtures, selectedFranchiseId]
  );

  const opponentId   = nextMatch ? (nextMatch.team1Id === selectedFranchiseId ? nextMatch.team2Id : nextMatch.team1Id) : null;
  const opponent     = franchises.find(f => f.id === opponentId);
  const opponentLogo = opponent ? getTeamLogo(opponent) : null;

  const teamStanding     = standings.find(s => s.teamId === selectedFranchiseId);
  const sortedStandings  = [...standings].sort((a, b) => b.points !== a.points ? b.points - a.points : b.nrr - a.nrr);
  const position         = sortedStandings.findIndex(s => s.teamId === selectedFranchiseId) + 1;
  const totalMatches     = fixtures.filter(f => !f.isPlayoff && (f.team1Id === selectedFranchiseId || f.team2Id === selectedFranchiseId)).length;
  const completedMatches = fixtures.filter(f => !f.isPlayoff && (f.team1Id === selectedFranchiseId || f.team2Id === selectedFranchiseId) && f.status === MatchStatus.COMPLETED).length;

  React.useEffect(() => {
    if (!team) {
      setGameState(GameState.LANDING);
    }
  }, [team, setGameState]);

  if (!team) return null;

  const playBtnClass = selectedFormat === 'IPL' ? 'bg-blue-600 hover:bg-blue-500' : selectedFormat === 'ODI' ? 'bg-sky-600 hover:bg-sky-500' : selectedFormat === 'TEST' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500';
  const progressClass = selectedFormat === 'IPL' ? 'bg-blue-500' : selectedFormat === 'ODI' ? 'bg-sky-500' : selectedFormat === 'TEST' ? 'bg-rose-500' : 'bg-emerald-500';
  const oversLabel = isTest ? '5 Days' : selectedFormat === 'ODI' ? '50 Overs' : '20 Overs';

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans overflow-y-auto pb-12 relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={`absolute top-0 right-0 w-[700px] h-[700px] rounded-full blur-[150px] ${fmt.accentGlow}`} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-zinc-900/20 blur-[100px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 relative z-10">

        {/* Team Hero */}
        <div className={`rounded-3xl border p-8 mb-6 relative overflow-hidden ${fmt.accentBorder} bg-gradient-to-br ${fmt.accent}`}>
          {teamLogo && <div className="absolute right-6 top-6 opacity-[0.06] pointer-events-none"><img src={teamLogo} alt="" className="w-48 h-48 object-contain" /></div>}
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-2">
              {teamLogo
                ? <img src={teamLogo} alt={team.name} className="w-full h-full object-contain drop-shadow-xl" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                : <Shield className="w-10 h-10 text-zinc-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${fmt.accentText}`}>{fmt.label}</div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight truncate">{team.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold"><Users className="w-3.5 h-3.5" />{squad.length} players</span>
                {isIPL
                  ? <span className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold"><Zap className="w-3.5 h-3.5" />Franchise</span>
                  : <span className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold"><Globe className="w-3.5 h-3.5" />International</span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Squad Rating</div>
              <div className="text-4xl font-black">{teamStrength.toFixed(1)}</div>
              <div className={`text-xs font-bold ${fmt.accentText}`}>OVERALL</div>
            </div>
          </div>
        </div>

        {/* Next Match */}
        <div
          className={`rounded-3xl border p-6 mb-6 transition-all ${nextMatch ? `${fmt.accentBorder} bg-gradient-to-br ${fmt.accent} cursor-pointer hover:scale-[1.01] active:scale-[0.99]` : 'border-zinc-800 bg-zinc-900/60'}`}
          onClick={() => { if (nextMatch) { useGameStore.setState({ currentMatchId: nextMatch.id }); useGameStore.getState().setGameState(GameState.PLAYING_XI_BUILDER); } }}
        >
          {nextMatch ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* User team logo */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-1.5">
                    {teamLogo ? <img src={teamLogo} alt={team.shortName} className="w-full h-full object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Shield className="w-7 h-7 text-zinc-500" />}
                  </div>
                  <span className="text-xs font-black">{team.shortName}</span>
                </div>
                {/* Match info */}
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={`text-[9px] font-black uppercase tracking-widest animate-pulse ${fmt.accentText}`}>NEXT {fmt.matchLabel.toUpperCase()}</div>
                  <span className="text-2xl font-black text-zinc-400">VS</span>
                  <div className="text-[10px] text-zinc-500 text-center font-semibold">Match {nextMatch.matchNumber} · {oversLabel}</div>
                </div>
                {/* Opponent logo */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-1.5">
                    {opponentLogo ? <img src={opponentLogo} alt={opponent?.shortName} className="w-full h-full object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Shield className="w-7 h-7 text-zinc-500" />}
                  </div>
                  <span className="text-xs font-black text-zinc-400">{opponent?.shortName}</span>
                </div>
              </div>
              <button className={`shrink-0 px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2 text-white ${playBtnClass}`}>
                Play <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-center py-4 text-zinc-500"><Trophy className="w-8 h-8 mx-auto mb-2 text-amber-500" /><div className="font-bold">Season Complete</div></div>
          )}
        </div>

        {/* Season Progress */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Activity className="w-5 h-5 text-zinc-400" /><h3 className="text-base font-black">Season Progress</h3></div>
            <span className="text-[10px] font-bold text-zinc-600 uppercase">{completedMatches}/{totalMatches} Played</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full mb-6 overflow-hidden">
            <div className={`h-full rounded-full ${progressClass}`} style={{ width: totalMatches > 0 ? `${(completedMatches / totalMatches) * 100}%` : '0%' }} />
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Matches', val: String(teamStanding?.played || 0), color: 'text-white' },
              { label: 'Wins',    val: String(teamStanding?.won || 0),    color: 'text-emerald-400' },
              { label: 'Losses',  val: String(teamStanding?.lost || 0),   color: 'text-red-400' },
              { label: isTest ? 'Draws' : 'Points', val: String(isTest ? ((teamStanding as any)?.drawn || 0) : (teamStanding?.points || 0)), color: 'text-white' },
              { label: 'Rank',    val: position ? `#${position}` : '—',   color: 'text-amber-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</span>
                <span className={`text-2xl sm:text-3xl font-black ${color}`}>{val}</span>
              </div>
            ))}
          </div>
          {!isTest && teamStanding && (
            <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center gap-5 flex-wrap text-sm">
              <div>
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">NRR </span>
                <span className={`font-black ${(teamStanding.nrr || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(teamStanding.nrr || 0) >= 0 ? '+' : ''}{(teamStanding.nrr || 0).toFixed(3)}</span>
              </div>
              {teamStanding.form?.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase">Form</span>
                  <div className="flex gap-1.5">
                    {teamStanding.form.slice(-5).map((r, i) => (
                      <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${r === 'W' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rules bar */}
        <RulesBar format={selectedFormat || 'T20'} />

        {/* Quick Access */}
        <div>
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-1">Quick Access</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onClick={() => setActiveTab(isTest ? 'SERIES' : 'MATCHES')} className="p-5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 rounded-2xl flex flex-col gap-3 transition-all text-left group hover:scale-[1.02]">
              <Calendar className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
              <div><div className="font-bold text-sm">Schedule</div><div className="text-[10px] text-zinc-500 mt-0.5">Matches & Table</div></div>
            </button>
            {!isIPL && (
              <button onClick={() => setActiveTab('SQUAD')} className="p-5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 rounded-2xl flex flex-col gap-3 transition-all text-left group hover:scale-[1.02]">
                <Users className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div><div className="font-bold text-sm">Squad</div><div className="text-[10px] text-zinc-500 mt-0.5">Manage squad</div></div>
              </button>
            )}
            {isIPL && (
              <button onClick={() => setActiveTab('AUCTION')} className="p-5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 rounded-2xl flex flex-col gap-3 transition-all text-left group hover:scale-[1.02]">
                <Zap className="w-6 h-6 text-yellow-400 group-hover:scale-110 transition-transform" />
                <div><div className="font-bold text-sm">Auction Room</div><div className="text-[10px] text-zinc-500 mt-0.5">Buy players</div></div>
              </button>
            )}
            <button onClick={() => setGameState(GameState.PLAYING_XI_BUILDER)} className="p-5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 rounded-2xl flex flex-col gap-3 transition-all text-left group hover:scale-[1.02]">
              <Shield className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
              <div><div className="font-bold text-sm">Playing XI</div><div className="text-[10px] text-zinc-500 mt-0.5">Pick your 11</div></div>
            </button>
            <button onClick={() => setActiveTab('TEAM_STATS')} className="p-5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 rounded-2xl flex flex-col gap-3 transition-all text-left group hover:scale-[1.02]">
              <BarChart3 className="w-6 h-6 text-orange-400 group-hover:scale-110 transition-transform" />
              <div><div className="font-bold text-sm">Team Stats</div><div className="text-[10px] text-zinc-500 mt-0.5">Performance data</div></div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
