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
        console.info('LanchDrap: No order confirmation text found for items parsing');
        return [];
      }

      // Find the order container - it should be a parent of the confirmation text
      const orderContainer =
        orderConfirmationText.closest('[id]') ||
        orderConfirmationText.closest('.my-8') ||
        orderConfirmationText.closest('div');

      console.info('LanchDrap: Order container found for items parsing', !!orderContainer);
      if (!orderContainer) {
        console.info('LanchDrap: No order container found for items parsing');
        return [];
      }

      // Parse order items from the table
      const orderItems = [];
      const itemRows = orderContainer.querySelectorAll('tbody tr');
      console.info('LanchDrap: Found item rows for parsing', itemRows.length);

      // If no tbody rows found, try other selectors
      let finalItemRows = itemRows;
      if (itemRows.length === 0) {
        const allRows = orderContainer.querySelectorAll('tr');
        console.info('LanchDrap: No tbody rows, trying all rows', allRows.length);
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
          if (itemNameElement && itemNameElement.textContent.trim()) {
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

      console.info('LanchDrap: Successfully parsed order items', { count: orderItems.length });
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
        console.info('LanchDrap: Order already processed for this page, skipping');
        return;
      }

      // Check if this is an order confirmation page
      // Look for various order confirmation text patterns
      console.info('LanchDrap: Checking for order confirmation page');

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
        console.info('LanchDrap: No order confirmation text found, not an order confirmation page');
        return;
      }

      console.info('LanchDrap: Order confirmation detected');

      // Find the order container - it should be a parent of the confirmation text
      const orderContainer =
        orderConfirmationText.closest('[id]') ||
        orderConfirmationText.closest('.my-8') ||
        orderConfirmationText.closest('div');

      if (!orderContainer) {
        console.info('LanchDrap: No order container found');
        return;
      }

      const isOrderPage = true; // We already confirmed this by finding the text

      console.info('LanchDrap: Order confirmation page detected');

      if (!isOrderPage) {
        return;
      }

      // Get restaurant information from existing context (use the same logic as displaySelectedRestaurantStats)
      let restaurantId = null;
      let restaurantName = null;

      // First, try to get restaurant info from the availability data (same as stats display)
      try {
        if (
          window.LanchDrapRestaurantScraper &&
          window.LanchDrapRestaurantScraper.getRestaurantAvailabilityData
        ) {
          const availabilityData =
            await window.LanchDrapRestaurantScraper.getRestaurantAvailabilityData();
          if (availabilityData && availabilityData.length > 0) {
            const selectedRestaurant = availabilityData.find((restaurant) => restaurant.isSelected);
            if (selectedRestaurant) {
              restaurantId = selectedRestaurant.id;
              restaurantName = selectedRestaurant.name;
              console.log('LanchDrap: Found selected restaurant from availability data', {
                restaurantId,
                restaurantName,
              });
            }
          }
        }
      } catch (error) {
        console.log('LanchDrap: Could not get availability data', error);
      }

      // Fallback: if not found in availability data, try URL extraction
      if (!restaurantId) {
        console.log('LanchDrap: Trying URL extraction as fallback');
        const urlParts = window.location.pathname.split('/');
        if (urlParts.length >= 4 && urlParts[1] === 'app') {
          restaurantId = urlParts[urlParts.length - 1];
          const localKey = `restaurant_name:${restaurantId}`;
          restaurantName = localStorage.getItem(localKey);
          console.log('LanchDrap: URL fallback result', { restaurantId, restaurantName });
        }
      }

      // Final fallback: extract restaurant name from page
      if (!restaurantName) {
        console.log('LanchDrap: Trying to extract restaurant name from page');
        const titleElement = document.querySelector('h1, .text-3xl, .text-2xl');
        if (titleElement && !titleElement.textContent.includes('Your order has been placed')) {
          restaurantName = titleElement.textContent.trim();
          if (restaurantId) {
            localStorage.setItem(`restaurant_name:${restaurantId}`, restaurantName);
          }
          console.log('LanchDrap: Extracted restaurant name from page:', restaurantName);
        }
      }

      if (!restaurantId) {
        console.info('LanchDrap: Could not determine restaurant ID');
        return;
      }

      // Get user ID
      const userId = await lanchDrapUserIdManager.getUserId();
      console.info('LanchDrap: Retrieved user ID for order storage', userId);
      if (!userId) {
        console.info('LanchDrap: No user ID available, cannot store order');
        return;
      }

      // Parse order items from the page
      const orderItems = parseOrderItemsFromPage();
      console.info('LanchDrap: Parsed order items', {
        count: orderItems?.length,
        items: orderItems,
      });

      if (!orderItems || orderItems.length === 0) {
        console.info('LanchDrap: No order items found, cannot store order');
        // Try to log the page content for debugging
        console.info('LanchDrap: Page content for debugging:', {
          url: window.location.href,
          title: document.title,
          bodyText: `${document.body.textContent.substring(0, 500)}...`,
        });
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

      console.info('LanchDrap: Order data prepared', {
        urlDate,
        currentDate: new Date().toISOString().split('T')[0],
        finalDate: orderData.date,
        restaurantId,
        restaurantName,
        itemCount: orderItems.length,
      });

      // Store the order
      if (typeof LanchDrapApiClient !== 'undefined' && typeof LanchDrapConfig !== 'undefined') {
        try {
          const apiClient = new LanchDrapApiClient.ApiClient(
            LanchDrapConfig.CONFIG.API_BASE_URL,
            LanchDrapConfig.CONFIG.ENDPOINTS
          );
          console.info('LanchDrap: Storing order to server', {
            userId,
            restaurantId,
            itemCount: orderData.items.length,
          });
          const result = await apiClient.storeUserOrder(userId, restaurantId, orderData);
          console.info('LanchDrap: Order stored successfully', {
            success: result?.success,
            orderAdded: result?.data?.orderAdded,
            isDuplicate: result?.data?.isDuplicate,
          });

          // Mark this page as processed to prevent duplicate processing
          if (result?.success) {
            sessionStorage.setItem(orderProcessedKey, 'true');
          }
        } catch (error) {
          console.error('LanchDrap: Failed to store order', error);
        }
      } else {
        console.info('LanchDrap: API client not available, cannot store order');
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
