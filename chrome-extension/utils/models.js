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
    this.name = data.name || '';
    this.quantity = data.quantity || 1;
    this.options = data.options || '';
    this.fullDescription = data.fullDescription || '';
  }

  /**
   * Create a MenuItem from a simple string (for backward compatibility)
   */
  static fromString(itemName) {
    return new MenuItem({
      name: itemName,
      quantity: 1,
      options: '',
      fullDescription: itemName,
    });
  }

  /**
   * Convert MenuItem to a simple string representation
   */
  toString() {
    return this.fullDescription || this.name;
  }

  /**
   * Check if two MenuItems are the same (by name)
   */
  equals(other) {
    if (!other || !(other instanceof MenuItem)) return false;
    return this.name.toLowerCase().trim() === other.name.toLowerCase().trim();
  }

  /**
   * Get a normalized name for comparison
   */
  getNormalizedName() {
    return this.name.toLowerCase().trim();
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      name: this.name,
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
   * Get items as simple names (for backward compatibility)
   */
  getItemNames() {
    return this.items.map((item) => item.name);
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
   * Find matching menu items by name
   */
  findMatchingMenuItems(items, targetName) {
    const normalizedTarget = targetName.toLowerCase().trim();
    return items.filter((item) => item.getNormalizedName() === normalizedTarget);
  },

  /**
   * Merge two arrays of menu items, keeping unique items by name
   */
  mergeMenuItems(existingItems, newItems) {
    const result = [...existingItems];
    const existingNames = new Set(existingItems.map((item) => item.getNormalizedName()));

    for (const newItem of newItems) {
      if (!existingNames.has(newItem.getNormalizedName())) {
        result.push(newItem);
        existingNames.add(newItem.getNormalizedName());
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

    // Create a set of new item names for quick lookup
    const newItemNames = new Set(newItems.map((item) => item.getNormalizedName()));

    // Start with items that exist in both old and new menus
    const updatedItems = existingItems.filter((existingItem) => {
      return newItemNames.has(existingItem.getNormalizedName());
    });

    // Add new items that don't already exist (avoid duplicates)
    const existingNames = new Set(updatedItems.map((item) => item.getNormalizedName()));
    for (const newItem of newItems) {
      if (!existingNames.has(newItem.getNormalizedName())) {
        updatedItems.push(newItem);
        existingNames.add(newItem.getNormalizedName());
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
window.LanchDrapModels.ModelUtils = ModelUtils;
