// Restaurant data utilities for LanchDrap extension
// Handles restaurant availability data loading from JSON (no scraping)

// Create global namespace for restaurant data utilities
window.LanchDrapRestaurantScraper = (() => {
  // Use data layer instead of local state
  // restaurantAvailabilityData is now managed by the data layer

  // Function to track both restaurants and orders on daily pages
  async function trackRestaurantAppearances(data, date) {
    // Hoist variables used in catch/finally to avoid ReferenceError
    try {
      console.log(
        'LanchDrap: trackRestaurantAppearances in scraper called with data:',
        data,
        'date:',
        date
      );

      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        console.error('LanchDrap: API client or config not available');
        return;
      }

      // Use a single global abort controller for tracking (like stats display)
      if (window.lanchDrapTrackingAbortController) {
        window.lanchDrapTrackingAbortController.abort();
      }
      window.lanchDrapTrackingAbortController = new AbortController();

      if (!date) {
        console.error('LanchDrap: No date available for tracking');
        return;
      }

      // Extract restaurants and orders from data
      const restaurants = data?.restaurants || [];
      const orders = data?.delivery?.orders || [];

      // Don't send empty data to the API
      if ((!restaurants || restaurants.length === 0) && (!orders || orders.length === 0)) {
        console.log('LanchDrap: No restaurants or orders found in data');
        return;
      }

      // API calls to LanchDrap backend should continue to be used for tracking
      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      const trackingData = {
        date: date,
      };

      // Add restaurants if available
      if (restaurants && restaurants.length > 0) {
        trackingData.restaurants = restaurants.map((restaurant) => ({
          id: restaurant.id,
          name: restaurant.name,
          status: restaurant.status,
          color: restaurant.color,
          logo: restaurant.logo,
          menu: restaurant.menu || [],
        }));
      }

      // Add orders if available
      if (orders && orders.length > 0) {
        trackingData.orders = orders;
      }

      const result = await apiClient.trackRestaurantAppearances(
        trackingData,
        window.lanchDrapTrackingAbortController.signal
      );

      // Removed: order history storage from tracking to avoid duplicate order API calls.

      // Check if the request was aborted
      if (window.lanchDrapTrackingAbortController.signal.aborted) {
        return null;
      }

      return result; // Return the result so it can be used in the main flow
    } catch (_error) {
      if (_error.name === 'AbortError') {
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
