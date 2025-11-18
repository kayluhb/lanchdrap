// Restaurant orders API routes
// Handles user order history operations

import { getCachedUserHistoryData, invalidateUserHistoryCache } from '../../utils/cache.js';
import { createApiResponse, createErrorResponse } from '../../utils/response.js';
import { normalizeOrderHistory } from '../../utils/order-history-normalizer.js';

// Update user order for specific date
export async function updateUserOrder(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orderDate = pathParts[pathParts.length - 1];

    const { userId, restaurantId, items } = await request.json();

    if (!userId || !restaurantId || !orderDate) {
      return createErrorResponse('Missing required fields: userId, restaurantId, orderDate', 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(orderDate)) {
      return createErrorResponse('Invalid date format. Use YYYY-MM-DD', 400);
    }

    const userRestaurantKey = `user_restaurant_history:${userId}:${restaurantId}`;
    const existingHistoryData = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);
    let historyData = {};

    if (existingHistoryData) {
      try {
        historyData = JSON.parse(existingHistoryData);
      } catch {
        historyData = {};
      }
    }

    const normalizedItems = (items || []).map((item) => ({
      id: item.id,
      itemId: item.itemId,
      label: item.label,
      description: item.description,
      price: item.price,
      quantity: item.quantity,
      specialRequest: item.specialRequest,
    }));

    const existingOrderData = historyData[orderDate] || {};
    historyData[orderDate] = {
      ...existingOrderData,
      items: normalizedItems,
      updatedAt: new Date().toISOString(),
    };

    await env.LANCHDRAP_RATINGS.put(userRestaurantKey, JSON.stringify(historyData));
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

// Delete a user's restaurant order history (optionally for a specific date)
export async function deleteUserRestaurantHistory(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orderDate = pathParts[pathParts.length - 1];
    const userId = url.searchParams.get('userId');
    const restaurantId = url.searchParams.get('restaurantId');

    if (!userId || !restaurantId) {
      return createErrorResponse('Missing required parameters: userId, restaurantId', 400);
    }

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

    let historyData = {};
    try {
      historyData = JSON.parse(historyDataRaw) || {};
    } catch (_e) {
      historyData = {};
    }

    if (historyData[orderDate]) {
      delete historyData[orderDate];

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
      const keyParts = key.name.split(':');

      if (keyParts.length >= 3) {
        const restaurantId = keyParts.slice(2).join(':');

        const historyData = await getCachedUserHistoryData(env, userId, restaurantId);

        if (historyData) {
          const orders = normalizeOrderHistory(historyData);
          const lastOrderDate = orders.length > 0 ? orders[0].date : null;

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
            recentOrders: orders.slice(0, 5),
          });
        }
      }
    }

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

