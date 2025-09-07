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
    
    // Restaurant endpoints
    RESTAURANTS: '/api/restaurants',
    RESTAURANTS_APPEARANCES_TRACK: '/api/restaurants/appearances/track',
    RESTAURANTS_UPDATE: '/api/restaurants/update', // Updated from update-name to update
    RESTAURANTS_GET_BY_ID: '/api/restaurant', // Dynamic route: /api/restaurant/{id}
    
    // Legacy endpoints (removed or deprecated)
    // RESTAURANTS_SELLOUT: '/api/restaurants/sellout', // Endpoint removed
    // RESTAURANTS_AVAILABILITY: '/api/restaurants/availability', // Endpoint removed
    // RESTAURANTS_AVAILABILITY_SUMMARY: '/api/restaurants/availability-summary', // Endpoint removed
    // RESTAURANTS_DAILY_AVAILABILITY: '/api/restaurants/daily-availability', // Endpoint removed
    // RESTAURANTS_OFFICE_AVAILABILITY: '/api/restaurants/office-availability', // Endpoint removed
  },

  // Extension settings
  SETTINGS: {
    SCRAPE_INTERVAL: 300000, // 5 minutes
    MAX_HISTORY_ITEMS: 50,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
    
    // Menu tracking settings
    MENU_TRACKING_ENABLED: true,
    MENU_UPDATE_DELAY: 1000, // 1 second delay before parsing menu
    MENU_CACHE_DURATION: 300000, // 5 minutes - how long to cache menu data
  },

  // User identification
  USER_ID: {
    STORAGE_KEY: 'lunchdrop_user_id',
    GENERATE_IF_MISSING: true,
  },

  // LanchDrap specific selectors
  SELECTORS: {
    RESTAURANT_GRID: 'div.mx-4.my-8.sm\\:my-2',
    RESTAURANT_CARDS: 'a[href*="/app/"]',
    TIME_SLOT: '.text-base.font-bold.text-center',
    STATUS: '.text-sm.text-center',
    RESTAURANT_IMAGE: 'img',
    
    // Menu selectors for parsing restaurant menus
    MENU_SECTIONS: '.my-16',
    MENU_ITEMS: '.my-4.text-lg.cursor-pointer',
    MENU_ITEM_NAME: '.flex.items-center.font-bold span',
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
      MENU_HTML: 'menuHtml', // Optional: HTML content to parse for menu items
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
  
  console.log('LanchDrap Rating Extension: LanchDrapConfig set globally:', typeof window.LanchDrapConfig);
}
