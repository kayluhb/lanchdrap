// Order history parsing utilities for LanchDrap extension
// Handles extraction and formatting of order data from props.delivery.orders

// Create global namespace for order history parser utilities
window.LanchDrapOrderHistoryParser = (() => {
  /**
   * Extract order history from page data
   * @returns {Object} Object with orders array and delivery info
   */
  function extractOrderHistoryFromPageData() {
    try {
      console.log('LanchDrap: extractOrderHistoryFromPageData called');

      // Check if we have page data with delivery orders
      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          try {
            const pageData = JSON.parse(appElement.dataset.page);
            console.log('LanchDrap: Full page data structure:', pageData);

            // Look for orders in props.delivery.orders
            const orders = pageData.props?.delivery?.orders;
            const delivery = pageData.props?.delivery;
            console.log('LanchDrap: Found orders in page data:', orders);
            console.log('LanchDrap: Found delivery data:', delivery);

            if (orders && Array.isArray(orders)) {
              const parsedOrders = parseOrders(orders);
              return {
                orders: parsedOrders,
                delivery: delivery, // Include delivery data for date extraction
              };
            } else {
              console.log('LanchDrap: No orders found in page data, orders value:', orders);
            }
          } catch (error) {
            console.log('LanchDrap: Error parsing page data for orders:', error);
          }
        } else {
          console.log('LanchDrap: No page dataset found');
        }
      } else {
        console.log('LanchDrap: No window.app found');
      }

      console.log('LanchDrap: extractOrderHistoryFromPageData returning empty object');
      return { orders: [], delivery: null };
    } catch (error) {
      console.log('LanchDrap: Error in extractOrderHistoryFromPageData:', error);
      return { orders: [], delivery: null };
    }
  }

  /**
   * Parse raw order data from props.delivery.orders
   * @param {Array} rawOrders - Raw order data from page
   * @returns {Array} Parsed order objects
   */
  function parseOrders(rawOrders) {
    try {
      if (!Array.isArray(rawOrders)) {
        return [];
      }

      console.log(`LanchDrap: Parsing ${rawOrders.length} orders`);

      const parsedOrders = rawOrders
        .map((order, index) => {
          try {
            return parseOrder(order, index);
          } catch (error) {
            console.log(`LanchDrap: Error parsing order ${index}:`, error);
            return null;
          }
        })
        .filter((order) => order !== null);

      console.log(`LanchDrap: Successfully parsed ${parsedOrders.length} orders`);
      return parsedOrders;
    } catch (error) {
      console.log('LanchDrap: Error parsing orders:', error);
      return [];
    }
  }

  /**
   * Parse a single order object
   * @param {Object} rawOrder - Raw order data
   * @param {number} index - Order index
   * @returns {Object} Parsed order object
   */
  function parseOrder(rawOrder, index) {
    try {
      // Extract basic order information
      const orderId = rawOrder.id || `order_${index}`;
      const userId = rawOrder.userId || '';
      const deliveryId = rawOrder.deliveryId || '';
      const isPaid = rawOrder.isPaid || false;

      // Extract financial information
      const itemsSubtotal = rawOrder.itemsSubtotal || 0;
      const promoAmount = rawOrder.promoAmount || 0;
      const packagingFee = rawOrder.packagingFee || 0;
      const deliveryFee = rawOrder.deliveryFee || 0;
      const supportFee = rawOrder.supportFee || 0;
      const tax = rawOrder.tax || 0;
      const tip = rawOrder.tip || 0;
      const subsidy = rawOrder.subsidy || 0;
      const giftCardAmount = rawOrder.giftCardAmount || 0;
      const amountDue = rawOrder.amountDue || 0;

      // Parse items
      const items = parseOrderItems(rawOrder.items || []);

      // Extract payment method information
      const paymentMethod = rawOrder.paymentMethod || null;

      // Create parsed order object
      const parsedOrder = {
        id: orderId,
        userId: userId,
        deliveryId: deliveryId,
        isPaid: isPaid,
        items: items,
        financial: {
          itemsSubtotal: itemsSubtotal,
          promoAmount: promoAmount,
          packagingFee: packagingFee,
          deliveryFee: deliveryFee,
          supportFee: supportFee,
          tax: tax,
          tip: tip,
          subsidy: subsidy,
          giftCardAmount: giftCardAmount,
          amountDue: amountDue,
          total:
            itemsSubtotal +
            tax +
            tip +
            packagingFee +
            deliveryFee +
            supportFee -
            promoAmount -
            subsidy -
            giftCardAmount,
        },
        paymentMethod: paymentMethod,
        orderAdjustments: rawOrder.orderAdjustments || [],
        needsPaymentInfo: rawOrder.needsPaymentInfo || false,
        useSubsidy: rawOrder.useSubsidy || false,
        doNotUseGiftCard: rawOrder.doNotUseGiftCard || false,
        autoCancelIfDeliveryFee: rawOrder.autoCancelIfDeliveryFee || false,
        isTaxExempt: rawOrder.isTaxExempt || false,
        userToggledTaxExempt: rawOrder.userToggledTaxExempt || false,
        isTipEditable: rawOrder.isTipEditable || false,
        isTipVisible: rawOrder.isTipVisible || false,
        isSupportFeeEditable: rawOrder.isSupportFeeEditable || false,
        isSupportFeeVisible: rawOrder.isSupportFeeVisible || false,
        guestToken: rawOrder.guestToken || null,
        guestLunchContribution: rawOrder.guestLunchContribution || '0.00',
        isTaxEstimated: rawOrder.isTaxEstimated || false,
        parsedAt: new Date().toISOString(),
      };

      console.log(`LanchDrap: Parsed order ${orderId}:`, {
        itemCount: items.length,
        total: parsedOrder.financial.total,
        isPaid: isPaid,
      });

      return parsedOrder;
    } catch (error) {
      console.log(`LanchDrap: Error parsing individual order:`, error);
      return null;
    }
  }

  /**
   * Parse order items from raw order data
   * @param {Array} rawItems - Raw item data
   * @returns {Array} Parsed item objects
   */
  function parseOrderItems(rawItems) {
    try {
      if (!Array.isArray(rawItems)) {
        return [];
      }

      return rawItems
        .map((item, index) => {
          try {
            return parseOrderItem(item, index);
          } catch (error) {
            console.log(`LanchDrap: Error parsing item ${index}:`, error);
            return null;
          }
        })
        .filter((item) => item !== null);
    } catch (error) {
      console.log('LanchDrap: Error parsing order items:', error);
      return [];
    }
  }

  /**
   * Parse a single order item
   * @param {Object} rawItem - Raw item data
   * @param {number} index - Item index
   * @returns {Object} Parsed item object
   */
  function parseOrderItem(rawItem, index) {
    try {
      const itemId = rawItem.id || `item_${index}`;
      const orderId = rawItem.orderId || '';
      const itemIdStr = rawItem.itemId || '';
      const quantity = rawItem.quantity || 1;
      const label = rawItem.label || '';
      const description = rawItem.description || '';
      const price = rawItem.price || 0;
      const specialRequest = rawItem.specialRequest || null;
      const specialRequestRequired = rawItem.specialRequestRequired || '';
      const labelFor = rawItem.labelFor || null;
      const guestToken = rawItem.guestToken || null;

      // Parse modifications
      const modifications = parseModifications(rawItem.modifications || {});

      // Parse payment method for this item
      const paymentMethod = rawItem.paymentMethod || null;

      const parsedItem = {
        id: itemId,
        orderId: orderId,
        itemId: itemIdStr,
        quantity: quantity,
        label: label,
        description: description,
        price: price,
        specialRequest: specialRequest,
        specialRequestRequired: specialRequestRequired,
        labelFor: labelFor,
        guestToken: guestToken,
        modifications: modifications,
        paymentMethod: paymentMethod,
        fullDescription: buildFullDescription(label, description, modifications, specialRequest),
      };

      return parsedItem;
    } catch (error) {
      console.log(`LanchDrap: Error parsing individual item:`, error);
      return null;
    }
  }

  /**
   * Parse modifications from raw modification data
   * @param {Object} rawModifications - Raw modification data
   * @returns {Object} Parsed modifications
   */
  function parseModifications(rawModifications) {
    try {
      if (!rawModifications || typeof rawModifications !== 'object') {
        return {};
      }

      const parsedModifications = {};

      for (const [modId, modValues] of Object.entries(rawModifications)) {
        if (Array.isArray(modValues)) {
          parsedModifications[modId] = modValues;
        }
      }

      return parsedModifications;
    } catch (error) {
      console.log('LanchDrap: Error parsing modifications:', error);
      return {};
    }
  }

  /**
   * Build a full description for an item including modifications and special requests
   * @param {string} label - Item label
   * @param {string} description - Item description
   * @param {Object} modifications - Item modifications
   * @param {string} specialRequest - Special request
   * @returns {string} Full description
   */
  function buildFullDescription(label, description, modifications, specialRequest) {
    let fullDescription = label;

    if (description && description.trim()) {
      fullDescription += ` - ${description}`;
    }

    // Add modifications if any
    const modCount = Object.keys(modifications).length;
    if (modCount > 0) {
      fullDescription += ` (${modCount} modification${modCount > 1 ? 's' : ''})`;
    }

    // Add special request if any
    if (specialRequest && specialRequest.trim()) {
      fullDescription += ` - Special: ${specialRequest}`;
    }

    return fullDescription;
  }

  /**
   * Get order history for a specific restaurant
   * @param {string} restaurantId - Restaurant ID to filter by
   * @returns {Array} Filtered orders for the restaurant
   */
  function getOrderHistoryForRestaurant(restaurantId) {
    try {
      const allOrders = extractOrderHistoryFromPageData();

      if (!restaurantId) {
        return allOrders;
      }

      // Filter orders by restaurant ID (this would need to be determined from context)
      // For now, return all orders since we don't have restaurant context in the order data
      return allOrders;
    } catch (error) {
      console.log('LanchDrap: Error getting order history for restaurant:', error);
      return [];
    }
  }

  /**
   * Get order statistics from order history
   * @param {Array} orders - Array of parsed orders
   * @returns {Object} Order statistics
   */
  function getOrderStatistics(orders) {
    try {
      if (!Array.isArray(orders) || orders.length === 0) {
        return {
          totalOrders: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          totalItems: 0,
          paidOrders: 0,
          unpaidOrders: 0,
        };
      }

      const stats = {
        totalOrders: orders.length,
        totalSpent: 0,
        averageOrderValue: 0,
        totalItems: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        orderIds: [],
        deliveryIds: [],
      };

      orders.forEach((order) => {
        // Financial stats
        stats.totalSpent += order.financial.total;
        stats.totalItems += order.items.length;

        // Payment status
        if (order.isPaid) {
          stats.paidOrders++;
        } else {
          stats.unpaidOrders++;
        }

        // Track IDs
        if (order.id) stats.orderIds.push(order.id);
        if (order.deliveryId) stats.deliveryIds.push(order.deliveryId);
      });

      stats.averageOrderValue = stats.totalOrders > 0 ? stats.totalSpent / stats.totalOrders : 0;

      return stats;
    } catch (error) {
      console.log('LanchDrap: Error calculating order statistics:', error);
      return {
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        totalItems: 0,
        paidOrders: 0,
        unpaidOrders: 0,
      };
    }
  }

  /**
   * Convert order history to menu items format for compatibility
   * @param {Array} orders - Array of parsed orders
   * @returns {Array} Menu items in the expected format
   */
  function convertOrdersToMenuItems(orders) {
    try {
      if (!Array.isArray(orders) || orders.length === 0) {
        return [];
      }

      const menuItems = [];

      orders.forEach((order) => {
        order.items.forEach((item) => {
          // Create menu item in the expected format
          const menuItem = {
            id: item.id,
            label: item.label,
            description: item.description || '',
            price: item.price || 0,
            basePrice: item.price || 0,
            maxPrice: item.price || 0,
            section: 'Order History', // All items from order history go in this section
            sectionSortOrder: 999, // Put at the end
            isEntree: true, // Assume items from orders are entrees
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
              fullDescription: item.fullDescription,
              orderDate: order.parsedAt,
            },
          };

          menuItems.push(menuItem);
        });
      });

      return menuItems;
    } catch (error) {
      console.log('LanchDrap: Error converting orders to menu items:', error);
      return [];
    }
  }

  /**
   * Store order history data to the API
   * @param {string} userId - User ID
   * @param {string} restaurantId - Restaurant ID
   * @param {Array} orders - Array of parsed orders
   * @returns {Promise<Object>} API response
   */
  async function storeOrderHistoryToAPI(userId, restaurantId, orders) {
    try {
      if (!orders || !Array.isArray(orders) || orders.length === 0) {
        console.log('LanchDrap: No orders to store');
        return null;
      }

      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        console.log('LanchDrap: API client or config not available for storing order history');
        return null;
      }

      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      // Convert orders to the format expected by the API
      // The API expects orderData with date and items, not an array of orders

      // Extract the date from delivery data's deliveryTime
      let orderDate = new Date().toISOString().split('T')[0]; // Default to today

      // Get delivery data from the order history extraction
      const orderHistoryData =
        window.LanchDrapOrderHistoryParser?.extractOrderHistoryFromPageData();
      if (orderHistoryData?.delivery?.deliveryTime) {
        try {
          // Parse deliveryTime string like "2025-09-23 12:15:00"
          const deliveryTime = orderHistoryData.delivery.deliveryTime;
          const deliveryDate = new Date(deliveryTime);
          if (!isNaN(deliveryDate.getTime())) {
            orderDate = deliveryDate.toISOString().split('T')[0];
            console.log(
              'LanchDrap: Using date from delivery data:',
              orderDate,
              'from deliveryTime:',
              deliveryTime
            );
          }
        } catch (error) {
          console.log('LanchDrap: Error parsing deliveryTime:', error);
        }
      }

      // Fallback to URL date if delivery data not available
      if (orderDate === new Date().toISOString().split('T')[0] && window.LanchDrapDOMUtils) {
        const urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
        if (urlDate) {
          orderDate = urlDate;
          console.log('LanchDrap: Using fallback date from URL:', orderDate);
        }
      }

      const orderData = {
        date: orderDate,
        items: orders.flatMap((order) =>
          order.items.map((item) => ({
            name: item.label,
            quantity: item.quantity,
            price: item.price,
            fullDescription: item.fullDescription,
            modifications: item.modifications,
            specialRequest: item.specialRequest,
          }))
        ),
      };

      console.log('LanchDrap: Storing order history to API:', {
        userId,
        restaurantId,
        orderCount: orders.length,
      });

      const result = await apiClient.storeUserOrder(userId, restaurantId, orderData);

      if (result?.success) {
        console.log('LanchDrap: Successfully stored order history');
      } else {
        console.log('LanchDrap: Failed to store order history:', result);
      }

      return result;
    } catch (error) {
      console.log('LanchDrap: Error storing order history to API:', error);
      return null;
    }
  }

  /**
   * Process and store order history from page data
   * @param {string} userId - User ID
   * @param {string} restaurantId - Restaurant ID (optional, will be determined from context if not provided)
   * @returns {Promise<Object>} Processing result
   */
  async function processAndStoreOrderHistory(userId, restaurantId) {
    try {
      console.log(
        'LanchDrap: Processing and storing order history for user:',
        userId,
        'restaurant:',
        restaurantId
      );

      // Extract order history from page data
      const orderHistoryData = extractOrderHistoryFromPageData();
      const orders = orderHistoryData.orders;

      if (!orders || orders.length === 0) {
        console.log('LanchDrap: No order history found on page');
        return { success: false, reason: 'No order history found' };
      }

      // Determine restaurant ID: prefer delivery.restaurant.id, then param, then context
      let actualRestaurantId = restaurantId;

      // Prefer the delivery's restaurant id when present
      const deliveryRestaurantId = orderHistoryData?.delivery?.restaurant?.id;
      if (deliveryRestaurantId && typeof deliveryRestaurantId === 'string') {
        actualRestaurantId = deliveryRestaurantId;
        console.log('LanchDrap: Using restaurant ID from delivery:', actualRestaurantId);
      }

      if (!actualRestaurantId || actualRestaurantId === 'current_restaurant') {
        // Fallback: try to get restaurant context
        if (window.LanchDrapRestaurantContext) {
          try {
            const restaurantContext =
              await window.LanchDrapRestaurantContext.getCurrentRestaurantContext();
            actualRestaurantId = restaurantContext.id;
            console.log('LanchDrap: Determined restaurant ID from context:', actualRestaurantId);
          } catch (error) {
            console.log('LanchDrap: Could not determine restaurant ID from context:', error);
            return { success: false, reason: 'Could not determine restaurant ID' };
          }
        } else {
          console.log('LanchDrap: No restaurant context available');
          return { success: false, reason: 'No restaurant context available' };
        }
      }

      if (!actualRestaurantId) {
        console.log('LanchDrap: No restaurant ID available for storing order history');
        return { success: false, reason: 'No restaurant ID available' };
      }

      // Store to API
      const result = await storeOrderHistoryToAPI(userId, actualRestaurantId, orders);

      if (result?.success) {
        return {
          success: true,
          ordersProcessed: orders.length,
          orderStatistics: getOrderStatistics(orders),
          restaurantId: actualRestaurantId,
        };
      } else {
        return {
          success: false,
          reason: 'Failed to store to API',
          ordersProcessed: orders.length,
          restaurantId: actualRestaurantId,
        };
      }
    } catch (error) {
      console.log('LanchDrap: Error processing and storing order history:', error);
      return { success: false, reason: 'Processing error', error: error.message };
    }
  }

  // Return public API
  return {
    extractOrderHistoryFromPageData,
    parseOrders,
    parseOrder,
    parseOrderItems,
    parseOrderItem,
    parseModifications,
    buildFullDescription,
    getOrderHistoryForRestaurant,
    getOrderStatistics,
    convertOrdersToMenuItems,
    storeOrderHistoryToAPI,
    processAndStoreOrderHistory,
  };
})();
