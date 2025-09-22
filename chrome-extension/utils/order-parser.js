// Order parsing utilities for LanchDrap extension
// Handles order detection, parsing, and storage

// Create global namespace for order parser utilities
window.LanchDrapOrderParser = (() => {
  // Function to parse menu items from restaurant page - REMOVED
  // Menu data is now extracted directly from delivery data in restaurant-scraper.js
  function parseMenuFromPage() {
    // This function is no longer used - menu data comes from delivery data
    return [];
  }

  // Function to parse order items from the order confirmation page
  function parseOrderItemsFromPage() {
    try {
      // Look for the order confirmation container by finding the confirmation text first
      const confirmationPatterns = [
        'Your order has been placed!',
        'Your order has been placed',
        'Order placed',
        'Order confirmed',
        'Thank you for your order',
        'Order successful',
        'Order complete',
        'Your order was placed',
        'Order submitted',
        'Success! Your order',
        'Payment complete',
      ];

      let orderConfirmationText = null;
      for (const pattern of confirmationPatterns) {
        orderConfirmationText = Array.from(document.querySelectorAll('div')).find((div) =>
          div.textContent.toLowerCase().includes(pattern.toLowerCase())
        );
        if (orderConfirmationText) break;
      }

      if (!orderConfirmationText) {
        return [];
      }

      // Find the order container - it should be a parent of the confirmation text
      const orderContainer =
        orderConfirmationText.closest('[id]') ||
        orderConfirmationText.closest('.my-8') ||
        orderConfirmationText.closest('div');
      if (!orderContainer) {
        return [];
      }

      // Parse order items from the table
      const orderItems = [];
      const itemRows = orderContainer.querySelectorAll('tbody tr');

      // If no tbody rows found, try other selectors
      let finalItemRows = itemRows;
      if (itemRows.length === 0) {
        const allRows = orderContainer.querySelectorAll('tr');
        finalItemRows = allRows;
      }

      for (const row of finalItemRows) {
        // Try multiple cell selectors for different table structures
        const itemCell =
          row.querySelector('td:nth-child(2)') ||
          row.querySelector('td:nth-child(1)') ||
          row.querySelector('td');

        if (itemCell) {
          // Try multiple selectors for item name
          const itemNameElement =
            itemCell.querySelector(
              '.text-lg.font-medium, .font-medium, .sm\\:text-base, .font-semibold, .font-bold'
            ) || itemCell.querySelector('span, div');

          const optionsElement = itemCell.querySelector('.text-gray-500, .text-gray-400, .text-sm');

          // Only process rows that have item names (skip tax, subtotal, etc.)
          if (itemNameElement?.textContent.trim()) {
            const itemName = itemNameElement.textContent.trim();
            const options = optionsElement ? optionsElement.textContent.trim() : '';

            // Skip if this looks like a total/tax/payment row
            if (
              itemName.toLowerCase().includes('tax') ||
              itemName.toLowerCase().includes('subtotal') ||
              itemName.toLowerCase().includes('amount due') ||
              itemName.toLowerCase().includes('discount') ||
              itemName.toLowerCase().includes('total') ||
              itemName.toLowerCase().includes('tip') ||
              itemName.toLowerCase().includes('charge to') ||
              itemName.toLowerCase().includes('payment') ||
              itemName.toLowerCase().includes('organizer') ||
              itemName.toLowerCase().includes('card') ||
              itemName.toLowerCase().includes('meal organizer') ||
              itemName.toLowerCase().includes('paying for') ||
              itemName.toLowerCase().includes('up to $') ||
              itemName.toLowerCase().includes('-$')
            ) {
              continue;
            }

            // Parse quantity if present (e.g., "2× Chicken Fajita")
            const quantityMatch = itemName.match(/^(\d+)×\s*(.+)$/);
            const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
            const name = quantityMatch ? quantityMatch[2] : itemName;

            const orderItem = {
              name: name,
              quantity: quantity,
              options: options,
              fullDescription: `${itemName}${options ? ` (${options})` : ''}`,
            };
            orderItems.push(orderItem);
          }
        }
      }
      return orderItems;
    } catch (_error) {
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
      // Parse order items first to create fingerprint
      let orderItems = parseOrderItemsFromPage();
      console.log('LanchDrap: Order detection - found items:', orderItems?.length || 0);

      // Detect confirmation text early so fallback logic can reference it
      const confirmationPatterns = [
        'Your order has been placed!',
        'Your order has been placed',
        'Your order was placed',
        'Order placed',
        'Order confirmed',
        'Order submitted',
        'Thank you for your order',
        'Order successful',
        'Order complete',
        'Success! Your order',
        'Payment complete',
      ];
      let orderConfirmationText = null;
      try {
        for (const pattern of confirmationPatterns) {
          orderConfirmationText = Array.from(document.querySelectorAll('div')).find((div) =>
            div.textContent.toLowerCase().includes(pattern.toLowerCase())
          );
          if (orderConfirmationText) break;
        }
      } catch (_e) {}

      // Fallback: if DOM parsing failed, try extracting from page data order history
      if (!orderItems || orderItems.length === 0) {
        try {
          const historyData =
            window.LanchDrapOrderHistoryParser?.extractOrderHistoryFromPageData?.();
          const parsedOrders = historyData?.orders;
          if (parsedOrders && Array.isArray(parsedOrders) && parsedOrders.length > 0) {
            // Prefer a paid order if available
            const lastOrder = parsedOrders.find((o) => o && o.isPaid === true) || parsedOrders[0];
            orderItems = (lastOrder.items || []).map((item) => ({
              name: item.label || item.fullDescription || 'Item',
              quantity: item.quantity || 1,
              options: item.specialRequest || '',
              fullDescription:
                item.fullDescription ||
                `${item.label || 'Item'}${item.description ? ` - ${item.description}` : ''}`,
            }));
            console.log(
              'LanchDrap: Fallback order detection from page data - items:',
              orderItems?.length || 0
            );
            // If no explicit confirmation text, require the fallback order to be paid
            if (!orderConfirmationText && !(lastOrder && lastOrder.isPaid === true)) {
              orderItems = [];
            }
          }
        } catch (_e) {}
      }

      if (!orderItems || orderItems.length === 0) {
        console.log('LanchDrap: No order items found after fallbacks, skipping order detection');
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
      const _extractedDate = window.LanchDrapDOMUtils.extractDateFromUrl();

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
      let urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
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
    parseMenuFromPage,
    parseOrderItemsFromPage,
    detectAndStoreOrder,
    createOrderFingerprint,
  };
})();
