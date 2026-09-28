import type { Player } from '../types/common';
import type { SyntheticEvent } from 'react';
import { PLAYER_CREX_IDS } from '../data/crexImages';
import { INTL_PLAYER_CREX_IDS } from '../data/intlCrexImages';

const ALL_CREX_IDS = { ...PLAYER_CREX_IDS, ...INTL_PLAYER_CREX_IDS };

export function getPlayerAvatar(name = 'player') {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=18181b&textColor=ffffff&fontWeight=700`;
}

export function getPlayerImage(player?: Pick<Player, 'name'> | null) {
  if (!player) return getPlayerAvatar('player');
  
  const crexId = ALL_CREX_IDS[player.name];
  if (crexId) {
    return `/images/players/${crexId.split('/')[0]}.png`;
  }
  
  return getPlayerAvatar(player.name);
}

export function handlePlayerImageError(event: SyntheticEvent<HTMLImageElement>, name = 'player') {
  event.currentTarget.onerror = null;
  event.currentTarget.src = getPlayerAvatar(name);
}
