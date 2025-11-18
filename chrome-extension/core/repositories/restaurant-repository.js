// Restaurant repository - centralized data access for restaurant operations
// Provides a clean interface for all restaurant-related API calls

class RestaurantRepository {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Get restaurant by ID
   * @param {string} restaurantId - Restaurant identifier
   * @param {string} [restaurantName] - Optional restaurant name for lookup
   * @returns {Promise<Object>} Restaurant data
   */
  async getById(restaurantId, restaurantName = null) {
    return this.apiClient.getRestaurantById(restaurantId, restaurantName);
  }

  /**
   * Get restaurant menu by ID
   * @param {string} restaurantId - Restaurant identifier
   * @returns {Promise<Object>} Menu data
   */
  async getMenu(restaurantId) {
    return this.apiClient.getRestaurantMenu(restaurantId);
  }

  /**
   * Get restaurant stats with user history
   * @param {string} restaurantId - Restaurant identifier
   * @param {string} userId - User identifier
   * @param {AbortSignal} [signal] - Optional abort signal
   * @returns {Promise<Object>} Restaurant stats with user history
   */
  async getStatsWithUserHistory(restaurantId, userId, signal = null) {
    return this.apiClient.getRestaurantStatsWithUserHistory(restaurantId, userId, signal);
  }

  /**
   * Update restaurant appearances
   * @param {string} restaurantId - Restaurant identifier
   * @param {Array<string>} appearanceDates - Array of appearance dates (YYYY-MM-DD)
   * @param {Array<string>} soldoutDates - Array of sold out dates (YYYY-MM-DD)
   * @returns {Promise<Object>} Update result
   */
  async updateAppearances(restaurantId, appearanceDates, soldoutDates) {
    return this.apiClient.updateRestaurantAppearances(restaurantId, appearanceDates, soldoutDates);
  }

  /**
   * Track restaurant appearances
   * @param {Object} trackingData - Tracking data object
   * @param {AbortSignal} [signal] - Optional abort signal
   * @returns {Promise<Object>} Tracking result
   */
  async trackAppearances(trackingData, signal = null) {
    return this.apiClient.trackRestaurantAppearances(trackingData, signal);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RestaurantRepository };
} else {
  // Browser environment
  window.LanchDrapRepositories = window.LanchDrapRepositories || {};
  window.LanchDrapRepositories.RestaurantRepository = RestaurantRepository;

  if (typeof globalThis !== 'undefined') {
    globalThis.LanchDrapRepositories = globalThis.LanchDrapRepositories || {};
    globalThis.LanchDrapRepositories.RestaurantRepository = RestaurantRepository;
  }
}

