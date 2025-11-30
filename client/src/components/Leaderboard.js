import React, { useState, useContext, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SocketContext } from '../App';
import cupIcon from '../images/cup.png';
import crownIcon from '../images/crown.png';

function Leaderboard({ telegramUser }) {
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const socket = useContext(SocketContext);

  // Animation variants - simplified for better performance
  const pageVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  };

  const tabVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  };

  // Enhanced list/grid animations
  const listContainerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.04
      }
    }
  };

  const listItemVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
    }
  };

  const tabs = [
    { id: 'leaderboard', label: 'LEADERBOARD', icon: '' }
  ];

  // Get display name (max 8 chars, avoid showing Telegram ID)
  const getDisplayName = (player) => {
    // Prefer live Telegram user data for current user
    if (telegramUser && player.telegramId?.toString() === telegramUser.id?.toString()) {
      const rawSelf = (telegramUser.first_name || telegramUser.username || telegramUser.last_name || 'Player') + '';
      const selfName = rawSelf.trim() || 'Player';
      return selfName.length > 8 ? selfName.slice(0, 8) : selfName;
    }
    const raw = (player.first_name || player.username || player.last_name || 'Player') + '';
    const baseName = raw.trim() || 'Player';
    return baseName.length > 8 ? baseName.slice(0, 8) : baseName;
  };

  // Fetch leaderboard data
const fetchLeaderboard = useCallback(() => {
  setLoading(true);
  setError(null);

  try {
    if (socket) {
      socket.emit('leaderboard:getData');
    } else {
      throw new Error('Socket not connected');
    }
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    setError(error.message || 'Failed to load leaderboard data');
    setLoading(false);
  }
}, [socket]);

  // Listen for leaderboard data
  useEffect(() => {
    if (!socket) return;

    const handleLeaderboardData = (data) => {
      if (data.success) {
        setLeaderboardData(data.leaderboard);
        setLoading(false);
        setError(null);
        console.log('Successfully received leaderboard data');
      } else {
        setError(data.error || 'Failed to load leaderboard data');
        setLoading(false);
      }
    };

    socket.on('leaderboard:data', handleLeaderboardData);

    return () => {
      socket.off('leaderboard:data', handleLeaderboardData);
    };
}, [socket, fetchLeaderboard]);

  // Refresh leaderboard after user data is saved (ensures names are up to date)
  useEffect(() => {
    if (!socket) return;

    const handleUserSaved = (data) => {
      if (data && data.success) {
        fetchLeaderboard();
      }
    };

    socket.on('user:saved', handleUserSaved);
    return () => socket.off('user:saved', handleUserSaved);
}, [socket, fetchLeaderboard]);

  // Fetch leaderboard when tab is switched to leaderboard
  useEffect(() => {
    if (activeTab === 'leaderboard' && !leaderboardData) {
      fetchLeaderboard();
    }
  }, [activeTab, leaderboardData, fetchLeaderboard]);

  // Get all players
  const getFilteredPlayers = () => {
    if (!leaderboardData || !leaderboardData.players) return [];
    return leaderboardData.players || [];
  };

  // Get top 3 players
  const getTop3Players = () => {
    const players = getFilteredPlayers();
    return players.slice(0, 3);
  };

  const renderLeaderboardContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-16">
          <div className="text-2xl mb-3">🚫</div>
          <div className="text-white font-semibold mb-1.5">Error: {error}</div>
          <div className="text-gray-400 text-sm">Failed to load leaderboard data.</div>
          <button
            onClick={fetchLeaderboard}
            className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!leaderboardData) {
      return (
        <div className="text-center py-16">
          <div className="text-3xl mb-3">📊</div>
          <div className="text-white font-semibold mb-1.5">Leaderboard</div>
          <div className="text-gray-400 text-sm">Loading global rankings...</div>
        </div>
      );
    }

    const top3Players = getTop3Players();
    const remainingPlayers = getFilteredPlayers().slice(3);

    return (
      <div className="p-1 max-w-6xl mx-auto">
        {/* Top 3 Players Section */}
        {top3Players.length > 0 && (
          <div className="mb-6 px-3">
            <div className="relative bg-gradient-to-b from-purple-900/40 to-purple-800/20 rounded-2xl p-6 overflow-hidden">
              {/* Radiating purple background effect */}
              <div className="absolute inset-0 opacity-50" style={{
                background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.3) 0%, rgba(147, 51, 234, 0.15) 50%, transparent 100%)'
              }}></div>
              
              <div className="relative flex items-end justify-center gap-4">
                {/* 2nd Place (Left) */}
                {top3Players[1] && (
                  <motion.div
                    className="flex flex-col items-center flex-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {/* Trend Icon */}
                    <div className="mb-1 text-purple-400 text-xs">▲</div>
                    {/* Profile Picture */}
                    <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-600 border-2 border-blue-400 mb-2">
                      {top3Players[1].profile_picture ? (
                        <img 
                          src={top3Players[1].profile_picture} 
                          alt={getDisplayName(top3Players[1])}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full flex items-center justify-center text-gray-400 text-2xl ${
                          top3Players[1].profile_picture ? 'hidden' : 'flex'
                        }`}
                      >
                        👤
                      </div>
                      {/* Rank Badge */}
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white z-10">
                        2
                      </div>
                    </div>
                    {/* Player Name */}
                    <div className="text-white text-xs font-medium text-center max-w-[80px] truncate">
                      {getDisplayName(top3Players[1])}
                    </div>
                  </motion.div>
                )}

                {/* 1st Place (Center) */}
                {top3Players[0] && (
                  <motion.div
                    className="flex flex-col items-center flex-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    {/* Golden Crown */}
                    <div className="">
                      <img src={crownIcon} alt="Crown" className="w-14 h-14" />
                    </div>
                    {/* Profile Picture - Larger */}
                    <div className="relative w-28 h-28 rounded-full overflow-hidden bg-gray-600 border-4 border-yellow-400 mb-2 shadow-lg">
                      {top3Players[0].profile_picture ? (
                        <img 
                          src={top3Players[0].profile_picture} 
                          alt={getDisplayName(top3Players[0])}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full flex items-center justify-center text-gray-400 text-3xl ${
                          top3Players[0].profile_picture ? 'hidden' : 'flex'
                        }`}
                      >
                        👤
                      </div>
                      {/* Rank Badge */}
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-white z-10">
                        1
                      </div>
                    </div>
                    {/* Player Name */}
                    <div className="text-white text-sm font-semibold text-center max-w-[100px] truncate">
                      {getDisplayName(top3Players[0])}
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place (Right) */}
                {top3Players[2] && (
                  <motion.div
                    className="flex flex-col items-center flex-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {/* Trend Icon */}
                    <div className="mb-1 text-red-400 text-xs">▼</div>
                    {/* Profile Picture */}
                    <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-600 border-2 border-pink-400 mb-2">
                      {top3Players[2].profile_picture ? (
                        <img 
                          src={top3Players[2].profile_picture} 
                          alt={getDisplayName(top3Players[2])}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full flex items-center justify-center text-gray-400 text-2xl ${
                          top3Players[2].profile_picture ? 'hidden' : 'flex'
                        }`}
                      >
                        👤
                      </div>
                      {/* Rank Badge */}
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-pink-400 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white z-10">
                        3
                      </div>
                    </div>
                    {/* Player Name */}
                    <div className="text-white text-xs font-medium text-center max-w-[80px] truncate">
                      {getDisplayName(top3Players[2])}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Remaining Players List */}
        <motion.div className="space-y-2" variants={listContainerVariants} initial="hidden" animate="visible">
          {remainingPlayers.map((player, index) => (
            <motion.div 
              key={player.telegramId}
              className={`flex items-center justify-between rounded-lg p-2.5 hover:bg-gray-600/40 transition-colors ${
                telegramUser && player.telegramId?.toString() === telegramUser.id?.toString() 
                  ? 'bg-purple-600/30 border border-purple-500/50' 
                  : 'bg-gray-700/30'
              }`}
              variants={listItemVariants}
              whileHover={{
                y: -4,
                scale: 1.02,
                boxShadow: (telegramUser && player.telegramId?.toString() === telegramUser.id?.toString()) 
                  ? '0 0 20px rgba(59,130,246,0.35)'
                  : '0 0 16px rgba(255,255,255,0.15)'
              }}
              transition={{ duration: 0.18 }}
            >
              {/* Rank and Player Info */}
              <div className="flex items-center space-x-2.5 flex-1">
                
                
                {/* Profile Picture */}
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-600 flex-shrink-0">
                  {player.profile_picture ? (
                    <img 
                      src={player.profile_picture} 
                      alt={getDisplayName(player)}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-full h-full flex items-center justify-center text-gray-400 text-base ${
                      player.profile_picture ? 'hidden' : 'flex'
                    }`}
                  >
                    👤
                  </div>
                </div>

                {/* Player Details */}
                <div className="flex-1">
                  <div className="text-white font-medium flex items-center space-x-1.5 text-sm">
                    <span>{getDisplayName(player)}</span>
                    {telegramUser && player.telegramId?.toString() === telegramUser.id?.toString() && (
                      <span className="px-1.5 py-0.5 bg-purple-500 text-white text-xs rounded-full">You</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Rank Number */}
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold flex-shrink-0 ${
                telegramUser && player.telegramId?.toString() === telegramUser.id?.toString()
                  ? 'bg-purple-500'
                  : 'bg-gray-600'
              }`}>
                {index + 4}
              </div>
              

            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {getFilteredPlayers().length === 0 && !loading && !error && (
          <div className="text-center py-16">
            <div className="text-3xl mb-3">🏆</div>
            <div className="text-white font-semibold mb-1.5">No Players Yet</div>
            <div className="text-gray-400 text-sm">Be the first to play and climb the leaderboard!</div>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      
      case 'leaderboard':
        return renderLeaderboardContent();
      
      default:
        return null;
    }
  };

  return (
    <motion.div 
      className="relative min-h-screen text-white font-sans overflow-x-hidden"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="grok-bg" />
      <div className="relative z-10">
        {/* Tab Navigation */}
        <motion.div 
          className="flex justify-center space-x-4 p-4"
          variants={contentVariants}
        >
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? ' text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
              variants={tabVariants}
              custom={index}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {tab.id === 'leaderboard' && (
                <img src={cupIcon} alt="Cup" className="w-5 h-5 mr-2" />
              )}
              {tab.icon && <span className="mr-2">{tab.icon}</span>}
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <motion.div 
          className="w-full"
          variants={contentVariants}
        >
          {renderTabContent()}
        </motion.div>
      </div>
    </motion.div>
  );
}

export default Leaderboard;
