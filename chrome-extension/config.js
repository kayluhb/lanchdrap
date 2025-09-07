// Configuration for LanchDrap Rating Extension
const CONFIG = {
  // API endpoints - update these with your actual Cloudflare Worker URL
  API_BASE_URL: 'https://lunchdrop-ratings.caleb-brown.workers.dev',

  // API endpoints
  ENDPOINTS: {
    RATINGS: '/api/ratings',
    RATINGS_STATS: '/api/ratings/stats',
    RESTAURANTS: '/api/restaurants',
    RESTAURANTS_SELLOUT: '/api/restaurants/sellout',
    RESTAURANTS_AVAILABILITY: '/api/restaurants/availability',
    // RESTAURANTS_AVAILABILITY_SUMMARY: '/api/restaurants/availability-summary', // Endpoint removed
    RESTAURANTS_DAILY_AVAILABILITY: '/api/restaurants/daily-availability',
    RESTAURANTS_OFFICE_AVAILABILITY: '/api/restaurants/office-availability',
  },

  // Extension settings
  SETTINGS: {
    SCRAPE_INTERVAL: 300000, // 5 minutes
    MAX_HISTORY_ITEMS: 50,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
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
  },

  // Status indicators
  STATUS_INDICATORS: {
    ORDERING_CLOSED: 'Ordering Closed',
    ORDER_PLACED: 'Order Placed',
    SOLD_OUT: 'sold out',
    LIMITED: 'limited',
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
