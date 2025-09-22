// Stats display utilities for LanchDrap extension
// Handles restaurant stats display and user order history

// Create global namespace for stats display utilities
window.LanchDrapStatsDisplay = (() => {
  // Request tracking for race condition protection
  let currentStatsRequestId = 0;

  // Utility function to create key elements with consistent styling
  function createKeyElement(keyText, title = 'Click to select key') {
    const keysVisible = window.LanchDrapKeyManager
      ? window.LanchDrapKeyManager.areKeysVisible()
      : false;
    return `
      <span style="
        font-size: 12px;
        font-weight: 500;
        color: #4a4a4a;
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        cursor: pointer;
        user-select: all;
        display: ${keysVisible ? 'inline' : 'none'};
      " title="${title}" class="ld-key-element">${keyText}</span>
    `;
  }

  // Utility function to get edit trigger properties
  function getEditTriggerProps(restaurantId, restaurantName) {
    const keysVisible = window.LanchDrapKeyManager
      ? window.LanchDrapKeyManager.areKeysVisible()
      : false;
    return {
      cursor: keysVisible ? 'pointer' : 'default',
      title: keysVisible
        ? 'Click to edit restaurant stats'
        : 'Enable keys visibility to edit stats',
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

    // Default to false (hidden) if no stored value exists
    keysVisible = stored === 'true';

    // If this is the first time, ensure keys start hidden
    if (stored === null) {
      keysVisible = false;
      localStorage.setItem('lanchdrap_keys_visible', 'false');
    }
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
      const newDisplay = keysVisible ? 'inline' : 'none';
      element.style.display = newDisplay;
    });

    // Also update edit triggers cursor and title
    const editTriggers = document.querySelectorAll('.ld-edit-stats-trigger');
    editTriggers.forEach((trigger) => {
      trigger.style.cursor = keysVisible ? 'pointer' : 'default';
      trigger.title = keysVisible
        ? 'Click to edit restaurant stats'
        : 'Enable keys visibility to edit stats';
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

  // Function to create skeleton loading component
  function createSkeletonComponent() {
    const skeletonHTML = `
      <div id="lanchdrap-restaurant-stats-skeleton" class="ld-tracking-container" style="
        background: linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
        margin: 16px 0;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        backdrop-filter: blur(10px);
        position: relative;
        animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
      ">
        <div class="ld-tracking-header" style="
          background: rgba(255, 255, 255, 0.1);
          padding: 16px 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(5px);
        ">
          <div style="
            background: #d0d0d0;
            height: 24px;
            width: 200px;
            border-radius: 12px;
            animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
          "></div>
        </div>
        <div class="ld-tracking-stats" style="padding: 20px;">
          <!-- Skeleton stat items -->
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            margin: 8px 0;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.05);
          ">
            <div style="
              background: #d0d0d0;
              height: 16px;
              width: 120px;
              border-radius: 8px;
              animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
            "></div>
            <div style="
              background: #d0d0d0;
              height: 16px;
              width: 60px;
              border-radius: 8px;
              animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
            "></div>
          </div>
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            margin: 8px 0;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.05);
          ">
            <div style="
              background: #d0d0d0;
              height: 16px;
              width: 100px;
              border-radius: 8px;
              animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
            "></div>
            <div style="
              background: #d0d0d0;
              height: 16px;
              width: 80px;
              border-radius: 8px;
              animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
            "></div>
          </div>
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            margin: 8px 0;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.05);
          ">
            <div style="
              background: #d0d0d0;
              height: 16px;
              width: 140px;
              border-radius: 8px;
              animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
            "></div>
            <div style="
              background: #d0d0d0;
              height: 16px;
              width: 40px;
              border-radius: 8px;
              animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
            "></div>
          </div>
        </div>
      </div>
      <style>
        @keyframes skeleton-pulse {
          0% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      </style>
    `;

    const container = document.createElement('div');
    container.innerHTML = skeletonHTML;
    return container.firstElementChild;
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

    // Find the insertion point using the same logic as displaySelectedRestaurantStats
    let restaurantNameElement = document.querySelector('.text-3xl.font-bold');
    if (!restaurantNameElement) {
      restaurantNameElement = document.querySelector(
        '#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)'
      );
    }

    if (restaurantNameElement) {
      const skeleton = createSkeletonComponent();
      const insertionPoint = restaurantNameElement.parentNode || restaurantNameElement;
      insertionPoint.insertBefore(skeleton, restaurantNameElement.nextSibling);
    } else {
    }
  }

  // Function to hide skeleton loading state
  function hideSkeletonLoading() {
    const skeleton = document.getElementById('lanchdrap-restaurant-stats-skeleton');
    if (skeleton) {
      skeleton.remove();
    }
  }

  // Shared function to render stats component
  function renderStatsComponent(stats, containerId, _title) {
    // Ensure key visibility is initialized before rendering
    if (!window.lanchdrapKonamiInitialized) {
      // Use centralized key manager if available, otherwise fallback to local implementation
      if (window.LanchDrapKeyManager) {
        window.LanchDrapKeyManager.initializeKonamiCode();
      } else {
        initializeKonamiCode();
      }
      window.lanchdrapKonamiInitialized = true;
    } else {
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

    // Create gradient colors from restaurant color - make them more subtle
    const hsl = colorToHsl(restaurantColor);
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
                `<strong>${item.name || item.fullDescription || 'Unknown Item'}</strong> (${item.quantity || 1})` +
                `${item.options ? `<br>(${item.options})` : ''}`
            )
            .join(', ')
        : 'No items recorded';

    const statsHTML = `
      <div class="ld-tracking-container" style="
        background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%);
        border: 1px solid ${borderColor};
        border-radius: 20px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
        margin: 24px 0;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        backdrop-filter: blur(10px);
        position: relative;
      ">
        <div class="ld-tracking-header" style="
          background: rgba(255, 255, 255, 0.1);
          padding: 20px 24px;
          border-bottom: 1px solid ${borderColor};
          backdrop-filter: blur(5px);
        ">
          <span class="ld-tracking-title ld-edit-stats-trigger" style="
            color: ${textColor};
            font-size: 20px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            background: ${textBackgroundColor};
            padding: 10px 18px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(0, 0, 0, 0.05);
            cursor: ${getEditTriggerProps(stats.id, stats.name).cursor};
            transition: all 0.2s ease;
          " data-restaurant-id="${stats.id || 'unknown'}" data-restaurant-name="${(stats.name || '').replace(/"/g, '&quot;')}" title="${getEditTriggerProps(stats.id, stats.name).title}">${displayTitle}             ${createKeyElement(`restaurant:${stats.id || 'unknown'}`, 'Click to select restaurant key')}</span>
          ${apiErrorIndicator}
        </div>
        <div class="ld-tracking-stats" style="padding: 24px;">
          ${
            stats.ratingSynopsis
              ? `
          <!-- Rating Synopsis Row -->
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
            padding: 14px 20px;
            margin: 16px 0;
            background: ${cardBackgroundColor};
            border-radius: 12px;
            border: 1px solid ${borderColor};
            backdrop-filter: blur(5px);
            transition: all 0.2s ease;
          ">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
                background: ${textBackgroundColor};
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid rgba(0, 0, 0, 0.05);
              ">Rating</span>
              <span class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 700;
                font-size: 16px;
                background: ${textBackgroundColor};
                padding: 6px 14px;
                border-radius: 20px;
                min-width: 72px;
                text-align: center;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                border: 1px solid rgba(0, 0, 0, 0.05);
              ">${stats.ratingSynopsis.summary}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
                background: ${textBackgroundColor};
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid rgba(0, 0, 0, 0.05);
              ">Distribution</span>
              <span class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 600;
                font-size: 14px;
                background: ${textBackgroundColor};
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid rgba(0, 0, 0, 0.05);
              ">${stats.ratingSynopsis.distribution}</span>
            </div>
          </div>
          `
              : ''
          }
          <!-- Appearances and Last Seen Row -->
          <div class="ld-stat-item" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
            padding: 14px 20px;
            margin: 16px 0;
            background: ${cardBackgroundColor};
            border-radius: 12px;
            border: 1px solid ${borderColor};
            backdrop-filter: blur(5px);
            transition: all 0.2s ease;
          ">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">Total Appearances</span>
              <span class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 700;
                font-size: 16px;
              background: ${textBackgroundColor};
              padding: 6px 14px;
              border-radius: 20px;
              min-width: 72px;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">${stats.totalAppearances || 0}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">Last Seen</span>
              <span class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 600;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 6px 10px;
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
            gap: 16px;
            flex-wrap: wrap;
            padding: 14px 20px;
            margin: 16px 0;
            background: ${cardBackgroundColor};
            border-radius: 12px;
            border: 1px solid ${borderColor};
            backdrop-filter: blur(5px);
            transition: all 0.2s ease;
          ">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">Times Sold Out</span>
              <span class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 700;
                font-size: 16px;
              background: ${textBackgroundColor};
              padding: 6px 14px;
              border-radius: 20px;
              min-width: 72px;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">${stats.totalSoldOuts || 0}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="ld-stat-label" style="
                color: ${secondaryTextColor};
                font-weight: 500;
                font-size: 14px;
              background: ${textBackgroundColor};
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
              ">Sold Out Rate</span>
              <span class="ld-stat-value" style="
                color: white;
                font-weight: 700;
                font-size: 16px;
                background: linear-gradient(45deg, ${accentColor}, ${restaurantColor});
                padding: 6px 14px;
                border-radius: 20px;
                min-width: 80px;
                text-align: center;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              ">${stats.soldOutRate ? `${(stats.soldOutRate * 100).toFixed(1)}%` : '0%'}</span>
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
              <span style="
                color: ${textColor};
                font-weight: 600;
                font-size: 14px;
                background: ${textBackgroundColor};
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid rgba(0, 0, 0, 0.05);
              ">Slots Available</span>
              <span class="ld-stat-value" style="
                color: white;
                font-weight: 700;
                font-size: 16px;
                background: linear-gradient(45deg, ${accentColor}, ${restaurantColor});
                padding: 6px 14px;
                border-radius: 20px;
                min-width: 72px;
                text-align: center;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              ">${stats.numSlotsAvailable}</span>
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
                ${createKeyElement(`user_restaurant_history:${stats.userId || 'unknown'}:${stats.id || 'unknown'}`, 'Click to select user history key')}
              </div>
            </div>
            <!-- User Order History Row -->
            <div class="ld-stat-item" style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 14px 20px;
              margin: 12px 0;
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
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
                ">Total Orders</span>
                <span class="ld-stat-value" style="
                  color: ${textColor};
                  font-weight: 700;
                  font-size: 16px;
              background: ${textBackgroundColor};
              padding: 6px 14px;
              border-radius: 20px;
                  min-width: 56px;
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
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
                ">Last Order</span>
                <span class="ld-stat-value" style="
                  color: ${textColor};
                  font-weight: 600;
                  font-size: 14px;
              background: ${textBackgroundColor};
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
                ">${stats.userOrderHistory.lastOrderDate ? window.LanchDrapDOMUtils.formatDateString(stats.userOrderHistory.lastOrderDate) : 'Never'}</span>
              </div>
            </div>
            ${
              lastItems && lastItems.length > 0
                ? `
            <div class="ld-stat-item" style="
              display: flex;
              flex-direction: column;
              padding: 14px 20px;
              margin: 12px 0;
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
                margin-bottom: 10px;
              background: ${textBackgroundColor};
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid rgba(0, 0, 0, 0.05);
              border: 1px solid rgba(0, 0, 0, 0.05);
                display: inline-block;
              "><strong>Last Order Items</strong></span>
              <div class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 500;
                font-size: 13px;
                line-height: 1.4;
                background: ${textBackgroundColor};
                padding: 10px 14px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                border: 1px solid rgba(0, 0, 0, 0.05);
              ">
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
      styleLink.href = chrome.runtime.getURL('content-styles.css');
      document.head.appendChild(styleLink);
    }

    return container;
  }

  // Function to display stats for selected restaurant on daily pages
  async function displaySelectedRestaurantStats(availabilityData) {
    try {
      console.log(
        'LanchDrap: displaySelectedRestaurantStats called with availabilityData:',
        availabilityData
      );

      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        console.log('LanchDrap: Stats display - API client or config not available');
        return;
      }

      // Validate that the availability data matches the current URL date
      if (availabilityData && availabilityData.length > 0) {
        const currentUrlDate = window.LanchDrapDOMUtils.extractDateFromUrl();
        const dataUrlDate = availabilityData[0]?.urlDate;

        if (currentUrlDate && dataUrlDate && currentUrlDate !== dataUrlDate) {
          return;
        }
      }

      // Find the selected restaurant first
      let selectedRestaurant = availabilityData.find((restaurant) => restaurant.isSelected);

      // If no selected restaurant found and NOT on grid, try using restaurant context ID (detail pages)
      if (!selectedRestaurant) {
        const onGrid =
          typeof window.LanchDrapDOMUtils?.isRestaurantGridPage === 'function' &&
          window.LanchDrapDOMUtils.isRestaurantGridPage();
        if (!onGrid) {
          const restaurantContext =
            await window.LanchDrapRestaurantContext.getCurrentRestaurantContext();
          if (restaurantContext.id) {
            selectedRestaurant = availabilityData.find(
              (restaurant) => restaurant.id === restaurantContext.id
            );
          }
        }
      }

      if (!selectedRestaurant) {
        console.log(
          'LanchDrap: Stats display - no selected restaurant found in availability data, returning'
        );
        return;
      }

      console.log(
        'LanchDrap: Stats display - selected restaurant found, proceeding with stats display'
      );

      // Get restaurant name and logo
      const restaurantName = selectedRestaurant.name || selectedRestaurant.id;
      const restaurantLogo = selectedRestaurant.logo;

      console.log('LanchDrap: Stats display - got restaurant name and logo:', {
        restaurantName,
        restaurantLogo,
      });

      // Hide skeleton loading state if it exists
      hideSkeletonLoading();

      console.log('LanchDrap: Stats display - called hideSkeletonLoading');

      // Check if stats are already displayed for this restaurant
      const existingStats = document.getElementById('lanchdrap-restaurant-stats');
      console.log('LanchDrap: Stats display - checking for existing stats:', existingStats);
      if (existingStats) {
        // Check if it's for the same restaurant
        const existingRestaurantId = existingStats.dataset.restaurantId;
        console.log(
          'LanchDrap: Stats display - existing restaurant ID:',
          existingRestaurantId,
          'current restaurant ID:',
          selectedRestaurant.id
        );
        if (existingRestaurantId === selectedRestaurant.id) {
          console.log(
            'LanchDrap: Stats display - already showing stats for this restaurant, returning'
          );
          return; // Already showing stats for this restaurant
        } else {
          console.log(
            'LanchDrap: Stats display - removing existing stats for different restaurant'
          );
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
        console.log(
          'LanchDrap: Stats display - calling API with restaurantId:',
          restaurantId,
          'userId:',
          userId
        );
        console.log('LanchDrap: Stats display - about to call API...');
        // Ensure API client is initialized (was missing before)
        const apiClient = new LanchDrapApiClient.ApiClient(
          LanchDrapConfig.CONFIG.API_BASE_URL,
          LanchDrapConfig.CONFIG.ENDPOINTS
        );
        const stats = await apiClient.getRestaurantStatsWithUserHistory(restaurantId, userId);
        console.log('LanchDrap: Stats display - API call completed, response:', stats);
        console.log('LanchDrap: Stats display - API response type:', typeof stats);
        console.log('LanchDrap: Stats display - API response is null check:', stats === null);
        console.log(
          'LanchDrap: Stats display - API response is undefined check:',
          stats === undefined
        );
        console.log(
          'LanchDrap: Stats display - API response keys:',
          stats ? Object.keys(stats) : 'null'
        );
        console.log('LanchDrap: Stats display - API response success check:', !!stats);
        console.log(
          'LanchDrap: Stats display - API response truthy check:',
          stats ? 'truthy' : 'falsy'
        );
        console.log('LanchDrap: Stats display - About to check if (!stats), stats value:', stats);
        console.log('LanchDrap: Stats display - !stats evaluation:', !stats);

        // Check if stats is an empty object
        if (stats && typeof stats === 'object') {
          console.log(
            'LanchDrap: Stats display - stats is object, checking if empty:',
            Object.keys(stats).length === 0
          );
          console.log('LanchDrap: Stats display - stats object keys:', Object.keys(stats));
        }

        if (!stats) {
          console.log('LanchDrap: Stats display - no stats returned from API, using fallback');
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

          console.log(
            'LanchDrap: Stats display - rendering fallback stats component with data:',
            fallbackStats
          );
          statsContainer = renderStatsComponent(
            fallbackStats,
            'lanchdrap-restaurant-stats',
            'Selected Restaurant Stats'
          );
          console.log(
            'LanchDrap: Stats display - fallback stats container created:',
            statsContainer
          );
        } else {
          console.log(
            'LanchDrap: Stats display - API response is truthy, proceeding with stats rendering'
          );
          // Check if this is still the current request
          if (requestId !== currentStatsRequestId) {
            console.log('LanchDrap: Stats display - request ID mismatch, returning');
            return;
          }

          // Validate that we're still on the same page and restaurant
          if (window.location.href !== currentUrl) {
            console.log('LanchDrap: Stats display - URL changed during request, returning');
            console.log('LanchDrap: Stats display - current URL:', window.location.href);
            console.log('LanchDrap: Stats display - original URL:', currentUrl);
            return;
          }

          // Use the color from the selected restaurant if the API doesn't have it yet
          if (!stats.color && selectedRestaurant.color) {
            console.log(
              'LanchDrap: Stats display - using restaurant color from selected restaurant:',
              selectedRestaurant.color
            );
            stats.color = selectedRestaurant.color;
          }

          // Add slots available information from the current delivery data
          if (selectedRestaurant.numSlotsAvailable !== undefined) {
            console.log(
              'LanchDrap: Stats display - adding slots available:',
              selectedRestaurant.numSlotsAvailable
            );
            stats.numSlotsAvailable = selectedRestaurant.numSlotsAvailable;
          }

          // Add userId to stats for display
          stats.userId = userId;

          console.log('LanchDrap: Stats display - rendering stats component with data:', stats);
          statsContainer = renderStatsComponent(
            stats,
            'lanchdrap-restaurant-stats',
            'Selected Restaurant Stats'
          );
          console.log('LanchDrap: Stats display - stats container created:', statsContainer);
        }
      } catch (error) {
        console.log('LanchDrap: Stats display - API error:', error);
        console.log('LanchDrap: Stats display - API error message:', error.message);
        console.log('LanchDrap: Stats display - API error stack:', error.stack);
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

        console.log(
          'LanchDrap: Stats display - rendering error fallback stats component with data:',
          fallbackStats
        );
        statsContainer = renderStatsComponent(
          fallbackStats,
          'lanchdrap-restaurant-stats',
          'Selected Restaurant Stats'
        );
        console.log(
          'LanchDrap: Stats display - error fallback stats container created:',
          statsContainer
        );
      } finally {
        // Processing flag removed
      }

      // Insert the stats after the restaurant title element
      let restaurantNameElement = document.querySelector('.text-3xl.font-bold');
      if (!restaurantNameElement) {
        restaurantNameElement = document.querySelector(
          '#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)'
        );
      }

      if (restaurantNameElement && statsContainer) {
        const insertionPoint = restaurantNameElement.parentNode || restaurantNameElement;
        insertionPoint.insertBefore(statsContainer, restaurantNameElement.nextSibling);
        if (window.LanchDrapKeyManager) {
          window.LanchDrapKeyManager.forceUpdateKeyVisibility();
        } else {
          updateKeyVisibility();
        }
      } else if (!statsContainer) {
        console.log('LanchDrap: Stats display - no stats container created, cannot insert');
      } else if (!restaurantNameElement) {
        console.log(
          'LanchDrap: Stats display - no restaurant name element found, cannot insert stats'
        );
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

      console.log('LanchDrap: Stats display - restaurant context:', restaurantContext);

      if (!restaurantId) {
        console.log('LanchDrap: Stats display - no restaurant ID available, returning');
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
        console.log(
          'LanchDrap: Stats display - calling API with restaurantId:',
          restaurantId,
          'userId:',
          userId
        );
        stats = await apiClient.getRestaurantStatsWithUserHistory(restaurantId, userId);
        console.log('LanchDrap: Stats display - API response:', stats);

        if (!stats) {
          console.log('LanchDrap: Stats display - no stats returned from API, returning');
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

      // Hide skeleton loading state if it exists
      hideSkeletonLoading();

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
      updateKeyVisibility();
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
        const message = error && error.message ? error.message : 'Unknown error';
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
    toggleKeyVisibility,
    initializeKonamiCode,
    showSkeletonLoading,
    hideSkeletonLoading,
  };
})();
