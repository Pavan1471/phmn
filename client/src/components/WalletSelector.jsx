import React, { useState, useEffect } from 'react';
import { useTonConnect } from '../hooks/useTonConnect';
import './WalletSelector.module.css';

const WalletSelector = ({ onWalletSelected, onClose }) => {
  const { walletList, connect, loading, error } = useTonConnect();
  const [selectedWallet, setSelectedWallet] = useState(null);

  const handleWalletSelect = async (wallet) => {
    setSelectedWallet(wallet);
    
    try {
      await connect(wallet.name);
      if (onWalletSelected) {
        onWalletSelected(wallet);
      }
    } catch (err) {
      console.error('Failed to connect to wallet:', err);
    }
  };

  const handleDeepLink = (wallet) => {
    // For mobile wallets, create deep link
    const deepLink = wallet.mobile?.universal || wallet.mobile?.native;
    
    if (deepLink) {
      // Try to open wallet app
      window.location.href = deepLink;
    } else {
      // Fallback to regular connection
      handleWalletSelect(wallet);
    }
  };

  const popularWallets = [
    'tonkeeper',
    'tonhub',
    'mytonwallet',
    'tonflow'
  ];

  const sortedWallets = walletList.sort((a, b) => {
    const aPopular = popularWallets.includes(a.name);
    const bPopular = popularWallets.includes(b.name);
    
    if (aPopular && !bPopular) return -1;
    if (!aPopular && bPopular) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="wallet-selector-overlay">
      <div className="wallet-selector-modal">
        <div className="wallet-selector-header">
          <h3>Connect TON Wallet</h3>
          <button onClick={onClose} className="close-button">
            ✕
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="wallet-list">
          {sortedWallets.map((wallet) => (
            <div
              key={wallet.name}
              className={`wallet-item ${selectedWallet?.name === wallet.name ? 'selected' : ''}`}
              onClick={() => handleDeepLink(wallet)}
            >
              <div className="wallet-info">
                <img 
                  src={wallet.imageUrl} 
                  alt={wallet.name}
                  className="wallet-icon"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="wallet-details">
                  <h4>{wallet.name}</h4>
                  <p>{wallet.description || 'TON Wallet'}</p>
                </div>
              </div>
              
              {wallet.mobile && (
                <div className="wallet-platforms">
                  {wallet.mobile.native && <span className="platform android">Android</span>}
                  {wallet.mobile.universal && <span className="platform ios">iOS</span>}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {loading && (
          <div className="loading-indicator">
            Connecting to wallet...
          </div>
        )}
        
        <div className="wallet-selector-footer">
          <p>Don't have a TON wallet?</p>
          <a 
            href="https://ton.org/wallets" 
            target="_blank" 
            rel="noopener noreferrer"
            className="get-wallet-link"
          >
            Get a TON Wallet
          </a>
        </div>
      </div>
    </div>
  );
};

export default WalletSelector;
