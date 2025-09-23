// Restaurant data utilities for LanchDrap extension
// Handles restaurant availability data loading from JSON (no scraping)

// Create global namespace for restaurant data utilities
window.LanchDrapRestaurantScraper = (() => {
  // Use data layer instead of local state
  // restaurantAvailabilityData is now managed by the data layer

  // Function to track restaurant appearances on daily pages
  async function trackRestaurantAppearances(availabilityData) {
    // Hoist variables used in catch/finally to avoid ReferenceError
    let currentUrl = null;
    let urlDate = null;
    try {
      console.log('LanchDrap: trackRestaurantAppearances called with data:', availabilityData);

      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        console.log('LanchDrap: API client or config not available');
        return;
      }

      // Use a single global abort controller for tracking (like stats display)
      if (window.lanchDrapTrackingAbortController) {
        window.lanchDrapTrackingAbortController.abort();
      }
      window.lanchDrapTrackingAbortController = new AbortController();

      // Store current URL to validate against when response comes back
      currentUrl = window.location.href;

      urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      if (!urlDate) {
        return;
      }

      // Don't send empty restaurant arrays to the API
      if (!availabilityData || availabilityData.length === 0) {
        return;
      }

      // API calls to LanchDrap backend should continue to be used for tracking
      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );
      const timeSlot = availabilityData[0]?.timeSlot?.full || 'unknown';

      const trackingData = {
        restaurants: availabilityData.map((restaurant) => ({
          id: restaurant.id,
          name: restaurant.name,
          status: restaurant.status,
          href: restaurant.href,
          color: restaurant.color,
          logo: restaurant.logo,
          isSelected: restaurant.isSelected,
          menu: restaurant.menu || [],
        })),
        date: urlDate,
        timeSlot: timeSlot,
      };

      console.log('LanchDrap: Sending tracking data to API:', trackingData);
      console.log(
        'LanchDrap: Menu data being sent:',
        trackingData.restaurants.map((r) => ({
          id: r.id,
          name: r.name,
          menuItems: r.menu?.length || 0,
        }))
      );

      const result = await apiClient.trackRestaurantAppearances(
        trackingData,
        window.lanchDrapTrackingAbortController.signal
      );

      console.log('LanchDrap: Tracking API response:', result);

      // Removed: order history storage from tracking to avoid duplicate order API calls.

      // Check if the request was aborted
      if (window.lanchDrapTrackingAbortController.signal.aborted) {
        return null;
      }

      // Validate that we're still on the same page and date
      if (window.location.href !== currentUrl) {
        return null;
      }

      // Double-check that the date in the current URL still matches what we're tracking
      const currentUrlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      if (currentUrlDate !== urlDate) {
        return null;
      }

      // Log the result for debugging
      if (result?.success) {
      }

      return result; // Return the result so it can be used in the main flow
    } catch (_error) {
      if (_error.name === 'AbortError') {
        return null;
      }

      // Also check if URL changed during the request
      if (currentUrl && window.location.href !== currentUrl) {
        return null;
      }

      // Also check if the date in the URL changed during the request
      const currentUrlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      if (urlDate && currentUrlDate !== urlDate) {
        return null;
      }
    } finally {
      // Clear the abort controller
      if (window.lanchDrapTrackingAbortController) {
        window.lanchDrapTrackingAbortController = null;
      }
    }
  }

  // Function to add sell out indicators to restaurant cards
  function addSellOutIndicators(restaurantsWithRates) {
    try {
      // Check if indicators have already been added to prevent duplicate processing
      if (document.querySelector('.ld-sellout-indicator')) {
        return;
      }

      // Try multiple selectors to find restaurant cards
      let restaurantCards = [];

      // Try different selectors
      const selectors = [
        'a[href*="/app/"]',
        'a[href*="/restaurant/"]',
        'div[class*="restaurant"] a',
        'div[class*="card"] a',
        'a[class*="restaurant"]',
      ];

      for (const selector of selectors) {
        const cards = document.querySelectorAll(selector);
        if (cards.length > 0) {
          restaurantCards = cards;
          break;
        }
      }

      // If still no cards found, try the cached grid approach
      if (restaurantCards.length === 0) {
        const restaurantGrid = window.LanchDrapDOMUtils.getCachedRestaurantGrid();
        if (restaurantGrid) {
          restaurantCards = restaurantGrid.querySelectorAll('a[href*="/app/"]');
        }
      }

      // Find the restaurant with the highest sell out rate
      const restaurantsWithValidRates = restaurantsWithRates.filter((r) => r.sellOutRate > 0);

      if (restaurantsWithValidRates.length === 0) {
        return; // No restaurants with sell out data
      }

      // Sort by sell out rate (highest first)
      const sortedBySellOutRate = restaurantsWithValidRates.sort(
        (a, b) => b.sellOutRate - a.sellOutRate
      );

      // Only show indicator on the restaurant with the highest sell out rate
      // AND only if it's significantly high and significantly higher than others
      const highestSellOutRestaurant = sortedBySellOutRate[0];
      const secondHighestRate =
        sortedBySellOutRate.length > 1 ? sortedBySellOutRate[1].sellOutRate : 0;

      // Get configuration values
      const sellOutThreshold = window.LanchDrapConfig?.CONFIG?.SETTINGS?.SELL_OUT_THRESHOLD || 0.8;
      const minDifference =
        window.LanchDrapConfig?.CONFIG?.SETTINGS?.SELL_OUT_MIN_DIFFERENCE || 0.2;

      // Only show indicator if:
      // 1. The highest rate is >= threshold
      // 2. The highest rate is at least minDifference higher than the second highest
      // 3. OR if there's only one restaurant with data and it's >= threshold
      const shouldShowIndicator =
        (highestSellOutRestaurant.sellOutRate >= sellOutThreshold &&
          highestSellOutRestaurant.sellOutRate - secondHighestRate >= minDifference) ||
        (restaurantsWithValidRates.length === 1 &&
          highestSellOutRestaurant.sellOutRate >= sellOutThreshold);

      if (shouldShowIndicator) {
        // Find the card for this restaurant
        const restaurantCard = Array.from(restaurantCards).find((card) => {
          const href = card.getAttribute('href');
          return href?.includes(highestSellOutRestaurant.id);
        });

        if (restaurantCard) {
          // Check if indicator already exists
          const existingIndicator = restaurantCard.querySelector('.ld-sellout-indicator');

          if (!existingIndicator) {
            // Create the indicator element
            const indicator = document.createElement('div');
            indicator.className = 'ld-sellout-indicator';
            indicator.style.cssText = `
              position: absolute;
              bottom: 8px;
              left: 50%;
              transform: translateX(-50%);
              background: linear-gradient(135deg, #ff6b6b, #ee5a52);
              color: white;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
              z-index: 10;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              text-transform: uppercase;
              letter-spacing: 0.5px;
              white-space: nowrap;
            `;
            indicator.textContent = `Likely to Sell Out`;

            // Make sure the card has relative positioning
            const cardDiv = restaurantCard.querySelector('div');

            if (cardDiv) {
              cardDiv.style.position = 'relative';
              cardDiv.appendChild(indicator);
            }
          }
        }
      }
    } catch (_error) {}
  }

  // Return public API
  return {
    addSellOutIndicators,
    trackRestaurantAppearances,
  };
})();
