import React, { useState } from 'react';
import { useGameStore, GameState } from '../../stores/useGameStore';
import { X, Save, RefreshCw, Trash2, Volume2, VolumeX, Gauge, Shield, Database, Check, Cloud, CloudCheck, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import GoogleAccountModal from '../auth/GoogleAccountModal';
import GoogleLoginButton from '../auth/GoogleLoginButton';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { 
    selectedFormat, 
    selectedFranchiseId, 
    franchises, 
    setGameState,
    fixtures,
    standings,
    authUser,
    cloudSaveStatus,
    lastCloudSaveTime,
    saveToCloud,
    loadFromCloud,
    logoutGoogle,
  } = useGameStore();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [defaultSpeed, setDefaultSpeed] = useState<number>(1);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncFeedback, setCloudSyncFeedback] = useState<string | null>(null);

  const team = franchises.find(f => f.id === selectedFranchiseId);

  const handleManualSave = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Trigger zustand persistence flush and cloud save if logged in
        if (authUser) {
          saveToCloud();
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  };

  const handleCloudSync = async () => {
    setIsCloudSyncing(true);
    try {
      const res = await saveToCloud();
      setCloudSyncFeedback(res.message);
      setTimeout(() => setCloudSyncFeedback(null), 3000);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleResetTournament = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cricket-arena-v3');
        window.location.reload();
      }
    } catch (e) {
      console.error('Reset error:', e);
    }
  };

  return (
    <>
      {showGoogleModal && <GoogleAccountModal onClose={() => setShowGoogleModal(false)} />}
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              ⚙️
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Career & Simulation Settings</h2>
              <p className="text-[11px] text-slate-500">Manage persistence, simulation speed, and tournament preferences</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-xs">
          
          {/* Active Career Info */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Career</span>
              <div className="text-sm font-black text-slate-900 mt-0.5">{team?.name || 'Franchise Career'}</div>
              <div className="text-[11px] text-blue-700 font-bold">{selectedFormat || 'IPL'} 2026 Tournament</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Matches Scheduled</span>
              <div className="text-sm font-black text-slate-900 mt-0.5 tabular-nums">{fixtures.length} Fixtures</div>
            </div>
          </div>

          {/* Simulation Preferences */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-blue-600" />
              Simulation Preferences
            </h3>

            <div className="grid grid-cols-2 gap-3">
              
              {/* Default Speed */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Default Ball Speed</span>
                <div className="flex items-center gap-1">
                  {[1, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setDefaultSpeed(spd)}
                      className={cn(
                        "flex-1 py-1 rounded-lg text-xs font-bold transition-all",
                        defaultSpeed === spd 
                          ? "bg-slate-900 text-white shadow-xs" 
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Effects */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Audio Effects</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={cn(
                    "w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                    soundEnabled 
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  )}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{soundEnabled ? 'Audio Enabled' : 'Muted'}</span>
                </button>
              </div>

            </div>
          </div>

          {/* Persistence & Save Management */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-600" />
                Google Cloud Backup & Storage
              </span>
              {authUser && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Synced
                </span>
              )}
            </h3>

            {/* Google Account Status Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
              {authUser ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {authUser.picture ? (
                      <img src={authUser.picture} alt={authUser.name} className="w-8 h-8 rounded-full border border-blue-400 object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                        {authUser.name[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">{authUser.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{authUser.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGoogleModal(true)}
                    className="px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    Manage
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Sign in with Google to Save</div>
                      <div className="text-[10px] text-slate-500">Enable cloud auto-save and sync across devices</div>
                    </div>
                  </div>
                  <GoogleLoginButton
                    onClick={() => setShowGoogleModal(true)}
                    size="sm"
                    variant="rectangular"
                    text="Sign in with Google to Save"
                    className="w-full justify-center"
                  />
                </div>
              )}

              {authUser && (
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <button
                    onClick={handleCloudSync}
                    disabled={isCloudSyncing}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isCloudSyncing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{isCloudSyncing ? 'Syncing...' : 'Sync to Cloud'}</span>
                  </button>

                  <button
                    onClick={() => setShowGoogleModal(true)}
                    className="py-1.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs transition-colors"
                  >
                    Account Details
                  </button>
                </div>
              )}

              {cloudSyncFeedback && (
                <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-center">
                  {cloudSyncFeedback}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleManualSave}
                className={cn(
                  "w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all",
                  saveSuccess 
                    ? "bg-emerald-600 text-white" 
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                )}
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Career Saved Successfully!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Career Progress</span>
                  </>
                )}
              </button>

              <div className="pt-2">
                {resetConfirm ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center space-y-2">
                    <p className="text-xs font-bold text-rose-800">
                      Are you sure? This will reset all current tournament progress.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResetTournament}
                        className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                      >
                        Confirm Reset
                      </button>
                      <button
                        onClick={() => setResetConfirm(false)}
                        className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setResetConfirm(true)}
                    className="w-full py-2 px-4 rounded-xl font-semibold text-xs text-rose-600 hover:bg-rose-50 border border-rose-200/60 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset Tournament Progress</span>
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Cricket Arena Engine v3.2</span>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
    </>
  );
}
