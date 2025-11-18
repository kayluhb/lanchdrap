// Main content script for LanchDrap extension
// Only waits for data layer initialization

// Global state
let isInitialized = false;
let lastUrl = window.location.href;
let lastRestaurantId = null;

// Prevent infinite loops in stats display
let isProcessingStats = false;
let isProcessingTracking = false;
let isHandlingPageChange = false;

// Initialize the extension
async function initializeExtension() {
  if (isInitialized) return;

  // Initialize data layer if not already done
  try {
    if (window.LanchDrapDataLayer) {
      // Initialize the data layer
      await window.LanchDrapDataLayer.initialize();
      console.log('LanchDrap: Data layer initialized');

      // Set up data layer event listeners
      setupDataLayerListeners();
    } else {
      console.warn('LanchDrap: Data layer not available');
    }
  } catch (error) {
    console.warn('LanchDrap: Data layer initialization failed:', error);
  }

  isInitialized = true;
}

// Set up data layer event listeners
function setupDataLayerListeners() {
  if (!window.LanchDrapDataLayer) {
    console.warn('LanchDrap: Data layer not available for event listeners');
    return;
  }

  // Listen for data changes from the data layer
  window.LanchDrapDataLayer.on('dataChanged', async (eventData) => {
    try {
      console.log('LanchDrap: Data changed event received:', eventData);

      // Parallelize independent operations for better performance
      const promises = [];

      // Check if we have restaurant data and if the restaurant has changed
      if (eventData.data?.currentRestaurant) {
        const currentRestaurantId = eventData.data.currentRestaurant.id;

        // Only trigger stats display if restaurant actually changed
        if (currentRestaurantId !== lastRestaurantId) {
          console.log(
            'LanchDrap: Restaurant changed from',
            lastRestaurantId,
            'to',
            currentRestaurantId
          );
          lastRestaurantId = currentRestaurantId;

          // Trigger stats display for the new restaurant (can run in parallel)
          promises.push(displayRestaurantStats(eventData.data));
        } else {
          console.log('LanchDrap: Restaurant unchanged, skipping stats display');
        }
      }

      // Track restaurant appearances when on day pages (can run in parallel)
      const isDayPage = window.LanchDrapDataLayer?.getIsDayPage?.();
      console.log(
        'LanchDrap: isDayPage:',
        isDayPage,
        'hasDeliveries:',
        !!eventData.data?.deliveries
      );
      if (isDayPage && eventData.data?.deliveries) {
        console.log('LanchDrap: Calling trackRestaurantAppearances');
        promises.push(trackRestaurantAppearances(eventData.data));
      }

      // Display restaurant grid badges on grid pages (can run in parallel, doesn't need to wait)
      // Only render if we have restaurants and the event includes a date (prevents stale data)
      if (eventData.data?.restaurants && eventData.data.restaurants.length > 0 && eventData.date) {
        console.log('LanchDrap: Calling displayRestaurantGridBadges for date:', eventData.date);
        // Don't await this - let it run independently so badges appear faster
        displayRestaurantGridBadges(eventData.data).catch((error) => {
          console.error('LanchDrap: Error displaying badges:', error);
        });
      }

      // Wait for all parallel operations to complete
      await Promise.all(promises);
    } catch (error) {
      console.error('LanchDrap: Error handling data changed event:', error);
    }
  });
}

// Display restaurant stats when restaurant changes
async function displayRestaurantStats(data) {
  try {
    // Prevent infinite loops
    if (isProcessingStats) {
      console.log('LanchDrap: Already processing stats, skipping to prevent infinite loop');
      return;
    }

    if (!window.LanchDrapStatsDisplay) {
      console.warn('LanchDrap: Stats display not available');
      return;
    }

    const { currentRestaurant } = data;

    if (!currentRestaurant) {
      console.log('LanchDrap: No current restaurant to display stats for');
      return;
    }

    // Check if stats are already displayed for this restaurant
    const existingStats = document.getElementById('lanchdrap-restaurant-stats');
    if (existingStats && existingStats.dataset.restaurantId === currentRestaurant.id) {
      return;
    }

    isProcessingStats = true;

    // Call the stats display function with the current restaurant object
    await window.LanchDrapStatsDisplay.displaySelectedRestaurantStats(currentRestaurant);
  } catch (error) {
    console.error('LanchDrap: Error displaying restaurant stats:', error);
  } finally {
    isProcessingStats = false;
  }
}

// Track restaurant appearances when on day pages
async function trackRestaurantAppearances(data) {
  try {
    // Prevent infinite loops
    if (isProcessingTracking) {
      return;
    }

    isProcessingTracking = true;

    // Get current date from data layer
    const currentDate = window.LanchDrapDataLayer?.getCurrentDate?.();

    if (!currentDate) {
      console.error('LanchDrap: No date available for tracking');
      return;
    }

    // Create a unique key for this tracking request to prevent duplicates
    // Include both restaurants and orders in the key to prevent duplicate tracking
    const restaurantIds = data?.restaurants?.map((r) => r.id) || [];
    const orderIds = data?.delivery?.orders?.map((o) => o.id) || [];
    const trackingKey = `${currentDate}-${JSON.stringify(restaurantIds)}-${JSON.stringify(orderIds)}`;

    // Check if we've already tracked this data today
    if (window.lanchDrapTrackedKeys?.has(trackingKey)) {
      return;
    }

    // Mark this tracking key as processed
    if (!window.lanchDrapTrackedKeys) {
      window.lanchDrapTrackedKeys = new Set();
    }
    window.lanchDrapTrackedKeys.add(trackingKey);

    // Send tracking request to background service worker
    const response = await chrome.runtime.sendMessage({
      action: 'trackRestaurantAppearances',
      data: data,
      date: currentDate,
    });
    if (response && !response.success) {
      console.error('LanchDrap: Background tracking failed:', response.error);
    }
  } catch (error) {
    console.error('LanchDrap: Error sending tracking request to background:', error);
  } finally {
    isProcessingTracking = false;
  }
}

// Display badges on restaurant grid
async function displayRestaurantGridBadges(data) {
  try {

    // Check if we have restaurants data
    if (!data?.restaurants || !Array.isArray(data.restaurants) || data.restaurants.length === 0) {
      console.log('LanchDrap: No restaurants data available for badges');
      return;
    }

    // Validate that we have current day's data by checking if restaurants have numSlotsAvailable
    // This ensures we're not rendering stale data from a previous day
    const hasValidSlotsData = data.restaurants.some(
      (r) => r.numSlotsAvailable !== undefined && r.numSlotsAvailable !== null
    );
    if (!hasValidSlotsData) {
      console.warn('LanchDrap: No valid slots data in restaurants, skipping badge display');
      return;
    }

    // Check if indicator function is available
    if (!window.LanchDrapRestaurantScraper?.addSellOutIndicators) {
      console.warn('LanchDrap: Restaurant scraper not available for badges');
      return;
    }

    // Use restaurant data directly from data layer - no additional API calls needed
    // The data layer already has all the current day's restaurant data including numSlotsAvailable
    // For badges, we only need numSlotsAvailable (current day) and appearances/soldOutDates (historical)
    // Since we don't have appearances/soldOutDates in the day data, we'll skip those badges for now
    // and only show slots available badges which use current day's data
    const enrichedRestaurants = data.restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name || restaurant.id,
      numSlotsAvailable: restaurant.numSlotsAvailable, // From data layer - current day's data
      appearances: [], // Not available in day data, would require separate API calls
      soldOutDates: [], // Not available in day data, would require separate API calls
    }));

    // Get current date from data layer to validate we're rendering current day's data
    const currentDate = window.LanchDrapDataLayer?.getCurrentDate?.();
    
    // Wait for restaurant grid to be available in DOM before rendering badges
    // Use a more efficient polling approach with shorter initial delay
    const waitForGrid = (maxAttempts = 20, attempt = 0) => {
      const restaurantGrid = document.querySelector('.mx-4.my-8') || 
                            (window.LanchDrapDOMUtils?.getCachedRestaurantGrid?.());
      
      if (restaurantGrid && restaurantGrid.querySelectorAll('a[href*="/app/"]').length > 0) {
        // Grid is ready, render badges immediately
        window.LanchDrapRestaurantScraper.addSellOutIndicators(enrichedRestaurants, currentDate);
      } else if (attempt < maxAttempts) {
        // Use shorter delay for first few attempts, then longer delays
        const delay = attempt < 5 ? 50 : 100;
        setTimeout(() => waitForGrid(maxAttempts, attempt + 1), delay);
      } else {
        console.warn('LanchDrap: Restaurant grid not found after max attempts, rendering anyway');
        window.LanchDrapRestaurantScraper.addSellOutIndicators(enrichedRestaurants, currentDate);
      }
    };
    
    // Start waiting for grid with immediate first check
    waitForGrid();
  } catch (error) {
    console.error('LanchDrap: Error displaying restaurant grid badges:', error);
  }
}

// Main function to handle page changes
async function handlePageChange() {
  // Prevent infinite loops - if already processing, skip
  if (isHandlingPageChange) {
    return;
  }

  try {
    isHandlingPageChange = true;

    const currentUrl = window.location.href;
    const urlChanged = currentUrl !== lastUrl;

    // Update last URL
    lastUrl = currentUrl;

    // Clear tracking keys when URL changes (new day/page)
    if (urlChanged && window.lanchDrapTrackedKeys) {
      window.lanchDrapTrackedKeys.clear();
    }

    // Initialize if not already done
    await initializeExtension();

    // Only call data layer handlePageChange if URL actually changed
    // (data layer handles initial load automatically)
    if (urlChanged && window.LanchDrapDataLayer?.handlePageChange) {
      await window.LanchDrapDataLayer.handlePageChange();
    } else if (!urlChanged && window.LanchDrapDataLayer?.getData) {
      // Handle initial load case - trigger stats display if we have data
      const data = window.LanchDrapDataLayer.getData();
      if (data?.currentRestaurant) {
        await displayRestaurantStats(data);
      }

      // Track restaurant appearances on initial load if on day page
      const isDayPage = window.LanchDrapDataLayer?.getIsDayPage?.();
      if (isDayPage && data?.deliveries) {
        await trackRestaurantAppearances(data);
      }

      // Display restaurant grid badges on initial load if we have restaurants
      if (data?.restaurants && data.restaurants.length > 0) {
        await displayRestaurantGridBadges(data);
      }
    }
  } catch (error) {
    console.error('🚀 LanchDrap: Error in handlePageChange:', error);
  } finally {
    isHandlingPageChange = false;
  }
}

// Set up event listeners for page navigation
function setupEventListeners() {
  // Handle initial page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      handlePageChange();
    });
  } else {
    handlePageChange();
  }

  // Listen for browser back/forward navigation
  window.addEventListener('popstate', () => {
    handlePageChange();
  });

  // Intercept programmatic navigation (pushState/replaceState)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = (...args) => {
    originalPushState.apply(history, args);
    // Small delay to allow DOM to update
    setTimeout(() => {
      handlePageChange();
    }, 100);
  };

  history.replaceState = (...args) => {
    originalReplaceState.apply(history, args);
    // Small delay to allow DOM to update
    setTimeout(() => {
      handlePageChange();
    }, 100);
  };

  // Listen for DOM changes that might indicate page content updates
  // This is useful for SPAs that update content without changing the URL
  const observer = new MutationObserver((mutations) => {
    let shouldHandleChange = false;

    for (const mutation of mutations) {
      // Check if the app element or its data attributes changed
      if (
        mutation.type === 'attributes' &&
        (mutation.attributeName === 'data-page' || mutation.target.id === 'app')
      ) {
        shouldHandleChange = true;
        break;
      }

      // Check if child nodes were added to the app element or its descendants
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if this is the app element or a descendant of it
        const isAppElement = mutation.target.id === 'app';
        const isAppDescendant = mutation.target.closest('#app') !== null;

        if (isAppElement || isAppDescendant) {
          shouldHandleChange = true;
          break;
        }
      }

      // Also trigger on any significant content changes within the app
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any added node contains meaningful content
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Ignore our own badge additions to prevent infinite loops
            if (
              node.classList?.contains('ld-slots-badge') ||
              node.classList?.contains('ld-soldout-last-time-badge') ||
              node.querySelector?.('.ld-slots-badge') ||
              node.querySelector?.('.ld-soldout-last-time-badge')
            ) {
              continue;
            }

            // Check if this looks like a page content change
            const hasSignificantContent =
              node.querySelector &&
              (node.querySelector('[data-page]') ||
                node.querySelector('.restaurant') ||
                node.querySelector('.delivery') ||
                node.textContent?.trim().length > 50);

            if (hasSignificantContent) {
              shouldHandleChange = true;
              break;
            }
          }
        }
      }
    }

    if (shouldHandleChange) {
      // Skip if we're already handling a page change
      if (isHandlingPageChange) {
        return;
      }

      // Debounce to avoid multiple rapid calls
      clearTimeout(window.lanchdrapChangeTimeout);
      window.lanchdrapChangeTimeout = setTimeout(() => {
        // Double-check URL actually changed before calling handlePageChange
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
          handlePageChange();
        }
      }, 200);
    }
  });

  // Start observing the app element for changes
  const appElement = document.getElementById('app');
  if (appElement) {
    observer.observe(appElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['data-page'],
    });
  } else {
    // If app element doesn't exist yet, wait for it
    const checkForApp = setInterval(() => {
      const app = document.getElementById('app');
      if (app) {
        observer.observe(app, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['data-page'],
        });
        clearInterval(checkForApp);
      }
    }, 100);
  }
}

// Initialize when the script loads
setupEventListeners();
