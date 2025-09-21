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

            // Extract restaurant ID from page data (primary method)
            let restaurantId = 'unknown';
            let restaurantName = null;

            // Try to get restaurant ID from page data first
            if (window.LanchDrapUserIdManager?.LanchDrapUserIdManager) {
              const userIdManager = new window.LanchDrapUserIdManager.LanchDrapUserIdManager();
              const pageRestaurantId = userIdManager.getLunchdropRestaurantId();
              if (pageRestaurantId) {
                restaurantId = pageRestaurantId;
              }
            }

            // Fallback: try to extract from image URL hash if no page data ID
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

            // Extract logo URL from image
            let logoUrl = null;
            const img = card.querySelector('img');
            if (img?.src) {
              logoUrl = img.src;
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
              logo: logoUrl, // Add the logo URL
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
      console.log('LanchDrap: Scheduling tracking call with data:', availabilityData);
      setTimeout(() => {
        console.log('LanchDrap: Executing tracking call');
        trackRestaurantAppearances(availabilityData)
          .then((result) => {
            console.log('LanchDrap: Tracking completed with result:', result);
            // Add sellout indicators when tracking completes
            if (result?.data?.data?.restaurants || result?.data?.restaurants) {
              const restaurants = result.data.data?.restaurants || result.data.restaurants;
              if (restaurants && Array.isArray(restaurants)) {
                // Add indicators
                addSellOutIndicators(restaurants);
              }
            }
          })
          .catch((error) => {
            console.log('LanchDrap: Tracking error:', error);
            console.log('LanchDrap: Tracking error details:', error.message, error.stack);
          });
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
                  isSelected: false, // We'll need to check DOM for this
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
          isSelected: false,
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
        Accept: 'text/html, application/xhtml+xml',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
      };
      if (version) headers['X-Inertia-Version'] = version;
      return headers;
    } catch (_error) {
      return {
        Accept: 'text/html, application/xhtml+xml',
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
  async function scrapeRestaurantAvailability() {
    try {
      console.log('LanchDrap: scrapeRestaurantAvailability called');

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

      // First, try to use the app's own JSON endpoint (Inertia) for the current day
      const apiUrlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      if (apiUrlDate) {
        const apiAvailability = await fetchAvailabilityFromInertia(apiUrlDate);
        if (apiAvailability && apiAvailability.length > 0) {
          // Track restaurant appearances similarly to page-data path
          setTimeout(() => {
            trackRestaurantAppearances(apiAvailability)
              .then((result) => {
                if (result?.data?.data?.restaurants || result?.data?.restaurants) {
                  const restaurants = result.data.data?.restaurants || result.data.restaurants;
                  if (restaurants && Array.isArray(restaurants)) {
                    addSellOutIndicators(restaurants);
                  }
                }
              })
              .catch((_error) => {});
          }, 200);

          return apiAvailability;
        }
      }

      // Next, try to extract from page data
      const pageDataAvailability = await extractAvailabilityFromPageData();
      if (pageDataAvailability && pageDataAvailability.length > 0) {
        console.log('LanchDrap: Using availability data from page data');

        // Track restaurant appearances in background (don't block UI)
        // Add a small delay to ensure navigation has settled
        console.log('LanchDrap: Scheduling tracking call with page data:', pageDataAvailability);
        setTimeout(() => {
          console.log('LanchDrap: Executing tracking call for page data');
          trackRestaurantAppearances(pageDataAvailability)
            .then((result) => {
              console.log('LanchDrap: Tracking completed with result:', result);
              // Add sellout indicators when tracking completes
              if (result?.data?.data?.restaurants || result?.data?.restaurants) {
                const restaurants = result.data.data?.restaurants || result.data.restaurants;
                if (restaurants && Array.isArray(restaurants)) {
                  // Add indicators
                  addSellOutIndicators(restaurants);
                }
              }
            })
            .catch((error) => {
              console.log('LanchDrap: Tracking error:', error);
              console.log('LanchDrap: Tracking error details:', error.message, error.stack);
            });
        }, 200); // Small delay to ensure navigation has settled

        return pageDataAvailability;
      }

      // Fallback to DOM scraping if page data is not available
      console.log('LanchDrap: Falling back to DOM scraping for availability data');

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

      // Process order history for restaurants that have order data
      if (result?.success && availabilityData) {
        // Only process order history if we have actual order data from the page
        const pageOrderHistoryData =
          window.LanchDrapOrderHistoryParser?.extractOrderHistoryFromPageData();
        const pageOrderHistory = pageOrderHistoryData?.orders;

        if (pageOrderHistory && pageOrderHistory.length > 0) {
          console.log(
            `LanchDrap: Found ${pageOrderHistory.length} orders on page, processing order history`
          );

          // Get user ID for storing order history
          if (window.lanchDrapUserIdManager) {
            try {
              const userId = await window.lanchDrapUserIdManager.getUserId();
              if (userId && window.LanchDrapOrderHistoryParser) {
                // Store order history in background (don't block UI)
                setTimeout(async () => {
                  try {
                    const orderResult =
                      await window.LanchDrapOrderHistoryParser.processAndStoreOrderHistory(
                        userId,
                        'current_restaurant' // We'll determine the actual restaurant ID from context
                      );
                    console.log(`LanchDrap: Order history processing result:`, orderResult);
                  } catch (error) {
                    console.log(`LanchDrap: Error processing order history:`, error);
                  }
                }, 2000); // Delay to avoid blocking UI and after tracking completes
              }
            } catch (error) {
              console.log(`LanchDrap: Error getting user ID for order history:`, error);
            }
          }
        } else {
          console.log('LanchDrap: No order history found on page, skipping order storage');
        }
      }

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
