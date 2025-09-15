// Main Cloudflare Worker with API Routes Pattern
// Following modern patterns similar to React Router Cloudflare template
// Import API route handlers
import { health } from './api/health.js';
import { submitRating } from './api/ratings.js';
import {
  getRestaurantById,
  getRestaurantStatsWithUserHistory,
  getRestaurantUsers,
  getUserOrderHistory,
  getUserRestaurantSummary,
  searchRestaurantByName,
  storeUserOrder,
  trackAppearances,
  update,
  updateAppearances,
} from './api/restaurants.js';
import { createCorsResponse } from './utils/response.js';

// Route configuration
const routes = {
  // Health endpoints
  'GET /api/health': health,

  // Rating endpoints
  'POST /api/ratings': submitRating,
  'POST /api/restaurants/appearances/track': trackAppearances,
  'POST /api/restaurants/update': update,
  'POST /api/restaurants/update-appearances': updateAppearances,

  // Restaurant search endpoints
  'GET /api/restaurants/search': searchRestaurantByName,
  'GET /api/restaurants/stats': getRestaurantStatsWithUserHistory,
  'GET /api/restaurants/users': getRestaurantUsers,

  // User order history endpoints
  'POST /api/orders': storeUserOrder,
  'GET /api/orders': getUserOrderHistory,
  'GET /api/orders/summary': getUserRestaurantSummary,
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
      let handler = routes[routeKey];

      // Handle dynamic routes
      if (!handler && method === 'GET' && path.startsWith('/api/restaurant/')) {
        handler = getRestaurantById;
      }

      if (handler) {
        // Execute the handler
        return await handler(request, env);
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
