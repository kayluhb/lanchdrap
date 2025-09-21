// Main content script for LanchDrap extension
// Orchestrates all the modular functionality

// Global state
let isInitialized = false;
let lastUrl = window.location.href;

// Initialize the extension
async function initializeExtension() {
  if (isInitialized) return;

  // Extract and store Lunchdrop user ID
  try {
    await window.lanchDrapUserIdManager.getUserId();
  } catch {
    // Silently fail if we can't extract the user ID
  }

  // Clear any existing DOM cache
  window.LanchDrapDOMUtils.clearDomCache();

  // Add floating rating button
  window.LanchDrapRatingWidget.addFloatingButton();

  // Check for pending rating prompt from before utilities were loaded
  const pendingPrompt = localStorage.getItem('lanchdrap_pending_rating_prompt');
  if (pendingPrompt) {
    try {
      const promptData = JSON.parse(pendingPrompt);

      // Create order data from pending prompt
      const orderData = {
        restaurant: promptData.restaurant,
        items: ['Detected from LanchDrap prompt'],
        total: 'Unknown',
        orderId: window.LanchDrapDOMUtils.generateOrderId(),
      };
      window.LanchDrapRatingWidget.setOrderData(orderData);

      // Clear the pending prompt
      localStorage.removeItem('lanchdrap_pending_rating_prompt');
    } catch (_error) {}
  }

  isInitialized = true;
}

// Main function to handle page changes
async function handlePageChange() {
  try {
    console.log('LanchDrap: handlePageChange called, current URL:', window.location.href);

    // Skip if on login page
    if (window.LanchDrapDOMUtils.isLoginPage()) {
      console.log('LanchDrap: On login page, skipping');
      return;
    }

    // Initialize if not already done
    await initializeExtension();

    // Handle restaurant grid pages (daily pages)
    if (window.LanchDrapDOMUtils.isRestaurantGridPage()) {
      console.log('LanchDrap: Detected restaurant grid page');
      // Show skeleton loading state immediately
      if (window.LanchDrapStatsDisplay?.showSkeletonLoading) {
        window.LanchDrapStatsDisplay.showSkeletonLoading();
      }

      // Wait for navigation to settle before scraping and displaying stats
      setTimeout(async () => {
        console.log('LanchDrap: Timeout callback executing');
        // Double-check we're still on a restaurant grid page
        if (!window.LanchDrapDOMUtils.isRestaurantGridPage()) {
          console.log('LanchDrap: No longer on restaurant grid page, skipping');
          return;
        }

        // Scrape restaurant availability and display stats
        console.log('LanchDrap: Calling scrapeRestaurantAvailability from content script');
        const availabilityData =
          await window.LanchDrapRestaurantScraper.scrapeRestaurantAvailability();

        console.log('LanchDrap: Got availability data:', availabilityData);
        if (availabilityData && availabilityData.length > 0) {
          // Display stats for selected restaurant
          await window.LanchDrapStatsDisplay.displaySelectedRestaurantStats(availabilityData);
        }
      }, 500); // Wait 500ms for navigation to settle
    }

    // Handle restaurant detail pages
    if (window.LanchDrapDOMUtils.isRestaurantDetailPage()) {
      // Display restaurant tracking info
      await window.LanchDrapStatsDisplay.displayRestaurantTrackingInfo();
    }

    // Check for order confirmation and store order history
    await window.LanchDrapOrderParser.detectAndStoreOrder();

    // Check for LanchDrap rating prompt
    window.LanchDrapRatingWidget.detectLunchDropRatingPrompt();
  } catch (_error) {}
}

// Handle URL changes (SPA navigation)
function handleUrlChange() {
  const currentUrl = window.location.href;

  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;

    // Clear DOM cache on URL change
    window.LanchDrapDOMUtils.clearDomCache();

    // Clear restaurant availability data on URL change
    if (window.LanchDrapRestaurantScraper?.clearRestaurantAvailabilityData) {
      window.LanchDrapRestaurantScraper.clearRestaurantAvailabilityData();
    }

    // Clear any existing stats display on URL change
    const existingStats = document.getElementById('lanchdrap-restaurant-stats');
    const existingSkeleton = document.getElementById('lanchdrap-restaurant-stats-skeleton');
    if (existingStats) {
      existingStats.remove();
    }
    if (existingSkeleton) {
      existingSkeleton.remove();
    }

    // Handle the page change
    handlePageChange();
  }
}

// Set up event listeners
function setupEventListeners() {
  // Listen for URL changes (for SPA navigation)
  let urlChangeTimeout;
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = (...args) => {
    originalPushState.apply(history, args);
    clearTimeout(urlChangeTimeout);
    urlChangeTimeout = setTimeout(handleUrlChange, 300);
  };

  history.replaceState = (...args) => {
    originalReplaceState.apply(history, args);
    clearTimeout(urlChangeTimeout);
    urlChangeTimeout = setTimeout(handleUrlChange, 300);
  };

  // Listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', () => {
    clearTimeout(urlChangeTimeout);
    urlChangeTimeout = setTimeout(handleUrlChange, 300);
  });

  // Listen for DOM changes (for dynamic content)
  const observer = new MutationObserver((mutations) => {
    let shouldHandleChange = false;

    mutations.forEach((mutation) => {
      // Check if restaurant cards were added/removed
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);
        const hasRestaurantContent = addedNodes.some((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return (
              node.querySelector &&
              (node.querySelector('a[href*="/app/"]') ||
                node.querySelector('.text-3xl.font-bold') ||
                node.textContent?.includes('Your order has been placed'))
            );
          }
          return false;
        });

        if (hasRestaurantContent) {
          shouldHandleChange = true;
        }
      }
    });

    if (shouldHandleChange) {
      clearTimeout(urlChangeTimeout);
      urlChangeTimeout = setTimeout(handlePageChange, 200);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Handle initial page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handlePageChange);
  } else {
    handlePageChange();
  }
}

// Initialize when the script loads
setupEventListeners();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getRestaurantInfo') {
    (async () => {
      try {
        // Use centralized restaurant context utility
        const restaurantContext =
          await window.LanchDrapRestaurantContext.getCurrentRestaurantContext();

        if (restaurantContext.hasValidId && restaurantContext.hasValidName) {
          const restaurantInfo = {
            restaurantName: restaurantContext.name,
            restaurantId: restaurantContext.id,
          };
          sendResponse(restaurantInfo);
        } else {
          sendResponse(null);
        }
      } catch (_error) {
        sendResponse(null);
      }
    })();
    return true; // Keep message channel open for async response
  }
});

// Export functions for potential external use
window.LanchDrapExtension = {
  handlePageChange,
  clearDomCache: () => window.LanchDrapDOMUtils.clearDomCache(),
  getOrderData: () => window.LanchDrapRatingWidget.getOrderData(),
  setOrderData: (data) => window.LanchDrapRatingWidget.setOrderData(data),
};
