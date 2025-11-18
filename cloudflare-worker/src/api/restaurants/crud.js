// Restaurant CRUD API routes
// Handles create, read, update operations for restaurants

import { getCachedRestaurantData, invalidateRestaurantCache } from '../../utils/cache.js';
import { getRatingEmoji } from '../../utils/rating-utils.js';
import { createApiResponse, createErrorResponse } from '../../utils/response.js';

// Helper function to calculate sold out rate
function calculateSoldOutRate(appearances, soldOutDates) {
  const totalAppearances = appearances.length;
  const totalSoldOuts = soldOutDates.length;
  return {
    rate: totalAppearances > 0 ? (totalSoldOuts / totalAppearances).toFixed(3) : 0,
    totalAppearances,
    totalSoldOuts,
  };
}

// Helper function to update restaurant timestamp
function updateRestaurantTimestamp(restaurantData) {
  restaurantData.updatedAt = new Date().toISOString();
}

// Update restaurant appearances and sold out dates
export async function updateAppearances(request, env) {
  try {
    const { restaurantId, appearanceDates, soldoutDates } = await request.json();

    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    if (!Array.isArray(appearanceDates)) {
      return createErrorResponse('Appearance dates array is required', 400);
    }

    if (!Array.isArray(soldoutDates)) {
      return createErrorResponse('Sold out dates array is required', 400);
    }

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

    const restaurantKey = `restaurant:${restaurantId}`;
    const existingData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    let restaurantData;
    if (existingData) {
      try {
        restaurantData = JSON.parse(existingData);
      } catch (_e) {
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

    const sortedAppearanceDates = [...new Set(appearanceDates)].sort();
    const sortedSoldoutDates = [...new Set(soldoutDates)].sort();

    const { appearances, soldOutDates } = restaurantData;
    restaurantData.appearances = sortedAppearanceDates;
    restaurantData.soldOutDates = sortedSoldoutDates;

    if (sortedAppearanceDates.length > 0) {
      restaurantData.firstSeen = sortedAppearanceDates[0];
      restaurantData.lastSeen = sortedAppearanceDates[sortedAppearanceDates.length - 1];
    } else {
      restaurantData.firstSeen = null;
      restaurantData.lastSeen = null;
    }

    updateRestaurantTimestamp(restaurantData);
    await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(restaurantData));
    await invalidateRestaurantCache(restaurantId);

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

// Get restaurant by ID or name
export async function getRestaurantById(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const restaurantId = pathParts[pathParts.length - 1];

    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    const userId = url.searchParams.get('userId');
    const orderDate = url.searchParams.get('orderDate');

    const data = await getCachedRestaurantData(env, restaurantId);

    if (!data) {
      return createErrorResponse('Restaurant not found', 404);
    }

    const appearances = data.appearances || [];
    const soldOutDates = data.soldOutDates || [];

    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    const soldOutStats = calculateSoldOutRate(appearances, soldOutDates);
    const soldOutRate = soldOutStats.rate;

    let userOrder = null;
    if (userId && orderDate) {
      try {
        const { getCachedUserHistoryData } = await import('../../utils/cache.js');
        const historyData = await getCachedUserHistoryData(env, userId, restaurantId);

        if (historyData) {
          let orderData = null;
          if (historyData[orderDate]) {
            orderData = historyData[orderDate];
          } else if (historyData.orders?.[orderDate]) {
            orderData = historyData.orders[orderDate];
          }

          if (orderData) {
            const items = (orderData.items || []).map((item) => {
              if (typeof item === 'string') {
                return { label: item, quantity: 1 };
              }
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
          }
        }
      } catch (_error) {
        // If there's an error getting user order, continue without it
      }
    }

    const responseData = {
      name: data.name || restaurantId,
      id: data.id || restaurantId,
      color: data.color || null,
      totalAppearances: appearances.length,
      totalSoldOuts: soldOutStats.totalSoldOuts,
      soldOutRate: parseFloat(soldOutRate),
      lastAppearance,
      firstSeen,
      lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
      appearances: appearances,
      soldOutDates: soldOutDates,
      timezone: 'America/Chicago',
    };

    if (userOrder) {
      responseData.userOrder = userOrder;
    }

    if (data.menu && data.menu.length > 0) {
      responseData.menu = data.menu;
    }

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

// Get restaurant menu by ID
export async function getRestaurantMenu(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const restaurantId = pathParts[pathParts.length - 1];

    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    const { getCachedMenuData } = await import('../../utils/cache.js');
    const menuData = await getCachedMenuData(env, restaurantId);

    if (!menuData) {
      return createErrorResponse('Menu not found for this restaurant', 404);
    }

    const menuItems = menuData.items?.map((item) => item.label) || [];

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          restaurantId,
          items: menuItems,
          lastUpdated: menuData.lastUpdated,
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
