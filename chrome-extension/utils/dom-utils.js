// DOM utilities for LanchDrap extension
// Handles DOM caching, element finding, and common DOM operations

// Create global namespace for DOM utilities
window.LanchDrapDOMUtils = (() => {
  // Cache for DOM queries to avoid repeated lookups
  const domCache = {
    restaurantGrid: null,
    restaurantCards: null,
    lastCacheTime: 0,
    cacheTimeout: 5000, // 5 seconds
  };

  // Helper function to get cached restaurant grid
  function getCachedRestaurantGrid() {
    const now = Date.now();
    if (domCache.restaurantGrid && now - domCache.lastCacheTime < domCache.cacheTimeout) {
      return domCache.restaurantGrid;
    }

    // Try to find the restaurant grid using optimized strategies
    let restaurantGrid = null;

    // Strategy 1: Look for the specific selector from the user's xpath
    restaurantGrid = document.querySelector(
      '#app > div.flex.flex-col.justify-between.w-full.min-h-screen.v-cloak > div.flex-auto.basis-full.relative > div.max-w-6xl.mx-auto > div:nth-child(6) > div'
    );

    // Strategy 2: Look for flex-wrap gap-3 (common pattern for restaurant grids)
    if (!restaurantGrid) {
      restaurantGrid = document.querySelector('div.flex.flex-wrap.gap-3');
    }

    // Strategy 3: Look for div containing restaurant links with specific URL pattern
    if (!restaurantGrid) {
      const restaurantLinks = document.querySelectorAll('a[href*="/app/"]');
      const validRestaurantLinks = Array.from(restaurantLinks).filter((link) => {
        const href = link.getAttribute('href');
        return href && /\/app\/.*\/[a-zA-Z0-9]+/.test(href);
      });

      if (validRestaurantLinks.length > 0) {
        const potentialGrid = validRestaurantLinks[0].closest('div');
        const restaurantLinksInGrid = potentialGrid.querySelectorAll('a[href*="/app/"]');
        const validLinksInGrid = Array.from(restaurantLinksInGrid).filter((link) => {
          const href = link.getAttribute('href');
          return href && /\/app\/.*\/[a-zA-Z0-9]+/.test(href);
        });

        const hasMultipleRestaurants = validLinksInGrid.length >= 3;
        const isNotDateNav =
          !potentialGrid.className.includes('day-container') &&
          !potentialGrid.className.includes('snap-x') &&
          !potentialGrid.className.includes('overflow-scroll');

        if (hasMultipleRestaurants && isNotDateNav) {
          restaurantGrid = potentialGrid;
        }
      }
    }

    // Strategy 4: Fallback to old selector
    if (!restaurantGrid) {
      restaurantGrid = document.querySelector('div.mx-4.my-8.sm\\:my-2');
    }

    // Cache the result
    domCache.restaurantGrid = restaurantGrid;
    domCache.lastCacheTime = now;

    return restaurantGrid;
  }

  // Helper function to clear DOM cache
  function clearDomCache() {
    domCache.restaurantGrid = null;
    domCache.restaurantCards = null;
    domCache.lastCacheTime = 0;
  }

  // Helper function to format date strings properly (avoid timezone issues)
  function formatDateString(dateString) {
    if (!dateString) return 'Unknown';

    // If it's already in YYYY-MM-DD format, treat it as local date
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      return date.toLocaleDateString();
    }

    // Otherwise, use the date as-is
    return new Date(dateString).toLocaleDateString();
  }

  // Function to extract date from LanchDrap URL
  function extractDateFromUrl() {
    try {
      const url = window.location.href;

      const dateMatch = url.match(/\/app\/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        return dateMatch[1]; // Returns YYYY-MM-DD format
      }

      // If no date in URL but URL contains /app, treat as today
      if (url.includes('/app') && !url.includes('/app/')) {
        const today = new Date();
        return today.toISOString().split('T')[0]; // Returns YYYY-MM-DD format for today
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  // Function to extract city from LanchDrap URL (for single office use)
  function extractCityFromUrl() {
    // Since this is single office use, we can hardcode or extract from URL
    try {
      const url = window.location.href;
      const cityMatch = url.match(/https:\/\/([^.]+)\.lunchdrop\.com/);
      if (cityMatch) {
        return cityMatch[1]; // Returns city name (e.g., "austin")
      }
      return 'office'; // Default to 'office' for single office use
    } catch (_error) {
      return 'office';
    }
  }

  // Function to generate unique order ID
  function generateOrderId() {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Function to check if we're on a restaurant detail page
  function isRestaurantDetailPage() {
    try {
      // Check if we have delivery data (indicates restaurant detail page)
      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          try {
            const pageData = JSON.parse(appElement.dataset.page);
            console.log('LanchDrap: isRestaurantDetailPage checking pageData:', pageData);
            const hasDeliveryRestaurant = !!pageData.props?.delivery?.restaurant?.id;
            console.log('LanchDrap: isRestaurantDetailPage result:', hasDeliveryRestaurant);
            return hasDeliveryRestaurant;
          } catch (error) {
            console.log('LanchDrap: Error parsing page data for detail page check:', error);
          }
        }
      }
      return false;
    } catch (_error) {
      return false;
    }
  }

  // Function to check if we're on the main restaurant grid page
  function isRestaurantGridPage() {
    try {
      // Check if we have deliveries data (indicates grid page)
      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          try {
            const pageData = JSON.parse(appElement.dataset.page);
            console.log('LanchDrap: isRestaurantGridPage checking pageData:', pageData);
            const hasLunchDayDeliveries = !!pageData.props?.lunchDay?.deliveries;
            console.log(
              'LanchDrap: isRestaurantGridPage looking for lunchDay.deliveries, found:',
              hasLunchDayDeliveries
            );
            console.log('LanchDrap: pageData.props structure:', pageData.props);
            return hasLunchDayDeliveries;
          } catch (error) {
            console.log('LanchDrap: Error parsing page data for grid page check:', error);
          }
        }
      }
      return false;
    } catch (_error) {
      return false;
    }
  }

  // Function to check if we're on a login page
  function isLoginPage() {
    return (
      document.querySelector('input[type="password"]') ||
      document.body.textContent.includes('Sign in') ||
      document.body.textContent.includes('Phone Number or Email Address')
    );
  }

  // Return public API
  return {
    getCachedRestaurantGrid,
    clearDomCache,
    formatDateString,
    extractDateFromUrl,
    extractCityFromUrl,
    generateOrderId,
    isRestaurantDetailPage,
    isRestaurantGridPage,
    isLoginPage,
  };
})();
