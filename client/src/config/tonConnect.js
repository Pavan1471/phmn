// TON Connect configuration using @tonconnect/ui-react approach
// This follows the working demo implementation

// Get the base URL - use current origin in browser, or env variable
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.REACT_APP_GAME_URL || process.env.GAME_URL || 'https://64.hexterminator.xyz';
};

const baseUrl = getBaseUrl();

// TON Connect manifest for your Mini App
export const manifest = {
  url: baseUrl,
  name: 'PHMN Mining Game',
  // Use a data URL or a simple icon that exists, or point to a valid image
  // For now, using a simple approach - you can add logo192.png to public folder later
  iconUrl: `${baseUrl}/favicon.ico`, // Fallback to favicon if logo doesn't exist
  // Optional fields - can be omitted if files don't exist
  // termsOfUseUrl: `${baseUrl}/terms`,
  // privacyPolicyUrl: `${baseUrl}/privacy`,
  features: ['ton_addr', 'ton_proof'],
  items: ['ton_addr', 'ton_proof']
};

// wallet address for receiving payments
// React apps require REACT_APP_ prefix for environment variables
export const SERVER_WALLET_ADDRESS = process.env.REACT_APP_SERVER_WALLET_ADDRESS || process.env.SERVER_WALLET_ADDRESS;
