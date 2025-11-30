/**
 * Adsgram Configuration
 * Block ID should be set via REACT_APP_ADSGRAM_BLOCK_ID environment variable
 * Or can be fetched from backend via socket
 */

// Fetch block ID from backend via socket if not set in environment
export const fetchBlockIdFromSocket = (socket) => {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      console.warn('⚠️ Socket not connected, cannot fetch block ID');
      resolve(null);
      return;
    }

    socket.emit('adsgram:getBlockId', {}, (response) => {
      if (response?.success && response.blockId) {
        console.log('✅ Block ID fetched from backend via socket');
        resolve(response.blockId);
      } else {
        console.warn('⚠️ Failed to fetch block ID from backend:', response?.error || 'No block ID in response');
        resolve(null);
      }
    });

    // Timeout after 3 seconds
    setTimeout(() => {
      resolve(null);
    }, 3000);
  });
};

export const ADSGRAM_BLOCK_ID = process.env.REACT_APP_ADSGRAM_BLOCK_ID || null;
export const ADSGRAM_DEBUG = process.env.REACT_APP_ADSGRAM_DEBUG === 'true' || false;

