/**
 * Data Models for LanchDrap Cloudflare Worker
 *
 * This file defines the data structures used in the Cloudflare Worker
 * to ensure consistency with the Chrome extension models.
 */

/**
 * Menu Item Model
 * Represents a single item from a restaurant's menu
 */
export class MenuItem {
  constructor(data = {}) {
    this.id = data.id || '';
    this.label = data.label || '';
    this.description = data.description || '';
    this.price = data.price || 0;
    this.basePrice = data.basePrice || 0;
    this.maxPrice = data.maxPrice || 0;
    this.section = data.section || '';
    this.sectionSortOrder = data.sectionSortOrder || 0;
    this.isEntree = data.isEntree || false;
    this.isFavorite = data.isFavorite || false;
    this.isSpicy1 = data.isSpicy1 || false;
    this.isSpicy2 = data.isSpicy2 || false;
    this.isSpicy3 = data.isSpicy3 || false;
    this.isGlutenFree = data.isGlutenFree || false;
    this.isVegetarian = data.isVegetarian || false;
    this.isNutAllergy = data.isNutAllergy || false;
    this.picture = data.picture || '';
    this.rating = data.rating || 0;
    this.reviews = data.reviews || 0;
  }

  /**
   * Convert MenuItem to a simple string representation
   */
  toString() {
    return this.description || this.label;
  }

  /**
   * Check if two MenuItems are the same (by ID)
   */
  equals(other) {
    if (!other || !(other instanceof MenuItem)) return false;
    return this.id === other.id;
  }

  /**
   * Get a normalized name for comparison
   */
  getNormalizedName() {
    return this.label.toLowerCase().trim();
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      id: this.id,
      label: this.label,
      description: this.description,
      price: this.price,
      basePrice: this.basePrice,
      maxPrice: this.maxPrice,
      section: this.section,
      sectionSortOrder: this.sectionSortOrder,
      isEntree: this.isEntree,
      isFavorite: this.isFavorite,
      isSpicy1: this.isSpicy1,
      isSpicy2: this.isSpicy2,
      isSpicy3: this.isSpicy3,
      isGlutenFree: this.isGlutenFree,
      isVegetarian: this.isVegetarian,
      isNutAllergy: this.isNutAllergy,
      picture: this.picture,
      rating: this.rating,
      reviews: this.reviews,
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
 * Menu Model
 * Represents a restaurant's menu with items organized by date
 */
export class Menu {
  constructor(data = {}) {
    this.restaurantId = data.restaurantId || '';
    this.items = data.items || []; // Array of MenuItem objects
    this.lastUpdated = data.lastUpdated || new Date().toISOString();
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * Add or update menu items
   */
  addMenuItems(newItems) {
    if (!Array.isArray(newItems)) return;

    // Convert to MenuItem objects if needed
    const menuItems = newItems.map((item) =>
      typeof item.getNormalizedName === 'function' ? item : new MenuItem(item)
    );

    // Merge with existing items, keeping the latest version of each item
    const existingItems = this.items.map((item) =>
      typeof item.getNormalizedName === 'function' ? item : new MenuItem(item)
    );

    // Create a map of existing items by ID
    const existingMap = new Map();
    for (const item of existingItems) {
      existingMap.set(item.id, item);
    }

    // Update or add new items
    for (const newItem of menuItems) {
      existingMap.set(newItem.id, newItem);
    }

    this.items = Array.from(existingMap.values());
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Get menu items by section
   */
  getItemsBySection(sectionName) {
    return this.items.filter((item) => item.section === sectionName);
  }

  /**
   * Get all unique sections
   */
  getSections() {
    const sections = new Set(this.items.map((item) => item.section));
    return Array.from(sections).sort();
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      restaurantId: this.restaurantId,
      items: this.items.map((item) => (item instanceof MenuItem ? item.toJSON() : item)),
      lastUpdated: this.lastUpdated,
      createdAt: this.createdAt,
    };
  }

  /**
   * Create Menu from plain object
   */
  static fromJSON(data) {
    const menu = new Menu(data);
    menu.items = data.items?.map((item) => new MenuItem(item)) || [];
    return menu;
  }
}

/**
 * Restaurant Model
 * Represents a restaurant with its data
 */
export class Restaurant {
  constructor(data = {}) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.appearances = data.appearances || [];
    this.soldOutDates = data.soldOutDates || [];
    this.firstSeen = data.firstSeen || null;
    this.lastSeen = data.lastSeen || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.color = data.color || null;
    this.logo = data.logo || null;
  }

  // Menu data is now stored separately in restaurant_menu:<id> KV records

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      appearances: this.appearances,
      soldOutDates: this.soldOutDates,
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
    return new Restaurant(data);
  }
}

/**
 * User Order Model
 * Represents a user's order from a restaurant
 */
export class UserOrder {
  constructor(data = {}) {
    this.userId = data.userId || '';
    this.restaurantId = data.restaurantId || '';
    this.orderDate = data.orderDate || '';
    this.items = data.items || []; // Array of MenuItem objects
    this.rating = data.rating || null; // Rating object or null
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
   * Add a rating to this order
   */
  addRating(rating) {
    if (rating instanceof Rating) {
      this.rating = rating;
    } else {
      this.rating = Rating.fromJSON(rating);
    }
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Check if this order has a rating
   */
  hasRating() {
    return this.rating !== null && this.rating !== undefined;
  }

  /**
   * Get the rating value (1-4) or null
   */
  getRatingValue() {
    return this.hasRating() ? this.rating.rating : null;
  }

  /**
   * Get the rating comment or empty string
   */
  getRatingComment() {
    return this.hasRating() ? this.rating.comment : '';
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
      rating: this.rating
        ? this.rating instanceof Rating
          ? this.rating.toJSON()
          : this.rating
        : null,
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
    if (order.rating && typeof order.rating === 'object') {
      order.rating = Rating.fromJSON(order.rating);
    }
    return order;
  }
}

/**
 * Rating Model
 * Represents a rating for a specific order
 */
export class Rating {
  constructor(data = {}) {
    this.id = data.id || '';
    this.userId = data.userId || '';
    this.restaurant = data.restaurant || '';
    this.orderDate = data.orderDate || '';
    this.rating = data.rating || null; // 1-4 scale
    this.comment = data.comment || '';
    this.items = data.items || []; // Array of MenuItem objects
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
 * Rating Statistics Model
 * Represents aggregated rating statistics for a restaurant
 */
export class RatingStats {
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
export const ModelUtils = {
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
