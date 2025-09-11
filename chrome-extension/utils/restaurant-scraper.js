// Restaurant scraping utilities for LanchDrap extension
// Handles restaurant availability scraping and tracking

// Create global namespace for restaurant scraper utilities
window.LanchDrapRestaurantScraper = (() => {
  let restaurantAvailabilityData = null;

  // Function to get restaurant name from local storage or API
  async function getRestaurantName(restaurantIdentifier) {
    try {
      // First check local storage
      const localKey = `restaurant_name:${restaurantIdentifier}`;
      const localName = localStorage.getItem(localKey);
      if (localName) {
        return localName;
      }

      // API endpoint removed - can't fetch restaurant names from API anymore
      // Restaurant names will be learned through the update-name endpoint

      return null;
    } catch (_error) {
      return null;
    }
  }

  // Function to process restaurant cards and extract data
  async function processRestaurantCards(restaurantCards, urlDate) {
    try {
      const availabilityData = [];
      const now = new Date();

      // Process cards in batches to avoid blocking the UI
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < restaurantCards.length; i += batchSize) {
        batches.push(restaurantCards.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (card, batchIndex) => {
          const index = batches.indexOf(batch) * batchSize + batchIndex;
          try {
            // Extract restaurant information
            const href = card.getAttribute('href');
            const timeSlot = card
              .querySelector('.text-base.font-bold.text-center')
              ?.textContent?.trim();
            const statusElement = card.querySelector('.text-sm.text-center');
            const statusText = statusElement?.textContent?.trim();

            // Determine availability status based on visual indicators
            let status = 'available';
            let reason = null;

            // Check for "SOLD OUT" text inside the restaurant card
            const cardText = card.textContent || '';
            const soldOutRegex = /sold\s+out!?/i;
            if (soldOutRegex.test(cardText)) {
              status = 'soldout';
              reason = 'Restaurant is sold out';
            }
            // Check for "Ordering Closed" text
            else if (statusText?.includes('Ordering Closed')) {
              status = 'soldout';
              reason = 'Ordering closed for this time slot';
            }
            // Check for "Order Placed" (available)
            else if (statusText?.includes('Order Placed')) {
              status = 'available';
              reason = 'Orders currently being accepted';
            }

            // Check visual indicators (opacity and border color)
            const cardDiv = card.querySelector('div.relative.h-full.rounded-md');
            let isSelected = false;
            let color = null;
            if (cardDiv) {
              const opacity = window.getComputedStyle(cardDiv).opacity;
              color = window.getComputedStyle(cardDiv).borderColor;

              // Check if this is the selected restaurant (has 'border-2' class)
              // Selected restaurants have the 'border-2' class
              if (cardDiv.classList.contains('border-2')) {
                isSelected = true;
              }

              // Reduced opacity often indicates closed/unavailable
              if (opacity && parseFloat(opacity) < 1) {
                if (status === 'available') {
                  status = 'limited';
                  reason = 'Reduced opacity suggests limited availability';
                }
              }
            }

            // Extract restaurant ID from href (primary method)
            let restaurantId = 'unknown';
            let restaurantName = null;

            // Extract restaurant ID from href
            if (href) {
              const hrefParts = href.split('/');
              if (hrefParts.length > 2) {
                restaurantId = hrefParts[hrefParts.length - 1];
              }
            }

            // Fallback: try to extract from image URL hash if no href ID
            if (restaurantId === 'unknown') {
              const img = card.querySelector('img');
              if (img?.src) {
                // Extract restaurant hash from the image URL
                // URL format: https://lunchdrop.s3.amazonaws.com/restaurant-logos/[hash].png
                const urlParts = img.src.split('/');
                if (urlParts.length > 0) {
                  const filename = urlParts[urlParts.length - 1];
                  if (filename.includes('.')) {
                    const hash = filename.split('.')[0];
                    restaurantId = hash;
                  }
                }
              }
            }

            // Try to get restaurant name from local storage or use identifier
            restaurantName = await getRestaurantName(restaurantId);
            if (!restaurantName || restaurantName === restaurantId) {
              // Use the ID as the name only if we don't have a better name
              restaurantName = restaurantId;
            }

            // Parse time slot
            let timeSlotData = null;
            if (timeSlot) {
              const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})(am|pm)/);
              if (timeMatch) {
                const [_, startHour, startMin, endHour, endMin, period] = timeMatch;
                timeSlotData = {
                  start: `${startHour}:${startMin}${period}`,
                  end: `${endHour}:${endMin}${period}`,
                  full: timeSlot,
                };
              }
            }

            const restaurantInfo = {
              index,
              id: restaurantId,
              name: restaurantName,
              restaurant: restaurantName, // Keep for backward compatibility
              status,
              reason,
              timeSlot: timeSlotData,
              href,
              urlDate: urlDate,
              timestamp: now.toISOString(),
              isSelected,
              color, // Add the color to the main object
              visualIndicators: {
                opacity: window.getComputedStyle(card).opacity,
                borderColor: window.getComputedStyle(
                  card.querySelector('div.relative.h-full.rounded-md')
                )?.borderColor,
                hasOrderPlaced: statusText?.includes('Order Placed') || false,
                hasOrderingClosed: statusText?.includes('Ordering Closed') || false,
                hasSoldOutInCard: /sold\s+out!?/i.test(cardText),
              },
            };

            return restaurantInfo;
          } catch (_cardError) {
            return null;
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        availabilityData.push(...batchResults.filter((result) => result !== null));

        // No delay needed - modern browsers handle this efficiently
      }

      // Store the scraped data
      storeAvailabilityData(availabilityData);

      // Report overall availability summary
      reportAvailabilitySummary(availabilityData);

      // Track restaurant appearances in background (don't block UI)
      console.info('LanchDrap: Starting background restaurant tracking');
      trackRestaurantAppearances(availabilityData)
        .then((result) => {
          // Add sellout indicators when tracking completes
          if (result?.data?.data?.restaurants || result?.data?.restaurants) {
            const restaurants = result.data.data?.restaurants || result.data.restaurants;
            if (restaurants && Array.isArray(restaurants)) {
              console.info('LanchDrap: Adding sellout indicators to restaurant cards');

              // Add indicators
              addSellOutIndicators(restaurants);
            }
          }
        })
        .catch((error) => {
          console.info('LanchDrap: Background tracking failed', error.message);
        });

      // Display stats for selected restaurant on daily pages
      if (
        window.LanchDrapStatsDisplay &&
        window.LanchDrapStatsDisplay.displaySelectedRestaurantStats
      ) {
        await window.LanchDrapStatsDisplay.displaySelectedRestaurantStats(availabilityData);
      }

      // Store the data for other modules to access
      restaurantAvailabilityData = availabilityData;
      return availabilityData;
    } catch (_error) {
      return null;
    }
  }

  // Function to scrape restaurant availability from the main grid
  async function scrapeRestaurantAvailability() {
    try {
      // Quick checks to avoid unnecessary processing
      if (
        document.querySelector('input[type="password"]') ||
        document.body.textContent.includes('Sign in') ||
        document.body.textContent.includes('Phone Number or Email Address')
      ) {
        return null;
      }

      // Check if we're on an individual restaurant page (not the main grid)
      const urlParts = window.location.pathname.split('/');
      if (urlParts.length >= 4 && urlParts[1] === 'app' && urlParts[3]) {
        return null;
      }

      // Extract date from URL for daily tracking
      const urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      if (!urlDate) {
        return null;
      }

      // Use cached restaurant grid
      const restaurantGrid = window.LanchDrapDOMUtils.getCachedRestaurantGrid();
      if (!restaurantGrid) {
        return;
      }

      // Get restaurant cards that match the specific URL pattern
      const allAppLinks = restaurantGrid.querySelectorAll('a[href*="/app/"]');

      // Debug: Log the first few hrefs to see the actual format
      if (allAppLinks.length > 0) {
      }

      const restaurantCards = Array.from(allAppLinks).filter((link) => {
        const href = link.getAttribute('href');
        // More flexible pattern - just check if it contains /app/ and has some identifier
        return href && /\/app\/.*\/[a-zA-Z0-9]+/.test(href);
      });

      if (restaurantCards.length === 0) {
        // Try to find valid restaurant cards with a broader search
        const allPageAppLinks = document.querySelectorAll('a[href*="/app/"]');

        const validPageLinks = Array.from(allPageAppLinks).filter((link) => {
          const href = link.getAttribute('href');
          return href && /\/app\/.*\/[a-zA-Z0-9]+/.test(href);
        });

        if (validPageLinks.length > 0) {
          // Use the first few valid restaurant links we can find
          const cards = validPageLinks.slice(0, 10); // Limit to first 10
          return await processRestaurantCards(cards, urlDate);
        }
        return null;
      }

      return await processRestaurantCards(restaurantCards, urlDate);
    } catch (_error) {}
  }

  // Function to store availability data locally
  function storeAvailabilityData(availabilityData) {
    try {
      const storageKey = `availability:${new Date().toISOString().split('T')[0]}`;
      const existingData = localStorage.getItem(storageKey);
      let dailyData = existingData ? JSON.parse(existingData) : [];

      // Add timestamp to each record
      const timestampedData = availabilityData.map((item) => ({
        ...item,
        scrapedAt: new Date().toISOString(),
      }));

      dailyData.push(...timestampedData);

      // Keep only last 100 records per day
      if (dailyData.length > 100) {
        dailyData = dailyData.slice(-100);
      }

      localStorage.setItem(storageKey, JSON.stringify(dailyData));
    } catch (_error) {}
  }

  // Function to track restaurant appearances on daily pages
  async function trackRestaurantAppearances(availabilityData) {
    try {
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        return;
      }

      const urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      if (!urlDate) {
        return;
      }

      // Don't send empty restaurant arrays to the API
      if (!availabilityData || availabilityData.length === 0) {
        return;
      }

      // Note: We always call the tracking API to get restaurant data
      // The backend will handle duplicate prevention and avoid unnecessary KV writes

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
          isSelected: restaurant.isSelected,
        })),
        date: urlDate,
        timeSlot: timeSlot,
      };

      console.info('LanchDrap: Tracking restaurant appearances', {
        date: urlDate,
        restaurantCount: trackingData.restaurants.length,
        restaurantIds: trackingData.restaurants.map((r) => r.id),
        restaurantNames: trackingData.restaurants.map((r) => r.name),
        timeSlot: timeSlot,
        fullTrackingData: trackingData,
      });

      const result = await apiClient.trackRestaurantAppearances(trackingData);

      // Log the result for debugging
      if (result && result.success) {
        console.info('LanchDrap: Restaurant tracking completed for date', urlDate, {
          restaurantsTracked: result.data?.totalRestaurants || 0,
          restaurantsWithChanges: result.data?.restaurantsWithChanges || 0,
          message: result.message,
        });
      }

      return result; // Return the result so it can be used in the main flow
    } catch (_error) {
      console.error('LanchDrap: Restaurant tracking failed for date', urlDate, _error);
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

      console.info('LanchDrap: Sell out analysis', {
        totalRestaurants: restaurantsWithRates.length,
        restaurantsWithValidRates: restaurantsWithValidRates.length,
        sellOutRates: restaurantsWithValidRates.map((r) => ({
          id: r.id,
          name: r.name,
          rate: r.sellOutRate,
        })),
      });

      if (restaurantsWithValidRates.length === 0) {
        console.info('LanchDrap: No restaurants with sell out data');
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

      console.info('LanchDrap: Sell out indicator decision', {
        highestRestaurant: {
          id: highestSellOutRestaurant.id,
          name: highestSellOutRestaurant.name,
          rate: highestSellOutRestaurant.sellOutRate,
        },
        secondHighestRate,
        configuration: {
          sellOutThreshold,
          minDifference,
        },
        shouldShowIndicator,
        reason: shouldShowIndicator
          ? restaurantsWithValidRates.length === 1
            ? 'Single restaurant with high rate'
            : 'Significantly higher than others'
          : 'Not significantly higher or below threshold',
      });

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

  // Function to report availability summary
  function reportAvailabilitySummary(availabilityData) {
    try {
      // Check if utilities are loaded
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        // Store data locally for later submission
        storeAvailabilitySummaryLocally(availabilityData);
        return;
      }

      const urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      // Validate data before sending
      if (!availabilityData || availabilityData.length === 0) {
        return;
      }

      const summary = {
        totalRestaurants: availabilityData.length,
        available: availabilityData.filter((r) => r.status === 'available').length,
        soldout: availabilityData.filter((r) => r.status === 'soldout').length,
        limited: availabilityData.filter((r) => r.status === 'limited').length,
        urlDate: urlDate,
        timestamp: new Date().toISOString(),
        timeSlot: availabilityData[0]?.timeSlot?.full || 'Unknown',
        city: window.LanchDrapDOMUtils.extractCityFromUrl(),
      };

      // Validate required fields
      if (!summary.totalRestaurants || !summary.timestamp) {
        return;
      }

      // Availability summary endpoint removed - no longer sending summaries
    } catch (_error) {}
  }

  // Function to store availability summary locally when utilities aren't loaded
  function storeAvailabilitySummaryLocally(availabilityData) {
    try {
      const urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      const summary = {
        totalRestaurants: availabilityData.length,
        available: availabilityData.filter((r) => r.status === 'available').length,
        soldout: availabilityData.filter((r) => r.status === 'soldout').length,
        limited: availabilityData.filter((r) => r.status === 'limited').length,
        urlDate: urlDate,
        timestamp: new Date().toISOString(),
        timeSlot: availabilityData[0]?.timeSlot?.full || 'Unknown',
        city: window.LanchDrapDOMUtils.extractCityFromUrl(),
        pendingSubmission: true,
      };

      // Store in localStorage for later submission
      const pendingSummaries = JSON.parse(
        localStorage.getItem('pendingAvailabilitySummaries') || '[]'
      );
      pendingSummaries.push(summary);
      localStorage.setItem('pendingAvailabilitySummaries', JSON.stringify(pendingSummaries));
    } catch (_error) {}
  }

  // Function to get restaurant availability data (for other modules)
  function getRestaurantAvailabilityData() {
    return restaurantAvailabilityData;
  }

  // Return public API
  return {
    scrapeRestaurantAvailability,
    getRestaurantAvailabilityData,
  };
})();
