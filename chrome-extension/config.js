// Configuration for LanchDrap Rating Extension
const CONFIG = {
  // API endpoints - update these with your actual Cloudflare Worker URL
  API_BASE_URL: 'https://lunchdrop-ratings.caleb-brown.workers.dev',

  // API endpoints
  ENDPOINTS: {
    // Health endpoints
    HEALTH: '/api/health',

    // Rating endpoints
    RATINGS: '/api/ratings',
    RATINGS_STATS: '/api/ratings/stats',
    RATINGS_UPDATE_RESTAURANT: '/api/ratings/restaurant',

    // Restaurant endpoints
    RESTAURANTS: '/api/restaurants',
    RESTAURANTS_APPEARANCES_TRACK: '/api/restaurants/appearances/track',
    RESTAURANTS_UPDATE: '/api/restaurants/update',
    RESTAURANTS_UPDATE_APPEARANCES: '/api/restaurants/update-appearances',
    RESTAURANTS_GET_BY_ID: '/api/restaurant',
    RESTAURANTS_SEARCH: '/api/restaurants/search',
    RESTAURANTS_STATS: '/api/restaurants/stats',
    RESTAURANTS_USERS: '/api/restaurants/users',

    // Sync endpoints
    SYNC: '/api/sync',

    // Order history endpoints
    ORDERS: '/api/orders',
    ORDERS_SUMMARY: '/api/orders/summary',
  },

  // Extension settings
  SETTINGS: {
    // API client settings (used in apiClient.js)
    API_RETRY_ATTEMPTS: 3,
    API_RETRY_DELAY: 1000, // 1 second

    // Content script timing settings
    PAGE_LOAD_DELAY: 300, // Delay before scraping restaurant availability
    RESTAURANT_STATS_DELAY: 500, // Delay before showing restaurant stats
    FLOATING_BUTTON_DELAY: 2000, // Delay before showing floating rating button

    // DOM cache settings
    DOM_CACHE_TIMEOUT: 5000, // 5 seconds - how long to cache DOM queries

    // Local storage settings
    MAX_DAILY_RECORDS: 100, // Max records to keep per day in localStorage

    // Sell out indicator settings
    SELL_OUT_THRESHOLD: 0.8, // Threshold (0-1) for showing "likely to sell out" indicator
    SELL_OUT_MIN_DIFFERENCE: 0.2, // Minimum difference (0-1) between highest and second highest rate
  },

  // User identification
  USER_ID: {
    STORAGE_KEY: 'lanchdrap_user_id',
    GENERATE_IF_MISSING: true,
  },

  // Status indicators
  STATUS_INDICATORS: {
    ORDERING_CLOSED: 'Ordering Closed',
    ORDER_PLACED: 'Order Placed',
    SOLD_OUT: 'sold out',
    LIMITED: 'limited',
  },

  // Restaurant data structure (for reference)
  RESTAURANT_DATA_STRUCTURE: {
    // Fields stored in KV for each restaurant
    FIELDS: {
      ID: 'id', // Restaurant identifier
      NAME: 'name', // Restaurant display name
      APPEARANCES: 'appearances', // Array of dates when restaurant appeared
      SOLD_OUT_DATES: 'soldOutDates', // Array of dates when restaurant was sold out
      COLOR: 'color', // Restaurant's brand color
      MENU: 'menu', // Array of menu item names
      FIRST_SEEN: 'firstSeen', // First date restaurant was seen
      LAST_SEEN: 'lastSeen', // Most recent date restaurant was seen
      CREATED_AT: 'createdAt', // When restaurant record was created
      UPDATED_AT: 'updatedAt', // When restaurant record was last updated
    },

    // API request/response structure for restaurant updates
    UPDATE_REQUEST: {
      RESTAURANT_ID: 'restaurantId', // Required: Restaurant identifier
      RESTAURANT_NAME: 'restaurantName', // Optional: Restaurant display name
      MENU_ITEMS: 'menuItems', // Optional: Array of parsed menu item names
    },
  },
};

// Helper function to get full API URL
function getApiUrl(endpoint) {
  return `${CONFIG.API_BASE_URL}${endpoint}`;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getApiUrl };
} else {
  // Browser environment - ensure global variables are set
  window.LanchDrapConfig = { CONFIG, getApiUrl };

  // Also set on global scope for content scripts
  if (typeof globalThis !== 'undefined') {
    globalThis.LanchDrapConfig = { CONFIG, getApiUrl };
  }
}
