// API client utility for communicating with Cloudflare Worker
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  // Get full API URL
  getUrl(endpoint) {
    return `${this.baseUrl}${endpoint}`;
  }

  // Make HTTP request with retry logic and enhanced error handling
  async request(endpoint, options = {}) {
    const url = this.getUrl(endpoint);
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`LanchDrap API: Attempting request to ${url} (attempt ${attempt})`);
        
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        console.log(`LanchDrap API: Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          // Get response body for better error messages
          let errorBody = '';
          try {
            errorBody = await response.text();
            console.log(`LanchDrap API: Error response body:`, errorBody);
          } catch (e) {
            console.log(`LanchDrap API: Could not read error response body`);
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
        }

        // Try to parse JSON response
        try {
          const jsonResponse = await response.json();
          console.log(`LanchDrap API: Successfully parsed JSON response`);
          return jsonResponse;
        } catch {
          // If response is not JSON, return text
          const textResponse = await response.text();
          console.log(`LanchDrap API: Returning text response`);
          return textResponse;
        }
      } catch (error) {
        lastError = error;
        console.warn(`LanchDrap API: Request attempt ${attempt} failed:`, error);

        if (attempt < this.retryAttempts) {
          console.log(`LanchDrap API: Waiting ${this.retryDelay * attempt}ms before retry...`);
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }

    // Enhanced error message with debugging info
    const errorMessage = `API request failed after ${this.retryAttempts} attempts: ${lastError.message}`;
    console.error(`LanchDrap API: ${errorMessage}`);
    console.error(`LanchDrap API: Last error details:`, lastError);
    console.error(`LanchDrap API: Request URL: ${url}`);
    console.error(`LanchDrap API: Request options:`, options);
    
    throw new Error(errorMessage);
  }

  // Submit a rating
  async submitRating(ratingData) {
    return this.request('/api/ratings', {
      method: 'POST',
      body: JSON.stringify(ratingData),
    });
  }

  // Get ratings endpoint removed

  // Get rating statistics
  async getRatingStats(options = {}) {
    const params = new URLSearchParams();
    if (options.restaurant) params.append('restaurant', options.restaurant);
    if (options.timeRange) params.append('timeRange', options.timeRange);

    const endpoint = `/api/ratings/stats${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request(endpoint);
  }

  // Get restaurant list endpoint removed

  // Report restaurant sellout status
  async reportSelloutStatus(selloutData) {
    return this.request('/api/restaurants/sellout', {
      method: 'POST',
      body: JSON.stringify(selloutData),
    });
  }

  // Get restaurant availability statistics
  async getRestaurantAvailability(options = {}) {
    const params = new URLSearchParams();
    if (options.restaurant) params.append('restaurant', options.restaurant);
    if (options.timeRange) params.append('timeRange', options.timeRange);
    if (options.includeDetails) params.append('includeDetails', options.includeDetails);

    const endpoint = `/api/restaurants/availability${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request(endpoint);
  }

  // Submit availability summary endpoint removed

  // Get daily availability data
  async getDailyAvailability(date) {
    const endpoint = `/api/restaurants/daily-availability?date=${date}`;
    return this.request(endpoint);
  }

  // Get office availability trends
  async getOfficeAvailability(options = {}) {
    const params = new URLSearchParams();
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);

    const endpoint = `/api/restaurants/office-availability${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request(endpoint);
  }

  // Get restaurant by ID
  async getRestaurantById(restaurantId, restaurantName = null) {
    let endpoint = `/api/restaurant/${restaurantId}`;
    
    // Add name as query parameter if provided
    if (restaurantName && restaurantName !== restaurantId) {
      const params = new URLSearchParams();
      params.append('name', restaurantName);
      endpoint += `?${params.toString()}`;
    }
    
    return this.request(endpoint);
  }

  // Get restaurant appearance statistics endpoint removed - use getRestaurantById instead

  // Track restaurant appearances from daily pages
  async trackRestaurantAppearances(appearanceData) {
    return this.request('/api/restaurants/appearances/track', {
      method: 'POST',
      body: JSON.stringify(appearanceData),
    });
  }

  // Check daily rating endpoint removed

  // Update restaurant name
  async updateRestaurantName(restaurantId, restaurantName) {
    return this.request('/api/restaurants/update-name', {
      method: 'POST',
      body: JSON.stringify({ restaurantId, restaurantName }),
    });
  }

  // Sync ratings from local storage
  async syncRatings(ratings) {
    return this.request('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ ratings }),
    });
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
  
  console.log('LanchDrap Rating Extension: LanchDrapApiClient set globally:', typeof window.LanchDrapApiClient);
}
