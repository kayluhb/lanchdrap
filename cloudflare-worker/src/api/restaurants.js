// Restaurant API routes
// Following modern API patterns with proper error handling and validation

import { createApiResponse, createErrorResponse } from '../utils/response.js';
import { compareMenus } from '../utils/restaurants.js';

// Helper function to get restaurant ID by name
async function getRestaurantIdByName(env, restaurantName) {
  try {
    const nameKey = `restaurant_name:${restaurantName}`;
    const restaurantId = await env.LANCHDRAP_RATINGS.get(nameKey);
    return restaurantId;
  } catch (_error) {
    return null;
  }
}

// Helper function to ensure name mapping exists
async function ensureNameMapping(env, restaurantId, restaurantName, _context = '') {
  if (restaurantName && restaurantName !== restaurantId) {
    const nameKey = `restaurant_name:${restaurantName}`;
    const existingMapping = await env.LANCHDRAP_RATINGS.get(nameKey);
    if (!existingMapping) {
      await env.LANCHDRAP_RATINGS.put(nameKey, restaurantId);
    }
  }
}

// Helper function to update restaurant timestamp
function updateRestaurantTimestamp(restaurantData) {
  restaurantData.updatedAt = new Date().toISOString();
}

// Track restaurant appearances with proper KV structure
async function trackRestaurantAppearances(env, restaurants, date) {
  const updatedRestaurants = [];

  // Process each restaurant
  for (const restaurantInfo of restaurants) {
    const restaurantId = restaurantInfo.id || restaurantInfo.name || restaurantInfo.restaurant;
    const restaurantName = restaurantInfo.name || restaurantInfo.restaurant || restaurantId;

    if (!restaurantId) continue;

    // Get existing restaurant data from KV
    const restaurantKey = `restaurant:${restaurantId}`;
    const existingData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    let restaurantData;
    if (existingData) {
      restaurantData = JSON.parse(existingData);
    } else {
      // Create new restaurant record
      restaurantData = {
        id: restaurantId,
        name: restaurantName !== restaurantId ? restaurantName : null, // Don't store ID as name
        appearances: [],
        soldOutDates: [],
        color: restaurantInfo.color || null, // Store the color
        menu: restaurantInfo.menu || [], // Store menu items
        firstSeen: date,
        lastSeen: date,
        createdAt: new Date().toISOString(),
      };

      // Create name mapping for new restaurant if name is different from ID
      await ensureNameMapping(env, restaurantId, restaurantName, 'new restaurant creation');
    }

    // Add date to appearances if not already present
    if (!restaurantData.appearances.includes(date)) {
      restaurantData.appearances.push(date);
      restaurantData.appearances.sort(); // Keep dates sorted
      restaurantData.lastSeen = date;
      updateRestaurantTimestamp(restaurantData);

      // Update first seen if this is earlier
      if (date < restaurantData.firstSeen) {
        restaurantData.firstSeen = date;
      }
    }

    // Initialize soldOutDates array if it doesn't exist (for existing records)
    if (!restaurantData.soldOutDates) {
      restaurantData.soldOutDates = [];
    }

    // Initialize color if it doesn't exist (for existing records)
    if (!restaurantData.color && restaurantInfo.color) {
      restaurantData.color = restaurantInfo.color;
    }

    // Initialize menu if it doesn't exist (for existing records)
    if (!restaurantData.menu) {
      restaurantData.menu = [];
    }

    // Track sold out status if restaurant is sold out
    if (restaurantInfo.status === 'soldout' && !restaurantData.soldOutDates.includes(date)) {
      restaurantData.soldOutDates.push(date);
      restaurantData.soldOutDates.sort(); // Keep dates sorted
      updateRestaurantTimestamp(restaurantData);
    }

    // Update restaurant name if we have a better one and it's different
    if (
      restaurantName &&
      restaurantName !== restaurantId &&
      restaurantData.name !== restaurantName
    ) {
      const oldName = restaurantData.name;
      restaurantData.name = restaurantName;

      // Remove old name mapping if it exists
      if (oldName && oldName !== restaurantId) {
        const oldNameKey = `restaurant_name:${oldName}`;
        await env.LANCHDRAP_RATINGS.delete(oldNameKey);
      }

      // Add new name mapping
      await ensureNameMapping(env, restaurantId, restaurantName, 'name update');
    } else if (restaurantName === restaurantId && restaurantData.name === restaurantId) {
      // If both the incoming name and stored name are the ID, set stored name to null
      restaurantData.name = null;
    } else if (restaurantName && restaurantName !== restaurantId && !restaurantData.name) {
      // If we have a name but the restaurant doesn't have one stored, set it and create mapping
      restaurantData.name = restaurantName;
      await ensureNameMapping(
        env,
        restaurantId,
        restaurantName,
        'existing restaurant name assignment'
      );
    }

    // Update color if provided and different
    if (restaurantInfo.color && restaurantData.color !== restaurantInfo.color) {
      restaurantData.color = restaurantInfo.color;
      updateRestaurantTimestamp(restaurantData);
    }

    // Update menu if provided and different
    if (restaurantInfo.menu && Array.isArray(restaurantInfo.menu)) {
      const menuChanged = compareMenus(restaurantData.menu, restaurantInfo.menu);
      if (menuChanged) {
        restaurantData.menu = restaurantInfo.menu;
        updateRestaurantTimestamp(restaurantData);
      }
    }

    // Ensure name mapping exists if restaurant has a name
    await ensureNameMapping(
      env,
      restaurantId,
      restaurantData.name,
      'trackRestaurantAppearances verification'
    );

    // Save to KV
    await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(restaurantData));

    // Calculate sell out rate for response
    const totalAppearances = restaurantData.appearances.length;
    const totalSoldOuts = restaurantData.soldOutDates.length;
    const sellOutRate = totalAppearances > 0 ? totalSoldOuts / totalAppearances : 0;

    updatedRestaurants.push({
      ...restaurantData,
      sellOutRate: parseFloat(sellOutRate.toFixed(3)), // Ensure it's a float with 3 decimal places
    });
  }

  return {
    success: true,
    updatedCount: restaurants.length,
    totalRestaurants: updatedRestaurants.length,
    updatedRestaurants: updatedRestaurants,
  };
}

// Track restaurant appearances
export async function trackAppearances(request, env) {
  try {
    const trackingData = await request.json();
    const { restaurants, date } = trackingData;

    if (!restaurants || !Array.isArray(restaurants) || !date) {
      return createErrorResponse(
        'Invalid tracking data: restaurants array and date are required',
        400
      );
    }

    if (restaurants.length === 0) {
      return createErrorResponse('Restaurants array cannot be empty', 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return createErrorResponse('Date must be in YYYY-MM-DD format', 400);
    }

    const result = await trackRestaurantAppearances(env, restaurants, date);

    return createApiResponse(
      {
        success: true,
        message: `Tracked ${restaurants.length} restaurant appearances for ${date}`,
        data: {
          date,
          totalRestaurants: restaurants.length,
          updatedRestaurants: result.totalRestaurants,
          restaurants: result.updatedRestaurants.map((r) => ({
            id: r.id,
            name: r.name,
            sellOutRate: r.sellOutRate,
          })),
        },
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to track restaurant appearances', 500, {
      error: error.message,
    });
  }
}

// Get restaurant appearances
export async function getAppearances(request, env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');
    const timeRange = url.searchParams.get('timeRange') || 'all';

    if (!restaurant) {
      return createErrorResponse('Restaurant parameter is required', 400);
    }

    // Get restaurant data from KV
    const restaurantKey = `restaurant:${restaurant}`;
    const restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    if (!restaurantData) {
      // Return empty stats for unknown restaurant
      return new Response(
        JSON.stringify({
          restaurant: restaurant,
          restaurantId: restaurant,
          timeRange,
          totalDays: 0,
          totalAppearances: 0,
          appearancesInRange: 0,
          appearanceRate: 0,
          lastAppearance: null,
          firstSeen: null,
          lastUpdated: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const data = JSON.parse(restaurantData);
    const appearances = data.appearances || [];
    const soldOutDates = data.soldOutDates || [];

    // Calculate stats
    const totalAppearances = appearances.length;
    const totalSoldOuts = soldOutDates.length;
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    // Calculate appearance rate (appearances per week)
    const appearanceRate = totalAppearances > 0 ? (totalAppearances / 7).toFixed(2) : 0;

    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    const soldOutRate = totalAppearances > 0 ? (totalSoldOuts / totalAppearances).toFixed(3) : 0;

    return new Response(
      JSON.stringify({
        appearanceRate: parseFloat(appearanceRate),
        appearances: appearances,
        appearancesInRange: totalAppearances,
        firstSeen,
        lastAppearance,
        lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
        restaurant: data.name || restaurant,
        restaurantId: data.id || restaurant,
        soldOutRate,
        timeRange,
        totalAppearances,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    return createErrorResponse('Failed to get restaurant appearances', 500, {
      error: error.message,
    });
  }
}

// Update restaurant (name, menu, etc.)
export async function update(request, env) {
  try {
    const { restaurantId, restaurantName, menuItems } = await request.json();

    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    if (restaurantName && restaurantName.length < 2) {
      return createErrorResponse('Restaurant name must be at least 2 characters long', 400);
    }

    // Get existing restaurant data from KV
    const restaurantKey = `restaurant:${restaurantId}`;
    const existingData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    let restaurantData;
    if (existingData) {
      restaurantData = JSON.parse(existingData);
    } else {
      // Create new restaurant record if it doesn't exist
      restaurantData = {
        id: restaurantId,
        name: restaurantName,
        appearances: [],
        soldOutDates: [],
        menu: [],
        firstSeen: null,
        lastSeen: null,
        createdAt: new Date().toISOString(),
      };
    }

    // Initialize menu if it doesn't exist
    if (!restaurantData.menu) {
      restaurantData.menu = [];
    }

    const updates = [];
    let hasChanges = false;

    // Update menu if provided
    if (menuItems && Array.isArray(menuItems)) {
      const menuChanged = compareMenus(restaurantData.menu, menuItems);
      if (menuChanged) {
        restaurantData.menu = menuItems;
        updates.push('menu');
        hasChanges = true;
      }
    }

    // Check if the name is actually different
    if (restaurantName && restaurantData.name !== restaurantName) {
      const oldName = restaurantData.name;

      // Remove old name mapping if it exists
      if (oldName && oldName !== restaurantId) {
        const oldNameKey = `restaurant_name:${oldName}`;
        await env.LANCHDRAP_RATINGS.delete(oldNameKey);
      }

      // Update restaurant name
      restaurantData.name = restaurantName;
      updates.push('name');
      hasChanges = true;

      // Add new name mapping (only if name is different from ID)
      await ensureNameMapping(env, restaurantId, restaurantName, 'update endpoint name change');
    }

    if (!hasChanges) {
      // No changes needed
      return createApiResponse(
        {
          success: true,
          message: 'No changes detected - restaurant data is up to date',
          data: {
            restaurantId,
            name: restaurantData.name,
            menu: restaurantData.menu,
            unchanged: true,
            timestamp: new Date().toISOString(),
          },
        },
        200
      );
    }

    // Ensure name mapping exists if restaurant has a name
    await ensureNameMapping(env, restaurantId, restaurantData.name, 'update endpoint verification');

    // Update timestamp and save to KV
    updateRestaurantTimestamp(restaurantData);
    await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(restaurantData));

    return createApiResponse(
      {
        success: true,
        message: `Updated restaurant: ${updates.join(', ')}`,
        data: {
          restaurantId,
          name: restaurantData.name,
          menu: restaurantData.menu,
          updatedFields: updates,
          updatedAt: restaurantData.updatedAt,
        },
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to update restaurant', 500, { error: error.message });
  }
}

// Get all restaurants
export async function getAllRestaurants(_request, env) {
  try {
    // List all restaurant keys from KV
    const list = await env.LANCHDRAP_RATINGS.list({ prefix: 'restaurant:' });
    const restaurants = [];

    for (const key of list.keys) {
      const restaurantData = await env.LANCHDRAP_RATINGS.get(key.name);
      if (restaurantData) {
        const data = JSON.parse(restaurantData);
        restaurants.push({
          id: data.id,
          name: data.name,
          appearances: data.appearances || [],
          totalAppearances: (data.appearances || []).length,
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
    }

    // Sort by total appearances (descending)
    restaurants.sort((a, b) => b.totalAppearances - a.totalAppearances);

    return createApiResponse(
      {
        restaurants,
        total: restaurants.length,
        lastUpdated: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to get restaurants', 500, { error: error.message });
  }
}

// Get restaurant by ID or name
export async function getRestaurantById(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    let restaurantId = pathParts[pathParts.length - 1]; // Get ID from URL path

    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    // Check if a name is provided in query params for potential update
    const providedName = url.searchParams.get('name');

    // Check if the provided ID is actually a restaurant name
    // If we can't find a restaurant with this ID, try looking it up as a name
    let restaurantKey = `restaurant:${restaurantId}`;
    let restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    if (!restaurantData) {
      // Try to find by name
      const foundId = await getRestaurantIdByName(env, restaurantId);
      if (foundId) {
        restaurantId = foundId;
        restaurantKey = `restaurant:${restaurantId}`;
        restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);
      }
    }

    if (!restaurantData) {
      return createErrorResponse('Restaurant not found', 404);
    }

    const data = JSON.parse(restaurantData);
    const appearances = data.appearances || [];
    const soldOutDates = data.soldOutDates || [];

    // Ensure name mapping exists if restaurant has a name
    await ensureNameMapping(env, restaurantId, data.name, 'getRestaurantById verification');

    // Update name if provided and different from stored name
    let nameUpdated = false;
    if (providedName && providedName !== restaurantId && providedName !== data.name) {
      // Only update if the provided name is better (not just the ID) and different
      data.name = providedName;
      updateRestaurantTimestamp(data);

      // Save updated data to KV
      await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(data));
      nameUpdated = true;
    }

    // Calculate stats
    const totalAppearances = appearances.length;
    const totalSoldOuts = soldOutDates.length;
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    // Calculate appearance rate (appearances per week)
    const appearanceRate = totalAppearances > 0 ? (totalAppearances / 7).toFixed(2) : 0;

    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    const soldOutRate = totalAppearances > 0 ? (totalSoldOuts / totalAppearances).toFixed(3) : 0;

    return new Response(
      JSON.stringify({
        name: data.name || restaurantId, // Use ID as fallback if no name
        id: data.id || restaurantId,
        color: data.color || null, // Include the color
        timeRange: 'all',
        totalDays: 7, // Assuming we track for 7 days
        totalAppearances,
        appearancesInRange: totalAppearances, // For now, all appearances are in range
        appearanceRate: parseFloat(appearanceRate),
        totalSoldOuts,
        soldOutRate: parseFloat(soldOutRate),
        lastAppearance,
        firstSeen,
        lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
        appearances: appearances, // Include the actual appearance dates
        // Add timezone info to help with date display
        timezone: 'America/Chicago', // LunchDrop appears to be in Central Time
        nameUpdated: nameUpdated, // Indicate if name was updated during this request
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    return createErrorResponse('Failed to get restaurant', 500, { error: error.message });
  }
}

// Search restaurant by name
export async function searchRestaurantByName(request, env) {
  try {
    const url = new URL(request.url);
    const restaurantName = url.searchParams.get('name');

    if (!restaurantName) {
      return createErrorResponse('Restaurant name is required', 400);
    }

    // Try to find restaurant ID by name
    const restaurantId = await getRestaurantIdByName(env, restaurantName);

    if (!restaurantId) {
      return createErrorResponse('Restaurant not found', 404);
    }

    // Get restaurant data
    const restaurantKey = `restaurant:${restaurantId}`;
    const restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    if (!restaurantData) {
      return createErrorResponse('Restaurant data not found', 404);
    }

    const data = JSON.parse(restaurantData);
    const appearances = data.appearances || [];
    const soldOutDates = data.soldOutDates || [];

    // Calculate stats
    const totalAppearances = appearances.length;
    const totalSoldOuts = soldOutDates.length;
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    // Calculate appearance rate (appearances per week)
    const appearanceRate = totalAppearances > 0 ? (totalAppearances / 7).toFixed(2) : 0;

    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    const soldOutRate = totalAppearances > 0 ? (totalSoldOuts / totalAppearances).toFixed(3) : 0;

    return new Response(
      JSON.stringify({
        name: data.name || restaurantName,
        id: data.id || restaurantId,
        color: data.color || null,
        menu: data.menu || [],
        timeRange: 'all',
        totalDays: 7,
        totalAppearances,
        appearancesInRange: totalAppearances,
        appearanceRate: parseFloat(appearanceRate),
        totalSoldOuts,
        soldOutRate: parseFloat(soldOutRate),
        lastAppearance,
        firstSeen,
        lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
        appearances: appearances,
        timezone: 'America/Chicago',
        foundByName: true, // Indicate this was found by name lookup
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    return createErrorResponse('Failed to search restaurant', 500, { error: error.message });
  }
}

// Submit availability summary
export async function submitAvailabilitySummary(request, _env) {
  try {
    const _summaryData = await request.json();

    // COMMENTED OUT: No longer storing availability summary data
    // const summaryKey = `availability_summary:${Date.now()}`;
    // await env.LANCHDRAP_RATINGS.put(summaryKey, JSON.stringify(summaryData));

    // Just acknowledge receipt, don't store the data
    return createApiResponse(
      {
        received: true,
        timestamp: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to submit availability summary', 500, {
      error: error.message,
    });
  }
}

// Store user order history
export async function storeUserOrder(request, env) {
  try {
    const { userId, restaurantId, orderData } = await request.json();

    if (!userId || !restaurantId || !orderData) {
      return createErrorResponse('Missing required fields: userId, restaurantId, orderData', 400);
    }

    // Get existing user data
    const userKey = `user_orders:${userId}`;
    const existingUserData = await env.LANCHDRAP_RATINGS.get(userKey);

    let userData = { orders: {} };
    if (existingUserData) {
      userData = JSON.parse(existingUserData);
      // Ensure orders object exists
      if (!userData.orders) {
        userData.orders = {};
      }
    }

    // Initialize restaurant orders if not exists
    if (!userData.orders[restaurantId]) {
      userData.orders[restaurantId] = {
        orders: [],
      };
    }

    // Add new order to restaurant's order history
    const newOrder = {
      date: orderData.date || new Date().toISOString().split('T')[0],
      items: orderData.items || [],
    };

    userData.orders[restaurantId].orders.push(newOrder);

    // Keep only last 50 orders per restaurant to prevent unlimited growth
    if (userData.orders[restaurantId].orders.length > 50) {
      userData.orders[restaurantId].orders = userData.orders[restaurantId].orders.slice(-50);
    }

    // Save updated user data
    await env.LANCHDRAP_RATINGS.put(userKey, JSON.stringify(userData));

    return createApiResponse({
      success: true,
      message: 'Order stored successfully',
      data: {
        userId,
        restaurantId,
        order: newOrder,
        totalOrders: userData.orders[restaurantId].orders.length,
      },
    });
  } catch (_error) {
    return createErrorResponse('Failed to store order', 500);
  }
}

// Get user order history
export async function getUserOrderHistory(request, env) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const restaurantId = url.searchParams.get('restaurantId'); // Optional filter

    if (!userId) {
      return createErrorResponse('Missing required parameter: userId', 400);
    }

    // Get user data
    const userKey = `user_orders:${userId}`;
    const userDataRaw = await env.LANCHDRAP_RATINGS.get(userKey);

    if (!userDataRaw) {
      return createApiResponse({
        success: true,
        message: 'No order history found',
        data: {
          userId,
          orders: {},
        },
      });
    }

    const userData = JSON.parse(userDataRaw);
    const orderHistory = userData.orders || {};

    // Filter by restaurant if specified
    if (restaurantId) {
      const restaurantData = orderHistory[restaurantId];
      if (!restaurantData) {
        return createApiResponse({
          success: true,
          message: 'No order history found for this restaurant',
          data: {
            userId,
            restaurantId,
            orders: [],
          },
        });
      }

      return createApiResponse({
        success: true,
        message: 'Order history retrieved successfully',
        data: {
          userId,
          restaurantId,
          orders: restaurantData.orders,
        },
      });
    }

    return createApiResponse({
      success: true,
      message: 'Order history retrieved successfully',
      data: {
        userId,
        orders: orderHistory,
      },
    });
  } catch (_error) {
    return createErrorResponse('Failed to retrieve order history', 500);
  }
}

// Get user's restaurant order summary (all restaurants they've ordered from)
export async function getUserRestaurantSummary(request, env) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return createErrorResponse('Missing required parameter: userId', 400);
    }

    // Get user data
    const userKey = `user_orders:${userId}`;
    const userDataRaw = await env.LANCHDRAP_RATINGS.get(userKey);

    if (!userDataRaw) {
      return createApiResponse({
        success: true,
        message: 'No order history found',
        data: {
          userId,
          restaurants: [],
        },
      });
    }

    const userData = JSON.parse(userDataRaw);
    const orderHistory = userData.orders || {};

    // Transform the data to show restaurant summary
    const restaurants = Object.keys(orderHistory).map((restaurantId) => {
      const restaurantData = orderHistory[restaurantId];
      const orders = restaurantData.orders || [];
      const lastOrderDate = orders.length > 0 ? orders[orders.length - 1].date : null;

      return {
        restaurantId,
        totalOrders: orders.length,
        lastOrderDate,
        recentOrders: orders.slice(-5), // Last 5 orders
      };
    });

    // Sort by last order date (most recent first)
    restaurants.sort((a, b) => {
      if (!a.lastOrderDate && !b.lastOrderDate) return 0;
      if (!a.lastOrderDate) return 1;
      if (!b.lastOrderDate) return -1;
      return new Date(b.lastOrderDate) - new Date(a.lastOrderDate);
    });

    return createApiResponse({
      success: true,
      message: 'Restaurant summary retrieved successfully',
      data: {
        userId,
        totalRestaurants: restaurants.length,
        restaurants,
      },
    });
  } catch (_error) {
    return createErrorResponse('Failed to retrieve restaurant summary', 500);
  }
}

// Functions are already exported individually above
