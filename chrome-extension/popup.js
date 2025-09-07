document.addEventListener('DOMContentLoaded', () => {
  let currentRating = 0;
  const stars = document.querySelectorAll('.star');
  const ratingDisplay = document.getElementById('current-rating');
  const commentInput = document.getElementById('comment');
  const submitButton = document.getElementById('submit-rating');
  const statusDiv = document.getElementById('status');
  const historyDiv = document.getElementById('rating-history');

  // Star rating functionality
  stars.forEach((star) => {
    star.addEventListener('click', function () {
      const rating = parseInt(this.dataset.rating);
      currentRating = rating;
      updateStarDisplay();
      ratingDisplay.textContent = rating;
    });

    star.addEventListener('mouseenter', function () {
      const rating = parseInt(this.dataset.rating);
      highlightStars(rating);
    });

    star.addEventListener('mouseleave', () => {
      updateStarDisplay();
    });
  });

  function updateStarDisplay() {
    stars.forEach((star, index) => {
      if (index < currentRating) {
        star.style.color = '#ffd700';
        star.style.transform = 'scale(1.1)';
      } else {
        star.style.color = '#ccc';
        star.style.transform = 'scale(1)';
      }
    });
  }

  function highlightStars(rating) {
    stars.forEach((star, index) => {
      if (index < rating) {
        star.style.color = '#ffd700';
        star.style.transform = 'scale(1.1)';
      }
    });
  }

  // Submit rating
  submitButton.addEventListener('click', async () => {
    if (currentRating === 0) {
      showStatus('Please select a rating first!', 'error');
      return;
    }

    const comment = commentInput.value.trim();
    const orderData = await getCurrentOrderData();

    if (!orderData) {
      showStatus('Could not detect current order. Please refresh the page.', 'error');
      return;
    }

    try {
      const ratingData = {
        orderId: orderData.orderId,
        restaurant: orderData.restaurant,
        items: orderData.items,
        rating: currentRating,
        comment: comment,
        timestamp: new Date().toISOString(),
        orderTotal: orderData.total,
      };

      // Save to local storage
      saveRatingToHistory(ratingData);

      // Send to Cloudflare Worker
      await sendRatingToServer(ratingData);

      showStatus('Rating submitted successfully!', 'success');
      resetForm();
      loadRatingHistory();
    } catch (error) {
      console.error('Error submitting rating:', error);
      showStatus('Error submitting rating. Please try again.', 'error');
    }
  });

  async function getCurrentOrderData() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getOrderData' });
      return response;
    } catch (error) {
      console.error('Error getting order data:', error);
      return null;
    }
  }

  async function sendRatingToServer(ratingData) {
    try {
      // Get user identification
      const userIdentification = await userIdManager.getUserIdentification();

      // Add user ID to rating data
      const ratingDataWithUser = {
        ...ratingData,
        userId: userIdentification.userId,
        userFingerprint: userIdentification.fingerprint,
      };

      // Use API client to submit rating
      const apiClient = new LunchDropApiClient.ApiClient(LunchDropConfig.CONFIG.API_BASE_URL);
      return await apiClient.submitRating(ratingDataWithUser);
    } catch (error) {
      console.error('Error sending rating to server:', error);
      throw new Error('Failed to send rating to server');
    }
  }

  function saveRatingToHistory(ratingData) {
    chrome.storage.local.get(['ratingHistory'], (result) => {
      const history = result.ratingHistory || [];
      history.unshift(ratingData);

      // Keep only last 50 ratings
      if (history.length > 50) {
        history.splice(50);
      }

      chrome.storage.local.set({ ratingHistory: history });
    });
  }

  function resetForm() {
    currentRating = 0;
    commentInput.value = '';
    updateStarDisplay();
    ratingDisplay.textContent = '0';
  }

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
      const apiClient = new LunchDropApiClient.ApiClient(LunchDropConfig.CONFIG.API_BASE_URL);
      // Ratings endpoint removed - can't fetch ratings from server anymore
      const serverHistory = null;

      if (serverHistory && serverHistory.ratings) {
        displayRatingHistory(serverHistory.ratings);

        // Also update local storage
        chrome.storage.local.set({ ratingHistory: serverHistory.ratings });
        return;
      }
    } catch (error) {
      console.log('Could not load from server, using local storage:', error);
    }

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
      const apiClient = new LunchDropApiClient.ApiClient(LunchDropConfig.CONFIG.API_BASE_URL);

      // Get overall restaurant stats
      const overallStats = await apiClient.getRatingStats({ timeRange: 'all' });

      // Restaurant list endpoint removed - can't fetch restaurant list anymore
      const restaurants = { restaurants: [] };

      if (restaurants && restaurants.restaurants) {
        displayRestaurantStats(restaurants.restaurants, overallStats);
      } else if (overallStats && overallStats.restaurants) {
        displayRestaurantStats(overallStats.restaurants);
      }
    } catch (error) {
      console.log('Could not load restaurant stats:', error);
      document.getElementById('restaurant-stats').innerHTML =
        '<p class="no-stats">Statistics unavailable</p>';
    }
  }

  function displayRestaurantStats(restaurants, overallStats = null) {
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
      const apiClient = new LunchDropApiClient.ApiClient(LunchDropConfig.CONFIG.API_BASE_URL);
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const availability = await apiClient.getDailyAvailability(today);

      if (availability && availability.restaurants) {
        displayAvailabilityStats(availability.restaurants);
      }
    } catch (error) {
      console.log('Could not load availability stats:', error);
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

  // Load data when popup opens
  loadRatingHistory();
  loadRestaurantStats();
  loadAvailabilityStats();
});
