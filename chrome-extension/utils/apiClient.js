// API client utility for communicating with Cloudflare Worker
class ApiClient {
  constructor(baseUrl, endpoints = null) {
    this.baseUrl = baseUrl;
    this.endpoints = endpoints;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  // Get full API URL
  getUrl(endpoint) {
    return `${this.baseUrl}${endpoint}`;
  }

  // Get endpoint from config or fallback to direct path
  getEndpoint(endpointKey) {
    if (this.endpoints?.[endpointKey]) {
      return this.endpoints[endpointKey];
    }
    // Fallback to direct path if config not available
    return endpointKey.toLowerCase().replace(/_/g, '-');
  }

  // Make HTTP request with retry logic and enhanced error handling
  async request(endpoint, options = {}) {
    const url = this.getUrl(endpoint);
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: options.signal, // Explicitly pass the abort signal
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          // Get response body for better error messages
          let errorBody = '';
          try {
            errorBody = await response.text();
          } catch {}

          throw new Error(
            `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`
          );
        }

        // Try to parse JSON response
        try {
          const jsonResponse = await response.json();
          return jsonResponse;
        } catch {
          // If response is not JSON, return text
          const textResponse = await response.text();
          return textResponse;
        }
      } catch (error) {
        lastError = error;

        if (attempt < this.retryAttempts) {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }

    // Enhanced error message with debugging info
    const errorMessage = `API request failed after ${this.retryAttempts} attempts: ${lastError.message}`;

    throw new Error(errorMessage);
  }

  // All other API methods disabled - only tracking enabled
  // async submitRating(ratingData) {
  //   return this.request(this.getEndpoint('RATINGS'), {
  //     method: 'POST',
  //     body: JSON.stringify(ratingData),
  //   });
  // }

  // async getRatingStats(options = {}) {
  //   const params = new URLSearchParams();
  //   if (options.restaurant) params.append('restaurant', options.restaurant);
  //   if (options.timeRange) params.append('timeRange', options.timeRange);
  //   const endpoint = `${this.getEndpoint('RATINGS_STATS')}${params.toString() ? `?${params.toString()}` : ''}`;
  //   return this.request(endpoint);
  // }

  // async getDailyAvailability(date) {
  //   const endpoint = `/api/restaurants/daily-availability?date=${date}`;
  //   return this.request(endpoint);
  // }

  // async getRestaurantById(restaurantId, restaurantName = null) {
  //   let endpoint = `${this.getEndpoint('RESTAURANTS_GET_BY_ID')}/${restaurantId}`;
  //   if (restaurantName && restaurantName !== restaurantId) {
  //     const params = new URLSearchParams();
  //     params.append('name', restaurantName);
  //     endpoint += `?${params.toString()}`;
  //   }
  //   return this.request(endpoint);
  // }
  async getRestaurantById(restaurantId, restaurantName = null) {
    let endpoint = `${this.getEndpoint('RESTAURANTS_GET_BY_ID')}/${restaurantId}`;
    if (restaurantName && restaurantName !== restaurantId) {
      const params = new URLSearchParams();
      params.append('name', restaurantName);
      endpoint += `?${params.toString()}`;
    }
    return this.request(endpoint);
  }

  // Track restaurant appearances from daily pages
  async trackRestaurantAppearances(appearanceData, signal = null) {
    return this.request(this.getEndpoint('RESTAURANTS_APPEARANCES_TRACK'), {
      method: 'POST',
      body: JSON.stringify(appearanceData),
      signal: signal,
    });
  }

  // Clear restaurant name lookup records (admin function)
  async clearRestaurantNameRecords() {
    return this.request(this.getEndpoint('CLEAR_RESTAURANT_NAMES'), {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // All other API methods disabled - only tracking enabled
  async updateRestaurant(
    restaurantId,
    restaurantName = null,
    menuItems = null,
    signal = null,
    orderDate = null,
    restaurantLogo = null
  ) {
    return this.request(this.getEndpoint('RESTAURANTS_UPDATE'), {
      method: 'POST',
      body: JSON.stringify({ restaurantId, restaurantName, menuItems, orderDate, restaurantLogo }),
      signal: signal,
    });
  }

  async storeUserOrder(userId, restaurantId, orderData) {
    return this.request(this.getEndpoint('ORDERS'), {
      method: 'POST',
      body: JSON.stringify({ userId, restaurantId, orderData }),
    });
  }

  async updateUserOrder(userId, restaurantId, orderDate, items) {
    const endpoint = `${this.getEndpoint('ORDERS')}/${orderDate}`;
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ userId, restaurantId, items }),
    });
  }

  // async getUserOrderHistory(userId, restaurantId = null) {
  //   const params = new URLSearchParams();
  //   params.append('userId', userId);
  //   if (restaurantId) {
  //     params.append('restaurantId', restaurantId);
  //   }
  //   const endpoint = `${this.getEndpoint('ORDERS')}?${params.toString()}`;
  //   return this.request(endpoint);
  // }

  async getUserRestaurantSummary(userId) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    const endpoint = `${this.getEndpoint('ORDERS_SUMMARY')}?${params.toString()}`;
    return this.request(endpoint);
  }

  async getRestaurantStatsWithUserHistory(restaurantId, userId, signal = null) {
    console.log('LanchDrap: API Client - getRestaurantStatsWithUserHistory called with:', {
      restaurantId,
      userId,
    });
    const params = new URLSearchParams();
    params.append('restaurant', restaurantId);
    params.append('userId', userId);
    const endpoint = `${this.getEndpoint('RESTAURANTS_STATS')}?${params.toString()}`;
    console.log('LanchDrap: API Client - calling endpoint:', endpoint);
    const result = await this.request(endpoint, { signal: signal });
    console.log('LanchDrap: API Client - request completed, result:', result);
    return result;
  }

  // async getRestaurantUsers(restaurantId) {
  //   const params = new URLSearchParams();
  //   params.append('restaurantId', restaurantId);
  //   const endpoint = `${this.getEndpoint('RESTAURANTS_USERS')}?${params.toString()}`;
  //   return this.request(endpoint);
  // }

  async updateRestaurantAppearances(restaurantId, appearanceDates, soldoutDates) {
    return this.request(this.getEndpoint('RESTAURANTS_UPDATE_APPEARANCES'), {
      method: 'POST',
      body: JSON.stringify({ restaurantId, appearanceDates, soldoutDates }),
    });
  }

  // ratings update endpoint removed per admin request

  async deleteUserRestaurantHistory(userId, restaurantId, orderDate) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    params.append('restaurantId', restaurantId);
    const endpoint = `${this.getEndpoint('ORDERS')}/${orderDate}?${params.toString()}`;
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ApiClient };
} else {
  // Browser environment - ensure global variables are set
  window.LanchDrapApiClient = { ApiClient };

  // Also set on global scope for content scripts
  if (typeof globalThis !== 'undefined') {
    globalThis.LanchDrapApiClient = { ApiClient };
  }
}
