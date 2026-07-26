import React from 'react';
import { Player } from '../types/common';
import { handlePlayerImageError } from '../lib/playerImages';
import { useGameStore } from '../stores/useGameStore';
import { getTeamJerseyUrl } from '../data/crexTeams';
import { PLAYER_CREX_IDS } from '../data/crexImages';
import { cn } from '../lib/utils';

const DEFAULT_JERSEY =
  'https://cricketvectors.akamaized.net/jersey/test/org/16.png';

interface JerseyPlayerImageProps {
  player: Player | null;
  franchiseId?: string | null;
  className?: string;
  imageClassName?: string;
}

export default function JerseyPlayerImage({
  player,
  franchiseId,
  className,
  imageClassName,
}: JerseyPlayerImageProps) {
  const { franchises } = useGameStore();

  const franchise = franchiseId
    ? franchises.find((f) => f.id === franchiseId)
    : player
      ? franchises.find((f) => f.squad.includes(player.id))
      : null;

  const jerseyUrl =
    (franchise ? getTeamJerseyUrl(franchise.shortName) : null) ??
    DEFAULT_JERSEY;

  const crexId = player ? PLAYER_CREX_IDS[player.name] : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        className
      )}
      style={{
        background: franchise
          ? `linear-gradient(to bottom, ${franchise.color}20 0%, ${franchise.color}05 100%)`
          : "#1A2238",
      }}
    >
      {/* 
        CREX approach: both images same width, normal flow, jersey overlaps head 
        with negative margin. Whole composition is pinned to bottom of the card. 
      */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
        {crexId && (
          <img
            src={`https://cricketvectors.akamaized.net/players/org/${crexId}.png`}
            onError={(e) => handlePlayerImageError(e, player?.name)}
            alt={player?.name ?? "Player"}
            draggable={false}
            className={cn(
              "relative z-0 w-full object-contain pointer-events-none select-none",
              imageClassName
            )}
            style={{
              filter:
                "brightness(1.04) contrast(1.06) drop-shadow(0 4px 6px rgba(0,0,0,.28))",
            }}
          />
        )}

        {/* Jersey — same width as head, negative margin overlaps the neck */}
        <img
          src={jerseyUrl}
          alt="jersey"
          draggable={false}
          className="relative z-10 w-full object-contain pointer-events-none select-none"
          style={{
            marginTop: crexId ? "-30%" : undefined,
          }}
        />

        {/* Initials fallback when no CREX head exists */}
        {player && !crexId && (
          <div className="absolute bottom-[27%] z-20">
            <span className="text-[11px] font-bold bg-white/20 px-2 py-1 rounded">
              {player.name
                .split(" ")
                .map((x) => x[0])
                .join("")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

