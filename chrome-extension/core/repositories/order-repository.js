// Order repository - centralized data access for order operations
// Provides a clean interface for all order-related API calls

class OrderRepository {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Get user restaurant summary (all restaurants user has ordered from)
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Restaurant summary data
   */
  async getUserRestaurantSummary(userId) {
    return this.apiClient.getUserRestaurantSummary(userId);
  }

  /**
   * Update user order for a specific date
   * @param {string} userId - User identifier
   * @param {string} restaurantId - Restaurant identifier
   * @param {string} orderDate - Order date (YYYY-MM-DD)
   * @param {Array<Object>} items - Order items
   * @returns {Promise<Object>} Update result
   */
  async updateUserOrder(userId, restaurantId, orderDate, items) {
    return this.apiClient.updateUserOrder(userId, restaurantId, orderDate, items);
  }

  /**
   * Delete user restaurant history for a specific date
   * @param {string} userId - User identifier
   * @param {string} restaurantId - Restaurant identifier
   * @param {string} orderDate - Order date (YYYY-MM-DD)
   * @returns {Promise<Object>} Deletion result
   */
  async deleteUserRestaurantHistory(userId, restaurantId, orderDate) {
    return this.apiClient.deleteUserRestaurantHistory(userId, restaurantId, orderDate);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OrderRepository };
} else {
  // Browser environment
  window.LanchDrapRepositories = window.LanchDrapRepositories || {};
  window.LanchDrapRepositories.OrderRepository = OrderRepository;

  if (typeof globalThis !== 'undefined') {
    globalThis.LanchDrapRepositories = globalThis.LanchDrapRepositories || {};
    globalThis.LanchDrapRepositories.OrderRepository = OrderRepository;
  }
}

