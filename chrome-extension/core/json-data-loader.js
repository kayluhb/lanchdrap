// JSON Data Loader for LanchDrap extension
// Replaces scraping functionality with pure JSON data extraction from page props

// Create global namespace for JSON data loader
window.LanchDrapJsonDataLoader = (() => {
  /**
   * Extract all available data from page props
   * @returns {Object} Complete page data structure
   */
  function extractPageData() {
    try {
      console.log('LanchDrap: extractPageData called');

      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          try {
            const pageData = JSON.parse(appElement.dataset.page);
            console.log('LanchDrap: Successfully extracted page data:', pageData);
            return pageData;
          } catch (error) {
            console.log('LanchDrap: Error parsing page data:', error);
            return null;
          }
        } else {
          console.log('LanchDrap: No page dataset found');
          return null;
        }
      } else {
        console.log('LanchDrap: No window.app found');
        return null;
      }
    } catch (error) {
      console.log('LanchDrap: Error in extractPageData:', error);
      return null;
    }
  }

  /**
   * Extract restaurant availability data from page props
   * @returns {Array|null} Array of restaurant availability data
   */
  function extractRestaurantAvailability() {
    try {
      const pageData = extractPageData();
      if (!pageData) return null;

      const props = pageData.props;
      if (!props) return null;

      // Look for deliveries in props.lunchDay.deliveries
      const deliveries = props.lunchDay?.deliveries;
      const singleDelivery = props.delivery;
      const orderHistory = props.delivery?.orders;

      console.log('LanchDrap: Found deliveries:', deliveries);
      console.log('LanchDrap: Found single delivery:', singleDelivery);
      console.log('LanchDrap: Found order history:', orderHistory);

      if (deliveries && Array.isArray(deliveries) && deliveries.length > 0) {
        return processDeliveriesData(deliveries, orderHistory);
      } else if (singleDelivery?.restaurant) {
        return processDeliveriesData([singleDelivery], orderHistory);
      }

      return null;
    } catch (error) {
      console.log('LanchDrap: Error extracting restaurant availability:', error);
      return null;
    }
  }

  /**
   * Process deliveries data into availability format
   * @param {Array} deliveries - Array of delivery objects
   * @param {Array} orderHistory - Order history data
   * @returns {Array} Processed availability data
   */
  function processDeliveriesData(deliveries, orderHistory) {
    try {
      if (!Array.isArray(deliveries) || deliveries.length === 0) {
        return null;
      }

      const urlDate = extractDateFromUrl();
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

      // Mark selected restaurant based on URL
      markSelectedRestaurant(availabilityData);

      return availabilityData;
    } catch (error) {
      console.log('LanchDrap: Error processing deliveries data:', error);
      return null;
    }
  }

  /**
   * Extract menu data from delivery object
   * @param {Object} delivery - Delivery object containing menu data
   * @returns {Array} Array of menu items
   */
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

  /**
   * Extract menu data from order history
   * @param {Array} orderHistory - Order history data
   * @returns {Array} Array of menu items from order history
   */
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

  /**
   * Manual fallback for extracting menu data from order history
   * @param {Array} orderHistory - Order history data
   * @returns {Array} Array of menu items
   */
  function extractMenuFromOrderHistoryManual(orderHistory) {
    try {
      const menuItems = [];
      const seenItems = new Set(); // To avoid duplicates

      // Manual fallback for extracting menu data from order history
      for (const order of orderHistory) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
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
          }
        }
      }

      console.log(
        `LanchDrap: Manually extracted ${menuItems.length} unique menu items from order history`
      );
      return menuItems;
    } catch (error) {
      console.log('LanchDrap: Error in manual order history extraction:', error);
      return [];
    }
  }

  /**
   * Mark the selected restaurant based on current URL
   * @param {Array} availabilityData - Array of restaurant availability data
   */
  function markSelectedRestaurant(availabilityData) {
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
        // On day page - check for selected delivery in page data
        const pageData = extractPageData();
        const selectedDeliveryId = pageData?.props?.delivery?.id;
        const selectedRestaurantId = pageData?.props?.delivery?.restaurant?.id;

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
        // On /app (today's page) - check for selected delivery in page data
        const pageData = extractPageData();
        const selectedDeliveryId = pageData?.props?.delivery?.id;
        const selectedRestaurantId = pageData?.props?.delivery?.restaurant?.id;

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

  /**
   * Extract order history data from page props
   * @returns {Object} Order history data with orders and delivery info
   */
  function extractOrderHistory() {
    try {
      console.log('LanchDrap: extractOrderHistory called');
      const pageData = extractPageData();
      console.log('LanchDrap: Page data from extractPageData:', pageData);

      if (!pageData) {
        console.log('LanchDrap: No page data available, returning empty orders');
        return { orders: [], delivery: null };
      }

      const props = pageData.props;
      console.log('LanchDrap: Props from page data:', props);

      if (!props) {
        console.log('LanchDrap: No props in page data, returning empty orders');
        return { orders: [], delivery: null };
      }

      const orders = props.delivery?.orders;
      const delivery = props.delivery;

      console.log('LanchDrap: Found orders in page data:', orders);
      console.log('LanchDrap: Found delivery data:', delivery);
      console.log('LanchDrap: Orders is array:', Array.isArray(orders));
      console.log('LanchDrap: Orders length:', orders?.length);

      if (orders && Array.isArray(orders)) {
        console.log('LanchDrap: Processing orders array with OrderHistoryParser');
        // Use the order history parser to parse the orders
        if (window.LanchDrapOrderHistoryParser) {
          console.log('LanchDrap: OrderHistoryParser available, parsing orders...');
          const parsedOrders = window.LanchDrapOrderHistoryParser.parseOrders(orders);
          console.log('LanchDrap: Parsed orders result:', parsedOrders);
          return {
            orders: parsedOrders,
            delivery: delivery,
          };
        } else {
          console.log('LanchDrap: OrderHistoryParser not available, using raw orders');
          // Fallback to raw orders if parser not available
          return {
            orders: orders,
            delivery: delivery,
          };
        }
      } else {
        console.log('LanchDrap: Orders not found or not an array, checking props structure:', {
          hasDelivery: !!props.delivery,
          deliveryKeys: props.delivery ? Object.keys(props.delivery) : null,
          propsKeys: Object.keys(props),
        });
      }

      console.log('LanchDrap: Returning empty orders from extractOrderHistory');
      return { orders: [], delivery: null };
    } catch (error) {
      console.log('LanchDrap: Error extracting order history:', error);
      return { orders: [], delivery: null };
    }
  }

  /**
   * Extract restaurant context from page props
   * @returns {Object} Restaurant context data
   */
  function extractRestaurantContext() {
    try {
      const pageData = extractPageData();
      if (!pageData) return { id: null, name: null, hasValidId: false, hasValidName: false };

      const props = pageData.props;
      if (!props) return { id: null, name: null, hasValidId: false, hasValidName: false };

      // Try to get restaurant info from delivery data
      const delivery = props.delivery;
      if (delivery?.restaurant) {
        const restaurant = delivery.restaurant;
        return {
          id: restaurant.id || null,
          name: restaurant.name || null,
          hasValidId: Boolean(restaurant.id?.trim()),
          hasValidName: Boolean(restaurant.name?.trim()),
          color: restaurant.brandColor || null,
          logo: restaurant.logo || null,
        };
      }

      // Fallback: try to extract from URL
      const path = window.location.pathname || '';
      const parts = path.split('/').filter(Boolean);

      if (parts.length >= 3 && parts[0] === 'app') {
        // On delivery detail page - we have a delivery ID but need to find the restaurant
        // This would require looking up the delivery in the deliveries array
        const deliveries = props.lunchDay?.deliveries;
        const currentDeliveryId = parts[2];

        if (deliveries && Array.isArray(deliveries)) {
          const currentDelivery = deliveries.find((d) => d.id === currentDeliveryId);
          if (currentDelivery?.restaurant) {
            const restaurant = currentDelivery.restaurant;
            return {
              id: restaurant.id || null,
              name: restaurant.name || null,
              hasValidId: Boolean(restaurant.id?.trim()),
              hasValidName: Boolean(restaurant.name?.trim()),
              color: restaurant.brandColor || null,
              logo: restaurant.logo || null,
            };
          }
        }
      }

      return { id: null, name: null, hasValidId: false, hasValidName: false };
    } catch (error) {
      console.log('LanchDrap: Error extracting restaurant context:', error);
      return { id: null, name: null, hasValidId: false, hasValidName: false };
    }
  }

  /**
   * Check if we're on a day overview page (daily page)
   * @returns {boolean} True if on day overview page
   */
  function isDayOverviewPage() {
    if (window.LanchDrapDOMUtils?.isDayOverviewPage) {
      return window.LanchDrapDOMUtils.isDayOverviewPage();
    }
    return false;
  }

  /**
   * Check if we're on a delivery detail page
   * @returns {boolean} True if on delivery detail page
   */
  function isDeliveryDetailPage() {
    if (window.LanchDrapDOMUtils?.isDeliveryDetailPage) {
      return window.LanchDrapDOMUtils.isDeliveryDetailPage();
    }
    return false;
  }

  /**
   * Extract date from URL
   * @returns {string|null} Date in YYYY-MM-DD format or null
   */
  function extractDateFromUrl() {
    try {
      const path = window.location.pathname || '';
      const parts = path.split('/').filter(Boolean);

      if (parts.length >= 2 && parts[0] === 'app') {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (datePattern.test(parts[1])) {
          return parts[1];
        }
      }

      // Handle /app or /app/ (today's date) - after filter(Boolean), both become ['app']
      if (parts.length === 1 && parts[0] === 'app') {
        const today = new Date();
        return today.toISOString().split('T')[0];
      }

      return null;
    } catch (error) {
      console.log('LanchDrap: Error extracting date from URL:', error);
      return null;
    }
  }

  // Utility to extract date from a given pageData object
  function extractDateFromUrlFromPageData(pageData) {
    try {
      const url = pageData?.url || window.location.pathname;
      const parts = url.split('/').filter(Boolean);

      if (parts.length >= 2 && parts[0] === 'app') {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (datePattern.test(parts[1])) {
          return parts[1];
        }
      }

      // Handle /app or /app/ (today's date) - after filter(Boolean), both become ['app']
      if (parts.length === 1 && parts[0] === 'app') {
        return new Date().toISOString().slice(0, 10);
      }

      return null;
    } catch (error) {
      console.log('LanchDrap: Error extracting date from page data URL:', error);
      return null;
    }
  }

  // Return public API
  return {
    extractPageData,
    extractRestaurantAvailability,
    extractOrderHistory,
    extractRestaurantContext,
    isDayOverviewPage,
    isDeliveryDetailPage,
    extractDateFromUrl,
    extractDateFromUrlFromPageData,
  };
})();
