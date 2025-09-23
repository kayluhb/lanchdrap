// User ID utilities for LanchDrap extension
// Handles user identification and management

const USER_ID_STORAGE_KEY = 'lanchdrap_user_id';

// Create global namespace for user ID management
window.LanchDrapUserIdManager = (() => {
  // Function to get user ID strictly from the DOM/app state (never generate)
  async function getUserId() {
    try {
      // 1) Prefer global window.user.id when available
      if (typeof window !== 'undefined' && window.user && window.user.id) {
        const domUserId = String(window.user.id);
        try {
          await chrome.storage.local.set({ [USER_ID_STORAGE_KEY]: domUserId });
        } catch (_e) {}
        try {
          localStorage.setItem(USER_ID_STORAGE_KEY, domUserId);
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
              await chrome.storage.local.set({ [USER_ID_STORAGE_KEY]: domUserId });
            } catch (_e) {}
            try {
              localStorage.setItem(USER_ID_STORAGE_KEY, domUserId);
            } catch (_e) {}
            return domUserId;
          }
        }
      } catch (_e) {}

      // 3) As a cache-only fallback, return a previously stored value (originated from DOM)
      try {
        const result = await chrome.storage.local.get([USER_ID_STORAGE_KEY]);
        if (result?.lanchdrap_user_id) {
          return result.lanchdrap_user_id;
        }
      } catch (_e) {}

      try {
        const cached = localStorage.getItem(USER_ID_STORAGE_KEY);
        if (cached) return cached;
      } catch (_e) {}

      // 4) If not found anywhere, return null (do not generate)
      return null;
    } catch (_error) {
      // On unexpected errors, prefer safe null
      try {
        const cached = localStorage.getItem(USER_ID_STORAGE_KEY);
        return cached || null;
      } catch (_e) {
        return null;
      }
    }
  }

  // Function to clear user ID (for testing/reset purposes)
  async function clearUserId() {
    try {
      await chrome.storage.local.remove([USER_ID_STORAGE_KEY]);
      localStorage.removeItem(USER_ID_STORAGE_KEY);
    } catch (_error) {
      localStorage.removeItem(USER_ID_STORAGE_KEY);
    }
  }

  // Return public API
  return {
    getUserId,
    clearUserId,
  };
})();

// Create a simple wrapper class for backward compatibility
window.LanchDrapUserIdManager.LanchDrapUserIdManager = class {
  async getUserId() {
    return window.LanchDrapUserIdManager.getUserId();
  }

  async clearUserId() {
    return window.LanchDrapUserIdManager.clearUserId();
  }
};

// Create global instance for backward compatibility
window.lanchDrapUserIdManager = window.LanchDrapUserIdManager;
