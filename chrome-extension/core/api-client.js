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

  // Get restaurant by ID
  async getRestaurantById(restaurantId, restaurantName = null) {
    let endpoint = `${this.getEndpoint('RESTAURANTS_GET_BY_ID')}/${restaurantId}`;
    if (restaurantName && restaurantName !== restaurantId) {
      const params = new URLSearchParams();
      params.append('name', restaurantName);
      endpoint += `?${params.toString()}`;
    }
    return this.request(endpoint);
  }

  // Get restaurant menu by ID
  async getRestaurantMenu(restaurantId) {
    const endpoint = `${this.getEndpoint('RESTAURANTS_GET_MENU')}/${restaurantId}`;
    return this.request(endpoint);
  }

  // Track both restaurants and orders from daily pages
  async trackRestaurantAppearances(trackingData, signal = null) {
    return this.request(this.getEndpoint('RESTAURANTS_APPEARANCES_TRACK'), {
      method: 'POST',
      body: JSON.stringify(trackingData),
      signal: signal,
    });
  }

  // Update restaurant
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

  // Update user order
  async updateUserOrder(userId, restaurantId, orderDate, items) {
    const endpoint = `/api/orders/${orderDate}`;
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ userId, restaurantId, items }),
    });
  }

  // Get user restaurant summary
  async getUserRestaurantSummary(userId) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    const endpoint = `${this.getEndpoint('ORDERS_SUMMARY')}?${params.toString()}`;
    return this.request(endpoint);
  }

  // Get restaurant stats with user history
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

  // Update restaurant appearances
  async updateRestaurantAppearances(restaurantId, appearanceDates, soldoutDates) {
    return this.request(this.getEndpoint('RESTAURANTS_UPDATE_APPEARANCES'), {
      method: 'POST',
      body: JSON.stringify({ restaurantId, appearanceDates, soldoutDates }),
    });
  }

  // Delete user restaurant history
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
