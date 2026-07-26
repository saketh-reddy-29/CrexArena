// CREX CDN image mappings for IPL teams
// Jersey URL pattern: https://cricketvectors.akamaized.net/jersey/limited/org/{CODE}.png
// Logo URL pattern:   https://cricketvectors.akamaized.net/Teams/{CODE}.png

const CREX_CDN = 'https://cricketvectors.akamaized.net';

export const CREX_TEAM_CODES: Record<string, string> = {
  MI:   'F',
  CSK:  'G',
  DC:   'H',
  PBKS: 'I',
  KKR:  'J',
  RCB:  'K',
  SRH:  'L',
  RR:   'M',
  GT:   'KB',
  LSG:  'KC',
};

export function getTeamJerseyUrl(shortName: string): string | null {
  const code = CREX_TEAM_CODES[shortName];
  if (!code) return null;
  return `${CREX_CDN}/jersey/limited/org/${code}.png`;
}

export function getTeamLogoUrl(shortName: string): string | null {
  const code = CREX_TEAM_CODES[shortName];
  if (!code) return null;
  return `${CREX_CDN}/Teams/${code}.png`;
}
