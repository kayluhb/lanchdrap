// User ID management utility
class LanchDrapUserIdManager {
  constructor() {
    this.storageKey = 'lanchdrap_user_id';
    this.userId = null;
  }

  // Generate a unique user ID
  generateUserId() {
    return Math.random().toString(36).substring(2, 15);
  }

  // Check if user ID is in old format and needs migration
  isOldFormatUserId(userId) {
    // Old format: user:user_1757167705474_07ap9dr3ewzr_Mozilla/5.
    // New format: simple random string like abc123def456
    return (
      userId &&
      (userId.startsWith('user:user_') ||
        userId.includes('Mozilla') ||
        (userId.includes('_') && userId.length > 20))
    );
  }

  // Get or create user ID
  async getUserId() {
    if (this.userId) {
      return this.userId;
    }

    try {
      // Try to get existing user ID from storage
      const result = await chrome.storage.local.get([this.storageKey]);
      if (result[this.storageKey]) {
        const storedUserId = result[this.storageKey];

        // Check if it's an old format user ID that needs migration
        if (this.isOldFormatUserId(storedUserId)) {
          console.info('LanchDrap: Migrating old format user ID to new format', {
            oldId: `${storedUserId.substring(0, 30)}...`,
            newId: this.generateUserId(),
          });
          // Generate new user ID and replace the old one
          this.userId = this.generateUserId();
          await chrome.storage.local.set({ [this.storageKey]: this.userId });
          return this.userId;
        }

        this.userId = storedUserId;
        return this.userId;
      }

      // Generate new user ID if none exists
      this.userId = this.generateUserId();
      console.info('LanchDrap: Generated new user ID', this.userId);

      // Store the new user ID
      await chrome.storage.local.set({ [this.storageKey]: this.userId });
      return this.userId;
    } catch (_error) {
      // Fallback to generated ID without storage
      this.userId = this.generateUserId();
      return this.userId;
    }
  }

  // Get user fingerprint for additional identification
  getUserFingerprint() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorDepth: screen.colorDepth,
    };
  }

  // Get complete user identification data
  async getUserIdentification() {
    const userId = await this.getUserId();
    const fingerprint = this.getUserFingerprint();

    return {
      userId,
      fingerprint,
      timestamp: new Date().toISOString(),
    };
  }
}

// Create singleton instance
const lanchDrapUserIdManager = new LanchDrapUserIdManager();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LanchDrapUserIdManager, lanchDrapUserIdManager };
} else {
  // Browser environment - ensure global variables are set
  window.lanchDrapUserIdManager = lanchDrapUserIdManager;
  window.LanchDrapUserIdManager = { LanchDrapUserIdManager, lanchDrapUserIdManager };

  // Also set on global scope for content scripts
  if (typeof globalThis !== 'undefined') {
    globalThis.lanchDrapUserIdManager = lanchDrapUserIdManager;
    globalThis.LanchDrapUserIdManager = { LanchDrapUserIdManager, lanchDrapUserIdManager };
  }
}
