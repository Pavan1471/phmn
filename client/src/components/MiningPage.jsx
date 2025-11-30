import React, { useState, useContext, useEffect, useMemo } from 'react';
import { SocketContext } from '../App';
import { useTonConnect } from '../hooks/useTonConnect';
import { SERVER_WALLET_ADDRESS } from '../config/tonConnect';
import { toUserFriendlyAddress } from '@tonconnect/sdk';
import { motion, AnimatePresence } from 'framer-motion';
import tonIcon from '../images/ton.svg';

function MiningPage({ telegramUser }) {
  // All state declarations must come first, before any conditional logic
  const [activeTab, setActiveTab] = useState('topup');

  const socket = useContext(SocketContext);
  const { 
    wallet, 
    connected, 
    loading: walletLoading, 
    error: walletError, 
    connect, 
    disconnect, 
    tonConnectUI 
  } = useTonConnect();

  // Note: Do NOT early-return before hooks are declared. We handle the
  // unauthenticated state just before rendering below to keep hook order stable.


  // Animation variants - simplified for better performance
  const pageVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
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

  const friendlyAddress = useMemo(() => {
    try {
      return wallet?.address
        ? toUserFriendlyAddress(wallet.address, { bounceable: false })
        : '';
    } catch (e) {
      return wallet?.address || '';
    }
  }, [wallet?.address]);

  const tabs = [
    { id: 'topup', label: 'TOP-UP', icon: '💳' },
    { id: 'shop', label: 'SHOP', icon: '🛒' },
    { id: 'exchange', label: 'EXCHANGE', icon: '🔄' }
  ];

  // White Diamond state
  const [whiteDiamonds, setWhiteDiamonds] = useState(0);
  const [loadingDiamonds, setLoadingDiamonds] = useState(false);
  const [diamondError, setDiamondError] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  // Blue Diamond state
  const [blueDiamonds, setBlueDiamonds] = useState(0);
  const [loadingBlueDiamonds, setLoadingBlueDiamonds] = useState(false);
  const [blueDiamondError, setBlueDiamondError] = useState(null);
  const [purchasingBlueDiamonds, setPurchasingBlueDiamonds] = useState(false);
  const [exchangeSuccessMessage, setExchangeSuccessMessage] = useState(null);





  // White Diamond purchase options (fetched from backend)
  const [whiteDiamondOptions, setWhiteDiamondOptions] = useState([
    { id: 1, tonAmount: 2.99, diamonds: 598, bonus: 0, popular: false },
    { id: 2, tonAmount: 5.99, diamonds: 1198, bonus: 0, popular: false },
    { id: 3, tonAmount: 19.99, diamonds: 3998, bonus: 0, popular: true },
    { id: 4, tonAmount: 39.99, diamonds: 7998, bonus: 0, popular: false },
    { id: 5, tonAmount: 99.99, diamonds: 19998, bonus: 0, popular: false }
  ]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Blue Diamond to TON exchange options
  const [blueDiamondExchangeOptions] = useState([
    { id: 1, blueDiamonds: 1198, tonAmount: 5.99, popular: false },
    { id: 2, blueDiamonds: 3998, tonAmount: 19.99, popular: true },
    { id: 3, blueDiamonds: 7998, tonAmount: 39.99, popular: false },
    { id: 4, blueDiamonds: 19998, tonAmount: 99.99, popular: false }
  ]);
  const [loadingBlueOptions] = useState(false);

  // Function to get plan name from level
  // Function to get icon based on active tab
  const getTabIcon = (tab) => {
    switch (tab) {
      case 'topup': return '💳';
      case 'shop': return '🛒';
      case 'exchange': return '🔄';
      default: return '⛏️';
    }
  };

  // Function to format TON prices to avoid scientific notation
  // Load White Diamond balance and options when topup tab is active
  useEffect(() => {
    if (!socket || !telegramUser) return;
    if (activeTab !== 'topup') return;
    
    // Load White Diamond balance
    setLoadingDiamonds(true);
    setDiamondError(null);
    console.log('🔄 MiningPage: Requesting White Diamond balance for user:', telegramUser.id);
    socket.emit('diamonds:getBalance', { telegramId: telegramUser.id }, (res) => {
      if (!res?.success) {
        console.log('❌ MiningPage: Failed to get White Diamond balance:', res?.error);
        setDiamondError(res?.error || 'Failed to load balance');
      } else {
        console.log('✅ MiningPage: Successfully loaded White Diamond balance:', res.balance);
        setWhiteDiamonds(res.balance || 0);
      }
      setLoadingDiamonds(false);
    });

    // Load White Diamond purchase options (optional - we have fallback)
    setLoadingOptions(true);
    socket.emit('diamonds:getOptions', {}, (res) => {
      if (res?.success && res.options?.length > 0) {
        setWhiteDiamondOptions(res.options);
      }
      setLoadingOptions(false);
      // Keep the default options if backend fails
    });
  }, [socket, telegramUser, activeTab]);

  // Load Blue Diamond balance when exchange tab is active
  useEffect(() => {
    if (!socket || !telegramUser) return;
    if (activeTab !== 'exchange') return;
    
    // Load Blue Diamond balance
    setLoadingBlueDiamonds(true);
    setBlueDiamondError(null);
    console.log('🔄 MiningPage: Requesting Blue Diamond balance for user:', telegramUser.id);
    socket.emit('blueDiamonds:getBalance', { telegramId: telegramUser.id }, (res) => {
      if (!res?.success) {
        console.log('❌ MiningPage: Failed to get Blue Diamond balance:', res?.error);
        setBlueDiamondError(res?.error || 'Failed to load Blue Diamond balance');
      } else {
        console.log('✅ MiningPage: Successfully loaded Blue Diamond balance:', res.balance);
        setBlueDiamonds(res.balance || 0);
      }
      setLoadingBlueDiamonds(false);
    });
  }, [socket, telegramUser, activeTab]);

  // Store wallet address when connected
  useEffect(() => {
    if (!socket || !telegramUser || !connected || !wallet?.address) return;

    // Convert raw address to user-friendly format before storing
    let userFriendlyAddress;
    try {
      // Try different conversion methods
      userFriendlyAddress = toUserFriendlyAddress(wallet.address, { bounceable: true });
      console.log('💙 MiningPage: First conversion attempt:', { raw: wallet.address, converted: userFriendlyAddress });
      
      // If it doesn't start with UQ, try without bounceable parameter
      if (!userFriendlyAddress.startsWith('UQ')) {
        userFriendlyAddress = toUserFriendlyAddress(wallet.address);
        console.log('💙 MiningPage: Second conversion attempt:', { raw: wallet.address, converted: userFriendlyAddress });
      }
    } catch (error) {
      console.error('💙 MiningPage: Address conversion failed:', error);
      userFriendlyAddress = wallet.address; // Fallback to raw address
    }
    
    console.log('💙 MiningPage: Storing wallet address for user:', telegramUser.id, { 
      raw: wallet.address, 
      userFriendly: userFriendlyAddress 
    });
    
    socket.emit('user:updateWalletAddress', { 
      telegramId: telegramUser.id, 
      walletAddress: userFriendlyAddress 
    }, (res) => {
      if (res?.success) {
        console.log('✅ MiningPage: Wallet address stored successfully');
      } else {
        console.log('❌ MiningPage: Failed to store wallet address:', res?.error);
      }
    });
  }, [socket, telegramUser, connected, wallet?.address]);

  // Listen for real-time White Diamond balance updates (like other components)
  useEffect(() => {
    if (!socket || !telegramUser) return;

    // Listen for White Diamond balance updates
    const handleDiamondBalanceUpdate = (data) => {
      console.log('💎 MiningPage: Received diamond balance update:', data);
      if (data.success && data.telegramId === telegramUser.id) {
        setWhiteDiamonds(data.balance || 0);
        setDiamondError(null);
      }
    };

    // Listen for White Diamond purchase confirmations
    const handleDiamondPurchaseUpdate = (data) => {
      console.log('💎 MiningPage: Received diamond purchase update:', data);
      if (data.success && data.telegramId === telegramUser.id) {
        setWhiteDiamonds(data.newBalance || 0);
        setDiamondError(null);
      }
    };

    // Listen for Blue Diamond balance updates
    const handleBlueDiamondBalanceUpdate = (data) => {
      console.log('💙 MiningPage: Received blue diamond balance update:', data);
      if (data.success && data.telegramId === telegramUser.id) {
        setBlueDiamonds(data.balance || 0);
        setBlueDiamondError(null);
      }
    };

    // Listen for Blue Diamond purchase confirmations
    const handleBlueDiamondPurchaseUpdate = (data) => {
      console.log('💙 MiningPage: Received blue diamond purchase update:', data);
      if (data.success && data.telegramId === telegramUser.id) {
        setBlueDiamonds(data.newBalance || 0);
        setDiamondError(null);
      }
    };

    // Listen for exchange completion events
    const handleExchangeCompleted = (data) => {
      console.log('💙 MiningPage: Received exchange completion:', data);
      if (data.success && data.telegramId === telegramUser.id) {
        setExchangeSuccessMessage(data.message || 'TON has been sent to your wallet!');
        // Clear success message after 4 seconds
        setTimeout(() => {
          setExchangeSuccessMessage(null);
        }, 4000);
      }
    };

    const handleExchangeFailed = (data) => {
      console.log('💙 MiningPage: Received exchange failure:', data);
      if (data.telegramId === telegramUser.id) {
        setBlueDiamondError(data.message || 'Exchange failed');
        // Refund Blue Diamonds on failure
        if (data.refundAmount) {
          setBlueDiamonds(prev => prev + data.refundAmount);
        }
      }
    };

    socket.on('diamonds:balanceUpdate', handleDiamondBalanceUpdate);
    socket.on('diamonds:purchaseUpdate', handleDiamondPurchaseUpdate);
    socket.on('blueDiamonds:balanceUpdate', handleBlueDiamondBalanceUpdate);
    socket.on('blueDiamonds:purchaseUpdate', handleBlueDiamondPurchaseUpdate);
    socket.on('exchange:completed', handleExchangeCompleted);
    socket.on('exchange:failed', handleExchangeFailed);

    return () => {
      socket.off('diamonds:balanceUpdate', handleDiamondBalanceUpdate);
      socket.off('diamonds:purchaseUpdate', handleDiamondPurchaseUpdate);
      socket.off('blueDiamonds:balanceUpdate', handleBlueDiamondBalanceUpdate);
      socket.off('blueDiamonds:purchaseUpdate', handleBlueDiamondPurchaseUpdate);
      socket.off('exchange:completed', handleExchangeCompleted);
      socket.off('exchange:failed', handleExchangeFailed);
    };
  }, [socket, telegramUser]);

  const handleBuyWhiteDiamonds = async (option) => {
    if (!socket || !telegramUser) return;
    
    setDiamondError(null);
    setPurchasing(true);
    
    // Check if wallet is connected
    if (!connected) {
      setDiamondError('Please connect your TON wallet first');
      setPurchasing(false);
      return;
    }
    
    try {
      // Send TON payment for White Diamonds using custom amount
      const result = await sendPaymentForDiamonds(option.tonAmount);
      
      if (result.success) {
        // Process White Diamond purchase on server using TON payment handler
        const purchaseData = { 
          telegramId: telegramUser.id, 
          tonAmount: option.tonAmount,
          diamonds: option.diamonds,
          transactionHash: result.boc 
        };
        console.log('💎 MiningPage: Sending purchase data to server:', purchaseData);
        socket.emit('ton:processDiamondPurchase', purchaseData, (res) => {
          if (res.success) {
            console.log('✅ MiningPage: White Diamond purchase successful');
            setWhiteDiamonds(res.newBalance);
            setDiamondError(null);
            // Real-time update will be handled by socket listener
          } else {
            console.log('❌ MiningPage: White Diamond purchase failed:', res.error);
            setDiamondError(res.error || 'Failed to purchase White Diamonds');
          }
          setPurchasing(false);
        });
      } else {
        setDiamondError(result.error || 'Payment failed');
        setPurchasing(false);
      }
    } catch (error) {
      setDiamondError('Payment error: ' + error.message);
      setPurchasing(false);
    }
  };

  // Custom payment function for White Diamonds
  const sendPaymentForDiamonds = async (tonAmount) => {
    if (!connected || !wallet) {
      console.log('❌ Wallet not connected:', { connected, wallet: !!wallet });
      return { success: false, error: 'Wallet not connected' };
    }

    if (!tonConnectUI) {
      console.log('❌ TON Connect UI not available');
      return { success: false, error: 'TON Connect UI not available' };
    }

    try {
      console.log(`💎 Sending payment for White Diamonds: ${tonAmount} TON`);
      console.log('💎 Wallet address:', wallet.address);
      
      // Use the imported SERVER_WALLET_ADDRESS constant instead of process.env
      const merchantWallet = SERVER_WALLET_ADDRESS;
      console.log('💎 Merchant wallet:', merchantWallet);
      
      if (!merchantWallet) {
        console.log('❌ Merchant wallet not configured');
        return { success: false, error: 'Merchant wallet not configured' };
      }

      const amountInNanoTON = (tonAmount * 1000000000).toString();

      // Create transaction using the UI provider
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: merchantWallet,
            amount: amountInNanoTON
          }
        ]
      };

      console.log('💎 Transaction details:', transaction);

      // Send transaction using the UI provider
      const result = await tonConnectUI.sendTransaction(transaction);
      
      console.log('💎 White Diamond transaction result:', result);
      
      if (result && result.boc) {
        return {
          success: true,
          boc: result.boc,
          message: `Payment sent successfully! Transaction: ${result.boc}`
        };
      } else {
        console.log('❌ No transaction result or BOC received');
        return { success: false, error: 'Transaction failed - no result received' };
      }

    } catch (err) {
      console.error('❌ White Diamond payment error:', err);
      console.error('❌ Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      return { 
        success: false, 
        error: err.message || 'Payment failed - check console for details' 
      };
    }
  };

  // Blue Diamond to TON exchange function
  const handleExchangeBlueDiamonds = async (option) => {
    if (!socket || !telegramUser) return;
    
    setBlueDiamondError(null);
    setPurchasingBlueDiamonds(true);
    
    // Check if user has enough Blue Diamonds
    if (blueDiamonds < option.blueDiamonds) {
      setBlueDiamondError(`Insufficient Blue Diamonds. You need ${option.blueDiamonds.toLocaleString()} but have ${blueDiamonds.toLocaleString()}`);
      setPurchasingBlueDiamonds(false);
      return;
    }
    
    try {
      // Process Blue Diamond exchange on server
      const exchangeData = { 
        telegramId: telegramUser.id, 
        blueDiamonds: option.blueDiamonds,
        tonAmount: option.tonAmount
      };
      console.log('💙 MiningPage: Sending exchange data to server:', exchangeData);
      socket.emit('blueDiamonds:exchangeToTon', exchangeData, (res) => {
        if (res.success) {
          console.log('✅ MiningPage: Blue Diamond exchange request successful');
          setBlueDiamonds(res.newBalance);
          setBlueDiamondError(null);
          setExchangeSuccessMessage(res.message || 'Be patient, TON will sent to your wallet in a few moment');
          // Clear success message after 4 seconds
          setTimeout(() => {
            setExchangeSuccessMessage(null);
          }, 4000);
          // Real-time update will be handled by socket listener
        } else {
          console.log('❌ MiningPage: Blue Diamond exchange failed:', res.error);
          setBlueDiamondError(res.error || 'Failed to exchange Blue Diamonds');
        }
        setPurchasingBlueDiamonds(false);
      });
    } catch (error) {
      setBlueDiamondError('Exchange error: ' + error.message);
      setPurchasingBlueDiamonds(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'shop':
        return (
          <motion.div 
            className="p-4"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="max-w-md mx-auto">
              <motion.div 
                className="text-center"
                variants={headerVariants}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div 
                  className="text-6xl mb-4"
                  animate={{ 
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                >
                  🛒
                </motion.div>
                <motion.h1 
                  className="text-2xl font-bold text-white mb-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  Shop Coming Soon
                </motion.h1>
                <motion.p 
                  className="text-gray-300 text-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  We're working on something amazing! The mining shop will be available soon with exciting boost plans and rewards.
                </motion.p>
                <motion.div 
                  className="mt-4 text-xs text-gray-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  Stay tuned for updates
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        );
      
      case 'topup':
        return (
          <motion.div 
            className="p-4"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="max-w-md mx-auto">
              {/* White Diamond Balance */}
              <motion.div 
                className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-md rounded-lg p-4 shadow-lg border border-blue-500/30 mb-6"
                variants={cardVariants}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">White Diamonds</div>
                      <div className="text-lg font-bold text-gray-300">
                        {loadingDiamonds ? '...' : whiteDiamonds.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Entry Currency
                  </div>
                </div>
              </motion.div>

              {/* TON Wallet Connection */}
              <motion.div 
                className="bg-[#181830]/60 rounded-lg p-3 mb-4 border border-gray-700/40"
                variants={cardVariants}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                {!connected ? (
                  <div className="text-center">
                    <div className="text-xs text-gray-300 mb-2">Connect TON Wallet to Purchase</div>
                    <motion.button
                      onClick={connect}
                      disabled={walletLoading}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded font-semibold transition disabled:opacity-50"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                    >
                      {walletLoading ? 'Connecting...' : 'Connect Wallet'}
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-green-400">✓ TON Wallet Connected</div>
                      <div className="text-xs text-gray-400">
                        {friendlyAddress ? `${friendlyAddress.slice(0, 6)}..${friendlyAddress.slice(-4)}` : ''}
                      </div>
                    </div>
                    <motion.button
                      onClick={disconnect}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ duration: 0.1 }}
                    >
                      Disconnect
                    </motion.button>
                  </div>
                )}
                {walletError && (
                  <motion.div 
                    className="text-xs text-red-400 mt-2 text-center bg-red-900/20 px-2 py-1 rounded"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {walletError}
                  </motion.div>
                )}
              </motion.div>

              {/* White Diamond Purchase Options */}
              <motion.div 
                className="space-y-3"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div 
                  className="text-center mb-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <h2 className="text-lg font-bold text-white mb-1">Purchase White Diamonds</h2>
                </motion.div>

                {loadingOptions ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400">Loading purchase options...</div>
                  </div>
                ) : whiteDiamondOptions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400">No purchase options available</div>
                  </div>
                ) : (
                  whiteDiamondOptions.map((option, index) => (
                  <motion.div
                    key={option.id}
                    className={`relative bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-md rounded-lg p-4 border transition-all duration-200 ${
                      option.popular 
                        ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/20' 
                        : 'border-gray-600/50 hover:border-gray-500/70'
                    }`}
                    variants={itemVariants}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                    {option.popular && (
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                        <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold">
                          POPULAR
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-bold text-white text-sm">
                            {option.diamonds.toLocaleString()} White Diamonds
                          </div>
                        </div>
                      </div>
                      
                      <motion.button
                        onClick={() => handleBuyWhiteDiamonds(option)}
                        disabled={!connected || purchasing}
                        className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center space-x-2 w-24 h-10 ${
                          connected && !purchasing
                            ? 'bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-gray-500/25'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                        whileHover={connected && !purchasing ? { scale: 1.05 } : {}}
                        whileTap={connected && !purchasing ? { scale: 0.95 } : {}}
                        transition={{ duration: 0.1 }}
                      >
                        {purchasing ? (
                          'Processing...'
                        ) : (
                          <>
                            <img src={tonIcon} alt="TON" className="w-4 h-4" />
                            <span>{option.tonAmount}</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                  ))
                )}
              </motion.div>

              {/* Error Display */}
              {diamondError && (
                <motion.div 
                  className="mt-4 text-center"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded">
                    {diamondError}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        );
      
      case 'exchange':
        return (
          <motion.div 
            className="p-4"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="max-w-md mx-auto">
              {/* Blue Diamond Balance */}
              <motion.div 
                className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-md rounded-lg p-4 shadow-lg border border-blue-500/30 mb-6"
                variants={cardVariants}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Blue Diamonds</div>
                      <div className="text-lg font-bold text-gray-300">
                        {loadingBlueDiamonds ? '...' : blueDiamonds.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Reward Currency
                  </div>
                </div>
              </motion.div>

              {/* TON Wallet Connection */}
              <motion.div 
                className="bg-[#181830]/60 rounded-lg p-3 mb-4 border border-gray-700/40"
                variants={cardVariants}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                {!connected ? (
                  <div className="text-center">
                    <div className="text-xs text-gray-300 mb-2">Connect TON Wallet to Exchange</div>
                    <motion.button
                      onClick={connect}
                      disabled={walletLoading}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded font-semibold transition disabled:opacity-50"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                    >
                      {walletLoading ? 'Connecting...' : 'Connect Wallet'}
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-green-400">✓ TON Wallet Connected</div>
                      <div className="text-xs text-gray-400">
                        {friendlyAddress ? `${friendlyAddress.slice(0, 6)}..${friendlyAddress.slice(-4)}` : ''}
                      </div>
                    </div>
                    <motion.button
                      onClick={disconnect}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ duration: 0.1 }}
                    >
                      Disconnect
                    </motion.button>
                  </div>
                )}
                {walletError && (
                  <motion.div 
                    className="text-xs text-red-400 mt-2 text-center bg-red-900/20 px-2 py-1 rounded"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {walletError}
                  </motion.div>
                )}
              </motion.div>

              {/* Blue Diamond Exchange Options */}
              <motion.div 
                className="space-y-3"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div 
                  className="text-center mb-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <h2 className="text-lg font-bold text-white mb-1">Exchange Blue Diamonds to TON</h2>
                  
                  {/* Success Message Display */}
                  {exchangeSuccessMessage && (
                    <motion.div 
                      className="mt-2"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-xs text-green-400 bg-green-900/20 px-3 py-2 rounded border border-green-500/30">
                        ✅ {exchangeSuccessMessage}
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                {loadingBlueOptions ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400">Loading exchange options...</div>
                  </div>
                ) : blueDiamondExchangeOptions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400">No exchange options available</div>
                  </div>
                ) : (
                  blueDiamondExchangeOptions.map((option, index) => (
                  <motion.div
                    key={option.id}
                    className={`relative bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-md rounded-lg p-4 border transition-all duration-200 ${
                      option.popular 
                        ? 'border-gray-500/50 shadow-lg ' 
                        : 'border-gray-600/50 hover:border-gray-500/70'
                    }`}
                    variants={itemVariants}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                   
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <img src={tonIcon} alt="TON" className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">
                            {option.tonAmount} TON
                          </div>
                        </div>
                      </div>
                      
                      <motion.button
                        onClick={() => handleExchangeBlueDiamonds(option)}
                        disabled={!connected || purchasingBlueDiamonds || blueDiamonds < option.blueDiamonds}
                        className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center space-x-2 w-24 h-10 ${
                          connected && !purchasingBlueDiamonds && blueDiamonds >= option.blueDiamonds
                            ? 'bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-gray-500/25'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                        whileHover={connected && !purchasingBlueDiamonds && blueDiamonds >= option.blueDiamonds ? { scale: 1.05 } : {}}
                        whileTap={connected && !purchasingBlueDiamonds && blueDiamonds >= option.blueDiamonds ? { scale: 0.95 } : {}}
                        transition={{ duration: 0.1 }}
                      >
                        {purchasingBlueDiamonds ? (
                          'Exchanging...'
                        ) : blueDiamonds < option.blueDiamonds ? (
                          'Insufficient'
                        ) : (
                          <>
                            <span>{option.blueDiamonds.toLocaleString()}</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                  ))
                )}
              </motion.div>

              {/* Error Display */}
              {blueDiamondError && (
                <motion.div 
                  className="mt-4 text-center"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded">
                    {blueDiamondError}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        );
      
      default:
        return (
          <motion.div 
            className="p-4"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="max-w-md mx-auto">
              <motion.div 
                className="text-center"
                variants={headerVariants}
              >
                <div className="text-6xl mb-4">🛒</div>
                <h1 className="text-2xl font-bold text-white mb-2">Shop Coming Soon</h1>
                <p className="text-gray-300 text-sm">
                  We're working on something amazing! The mining shop will be available soon with exciting boost plans and rewards.
                </p>
                <div className="mt-4 text-xs text-gray-400">
                  Stay tuned for updates
                </div>
              </motion.div>
            </div>
          </motion.div>
        );
    }
  };

  // Show authentication placeholder UI if Telegram user is not ready yet
  if (!telegramUser) {
    return (
      <div className="relative min-h-screen text-white font-sans overflow-x-hidden">
        <div className="grok-bg" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center backdrop-blur-md bg-white/5 rounded-xl shadow-lg p-8 max-w-md mx-auto">
            <div className="text-4xl mb-4 animate-spin">⛏️</div>
            <h1 className="text-xl font-bold text-cyan-400 mb-2">Initializing Mining...</h1>
            <p className="text-gray-300 text-sm">Please wait while we authenticate your account</p>
            <div className="mt-4 text-xs text-gray-400">
              If this persists, please refresh the page
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="relative min-h-screen text-white font-sans overflow-x-hidden"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="grok-bg" />
      <div className="relative z-10">
        {/* Header */}
        <motion.div 
          className="p-6 text-center backdrop-blur-md bg-white/5 rounded-xl shadow-lg max-w-xl mx-auto"
          variants={headerVariants}
        >
          <motion.h1 
            className="text-5xl font-bold text-cyan-400 mb-2"
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            key={activeTab}
          >
            {getTabIcon(activeTab)}
          </motion.h1>
        </motion.div>


        {/* Tab Navigation */}
        <motion.div 
          className="flex flex-col items-center space-y-3 p-4"
          variants={contentVariants}
        >
          {/* First row: TOP-UP and EXCHANGE */}
          <div className="flex justify-center space-x-4">
            {tabs.filter(tab => tab.id === 'topup' || tab.id === 'exchange').map((tab, index) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
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
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </motion.button>
            ))}
          </div>
          
          {/* Second row: SHOP */}
          <div className="flex justify-center">
            {tabs.filter(tab => tab.id === 'shop').map((tab, index) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-cyan-500 text-white shadow-lg'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
                variants={tabVariants}
                custom={index + 2}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <motion.div 
          className="w-full"
          variants={contentVariants}
        >
          <AnimatePresence mode="wait">
            {renderTabContent()}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default MiningPage;
