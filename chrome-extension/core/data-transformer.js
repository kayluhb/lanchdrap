// Data transformer utility for LanchDrap extension
// Handles menu extraction and data normalization
// Extracted from data-layer.js for better modularity

window.LanchDrapDataTransformer = (() => {
  /**
   * Extract menu items from delivery data
   * @param {Object} delivery - Delivery object with menu data
   * @returns {Array<Object>} Array of menu items
   */
  function extractMenuFromDelivery(delivery) {
    if (!delivery?.menu?.sections || !delivery?.menu?.items) {
      return [];
    }

    try {
      const { sections, items } = delivery.menu;

      // Create a map of item IDs to items for quick lookup
      const itemMap = new Map();
      for (const item of items) {
        itemMap.set(item.id, item);
      }

      // Build menu items with section labels using flatMap for cleaner code
      const menuItems = sections.flatMap((section) => {
        if (!section.items || !Array.isArray(section.items)) {
          return [];
        }
        return section.items
          .map((itemId) => {
            const item = itemMap.get(itemId);
            if (!item) return null;
            return {
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
            };
          })
          .filter(Boolean); // Remove null entries
      });

      return menuItems;
    } catch {
      return [];
    }
  }

  /**
   * Combine delivery and restaurant data
   * @param {Object} delivery - Delivery object
   * @param {Function} isBeforeNoonOnDeliveryDay - Function to check if before noon
   * @returns {Object} Combined restaurant object
   */
  function combineDeliveryAndRestaurant(delivery, isBeforeNoonOnDeliveryDay) {
    if (!delivery?.restaurant) {
      return null;
    }

    const { restaurant, numSlotsAvailable } = delivery;
    const { brandColor, color } = restaurant;

    // Determine if restaurant is sold out based on slots AND time
    const isSoldOut = numSlotsAvailable === 0 && isBeforeNoonOnDeliveryDay();

    return {
      ...restaurant,
      // Map brandColor to color for consistency with API data structure
      color: brandColor || color || null,
      numSlotsAvailable,
      menu: extractMenuFromDelivery(delivery),
      status: isSoldOut ? 'soldout' : 'available',
    };
  }

  /**
   * Normalize order items to ensure consistent field names
   * @param {Array<Object>} items - Array of order items
   * @returns {Array<Object>} Normalized order items
   */
  function normalizeOrderItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map((item) => {
      const { itemId, quantity = 1, label, description = '', price = 0, specialRequest } = item;
      const name = label || 'Unknown Item';

      return {
        itemId,
        quantity,
        name, // Use label only
        description,
        fullDescription: name, // Use label only
        options: '', // Empty options field as requested
        price,
        specialRequest,
        // Explicitly exclude: id, orderId, modifications, specialRequestRequired, labelFor, guestToken, paymentMethod
      };
    });
  }

  /**
   * Normalize delivery order data
   * @param {Object} delivery - Delivery object
   * @returns {Object} Normalized delivery object
   */
  function normalizeDeliveryOrder(delivery) {
    if (!delivery?.order) {
      return delivery;
    }

    const { order, id } = delivery;
    const { id: orderId, items = [] } = order;

    return {
      ...delivery,
      order: {
        id: orderId || id, // Include order ID
        items: normalizeOrderItems(items),
      },
    };
  }

  return {
    extractMenuFromDelivery,
    combineDeliveryAndRestaurant,
    normalizeOrderItems,
    normalizeDeliveryOrder,
  };
})();
