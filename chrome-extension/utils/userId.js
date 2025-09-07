// User ID management utility
class LanchDrapUserIdManager {
  constructor() {
    this.storageKey = 'lanchdrap_user_id';
    this.userId = null;
  }

  // Generate a unique user ID
  generateUserId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const userAgent = navigator.userAgent.substring(0, 10);
    return `user_${timestamp}_${random}_${userAgent}`;
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
        this.userId = result[this.storageKey];
        return this.userId;
      }

      // Generate new user ID if none exists
      this.userId = this.generateUserId();

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
