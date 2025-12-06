import React, { useState, useEffect, useContext, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SocketContext } from '../App';

function Admin() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const appSocket = useContext(SocketContext);

  const loadMiningStats = useCallback(() => {
    if (!appSocket || !appSocket.connected) {
      setError('Not connected to server');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    appSocket.emit('admin:getMiningStats', {}, (response) => {
      setLoading(false);
      
      if (response?.success) {
        setStats(response);
      } else {
        setError(response?.error || 'Failed to load mining stats');
      }
    });
  }, [appSocket]);

  useEffect(() => {
    loadMiningStats();
    
    // Auto-refresh every 10 seconds
    const refreshInterval = setInterval(loadMiningStats, 10000);
    
    return () => clearInterval(refreshInterval);
  }, [loadMiningStats]);

  const formatNumber = (num) => {
    return num.toLocaleString(undefined, { 
      maximumFractionDigits: 5, 
      minimumFractionDigits: 2 
    });
  };

  return (
    <motion.div 
      className="relative min-h-screen text-white font-sans overflow-x-hidden pb-24"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4 } } }}
      initial="hidden"
      animate="visible"
    >
      <div className="grok-bg" />
      <div className="relative z-10 max-w-xl mx-auto px-4 pt-4">
        {/* Header */}
        <motion.div 
          className="flex items-center justify-between mb-6 mt-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-white">Admin</h1>
          <button
            onClick={loadMiningStats}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-xl"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-red-400 text-sm">{error}</div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && !stats && (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading mining stats...</div>
          </div>
        )}

        {/* Stats Summary */}
        {stats && (
          <>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {/* Total Players Card */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50">
                <div className="text-sm text-gray-300 mb-2">Active Miners</div>
                <div className="text-3xl font-bold text-white">{stats.totalPlayers}</div>
              </div>

              {/* Total PHMN Balance Card */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50">
                <div className="text-sm text-gray-300 mb-2">Total Balance of all users</div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-white">
                    {stats.totalPHMNBalance !== undefined ? formatNumber(stats.totalPHMNBalance) : '...'}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Players List */}
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <h2 className="text-lg font-bold text-white mb-3">Players</h2>
              
              {stats.players.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No active mining sessions
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.players.map((player, index) => (
                    <motion.div
                      key={player.telegramId}
                      className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-4 border border-gray-700/50"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-white mb-1">
                            {player.name}
                          </div>
                        </div>
                        <div className="text-right">
                        </div>
                      </div>
                    
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default Admin;

