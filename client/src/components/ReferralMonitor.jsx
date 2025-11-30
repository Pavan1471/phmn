import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { SocketContext } from '../App';

const ReferralMonitor = ({ telegramUser, compact = false }) => {
  const socket = useContext(SocketContext);
  const [referralStats, setReferralStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket || !telegramUser) return;
    loadReferralStats();
  }, [socket, telegramUser]);

  const loadReferralStats = () => {
    if (!socket || !telegramUser) return;
    
    setLoading(true);
    socket.emit('referral:getStats', { telegramId: telegramUser.id }, (res) => {
      if (res?.success) {
        setReferralStats(res.stats);
      }
      setLoading(false);
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (!referralStats) {
    return null;
  }

  if (compact) {
    return (
      <motion.div
        className="bg-[#181830] rounded-lg p-4 border border-gray-700/40"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Referral Stats</h3>
          <span className="text-xs text-gray-400">👥</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-cyan-400">{referralStats.totalReferrals}</div>
            <div className="text-xs text-gray-400">Referrals</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">{referralStats.totalEarnings}</div>
            <div className="text-xs text-gray-400">Earnings</div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="bg-[#181830] rounded-xl p-6 border border-gray-700/40"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Referral Overview</h3>
        <button
          onClick={loadReferralStats}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          🔄
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-800 rounded-lg">
          <div className="text-2xl font-bold text-cyan-400">{referralStats.totalReferrals}</div>
          <div className="text-sm text-gray-400">Total Referrals</div>
        </div>
        <div className="text-center p-4 bg-gray-800 rounded-lg">
          <div className="text-2xl font-bold text-green-400">{referralStats.totalEarnings}</div>
          <div className="text-sm text-gray-400">Total Earnings</div>
        </div>
      </div>

      {/* Recent Referrals */}
      {referralStats.referrals.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-white mb-3">Recent Referrals</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {referralStats.referrals.slice(0, 5).map((ref) => (
              <div key={ref.telegramId} className="bg-gray-800 rounded-lg p-3">
                <div className="text-white font-medium">{ref.name}</div>
                <div className="text-sm text-gray-400">
                  Joined: {new Date(ref.joinedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
          {referralStats.referrals.length > 5 && (
            <div className="text-center text-sm text-gray-400 mt-2">
              +{referralStats.referrals.length - 5} more referrals
            </div>
          )}
        </div>
      )}

      {/* Referrer Info */}
      {referralStats.referrer && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h4 className="text-sm font-semibold text-white mb-2">You were referred by:</h4>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-white font-medium">{referralStats.referrer.name}</div>
            <div className="text-xs text-gray-400">ID: {referralStats.referrer.publicId || referralStats.referrer.telegramId}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ReferralMonitor;
