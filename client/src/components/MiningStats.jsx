import React, { useState, useEffect, useContext, useMemo } from 'react';
import { SocketContext } from '../App';
import { motion, AnimatePresence } from 'framer-motion';

function MiningStats({ telegramUser, refreshTrigger }) {
  const [miningStats, setMiningStats] = useState(null);
  const [rankStats, setRankStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const socket = useContext(SocketContext);

  // Animation variants for staggered content - simplified for performance
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  };

  const statVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  };

  useEffect(() => {
    console.log('🔍 MiningStats useEffect - telegramUser:', telegramUser, 'socket:', !!socket, 'refreshTrigger:', refreshTrigger);
    console.log('🔍 MiningStats: useEffect triggered with refreshTrigger:', refreshTrigger);

    // If Telegram user or socket is missing (common on first load on mobile), stop loading and show a hint
    if (!telegramUser || !socket) {
      console.log('❌ MiningStats: Missing telegramUser or socket');
      setLoading(false);
      setError('Telegram not initialized. Please reopen the WebApp.');
      return;
    }

    console.log('📤 MiningStats: Emitting mining:getStats for telegramId:', telegramUser.id, 'refreshTrigger:', refreshTrigger);

    // Get mining stats and rank stats
    socket.emit('mining:getStats', telegramUser.id);
    socket.emit('rank:getStats', telegramUser.id);

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('⏰ MiningStats: Request timeout, setting error');
      setError('Request timeout - please try again');
      setLoading(false);
    }, 10000); // 10 seconds

    // Listen for mining stats
    const handleMiningStats = (data) => {
      console.log('📥 MiningStats: Received mining:stats response:', data, 'refreshTrigger:', refreshTrigger);
      // Clear timeout immediately when we get any response
      clearTimeout(timeout);

      if (data?.success) {
        console.log('✅ MiningStats: Setting mining stats:', data);
        setMiningStats(data);
      } else {
        console.log('❌ MiningStats: Error in response:', data?.error);
        setError(data?.error || 'Failed to load mining stats');
        setLoading(false);
      }
    };

    // Listen for rank stats
    const handleRankStats = (data) => {
      console.log('📥 MiningStats: Received rank:stats response:', data, 'refreshTrigger:', refreshTrigger);
      
      if (data?.success) {
        console.log('✅ MiningStats: Setting rank stats:', data);
        setRankStats(data);
      } else {
        console.log('❌ MiningStats: Error in rank stats response:', data?.error);
        setError(data?.error || 'Failed to load rank stats');
        setLoading(false);
      }
    };

    console.log('🔌 MiningStats: Adding socket listeners with refreshTrigger:', refreshTrigger);
    socket.on('mining:stats', handleMiningStats);
    socket.on('rank:stats', handleRankStats);

    return () => {
      console.log('🧹 MiningStats: Cleaning up socket listeners for refreshTrigger:', refreshTrigger);
      socket.off('mining:stats', handleMiningStats);
      socket.off('rank:stats', handleRankStats);
      clearTimeout(timeout);
    };
  }, [telegramUser, socket, refreshTrigger]); // Add refreshTrigger to dependencies

  // Handle when both mining and rank stats are loaded
  useEffect(() => {
    if (miningStats && rankStats) {
      setLoading(false);
      setError(null);
    }
  }, [miningStats, rankStats]);

  if (loading) {
    return (
      <motion.div 
        className="flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div 
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div 
        className="p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-md mx-auto">
          <motion.div 
            className="bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-red-500/30"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="text-center">
              <motion.div 
                className="text-2xl mb-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                ⚠️
              </motion.div>
              <div className="text-red-400">{error}</div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  const handleSeasonSelect = (season) => {
    setSelectedSeason(selectedSeason?.id === season.id ? null : season);
  };

  return (
    <motion.div 
      className="p-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="max-w-md mx-auto space-y-6">
        <SeasonSelector 
          onSeasonSelect={handleSeasonSelect}
          selectedSeason={selectedSeason}
        />
        
        {miningStats && (
          <SeasonStats miningStats={miningStats} rankStats={rankStats} />
        )}
      </div>
    </motion.div>
  );
}

export default MiningStats; 