// Stats display utilities for LanchDrap extension
// Handles restaurant stats display and user order history

// Create global namespace for stats display utilities
window.LanchDrapStatsDisplay = (() => {
  // Request tracking for race condition protection
  let currentStatsRequestId = 0;

  // Utility function to create key elements via centralized KeyManager
  function createKeyElement(keyText, title = 'Click to select key') {
    try {
      if (window.LanchDrapKeyManager?.createKeyElement) {
        return window.LanchDrapKeyManager.createKeyElement(keyText, title);
      }
    } catch (_e) {}
    return '';
  }

  // Utility function to get edit trigger properties
  function getEditTriggerProps(restaurantId, restaurantName) {
    try {
      if (window.LanchDrapKeyManager?.createEditTrigger) {
        return window.LanchDrapKeyManager.createEditTrigger(restaurantId, restaurantName);
      }
    } catch (_e) {}
    return {
      cursor: 'default',
      title: 'Enable keys visibility to edit stats',
      dataRestaurantId: restaurantId,
      dataRestaurantName: restaurantName,
    };
  }

  // Utility function to create proper possessive form
  function createPossessive(name) {
    if (!name) return '';

    // If the name already ends with an apostrophe and 's' (like "Mary's"), don't add anything
    if (name.endsWith("'s") || name.endsWith("'S")) {
      return name;
    }

    // If the name ends with just 's' (like "Tacos"), add an apostrophe
    if (name.endsWith('s') || name.endsWith('S')) {
      return `${name}'`;
    }

    // Otherwise, add apostrophe + s
    return `${name}'s`;
  }

  // Function to create skeleton loading component
  function createSkeletonComponent() {
    const skeletonHTML = `
      <div id="lanchdrap-restaurant-stats-skeleton" class="ld-tracking-container">
        <div class="ld-tracking-header ld-skeleton-header">
          <div class="ld-skeleton-bar" style="height:24px; width:200px; border-radius:12px;"></div>
        </div>
        <div class="ld-tracking-stats">
          <div class="ld-skeleton-row">
            <div class="ld-skeleton-bar" style="width:120px;"></div>
            <div class="ld-skeleton-bar" style="width:60px;"></div>
          </div>
          <div class="ld-skeleton-row">
            <div class="ld-skeleton-bar" style="width:100px;"></div>
            <div class="ld-skeleton-bar" style="width:80px;"></div>
          </div>
          <div class="ld-skeleton-row">
            <div class="ld-skeleton-bar" style="width:140px;"></div>
            <div class="ld-skeleton-bar" style="width:40px;"></div>
          </div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = skeletonHTML;
    return container.firstElementChild;
  }

  // Find a robust insertion anchor for both grid and detail pages
  function findInsertionAnchor() {
    try {
      // Prefer a visible page title when present
      const title = document.querySelector('.text-3xl.font-bold');
      if (title) return { node: title, mode: 'after' };

      // Try a known fallback title location
      const fallbackTitle = document.querySelector(
        '#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)'
      );
      if (fallbackTitle) return { node: fallbackTitle, mode: 'after' };

      // If on grid page, insert before the restaurant grid
      if (window.LanchDrapDOMUtils?.getCachedRestaurantGrid) {
        const grid = window.LanchDrapDOMUtils.getCachedRestaurantGrid();
        if (grid?.parentNode) return { node: grid, mode: 'before' };
      }

      // Fallback: insert after the first heading on the page
      const anyHeading = document.querySelector('h1, h2');
      if (anyHeading) return { node: anyHeading, mode: 'after' };

      // Last resort: insert at top of main content if available
      const main = document.querySelector('main');
      if (main?.firstChild) return { node: main.firstChild, mode: 'before' };

      // Absolute fallback: after #app container start
      const app = document.getElementById('app');
      if (app?.firstChild) return { node: app.firstChild, mode: 'before' };
    } catch (_e) {}
    return null;
  }

  // Function to clear restaurant stats
  function clearRestaurantStats() {
    const existingStats = document.getElementById('lanchdrap-restaurant-stats');
    const existingSkeleton = document.getElementById('lanchdrap-restaurant-stats-skeleton');
    if (existingStats) {
      existingStats.remove();
    }
    if (existingSkeleton) {
      existingSkeleton.remove();
    }
  }

  // Function to show skeleton loading state
  function showSkeletonLoading() {
    // Remove any existing stats or skeleton
    const existingStats = document.getElementById('lanchdrap-restaurant-stats');
    const existingSkeleton = document.getElementById('lanchdrap-restaurant-stats-skeleton');

    if (existingStats) {
      existingStats.remove();
    }
    if (existingSkeleton) {
      existingSkeleton.remove();
    }

    const anchor = findInsertionAnchor();

    if (anchor) {
      const skeleton = createSkeletonComponent();

      if (anchor.mode === 'after' && anchor.node.parentNode) {
        anchor.node.parentNode.insertBefore(skeleton, anchor.node.nextSibling);
      } else if (anchor.mode === 'before' && anchor.node.parentNode) {
        anchor.node.parentNode.insertBefore(skeleton, anchor.node);
      }
    }
  }

  // Function to hide skeleton loading state
  function hideSkeletonLoading() {
    const skeleton = document.getElementById('lanchdrap-restaurant-stats-skeleton');
    if (skeleton) {
      skeleton.remove();
    }
  }

  // Helper function to format dates
  function formatDateString(dateString) {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  }

  // Shared function to render stats component
  function renderStatsComponent(stats, containerId, _title) {
    // Ensure key visibility is initialized before rendering
    if (!window.lanchdrapKonamiInitialized) {
      if (window.LanchDrapKeyManager?.initializeKonamiCode) {
        window.LanchDrapKeyManager.initializeKonamiCode();
      }
      window.lanchdrapKonamiInitialized = true;
    }

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

    // Helper: parse color string (#RRGGBB, #RGB, rgb(), rgba()) to {r,g,b}
    function parseColorToRgb(color) {
      if (!color || typeof color !== 'string') return null;
      const c = color.trim();
      // rgb() or rgba()
      let m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (m) {
        return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
      }
      // #RRGGBB
      m = c.match(/^#([0-9a-fA-F]{6})$/);
      if (m) {
        const intVal = parseInt(m[1], 16);
        return { r: (intVal >> 16) & 255, g: (intVal >> 8) & 255, b: intVal & 255 };
      }
      // #RGB
      m = c.match(/^#([0-9a-fA-F]{3})$/);
      if (m) {
        const rHex = m[1][0];
        const gHex = m[1][1];
        const bHex = m[1][2];
        return {
          r: parseInt(rHex + rHex, 16),
          g: parseInt(gHex + gHex, 16),
          b: parseInt(bHex + bHex, 16),
        };
      }
      return null;
    }

    // Helper: convert color string to HSL for better gradient control
    function colorToHsl(color) {
      const rgbVals = parseColorToRgb(color);
      if (!rgbVals) return { h: 0, s: 0, l: 50 };

      const r = rgbVals.r / 255;
      const g = rgbVals.g / 255;
      const b = rgbVals.b / 255;

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

    // Create gradient colors from restaurant color; also expose via CSS vars
    const hsl = colorToHsl(restaurantColor);
    const gradientStart = `hsl(${hsl.h}, ${Math.min(hsl.s + 10, 80)}%, ${Math.min(hsl.l + 25, 90)}%)`;
    const gradientEnd = `hsl(${hsl.h}, ${Math.max(hsl.s - 5, 20)}%, ${Math.max(hsl.l + 10, 85)}%)`;

    const restaurantName = stats.name || stats.id;
    const displayTitle = `📊 ${createPossessive(restaurantName)} Stats`;

    // Prepare last order items with fallback to recentOrders[0].items
    const userHistory = stats.userOrderHistory || null;
    const fallbackLastItems =
      userHistory?.recentOrders &&
      Array.isArray(userHistory.recentOrders) &&
      userHistory.recentOrders.length > 0
        ? userHistory.recentOrders[0]?.items || []
        : [];
    const lastItems =
      userHistory?.lastOrderItems && userHistory.lastOrderItems.length > 0
        ? userHistory.lastOrderItems
        : fallbackLastItems;
    const lastItemsHtml =
      lastItems && lastItems.length > 0
        ? lastItems
            .map(
              (item) =>
                `<strong>${item.label || 'Unknown Item'}</strong> (${item.quantity || 1})` +
                `${item.options ? `<br>(${item.options})` : ''}`
            )
            .join(', ')
        : 'No items recorded';

    const statsHTML = `
      <div class="ld-tracking-container">
        <div class="ld-tracking-header">
          <span class="ld-tracking-title ld-edit-stats-trigger" data-restaurant-id="${stats.id || 'unknown'}" data-restaurant-name="${(stats.name || '').replace(/"/g, '&quot;')}" title="${getEditTriggerProps(stats.id, stats.name).title}">${displayTitle} ${createKeyElement(`restaurant:${stats.id || 'unknown'}`, 'Click to select restaurant key')}</span>
          ${apiErrorIndicator}
        </div>
        <div class="ld-tracking-stats">
          ${
            stats.ratingSynopsis
              ? `
          <!-- Rating Synopsis Row -->
          <div class="ld-stat-item">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label">Rating</span>
              <span class="ld-stat-value">${stats.ratingSynopsis.summary}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label">Distribution</span>
              <span class="ld-stat-value" style="font-weight:600; font-size:14px;">${stats.ratingSynopsis.distribution}</span>
            </div>
          </div>
          `
              : ''
          }
          <!-- Appearances and Last Seen Row -->
          <div class="ld-stat-item">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label">Total Appearances</span>
              <span class="ld-stat-value">${stats.totalAppearances || 0}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label">Last Seen</span>
              <span class="ld-stat-value" style="font-weight:600; font-size:14px;">${formatDateString(stats.lastAppearance)}</span>
            </div>
          </div>
          
          <!-- Sold Out Stats Row -->
          <div class="ld-stat-item">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label">Times Sold Out</span>
              <span class="ld-stat-value">${stats.totalSoldOuts || 0}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label">Sold Out Rate</span>
              <span class="ld-pill">${stats.soldOutRate ? `${(stats.soldOutRate * 100).toFixed(1)}%` : '0%'}</span>
            </div>
            ${
              stats.numSlotsAvailable !== undefined
                ? `
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;
              gap: 14px;
            ">
              <span class="ld-stat-label" style="font-weight:600;">Slots Available</span>
              <span class="ld-pill">${stats.numSlotsAvailable}</span>
            </div>
            `
                : ''
            }
          </div>
          ${
            stats.userOrderHistory
              ? `
          <div style="
            margin-top: 16px;
            padding-top: 16px;
            border-top: 2px solid var(--ld-border);
          ">
            <div style="
              color: var(--ld-text);
              font-weight: 600;
              font-size: 16px;
              margin-bottom: 12px;
              display: flex;
              flex-direction: column;
              gap: 8px;
              background: var(--ld-text-bg);
              padding: 8px 12px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              border: 1px solid rgba(0, 0, 0, 0.05);
            ">
              <div style="display: flex; align-items: center; gap: 8px;">👤 Your Order History</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                ${createKeyElement(`user_restaurant_history:${stats.userId || 'unknown'}:${stats.id || 'unknown'}`, 'Click to select user history key')}
              </div>
            </div>
            <!-- User Order History Row -->
            <div class="ld-stat-item" style="margin:12px 0;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span class="ld-stat-label">Total Orders</span>
                <span class="ld-stat-value" style="min-width:56px;">${stats.userOrderHistory.totalOrders}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span class="ld-stat-label">Last Order</span>
                <span class="ld-stat-value" style="font-weight:600; font-size:14px;">${formatDateString(stats.userOrderHistory.lastOrderDate)}</span>
              </div>
            </div>
            ${
              lastItems && lastItems.length > 0
                ? `
            <div class="ld-stat-item" style="flex-direction:column;">
              <span class="ld-stat-label" style="display:inline-block; margin-bottom:10px;"><strong>Last Order Items</strong></span>
              <div class="ld-stat-value" style="font-weight:500; font-size:13px; line-height:1.4; border-radius:8px;">
                ${lastItemsHtml}
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
    if (editTrigger) {
      editTrigger.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Check if keys are visible before allowing edit
        const keysVisible = window.LanchDrapKeyManager
          ? window.LanchDrapKeyManager.areKeysVisible()
          : false;
        if (!keysVisible) {
          return;
        }

        let restaurantId = editTrigger.dataset.restaurantId;
        let restaurantName = editTrigger.dataset.restaurantName;

        // Fallbacks if dataset is missing/unknown
        if (!restaurantId || restaurantId === 'unknown') {
          try {
            const context = await window.LanchDrapRestaurantContext.getCurrentRestaurantContext();
            if (context?.id) restaurantId = context.id;
            if (context?.name) restaurantName = restaurantName || context.name;
          } catch (_e) {}

          // Try delivery data as last resort
          try {
            if (typeof window !== 'undefined' && window.app?.dataset?.page) {
              const pageData = JSON.parse(window.app.dataset.page);
              const delivery = pageData?.props?.delivery;
              if (delivery?.restaurant?.id) restaurantId = restaurantId || delivery.restaurant.id;
              if (delivery?.restaurant?.name)
                restaurantName = restaurantName || delivery.restaurant.name;
            }
          } catch (_e) {}
        }

        openEditDialog(restaurantId, restaurantName);
      });
    } else {
    }

    // Add styles
    if (!document.getElementById('lanchdrap-tracking-styles')) {
      const styleLink = document.createElement('link');
      styleLink.id = 'lanchdrap-tracking-styles';
      styleLink.rel = 'stylesheet';
      styleLink.href = chrome.runtime.getURL('styles/content-styles.css');
      document.head.appendChild(styleLink);
    }

    // Wire dynamic color variables and inline gradient background on the stats container
    if (hsl && container) {
      const root = container;
      root.style.setProperty('--ld-restaurant-h', String(Math.round(hsl.h)));
      root.style.setProperty('--ld-restaurant-s', `${Math.round(hsl.s)}%`);
      root.style.setProperty('--ld-restaurant-l', `${Math.round(hsl.l)}%`);

      const trackingContainer = container.querySelector('.ld-tracking-container');
      if (trackingContainer) {
        trackingContainer.style.background = `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`;
      }
    }

    return container;
  }

  // Function to display stats for selected restaurant on daily pages
  async function displaySelectedRestaurantStats(selectedRestaurant) {
    try {
      if (
        typeof window.LanchDrapApiClient === 'undefined' ||
        typeof window.LanchDrapConfig === 'undefined'
      ) {
        console.error('LanchDrap: Stats display - API client or config not available');
        return;
      }

      // Handle single restaurant object

      if (!selectedRestaurant) {
        return;
      }

      // Get restaurant name and logo
      const restaurantName = selectedRestaurant.name || selectedRestaurant.id;
      const restaurantLogo = selectedRestaurant.logo;

      // Show skeleton loading state
      showSkeletonLoading();

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

      // Remove processing flag check to prevent blocking

      // Generate unique request ID for this stats request
      const requestId = ++currentStatsRequestId;
      const currentUrl = window.location.href;
      let statsContainer = null;

      try {
        // Get user ID for order history
        const userId = await window.lanchDrapUserIdManager.getUserId();

        // Get restaurant ID for API call
        const restaurantId = selectedRestaurant.id;

        // API call enabled - restaurant stats endpoint is now available
        // Ensure API client is initialized (was missing before)
        const apiClient = new LanchDrapApiClient.ApiClient(
          LanchDrapConfig.CONFIG.API_BASE_URL,
          LanchDrapConfig.CONFIG.ENDPOINTS
        );
        const stats = await apiClient.getRestaurantStatsWithUserHistory(restaurantId, userId);

        if (!stats || (typeof stats === 'object' && Object.keys(stats).length === 0)) {
          // Use fallback stats if API fails
          const fallbackStats = {
            name: restaurantName,
            id: selectedRestaurant.id,
            color: selectedRestaurant.color,
            logo: restaurantLogo,
            timeRange: 'all',
            totalDays: 0,
            totalAppearances: 0,
            appearancesInRange: 0,
            appearanceRate: 0,
            lastAppearance: null,
            firstSeen: null,
            lastUpdated: new Date().toISOString(),
            apiError: true,
            loading: false,
            apiDisabled: false,
            message: 'Stats API unavailable - showing fallback data',
            numSlotsAvailable: selectedRestaurant.numSlotsAvailable,
          };

          statsContainer = renderStatsComponent(
            fallbackStats,
            'lanchdrap-restaurant-stats',
            'Selected Restaurant Stats'
          );
        } else {
          // Check if this is still the current request
          if (requestId !== currentStatsRequestId) {
            return;
          }

          // Validate that we're still on the same page and restaurant
          if (window.location.href !== currentUrl) {
            return;
          }

          // Use the color from the selected restaurant if the API doesn't have it yet
          if (!stats.color && selectedRestaurant.color) {
            stats.color = selectedRestaurant.color;
          }

          // Add slots available information from the current delivery data
          if (selectedRestaurant.numSlotsAvailable !== undefined) {
            stats.numSlotsAvailable = selectedRestaurant.numSlotsAvailable;
          }

          // Add userId to stats for display
          stats.userId = userId;

          statsContainer = renderStatsComponent(
            stats,
            'lanchdrap-restaurant-stats',
            'Selected Restaurant Stats'
          );
        }
      } catch (error) {
        console.error('LanchDrap: Stats display - API error:', error);
        // Use fallback stats on error
        const fallbackStats = {
          name: restaurantName,
          id: selectedRestaurant.id,
          color: selectedRestaurant.color,
          logo: restaurantLogo,
          timeRange: 'all',
          totalDays: 0,
          totalAppearances: 0,
          appearancesInRange: 0,
          appearanceRate: 0,
          lastAppearance: null,
          firstSeen: null,
          lastUpdated: new Date().toISOString(),
          apiError: true,
          loading: false,
          apiDisabled: false,
          message: 'Stats API error - showing fallback data',
          numSlotsAvailable: selectedRestaurant.numSlotsAvailable,
        };

        statsContainer = renderStatsComponent(
          fallbackStats,
          'lanchdrap-restaurant-stats',
          'Selected Restaurant Stats'
        );
      } finally {
        // Processing flag removed
      }

      if (statsContainer) {
        const existingSkeleton = document.getElementById('lanchdrap-restaurant-stats-skeleton');
        if (existingSkeleton?.parentNode) {
          existingSkeleton.replaceWith(statsContainer);
        } else {
          const anchor = findInsertionAnchor();
          if (anchor?.node?.parentNode) {
            if (anchor.mode === 'after') {
              anchor.node.parentNode.insertBefore(statsContainer, anchor.node.nextSibling);
            } else {
              anchor.node.parentNode.insertBefore(statsContainer, anchor.node);
            }
          }
        }
        if (window.LanchDrapKeyManager?.forceUpdateKeyVisibility) {
          window.LanchDrapKeyManager.forceUpdateKeyVisibility();
        }
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

      const domRestaurantName = restaurantNameElement.textContent?.trim();
      if (!domRestaurantName) {
        return;
      }

      // Check if utilities are loaded
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        return;
      }

      // API client enabled - restaurant stats endpoint is now available
      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      // Get restaurant information using centralized context utility
      const restaurantContext =
        await window.LanchDrapRestaurantContext.getCurrentRestaurantContext();
      const restaurantId = restaurantContext.id;
      const restaurantName = restaurantContext.name;
      const restaurantLogo = restaurantContext.logo;
      let stats = null;

      if (!restaurantId) {
        return; // No restaurant ID available
      }

      // Use restaurant name from context, fallback to DOM if not available
      const finalRestaurantName =
        restaurantName || restaurantNameElement.textContent?.trim() || restaurantId;

      try {
        // Get user ID for order history
        const userId = await window.lanchDrapUserIdManager.getUserId();

        // Generate unique request ID for this stats request
        const requestId = ++currentStatsRequestId;
        const currentUrl = window.location.href;
        const _currentRestaurantId = restaurantId;

        // API call enabled - restaurant stats endpoint is now available
        stats = await apiClient.getRestaurantStatsWithUserHistory(restaurantId, userId);

        if (!stats) {
          return;
        }

        // Check if this is still the current request
        if (requestId !== currentStatsRequestId) {
          return;
        }

        // Validate that we're still on the same page and restaurant
        if (window.location.href !== currentUrl) {
          return;
        }

        // Detail page: no selectedRestaurant context here. Skip color/slots enrichment.

        // Add userId to stats for display
        stats.userId = userId;

        // Detail page: enrich with delivery context (slots available, color) if present
        try {
          if (typeof window !== 'undefined' && window.app && window.app.dataset?.page) {
            const pageData = JSON.parse(window.app.dataset.page);
            const delivery = pageData?.props?.delivery;
            if (delivery && typeof delivery.numSlotsAvailable !== 'undefined') {
              stats.numSlotsAvailable = delivery.numSlotsAvailable;
            }
            // Also use brand color if API didn't include one
            const brandColor = delivery?.restaurant?.brandColor;
            if (!stats.color && brandColor) {
              stats.color = brandColor;
            }
          }
        } catch (_e) {}

        // Check if we need to update the restaurant name or menu in backend
        // Only update if we have a real name (not just an ID) and it's different from what's stored
        // Restaurant updates are now handled through the tracking endpoint
        // No need for separate update calls since menu data comes from delivery data
      } catch (_apiError) {
        // Check if this is still the current request
        if (requestId !== currentStatsRequestId) {
          return;
        }

        // Check if URL changed during the request
        if (window.location.href !== currentUrl) {
          return;
        }

        // Create fallback stats when API is unavailable
        stats = {
          name: finalRestaurantName,
          id: restaurantId,
          logo: restaurantLogo,
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

      // Don't hide skeleton here; replace it seamlessly during insertion

      // Create tracking info display using shared component
      const trackingInfo = renderStatsComponent(
        stats,
        'lanchdrap-restaurant-stats',
        'Restaurant Stats'
      );

      // Insert or replace skeleton in-place
      const existingSkeleton = document.getElementById('lanchdrap-restaurant-stats-skeleton');
      if (existingSkeleton?.parentNode) {
        existingSkeleton.replaceWith(trackingInfo);
      } else {
        // Try to find a good insertion point near the restaurant name
        const insertionPoint = restaurantNameElement.parentNode || restaurantNameElement;
        insertionPoint.insertBefore(trackingInfo, restaurantNameElement.nextSibling);
      }
      if (window.LanchDrapKeyManager?.forceUpdateKeyVisibility) {
        window.LanchDrapKeyManager.forceUpdateKeyVisibility();
      }
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
    // Remove existing dialog if any
    const existingDialog = document.getElementById('lanchdrap-edit-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Create dialog overlay
    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'lanchdrap-edit-dialog';

    // Create dialog content
    const dialogContent = document.createElement('div');
    dialogContent.className = 'ld-edit-content';

    dialogContent.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h2 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">
          Edit ${createPossessive(restaurantName || restaurantId)} Stats
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
            placeholder="2024-01-15&#10;2024-01-20"
          ></textarea>
          <div style="margin-top: 4px; font-size: 12px; color: #666;">
            Enter dates when the restaurant was sold out
          </div>
        </div>

        

        <div class="ld-edit-actions">
          <button 
            type="button" 
            id="cancel-edit" 
            class="ld-btn ld-btn-secondary"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            id="save-edit" 
            class="ld-btn ld-btn-primary"
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
        return;
      }

      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      // Fetch restaurant by ID to prefill appearances/soldout and rating data
      let restaurantData = null;
      try {
        const endpoint = `${apiClient.getEndpoint('RESTAURANTS_GET_BY_ID')}/${restaurantId}`;
        restaurantData = await apiClient.request(endpoint);
      } catch (_e) {}

      // Fallback: try stats endpoint if direct lookup failed or missing fields
      if (!restaurantData || (!restaurantData.appearances && !restaurantData.data?.appearances)) {
        try {
          const params = new URLSearchParams();
          params.append('restaurant', restaurantId);
          const statsEndpoint = `${apiClient.getEndpoint('RESTAURANTS_STATS')}?${params.toString()}`;
          const statsData = await apiClient.request(statsEndpoint);
          // Some endpoints return wrapped `{ data: ... }` and some raw; support both
          restaurantData = statsData?.data || statsData || restaurantData;
        } catch (_e) {}
      }

      const appearancesArray = restaurantData?.appearances || restaurantData?.data?.appearances;
      const soldOutArray = restaurantData?.soldOutDates || restaurantData?.data?.soldOutDates;

      if (appearancesArray) {
        const appearanceDatesTextarea = document.getElementById('appearance-dates');
        const soldoutDatesTextarea = document.getElementById('soldout-dates');

        if (appearanceDatesTextarea) {
          appearanceDatesTextarea.value = appearancesArray.join('\n');
        }

        if (soldoutDatesTextarea) {
          // Handle both cases: soldOutDates exists and is an array, or it's undefined/null
          const soldOutDates = soldOutArray || [];
          soldoutDatesTextarea.value = soldOutDates.join('\n');
        }

        // Load rating data
        if (restaurantData.ratingStats) {
          const totalRatingsInput = document.getElementById('total-ratings');
          const averageRatingInput = document.getElementById('average-rating');
          const rating1Input = document.getElementById('rating-1');
          const rating2Input = document.getElementById('rating-2');
          const rating3Input = document.getElementById('rating-3');
          const rating4Input = document.getElementById('rating-4');

          if (totalRatingsInput) {
            totalRatingsInput.value = restaurantData.ratingStats.totalRatings || 0;
          }
          if (averageRatingInput) {
            averageRatingInput.value = restaurantData.ratingStats.averageRating || 0;
          }
          if (rating1Input) {
            rating1Input.value = restaurantData.ratingStats.ratingDistribution?.[1] || 0;
          }
          if (rating2Input) {
            rating2Input.value = restaurantData.ratingStats.ratingDistribution?.[2] || 0;
          }
          if (rating3Input) {
            rating3Input.value = restaurantData.ratingStats.ratingDistribution?.[3] || 0;
          }
          if (rating4Input) {
            rating4Input.value = restaurantData.ratingStats.ratingDistribution?.[4] || 0;
          }
        }
      }
    } catch (_error) {}
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
      const totalRatingsInput = document.getElementById('total-ratings');
      const averageRatingInput = document.getElementById('average-rating');
      const rating1Input = document.getElementById('rating-1');
      const rating2Input = document.getElementById('rating-2');
      const rating3Input = document.getElementById('rating-3');
      const rating4Input = document.getElementById('rating-4');

      const appearanceDates = appearanceDatesTextarea.value
        .split('\n')
        .map((date) => date.trim())
        .filter((date) => date.length > 0);

      const soldoutDates = soldoutDatesTextarea.value
        .split('\n')
        .map((date) => date.trim())
        .filter((date) => date.length > 0);

      // Collect rating data (optional - fields may not exist in the dialog)
      let ratingData = null;
      if (
        totalRatingsInput &&
        averageRatingInput &&
        rating1Input &&
        rating2Input &&
        rating3Input &&
        rating4Input
      ) {
        ratingData = {
          totalRatings: parseInt(totalRatingsInput.value, 10) || 0,
          averageRating: parseFloat(averageRatingInput.value) || 0,
          ratingDistribution: {
            1: parseInt(rating1Input.value, 10) || 0,
            2: parseInt(rating2Input.value, 10) || 0,
            3: parseInt(rating3Input.value, 10) || 0,
            4: parseInt(rating4Input.value, 10) || 0,
          },
        };
      }

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
        await saveRestaurantData(restaurantId, appearanceDates, soldoutDates, ratingData);
        dialogOverlay.remove();

        // Refresh the stats display
        const statsContainer = document.getElementById('lanchdrap-restaurant-stats');
        if (statsContainer) {
          statsContainer.remove();
        }

        // Trigger a page refresh to reload stats
        if (window.LanchDrapStatsDisplay) {
          // Check if we're on a restaurant detail page or daily page
          if (await window.LanchDrapRestaurantContext?.isRestaurantDetailPage()) {
            await window.LanchDrapStatsDisplay.displayRestaurantTrackingInfo();
          } else if (window.LanchDrapRestaurantContext?.isRestaurantGridPage()) {
            const availabilityData =
              await window.LanchDrapRestaurantScraper.scrapeRestaurantAvailability();
            if (availabilityData && availabilityData.length > 0) {
              await window.LanchDrapStatsDisplay.displaySelectedRestaurantStats(availabilityData);
            }
          }
        }
      } catch (error) {
        const message = error?.message || 'Unknown error';
        alert(`Error saving changes: ${message}`);
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
      }
    });
  }

  // Save restaurant data via API - DISABLED (only tracking endpoint enabled)
  async function saveRestaurantData(restaurantId, appearanceDates, soldoutDates, ratingData) {
    if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
      throw new Error('API client not available');
    }

    const apiClient = new LanchDrapApiClient.ApiClient(
      LanchDrapConfig.CONFIG.API_BASE_URL,
      LanchDrapConfig.CONFIG.ENDPOINTS
    );

    // Update restaurant with new appearance and sold out dates
    await apiClient.updateRestaurantAppearances(restaurantId, appearanceDates, soldoutDates);

    // Update restaurant rating data if provided and endpoint is available
    if (ratingData && typeof apiClient.updateRestaurantRatingData === 'function') {
      await apiClient.updateRestaurantRatingData(restaurantId, ratingData);
    }
  }

  // Return public API
  return {
    renderStatsComponent,
    displaySelectedRestaurantStats,
    displayRestaurantTrackingInfo,
    openEditDialog,
    showSkeletonLoading,
    hideSkeletonLoading,
    clearRestaurantStats,
  };
})();
