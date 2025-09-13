document.addEventListener('DOMContentLoaded', () => {
  const statusDiv = document.getElementById('status');
  const orderHistoryDiv = document.getElementById('order-history');

  // Show loading message
  orderHistoryDiv.innerHTML = '<p class="no-orders">Loading your restaurant history...</p>';

  function _showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = 'status';
    }, 3000);
  }

  // Silent version of copy function (no popup messages)
  async function copyLocalStorageToChromeStorageSilent() {
    try {
      // Get all localStorage keys that start with 'restaurant_name:'
      const allKeys = Object.keys(localStorage);
      const restaurantNameKeys = allKeys.filter((key) => key.startsWith('restaurant_name:'));

      if (restaurantNameKeys.length === 0) {
        return { copied: 0, message: 'No restaurant names found in localStorage' };
      }

      // Get all restaurant names from localStorage
      const restaurantNames = {};
      for (const key of restaurantNameKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          restaurantNames[key] = value;
        }
      }

      // Store them in chrome.storage.local
      await chrome.storage.local.set(restaurantNames);

      return {
        copied: Object.keys(restaurantNames).length,
        message: `Copied ${Object.keys(restaurantNames).length} restaurant names to chrome.storage.local`,
        names: restaurantNames,
      };
    } catch (error) {
      return { copied: 0, message: `Error copying: ${error.message}` };
    }
  }

  // Load last 10 restaurants from user order history
  async function loadLast10Restaurants() {
    // Auto-copy localStorage restaurant names to chrome.storage.local (silent version)
    await copyLocalStorageToChromeStorageSilent();

    try {
      // Get user ID
      const userIdentification = await lanchDrapUserIdManager.getUserIdentification();

      if (!userIdentification || !userIdentification.userId) {
        // DON'T OVERWRITE - just add to debug
        orderHistoryDiv.innerHTML +=
          '<div style="background: #f8d7da; padding: 5px; margin: 5px 0;">ERROR: Unable to get user ID</div>';
        return;
      }

      // Get order summary from API
      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      const restaurantSummary = await apiClient.getUserRestaurantSummary(userIdentification.userId);

      // Check if the API call was successful
      if (!restaurantSummary) {
        orderHistoryDiv.innerHTML = `
          <div class="error-message">
            <h3>Connection Error</h3>
            <p>Unable to connect to the server. Please check your internet connection and try again.</p>
          </div>
        `;
        return;
      }

      // Check if the API returned an error
      if (restaurantSummary.success === false) {
        orderHistoryDiv.innerHTML = `
          <div class="error-message">
            <h3>Server Error</h3>
            <p>${restaurantSummary.error?.message || restaurantSummary.message || 'An error occurred while loading your restaurant history.'}</p>
          </div>
        `;
        return;
      }

      // Check if we have data
      const restaurants = restaurantSummary.data?.restaurants;
      if (!restaurants || restaurants.length === 0) {
        orderHistoryDiv.innerHTML = `
          <div class="no-data-message">
            <h3>No restaurant history found</h3>
            <p>You haven't ordered from any restaurants yet, or your order history is not available.</p>
          </div>
        `;
        return;
      }

      // Sort by last order date and take the first 10
      const sortedRestaurants = restaurants
        .sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate))
        .slice(0, 10);

      await displayLast10Restaurants(sortedRestaurants);
    } catch (_error) {
      orderHistoryDiv.innerHTML = `
        <div class="error-message">
          <h3>Error loading restaurant history</h3>
          <p>Unable to load your restaurant order history. Please try again later.</p>
        </div>
      `;
    }
  }

  async function displayLast10Restaurants(restaurants) {
    if (!restaurants || restaurants.length === 0) {
      orderHistoryDiv.innerHTML = `
        <div class="no-data-message">
          <h3>No restaurant history found</h3>
          <p>You haven't ordered from any restaurants yet, or your order history is not available.</p>
        </div>
      `;
      return;
    }

    // Get all restaurant names from chrome.storage.local
    const restaurantKeys = restaurants.map((r) => `restaurant_name:${r.restaurantId}`);
    const storageResult = await chrome.storage.local.get(restaurantKeys);

    const restaurantsHTML = restaurants
      .map((restaurant) => {
        const lastOrderDate =
          window.LanchDrapDOMUtils?.formatDateString?.(restaurant.lastOrderDate) ||
          new Date(restaurant.lastOrderDate).toLocaleDateString();
        const totalOrders = restaurant.totalOrders || 0;
        const recentOrders = restaurant.recentOrders || [];

        // Get the most recent order items for display
        const recentItems =
          recentOrders.length > 0 && recentOrders[0].items
            ? recentOrders[0].items
                .slice(0, 3)
                .map((item) => item.name || item.fullDescription || 'Unknown Item')
                .join(', ')
            : 'No items recorded';

        // Get restaurant name from chrome.storage.local
        const restaurantKey = `restaurant_name:${restaurant.restaurantId}`;
        const storedName = storageResult[restaurantKey];
        const restaurantName = storedName || restaurant.restaurantId;

        return `
          <div class="restaurant-item">
            <div class="restaurant-header">
              <span class="restaurant-name">${restaurantName}</span>
              <span class="last-order-date">${lastOrderDate}</span>
            </div>
            <div class="restaurant-stats">
              <div class="stat-row">
                <span class="stat-label">Total Orders:</span>
                <span class="stat-value">${totalOrders}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Last Order Items:</span>
                <span class="stat-value">${recentItems}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    orderHistoryDiv.innerHTML = `
      <h3>Restaurant Order History</h3>
      ${restaurantsHTML}
    `;
  }

  // Load data when popup opens
  loadLast10Restaurants();
});
