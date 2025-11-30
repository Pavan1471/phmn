import React, { useState, useEffect, useCallback } from "react";
import Play from "./components/Play";
import MiningPage from "./components/MiningPage";
import Leaderboard from "./components/Leaderboard.js";
import Wallet from "./components/Wallet";
import Tasks from "./components/Tasks";
import Upgrade from "./components/upgrade";
import BottomNav from "./components/BottomNav";
import TopNav from "./components/TopNav";
import TonConnectTest from "./components/TonConnectTest";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from "framer-motion";
import { io } from 'socket.io-client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import onboardingImage from './images/Onboading page-1.png';
// Account storage functions using localStorage as fallback
const initAccountStorage = (userId) => {
  // Initialize storage for the user - no special initialization needed for localStorage
  console.log('📦 Initializing account storage for user:', userId);
};

const getAccountData = (key) => {
  return localStorage.getItem(key);
};

const setAccountData = (key, value) => {
  if (typeof value === 'object') {
    localStorage.setItem(key, JSON.stringify(value));
  } else {
    localStorage.setItem(key, value);
  }
};

// Create socket context
export const SocketContext = React.createContext();

function AppContent() {
  const [section, setSection] = useState("play");
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [invitationReceived, setInvitationReceived] = useState(null);
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Get the top-level route for keying the animation
  const topLevel = location.pathname.split("/")[1] || "play";

  // Check if user is in lobby or room (game interface where BottomNav should be hidden)
  const isInLobbyOrRoom = location.pathname.includes('/play/classic') || 
                         location.pathname.includes('/play/Random');

  // Check if we have valid session data that should prevent login routing
  const hasValidSession = () => {
    const savedRoomId = getAccountData('roomId');
    const savedTelegramId = getAccountData('telegramId');
    const pendingRoomCreation = getAccountData('pendingRoomCreation');
    const pendingInvitation = getAccountData('pendingInvitation');
    
    return savedRoomId && savedTelegramId && !pendingRoomCreation && !pendingInvitation;
  };

  // Debug logging for invitation state
  console.log('🔍 App render - invitation state:', {
    invitationReceived: invitationReceived,
    isInLobbyOrRoom: isInLobbyOrRoom,
    shouldShowDialog: invitationReceived && !isInLobbyOrRoom,
    currentPath: location.pathname,
    isInitializing: isInitializing,
    user: user ? 'loaded' : 'not loaded',
    socket: socket ? 'connected' : 'not connected',
    hasValidSession: hasValidSession()
  });

  // Warn if we might be incorrectly going to login
  if (hasValidSession() && location.pathname === '/play' && !isInitializing) {
    console.warn('⚠️ WARNING: App has valid session data but is on main play page - this might cause login routing issues');
  }

  // Add notification helper
  const addNotification = useCallback((notification) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { ...notification, id }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, notification.duration || 5000);
  }, []);



  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_GAME_URL, {
      transports: ["polling"],
      reconnection: true,
      timeout: 2000
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to server');
      
      // Process any pending referral code when socket connects
      const pendingReferralCode = localStorage.getItem('pendingReferralCode');
      if (pendingReferralCode && user) {
        console.log('🎯 Processing pending referral code:', pendingReferralCode);
        
        newSocket.emit('referral:useCode', { 
          telegramId: user.id, 
          referralCode: pendingReferralCode 
        }, (res) => {
          if (res?.success) {
            console.log('✅ Pending referral code applied successfully:', res.referrerName);
            addNotification({
              type: 'success',
              message: `🎉 Welcome! You were referred by ${res.referrerName}`,
              duration: 5000
            });
          } else {
            console.log('⚠️ Pending referral code processing failed:', res?.error);
          }
          // Clean up pending referral code
          localStorage.removeItem('pendingReferralCode');
        });
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from server:', reason);
    });

    newSocket.on('connect_error', (error) => {
      console.error('🔌 Connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('connect_error');
      newSocket.close();
    };
  }, [user, addNotification]);

  // Initialize Telegram WebApp
  useEffect(() => {
    const initializeTelegram = () => {
      console.log('🔍 Checking for Telegram WebApp...');
      
      const tg = window.Telegram?.WebApp;
      if (tg) {
        try {
          console.log('✅ Telegram WebApp found, calling ready()...');
          tg.ready();
          const telegramUser = tg.initDataUnsafe?.user;
          
          if (telegramUser) {
            console.log('👤 Telegram user loaded:', telegramUser);
            setUser(telegramUser);
            setIsInitializing(false);
            
            // Initialize account-specific storage for this telegramId
            initAccountStorage(telegramUser.id);
            
            // Save user data to socket if available
            if (socket) {
              socket.emit('user:save', telegramUser);
            }

            // Process referral code from URL if present
            processReferralCodeFromURL(telegramUser);
          } else {
            console.log('⚠️ Telegram WebApp ready but no user data');
            setIsInitializing(false);
          }
        } catch (error) {
          console.error('❌ Error initializing Telegram WebApp:', error);
          setIsInitializing(false);
        }
      } else {
        // Check if we're in a browser environment (not Telegram)
        if (typeof window !== 'undefined' && !window.Telegram) {
          console.log('🌐 Browser environment detected - creating mock user for testing');
          const mockUser = {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            photo_url: null
          };
          setUser(mockUser);
          initAccountStorage(mockUser.id);
          setIsInitializing(false);
          
          // Process referral code from URL for browser testing
          processReferralCodeFromURL(mockUser);
          return;
        }
        
        console.log('⏳ Telegram WebApp not ready yet, retrying...');
        // Retry after a longer delay to prevent rapid retries
        setTimeout(initializeTelegram, 1000);
      }
    };

    // Process referral code from URL parameters or stored codes
    const processReferralCodeFromURL = (user) => {
      try {
        // Get referral code from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const startParam = urlParams.get('start');
        
        if (startParam && startParam.trim()) {
          console.log('🎯 Referral code detected in URL:', startParam);
          
          // Only process if socket is available
          if (socket && socket.connected) {
            // Apply the referral code
            socket.emit('referral:useCode', { 
              telegramId: user.id, 
              referralCode: startParam.trim() 
            }, (res) => {
              if (res?.success) {
                console.log('✅ Referral code applied successfully:', res.referrerName);
                // Show success notification
                addNotification({
                  type: 'success',
                  message: `🎉 Welcome! You were referred by ${res.referrerName}`,
                  duration: 5000
                });
                
                // Clean up URL by removing the start parameter
                const newUrl = new URL(window.location);
                newUrl.searchParams.delete('start');
                window.history.replaceState({}, '', newUrl.toString());
              } else {
                console.log('⚠️ Referral code processing failed:', res?.error);
                // Don't show error notification for referral code issues to avoid spam
              }
            });
          } else {
            console.log('⚠️ Socket not ready, will process referral code when socket connects');
            // Store referral code to process later when socket connects
            localStorage.setItem('pendingReferralCode', startParam.trim());
          }
        } else {
          // No URL parameter, check for stored referral code from bot
          console.log('🔍 No URL referral code, checking for stored referral code...');
          
          if (socket && socket.connected) {
            socket.emit('referral:getStoredCode', { 
              telegramId: user.id 
            }, (res) => {
              if (res?.success && res.referralCode) {
                console.log('🎯 Stored referral code found:', res.referralCode);
                
                // Apply the stored referral code
                socket.emit('referral:useCode', { 
                  telegramId: user.id, 
                  referralCode: res.referralCode 
                }, (useRes) => {
                  if (useRes?.success) {
                    console.log('✅ Stored referral code applied successfully:', useRes.referrerName);
                    addNotification({
                      type: 'success',
                      message: `🎉 Welcome! You were referred by ${useRes.referrerName}`,
                      duration: 5000
                    });
                  } else {
                    console.log('⚠️ Stored referral code processing failed:', useRes?.error);
                  }
                });
              } else {
                console.log('ℹ️ No stored referral code found or error:', res?.error);
              }
            });
          } else {
            console.log('⚠️ Socket not ready, will check for stored referral code when socket connects');
            // Mark that we need to check for stored referral code later
            localStorage.setItem('checkStoredReferralCode', 'true');
          }
        }
      } catch (error) {
        console.error('❌ Error processing referral code from URL:', error);
      }
    };

    // Start initialization
    initializeTelegram();
    
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isInitializing) {
        console.warn('⚠️ Telegram WebApp initialization timed out');
        setIsInitializing(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [socket, isInitializing, addNotification]);

  // Ensure user data is saved once both socket and Telegram user are ready
  useEffect(() => {
    if (socket && user) {
      try {
        console.log('💾 Ensuring user is saved after socket/user ready');
        socket.emit('user:save', user);
        
        // Process any pending referral code when both socket and user are ready
        const pendingReferralCode = localStorage.getItem('pendingReferralCode');
        if (pendingReferralCode) {
          console.log('🎯 Processing pending referral code after user save:', pendingReferralCode);
          
          socket.emit('referral:useCode', { 
            telegramId: user.id, 
            referralCode: pendingReferralCode 
          }, (res) => {
            if (res?.success) {
              console.log('✅ Pending referral code applied successfully:', res.referrerName);
              addNotification({
                type: 'success',
                message: `🎉 Welcome! You were referred by ${res.referrerName}`,
                duration: 5000
              });
            } else {
              console.log('⚠️ Pending referral code processing failed:', res?.error);
            }
            // Clean up pending referral code
            localStorage.removeItem('pendingReferralCode');
          });
        }

        // Check for stored referral code if needed
        const checkStoredReferralCode = localStorage.getItem('checkStoredReferralCode');
        if (checkStoredReferralCode === 'true') {
          console.log('🔍 Checking for stored referral code after user save...');
          
          socket.emit('referral:getStoredCode', { 
            telegramId: user.id 
          }, (res) => {
            if (res?.success && res.referralCode) {
              console.log('🎯 Stored referral code found:', res.referralCode);
              
              // Apply the stored referral code
              socket.emit('referral:useCode', { 
                telegramId: user.id, 
                referralCode: res.referralCode 
              }, (useRes) => {
                if (useRes?.success) {
                  console.log('✅ Stored referral code applied successfully:', useRes.referrerName);
                  addNotification({
                    type: 'success',
                    message: `🎉 Welcome! You were referred by ${useRes.referrerName}`,
                    duration: 5000
                  });
                } else {
                  console.log('⚠️ Stored referral code processing failed:', useRes?.error);
                }
              });
            } else {
              console.log('ℹ️ No stored referral code found or error:', res?.error);
            }
            // Clean up the flag
            localStorage.removeItem('checkStoredReferralCode');
          });
        }
      } catch (e) {
        console.error('❌ Failed to emit user:save:', e);
      }
    }
  }, [socket, user, addNotification]);

  // Persist basic user identity locally for name fallback
  useEffect(() => {
    if (user) {
      try {
        setAccountData('telegramId', user.id?.toString());
        const displayName = user.first_name || user.username || user.last_name || 'Player';
        setAccountData('displayName', displayName);
      } catch (e) {
        // ignore storage failures
      }
    }
  }, [user]);

  // Handle invitation events
  useEffect(() => {
    if (socket && user) {
      socket.on('lobby:invitationReceived', (data) => {
        console.log('📨 Received invitation:', data);
        if (data.success && data.invitation) {
          setInvitationReceived(data.invitation);
          setShowInvitationDialog(true);
        }
      });

      // Handle auto-added friends (from referrals)
      socket.on('friends:autoAdded', (data) => {
        console.log('👥 Auto-added friend:', data);
        if (data.success) {
          addNotification({
            type: 'success',
            message: data.message,
            duration: 5000
          });
        }
      });

      return () => {
        socket.off('lobby:invitationReceived');
        socket.off('friends:autoAdded');
      };
    }
  }, [socket, user, addNotification]);

  // Handle invitation dialog actions
  const handleInvitationAccept = () => {
    if (invitationReceived && socket) {
      console.log('✅ Accepting invitation to room:', invitationReceived.roomId);
      
      // Save room info to localStorage for rejoin
      localStorage.setItem('roomId', invitationReceived.roomId);
      localStorage.setItem('telegramId', user.id.toString());
      localStorage.setItem('pendingInvitation', 'true');
      
      // Navigate to classic game
      window.location.href = '/play/classic';
    }
    setShowInvitationDialog(false);
    setInvitationReceived(null);
  };

  const handleInvitationDecline = () => {
    console.log('❌ Declining invitation');
    setShowInvitationDialog(false);
    setInvitationReceived(null);
  };

  // Add global test function for debugging
  useEffect(() => {
    if (socket && user) {
      // Add debugging for invitation events
      console.log('🔧 Setting up invitation debugging for user:', user.id);
      
      // Add manual test function
      window.testDialog = () => {
        console.log('🧪 Testing dialog manually');
        setInvitationReceived({
          from: {
            first_name: 'Test User',
            last_name: 'Test',
            profile_picture: null
          },
          roomId: '507f1f77bcf86cd799439011',
          roomName: 'Test Room'
        });
      };
      
      // Add test function to manually trigger invitation event
      window.testInvitationEvent = () => {
        console.log('🧪 Manually triggering invitation event');
        socket.emit('lobby:invitationReceived', {
          success: true,
          invitation: {
            from: {
              telegramId: '123456789',
              first_name: 'Test Friend',
              last_name: 'User',
              profile_picture: null
            },
            roomId: '507f1f77bcf86cd799439011',
            roomName: 'Test Game Room',
            timestamp: new Date()
          }
        });
      };
    }
  }, [socket, user]);

  // Preload onboarding image
  useEffect(() => {
    const img = new Image();
    img.src = onboardingImage;
    img.onload = () => {
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load onboarding image');
      setImageLoaded(true); // Still allow app to continue even if image fails
    };
  }, []);

  // Show onboarding image for 3 seconds after initialization and image is loaded
  useEffect(() => {
    if (!isInitializing && imageLoaded) {
      setShowOnboarding(true);
      const timer = setTimeout(() => {
        setShowOnboarding(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, imageLoaded]);

  // Sync section state with URL
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/play')) {
      setSection("play");
    } else if (path.startsWith('/mining')) {
      setSection("mining");
    } else if (path.startsWith('/leaderboard')) {
      setSection("leaderboard");
    } else if (path.startsWith('/wallet')) {
      setSection("wallet");
    }
  }, [location.pathname]);

  return (
    <SocketContext.Provider value={socket}>
      <div>
        {/* Animated backgrounds always present */}
        <div className="grok-bg" />
        
        {/* Loading screen while initializing */}
        {isInitializing && (
          <div className="">

          </div>
        )}

        {/* Onboarding image - shows for 3 seconds after initialization */}
        <AnimatePresence>
          {showOnboarding && (
            <motion.div 
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <img 
                src={onboardingImage} 
                alt="Onboarding" 
                className="w-full h-full object-cover"
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="relative pt-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={topLevel}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -32 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full"
            >
              <Routes location={location}>
                <Route path="/" element={
                  (() => {
                    try {
                      const savedRoomId = localStorage.getItem('roomId');
                      const savedTelegramId = localStorage.getItem('telegramId');
                      const savedGameState = localStorage.getItem('gameState');
                      const pendingRoomCreation = localStorage.getItem('pendingRoomCreation');
                      const pendingInvitation = localStorage.getItem('pendingInvitation');
                      const fromRandomMatch = localStorage.getItem('fromRandomMatch');
                      
                      // Only auto-resume if it's not a random match game
                      const canResume = savedRoomId && savedTelegramId && savedGameState === 'game' && 
                                       !pendingRoomCreation && !pendingInvitation && 
                                       !fromRandomMatch;
                      const target = canResume ? '/play/classic' : (location.search ? `/play${location.search}` : '/play');
                      return (
                        <Navigate
                          to={target}
                          replace
                        />
                      );
                    } catch (e) {
                      return (
                        <Navigate
                          to={location.search ? `/play${location.search}` : "/play"}
                          replace
                        />
                      );
                    }
                  })()
                } />
                <Route path="/play/*" element={<Play />} />
                        <Route path="/mining" element={<MiningPage telegramUser={user} />} />
        <Route path="/tasks" element={<Tasks telegramUser={user} />} />
        <Route path="/upgrade" element={<Upgrade telegramUser={user} />} />
        <Route path="/leaderboard" element={<Leaderboard telegramUser={user} />} />
        <Route path="/wallet" element={<Wallet telegramUser={user} />} />
                <Route path="/test" element={<TonConnectTest />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Show TopNav only when not in game interface */}
        {!isInLobbyOrRoom && (
          <TopNav 
            user={user}
            onTopPlayerClick={() => navigate('/leaderboard')}
            onOptionsClick={() => {
              // Add options handler if needed
              console.log('Options clicked');
            }}
          />
        )}
        
        {/* Show BottomNav only when not in game interface */}
        {!isInLobbyOrRoom && (
          <BottomNav active={section} onChange={setSection} />
        )}

        {/* Global Notifications */}
        {showInvitationDialog && invitationReceived && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
              <div className="text-center mb-4">
                <div className="text-2xl mb-2">🎮</div>
                <h3 className="text-lg font-semibold text-white mb-2">Game Invitation</h3>
                <p className="text-gray-300 text-sm">
                  {invitationReceived.from.first_name} {invitationReceived.from.last_name} invited you to join:
                </p>
                <p className="text-cyan-400 font-semibold mt-2">{invitationReceived.roomName}</p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleInvitationDecline}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={handleInvitationAccept}
                  className="flex-1 bg-cyan-500 text-white py-2 px-4 rounded-lg hover:bg-cyan-600 transition-colors"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        )}






        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-white max-w-sm transform transition-all duration-300 ${
                notification.type === 'success' ? 'bg-green-500' :
                notification.type === 'error' ? 'bg-red-500' :
                notification.type === 'warning' ? 'bg-yellow-500' :
                'bg-blue-500'
              }`}
            >
              {notification.message}
            </div>
          ))}
        </div>
      </div>
    </SocketContext.Provider>
  );
}

function App() {
  // Get the base URL for manifest - use current origin in browser
  const getManifestUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/tonconnect-manifest.json`;
    }
    return `${process.env.REACT_APP_GAME_URL}/tonconnect-manifest.json`;
  };

  return (
    <TonConnectUIProvider manifestUrl={getManifestUrl()}>
      <BrowserRouter>
          <AppContent />
      </BrowserRouter>
    </TonConnectUIProvider>
  );
}

export default App;
