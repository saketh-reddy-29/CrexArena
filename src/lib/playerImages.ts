import type { Player } from '../types/common';
import type { SyntheticEvent } from 'react';
import { PLAYER_CREX_IDS } from '../data/crexImages';

export function getPlayerAvatar(name = 'player') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=18181b&color=ffffff&bold=true&format=svg`;
}

export function getPlayerImage(player?: Pick<Player, 'name'> | null) {
  if (!player) return getPlayerAvatar('player');
  
  const crexId = PLAYER_CREX_IDS[player.name];
  if (crexId) {
    return `https://cricketvectors.akamaized.net/players/org/${crexId}.png`;
  }
  
  return getPlayerAvatar(player.name);
}

export function handlePlayerImageError(event: SyntheticEvent<HTMLImageElement>, name = 'player') {
  event.currentTarget.onerror = null;
  event.currentTarget.src = getPlayerAvatar(name);
}
