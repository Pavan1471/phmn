require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const http = require('http');
const path = require('path');
const socketManager = require('./socket/socketManager');
const mongoose = require('./config/database'); // exports connected mongoose instance
const { connectToDatabase } = require('./config/database'); // Get the connect function
const User = require('./models/user');
const { saveUserData, getUserProfile, searchUsers, getMiningStats } = require('./handlers/userHandler');

// Import socket configuration
const configureSocket = require('./config/socket');

// Telegram Bot Setup
const TelegramBot = require('node-telegram-bot-api');

const app = express();

app.use(require('cors')({
  origin: [process.env.GAME_URL],
  credentials: true
}));
app.use(express.json()); // Add JSON body parsing
app.use(express.static('build', {
  maxAge: '0',
  etag: false,
}));

// Basic API routes for testing
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Airdrop Mining Game Server is running' });
});

// Get Adsgram Block ID
app.get('/api/adsgram/blockId', (req, res) => {
  const blockId = process.env.ADSGRAM_BLOCK_ID || null;
  res.json({
    success: !!blockId,
    blockId: blockId,
    message: blockId ? 'Block ID available' : 'Block ID not configured'
  });
});

app.post('/api/user/save', async (req, res) => {
  try {
    const user = await saveUserData(req.body);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const user = await getUserProfile(req.params.telegramId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users/search', async (req, res) => {
  try {
    const { searchTerm, excludeTelegramId } = req.query;
    if (!searchTerm) {
      return res.status(400).json({ success: false, error: 'Search term is required' });
    }

    const users = await searchUsers(searchTerm, excludeTelegramId);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/mining/stats/:telegramId', async (req, res) => {
  try {
    const stats = await getMiningStats(req.params.telegramId);
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get leaderboard data
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Get top 100 players by PHMN
    const topPlayers = await User.find({})
      .sort({ PHMN: -1 })
      .limit(100)
      .select('telegramId username first_name last_name profile_picture PHMN')
      .lean();

    // Process players - simple list sorted by PHMN
    const processedPlayers = topPlayers.map(player => ({
      ...player,
      PHMN: player.PHMN || 0
    }));

    const responseData = {
      success: true,
      leaderboard: {
        totalPlayers: processedPlayers.length,
        players: processedPlayers,
        lastUpdated: new Date().toISOString()
      }
    };

    res.json(responseData);
  } catch (error) {
    console.error('❌ Error in leaderboard endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    endpoints: ['/api/health', '/api/leaderboard', '/api/test']
  });
});

// Serve React app for all non-API routes
app.get(/^\/(?!api|socket\.io).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO through socketManager and configure handlers
socketManager.initialize(server);
configureSocket(server);

// Start server only once
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`🎯 Server running on port ${PORT}`);
});

// Connect to MongoDB
(async () => {
  try {
    await connectToDatabase();
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    // Don't exit the process, continue without database
    console.log('⚠️ Server will continue running without database connection');
  }
})();

// Initialize Telegram Bot
const botToken = process.env.BOT_TOKEN;
const botUsername = process.env.BOT_USERNAME;
const gameUrl = process.env.TG_GAME_URL;
const enableMiniApp = process.env.ENABLE_MINI_APP === 'true';
const referralCodeStore = new Map();
const miniAppEnabled = enableMiniApp && !!gameUrl;

if (enableMiniApp && !gameUrl) {
  console.warn('⚠️ ENABLE_MINI_APP is true but GAME_URL is not set. Mini App buttons will be disabled until GAME_URL is configured.');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports.referralCodeStore = referralCodeStore;
}

// Global variable for the bot instance to be used by reminder task
let telegramBotInstance = null;

const ensureGameUrlConfigured = async (chatId, bot) => {
  if (gameUrl) return true;
  await bot.sendMessage(chatId, '⚠️ The game link is not configured yet. Please try again later.');
  return false;
};

const buildLaunchButton = (text, referralCode) => {
  const targetUrl = referralCode ? `${gameUrl}?start=${referralCode}` : gameUrl;
  if (miniAppEnabled) {
    return { text, web_app: { url: targetUrl } };
  }
  return { text, url: targetUrl };
};

// Mining Session Reminder (runs every 5 minutes)
const runMiningReminder = async () => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    if (!telegramBotInstance) return;

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const usersToRemind = await User.find({
      miningSessionEndTime: { $lt: now, $gt: twentyFourHoursAgo },
      $or: [
         { miningSessionReminderSent: false },
         { miningSessionReminderSent: { $exists: false } }
      ]
    }).limit(50);

    if (usersToRemind.length > 0) {
      console.log(`⏰ Found ${usersToRemind.length} users to remind about mining completion`);
    }

    for (const user of usersToRemind) {
      try {
        const keyboard = {
          inline_keyboard: [[ buildLaunchButton('🎮 Start Mining') ]]
        };
        const chatId = user.telegramId.toString();
        await telegramBotInstance.sendMessage(chatId, 
          "⛏️ *Mining Completed!* ⛏️\n\nYour mining session has finished and your rewards are ready to claim! 💰\n\nStart a new session now to keep earning PHMN! 🚀", 
          { parse_mode: 'Markdown', reply_markup: keyboard }
        );
        user.miningSessionReminderSent = true;
        await user.save();
        console.log(`✅ Sent mining reminder to user ${user.telegramId}`);
      } catch (e) {
        if (e.response && (e.response.statusCode === 403 || e.response.statusCode === 400)) {
           user.miningSessionReminderSent = true;
           await user.save();
        } else {
           console.error(`❌ Failed to send reminder to user ${user.telegramId}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error in mining reminder cron:', err);
  }
};

if (!botToken || botToken === 'your_bot_token_here' || botToken === '') {
  console.log('⚠️ No valid BOT_TOKEN found - Telegram bot disabled');
} else {
  try {
    const bot = new TelegramBot(botToken, { polling: true });
    telegramBotInstance = bot;

    console.log('🤖 Telegram Bot starting...');
    console.log(`📱 Bot username: @${botUsername}`);
    console.log(`🎮 Game URL: ${gameUrl || 'not configured'}`);
    console.log(`📱 Mini App mode: ${miniAppEnabled ? 'Enabled' : 'Disabled'}`);

    const welcomeHelpText = `🎮 PHMN CHAD Game\n\n📱 Play and earn PHMN rewards!\n\n🎯 How to play:\n• Open the game via the button below\n• Start mining to earn PHMN every 12 hours\n• Complete tasks for extra rewards\n\n🎁 Referral System:\n• Share your link with friends\n• Earn PHMN for every active referral\n\n🎲 Features:\n• 12h Mining Cycle\n• Team Battles\n• Passive Income`;

    bot.onText(/\/help/, async (msg) => {
      bot.sendMessage(msg.chat.id, welcomeHelpText, {
        reply_markup: { inline_keyboard: [[buildLaunchButton('🎮 Open Game')]] }
      });
    });

    bot.onText(/\/testremind/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const user = await User.findOne({ telegramId: chatId });
        if (!user) return bot.sendMessage(chatId, "❌ User not found in database.");
        user.miningSessionEndTime = new Date(Date.now() - 1000);
        user.miningSessionReminderSent = false;
        await user.save();
        await bot.sendMessage(chatId, "🧪 Test mode activated! Reminder will arrive within 5 mins.");
      } catch (err) {
        bot.sendMessage(chatId, "❌ Error: " + err.message);
      }
    });

    if (miniAppEnabled) {
      bot.onText(/\/start(.+)?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const startParam = match ? match[1] : null;
        const referralCode = startParam && startParam.trim() ? startParam.trim() : null;
        if (!(await ensureGameUrlConfigured(chatId, bot))) return;

        if (referralCode) {
          referralCodeStore.set(chatId.toString(), {
            code: referralCode,
            timestamp: Date.now(),
            expiresAt: Date.now() + (60 * 60 * 1000)
          });
          bot.sendMessage(chatId, `🎮 Welcome!\n\nYou were invited!\n\nClick below to play:`, {
            reply_markup: { inline_keyboard: [[buildLaunchButton('🎮 Open Game', referralCode)]] }
          });
        } else {
          bot.sendMessage(chatId, `🎮 Welcome!\n\nClick below to play:`, {
            reply_markup: { inline_keyboard: [[buildLaunchButton('🎮 Open Game')]] }
          });
        }
      });
    } else {
      bot.onText(/\/start(.+)?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const startParam = match ? match[1] : null;
        const referralCode = startParam && startParam.trim() ? startParam.trim() : null;
        if (!(await ensureGameUrlConfigured(chatId, bot))) return;

        if (referralCode) {
          referralCodeStore.set(chatId.toString(), {
            code: referralCode,
            timestamp: Date.now(),
            expiresAt: Date.now() + (60 * 60 * 1000)
          });
          bot.sendMessage(chatId, `🎮 Welcome!\n\nYou were invited!\n\nClick below to play:`, {
            reply_markup: { inline_keyboard: [[buildLaunchButton('🎮 Play', referralCode)]] }
          });
        } else {
          bot.sendMessage(chatId, `🎮 Welcome!`, {
            reply_markup: { inline_keyboard: [[buildLaunchButton('🎮 Play')]] }
          });
        }
      });
    }

    // Interval tasks
    setInterval(() => {
      const now = Date.now();
      for (const [chatId, data] of referralCodeStore.entries()) {
        if (data.expiresAt < now) referralCodeStore.delete(chatId);
      }
    }, 30 * 60 * 1000);

    setTimeout(runMiningReminder, 45000); 
    setInterval(runMiningReminder, 5 * 60 * 1000);

    bot.on('error', (error) => { /* Handle error */ });
    bot.on('polling_error', (error) => { /* Handle polling error */ });

    console.log('✅ Telegram Bot is running!');
  } catch (error) {
    console.error('❌ Failed to initialize Telegram Bot:', error);
  }
}
