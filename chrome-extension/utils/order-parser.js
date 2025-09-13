// Order parsing utilities for LanchDrap extension
// Handles order detection, parsing, and storage

// Create global namespace for order parser utilities
window.LanchDrapOrderParser = (() => {
  // Function to parse menu items from restaurant page
  function parseMenuFromPage() {
    try {
      // Look for menu sections with the structure provided by the user
      const menuSections = document.querySelectorAll('.my-16');
      const allMenuItems = [];

      for (const section of menuSections) {
        // Find all menu item containers within this section
        const menuItems = section.querySelectorAll('.my-4.text-lg.cursor-pointer');

        for (const item of menuItems) {
          // Extract the menu item name from the span with font-bold class
          const nameElement = item.querySelector('.flex.items-center.font-bold span');
          if (nameElement) {
            const menuItemName = nameElement.textContent.trim();
            if (menuItemName) {
              allMenuItems.push(menuItemName);
            }
          }
        }
      }

      return allMenuItems;
    } catch (_error) {
      return [];
    }
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
      const orderItems = parseOrderItemsFromPage();

      // Debug: Log order items detection
      // eslint-disable-next-line no-console
      console.log('=== ORDER ITEMS DETECTION ===');
      // eslint-disable-next-line no-console
      console.log('Order items found:', orderItems?.length || 0);
      if (orderItems && orderItems.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          'Order items:',
          orderItems.map((item) => item.name)
        );
      }
      // eslint-disable-next-line no-console
      console.log('============================');

      if (!orderItems || orderItems.length === 0) {
        return;
      }

      // Get restaurant information using centralized context utility
      const restaurantContext = window.LanchDrapRestaurantContext.getCurrentRestaurantContext();
      const restaurantId = restaurantContext.id;
      const restaurantName = restaurantContext.name;

      // Debug: Log restaurant context information
      // eslint-disable-next-line no-console
      console.log('=== RESTAURANT CONTEXT DEBUG ===');
      // eslint-disable-next-line no-console
      console.log('Restaurant ID:', restaurantId);
      // eslint-disable-next-line no-console
      console.log('Restaurant Name:', restaurantName);
      // eslint-disable-next-line no-console
      console.log('Has Valid ID:', restaurantContext.hasValidId);
      // eslint-disable-next-line no-console
      console.log('Has Valid Name:', restaurantContext.hasValidName);
      // eslint-disable-next-line no-console
      console.log('===============================');

      if (!restaurantId) {
        return;
      }

      // Debug: Log restaurant information
      const urlParts = window.location.pathname.split('/');
      // eslint-disable-next-line no-console
      console.log('=== ORDER DETECTION DEBUG ===');
      // eslint-disable-next-line no-console
      console.log('Current URL:', window.location.href);
      // eslint-disable-next-line no-console
      console.log('URL Path Parts:', urlParts);
      // eslint-disable-next-line no-console
      console.log('Restaurant ID:', restaurantId);
      // eslint-disable-next-line no-console
      console.log('Restaurant Name:', restaurantName);
      // eslint-disable-next-line no-console
      console.log(
        'Order Items:',
        orderItems.map((item) => item.name)
      );
      // eslint-disable-next-line no-console
      console.log('=============================');

      // Create order fingerprint based on actual content
      const orderFingerprint = createOrderFingerprint(orderItems, restaurantId, restaurantName);
      if (!orderFingerprint) {
        return;
      }

      // Check if we've already processed this specific order content
      const orderProcessedKey = `order_processed_${orderFingerprint}`;
      if (sessionStorage.getItem(orderProcessedKey)) {
        // eslint-disable-next-line no-console
        console.log('Order with this content already processed:', orderFingerprint);
        return;
      }

      // Debug: Log current URL and extracted date
      const extractedDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      // eslint-disable-next-line no-console
      console.log('Order detection - Current URL:', window.location.href);
      // eslint-disable-next-line no-console
      console.log('Order detection - Extracted date:', extractedDate);

      // Try multiple confirmation text patterns
      const confirmationPatterns = [
        'Your order has been placed!',
        'Your order has been placed',
        'Order placed',
        'Order confirmed',
        'Thank you for your order',
        'Order successful',
        'Order complete',
      ];

      // Debug: Log confirmation text search
      // eslint-disable-next-line no-console
      console.log('=== CONFIRMATION TEXT SEARCH ===');
      // eslint-disable-next-line no-console
      console.log('Searching for confirmation patterns:', confirmationPatterns);
      // eslint-disable-next-line no-console
      console.log('Page text content preview:', document.body.textContent.substring(0, 500));
      // eslint-disable-next-line no-console
      console.log('================================');

      let orderConfirmationText = null;

      for (const pattern of confirmationPatterns) {
        orderConfirmationText = Array.from(document.querySelectorAll('div')).find((div) =>
          div.textContent.toLowerCase().includes(pattern.toLowerCase())
        );
        if (orderConfirmationText) {
          // eslint-disable-next-line no-console
          console.log('Found confirmation text with pattern:', pattern);
          break;
        }
      }

      if (!orderConfirmationText) {
        // eslint-disable-next-line no-console
        console.log('No order confirmation text found on page');
        return;
      }

      // Find the order container - it should be a parent of the confirmation text
      const orderContainer =
        orderConfirmationText.closest('[id]') ||
        orderConfirmationText.closest('.my-8') ||
        orderConfirmationText.closest('div');

      if (!orderContainer) {
        return;
      }

      const isOrderPage = true; // We already confirmed this by finding the text

      if (!isOrderPage) {
        return;
      }

      // Get user ID
      const userId = await lanchDrapUserIdManager.getUserId();
      if (!userId) {
        return;
      }

      // Create order data using existing restaurant context
      // Use the date from the URL, not the current date
      const urlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
      const orderData = {
        date: urlDate || new Date().toISOString().split('T')[0], // Fallback to current date if no URL date
        restaurantName: restaurantName || restaurantId,
        items: orderItems,
      };

      // Store the order
      // eslint-disable-next-line no-console
      console.log('Attempting to store order:', { userId, restaurantId, orderData });

      // Debug: Check API client availability
      // eslint-disable-next-line no-console
      console.log('=== API CLIENT CHECK ===');
      // eslint-disable-next-line no-console
      console.log('LanchDrapApiClient available:', typeof LanchDrapApiClient !== 'undefined');
      // eslint-disable-next-line no-console
      console.log('LanchDrapConfig available:', typeof LanchDrapConfig !== 'undefined');
      // eslint-disable-next-line no-console
      console.log('========================');

      if (typeof LanchDrapApiClient !== 'undefined' && typeof LanchDrapConfig !== 'undefined') {
        try {
          const apiClient = new LanchDrapApiClient.ApiClient(
            LanchDrapConfig.CONFIG.API_BASE_URL,
            LanchDrapConfig.CONFIG.ENDPOINTS
          );
          const result = await apiClient.storeUserOrder(userId, restaurantId, orderData);

          // eslint-disable-next-line no-console
          console.log('Order storage result:', result);

          // Mark this specific order content as processed to prevent duplicate processing
          if (result?.success) {
            sessionStorage.setItem(orderProcessedKey, 'true');
            // eslint-disable-next-line no-console
            console.log(
              'Order stored successfully and content marked as processed:',
              orderFingerprint
            );
          } else {
            // eslint-disable-next-line no-console
            console.log('Order storage failed:', result);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error storing order:', error);
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('API client or config not available');
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
