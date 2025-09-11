// Stats display utilities for LanchDrap extension
// Handles restaurant stats display and user order history

// Create global namespace for stats display utilities
window.LanchDrapStatsDisplay = (() => {
  // Shared function to render stats component
  function renderStatsComponent(stats, containerId, _title) {
    console.info('LanchDrap: renderStatsComponent called with stats', {
      totalAppearances: stats.totalAppearances,
      lastAppearance: stats.lastAppearance,
      loading: stats.loading,
      apiError: stats.apiError,
      containerId,
    });

    // Add API error indicator if applicable
    const apiErrorIndicator = stats.apiError
      ? '<div class="ld-api-error">⚠️ API temporarily unavailable - showing cached data</div>'
      : '';

    // Use restaurant's color for styling
    const restaurantColor = stats.color || 'rgb(100, 100, 100)'; // Default gray if no color

    const restaurantName = stats.name || stats.id;
    const displayTitle = `📊 ${restaurantName}'s Stats`;

    const statsHTML = `
      <div class="ld-tracking-container" style="
        background: #ffffff;
        border: 1px solid #e9ecef;
        border-left: 4px solid ${restaurantColor};
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        margin: 12px 0;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div class="ld-tracking-header" style="
          background: ${restaurantColor}10;
          padding: 12px 16px;
          border-bottom: 1px solid ${restaurantColor}20;
        ">
          <span class="ld-tracking-title" style="
            color: ${restaurantColor};
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
          ">${displayTitle}</span>
          ${apiErrorIndicator}
        </div>
        <div class="ld-tracking-stats" style="padding: 12px 20px;">
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f1f3f4;
          ">
            <span class="ld-stat-label" style="
              color: #6c757d;
              font-weight: 500;
              font-size: 13px;
            ">Total Appearances:</span>
            <span class="ld-stat-value" style="
              color: ${restaurantColor};
              font-weight: 600;
              font-size: 14px;
            ">${stats.totalAppearances || 0}</span>
          </div>
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f1f3f4;
          ">
            <span class="ld-stat-label" style="
              color: #6c757d;
              font-weight: 500;
              font-size: 13px;
            ">Last Seen:</span>
            <span class="ld-stat-value" style="
              color: ${restaurantColor};
              font-weight: 600;
              font-size: 14px;
            ">${stats.lastAppearance ? window.LanchDrapDOMUtils.formatDateString(stats.lastAppearance) : 'Never'}</span>
          </div>
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f1f3f4;
          ">
            <span class="ld-stat-label" style="
              color: #6c757d;
              font-weight: 500;
              font-size: 13px;
            ">Times Sold Out:</span>
            <span class="ld-stat-value" style="
              color: ${restaurantColor};
              font-weight: 600;
              font-size: 14px;
            ">${stats.totalSoldOuts || 0}</span>
          </div>
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
          ">
            <span class="ld-stat-label" style="
              color: #6c757d;
              font-weight: 500;
              font-size: 13px;
            ">Sold Out Rate:</span>
            <span class="ld-stat-value" style="
              color: ${restaurantColor};
              font-weight: 600;
              font-size: 14px;
            ">${stats.soldOutRate ? `${(stats.soldOutRate * 100).toFixed(1)}%` : '0%'}</span>
          </div>
          ${
            stats.userOrderHistory
              ? `
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-top: 1px solid #f1f3f4;
            margin-top: 8px;
          ">
            <span class="ld-stat-label" style="
              color: #6c757d;
              font-weight: 500;
              font-size: 13px;
            ">Your Orders:</span>
            <span class="ld-stat-value" style="
              color: ${restaurantColor};
              font-weight: 600;
              font-size: 14px;
            ">${stats.userOrderHistory.totalOrders}</span>
          </div>
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
          ">
            <span class="ld-stat-label" style="
              color: #6c757d;
              font-weight: 500;
              font-size: 13px;
            ">Last Order:</span>
            <span class="ld-stat-value" style="
              color: ${restaurantColor};
              font-weight: 600;
              font-size: 14px;
            ">${stats.userOrderHistory.lastOrderDate ? window.LanchDrapDOMUtils.formatDateString(stats.userOrderHistory.lastOrderDate) : 'Never'}</span>
          </div>
          ${
            stats.userOrderHistory.lastOrderItems &&
            stats.userOrderHistory.lastOrderItems.length > 0
              ? `
          <div class="ld-stat-item" style="
            display: flex;
            flex-direction: column;
            padding: 8px 0;
          ">
            <span class="ld-stat-label" style="
              color: #6c757d;
              font-weight: 500;
              font-size: 13px;
              margin-bottom: 4px;
            ">Last Order:</span>
            <div class="ld-stat-value" style="
              color: ${restaurantColor};
              font-weight: 600;
              font-size: 14px;
              line-height: 1.3;
            ">
              ${stats.userOrderHistory.lastOrderItems
                .filter((item) => {
                  // Filter out payment/billing items
                  const name = item.name || item.fullDescription || '';
                  return (
                    !name.toLowerCase().includes('charge to') &&
                    !name.toLowerCase().includes('paying for') &&
                    !name.toLowerCase().includes('organizer') &&
                    !name.toLowerCase().includes('visa') &&
                    !name.toLowerCase().includes('$15.00') &&
                    !name.toLowerCase().includes('-$')
                  );
                })
                .map((item) => item.fullDescription || item.name || 'Unknown Item')
                .join(', ')}
            </div>
          </div>
          `
              : ''
          }
          `
              : ''
          }
        </div>
      </div>
    `;

    // Create container
    const container = document.createElement('div');
    container.id = containerId;
    container.dataset.restaurantId = stats.id || stats.restaurantId;
    container.innerHTML = statsHTML;

    // Add styles
    if (!document.getElementById('lunchdrop-tracking-styles')) {
      const styleLink = document.createElement('link');
      styleLink.id = 'lunchdrop-tracking-styles';
      styleLink.rel = 'stylesheet';
      styleLink.href = chrome.runtime.getURL('content-styles.css');
      document.head.appendChild(styleLink);
    }

    return container;
  }

  // Function to display stats for selected restaurant on daily pages
  async function displaySelectedRestaurantStats(availabilityData) {
    try {
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        return;
      }

      // Find the selected restaurant
      const selectedRestaurant = availabilityData.find((restaurant) => restaurant.isSelected);
      if (!selectedRestaurant) {
        return;
      }

      // Check if stats are already displayed for this restaurant
      const existingStats = document.getElementById('lunchdrop-restaurant-stats');
      if (existingStats) {
        // Check if it's for the same restaurant
        const existingRestaurantId = existingStats.dataset.restaurantId;
        if (existingRestaurantId === selectedRestaurant.id) {
          return; // Already showing stats for this restaurant
        } else {
          // Remove existing stats for different restaurant
          existingStats.remove();
        }
      }

      // Check if stats are currently being processed to prevent race conditions
      if (window.lanchDrapStatsProcessing) {
        return;
      }

      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      // Set processing flag after we've confirmed we can proceed
      window.lanchDrapStatsProcessing = true;
      // Create fallback stats immediately (don't block UI)
      const fallbackStats = {
        name: selectedRestaurant.name,
        id: selectedRestaurant.id,
        color: selectedRestaurant.color,
        timeRange: 'all',
        totalDays: 0,
        totalAppearances: 0,
        appearancesInRange: 0,
        appearanceRate: 0,
        lastAppearance: null,
        firstSeen: null,
        lastUpdated: new Date().toISOString(),
        apiError: false,
        loading: true,
        loadingMessage: 'Loading stats...',
      };

      // Create stats display immediately with fallback data
      const statsContainer = renderStatsComponent(
        fallbackStats,
        'lunchdrop-restaurant-stats',
        'Selected Restaurant Stats'
      );

      // Get user ID for order history
      const userId = await lanchDrapUserIdManager.getUserId();

      // Fetch combined stats with user order history in background and update UI when ready
      const combinedStatsPromise = apiClient.getRestaurantStatsWithUserHistory(
        selectedRestaurant.id,
        userId
      );

      Promise.all([combinedStatsPromise])
        .then(([stats]) => {
          // Use the color from the selected restaurant if the API doesn't have it yet
          if (!stats.color && selectedRestaurant.color) {
            stats.color = selectedRestaurant.color;
          }

          // userOrderHistory is already included in the combined stats response

          console.info('LanchDrap: Received API stats for restaurant', {
            restaurantId: selectedRestaurant.id,
            totalAppearances: stats.totalAppearances,
            lastAppearance: stats.lastAppearance,
            appearances: stats.appearances?.length || 0,
            hasUserOrderHistory: !!stats.userOrderHistory,
            statsObject: stats,
          });

          // Update the stats display with real data
          const updatedContainer = renderStatsComponent(
            stats,
            'lunchdrop-restaurant-stats',
            'Selected Restaurant Stats'
          );

          // Check if the container was actually updated
          const existingContainer = document.getElementById('lunchdrop-restaurant-stats');
          if (existingContainer) {
            existingContainer.replaceWith(updatedContainer);
            console.info('LanchDrap: Replaced existing stats container with updated data');
          } else {
            console.info('LanchDrap: No existing stats container found to replace');
          }

          console.info('LanchDrap: Updated restaurant stats with API data');
        })
        .catch((error) => {
          // Update with error state
          const errorStats = {
            ...fallbackStats,
            apiError: true,
            loading: false,
            errorMessage: 'API temporarily unavailable',
          };
          renderStatsComponent(
            errorStats,
            'lunchdrop-restaurant-stats',
            'Selected Restaurant Stats'
          );
          console.info('LanchDrap: Restaurant stats API failed, showing fallback', error.message);
        })
        .finally(() => {
          // Clear the processing flag
          window.lanchDrapStatsProcessing = false;
        });

      // Insert the stats after the restaurant title element
      let restaurantNameElement = document.querySelector('.text-3xl.font-bold');
      if (!restaurantNameElement) {
        restaurantNameElement = document.querySelector(
          '#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)'
        );
      }

      if (restaurantNameElement) {
        const insertionPoint = restaurantNameElement.parentNode || restaurantNameElement;
        insertionPoint.insertBefore(statsContainer, restaurantNameElement.nextSibling);
      }
    } catch (_error) {
      // Clear the processing flag on error
      window.lanchDrapStatsProcessing = false;
    } finally {
      // Always clear the processing flag
      window.lanchDrapStatsProcessing = false;
    }
  }

  // Function to display restaurant tracking information on detail pages
  async function displayRestaurantTrackingInfo() {
    try {
      // Check if we're on a restaurant detail page by looking for the restaurant name
      // Try multiple selectors to find the restaurant name
      let restaurantNameElement = document.querySelector('.text-3xl.font-bold');
      if (!restaurantNameElement) {
        restaurantNameElement = document.querySelector(
          '#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)'
        );
      }

      if (!restaurantNameElement) {
        return; // Not on a detail page
      }

      const restaurantName = restaurantNameElement.textContent?.trim();
      if (!restaurantName) {
        return;
      }

      // Check if utilities are loaded
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        return;
      }

      // Create API client instance
      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      // Store the restaurant name for future use (extract identifier from URL)
      const urlParts = window.location.pathname.split('/');
      let restaurantId = null;
      let stats = null;

      // Expected URL structure: /app/2025-09-08/eajz7qx8
      // We want the last part (restaurant ID), not the date
      if (urlParts.length >= 4 && urlParts[1] === 'app') {
        restaurantId = urlParts[urlParts.length - 1];

        // Validate that it's not a date (YYYY-MM-DD format)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(restaurantId)) {
          return;
        }

        const localKey = `restaurant_name:${restaurantId}`;
        localStorage.setItem(localKey, restaurantName);

        try {
          // Get user ID for order history
          const userId = await lanchDrapUserIdManager.getUserId();

          // Fetch combined restaurant stats with user order history
          stats = await apiClient.getRestaurantStatsWithUserHistory(restaurantId, userId);

          if (!stats) {
            return;
          }

          // Check if we need to update the restaurant name or menu in backend
          // Only update if we have a real name (not just an ID) and it's different from what's stored
          const needsNameUpdate =
            restaurantName !== restaurantId &&
            restaurantName.length > 3 &&
            stats.name !== restaurantName;

          // Parse menu items from the page
          const menuItems = window.LanchDrapOrderParser
            ? window.LanchDrapOrderParser.parseMenuFromPage()
            : [];
          const needsMenuUpdate = menuItems.length > 0;

          if (needsNameUpdate || needsMenuUpdate) {
            // Update restaurant info in background (don't block UI)
            console.info('LanchDrap: Starting background restaurant update', {
              restaurantId,
              needsNameUpdate,
              needsMenuUpdate,
            });
            apiClient.updateRestaurant(restaurantId, restaurantName, menuItems).catch((error) => {
              console.info('LanchDrap: Background restaurant update failed', error.message);
            });
          }
        } catch (_apiError) {
          // Create fallback stats when API is unavailable
          stats = {
            name: restaurantName,
            id: restaurantId,
            timeRange: 'all',
            totalDays: 0,
            totalAppearances: 0,
            appearancesInRange: 0,
            appearanceRate: 0,
            lastAppearance: null,
            firstSeen: null,
            lastUpdated: new Date().toISOString(),
            apiError: true,
            errorMessage: 'API temporarily unavailable',
          };
        }
      } else {
        return;
      }

      // Check if tracking info is already displayed for this restaurant
      const existingStats = document.getElementById('lunchdrop-restaurant-stats');
      if (existingStats) {
        const existingRestaurantId = existingStats.dataset.restaurantId;
        if (existingRestaurantId === restaurantId) {
          return; // Already showing stats for this restaurant
        } else {
          // Remove existing stats for different restaurant
          existingStats.remove();
        }
      }

      // Check if stats are currently being processed to prevent race conditions
      if (window.lanchDrapStatsProcessing) {
        return;
      }

      // Set processing flag after we've confirmed we can proceed
      window.lanchDrapStatsProcessing = true;

      // Create tracking info display using shared component
      const trackingInfo = renderStatsComponent(
        stats,
        'lunchdrop-restaurant-stats',
        'Restaurant Stats'
      );

      // Insert the tracking info near the restaurant name
      // Try to find a good insertion point near the restaurant name
      const insertionPoint = restaurantNameElement.parentNode || restaurantNameElement;
      insertionPoint.insertBefore(trackingInfo, restaurantNameElement.nextSibling);
    } catch (_error) {
      // Clear the processing flag on error
      window.lanchDrapStatsProcessing = false;
    } finally {
      // Always clear the processing flag
      window.lanchDrapStatsProcessing = false;
    }
  }

  // Return public API
  return {
    renderStatsComponent,
    displaySelectedRestaurantStats,
    displayRestaurantTrackingInfo,
  };
})();
