// Restaurant API routes
// Following modern API patterns with proper error handling and validation

import {
  getCachedMenuData,
  getCachedRestaurantData,
  getCachedUserHistoryData,
  invalidateMenuCache,
  invalidateRestaurantCache,
  invalidateUserHistoryCache,
} from '../utils/cache.js';
import { Menu } from '../utils/models.js';
import { getRatingEmoji } from '../utils/rating-utils.js';
import { createApiResponse, createErrorResponse } from '../utils/response.js';
import { compareMenus } from '../utils/restaurants.js';

// Helper function to store menu data separately
async function storeMenuData(env, restaurantId, menuItems) {
  try {
    // Get existing menu data using cache
    const existingData = await getCachedMenuData(env, restaurantId);
    let menu;
    let shouldUpdate = false;

    if (existingData) {
      // Parse existing menu and check if new items would cause changes
      menu = Menu.fromJSON(existingData);

      // Create a copy of the existing menu to compare against
      const originalMenuItems = [...menu.items];

      // Add new items to the menu
      menu.addMenuItems(menuItems);

      // Compare the menu items to see if anything actually changed
      shouldUpdate = !compareMenus(originalMenuItems, menu.items);
    } else {
      // Create new menu - this is always an update
      menu = new Menu({
        restaurantId: restaurantId,
        items: menuItems,
      });
      shouldUpdate = true;
    }

    // Only save to KV and invalidate cache if the menu data actually changed
    if (shouldUpdate) {
      const menuKey = `restaurant_menu:${restaurantId}`;
      await env.LANCHDRAP_RATINGS.put(menuKey, JSON.stringify(menu.toJSON()));

      // Invalidate the menu cache since we updated the data
      await invalidateMenuCache(restaurantId);
    }

    return shouldUpdate; // Return whether the menu was actually updated
  } catch (_error) {
    // Log error but don't fail the main tracking operation
    // Error storing menu data
    return false; // Return false on error
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

    // Get existing restaurant data using cache
    const restaurantData = await getCachedRestaurantData(env, restaurantId);

    let finalRestaurantData;
    if (restaurantData) {
      finalRestaurantData = restaurantData;
    } else {
      // Create new restaurant record
      finalRestaurantData = {
        id: restaurantId,
        name: restaurantName !== restaurantId ? restaurantName : null, // Don't store ID as name
        appearances: [],
        soldOutDates: [],
        color: restaurantInfo.color || null, // Store the color
        logo: restaurantInfo.logo || null, // Store the logo URL
        firstSeen: date,
        lastSeen: date,
        createdAt: new Date().toISOString(),
      };
    }

    // Ensure arrays exist if missing
    if (!Array.isArray(finalRestaurantData.appearances)) finalRestaurantData.appearances = [];
    if (!Array.isArray(finalRestaurantData.soldOutDates)) finalRestaurantData.soldOutDates = [];

    // Track if any changes were made to avoid unnecessary KV writes
    let dataChanged = false;

    if (!finalRestaurantData.appearances.includes(date)) {
      finalRestaurantData.appearances.push(date);
      finalRestaurantData.appearances.sort(); // Keep dates sorted
      finalRestaurantData.lastSeen = date;
      updateRestaurantTimestamp(finalRestaurantData);
      dataChanged = true;

      // Update first seen if this is earlier
      if (date < finalRestaurantData.firstSeen) {
        finalRestaurantData.firstSeen = date;
      }
    }

    // Initialize soldOutDates array if it doesn't exist (for existing records)
    if (!finalRestaurantData.soldOutDates) {
      finalRestaurantData.soldOutDates = [];
    }

    // Initialize color if it doesn't exist (for existing records)
    if (!finalRestaurantData.color && restaurantInfo.color) {
      finalRestaurantData.color = restaurantInfo.color;
      dataChanged = true;
    }

    // Initialize logo if it doesn't exist (for existing records)
    if (!finalRestaurantData.logo && restaurantInfo.logo) {
      finalRestaurantData.logo = restaurantInfo.logo;
      dataChanged = true;
    }

    // Track sold out status if restaurant is sold out
    if (restaurantInfo.status === 'soldout' && !finalRestaurantData.soldOutDates.includes(date)) {
      finalRestaurantData.soldOutDates.push(date);
      finalRestaurantData.soldOutDates.sort(); // Keep dates sorted
      updateRestaurantTimestamp(finalRestaurantData);
      dataChanged = true;
    }

    // Update restaurant name if we have a better one and it's different
    if (
      restaurantName &&
      restaurantName !== restaurantId &&
      finalRestaurantData.name !== restaurantName
    ) {
      finalRestaurantData.name = restaurantName;
      dataChanged = true;
    } else if (restaurantName === restaurantId && finalRestaurantData.name === restaurantId) {
      // If both the incoming name and stored name are the ID, set stored name to null
      finalRestaurantData.name = null;
    } else if (restaurantName && restaurantName !== restaurantId && !finalRestaurantData.name) {
      // If we have a name but the restaurant doesn't have one stored, set it
      finalRestaurantData.name = restaurantName;
    }

    // Update color if provided and different
    if (restaurantInfo.color && finalRestaurantData.color !== restaurantInfo.color) {
      finalRestaurantData.color = restaurantInfo.color;
      updateRestaurantTimestamp(finalRestaurantData);
      dataChanged = true;
    }

    // Update logo if provided and different
    if (restaurantInfo.logo && finalRestaurantData.logo !== restaurantInfo.logo) {
      finalRestaurantData.logo = restaurantInfo.logo;
      updateRestaurantTimestamp(finalRestaurantData);
      dataChanged = true;
    }

    // Store menu data separately in restaurant_menu:<id> KV record
    let menuChanged = false;
    if (
      restaurantInfo.menu &&
      Array.isArray(restaurantInfo.menu) &&
      restaurantInfo.menu.length > 0
    ) {
      menuChanged = await storeMenuData(env, restaurantId, restaurantInfo.menu);
    }

    // Only save to KV and invalidate cache if data actually changed
    if (dataChanged) {
      const restaurantKey = `restaurant:${restaurantId}`;
      await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(finalRestaurantData));

      // Invalidate the restaurant cache since we updated the data
      await invalidateRestaurantCache(restaurantId);
    }

    // Calculate sell out rate for response
    const totalAppearances = finalRestaurantData.appearances.length;
    const totalSoldOuts = finalRestaurantData.soldOutDates.length;
    const sellOutRate = totalAppearances > 0 ? totalSoldOuts / totalAppearances : 0;

    updatedRestaurants.push({
      ...finalRestaurantData,
      sellOutRate: parseFloat(sellOutRate.toFixed(3)), // Ensure it's a float with 3 decimal places
      dataChanged, // Include whether data was actually changed
      menuChanged, // Include whether menu data was actually changed
    });
  }

  // Count how many restaurants actually had data changes
  const restaurantsWithChanges = updatedRestaurants.filter((r) => r.dataChanged).length;
  const restaurantsWithMenuChanges = updatedRestaurants.filter((r) => r.menuChanged).length;

  return {
    success: true,
    updatedCount: restaurants.length,
    totalRestaurants: updatedRestaurants.length,
    restaurantsWithChanges,
    restaurantsWithMenuChanges,
    updatedRestaurants: updatedRestaurants,
  };
}

// Helper function to calculate sold out rate excluding today's date from sold out count
function calculateSoldOutRate(appearances, soldOutDates) {
  const totalAppearances = appearances.length;
  const totalSoldOuts = soldOutDates.length;
  return {
    rate: totalAppearances > 0 ? (totalSoldOuts / totalAppearances).toFixed(3) : 0,
    totalAppearances,
    totalSoldOuts,
  };
}

// Track user orders
async function trackUserOrders(env, orders, date) {
  const processedOrders = [];

  // Process each order
  for (const order of orders) {
    if (!order.id || !order.userId) {
      continue;
    }

    try {
      // Store in user's order history by date using restaurant ID
      const userHistoryKey = `user_restaurant_history:${order.userId}:${order.restaurantId || order.deliveryId || 'unknown'}`;
      const existingHistory = await env.LANCHDRAP_RATINGS.get(userHistoryKey);

      let historyData = {};
      if (existingHistory) {
        try {
          historyData = JSON.parse(existingHistory);
        } catch (_e) {
          // Failed to parse existing history data
        }
      }

      // Add order to history by date
      if (!historyData[date]) {
        historyData[date] = { items: [], processedOrders: [] };
      }

      // Check if this order has already been processed for this date
      if (historyData[date].processedOrders?.includes(order.id)) {
        continue;
      }

      // Add order items to history
      if (order.items && Array.isArray(order.items)) {
        const orderItems = order.items.map((item) => ({
          id: item.id,
          itemId: item.itemId,
          label: item.label,
          description: item.description,
          price: item.price,
          quantity: item.quantity,
          specialRequest: item.specialRequest,
          orderId: order.id, // Add order ID to track which order this item came from
        }));

        // Check for duplicate items and only add new ones
        // Use item ID for deduplication since the same item shouldn't appear twice
        const existingItemIds = new Set(historyData[date].items.map((item) => item.id));
        const newItems = orderItems.filter((item) => !existingItemIds.has(item.id));

        if (newItems.length > 0) {
          historyData[date].items.push(...newItems);
        }
      }

      // Mark this order as processed for this date
      if (!historyData[date].processedOrders) {
        historyData[date].processedOrders = [];
      }
      historyData[date].processedOrders.push(order.id);

      // Store restaurant ID in the order data for proper mapping
      if (order.restaurantId) {
        historyData[date].restaurantId = order.restaurantId;
      }

      // Update the history
      await env.LANCHDRAP_RATINGS.put(userHistoryKey, JSON.stringify(historyData));

      processedOrders.push(order);
    } catch (_error) {
      // Error processing order
    }
  }

  return {
    processedOrders,
  };
}

// Combined tracking for both restaurants and orders
export async function trackAppearances(request, env) {
  try {
    const trackingData = await request.json();
    const { restaurants, orders, date } = trackingData;

    if (!date) {
      return createErrorResponse('Date is required', 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return createErrorResponse('Date must be in YYYY-MM-DD format', 400);
    }

    const results = {
      restaurants: null,
      orders: null,
    };

    // Track restaurants if provided
    if (restaurants && Array.isArray(restaurants) && restaurants.length > 0) {
      results.restaurants = await trackRestaurantAppearances(env, restaurants, date);
    }

    // Track orders if provided
    if (orders && Array.isArray(orders) && orders.length > 0) {
      results.orders = await trackUserOrders(env, orders, date);
    }

    // If neither restaurants nor orders provided, return error
    if (!results.restaurants && !results.orders) {
      return createErrorResponse('Either restaurants array or orders array is required', 400);
    }

    const responseData = {
      success: true,
      message: `Tracked data for ${date}`,
      data: {
        date,
      },
    };

    if (results.restaurants) {
      responseData.data.restaurants = {
        totalRestaurants: results.restaurants.totalRestaurants,
        restaurantsWithChanges: results.restaurants.restaurantsWithChanges,
        restaurantsWithMenuChanges: results.restaurants.restaurantsWithMenuChanges,
        restaurants: results.restaurants.updatedRestaurants.map((r) => ({
          id: r.id,
          name: r.name,
          sellOutRate: r.sellOutRate,
          dataChanged: r.dataChanged,
          menuChanged: r.menuChanged,
        })),
      };
    }

    if (results.orders) {
      responseData.data.orders = {
        totalOrders: results.orders.processedOrders.length,
        processedOrders: results.orders.processedOrders.map((order) => ({
          id: order.id,
          userId: order.userId,
          deliveryId: order.deliveryId,
          isPaid: order.isPaid,
          itemsCount: order.items?.length || 0,
        })),
      };
    }

    return createApiResponse(responseData, 200);
  } catch (error) {
    return createErrorResponse('Failed to track data', 500, {
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

    // Get restaurant data using cache
    const restaurantData = await getCachedRestaurantData(env, restaurant);

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

    const appearances = restaurantData.appearances || [];
    const soldOutDates = restaurantData.soldOutDates || [];

    // Calculate stats
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = restaurantData.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    // Exclude today's date from the calculation
    const soldOutStats = calculateSoldOutRate(appearances, soldOutDates);
    const soldOutRate = soldOutStats.rate;

    // Get user order history if userId is provided
    let userOrderHistory = null;
    if (userId) {
      const historyData = await getCachedUserHistoryData(env, userId, restaurant);

      if (historyData) {
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
      try {
        restaurantData = JSON.parse(existingData);
      } catch (_e) {
        // If stored data is malformed, start fresh instead of failing with 500
        restaurantData = {
          id: restaurantId,
          name: restaurantId,
          appearances: [],
          soldOutDates: [],
          menu: [],
          firstSeen: null,
          lastSeen: null,
          createdAt: new Date().toISOString(),
        };
      }
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

    // Ensure arrays are initialized if missing in existing records
    if (!Array.isArray(restaurantData.appearances)) {
      restaurantData.appearances = [];
    }
    if (!Array.isArray(restaurantData.soldOutDates)) {
      restaurantData.soldOutDates = [];
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
    const { restaurantId, restaurantName, menuItems, orderDate } = await request.json();

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
      restaurantData.menu = {};
    }

    const updates = [];
    let hasChanges = false;

    // Update menu if provided
    if (menuItems && Array.isArray(menuItems) && orderDate) {
      // Convert orderDate to YYYY-MM-DD format
      const dateKey = new Date(orderDate).toISOString().split('T')[0];

      // Get existing menu items for this date
      const existingMenuForDate = restaurantData.menu[dateKey] || [];

      // Merge menu items for this specific date
      const mergedMenu = mergeMenus(existingMenuForDate, menuItems);
      const menuChanged = compareMenus(existingMenuForDate, mergedMenu);

      if (menuChanged) {
        restaurantData.menu[dateKey] = mergedMenu;
        updates.push('menu');
        hasChanges = true;
      }
    } else if (menuItems && Array.isArray(menuItems) && !orderDate) {
      // Fallback: if no orderDate provided, update the general menu (backward compatibility)
      const existingMenu = Array.isArray(restaurantData.menu) ? restaurantData.menu : [];
      const mergedMenu = mergeMenus(existingMenu, menuItems);
      const menuChanged = compareMenus(existingMenu, mergedMenu);

      if (menuChanged) {
        restaurantData.menu = mergedMenu;
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
      // Name mapping no longer used
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
    // Name mapping no longer used

    // Update timestamp and save to KV
    updateRestaurantTimestamp(restaurantData);

    // Convert MenuItem objects to plain objects for JSON serialization
    const serializableData = {
      ...restaurantData,
      menu: {},
    };

    // Convert menu items to plain objects
    if (restaurantData.menu && typeof restaurantData.menu === 'object') {
      for (const [dateKey, menuItems] of Object.entries(restaurantData.menu)) {
        if (Array.isArray(menuItems)) {
          serializableData.menu[dateKey] = menuItems.map((item) =>
            item instanceof MenuItem ? item.toJSON() : item
          );
        } else {
          serializableData.menu[dateKey] = menuItems;
        }
      }
    }

    await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(serializableData));

    return createApiResponse(
      {
        success: true,
        message: `Updated restaurant: ${updates.join(', ')}`,
        data: {
          restaurantId,
          name: restaurantData.name,
          menu: serializableData.menu,
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

// Get restaurant menu by ID
export async function getRestaurantMenu(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const restaurantId = pathParts[pathParts.length - 1]; // Get the restaurant ID from the URL

    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    // Get menu data from KV using the restaurant_menu key
    const menuKey = `restaurant_menu:${restaurantId}`;
    const menuData = await env.LANCHDRAP_RATINGS.get(menuKey);

    if (!menuData) {
      return createErrorResponse('Menu not found for this restaurant', 404);
    }

    const parsedMenuData = JSON.parse(menuData);

    // Extract just the item labels for autocomplete
    const menuItems = parsedMenuData.items?.map((item) => item.label) || [];

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          restaurantId,
          items: menuItems,
          lastUpdated: parsedMenuData.lastUpdated,
        },
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
    return createErrorResponse('Failed to get restaurant menu', 500, { error: error.message });
  }
}

// Get restaurant by ID or name
export async function getRestaurantById(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const restaurantId = pathParts[pathParts.length - 1]; // Get ID from URL path

    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    // Check if userId and orderDate are provided for user order lookup
    const userId = url.searchParams.get('userId');
    const orderDate = url.searchParams.get('orderDate');

    // Check if the provided ID is actually a restaurant name
    // If we can't find a restaurant with this ID, try looking it up as a name
    const data = await getCachedRestaurantData(env, restaurantId);

    if (!data) {
      return createErrorResponse('Restaurant not found', 404);
    }
    const appearances = data.appearances || [];
    const soldOutDates = data.soldOutDates || [];

    // Calculate stats
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    // Exclude today's date from the calculation
    const soldOutStats = calculateSoldOutRate(appearances, soldOutDates);
    const soldOutRate = soldOutStats.rate;

    // Get user's order for the specific date if userId and orderDate are provided
    let userOrder = null;
    if (userId && orderDate) {
      try {
        const historyData = await getCachedUserHistoryData(env, userId, restaurantId);

        if (historyData) {
          // Debug: Log the available dates and the requested date
          const _availableDates = Object.keys(historyData);

          // Handle different data structures - check if there's an 'orders' wrapper
          let orderData = null;
          if (historyData[orderDate]) {
            // Direct date key structure: { "2025-09-09": { "items": [...] } }
            orderData = historyData[orderDate];
          } else if (historyData.orders?.[orderDate]) {
            // Orders wrapper structure: { "orders": { "2025-09-09": { "items": [...] } } }
            orderData = historyData.orders[orderDate];
          }

          if (orderData) {
            // Return items in their original format from KV storage
            const items = (orderData.items || []).map((item) => {
              // Handle different item formats
              if (typeof item === 'string') {
                return { label: item, quantity: 1 };
              }
              // Return the item as-is from KV storage (preserves label field)
              return {
                id: item.id,
                itemId: item.itemId,
                label: item.label || 'Unknown Item',
                description: item.description || '',
                price: item.price || 0,
                quantity: item.quantity || 1,
                specialRequest: item.specialRequest,
                orderId: item.orderId,
              };
            });

            userOrder = {
              date: orderDate,
              items: items,
            };
          } else {
          }
        } else {
        }
      } catch (_error) {
        // If there's an error getting user order, continue without it
      }
    }

    const responseData = {
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
    };

    // Include user order if available
    if (userOrder) {
      responseData.userOrder = userOrder;
    }

    // Include menu if available
    if (data.menu && data.menu.length > 0) {
      responseData.menu = data.menu;
    }

    // Include rating synopsis if available
    if (data.ratingStats) {
      const ratingStats = data.ratingStats;
      const averageEmoji = getRatingEmoji(Math.round(ratingStats.averageRating));
      responseData.ratingSynopsis = {
        averageEmoji,
        averageRating: Math.round(ratingStats.averageRating * 100) / 100,
        totalRatings: ratingStats.totalRatings,
        summary: `${averageEmoji} ${ratingStats.averageRating.toFixed(1)} (${ratingStats.totalRatings} rating${ratingStats.totalRatings !== 1 ? 's' : ''})`,
        distribution: Object.entries(ratingStats.ratingDistribution)
          .map(([stars, count]) => `${getRatingEmoji(parseInt(stars, 10))} ${count}`)
          .join(' • '),
      };
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return createErrorResponse('Failed to get restaurant', 500, { error: error.message });
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

// Update user order for specific date
export async function updateUserOrder(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orderDate = pathParts[pathParts.length - 1]; // Get the date from the URL

    const { userId, restaurantId, items } = await request.json();

    if (!userId || !restaurantId || !orderDate) {
      return createErrorResponse('Missing required fields: userId, restaurantId, orderDate', 400);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(orderDate)) {
      return createErrorResponse('Invalid date format. Use YYYY-MM-DD', 400);
    }

    // Create user-restaurant history record key
    const userRestaurantKey = `user_restaurant_history:${userId}:${restaurantId}`;

    // Get existing history data
    const existingHistoryData = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);
    let historyData = {};

    if (existingHistoryData) {
      try {
        historyData = JSON.parse(existingHistoryData);
      } catch {
        // If parsing fails, start with empty object
        historyData = {};
      }
    }

    // Normalize items to exclude modifications (consistent with data-layer.js)
    const normalizedItems = (items || []).map((item) => ({
      id: item.id,
      itemId: item.itemId,
      label: item.label,
      description: item.description,
      price: item.price,
      quantity: item.quantity,
      specialRequest: item.specialRequest,
    }));

    // Update the order for the specific date, preserving existing data like ratings
    const existingOrderData = historyData[orderDate] || {};
    historyData[orderDate] = {
      ...existingOrderData, // Preserve existing data (rating, etc.)
      items: normalizedItems,
      updatedAt: new Date().toISOString(),
    };

    // Save updated history
    await env.LANCHDRAP_RATINGS.put(userRestaurantKey, JSON.stringify(historyData));

    // Invalidate user history cache
    await invalidateUserHistoryCache(userId, restaurantId);

    return createApiResponse(
      {
        success: true,
        message: `Updated order for ${orderDate}`,
        data: {
          userId,
          restaurantId,
          orderDate,
          items: items || [],
          updatedAt: historyData[orderDate].updatedAt,
        },
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to update order', 500, { error: error.message });
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

// Delete a user's restaurant order history (optionally for a specific date)
export async function deleteUserRestaurantHistory(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orderDate = pathParts[pathParts.length - 1]; // Get the date from the URL path
    const userId = url.searchParams.get('userId');
    const restaurantId = url.searchParams.get('restaurantId');

    if (!userId || !restaurantId) {
      return createErrorResponse('Missing required parameters: userId, restaurantId', 400);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(orderDate)) {
      return createErrorResponse('Invalid date format. Use YYYY-MM-DD', 400);
    }

    const userRestaurantKey = `user_restaurant_history:${userId}:${restaurantId}`;
    const historyDataRaw = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);

    if (!historyDataRaw) {
      return createApiResponse({
        success: true,
        message: 'No history found to delete',
        data: { userId, restaurantId, deleted: false },
      });
    }

    // Delete the specific order for the given date
    let historyData = {};
    try {
      historyData = JSON.parse(historyDataRaw) || {};
    } catch (_e) {
      historyData = {};
    }

    if (historyData[orderDate]) {
      delete historyData[orderDate];

      // If no orders remain, delete the whole key; otherwise update it
      if (Object.keys(historyData).length === 0) {
        await env.LANCHDRAP_RATINGS.delete(userRestaurantKey);
      } else {
        await env.LANCHDRAP_RATINGS.put(userRestaurantKey, JSON.stringify(historyData));
      }

      return createApiResponse({
        success: true,
        message: `Deleted order on ${orderDate}`,
        data: { userId, restaurantId, date: orderDate, deleted: true },
      });
    }

    // Nothing to delete for that date
    return createApiResponse({
      success: true,
      message: 'No order found for the specified date',
      data: { userId, restaurantId, date: orderDate, deleted: false },
    });
  } catch (_error) {
    return createErrorResponse('Failed to delete user restaurant history', 500);
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
      return createApiResponse({
        userId,
        totalRestaurants: 0,
        restaurants: [],
      });
    }

    const restaurants = [];

    for (const key of list.keys) {
      // Extract restaurant ID from key: user_restaurant_history:userId:restaurantId
      const keyParts = key.name.split(':');

      if (keyParts.length >= 3) {
        const restaurantId = keyParts.slice(2).join(':'); // Handle restaurant IDs with colons

        const historyData = await getCachedUserHistoryData(env, userId, restaurantId);

        if (historyData) {
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
          const lastOrderDate = orders.length > 0 ? orders[0].date : null; // First item is newest

          // Restaurant ID is already extracted from the key

          // Look up restaurant record to include display name (and optional color/logo)
          let restaurantName = restaurantId;
          let color = null;
          let logo = null;
          try {
            const restaurantKey = `restaurant:${restaurantId}`;
            const restaurantDataRaw = await env.LANCHDRAP_RATINGS.get(restaurantKey);
            if (restaurantDataRaw) {
              const restaurantData = JSON.parse(restaurantDataRaw);
              restaurantName = restaurantData.name || restaurantId;
              color = restaurantData.color || null;
              logo = restaurantData.logo || null;
            }
          } catch (_e) {
            // Error looking up restaurant data
          }

          restaurants.push({
            restaurantId,
            restaurantName,
            color,
            logo,
            totalOrders: orders.length,
            lastOrderDate,
            recentOrders: orders.slice(0, 5), // First 5 orders (newest)
          });
        }
      } else {
      }
    }

    // Sort by last order date (most recent first)
    restaurants.sort((a, b) => {
      if (!a.lastOrderDate && !b.lastOrderDate) return 0;
      if (!a.lastOrderDate) return 1;
      if (!b.lastOrderDate) return -1;
      return new Date(b.lastOrderDate) - new Date(a.lastOrderDate);
    });
    return createApiResponse({
      userId,
      totalRestaurants: restaurants.length,
      restaurants,
    });
  } catch (error) {
    return createErrorResponse('Failed to retrieve restaurant summary', 500, null, {
      error: error.message,
    });
  }
}

// Get users who have ordered from a specific restaurant (for recommendations)
export async function getRestaurantUsers(request, env) {
  try {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get('restaurantId');

    if (!restaurantId) {
      return createErrorResponse('Missing required parameter: restaurantId', 400);
    }

    // Use prefix query to get all users for this restaurant
    const prefix = `restaurant_users:${restaurantId}:`;
    const list = await env.LANCHDRAP_RATINGS.list({ prefix });

    if (list.keys.length === 0) {
      return createApiResponse({
        success: true,
        message: 'No users found for this restaurant',
        data: {
          restaurantId,
          users: [],
          totalUsers: 0,
        },
      });
    }

    // Process each user-restaurant record
    const users = [];
    for (const key of list.keys) {
      try {
        const userId = await env.LANCHDRAP_RATINGS.get(key.name);
        if (userId) {
          users.push(userId);
        }
      } catch (_error) {}
    }

    return createApiResponse({
      success: true,
      message: 'Restaurant users retrieved successfully',
      data: {
        restaurantId,
        users,
        totalUsers: users.length,
      },
    });
  } catch (error) {
    return createErrorResponse('Failed to retrieve restaurant users', 500, null, {
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
    const soldOutStats = calculateSoldOutRate(appearances, soldOutDates);
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

          // Find the most recent rating by timestamp
          let lastRating = null;
          for (const order of orders) {
            const orderData = historyData[order.date];
            if (orderData?.rating) {
              const ratingTimestamp = new Date(orderData.rating.timestamp);
              if (!lastRating || ratingTimestamp > new Date(lastRating.timestamp)) {
                lastRating = {
                  rating: orderData.rating.rating,
                  timestamp: orderData.rating.timestamp,
                  emoji: getRatingEmoji(orderData.rating.rating),
                };
              }
            }
          }

          userOrderHistory = {
            totalOrders: orders.length,
            lastOrderDate: lastOrder.date,
            lastItemPurchased: lastItemPurchased,
            lastOrderItems: lastOrder.items || [], // All items from the last order
            orderDates: orderDates,
            recentOrders: orders.slice(0, 5), // First 5 orders (newest)
            lastRating: lastRating, // Most recent rating by timestamp
          };
        }
      }
    }

    // Include rating synopsis if available
    let ratingSynopsis = null;
    if (data.ratingStats) {
      const ratingStats = data.ratingStats;
      const averageEmoji = getRatingEmoji(Math.round(ratingStats.averageRating));
      ratingSynopsis = {
        averageEmoji,
        averageRating: Math.round(ratingStats.averageRating * 100) / 100,
        totalRatings: ratingStats.totalRatings,
        summary: `${averageEmoji} ${ratingStats.averageRating.toFixed(1)} (${ratingStats.totalRatings} rating${ratingStats.totalRatings !== 1 ? 's' : ''})`,
        distribution: Object.entries(ratingStats.ratingDistribution)
          .map(([stars, count]) => `${getRatingEmoji(parseInt(stars, 10))} ${count}`)
          .join(' • '),
      };
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
        ratingSynopsis,
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

// Get batch restaurant data (appearances and soldOutDates) for multiple restaurants
export async function getBatchRestaurantData(request, env) {
  try {
    const url = new URL(request.url);
    const restaurantIdsParam = url.searchParams.get('restaurants');

    if (!restaurantIdsParam) {
      return createErrorResponse('Restaurants parameter is required (comma-separated IDs)', 400);
    }

    // Parse comma-separated restaurant IDs
    const restaurantIds = restaurantIdsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (restaurantIds.length === 0) {
      return createErrorResponse('At least one restaurant ID is required', 400);
    }

    // Fetch data for all restaurants in parallel
    const restaurantDataPromises = restaurantIds.map(async (restaurantId) => {
      try {
        const data = await getCachedRestaurantData(env, restaurantId);
        if (data) {
          return {
            id: restaurantId,
            appearances: data.appearances || [],
            soldOutDates: data.soldOutDates || [],
          };
        } else {
          // Return empty data for unknown restaurants
          return {
            id: restaurantId,
            appearances: [],
            soldOutDates: [],
          };
        }
      } catch {
        // Return empty data on error
        return {
          id: restaurantId,
          appearances: [],
          soldOutDates: [],
        };
      }
    });

    const restaurantDataArray = await Promise.all(restaurantDataPromises);

    // Create a map for easy lookup
    const restaurantDataMap = {};
    for (const data of restaurantDataArray) {
      restaurantDataMap[data.id] = {
        appearances: data.appearances,
        soldOutDates: data.soldOutDates,
      };
    }

    return new Response(
      JSON.stringify({
        restaurants: restaurantDataMap,
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
    return createErrorResponse('Failed to get batch restaurant data', 500, {
      error: error.message,
    });
  }
}

// Functions are already exported individually above
