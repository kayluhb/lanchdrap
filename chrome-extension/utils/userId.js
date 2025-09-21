// User ID management utility
class LanchDrapUserIdManager {
  constructor() {
    this.storageKey = 'lanchdrap_user_id';
    this.userId = null;
  }

  // Extract restaurant ID from Lunchdrop page
  getLunchdropRestaurantId() {
    try {
      // Try to extract from app data
      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          try {
            const pageData = JSON.parse(appElement.dataset.page);
            console.log('LanchDrap: Full page data from app.dataset.page:', pageData);

            // Check if we're on a restaurant detail page with delivery data
            if (pageData.props?.delivery?.restaurant?.id) {
              const restaurantId = pageData.props.delivery.restaurant.id;
              console.log('LanchDrap: Found restaurant ID in delivery data:', restaurantId);
              console.log('LanchDrap: Restaurant name:', pageData.props.delivery.restaurant.name);
              return restaurantId;
            }

            // Check if we're on the day page with nextDeliveries
            if (pageData.props?.lunchDay?.nextDeliveries) {
              console.log(
                'LanchDrap: On day page - nextDeliveries available:',
                pageData.props.lunchDay.nextDeliveries
              );
              // On day page, we don't have a specific restaurant selected
              return null;
            }

            console.log('LanchDrap: No restaurant ID found in page data');
            return null;
          } catch (error) {
            console.log('LanchDrap: Error parsing page data for restaurant ID:', error);
            return null;
          }
        }
      }

      return null;
    } catch (error) {
      console.log('LanchDrap: Error in getLunchdropRestaurantId:', error);
      return null;
    }
  }

  // Extract user ID from Lunchdrop page
  getLunchdropUserId() {
    try {
      // First try window.user.id (if available)
      if (typeof window !== 'undefined' && window.user && window.user.id) {
        console.log('LanchDrap: Found window.user.id:', window.user.id);
        console.log('LanchDrap: Full window.user object:', window.user);
        return window.user.id;
      }

      // Try to extract from app data
      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          try {
            const pageData = JSON.parse(appElement.dataset.page);
            console.log('LanchDrap: Full page data from app.dataset.page:', pageData);

            // Log specific restaurant-related data
            if (pageData.props?.delivery) {
              console.log('LanchDrap: Delivery data:', pageData.props.delivery);
            }
            if (pageData.props?.lunchDay?.nextDeliveries) {
              console.log(
                'LanchDrap: Next deliveries (restaurant list):',
                pageData.props.lunchDay.nextDeliveries
              );
            }
            if (pageData.props?.ordersToRate) {
              console.log('LanchDrap: Orders to rate:', pageData.props.ordersToRate);
            }

            // Look for userId in orders
            if (pageData.props?.delivery?.orders) {
              const orders = pageData.props.delivery.orders;
              console.log('LanchDrap: Delivery orders data:', orders);
              if (orders.length > 0 && orders[0].userId) {
                console.log('LanchDrap: Found userId in orders:', orders[0].userId);
                return orders[0].userId;
              }
            }
          } catch (error) {
            console.log('LanchDrap: Error parsing page data:', error);
          }
        }
      }

      // Also check for other potential data sources
      console.log('LanchDrap: Checking for other data sources...');
      console.log(
        'LanchDrap: window object keys:',
        Object.keys(window).filter(
          (key) => key.includes('app') || key.includes('data') || key.includes('page')
        )
      );

      // Check if there are any other global objects with restaurant data
      if (typeof window !== 'undefined') {
        const potentialDataSources = [
          '__NEXT_DATA__',
          '__NUXT__',
          '__INITIAL_STATE__',
          'initialData',
          'pageData',
        ];
        potentialDataSources.forEach((source) => {
          if (window[source]) {
            console.log(`LanchDrap: Found ${source}:`, window[source]);
          }
        });
      }

      // Fallback: try window.user.id again (in case it loaded asynchronously)
      if (typeof window !== 'undefined' && window.user && window.user.id) {
        console.log('LanchDrap: Found window.user.id (fallback):', window.user.id);
        return window.user.id;
      }

      return null;
    } catch (error) {
      console.log('LanchDrap: Error in getLunchdropUserId:', error);
      return null;
    }
  }

  // Get user ID from Lunchdrop page or storage
  async getUserId() {
    if (this.userId) {
      return this.userId;
    }
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
