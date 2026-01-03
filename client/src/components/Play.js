import React, { useEffect, useState, useContext } from 'react';
import { SocketContext } from '../App';
import minerImg from '../images/main-icon.png';
import phmnCoinImg from '../images/PHMN coin.png';
import timerImg from '../images/timer.png';
import frameImg from '../images/Frame 1321314691.png';
import topBackImg from '../images/top-back.png';
import ellipseImg from '../images/Ellipse.png';
import backgImg from '../images/backg.png';
import adsgramService from '../services/adsgram';

import { ADSGRAM_BLOCK_ID, ADSGRAM_DEBUG, fetchBlockIdFromSocket } from '../config/adsgram';
import DailyStreakPopup from './DailyStreakPopup';

function Play() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [miningState, setMiningState] = useState('idle'); // 'idle', 'active', 'completed'
  const [remainingTime, setRemainingTime] = useState(0);
  const [miningRate, setMiningRate] = useState(0.00463); // PHMN per hour (default level 1)
  const [, setMiningLevel] = useState(1); // Current mining level
  const [pendingRewards, setPendingRewards] = useState(0);
  const [miningProgress, setMiningProgress] = useState(0); // 0-100%
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionEndTime, setSessionEndTime] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState('');
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [showAdsModal, setShowAdsModal] = useState(false);
  const [isShowingAds, setIsShowingAds] = useState(false);

  const [adsStatus, setAdsStatus] = useState({ adsWatched: 0, adsRequired: 1, canStartMining: false });

  // Daily Streak State
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [streakData, setStreakData] = useState(null);
  const [isClaimingStreak, setIsClaimingStreak] = useState(false);

  const appSocket = useContext(SocketContext);

  // All major timezones of the world (40+ timezones)
  const timezones = [
    // North America
    { value: 'America/New_York', label: 'New York - Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Chicago - Central Time (CT)' },
    { value: 'America/Denver', label: 'Denver - Mountain Time (MT)' },
    { value: 'America/Phoenix', label: 'Phoenix - Mountain Time (MST)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles - Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Anchorage - Alaska Time (AKT)' },
    { value: 'America/Honolulu', label: 'Honolulu - Hawaii Time (HST)' },
    { value: 'America/Toronto', label: 'Toronto - Eastern Time (ET)' },
    { value: 'America/Vancouver', label: 'Vancouver - Pacific Time (PT)' },
    { value: 'America/Mexico_City', label: 'Mexico City - Central Time (CST)' },

    // South America
    { value: 'America/Sao_Paulo', label: 'São Paulo - Brasília Time (BRT)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires - Argentina Time (ART)' },
    { value: 'America/Lima', label: 'Lima - Peru Time (PET)' },
    { value: 'America/Bogota', label: 'Bogotá - Colombia Time (COT)' },
    { value: 'America/Santiago', label: 'Santiago - Chile Time (CLT)' },
    { value: 'America/Caracas', label: 'Caracas - Venezuela Time (VET)' },

    // Europe
    { value: 'Europe/London', label: 'London - Greenwich Mean Time (GMT)' },
    { value: 'Europe/Paris', label: 'Paris - Central European Time (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin - Central European Time (CET)' },
    { value: 'Europe/Rome', label: 'Rome - Central European Time (CET)' },
    { value: 'Europe/Madrid', label: 'Madrid - Central European Time (CET)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam - Central European Time (CET)' },
    { value: 'Europe/Athens', label: 'Athens - Eastern European Time (EET)' },
    { value: 'Europe/Moscow', label: 'Moscow - Moscow Time (MSK)' },
    { value: 'Europe/Istanbul', label: 'Istanbul - Turkey Time (TRT)' },
    { value: 'Europe/Kiev', label: 'Kyiv - Eastern European Time (EET)' },
    { value: 'Europe/Stockholm', label: 'Stockholm - Central European Time (CET)' },
    { value: 'Europe/Warsaw', label: 'Warsaw - Central European Time (CET)' },

    // Africa
    { value: 'Africa/Cairo', label: 'Cairo - Eastern European Time (EET)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg - South Africa Time (SAST)' },
    { value: 'Africa/Lagos', label: 'Lagos - West Africa Time (WAT)' },
    { value: 'Africa/Nairobi', label: 'Nairobi - East Africa Time (EAT)' },
    { value: 'Africa/Casablanca', label: 'Casablanca - Morocco Time (WET)' },

    // Middle East
    { value: 'Asia/Dubai', label: 'Dubai - Gulf Standard Time (GST)' },
    { value: 'Asia/Riyadh', label: 'Riyadh - Arabia Standard Time (AST)' },
    { value: 'Asia/Tehran', label: 'Tehran - Iran Standard Time (IRST)' },
    { value: 'Asia/Jerusalem', label: 'Jerusalem - Israel Time (IST)' },
    { value: 'Asia/Baghdad', label: 'Baghdad - Arabia Standard Time (AST)' },

    // Asia
    { value: 'Asia/Kolkata', label: 'Mumbai/New Delhi - India Standard Time (IST)' },
    { value: 'Asia/Karachi', label: 'Karachi - Pakistan Standard Time (PKT)' },
    { value: 'Asia/Dhaka', label: 'Dhaka - Bangladesh Time (BST)' },
    { value: 'Asia/Bangkok', label: 'Bangkok - Indochina Time (ICT)' },
    { value: 'Asia/Jakarta', label: 'Jakarta - Western Indonesia Time (WIB)' },
    { value: 'Asia/Manila', label: 'Manila - Philippine Time (PHT)' },
    { value: 'Asia/Singapore', label: 'Singapore - Singapore Time (SGT)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong - Hong Kong Time (HKT)' },
    { value: 'Asia/Shanghai', label: 'Shanghai - China Standard Time (CST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo - Japan Standard Time (JST)' },
    { value: 'Asia/Seoul', label: 'Seoul - Korea Standard Time (KST)' },
    { value: 'Asia/Vladivostok', label: 'Vladivostok - Vladivostok Time (VLAT)' },

    // Oceania
    { value: 'Australia/Sydney', label: 'Sydney - Australian Eastern Time (AEST)' },
    { value: 'Australia/Melbourne', label: 'Melbourne - Australian Eastern Time (AEST)' },
    { value: 'Australia/Brisbane', label: 'Brisbane - Australian Eastern Time (AEST)' },
    { value: 'Australia/Perth', label: 'Perth - Australian Western Time (AWST)' },
    { value: 'Australia/Adelaide', label: 'Adelaide - Australian Central Time (ACST)' },
    { value: 'Pacific/Auckland', label: 'Auckland - New Zealand Time (NZST)' },
    { value: 'Pacific/Honolulu', label: 'Honolulu - Hawaii Time (HST)' },
  ];

  // Initialize Adsgram
  useEffect(() => {
    const initializeAdsgram = async () => {
      let blockId = ADSGRAM_BLOCK_ID;

      // If block ID not set in env, try to fetch from backend via socket
      if (!blockId && appSocket && appSocket.connected) {
        console.log('📡 Fetching Adsgram block ID from backend via socket...');
        blockId = await fetchBlockIdFromSocket(appSocket);
      } else if (!blockId) {
        // Wait for socket to connect, then try again
        if (appSocket) {
          const checkSocket = () => {
            if (appSocket.connected) {
              fetchBlockIdFromSocket(appSocket).then(id => {
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
  }, [appSocket]);

  // Load ads status on mount and when user changes
  useEffect(() => {
    if (!appSocket || !appSocket.connected || !user) return;

    const loadAdsStatus = () => {
      appSocket.emit('ads:getStatus', { telegramId: user.id }, (response) => {
        if (response?.success) {
          setAdsStatus({
            adsWatched: response.adsWatched || 0,
            adsRequired: response.adsRequired || 1,
            canStartMining: response.canStartMining || false
          });
        }
      });
    };

    loadAdsStatus();
    // Refresh ads status periodically
    const statusInterval = setInterval(loadAdsStatus, 10000); // Every 10 seconds

    return () => clearInterval(statusInterval);

  }, [appSocket, user]);

  // Daily Streak Logic
  useEffect(() => {
    // We want to register listeners immediately, even if socket isn't connected yet,
    // so we don't miss any events if connection happens fast
    if (!appSocket) return;

    const handleStreakStatus = (data) => {
      if (data.success) {
        setStreakData(data);
        if (data.canClaim) {
          // Show popup automatically if can claim
          setShowStreakPopup(true);
        }
      }
    };

    const handleStreakClaimed = (data) => {
      setIsClaimingStreak(false);
      if (data.success) {
        setBalance(data.newBalance);
        setStreakData(prev => ({
          ...prev,
          streak: data.nextStreak,
          canClaim: false,
          reward: 0 // Waiting for next cycle/day
        }));
      } else {
        alert(data.error || 'Failed to claim streak');
      }
    };

    appSocket.on('user:dailyStreakStatus', handleStreakStatus);
    appSocket.on('user:dailyStreakClaimed', handleStreakClaimed);

    // Initial fetch if ready
    if (appSocket.connected && user) {
      console.log('📅 Play: Initial fetch of daily streak for', user.id);
      appSocket.emit('user:getDailyStreak', user.id);
    }

    // Also listen for connect event to fetch when socket becomes ready
    const handleConnect = () => {
      if (user) {
        console.log('📅 Play: Socket connected, fetching daily streak for', user.id);
        appSocket.emit('user:getDailyStreak', user.id);
      }
    };

    appSocket.on('connect', handleConnect);

    return () => {
      appSocket.off('user:dailyStreakStatus', handleStreakStatus);
      appSocket.off('user:dailyStreakClaimed', handleStreakClaimed);
      appSocket.off('connect', handleConnect);
    };
  }, [appSocket, user]);

  const handleClaimStreak = async () => {
    if (isClaimingStreak) return;

    if (!streakData?.canClaim) return;

    if (!adsgramService.isReady()) {
      alert('Ads are not available right now. Please try again later.');
      // For testing without ads, you might want to uncomment this:
      // setIsClaimingStreak(true);
      // appSocket.emit('user:claimDailyStreak', user.id);
      return;
    }

    setIsClaimingStreak(true);
    try {
      // Show 1 ad before claiming streak
      const result = await adsgramService.showAds(1, () => { });

      if (result && result.watched) {
        appSocket.emit('user:claimDailyStreak', user.id);
      } else {
        setIsClaimingStreak(false);
        // User closed ad or failed
      }
    } catch (e) {
      console.error('Error showing ad for streak:', e);
      setIsClaimingStreak(false);
      alert('Error showing ad. Please try again.');
    }
  };

  // Initialize Telegram WebApp
  useEffect(() => {
    const initializeTelegram = () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          const telegramUser = tg.initDataUnsafe?.user;
          if (telegramUser) {
            console.log('👤 Play component - Telegram user loaded:', telegramUser);
            setUser(telegramUser);

            // Referral processing is now handled centrally in App.js
            console.log('🔍 Play component - Referral processing handled by App.js');

            // Auto-generate referral code for this user if they don't have one
            const ensureReferralCodeExists = () => {
              // Only proceed if socket is available
              if (!appSocket || !appSocket.connected) {
                console.log('⚠️ Play component - Socket not ready, skipping referral code generation');
                return;
              }

              const userReferralCode = `ref_${telegramUser.id}`;
              console.log('🔍 Play component - Ensuring referral code exists:', userReferralCode);

              appSocket.emit('referral:checkCode', { referralCode: userReferralCode }, (checkRes) => {
                if (!checkRes?.success) {
                  console.log('🔍 Play component - User does not have referral code, generating one...');
                  appSocket.emit('referral:generateCode', {
                    telegramId: telegramUser.id,
                    referralCode: userReferralCode
                  }, (generateRes) => {
                    if (generateRes?.success) {
                      console.log('🎯 Play component - Auto-generated referral code successfully');
                    } else {
                      console.error('❌ Play component - Failed to auto-generate referral code:', generateRes?.error);
                    }
                  });
                } else {
                  console.log('🔍 Play component - User already has referral code');
                }
              });
            };

            // Only try to generate referral code if socket is ready
            if (appSocket && appSocket.connected) {
              ensureReferralCodeExists();
            } else {
              console.log('⏳ Play component - Waiting for socket to be ready before generating referral code');
              // Set up a retry mechanism when socket becomes available
              const checkSocketAndRetry = () => {
                if (appSocket && appSocket.connected) {
                  console.log('✅ Socket now ready, generating referral code');
                  ensureReferralCodeExists();
                } else {
                  setTimeout(checkSocketAndRetry, 100);
                }
              };
              checkSocketAndRetry();
            }
          } else {
            console.log('⚠️ Play component - Telegram WebApp ready but no user data');
          }
        } catch (error) {
          console.error('❌ Play component - Error initializing Telegram WebApp:', error);
        }
      } else {
        console.log('⏳ Play component - Telegram WebApp not ready yet, retrying...');
        // Retry after a short delay
        setTimeout(initializeTelegram, 100);
      }
    };

    // Start initialization
    initializeTelegram();
  }, [appSocket]);


  // Load mining session status on mount and when socket/user is ready
  useEffect(() => {
    let statusInterval = null;
    let retryTimeout = null;
    let retryCount = 0;
    const maxRetries = 10;

    const loadMiningStatus = () => {
      // Wait for socket and user to be ready
      if (!appSocket || !appSocket.connected || !user) {
        console.log('⏳ Play: Waiting for socket/user to be ready...', {
          hasSocket: !!appSocket,
          socketConnected: appSocket?.connected,
          hasUser: !!user
        });

        // Retry after a short delay
        if (retryCount < maxRetries) {
          retryCount++;
          retryTimeout = setTimeout(loadMiningStatus, 500);
        } else {
          console.error('❌ Play: Failed to load mining status after max retries');
          setIsLoadingStatus(false);
        }
        return;
      }

      console.log('🔄 Play: Loading mining status for user:', user.id);
      setIsLoadingStatus(true);

      appSocket.emit('playMining:status', { telegramId: user.id }, (response) => {
        setIsLoadingStatus(false);

        if (response?.success) {
          console.log('✅ Play: Mining status loaded:', {
            status: response.sessionStatus,
            remainingTime: response.remainingTime,
            miningRate: response.miningRate,
            pendingRewards: response.pendingRewards
          });

          setMiningState(response.sessionStatus);
          setRemainingTime(response.remainingTime);
          // Use effective mining rate (already includes boost multiplier if active)
          setMiningRate(response.miningRate || response.baseMiningRate || 0.00463);
          setMiningLevel(response.miningLevel || 1);

          // Store session times for client-side calculation
          if (response.startTime && response.endTime) {
            setSessionStartTime(new Date(response.startTime));
            setSessionEndTime(new Date(response.endTime));
          }

          // Calculate pending rewards client-side for both active and completed sessions
          if ((response.sessionStatus === 'active' || response.sessionStatus === 'completed') && response.startTime && response.endTime) {
            const startTime = new Date(response.startTime);
            const endTime = new Date(response.endTime);
            const now = new Date();
            const totalCycleHours = (endTime - startTime) / (1000 * 60 * 60);
            const effectiveRate = response.miningRate || response.baseMiningRate || 0.00463;

            if (response.sessionStatus === 'active') {
              // For active sessions, calculate based on elapsed time
              const elapsedHours = (now - startTime) / (1000 * 60 * 60);
              const calculatedPending = Math.min(effectiveRate * totalCycleHours, effectiveRate * elapsedHours);
              setPendingRewards(Math.max(0, calculatedPending));
            } else {
              // For completed sessions, use total cycle rewards
              const calculatedPending = effectiveRate * totalCycleHours;
              setPendingRewards(Math.max(0, calculatedPending));
            }
          } else {
            setPendingRewards(response.pendingRewards || 0);
          }

          // CRITICAL: Always update balance from database PHMN value
          // This ensures balance always reflects the actual database value
          const dbPHMN = response.PHMN || 0;
          setBalance(dbPHMN);

          // Log boost status if active
          if (response.activeBoost) {
            console.log(`🚀 Active boost: ${response.activeBoost.mode} (${response.activeBoost.multiplier}x)`);
          }

          console.log('💾 Play: Balance updated from DB PHMN:', dbPHMN);

          // Calculate progress percentage (0-100%) based on actual cycle duration
          if (response.sessionStatus === 'active' && response.remainingTime > 0 && response.startTime && response.endTime) {
            const startTime = new Date(response.startTime);
            const endTime = new Date(response.endTime);
            const now = new Date();
            const totalSessionTime = (endTime - startTime) / 1000; // Total cycle duration in seconds
            const elapsedTime = (now - startTime) / 1000; // Elapsed time in seconds
            const progress = Math.min(100, Math.max(0, (elapsedTime / totalSessionTime) * 100));
            setMiningProgress(progress);
          } else if (response.sessionStatus === 'completed') {
            setMiningProgress(100);
          } else {
            setMiningProgress(0);
          }
        } else {
          console.error('❌ Play: Failed to load mining status:', response?.error);
          // If error, assume idle state
          setMiningState('idle');
          setMiningProgress(0);
          // Still try to get balance from database if status fails
          // Balance will be loaded from status when it succeeds
        }
      });
    };

    // Start loading status
    loadMiningStatus();

    // Set up periodic refresh once socket/user are ready
    const setupPeriodicRefresh = () => {
      if (appSocket && appSocket.connected && user) {
        statusInterval = setInterval(() => {
          if (appSocket && appSocket.connected && user) {
            appSocket.emit('playMining:status', { telegramId: user.id }, (response) => {
              if (response?.success) {
                setMiningState(response.sessionStatus);
                setRemainingTime(response.remainingTime);
                // Use effective mining rate (already includes boost multiplier if active)
                setMiningRate(response.miningRate || response.baseMiningRate || 0.00463);
                setMiningLevel(response.miningLevel || 1);

                // Store session times for client-side calculation
                if (response.startTime && response.endTime) {
                  setSessionStartTime(new Date(response.startTime));
                  setSessionEndTime(new Date(response.endTime));
                }

                // Calculate pending rewards client-side for both active and completed sessions
                if ((response.sessionStatus === 'active' || response.sessionStatus === 'completed') && response.startTime && response.endTime) {
                  const startTime = new Date(response.startTime);
                  const endTime = new Date(response.endTime);
                  const now = new Date();
                  const totalCycleHours = (endTime - startTime) / (1000 * 60 * 60);
                  const effectiveRate = response.miningRate || response.baseMiningRate || 0.00463;

                  if (response.sessionStatus === 'active') {
                    // For active sessions, calculate based on elapsed time
                    const elapsedHours = (now - startTime) / (1000 * 60 * 60);
                    const calculatedPending = Math.min(effectiveRate * totalCycleHours, effectiveRate * elapsedHours);
                    setPendingRewards(Math.max(0, calculatedPending));
                  } else {
                    // For completed sessions, use total cycle rewards
                    const calculatedPending = effectiveRate * totalCycleHours;
                    setPendingRewards(Math.max(0, calculatedPending));
                  }
                } else {
                  setPendingRewards(response.pendingRewards || 0);
                }

                // CRITICAL: Always sync balance from database PHMN value
                const dbPHMN = response.PHMN || 0;
                setBalance(dbPHMN);
                console.log('🔄 Play: Balance synced from DB:', dbPHMN);

                // Log boost status if active
                if (response.activeBoost) {
                  console.log(`🚀 Active boost: ${response.activeBoost.mode} (${response.activeBoost.multiplier}x)`);
                }

                // Update progress based on actual cycle duration
                if (response.sessionStatus === 'active' && response.remainingTime > 0 && response.startTime && response.endTime) {
                  const startTime = new Date(response.startTime);
                  const endTime = new Date(response.endTime);
                  const now = new Date();
                  const totalSessionTime = (endTime - startTime) / 1000;
                  const elapsedTime = (now - startTime) / 1000;
                  const progress = Math.min(100, Math.max(0, (elapsedTime / totalSessionTime) * 100));
                  setMiningProgress(progress);
                } else if (response.sessionStatus === 'completed') {
                  setMiningProgress(100);
                }
              }
            });
          }
        }, 5000); // Refresh every 5 seconds
      }
    };

    // Try to set up periodic refresh after a delay
    const refreshTimeout = setTimeout(setupPeriodicRefresh, 1000);

    return () => {
      if (statusInterval) clearInterval(statusInterval);
      if (retryTimeout) clearTimeout(retryTimeout);
      clearTimeout(refreshTimeout);
    };
  }, [appSocket, user]);

  // Simple: Check ads status and start mining or show ads
  const checkTimezoneAndStart = () => {
    if (!appSocket || !appSocket.connected || !user) return;
    startMining();
  };

  // Set user timezone
  const setUserTimezone = (timezone) => {
    if (!appSocket || !appSocket.connected || !user) return;

    appSocket.emit('user:setTimezone', { telegramId: user.id, timezone }, (response) => {
      if (response?.success) {
        console.log('✅ Timezone set successfully:', timezone);
        setShowTimezoneModal(false);
        // Now start mining
        startMining();
      } else {
        console.error('Failed to set timezone:', response?.error);
        alert(response?.error || 'Failed to set timezone');
      }
    });
  };

  // Show ads and mark them as watched, then start mining
  const showAdsBeforeMining = async () => {
    if (isShowingAds) return; // Prevent duplicate calls

    if (!adsgramService.isReady()) {
      alert('Ads not available. Please try again later.');
      return;
    }

    setIsShowingAds(true);
    setShowAdsModal(true);

    try {
      // Get current ads status
      const getAdsStatus = () => new Promise((resolve) => {
        appSocket.emit('ads:getStatus', { telegramId: user.id }, (response) => {
          resolve(response?.success ? response : { adsWatched: 0, adsRequired: 1 });
        });
      });

      let status = await getAdsStatus();
      let adsWatched = status.adsWatched || 0;
      const adsRequired = 1;
      const adsNeeded = adsRequired - adsWatched;

      // If already have 1 ad, start mining
      if (adsNeeded <= 0) {
        setShowAdsModal(false);
        setIsShowingAds(false);
        startMining();
        return;
      }

      // Show ads one at a time with 10 second delay between them
      let currentAdsWatched = status.adsWatched || 0;

      // Helper function to mark ad as watched (defined outside loop to avoid closure issues)
      const markAdWatched = async (currentCount) => {
        return new Promise((resolve) => {
          appSocket.emit('ads:markWatched', {
            telegramId: user.id,
            adsWatched: 1
          }, (response) => {
            if (response?.success) {
              const newCount = response.adsWatched;
              setAdsStatus({
                adsWatched: newCount,
                adsRequired: response.adsRequired,
                canStartMining: response.canStartMining
              });
              resolve(newCount);
            } else {
              resolve(currentCount);
            }
          });
        });
      };

      // Helper function to show a single ad and mark it as watched (defined outside loop)
      const showSingleAd = async (currentCount) => {
        // Create a promise to track when the ad is marked as watched
        let adWatchPromise = null;

        // Show 1 ad at a time
        const result = await adsgramService.showAds(1, (adNumber, adResult) => {
          // Mark ad as watched when shown - use captured currentCount parameter
          adWatchPromise = markAdWatched(currentCount);
        });

        // Wait for the ad to be marked as watched and return result and new count
        let updatedCount = currentCount;
        if (adWatchPromise) {
          updatedCount = await adWatchPromise;
        }

        return { result, updatedCount };
      };

      for (let i = 0; i < adsNeeded; i++) {
        // Capture current value for this iteration
        const currentCount = currentAdsWatched;

        // Show ad and get updated count
        const { result, updatedCount } = await showSingleAd(currentCount);

        // Update count after iteration completes
        currentAdsWatched = updatedCount;

        // If ad wasn't shown, break the loop
        if (result.watched === 0) {
          console.log('No ad available, stopping ad flow');
          break;
        }

        // Check if we have enough ads now
        if (currentAdsWatched >= adsRequired) {
          break;
        }

        // 10 second countdown before showing next ad (except after the last one)
        if (i < adsNeeded - 1 && currentAdsWatched < adsRequired) {
          console.log('⏳ Starting 10 second countdown before next ad...');
          // Wait 10 seconds before showing next ad
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      setShowAdsModal(false);
      setIsShowingAds(false);

      // If we have 1 ad, start mining. Otherwise, user needs to try again
      if (adsWatched >= adsRequired) {
        setTimeout(() => startMining(), 300);
      }

    } catch (error) {
      console.error('Error showing ads:', error);
      setShowAdsModal(false);
      setIsShowingAds(false);
      alert('Error showing ads. Please try again.');
    }
  };


  // Start mining - backend will check if ads are needed
  const startMining = () => {
    if (!appSocket || !appSocket.connected || !user) return;

    appSocket.emit('playMining:start', { telegramId: user.id }, (response) => {
      if (response?.success) {
        // Mining started successfully
        setMiningState('active');
        setMiningRate(response.miningRate || response.baseMiningRate || 0.00463);
        setMiningLevel(response.miningLevel || 1);
        const endTime = new Date(response.endTime);
        const now = new Date();
        setRemainingTime(Math.max(0, Math.floor((endTime - now) / 1000)));
      } else {
        // Handle errors
        if (response?.requiresTimezone) {
          setShowTimezoneModal(true);
        } else if (response?.requiresAds) {
          showAdsBeforeMining();
        } else {
          alert(response?.error || 'Failed to start mining');
        }
      }
    });
  };

  // Claim mining rewards (show 1 ad before claiming)
  const claimRewards = async () => {
    if (!appSocket || !appSocket.connected || !user) {
      console.error('❌ Play: Cannot claim - socket or user not ready');
      return;
    }

    // Require 1 ad view before allowing claim
    if (!adsgramService.isReady()) {
      alert('Ads are not available right now. Please try again later.');
      return;
    }

    if (isShowingAds) {
      // Prevent duplicate ad requests
      return;
    }

    try {
      setIsShowingAds(true);
      setShowAdsModal(true);

      const result = await adsgramService.showAds(1, () => { });

      setShowAdsModal(false);
      setIsShowingAds(false);

      // If user didn't actually watch the ad, do not proceed with claim
      if (!result || result.watched === 0) {
        console.log('❌ Play: Claim ad was not watched, cancelling claim');
        return;
      }
    } catch (error) {
      console.error('❌ Play: Error showing ad before claim:', error);
      setShowAdsModal(false);
      setIsShowingAds(false);
      alert('Error showing ad. Please try again.');
      return;
    }

    console.log('💰 Play: Claiming mining rewards for user:', user.id);

    appSocket.emit('playMining:claim', { telegramId: user.id }, (response) => {
      if (response?.success) {
        console.log('✅ Play: Rewards claimed successfully:', {
          claimedRewards: response.claimedRewards,
          newBalance: response.newBalance
        });

        // Update balance from database response
        setBalance(response.newBalance);
        setPendingRewards(0);
        setMiningState('idle');
        setRemainingTime(0);
        setMiningProgress(0);

        // Refresh status from database to ensure everything is in sync
        setTimeout(() => {
          appSocket.emit('playMining:status', { telegramId: user.id }, (statusResponse) => {
            if (statusResponse?.success) {
              setBalance(statusResponse.PHMN || 0);
              console.log('🔄 Play: Balance refreshed from DB:', statusResponse.PHMN);
            }
          });
        }, 500);

        // Show success message - use pendingRewards as fallback if claimedRewards is 0 or undefined
        const claimedAmount = response.claimedRewards || pendingRewards || 0;
        alert(`Successfully claimed ${claimedAmount.toLocaleString(undefined, { maximumFractionDigits: 5, minimumFractionDigits: 5 })} PHMN!`);
      } else {
        console.error('❌ Play: Failed to claim rewards:', response?.error);
        alert(response?.error || 'Failed to claim rewards');
      }
    });
  };

  // Update timer countdown when mining is active (syncs with server every 5 seconds)
  useEffect(() => {
    if (miningState !== 'active') return;

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          setMiningState('completed');
          // Final rewards are calculated server-side based on actual cycle duration
          // Server will update pendingRewards in the next status sync
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [miningState, miningRate]);

  // Sync timer with server periodically to handle app close/reopen
  useEffect(() => {
    if (miningState !== 'active' || !appSocket || !appSocket.connected || !user) return;

    const syncTimer = setInterval(() => {
      appSocket.emit('playMining:status', { telegramId: user.id }, (response) => {
        if (response?.success) {
          // Update state if session completed on server
          if (response.sessionStatus === 'completed' && miningState === 'active') {
            setMiningState('completed');
            setRemainingTime(0);
            // Store session times for completed session
            if (response.startTime && response.endTime) {
              setSessionStartTime(new Date(response.startTime));
              setSessionEndTime(new Date(response.endTime));
              // Calculate pending rewards for completed session
              const startTime = new Date(response.startTime);
              const endTime = new Date(response.endTime);
              const totalCycleHours = (endTime - startTime) / (1000 * 60 * 60);
              const effectiveRate = response.miningRate || response.baseMiningRate || 0.00463;
              const calculatedPending = effectiveRate * totalCycleHours;
              setPendingRewards(Math.max(0, calculatedPending));
            } else {
              setPendingRewards(response.pendingRewards || 0);
            }
          } else if (response.sessionStatus === 'active') {
            // Sync remaining time from server
            setRemainingTime(response.remainingTime);
            // Store session times
            if (response.startTime && response.endTime) {
              setSessionStartTime(new Date(response.startTime));
              setSessionEndTime(new Date(response.endTime));
            }
            // Calculate pending rewards client-side for active sessions
            if (response.startTime && response.endTime) {
              const startTime = new Date(response.startTime);
              const endTime = new Date(response.endTime);
              const now = new Date();
              const elapsedHours = (now - startTime) / (1000 * 60 * 60);
              const totalCycleHours = (endTime - startTime) / (1000 * 60 * 60);
              const effectiveRate = response.miningRate || response.baseMiningRate || 0.00463;
              const calculatedPending = Math.min(effectiveRate * totalCycleHours, effectiveRate * elapsedHours);
              setPendingRewards(Math.max(0, calculatedPending));
            } else {
              setPendingRewards(response.pendingRewards || 0);
            }
          } else if (response.sessionStatus === 'completed') {
            // Calculate pending rewards for completed sessions
            if (response.startTime && response.endTime) {
              const startTime = new Date(response.startTime);
              const endTime = new Date(response.endTime);
              const totalCycleHours = (endTime - startTime) / (1000 * 60 * 60);
              const effectiveRate = response.miningRate || response.baseMiningRate || 0.00463;
              const calculatedPending = effectiveRate * totalCycleHours;
              setPendingRewards(Math.max(0, calculatedPending));
            } else {
              setPendingRewards(response.pendingRewards || 0);
            }
          }
        }
      });
    }, 5000); // Sync every 5 seconds

    return () => clearInterval(syncTimer);
  }, [miningState, appSocket, user]);

  // Update pending rewards and progress during active mining (real-time calculation)
  useEffect(() => {
    if ((miningState !== 'active' && miningState !== 'completed') || !sessionStartTime || !sessionEndTime) {
      if (miningState === 'completed') {
        setMiningProgress(100);
        // Calculate final pending rewards for completed session
        if (sessionStartTime && sessionEndTime) {
          const totalCycleHours = (sessionEndTime - sessionStartTime) / (1000 * 60 * 60);
          const calculatedPending = miningRate * totalCycleHours;
          setPendingRewards(Math.max(0, calculatedPending));
        }
      } else {
        setMiningProgress(0);
      }
      return;
    }

    // Update pending rewards in real-time every second
    const updateInterval = setInterval(() => {
      const now = new Date();
      const startTime = sessionStartTime;
      const endTime = sessionEndTime;

      if (startTime && endTime) {
        const totalCycleHours = (endTime - startTime) / (1000 * 60 * 60);

        if (miningState === 'active') {
          // For active sessions, calculate based on elapsed time
          const elapsedHours = (now - startTime) / (1000 * 60 * 60);
          const calculatedPending = Math.min(miningRate * totalCycleHours, miningRate * elapsedHours);
          setPendingRewards(Math.max(0, calculatedPending));

          // Update progress
          const totalSessionTime = (endTime - startTime) / 1000;
          const elapsedTime = (now - startTime) / 1000;
          const progress = Math.min(100, Math.max(0, (elapsedTime / totalSessionTime) * 100));
          setMiningProgress(progress);
        } else if (miningState === 'completed') {
          // For completed sessions, use total cycle rewards
          const calculatedPending = miningRate * totalCycleHours;
          setPendingRewards(Math.max(0, calculatedPending));
          setMiningProgress(100);
        }
      }
    }, 1000); // Update every second

    return () => clearInterval(updateInterval);
  }, [miningState, sessionStartTime, sessionEndTime, miningRate]);

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return `${h}:${mm}:${ss}`;
  };


  return (
    <div className="relative h-[100dvh] text-white font-sans overflow-hidden bg-gradient-to-b from-[#160924] via-[#30154e] to-[#0d041a] flex flex-col pb-[calc(env(safe-area-inset-bottom)+109px)]">
      {/* Top Bar */}
      <div className="pt-4 px-4">
        {/* Balance */}
        <div className="text-center">
          <div
            className="flex items-center justify-center gap-2 py-3 px-6 mx-auto"
            style={{
              backgroundImage: `url("${topBackImg}")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: '100% 100%',
              maxWidth: '90%',
              minWidth: '280px',
            }}
          >
            <img
              src={phmnCoinImg}
              alt="PHMN Coin"
              className="w-8 h-8 select-none"
              draggable="false"
            />
            <div className="text-3xl font-bold tracking-wider">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 5, minimumFractionDigits: 3 })}
            </div>
          </div>
        </div>
      </div>

      {/* Circle area */}
      <div className="mt-5 relative px-6 flex items-center justify-center">
        {/* Ellipse background - outside the rounded-full */}
        <img
          src={ellipseImg}
          alt="Ellipse"
          className="absolute w-[76vw] h-[76vw] max-w-[320px] max-h-[320px] select-none pointer-events-none z-0"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          draggable="false"
        />
        <div
          className="relative mx-auto w-[72vw] h-[72vw] max-w-[280px] max-h-[280px] rounded-full z-10"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.5) 0%, rgba(88, 28, 135, 0.3) 50%, rgba(30, 27, 75, 0.1) 100%)'
          }}
        >
          <div className="absolute" />
          <button
            className="absolute mt-5 inset-0 focus:outline-none active:scale-[0.90] transition-transform"
          >
            <img
              src={minerImg}
              alt="Miner"
              className="absolute bottom-8 ml-2 -mb-1.5 left-1/2 -translate-x-1/2 w-[52vw] max-w-[260px] select-none pointer-events-none"
              draggable="false"
            />
          </button>
        </div>
      </div>

      {/* Start/Claim Button */}
      <div className="px-6 relative z-50">
        {miningState === 'idle' && (
          <button
            onClick={checkTimezoneAndStart}
            className="mx-auto block -mt-8 w-full max-w-[280px] py-3 rounded-full bg-gradient-to-b from-[#a855f7] to-[#7c3aed] shadow-lg shadow-purple-900/40 text-white relative z-50"
          >
            {adsStatus.canStartMining || adsStatus.adsWatched >= 1
              ? 'Start Mining'
              : 'Watch Ads to Start'}
          </button>
        )}
        {miningState === 'completed' && (
          <button
            onClick={claimRewards}
            className="mx-auto block -mt-8 w-full max-w-[280px] py-3 rounded-full bg-gradient-to-b from-[#10b981] to-[#059669] shadow-lg shadow-green-900/40 text-white relative z-50"
          >
            Claim {(pendingRewards || 0).toLocaleString(undefined, { maximumFractionDigits: 3, minimumFractionDigits: 3 })} PHMN
          </button>
        )}
        {miningState === 'active' && (
          <div className="mx-auto block -mt-8 w-full max-w-[280px] py-3 rounded-full bg-gradient-to-b from-[#4e4e4e] to-[#6d6d6d] shadow-lg shadow-indigo-900/40 text-white text-center relative z-50">
            Mining in Progress
          </div>
        )}
      </div>

      {/* Daily Streak Button - Floating Right Middle */}
      <button
        onClick={() => setShowStreakPopup(true)}
        className="absolute right-0 top-[20%] -translate-y-1/2 bg-gradient-to-l from-purple-600 to-indigo-600 text-white py-3 px-1 pl-3 rounded-l-xl shadow-[0_0_15px_rgba(168,85,247,0.4)] z-40 flex gap-2 items-center border-y border-l border-purple-400/50 hover:pl-4 transition-all"
      >
        <div className="text-xl">📅</div>
        <div className="flex flex-col items-start leading-none pr-1">
          <span className="text-[10px] font-bold">DAILY</span>
          <span className="text-[10px] font-bold text-purple-200">BONUS</span>
        </div>
        {streakData?.canClaim && (
          <span className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
        )}
      </button>

      {/* Bottom panel */}
      <div
        className="absolute left-0 right-0 px-3 pt-5 pb-5"
        style={{
          top: 'calc(100% - 275px - 20px)',
          bottom: 0,
          backgroundImage: `url("${backgImg}")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: '100% 100%',
        }}
      >
        <div className="flex items-start justify-between gap-4">

          {/* Remaining Time section */}
          <div className="flex items-start gap-2 ml-2 flex-shrink-0">

            <img
              src={frameImg}
              alt="Timer"
              className="w-10 h-10 mt-1 select-none flex-shrink-0 object-contain"
              draggable="false"
            />
          </div>

          {/* Remaining Time section */}
          <div className="flex items-start gap-2 flex-1">

            <div className="flex flex-col pl-3">
              <span className="text-xs opacity-80 whitespace-nowrap">Remaining Time</span>
              <div className="text-sm mt-0.5 flex items-center gap-1">
                <img
                  src={timerImg}
                  alt="Timer"
                  className="w-4 h-4"
                  draggable="false"
                />
                <span>{isLoadingStatus ? '...' : (miningState === 'active' ? formatTime(remainingTime) : '0:00:00')}</span>
              </div>
            </div>
          </div>

          {/* PHMN/HR section */}
          <div className=" ml-6">

            <div className="flex flex-col pr-6">
              <span className="text-xs opacity-80">PHMN/HR</span>
              <div className="text-sm text-yellow-300 mt-0.5 flex items-center gap-1">
                <img
                  src={phmnCoinImg}
                  alt="PHMN Coin"
                  className="w-5 h-5 select-none"
                  draggable="false"
                />
                <span>+{miningRate.toFixed(5)}</span>
              </div>
            </div>
          </div>

          {/* Status/Claim button */}
          {miningState === 'active' && (
            <div className="px-4 py-2 rounded-xl bg-[#5d4b85] text-white text-xs whitespace-nowrap pl-3">
              {(pendingRewards || 0).toLocaleString(undefined, { maximumFractionDigits: 3, minimumFractionDigits: 3 })} mined
            </div>
          )}

          {/* Daily Streak Button - Floating Right */}


          {miningState === 'completed' && (
            <div className="px-4 py-2 rounded-xl bg-[#10b981] text-white text-xs whitespace-nowrap">
              Claim
            </div>
          )}
          {miningState === 'idle' && (
            <div className="px-4 py-2 rounded-xl bg-gray-600 text-white text-xs whitespace-nowrap">
              ...
            </div>
          )}
        </div>

        {/* Progress bar for active mining */}
        {miningState === 'active' && (
          <div className="">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="opacity-70"></span>
              <span className="font-semibold">{miningProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-purple-900/30 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#a855f7] to-[#7c3aed] transition-all duration-500 ease-out"
                style={{ width: `${miningProgress}%` }}
              />
            </div>
          </div>
        )}


      </div>

      {/* Ads Modal */}
      {showAdsModal}

      {/* Daily Streak Popup */}
      <DailyStreakPopup
        isOpen={showStreakPopup}
        onClose={() => setShowStreakPopup(false)}
        streakData={streakData}
        onClaim={handleClaimStreak}
        isLoading={isClaimingStreak}
      />

      {/* Timezone Selection Modal */}
      {showTimezoneModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1a0f2e] to-[#2d1b4e] rounded-2xl p-6 max-w-md w-full border border-purple-500/30 max-h-[70vh] flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Select Your Timezone</h2>
            <p className="text-sm text-gray-300 mb-4 text-center">
              Choose your timezone to set up mining cycles. This will only be asked once.
            </p>

            {/* Search input */}
            <input
              type="text"
              placeholder="Search timezone..."
              value={timezoneSearch}
              onChange={(e) => setTimezoneSearch(e.target.value)}
              className="w-full px-4 py-2 mb-4 rounded-lg bg-purple-900/30 text-white border border-purple-500/30 focus:outline-none focus:border-purple-400 placeholder-gray-400"
            />

            {/* Timezone list with scroll */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-2 min-h-0">
              {timezones
                .filter((tz) =>
                  tz.label.toLowerCase().includes(timezoneSearch.toLowerCase()) ||
                  tz.value.toLowerCase().includes(timezoneSearch.toLowerCase())
                )
                .map((tz) => (
                  <button
                    key={tz.value}
                    onClick={() => setSelectedTimezone(tz.value)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${selectedTimezone === tz.value
                      ? 'bg-purple-600 text-white border-2 border-purple-400'
                      : 'bg-purple-900/30 text-gray-200 border-2 border-transparent hover:bg-purple-800/50'
                      }`}
                  >
                    {tz.label}
                  </button>
                ))}
              {timezones.filter((tz) =>
                tz.label.toLowerCase().includes(timezoneSearch.toLowerCase()) ||
                tz.value.toLowerCase().includes(timezoneSearch.toLowerCase())
              ).length === 0 && (
                  <div className="text-center text-gray-400 py-4">
                    No timezones found matching "{timezoneSearch}"
                  </div>
                )}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowTimezoneModal(false);
                  setSelectedTimezone('');
                  setTimezoneSearch('');
                }}
                className="flex-1 py-3 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedTimezone) {
                    setUserTimezone(selectedTimezone);
                    setTimezoneSearch('');
                  } else {
                    alert('Please select a timezone');
                  }
                }}
                className="flex-1 py-3 rounded-lg bg-gradient-to-b from-[#a855f7] to-[#7c3aed] text-white hover:from-[#9333ea] hover:to-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!selectedTimezone}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyframes for floating labels */}
      <style>{`
        @keyframes riseFade {
          0% { opacity: 0; transform: translate(-50%, -30%) scale(0.9); }
          10% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -120%) scale(1.1); }
        }
      `}</style>
    </div>
  );
}

export default Play;
