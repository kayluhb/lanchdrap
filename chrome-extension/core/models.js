/**
 * Data Models for LanchDrap Extension
 *
 * This file defines the data structures used throughout the extension
 * to ensure consistency and prevent data structure mismatches.
 */

// Global namespace for models
window.LanchDrapModels = window.LanchDrapModels || {};

/**
 * Menu Item Model
 * Represents a single item from a restaurant's menu
 */
class MenuItem {
  constructor(data = {}) {
    this.label = data.label || data.name || '';
    this.quantity = data.quantity || 1;
    this.options = data.options || '';
    this.fullDescription = data.fullDescription || this.label;
  }

  /**
   * Create a MenuItem from a simple string (for backward compatibility)
   */
  static fromString(itemName) {
    return new MenuItem({
      label: itemName,
      quantity: 1,
      options: '',
      fullDescription: itemName,
    });
  }

  /**
   * Convert MenuItem to a simple string representation
   */
  toString() {
    return this.fullDescription || this.label;
  }

  /**
   * Check if two MenuItems are the same (by label)
   */
  equals(other) {
    if (!other || !(other instanceof MenuItem)) return false;
    return this.label.toLowerCase().trim() === other.label.toLowerCase().trim();
  }

  /**
   * Get a normalized label for comparison
   */
  getNormalizedLabel() {
    return this.label.toLowerCase().trim();
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      label: this.label,
      quantity: this.quantity,
      options: this.options,
      fullDescription: this.fullDescription,
    };
  }

  /**
   * Create MenuItem from plain object
   */
  static fromJSON(data) {
    return new MenuItem(data);
  }
}

/**
 * Restaurant Model
 * Represents a restaurant with its data
 */
class Restaurant {
  constructor(data = {}) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.appearances = data.appearances || [];
    this.soldOutDates = data.soldOutDates || [];
    this.menu = data.menu || {}; // Object with date keys: {"YYYY-MM-DD": [MenuItem]}
    this.firstSeen = data.firstSeen || null;
    this.lastSeen = data.lastSeen || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.color = data.color || null;
    this.logo = data.logo || null;
  }

  /**
   * Get menu items for a specific date
   */
  getMenuForDate(date) {
    const dateKey = this.formatDateKey(date);
    return this.menu[dateKey] || [];
  }

  /**
   * Set menu items for a specific date
   */
  setMenuForDate(date, menuItems) {
    const dateKey = this.formatDateKey(date);
    this.menu[dateKey] = menuItems;
  }

  /**
   * Format date to YYYY-MM-DD key
   */
  formatDateKey(date) {
    if (typeof date === 'string') {
      return new Date(date).toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      appearances: this.appearances,
      soldOutDates: this.soldOutDates,
      menu: this.menu,
      firstSeen: this.firstSeen,
      lastSeen: this.lastSeen,
      createdAt: this.createdAt,
      color: this.color,
      logo: this.logo,
    };
  }

  /**
   * Create Restaurant from plain object
   */
  static fromJSON(data) {
    const restaurant = new Restaurant(data);
    // Convert menu items to MenuItem objects
    if (restaurant.menu && typeof restaurant.menu === 'object') {
      for (const dateKey of Object.keys(restaurant.menu)) {
        if (Array.isArray(restaurant.menu[dateKey])) {
          restaurant.menu[dateKey] = restaurant.menu[dateKey].map((item) => {
            if (typeof item === 'string') {
              return MenuItem.fromString(item);
            }
            return MenuItem.fromJSON(item);
          });
        }
      }
    }
    return restaurant;
  }
}

/**
 * User Order Model
 * Represents a user's order from a restaurant
 */
class UserOrder {
  constructor(data = {}) {
    this.userId = data.userId || '';
    this.restaurantId = data.restaurantId || '';
    this.orderDate = data.orderDate || '';
    this.items = data.items || []; // Array of MenuItem objects
    this.rating = data.rating || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();

    // Order history specific fields
    this.orderId = data.orderId || '';
    this.deliveryId = data.deliveryId || '';
    this.isPaid = data.isPaid || false;
    this.financial = data.financial || {};
    this.paymentMethod = data.paymentMethod || null;
    this.orderAdjustments = data.orderAdjustments || [];
    this.needsPaymentInfo = data.needsPaymentInfo || false;
    this.useSubsidy = data.useSubsidy || false;
    this.doNotUseGiftCard = data.doNotUseGiftCard || false;
    this.autoCancelIfDeliveryFee = data.autoCancelIfDeliveryFee || false;
    this.isTaxExempt = data.isTaxExempt || false;
    this.userToggledTaxExempt = data.userToggledTaxExempt || false;
    this.isTipEditable = data.isTipEditable || false;
    this.isTipVisible = data.isTipVisible || false;
    this.isSupportFeeEditable = data.isSupportFeeEditable || false;
    this.isSupportFeeVisible = data.isSupportFeeVisible || false;
    this.guestToken = data.guestToken || null;
    this.guestLunchContribution = data.guestLunchContribution || '0.00';
    this.isTaxEstimated = data.isTaxEstimated || false;
  }

  /**
   * Add an item to the order
   */
  addItem(menuItem) {
    if (menuItem instanceof MenuItem) {
      this.items.push(menuItem);
    } else {
      this.items.push(MenuItem.fromJSON(menuItem));
    }
  }

  /**
   * Remove an item from the order
   */
  removeItem(menuItem) {
    this.items = this.items.filter((item) => !item.equals(menuItem));
  }

  /**
   * Get items as simple labels (for backward compatibility)
   */
  getItemLabels() {
    return this.items.map((item) => item.label);
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      userId: this.userId,
      restaurantId: this.restaurantId,
      orderDate: this.orderDate,
      items: this.items.map((item) => item.toJSON()),
      rating: this.rating,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create UserOrder from plain object
   */
  static fromJSON(data) {
    const order = new UserOrder(data);
    if (Array.isArray(order.items)) {
      order.items = order.items.map((item) => {
        if (typeof item === 'string') {
          return MenuItem.fromString(item);
        }
        return MenuItem.fromJSON(item);
      });
    }
    return order;
  }
}

/**
 * Restaurant History Item Model
 * Represents a restaurant in the user's order history
 */
class RestaurantHistoryItem {
  constructor(data = {}) {
    this.restaurantId = data.restaurantId || '';
    this.restaurantName = data.restaurantName || '';
    this.lastOrderDate = data.lastOrderDate || '';
    this.orderCount = data.orderCount || 0;
    this.totalSpent = data.totalSpent || 0;
    this.averageRating = data.averageRating || null;
    this.lastOrderItems = data.lastOrderItems || []; // Array of MenuItem objects
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      restaurantId: this.restaurantId,
      restaurantName: this.restaurantName,
      lastOrderDate: this.lastOrderDate,
      orderCount: this.orderCount,
      totalSpent: this.totalSpent,
      averageRating: this.averageRating,
      lastOrderItems: this.lastOrderItems.map((item) => item.toJSON()),
    };
  }

  /**
   * Create RestaurantHistoryItem from plain object
   */
  static fromJSON(data) {
    const item = new RestaurantHistoryItem(data);
    if (Array.isArray(item.lastOrderItems)) {
      item.lastOrderItems = item.lastOrderItems.map((orderItem) => {
        if (typeof orderItem === 'string') {
          return MenuItem.fromString(orderItem);
        }
        return MenuItem.fromJSON(orderItem);
      });
    }
    return item;
  }
}

/**
 * Rating Model
 * Represents a rating for a specific order
 */
class Rating {
  constructor(data = {}) {
    this.id = data.id || '';
    this.userId = data.userId || '';
    this.restaurant = data.restaurant || '';
    this.orderDate = data.orderDate || '';
    this.rating = data.rating || null; // 1-4 scale
    this.comment = data.comment || '';
    this.items = data.items || []; // Array of MenuItem objects (optional, pulled from existing order data)
    this.timestamp = data.timestamp || new Date().toISOString();
    this.userAgent = data.userAgent || '';
    this.ip = data.ip || '';
  }

  /**
   * Validate rating data
   */
  validate() {
    const errors = [];

    if (!this.userId) errors.push('userId is required');
    if (!this.restaurant) errors.push('restaurant is required');
    if (!this.orderDate) errors.push('orderDate is required');
    if (!this.rating || this.rating < 1 || this.rating > 4) {
      errors.push('rating must be between 1 and 4');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (this.orderDate && !dateRegex.test(this.orderDate)) {
      errors.push('orderDate must be in YYYY-MM-DD format');
    }

    return errors;
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      restaurant: this.restaurant,
      orderDate: this.orderDate,
      rating: this.rating,
      comment: this.comment,
      items: this.items.map((item) => (item instanceof MenuItem ? item.toJSON() : item)),
      timestamp: this.timestamp,
      userAgent: this.userAgent,
      ip: this.ip,
    };
  }

  /**
   * Create Rating from plain object
   */
  static fromJSON(data) {
    const rating = new Rating(data);
    if (Array.isArray(rating.items)) {
      rating.items = rating.items.map((item) => {
        if (typeof item === 'string') {
          return MenuItem.fromString(item);
        }
        return MenuItem.fromJSON(item);
      });
    }
    return rating;
  }
}

/**
 * Order History Item Model
 * Represents an item from order history with detailed information
 */
class OrderHistoryItem {
  constructor(data = {}) {
    this.id = data.id || '';
    this.orderId = data.orderId || '';
    this.itemId = data.itemId || '';
    this.quantity = data.quantity || 1;
    this.label = data.label || '';
    this.description = data.description || '';
    this.price = data.price || 0;
    this.specialRequest = data.specialRequest || null;
    this.specialRequestRequired = data.specialRequestRequired || '';
    this.labelFor = data.labelFor || null;
    this.guestToken = data.guestToken || null;
    this.modifications = data.modifications || {};
    this.paymentMethod = data.paymentMethod || null;
    this.fullDescription = data.fullDescription || '';
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      id: this.id,
      orderId: this.orderId,
      itemId: this.itemId,
      quantity: this.quantity,
      label: this.label,
      description: this.description,
      price: this.price,
      specialRequest: this.specialRequest,
      specialRequestRequired: this.specialRequestRequired,
      labelFor: this.labelFor,
      guestToken: this.guestToken,
      paymentMethod: this.paymentMethod,
      fullDescription: this.fullDescription,
    };
  }

  /**
   * Create OrderHistoryItem from plain object
   */
  static fromJSON(data) {
    return new OrderHistoryItem(data);
  }
}

/**
 * Order History Model
 * Represents a complete order from the order history
 */
class OrderHistory {
  constructor(data = {}) {
    this.id = data.id || '';
    this.userId = data.userId || '';
    this.deliveryId = data.deliveryId || '';
    this.isPaid = data.isPaid || false;
    this.items = data.items || []; // Array of OrderHistoryItem objects
    this.financial = data.financial || {};
    this.paymentMethod = data.paymentMethod || null;
    this.orderAdjustments = data.orderAdjustments || [];
    this.needsPaymentInfo = data.needsPaymentInfo || false;
    this.useSubsidy = data.useSubsidy || false;
    this.doNotUseGiftCard = data.doNotUseGiftCard || false;
    this.autoCancelIfDeliveryFee = data.autoCancelIfDeliveryFee || false;
    this.isTaxExempt = data.isTaxExempt || false;
    this.userToggledTaxExempt = data.userToggledTaxExempt || false;
    this.isTipEditable = data.isTipEditable || false;
    this.isTipVisible = data.isTipVisible || false;
    this.isSupportFeeEditable = data.isSupportFeeEditable || false;
    this.isSupportFeeVisible = data.isSupportFeeVisible || false;
    this.guestToken = data.guestToken || null;
    this.guestLunchContribution = data.guestLunchContribution || '0.00';
    this.isTaxEstimated = data.isTaxEstimated || false;
    this.parsedAt = data.parsedAt || new Date().toISOString();
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      deliveryId: this.deliveryId,
      isPaid: this.isPaid,
      items: this.items.map((item) => (item instanceof OrderHistoryItem ? item.toJSON() : item)),
      financial: this.financial,
      paymentMethod: this.paymentMethod,
      orderAdjustments: this.orderAdjustments,
      needsPaymentInfo: this.needsPaymentInfo,
      useSubsidy: this.useSubsidy,
      doNotUseGiftCard: this.doNotUseGiftCard,
      autoCancelIfDeliveryFee: this.autoCancelIfDeliveryFee,
      isTaxExempt: this.isTaxExempt,
      userToggledTaxExempt: this.userToggledTaxExempt,
      isTipEditable: this.isTipEditable,
      isTipVisible: this.isTipVisible,
      isSupportFeeEditable: this.isSupportFeeEditable,
      isSupportFeeVisible: this.isSupportFeeVisible,
      guestToken: this.guestToken,
      guestLunchContribution: this.guestLunchContribution,
      isTaxEstimated: this.isTaxEstimated,
      parsedAt: this.parsedAt,
    };
  }

  /**
   * Create OrderHistory from plain object
   */
  static fromJSON(data) {
    const orderHistory = new OrderHistory(data);
    if (Array.isArray(orderHistory.items)) {
      orderHistory.items = orderHistory.items.map((item) => {
        if (typeof item === 'string') {
          return OrderHistoryItem.fromJSON({ label: item });
        }
        return OrderHistoryItem.fromJSON(item);
      });
    }
    return orderHistory;
  }
}

/**
 * Rating Statistics Model
 * Represents aggregated rating statistics for a restaurant
 */
class RatingStats {
  constructor(data = {}) {
    this.totalRatings = data.totalRatings || 0;
    this.averageRating = data.averageRating || 0;
    this.ratingDistribution = data.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.lastUpdated = data.lastUpdated || new Date().toISOString();
  }

  /**
   * Add a new rating and update statistics
   */
  addRating(rating) {
    const oldTotal = this.totalRatings;
    const oldAverage = this.averageRating;

    this.totalRatings += 1;
    this.averageRating = (oldAverage * oldTotal + rating) / this.totalRatings;
    this.ratingDistribution[rating] += 1;
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Get rating distribution as array
   */
  getDistributionArray() {
    return [1, 2, 3, 4].map((star) => ({
      stars: star,
      count: this.ratingDistribution[star] || 0,
      percentage:
        this.totalRatings > 0
          ? (((this.ratingDistribution[star] || 0) / this.totalRatings) * 100).toFixed(1)
          : 0,
    }));
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      totalRatings: this.totalRatings,
      averageRating: this.averageRating,
      ratingDistribution: this.ratingDistribution,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Create RatingStats from plain object
   */
  static fromJSON(data) {
    return new RatingStats(data);
  }
}

/**
 * Utility functions for working with the models
 */
const ModelUtils = {
  /**
   * Convert an array of strings to MenuItem objects
   */
  stringsToMenuItems(strings) {
    return strings.map((str) => MenuItem.fromString(str));
  },

  /**
   * Convert an array of MenuItem objects to strings
   */
  menuItemsToStrings(menuItems) {
    return menuItems.map((item) => item.toString());
  },

  /**
   * Find matching menu items by label
   */
  findMatchingMenuItems(items, targetLabel) {
    const normalizedTarget = targetLabel.toLowerCase().trim();
    return items.filter((item) => item.getNormalizedLabel() === normalizedTarget);
  },

  /**
   * Merge two arrays of menu items, keeping unique items by label
   */
  mergeMenuItems(existingItems, newItems) {
    const result = [...existingItems];
    const existingLabels = new Set(existingItems.map((item) => item.getNormalizedLabel()));

    for (const newItem of newItems) {
      if (!existingLabels.has(newItem.getNormalizedLabel())) {
        result.push(newItem);
        existingLabels.add(newItem.getNormalizedLabel());
      }
    }

    return result;
  },

  /**
   * Replace menu items: keep existing items that match new items, add new items, remove items not in new list
   */
  replaceMenuItems(existingItems, newItems) {
    if (!Array.isArray(existingItems)) existingItems = [];
    if (!Array.isArray(newItems)) return existingItems;

    // Create a set of new item labels for quick lookup
    const newItemLabels = new Set(newItems.map((item) => item.getNormalizedLabel()));

    // Start with items that exist in both old and new menus
    const updatedItems = existingItems.filter((existingItem) => {
      return newItemLabels.has(existingItem.getNormalizedLabel());
    });

    // Add new items that don't already exist (avoid duplicates)
    const existingLabels = new Set(updatedItems.map((item) => item.getNormalizedLabel()));
    for (const newItem of newItems) {
      if (!existingLabels.has(newItem.getNormalizedLabel())) {
        updatedItems.push(newItem);
        existingLabels.add(newItem.getNormalizedLabel());
      }
    }

    return updatedItems;
  },
};

// Export classes to global namespace
window.LanchDrapModels.MenuItem = MenuItem;
window.LanchDrapModels.Restaurant = Restaurant;
window.LanchDrapModels.UserOrder = UserOrder;
window.LanchDrapModels.RestaurantHistoryItem = RestaurantHistoryItem;
window.LanchDrapModels.Rating = Rating;
window.LanchDrapModels.RatingStats = RatingStats;
window.LanchDrapModels.OrderHistoryItem = OrderHistoryItem;
window.LanchDrapModels.OrderHistory = OrderHistory;
window.LanchDrapModels.ModelUtils = ModelUtils;
