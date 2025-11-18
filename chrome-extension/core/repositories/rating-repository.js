// Rating repository - centralized data access for rating operations
// Provides a clean interface for all rating-related API calls

class RatingRepository {
  constructor(apiClient, baseUrl, endpoints) {
    this.apiClient = apiClient;
    this.baseUrl = baseUrl;
    this.endpoints = endpoints;
  }

  /**
   * Get rating for a specific order
   * @param {string} userId - User identifier
   * @param {string} restaurantId - Restaurant identifier
   * @param {string} orderDate - Order date (YYYY-MM-DD)
   * @returns {Promise<Object>} Rating data
   */
  async getOrderRating(userId, restaurantId, orderDate) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    params.append('restaurantId', restaurantId);
    params.append('orderDate', orderDate);

    const endpoint = `${this.endpoints.RATINGS}/order?${params.toString()}`;
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get order rating: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Submit a rating
   * @param {Object} ratingData - Rating data object
   * @returns {Promise<Object>} Submission result
   */
  async submitRating(ratingData) {
    const endpoint = this.endpoints.RATINGS;
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ratingData),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit rating: ${response.statusText}`);
    }

    return response.json();
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RatingRepository };
} else {
  // Browser environment
  window.LanchDrapRepositories = window.LanchDrapRepositories || {};
  window.LanchDrapRepositories.RatingRepository = RatingRepository;

  if (typeof globalThis !== 'undefined') {
    globalThis.LanchDrapRepositories = globalThis.LanchDrapRepositories || {};
    globalThis.LanchDrapRepositories.RatingRepository = RatingRepository;
  }
}

