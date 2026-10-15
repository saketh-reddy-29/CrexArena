import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';

export const IPL_TEAM_LOGOS: Record<string, string> = {
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

export function resolveTeamLogoUrl(shortName?: string, fallbackLogo?: string): string {
  if (!shortName) return fallbackLogo || '';
  return getIntlTeamLogoUrl(shortName) || IPL_TEAM_LOGOS[shortName] || fallbackLogo || '';
}
