require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const http = require('http');
const path = require('path');
const socketManager = require('./socket/socketManager');
const mongoose = require('./config/database'); // exports connected mongoose instance
const { connectToDatabase } = require('./config/database'); // Get the connect function
const User = require('./models/user');
const { saveUserData, getUserProfile, searchUsers } = require('./handlers/userHandler');

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

if (!botToken || botToken === 'your_bot_token_here' || botToken === '') {
  console.log('⚠️ No valid BOT_TOKEN found - Telegram bot disabled');
  console.log('📝 Add your bot token to .env file to enable Telegram features');
} else {
  try {
    const bot = new TelegramBot(botToken, { polling: true });

    console.log('🤖 Telegram Bot starting...');
    console.log(`📱 Bot username: @${botUsername}`);
    console.log(`🎮 Game URL: ${gameUrl || 'not configured'}`);
    console.log(`📱 Mini App mode: ${miniAppEnabled ? 'Enabled' : 'Disabled'}`);

    const ensureGameUrlConfigured = async (chatId) => {
      if (gameUrl) {
        return true;
      }

      await bot.sendMessage(chatId, '⚠️ The game link is not configured yet. Please try again later.');
      return false;
    };

    const buildLaunchButton = (text, referralCode) => {
      const targetUrl = referralCode ? `${gameUrl}?start=${referralCode}` : gameUrl;
      if (miniAppEnabled) {
        return {
          text,
          web_app: { url: targetUrl }
        };
      }

      return {
        text,
        url: targetUrl
      };
    };

    if (miniAppEnabled) {
      // Mini App mode - simplified bot for referral links only
      bot.onText(/\/start(.+)?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const startParam = match ? match[1] : null;
        const referralCode = startParam && startParam.trim() ? startParam.trim() : null;

        if (!(await ensureGameUrlConfigured(chatId))) {
          return;
        }

        if (referralCode) {
          // Referral link - redirect to Mini App with referral code
          console.log(`🎯 Referral link accessed with code: ${referralCode}`);

          // Store the referral code for this user (valid for 1 hour)
          referralCodeStore.set(chatId.toString(), {
            code: referralCode,
            timestamp: Date.now(),
            expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
          });

          const welcomeText = `🎮 Welcome to  PHMN CHAD BOT!\n\n🎲 You were invited by a friend!\n\n🎁 Click the "Open Game" button below to start playing and earn rewards!\n\n💡 Tip: Use the button below for the best experience!`;
          const keyboard = {
            inline_keyboard: [[
              buildLaunchButton('🎮 Open Game', referralCode)
            ]]
          };

          await bot.sendMessage(chatId, welcomeText, {
            reply_markup: keyboard
          });
        } else {
          // Direct start - redirect to Mini App
          const welcomeText = `🎮 Welcome to PHMN CHAD BOT!\n\n🎁 Click below to start playing:`;

          const keyboard = {
            inline_keyboard: [[
              buildLaunchButton('🎮 Open Game')
            ]]
          };

          await bot.sendMessage(chatId, welcomeText, {
            reply_markup: keyboard
          });
        }
      });

      // Add help command for Mini App
      bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        const helpText = `🎮 Game Mini App\n\n📱 This is a Mini App that runs directly in Telegram!\n\n🎯 To play:\n• Open the Mini App from the menu\n• Or use /start to get the link\n\n🎁 Referral System:\n• Share your referral link with friends\n• Earn rewards when they join and play\n\n🎲 Features:\n• Play with friends\n• Bot games\n• Mining system\n• Referral rewards`;

        await bot.sendMessage(chatId, helpText);
      });

    } else {
      // Traditional bot mode (current implementation)
      bot.onText(/\/start(.+)?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const startParam = match ? match[1] : null;
        const referralCode = startParam && startParam.trim() ? startParam.trim() : null;

        if (!(await ensureGameUrlConfigured(chatId))) {
          return;
        }

        // Check if this is a referral link
        if (referralCode) {
          console.log(`🎯 Referral link accessed with code: ${referralCode}`);

          // Store the referral code for this user (valid for 1 hour)
          referralCodeStore.set(chatId.toString(), {
            code: referralCode,
            timestamp: Date.now(),
            expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
          });

          // Welcome message for referral
          const welcomeText = `🎮 Welcome to PHMN CHAD BOT!\n\n🎲 You were invited by a friend!\n\n🎁 Click the "Play" button below to start playing and earn rewards!\n\n💡 Tip: Use the button below for the best experience!`;

          const keyboard = {
            inline_keyboard: [[
              buildLaunchButton('🎮 Play', referralCode)
            ]]
          };

          await bot.sendMessage(chatId, welcomeText, {
            reply_markup: keyboard
          });
        } else {
          // Normal start without referral
          const welcomeText = `🎮 Welcome to PHMN CHAD BOT!`;

          const keyboard = {
            inline_keyboard: [[
              buildLaunchButton('🎮 Play')
            ]]
          };

          await bot.sendMessage(chatId, welcomeText, {
            reply_markup: keyboard
          });
        }
      });

      // Debug command to test reminder immediately
      bot.onText(/\/testremind/, async (msg) => {
        const chatId = msg.chat.id;
        try {
          const user = await User.findOne({ telegramId: chatId });
          if (!user) {
            return bot.sendMessage(chatId, "❌ You are not registered in the game database yet. Open the game first!");
          }

          // Force completion state for testing
          user.miningSessionEndTime = new Date(Date.now() - 1000); // 1 second ago
          user.miningSessionReminderSent = false;
          await user.save();

          await bot.sendMessage(chatId, "🧪 Test mode activated! Your mining session has been marked as 'Completed' and reminder reset. The reminder cron runs every 5 minutes.");
          console.log(`🧪 User ${chatId} triggered /testremind`);
        } catch (err) {
          bot.sendMessage(chatId, "❌ Error triggering test: " + err.message);
        }
      });
    }

    // Clean up expired referral codes every 30 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [chatId, data] of referralCodeStore.entries()) {
        if (data.expiresAt < now) {
          referralCodeStore.delete(chatId);
        }
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Mining Session Reminder (runs every 5 minutes)
    setInterval(async () => {
      try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Debug: Log heartbeat
        // console.log(`[${now.toISOString()}] 🔍 Reminder Cron: Checking for completed sessions...`);

        // Find users with completed mining session (endTime < now) who haven't been reminded
        // Only check sessions ended within last 24 hours to avoid spamming inactive users
        const usersToRemind = await User.find({
          miningSessionEndTime: { $lt: now, $gt: twentyFourHoursAgo }, // Completed recently
          $or: [
             { miningSessionReminderSent: false },
             { miningSessionReminderSent: { $exists: false } }
          ]
        }).limit(50); // Process in batches

        if (usersToRemind.length > 0) {
          console.log(`⏰ Found ${usersToRemind.length} users to remind about mining completion`);
        }

        for (const user of usersToRemind) {
          try {
            // Always include a keyboard with a launch button
            const keyboard = {
              inline_keyboard: [[
                buildLaunchButton('🎮 Start Mining') // No referral code needed for self-start
              ]]
            };

            const chatId = user.telegramId.toString();
            await bot.sendMessage(chatId, 
              "⛏️ *Mining Completed!* ⛏️\n\nYour mining session has finished and your rewards are ready to claim! 💰\n\nStart a new session now to keep earning PHMN! 🚀", 
              {
                parse_mode: 'Markdown',
                reply_markup: keyboard
              }
            );
            
            user.miningSessionReminderSent = true;
            await user.save();
            console.log(`✅ Sent mining reminder to user ${user.telegramId}`);
          } catch (e) {
            console.error(`❌ Failed to send reminder to user ${user.telegramId}:`, e.message);
            // If bot is blocked or user not found, mark as sent to avoid infinite retries
            // 403: Forbidden (user blocked bot), 400: Bad Request (generic error or invalid id)
            if (e.response && (e.response.statusCode === 403 || e.response.statusCode === 400)) {
               console.log(`⚠️ Marking reminder as sent for blocked/invalid user ${user.telegramId}`);
               user.miningSessionReminderSent = true;
               await user.save();
            }
          }
        }
      } catch (err) {
        console.error('❌ Error in mining reminder cron:', err);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Handle errors (suppressed for development)
    bot.on('error', (error) => {
      // console.error('❌ Bot error:', error);
    });

    bot.on('polling_error', (error) => {
      // console.error('❌ Polling error:', error);
    });

    console.log('✅ Telegram Bot is running!');
    if (miniAppEnabled) {
      console.log('📱 Mini App mode enabled - users can access directly via Mini App');
    }

  } catch (error) {
    console.error('❌ Failed to initialize Telegram Bot:', error);
  }
}
