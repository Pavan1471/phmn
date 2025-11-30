/**
 * Adsgram Service
 * Handles Adsgram ad integration for mining cycles
 */

class AdsgramService {
  constructor() {
    this.adController = null;
    this.isInitialized = false;
    this.blockId = null;
  }

  /**
   * Initialize Adsgram with block ID
   * @param {string} blockId - The Adsgram block ID from environment
   * @param {boolean} debug - Enable debug mode (default: false)
   */
  init(blockId, debug = false) {
    if (!blockId) {
      console.error('❌ Adsgram: Block ID is required');
      return false;
    }

    if (typeof window === 'undefined' || !window.Adsgram) {
      console.error('❌ Adsgram: SDK not loaded. Make sure the script is included in index.html');
      return false;
    }

    try {
      this.blockId = blockId;
      this.adController = window.Adsgram.init({
        blockId: blockId,
        debug: debug
      });
      this.isInitialized = true;
      console.log('✅ Adsgram initialized successfully with block ID:', blockId);
      return true;
    } catch (error) {
      console.error('❌ Adsgram initialization error:', error);
      return false;
    }
  }

  /**
   * Show a single ad
   * @returns {Promise<{success: boolean, done: boolean, error?: string}>}
   */
  async showAd() {
    if (!this.isInitialized || !this.adController) {
      return {
        success: false,
        done: false,
        error: 'Adsgram not initialized'
      };
    }

    try {
      const result = await this.adController.show();
      return {
        success: true,
        done: result.done || false
      };
    } catch (error) {
      console.error('❌ Error showing ad:', error);
      return {
        success: false,
        done: false,
        error: error.message || 'Failed to show ad'
      };
    }
  }

  /**
   * Show multiple ads sequentially
   * @param {number} count - Number of ads to show (default: 2)
   * @param {function} onAdComplete - Callback when each ad completes (adNumber, result)
   * @returns {Promise<{success: boolean, watched: number, total: number}>}
   */
  async showAds(count = 2, onAdComplete = null) {
    if (!this.isInitialized || !this.adController) {
      return {
        success: false,
        watched: 0,
        total: count,
        error: 'Adsgram not initialized'
      };
    }

    let watched = 0;
    const results = [];

    for (let i = 0; i < count; i++) {
      try {
        console.log(`📺 Showing ad ${i + 1} of ${count}...`);
        const result = await this.showAd();
        
        results.push(result);
        
        if (result.done) {
          watched++;
          console.log(`✅ Ad ${i + 1} watched successfully`);
        } else {
          console.log(`⚠️ Ad ${i + 1} was skipped or not completed`);
        }

        // Call callback if provided
        if (onAdComplete) {
          onAdComplete(i + 1, result);
        }

        // Small delay between ads
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`❌ Error showing ad ${i + 1}:`, error);
        results.push({
          success: false,
          done: false,
          error: error.message
        });
      }
    }

    return {
      success: watched > 0,
      watched: watched,
      total: count,
      results: results
    };
  }

  /**
   * Add event listeners for ad events
   * @param {object} callbacks - Object with onReward, onError, onSkip callbacks
   */
  addEventListeners(callbacks = {}) {
    if (!this.isInitialized || !this.adController) {
      console.warn('⚠️ Adsgram not initialized, cannot add event listeners');
      return;
    }

    if (callbacks.onReward) {
      this.adController.addEventListener('onReward', callbacks.onReward);
    }

    if (callbacks.onError) {
      this.adController.addEventListener('onError', callbacks.onError);
    }

    if (callbacks.onSkip) {
      this.adController.addEventListener('onSkip', callbacks.onSkip);
    }
  }

  /**
   * Check if Adsgram is ready
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && this.adController !== null;
  }
}

// Export singleton instance
const adsgramService = new AdsgramService();
export default adsgramService;

