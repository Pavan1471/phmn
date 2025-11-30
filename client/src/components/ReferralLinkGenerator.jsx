import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { SocketContext } from '../App';

const ReferralLinkGenerator = ({ telegramUser, botUsername, onClose }) => {
  const socket = useContext(SocketContext);
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [shareOptions, setShareOptions] = useState([]);

  useEffect(() => {
    if (!socket || !telegramUser) return;
    loadReferralCode();
    detectShareOptions();
  }, [socket, telegramUser]);

  const loadReferralCode = () => {
    if (!socket || !telegramUser) return;
    
    socket.emit('referral:getCode', { telegramId: telegramUser.id }, (res) => {
      if (res?.success) {
        setReferralCode(res.referralCode);
      }
      setLoading(false);
    });
  };

  const detectShareOptions = () => {
    const options = [];
    
    // Check if Web Share API is available
    if (navigator.share) {
      options.push('native');
    }
    
    // Check if Telegram WebApp is available
    if (window.Telegram?.WebApp) {
      options.push('telegram');
    }
    
    // Always available options
    options.push('copy', 'qr');
    
    setShareOptions(options);
  };

  const generateReferralLink = () => {
    return `https://t.me/${botUsername}?start=${referralCode}`;
  };

  const copyToClipboard = async () => {
    try {
      const link = generateReferralLink();
      await navigator.clipboard.writeText(link);
      showSuccessMessage('Link copied to clipboard!');
    } catch (error) {
      showErrorMessage('Failed to copy link');
    }
  };

  const shareNative = async () => {
    try {
      const link = generateReferralLink();
      const text = `🎮 Join me in this awesome Ludo game! Use my referral link: ${link}`;
      
      await navigator.share({
        title: 'Join my Ludo game!',
        text: text,
        url: link
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        showErrorMessage('Failed to share');
      }
    }
  };

  const shareTelegram = () => {
    try {
      const link = generateReferralLink();
      const text = `🎮 Join me in this awesome Ludo game! Use my referral link: ${link}`;
      
      // Open Telegram share dialog
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
      window.open(telegramUrl, '_blank');
    } catch (error) {
      showErrorMessage('Failed to share via Telegram');
    }
  };

  const showSuccessMessage = (message) => {
    // You can implement a toast notification here
    console.log('Success:', message);
  };

  const showErrorMessage = (message) => {
    // You can implement a toast notification here
    console.error('Error:', message);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <motion.div
      className="bg-[#181830] rounded-xl p-6 border border-gray-700/40"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Share Your Referral Link</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Referral Code Display */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="text-center mb-3">
          <div className="text-sm text-gray-400 mb-2">Your Referral Code</div>
          <code className="text-3xl font-mono text-cyan-400 font-bold tracking-wider">
            {referralCode}
          </code>
        </div>
        
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-2">Full Referral Link</div>
          <div className="bg-gray-700 rounded p-2 break-all">
            <code className="text-sm text-gray-300">{generateReferralLink()}</code>
          </div>
        </div>
      </div>

      {/* Share Options */}
      <div className="space-y-3">
        <h4 className="text-lg font-semibold text-white mb-3">Share Options</h4>
        
        {/* Copy Link */}
        <button
          onClick={copyToClipboard}
          className="w-full py-3 px-4 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
        >
          📋 Copy Link to Clipboard
        </button>

        {/* Native Share */}
        {shareOptions.includes('native') && (
          <button
            onClick={shareNative}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            📤 Share via System
          </button>
        )}

        {/* Telegram Share */}
        {shareOptions.includes('telegram') && (
          <button
            onClick={shareTelegram}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            📱 Share via Telegram
          </button>
        )}

        {/* QR Code Option */}
        <button
          onClick={() => {
            // You can implement QR code generation here
            showSuccessMessage('QR code feature coming soon!');
          }}
          className="w-full py-3 px-4 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
        >
          📱 Generate QR Code
        </button>
      </div>

      {/* Referral Benefits */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <h4 className="text-lg font-semibold text-white mb-3">🎁 Referral Benefits</h4>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>• Earn 100 Gold Pieces for each friend who joins</li>
          <li>• Your friends get a bonus when they start playing</li>
          <li>• Track your referral earnings in real-time</li>
          <li>• Build your gaming community</li>
        </ul>
      </div>
    </motion.div>
  );
};

export default ReferralLinkGenerator;
