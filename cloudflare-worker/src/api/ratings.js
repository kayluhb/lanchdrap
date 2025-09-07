// Rating API routes
// Following modern API patterns with proper error handling and validation

import { createApiResponse, createErrorResponse } from '../utils/response.js';

// Submit a new rating
export async function submitRating(request, env) {
  try {
    const ratingData = await request.json();

    // Validation
    if (!ratingData.restaurant || !ratingData.rating) {
      return createErrorResponse('Restaurant and rating are required', 400);
    }

    if (ratingData.rating < 1 || ratingData.rating > 5) {
      return createErrorResponse('Rating must be between 1 and 5', 400);
    }

    // Check for daily rating limit
    const today = new Date().toISOString().split('T')[0];
    const dailyRatingKey = `daily_rating:${ratingData.restaurant}:${today}`;
    const existingRating = await env.LANCHDRAP_RATINGS.get(dailyRatingKey);

    if (existingRating) {
      return createErrorResponse('You have already rated this restaurant today', 409, {
        existingRating: JSON.parse(existingRating),
      });
    }

    // Store the rating
    const ratingKey = `rating:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const fullRatingData = {
      ...ratingData,
      id: ratingKey,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
    };

    // COMMENTED OUT: Not storing ratings yet
    // await env.LANCHDRAP_RATINGS.put(ratingKey, JSON.stringify(fullRatingData));
    // await env.LANCHDRAP_RATINGS.put(dailyRatingKey, JSON.stringify(fullRatingData));

    return createApiResponse(
      {
        success: true,
        message: 'Rating submitted successfully',
        ratingId: ratingKey,
        rating: fullRatingData,
      },
      201
    );
  } catch (error) {
    console.error('Error submitting rating:', error);
    return createErrorResponse('Failed to submit rating', 500, { error: error.message });
  }
}

// Get ratings with filters
export async function getRatings(request, _env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100); // Max 100
    const offset = Math.max(parseInt(url.searchParams.get('offset')) || 0, 0);
    const sortBy = url.searchParams.get('sortBy') || 'timestamp';
    const order = url.searchParams.get('order') || 'desc';

    // COMMENTED OUT: Not storing ratings yet, return empty array
    const ratings = [];
    // const list = await env.LANCHDRAP_RATINGS.list({ prefix: 'rating:' });
    //
    // for (const key of list.keys) {
    //   const ratingData = await env.LANCHDRAP_RATINGS.get(key.name);
    //   if (ratingData) {
    //     const rating = JSON.parse(ratingData);
    //     if (!restaurant || rating.restaurant === restaurant) {
    //       ratings.push(rating);
    //     }
    //   }
    // }

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
          sortBy,
          order,
        },
      },
      200
    );
  } catch (error) {
    console.error('Error getting ratings:', error);
    return createErrorResponse('Failed to get ratings', 500, { error: error.message });
  }
}

// Get rating statistics
export async function getRatingStats(request, _env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');
    const timeRange = url.searchParams.get('timeRange') || 'all';

    // COMMENTED OUT: Not storing ratings yet, return empty array
    const ratings = [];
    // const list = await env.LANCHDRAP_RATINGS.list({ prefix: 'rating:' });
    //
    // for (const key of list.keys) {
    //   const ratingData = await env.LANCHDRAP_RATINGS.get(key.name);
    //   if (ratingData) {
    //     const rating = JSON.parse(ratingData);
    //     if (!restaurant || rating.restaurant === restaurant) {
    //       ratings.push(rating);
    //     }
    //   }
    // }

    // Calculate statistics
    const totalRatings = ratings.length;
    const averageRating =
      totalRatings > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings : 0;

    // Rating distribution
    const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
      stars: star,
      count: ratings.filter((r) => r.rating === star).length,
      percentage:
        totalRatings > 0
          ? ((ratings.filter((r) => r.rating === star).length / totalRatings) * 100).toFixed(1)
          : 0,
    }));

    // Recent ratings (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRatings = ratings.filter((r) => new Date(r.timestamp) > weekAgo);

    return createApiResponse(
      {
        totalRatings,
        averageRating: Math.round(averageRating * 100) / 100,
        ratingDistribution,
        recentRatings: recentRatings.length,
        timeRange,
        restaurant: restaurant || 'all',
        lastUpdated: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    console.error('Error getting rating stats:', error);
    return createErrorResponse('Failed to get rating statistics', 500, { error: error.message });
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
    console.error('Error checking daily rating:', error);
    return createErrorResponse('Failed to check daily rating', 500, { error: error.message });
  }
}
