const mongoose = require('../config/database');

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  publicId: { type: String, unique: true, sparse: true }, // Public-friendly unique ID
  username: String,
  first_name: String,
  last_name: String,
  profile_picture: String, // Telegram profile picture URL
  score: { type: Number, default: 0 },
  
  // Referral system fields
  referralCode: { type: String, unique: true, sparse: true }, // Unique referral code for this user
  referredBy: { type: Number, ref: 'User' }, // Who referred this user
  referrals: [{ type: Number, ref: 'User' }], // Array of users referred by this user
  totalReferrals: { type: Number, default: 0 }, // Total count of successful referrals
  totalReferralEarnings: { type: Number, default: 0 }, // Total Gold Pieces earned from referrals
  referralRewardsClaimed: [{ type: Number }], // Array of referral IDs for which rewards were claimed
  referralHistory: [{ // History of referral rewards and milestones
    type: { type: String, enum: ['milestone', 'first_game'] }, // Type of reward
    referralId: { type: Number }, // ID of the referred user
    reward: { type: Number }, // Amount of Gold Pieces earned
    milestone: { type: Number }, // Milestone number (for milestone rewards)
    timestamp: { type: Date, default: Date.now } // When the reward was earned
  }],
  

  // Game-based mining fields
  total_mined_pieces: { type: Number, default: 0 },
  current_game_mined: { type: Number, default: 0 },
  last_game_session: { type: String, default: null }, // roomId of last game
  mining_start_time: { type: Date, default: null },
  // Premium mining plan
  mining_premium_plan_level: { type: Number, default: 0 }, // 0 = none, 1..6 plans
  mining_boost_multiplier: { type: Number, default: 1 }, // applied to mining rate
  purchased_plans: [Number], // Array of plan levels purchased
  // TON payment history
  ton_transactions: [
    {
      planLevel: { type: Number, required: true },
      amount: { type: Number, required: true }, // TON amount paid
      transactionHash: { type: String, required: true },
      purchasedAt: { type: Date, default: Date.now }
    }
  ],
  
  // PHMN 
  PHMN: { type: Number, default: 0 },
  
  // 8-hour mining(Play.js)
  miningSessionStartTime: { type: Date, default: null }, // When the current 8-hour session started
  miningSessionEndTime: { type: Date, default: null }, // When the current 8-hour session ends (startTime + 8 hours)
  miningSessionPendingRewards: { type: Number, default: 0 }, // earned but not yet claimed
  miningLevel: { type: Number, default: 1 }, // Mining level (1, 5, 10, 15, 20, 25, 30, 50)
  miningRate: { type: Number, default: 0.00463 }, // per hour (calculated from mining level)
  timezone: { type: String, default: null }, // User's timezone (e.g., "America/New_York", "Europe/London")
  
  // Adsgram integration - track ads watched per cycle
  adsWatchedForCycle: { type: Number, default: 0 }, // Number of ads watched for current cycle (0-1)
  lastCycleWithAds: { type: Number, default: null }, // Last cycle number where ads were watched (1, 2, or 3)
  
  // Mining Boost System (Turbo 2x, Super 4x, Ultimate 6x)
  activeBoost: {
    mode: { type: String, enum: ['turbo', 'super', 'ultimate'], default: null }, // Boost type
    multiplier: { type: Number, default: 1 }, // Applied multiplier (2x, 4x, or 6x)
    startTime: { type: Date, default: null }, // When boost was activated
    endTime: { type: Date, default: null }, // When boost expires
    duration: { type: String, enum: ['day', 'week', 'month'], default: null }, // Duration type
    tonAmount: { type: Number, default: 0 }, // TON paid for boost
    usdAmount: { type: Number, default: 0 }, // USD equivalent
    transactionHash: { type: String, default: null } // TON transaction hash
  },
  boostHistory: [{ // History of all boost purchases
    mode: { type: String, enum: ['turbo', 'super', 'ultimate'] },
    multiplier: { type: Number },
    duration: { type: String },
    tonAmount: { type: Number },
    usdAmount: { type: Number },
    transactionHash: { type: String },
    startTime: { type: Date },
    endTime: { type: Date },
    purchasedAt: { type: Date, default: Date.now }
  }],

  // TON wallet integration
  walletAddress: { type: String, default: null }, // User's TON wallet address
  
  // Friends functionality
  friends: [{ type: Number, ref: 'User' }], // Array of telegram IDs
  friend_requests: [{ type: Number, ref: 'User' }], // Pending friend requests

  // Task completion fields
  lastDailyReward: { type: Date, default: null }, // Last time daily reward was claimed
  lastBoostRateTaskClaimed: { type: Date, default: null }, // Last time boost mining rate task was claimed
  lastExtendTimeTaskClaimed: { type: Date, default: null }, // Last time extend mining time task was claimed
  miningRateBoostFromAds: { type: Number, default: 0 }, // Cumulative mining rate boost from ads (e.g., 0.002 = 0.2%)
  miningTimeExtended: { type: Number, default: 0 }, // Cumulative mining time extended in hours from ads
  gamesPlayed: { type: Number, default: 0 }, // Total games played
  miningStreak: { type: Number, default: 0 }, // Consecutive days of mining
  lastMiningDate: { type: Date, default: null }, // Last date user mined (for streak tracking)
  channelJoinedRewardClaimed: { type: Boolean, default: false }, // Whether channel join reward was claimed
  xFollowRewardClaimed: { type: Boolean, default: false }, // Whether X follow reward was claimed
  youtubeSubscribeRewardClaimed: { type: Boolean, default: false }, // Whether YouTube subscribe reward was claimed
  discordJoinedRewardClaimed: { type: Boolean, default: false }, // Whether Discord join reward was claimed
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Update the updated_at field before saving
userSchema.pre('save', function(next) {
  this.updated_at = Date.now();

  
  next();
});

// Generate unique referral code and public ID before saving
userSchema.pre('save', async function(next) {
  if (!this.referralCode) {
    this.referralCode = await this.generateReferralCode();
  }
  if (!this.publicId) {
    this.publicId = await this.generatePublicId();
  }
  next();
});

// Method to generate unique referral code
userSchema.methods.generateReferralCode = async function() {
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = generateCode();
    const existingUser = await this.constructor.findOne({ referralCode: code });
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique referral code');
  }

  return code;
};

// Method to generate unique public ID
userSchema.methods.generatePublicId = async function() {
  const crypto = require('crypto');
  
  const generateId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomBytes = crypto.randomBytes(6);
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  };

  let publicId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    publicId = generateId();
    const existingUser = await this.constructor.findOne({ publicId: publicId });
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique public ID');
  }

  return publicId;
};

module.exports = mongoose.model('User', userSchema);
