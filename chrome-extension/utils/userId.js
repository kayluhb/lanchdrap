// User ID management utility
class LanchDrapUserIdManager {
  constructor() {
    this.storageKey = 'lanchdrap_user_id';
    this.userId = null;
  }

  // Extract user ID from Lunchdrop page
  getLunchdropUserId() {
    try {
      // First try window.user.id (if available)
      if (typeof window !== 'undefined' && window.user && window.user.id) {
        return window.user.id;
      }

      // Try to extract from app data
      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          try {
            const pageData = JSON.parse(appElement.dataset.page);

            // Look for userId in orders
            if (pageData.props?.delivery?.orders) {
              const orders = pageData.props.delivery.orders;
              if (orders.length > 0 && orders[0].userId) {
                return orders[0].userId;
              }
            }
          } catch {
            // Silently fail if we can't parse the data
          }
        }
      }

      // Fallback: try window.user.id again (in case it loaded asynchronously)
      if (typeof window !== 'undefined' && window.user && window.user.id) {
        return window.user.id;
      }

      return null;
    } catch {
      // Silently fail if we can't extract the user ID
      return null;
    }
  }

  // Get user ID from Lunchdrop page or storage
  async getUserId() {
    if (this.userId) {
      return this.userId;
    }

    try {
      // Get the Lunchdrop user ID from the page
      const lunchdropUserId = this.getLunchdropUserId();

      if (lunchdropUserId) {
        // Use the Lunchdrop user ID and store it for future use
        this.userId = lunchdropUserId;
        await chrome.storage.local.set({ [this.storageKey]: this.userId });
        return this.userId;
      }

      // If no Lunchdrop user ID found, try to get existing user ID from storage
      const result = await chrome.storage.local.get([this.storageKey]);

      if (result[this.storageKey]) {
        this.userId = result[this.storageKey];
        return this.userId;
      }

      // If no user ID found anywhere, this is an error
      throw new Error('No user ID available from Lunchdrop page or storage');
    } catch (error) {
      throw error;
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
