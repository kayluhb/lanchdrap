// Restaurant scraping utilities for LanchDrap extension
// Handles restaurant availability scraping and tracking

// Create global namespace for restaurant scraper utilities
window.LanchDrapRestaurantScraper = (() => {
  let restaurantAvailabilityData = null;

  // [Removed] getRestaurantName - not needed with API-provided names

  // [Removed] HTML-based card scraping replaced by API and initial render data

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

      console.log(`LanchDrap: Extracted ${menuItems.length} menu items`);
      return menuItems;
    } catch (error) {
      console.log('LanchDrap: Error extracting menu data:', error);
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

  // Function to extract restaurant availability from page data
  async function extractAvailabilityFromPageData() {
    try {
      console.log('LanchDrap: extractAvailabilityFromPageData called');
      // Check if we have deliveries data (indicates we're on a grid page)
      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          try {
            const pageData = JSON.parse(appElement.dataset.page);
            console.log('LanchDrap: Full page data structure:', pageData);
            console.log(
              'LanchDrap: Looking for deliveries in pageData.props?.lunchDay?.deliveries'
            );
            const deliveries = pageData.props?.lunchDay?.deliveries;

            // Also check for single delivery data (which seems to be the actual structure)
            const singleDelivery = pageData.props?.delivery;
            console.log('LanchDrap: Also checking for single delivery:', singleDelivery);

            // Extract order history from props.delivery.orders
            const orderHistory = pageData.props?.delivery?.orders;
            console.log('LanchDrap: Found order history in page data:', orderHistory);

            if (deliveries && Array.isArray(deliveries)) {
              console.log('LanchDrap: Found deliveries in page data:', deliveries);

              // Extract date from URL for daily tracking
              const urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
              if (!urlDate) {
                return null;
              }

              // Convert deliveries to our availability format
              const availabilityData = deliveries.map((delivery, index) => {
                const restaurant = delivery.restaurant;
                const now = new Date();

                console.log(`LanchDrap: Processing delivery ${index} for ${restaurant.name}:`, {
                  numSlotsAvailable: delivery.numSlotsAvailable,
                  isTakingOrders: delivery.isTakingOrders,
                  isCancelled: delivery.isCancelled,
                  isSuspended: delivery.isSuspended,
                  cancelledReason: delivery.cancelledReason,
                  hasMenu: !!delivery.menu,
                  menuSections: delivery.menu?.sections?.length || 0,
                  menuItems: delivery.menu?.items?.length || 0,
                });

                // Determine status based on delivery data
                let status = 'available';
                let reason = null;
                let hasSoldOutInCard = false;

                // Check for sold-out conditions using delivery data
                if (delivery.numSlotsAvailable === 0) {
                  status = 'soldout';
                  reason = 'No delivery slots available';
                  hasSoldOutInCard = true;
                  console.log(
                    `LanchDrap: ${restaurant.name} marked as soldout - no slots available`
                  );
                } else if (delivery.isCancelled) {
                  status = 'soldout';
                  reason = delivery.cancelledReason ?? 'Delivery cancelled';
                  hasSoldOutInCard = true;
                  console.log(
                    `LanchDrap: ${restaurant.name} marked as soldout - cancelled: ${reason}`
                  );
                } else if (delivery.isSuspended) {
                  status = 'soldout';
                  reason = 'Restaurant suspended';
                  hasSoldOutInCard = true;
                  console.log(`LanchDrap: ${restaurant.name} marked as soldout - suspended`);
                } else if (!delivery.isTakingOrders) {
                  status = 'soldout';
                  reason = 'Not taking orders';
                  hasSoldOutInCard = true;
                  console.log(
                    `LanchDrap: ${restaurant.name} marked as soldout - not taking orders`
                  );
                } else {
                  console.log(`LanchDrap: ${restaurant.name} marked as available`);
                }

                // Extract menu data from delivery and order history
                const menuData = extractMenuFromDelivery(delivery);
                const orderHistoryMenuData = extractMenuFromOrderHistory(orderHistory);

                // Combine menu data from delivery and order history
                const combinedMenuData = [...menuData, ...orderHistoryMenuData];

                return {
                  index,
                  id: restaurant.id, // Use the actual restaurant ID, not delivery ID
                  name: restaurant.name,
                  restaurant: restaurant.name, // Keep for backward compatibility
                  status: status,
                  reason: reason,
                  timeSlot: {
                    start: '12:15pm', // Default lunch time
                    end: '1:15pm',
                    full: '12:15pm-1:15pm',
                  },
                  href: `/app/${urlDate}/${delivery.id}`,
                  urlDate: urlDate,
                  timestamp: now.toISOString(),
                  isSelected: false, // Will set based on URL delivery id if present
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
                  orderHistory: orderHistory, // Include raw order history data
                  numSlotsAvailable: delivery.numSlotsAvailable, // Include slots available for stats display
                };
              });

              // Mark selected restaurant
              try {
                const path = window.location.pathname || '';
                const parts = path.split('/').filter(Boolean);
                if (parts.length >= 3 && parts[0] === 'app') {
                  const currentDeliveryId = parts[2];
                  availabilityData.forEach((r) => {
                    r.isSelected = r.href?.endsWith(`/${currentDeliveryId}`);
                  });
                } else if (parts.length === 2 && parts[0] === 'app') {
                  // On day page: prefer props.delivery.restaurant.id, else first delivery
                  const selectedRestaurantIdFromProps = singleDelivery?.restaurant?.id;
                  if (selectedRestaurantIdFromProps) {
                    for (const r of availabilityData) {
                      r.isSelected = r.id === selectedRestaurantIdFromProps;
                    }
                  } else if (availabilityData.length > 0) {
                    availabilityData[0].isSelected = true;
                  }
                }
              } catch (_e) {}

              // Ensure at least one selection exists
              if (!availabilityData.some((r) => r.isSelected) && availabilityData.length > 0) {
                availabilityData[0].isSelected = true;
              }

              return availabilityData;
            } else {
              console.log(
                'LanchDrap: No deliveries found in page data, deliveries value:',
                deliveries
              );

              // Try to handle single delivery case
              if (singleDelivery?.restaurant) {
                console.log('LanchDrap: Found single delivery, converting to availability data');

                // Extract date from URL for daily tracking
                const urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
                if (!urlDate) {
                  console.log('LanchDrap: No URL date found');
                  return null;
                }

                // Convert single delivery to availability format
                const restaurant = singleDelivery.restaurant;
                const now = new Date();

                console.log(`LanchDrap: Processing single delivery for ${restaurant.name}:`, {
                  numSlotsAvailable: singleDelivery.numSlotsAvailable,
                  isTakingOrders: singleDelivery.isTakingOrders,
                  isCancelled: singleDelivery.isCancelled,
                  isSuspended: singleDelivery.isSuspended,
                  cancelledReason: singleDelivery.cancelledReason,
                  hasMenu: !!singleDelivery.menu,
                  menuSections: singleDelivery.menu?.sections?.length || 0,
                  menuItems: singleDelivery.menu?.items?.length || 0,
                });

                // Determine status based on delivery data
                let status = 'available';
                let reason = null;
                let hasSoldOutInCard = false;

                // Check for sold-out conditions using delivery data
                if (singleDelivery.numSlotsAvailable === 0) {
                  status = 'soldout';
                  reason = 'No delivery slots available';
                  hasSoldOutInCard = true;
                  console.log(
                    `LanchDrap: ${restaurant.name} marked as soldout - no slots available`
                  );
                } else if (singleDelivery.isCancelled) {
                  status = 'soldout';
                  reason = singleDelivery.cancelledReason ?? 'Delivery cancelled';
                  hasSoldOutInCard = true;
                  console.log(
                    `LanchDrap: ${restaurant.name} marked as soldout - cancelled: ${reason}`
                  );
                } else if (singleDelivery.isSuspended) {
                  status = 'soldout';
                  reason = 'Restaurant suspended';
                  hasSoldOutInCard = true;
                  console.log(`LanchDrap: ${restaurant.name} marked as soldout - suspended`);
                } else if (!singleDelivery.isTakingOrders) {
                  status = 'soldout';
                  reason = 'Not taking orders';
                  hasSoldOutInCard = true;
                  console.log(
                    `LanchDrap: ${restaurant.name} marked as soldout - not taking orders`
                  );
                } else {
                  console.log(`LanchDrap: ${restaurant.name} marked as available`);
                }

                // Extract menu data from delivery and order history
                const menuData = extractMenuFromDelivery(singleDelivery);
                const orderHistoryMenuData = extractMenuFromOrderHistory(orderHistory);

                // Combine menu data from delivery and order history
                const combinedMenuData = [...menuData, ...orderHistoryMenuData];

                const availabilityData = [
                  {
                    index: 0,
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
                    href: `/app/${urlDate}/${singleDelivery.id}`,
                    urlDate: urlDate,
                    timestamp: now.toISOString(),
                    isSelected: true, // This is the selected restaurant
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
                    orderHistory: orderHistory, // Include raw order history data
                    numSlotsAvailable: singleDelivery.numSlotsAvailable, // Include slots available for stats display
                  },
                ];

                // Order history processing is now handled in the main tracking flow
                // to avoid duplicate processing and ensure proper restaurant context

                console.log(
                  'LanchDrap: Converted single delivery to availability data:',
                  availabilityData
                );
                return availabilityData;
              }
            }
          } catch (error) {
            console.log('LanchDrap: Error parsing page data for availability:', error);
          }
        } else {
          console.log('LanchDrap: No page dataset found');
        }
      } else {
        console.log('LanchDrap: No window.app found');
      }
      console.log('LanchDrap: extractAvailabilityFromPageData returning null');
      return null;
    } catch (_error) {
      console.log('LanchDrap: Error in extractAvailabilityFromPageData:', _error);
      return null;
    }
  }

  // Helper: build availability objects from deliveries (shared by API and page-data)
  function mapDeliveriesToAvailability(deliveries, orderHistory, urlDate) {
    try {
      if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
        return null;
      }

      const availabilityData = deliveries.map((delivery, index) => {
        const restaurant = delivery.restaurant;
        const now = new Date();

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

        const menuData = extractMenuFromDelivery(delivery);
        const orderHistoryMenuData = extractMenuFromOrderHistory(orderHistory);
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
          isSelected: false, // Will set based on URL delivery id if present
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

      // Mark selected restaurant
      try {
        const path = window.location.pathname || '';
        const parts = path.split('/').filter(Boolean);
        if (parts.length >= 3 && parts[0] === 'app') {
          const currentDeliveryId = parts[2];
          availabilityData.forEach((r) => {
            r.isSelected = r.href?.endsWith(`/${currentDeliveryId}`);
          });
        } else if (parts.length === 2 && parts[0] === 'app') {
          // On day page: prefer the restaurant from existing orders, else first
          let selectedByOrder = false;
          // orderHistory is not passed here; try reading from page data
          const pageOrdersData =
            window.LanchDrapOrderHistoryParser?.extractOrderHistoryFromPageData();
          const pageOrders = pageOrdersData?.orders;
          if (pageOrders && Array.isArray(pageOrders) && pageOrders.length > 0) {
            const firstOrderWithDelivery = pageOrders.find((o) => o && o.deliveryId);
            const orderedDeliveryId = firstOrderWithDelivery?.deliveryId;
            if (orderedDeliveryId) {
              for (const r of availabilityData) {
                if (r.href?.endsWith(`/${orderedDeliveryId}`)) {
                  r.isSelected = true;
                  selectedByOrder = true;
                  break;
                }
              }
            }
          }
          if (!selectedByOrder && availabilityData.length > 0) {
            availabilityData[0].isSelected = true;
          }
        }
      } catch (_e) {}

      // Ensure at least one selection exists
      if (!availabilityData.some((r) => r.isSelected) && availabilityData.length > 0) {
        availabilityData[0].isSelected = true;
      }

      return availabilityData;
    } catch (_error) {
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

  // Try to fetch lunch day data via Inertia JSON endpoint (SPA uses same call)
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
      const props = data?.props;
      if (!props) return null;

      // Validate we're still on same page and date
      if (window.location.href !== currentUrl) return null;
      const stillUrlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      if (stillUrlDate !== urlDate) return null;

      const deliveries = props?.lunchDay?.deliveries;
      const orderHistory = props?.delivery?.orders;
      if (deliveries && Array.isArray(deliveries) && deliveries.length > 0) {
        const availabilityData = mapDeliveriesToAvailability(deliveries, orderHistory, urlDate);

        // Selection on day pages: if props.delivery.restaurant exists, use it; else first
        try {
          const selectedRestaurantIdFromProps = props?.delivery?.restaurant?.id;
          const path = window.location.pathname || '';
          const parts = path.split('/').filter(Boolean);
          const isDayPage = parts.length === 2 && parts[0] === 'app';
          if (isDayPage) {
            if (selectedRestaurantIdFromProps) {
              for (const r of availabilityData) {
                r.isSelected = r.id === selectedRestaurantIdFromProps;
              }
            } else if (availabilityData.length > 0) {
              availabilityData[0].isSelected = true;
            }
          }
        } catch (_e) {}

        return availabilityData;
      }

      // Fallback: single delivery case if it ever happens on this route
      const singleDelivery = props?.delivery;
      if (singleDelivery?.restaurant) {
        const availabilityData = mapDeliveriesToAvailability(
          [singleDelivery],
          orderHistory,
          urlDate
        );
        if (availabilityData && availabilityData.length > 0) {
          availabilityData[0].isSelected = true;
          return availabilityData;
        }
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  // Function to scrape restaurant availability from the main grid
  // options: { prefer: 'page' | 'api' }
  async function scrapeRestaurantAvailability(options = {}) {
    try {
      console.log('LanchDrap: scrapeRestaurantAvailability called');
      const prefer = options.prefer === 'api' ? 'api' : 'page';

      // Quick checks to avoid unnecessary processing
      if (
        document.querySelector('input[type="password"]') ||
        document.body.textContent.includes('Sign in') ||
        document.body.textContent.includes('Phone Number or Email Address')
      ) {
        return null;
      }

      // TEMPORARY: Disable page detection to test tracking
      // Check if we're on an individual restaurant page (not the main grid)
      // Use the proper page detection logic instead of delivery data check
      // if (
      //   window.LanchDrapDOMUtils?.isRestaurantDetailPage &&
      //   window.LanchDrapDOMUtils.isRestaurantDetailPage()
      // ) {
      //   console.log('LanchDrap: Skipping scraping - detected restaurant detail page');
      //   return null; // We're on a restaurant detail page, not the grid
      // }

      console.log('LanchDrap: TEMPORARILY SKIPPING PAGE DETECTION - proceeding with scraping');

      const urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();

      if (prefer === 'page') {
        // 1) Try initial page render data
        const pageDataAvailability = await extractAvailabilityFromPageData();
        if (pageDataAvailability && pageDataAvailability.length > 0) {
          console.log('LanchDrap: Using availability data from page data');
          scheduleTrackingAndIndicators(pageDataAvailability);
          return pageDataAvailability;
        }

        // 2) Fallback to API if page data missing
        if (urlDate) {
          const apiAvailability = await fetchAvailabilityFromInertia(urlDate);
          if (apiAvailability && apiAvailability.length > 0) {
            scheduleTrackingAndIndicators(apiAvailability);
            return apiAvailability;
          }
        }
      } else {
        // prefer === 'api' path: 1) API first
        if (urlDate) {
          const apiAvailability = await fetchAvailabilityFromInertia(urlDate);
          if (apiAvailability && apiAvailability.length > 0) {
            scheduleTrackingAndIndicators(apiAvailability);
            return apiAvailability;
          }
        }
        // No page-data fallback when preferring API to avoid stale renders
        return null;
      }

      // No HTML scraping fallback: rely solely on API or initial page data
      return null;
    } catch (_error) {}
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
          orderHistory: restaurant.orderHistory || [], // Include order history in tracking data
        })),
        date: urlDate,
        timeSlot: timeSlot,
      };

      console.log('LanchDrap: Sending tracking data to API:', trackingData);
      console.log(
        'LanchDrap: Menu and order history data being sent:',
        trackingData.restaurants.map((r) => ({
          id: r.id,
          name: r.name,
          menuItems: r.menu?.length || 0,
          orderHistoryItems: r.orderHistory?.length || 0,
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
        // Only track on day landing pages (grid). Skip on detail pages.
        const isGrid =
          typeof window.LanchDrapDOMUtils?.isRestaurantGridPage === 'function' &&
          window.LanchDrapDOMUtils.isRestaurantGridPage();
        if (!isGrid) return;

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
    scrapeRestaurantAvailability,
    getRestaurantAvailabilityData,
    getAvailabilityDataFromStorage,
    clearRestaurantAvailabilityData,
    cleanupOldAvailabilityData,
    cleanupAllExpiredData,
  };
})();
