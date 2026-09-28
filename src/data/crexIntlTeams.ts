// CREX CDN image mappings for International teams
// Logo URL pattern: https://cricketvectors.akamaized.net/Teams/{CODE}.png
// Player URL pattern: https://cricketvectors.akamaized.net/players/org/{ID}.png

const CREX_CDN = 'https://cricketvectors.akamaized.net';

// International team CREX codes (from team page URLs)
export const CREX_INTL_TEAM_CODES: Record<string, string> = {
  IND:  'O',
  AUS:  'Q',
  ENG:  'S',
  SA:   'P',
  NZ:   'R',
  PAK:  'U',
  SL:   'T',
  WI:   'V',
  BAN:  'W',
  AFG:  'Y',
  IRE:  'Z',
  ZIM:  'X',
  SCO:  '10',
  NED:  '12',
  NEP:  '19',
  NAM:  '14',
};

export function getIntlTeamLogoUrl(shortName: string): string | null {
  const code = CREX_INTL_TEAM_CODES[shortName];
  if (!code) return null;
  return `${CREX_CDN}/Teams/${code}.png`;
}
