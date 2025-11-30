import React, { useMemo, useState, useEffect, useContext } from 'react';
import { useTonConnect } from '../hooks/useTonConnect';
import { SocketContext } from '../App';

const TonConnectTest = ({ telegramUser }) => {
  const { wallet, connected, loading, error, connect, disconnect } = useTonConnect();
  const [user, setUser] = useState(null);
  const socket = useContext(SocketContext);

  // Fetch user data on component mount
  useEffect(() => {
    if (!socket || !telegramUser) return;
    
    console.log('🔍 TonConnectTest: Fetching user data for:', telegramUser.id);
    socket.emit('user:getUserData', { telegramId: telegramUser.id }, (response) => {
      if (response.success) {
        console.log('✅ TonConnectTest: User data received:', response.user);
        setUser(response.user);
      } else {
        console.error('❌ TonConnectTest: Failed to fetch user data:', response.error);
      }
    });
  }, [socket, telegramUser]);

  // Add friendly address calculation - use stored wallet address
  const friendlyAddress = useMemo(() => {
    // Simply use the stored wallet address from database
    if (user?.walletAddress) {
      console.log('🔍 TonConnectTest: Using stored wallet address:', user.walletAddress);
      return user.walletAddress;
    }
    
    return '';
  }, [user?.walletAddress]);

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">TON Connect Test</h2>
      
      <div className="space-y-4">
        <div className="p-3 bg-gray-100 rounded">
          <p className="text-sm text-gray-600">Status: {connected ? 'Connected' : 'Disconnected'}</p>
          {wallet && (
            <p className="text-sm text-gray-600 mt-1">
              Address: {friendlyAddress ? `${friendlyAddress.slice(0, 6)}..${friendlyAddress.slice(-4)}` : ''}
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-300 rounded">
            <p className="text-sm text-red-600">Error: {error}</p>
          </div>
        )}

        <div className="flex space-x-3">
          {!connected ? (
            <button
              onClick={connect}
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded font-medium disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <button
              onClick={disconnect}
              disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded font-medium disabled:opacity-50"
            >
              {loading ? 'Disconnecting...' : 'Disconnect Wallet'}
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 text-center">
          This is a test component to verify TON Connect integration
        </div>
      </div>
    </div>
  );
};

export default TonConnectTest;
