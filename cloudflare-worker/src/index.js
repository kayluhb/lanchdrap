// Main Cloudflare Worker with API Routes Pattern
// Following modern patterns similar to React Router Cloudflare template
// Import API route handlers

import { getOrderRating, getRatingStats, submitRating } from './api/ratings.js';
// Import tracking, admin, order, and stats functions
import {
  deleteUserRestaurantHistory,
  getRestaurantById,
  getRestaurantMenu,
  getRestaurantStatsWithUserHistory,
  getUserRestaurantSummary,
  trackAppearances,
  updateAppearances,
  updateUserOrder,
} from './api/restaurants.js';
import { createCorsResponse } from './utils/response.js';

// Route configuration - Tracking, admin, and order endpoints enabled
const routes = {
  // Combined tracking endpoint for both restaurants and orders
  'POST /api/restaurants/appearances/track': trackAppearances,

  // Order endpoints enabled
  'GET /api/orders/summary': getUserRestaurantSummary,

  // Restaurant stats endpoints enabled
  'GET /api/restaurants/stats': getRestaurantStatsWithUserHistory,

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

      if (dynamicHandler) {
        // Execute the handler
        return await dynamicHandler(request, env);
      }

      // No route found - return 404
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Route not found',
            status: 404,
            timestamp: new Date().toISOString(),
          },
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Internal server error',
            status: 500,
            timestamp: new Date().toISOString(),
            details: { error: error.message },
          },
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};
