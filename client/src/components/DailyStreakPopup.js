import React from 'react';
import { motion } from 'framer-motion';

const DailyStreakPopup = ({
    isOpen,
    onClose,
    streakData,
    onClaim,
    isLoading
}) => {
    if (!isOpen) return null;

    const rewards = [0.1, 0.3, 0.6, 0.9, 1.3, 1.6, 2.0];
    const { streak, canClaim } = streakData || { streak: 0, canClaim: false };

    const getStatus = (index) => {
        if (index < streak) return 'claimed';
        if (index === streak) return canClaim ? 'claimable' : 'current';
        return 'locked';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#131722] border border-white/10 rounded-2xl w-full max-w-[320px] overflow-hidden shadow-2xl relative"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10"
                >
                    <span className="text-xs">✕</span>
                </button>

                {/* Header */}
                <div className="pt-5 pb-3 px-5 text-center">
                    <h2 className="text-lg font-bold text-white mb-0.5">
                        Daily Streak
                    </h2>
                    <p className="text-gray-400 text-[11px]">
                        Watch ads daily to keep your streak
                    </p>
                </div>

                {/* Calendar Grid */}
                <div className="p-4 pt-0">
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        {rewards.map((reward, index) => {
                            const status = getStatus(index);
                            const dayNum = index + 1;
                            const isLarge = index === 6; // Day 7

                            return (
                                <div
                                    key={index}
                                    className={`
                    relative rounded-lg flex flex-col items-center justify-center transition-all duration-300 border
                    ${isLarge ? 'col-span-4 h-14 flex-row gap-3' : 'h-16'}
                    ${status === 'claimed'
                                            ? 'bg-purple-900/30 border-purple-500/30 text-purple-100'
                                            : status === 'claimable'
                                                ? 'bg-purple-600/30 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                                                : status === 'current'
                                                    ? 'bg-white/5 border-white/20 text-gray-400'
                                                    : 'bg-white/5 border-transparent text-gray-600 opacity-60'
                                        }
                  `}
                                >
                                    <div className={`text-[9px] uppercase tracking-wide opacity-60 ${isLarge ? 'mb-0' : 'mb-0.5'}`}>
                                        {isLarge ? 'Day 7 Bonus' : `Day ${dayNum}`}
                                    </div>

                                    {status === 'claimed' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                                            <span className="text-lg">✓</span>
                                        </div>
                                    )}

                                    <div className={`font-bold leading-none ${isLarge ? 'text-xl' : 'text-sm'}`}>
                                        {reward} <span className="text-[8px] font-normal opacity-70">PHMN</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-center text-[10px] text-red-400/70 mb-3 h-3">
                        {!canClaim && streak > 0 ? "Next reward available tomorrow" : ""}
                    </p>

                    <button
                        onClick={onClaim}
                        disabled={!canClaim || isLoading}
                        className={`w-full py-3 rounded-xl font-semibold text-sm relative overflow-hidden transition-all
              ${canClaim
                                ? 'text-white hover:opacity-90 active:scale-[0.98]'
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {canClaim ? (
                            <>
                                <div className="absolute inset-0 bg-gradient-to-r from-[#a855f7] to-[#7c3aed]"></div>
                                <div className="relative flex items-center justify-center gap-2">
                                    <span>Watch Ad & Claim</span>
                                </div>
                            </>
                        ) : (
                            'Claimed'
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default DailyStreakPopup;
