import { useState, useCallback, useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { SERVER_WALLET_ADDRESS } from '../config/tonConnect';

export const useTonConnect = () => {
  const [tonConnectUI] = useTonConnectUI();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Add local state for wallet and connection status
  const [wallet, setWallet] = useState(null);
  const [connected, setConnected] = useState(false);

  // Listen for connection changes
  useEffect(() => {
    if (!tonConnectUI) return;

    // Set initial state
    setWallet(tonConnectUI.account);
    setConnected(tonConnectUI.connected);

    // Listen for account changes
    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      console.log('Wallet status changed:', wallet);
      setWallet(wallet);
      setConnected(!!wallet);
    });

    return unsubscribe;
  }, [tonConnectUI]);

  // Connect wallet - this opens the modal automatically
  const connect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Opening TON Connect modal...');
      await tonConnectUI.openModal();
      
    } catch (err) {
      console.error('Failed to open TON Connect modal:', err);
      setError('Failed to open wallet connection: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [tonConnectUI]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await tonConnectUI.disconnect();
      console.log('Wallet disconnected successfully');
      
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
      setError('Failed to disconnect wallet: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [tonConnectUI]);

  // Send TON payment - generic function for sending TON
  const sendPayment = useCallback(async (tonAmount, recipientAddress = SERVER_WALLET_ADDRESS) => {
    if (!connected || !wallet) {
      setError('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    if (!recipientAddress) {
      setError('Recipient address not specified');
      return { success: false, error: 'Recipient address not specified' };
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Sending payment: ${tonAmount} TON to ${recipientAddress}`);

      // Create transaction using the UI provider
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: recipientAddress,
            amount: (tonAmount * 1000000000).toString() // Convert to nanotons
          }
        ]
      };

      // Send transaction using the UI provider
      const result = await tonConnectUI.sendTransaction(transaction);
      
      console.log('Transaction result:', result);
      
      if (result) {
        return {
          success: true,
          boc: result.boc,
          transactionHash: result.boc,
          message: `Payment sent successfully! Transaction: ${result.boc}`
        };
      } else {
        setError('Transaction failed');
        return { success: false, error: 'Transaction failed' };
      }

    } catch (err) {
      console.error('Payment error:', err);
      
      // Provide user-friendly error messages
      let errorMessage = 'Payment failed';
      if (err.message && err.message.includes('User Rejects Error')) {
        errorMessage = 'Payment failed: User rejects the action in the wallet';
      } else if (err.message && err.message.includes('TON CONNECT SDK ERROR')) {
        errorMessage = 'Payment failed: Transaction error occurred';
      } else if (err.message && err.message.includes('NetworkError')) {
        errorMessage = 'Payment failed: Network connection error';
      } else if (err.message && err.message.includes('TimeoutError')) {
        errorMessage = 'Payment failed: Transaction timeout';
      } else if (err.message && err.message.includes('InsufficientFundsError')) {
        errorMessage = 'Payment failed: Insufficient funds in wallet';
      } else if (err.message) {
        errorMessage = 'Payment failed: ' + err.message;
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [connected, wallet, tonConnectUI]);

  // Get wallet balance
  const getBalance = useCallback(async () => {
    if (!connected || !wallet) {
      return 0;
    }

    // The TON Connect UI provider does not expose a direct balance query.
    // Integrate a separate API or toncenter call here when available.
    return 0;
  }, [connected, wallet]);

  // Get available wallets - not needed with UI provider
  const getAvailableWallets = useCallback(() => {
    return [];
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    wallet,
    connected,
    loading,
    error,
    walletList: [], // Not needed with UI provider
    connect,
    disconnect,
    sendPayment,
    getBalance,
    getAvailableWallets,
    clearError,
    tonConnectUI
  };
};
