// Main content script for LanchDrap extension
// Orchestrates all the modular functionality

// Global state
let isInitialized = false;
let lastUrl = window.location.href;

// Initialize the extension
async function initializeExtension() {
  if (isInitialized) return;

  console.info('LanchDrap: Initializing extension');

  // Clear any existing DOM cache
  window.LanchDrapDOMUtils.clearDomCache();

  // Add floating rating button
  window.LanchDrapRatingWidget.addFloatingButton();

  // Check for pending rating prompt from before utilities were loaded
  const pendingPrompt = localStorage.getItem('lanchdrap_pending_rating_prompt');
  if (pendingPrompt) {
    try {
      const promptData = JSON.parse(pendingPrompt);
      console.info('LanchDrap: Processing pending rating prompt', promptData);

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
    } catch (error) {
      console.info('LanchDrap: Error processing pending prompt', error);
    }
  }

  isInitialized = true;
}

// Main function to handle page changes
async function handlePageChange() {
  console.log('LanchDrap: handlePageChange called', {
    url: window.location.href,
    timestamp: new Date().toISOString(),
  });

  try {
    // Skip if on login page
    if (window.LanchDrapDOMUtils.isLoginPage()) {
      console.log('LanchDrap: Skipping login page');
      return;
    }

    // Initialize if not already done
    await initializeExtension();

    // Handle restaurant grid pages (daily pages)
    if (window.LanchDrapDOMUtils.isRestaurantGridPage()) {
      console.info('LanchDrap: Restaurant grid page detected');

      // Show skeleton loading state immediately
      if (window.LanchDrapStatsDisplay && window.LanchDrapStatsDisplay.showSkeletonLoading) {
        window.LanchDrapStatsDisplay.showSkeletonLoading();
      }

      // Wait for navigation to settle before scraping and displaying stats
      setTimeout(async () => {
        // Double-check we're still on a restaurant grid page
        if (!window.LanchDrapDOMUtils.isRestaurantGridPage()) {
          console.log('LanchDrap: No longer on restaurant grid page, skipping stats');
          return;
        }

        // Scrape restaurant availability and display stats
        const availabilityData =
          await window.LanchDrapRestaurantScraper.scrapeRestaurantAvailability();

        if (availabilityData && availabilityData.length > 0) {
          // Display stats for selected restaurant
          await window.LanchDrapStatsDisplay.displaySelectedRestaurantStats(availabilityData);
        }
      }, 500); // Wait 500ms for navigation to settle
    }

    // Handle restaurant detail pages
    if (window.LanchDrapDOMUtils.isRestaurantDetailPage()) {
      console.info('LanchDrap: Restaurant detail page detected');

      // Display restaurant tracking info
      await window.LanchDrapStatsDisplay.displayRestaurantTrackingInfo();
    }

    // Check for order confirmation and store order history
    await window.LanchDrapOrderParser.detectAndStoreOrder();

    // Check for LanchDrap rating prompt
    window.LanchDrapRatingWidget.detectLunchDropRatingPrompt();
  } catch (error) {
    console.error('LanchDrap: Error in handlePageChange', error);
  }
}

// Handle URL changes (SPA navigation)
function handleUrlChange() {
  const currentUrl = window.location.href;

  if (currentUrl !== lastUrl) {
    console.info('LanchDrap: URL changed, handling page change', {
      from: lastUrl,
      to: currentUrl,
      timestamp: new Date().toISOString(),
    });
    lastUrl = currentUrl;

    // Clear DOM cache on URL change
    window.LanchDrapDOMUtils.clearDomCache();

    // Clear restaurant availability data on URL change
    if (
      window.LanchDrapRestaurantScraper &&
      window.LanchDrapRestaurantScraper.clearRestaurantAvailabilityData
    ) {
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getRestaurantInfo') {
    try {
      // Try to get restaurant info from the current page
      let restaurantInfo = null;

      // Method 1: Look for restaurant name in common selectors
      const restaurantNameElement = document.querySelector('.text-3xl.font-bold');
      if (restaurantNameElement) {
        const restaurantName = restaurantNameElement.textContent?.trim();

        // Try to get restaurant ID from URL
        const urlParts = window.location.pathname.split('/');
        let restaurantId = null;

        if (urlParts.length >= 4 && urlParts[1] === 'app') {
          const potentialId = urlParts[urlParts.length - 1];
          // Check if it's not a date
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(potentialId)) {
            restaurantId = potentialId;
          }
        }

        if (restaurantName && restaurantId) {
          restaurantInfo = {
            restaurantName: restaurantName,
            restaurantId: restaurantId,
          };
        }
      }

      sendResponse(restaurantInfo);
    } catch (error) {
      console.error('Error getting restaurant info:', error);
      sendResponse(null);
    }
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
