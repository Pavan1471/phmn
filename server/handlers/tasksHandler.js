const User = require('../models/user');
let fetch;
try {
  // Prefer node-fetch v2 for CommonJS
  fetch = require('node-fetch');
} catch (e) {
  // Fallback to global fetch if available (Node 18+)
  fetch = global.fetch;
}

class TasksHandler {
  constructor(socket) {
    if (!socket) {
      throw new Error('Socket is required for TasksHandler');
    }
    this.socket = socket;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    if (!this.socket) {
      console.error('Socket is not available for TasksHandler');
      return;
    }

    // Referral system events
    this.socket.on('referral:getCode', this.handleGetReferralCode.bind(this));
    this.socket.on('referral:useCode', this.handleUseReferralCode.bind(this));
    this.socket.on('referral:getStats', this.handleGetReferralStats.bind(this));
    this.socket.on('referral:claimReward', this.handleClaimReferralReward.bind(this));
    this.socket.on('referral:debug', this.handleGetReferralDebug.bind(this));
    this.socket.on('referral:getStoredCode', this.handleGetStoredReferralCode.bind(this));
    
    // Task system events
    this.socket.on('tasks:getAvailable', this.handleGetAvailableTasks.bind(this));
    this.socket.on('tasks:claimReward', this.handleClaimTaskReward.bind(this));
    this.socket.on('tasks:checkChannelMembership', this.handleCheckChannelMembership.bind(this));
    
    // App configuration events
    this.socket.on('app:getBotUsername', this.handleGetBotUsername.bind(this));
  }

  // Get user's referral code
  async handleGetReferralCode(data, callback) {
    try {
      const { telegramId } = data;
      if (!telegramId) {
        return callback({ success: false, error: 'Telegram ID is required' });
      }

      let user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback({ success: false, error: 'User not found' });
      }

      // Ensure user has a referral code
      if (!user.referralCode) {
        user.referralCode = await user.generateReferralCode();
        await user.save();
      }

      callback({
        success: true,
        referralCode: user.referralCode,
        totalReferrals: user.totalReferrals,
        totalEarnings: user.totalReferralEarnings
      });
    } catch (error) {
      console.error('Error getting referral code:', error);
      callback({ success: false, error: 'Failed to get referral code' });
    }
  }

  // Use a referral code (when new user joins)
  async handleUseReferralCode(data, callback) {
    try {
      const { telegramId, referralCode } = data;
      if (!telegramId || !referralCode) {
        return callback({ success: false, error: 'Telegram ID and referral code are required' });
      }

      // Find the referrer
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (!referrer) {
        return callback({ success: false, error: 'Invalid referral code' });
      }

      // Prevent self-referral
      if (referrer.telegramId === parseInt(telegramId)) {
        return callback({ success: false, error: 'Cannot refer yourself' });
      }

      // Check if user already used a referral code
      let user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (user && user.referredBy) {
        return callback({ success: false, error: 'User already used a referral code' });
      }

      // Create or update user with referral info
      if (!user) {
        user = new User({ telegramId: parseInt(telegramId) });
      }
      
      user.referredBy = referrer.telegramId;
      
      // Give bonus to the person who uses the referral code (50 Gold Pieces)
      user.total_mined_pieces += 50;
      
      await user.save();

      // Update referrer's stats
      referrer.referrals.push(parseInt(telegramId));
      referrer.totalReferrals = referrer.referrals.length;
      
      // Give immediate reward for each referral (0.01 PHMN)
      const immediateReward = 0.3;
      referrer.PHMN = (referrer.PHMN || 0) + immediateReward;
      referrer.totalReferralEarnings += immediateReward;
      
      // Check for milestone rewards
      const milestoneReward = this.calculateMilestoneReward(referrer.totalReferrals);
      if (milestoneReward > 0) {
        referrer.total_mined_pieces += milestoneReward;
        referrer.totalReferralEarnings += milestoneReward;
        
        // Add to referral history
        if (!referrer.referralHistory) referrer.referralHistory = [];
        referrer.referralHistory.push({
          type: 'milestone',
          referralId: parseInt(telegramId),
          reward: milestoneReward,
          milestone: referrer.totalReferrals,
          timestamp: new Date()
        });
      }
      
      // Add immediate reward to history
      if (!referrer.referralHistory) referrer.referralHistory = [];
      referrer.referralHistory.push({
        type: 'first_game',
        referralId: parseInt(telegramId),
        reward: immediateReward,
        timestamp: new Date()
      });
      
      await referrer.save();

      // Automatically add both users as friends
      await this.autoAddReferralFriends(referrer.telegramId, parseInt(telegramId));

      callback({
        success: true,
        message: 'Referral code applied successfully! You received 50 Gold Pieces as a welcome bonus!',
        referrerName: referrer.first_name || referrer.username || 'Unknown'
      });
    } catch (error) {
      console.error('Error using referral code:', error);
      callback({ success: false, error: 'Failed to use referral code' });
    }
  }

  // Get stored referral code for a user (when they use regular "Open" button)
  async handleGetStoredReferralCode(data, callback) {
    try {
      const { telegramId } = data;
      if (!telegramId) {
        return callback({ success: false, error: 'Telegram ID is required' });
      }

      // Get the referral code store from the main server file
      const { referralCodeStore } = require('../index');
      
      if (!referralCodeStore) {
        return callback({ success: false, error: 'Referral code store not available' });
      }

      const storedData = referralCodeStore.get(telegramId.toString());
      
      if (!storedData) {
        return callback({ success: false, error: 'No stored referral code found' });
      }

      // Check if the code has expired
      if (storedData.expiresAt < Date.now()) {
        referralCodeStore.delete(telegramId.toString());
        return callback({ success: false, error: 'Stored referral code has expired' });
      }

      // Return the stored referral code
      callback({
        success: true,
        referralCode: storedData.code,
        timestamp: storedData.timestamp
      });

      // Clean up the stored code after retrieving it
      referralCodeStore.delete(telegramId.toString());
      
    } catch (error) {
      console.error('Error getting stored referral code:', error);
      callback({ success: false, error: 'Failed to get stored referral code' });
    }
  }

  // Automatically add referral friends
  async autoAddReferralFriends(referrerTelegramId, referredTelegramId) {
    try {
      const referrer = await User.findOne({ telegramId: referrerTelegramId });
      const referred = await User.findOne({ telegramId: referredTelegramId });

      if (!referrer || !referred) {
        console.error('❌ Auto-add friends: One or both users not found');
        return;
      }

      // Check if they're already friends
      if (referrer.friends.includes(referredTelegramId) || referred.friends.includes(referrerTelegramId)) {
        console.log('👥 Auto-add friends: Users are already friends');
        return;
      }

      // Add to friends list for both users
      if (!referrer.friends.includes(referredTelegramId)) {
        referrer.friends.push(referredTelegramId);
      }
      if (!referred.friends.includes(referrerTelegramId)) {
        referred.friends.push(referrerTelegramId);
      }

      // Remove any pending friend requests between them
      referrer.friend_requests = referrer.friend_requests.filter(id => id !== referredTelegramId);
      referred.friend_requests = referred.friend_requests.filter(id => id !== referrerTelegramId);

      await referrer.save();
      await referred.save();

      console.log(`👥 Auto-added friends: ${referrerTelegramId} and ${referredTelegramId} are now friends via referral`);

      // Notify both users if they're online
      const socketManager = require('../socket/socketManager');
      const io = socketManager.getIO();
      
      // Notify referrer
      const referrerRoom = `user_${referrerTelegramId}`;
      io.to(referrerRoom).emit('friends:autoAdded', {
        success: true,
        friend: {
          telegramId: referredTelegramId,
          first_name: referred.first_name,
          last_name: referred.last_name,
          profile_picture: referred.profile_picture,
          publicId: referred.publicId
        },
        message: `You and ${referred.first_name || 'your referral'} are now friends!`
      });

      // Notify referred user
      const referredRoom = `user_${referredTelegramId}`;
      io.to(referredRoom).emit('friends:autoAdded', {
        success: true,
        friend: {
          telegramId: referrerTelegramId,
          first_name: referrer.first_name,
          last_name: referrer.last_name,
          profile_picture: referrer.profile_picture,
          publicId: referrer.publicId
        },
        message: `You and ${referrer.first_name || 'your referrer'} are now friends!`
      });

    } catch (error) {
      console.error('❌ Error auto-adding referral friends:', error);
    }
  }

  // Calculate milestone rewards based on referral count
  calculateMilestoneReward(referralCount) {
    if (referralCount === 1) return 10;
    if (referralCount === 5) return 50;
    if (referralCount === 10) return 100;
    if (referralCount === 50) return 500;
    if (referralCount === 100) return 0; // Mindrop coming soon
    if (referralCount === 1000) return 0; // Megadrop coming soon
    return 0;
  }

  // Get referral statistics
  async handleGetReferralStats(data, callback) {
    try {
      const { telegramId } = data;
      if (!telegramId) {
        return callback({ success: false, error: 'Telegram ID is required' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback({ success: false, error: 'User not found' });
      }

      // Get detailed referral information
      const referrals = await User.find({ 
        telegramId: { $in: user.referrals } 
      }).select('telegramId first_name last_name username created_at total_games_played');

      // Get referrer info if user was referred
      let referrer = null;
      if (user.referredBy) {
        referrer = await User.findOne({ telegramId: user.referredBy })
          .select('telegramId first_name last_name username');
      }

      // Calculate actual total earnings from referralHistory (only count immediate referral rewards in PHMN)
      // Exclude milestone rewards which are in Gold Pieces to avoid mixing units
      const referralHistory = user.referralHistory || [];
      const actualTotalEarnings = referralHistory.reduce((sum, entry) => {
        // Only count 'first_game' type rewards (immediate referral rewards in PHMN)
        // Milestone rewards are in Gold Pieces and should be excluded
        if (entry.type === 'first_game') {
          return sum + (entry.reward || 0);
        }
        return sum;
      }, 0);

      callback({
        success: true,
        stats: {
          referralCode: user.referralCode,
          totalReferrals: user.totalReferrals,
          totalEarnings: actualTotalEarnings, // Use calculated value from history
          referrals: referrals.map(ref => ({
            telegramId: ref.telegramId,
            name: ref.first_name || ref.last_name || ref.username || 'Unknown',
            joinedAt: ref.created_at,
            gamesPlayed: ref.total_games_played || 0
          })),
          referrer: referrer ? {
            telegramId: referrer.telegramId,
            name: referrer.first_name || referrer.last_name || referrer.username || 'Unknown'
          } : null,
          referralHistory: referralHistory
        }
      });
    } catch (error) {
      console.error('Error getting referral stats:', error);
      callback({ success: false, error: 'Failed to get referral stats' });
    }
  }

  // Claim referral reward (when referred user completes first game)
  async handleClaimReferralReward(data, callback) {
    try {
      const { telegramId, referralId } = data;
      if (!telegramId || !referralId) {
        return callback({ success: false, error: 'Telegram ID and referral ID are required' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback({ success: false, error: 'User not found' });
      }

      // Check if user has this referral
      if (!user.referrals.includes(parseInt(referralId))) {
        return callback({ success: false, error: 'Invalid referral ID' });
      }

      // Check if reward already claimed for this referral
      if (user.referralRewardsClaimed.includes(parseInt(referralId))) {
        return callback({ success: false, error: 'Reward already claimed for this referral' });
      }

      // Check if referred user has completed at least one game
      const referredUser = await User.findOne({ telegramId: parseInt(referralId) });
      if (!referredUser || referredUser.total_games_played === 0) {
        return callback({ success: false, error: 'Referred user has not completed any games yet' });
      }

      // Award the referral reward
      const rewardAmount = 0.3; // 0.01 PHMN for first game
      user.PHMN = (user.PHMN || 0) + rewardAmount;
      user.totalReferralEarnings += rewardAmount;
      user.referralRewardsClaimed.push(parseInt(referralId));
      
      // Add to referral history
      if (!user.referralHistory) user.referralHistory = [];
      user.referralHistory.push({
        type: 'first_game',
        referralId: parseInt(referralId),
        reward: rewardAmount,
        timestamp: new Date()
      });
      
      await user.save();

      callback({
        success: true,
        message: `Referral reward claimed! +${rewardAmount} PHMN`,
        rewardAmount,
        totalEarnings: user.totalReferralEarnings
      });
    } catch (error) {
      console.error('Error claiming referral reward:', error);
      callback({ success: false, error: 'Failed to claim referral reward' });
    }
  }

  // Get detailed referral debugging information
  async handleGetReferralDebug(data, callback) {
    try {
      const { telegramId } = data;
      if (!telegramId) {
        return callback({ success: false, error: 'Telegram ID is required' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback({ success: false, error: 'User not found' });
      }

      // Get detailed referral information for debugging
      const referralDetails = [];
      for (const refId of user.referrals) {
        const referredUser = await User.findOne({ telegramId: refId });
        if (referredUser) {
          referralDetails.push({
            telegramId: refId,
            name: referredUser.first_name || referredUser.username || 'Unknown',
            gamesPlayed: referredUser.total_games_played,
            isClaimed: user.referralRewardsClaimed.includes(refId),
            joinedAt: referredUser.created_at
          });
        }
      }

      callback({
        success: true,
        debug: {
          referralCode: user.referralCode,
          totalReferrals: user.totalReferrals,
          totalEarnings: user.totalReferralEarnings,
          referrals: referralDetails,
          referralRewardsClaimed: user.referralRewardsClaimed,
          referralHistory: user.referralHistory || [],
          miningPieces: user.miningPieces
        }
      });
    } catch (error) {
      console.error('Error getting referral debug info:', error);
      callback({ success: false, error: 'Failed to get referral debug info' });
    }
  }

  // Check and update referral eligibility when user completes a game
  async checkReferralEligibility(telegramId) {
    try {
      // Find users who referred this user
      const referrers = await User.find({ referrals: telegramId });
      
      for (const referrer of referrers) {
        // Check if this referral reward is already claimed
        if (!referrer.referralRewardsClaimed.includes(telegramId)) {
          // Update referral stats if needed
          await referrer.save();
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking referral eligibility:', error);
      return false;
    }
  }

  // Get available tasks (including referral tasks)
  async handleGetAvailableTasks(data, callback) {
    try {
      const { telegramId } = data;
      if (!telegramId) {
        return callback({ success: false, error: 'Telegram ID is required' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback({ success: false, error: 'User not found' });
      }

      const tasks = [];



      // Daily login task
      const today = new Date().toDateString();
      const lastDaily = user.lastDailyReward ? new Date(user.lastDailyReward).toDateString() : null;
      const dailyTask = {
        id: 'daily_login',
        type: 'daily',
        title: 'Daily Login',
        description: 'Log in today to claim your daily reward',
        icon: '📅',
        reward: 50,
        completed: lastDaily === today,
        progress: lastDaily === today ? 1 : 0,
        target: 1
      };
      tasks.push(dailyTask);

      // Boost mining rate task
      const lastBoostRate = user.lastBoostRateTaskClaimed ? new Date(user.lastBoostRateTaskClaimed).toDateString() : null;
      const boostRateTask = {
        id: 'boost_mining_rate',
        type: 'mining',
        title: 'Boost Mining Rate',
        description: 'Watch 1 ad to boost mining rate by +0.2%',
        icon: '⚡',
        reward: 0,
        completed: lastBoostRate === today,
        progress: lastBoostRate === today ? 1 : 0,
        target: 1,
        lastBoostRateTaskClaimed: user.lastBoostRateTaskClaimed
      };
      tasks.push(boostRateTask);

      // Extend mining time task
      const lastExtendTime = user.lastExtendTimeTaskClaimed ? new Date(user.lastExtendTimeTaskClaimed).toDateString() : null;
      const extendTimeTask = {
        id: 'extend_mining_time',
        type: 'mining',
        title: 'Extend Mining Time',
        description: 'Watch 1 ad to extend mining time by +2 hours',
        icon: '⏰',
        reward: 0,
        completed: lastExtendTime === today,
        progress: lastExtendTime === today ? 1 : 0,
        target: 1,
        lastExtendTimeTaskClaimed: user.lastExtendTimeTaskClaimed
      };
      tasks.push(extendTimeTask);

      // Channel join task
      const channelTask = {
        id: 'join_channel',
        type: 'social',
        title: 'Join Telegram Channel',
        description: '',
        reward: 0.3,
        completed: user.channelJoinedRewardClaimed || false,
        progress: user.channelJoinedRewardClaimed ? 1 : 0,
        target: 1,
        channelLink: 'https://t.me/PhoneMinerChadGlobal'
      };
      tasks.push(channelTask);

      // X follow task
      const xFollowTask = {
        id: 'follow_x',
        type: 'social',
        title: 'Follow us on X',
        description: 'Follow us X (Twitter) for updates and rewards',
        reward: 0.3,
        completed: user.xFollowRewardClaimed || false,
        progress: user.xFollowRewardClaimed ? 1 : 0,
        target: 1,
        xLink: 'https://x.com/PhoneMinerChad'
      };
      tasks.push(xFollowTask);

      // Discord join task
      const discordTask = {
        id: 'join_discord',
        type: 'social',
        title: 'Join Discord Server',
        description: 'Join our Discord server for updates and rewards',
        reward: 0.3,
        completed: user.discordJoinedRewardClaimed || false,
        progress: user.discordJoinedRewardClaimed ? 1 : 0,
        target: 1,
        discordLink: 'https://discord.gg/cSBCQhEECc'
      };
      tasks.push(discordTask);


      callback({
        success: true,
        tasks
      });
    } catch (error) {
      console.error('Error getting available tasks:', error);
      callback({ success: false, error: 'Failed to get available tasks' });
    }
  }

  // Claim task reward
  async handleClaimTaskReward(data, callback) {
    try {
      const { telegramId, taskId } = data;
      
      if (!telegramId || !taskId) {
        return callback({ success: false, error: 'Telegram ID and task ID are required' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback({ success: false, error: 'User not found' });
      }

      let rewardAmount = 0;
      let message = '';

      switch (taskId) {
        case 'referral':
          // Handle referral rewards
          if (user.totalReferrals === 0) {
            return callback({ success: false, error: 'No referrals to claim rewards for' });
          }
          
          // Find referrals that haven't been claimed yet
          const unclaimedReferrals = user.referrals.filter(refId => 
            !user.referralRewardsClaimed.includes(refId)
          );
          
          if (unclaimedReferrals.length === 0) {
            return callback({ success: false, error: 'All referral rewards have been claimed' });
          }
          
          // Check which unclaimed referrals are eligible for rewards (have played games)
          let eligibleCount = 0;
          for (const refId of unclaimedReferrals) {
            const referredUser = await User.findOne({ telegramId: refId });
            if (referredUser && referredUser.total_games_played > 0) {
              eligibleCount++;
              // Mark this referral as claimed
              user.referralRewardsClaimed.push(refId);
            }
          }
          
          if (eligibleCount === 0) {
            return callback({ success: false, error: 'No eligible referrals found. Your referrals need to complete games first.' });
          }
          
          // Award rewards for eligible referrals only
          rewardAmount = eligibleCount * 0.3;
          user.PHMN = (user.PHMN || 0) + rewardAmount;
          user.totalReferralEarnings += rewardAmount;
          
          message = `Referral rewards claimed! +${rewardAmount.toFixed(2)} PHMN for ${eligibleCount} referral(s)`;
          break;

        case 'daily_login':
          const today = new Date().toDateString();
          const lastDaily = user.lastDailyReward ? new Date(user.lastDailyReward).toDateString() : null;
          
          if (lastDaily === today) {
            return callback({ success: false, error: 'Daily reward already claimed today' });
          }
          
          // Daily login reward: 0.2 PHMN
          rewardAmount = 0.2;
          user.lastDailyReward = new Date();
          user.PHMN = (user.PHMN || 0) + rewardAmount;
          message = 'Daily login reward claimed! +0.2 PHMN';
          break;

        case 'boost_mining_rate':
          const todayBoostRate = new Date().toDateString();
          const lastBoostRateClaimed = user.lastBoostRateTaskClaimed ? new Date(user.lastBoostRateTaskClaimed).toDateString() : null;
          
          if (lastBoostRateClaimed === todayBoostRate) {
            return callback({ success: false, error: 'Mining rate boost already claimed today' });
          }
          
          // Boost mining rate by 0.2% (0.002 multiplier)
          user.miningRateBoostFromAds = (user.miningRateBoostFromAds || 0) + 0.002;
          user.lastBoostRateTaskClaimed = new Date();
          message = 'Mining rate boosted by +0.2%!';
          break;

        case 'extend_mining_time':
          const todayExtendTime = new Date().toDateString();
          const lastExtendTimeClaimed = user.lastExtendTimeTaskClaimed ? new Date(user.lastExtendTimeTaskClaimed).toDateString() : null;
          
          if (lastExtendTimeClaimed === todayExtendTime) {
            return callback({ success: false, error: 'Mining time extension already claimed today' });
          }
          
          // Check if mining session is active and valid
          const now = new Date();
          const hasActiveSession = user.miningSessionStartTime && 
                                   user.miningSessionEndTime && 
                                   now < new Date(user.miningSessionEndTime);
          
          if (!hasActiveSession) {
            return callback({ 
              success: false, 
              error: 'Please start mining first before extending mining time',
              requiresMiningActive: true
            });
          }
          
          // Extend mining time by 2 hours
          user.miningTimeExtended = (user.miningTimeExtended || 0) + 2;
          user.lastExtendTimeTaskClaimed = new Date();
          
          // Extend the active session endTime by 2 hours
          const currentEndTime = new Date(user.miningSessionEndTime);
          currentEndTime.setHours(currentEndTime.getHours() + 2);
          user.miningSessionEndTime = currentEndTime;
          
          message = 'Mining time extended by +2 hours!';
          break;

        case 'join_channel':
          if (user.channelJoinedRewardClaimed) {
            return callback({ success: false, error: 'Channel join reward already claimed' });
          }
          
          // Verify channel membership before allowing claim
          const isVerifiedMember = await this.verifyChannelMembership(telegramId);
          
          if (!isVerifiedMember) {
            return callback({ 
              success: false, 
              error: 'Please join the channel first, then try claiming again.',
              requiresVerification: true
            });
          }
          
          // Channel join reward: 0.3 PHMN
          rewardAmount = 0.3;
          user.channelJoinedRewardClaimed = true;
          user.PHMN = (user.PHMN || 0) + rewardAmount;
          message = 'Channel join reward claimed! +0.3 PHMN';
          break;

        case 'follow_x':
          if (user.xFollowRewardClaimed) {
            return callback({ success: false, error: 'X follow reward already claimed' });
          }
          
          // For X follow, we'll use manual verification since we can't programmatically verify follows
          // The user will need to confirm they followed the account
          const confirmed = data.confirmed || false;
          
          if (!confirmed) {
            return callback({ 
              success: false, 
              error: 'Please follow on X first, then confirm to claim your reward.',
              requiresConfirmation: true
            });
          }
          
          // X follow reward: 0.3 PHMN
          rewardAmount = 0.3;
          user.xFollowRewardClaimed = true;
          user.PHMN = (user.PHMN || 0) + rewardAmount;
          message = 'X follow reward claimed! +0.3 PHMN';
          break;

        case 'join_discord':
          if (user.discordJoinedRewardClaimed) {
            return callback({ success: false, error: 'Discord join reward already claimed' });
          }
          
          // For Discord join, we'll use manual verification since we can't programmatically verify joins
          // The user will need to confirm they joined the server
          const discordConfirmed = data.confirmed || false;
          
          if (!discordConfirmed) {
            return callback({ 
              success: false, 
              error: 'Please join Discord server first, then confirm to claim your reward.',
              requiresConfirmation: true
            });
          }
          
          // Discord join reward: 0.3 PHMN
          rewardAmount = 0.3;
          user.discordJoinedRewardClaimed = true;
          user.PHMN = (user.PHMN || 0) + rewardAmount;
          message = 'Discord join reward claimed! +0.3 PHMN';
          break;

        default:
          return callback({ success: false, error: 'Invalid task ID' });
      }

      // All rewards are already handled in their respective cases
      // No need to add rewardAmount again here
      await user.save();

      callback({
        success: true,
        message,
        rewardAmount,
        PHMN: user.PHMN || 0
      });
    } catch (error) {
      console.error('Error claiming task reward:', error);
      callback({ success: false, error: 'Failed to claim task reward' });
    }
  }

  // Get bot username from server configuration
  async handleGetBotUsername(data, callback) {
    try {
      // Get bot username from environment variables
      const botUsername = process.env.BOT_USERNAME;
      
      callback({ success: true, botUsername });
    } catch (error) {
      console.error('Error getting bot username:', error);
      callback({ success: false, error: 'Failed to get bot username' });
    }
  }

  // Check channel membership status
  async handleCheckChannelMembership(data, callback) {
    try {
      const { telegramId } = data;
      if (!telegramId) {
        return callback({ success: false, error: 'Telegram ID is required' });
      }

      const user = await User.findOne({ telegramId: parseInt(telegramId) });
      if (!user) {
        return callback({ success: false, error: 'User not found' });
      }

      // Check if already claimed
      if (user.channelJoinedRewardClaimed) {
        return callback({
          success: true,
          isMember: true,
          canClaim: false,
          message: 'Channel join reward already claimed'
        });
      }

      // Try to verify via Telegram Bot API first
      const isVerifiedMember = await this.verifyChannelMembership(telegramId);
      
      if (isVerifiedMember) {
        // User is verified as a member, allow claiming
        return callback({
          success: true,
          isMember: true,
          canClaim: true,
          message: 'Channel membership verified! You can claim your reward.'
        });
      } else {
        // Could not verify automatically, allow manual verification
        return callback({
          success: true,
          isMember: false,
          canClaim: true,
          message: 'Please confirm that you have joined the channel to claim your reward.',
          requiresManualVerification: true
        });
      }
    } catch (error) {
      console.error('Error checking channel membership:', error);
      callback({ success: false, error: 'Failed to check channel membership' });
    }
  }

  // Verify channel membership via Telegram Bot API
  async verifyChannelMembership(telegramId) {
    try {
      const botToken = process.env.BOT_TOKEN;
      const channelUsername = 'ludoremastered'; // The channel username without @
      
      if (!botToken) {
        console.log('⚠️ BOT_TOKEN not configured, skipping API verification');
        return false;
      }

      // Use Telegram Bot API to check if user is a member of the channel
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: `@${channelUsername}`,
          user_id: telegramId
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        // Check if user is a member (status: 'member', 'administrator', 'creator')
        const isMember = ['member', 'administrator', 'creator'].includes(data.result.status);
        console.log(`🔍 Channel membership check for ${telegramId}: ${isMember ? '✅ Member' : '❌ Not a member'}`);
        return isMember;
      } else {
        console.log(`⚠️ Telegram API error: ${data.description}`);
        
        // Provide specific guidance for common errors
        if (data.description.includes('member list is inaccessible')) {
          console.log('💡 Solution: Bot needs to be admin of the channel with "Get Chat Member" permission');
        } else if (data.description.includes('chat not found')) {
          console.log('💡 Solution: Check if channel username is correct');
        } else if (data.description.includes('bot was blocked')) {
          console.log('💡 Solution: Bot needs to be added to the channel');
        }
        
        return false;
      }
    } catch (error) {
      console.error('❌ Error verifying channel membership:', error);
      return false;
    }
  }
}

module.exports = TasksHandler;
