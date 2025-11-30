const mongoose = require('mongoose');
const EventEmitter = require('events');

// Create an event emitter for database connection events
const dbEvents = new EventEmitter();

// Monitor connection state changes
mongoose.connection.on('connected', () => {
  console.log('🔗 MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  // Don't emit error event if it's a connection refused error
  if (err.code !== 'ECONNREFUSED') {
    dbEvents.emit('error', err);
  }
});

mongoose.connection.on('disconnected', () => {
  // Silent disconnect handling
});

mongoose.connection.on('reconnected', () => {
  // Silent reconnection handling
});

// Advanced connection pooling configuration for 1M+ users
const connectionOptions = {
  // Connection Pool Settings
  maxPoolSize: 100,           // Maximum connections in pool (increased for high load)
  minPoolSize: 20,            // Minimum connections to keep ready
  maxIdleTimeMS: 30000,       // Close idle connections after 30s
  waitQueueTimeoutMS: 10000,  // Wait up to 10s for available connection
  
  // Connection Timeouts
  serverSelectionTimeoutMS: 5000,  // Fast server selection
  socketTimeoutMS: 45000,          // Socket timeout
  connectTimeoutMS: 10000,         // Connection establishment timeout
  
  // Write Concerns & Reliability
  w: 'majority',              // Wait for majority of replicas
  wtimeoutMS: 10000,          // Write timeout
  journal: true,               // Wait for journal commit
  
  // Read Preferences for Scaling
  readPreference: 'secondaryPreferred',  // Read from secondary when possible
  readConcern: { level: 'majority' },   // Read committed data
  
  // Retry Settings
  retryWrites: true,
  retryReads: true,
  
  // SSL & Security
  tls: process.env.MONGODB_SSL === 'true',
  
  // Compression
  compressors: ['zlib'],
  zlibCompressionLevel: 6,
  
  // Performance Optimizations
  bufferCommands: false,      // Disable command buffering
  
  // Monitoring
  monitorCommands: process.env.NODE_ENV === 'development',
  
  // Heartbeat
  heartbeatFrequencyMS: 10000,  // Heartbeat every 10s
  
  // Connection String Options
  directConnection: false,     // Use replica set discovery
  replicaSet: process.env.MONGODB_REPLICA_SET || undefined,
  
  // Authentication - will be handled by connection string if needed
};

// Connection pool monitoring and management
class ConnectionPoolManager {
  constructor() {
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingConnections: 0,
      connectionErrors: 0,
      lastHealthCheck: null
    };
    
    this.healthCheckInterval = null;
    this.connectionAlerts = [];
  }

  startMonitoring() {
    if (this.healthCheckInterval) return;
    
    this.healthCheckInterval = setInterval(() => {
      this.checkPoolHealth();
    }, 30000); // Every 30 seconds
  }

  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  checkPoolHealth() {
    try {
      const pool = mongoose.connection.pool;
      if (!pool) return;

      this.stats.totalConnections = pool.size;
      this.stats.activeConnections = pool.activeCount;
      this.stats.idleConnections = pool.size - pool.activeCount;
      this.stats.pendingConnections = pool.pendingCount;
      this.stats.lastHealthCheck = new Date();

      // Alert on high connection usage
      const usagePercent = (pool.activeCount / pool.maxSize) * 100;
      if (usagePercent > 80) {
        this.connectionAlerts.push({
          timestamp: new Date(),
          message: `High connection pool usage: ${usagePercent.toFixed(1)}%`,
          level: 'warning'
        });
      }

      // Alert on connection errors
      if (this.stats.connectionErrors > 5) {
        this.connectionAlerts.push({
          timestamp: new Date(),
          message: `Multiple connection errors: ${this.stats.connectionErrors}`,
          level: 'error'
        });
      }

      // Keep only recent alerts
      this.connectionAlerts = this.connectionAlerts.filter(
        alert => Date.now() - alert.timestamp.getTime() < 300000 // 5 minutes
      );

    } catch (error) {
      console.error('❌ Error checking pool health:', error);
    }
  }

  getStats() {
    return { ...this.stats };
  }

  getAlerts() {
    return [...this.connectionAlerts];
  }
}

// Create pool manager instance
const poolManager = new ConnectionPoolManager();

// Function to connect to MongoDB - this will be called explicitly
async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    // Silent connection check
    return mongoose.connection;
  }

  if (!process.env.CONNECTION_URI) {
    throw new Error('CONNECTION_URI environment variable is not set');
  }

  try {
    await mongoose.connect(process.env.CONNECTION_URI, connectionOptions);
    console.log('✅ MongoDB connected via database.js');
    
    // Safely access connection pool info
    const pool = mongoose.connection.pool;
    if (pool) {
      // Silent pool status check
    } else {
      // Silent pool info not available
    }
    
    // Start pool monitoring
    poolManager.startMonitoring();
    
    // Create performance indexes silently
    try {
      // User Collection Indexes
      // Primary user lookup index
      await mongoose.connection.db.collection('users').createIndex(
        { "telegramId": 1 },
        { unique: true, background: true, name: "telegramId_unique" }
      );
      
      // Leaderboard and ranking indexes
      await mongoose.connection.db.collection('users').createIndex(
        { "rank_points": -1, "total_games_played": -1 },
        { background: true, name: "rank_points_games_played" }
      );
      
      await mongoose.connection.db.collection('users').createIndex(
        { "total_games_won": -1, "total_games_played": -1 },
        { background: true, name: "win_rate_performance" }
      );
      
      // Referral system indexes
      await mongoose.connection.db.collection('users').createIndex(
        { "referralCode": 1 },
        { unique: true, sparse: true, background: true, name: "referralCode_unique" }
      );
      
      await mongoose.connection.db.collection('users').createIndex(
        { "referredBy": 1 },
        { background: true, name: "referredBy_lookup" }
      );
      
      // User activity indexes
      await mongoose.connection.db.collection('users').createIndex(
        { "lastActive": -1 },
        { background: true, name: "lastActive_sorting" }
      );
      
      await mongoose.connection.db.collection('users').createIndex(
        { "created_at": -1 },
        { background: true, name: "user_creation_date" }
      );
      
      // Room Collection Indexes
      // Room status and activity indexes
      await mongoose.connection.db.collection('rooms').createIndex(
        { "status": 1, "created_at": -1 },
        { background: true, name: "room_status_creation" }
      );
      
      await mongoose.connection.db.collection('rooms').createIndex(
        { "player_count": 1, "status": 1 },
        { background: true, name: "room_player_count_status" }
      );
      
      await mongoose.connection.db.collection('rooms').createIndex(
        { "lastActivity": 1 },
        { background: true, name: "room_last_activity" }
      );
      
      // Room search and filtering indexes
      await mongoose.connection.db.collection('rooms').createIndex(
        { "gameType": 1, "status": 1 },
        { background: true, name: "room_game_type_status" }
      );
      
      await mongoose.connection.db.collection('rooms').createIndex(
        { "isPrivate": 1, "status": 1 },
        { background: true, name: "room_privacy_status" }
      );
      
      // Game Room Collection Indexes
      // GameRoom indexes
      await mongoose.connection.db.collection('gameroms').createIndex(
        { "roomId": 1, "status": 1 },
        { background: true, name: "gamerom_room_status" }
      );
      
      await mongoose.connection.db.collection('gameroms').createIndex(
        { "created_at": 1 },
        { background: true, name: "gamerom_creation_date" }
      );
      
      await mongoose.connection.db.collection('gameroms').createIndex(
        { "gameStatus": 1, "lastMove": -1 },
        { background: true, name: "gamerom_status_lastmove" }
      );
      
      // Mining Session Indexes
      // Mining Session indexes
      await mongoose.connection.db.collection('miningsessions').createIndex(
        { "roomId": 1, "playerId": 1 },
        { background: true, name: "mining_room_player" }
      );
      
      await mongoose.connection.db.collection('miningsessions').createIndex(
        { "startTime": 1 },
        { background: true, name: "mining_start_time" }
      );
      
      await mongoose.connection.db.collection('miningsessions').createIndex(
        { "status": 1, "lastActivity": -1 },
        { background: true, name: "mining_status_activity" }
      );
      
      // Chat and Messages Indexes
      // Chat and Messages indexes
      try {
        await mongoose.connection.db.collection('chatmessages').createIndex(
          { "roomId": 1, "timestamp": -1 },
          { background: true, name: "chat_room_timestamp" }
        );
        
        await mongoose.connection.db.collection('chatmessages').createIndex(
          { "senderId": 1, "timestamp": -1 },
          { background: true, name: "chat_sender_timestamp" }
        );
      } catch (error) {
        console.log('ℹ️ Chat collection not found, skipping chat indexes');
      }
      
      // Payment and Transactions Indexes
      // Payment and Transactions indexes
      try {
        await mongoose.connection.db.collection('payments').createIndex(
          { "userId": 1, "status": 1 },
          { background: true, name: "payment_user_status" }
        );
        
        await mongoose.connection.db.collection('payments').createIndex(
          { "created_at": -1 },
          { background: true, name: "payment_creation_date" }
        );
        
        await mongoose.connection.db.collection('payments').createIndex(
          { "transactionId": 1 },
          { unique: true, background: true, name: "payment_transaction_unique" }
        );
      } catch (error) {
        console.log('ℹ️ Payments collection not found, skipping payment indexes');
      }
      
      // Statistics and Analytics Indexes
      // Statistics and Analytics indexes
      try {
        await mongoose.connection.db.collection('gamestats').createIndex(
          { "date": -1 },
          { background: true, name: "gamestats_date" }
        );
        
        await mongoose.connection.db.collection('gamestats').createIndex(
          { "gameType": 1, "date": -1 },
          { background: true, name: "gamestats_type_date" }
        );
      } catch (error) {
        console.log('ℹ️ GameStats collection not found, skipping stats indexes');
      }
      
      // Compound Indexes for Complex Queries
      // Compound indexes
      await mongoose.connection.db.collection('users').createIndex(
        { "username": 1, "rank_points": -1, "total_games_played": -1 },
        { background: true, name: "user_search_ranking" }
      );
      
      await mongoose.connection.db.collection('rooms').createIndex(
        { "status": 1, "gameType": 1, "player_count": 1, "created_at": -1 },
        { background: true, name: "room_search_comprehensive" }
      );
      
      await mongoose.connection.db.collection('gameroms').createIndex(
        { "gameStatus": 1, "roomId": 1, "lastMove": -1 },
        { background: true, name: "game_performance_lookup" }
      );
      
      // Silent index creation completion
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
    }
    
    // Log index statistics
    await logIndexStatistics();
    
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    dbEvents.emit('error', err);
    throw err;
  }
}

// Create performance indexes for better query performance
async function createPerformanceIndexes() {
  try {
    console.log('🔍 Creating comprehensive performance indexes...');
    
    const collections = ['users', 'rooms', 'gameroms', 'miningsessions'];
    
    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const indexStats = await collection.stats();
        
        if (indexStats.indexDetails) {
          console.log(`\n📊 ${collectionName} Index Analysis:`);
          
          for (const [indexName, details] of Object.entries(indexStats.indexDetails)) {
            const usage = details.accesses ? details.accesses.ops : 0;
            const size = details.size || 0;
            
            console.log(`  - ${indexName}: ${usage} accesses, ${Math.round(size / 1024)}KB`);
            
            // Recommend removing unused indexes
            if (usage < 10 && indexName !== '_id_') {
              console.log(`    ⚠️ Consider removing unused index: ${indexName}`);
            }
          }
        }
      } catch (error) {
        console.log(`ℹ️ Collection ${collectionName} not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error analyzing indexes:', error);
  }
}

// Log index statistics for monitoring
async function logIndexStatistics() {
  try {
    const collections = ['users', 'rooms', 'gameroms', 'miningsessions'];
    
    for (const collectionName of collections) {
      try {
        const stats = await mongoose.connection.db.collection(collectionName).stats();
        // Silent index stats
      } catch (error) {
        // Silent collection not found
      }
    }
  } catch (error) {
    console.error('❌ Error logging index statistics:', error);
  }
}

// Function to analyze and optimize existing indexes
async function analyzeAndOptimizeIndexes() {
  try {
    console.log('🔍 Analyzing existing indexes for optimization...');
    
    const collections = ['users', 'rooms', 'gameroms', 'miningsessions'];
    
    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const indexStats = await collection.stats();
        
        if (indexStats.indexDetails) {
          console.log(`\n📊 ${collectionName} Index Analysis:`);
          
          for (const [indexName, details] of Object.entries(indexStats.indexDetails)) {
            const usage = details.accesses ? details.accesses.ops : 0;
            const size = details.size || 0;
            
            console.log(`  - ${indexName}: ${usage} accesses, ${Math.round(size / 1024)}KB`);
            
            // Recommend removing unused indexes
            if (usage < 10 && indexName !== '_id_') {
              console.log(`    ⚠️ Consider removing unused index: ${indexName}`);
            }
          }
        }
      } catch (error) {
        console.log(`ℹ️ Collection ${collectionName} not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error analyzing indexes:', error);
  }
}

// Function to create indexes for new collections
async function createIndexesForCollection(collectionName, indexSpecs) {
  try {
    console.log(`🔍 Creating indexes for collection: ${collectionName}`);
    
    for (const spec of indexSpecs) {
      await mongoose.connection.db.collection(collectionName).createIndex(
        spec.fields,
        { ...spec.options, background: true }
      );
      console.log(`  ✅ Created index: ${spec.name}`);
    }
    
  } catch (error) {
    console.error(`❌ Error creating indexes for ${collectionName}:`, error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    poolManager.stopMonitoring();
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during MongoDB shutdown:', err);
    process.exit(1);
  }
});

// Export both mongoose and the event emitter
module.exports = mongoose;
module.exports.dbEvents = dbEvents;
module.exports.connectionOptions = connectionOptions;
module.exports.createPerformanceIndexes = createPerformanceIndexes;
module.exports.poolManager = poolManager;
module.exports.analyzeAndOptimizeIndexes = analyzeAndOptimizeIndexes;
module.exports.createIndexesForCollection = createIndexesForCollection;
module.exports.logIndexStatistics = logIndexStatistics;
module.exports.connectToDatabase = connectToDatabase;
