// Sync API routes
// Following modern API patterns for data synchronization

import { createApiResponse, createErrorResponse } from '../utils/response.js';

// Sync ratings from client
export async function syncRatings(request, env, corsHeaders) {
  try {
    const { ratings } = await request.json();

    // Validation
    if (!ratings || !Array.isArray(ratings)) {
      return createErrorResponse(
        'Invalid ratings data: ratings must be an array',
        400,
        corsHeaders
      );
    }

    if (ratings.length === 0) {
      return createApiResponse(
        {
          success: true,
          message: 'No ratings to sync',
          syncedCount: 0,
        },
        200,
        corsHeaders
      );
    }

    // Validate each rating
    const validRatings = [];
    const invalidRatings = [];

    for (const rating of ratings) {
      if (rating.restaurant && rating.rating && rating.timestamp) {
        validRatings.push(rating);
      } else {
        invalidRatings.push(rating);
      }
    }

    // Sync valid ratings to KV store
    const syncedRatings = [];
    for (const rating of validRatings) {
      const ratingKey = `rating:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      const fullRatingData = {
        ...rating,
        id: ratingKey,
        syncedAt: new Date().toISOString(),
        userAgent: request.headers.get('User-Agent'),
        ip: request.headers.get('CF-Connecting-IP'),
      };

      await env.LANCHDRAP_RATINGS.put(ratingKey, JSON.stringify(fullRatingData));
      syncedRatings.push(fullRatingData);
    }

    return createApiResponse(
      {
        success: true,
        message: `Synced ${syncedRatings.length} ratings`,
        syncedCount: syncedRatings.length,
        invalidCount: invalidRatings.length,
        data: {
          syncedRatings: syncedRatings.length,
          invalidRatings: invalidRatings.length,
          totalProcessed: ratings.length,
          timestamp: new Date().toISOString(),
        },
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error('Error syncing ratings:', error);
    return createErrorResponse('Failed to sync ratings', 500, corsHeaders, {
      error: error.message,
    });
  }
}
