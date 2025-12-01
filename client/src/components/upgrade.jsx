import React, { useState, useEffect, useContext, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SocketContext } from '../App';
import { useTonConnect } from '../hooks/useTonConnect';
import { SERVER_WALLET_ADDRESS } from '../config/tonConnect';
import { toUserFriendlyAddress } from '@tonconnect/sdk';
import upgradeImg from '../images/upgrade.png';
import phmnCoinImg from '../images/PHMN coin.png';
import tasksImg from '../images/tasks.png';
import turboImg from '../images/super turbo.png';
import ultimateImg from '../images/ultimate.png';
import tonIcon from '../images/ton.svg';

// Mining levels configuration based on the image
const MINING_LEVELS = [
  { level: 1, multiplier: 1.0, coinsPerHour: 0.00463, coinsNeeded: null },
  { level: 5, multiplier: 1.2, coinsPerHour: 0.00556, coinsNeeded: 5 },
  { level: 10, multiplier: 1.5, coinsPerHour: 0.00694, coinsNeeded: 10 },
  { level: 15, multiplier: 1.8, coinsPerHour: 0.00833, coinsNeeded: 15 },
  { level: 20, multiplier: 2.2, coinsPerHour: 0.01019, coinsNeeded: 20 },
  { level: 25, multiplier: 2.8, coinsPerHour: 0.01296, coinsNeeded: 25 },
  { level: 30, multiplier: 3.5, coinsPerHour: 0.0162, coinsNeeded: 30 },
  { level: 50, multiplier: 5.0, coinsPerHour: 0.02315, coinsNeeded: 50 },
];

// Boost Configuration by Mode (from actual-logic.png)
// Prices in USD, converted to TON (1 TON = $1.6) for display
const TON_TO_USD = 1.6; // 1 TON = $1.6

const BOOST_CONFIG = {
  turbo: { 
    multiplier: 2, 
    // USD prices from actual-logic.png: Daily $2, Weekly $5, Monthly $15
    dailyUSD: 2, 
    weeklyUSD: 5, 
    monthlyUSD: 15,
    // Convert to TON for display
    dailyTON: 2 / TON_TO_USD,    // $2 / 1.6 = 1.25 TON
    weeklyTON: 5 / TON_TO_USD,   // $5 / 1.6 = 3.125 TON
    monthlyTON: 15 / TON_TO_USD, // $15 / 1.6 = 9.375 TON
  },
  super: { 
    multiplier: 4,
    // USD prices from actual-logic.png: Daily $10, Weekly $15, Monthly $50
    dailyUSD: 10,
    weeklyUSD: 15,
    monthlyUSD: 50,
    // Convert to TON for display
    dailyTON: 10 / TON_TO_USD,    // $10 / 1.6 = 6.25 TON
    weeklyTON: 15 / TON_TO_USD,   // $15 / 1.6 = 9.375 TON
    monthlyTON: 50 / TON_TO_USD,  // $50 / 1.6 = 31.25 TON
  },
  ultimate: { 
    multiplier: 6,
    // USD prices from actual-logic.png: Daily $25, Weekly $30, Monthly $80
    dailyUSD: 25,
    weeklyUSD: 30,
    monthlyUSD: 80,
    // Convert to TON for display
    dailyTON: 25 / TON_TO_USD,    // $25 / 1.6 = 15.625 TON
    weeklyTON: 30 / TON_TO_USD,   // $30 / 1.6 = 18.75 TON
    monthlyTON: 80 / TON_TO_USD,  // $80 / 1.6 = 50 TON
  },
};

// Duration options
const DURATION_OPTIONS = [
  { id: 'day', label: 'For Day', duration: 1 },
  { id: 'week', label: 'For Week', duration: 7 },
  { id: 'month', label: 'For Month', duration: 30 },
];

function Upgrade() {
  const [activeMiningMode, setActiveMiningMode] = useState('basic');
  const [currentMiningLevel, setCurrentMiningLevel] = useState(1);
  const [balance, setBalance] = useState(0);
  const [user, setUser] = useState(null);
  const [purchasingBoost, setPurchasingBoost] = useState(false);
  const [boostError, setBoostError] = useState(null);
  const appSocket = useContext(SocketContext);
  
  // TON Connect
  const { 
    wallet, 
    connected, 
    loading: walletLoading, 
    error: walletError, 
    connect, 
    disconnect, 
    tonConnectUI 
  } = useTonConnect();

  const miningModes = [
    { id: 'basic', label: 'Basic', available: true },
    { id: 'turbo', label: 'Turbo', available: true },
    { id: 'super', label: 'Super', available: true },
    { id: 'ultimate', label: 'Ultimate', available: true },
  ];

  const loadUserData = useCallback((telegramId) => {
    if (!appSocket || !appSocket.connected) {
      setTimeout(() => loadUserData(telegramId), 500);
      return;
    }

    appSocket.emit('playMining:status', { telegramId }, (response) => {
      if (response?.success) {
        setBalance(response.PHMN || 0);
        // Get mining level from server (will be added to response)
        setCurrentMiningLevel(response.miningLevel || 1);
      }
    });
  }, [appSocket]);

  // Load user data and mining level
  useEffect(() => {
    const initializeTelegram = () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          const telegramUser = tg.initDataUnsafe?.user;
          if (telegramUser) {
            setUser(telegramUser);
            if (appSocket && appSocket.connected) {
              loadUserData(telegramUser.id);
            }
          }
        } catch (error) {
          console.error('Error initializing Telegram:', error);
        }
      } else {
        setTimeout(initializeTelegram, 100);
      }
    };
    initializeTelegram();
  }, [appSocket, loadUserData]);

  const handleUpgrade = (level) => {
    if (!appSocket || !appSocket.connected || !user) {
      alert('Please wait for connection...');
      return;
    }

    const levelData = MINING_LEVELS.find(l => l.level === level);
    if (!levelData || !levelData.coinsNeeded) {
      return;
    }

    if (balance < levelData.coinsNeeded) {
      alert(`You need at least ${levelData.coinsNeeded} PHMN to unlock level ${level}.`);
      return;
    }

    appSocket.emit('mining:upgradeLevel', { 
      telegramId: user.id, 
      targetLevel: level 
    }, (response) => {
      if (response?.success) {
        setCurrentMiningLevel(level);
        setBalance(response.newBalance || balance); // Balance doesn't change
        alert(`Successfully unlocked level ${level}!`);
        loadUserData(user.id);
      } else {
        alert(response?.error || 'Failed to unlock level');
      }
    });
  };


  // Handle Boost purchase with TON
  const handlePurchaseBoost = async (mode, duration) => {
    if (!appSocket || !user) {
      setBoostError('Please wait for connection...');
      return;
    }

    if (!connected || !tonConnectUI) {
      setBoostError('Please connect your TON wallet first');
      return;
    }

    const boostData = BOOST_CONFIG[mode];
    if (!boostData) {
      setBoostError('Invalid mode selected');
      return;
    }

    let tonAmount;
    let usdAmount;
    switch (duration) {
      case 'day':
        tonAmount = boostData.dailyTON;
        usdAmount = boostData.dailyUSD;
        break;
      case 'week':
        tonAmount = boostData.weeklyTON;
        usdAmount = boostData.weeklyUSD;
        break;
      case 'month':
        tonAmount = boostData.monthlyTON;
        usdAmount = boostData.monthlyUSD;
        break;
      default:
        setBoostError('Invalid duration');
        return;
    }

    if (!SERVER_WALLET_ADDRESS) {
      setBoostError('Server wallet address not configured. Please set REACT_APP_SERVER_WALLET_ADDRESS in your .env file.');
      console.error('❌ SERVER_WALLET_ADDRESS is missing!');
      console.error('📝 Please add REACT_APP_SERVER_WALLET_ADDRESS to PHMN/client/.env file');
      return;
    }

    setPurchasingBoost(true);
    setBoostError(null);

    try {
      console.log(`💵 Purchasing boost: ${mode} ${duration} - ${tonAmount} TON ($${usdAmount})`);
      
      // Send TON payment via TON Connect
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: SERVER_WALLET_ADDRESS,
            amount: (tonAmount * 1000000000).toString() // Convert to nanotons
          }
        ]
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      
      if (result && result.boc) {
        // Process boost purchase on server
        appSocket.emit('mining:purchaseBoost', {
          telegramId: user.id,
          mode: mode,
          duration: duration,
          multiplier: boostData.multiplier,
          tonAmount: tonAmount,
          usdAmount: usdAmount,
          transactionHash: result.boc
        }, (response) => {
          if (response?.success) {
            alert(`Successfully activated ${boostData.multiplier}x boost for ${duration === 'day' ? '1 day' : duration === 'week' ? '1 week' : '1 month'}!`);
            setBoostError(null);
            loadUserData(user.id);
          } else {
            setBoostError(response?.error || 'Failed to activate boost');
          }
          setPurchasingBoost(false);
        });
      } else {
        setBoostError('Transaction failed - no result received');
        setPurchasingBoost(false);
      }
    } catch (error) {
      console.error('❌ Boost purchase error:', error);
      let errorMessage = 'Payment failed';
      if (error.message && error.message.includes('User Rejects Error')) {
        errorMessage = 'Payment cancelled by user';
      } else if (error.message) {
        errorMessage = 'Payment error: ' + error.message;
      }
      setBoostError(errorMessage);
      setPurchasingBoost(false);
    }
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
        {/* Upgrade Header */}
        <motion.div 
          className="flex items-center justify-center gap-2 mb-6 mt-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <img src={upgradeImg} alt="Upgrade" className="h-6 w-auto" />
        </motion.div>

        {/* Upgrade Cards Section */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Max Energy Card 
          
          <motion.div
            className="bg-gradient-to-br from-purple-600/30 to-purple-800/30 rounded-xl p-4 border border-purple-500/30"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <img src={maxEnergyImg} alt="Max Energy" className="w-6 h-6" />
              <h3 className="text-sm font-semibold text-white">Max Energy</h3>
            </div>
            <div className="text-xs text-gray-300 mb-3">
              LVL {maxEnergyLevel} : {maxEnergyValue.toLocaleString()}
            </div>
            <div className="mb-2">
              <div className="text-xs text-purple-300 mb-1">Upgrade</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <span className="text-xs text-gray-400">→</span>
            </div>
          </motion.div>
          
          
          */}

          {/* Restore Energy Card 
          <motion.div
            className="bg-gradient-to-br from-green-600/30 to-green-800/30 rounded-xl p-4 border border-green-500/30"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <img src={renewableEnergyImg} alt="Restore Energy" className="w-6 h-6" />
              <h3 className="text-sm font-semibold text-white">Restore Energy</h3>
            </div>
            <div className="text-xs text-gray-300 mb-3">
              {restoreEnergyRate} PHMN/hr x{restoreEnergyMultiplier}
            </div>
            <div className="mb-2">
              <div className="text-xs text-green-300 mb-1">Restore</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div className="text-xs text-green-300">{restoreTimeRemaining} remaining</div>
            <div className="flex items-center justify-end mt-1">
              <span className="text-xs text-gray-400">→</span>
            </div>
          </motion.div>
          
          
          */}
          
        </div>

        {/* Mining Mode Section */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <h2 className="text-lg font-bold text-white mb-3">Mining Mode</h2>
          
          {/* Mining Mode Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {miningModes.map((mode) => (
              <div key={mode.id} className="relative flex-shrink-0">
                {!mode.available && (
                  <div className="absolute -top-2 left-0 right-0 text-[8px] text-yellow-400 text-center font-bold">
                    COMING SOON
                  </div>
                )}
                <motion.button
                  onClick={() => mode.available && setActiveMiningMode(mode.id)}
                  disabled={!mode.available}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                    activeMiningMode === mode.id
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                      : mode.available
                      ? 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                      : 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
                  }`}
                  whileHover={mode.available ? { scale: 1.05 } : {}}
                  whileTap={mode.available ? { scale: 0.95 } : {}}
                >
                  {mode.label}
                </motion.button>
              </div>
            ))}
          </div>

          {/* Boost Purchase Section - Turbo (2x), Super (4x), Ultimate (6x) */}
          {(activeMiningMode === 'turbo' || activeMiningMode === 'super' || activeMiningMode === 'ultimate') && (() => {
            const boostData = BOOST_CONFIG[activeMiningMode];
            if (!boostData) return null;

            // Select image based on mode
            const modeImage = (activeMiningMode === 'turbo' || activeMiningMode === 'super') 
              ? turboImg 
              : activeMiningMode === 'ultimate' 
              ? ultimateImg 
              : tasksImg;

            return (
              <div className="mb-6">
                {/* Server Wallet Warning */}
                {!SERVER_WALLET_ADDRESS && (
                  <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-xl p-3 mb-4">
                    <div className="text-xs text-yellow-400 font-semibold mb-1">⚠️ Configuration Required</div>
                    <div className="text-xs text-yellow-300">
                      Server wallet address is not configured. Please set <code className="bg-black/30 px-1 rounded">REACT_APP_SERVER_WALLET_ADDRESS</code> in your .env file.
                    </div>
                  </div>
                )}

                {/* TON Wallet Connection */}
                <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-xl p-3 mb-4 border border-purple-500/30">
                  {!connected ? (
                    <div className="text-center">
                      <div className="text-xs text-gray-300 mb-2">Connect TON Wallet to Purchase Boost</div>
                      {walletError && (
                        <div className="text-xs text-red-400 mb-2 bg-red-900/20 px-2 py-1 rounded">
                          {walletError}
                        </div>
                      )}
                      <motion.button
                        onClick={() => {
                          if (!walletLoading) {
                            connect();
                          }
                        }}
                        disabled={walletLoading || !SERVER_WALLET_ADDRESS}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={!walletLoading && SERVER_WALLET_ADDRESS ? { scale: 1.05 } : {}}
                        whileTap={!walletLoading && SERVER_WALLET_ADDRESS ? { scale: 0.95 } : {}}
                      >
                        {walletLoading ? 'Connecting...' : 'Connect Wallet'}
                      </motion.button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-green-400">✓ TON Wallet Connected</div>
                        <div className="text-xs text-gray-400">
                          {wallet?.address ? `${toUserFriendlyAddress(wallet.address, { bounceable: false }).slice(0, 6)}..${toUserFriendlyAddress(wallet.address, { bounceable: false }).slice(-4)}` : ''}
                        </div>
                      </div>
                      <motion.button
                        onClick={disconnect}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        Disconnect
                      </motion.button>
                    </div>
                  )}
                </div>

                {/* Duration Cards */}
                <div className="space-y-3">
                  {DURATION_OPTIONS.map((duration, index) => {
                    let tonAmount;
                    switch (duration.id) {
                      case 'day':
                        tonAmount = boostData.dailyTON;
                        break;
                      case 'week':
                        tonAmount = boostData.weeklyTON;
                        break;
                      case 'month':
                        tonAmount = boostData.monthlyTON;
                        break;
                      default:
                        tonAmount = 0;
                    }

                    return (
                      <motion.div
                        key={duration.id}
                        className="bg-gradient-to-br from-purple-600/30 to-purple-800/30 rounded-xl p-4 border border-purple-500/30 flex items-center gap-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        {/* Icon Section */}
                        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg p-3 flex-shrink-0">
                          <img 
                            src={modeImage} 
                            alt="Miner" 
                            className="w-12 h-12 object-contain"
                          />
                        </div>

                        {/* Details Section */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-bold text-white">
                              {duration.label}
                            </div>
                            <div className="text-sm font-semibold text-white">
                              x{boostData.multiplier} BOOST
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <img src={tonIcon} alt="TON" className="w-4 h-4" />
                            <span className="text-xs text-white">
                              {tonAmount.toFixed(3)} TON
                            </span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <motion.button
                          onClick={() => handlePurchaseBoost(activeMiningMode, duration.id)}
                          disabled={!connected || purchasingBoost || !SERVER_WALLET_ADDRESS}
                          className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all ${
                            connected && !purchasingBoost && SERVER_WALLET_ADDRESS
                              ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800'
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          }`}
                          whileHover={connected && !purchasingBoost && SERVER_WALLET_ADDRESS ? { scale: 1.05 } : {}}
                          whileTap={connected && !purchasingBoost && SERVER_WALLET_ADDRESS ? { scale: 0.95 } : {}}
                        >
                          {purchasingBoost ? 'Processing...' : !SERVER_WALLET_ADDRESS ? 'Not Configured' : 'GET'}
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Error Display */}
                {boostError && (
                  <motion.div 
                    className="mt-4 text-center"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded">
                      {boostError}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })()}

          {/* Mining Levels Cards for Basic Mode */}
          {activeMiningMode === 'basic' && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-white mb-3">Mining Levels and Ratios</h3>
              <div className="grid grid-cols-3 gap-3">
                {MINING_LEVELS.map((levelData, index) => {
                  const hasReachedLevel = currentMiningLevel >= levelData.level;
                  const canUpgrade = levelData.coinsNeeded && balance >= levelData.coinsNeeded && currentMiningLevel < levelData.level;
                  const isCurrentLevel = currentMiningLevel === levelData.level;
                  
                  return (
                    <motion.div
                      key={levelData.level}
                      className={`bg-gradient-to-br from-purple-600/30 to-purple-800/30 rounded-xl p-3 border flex flex-col items-center ${
                        isCurrentLevel ? 'border-green-500/50' : hasReachedLevel ? 'border-purple-400/50' : 'border-purple-500/30'
                      }`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      {/* Level Badge */}
                      <div className="text-xs font-bold text-white mb-2">
                        Level {levelData.level}
                      </div>
                      {/* Miner Image */}
                      <div className="mb-2">
                        <img 
                          src={tasksImg} 
                          alt="Miner" 
                          className="w-20 h-20 object-contain"
                        />
                      </div>
                      
                      {/* Multiplier */}
                      <div className="text-xs text-purple-300 mb-2">
                        {levelData.multiplier}x Multiplier
                      </div>
                      
                      {/* Coins/hr */}
                      <div className="flex items-center gap-1 mb-2">
                        <img src={phmnCoinImg} alt="Coin" className="w-4 h-4" />
                        <span className="text-xs font-bold text-yellow-400">
                          {levelData.coinsPerHour.toFixed(5)}/hr
                        </span>
                      </div>
                      
                      {/* Unlock Requirement or Status */}
                      {levelData.coinsNeeded === null ? (
                        <div className="text-[10px] text-gray-400 mt-1">
                          Starter Level
                        </div>
                      ) : (
                        <div className="w-full flex flex-col items-center gap-1">
                          {canUpgrade && (
                            <motion.button
                              onClick={() => handleUpgrade(levelData.level)}
                              className="w-full py-1.5 px-2 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-[10px] font-semibold text-white hover:from-green-600 hover:to-green-700 transition-all"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Unlock
                            </motion.button>
                          )}
                          {isCurrentLevel && (
                            <div className="w-full py-1.5 px-2 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-[10px] font-semibold text-white text-center">
                              ✓ Current
                            </div>
                          )}
                          {hasReachedLevel && !isCurrentLevel && (
                            <div className="w-full py-1.5 px-2 bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg text-[10px] font-semibold text-white text-center">
                              ✓ Unlocked
                            </div>
                          )}
                          {!hasReachedLevel && !canUpgrade && (
                            <div className="w-full py-1.5 px-2 bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg text-[10px] font-semibold text-gray-300 text-center">
                              Need: {levelData.coinsNeeded} PHMN
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
    </div>
    </motion.div>
  );
}

export default Upgrade;
