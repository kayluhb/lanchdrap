// User ID utilities for LanchDrap extension
// Handles user identification and management

// Create global namespace for user ID management
window.LanchDrapUserIdManager = (() => {
  // Function to get user ID strictly from the DOM/app state (never generate)
  async function getUserId() {
    try {
      // 1) Prefer global window.user.id when available
      if (typeof window !== 'undefined' && window.user && window.user.id) {
        const domUserId = String(window.user.id);
        try {
          await chrome.storage.local.set({ lanchdrap_user_id: domUserId });
        } catch (_e) {}
        try {
          localStorage.setItem('lanchdrap_user_id', domUserId);
        } catch (_e) {}
        return domUserId;
      }

      // 2) Try to parse user ID from embedded page data if present
      try {
        if (typeof window !== 'undefined' && window.app?.dataset?.page) {
          const pageData = JSON.parse(window.app.dataset.page);
          const possibleIds = [
            pageData?.props?.user?.id,
            pageData?.props?.currentUser?.id,
            pageData?.props?.session?.user?.id,
          ].filter(Boolean);
          if (possibleIds.length > 0) {
            const domUserId = String(possibleIds[0]);
            try {
              await chrome.storage.local.set({ lanchdrap_user_id: domUserId });
            } catch (_e) {}
            try {
              localStorage.setItem('lanchdrap_user_id', domUserId);
            } catch (_e) {}
            return domUserId;
          }
        }
      } catch (_e) {}

      // 3) As a cache-only fallback, return a previously stored value (originated from DOM)
      try {
        const result = await chrome.storage.local.get(['lanchdrap_user_id']);
        if (result?.lanchdrap_user_id) {
          return result.lanchdrap_user_id;
        }
      } catch (_e) {}

      try {
        const cached = localStorage.getItem('lanchdrap_user_id');
        if (cached) return cached;
      } catch (_e) {}

      // 4) If not found anywhere, return null (do not generate)
      return null;
    } catch (_error) {
      // On unexpected errors, prefer safe null
      try {
        const cached = localStorage.getItem('lanchdrap_user_id');
        return cached || null;
      } catch (_e) {
        return null;
      }
    }
  }

  // Function to extract restaurant ID from LunchDrop page data
  function getLunchdropRestaurantId() {
    try {
      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          const pageData = JSON.parse(appElement.dataset.page);

          // Try to get restaurant ID from delivery data (detail pages)
          if (pageData.props?.delivery?.restaurant?.id) {
            return pageData.props.delivery.restaurant.id;
          }

          // For grid pages, we don't have a single restaurant ID
          // This will be null and handled by the calling code
          return null;
        }
      }
      return null;
    } catch (_error) {
      console.log('LanchDrap: Error extracting restaurant ID from page data:', _error);
      return null;
    }
  }

  // Function to clear user ID (for testing/reset purposes)
  async function clearUserId() {
    try {
      await chrome.storage.local.remove(['lanchdrap_user_id']);
      localStorage.removeItem('lanchdrap_user_id');
    } catch (_error) {
      localStorage.removeItem('lanchdrap_user_id');
    }
  }

  // Get user identification object (for backward compatibility)
  async function getUserIdentification() {
    const userId = await getUserId();
    return userId ? { userId } : null;
  }

  // Return public API
  return {
    getUserId,
    getUserIdentification,
    getLunchdropRestaurantId,
    clearUserId,
  };
})();

// Create a simple wrapper class for backward compatibility
window.LanchDrapUserIdManager.LanchDrapUserIdManager = class {
  async getUserId() {
    return window.LanchDrapUserIdManager.getUserId();
  }

  async getUserIdentification() {
    return window.LanchDrapUserIdManager.getUserIdentification();
  }

  getLunchdropRestaurantId() {
    return window.LanchDrapUserIdManager.getLunchdropRestaurantId();
  }

  async clearUserId() {
    return window.LanchDrapUserIdManager.clearUserId();
  }
};

// Create global instance for backward compatibility
window.lanchDrapUserIdManager = window.LanchDrapUserIdManager;
