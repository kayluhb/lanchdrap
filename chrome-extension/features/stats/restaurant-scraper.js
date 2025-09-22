// Restaurant data utilities for LanchDrap extension
// Handles restaurant availability data loading from JSON (no scraping)

// Create global namespace for restaurant data utilities
window.LanchDrapRestaurantScraper = (() => {
  let restaurantAvailabilityData = null;

  // Function to load restaurant availability data from JSON with navigation logic
  async function loadRestaurantAvailability(options = {}) {
    try {
      console.log('LanchDrap: loadRestaurantAvailability called');

      const prefer = options.prefer === 'api' ? 'api' : 'page';
      const urlDate = window.LanchDrapJsonDataLoader?.extractDateFromUrl();

      if (prefer === 'page') {
        // 1) Try initial page render data first
        const pageDataAvailability =
          window.LanchDrapJsonDataLoader?.extractRestaurantAvailability();
        if (pageDataAvailability && pageDataAvailability.length > 0) {
          console.log('LanchDrap: Using availability data from page data');
          scheduleTrackingAndIndicators(pageDataAvailability);
          return pageDataAvailability;
        }

        // 2) Fallback to API if page data missing
        if (urlDate) {
          const apiAvailability = await fetchAvailabilityFromInertia(urlDate);
          if (apiAvailability && apiAvailability.length > 0) {
            console.log('LanchDrap: Using availability data from API fallback');
            scheduleTrackingAndIndicators(apiAvailability);
            return apiAvailability;
          }
        }
      } else {
        // prefer === 'api' path: 1) API first
        if (urlDate) {
          const apiAvailability = await fetchAvailabilityFromInertia(urlDate);
          if (apiAvailability && apiAvailability.length > 0) {
            console.log('LanchDrap: Using availability data from API');
            scheduleTrackingAndIndicators(apiAvailability);
            return apiAvailability;
          }
        }
        // No page-data fallback when preferring API to avoid stale renders
        return null;
      }

      console.log('LanchDrap: No availability data found');
      return null;
    } catch (error) {
      console.log('LanchDrap: Error loading restaurant availability:', error);
      return null;
    }
  }

  // Helper: read Inertia version and base headers from current page
  function getInertiaHeaders() {
    try {
      let version = null;
      if (typeof window !== 'undefined' && window.app?.dataset?.page) {
        try {
          const pageData = JSON.parse(window.app.dataset.page);
          version = pageData?.version || null;
        } catch (_e) {}
      }

      const headers = {
        Accept: 'application/json, text/html',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
      };
      if (version) headers['X-Inertia-Version'] = version;
      return headers;
    } catch (_error) {
      return {
        Accept: 'application/json, text/html',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
      };
    }
  }

  // Fetch lunch day data via Inertia JSON endpoint for day navigation
  async function fetchAvailabilityFromInertia(urlDate) {
    try {
      if (!urlDate) return null;

      const currentUrl = window.location.href;
      const origin = window.location.origin;
      const headers = getInertiaHeaders();

      let response = await fetch(`${origin}/app/${urlDate}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      // Handle Inertia 409 responses (version mismatch) with location redirect
      if (response.status === 409) {
        const location = response.headers.get('X-Inertia-Location');
        if (location) {
          response = await fetch(location, {
            method: 'GET',
            headers,
            credentials: 'include',
          });
        }
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Validate we're still on same page and date
      if (window.location.href !== currentUrl) return null;
      const stillUrlDate = window.LanchDrapJsonDataLoader?.extractDateFromUrl();
      if (stillUrlDate !== urlDate) return null;

      // API response structure: data is the delivery object directly
      // Page data structure: data.props.delivery is the delivery object
      const delivery = data?.props?.delivery || data;
      const orderHistory = delivery?.orders;

      if (delivery?.restaurant) {
        return processDeliveriesData([delivery], orderHistory);
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  // Process deliveries data into availability format (shared by page data and API)
  function processDeliveriesData(deliveries, orderHistory, deliveryData = null) {
    try {
      if (!Array.isArray(deliveries) || deliveries.length === 0) {
        return null;
      }

      const urlDate = window.LanchDrapJsonDataLoader?.extractDateFromUrl();
      if (!urlDate) {
        console.log('LanchDrap: No URL date found for processing deliveries');
        return null;
      }

      const availabilityData = deliveries.map((delivery, index) => {
        const restaurant = delivery.restaurant;
        const now = new Date();

        // Determine status based on delivery data
        let status = 'available';
        let reason = null;
        let hasSoldOutInCard = false;

        if (delivery.numSlotsAvailable === 0) {
          status = 'soldout';
          reason = 'No delivery slots available';
          hasSoldOutInCard = true;
        } else if (delivery.isCancelled) {
          status = 'soldout';
          reason = delivery.cancelledReason ?? 'Delivery cancelled';
          hasSoldOutInCard = true;
        } else if (delivery.isSuspended) {
          status = 'soldout';
          reason = 'Restaurant suspended';
          hasSoldOutInCard = true;
        } else if (!delivery.isTakingOrders) {
          status = 'soldout';
          reason = 'Not taking orders';
          hasSoldOutInCard = true;
        }

        // Extract menu data from delivery
        const menuData = extractMenuFromDelivery(delivery);

        // Extract order history menu data
        const orderHistoryMenuData = extractMenuFromOrderHistory(orderHistory);

        // Combine menu data
        const combinedMenuData = [...menuData, ...orderHistoryMenuData];

        return {
          index,
          id: restaurant.id,
          name: restaurant.name,
          restaurant: restaurant.name,
          status: status,
          reason: reason,
          timeSlot: {
            start: '12:15pm',
            end: '1:15pm',
            full: '12:15pm-1:15pm',
          },
          href: `/app/${urlDate}/${delivery.id}`,
          urlDate: urlDate,
          timestamp: now.toISOString(),
          isSelected: false, // Will be set based on URL
          color: restaurant.brandColor,
          logo: restaurant.logo,
          visualIndicators: {
            opacity: '1',
            borderColor: 'transparent',
            hasOrderPlaced: false,
            hasOrderingClosed: false,
            hasSoldOutInCard: hasSoldOutInCard,
          },
          menu: combinedMenuData,
          orderHistory: orderHistory,
          numSlotsAvailable: delivery.numSlotsAvailable,
        };
      });

      // Mark selected restaurant based on URL and delivery data
      markSelectedRestaurant(availabilityData, deliveryData);

      return availabilityData;
    } catch (error) {
      console.log('LanchDrap: Error processing deliveries data:', error);
      return null;
    }
  }

  // Function to extract menu data from delivery
  function extractMenuFromDelivery(delivery) {
    try {
      if (!delivery.menu || !delivery.menu.sections || !delivery.menu.items) {
        console.log('LanchDrap: No menu data available in delivery');
        return [];
      }

      const sections = delivery.menu.sections;
      const items = delivery.menu.items;

      // Create a map of item IDs to items for quick lookup
      const itemMap = new Map();
      for (const item of items) {
        itemMap.set(item.id, item);
      }

      console.log(
        `LanchDrap: Processing menu with ${sections.length} sections and ${items.length} items`
      );

      // Build menu items with section labels
      const menuItems = [];

      for (const section of sections) {
        if (section.items && Array.isArray(section.items)) {
          for (const itemId of section.items) {
            const item = itemMap.get(itemId);
            if (item) {
              menuItems.push({
                id: item.id,
                label: item.label,
                description: item.description || '',
                price: item.price || 0,
                basePrice: item.basePrice || 0,
                maxPrice: item.maxPrice || 0,
                section: section.label || 'Unknown',
                sectionSortOrder: section.sort_order || 0,
                isEntree: item.isEntree || false,
                isFavorite: item.isFavorite || false,
                isSpicy1: item.isSpicy1 || false,
                isSpicy2: item.isSpicy2 || false,
                isSpicy3: item.isSpicy3 || false,
                isGlutenFree: item.isGlutenFree || false,
                isVegetarian: item.isVegetarian || false,
                isNutAllergy: item.isNutAllergy || false,
                picture: item.picture || '',
                rating: item.rating || 0,
                reviews: item.reviews || 0,
              });
            }
          }
        }
      }

      console.log(`LanchDrap: Extracted ${menuItems.length} menu items from delivery`);
      return menuItems;
    } catch (error) {
      console.log('LanchDrap: Error extracting menu data from delivery:', error);
      return [];
    }
  }

  // Function to extract menu data from order history
  function extractMenuFromOrderHistory(orderHistory) {
    try {
      if (!orderHistory || !Array.isArray(orderHistory) || orderHistory.length === 0) {
        console.log('LanchDrap: No order history data available');
        return [];
      }

      console.log(`LanchDrap: Processing order history with ${orderHistory.length} orders`);

      // Use the order history parser to convert orders to menu items
      if (window.LanchDrapOrderHistoryParser) {
        const menuItems = window.LanchDrapOrderHistoryParser.convertOrdersToMenuItems(orderHistory);
        console.log(`LanchDrap: Extracted ${menuItems.length} menu items from order history`);
        return menuItems;
      } else {
        console.log(
          'LanchDrap: Order history parser not available, falling back to manual parsing'
        );
        return extractMenuFromOrderHistoryManual(orderHistory);
      }
    } catch (error) {
      console.log('LanchDrap: Error extracting menu data from order history:', error);
      return [];
    }
  }

  // Manual fallback for extracting menu data from order history
  function extractMenuFromOrderHistoryManual(orderHistory) {
    try {
      const menuItems = [];
      const seenItems = new Set(); // To avoid duplicates

      orderHistory.forEach((order, orderIndex) => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item, itemIndex) => {
            // Create a unique key for this item to avoid duplicates
            const itemKey = `${item.label}_${item.price}`;

            if (!seenItems.has(itemKey)) {
              seenItems.add(itemKey);

              menuItems.push({
                id: item.id || `order_item_${orderIndex}_${itemIndex}`,
                label: item.label || 'Unknown Item',
                description: item.description || '',
                price: item.price || 0,
                basePrice: item.price || 0,
                maxPrice: item.price || 0,
                section: 'Order History',
                sectionSortOrder: 999,
                isEntree: true,
                isFavorite: false,
                isSpicy1: false,
                isSpicy2: false,
                isSpicy3: false,
                isGlutenFree: false,
                isVegetarian: false,
                isNutAllergy: false,
                picture: '',
                rating: 0,
                reviews: 0,
                orderHistory: {
                  orderId: order.id,
                  quantity: item.quantity,
                  modifications: item.modifications,
                  specialRequest: item.specialRequest,
                  fullDescription: item.fullDescription || item.label,
                },
              });
            }
          });
        }
      });

      console.log(
        `LanchDrap: Manually extracted ${menuItems.length} unique menu items from order history`
      );
      return menuItems;
    } catch (error) {
      console.log('LanchDrap: Error in manual order history extraction:', error);
      return [];
    }
  }

  // Mark the selected restaurant based on current URL and page data
  function markSelectedRestaurant(availabilityData, deliveryData = null) {
    try {
      const path = window.location.pathname || '';
      const parts = path.split('/').filter(Boolean);

      if (parts.length >= 3 && parts[0] === 'app') {
        // On restaurant detail page
        const currentDeliveryId = parts[2];
        for (const r of availabilityData) {
          r.isSelected = r.href?.endsWith(`/${currentDeliveryId}`);
        }
      } else if (parts.length === 2 && parts[0] === 'app') {
        // On day page - check for selected delivery in page data or delivery data
        const pageData = window.LanchDrapJsonDataLoader?.extractPageData();
        const selectedDeliveryId = deliveryData?.id || pageData?.props?.delivery?.id;
        const selectedRestaurantId =
          deliveryData?.restaurant?.id || pageData?.props?.delivery?.restaurant?.id;

        let selected = false;
        if (selectedDeliveryId) {
          for (const r of availabilityData) {
            if (r.href?.endsWith(`/${selectedDeliveryId}`)) {
              r.isSelected = true;
              selected = true;
              break;
            }
          }
        }
        if (!selected && selectedRestaurantId) {
          for (const r of availabilityData) {
            r.isSelected = r.id === selectedRestaurantId;
            if (r.isSelected) selected = true;
          }
        }
        if (!selected && availabilityData.length > 0) {
          availabilityData[0].isSelected = true;
        }
      } else if (parts.length === 1 && parts[0] === 'app') {
        // On /app (today's page) - check for selected delivery in page data or delivery data
        const pageData = window.LanchDrapJsonDataLoader?.extractPageData();
        const selectedDeliveryId = deliveryData?.id || pageData?.props?.delivery?.id;
        const selectedRestaurantId =
          deliveryData?.restaurant?.id || pageData?.props?.delivery?.restaurant?.id;

        let selected = false;
        if (selectedDeliveryId) {
          for (const r of availabilityData) {
            if (r.href?.endsWith(`/${selectedDeliveryId}`)) {
              r.isSelected = true;
              selected = true;
              break;
            }
          }
        }
        if (!selected && selectedRestaurantId) {
          for (const r of availabilityData) {
            r.isSelected = r.id === selectedRestaurantId;
            if (r.isSelected) selected = true;
          }
        }
        if (!selected && availabilityData.length > 0) {
          availabilityData[0].isSelected = true;
        }
      }

      // Ensure at least one selection exists
      if (!availabilityData.some((r) => r.isSelected) && availabilityData.length > 0) {
        availabilityData[0].isSelected = true;
      }
    } catch (error) {
      console.log('LanchDrap: Error marking selected restaurant:', error);
    }
  }

  // [Removed] Local storage of scraped availability - not needed

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

  // Helper: schedule tracking and sell-out indicators for availability
  function scheduleTrackingAndIndicators(availabilityData) {
    try {
      setTimeout(() => {
        // Only track on day overview pages. Skip on detail pages.
        const isDayOverview = window.LanchDrapJsonDataLoader?.isDayOverviewPage();
        if (!isDayOverview) return;

        trackRestaurantAppearances(availabilityData)
          .then((result) => {
            try {
              const restaurants =
                result?.data?.data?.restaurants || result?.data?.restaurants || null;
              if (restaurants && Array.isArray(restaurants)) {
                addSellOutIndicators(restaurants);
              }
            } catch (_e) {}
          })
          .catch((_error) => {});
      }, 200);
    } catch (_e) {}
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

  // [Removed] Reporting availability summary - not needed

  // [Removed] Local summary storage - not needed

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
      return cleanedCount;
    } catch (_error) {
      return 0;
    }
  }

  // Initialize cleanup on load
  cleanupOldAvailabilityData();

  // Return public API
  return {
    loadRestaurantAvailability,
    getRestaurantAvailabilityData,
    getAvailabilityDataFromStorage,
    clearRestaurantAvailabilityData,
    cleanupOldAvailabilityData,
    cleanupAllExpiredData,
  };
})();
