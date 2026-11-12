import { GoogleUserProfile } from '../types/auth';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: (notification?: any) => void;
          disableAutoSelect: () => void;
          revoke: (hint: string, done: () => void) => void;
        };
      };
    };
  }
}

const DEFAULT_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/**
 * Safely decodes a Google JWT id_token without external dependencies
 */
export function decodeGoogleJwt(token: string): GoogleUserProfile | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    
    // Convert base64url to standard base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    
    return {
      id: payload.sub || `google_user_${Date.now()}`,
      email: payload.email || 'user@gmail.com',
      name: payload.name || payload.email?.split('@')[0] || 'Cricket Fan',
      picture: payload.picture,
      givenName: payload.given_name,
      familyName: payload.family_name,
      token,
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[GoogleAuth] Failed to decode Google JWT token:', err);
    return null;
  }
}

/**
 * Dynamically loads Google Identity Services script into document
 */
export function loadGoogleScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    
    if (window.google?.accounts?.id) {
      return resolve(true);
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('[GoogleAuth] Failed to load Google Identity Services script');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * Initializes Google Identity Services
 */
export async function initializeGoogleAuth(
  onSuccess: (profile: GoogleUserProfile) => void,
  clientId?: string
): Promise<boolean> {
  const loaded = await loadGoogleScript();
  const activeClientId = clientId || DEFAULT_CLIENT_ID;

  if (!loaded || !window.google?.accounts?.id) {
    return false;
  }

  if (!activeClientId) {
    // GIS requires a client ID; caller can use demo sign-in or provide clientId
    return false;
  }

  try {
    window.google.accounts.id.initialize({
      client_id: activeClientId,
      callback: (response: { credential?: string }) => {
        if (response.credential) {
          const profile = decodeGoogleJwt(response.credential);
          if (profile) {
            onSuccess(profile);
          }
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    return true;
  } catch (err) {
    console.error('[GoogleAuth] Error initializing Google Auth:', err);
    return false;
  }
}

/**
 * Render the official Google Sign-In button into a DOM container
 */
export function renderGoogleButton(
  container: HTMLElement,
  options?: {
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    width?: number;
  }
): boolean {
  if (!window.google?.accounts?.id || !container) {
    return false;
  }

  try {
    window.google.accounts.id.renderButton(container, {
      theme: options?.theme || 'outline',
      size: options?.size || 'large',
      text: options?.text || 'continue_with',
      shape: options?.shape || 'pill',
      width: options?.width || 250,
    });
    return true;
  } catch (err) {
    console.error('[GoogleAuth] Error rendering Google button:', err);
    return false;
  }
}

/**
 * Creates a standard verified demo/dev Google profile for seamless instant login
 */
export function createDemoGoogleProfile(customEmail?: string, customName?: string): GoogleUserProfile {
  const email = customEmail || 'cricket.fan@gmail.com';
  const name = customName || (email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Cricket Manager');
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'CA';
  
  // High quality Google-style avatar SVG
  const avatarSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%231E3A8A"/><stop offset="100%" stop-color="%232563EB"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(%23g)"/><text x="48" y="58" font-family="system-ui,sans-serif" font-size="34" font-weight="700" fill="white" text-anchor="middle">${initials}</text></svg>`;

  return {
    id: `google_demo_${hashString(email)}`,
    email,
    name,
    picture: avatarSvg,
    givenName: name.split(' ')[0],
    familyName: name.split(' ').slice(1).join(' ') || '',
    token: `demo_token_${Date.now()}`,
    lastSyncedAt: new Date().toISOString(),
  };
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
