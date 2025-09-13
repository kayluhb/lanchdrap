document.addEventListener('DOMContentLoaded', () => {
  const statusDiv = document.getElementById('status');
  const historyDiv = document.getElementById('rating-history');

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = 'status';
    }, 3000);
  }

  async function loadRatingHistory() {
    try {
      // Try to load from server first
      // Ratings endpoint removed - can't fetch ratings from server anymore
      const serverHistory = null;

      if (serverHistory?.ratings) {
        displayRatingHistory(serverHistory.ratings);

        // Also update local storage
        chrome.storage.local.set({ ratingHistory: serverHistory.ratings });
        return;
      }
    } catch (_error) {}

    // Fallback to local storage
    chrome.storage.local.get(['ratingHistory'], (result) => {
      const history = result.ratingHistory || [];
      displayRatingHistory(history);
    });
  }

  function displayRatingHistory(history) {
    if (history.length === 0) {
      historyDiv.innerHTML = '<p class="no-ratings">No ratings yet. Rate your first order!</p>';
      return;
    }

    const historyHTML = history
      .map(
        (rating) => `
            <div class="history-item">
                <div class="history-header">
                    <span class="restaurant">${rating.restaurant}</span>
                    <span class="rating">${'⭐'.repeat(rating.rating)}</span>
                </div>
                <div class="history-details">
                    <span class="items">${rating.items.join(', ')}</span>
                    <span class="total">$${rating.total}</span>
                </div>
                ${rating.comment ? `<div class="comment">"${rating.comment}"</div>` : ''}
                <div class="timestamp">${new Date(rating.timestamp).toLocaleDateString()}</div>
            </div>
        `
      )
      .join('');

    historyDiv.innerHTML = historyHTML;
  }

  // Load restaurant statistics
  async function loadRestaurantStats() {
    try {
      const apiClient = new LunchDropApiClient.ApiClient(
        LunchDropConfig.CONFIG.API_BASE_URL,
        LunchDropConfig.CONFIG.ENDPOINTS
      );

      // Get overall restaurant stats
      const overallStats = await apiClient.getRatingStats({ timeRange: 'all' });

      // Restaurant list endpoint removed - can't fetch restaurant list anymore
      const restaurants = { restaurants: [] };

      if (restaurants?.restaurants) {
        displayRestaurantStats(restaurants.restaurants, overallStats);
      } else if (overallStats?.restaurants) {
        displayRestaurantStats(overallStats.restaurants);
      }
    } catch (_error) {
      document.getElementById('restaurant-stats').innerHTML =
        '<p class="no-stats">Statistics unavailable</p>';
    }
  }

  function displayRestaurantStats(restaurants, _overallStats = null) {
    const statsDiv = document.getElementById('restaurant-stats');

    if (!restaurants || restaurants.length === 0) {
      statsDiv.innerHTML = '<p class="no-stats">No restaurant statistics available</p>';
      return;
    }

    const statsHTML = restaurants
      .map((restaurant) => {
        // Get rating distribution if available
        const ratingDistribution = restaurant.ratingDistribution || {};
        const totalRatings = restaurant.totalRatings || 0;
        const averageRating = restaurant.averageRating || 0;
        const appearanceCount = restaurant.appearanceCount || 0;
        const lastAppearance = restaurant.lastAppearance;
        const selloutCount = restaurant.selloutCount || 0;
        const availabilityStatus = restaurant.availabilityStatus || 'unknown';

        // Calculate sellout percentage
        const selloutPercentage =
          appearanceCount > 0 ? ((selloutCount / appearanceCount) * 100).toFixed(1) : '0.0';

        // Create rating distribution bar
        const ratingBars = [5, 4, 3, 2, 1]
          .map((rating) => {
            const count = ratingDistribution[rating] || 0;
            const percentage = totalRatings > 0 ? ((count / totalRatings) * 100).toFixed(0) : 0;
            return `
            <div class="rating-bar">
              <span class="rating-label">${rating}⭐</span>
              <div class="rating-bar-bg">
                <div class="rating-bar-fill" style="width: ${percentage}%"></div>
              </div>
              <span class="rating-count">${count}</span>
            </div>
          `;
          })
          .join('');

        return `
          <div class="stats-item">
            <div class="stats-header">
              <span class="restaurant-name">${restaurant.name}</span>
              <span class="avg-rating">${averageRating.toFixed(1)}⭐</span>
            </div>
            
            <div class="stats-main">
              <div class="stats-row">
                <span class="stat-label">Total Ratings:</span>
                <span class="stat-value">${totalRatings}</span>
              </div>
              
              <div class="stats-row">
                <span class="stat-label">Times Seen:</span>
                <span class="stat-value">${appearanceCount}</span>
              </div>
              
              <div class="stats-row">
                <span class="stat-label">Times Sold Out:</span>
                <span class="stat-value">${selloutCount}</span>
              </div>
              
              <div class="stats-row">
                <span class="stat-label">Sellout Rate:</span>
                <span class="stat-value ${selloutPercentage > 50 ? 'high-sellout' : 'low-sellout'}">${selloutPercentage}%</span>
              </div>
              
              <div class="stats-row">
                <span class="stat-label">Status:</span>
                <span class="stat-value status-${availabilityStatus}">${availabilityStatus}</span>
              </div>
            </div>

            ${
              totalRatings > 0
                ? `
              <div class="rating-distribution">
                <div class="distribution-title">Rating Distribution</div>
                ${ratingBars}
              </div>
            `
                : ''
            }

            <div class="stats-footer">
              <span class="last-appearance">Last seen: ${lastAppearance ? new Date(lastAppearance).toLocaleDateString() : 'Never'}</span>
            </div>
          </div>
        `;
      })
      .join('');

    statsDiv.innerHTML = statsHTML;
  }

  // Load availability data
  async function loadAvailabilityStats() {
    try {
      const apiClient = new LunchDropApiClient.ApiClient(
        LunchDropConfig.CONFIG.API_BASE_URL,
        LunchDropConfig.CONFIG.ENDPOINTS
      );
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const availability = await apiClient.getDailyAvailability(today);

      if (availability?.restaurants) {
        displayAvailabilityStats(availability.restaurants);
      }
    } catch (_error) {
      document.getElementById('availability-stats').innerHTML =
        '<p class="no-availability">Availability data unavailable</p>';
    }
  }

  function displayAvailabilityStats(restaurants) {
    const availabilityDiv = document.getElementById('availability-stats');

    if (!restaurants || restaurants.length === 0) {
      availabilityDiv.innerHTML = '<p class="no-availability">No availability data for today</p>';
      return;
    }

    const availabilityHTML = restaurants
      .map((restaurant) => {
        const status = restaurant.status || 'unknown';
        const timeSlot = restaurant.timeSlot || 'Unknown';
        const lastSeen = restaurant.timestamp
          ? new Date(restaurant.timestamp).toLocaleTimeString()
          : 'Unknown';

        return `
          <div class="availability-item status-${status}">
            <div class="availability-header">
              <span class="restaurant-name">${restaurant.name}</span>
              <span class="availability-status">${status}</span>
            </div>
            <div class="availability-details">
              <span class="time-slot">${timeSlot}</span>
              <span class="last-seen">Last seen: ${lastSeen}</span>
            </div>
          </div>
        `;
      })
      .join('');

    availabilityDiv.innerHTML = availabilityHTML;
  }

  // Load order history for current restaurant
  async function loadOrderHistory() {
    try {
      // Get current restaurant info from the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on a LunchDrop page
      if (!tab.url.includes('lunchdrop.com')) {
        document.getElementById('order-history').innerHTML =
          '<p class="no-orders">Not on a LunchDrop page</p>';
        return;
      }

      // Get restaurant information from the page
      const restaurantInfo = await getCurrentRestaurantInfo(tab.id);

      if (!restaurantInfo) {
        document.getElementById('order-history').innerHTML =
          '<p class="no-orders">Could not detect current restaurant</p>';
        return;
      }

      // Get user ID
      const userIdentification = await userIdManager.getUserIdentification();

      // Get order history from API
      const apiClient = new LunchDropApiClient.ApiClient(
        LunchDropConfig.CONFIG.API_BASE_URL,
        LunchDropConfig.CONFIG.ENDPOINTS
      );

      const orderHistory = await apiClient.getUserOrderHistory(
        userIdentification.userId,
        restaurantInfo.restaurantId
      );

      displayOrderHistory(orderHistory, restaurantInfo.restaurantName);
    } catch (error) {
      console.error('Error loading order history:', error);
      document.getElementById('order-history').innerHTML =
        '<p class="no-orders">Error loading order history</p>';
    }
  }

  async function getCurrentRestaurantInfo(tabId) {
    try {
      // Send message to content script to get restaurant info
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'getRestaurantInfo',
      });
      return response;
    } catch (error) {
      console.error('Error getting restaurant info:', error);
      return null;
    }
  }

  function displayOrderHistory(orderHistory, restaurantName) {
    const orderHistoryDiv = document.getElementById('order-history');

    if (!orderHistory || orderHistory.length === 0) {
      orderHistoryDiv.innerHTML = `<p class="no-orders">No order history found for ${restaurantName}</p>`;
      return;
    }

    const orderHistoryHTML = orderHistory
      .map((order) => {
        const orderDate = new Date(order.orderDate).toLocaleDateString();
        const orderTime = new Date(order.orderDate).toLocaleTimeString();
        const total = order.total || 'Unknown';
        const items = order.items || [];

        // Format items list
        const itemsList =
          items.length > 0
            ? items.map((item) => item.name || item.fullDescription || 'Unknown Item').join(', ')
            : 'No items recorded';

        return `
          <div class="order-history-item">
            <div class="order-header">
              <span class="order-date">${orderDate}</span>
              <span class="order-time">${orderTime}</span>
              <span class="order-total">$${total}</span>
            </div>
            <div class="order-items">
              <span class="items-label">Items:</span>
              <span class="items-list">${itemsList}</span>
            </div>
            ${
              order.rating
                ? `
              <div class="order-rating">
                <span class="rating-label">Your Rating:</span>
                <span class="rating-stars">${'⭐'.repeat(order.rating)}</span>
              </div>
            `
                : ''
            }
            ${
              order.comment
                ? `
              <div class="order-comment">
                <span class="comment-label">Comment:</span>
                <span class="comment-text">"${order.comment}"</span>
              </div>
            `
                : ''
            }
          </div>
        `;
      })
      .join('');

    orderHistoryDiv.innerHTML = orderHistoryHTML;
  }

  // Load data when popup opens
  loadRatingHistory();
  loadRestaurantStats();
  loadAvailabilityStats();
  loadOrderHistory();
});
