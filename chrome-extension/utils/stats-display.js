// Stats display utilities for LanchDrap extension
// Handles restaurant stats display and user order history

// Create global namespace for stats display utilities
window.LanchDrapStatsDisplay = (() => {
  // Request tracking for race condition protection
  let currentStatsRequestId = 0;

  // Konami code detection
  const konamiCode = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'KeyB',
    'KeyA',
    'Enter',
  ];
  let konamiSequence = [];
  let keysVisible = false;

  // Initialize key visibility from localStorage
  function initializeKeyVisibility() {
    const stored = localStorage.getItem('lanchdrap_keys_visible');
    keysVisible = stored === 'true';
  }

  // Toggle key visibility
  function toggleKeyVisibility() {
    keysVisible = !keysVisible;
    localStorage.setItem('lanchdrap_keys_visible', keysVisible.toString());

    // Update all existing key elements
    updateKeyVisibility();

    // Show feedback
    showKonamiFeedback();
  }

  // Update visibility of all key elements
  function updateKeyVisibility() {
    const keyElements = document.querySelectorAll('.ld-key-element');
    keyElements.forEach((element) => {
      element.style.display = keysVisible ? 'inline' : 'none';
    });
  }

  // Show visual feedback for Konami code
  function showKonamiFeedback() {
    // Create or update feedback element
    let feedback = document.getElementById('lanchdrap-konami-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.id = 'lanchdrap-konami-feedback';
      feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 14px;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;
      document.body.appendChild(feedback);
    }

    feedback.textContent = keysVisible ? '🔑 Keys Visible' : '🔒 Keys Hidden';

    // Animate in
    setTimeout(() => {
      feedback.style.transform = 'translateX(0)';
    }, 10);

    // Animate out after 2 seconds
    setTimeout(() => {
      feedback.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }, 2000);
  }

  // Handle Konami code input
  function handleKonamiInput(event) {
    // Reset sequence if too much time has passed
    if (
      konamiSequence.length > 0 &&
      Date.now() - konamiSequence[konamiSequence.length - 1].timestamp > 3000
    ) {
      konamiSequence = [];
    }

    // Add current key to sequence
    konamiSequence.push({
      key: event.code,
      timestamp: Date.now(),
    });

    // Keep only the last 11 keys
    if (konamiSequence.length > konamiCode.length) {
      konamiSequence = konamiSequence.slice(-konamiCode.length);
    }

    // Check if sequence matches Konami code
    if (konamiSequence.length === konamiCode.length) {
      const sequenceKeys = konamiSequence.map((item) => item.key);
      if (sequenceKeys.every((key, index) => key === konamiCode[index])) {
        toggleKeyVisibility();
        konamiSequence = []; // Reset sequence
      }
    }
  }

  // Initialize Konami code detection
  function initializeKonamiCode() {
    initializeKeyVisibility();
    document.addEventListener('keydown', handleKonamiInput);
  }

  // Shared function to render stats component
  function renderStatsComponent(stats, containerId, _title) {
    console.info('LanchDrap: renderStatsComponent called with stats', {
      totalAppearances: stats.totalAppearances,
      lastAppearance: stats.lastAppearance,
      loading: stats.loading,
      apiError: stats.apiError,
      containerId,
      restaurantId: stats.id,
      restaurantName: stats.name,
      url: window.location.href,
    });

    // Add API error indicator if applicable
    const apiErrorIndicator = stats.apiError
      ? `<div class="ld-api-error" style="
          background: rgba(255, 193, 7, 0.2);
          border: 1px solid rgba(255, 193, 7, 0.4);
          color: #856404;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          margin-top: 8px;
          backdrop-filter: blur(5px);
        ">⚠️ API temporarily unavailable - showing cached data</div>`
      : '';

    // Use restaurant's color for styling
    const restaurantColor = stats.color || 'rgb(100, 100, 100)'; // Default gray if no color

    // Helper function to convert RGB to HSL for better gradient control
    function rgbToHsl(rgb) {
      const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return { h: 0, s: 0, l: 50 };

      const r = parseInt(match[1]) / 255;
      const g = parseInt(match[2]) / 255;
      const b = parseInt(match[3]) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s;
      const l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      return { h: h * 360, s: s * 100, l: l * 100 };
    }

    // Create gradient colors from restaurant color - make them more subtle
    const hsl = rgbToHsl(restaurantColor);
    const gradientStart = `hsl(${hsl.h}, ${Math.min(hsl.s + 10, 80)}%, ${Math.min(hsl.l + 25, 90)}%)`;
    const gradientEnd = `hsl(${hsl.h}, ${Math.max(hsl.s - 5, 20)}%, ${Math.max(hsl.l + 10, 85)}%)`;
    const accentColor = `hsl(${hsl.h}, ${Math.min(hsl.s + 20, 90)}%, ${Math.max(hsl.l - 15, 25)}%)`;

    // Determine text color based on background lightness
    const textColor = '#1a1a1a'; // Always use dark text for better readability
    const secondaryTextColor = '#4a4a4a';
    const borderColor = 'rgba(0, 0, 0, 0.1)';
    const textBackgroundColor = 'rgba(255, 255, 255, 0.95)'; // Very high opacity white background for text
    const cardBackgroundColor = 'rgba(255, 255, 255, 0.15)'; // Slightly more opaque card backgrounds

    const restaurantName = stats.name || stats.id;
    const displayTitle = `📊 ${restaurantName}'s Stats`;

    const statsHTML = `
      <div class="ld-tracking-container" style="
        background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%);
        border: 1px solid ${borderColor};
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
        margin: 16px 0;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        backdrop-filter: blur(10px);
        position: relative;
      ">
        <div class="ld-tracking-header" style="
          background: rgba(255, 255, 255, 0.1);
          padding: 16px 20px;
          border-bottom: 1px solid ${borderColor};
          backdrop-filter: blur(5px);
        ">
          <span class="ld-tracking-title ld-edit-stats-trigger" style="
            color: ${textColor};
            font-size: 18px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            background: ${textBackgroundColor};
            padding: 8px 16px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(0, 0, 0, 0.05);
            cursor: pointer;
            transition: all 0.2s ease;
          " data-restaurant-id="${stats.id || 'unknown'}" data-restaurant-name="${(stats.name || '').replace(/"/g, '&quot;')}" title="Click to edit restaurant stats">${displayTitle} <span style="
            font-size: 12px;
            font-weight: 500;
            color: ${secondaryTextColor};
            background: rgba(0, 0, 0, 0.05);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            cursor: pointer;
            user-select: all;
          " title="Click to select restaurant key" class="ld-key-element" style="display: ${keysVisible ? 'inline' : 'none'};">restaurant:${stats.id || 'unknown'}</span></span>
          ${apiErrorIndicator}
        </div>
        <div class="ld-tracking-stats" style="padding: 20px;">
          <!-- Appearances and Last Seen Row -->
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            margin: 8px 0;
            background: ${cardBackgroundColor};
            border-radius: 12px;
            border: 1px solid ${borderColor};
            backdrop-filter: blur(5px);
            transition: all 0.2s ease;
          ">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">Total Appearances</span>
              <span class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 700;
                font-size: 16px;
              background: ${textBackgroundColor};
              padding: 4px 12px;
              border-radius: 20px;
              min-width: 40px;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">${stats.totalAppearances || 0}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">Last Seen</span>
              <span class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 600;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">${stats.lastAppearance ? window.LanchDrapDOMUtils.formatDateString(stats.lastAppearance) : 'Never'}</span>
            </div>
          </div>
          
          <!-- Sold Out Stats Row -->
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            margin: 8px 0;
            background: ${cardBackgroundColor};
            border-radius: 12px;
            border: 1px solid ${borderColor};
            backdrop-filter: blur(5px);
            transition: all 0.2s ease;
          ">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">Times Sold Out</span>
              <span class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 700;
                font-size: 16px;
              background: ${textBackgroundColor};
              padding: 4px 12px;
              border-radius: 20px;
              min-width: 40px;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">${stats.totalSoldOuts || 0}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">Sold Out Rate</span>
              <span class="ld-stat-value" style="
                color: white;
                font-weight: 700;
                font-size: 16px;
                background: linear-gradient(45deg, ${accentColor}, ${restaurantColor});
                padding: 4px 12px;
                border-radius: 20px;
                min-width: 50px;
                text-align: center;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              ">${stats.soldOutRate ? `${(stats.soldOutRate * 100).toFixed(1)}%` : '0%'}</span>
            </div>
          </div>
          ${
            stats.userOrderHistory
              ? `
          <div style="
            margin-top: 16px;
            padding-top: 16px;
            border-top: 2px solid ${borderColor};
          ">
            <div style="
              color: ${textColor};
              font-weight: 600;
              font-size: 16px;
              margin-bottom: 12px;
              display: flex;
              flex-direction: column;
              gap: 8px;
              background: ${textBackgroundColor};
              padding: 8px 12px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              border: 1px solid rgba(0, 0, 0, 0.05);
            ">
              <div style="display: flex; align-items: center; gap: 8px;">👤 Your Order History</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="
                  font-size: 12px;
                  font-weight: 500;
                  color: ${secondaryTextColor};
                  background: rgba(0, 0, 0, 0.05);
                  padding: 2px 6px;
                  border-radius: 4px;
                  font-family: monospace;
                  cursor: pointer;
                  user-select: all;
                " title="Click to select user history key" class="ld-key-element" style="display: ${keysVisible ? 'inline' : 'none'};">user_restaurant_history:${stats.userId || 'unknown'}:${stats.id || 'unknown'}</span>
              </div>
            </div>
            <!-- User Order History Row -->
            <div class="ld-stat-item" style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 16px;
              margin: 8px 0;
              background: ${cardBackgroundColor};
              border-radius: 12px;
              border: 1px solid ${borderColor};
              backdrop-filter: blur(5px);
              transition: all 0.2s ease;
            ">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span class="ld-stat-label" style="
                  color: ${secondaryTextColor};
                  font-weight: 500;
                  font-size: 14px;
              background: ${textBackgroundColor};
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
                ">Total Orders</span>
                <span class="ld-stat-value" style="
                  color: ${textColor};
                  font-weight: 700;
                  font-size: 16px;
              background: ${textBackgroundColor};
              padding: 4px 12px;
              border-radius: 20px;
              min-width: 40px;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              border: 1px solid rgba(0, 0, 0, 0.05);
                ">${stats.userOrderHistory.totalOrders}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span class="ld-stat-label" style="
                  color: ${secondaryTextColor};
                  font-weight: 500;
                  font-size: 14px;
              background: ${textBackgroundColor};
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
                ">Last Order</span>
                <span class="ld-stat-value" style="
                  color: ${textColor};
                  font-weight: 600;
                  font-size: 14px;
              background: ${textBackgroundColor};
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
                ">${stats.userOrderHistory.lastOrderDate ? window.LanchDrapDOMUtils.formatDateString(stats.userOrderHistory.lastOrderDate) : 'Never'}</span>
              </div>
            </div>
            ${
              stats.userOrderHistory.lastOrderItems &&
              stats.userOrderHistory.lastOrderItems.length > 0
                ? `
            <div class="ld-stat-item" style="
              display: flex;
              flex-direction: column;
              padding: 12px 16px;
              margin: 8px 0;
              background: ${cardBackgroundColor};
              border-radius: 12px;
              border: 1px solid ${borderColor};
              backdrop-filter: blur(5px);
              transition: all 0.2s ease;
            ">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
                margin-bottom: 8px;
              background: ${textBackgroundColor};
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
                display: inline-block;
              ">Last Order Items</span>
              <div class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 500;
                font-size: 13px;
                line-height: 1.4;
                background: ${textBackgroundColor};
                padding: 8px 12px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                border: 1px solid rgba(0, 0, 0, 0.05);
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
          </div>
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

    // Add event listener for edit dialog
    const editTrigger = container.querySelector('.ld-edit-stats-trigger');
    console.log('LanchDrap: Edit trigger found:', editTrigger);
    if (editTrigger) {
      console.log('LanchDrap: Adding click event listener to edit trigger');
      editTrigger.addEventListener('click', (e) => {
        console.log('LanchDrap: Edit trigger clicked!');
        e.preventDefault();
        e.stopPropagation();
        const restaurantId = editTrigger.dataset.restaurantId;
        const restaurantName = editTrigger.dataset.restaurantName;
        console.log('LanchDrap: Opening edit dialog for:', { restaurantId, restaurantName });
        openEditDialog(restaurantId, restaurantName);
      });
    } else {
      console.log('LanchDrap: Edit trigger not found in container');
    }

    // Add styles
    if (!document.getElementById('lanchdrap-tracking-styles')) {
      const styleLink = document.createElement('link');
      styleLink.id = 'lanchdrap-tracking-styles';
      styleLink.rel = 'stylesheet';
      styleLink.href = chrome.runtime.getURL('content-styles.css');
      document.head.appendChild(styleLink);
    }

    // Initialize Konami code detection if not already done
    if (!window.lanchdrapKonamiInitialized) {
      initializeKonamiCode();
      window.lanchdrapKonamiInitialized = true;
    }

    return container;
  }

  // Function to display stats for selected restaurant on daily pages
  async function displaySelectedRestaurantStats(availabilityData) {
    console.log('LanchDrap: displaySelectedRestaurantStats called', {
      url: window.location.href,
      availabilityDataLength: availabilityData?.length,
      timestamp: new Date().toISOString(),
    });

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
      const existingStats = document.getElementById('lanchdrap-restaurant-stats');
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
        'lanchdrap-restaurant-stats',
        'Selected Restaurant Stats'
      );

      // Get user ID for order history
      const userId = await lanchDrapUserIdManager.getUserId();

      // Generate unique request ID for this stats request
      const requestId = ++currentStatsRequestId;
      const currentUrl = window.location.href;
      const currentRestaurantId = selectedRestaurant.id;

      console.log('LanchDrap: Starting stats request', {
        requestId,
        restaurantId: selectedRestaurant.id,
        url: currentUrl,
        currentStatsRequestId,
      });

      // Fetch combined stats with user order history in background and update UI when ready
      const combinedStatsPromise = apiClient.getRestaurantStatsWithUserHistory(
        selectedRestaurant.id,
        userId
      );

      Promise.all([combinedStatsPromise])
        .then(([stats]) => {
          console.log('LanchDrap: Stats response received', {
            requestId,
            currentStatsRequestId,
            restaurantId: currentRestaurantId,
            url: window.location.href,
            originalUrl: currentUrl,
          });

          // Check if this is still the current request
          if (requestId !== currentStatsRequestId) {
            console.log(
              'LanchDrap: Stats request is stale, ignoring response',
              'Request ID:',
              requestId,
              'Current Request ID:',
              currentStatsRequestId,
              'Restaurant:',
              currentRestaurantId
            );
            return;
          }

          // Validate that we're still on the same page and restaurant
          if (window.location.href !== currentUrl) {
            console.log(
              'LanchDrap: URL changed during stats request, ignoring response for restaurant:',
              currentRestaurantId,
              'Current URL:',
              window.location.href,
              'Original URL:',
              currentUrl
            );
            return;
          }

          // Use the color from the selected restaurant if the API doesn't have it yet
          if (!stats.color && selectedRestaurant.color) {
            stats.color = selectedRestaurant.color;
          }

          // Add userId to stats for display
          stats.userId = userId;

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
          console.log('LanchDrap: About to render stats component', {
            requestId,
            restaurantId: currentRestaurantId,
            stats: {
              totalAppearances: stats.totalAppearances,
              lastAppearance: stats.lastAppearance,
              name: stats.name,
              id: stats.id,
            },
          });

          const updatedContainer = renderStatsComponent(
            stats,
            'lanchdrap-restaurant-stats',
            'Selected Restaurant Stats'
          );

          // Check if the container was actually updated
          const existingContainer = document.getElementById('lanchdrap-restaurant-stats');
          if (existingContainer) {
            console.log('LanchDrap: Replacing existing stats container', {
              requestId,
              restaurantId: currentRestaurantId,
              existingContainerExists: true,
              newStats: {
                totalAppearances: stats.totalAppearances,
                lastAppearance: stats.lastAppearance,
                name: stats.name,
                id: stats.id,
              },
            });
            existingContainer.replaceWith(updatedContainer);
            console.info('LanchDrap: Replaced existing stats container with updated data');
          } else {
            console.info('LanchDrap: No existing stats container found to replace');
          }

          console.info('LanchDrap: Updated restaurant stats with API data');
        })
        .catch((error) => {
          // Check if this is still the current request
          if (requestId !== currentStatsRequestId) {
            console.log(
              'LanchDrap: Stats request error is stale, ignoring',
              'Request ID:',
              requestId,
              'Current Request ID:',
              currentStatsRequestId,
              'Restaurant:',
              currentRestaurantId
            );
            return;
          }

          // Check if URL changed during the request
          if (window.location.href !== currentUrl) {
            console.log(
              'LanchDrap: URL changed during stats request error, ignoring for restaurant:',
              currentRestaurantId,
              'Current URL:',
              window.location.href,
              'Original URL:',
              currentUrl
            );
            return;
          }

          // Update with error state
          const errorStats = {
            ...fallbackStats,
            apiError: true,
            loading: false,
            errorMessage: 'API temporarily unavailable',
          };
          renderStatsComponent(
            errorStats,
            'lanchdrap-restaurant-stats',
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
    console.log('LanchDrap: displayRestaurantTrackingInfo called', {
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });

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

          // Generate unique request ID for this stats request
          const requestId = ++currentStatsRequestId;
          const currentUrl = window.location.href;
          const currentRestaurantId = restaurantId;

          console.log('LanchDrap: Starting restaurant tracking stats request', {
            requestId,
            restaurantId,
            url: currentUrl,
            currentStatsRequestId,
          });

          // Fetch combined restaurant stats with user order history
          stats = await apiClient.getRestaurantStatsWithUserHistory(restaurantId, userId);

          if (!stats) {
            return;
          }

          // Check if this is still the current request
          if (requestId !== currentStatsRequestId) {
            console.log(
              'LanchDrap: Restaurant tracking stats request is stale, ignoring response',
              'Request ID:',
              requestId,
              'Current Request ID:',
              currentStatsRequestId,
              'Restaurant:',
              currentRestaurantId
            );
            return;
          }

          // Validate that we're still on the same page and restaurant
          if (window.location.href !== currentUrl) {
            console.log(
              'LanchDrap: URL changed during stats request, ignoring response for restaurant:',
              currentRestaurantId,
              'Current URL:',
              window.location.href,
              'Original URL:',
              currentUrl
            );
            return;
          }

          // Add userId to stats for display
          stats.userId = userId;

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
          // Check if this is still the current request
          if (requestId !== currentStatsRequestId) {
            console.log(
              'LanchDrap: Restaurant tracking stats request error is stale, ignoring',
              'Request ID:',
              requestId,
              'Current Request ID:',
              currentStatsRequestId,
              'Restaurant:',
              currentRestaurantId
            );
            return;
          }

          // Check if URL changed during the request
          if (window.location.href !== currentUrl) {
            console.log(
              'LanchDrap: URL changed during stats request error, ignoring for restaurant:',
              currentRestaurantId,
              'Current URL:',
              window.location.href,
              'Original URL:',
              currentUrl
            );
            return;
          }

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
      const existingStats = document.getElementById('lanchdrap-restaurant-stats');
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
        'lanchdrap-restaurant-stats',
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

  // Open edit dialog for restaurant stats
  function openEditDialog(restaurantId, restaurantName) {
    console.log('LanchDrap: Opening edit dialog for restaurant', { restaurantId, restaurantName });

    // Remove existing dialog if any
    const existingDialog = document.getElementById('lanchdrap-edit-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Create dialog overlay
    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'lanchdrap-edit-dialog';
    dialogOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(5px);
    `;

    // Create dialog content
    const dialogContent = document.createElement('div');
    dialogContent.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    dialogContent.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h2 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">
          Edit ${restaurantName || restaurantId} Stats
        </h2>
        <p style="margin: 0; color: #666; font-size: 14px;">
          Edit appearance dates and sold out dates for this restaurant
        </p>
      </div>

      <form id="lanchdrap-edit-form">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
            Appearance Dates (one per line, YYYY-MM-DD format)
          </label>
          <textarea 
            id="appearance-dates" 
            rows="6" 
            style="
              width: 100%;
              padding: 12px;
              border: 2px solid #e1e5e9;
              border-radius: 8px;
              font-family: monospace;
              font-size: 14px;
              resize: vertical;
              box-sizing: border-box;
            "
            placeholder="2024-01-15&#10;2024-01-16&#10;2024-01-17"
          ></textarea>
          <div style="margin-top: 4px; font-size: 12px; color: #666;">
            Enter dates in YYYY-MM-DD format, one per line
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
            Sold Out Dates (one per line, YYYY-MM-DD format)
          </label>
          <textarea 
            id="soldout-dates" 
            rows="4" 
            style="
              width: 100%;
              padding: 12px;
              border: 2px solid #e1e5e9;
              border-radius: 8px;
              font-family: monospace;
              font-size: 14px;
              resize: vertical;
              box-sizing: border-box;
            "
            placeholder="2024-01-15&#10;2024-01-20"
          ></textarea>
          <div style="margin-top: 4px; font-size: 12px; color: #666;">
            Enter dates when the restaurant was sold out
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button 
            type="button" 
            id="cancel-edit" 
            style="
              padding: 10px 20px;
              border: 2px solid #e1e5e9;
              background: white;
              color: #666;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
            "
          >
            Cancel
          </button>
          <button 
            type="submit" 
            id="save-edit" 
            style="
              padding: 10px 20px;
              border: none;
              background: #007AFF;
              color: white;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
            "
          >
            Save Changes
          </button>
        </div>
      </form>
    `;

    dialogOverlay.appendChild(dialogContent);
    document.body.appendChild(dialogOverlay);

    // Load current data
    loadCurrentData(restaurantId);

    // Add event listeners
    setupDialogEventListeners(restaurantId, restaurantName, dialogOverlay);
  }

  // Load current restaurant data into the form
  async function loadCurrentData(restaurantId) {
    try {
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        console.error('LanchDrap: API client not available');
        return;
      }

      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      // Get current restaurant data
      const restaurantData = await apiClient.getRestaurantById(restaurantId);

      if (restaurantData?.appearances) {
        const appearanceDatesTextarea = document.getElementById('appearance-dates');
        const soldoutDatesTextarea = document.getElementById('soldout-dates');

        if (appearanceDatesTextarea) {
          appearanceDatesTextarea.value = restaurantData.appearances.join('\n');
        }

        if (soldoutDatesTextarea && restaurantData.soldOutDates) {
          soldoutDatesTextarea.value = restaurantData.soldOutDates.join('\n');
        }
      }
    } catch (error) {
      console.error('LanchDrap: Error loading current data', error);
    }
  }

  // Setup dialog event listeners
  function setupDialogEventListeners(restaurantId, _restaurantName, dialogOverlay) {
    const form = document.getElementById('lanchdrap-edit-form');
    const cancelButton = document.getElementById('cancel-edit');
    const saveButton = document.getElementById('save-edit');

    // Cancel button
    cancelButton.addEventListener('click', () => {
      dialogOverlay.remove();
    });

    // Close on overlay click
    dialogOverlay.addEventListener('click', (e) => {
      if (e.target === dialogOverlay) {
        dialogOverlay.remove();
      }
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const appearanceDatesTextarea = document.getElementById('appearance-dates');
      const soldoutDatesTextarea = document.getElementById('soldout-dates');

      const appearanceDates = appearanceDatesTextarea.value
        .split('\n')
        .map((date) => date.trim())
        .filter((date) => date.length > 0);

      const soldoutDates = soldoutDatesTextarea.value
        .split('\n')
        .map((date) => date.trim())
        .filter((date) => date.length > 0);

      // Validate dates
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const invalidAppearanceDates = appearanceDates.filter((date) => !dateRegex.test(date));
      const invalidSoldoutDates = soldoutDates.filter((date) => !dateRegex.test(date));

      if (invalidAppearanceDates.length > 0 || invalidSoldoutDates.length > 0) {
        alert('Please enter dates in YYYY-MM-DD format');
        return;
      }

      // Disable save button and show loading
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';

      try {
        await saveRestaurantData(restaurantId, appearanceDates, soldoutDates);
        dialogOverlay.remove();

        // Refresh the stats display
        const statsContainer = document.getElementById('lanchdrap-restaurant-stats');
        if (statsContainer) {
          statsContainer.remove();
        }

        // Trigger a page refresh to reload stats
        if (window.LanchDrapStatsDisplay) {
          // Check if we're on a restaurant detail page or daily page
          if (window.LanchDrapDOMUtils?.isRestaurantDetailPage()) {
            await window.LanchDrapStatsDisplay.displayRestaurantTrackingInfo();
          } else if (window.LanchDrapDOMUtils?.isRestaurantGridPage()) {
            const availabilityData =
              await window.LanchDrapRestaurantScraper.scrapeRestaurantAvailability();
            if (availabilityData && availabilityData.length > 0) {
              await window.LanchDrapStatsDisplay.displaySelectedRestaurantStats(availabilityData);
            }
          }
        }
      } catch (error) {
        console.error('LanchDrap: Error saving restaurant data', error);
        alert('Error saving changes. Please try again.');
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
      }
    });
  }

  // Save restaurant data via API
  async function saveRestaurantData(restaurantId, appearanceDates, soldoutDates) {
    if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
      throw new Error('API client not available');
    }

    const apiClient = new LanchDrapApiClient.ApiClient(
      LanchDrapConfig.CONFIG.API_BASE_URL,
      LanchDrapConfig.CONFIG.ENDPOINTS
    );

    // Update restaurant with new appearance and sold out dates
    await apiClient.updateRestaurantAppearances(restaurantId, appearanceDates, soldoutDates);
  }

  // Return public API
  return {
    renderStatsComponent,
    displaySelectedRestaurantStats,
    displayRestaurantTrackingInfo,
    openEditDialog,
    toggleKeyVisibility,
    initializeKonamiCode,
  };
})();
