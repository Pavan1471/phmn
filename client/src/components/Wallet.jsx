import React, { useState, useContext, useEffect, useMemo } from 'react';
import { SocketContext } from '../App';
import { useTonConnect } from '../hooks/useTonConnect';
import { motion } from 'framer-motion';
import phmnCoinImg from '../images/PHMN coin.png';
import walletIconImg from '../images/wallet icon.png';
import arrowImg from '../images/arrow.png';


function Wallet({ telegramUser }) {
  const [balanceInfo, setBalanceInfo] = useState(null);

  const socket = useContext(SocketContext);
  
  // Add TON wallet connection hook
  const { 
    connected, 
    loading: walletLoading, 
    error: walletError, 
    connect, 
    disconnect 
  } = useTonConnect();

  // User data state
  const [user, setUser] = useState(null);

  // Referral system state
  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [botUsername, setBotUsername] = useState('');

  // Fetch user data on component mount
  useEffect(() => {
    if (!socket || !telegramUser) return;
    
    console.log('🔍 Wallet: Fetching user data for:', telegramUser.id);
    socket.emit('user:getUserData', { telegramId: telegramUser.id }, (response) => {
      if (response.success) {
        console.log('✅ Wallet: User data received:', response.user);
        setUser(response.user);
      } else {
        console.error('❌ Wallet: Failed to fetch user data:', response.error);
      }
    });
  }, [socket, telegramUser]);

  // Fetch referral code and stats
  useEffect(() => {
    if (!socket || !telegramUser) return;

    setReferralLoading(true);
    
    // Get bot username
    socket.emit('app:getBotUsername', {}, (response) => {
      if (response?.success && response.botUsername) {
        setBotUsername(response.botUsername);
      } else {
        // Fallback: try to extract from URL or use default
        const urlParams = new URLSearchParams(window.location.search);
        const startParam = urlParams.get('start');
        if (startParam) {
          const currentUrl = window.location.href;
          const match = currentUrl.match(/https:\/\/t\.me\/([^?]+)/);
          if (match) {
            setBotUsername(match[1]);
          }
        } else {
          // Use default bot username
          setBotUsername('PHMNCHADBOT');
        }
      }
    });

    // Get referral code
    socket.emit('referral:getCode', { telegramId: telegramUser.id }, (response) => {
      if (response?.success) {
        setReferralCode(response.referralCode || '');
      }
      setReferralLoading(false);
    });

    // Get referral stats (includes friends list)
    socket.emit('referral:getStats', { telegramId: telegramUser.id }, (response) => {
      if (response?.success && response.stats) {
        setReferralStats(response.stats);
      }
    });
  }, [socket, telegramUser]);

  // Generate referral link
  const generateReferralLink = () => {
    if (!botUsername || !referralCode) return '';
    return `https://t.me/${botUsername}?start=${referralCode}`;
  };

  // Copy referral link to clipboard
  const handleCopyLink = async () => {
    const link = generateReferralLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // Share referral link
  const handleInviteFriends = async () => {
    const link = generateReferralLink();
    if (!link) return;

    // Try native share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on PHMN!',
          text: 'Invite to your friends and get extra coins',
          url: link,
        });
        return;
      } catch (error) {
        // User cancelled or error, fall back to copy
        console.log('Share cancelled or failed, falling back to copy');
      }
    }

    // Fall back to copy
    handleCopyLink();
  };

  // Refresh friends list
  const handleRefreshFriends = () => {
    if (!socket || !telegramUser) return;
    
    socket.emit('referral:getStats', { telegramId: telegramUser.id }, (response) => {
      if (response?.success && response.stats) {
        setReferralStats(response.stats);
      }
    });
  };

  // Add friendly address calculation - use stored wallet address
  const friendlyAddress = useMemo(() => {
    // Simply use the stored wallet address from database
    if (user?.walletAddress) {
      console.log('🔍 Wallet: Using stored wallet address:', user.walletAddress);
      return user.walletAddress;
    }
    
    return '';
  }, [user?.walletAddress]);
  
  useEffect(() => {
    if (!socket || !telegramUser?.id) return;

    let isMounted = true;

    const fetchBalanceFromServer = () => {
      socket.emit('playMining:status', { telegramId: telegramUser.id }, (response) => {
        if (!isMounted) return;

        if (response?.success) {
          const nextBalance = response.PHMN ?? response.balance ?? 0;

          setBalanceInfo((prev) => ({
            ...prev,
            phmnBalance: nextBalance,
          }));

          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  phmnBalance: nextBalance,
                  balance: nextBalance,
                }
              : prev
          );
        } else {
          console.error('❌ Wallet: Failed to sync PHMN balance:', response?.error);
        }
      });
    };

    fetchBalanceFromServer();
    const balanceInterval = setInterval(fetchBalanceFromServer, 5000);

    return () => {
      isMounted = false;
      clearInterval(balanceInterval);
    };
  }, [socket, telegramUser?.id]);

  const phmnBalance = useMemo(() => {
    const rawValue =
      balanceInfo?.phmnBalance ??
      balanceInfo?.balance ??
      user?.phmnBalance ??
      user?.balance ??
      0;

    const numericValue =
      typeof rawValue === 'number'
        ? rawValue
        : parseFloat(typeof rawValue === 'string' ? rawValue : '0');

    return Number.isFinite(numericValue) ? numericValue : 0;
  }, [balanceInfo?.balance, balanceInfo?.phmnBalance, user?.balance, user?.phmnBalance]);

  const formattedBalance = useMemo(() => {
    try {
      return phmnBalance.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    } catch (error) {
      return '0';
    }
  }, [phmnBalance]);

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

  return (
    <motion.div 
      className="relative min-h-screen text-white font-sans overflow-x-hidden"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="grok-bg" />
      <div className="relative z-10 px-4 pt-12 pb-32">
        <div className="max-w-sm mx-auto">
          {/* Two cards stacked vertically */}
          <div className="flex flex-col gap-4">
            {/* Balance Card */}
            <motion.div
              className="w-full rounded-3xl bg-gradient-to-br from-[#38206b] via-[#2a1f3d] to-[#1c1231] px-6 py-7 shadow-[0_20px_50px_#150b2e80] border border-purple-500/20"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="text-center text-sm font-semibold text-gray-300">Balance</div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <img src={phmnCoinImg} alt="PHMN Coin" className="h-8 w-8 drop-shadow-lg" />
                <span className="text-3xl font-extrabold tracking-wide text-white">{formattedBalance}</span>
              </div>
              {connected && (
                <div className="mt-2 text-center text-[11px] text-green-300">
                  {friendlyAddress ? `${friendlyAddress.slice(0, 6)}…${friendlyAddress.slice(-4)}` : 'Wallet Connected'}
                </div>
              )}

              <motion.button
                onClick={connected ? disconnect : connect}
                disabled={walletLoading}
                className="mt-6 flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-[#0a5cff] to-[#3b7cff] px-4 py-3 shadow-[0_10px_20px_#0a5cff50] transition disabled:opacity-60"
                whileHover={{ scale: walletLoading ? 1 : 1.02, y: walletLoading ? 0 : -1 }}
                whileTap={{ scale: walletLoading ? 1 : 0.97 }}
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                    <img src={walletIconImg} alt="Wallet icon" className="h-5 w-5" />
                  </span>
                  {walletLoading
                    ? 'Connecting...'
                    : connected
                    ? 'Wallet Connected'
                    : 'Connect Wallet'}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100/40 bg-black/80">
                  <img src={arrowImg} alt="Arrow" className="h-3.5 w-3.5" />
                </span>
              </motion.button>

              {!connected && !walletLoading && (
                <div className="mt-3 text-center text-[11px] text-gray-300/80">
                  connect your TON wallet to manage PHMN.
                </div>
              )}

              {connected && (
                <div className="mt-2 text-center text-[11px] text-gray-300/80">
                  Tap the button to disconnect your wallet.
                </div>
              )}

              {walletError && (
                <motion.div
                  className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-center text-xs text-red-300"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {walletError}
                </motion.div>
              )}
            </motion.div>

            {/* Invite your friends Card */}
            <motion.div
              className="w-full rounded-3xl bg-gradient-to-br from-[#38206b] via-[#2a1f3d] to-[#1c1231] px-6 py-7 shadow-[0_20px_50px_#150b2e80] border border-purple-500/20"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="text-sm font-semibold text-gray-300 mb-4">Invite your friends</div>
              
              <motion.div
                className="rounded-2xl bg-gradient-to-br from-[#6b21a8] via-[#7c3aed] to-[#9333ea] p-4 shadow-[0_10px_30px_#6b21a850] border border-purple-400/30"
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-start gap-3 mb-4">
                  {/* Profile picture */}
                  <div className="flex-shrink-0">
                    {telegramUser?.photo_url ? (
                      <img
                        src={telegramUser.photo_url}
                        alt="Profile"
                        className="h-10 w-10 rounded-full border-2 border-white/20"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {telegramUser?.first_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-white font-semibold text-xs truncate">
                        @{telegramUser?.username || telegramUser?.first_name || 'User'}
                      </div>
                      {/* Referral count badge - white background with purple border */}
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-purple-400/50">
                        <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-purple-700 text-[10px] font-semibold">
                          {referralStats?.totalReferrals?.toString().padStart(2, '0') || '00'}
                        </span>
                      </div>
                    </div>
                    <p className="text-white text-[10px] leading-relaxed">
                      Invite to your friends and get a extra coins
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={handleInviteFriends}
                    disabled={referralLoading || !referralCode}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white text-purple-700 px-3 py-2.5 font-semibold text-xs shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: referralLoading || !referralCode ? 1 : 1.02 }}
                    whileTap={{ scale: referralLoading || !referralCode ? 1 : 0.98 }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Invite friends
                  </motion.button>
                  
                  <motion.button
                    onClick={handleCopyLink}
                    disabled={referralLoading || !referralCode}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-purple-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: referralLoading || !referralCode ? 1 : 1.05 }}
                    whileTap={{ scale: referralLoading || !referralCode ? 1 : 0.95 }}
                  >
                    {copySuccess ? (
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* List of your friends section - full width below cards */}
          <motion.div
            className="mt-6 w-full"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-300">List of your friends</div>
              <motion.button
                onClick={handleRefreshFriends}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </motion.button>
            </div>

            <div className="rounded-2xl bg-[#1a0f2e] border border-purple-500/20 p-5 min-h-[120px]">
            {referralStats?.referrals && referralStats.referrals.length > 0 ? (
              <div className="space-y-3">
                {referralStats.referrals.map((friend, index) => (
                  <motion.div
                    key={friend.telegramId || index}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                      {friend.name?.[0]?.toUpperCase() || 'F'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">
                        {friend.name || 'Friend'}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[80px]">
                <div className="text-center">
                  <div className="text-gray-400 text-sm">
                    You haven't invited anyone yet!
                  </div>
                </div>
              </div>
            )}
            </div>
          </motion.div>
        </div>
      </div>
      
    </motion.div>
  );
}

export default Wallet;
