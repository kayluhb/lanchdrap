// Restaurant tracking API routes
// Handles tracking restaurant appearances and orders

import {
  getCachedMenuData,
  getCachedRestaurantData,
  invalidateMenuCache,
  invalidateRestaurantCache,
} from '../../utils/cache.js';
import { Menu } from '../../utils/models.js';
import { createApiResponse, createErrorResponse } from '../../utils/response.js';
import { compareMenus } from '../../utils/restaurants.js';

// Helper function to store menu data separately
async function storeMenuData(env, restaurantId, menuItems) {
  try {
    const existingData = await getCachedMenuData(env, restaurantId);
    let menu;
    let shouldUpdate = false;

    if (existingData) {
      menu = Menu.fromJSON(existingData);
      const originalMenuItems = [...menu.items];
      menu.addMenuItems(menuItems);
      shouldUpdate = !compareMenus(originalMenuItems, menu.items);
    } else {
      menu = new Menu({
        restaurantId: restaurantId,
        items: menuItems,
      });
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      const menuKey = `restaurant_menu:${restaurantId}`;
      await env.LANCHDRAP_RATINGS.put(menuKey, JSON.stringify(menu.toJSON()));
      await invalidateMenuCache(restaurantId);
    }

    return shouldUpdate;
  } catch (_error) {
    return false;
  }
}

// Helper function to update restaurant timestamp
function updateRestaurantTimestamp(restaurantData) {
  restaurantData.updatedAt = new Date().toISOString();
}

// Track restaurant appearances with proper KV structure
async function trackRestaurantAppearances(env, restaurants, date) {
  const updatedRestaurants = [];

  for (const restaurantInfo of restaurants) {
    const { id, name, restaurant, color, logo, status, menu } = restaurantInfo;
    const restaurantId = id || name || restaurant;
    const restaurantName = name || restaurant || restaurantId;

    if (!restaurantId) continue;

    const restaurantData = await getCachedRestaurantData(env, restaurantId);

    let finalRestaurantData;
    if (restaurantData) {
      finalRestaurantData = restaurantData;
    } else {
      finalRestaurantData = {
        id: restaurantId,
        name: restaurantName !== restaurantId ? restaurantName : null,
        appearances: [],
        soldOutDates: [],
        color: color || null,
        logo: logo || null,
        firstSeen: date,
        lastSeen: date,
        createdAt: new Date().toISOString(),
      };
    }

    if (!Array.isArray(finalRestaurantData.appearances)) {
      finalRestaurantData.appearances = [];
    }
    if (!Array.isArray(finalRestaurantData.soldOutDates)) {
      finalRestaurantData.soldOutDates = [];
    }

    let dataChanged = false;

    if (!finalRestaurantData.appearances.includes(date)) {
      finalRestaurantData.appearances.push(date);
      finalRestaurantData.appearances.sort();
      finalRestaurantData.lastSeen = date;
      updateRestaurantTimestamp(finalRestaurantData);
      dataChanged = true;

      if (date < finalRestaurantData.firstSeen) {
        finalRestaurantData.firstSeen = date;
      }
    }

    if (status === 'soldout' && !finalRestaurantData.soldOutDates.includes(date)) {
      finalRestaurantData.soldOutDates.push(date);
      finalRestaurantData.soldOutDates.sort();
      updateRestaurantTimestamp(finalRestaurantData);
      dataChanged = true;
    }

    if (color && finalRestaurantData.color !== color) {
      finalRestaurantData.color = color;
      updateRestaurantTimestamp(finalRestaurantData);
      dataChanged = true;
    }

    if (logo && finalRestaurantData.logo !== logo) {
      finalRestaurantData.logo = logo;
      updateRestaurantTimestamp(finalRestaurantData);
      dataChanged = true;
    }

    if (restaurantName && restaurantName !== restaurantId && finalRestaurantData.name !== restaurantName) {
      finalRestaurantData.name = restaurantName;
      dataChanged = true;
    } else if (restaurantName === restaurantId && finalRestaurantData.name === restaurantId) {
      finalRestaurantData.name = null;
    } else if (restaurantName && restaurantName !== restaurantId && !finalRestaurantData.name) {
      finalRestaurantData.name = restaurantName;
    }

    let menuChanged = false;
    if (menu && Array.isArray(menu) && menu.length > 0) {
      menuChanged = await storeMenuData(env, restaurantId, menu);
    }

    if (dataChanged) {
      const restaurantKey = `restaurant:${restaurantId}`;
      await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(finalRestaurantData));
      await invalidateRestaurantCache(restaurantId);
    }

    const totalAppearances = finalRestaurantData.appearances.length;
    const totalSoldOuts = finalRestaurantData.soldOutDates.length;
    const sellOutRate = totalAppearances > 0 ? totalSoldOuts / totalAppearances : 0;

    updatedRestaurants.push({
      ...finalRestaurantData,
      sellOutRate: parseFloat(sellOutRate.toFixed(3)),
      dataChanged,
      menuChanged,
    });
  }

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

// Track user orders
async function trackUserOrders(env, orders, date) {
  const processedOrders = [];

  for (const order of orders) {
    if (!order.id || !order.userId) {
      continue;
    }

    try {
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

      if (!historyData[date]) {
        historyData[date] = { items: [], processedOrders: [] };
      }

      if (historyData[date].processedOrders?.includes(order.id)) {
        continue;
      }

      if (order.items && Array.isArray(order.items)) {
        const orderItems = order.items.map((item) => ({
          id: item.id,
          itemId: item.itemId,
          label: item.label,
          description: item.description,
          price: item.price,
          quantity: item.quantity,
          specialRequest: item.specialRequest,
          orderId: order.id,
        }));

        const existingItemIds = new Set(historyData[date].items.map((item) => item.id));
        const newItems = orderItems.filter((item) => !existingItemIds.has(item.id));

        if (newItems.length > 0) {
          historyData[date].items.push(...newItems);
        }
      }

      if (!historyData[date].processedOrders) {
        historyData[date].processedOrders = [];
      }
      historyData[date].processedOrders.push(order.id);

      if (order.restaurantId) {
        historyData[date].restaurantId = order.restaurantId;
      }

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

    if (restaurants && Array.isArray(restaurants) && restaurants.length > 0) {
      results.restaurants = await trackRestaurantAppearances(env, restaurants, date);
    }

    if (orders && Array.isArray(orders) && orders.length > 0) {
      results.orders = await trackUserOrders(env, orders, date);
    }

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
