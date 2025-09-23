// Rating API routes
// Following modern API patterns with proper error handling and validation

import { invalidateUserHistoryCache } from '../utils/cache.js';
import { Rating, RatingStats } from '../utils/models.js';
import { createApiResponse, createErrorResponse } from '../utils/response.js';

// Helper function to get rating emoji
function getRatingEmoji(rating) {
  const emojis = { 1: '🤮', 2: '😐', 3: '🤤', 4: '🤯' };
  return emojis[rating] || '⭐';
}

// Update restaurant rating data (for admin editing)
export async function updateRestaurantRatingData(request, env) {
  try {
    const data = await request.json();
    const { restaurantId, totalRatings, averageRating, ratingDistribution } = data;

    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    // Get current restaurant data
    const restaurantKey = `restaurant:${restaurantId}`;
    const restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    if (!restaurantData) {
      return createErrorResponse('Restaurant not found', 404);
    }

    const restaurant = JSON.parse(restaurantData);

    // Update rating statistics
    if (
      totalRatings !== undefined ||
      averageRating !== undefined ||
      ratingDistribution !== undefined
    ) {
      const ratingStats = new RatingStats({
        totalRatings: totalRatings || restaurant.ratingStats?.totalRatings || 0,
        averageRating: averageRating || restaurant.ratingStats?.averageRating || 0,
        ratingDistribution: ratingDistribution ||
          restaurant.ratingStats?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0 },
        lastUpdated: new Date().toISOString(),
      });

      restaurant.ratingStats = ratingStats.toJSON();
    }

    restaurant.updatedAt = new Date().toISOString();

    // Save updated restaurant data
    await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(restaurant));

    return createApiResponse(
      {
        success: true,
        message: 'Restaurant rating data updated successfully',
        restaurant: {
          id: restaurantId,
          ratingStats: restaurant.ratingStats,
        },
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to update restaurant rating data', 500, {
      error: error.message,
    });
  }
}

// Submit a new rating
export async function submitRating(request, env) {
  try {
    const ratingData = await request.json();

    // Create Rating model and validate
    const rating = new Rating({
      ...ratingData,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
    });

    const validationErrors = rating.validate();
    if (validationErrors.length > 0) {
      return createErrorResponse(`Validation failed: ${validationErrors.join(', ')}`, 400);
    }

    // Check if rating already exists for this order
    const userRestaurantKey = `user_restaurant_history:${rating.userId}:${rating.restaurant}`;
    const existingHistoryData = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);

    let isUpdate = false;
    let existingRatingId = null;
    if (existingHistoryData) {
      const historyData = JSON.parse(existingHistoryData);
      if (historyData[rating.orderDate] && historyData[rating.orderDate].rating) {
        isUpdate = true;
        // Get the existing rating ID
        existingRatingId = historyData[rating.orderDate].rating.id;
        if (existingRatingId) {
          rating.id = existingRatingId;
        }
      }
    }

    // Store the rating in the order history
    let historyData = {};
    if (existingHistoryData) {
      historyData = JSON.parse(existingHistoryData);
    }

    // Ensure the order date exists in history
    if (!historyData[rating.orderDate]) {
      historyData[rating.orderDate] = {
        items: rating.items || [],
        updatedAt: new Date().toISOString(),
      };
    }

    // Add rating to the order
    const ratingRecord = {
      rating: rating.rating,
      comment: rating.comment,
      timestamp: rating.timestamp,
      items: rating.items || [],
      id: rating.id, // Include the rating ID
    };

    historyData[rating.orderDate].rating = ratingRecord;
    historyData[rating.orderDate].updatedAt = new Date().toISOString();

    // Save updated history
    await env.LANCHDRAP_RATINGS.put(userRestaurantKey, JSON.stringify(historyData));

    // Invalidate user history cache
    await invalidateUserHistoryCache(rating.userId, rating.restaurant);

    // Store individual rating record for analytics (only for new ratings)
    if (!isUpdate) {
      if (!rating.id) {
        rating.id = `rating:${rating.restaurant}:${Date.now()}:${Math.random().toString(36).substring(2, 11)}`;
      }
      await env.LANCHDRAP_RATINGS.put(rating.id, JSON.stringify(rating.toJSON()));
    } else {
      // For updates, update the existing rating record
      if (rating.id) {
        await env.LANCHDRAP_RATINGS.put(rating.id, JSON.stringify(rating.toJSON()));
      }
    }

    // Update restaurant-level rating statistics
    if (isUpdate) {
      // For updates, we need to recalculate stats by getting all ratings for this restaurant
      await recalculateRestaurantRatingStats(env, rating.restaurant);
    } else {
      // For new ratings, just add to existing stats
      await updateRestaurantRatingStats(env, rating.restaurant, rating.rating);
    }

    return createApiResponse(
      {
        success: true,
        message: isUpdate ? 'Rating updated successfully' : 'Rating submitted successfully',
        ratingId: rating.id,
        rating: rating.toJSON(),
        isUpdate,
      },
      isUpdate ? 200 : 201
    );
  } catch (error) {
    return createErrorResponse('Failed to submit rating', 500, { error: error.message });
  }
}

// Helper function to recalculate restaurant rating statistics from all ratings
async function recalculateRestaurantRatingStats(env, restaurantId) {
  try {
    // Get all ratings for this restaurant using the new key format
    const list = await env.LANCHDRAP_RATINGS.list({ prefix: `rating:${restaurantId}:` });

    const ratingStats = new RatingStats();

    for (const key of list.keys) {
      const ratingData = await env.LANCHDRAP_RATINGS.get(key.name);
      if (ratingData) {
        const rating = JSON.parse(ratingData);
        ratingStats.addRating(rating.rating);
      }
    }

    // Update restaurant record with recalculated stats
    const restaurantKey = `restaurant:${restaurantId}`;
    const restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    if (restaurantData) {
      const data = JSON.parse(restaurantData);
      data.ratingStats = ratingStats.toJSON();
      data.updatedAt = new Date().toISOString();
      await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(data));
    }
  } catch (_error) {}
}

// Helper function to update restaurant-level rating statistics
async function updateRestaurantRatingStats(env, restaurantId, newRating) {
  try {
    const restaurantKey = `restaurant:${restaurantId}`;
    const restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    if (!restaurantData) {
      // Restaurant doesn't exist, create basic record
      const ratingStats = new RatingStats();
      ratingStats.addRating(newRating);

      const newRestaurantData = {
        id: restaurantId,
        name: null,
        appearances: [],
        soldOutDates: [],
        menu: [],
        firstSeen: null,
        lastSeen: null,
        createdAt: new Date().toISOString(),
        ratingStats: ratingStats.toJSON(),
      };
      await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(newRestaurantData));
      return;
    }

    const data = JSON.parse(restaurantData);

    // Initialize rating stats if they don't exist
    let ratingStats;
    if (!data.ratingStats) {
      ratingStats = new RatingStats();
    } else {
      ratingStats = RatingStats.fromJSON(data.ratingStats);
    }

    // Update statistics using the model
    ratingStats.addRating(newRating);

    // Update restaurant timestamp
    data.updatedAt = new Date().toISOString();
    data.ratingStats = ratingStats.toJSON();

    // Save updated restaurant data
    await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(data));
  } catch (_error) {}
}

// Get ratings with filters
export async function getRatings(request, env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');
    const userId = url.searchParams.get('userId');
    const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 50, 100); // Max 100
    const offset = Math.max(parseInt(url.searchParams.get('offset'), 10) || 0, 0);
    const sortBy = url.searchParams.get('sortBy') || 'timestamp';
    const order = url.searchParams.get('order') || 'desc';

    const ratings = [];
    const list = await env.LANCHDRAP_RATINGS.list({ prefix: 'rating:' });

    for (const key of list.keys) {
      const ratingData = await env.LANCHDRAP_RATINGS.get(key.name);
      if (ratingData) {
        const rating = JSON.parse(ratingData);

        // Apply filters
        if (restaurant && rating.restaurant !== restaurant) continue;
        if (userId && rating.userId !== userId) continue;

        ratings.push(rating);
      }
    }

    // Sort ratings
    ratings.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (order === 'desc') {
        return new Date(bVal) - new Date(aVal);
      } else {
        return new Date(aVal) - new Date(bVal);
      }
    });

    const paginatedRatings = ratings.slice(offset, offset + limit);

    return createApiResponse(
      {
        ratings: paginatedRatings,
        pagination: {
          total: ratings.length,
          limit,
          offset,
          hasMore: offset + limit < ratings.length,
        },
        filters: {
          restaurant: restaurant || null,
          userId: userId || null,
          sortBy,
          order,
        },
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to get ratings', 500, { error: error.message });
  }
}

// Get rating statistics
export async function getRatingStats(request, env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');
    const timeRange = url.searchParams.get('timeRange') || 'all';

    if (!restaurant) {
      return createErrorResponse('Restaurant parameter is required', 400);
    }

    // Get restaurant data with rating stats
    const restaurantKey = `restaurant:${restaurant}`;
    const restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);

    if (!restaurantData) {
      return createApiResponse(
        {
          totalRatings: 0,
          averageRating: 0,
          ratingDistribution: [
            { stars: 1, count: 0, percentage: 0 },
            { stars: 2, count: 0, percentage: 0 },
            { stars: 3, count: 0, percentage: 0 },
            { stars: 4, count: 0, percentage: 0 },
          ],
          recentRatings: 0,
          timeRange,
          restaurant,
          lastUpdated: new Date().toISOString(),
        },
        200
      );
    }

    const data = JSON.parse(restaurantData);
    const ratingStats = data.ratingStats
      ? RatingStats.fromJSON(data.ratingStats)
      : new RatingStats();

    // Get rating distribution using the model
    const ratingDistribution = ratingStats.getDistributionArray();

    // Get recent ratings count (last 7 days) from individual rating records
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const list = await env.LANCHDRAP_RATINGS.list({ prefix: 'rating:' });
    let recentRatings = 0;

    for (const key of list.keys) {
      const ratingData = await env.LANCHDRAP_RATINGS.get(key.name);
      if (ratingData) {
        const rating = JSON.parse(ratingData);
        if (rating.restaurant === restaurant && new Date(rating.timestamp) > weekAgo) {
          recentRatings++;
        }
      }
    }

    // Get rating synopsis (average emoji and summary)
    const averageEmoji = getRatingEmoji(Math.round(ratingStats.averageRating));
    const ratingSynopsis = {
      averageEmoji,
      averageRating: Math.round(ratingStats.averageRating * 100) / 100,
      totalRatings: ratingStats.totalRatings,
      summary: `${averageEmoji} ${ratingStats.averageRating.toFixed(1)} (${ratingStats.totalRatings} rating${ratingStats.totalRatings !== 1 ? 's' : ''})`,
      distribution: ratingDistribution
        .map((dist) => `${getRatingEmoji(dist.stars)} ${dist.count}`)
        .join(' • '),
    };

    return createApiResponse(
      {
        totalRatings: ratingStats.totalRatings,
        averageRating: Math.round(ratingStats.averageRating * 100) / 100,
        ratingDistribution,
        recentRatings,
        ratingSynopsis,
        timeRange,
        restaurant,
        lastUpdated: ratingStats.lastUpdated,
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to get rating statistics', 500, { error: error.message });
  }
}

// Get rating for a specific order
export async function getOrderRating(request, env) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const restaurantId = url.searchParams.get('restaurantId');
    const orderDate = url.searchParams.get('orderDate');

    if (!userId || !restaurantId || !orderDate) {
      return createErrorResponse('userId, restaurantId, and orderDate are required', 400);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(orderDate)) {
      return createErrorResponse('orderDate must be in YYYY-MM-DD format', 400);
    }

    // Get user's order history for this restaurant
    const userRestaurantKey = `user_restaurant_history:${userId}:${restaurantId}`;
    const historyDataRaw = await env.LANCHDRAP_RATINGS.get(userRestaurantKey);

    if (!historyDataRaw) {
      return createApiResponse(
        {
          hasRating: false,
          rating: null,
          orderDate,
        },
        200
      );
    }

    const historyData = JSON.parse(historyDataRaw);
    const orderData = historyData[orderDate];

    if (!orderData || !orderData.rating) {
      return createApiResponse(
        {
          hasRating: false,
          rating: null,
          orderDate,
        },
        200
      );
    }

    return createApiResponse(
      {
        hasRating: true,
        rating: orderData.rating,
        orderDate,
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to get order rating', 500, { error: error.message });
  }
}

// Check if restaurant was rated today
export async function checkDailyRating(request, env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');

    if (!restaurant) {
      return createErrorResponse('Restaurant parameter is required', 400);
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyRatingKey = `daily_rating:${restaurant}:${today}`;
    const existingRating = await env.LANCHDRAP_RATINGS.get(dailyRatingKey);

    if (existingRating) {
      return createApiResponse(
        {
          hasRatedToday: true,
          rating: JSON.parse(existingRating),
          date: today,
        },
        200
      );
    }

    return createApiResponse(
      {
        hasRatedToday: false,
        date: today,
      },
      200
    );
  } catch (error) {
    return createErrorResponse('Failed to check daily rating', 500, { error: error.message });
  }
}
