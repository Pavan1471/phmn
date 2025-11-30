import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { SocketContext } from '../App';
import tasksImg from '../images/tasks.png';
import twitterIcon from '../images/task-icon/twitter.png';
import youtubeIcon from '../images/task-icon/youtube.png';
import telegramIcon from '../images/task-icon/telegram.png';
import discordIcon from '../images/task-icon/discord.png';
import phmnCoinImg from '../images/PHMN coin.png';
import adsgramService from '../services/adsgram';
import { ADSGRAM_BLOCK_ID, ADSGRAM_DEBUG, fetchBlockIdFromSocket } from '../config/adsgram';

const Tasks = ({ telegramUser, botUsername }) => {
  const socket = useContext(SocketContext);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const notificationTimeoutRef = useRef(null);
  const [gameStats, setGameStats] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [activeTab, setActiveTab] = useState('tasks');
  const [botUsernameState, setBotUsernameState] = useState(botUsername || '');
  const [isShowingAds, setIsShowingAds] = useState(false);
  
  // State to track button states for join/follow tasks
  const [buttonStates, setButtonStates] = useState({
    join_channel: 'join', // 'join' or 'claim'
    follow_x: 'follow',     // 'follow' or 'claim'
    join_discord: 'join' // 'join' or 'claim'
  });

  const tabs = [
    { id: 'tasks', label: 'Tasks', icon: '🎯' },
    { id: 'referrals', label: 'Friends', icon: '👥' }
  ];

  const showNotification = useCallback((message, type = 'success') => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification({ show: true, message, type });
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
      notificationTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // Initialize Adsgram
  useEffect(() => {
    const initializeAdsgram = async () => {
      let blockId = ADSGRAM_BLOCK_ID;
      
      // If block ID not set in env, try to fetch from backend via socket
      if (!blockId && socket && socket.connected) {
        console.log('📡 Fetching Adsgram block ID from backend via socket...');
        blockId = await fetchBlockIdFromSocket(socket);
      } else if (!blockId) {
        // Wait for socket to connect, then try again
        if (socket) {
          const checkSocket = () => {
            if (socket.connected) {
              fetchBlockIdFromSocket(socket).then(id => {
                if (id) {
                  const initialized = adsgramService.init(id, ADSGRAM_DEBUG);
                  if (initialized) {
                    console.log('✅ Adsgram initialized successfully');
                  }
                }
              });
            } else {
              setTimeout(checkSocket, 500);
            }
          };
          checkSocket();
          return; // Exit early, will initialize when socket connects
        }
      }

      if (blockId) {
        const initialized = adsgramService.init(blockId, ADSGRAM_DEBUG);
        if (initialized) {
          console.log('✅ Adsgram initialized successfully');
        } else {
          console.warn('⚠️ Adsgram initialization failed - ads will not be shown');
        }
      } else {
        console.warn('⚠️ ADSGRAM_BLOCK_ID not set - ads will not be shown. Please set ADSGRAM_BLOCK_ID in backend .env file.');
      }
    };

    initializeAdsgram();
  }, [socket]);

const loadBotUsername = useCallback(() => {
    if (!socket) return;
    socket.emit('app:getBotUsername', {}, (res) => {
      if (res?.success && res.botUsername) {
        setBotUsernameState(res.botUsername);
      } else {
        // Fallback to extracting from URL or using default
        const urlParams = new URLSearchParams(window.location.search);
        const startParam = urlParams.get('start');
        if (startParam) {
          // Extract bot username from current URL
          const currentUrl = window.location.href;
          const match = currentUrl.match(/https:\/\/t\.me\/([^?]+)/);
          if (match) {
            setBotUsernameState(match[1]);
          }
        } else {
          // Use default bot username
          setBotUsernameState('PHMNCHADBOT');
        }
      }
    });
}, [socket]);

const loadTasks = useCallback(() => {
    setTasksLoading(true); setError(null);
    socket.emit('tasks:getAvailable', { telegramId: telegramUser.id }, (res) => {
      if (!res?.success) setError(res?.error || 'Failed to load tasks');
      else setTasks(res.tasks || []);
      setTasksLoading(false);
    });
}, [socket, telegramUser]);

const loadReferralCode = useCallback(() => {
    if (!socket || !telegramUser) return;
    socket.emit('referral:getCode', { telegramId: telegramUser.id }, (res) => {
      if (res?.success) setReferralCode(res.referralCode);
    });
}, [socket, telegramUser]);

const loadReferralStats = useCallback(() => {
    if (!socket || !telegramUser) return;
    setReferralLoading(true);
    socket.emit('referral:getStats', { telegramId: telegramUser.id }, (res) => {
      if (res?.success) setReferralStats(res.stats);
      setReferralLoading(false);
    });
}, [socket, telegramUser]);

const loadGameStats = useCallback(() => {
    if (!socket || !telegramUser) return;
    socket.emit('rank:getStats', telegramUser.id);
}, [socket, telegramUser]);

useEffect(() => {
  if (!socket || !telegramUser) return;
  loadTasks();
  loadReferralCode();
  loadReferralStats();
  loadGameStats();

  const handleRankStats = (data) => { if (data.success) setGameStats(data); };
  socket.on('rank:stats', handleRankStats);
  
  if (!botUsernameState) {
    loadBotUsername();
  }
  
  return () => socket.off('rank:stats', handleRankStats);
}, [socket, telegramUser, botUsernameState, loadTasks, loadReferralCode, loadReferralStats, loadGameStats, loadBotUsername]);

const claimTaskReward = useCallback((taskId, additionalData = {}) => {
    if (!socket || !telegramUser) return;
    socket.emit('tasks:claimReward', { telegramId: telegramUser.id, taskId, ...additionalData }, (res) => {
      if (res?.success) { 
        loadTasks(); 
        loadReferralStats(); 
        loadGameStats(); 
        showNotification(res.message || `Task reward claimed! +${res.rewardAmount || 0} PHMN`); 
        
        // Reset button states for completed tasks
        if (taskId === 'join_channel') {
          setButtonStates(prev => ({ ...prev, join_channel: 'join' }));
        } else if (taskId === 'follow_x') {
          setButtonStates(prev => ({ ...prev, follow_x: 'follow' }));
        } else if (taskId === 'join_discord') {
          setButtonStates(prev => ({ ...prev, join_discord: 'join' }));
        }
      } else {
        if (res?.requiresVerification) {
          showNotification('Please join the channel first, then click "Claim"', 'error');
        } else if (res?.requiresConfirmation) {
          showNotification('Please follow the account first, then click "Claim"', 'error');
        } else if (res?.requiresMiningActive) {
          showNotification('Please start mining first before extending mining time', 'error');
        } else {
          setError(res?.error || 'Failed to claim reward');
        }
      }
    });
}, [socket, telegramUser, loadTasks, loadReferralStats, loadGameStats, showNotification]);

  // Show ads before claiming daily login reward
  const showAdsBeforeDailyClaim = async () => {
    if (isShowingAds) return; // Prevent duplicate calls
    
    if (!adsgramService.isReady()) {
      showNotification('Ads not available. Please try again later.', 'error');
      return;
    }

    setIsShowingAds(true);

    try {
      // Show 1 ad
      const result = await adsgramService.showAds(1, async (adNumber, adResult) => {
        console.log(`Ad ${adNumber} completed:`, adResult);
      });

      // If ad wasn't shown, still allow claim (graceful degradation)
      if (result.watched === 0) {
        console.log('No ad available, proceeding with claim anyway');
      }

      // Claim the reward after ad is shown
      claimTaskReward('daily_login');
    } catch (error) {
      console.error('Error showing ads:', error);
      showNotification('Error showing ads. Please try again.', 'error');
    } finally {
      setIsShowingAds(false);
    }
  };

  // Show ads before claiming boost mining rate task
  const showAdsBeforeBoostRate = async () => {
    if (isShowingAds) return; // Prevent duplicate calls
    
    if (!adsgramService.isReady()) {
      showNotification('Ads not available. Please try again later.', 'error');
      return;
    }

    setIsShowingAds(true);

    try {
      // Show 1 ad
      const result = await adsgramService.showAds(1, async (adNumber, adResult) => {
        console.log(`Ad ${adNumber} completed:`, adResult);
      });

      // If ad wasn't shown, still allow claim (graceful degradation)
      if (result.watched === 0) {
        console.log('No ad available, proceeding with claim anyway');
      }

      // Claim the reward after ad is shown
      claimTaskReward('boost_mining_rate');
    } catch (error) {
      console.error('Error showing ads:', error);
      showNotification('Error showing ads. Please try again.', 'error');
    } finally {
      setIsShowingAds(false);
    }
  };

  // Show ads before claiming extend mining time task
  const showAdsBeforeExtendTime = async () => {
    if (isShowingAds) return; // Prevent duplicate calls
    
    if (!adsgramService.isReady()) {
      showNotification('Ads not available. Please try again later.', 'error');
      return;
    }

    setIsShowingAds(true);

    try {
      // Show 1 ad
      const result = await adsgramService.showAds(1, async (adNumber, adResult) => {
        console.log(`Ad ${adNumber} completed:`, adResult);
      });

      // If ad wasn't shown, still allow claim (graceful degradation)
      if (result.watched === 0) {
        console.log('No ad available, proceeding with claim anyway');
      }

      // Claim the reward after ad is shown
      claimTaskReward('extend_mining_time');
    } catch (error) {
      console.error('Error showing ads:', error);
      showNotification('Error showing ads. Please try again.', 'error');
    } finally {
      setIsShowingAds(false);
    }
  };

  const handleChannelJoin = (task) => {
    if (task.channelLink) {
      // Open the channel link in Telegram
      if (window.Telegram?.WebApp) {
        try {
          window.Telegram.WebApp.openTelegramLink(task.channelLink);
          showNotification('Opening channel... Join the channel and return here to click "Claim"!', 'success');
          // Change button state to 'claim'
          setButtonStates(prev => ({ ...prev, join_channel: 'claim' }));
        } catch (error) {
          // Fallback to regular method
          window.open(task.channelLink, '_blank');
          showNotification('Channel link opened! Join the channel and return here to click "Claim"!', 'success');
          // Change button state to 'claim'
          setButtonStates(prev => ({ ...prev, join_channel: 'claim' }));
        }
      } else {
        // Fallback for non-Telegram environments
        window.open(task.channelLink, '_blank');
        showNotification('Channel link opened! Join the channel and return here to click "Claim"!', 'success');
        // Change button state to 'claim'
        setButtonStates(prev => ({ ...prev, join_channel: 'claim' }));
      }
    }
  };

  const handleChannelVerification = (task) => {
    if (!socket || !telegramUser) return;
    
    // Check channel membership status
    socket.emit('tasks:checkChannelMembership', { telegramId: telegramUser.id }, (res) => {
      if (res?.success) {
        if (res.isMember) {
          // User is verified as a member, allow claiming
          showNotification('Channel membership verified! Claiming your reward...', 'success');
          claimTaskReward(task.id);
          // Reset button state after successful claim
          setButtonStates(prev => ({ ...prev, join_channel: 'join' }));
        } else if (res.canClaim && res.requiresManualVerification) {
          // Manual verification needed
          const confirmed = window.confirm('Please confirm that you have joined the channel. Click OK to claim your reward.');
          if (confirmed) {
            showNotification('Manual verification confirmed! Claiming your reward...', 'success');
            claimTaskReward(task.id);
            // Reset button state after successful claim
            setButtonStates(prev => ({ ...prev, join_channel: 'join' }));
          }
        } else {
          showNotification(res.message || 'Please join the channel first.', 'error');
        }
      } else {
        // Show helpful error message for API issues
        if (res?.error?.includes('member list is inaccessible')) {
          showNotification('Bot verification failed. Using manual verification instead...', 'warning');
          // Fall back to manual verification
          const confirmed = window.confirm('Please confirm that you have joined the channel. Click OK to claim your reward.');
          if (confirmed) {
            showNotification('Manual verification confirmed! Claiming your reward...', 'success');
            claimTaskReward(task.id);
            // Reset button state after successful claim
            setButtonStates(prev => ({ ...prev, join_channel: 'join' }));
          }
        } else {
          showNotification(res?.error || 'Failed to verify channel membership', 'error');
        }
      }
    });
  };

  const handleXFollow = (task) => {
    if (task.xLink) {
      // Open the X link in a new tab
      window.open(task.xLink, '_blank');
      showNotification('Opening X profile... Follow and return here to click "Claim"!', 'success');
      // Change button state to 'claim'
      setButtonStates(prev => ({ ...prev, follow_x: 'claim' }));
    }
  };

  const handleXFollowVerification = (task) => {
    if (!socket || !telegramUser) return;
    
    // Direct claim without confirmation
    showNotification('Claiming X follow reward...', 'success');
    claimTaskReward(task.id, { confirmed: true });
    // Reset button state after successful claim
    setButtonStates(prev => ({ ...prev, follow_x: 'follow' }));
  };

  const handleDiscordJoin = (task) => {
    if (task.discordLink) {
      // Open the Discord link in a new tab
      window.open(task.discordLink, '_blank');
      showNotification('Opening Discord server... Join and return here to click "Claim"!', 'success');
      // Change button state to 'claim'
      setButtonStates(prev => ({ ...prev, join_discord: 'claim' }));
    }
  };

  const handleDiscordJoinVerification = (task) => {
    if (!socket || !telegramUser) return;
    
    // Direct claim without confirmation
    showNotification('Claiming Discord join reward...', 'success');
    claimTaskReward(task.id, { confirmed: true });
    // Reset button state after successful claim
    setButtonStates(prev => ({ ...prev, join_discord: 'join' }));
  };

  const generateReferralLink = () => {
    return `https://t.me/${botUsernameState}?start=${referralCode}`;
  };

  const copyReferralLink = () => {
    if (!referralCode) return;
    const referralLink = generateReferralLink();
    navigator.clipboard.writeText(referralLink).then(() => showNotification('Link copied!')).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = referralLink; document.body.appendChild(textArea); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea);
      showNotification('Link copied!');
    });
  };



  const shareTelegram = () => {
    try {
      const link = generateReferralLink();
      const text = `🎮 Join me in this awesome game! Use my referral link to get started: ${link}`;
      
      // Use Telegram's built-in sharing
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
      } else {
        // Fallback to regular method
        window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank');
      }
      showNotification('Opening Telegram share...', 'success');
    } catch (error) {
      showNotification('Failed to share via Telegram', 'error');
    }
  };

  const handleUseReferralCode = () => {
    if (!socket || !telegramUser || !referralInput.trim()) return;
    socket.emit('referral:useCode', { telegramId: telegramUser.id, referralCode: referralInput.trim() }, (res) => {
      if (res?.success) {
        showNotification(`Code applied! Referred by ${res.referrerName}`);
        setReferralInput('');
        loadReferralStats();
      } else {
        showNotification(res?.error || 'Failed to use code', 'error');
      }
    });
  };

  const getTaskProgress = (task) => {
    if (!gameStats) return 0;
    let progress = 0;
    const today = new Date().toDateString(); // Declare once at the top for all cases
    switch (task.id) {
      case 'play_games': progress = Math.min(gameStats.totalGamesPlayed || 0, task.target); break;
      case 'win_games': progress = Math.min(gameStats.totalGamesWon || 0, task.target); break;
      case 'kill_pawns': progress = Math.min(gameStats.totalPawnsKilled || 0, task.target); break;
      case 'first_home': progress = Math.min(gameStats.totalFirstHome || 0, task.target); break;
      case 'referral': progress = referralStats?.totalReferrals || 0; break;
      case 'daily_login': 
        // Daily login is always available if not claimed today
        const lastDaily = task.lastDailyReward ? new Date(task.lastDailyReward).toDateString() : null;
        progress = lastDaily === today ? 1 : 0;
        break;
      case 'boost_mining_rate':
        const lastBoostRate = task.lastBoostRateTaskClaimed ? new Date(task.lastBoostRateTaskClaimed).toDateString() : null;
        progress = lastBoostRate === today ? 1 : 0;
        break;
      case 'extend_mining_time':
        const lastExtendTime = task.lastExtendTimeTaskClaimed ? new Date(task.lastExtendTimeTaskClaimed).toDateString() : null;
        progress = lastExtendTime === today ? 1 : 0;
        break;
      case 'join_channel': progress = task.progress || 0; break;
      case 'follow_x': progress = task.progress || 0; break;
      case 'subscribe_youtube': progress = task.progress || 0; break;
      case 'join_discord': progress = task.progress || 0; break;
      default: progress = task.progress || 0;
    }
    return progress;
  };

  const isTaskCompleted = (task) => {
    // Check if task is already claimed by looking at the task's completed property
    if (task.completed) return true;
    
    const today = new Date().toDateString(); // Declare once at the top for all checks
    
    // For daily login, check if already claimed today
    if (task.id === 'daily_login') {
      const lastDaily = task.lastDailyReward ? new Date(task.lastDailyReward).toDateString() : null;
      return lastDaily === today;
    }
    
    // For boost mining rate, check if already claimed today
    if (task.id === 'boost_mining_rate') {
      const lastBoostRate = task.lastBoostRateTaskClaimed ? new Date(task.lastBoostRateTaskClaimed).toDateString() : null;
      return lastBoostRate === today;
    }
    
    // For extend mining time, check if already claimed today
    if (task.id === 'extend_mining_time') {
      const lastExtendTime = task.lastExtendTimeTaskClaimed ? new Date(task.lastExtendTimeTaskClaimed).toDateString() : null;
      return lastExtendTime === today;
    }
    
    // For tasks that need progress tracking, check if progress meets target
    const progress = getTaskProgress(task);
    return progress >= task.target;
  };

  const isTaskClaimable = (task) => {
    // Task is claimable if it's not completed but progress meets target
    if (task.completed) return false;
    
    const today = new Date().toDateString(); // Declare once at the top for all checks
    
    // For daily login, it's claimable if not claimed today
    if (task.id === 'daily_login') {
      const lastDaily = task.lastDailyReward ? new Date(task.lastDailyReward).toDateString() : null;
      return lastDaily !== today;
    }
    
    // For boost mining rate, it's claimable if not claimed today
    if (task.id === 'boost_mining_rate') {
      const lastBoostRate = task.lastBoostRateTaskClaimed ? new Date(task.lastBoostRateTaskClaimed).toDateString() : null;
      return lastBoostRate !== today;
    }
    
    // For extend mining time, it's claimable if not claimed today
    if (task.id === 'extend_mining_time') {
      const lastExtendTime = task.lastExtendTimeTaskClaimed ? new Date(task.lastExtendTimeTaskClaimed).toDateString() : null;
      return lastExtendTime !== today;
    }
    
    const progress = getTaskProgress(task);
    return progress >= task.target;
  };

  const getTaskIcon = (taskId) => {
    const iconMap = {
      'follow_x': twitterIcon,
      'join_channel': telegramIcon,
      'subscribe_youtube': youtubeIcon,
      'join_discord': discordIcon,
    };
    return iconMap[taskId] || null;
  };

  const getTaskEnergyReward = (task) => {
    // Return energy reward, defaulting to 10000 if not specified
    return task.energyReward || 10000;
  };

  const getTaskRewardDisplay = (task) => {
    // For daily login, show PHMN reward
    if (task.id === 'daily_login') {
      return '+0.2 PHMN';
    }
    // For boost mining rate, show boost percentage
    if (task.id === 'boost_mining_rate') {
      return '+0.2% Rate';
    }
    // For extend mining time, show time extension
    if (task.id === 'extend_mining_time') {
      return '+2 Hours';
    }
    // For social tasks (join_channel, follow_x, join_discord), show PHMN reward
    if (task.id === 'join_channel' || task.id === 'follow_x' || task.id === 'join_discord') {
      return '+0.3 PHMN';
    }
    // For other tasks, show energy reward
    return `+${getTaskEnergyReward(task).toLocaleString()} Energy`;
  };

  const renderTasks = () => {
    if (tasksLoading || !gameStats) return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
        {!gameStats && <div className="ml-2 text-gray-400 text-xs">Loading...</div>}
      </div>
    );
    if (error) return (
      <div className="text-center py-4">
        <div className="text-red-400 mb-2 text-sm">❌ {error}</div>
        <motion.button 
          onClick={loadTasks} 
          className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-lg"
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          Retry
        </motion.button>
      </div>
    );
    if (!tasks.length) return <div className="text-center py-4 text-gray-400 text-sm">No tasks available.</div>;
    
    return (
      <div className="space-y-3">
        {tasks.map((task) => {
          const taskIsCompleted = isTaskCompleted(task);
          const taskIsClaimable = isTaskClaimable(task);
          const isJoinTask = task.id === 'join_channel';
          const isFollowXTask = task.id === 'follow_x';
          const isDiscordTask = task.id === 'join_discord';

          return (
            <motion.div 
              key={task.id} 
              className={`rounded-xl p-4 transition-all duration-200 ${
                taskIsCompleted
                  ? 'bg-[#2a1f3d]/80 border border-gray-700/40'
                  : 'bg-[#2a1f3d] border border-gray-700/40'
              }`} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={`flex items-center justify-between ${!taskIsClaimable && !isJoinTask && !isFollowXTask && !isDiscordTask ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                    {getTaskIcon(task.id) ? (
                      <img 
                        src={getTaskIcon(task.id)} 
                        alt={task.title} 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-3xl">{task.icon || '📋'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white mb-1">{task.title}</h3>
                    <div className="text-sm text-gray-400 font-medium">{getTaskRewardDisplay(task)}</div>
                    {task.target > 1 && (
                      <div className="text-xs text-gray-400 mt-2">
                        <span>{getTaskProgress(task)}/{task.target}</span>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                          <div className="bg-gradient-to-r from-gray-500 to-gray-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.min((getTaskProgress(task) / task.target) * 100, 100)}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-3">
                  {taskIsCompleted ? (
                    <motion.button 
                      className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center gap-2 shadow-lg font-medium min-w-[100px]"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.15 }}
                    >
                      <span>✓</span>
                      <span>Claimed</span>
                    </motion.button>
                  ) : isJoinTask ? (
                    buttonStates.join_channel === 'join' ? (
                      <motion.button 
                        onClick={() => handleChannelJoin(task)}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px]"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <img
                          src={phmnCoinImg}
                          alt="PHMN Coin"
                          className="w-6 h-6 select-none"
                          draggable="false"
                        />
                        <span>0.3</span>
                      </motion.button>
                    ) : (
                      <motion.button 
                        onClick={() => handleChannelVerification(task)}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px]"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <img
                          src={phmnCoinImg}
                          alt="PHMN Coin"
                          className="w-6 h-6 select-none"
                          draggable="false"
                        />
                        <span>0.3</span>
                      </motion.button>
                    )
                  ) : isFollowXTask ? (
                    buttonStates.follow_x === 'follow' ? (
                      <motion.button 
                        onClick={() => handleXFollow(task)}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px]"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <img
                          src={phmnCoinImg}
                          alt="PHMN Coin"
                          className="w-6 h-6 select-none"
                          draggable="false"
                        />
                        <span>0.3</span>
                      </motion.button>
                    ) : (
                      <motion.button 
                        onClick={() => handleXFollowVerification(task)}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px]"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <img
                          src={phmnCoinImg}
                          alt="PHMN Coin"
                          className="w-6 h-6 select-none"
                          draggable="false"
                        />
                        <span>0.3</span>
                      </motion.button>
                    )
                  ) : isDiscordTask ? (
                    buttonStates.join_discord === 'join' ? (
                      <motion.button 
                        onClick={() => handleDiscordJoin(task)}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px]"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <img
                          src={phmnCoinImg}
                          alt="PHMN Coin"
                          className="w-6 h-6 select-none"
                          draggable="false"
                        />
                        <span>0.3</span>
                      </motion.button>
                    ) : (
                      <motion.button 
                        onClick={() => handleDiscordJoinVerification(task)}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px]"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <img
                          src={phmnCoinImg}
                          alt="PHMN Coin"
                          className="w-6 h-6 select-none"
                          draggable="false"
                        />
                        <span>0.3</span>
                      </motion.button>
                    )
                  ) : taskIsClaimable ? (
                    task.id === 'daily_login' ? (
                      <motion.button 
                        onClick={showAdsBeforeDailyClaim}
                        disabled={isShowingAds}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={isShowingAds ? {} : { scale: 1.05, y: -2 }}
                        whileTap={isShowingAds ? {} : { scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        {isShowingAds ? 'Ad...' : 'Claim'}
                      </motion.button>
                    ) : task.id === 'boost_mining_rate' ? (
                      <motion.button 
                        onClick={showAdsBeforeBoostRate}
                        disabled={isShowingAds}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={isShowingAds ? {} : { scale: 1.05, y: -2 }}
                        whileTap={isShowingAds ? {} : { scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        {isShowingAds ? 'Ad...' : 'Claim'}
                      </motion.button>
                    ) : task.id === 'extend_mining_time' ? (
                      <motion.button 
                        onClick={showAdsBeforeExtendTime}
                        disabled={isShowingAds}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={isShowingAds ? {} : { scale: 1.05, y: -2 }}
                        whileTap={isShowingAds ? {} : { scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        {isShowingAds ? 'Ad...' : 'Claim'}
                      </motion.button>
                    ) : (
                      <motion.button 
                        onClick={() => claimTaskReward(task.id)}
                        className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center gap-2 shadow-lg font-medium cursor-pointer hover:from-purple-700 hover:to-purple-800 min-w-[100px]"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <img
                            src={phmnCoinImg}
                            alt="PHMN Coin"
                            className="w-6 h-6 select-none"
                            draggable="false"
                          />
                        <span>0.3</span>
                      </motion.button>
                    )
                  ) : (
                    <motion.div 
                      className="text-white text-sm px-4 py-2.5 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 flex items-center justify-center gap-2 shadow-lg font-medium min-w-[100px]"
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.15 }}
                    >
                      <span>✗</span>
                      <span>Locked</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const renderReferralSection = () => {
    if (referralLoading) return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
      </div>
    );
    return (
      <div className="space-y-3">
        <motion.div className="rounded-lg p-3 border border-gray-700/40" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-xs text-gray-400 mb-2 mt-2 text-center">
                                Share this link with friends to earn instant rewards!
                              </div>

              <motion.button 
                onClick={copyReferralLink} 
                  className="w-full py-2 px-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-lg flex items-center justify-center gap-2 mb-3"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                Copy Link
              </motion.button>

              
          <motion.button 
            onClick={shareTelegram}
            className="w-full py-2 px-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            Invite Friends
          </motion.button>
             
        </motion.div>


        {referralStats && (
          <motion.div className=" rounded-lg p-3 border border-gray-700/40" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="text-base font-bold text-white mb-2">Stats</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="text-center p-2 bg-gray-800 rounded">
                <div className="text-lg font-bold text-purple-600">{referralStats.totalReferrals}</div>
                <div className="text-xs text-gray-400">Friends Invited</div>
              </div>
              <div className="text-center p-2 bg-gray-800 rounded">
                <div className="text-lg font-bold text-purple-600">{referralStats.totalEarnings}</div>
                <div className="text-xs text-gray-400">Total Rewards</div>
              </div>
            </div>

            {referralStats.referrals.length > 0 && (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {referralStats.referrals.slice(0, 5).map((ref) => (
                  <div key={ref.telegramId} className="bg-gray-800 rounded p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                        {ref.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-xs">
                        <div className="text-white font-medium">{ref.name}</div>
                        <div className="text-gray-400">Joined via referral</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <motion.div className="rounded-lg p-3 border border-gray-700/40" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="text-sm font-semibold text-white mb-2">Have a referral code?</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value)}
              placeholder="Enter friend's code"
              className="flex-1 bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <motion.button
              onClick={handleUseReferralCode}
              disabled={!referralInput.trim()}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              whileHover={!referralInput.trim() ? {} : { scale: 1.05, y: -2 }}
              whileTap={!referralInput.trim() ? {} : { scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              Apply Code
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'referrals':
        return renderReferralSection();
      
      case 'tasks':
        return <div className="space-y-2">{renderTasks()}</div>;
      
      default:
        return null;
    }
  };

  return (
    <motion.div 
      className="relative min-h-screen text-white font-sans overflow-x-hidden bg-purple-950/30"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } } }}
      initial="hidden"
      animate="visible"
    >
      <div className="grok-bg" />
      <div className="relative z-10 pb-24">
        {/* Tasks & Earn Card */}
        <motion.div 
          className="max-w-xl mx-auto px-4 pt-4 mb-6"
          variants={{ hidden: { opacity: 0, y: -20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } } }}
        >
          <div className="bg-gradient-to-br from-purple-800/60 to-purple-800/30 rounded-xl p-5 border border-purple-500/10 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-[15px] text-white mb-1">Tasks & Earn</h2>
                <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                  Complete tasks, earn rewards, and get bonuses for active friends!
                </p>
                <motion.button
                  onClick={() => {
                    const dailyTask = tasks.find(t => t.id === 'daily_login');
                    if (dailyTask && isTaskClaimable(dailyTask)) {
                      showAdsBeforeDailyClaim();
                    } else {
                      showNotification('Daily reward not available yet', 'error');
                    }
                  }}
                  disabled={isShowingAds}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-600/100 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg text-sm shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={isShowingAds ? {} : { scale: 1.05, y: -2 }}
                  whileTap={isShowingAds ? {} : { scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  {isShowingAds ? 'Showing Ad...' : 'Daily Claim'}
                </motion.button>
              </div>
              <div className="flex-shrink-0">
                <img 
                  src={tasksImg} 
                  alt="Miner illustration" 
                  className="w-32 h-32 object-contain"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div 
          className="flex justify-center space-x-2 px-4 mb-4"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } } }}
        >
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
              }`}
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } } }}
              custom={index}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <motion.div 
          className="w-full"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } } }}
        >
          <div className="max-w-xl mx-auto px-4">
            {renderTabContent()}
          </div>
        </motion.div>
      </div>

      {notification.show && (
        <motion.div className={`fixed right-4 p-3 rounded-lg shadow-lg z-50 text-sm ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`} style={{ bottom: 'calc(1rem + 44px)' }} initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}>{notification.message}</motion.div>
      )}
    </motion.div>
  );
};

export default Tasks;
