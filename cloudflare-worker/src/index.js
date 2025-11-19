// Main Cloudflare Worker with API Routes Pattern
// Following modern patterns similar to React Router Cloudflare template
// Import API route handlers

import { getPrivacyPolicy } from './api/privacy.js';
import { getOrderRating, getRatingStats, submitRating } from './api/ratings.js';
import { getRestaurantById, getRestaurantMenu, updateAppearances } from './api/restaurants/crud.js';
import {
  deleteUserRestaurantHistory,
  getUserRestaurantSummary,
  updateUserOrder,
} from './api/restaurants/orders.js';
import {
  getBatchRestaurantData,
  getRestaurantStatsWithUserHistory,
} from './api/restaurants/stats.js';
// Import tracking, admin, order, and stats functions
import { trackAppearances } from './api/restaurants/tracking.js';
import { createCorsResponse, createErrorResponse } from './utils/response.js';

// Route configuration - Tracking, admin, and order endpoints enabled
const routes = {
  // Privacy policy endpoint
  'GET /privacy': getPrivacyPolicy,
  'GET /privacy-policy': getPrivacyPolicy,

  // Combined tracking endpoint for both restaurants and orders
  'POST /api/restaurants/appearances/track': trackAppearances,

  // Order endpoints enabled
  'GET /api/orders/summary': getUserRestaurantSummary,

  // Restaurant stats endpoints enabled
  'GET /api/restaurants/stats': getRestaurantStatsWithUserHistory,

  // Batch restaurant data endpoint
  'GET /api/restaurants/batch': getBatchRestaurantData,

  // Ratings endpoints temporarily enabled
  'POST /api/ratings': submitRating,
  'GET /api/ratings/order': getOrderRating,
  'GET /api/ratings/stats': getRatingStats,

  // Enable appearance editing only
  'POST /api/restaurants/update-appearances': updateAppearances,

  // All other endpoints disabled
  // 'GET /api/health': health,
  // 'POST /api/ratings': submitRating,
  // 'GET /api/ratings/order': getOrderRating,
  // 'GET /api/ratings/stats': getRatingStats,
  // 'POST /api/ratings/restaurant': updateRestaurantRatingData,
  // 'POST /api/restaurants/update': update,
  // 'POST /api/restaurants/update-appearances': updateAppearances,
  // 'GET /api/restaurants/search': searchRestaurantByName,
  // 'GET /api/restaurants/stats': getRestaurantStatsWithUserHistory,
  // 'GET /api/restaurants/users': getRestaurantUsers,
  // 'PUT /api/orders': updateUserOrder,
  // 'GET /api/orders': getUserOrderHistory,
  // 'DELETE /api/orders': deleteUserRestaurantHistory,
};

// Main worker export
export default {
  async fetch(request, env, _ctx) {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return createCorsResponse();
      }

      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Create route key
      const routeKey = `${method} ${path}`;

      // Find matching route
      const handler = routes[routeKey];

      // Enable dynamic route for restaurant by ID, restaurant menu, and orders by date
      let dynamicHandler = handler;
      if (!dynamicHandler && method === 'GET' && path.startsWith('/api/restaurant/')) {
        dynamicHandler = getRestaurantById;
      }
      if (!dynamicHandler && method === 'GET' && path.startsWith('/api/restaurant-menu/')) {
        dynamicHandler = getRestaurantMenu;
      }
      if (!dynamicHandler && method === 'PUT' && path.startsWith('/api/orders/')) {
        dynamicHandler = updateUserOrder;
      }
      if (!dynamicHandler && method === 'DELETE' && path.startsWith('/api/orders/')) {
        dynamicHandler = deleteUserRestaurantHistory;
      }
      // Privacy policy routes (also handle /privacy.html for compatibility)
      if (
        !dynamicHandler &&
        method === 'GET' &&
        (path === '/privacy' || path === '/privacy-policy' || path === '/privacy.html')
      ) {
        dynamicHandler = getPrivacyPolicy;
      }

      if (dynamicHandler) {
        // Execute the handler
        return await dynamicHandler(request, env);
      }

      // No route found - return 404
      return createErrorResponse('Route not found', 404);
    } catch (error) {
      return createErrorResponse('Internal server error', 500, null, {
        error: error.message,
      });
    }
  },
};
