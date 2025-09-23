// Order parsing utilities for LanchDrap extension
// Handles order detection, parsing, and storage using JSON data only

// Create global namespace for order parser utilities
window.LanchDrapOrderParser = (() => {
  // Function to parse order items from JSON data (no DOM scraping)
  function parseOrderItemsFromJson() {
    try {
      console.log('LanchDrap: parseOrderItemsFromJson called');

      // Use the JSON data loader to get order history
      if (window.LanchDrapJsonDataLoader) {
        console.log('LanchDrap: JsonDataLoader available, extracting order history...');
        const orderHistoryData = window.LanchDrapJsonDataLoader.extractOrderHistory();
        console.log('LanchDrap: Raw order history data:', orderHistoryData);
        const orders = orderHistoryData.orders;
        console.log('LanchDrap: Extracted orders array:', orders);

        if (orders && Array.isArray(orders) && orders.length > 0) {
          console.log(`LanchDrap: Found ${orders.length} orders in JSON data`);

          // Log details about each order
          orders.forEach((order, index) => {
            console.log(`LanchDrap: Order ${index}:`, {
              id: order.id,
              isPaid: order.isPaid,
              itemCount: order.items?.length || 0,
              items: order.items,
            });
          });

          // Find the most recent paid order, or the most recent order if none are paid
          const paidOrder = orders.find((order) => order.isPaid === true);
          const targetOrder = paidOrder || orders[0];
          console.log('LanchDrap: Selected target order:', {
            id: targetOrder?.id,
            isPaid: targetOrder?.isPaid,
            itemCount: targetOrder?.items?.length || 0,
            usedPaidOrder: !!paidOrder,
          });

          if (targetOrder?.items && Array.isArray(targetOrder.items)) {
            const orderItems = [];
            for (const item of targetOrder.items) {
              orderItems.push({
                name: item.label || 'Unknown Item',
                quantity: item.quantity || 1,
                options: item.specialRequest || '',
                fullDescription: item.fullDescription || item.label || 'Unknown Item',
              });
            }

            console.log('LanchDrap: Parsed order items from JSON:', orderItems);
            return orderItems;
          } else {
            console.log(
              'LanchDrap: Target order has no items or items is not an array:',
              targetOrder?.items
            );
          }
        } else {
          console.log('LanchDrap: No orders found or orders is not a valid array:', {
            orders,
            isArray: Array.isArray(orders),
            length: orders?.length,
          });
        }
      } else {
        console.log('LanchDrap: JsonDataLoader not available');
      }

      console.log('LanchDrap: No order items found in JSON data');
      return [];
    } catch (error) {
      console.log('LanchDrap: Error parsing order items from JSON:', error);
      return [];
    }
  }

  // Function to create a fingerprint of the current order
  function createOrderFingerprint(orderItems, restaurantId, restaurantName) {
    if (!orderItems || orderItems.length === 0) {
      return null;
    }

    // Create a hash of the order content
    const orderContent = {
      restaurantId,
      restaurantName,
      items: orderItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        options: item.options,
      })),
    };

    // Simple hash function for the order content
    const contentString = JSON.stringify(orderContent);
    let hash = 0;
    for (let i = 0; i < contentString.length; i++) {
      const char = contentString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `order_${Math.abs(hash)}`;
  }

  // Function to detect and store order when placed
  async function detectAndStoreOrder() {
    try {
      console.log('LanchDrap: detectAndStoreOrder called');
      console.log('LanchDrap: Current URL:', window.location.href);
      console.log('LanchDrap: Current page data available:', !!window.app?.dataset?.page);

      // Extract the current date from URL to ensure we're processing orders for the right day
      const currentDate = window.LanchDrapJsonDataLoader?.extractDateFromUrl();
      console.log('LanchDrap: Current date from URL:', currentDate);

      // Parse order items from JSON data
      const orderItems = parseOrderItemsFromJson();
      console.log('LanchDrap: Order detection - found items:', orderItems?.length || 0);

      if (!orderItems || orderItems.length === 0) {
        console.log('LanchDrap: No order items found in JSON data, skipping order detection');
        return;
      }

      // Check if we have a paid order in the JSON data
      const orderHistoryData = window.LanchDrapJsonDataLoader?.extractOrderHistory();
      console.log('LanchDrap: Order history data for paid check:', orderHistoryData);
      const hasPaidOrder = orderHistoryData?.orders?.some((order) => order.isPaid === true);
      console.log('LanchDrap: Has paid order:', hasPaidOrder);

      // OPTION 2: Process all orders with items (comment out the paid check)
      // if (!hasPaidOrder) {
      //   console.log('LanchDrap: No paid orders found in JSON data, skipping order detection');
      //   return;
      // }

      // For now, let's process all orders that have items, regardless of paid status
      console.log('LanchDrap: Processing order regardless of paid status');
      console.log('LanchDrap: Processing order for date:', currentDate);

      // Get restaurant information using centralized context utility
      const restaurantContext =
        await window.LanchDrapRestaurantContext.getCurrentRestaurantContext();
      const restaurantId = restaurantContext.id;
      const restaurantName = restaurantContext.name;

      if (!restaurantId) {
        console.log('LanchDrap: No restaurant ID found, skipping order detection');
        return;
      }

      console.log('LanchDrap: Order detection - restaurant:', restaurantName, 'ID:', restaurantId);

      // Create order fingerprint based on actual content
      const orderFingerprint = createOrderFingerprint(orderItems, restaurantId, restaurantName);
      if (!orderFingerprint) {
        return;
      }

      // Check if we've already processed this specific order content for this date
      // Include date in the key to allow reprocessing when navigating between different days
      const orderProcessedKey = `order_processed_${orderFingerprint}_${currentDate || 'unknown'}`;
      if (sessionStorage.getItem(orderProcessedKey)) {
        console.log(
          'LanchDrap: Order already processed for this date, skipping:',
          orderProcessedKey
        );
        return;
      }

      // Debug: Log current URL and extracted date
      const _extractedDate = window.LanchDrapJsonDataLoader.extractDateFromUrl();

      // Proceed with order processing since we have valid order items and paid order status
      console.log('LanchDrap: Proceeding with order processing based on JSON data');

      // Get user ID
      const userId = await lanchDrapUserIdManager.getUserId();
      if (!userId) {
        return;
      }

      // Create order data using existing restaurant context
      // Use the date from the URL if present; otherwise attempt deliveryTime derived by history parser
      let urlDate = window.LanchDrapJsonDataLoader.extractDateFromUrl();
      if (!urlDate && window.LanchDrapOrderHistoryParser?.extractOrderHistoryFromPageData) {
        try {
          const historyData = window.LanchDrapOrderHistoryParser.extractOrderHistoryFromPageData();
          const deliveryTime = historyData?.delivery?.deliveryTime;
          if (deliveryTime) {
            const d = new Date(deliveryTime);
            if (!Number.isNaN(d.getTime())) {
              urlDate = d.toISOString().split('T')[0];
            }
          }
        } catch (_e) {}
      }
      const orderData = {
        date: currentDate || urlDate || new Date().toISOString().split('T')[0], // Use current date from URL first
        restaurantName: restaurantName || restaurantId,
        items: orderItems,
      };

      console.log('LanchDrap: Order data prepared:', {
        date: orderData.date,
        restaurantName: orderData.restaurantName,
        itemCount: orderData.items.length,
        restaurantId: restaurantId,
      });

      if (typeof LanchDrapApiClient !== 'undefined' && typeof LanchDrapConfig !== 'undefined') {
        try {
          const apiClient = new LanchDrapApiClient.ApiClient(
            LanchDrapConfig.CONFIG.API_BASE_URL,
            LanchDrapConfig.CONFIG.ENDPOINTS
          );
          const result = await apiClient.storeUserOrder(userId, restaurantId, orderData);
          console.log('LanchDrap: Order storage result:', result);

          // Mark this specific order content as processed to prevent duplicate processing
          if (result?.success) {
            sessionStorage.setItem(orderProcessedKey, 'true');
            console.log('LanchDrap: Order successfully stored and marked as processed');
          } else {
            console.log('LanchDrap: Order storage failed:', result);
          }
        } catch (error) {
          console.log('LanchDrap: Error storing order via API:', error);
        }
      } else {
        console.log('LanchDrap: API client or config not available, skipping order storage');
      }
    } catch (error) {
      console.log('LanchDrap: Error in detectAndStoreOrder:', error);
    }
  }

  // Return public API
  return {
    parseOrderItemsFromJson,
    detectAndStoreOrder,
    createOrderFingerprint,
  };
})();
