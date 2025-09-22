// Order parsing utilities for LanchDrap extension
// Handles order detection, parsing, and storage using JSON data only

// Create global namespace for order parser utilities
window.LanchDrapOrderParser = (() => {
  // Function to parse order items from JSON data (no DOM scraping)
  function parseOrderItemsFromJson() {
    try {
      // Use the JSON data loader to get order history
      if (window.LanchDrapJsonDataLoader) {
        const orderHistoryData = window.LanchDrapJsonDataLoader.extractOrderHistory();
        const orders = orderHistoryData.orders;

        if (orders && Array.isArray(orders) && orders.length > 0) {
          // Find the most recent paid order, or the most recent order if none are paid
          const paidOrder = orders.find((order) => order.isPaid === true);
          const targetOrder = paidOrder || orders[0];

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
          }
        }
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
      // Parse order items from JSON data
      const orderItems = parseOrderItemsFromJson();
      console.log('LanchDrap: Order detection - found items:', orderItems?.length || 0);

      if (!orderItems || orderItems.length === 0) {
        console.log('LanchDrap: No order items found in JSON data, skipping order detection');
        return;
      }

      // Check if we have a paid order in the JSON data
      const orderHistoryData = window.LanchDrapJsonDataLoader?.extractOrderHistory();
      const hasPaidOrder = orderHistoryData?.orders?.some((order) => order.isPaid === true);

      if (!hasPaidOrder) {
        console.log('LanchDrap: No paid orders found in JSON data, skipping order detection');
        return;
      }

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

      // Check if we've already processed this specific order content
      const orderProcessedKey = `order_processed_${orderFingerprint}`;
      if (sessionStorage.getItem(orderProcessedKey)) {
        return;
      }

      // Debug: Log current URL and extracted date
      const _extractedDate = window.LanchDrapJsonDataLoader.extractDateFromUrl();

      // orderConfirmationText already computed above

      if (!orderConfirmationText) {
        // Allow fallback path when we have items but no explicit confirmation banner
        console.log(
          'LanchDrap: No explicit confirmation text found; proceeding with items fallback'
        );
      }

      // Find the order container - it should be a parent of the confirmation text
      // Note: We proceed without requiring a specific container when confirmation text is absent

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
        date: urlDate || new Date().toISOString().split('T')[0], // Fallback to current date if no URL date
        restaurantName: restaurantName || restaurantId,
        items: orderItems,
      };

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
        } catch (_error) {}
      } else {
      }
    } catch (_error) {}
  }

  // Return public API
  return {
    parseOrderItemsFromJson,
    detectAndStoreOrder,
    createOrderFingerprint,
  };
})();
