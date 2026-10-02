import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DeliveryStatusProps {
  stateName: string;
  shotName?: string;
  targetZone?: string;
  batterOutcome?: string;
  isWicket?: boolean;
  bowlerName?: string;
  batterName?: string;
}

export const DeliveryStatus: React.FC<DeliveryStatusProps> = ({
  stateName,
  shotName,
  targetZone,
  batterOutcome,
  isWicket,
  bowlerName,
  batterName,
}) => {
  const isActionActive = stateName !== 'READY' && stateName !== 'PRE_DELIVERY' && stateName !== 'DELIVERY_COMPLETE';

  const getStatusBadge = () => {
    switch (stateName) {
      case 'BOWLER_RUNUP':
        return { label: 'RUN-UP', text: `${bowlerName || 'Bowler'} running in...`, color: 'from-amber-500 to-yellow-500' };
      case 'BALL_RELEASE':
      case 'BALL_IN_FLIGHT':
        return { label: 'IN FLIGHT', text: 'Ball released toward pitch', color: 'from-blue-500 to-cyan-500' };
      case 'BOUNCE':
      case 'BATTER_ACTION':
      case 'CONTACT':
        return { label: 'STROKE', text: `${batterName || 'Batter'} plays ${shotName || 'Shot'}`, color: 'from-emerald-500 to-teal-500' };
      case 'BALL_TRAVEL':
      case 'BOUNDARY_ACTION':
      case 'WICKET_ACTION':
        return {
          label: isWicket ? 'WICKET!' : batterOutcome === 'SIX' ? 'SIX!' : batterOutcome === 'FOUR' ? 'FOUR!' : 'BALL TRAVEL',
          text: `Traversing toward ${targetZone || 'Field'}`,
          color: isWicket ? 'from-red-600 to-rose-500' : batterOutcome === 'SIX' ? 'from-purple-600 to-indigo-500' : batterOutcome === 'FOUR' ? 'from-blue-600 to-cyan-500' : 'from-zinc-700 to-zinc-800',
        };
      case 'SCORECARD_UPDATE':
      case 'CELEBRATION':
        return { label: 'CONFIRMED', text: isWicket ? 'Wicket confirmation & celebration' : `${batterOutcome || 'Runs'} confirmed`, color: 'from-amber-600 to-orange-500' };
      case 'FIELD_CHANGE':
        return { label: 'FIELD RESET', text: 'Fielders repositioning for next ball', color: 'from-indigo-600 to-purple-500' };
      default:
        return { label: 'READY', text: 'Next delivery locked & ready', color: 'from-zinc-700 to-zinc-800' };
    }
  };

  const badge = getStatusBadge();

  return (
    <AnimatePresence>
      {isActionActive && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute top-3 left-3 z-30 flex items-center gap-2.5 bg-black/75 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 shadow-2xl text-xs"
        >
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black text-white uppercase bg-gradient-to-r ${badge.color} shadow-sm animate-pulse`}>
            {badge.label}
          </span>
          <span className="text-zinc-200 font-semibold text-[11px] truncate max-w-[220px]">
            {badge.text}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
