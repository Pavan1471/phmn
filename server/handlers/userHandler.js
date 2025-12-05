const User = require('../models/user');
const socketManager = require('../socket/socketManager');

// Mining levels configuration (matches client-side)
const MINING_LEVELS = {
  1: { multiplier: 1.0, coinsPerHour: 0.00463, coinsNeeded: null },
  5: { multiplier: 1.2, coinsPerHour: 0.00556, coinsNeeded: 5 },
  10: { multiplier: 1.5, coinsPerHour: 0.00694, coinsNeeded: 10 },
  15: { multiplier: 1.8, coinsPerHour: 0.00833, coinsNeeded: 15 },
  20: { multiplier: 2.2, coinsPerHour: 0.01019, coinsNeeded: 20 },
  25: { multiplier: 2.8, coinsPerHour: 0.01296, coinsNeeded: 25 },
  30: { multiplier: 3.5, coinsPerHour: 0.0162, coinsNeeded: 30 },
  50: { multiplier: 5.0, coinsPerHour: 0.02315, coinsNeeded: 50 },
};

// Helper function to get mining rate from level
const getMiningRateFromLevel = (level) => {
  const levelData = MINING_LEVELS[level];
  return levelData ? levelData.coinsPerHour : 0.00463; // Default to level 1
};

// Helper function to get effective mining rate with boost multiplier applied
const getEffectiveMiningRate = (user) => {
  const baseRate = getMiningRateFromLevel(user.miningLevel || 1);
  let effectiveRate = baseRate;
  
  // Apply boost from ads (cumulative percentage boost)
  const adsBoostMultiplier = 1 + (user.miningRateBoostFromAds || 0);
  effectiveRate = effectiveRate * adsBoostMultiplier;
  
  // Check if user has an active boost that hasn't expired
  if (user.activeBoost && user.activeBoost.multiplier && user.activeBoost.endTime) {
    const now = new Date();
    const endTime = new Date(user.activeBoost.endTime);
    
    // Boost is active if it hasn't expired
    if (now < endTime) {
      const boostMultiplier = user.activeBoost.multiplier || 1;
      effectiveRate = effectiveRate * boostMultiplier;
      console.log(`🚀 Boost active (${user.activeBoost.mode}): ${baseRate.toFixed(5)} * ${adsBoostMultiplier.toFixed(3)} (ads) * ${boostMultiplier} = ${effectiveRate.toFixed(5)} PHMN/hr`);
      return effectiveRate;
    } else {
      // Boost expired, clear it
      console.log(`⏰ Boost expired for user ${user.telegramId}, clearing active boost`);
      user.activeBoost = {
        mode: null,
        multiplier: 1,
        startTime: null,
        endTime: null,
        duration: null,
        tonAmount: 0,
        usdAmount: 0,
        transactionHash: null
      };
      // Save asynchronously to avoid blocking
      user.save().catch(err => console.error('Error clearing expired boost:', err));
    }
  }
  
  if (user.miningRateBoostFromAds && user.miningRateBoostFromAds > 0) {
    console.log(`⚡ Ads boost active: ${baseRate.toFixed(5)} * ${adsBoostMultiplier.toFixed(3)} = ${effectiveRate.toFixed(5)} PHMN/hr`);
  }
  
  return effectiveRate;
};

// Store online users in memory for real-time status
const onlineUsers = new Map(); // telegramId -> socketId

// Save or update user data from Telegram
const saveUserData = async (telegramUser) => {
  try {
    const userData = {
      telegramId: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      profile_picture: telegramUser.photo_url || null
    };

    const user = await User.findOneAndUpdate(
      { telegramId: telegramUser.id },
      userData,
      { upsert: true, new: true }
    );

    return user;
  } catch (error) {
    console.error('Error saving user data:', error);
    throw error;
  }
};

// Get user profile by telegram ID
const getUserProfile = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      throw new Error('User not found');
    }

    // Ensure user has a public ID
    if (!user.publicId) {
      user.publicId = await user.generatePublicId();
      await user.save();
      console.log(`✅ Generated public ID ${user.publicId} for user ${telegramId}`);
    }

    return user;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

// Search users by Telegram full name
const searchUsers = async (searchTerm, excludeTelegramId) => {
  try {
    const searchRegex = new RegExp(searchTerm, 'i'); // Case-insensitive search
    
    const users = await User.find({
      $and: [
        { 
          $or: [
            { first_name: searchRegex },
            { last_name: searchRegex }
          ]
        },
        { telegramId: { $ne: parseInt(excludeTelegramId) } } // Exclude the searching user
      ]
    }).limit(10); // Limit to 10 results

    return users;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

// Search user by public ID
const searchUserByPublicId = async (publicId, excludeTelegramId) => {
  try {
    const user = await User.findOne({
      publicId: publicId,
      telegramId: { $ne: parseInt(excludeTelegramId) } // Exclude the searching user
    });

    return user;
  } catch (error) {
    console.error('Error searching user by public ID:', error);
    throw error;
  }
};

// Generate public ID for existing users (migration function)
const generatePublicIdForUser = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.publicId) {
      user.publicId = await user.generatePublicId();
      await user.save();
    }

    return user.publicId;
  } catch (error) {
    console.error('Error generating public ID for user:', error);
    throw error;
  }
};

// Add friend request
const sendFriendRequest = async (fromTelegramId, toTelegramId) => {
  try {
    // Check if both users exist
    const fromUser = await User.findOne({ telegramId: parseInt(fromTelegramId) });
    const toUser = await User.findOne({ telegramId: parseInt(toTelegramId) });

    if (!fromUser || !toUser) {
      throw new Error('User not found');
    }

    // Check if already friends
    if (fromUser.friends.includes(parseInt(toTelegramId))) {
      throw new Error('Already friends');
    }

    // Check if request already sent
    if (toUser.friend_requests.includes(parseInt(fromTelegramId))) {
      throw new Error('Friend request already sent');
    }

    // Add to friend requests
    toUser.friend_requests.push(parseInt(fromTelegramId));
    await toUser.save();

    return { success: true, message: 'Friend request sent' };
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

// Accept friend request
const acceptFriendRequest = async (userTelegramId, friendTelegramId) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(userTelegramId) });
    const friend = await User.findOne({ telegramId: parseInt(friendTelegramId) });

    if (!user || !friend) {
      throw new Error('User not found');
    }

    // Remove from friend requests
    user.friend_requests = user.friend_requests.filter(id => id !== parseInt(friendTelegramId));
    
    // Add to friends list for both users
    if (!user.friends.includes(parseInt(friendTelegramId))) {
      user.friends.push(parseInt(friendTelegramId));
    }
    if (!friend.friends.includes(parseInt(userTelegramId))) {
      friend.friends.push(parseInt(userTelegramId));
    }

    await user.save();
    await friend.save();

    return { success: true, message: 'Friend request accepted' };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

// Reject friend request
const rejectFriendRequest = async (userTelegramId, friendTelegramId) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(userTelegramId) });
    
    if (!user) {
      throw new Error('User not found');
    }

    // Remove from friend requests
    user.friend_requests = user.friend_requests.filter(id => id !== parseInt(friendTelegramId));
    await user.save();

    return { success: true, message: 'Friend request rejected' };
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
};

// Remove friend
const removeFriend = async (userTelegramId, friendTelegramId) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(userTelegramId) });
    const friend = await User.findOne({ telegramId: parseInt(friendTelegramId) });

    if (!user || !friend) {
      throw new Error('User not found');
    }

    // Remove from friends list for both users
    user.friends = user.friends.filter(id => id !== parseInt(friendTelegramId));
    friend.friends = friend.friends.filter(id => id !== parseInt(userTelegramId));

    await user.save();
    await friend.save();

    return { success: true, message: 'Friend removed' };
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

// Get friends list with online status
const getFriendsList = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) return [];
    
    // Manually fetch friend data instead of using populate
    const friends = await User.find({ 
      telegramId: { $in: user.friends } 
    });
    
    // Add online status to each friend
    const friendsWithStatus = friends.map(friend => ({
      ...friend.toObject(),
      isOnline: onlineUsers.has(friend.telegramId.toString())
    }));
    
    console.log(`👥 Friends for user ${telegramId}:`, friendsWithStatus.map(f => ({
      name: f.first_name,
      telegramId: f.telegramId,
      isOnline: f.isOnline
    })));
    
    return friendsWithStatus;
  } catch (error) {
    console.error('Error getting friends list:', error);
    throw error;
  }
};

// Get friend requests
const getFriendRequests = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) return [];
    
    // Manually fetch friend request data instead of using populate
    const requests = await User.find({ 
      telegramId: { $in: user.friend_requests } 
    });
    
    // Add online status to each request
    const requestsWithStatus = requests.map(request => ({
      ...request.toObject(),
      isOnline: onlineUsers.has(request.telegramId.toString())
    }));
    
    return requestsWithStatus;
  } catch (error) {
    console.error('Error getting friend requests:', error);
    throw error;
  }
};

// Send lobby invitation
const sendLobbyInvitation = async (fromTelegramId, toTelegramId, roomId, roomName) => {
  try {
    const fromUser = await User.findOne({ telegramId: parseInt(fromTelegramId) });
    const toUser = await User.findOne({ telegramId: parseInt(toTelegramId) });

    if (!fromUser || !toUser) {
      throw new Error('User not found');
    }

    // Check if they are friends
    if (!fromUser.friends.includes(parseInt(toTelegramId))) {
      throw new Error('Can only invite friends');
    }

    // Check if invited user is online
    const isOnline = onlineUsers.has(toTelegramId.toString());
    console.log(`🔍 Checking online status for user ${toTelegramId}: ${isOnline}`);
    if (!isOnline) {
      throw new Error('Friend is not online');
    }

    return {
      success: true,
      invitation: {
        from: {
          telegramId: fromUser.telegramId,
          first_name: fromUser.first_name,
          last_name: fromUser.last_name,
          profile_picture: fromUser.profile_picture
        },
        roomId: roomId,
        roomName: roomName,
        timestamp: new Date()
      }
    };
  } catch (error) {
    console.error('Error sending lobby invitation:', error);
    throw error;
  }
};



// Socket event handlers
const registerUserHandlers = (socket) => {
  // Track user online status
  const trackUserOnline = (telegramId) => {
    if (telegramId) {
      onlineUsers.set(telegramId.toString(), socket.id);
      console.log(`👤 User ${telegramId} is now ONLINE (socket: ${socket.id})`);
      console.log(`📊 Current online users: ${onlineUsers.size}`);
      
      // Notify friends that user is online
      notifyFriendsOnlineStatus(telegramId, true);
    }
  };

  const trackUserOffline = (telegramId) => {
    if (telegramId) {
      onlineUsers.delete(telegramId.toString());
      console.log(`👤 User ${telegramId} is now OFFLINE`);
      console.log(`📊 Current online users: ${onlineUsers.size}`);
      
      // Notify friends that user is offline
      notifyFriendsOnlineStatus(telegramId, false);
    }
  };

  const notifyFriendsOnlineStatus = async (telegramId, isOnline) => {
    try {
      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user || !user.friends.length) return;

      const userData = {
        telegramId: user.telegramId,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture: user.profile_picture,
        isOnline: isOnline
      };

      console.log(`📢 Notifying ${user.friends.length} friends about ${user.first_name}'s status change to ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      // Notify all friends about online status change
      user.friends.forEach(friendId => {
        const friendRoom = `user_${friendId}`;
        console.log(`📤 Sending status update to friend ${friendId} in room ${friendRoom}`);
        socketManager.getIO().to(friendRoom).emit('friend:statusChanged', {
          success: true,
          friend: userData
        });
      });
    } catch (error) {
      console.error('Error notifying friends about status change:', error);
    }
  };

  // User connected event
  socket.on('user:connected', (telegramId) => {
    console.log(`🔌 User connected event received for: ${telegramId}`);
    trackUserOnline(telegramId);
  });

  // User disconnected event
  socket.on('user:disconnected', (telegramId) => {
    console.log(`🔌 User disconnected event received for: ${telegramId}`);
    trackUserOffline(telegramId);
  });

  // Save user data when they connect
  socket.on('user:save', async (telegramUser) => {
    try {
      console.log(`💾 Processing user:save for user: ${telegramUser.id}`);
      const user = await saveUserData(telegramUser);
      trackUserOnline(telegramUser.id);
      
      // Update session with telegramId for room joining
      socket.request.session.telegramId = telegramUser.id;
      socket.request.session.save();
      
      // Join user-specific room for invitations
      const userRoom = `user_${telegramUser.id}`;
      socket.join(userRoom);
      console.log(`👤 User ${telegramUser.id} joined user room: ${userRoom} after save`);
      
      // Debug: Verify room membership
      const io = socketManager.getIO();
      const room = io.sockets.adapter.rooms.get(userRoom);
      console.log(`🔍 Room ${userRoom} exists after join:`, !!room);
      console.log(`🔍 Room ${userRoom} members after join:`, room ? room.size : 0);
      
      socket.emit('user:saved', { success: true, user });
    } catch (error) {
      socket.emit('user:saved', { success: false, error: error.message });
    }
  });

  // Update user wallet address
  socket.on('user:updateWalletAddress', async (data, callback) => {
    try {
      const { telegramId, walletAddress } = data;
      
      if (!telegramId || !walletAddress) {
        console.log('❌ UserHandler: Missing telegramId or walletAddress');
        return callback && callback({
          success: false,
          error: 'Missing telegramId or walletAddress'
        });
      }

      console.log(`💙 UserHandler: Updating wallet address for user ${telegramId}:`, walletAddress);

      const user = await User.findOneAndUpdate(
        { telegramId: parseInt(telegramId) },
        { walletAddress: walletAddress },
        { new: true }
      );

      if (!user) {
        console.log(`❌ UserHandler: User ${telegramId} not found`);
        return callback && callback({
          success: false,
          error: 'User not found'
        });
      }

      console.log(`✅ UserHandler: Successfully updated wallet address for user ${telegramId}`);
      
      callback && callback({
        success: true,
        walletAddress: walletAddress,
        message: 'Wallet address updated successfully'
      });

    } catch (error) {
      console.error('❌ UserHandler: Error updating wallet address:', error);
      callback && callback({
        success: false,
        error: error.message || 'Failed to update wallet address'
      });
    }
  });

  // Get user profile
  socket.on('user:getProfile', async (telegramId) => {
    try {
      const user = await getUserProfile(telegramId);
      socket.emit('user:profile', { success: true, user });
    } catch (error) {
      socket.emit('user:profile', { success: false, error: error.message });
    }
  });

  // Get user data (including wallet address)
  socket.on('user:getUserData', async (data, callback) => {
    try {
      const { telegramId } = data;
      
      if (!telegramId) {
        return callback && callback({
          success: false,
          error: 'Telegram ID is required'
        });
      }

      console.log(`🔍 UserHandler: Getting user data for: ${telegramId}`);
      
      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      
      if (!user) {
        return callback && callback({
          success: false,
          error: 'User not found'
        });
      }

      console.log(`✅ UserHandler: User data found:`, {
        telegramId: user.telegramId,
        walletAddress: user.walletAddress,
        blueDiamonds: user.blueDiamonds
      });

      callback && callback({
        success: true,
        user: {
          telegramId: user.telegramId,
          walletAddress: user.walletAddress,
          blueDiamonds: user.blueDiamonds,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username
        }
      });

    } catch (error) {
      console.error('❌ UserHandler: Error getting user data:', error);
      callback && callback({
        success: false,
        error: error.message || 'Failed to get user data'
      });
    }
  });

  // Search users
  socket.on('users:search', async (data) => {
    try {
      const users = await searchUsers(data.searchTerm, data.excludeTelegramId);
      socket.emit('users:searchResults', { success: true, users });
    } catch (error) {
      socket.emit('users:searchResults', { success: false, error: error.message });
    }
  });

  // Search user by public ID
  socket.on('users:searchByPublicId', async (data) => {
    try {
      console.log(`🔍 Searching for user by public ID: ${data.publicId}`);
      
      const user = await searchUserByPublicId(data.publicId, data.excludeTelegramId);

      if (!user) {
        socket.emit('users:searchByPublicId', { 
          success: false, 
          error: 'User not found',
          users: []
        });
        return;
      }

      // Return user in the same format as search results
      const userData = {
        telegramId: user.telegramId,
        publicId: user.publicId,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture: user.profile_picture,
        isOnline: onlineUsers.has(user.telegramId.toString())
      };

      socket.emit('users:searchByPublicId', { 
        success: true, 
        users: [userData]
      });
    } catch (error) {
      console.error('Error searching user by public ID:', error);
      socket.emit('users:searchByPublicId', { 
        success: false, 
        error: error.message,
        users: []
      });
    }
  });

  // Get user's public ID
  socket.on('users:getPublicId', async (data) => {
    try {
      console.log(`🔍 Getting public ID for user: ${data.telegramId}`);
      
      const publicId = await generatePublicIdForUser(data.telegramId);
      
      socket.emit('users:publicId', { 
        success: true, 
        publicId: publicId
      });
    } catch (error) {
      console.error('Error getting public ID:', error);
      socket.emit('users:publicId', { 
        success: false, 
        error: error.message
      });
    }
  });

  // Send friend request
  socket.on('friends:sendRequest', async (data) => {
    try {
      const result = await sendFriendRequest(data.fromTelegramId, data.toTelegramId);
      
      // Send notification to the target user if they're online
      const targetRoom = `user_${data.toTelegramId}`;
      socketManager.getIO().to(targetRoom).emit('friend:requestReceived', {
        success: true,
        from: {
          telegramId: data.fromTelegramId,
          first_name: data.fromFirstName,
          last_name: data.fromLastName,
          profile_picture: data.fromProfilePicture
        },
        message: 'sent you a friend request'
      });
      
      socket.emit('friends:requestSent', { success: true, ...result });
    } catch (error) {
      socket.emit('friends:requestSent', { success: false, error: error.message });
    }
  });

  // Accept friend request
  socket.on('friends:acceptRequest', async (data) => {
    try {
      const result = await acceptFriendRequest(data.userTelegramId, data.friendTelegramId);
      
      // Notify the friend that their request was accepted
      const friendRoom = `user_${data.friendTelegramId}`;
      socketManager.getIO().to(friendRoom).emit('friend:requestAccepted', {
        success: true,
        by: {
          telegramId: data.userTelegramId,
          first_name: data.userFirstName,
          last_name: data.userLastName,
          profile_picture: data.userProfilePicture
        },
        message: 'accepted your friend request'
      });
      
      socket.emit('friends:requestAccepted', { success: true, ...result });
    } catch (error) {
      socket.emit('friends:requestAccepted', { success: false, error: error.message });
    }
  });

  // Reject friend request
  socket.on('friends:rejectRequest', async (data) => {
    try {
      const result = await rejectFriendRequest(data.userTelegramId, data.friendTelegramId);
      socket.emit('friends:requestRejected', { success: true, ...result });
    } catch (error) {
      socket.emit('friends:requestRejected', { success: false, error: error.message });
    }
  });

  // Remove friend
  socket.on('friends:remove', async (data) => {
    try {
      const result = await removeFriend(data.userTelegramId, data.friendTelegramId);
      socket.emit('friends:removed', { success: true, ...result });
    } catch (error) {
      socket.emit('friends:removed', { success: false, error: error.message });
    }
  });

  // Get friends list
  socket.on('friends:getList', async (telegramId) => {
    try {
      console.log(`📋 Getting friends list for user: ${telegramId}`);
      const friends = await getFriendsList(telegramId);
      socket.emit('friends:list', { success: true, friends });
    } catch (error) {
      socket.emit('friends:list', { success: false, error: error.message });
    }
  });

  // Get friend requests
  socket.on('friends:getRequests', async (telegramId) => {
    try {
      const requests = await getFriendRequests(telegramId);
      socket.emit('friends:requests', { success: true, requests });
    } catch (error) {
      socket.emit('friends:requests', { success: false, error: error.message });
    }
  });

  // Send lobby invitation
  socket.on('lobby:sendInvitation', async (data) => {
    try {
      console.log('🎯 Starting lobby invitation process...');
      console.log('📤 From user:', data.fromTelegramId);
      console.log('📥 To user:', data.toTelegramId);
      console.log('🏠 Room ID:', data.roomId);
      
      const result = await sendLobbyInvitation(
        data.fromTelegramId, 
        data.toTelegramId, 
        data.roomId, 
        data.roomName
      );
      
      // Emit to the inviting user
      socket.emit('lobby:invitationSent', { success: true, ...result });
      
      // Emit to the invited user (if they're online) - FIXED: Use proper socket emission
      const invitedUserRoom = `user_${data.toTelegramId}`;
      console.log(`📤 Sending invitation to room: ${invitedUserRoom}`);
      
      // Debug: Check if the room exists and has members
      const io = socketManager.getIO();
      const room = io.sockets.adapter.rooms.get(invitedUserRoom);
      console.log(`🔍 Room ${invitedUserRoom} exists:`, !!room);
      console.log(`🔍 Room ${invitedUserRoom} members:`, room ? room.size : 0);
      
      // Debug: List all rooms to see what's available
      console.log('🔍 All available rooms:', Array.from(io.sockets.adapter.rooms.keys()));
      
      // Debug: Check if the target user is online
      const isTargetOnline = onlineUsers.has(data.toTelegramId.toString());
      console.log(`🔍 Target user ${data.toTelegramId} online status:`, isTargetOnline);
      console.log(`🔍 Online users map:`, Array.from(onlineUsers.entries()));
      
      // Debug: Check if the target user's socket is in the room
      if (room) {
        const roomSockets = Array.from(room);
        console.log(`🔍 Sockets in room ${invitedUserRoom}:`, roomSockets);
        
        // Check if any of these sockets belong to the target user
        for (const socketId of roomSockets) {
          const socket = io.sockets.sockets.get(socketId);
          if (socket && socket.request.session.telegramId == data.toTelegramId) {
            console.log(`✅ Found target user's socket in room: ${socketId}`);
          }
        }
      }
      
      console.log('📤 About to emit lobby:invitationReceived to room:', invitedUserRoom);
      socketManager.getIO().to(invitedUserRoom).emit('lobby:invitationReceived', {
        success: true,
        invitation: result.invitation
      });
      console.log('✅ Invitation emission completed');
      
    } catch (error) {
      console.error('❌ Error sending lobby invitation:', error);
      socket.emit('lobby:invitationSent', { success: false, error: error.message });
    }
  });

  // Accept lobby invitation
  socket.on('lobby:acceptInvitation', async (data) => {
    try {
      console.log('✅ Accepting lobby invitation:', data);
      
      // Join the room
      socket.join(data.roomId);
      
      // Emit to the inviting user that invitation was accepted - FIXED: Use proper room emission
      const roomName = `room_${data.roomId}`;
      console.log(`📤 Notifying room: ${roomName} about accepted invitation`);
      socketManager.getIO().to(roomName).emit('lobby:invitationAccepted', {
        success: true,
        invitedUser: data.invitedUser
      });
      
      socket.emit('lobby:invitationAccepted', { success: true });
      
    } catch (error) {
      console.error('❌ Error accepting lobby invitation:', error);
      socket.emit('lobby:invitationAccepted', { success: false, error: error.message });
    }
  });

  // Reject lobby invitation
  socket.on('lobby:rejectInvitation', async (data) => {
    try {
      console.log('❌ Rejecting lobby invitation:', data);
      
      // Emit to the inviting user that invitation was rejected - FIXED: Use proper room emission
      const roomName = `room_${data.roomId}`;
      console.log(`📤 Notifying room: ${roomName} about rejected invitation`);
      socketManager.getIO().to(roomName).emit('lobby:invitationRejected', {
        success: true,
        invitedUser: data.invitedUser
      });
      
      socket.emit('lobby:invitationRejected', { success: true });
      
    } catch (error) {
      console.error('❌ Error rejecting lobby invitation:', error);
      socket.emit('lobby:invitationRejected', { success: false, error: error.message });
    }
  });



  // Test invitation sending
  socket.on('test:sendInvitation', async (data) => {
    try {
      console.log('🧪 Test invitation sending:', data);
      const invitedUserRoom = `user_${data.toTelegramId}`;
      
      // Debug: Check room and send test invitation
      const io = socketManager.getIO();
      const room = io.sockets.adapter.rooms.get(invitedUserRoom);
      console.log(`🧪 Test - Room ${invitedUserRoom} exists:`, !!room);
      console.log(`🧪 Test - Room ${invitedUserRoom} members:`, room ? room.size : 0);
      
      socketManager.getIO().to(invitedUserRoom).emit('lobby:invitationReceived', {
        success: true,
        invitation: {
          from: {
            telegramId: data.fromTelegramId,
            first_name: 'Test User',
            last_name: 'Test',
            profile_picture: null
          },
          roomId: data.roomId,
          roomName: 'Test Room',
          timestamp: new Date()
        }
      });
      
      console.log('🧪 Test invitation sent successfully');
    } catch (error) {
      console.error('🧪 Test invitation error:', error);
    }
  });

  // ============================================
  // 12-HOUR CYCLE MINING SESSION HANDLERS (for Play.js)
  // ============================================
  
  // Helper function to get current time in user's timezone
  const getCurrentTimeInTimezone = (timezone) => {
    if (!timezone) {
      // Default to UTC if no timezone set
      return new Date();
    }
    
    try {
      // Get current time in user's timezone
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(now);
      const year = parseInt(parts.find(p => p.type === 'year').value);
      const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
      const day = parseInt(parts.find(p => p.type === 'day').value);
      const hour = parseInt(parts.find(p => p.type === 'hour').value);
      const minute = parseInt(parts.find(p => p.type === 'minute').value);
      const second = parseInt(parts.find(p => p.type === 'second').value);
      
      // Create date in UTC that represents the local time in user's timezone
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } catch (error) {
      console.error('Error getting time in timezone:', error);
      return new Date();
    }
  };
  
  // Helper function to get current cycle and cycle end time based on user's timezone
  // Cycles: 10:00-22:00 (12h), 22:00-10:00 (12h)
  const getCurrentCycle = (timezone) => {
    if (!timezone) {
      return { cycle: null, cycleEndTime: null, remainingSeconds: 0 };
    }
    
    try {
      const now = new Date();
      
      // Get current date/time components in user's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(now);
      const year = parseInt(parts.find(p => p.type === 'year').value);
      const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
      const day = parseInt(parts.find(p => p.type === 'day').value);
      const currentHour = parseInt(parts.find(p => p.type === 'hour').value);
      const currentMinute = parseInt(parts.find(p => p.type === 'minute').value);
      
      let cycleEndHour, cycleEndMinute, cycleEndDay = day, cycleEndMonth = month, cycleEndYear = year;
      
      // Determine current cycle and calculate end time
      if (currentHour >= 10 && currentHour < 22) {
        // Cycle 1: 10:00 → 22:00
        cycleEndHour = 22;
        cycleEndMinute = 0;
      } else {
        // Cycle 2: 22:00 → 10:00 (next day)
        cycleEndHour = 10;
        cycleEndMinute = 0;
        // Handle day/month/year rollover
        const nextDay = new Date(year, month, day + 1);
        cycleEndDay = nextDay.getDate();
        cycleEndMonth = nextDay.getMonth();
        cycleEndYear = nextDay.getFullYear();
      }
      
      // Calculate cycle end time in UTC
      // We need to find the UTC timestamp that, when formatted in the user's timezone, gives us cycleEndHour:cycleEndMinute
      // Use binary search approach for efficiency
      let cycleEndTimeFinal = null;
      const cycleDurations = { 1: 12 * 3600, 2: 12 * 3600 };
      const currentCycle = currentHour >= 10 && currentHour < 22 ? 1 : 2;
      
      // Start search from current time, going forward up to 24 hours
      let low = now.getTime();
      let high = now.getTime() + 24 * 60 * 60 * 1000;
      let bestMatch = null;
      let bestDiff = Infinity;
      
      // Binary search for the cycle end time
      for (let i = 0; i < 20; i++) {
        const mid = Math.floor((low + high) / 2);
        const candidate = new Date(mid);
        const candidateParts = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).formatToParts(candidate);
        
        const candidateHour = parseInt(candidateParts.find(p => p.type === 'hour').value);
        const candidateDay = parseInt(candidateParts.find(p => p.type === 'day').value);
        const candidateMonth = parseInt(candidateParts.find(p => p.type === 'month').value) - 1;
        const candidateYear = parseInt(candidateParts.find(p => p.type === 'year').value);
        
        // Check if this is our target time
        if (candidateHour === cycleEndHour && 
            candidateDay === cycleEndDay && 
            candidateMonth === cycleEndMonth && 
            candidateYear === cycleEndYear) {
          const diff = Math.abs(candidate.getTime() - now.getTime());
          if (diff < bestDiff) {
            bestDiff = diff;
            bestMatch = candidate;
          }
          // Found a match, but continue searching for closer matches
          if (candidate.getTime() < now.getTime()) {
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        } else {
          // Compare to determine search direction
          const candidateTime = candidateYear * 100000000 + candidateMonth * 1000000 + candidateDay * 10000 + candidateHour * 100 + parseInt(candidateParts.find(p => p.type === 'minute').value);
          const targetTime = cycleEndYear * 100000000 + cycleEndMonth * 1000000 + cycleEndDay * 10000 + cycleEndHour * 100;
          
          if (candidateTime < targetTime) {
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
      }
      
      if (bestMatch) {
        cycleEndTimeFinal = bestMatch;
      } else {
        // Fallback: calculate based on current time and cycle duration
        cycleEndTimeFinal = new Date(now.getTime() + cycleDurations[currentCycle] * 1000);
      }
      
      // Calculate remaining seconds until cycle end
      const remainingMs = cycleEndTimeFinal.getTime() - now.getTime();
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      
      return {
        cycle: currentHour >= 10 && currentHour < 22 ? 1 : 2,
        cycleEndTime: cycleEndTimeFinal,
        remainingSeconds: remainingSeconds
      };
    } catch (error) {
      console.error('Error calculating cycle:', error);
      return { cycle: null, cycleEndTime: null, remainingSeconds: 0 };
    }
  };
  
  // Helper function to set user timezone
  socket.on('user:setTimezone', async (data, callback) => {
    try {
      const telegramId = data?.telegramId || socket.request.session?.telegramId;
      if (!telegramId) {
        return callback && callback({ success: false, error: 'Not authenticated' });
      }
      
      const { timezone } = data;
      if (!timezone) {
        return callback && callback({ success: false, error: 'Timezone is required' });
      }
      
      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback && callback({ success: false, error: 'User not found' });
      }
      
      user.timezone = timezone;
      await user.save();
      
      console.log(`✅ User ${telegramId} timezone set to: ${timezone}`);
      
      callback && callback({
        success: true,
        timezone: timezone,
        message: 'Timezone set successfully'
      });
    } catch (error) {
      console.error('Error setting timezone:', error);
      callback && callback({ success: false, error: error.message });
    }
  });
  
  // Start a new mining session (12-hour session, can start anytime)
  socket.on('playMining:start', async (data, callback) => {
    try {
      const telegramId = data?.telegramId || socket.request.session?.telegramId;
      if (!telegramId) {
        return callback && callback({ success: false, error: 'Not authenticated' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback && callback({ success: false, error: 'User not found' });
      }

      // Check if there's an active session
      if (user.miningSessionStartTime && user.miningSessionEndTime) {
        const now = new Date();
        if (now < user.miningSessionEndTime) {
          // Session still active
          return callback && callback({ 
            success: false, 
            error: 'Mining session already in progress',
            sessionStatus: 'active'
          });
        }
        
        // Session completed but not claimed
        if (user.miningSessionPendingRewards > 0) {
          return callback && callback({ 
            success: false, 
            error: 'Please claim your previous mining rewards before starting a new session',
            sessionStatus: 'completed'
          });
        }
      }

      // Require 1 ad to be watched before starting mining (reset for new session)
      if (user.adsWatchedForCycle < 1) {
        return callback && callback({ 
          success: false, 
          error: 'Please watch 1 ad before starting mining',
          requiresAds: true,
          adsWatched: user.adsWatchedForCycle || 0,
          adsRequired: 1
        });
      }

      // Start mining session - 12 hours from now
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + (12 * 60 * 60 * 1000)); // 12 hours from start

      user.miningSessionStartTime = startTime;
      user.miningSessionEndTime = endTime;
      user.miningSessionPendingRewards = 0; // Reset pending rewards
      // Reset ads watched when starting new session (user needs to watch ad for next session)
      user.adsWatchedForCycle = 0;
      user.lastCycleWithAds = null;
      await user.save();

      // Calculate effective mining rate (base rate * boost multiplier if active)
      const currentMiningLevel = user.miningLevel || 1;
      const baseMiningRate = getMiningRateFromLevel(currentMiningLevel);
      const effectiveMiningRate = getEffectiveMiningRate(user);
      
      // Update base mining rate if it doesn't match the level (store base rate, not boosted)
      if (user.miningRate !== baseMiningRate) {
        user.miningRate = baseMiningRate;
        await user.save();
      }
      
      // Calculate estimated rewards for 12-hour session using effective rate
      const sessionDurationHours = 12;
      const estimatedRewards = effectiveMiningRate * sessionDurationHours;
      const remainingSeconds = 12 * 60 * 60; // 12 hours in seconds

      console.log(`✅ Mining session started for user ${telegramId}:`, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationHours: sessionDurationHours,
        estimatedRewards: estimatedRewards.toFixed(2)
      });

      callback && callback({
        success: true,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        miningRate: effectiveMiningRate, // Return effective rate (with boost if active)
        baseMiningRate: baseMiningRate, // Also return base rate for reference
        miningLevel: currentMiningLevel,
        activeBoost: user.activeBoost && user.activeBoost.endTime && new Date() < new Date(user.activeBoost.endTime) ? {
          mode: user.activeBoost.mode,
          multiplier: user.activeBoost.multiplier
        } : null,
        estimatedRewards: estimatedRewards,
        remainingTime: remainingSeconds
      });
    } catch (error) {
      console.error('Error starting mining session:', error);
      callback && callback({ success: false, error: error.message });
    }
  });

  // Get current mining session status
  socket.on('playMining:status', async (data, callback) => {
    try {
      const telegramId = data?.telegramId || socket.request.session?.telegramId;
      if (!telegramId) {
        console.log('❌ playMining:status - Not authenticated, telegramId:', telegramId);
        return callback && callback({ success: false, error: 'Not authenticated' });
      }

      console.log('🔄 playMining:status - Fetching status for telegramId:', telegramId);
      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        console.log('❌ playMining:status - User not found for telegramId:', telegramId);
        return callback && callback({ success: false, error: 'User not found' });
      }

      const now = new Date();
      let sessionStatus = 'idle';
      let remainingTime = 0;
      let pendingRewards = 0;

      console.log('📊 playMining:status - User mining session data:', {
        hasStartTime: !!user.miningSessionStartTime,
        hasEndTime: !!user.miningSessionEndTime,
        startTime: user.miningSessionStartTime,
        endTime: user.miningSessionEndTime,
        now: now,
        miningRate: user.miningRate
      });

      if (user.miningSessionStartTime && user.miningSessionEndTime) {
        if (now < user.miningSessionEndTime) {
          // Session active
          sessionStatus = 'active';
          remainingTime = Math.max(0, Math.floor((user.miningSessionEndTime - now) / 1000));
          
          // Calculate effective mining rate (base rate * boost multiplier if active)
          const currentMiningLevel = user.miningLevel || 1;
          const effectiveMiningRate = getEffectiveMiningRate(user);
          
          // Calculate earned rewards so far (proportional to time elapsed in session)
          const elapsedHours = (now - user.miningSessionStartTime) / (1000 * 60 * 60);
          const totalSessionHours = (user.miningSessionEndTime - user.miningSessionStartTime) / (1000 * 60 * 60);
          const totalRewards = effectiveMiningRate * totalSessionHours;
          pendingRewards = Math.min(totalRewards, effectiveMiningRate * elapsedHours);
          
          console.log('✅ playMining:status - Active session:', {
            remainingTime,
            elapsedHours: elapsedHours.toFixed(2),
            totalSessionHours: totalSessionHours.toFixed(2),
            pendingRewards: Math.floor(pendingRewards)
          });
        } else {
          // Session completed
          sessionStatus = 'completed';
          remainingTime = 0;
          
          // Calculate effective mining rate (base rate * boost multiplier if active)
          const currentMiningLevel = user.miningLevel || 1;
          const effectiveMiningRate = getEffectiveMiningRate(user);
          
          // Calculate final rewards based on actual session duration using effective rate
          const totalSessionHours = (user.miningSessionEndTime - user.miningSessionStartTime) / (1000 * 60 * 60);
          const calculatedRewards = effectiveMiningRate * totalSessionHours;
          
          // Always update pending rewards when session is completed
          if (user.miningSessionPendingRewards !== calculatedRewards) {
            user.miningSessionPendingRewards = calculatedRewards;
            await user.save();
            console.log('💾 playMining:status - Updated pending rewards to:', calculatedRewards);
          }
          
          pendingRewards = user.miningSessionPendingRewards;
          console.log('✅ playMining:status - Completed session, pending rewards:', pendingRewards);
        }
      } else {
        console.log('ℹ️ playMining:status - No active session, status: idle');
      }

      // CRITICAL: Always get fresh PHMN value from database
      const userPHMN = user.PHMN || 0;
      
      // Calculate effective mining rate (base rate * boost multiplier if active)
      const currentMiningLevel = user.miningLevel || 1;
      const baseMiningRate = getMiningRateFromLevel(currentMiningLevel);
      const effectiveMiningRate = getEffectiveMiningRate(user);
      
      // Update base mining rate if it doesn't match the level (store base rate, not boosted)
      if (user.miningRate !== baseMiningRate) {
        user.miningRate = baseMiningRate;
        await user.save();
      }
      
      // Check if boost is active
      const isBoostActive = user.activeBoost && user.activeBoost.endTime && new Date() < new Date(user.activeBoost.endTime);
      
      const response = {
        success: true,
        sessionStatus,
        remainingTime,
        pendingRewards: Math.floor(pendingRewards),
        miningRate: effectiveMiningRate, // Return effective rate (with boost if active)
        baseMiningRate: baseMiningRate, // Also return base rate for reference
        miningLevel: currentMiningLevel,
        activeBoost: isBoostActive ? {
          mode: user.activeBoost.mode,
          multiplier: user.activeBoost.multiplier,
          endTime: user.activeBoost.endTime
        } : null,
        startTime: user.miningSessionStartTime ? user.miningSessionStartTime.toISOString() : null,
        endTime: user.miningSessionEndTime ? user.miningSessionEndTime.toISOString() : null,
        PHMN: userPHMN // Always return PHMN from database
      };

      console.log('📤 playMining:status - Sending response with PHMN from DB:', {
        ...response,
        PHMN: userPHMN
      });
      callback && callback(response);
    } catch (error) {
      console.error('❌ Error getting mining status:', error);
      callback && callback({ success: false, error: error.message });
    }
  });

  // Claim mining rewards
  socket.on('playMining:claim', async (data, callback) => {
    try {
      const telegramId = data?.telegramId || socket.request.session?.telegramId;
      if (!telegramId) {
        return callback && callback({ success: false, error: 'Not authenticated' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback && callback({ success: false, error: 'User not found' });
      }

      // Check if session is completed
      if (!user.miningSessionStartTime || !user.miningSessionEndTime) {
        return callback && callback({ success: false, error: 'No mining session found' });
      }

      const now = new Date();
      if (now < user.miningSessionEndTime) {
        return callback && callback({ success: false, error: 'Mining session is still in progress' });
      }

      // Calculate effective mining rate (base rate * boost multiplier if active)
      const currentMiningLevel = user.miningLevel || 1;
      const effectiveMiningRate = getEffectiveMiningRate(user);
      
      // Check if there are rewards to claim
      if (user.miningSessionPendingRewards <= 0) {
        // Calculate final rewards if not set using effective rate (fallback to 12 hours)
        const totalSessionHours = (user.miningSessionEndTime - user.miningSessionStartTime) / (1000 * 60 * 60);
        const finalRewards = effectiveMiningRate * (totalSessionHours || 12);
        user.miningSessionPendingRewards = finalRewards;
        await user.save();
      }

      const rewardsToClaim = user.miningSessionPendingRewards;

      console.log('💰 playMining:claim - Claiming rewards:', {
        telegramId,
        currentPHMN: user.PHMN || 0,
        rewardsToClaim: rewardsToClaim
      });

      // Add rewards to PHMN balance
      const previousPHMN = user.PHMN || 0;
      user.PHMN = previousPHMN + rewardsToClaim;
      
      // Clear session data
      user.miningSessionStartTime = null;
      user.miningSessionEndTime = null;
      user.miningSessionPendingRewards = 0;
      
      await user.save();

      console.log('✅ playMining:claim - Rewards claimed successfully:', {
        claimedRewards: Math.floor(rewardsToClaim),
        previousPHMN: previousPHMN,
        newPHMN: user.PHMN
      });

      // Reload user to ensure we have the latest data
      const updatedUser = await User.findOne({ telegramId: parseInt(telegramId) });

      callback && callback({
        success: true,
        claimedRewards: rewardsToClaim,
        newBalance: updatedUser.PHMN || 0
      });
    } catch (error) {
      console.error('Error claiming mining rewards:', error);
      callback && callback({ success: false, error: error.message });
    }
  });

  // Mark ads as watched for current cycle
  socket.on('ads:markWatched', async (data, callback) => {
    try {
      const telegramId = data?.telegramId || socket.request.session?.telegramId;
      if (!telegramId) {
        console.error('❌ ads:markWatched - Not authenticated, telegramId:', telegramId);
        return callback && callback({ success: false, error: 'Not authenticated' });
      }

      const { adsWatched } = data;
      console.log(`📥 ads:markWatched received for user ${telegramId}:`, { adsWatched, data });
      
      if (typeof adsWatched !== 'number' || adsWatched < 1 || adsWatched > 1) {
        console.error(`❌ ads:markWatched - Invalid count: ${adsWatched} (must be 1)`);
        return callback && callback({ 
          success: false, 
          error: 'Invalid ads watched count. Must be 1.' 
        });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback && callback({ success: false, error: 'User not found' });
      }

      // Set ads watched to 1 (capped at 1 per session)
      const previousCount = user.adsWatchedForCycle || 0;
      
      // If user already watched 1 ad, don't change it
      if (user.adsWatchedForCycle >= 1) {
        console.log(`✅ User already watched 1 ad, keeping count at 1`);
      } else {
        // Mark ad as watched (cap at 1)
        user.adsWatchedForCycle = Math.min(1, previousCount + adsWatched);
        console.log(`📺 Updating ads count: ${previousCount} + ${adsWatched} = ${user.adsWatchedForCycle} (capped at 1)`);
      }
      
      await user.save();

      // Reload user to ensure we have the latest data
      const updatedUser = await User.findOne({ telegramId: parseInt(telegramId) });

      console.log(`✅ Ads marked as watched for user ${telegramId}:`, {
        adsWatched: updatedUser.adsWatchedForCycle,
        totalRequired: 1,
        previousCount: previousCount,
        added: adsWatched
      });

      callback && callback({
        success: true,
        adsWatched: updatedUser.adsWatchedForCycle,
        adsRequired: 1,
        canStartMining: updatedUser.adsWatchedForCycle >= 1
      });
    } catch (error) {
      console.error('Error marking ads as watched:', error);
      callback && callback({ success: false, error: error.message });
    }
  });

  // Get Adsgram block ID
  socket.on('adsgram:getBlockId', async (data, callback) => {
    try {
      const blockId = process.env.ADSGRAM_BLOCK_ID || null;
      callback && callback({
        success: !!blockId,
        blockId: blockId,
        message: blockId ? 'Block ID available' : 'Block ID not configured in backend .env'
      });
    } catch (error) {
      console.error('Error getting Adsgram block ID:', error);
      callback && callback({ success: false, error: error.message });
    }
  });

  // Get ads status
  socket.on('ads:getStatus', async (data, callback) => {
    try {
      const telegramId = data?.telegramId || socket.request.session?.telegramId;
      if (!telegramId) {
        return callback && callback({ success: false, error: 'Not authenticated' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback && callback({ success: false, error: 'User not found' });
      }

      callback && callback({
        success: true,
        adsWatched: user.adsWatchedForCycle || 0,
        adsRequired: 1,
        canStartMining: (user.adsWatchedForCycle || 0) >= 1
      });
    } catch (error) {
      console.error('Error getting ads status:', error);
      callback && callback({ success: false, error: error.message });
    }
  });

  // Upgrade mining level
  socket.on('mining:upgradeLevel', async (data, callback) => {
    try {
      const telegramId = data?.telegramId || socket.request.session?.telegramId;
      if (!telegramId) {
        return callback && callback({ success: false, error: 'Not authenticated' });
      }

      const { targetLevel } = data;
      if (!targetLevel) {
        return callback && callback({ success: false, error: 'Target level is required' });
      }

      const levelData = MINING_LEVELS[targetLevel];
      if (!levelData) {
        return callback && callback({ success: false, error: 'Invalid level' });
      }

      if (!levelData.coinsNeeded) {
        return callback && callback({ success: false, error: 'Cannot upgrade to this level' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback && callback({ success: false, error: 'User not found' });
      }

      // Check if user already has this level or higher
      if (user.miningLevel >= targetLevel) {
        return callback && callback({ success: false, error: 'You already have this level or higher' });
      }

      // Check if user has enough PHMN to unlock (but don't deduct)
      const userPHMN = user.PHMN || 0;
      if (userPHMN < levelData.coinsNeeded) {
        return callback && callback({ 
          success: false, 
          error: `You need at least ${levelData.coinsNeeded} PHMN to unlock this level.` 
        });
      }

      // Upgrade level (no PHMN deduction - just requires having the amount)
      user.miningLevel = targetLevel;
      user.miningRate = levelData.coinsPerHour;
      await user.save();

      console.log(`✅ User ${telegramId} upgraded to mining level ${targetLevel}`);

      callback && callback({
        success: true,
        newLevel: targetLevel,
        newMiningRate: levelData.coinsPerHour,
        newBalance: user.PHMN, // Balance remains unchanged
        message: `Successfully unlocked level ${targetLevel}!`
      });
    } catch (error) {
      console.error('Error upgrading mining level:', error);
      callback && callback({ success: false, error: error.message });
    }
  });

  // Purchase boost (Turbo 2x, Super 4x, Ultimate 6x)
  socket.on('mining:purchaseBoost', async (data, callback) => {
    try {
      const telegramId = data?.telegramId || socket.request.session?.telegramId;
      if (!telegramId) {
        return callback && callback({ success: false, error: 'Not authenticated' });
      }

      const { mode, duration, multiplier, tonAmount, usdAmount, transactionHash } = data;
      
      if (!mode || !duration || !multiplier || !tonAmount || !usdAmount || !transactionHash) {
        return callback && callback({ 
          success: false, 
          error: 'Missing required boost purchase data' 
        });
      }

      // Validate mode
      const validModes = ['turbo', 'super', 'ultimate'];
      if (!validModes.includes(mode)) {
        return callback && callback({ success: false, error: 'Invalid boost mode' });
      }

      // Validate duration
      const validDurations = ['day', 'week', 'month'];
      if (!validDurations.includes(duration)) {
        return callback && callback({ success: false, error: 'Invalid duration' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback && callback({ success: false, error: 'User not found' });
      }

      // Calculate boost end time based on duration
      const now = new Date();
      let endTime = new Date(now);
      switch (duration) {
        case 'day':
          endTime.setDate(now.getDate() + 1);
          break;
        case 'week':
          endTime.setDate(now.getDate() + 7);
          break;
        case 'month':
          endTime.setMonth(now.getMonth() + 1);
          break;
      }

      // Set active boost
      user.activeBoost = {
        mode: mode,
        multiplier: multiplier,
        startTime: now,
        endTime: endTime,
        duration: duration,
        tonAmount: tonAmount,
        usdAmount: usdAmount,
        transactionHash: transactionHash
      };

      // Add to boost history
      if (!user.boostHistory) {
        user.boostHistory = [];
      }
      user.boostHistory.push({
        mode: mode,
        multiplier: multiplier,
        duration: duration,
        tonAmount: tonAmount,
        usdAmount: usdAmount,
        transactionHash: transactionHash,
        startTime: now,
        endTime: endTime,
        purchasedAt: now
      });

      await user.save();

      console.log(`✅ User ${telegramId} purchased boost: ${mode} ${duration} (${multiplier}x) for ${tonAmount} TON`);

      callback && callback({
        success: true,
        boost: {
          mode: mode,
          multiplier: multiplier,
          startTime: now.toISOString(),
          endTime: endTime.toISOString(),
          duration: duration
        },
        message: `Successfully activated ${multiplier}x boost for ${duration === 'day' ? '1 day' : duration === 'week' ? '1 week' : '1 month'}!`
      });
    } catch (error) {
      console.error('Error purchasing boost:', error);
      callback && callback({ success: false, error: error.message });
    }
  });

  // Get rank stats (for Tasks component)
  socket.on('rank:getStats', async (telegramId) => {
    try {
      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      
      if (!user) {
        // Return default stats if user doesn't exist
        if (socket.connected) {
          socket.emit('rank:stats', {
            success: true,
            rankPoints: 0,
            rankName: 'Bronze',
            rankColor: '#CD7F32',
            rankProgress: 0,
            rankMinPoints: 0,
            rankMaxPoints: 1000,
            totalGamesPlayed: 0,
            totalGamesWon: 0,
            winRate: 0,
            totalPawnsKilled: 0,
            totalFirstHome: 0,
            lastGame: null,
            gameHistory: []
          });
        }
        return;
      }

      // Calculate rank info (simplified version)
      const rankPoints = user.rank_points || 0;
      let rankName = 'Bronze';
      let rankColor = '#CD7F32';
      let rankMinPoints = 0;
      let rankMaxPoints = 1000;
      let rankProgress = 0;

      if (rankPoints >= 0 && rankPoints <= 1000) {
        rankName = 'Bronze';
        rankColor = '#CD7F32';
        rankMinPoints = 0;
        rankMaxPoints = 1000;
        rankProgress = (rankPoints / 1000) * 100;
      } else if (rankPoints <= 1200) {
        rankName = 'Silver';
        rankColor = '#C0C0C0';
        rankMinPoints = 1001;
        rankMaxPoints = 1200;
        rankProgress = ((rankPoints - 1001) / 199) * 100;
      } else if (rankPoints <= 2000) {
        rankName = 'Gold I';
        rankColor = '#FFD700';
        rankMinPoints = 1201;
        rankMaxPoints = 2000;
        rankProgress = ((rankPoints - 1201) / 799) * 100;
      } else {
        rankName = 'Gold II';
        rankColor = '#FFD700';
        rankMinPoints = 2001;
        rankMaxPoints = 4000;
        rankProgress = Math.min(100, ((rankPoints - 2001) / 1999) * 100);
      }

      if (socket.connected) {
        socket.emit('rank:stats', {
          success: true,
          rankPoints: rankPoints,
          rankName: rankName,
          rankColor: rankColor,
          rankProgress: rankProgress,
          rankMinPoints: rankMinPoints,
          rankMaxPoints: rankMaxPoints,
          totalGamesPlayed: user.total_games_played || 0,
          totalGamesWon: user.total_games_won || 0,
          winRate: user.total_games_played > 0 ? (user.total_games_won / user.total_games_played * 100).toFixed(1) : 0,
          totalPawnsKilled: user.total_pawns_killed || 0,
          totalFirstHome: user.total_first_home || 0,
          lastGame: user.last_game_history || null,
          gameHistory: user.game_history || []
        });
      }
    } catch (error) {
      console.error('🏆 Server: Error getting rank stats:', error);
      if (socket.connected) {
        socket.emit('rank:stats', { success: false, error: error.message });
      }
    }
  });

  // Handle socket disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    
    // Find and remove user from online users
    for (const [telegramId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        console.log(`👤 User ${telegramId} disconnected, marking as offline`);
        trackUserOffline(telegramId);
        break;
      }
    }
  });
};

module.exports = {
  saveUserData,
  getUserProfile,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriendsList,
  getFriendRequests,
  sendLobbyInvitation,
  registerUserHandlers
};
