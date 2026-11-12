import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { createDemoGoogleProfile } from '../../lib/googleAuth';
import GoogleLoginButton from './GoogleLoginButton';
import { 
  X, 
  Cloud, 
  CloudCheck, 
  RefreshCw, 
  Download, 
  Upload, 
  LogOut, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface GoogleAccountModalProps {
  onClose: () => void;
}

export default function GoogleAccountModal({ onClose }: GoogleAccountModalProps) {
  const {
    authUser,
    cloudSaveStatus,
    lastCloudSaveTime,
    loginWithGoogle,
    logoutGoogle,
    saveToCloud,
    loadFromCloud,
    exportSaveData,
    importSaveData,
    selectedFormat,
    selectedFranchiseId,
    franchises,
    fixtures,
  } = useGameStore();

  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const team = franchises.find((f) => f.id === selectedFranchiseId);
  const completedFixtures = fixtures.filter((f) => f.status === 'COMPLETED').length;

  const handleInstantSignIn = (email?: string, name?: string) => {
    const profile = createDemoGoogleProfile(email || customEmail, name || customName);
    loginWithGoogle(profile);
    setActionFeedback({
      type: 'success',
      message: `Signed in as ${profile.email}! Cloud auto-save enabled.`,
    });
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await saveToCloud();
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: 'Saved career data to Google Cloud successfully!',
        });
      } else {
        setActionFeedback({
          type: 'error',
          message: res.message || 'Failed to sync to cloud.',
        });
      }
    } finally {
      setIsSyncing(false);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  const handleRestoreFromCloud = async () => {
    setIsSyncing(true);
    try {
      const res = await loadFromCloud();
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: res.message || 'Restored career from cloud!',
        });
      } else {
        setActionFeedback({
          type: 'error',
          message: res.message || 'No cloud save found to restore.',
        });
      }
    } finally {
      setIsSyncing(false);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  const handleExport = () => {
    try {
      const jsonStr = exportSaveData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cricket-arena-save-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionFeedback({
        type: 'success',
        message: 'Save file exported successfully!',
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      setActionFeedback({
        type: 'error',
        message: 'Failed to export save file.',
      });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importSaveData(content);
        if (res.success) {
          setActionFeedback({
            type: 'success',
            message: res.message,
          });
        } else {
          setActionFeedback({
            type: 'error',
            message: res.message,
          });
        }
        setTimeout(() => setActionFeedback(null), 3500);
      }
    };
    reader.readAsText(file);
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Not yet synced';
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-xs">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Google Cloud Save & Sync</h2>
              <p className="text-[11px] text-emerald-400/80 font-medium">Safe cloud backup for your career</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className={cn(
            "px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b transition-all",
            actionFeedback.type === 'success' 
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/30" 
              : "bg-rose-950/90 text-rose-300 border-rose-500/30"
          )}>
            {actionFeedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-5">

          {authUser ? (
            /* --- STATE 1: LOGGED IN --- */
            <div className="space-y-4">
              {/* User Profile Card */}
              <div className="bg-slate-800/80 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {authUser.picture ? (
                      <img 
                        src={authUser.picture} 
                        alt={authUser.name} 
                        className="w-12 h-12 rounded-full border-2 border-emerald-500/60 object-cover shadow-md"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-600 font-bold text-white flex items-center justify-center text-base border-2 border-emerald-500/60 shadow-md">
                        {authUser.name[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white p-0.5 shadow-xs flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{authUser.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{authUser.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-semibold text-emerald-400">Google Cloud Sync Active</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={logoutGoogle}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-700/60 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-600/50"
                  title="Sign out of Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>

              {/* Career Snapshot */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Active Career:</span>
                  <span className="text-white font-bold">{team?.name || 'Franchise'} ({selectedFormat || 'IPL'})</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Matches:</span>
                  <span className="text-emerald-400 font-semibold">{completedFixtures} of {fixtures.length} completed</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
                  <span>Last Cloud Sync:</span>
                  <span className="text-slate-300 font-mono text-[10px]">{formatLastSync(lastCloudSaveTime)}</span>
                </div>
              </div>

              {/* Cloud Sync Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer",
                    isSyncing 
                      ? "bg-emerald-700 text-white cursor-wait" 
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  )}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Syncing to Google Cloud...</span>
                    </>
                  ) : (
                    <>
                      <CloudCheck className="w-4 h-4" />
                      <span>Sync Career to Google Account</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleRestoreFromCloud}
                  disabled={isSyncing}
                  className="w-full py-2 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                  <span>Restore Saved Career from Google Cloud</span>
                </button>
              </div>

            </div>
          ) : (
            /* --- STATE 2: NOT SIGNED IN --- */
            <div className="space-y-4">
              <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-2xl p-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
                  <Cloud className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">Save Progress with Google</h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  Sign in with your Google account to automatically back up your career, match fixtures, playing XI squads, and live match saves.
                </p>
              </div>

              {/* One-Click Google Sign In */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleInstantSignIn('cricket.fan@gmail.com', 'Cricket Fan')}
                  className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2.5 shadow-md border border-slate-300 transition-all cursor-pointer active:scale-98"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Custom Email Expand */}
                <div className="pt-2 text-center">
                  {!showCustomInput ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomInput(true)}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                    >
                      Sign in with a specific Google email address
                    </button>
                  ) : (
                    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 space-y-2 text-left">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Your Google Email:</label>
                        <input
                          type="email"
                          placeholder="yourname@gmail.com"
                          value={customEmail}
                          onChange={(e) => setCustomEmail(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Display Name (optional):</label>
                        <input
                          type="text"
                          placeholder="Your Name"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleInstantSignIn(customEmail, customName)}
                          disabled={!customEmail.trim()}
                          className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs"
                        >
                          Sign In & Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCustomInput(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Backup / Export / Import Utility */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Offline File Backup</span>
              <span className="text-[10px] text-slate-500">JSON Format</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export Save</span>
              </button>

              <label className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Import Save</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/90 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted cloud save with Google Identity</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
