// Cloudflare Cache utility for restaurant data
// Provides caching layer on top of KV storage for better performance

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  // Cache TTL in seconds
  RESTAURANT_DATA_TTL: 300, // 5 minutes
  MENU_DATA_TTL: 600, // 10 minutes
  USER_HISTORY_TTL: 180, // 3 minutes

  // Cache key prefixes
  RESTAURANT_PREFIX: 'cache:restaurant:',
  MENU_PREFIX: 'cache:menu:',
  USER_HISTORY_PREFIX: 'cache:user_history:',
};

/**
 * Get cached restaurant data or fetch from KV if not cached
 */
export async function getCachedRestaurantData(env, restaurantId) {
  const cacheKey = `${CACHE_CONFIG.RESTAURANT_PREFIX}${restaurantId}`;
  const kvKey = `restaurant:${restaurantId}`;

  try {
    // Try to get from cache first
    const cache = caches.default;
    const cacheUrl = new URL(`https://cache.lanchdrap.com/${cacheKey}`);
    const cachedResponse = await cache.match(cacheUrl);

    if (cachedResponse) {
      const cachedData = await cachedResponse.text();
      return cachedData ? JSON.parse(cachedData) : null;
    }

    // Not in cache, fetch from KV
    const kvData = await env.LANCHDRAP_RATINGS.get(kvKey);

    if (kvData) {
      // Store in cache for future requests
      const response = new Response(kvData, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${CACHE_CONFIG.RESTAURANT_DATA_TTL}`,
        },
      });

      await cache.put(cacheUrl, response.clone());
      return JSON.parse(kvData);
    }

    return null;
  } catch (_error) {
    // Fallback to KV on cache error
    // Cache error, falling back to KV
    const kvData = await env.LANCHDRAP_RATINGS.get(kvKey);
    return kvData ? JSON.parse(kvData) : null;
  }
}

/**
 * Get cached menu data or fetch from KV if not cached
 */
export async function getCachedMenuData(env, restaurantId) {
  const cacheKey = `${CACHE_CONFIG.MENU_PREFIX}${restaurantId}`;
  const kvKey = `restaurant_menu:${restaurantId}`;

  try {
    // Try to get from cache first
    const cache = caches.default;
    const cacheUrl = new URL(`https://cache.lanchdrap.com/${cacheKey}`);
    const cachedResponse = await cache.match(cacheUrl);

    if (cachedResponse) {
      const cachedData = await cachedResponse.text();
      return cachedData ? JSON.parse(cachedData) : null;
    }

    // Not in cache, fetch from KV
    const kvData = await env.LANCHDRAP_RATINGS.get(kvKey);

    if (kvData) {
      // Store in cache for future requests
      const response = new Response(kvData, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${CACHE_CONFIG.MENU_DATA_TTL}`,
        },
      });

      await cache.put(cacheUrl, response.clone());
      return JSON.parse(kvData);
    }

    return null;
  } catch (_error) {
    // Fallback to KV on cache error
    // Cache error, falling back to KV
    const kvData = await env.LANCHDRAP_RATINGS.get(kvKey);
    return kvData ? JSON.parse(kvData) : null;
  }
}

/**
 * Get cached user history data or fetch from KV if not cached
 */
export async function getCachedUserHistoryData(env, userId, restaurantId) {
  const cacheKey = `${CACHE_CONFIG.USER_HISTORY_PREFIX}${userId}:${restaurantId}`;
  const kvKey = `user_restaurant_history:${userId}:${restaurantId}`;

  try {
    // Try to get from cache first
    const cache = caches.default;
    const cacheUrl = new URL(`https://cache.lanchdrap.com/${cacheKey}`);
    const cachedResponse = await cache.match(cacheUrl);

    if (cachedResponse) {
      const cachedData = await cachedResponse.text();
      return cachedData ? JSON.parse(cachedData) : null;
    }

    // Not in cache, fetch from KV
    const kvData = await env.LANCHDRAP_RATINGS.get(kvKey);

    if (kvData) {
      // Store in cache for future requests
      const response = new Response(kvData, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${CACHE_CONFIG.USER_HISTORY_TTL}`,
        },
      });

      await cache.put(cacheUrl, response.clone());
      return JSON.parse(kvData);
    }

    return null;
  } catch (_error) {
    // Fallback to KV on cache error
    // Cache error, falling back to KV
    const kvData = await env.LANCHDRAP_RATINGS.get(kvKey);
    return kvData ? JSON.parse(kvData) : null;
  }
}

/**
 * Invalidate restaurant data cache when data is updated
 */
export async function invalidateRestaurantCache(restaurantId) {
  try {
    const cache = caches.default;
    const cacheKey = `${CACHE_CONFIG.RESTAURANT_PREFIX}${restaurantId}`;
    const cacheUrl = new URL(`https://cache.lanchdrap.com/${cacheKey}`);

    await cache.delete(cacheUrl);
  } catch (_error) {
    // Error invalidating restaurant cache
  }
}

/**
 * Invalidate menu data cache when menu is updated
 */
export async function invalidateMenuCache(restaurantId) {
  try {
    const cache = caches.default;
    const cacheKey = `${CACHE_CONFIG.MENU_PREFIX}${restaurantId}`;
    const cacheUrl = new URL(`https://cache.lanchdrap.com/${cacheKey}`);

    await cache.delete(cacheUrl);
  } catch (_error) {
    // Error invalidating menu cache
  }
}

/**
 * Invalidate user history cache when history is updated
 */
export async function invalidateUserHistoryCache(userId, restaurantId) {
  try {
    const cache = caches.default;
    const cacheKey = `${CACHE_CONFIG.USER_HISTORY_PREFIX}${userId}:${restaurantId}`;
    const cacheUrl = new URL(`https://cache.lanchdrap.com/${cacheKey}`);

    await cache.delete(cacheUrl);
  } catch (_error) {
    // Error invalidating user history cache
  }
}

/**
 * Batch invalidate multiple cache entries
 */
export async function batchInvalidateCache(invalidations) {
  const promises = invalidations.map(async ({ type, restaurantId, userId }) => {
    switch (type) {
      case 'restaurant':
        return invalidateRestaurantCache(restaurantId);
      case 'menu':
        return invalidateMenuCache(restaurantId);
      case 'user_history':
        return invalidateUserHistoryCache(userId, restaurantId);
      default:
        return Promise.resolve();
    }
  });

  await Promise.allSettled(promises);
}
