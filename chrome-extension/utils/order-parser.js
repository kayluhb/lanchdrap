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

      menuSections.forEach((section) => {
        // Find all menu item containers within this section
        const menuItems = section.querySelectorAll('.my-4.text-lg.cursor-pointer');

        menuItems.forEach((item) => {
          // Extract the menu item name from the span with font-bold class
          const nameElement = item.querySelector('.flex.items-center.font-bold span');
          if (nameElement) {
            const menuItemName = nameElement.textContent.trim();
            if (menuItemName) {
              allMenuItems.push(menuItemName);
            }
          }
        });
      });

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
              itemName.toLowerCase().includes('visa') ||
              itemName.toLowerCase().includes('card') ||
              itemName.toLowerCase().includes('meal organizer') ||
              itemName.toLowerCase().includes('paying for') ||
              itemName.toLowerCase().includes('up to $') ||
              itemName.toLowerCase().includes('-$') ||
              itemName.toLowerCase().includes('$15.00')
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

  // Function to detect and store order when placed
  async function detectAndStoreOrder() {
    try {
      // Check if we've already processed an order on this page to prevent duplicates
      const orderProcessedKey = `order_processed_${window.location.href}`;
      if (sessionStorage.getItem(orderProcessedKey)) {
        return;
      }

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

      let orderConfirmationText = null;

      for (const pattern of confirmationPatterns) {
        orderConfirmationText = Array.from(document.querySelectorAll('div')).find((div) =>
          div.textContent.toLowerCase().includes(pattern.toLowerCase())
        );
        if (orderConfirmationText) {
          break;
        }
      }

      if (!orderConfirmationText) {
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

      // Get restaurant information from existing context (use the same logic as displaySelectedRestaurantStats)
      let restaurantId = null;
      let restaurantName = null;

      // First, try to get restaurant info from the availability data (same as stats display)
      try {
        if (
          window.LanchDrapRestaurantScraper?.getRestaurantAvailabilityData
        ) {
          const availabilityData =
            await window.LanchDrapRestaurantScraper.getRestaurantAvailabilityData();
          if (availabilityData && availabilityData.length > 0) {
            const selectedRestaurant = availabilityData.find((restaurant) => restaurant.isSelected);
            if (selectedRestaurant) {
              restaurantId = selectedRestaurant.id;
              restaurantName = selectedRestaurant.name;
            }
          }
        }
      } catch (_error) {
      }

      // Fallback: if not found in availability data, try URL extraction
      if (!restaurantId) {
        const urlParts = window.location.pathname.split('/');
        if (urlParts.length >= 4 && urlParts[1] === 'app') {
          restaurantId = urlParts[urlParts.length - 1];
          const localKey = `restaurant_name:${restaurantId}`;
          restaurantName = localStorage.getItem(localKey);
        }
      }

      // Final fallback: extract restaurant name from page
      if (!restaurantName) {
        const titleElement = document.querySelector('h1, .text-3xl, .text-2xl');
        if (titleElement && !titleElement.textContent.includes('Your order has been placed')) {
          restaurantName = titleElement.textContent.trim();
          if (restaurantId) {
            localStorage.setItem(`restaurant_name:${restaurantId}`, restaurantName);
          }
        }
      }

      if (!restaurantId) {
        return;
      }

      // Get user ID
      const userId = await lanchDrapUserIdManager.getUserId();
      if (!userId) {
        return;
      }

      // Parse order items from the page
      const orderItems = parseOrderItemsFromPage();

      if (!orderItems || orderItems.length === 0) {
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
      if (typeof LanchDrapApiClient !== 'undefined' && typeof LanchDrapConfig !== 'undefined') {
        try {
          const apiClient = new LanchDrapApiClient.ApiClient(
            LanchDrapConfig.CONFIG.API_BASE_URL,
            LanchDrapConfig.CONFIG.ENDPOINTS
          );
          const result = await apiClient.storeUserOrder(userId, restaurantId, orderData);

          // Mark this page as processed to prevent duplicate processing
          if (result?.success) {
            sessionStorage.setItem(orderProcessedKey, 'true');
          }
        } catch (_error) {
        }
      } else {
      }
    } catch (_error) {}
  }

  // Return public API
  return {
    parseMenuFromPage,
    parseOrderItemsFromPage,
    detectAndStoreOrder,
  };
})();
