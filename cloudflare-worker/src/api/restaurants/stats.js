// Restaurant stats API routes
// Handles stats retrieval and user history

import { getCachedRestaurantData, getCachedUserHistoryData } from '../../utils/cache.js';
import { getRatingEmoji } from '../../utils/rating-utils.js';
import { createApiResponse, createErrorResponse } from '../../utils/response.js';
import { normalizeOrderHistory } from '../../utils/order-history-normalizer.js';

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

// Get restaurant appearances
export async function getAppearances(request, env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');
    const userId = url.searchParams.get('userId');

    if (!restaurant) {
      return createErrorResponse('Restaurant parameter is required', 400);
    }

    const restaurantData = await getCachedRestaurantData(env, restaurant);

    if (!restaurantData) {
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

    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = restaurantData.firstSeen || (appearances.length > 0 ? appearances[0] : null);

    const soldOutStats = calculateSoldOutRate(appearances, soldOutDates);
    const soldOutRate = soldOutStats.rate;

    let userOrderHistory = null;
    if (userId) {
      const historyData = await getCachedUserHistoryData(env, userId, restaurant);

      if (historyData) {
        const orders = normalizeOrderHistory(historyData);

        if (orders.length > 0) {
          const lastOrder = orders[0];
          const orderDates = orders.map((order) => order.date);
          const lastItemPurchased =
            lastOrder.items && lastOrder.items.length > 0
              ? lastOrder.items[lastOrder.items.length - 1]
              : null;

          userOrderHistory = {
            totalOrders: orders.length,
            lastOrderDate: lastOrder.date,
            lastItemPurchased: lastItemPurchased,
            lastOrderItems: lastOrder.items || [],
            orderDates: orderDates,
            recentOrders: orders.slice(0, 5),
          };
        }
      }
    }

    return new Response(
      JSON.stringify({
        appearances: appearances,
        firstSeen,
        lastAppearance,
        lastUpdated: restaurantData.updatedAt || restaurantData.createdAt || new Date().toISOString(),
        restaurant: restaurantData.name || restaurant,
        restaurantId: restaurantData.id || restaurant,
        soldOutRate,
        totalAppearances: appearances.length,
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

// Get restaurant stats with user order history (combined endpoint)
export async function getRestaurantStatsWithUserHistory(request, env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');
    const userId = url.searchParams.get('userId');

    if (!restaurant) {
      return createErrorResponse('Restaurant parameter is required', 400);
    }

    const restaurantKey = `restaurant:${restaurant}`;
    const restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    if (!restaurantData) {
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
    const { appearances = [], soldOutDates = [], name, id, color, firstSeen: dataFirstSeen, updatedAt, createdAt, ratingStats } = data;

    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = dataFirstSeen || (appearances.length > 0 ? appearances[0] : null);

    const soldOutStats = calculateSoldOutRate(appearances, soldOutDates);
    const { rate: soldOutRate, totalSoldOuts } = soldOutStats;

    let userOrderHistory = null;
    if (userId) {
      const userRestaurantKey = `user_restaurant_history:${userId}:${restaurant}`;
      const historyDataRaw = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);

      if (!historyDataRaw) {
        // No history data, continue without userOrderHistory
      } else {
        const historyData = JSON.parse(historyDataRaw);
        const orders = normalizeOrderHistory(historyData);

        if (orders.length === 0) {
          // No orders, continue without userOrderHistory
        } else {
          const [lastOrder] = orders;
          const { date: lastOrderDate, items: lastOrderItems = [] } = lastOrder;
          const orderDates = orders.map((order) => order.date);
          const lastItemPurchased = lastOrderItems.length > 0 ? lastOrderItems[lastOrderItems.length - 1] : null;

          let lastRating = null;
          for (const order of orders) {
            const orderData = historyData[order.date];
            if (!orderData?.rating) continue;

            const { rating: orderRating, timestamp } = orderData.rating;
            const ratingTimestamp = new Date(timestamp);
            if (!lastRating || ratingTimestamp > new Date(lastRating.timestamp)) {
              lastRating = {
                rating: orderRating,
                timestamp,
                emoji: getRatingEmoji(orderRating),
              };
            }
          }

          userOrderHistory = {
            totalOrders: orders.length,
            lastOrderDate,
            lastItemPurchased,
            lastOrderItems,
            orderDates,
            recentOrders: orders.slice(0, 5),
            lastRating,
          };
        }
      }
    }

    let ratingSynopsis = null;
    if (ratingStats) {
      const { averageRating, totalRatings, ratingDistribution } = ratingStats;
      const averageEmoji = getRatingEmoji(Math.round(averageRating));
      ratingSynopsis = {
        averageEmoji,
        averageRating: Math.round(averageRating * 100) / 100,
        totalRatings,
        summary: `${averageEmoji} ${averageRating.toFixed(1)} (${totalRatings} rating${totalRatings !== 1 ? 's' : ''})`,
        distribution: Object.entries(ratingDistribution)
          .map(([stars, count]) => `${getRatingEmoji(parseInt(stars, 10))} ${count}`)
          .join(' • '),
      };
    }

    return new Response(
      JSON.stringify({
        name: name || restaurant,
        id: id || restaurant,
        color: color || null,
        totalAppearances: appearances.length,
        totalSoldOuts,
        soldOutRate: parseFloat(soldOutRate),
        lastAppearance,
        firstSeen,
        lastUpdated: updatedAt || createdAt || new Date().toISOString(),
        appearances,
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

    const restaurantIds = restaurantIdsParam.split(',').map(id => id.trim()).filter(Boolean);
    
    if (restaurantIds.length === 0) {
      return createErrorResponse('At least one restaurant ID is required', 400);
    }

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
          return {
            id: restaurantId,
            appearances: [],
            soldOutDates: [],
          };
        }
      } catch (error) {
        console.error(`Error fetching data for restaurant ${restaurantId}:`, error);
        return {
          id: restaurantId,
          appearances: [],
          soldOutDates: [],
        };
      }
    });

    const restaurantDataArray = await Promise.all(restaurantDataPromises);

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

