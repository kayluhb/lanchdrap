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

// Helper function to calculate sold out rate excluding today's date from sold out count
function calculateSoldOutRateExcludingToday(appearances, soldOutDates) {
  const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

  // Include all appearances (including today)
  const totalAppearances = appearances.length;

  // Filter out today's date from sold out dates only
  const soldOutDatesExcludingToday = soldOutDates.filter((date) => date !== today);
  const totalSoldOuts = soldOutDatesExcludingToday.length;

  return {
    rate: totalAppearances > 0 ? (totalSoldOuts / totalAppearances).toFixed(3) : 0,
    totalAppearances,
    totalSoldOuts,
  };
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

    // Track if any changes were made to avoid unnecessary KV writes
    let dataChanged = false;

    if (!restaurantData.appearances.includes(date)) {
      restaurantData.appearances.push(date);
      restaurantData.appearances.sort(); // Keep dates sorted
      restaurantData.lastSeen = date;
      updateRestaurantTimestamp(restaurantData);
      dataChanged = true;

      // Update first seen if this is earlier
      if (date < restaurantData.firstSeen) {
        restaurantData.firstSeen = date;
      }
    } else {
    }

    // Initialize soldOutDates array if it doesn't exist (for existing records)
    if (!restaurantData.soldOutDates) {
      restaurantData.soldOutDates = [];
    }

    // Initialize color if it doesn't exist (for existing records)
    if (!restaurantData.color && restaurantInfo.color) {
      restaurantData.color = restaurantInfo.color;
      dataChanged = true;
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
      dataChanged = true;
    }

    // Update restaurant name if we have a better one and it's different
    if (
      restaurantName &&
      restaurantName !== restaurantId &&
      restaurantData.name !== restaurantName
    ) {
      const oldName = restaurantData.name;
      restaurantData.name = restaurantName;
      dataChanged = true;

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
        dataChanged = true;
      }
    }

    // Ensure name mapping exists if restaurant has a name
    await ensureNameMapping(
      env,
      restaurantId,
      restaurantData.name,
      'trackRestaurantAppearances verification'
    );

    // Only save to KV if data actually changed
    if (dataChanged) {
      await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(restaurantData));
    }

    // Calculate sell out rate for response
    const totalAppearances = restaurantData.appearances.length;
    const totalSoldOuts = restaurantData.soldOutDates.length;
    const sellOutRate = totalAppearances > 0 ? totalSoldOuts / totalAppearances : 0;

    updatedRestaurants.push({
      ...restaurantData,
      sellOutRate: parseFloat(sellOutRate.toFixed(3)), // Ensure it's a float with 3 decimal places
      dataChanged, // Include whether data was actually changed
    });
  }

  // Count how many restaurants actually had data changes
  const restaurantsWithChanges = updatedRestaurants.filter((r) => r.dataChanged).length;

  return {
    success: true,
    updatedCount: restaurants.length,
    totalRestaurants: updatedRestaurants.length,
    restaurantsWithChanges,
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
        message: `Tracked ${restaurants.length} restaurant appearances for ${date} (${result.restaurantsWithChanges} had changes)`,
        data: {
          date,
          totalRestaurants: restaurants.length,
          updatedRestaurants: result.totalRestaurants,
          restaurantsWithChanges: result.restaurantsWithChanges,
          restaurants: result.updatedRestaurants.map((r) => ({
            id: r.id,
            name: r.name,
            sellOutRate: r.sellOutRate,
            dataChanged: r.dataChanged,
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
    const userId = url.searchParams.get('userId');

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
          totalAppearances: 0,
          lastAppearance: null,
          firstSeen: null,
          lastUpdated: new Date().toISOString(),
          userOrderHistory: null,
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
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    // Exclude today's date from the calculation
    const soldOutStats = calculateSoldOutRateExcludingToday(appearances, soldOutDates);
    const soldOutRate = soldOutStats.rate;

    // Get user order history if userId is provided
    let userOrderHistory = null;
    if (userId) {
      const userRestaurantKey = `user_restaurant_history:${userId}:${restaurant}`;
      const historyDataRaw = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);

      if (historyDataRaw) {
        const historyData = JSON.parse(historyDataRaw);
        // Handle both old and new data structures
        let orders = [];
        if (historyData.orders && Array.isArray(historyData.orders)) {
          // Old structure - already in array format
          orders = historyData.orders.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
          // New structure - convert date-keyed structure to array format
          orders = Object.keys(historyData)
            .map((date) => ({
              date,
              items: historyData[date].items || [],
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
        }

        if (orders.length > 0) {
          // Get the last order (most recent)
          const lastOrder = orders[0]; // First item is newest after sorting

          // Get all order dates
          const orderDates = orders.map((order) => order.date);

          // Get the last item purchased (from the most recent order)
          const lastItemPurchased =
            lastOrder.items && lastOrder.items.length > 0
              ? lastOrder.items[lastOrder.items.length - 1]
              : null;

          userOrderHistory = {
            totalOrders: orders.length,
            lastOrderDate: lastOrder.date,
            lastItemPurchased: lastItemPurchased,
            lastOrderItems: lastOrder.items || [], // All items from the last order
            orderDates: orderDates,
            recentOrders: orders.slice(0, 5), // First 5 orders (newest)
          };
        }
      }
    }

    return new Response(
      JSON.stringify({
        appearances: appearances,
        firstSeen,
        lastAppearance,
        lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
        restaurant: data.name || restaurant,
        restaurantId: data.id || restaurant,
        soldOutRate,
        totalAppearances,
        userOrderHistory,
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

// Update restaurant appearances and sold out dates
export async function updateAppearances(request, env) {
  try {
    const { restaurantId, appearanceDates, soldoutDates } = await request.json();

    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    if (!appearanceDates || !Array.isArray(appearanceDates)) {
      return createErrorResponse('Appearance dates array is required', 400);
    }

    if (!soldoutDates || !Array.isArray(soldoutDates)) {
      return createErrorResponse('Sold out dates array is required', 400);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const invalidAppearanceDates = appearanceDates.filter((date) => !dateRegex.test(date));
    const invalidSoldoutDates = soldoutDates.filter((date) => !dateRegex.test(date));

    if (invalidAppearanceDates.length > 0) {
      return createErrorResponse(
        `Invalid appearance date format: ${invalidAppearanceDates.join(', ')}. Use YYYY-MM-DD format.`,
        400
      );
    }

    if (invalidSoldoutDates.length > 0) {
      return createErrorResponse(
        `Invalid sold out date format: ${invalidSoldoutDates.join(', ')}. Use YYYY-MM-DD format.`,
        400
      );
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
        name: restaurantId, // Use ID as name if no name exists
        appearances: [],
        soldOutDates: [],
        menu: [],
        firstSeen: null,
        lastSeen: null,
        createdAt: new Date().toISOString(),
      };
    }

    // Sort dates to ensure proper ordering
    const sortedAppearanceDates = [...new Set(appearanceDates)].sort();
    const sortedSoldoutDates = [...new Set(soldoutDates)].sort();

    // Update the data
    restaurantData.appearances = sortedAppearanceDates;
    restaurantData.soldOutDates = sortedSoldoutDates;

    // Update first seen and last seen
    if (sortedAppearanceDates.length > 0) {
      restaurantData.firstSeen = sortedAppearanceDates[0];
      restaurantData.lastSeen = sortedAppearanceDates[sortedAppearanceDates.length - 1];
    } else {
      restaurantData.firstSeen = null;
      restaurantData.lastSeen = null;
    }

    // Update timestamp and save to KV
    updateRestaurantTimestamp(restaurantData);
    await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(restaurantData));

    return createApiResponse(
      {
        success: true,
        message: `Updated restaurant appearances and sold out dates`,
        data: {
          restaurantId,
          name: restaurantData.name,
          totalAppearances: sortedAppearanceDates.length,
          totalSoldOuts: sortedSoldoutDates.length,
          firstSeen: restaurantData.firstSeen,
          lastSeen: restaurantData.lastSeen,
          updatedAt: restaurantData.updatedAt,
        },
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to update restaurant appearances', 500, {
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
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    // Exclude today's date from the calculation
    const soldOutStats = calculateSoldOutRateExcludingToday(appearances, soldOutDates);
    const soldOutRate = soldOutStats.rate;

    return new Response(
      JSON.stringify({
        name: data.name || restaurantId, // Use ID as fallback if no name
        id: data.id || restaurantId,
        color: data.color || null, // Include the color
        totalAppearances: appearances.length,
        totalSoldOuts: soldOutStats.totalSoldOuts,
        soldOutRate: parseFloat(soldOutRate),
        lastAppearance,
        firstSeen,
        lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
        appearances: appearances, // Include the actual appearance dates
        soldOutDates: soldOutDates, // Include the sold out dates for editing
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
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    // Exclude today's date from the calculation
    const soldOutStats = calculateSoldOutRateExcludingToday(appearances, soldOutDates);
    const soldOutRate = soldOutStats.rate;

    return new Response(
      JSON.stringify({
        name: data.name || restaurantName,
        id: data.id || restaurantId,
        color: data.color || null,
        menu: data.menu || [],
        timeRange: 'all',
        totalDays: 7,
        totalAppearances: appearances.length,
        appearancesInRange: appearances.length,
        appearanceRate: 1.0, // Since we're searching by name, we found it (100% appearance rate)
        totalSoldOuts: soldOutStats.totalSoldOuts,
        soldOutRate: parseFloat(soldOutRate),
        lastAppearance,
        firstSeen,
        lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
        appearances: appearances,
        soldOutDates: soldOutDates, // Include the sold out dates for editing
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

    // Create individual user-restaurant history record key
    const userRestaurantKey = `user_restaurant_history:${userId}:${restaurantId}`;
    const existingHistoryData = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);

    let historyData = {};
    if (existingHistoryData) {
      const parsedData = JSON.parse(existingHistoryData);

      // Handle migration from old structure to new structure
      if (parsedData.orders && Array.isArray(parsedData.orders)) {
        // Convert old array-based structure to new date-keyed structure
        historyData = {};
        for (const order of parsedData.orders) {
          historyData[order.date] = {
            items: order.items || [],
          };
        }
      } else if (
        parsedData.orders &&
        typeof parsedData.orders === 'object' &&
        !Array.isArray(parsedData.orders)
      ) {
        // Handle malformed data where orders is an object but should be the root structure
        // This happens when old and new formats get mixed up
        historyData = parsedData.orders;
      } else {
        // Already in new structure (date-keyed at root level)
        historyData = parsedData;
      }
    }

    // Add new order to the history
    const orderDate = orderData.date || new Date().toISOString().split('T')[0];
    const newOrderItems = orderData.items || [];

    // Check for duplicate orders (same date and same items)
    let isDuplicate = false;
    if (historyData[orderDate]) {
      const existingItems = historyData[orderDate].items || [];

      // Compare items arrays
      if (existingItems.length === newOrderItems.length) {
        isDuplicate = existingItems.every((existingItem, index) => {
          const newItem = newOrderItems[index];
          return (
            existingItem.name === newItem.name &&
            existingItem.quantity === newItem.quantity &&
            existingItem.fullDescription === newItem.fullDescription
          );
        });
      }
    }

    // Only add if it's not a duplicate
    let orderAdded = false;
    let dataChanged = false;

    if (!isDuplicate) {
      // Check if the data is actually different from what's already stored
      const existingOrderData = historyData[orderDate];
      const newOrderData = {
        items: newOrderItems,
      };

      // Compare the new order data with existing data
      const isDataDifferent =
        !existingOrderData ||
        JSON.stringify(existingOrderData.items) !== JSON.stringify(newOrderData.items);

      if (isDataDifferent) {
        historyData[orderDate] = newOrderData;
        orderAdded = true;
        dataChanged = true;
      }
    }

    // Keep only last 50 order dates to prevent unlimited growth
    const orderDates = Object.keys(historyData).sort();
    if (orderDates.length > 50) {
      const datesToRemove = orderDates.slice(0, orderDates.length - 50);
      for (const date of datesToRemove) {
        delete historyData[date];
        dataChanged = true;
      }
    }

    // Only save to KV if data actually changed
    if (dataChanged) {
      await env.LANCHDRAP_RATINGS.put(userRestaurantKey, JSON.stringify(historyData));
    }

    return createApiResponse({
      success: true,
      message: orderAdded
        ? 'Order stored successfully'
        : isDuplicate
          ? 'Order already exists (duplicate prevented)'
          : 'Order data unchanged (no KV write)',
      data: {
        userId,
        restaurantId,
        orderDate,
        totalOrders: Object.keys(historyData).length,
        orderAdded,
        isDuplicate,
        dataChanged,
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

    // Filter by restaurant if specified
    if (restaurantId) {
      const userRestaurantKey = `user_restaurant_history:${userId}:${restaurantId}`;
      const historyDataRaw = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);

      if (!historyDataRaw) {
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

      const historyData = JSON.parse(historyDataRaw);

      // Handle both old and new data structures
      let orders = [];
      if (historyData.orders && Array.isArray(historyData.orders)) {
        // Old structure - already in array format
        orders = historyData.orders.sort((a, b) => new Date(b.date) - new Date(a.date));
      } else if (
        historyData.orders &&
        typeof historyData.orders === 'object' &&
        !Array.isArray(historyData.orders)
      ) {
        // Handle malformed data where orders is an object but should be the root structure
        orders = Object.keys(historyData.orders)
          .map((date) => ({
            date,
            items: historyData.orders[date].items || [],
          }))
          .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
      } else {
        // New structure - convert date-keyed structure to array format
        orders = Object.keys(historyData)
          .map((date) => ({
            date,
            items: historyData[date].items || [],
          }))
          .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
      }

      return createApiResponse({
        success: true,
        message: 'Order history retrieved successfully',
        data: {
          userId,
          restaurantId,
          orders,
        },
      });
    }

    // Get all user-restaurant history records for this user
    const prefix = `user_restaurant_history:${userId}:`;
    const list = await env.LANCHDRAP_RATINGS.list({ prefix });

    const orderHistory = {};

    for (const key of list.keys) {
      // Extract restaurant ID from key: user_restaurant_history:userId:restaurantId
      const keyParts = key.name.split(':');
      if (keyParts.length >= 3) {
        const restaurantId = keyParts.slice(2).join(':'); // Handle restaurant IDs with colons
        const historyDataRaw = await env.LANCHDRAP_RATINGS.get(key.name);

        if (historyDataRaw) {
          const historyData = JSON.parse(historyDataRaw);

          // Handle both old and new data structures
          let orders = [];
          if (historyData.orders && Array.isArray(historyData.orders)) {
            // Old structure - already in array format
            orders = historyData.orders.sort((a, b) => new Date(b.date) - new Date(a.date));
          } else if (
            historyData.orders &&
            typeof historyData.orders === 'object' &&
            !Array.isArray(historyData.orders)
          ) {
            // Handle malformed data where orders is an object but should be the root structure
            orders = Object.keys(historyData.orders)
              .map((date) => ({
                date,
                items: historyData.orders[date].items || [],
              }))
              .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
          } else {
            // New structure - convert date-keyed structure to array format
            orders = Object.keys(historyData)
              .map((date) => ({
                date,
                items: historyData[date].items || [],
              }))
              .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
          }

          orderHistory[restaurantId] = {
            orders,
          };
        }
      }
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

// Clean up duplicate orders for a user-restaurant combination
export async function cleanupDuplicateOrders(request, env) {
  try {
    const { userId, restaurantId } = await request.json();

    if (!userId || !restaurantId) {
      return createErrorResponse('Missing required fields: userId, restaurantId', 400);
    }

    const userRestaurantKey = `user_restaurant_history:${userId}:${restaurantId}`;
    const historyDataRaw = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);

    if (!historyDataRaw) {
      return createApiResponse({
        success: true,
        message: 'No order history found',
        data: { userId, restaurantId, originalCount: 0, cleanedCount: 0 },
      });
    }

    const historyData = JSON.parse(historyDataRaw);

    // Handle both old and new data structures for migration
    let originalCount = 0;
    const cleanedData = {};

    if (historyData.orders && Array.isArray(historyData.orders)) {
      // Old structure - convert to new structure
      originalCount = historyData.orders.length;
      const seenOrders = new Set();

      for (const order of historyData.orders) {
        const orderKey = `${order.date}_${JSON.stringify(
          order.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            fullDescription: item.fullDescription,
          }))
        )}`;

        if (!seenOrders.has(orderKey)) {
          seenOrders.add(orderKey);
          cleanedData[order.date] = {
            items: order.items,
          };
        }
      }
    } else if (
      historyData.orders &&
      typeof historyData.orders === 'object' &&
      !Array.isArray(historyData.orders)
    ) {
      // Handle malformed data where orders is an object but should be the root structure
      originalCount = Object.keys(historyData.orders).length;
      const seenOrders = new Set();

      for (const [date, orderData] of Object.entries(historyData.orders)) {
        const orderKey = `${date}_${JSON.stringify(
          orderData.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            fullDescription: item.fullDescription,
          }))
        )}`;

        if (!seenOrders.has(orderKey)) {
          seenOrders.add(orderKey);
          cleanedData[date] = orderData;
        }
      }
    } else {
      // New structure - already date-keyed
      originalCount = Object.keys(historyData).length;
      const seenOrders = new Set();

      for (const [date, orderData] of Object.entries(historyData)) {
        const orderKey = `${date}_${JSON.stringify(
          orderData.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            fullDescription: item.fullDescription,
          }))
        )}`;

        if (!seenOrders.has(orderKey)) {
          seenOrders.add(orderKey);
          cleanedData[date] = orderData;
        }
      }
    }

    // Only save to KV if data actually changed
    const cleanedCount = Object.keys(cleanedData).length;
    if (cleanedCount !== originalCount) {
      await env.LANCHDRAP_RATINGS.put(userRestaurantKey, JSON.stringify(cleanedData));
    }

    const finalCleanedCount = Object.keys(cleanedData).length;
    const duplicatesRemoved = originalCount - finalCleanedCount;

    return createApiResponse({
      success: true,
      message:
        duplicatesRemoved > 0
          ? 'Duplicate orders cleaned up successfully'
          : 'No duplicates found (no KV write)',
      data: {
        userId,
        restaurantId,
        originalCount,
        cleanedCount: finalCleanedCount,
        duplicatesRemoved,
        dataChanged: duplicatesRemoved > 0,
      },
    });
  } catch (_error) {
    return createErrorResponse('Failed to cleanup duplicate orders', 500);
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

    // Get all user-restaurant history records for this user
    const prefix = `user_restaurant_history:${userId}:`;
    const list = await env.LANCHDRAP_RATINGS.list({ prefix });

    if (list.keys.length === 0) {
      console.log('getUserRestaurantSummary: No keys found, returning empty result');
      return createApiResponse({
        userId,
        totalRestaurants: 0,
        restaurants: [],
      });
    }

    const restaurants = [];
    console.log('getUserRestaurantSummary: Processing', list.keys.length, 'keys');

    for (const key of list.keys) {
      console.log('getUserRestaurantSummary: Processing key:', key.name);
      // Extract restaurant ID from key: user_restaurant_history:userId:restaurantId
      const keyParts = key.name.split(':');
      console.log('getUserRestaurantSummary: Key parts:', keyParts);

      if (keyParts.length >= 3) {
        const restaurantId = keyParts.slice(2).join(':'); // Handle restaurant IDs with colons
        console.log('getUserRestaurantSummary: Extracted restaurantId:', restaurantId);

        const historyDataRaw = await env.LANCHDRAP_RATINGS.get(key.name);
        console.log(
          'getUserRestaurantSummary: Raw history data length:',
          historyDataRaw ? historyDataRaw.length : 'null'
        );

        if (historyDataRaw) {
          try {
            console.log('getUserRestaurantSummary: Attempting to parse JSON for key:', key.name);
            const historyData = JSON.parse(historyDataRaw);
            console.log(
              'getUserRestaurantSummary: Successfully parsed JSON, structure:',
              Object.keys(historyData)
            );

            // Handle both old and new data structures
            let orders = [];
            if (historyData.orders && Array.isArray(historyData.orders)) {
              console.log('getUserRestaurantSummary: Using old structure (array format)');
              // Old structure - already in array format
              orders = historyData.orders.sort((a, b) => new Date(b.date) - new Date(a.date));
            } else if (
              historyData.orders &&
              typeof historyData.orders === 'object' &&
              !Array.isArray(historyData.orders)
            ) {
              console.log('getUserRestaurantSummary: Using malformed structure (orders object)');
              // Handle malformed data where orders is an object but should be the root structure
              orders = Object.keys(historyData.orders)
                .map((date) => ({
                  date,
                  items: historyData.orders[date].items || [],
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
            } else {
              console.log('getUserRestaurantSummary: Using new structure (date-keyed)');
              // New structure - convert date-keyed structure to array format
              orders = Object.keys(historyData)
                .map((date) => ({
                  date,
                  items: historyData[date].items || [],
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
            }

            console.log(
              'getUserRestaurantSummary: Processed',
              orders.length,
              'orders for restaurant:',
              restaurantId
            );
            const lastOrderDate = orders.length > 0 ? orders[0].date : null; // First item is newest

            restaurants.push({
              restaurantId,
              totalOrders: orders.length,
              lastOrderDate,
              recentOrders: orders.slice(0, 5), // First 5 orders (newest)
            });
          } catch (parseError) {
            console.error(
              'getUserRestaurantSummary: JSON parse error for key:',
              key.name,
              'Error:',
              parseError.message
            );
            console.error(
              'getUserRestaurantSummary: Raw data that failed to parse:',
              historyDataRaw
            );
          }
        } else {
          console.log('getUserRestaurantSummary: No raw data for key:', key.name);
        }
      } else {
        console.log('getUserRestaurantSummary: Key parts insufficient for key:', key.name);
      }
    }

    console.log('getUserRestaurantSummary: Processed', restaurants.length, 'restaurants');

    // Sort by last order date (most recent first)
    restaurants.sort((a, b) => {
      if (!a.lastOrderDate && !b.lastOrderDate) return 0;
      if (!a.lastOrderDate) return 1;
      if (!b.lastOrderDate) return -1;
      return new Date(b.lastOrderDate) - new Date(a.lastOrderDate);
    });

    console.log(
      'getUserRestaurantSummary: Returning success with',
      restaurants.length,
      'restaurants'
    );
    return createApiResponse({
      userId,
      totalRestaurants: restaurants.length,
      restaurants,
    });
  } catch (error) {
    console.error('getUserRestaurantSummary: Unexpected error:', error.message);
    console.error('getUserRestaurantSummary: Error stack:', error.stack);
    return createErrorResponse('Failed to retrieve restaurant summary', 500, null, {
      error: error.message,
    });
  }
}

// Get restaurant stats with user order history (combined endpoint)
export async function getRestaurantStatsWithUserHistory(request, env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');
    const userId = url.searchParams.get('userId');

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
          name: restaurant,
          id: restaurant,
          color: null,
          totalAppearances: 0,
          totalSoldOuts: 0,
          soldOutRate: 0,
          lastAppearance: null,
          firstSeen: null,
          lastUpdated: new Date().toISOString(),
          appearances: [],
          timezone: 'America/Chicago',
          userOrderHistory: null,
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

    // Calculate basic stats
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    // Exclude today's date from the calculation
    const soldOutStats = calculateSoldOutRateExcludingToday(appearances, soldOutDates);
    const soldOutRate = soldOutStats.rate;

    // Get user order history if userId is provided
    let userOrderHistory = null;
    if (userId) {
      const userRestaurantKey = `user_restaurant_history:${userId}:${restaurant}`;
      const historyDataRaw = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);

      if (historyDataRaw) {
        const historyData = JSON.parse(historyDataRaw);
        // Handle both old and new data structures
        let orders = [];
        if (historyData.orders && Array.isArray(historyData.orders)) {
          // Old structure - already in array format
          orders = historyData.orders.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
          // New structure - convert date-keyed structure to array format
          orders = Object.keys(historyData)
            .map((date) => ({
              date,
              items: historyData[date].items || [],
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
        }

        if (orders.length > 0) {
          // Get the last order (most recent)
          const lastOrder = orders[0]; // First item is newest after sorting

          // Get all order dates
          const orderDates = orders.map((order) => order.date);

          // Get the last item purchased (from the most recent order)
          const lastItemPurchased =
            lastOrder.items && lastOrder.items.length > 0
              ? lastOrder.items[lastOrder.items.length - 1]
              : null;

          userOrderHistory = {
            totalOrders: orders.length,
            lastOrderDate: lastOrder.date,
            lastItemPurchased: lastItemPurchased,
            lastOrderItems: lastOrder.items || [], // All items from the last order
            orderDates: orderDates,
            recentOrders: orders.slice(0, 5), // First 5 orders (newest)
          };
        }
      }
    }

    return new Response(
      JSON.stringify({
        // Combined data from both endpoints
        name: data.name || restaurant,
        id: data.id || restaurant,
        color: data.color || null,
        totalAppearances: appearances.length,
        totalSoldOuts: soldOutStats.totalSoldOuts,
        soldOutRate: parseFloat(soldOutRate),
        lastAppearance,
        firstSeen,
        lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
        appearances: appearances,
        timezone: 'America/Chicago',
        userOrderHistory,
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
    return createErrorResponse('Failed to get restaurant stats with user history', 500, {
      error: error.message,
    });
  }
}

// Functions are already exported individually above
