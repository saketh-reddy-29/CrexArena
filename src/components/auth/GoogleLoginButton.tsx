import React, { useEffect, useRef } from 'react';
import { initializeGoogleAuth, renderGoogleButton } from '../../lib/googleAuth';
import { useGameStore } from '../../stores/useGameStore';
import { GoogleUserProfile } from '../../types/auth';
import { cn } from '../../lib/utils';

interface GoogleLoginButtonProps {
  onSuccess?: (profile: GoogleUserProfile) => void;
  className?: string;
  variant?: 'pill' | 'rectangular' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light' | 'emerald';
  text?: string;
  onClick?: () => void;
}

export default function GoogleLoginButton({
  onSuccess,
  className,
  variant = 'pill',
  size = 'md',
  theme = 'light',
  text = 'Sign in with Google',
  onClick,
}: GoogleLoginButtonProps) {
  const { loginWithGoogle, authUser } = useGameStore();
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const handleSuccessfulLogin = (profile: GoogleUserProfile) => {
    loginWithGoogle(profile);
    if (onSuccess) onSuccess(profile);
  };

  useEffect(() => {
    // Attempt to render native GIS button if configured and container exists
    const clientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID;
    if (clientId && googleBtnContainerRef.current) {
      initializeGoogleAuth(handleSuccessfulLogin, clientId).then((ready) => {
        if (ready && googleBtnContainerRef.current) {
          renderGoogleButton(googleBtnContainerRef.current, {
            theme: theme === 'dark' ? 'filled_black' : 'outline',
            size: size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'medium',
            text: 'signin_with',
            shape: variant === 'pill' ? 'pill' : 'rectangular',
          });
        }
      });
    }
  }, [theme, size, variant]);

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1 gap-1.5 h-8',
    md: 'text-xs px-3.5 py-2 gap-2 h-9',
    lg: 'text-sm px-4 py-2.5 gap-2.5 h-11',
  };

  const themeClasses = {
    light: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs hover:border-slate-400',
    dark: 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 shadow-md hover:border-slate-600',
    emerald: 'bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-100 border border-emerald-500/30 backdrop-blur-md shadow-lg',
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Hidden container for GIS native button if initialized */}
      <div ref={googleBtnContainerRef} className="hidden" />

      {/* Styled Interactive Google Button */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "font-semibold transition-all inline-flex items-center justify-center select-none active:scale-98 cursor-pointer",
          variant === 'pill' ? 'rounded-full' : 'rounded-xl',
          variant === 'icon' ? 'p-2 w-9 h-9 rounded-full' : sizeClasses[size],
          themeClasses[theme],
          className
        )}
      >
        {/* Google Multicolor SVG Logo */}
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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

        {variant !== 'icon' && <span>{text}</span>}
      </button>
    </div>
  );
}
