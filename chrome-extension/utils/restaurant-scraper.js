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
      // CRITICAL: Validate that we're processing cards for the correct date
      const currentUrlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      if (currentUrlDate !== urlDate) {
        return null;
      }

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
      // Add a small delay to ensure navigation has settled
      setTimeout(() => {
        trackRestaurantAppearances(availabilityData)
          .then((result) => {
            // Add sellout indicators when tracking completes
            if (result?.data?.data?.restaurants || result?.data?.restaurants) {
              const restaurants = result.data.data?.restaurants || result.data.restaurants;
              if (restaurants && Array.isArray(restaurants)) {
                // Add indicators
                addSellOutIndicators(restaurants);
              }
            }
          })
          .catch((_error) => {});
      }, 200); // Small delay to ensure navigation has settled

      // Display stats for selected restaurant on daily pages
      if (window.LanchDrapStatsDisplay?.displaySelectedRestaurantStats) {
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
        if (!href || !/\/app\/.*\/[a-zA-Z0-9]+/.test(href)) {
          return false;
        }

        // CRITICAL: Only include cards that match the current URL date
        const hrefDateMatch = href.match(/\/app\/(\d{4}-\d{2}-\d{2})/);
        if (!hrefDateMatch || hrefDateMatch[1] !== urlDate) {
          return false;
        }

        return true;
      });

      if (restaurantCards.length === 0) {
        // Try to find valid restaurant cards with a broader search
        const allPageAppLinks = document.querySelectorAll('a[href*="/app/"]');

        const validPageLinks = Array.from(allPageAppLinks).filter((link) => {
          const href = link.getAttribute('href');
          if (!href || !/\/app\/.*\/[a-zA-Z0-9]+/.test(href)) {
            return false;
          }

          // CRITICAL: Only include cards that match the current URL date
          const hrefDateMatch = href.match(/\/app\/(\d{4}-\d{2}-\d{2})/);
          if (!hrefDateMatch || hrefDateMatch[1] !== urlDate) {
            return false;
          }

          return true;
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
      if (!availabilityData || availabilityData.length === 0) {
        return;
      }

      // Use the date from the first restaurant's URL date (they should all be the same)
      const urlDate = availabilityData[0]?.urlDate;
      if (!urlDate) {
        return;
      }

      const storageKey = `availability:${urlDate}`;
      const existingData = localStorage.getItem(storageKey);
      let dailyData = [];

      if (existingData) {
        try {
          const parsedData = JSON.parse(existingData);

          // Check if data has TTL format and if it's expired
          if (parsedData.expiresAt && parsedData.data) {
            const expiresAt = new Date(parsedData.expiresAt);
            if (new Date() < expiresAt) {
              dailyData = parsedData.data;
            } else {
              // Data is expired, remove it
              localStorage.removeItem(storageKey);
            }
          } else {
            // Legacy format (no TTL), use the data directly
            dailyData = Array.isArray(parsedData) ? parsedData : [];
          }
        } catch (_error) {
          // If parsing fails, treat as empty data
          dailyData = [];
        }
      }

      // Add timestamp to each record
      const timestampedData = availabilityData.map((item) => ({
        ...item,
        scrapedAt: new Date().toISOString(),
      }));

      // Create a Set to track existing restaurant IDs to prevent duplicates
      const existingRestaurantIds = new Set(
        dailyData.map((item) => `${item.id}-${item.timeSlot?.start}-${item.timeSlot?.end}`)
      );

      // Only add new records that don't already exist
      const newRecords = timestampedData.filter((item) => {
        const recordKey = `${item.id}-${item.timeSlot?.start}-${item.timeSlot?.end}`;
        return !existingRestaurantIds.has(recordKey);
      });

      // If we have new records, add them
      if (newRecords.length > 0) {
        dailyData.push(...newRecords);
      }

      // Keep only last 50 records per day (reduced from 100 to prevent excessive storage)
      if (dailyData.length > 50) {
        dailyData = dailyData.slice(-50);
      }

      // Store data with TTL (Time To Live) - expires in 10 days
      const dataWithTTL = {
        data: dailyData,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(storageKey, JSON.stringify(dataWithTTL));
    } catch (_error) {}
  }

  // Function to clean up old availability data from localStorage
  function cleanupOldAvailabilityData() {
    try {
      const today = new Date();
      const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Get all localStorage keys that start with 'availability:'
      const availabilityKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith('availability:')
      );

      for (const key of availabilityKeys) {
        try {
          const data = localStorage.getItem(key);
          if (!data) continue;

          const parsedData = JSON.parse(data);

          // Check TTL expiration first (new format)
          if (parsedData.expiresAt) {
            const expiresAt = new Date(parsedData.expiresAt);
            if (new Date() >= expiresAt) {
              localStorage.removeItem(key);
              continue;
            }
          }

          // Fallback: check date-based expiration (legacy format)
          const dateStr = key.replace('availability:', '');
          const keyDate = new Date(dateStr);
          if (keyDate < tenDaysAgo) {
            localStorage.removeItem(key);
          }
        } catch (_error) {
          // If we can't parse the data, remove it
          localStorage.removeItem(key);
        }
      }
    } catch (_error) {
      // Silently fail if cleanup encounters issues
    }
  }

  // Cleanup function to cancel all tracking when page unloads
  function cleanupTrackingOnUnload() {
    if (window.lanchDrapTrackingAbortController) {
      window.lanchDrapTrackingAbortController.abort();
      window.lanchDrapTrackingAbortController = null;
    }
  }

  // Add cleanup listeners
  window.addEventListener('beforeunload', cleanupTrackingOnUnload);
  window.addEventListener('pagehide', cleanupTrackingOnUnload);

  // Function to track restaurant appearances on daily pages
  async function trackRestaurantAppearances(availabilityData) {
    try {
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        return;
      }

      // Use a single global abort controller for tracking (like stats display)
      if (window.lanchDrapTrackingAbortController) {
        window.lanchDrapTrackingAbortController.abort();
      }
      window.lanchDrapTrackingAbortController = new AbortController();

      // Store current URL to validate against when response comes back
      const currentUrl = window.location.href;

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

      const result = await apiClient.trackRestaurantAppearances(
        trackingData,
        window.lanchDrapTrackingAbortController.signal
      );

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
      if (window.location.href !== currentUrl) {
        return null;
      }

      // Also check if the date in the URL changed during the request
      const currentUrlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      if (currentUrlDate !== urlDate) {
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

  // Function to get availability data from localStorage with TTL support
  function getAvailabilityDataFromStorage(urlDate) {
    try {
      const storageKey = `availability:${urlDate}`;
      const existingData = localStorage.getItem(storageKey);

      if (!existingData) return null;

      const parsedData = JSON.parse(existingData);

      // Check if data has TTL format and if it's expired
      if (parsedData.expiresAt && parsedData.data) {
        const expiresAt = new Date(parsedData.expiresAt);
        if (new Date() < expiresAt) {
          return parsedData.data;
        } else {
          // Data is expired, remove it
          localStorage.removeItem(storageKey);
          return null;
        }
      } else {
        // Legacy format (no TTL), return the data directly
        return Array.isArray(parsedData) ? parsedData : null;
      }
    } catch (_error) {
      return null;
    }
  }

  // Function to clear restaurant availability data (for navigation cleanup)
  function clearRestaurantAvailabilityData() {
    restaurantAvailabilityData = null;
  }

  // Function to manually clean up all expired data (can be called from console)
  function cleanupAllExpiredData() {
    try {
      const allKeys = Object.keys(localStorage);
      let cleanedCount = 0;

      for (const key of allKeys) {
        if (key.startsWith('availability:')) {
          try {
            const data = localStorage.getItem(key);
            if (!data) continue;

            const parsedData = JSON.parse(data);

            // Check TTL expiration
            if (parsedData.expiresAt) {
              const expiresAt = new Date(parsedData.expiresAt);
              if (new Date() >= expiresAt) {
                localStorage.removeItem(key);
                cleanedCount++;
              }
            }
          } catch (_error) {
            // If we can't parse the data, remove it
            localStorage.removeItem(key);
            cleanedCount++;
          }
        }
      }

      console.log(`Cleaned up ${cleanedCount} expired availability records`);
      return cleanedCount;
    } catch (_error) {
      console.error('Error cleaning up expired data:', _error);
      return 0;
    }
  }

  // Initialize cleanup on load
  cleanupOldAvailabilityData();

  // Return public API
  return {
    scrapeRestaurantAvailability,
    getRestaurantAvailabilityData,
    getAvailabilityDataFromStorage,
    clearRestaurantAvailabilityData,
    cleanupOldAvailabilityData,
    cleanupAllExpiredData,
  };
})();
