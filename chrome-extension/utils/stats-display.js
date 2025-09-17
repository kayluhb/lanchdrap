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

    // Helper function to convert RGB to HSL for better gradient control
    function rgbToHsl(rgb) {
      const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return { h: 0, s: 0, l: 50 };

      const r = parseInt(match[1], 10) / 255;
      const g = parseInt(match[2], 10) / 255;
      const b = parseInt(match[3], 10) / 255;

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
    const displayTitle = `📊 ${createPossessive(restaurantName)} Stats`;

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
            cursor: ${getEditTriggerProps(stats.id, stats.name).cursor};
            transition: all 0.2s ease;
          " data-restaurant-id="${stats.id || 'unknown'}" data-restaurant-name="${(stats.name || '').replace(/"/g, '&quot;')}" title="${getEditTriggerProps(stats.id, stats.name).title}">${displayTitle}             ${createKeyElement(`restaurant:${stats.id || 'unknown'}`, 'Click to select restaurant key')}</span>
          ${apiErrorIndicator}
        </div>
        <div class="ld-tracking-stats" style="padding: 20px;">
          ${
            stats.ratingSynopsis
              ? `
          <!-- Rating Synopsis Row -->
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
              ">Rating</span>
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
              ">${stats.ratingSynopsis.summary}</span>
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
              ">Distribution</span>
              <span class="ld-stat-value" style="
                color: ${textColor};
                font-weight: 600;
                font-size: 14px;
                background: ${textBackgroundColor};
                padding: 4px 8px;
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
                ${createKeyElement(`user_restaurant_history:${stats.userId || 'unknown'}:${stats.id || 'unknown'}`, 'Click to select user history key')}
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
              "><strong>Last Order Items</strong></span>
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
                  .map(
                    (item) =>
                      `<strong>${item.name}</strong> (${item.quantity})<br>${item.options ? `(${item.options})` : ''}`
                  )
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
    if (editTrigger) {
      editTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Check if keys are visible before allowing edit
        const keysVisible = window.LanchDrapKeyManager
          ? window.LanchDrapKeyManager.areKeysVisible()
          : false;
        if (!keysVisible) {
          return;
        }

        const restaurantId = editTrigger.dataset.restaurantId;
        const restaurantName = editTrigger.dataset.restaurantName;
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
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
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

      // Find the selected restaurant
      const selectedRestaurant = availabilityData.find((restaurant) => restaurant.isSelected);
      if (!selectedRestaurant) {
        return;
      }

      // Hide skeleton loading state if it exists
      hideSkeletonLoading();

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
      const _currentRestaurantId = selectedRestaurant.id;

      // Fetch combined stats with user order history in background and update UI when ready
      const combinedStatsPromise = apiClient.getRestaurantStatsWithUserHistory(
        selectedRestaurant.id,
        userId
      );

      Promise.all([combinedStatsPromise])
        .then(([stats]) => {
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

          // Add userId to stats for display
          stats.userId = userId;

          const updatedContainer = renderStatsComponent(
            stats,
            'lanchdrap-restaurant-stats',
            'Selected Restaurant Stats'
          );

          // Check if the container was actually updated
          const existingContainer = document.getElementById('lanchdrap-restaurant-stats');
          if (existingContainer) {
            existingContainer.replaceWith(updatedContainer);
          } else {
          }
        })
        .catch((_error) => {
          // Check if this is still the current request
          if (requestId !== currentStatsRequestId) {
            return;
          }

          // Check if URL changed during the request
          if (window.location.href !== currentUrl) {
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
        if (window.LanchDrapKeyManager) {
          window.LanchDrapKeyManager.forceUpdateKeyVisibility();
        } else {
          updateKeyVisibility();
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

        // Also store in chrome.storage.local for popup access
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [localKey]: restaurantName });
        }

        try {
          // Get user ID for order history
          const userId = await lanchDrapUserIdManager.getUserId();

          // Generate unique request ID for this stats request
          const requestId = ++currentStatsRequestId;
          const currentUrl = window.location.href;
          const _currentRestaurantId = restaurantId;

          // Fetch combined restaurant stats with user order history
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
            apiClient
              .updateRestaurant(restaurantId, restaurantName, menuItems)
              .catch((_error) => {});
          }
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

        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
            Rating Statistics
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div>
              <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">
                Total Ratings
              </label>
              <input 
                type="number" 
                id="total-ratings" 
                min="0"
                style="
                  width: 100%;
                  padding: 8px;
                  border: 2px solid #e1e5e9;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
            </div>
            <div>
              <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">
                Average Rating
              </label>
              <input 
                type="number" 
                id="average-rating" 
                min="1" 
                max="4" 
                step="0.1"
                style="
                  width: 100%;
                  padding: 8px;
                  border: 2px solid #e1e5e9;
                  border-radius: 6px;
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">
              Rating Distribution (🤮 😐 🤤 🤯)
            </label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              <div>
                <label style="display: block; margin-bottom: 2px; font-size: 11px; color: #666;">🤮 (1)</label>
                <input 
                  type="number" 
                  id="rating-1" 
                  min="0"
                  style="
                    width: 100%;
                    padding: 6px;
                    border: 2px solid #e1e5e9;
                    border-radius: 4px;
                    font-size: 12px;
                    box-sizing: border-box;
                  "
                />
              </div>
              <div>
                <label style="display: block; margin-bottom: 2px; font-size: 11px; color: #666;">😐 (2)</label>
                <input 
                  type="number" 
                  id="rating-2" 
                  min="0"
                  style="
                    width: 100%;
                    padding: 6px;
                    border: 2px solid #e1e5e9;
                    border-radius: 4px;
                    font-size: 12px;
                    box-sizing: border-box;
                  "
                />
              </div>
              <div>
                <label style="display: block; margin-bottom: 2px; font-size: 11px; color: #666;">🤤 (3)</label>
                <input 
                  type="number" 
                  id="rating-3" 
                  min="0"
                  style="
                    width: 100%;
                    padding: 6px;
                    border: 2px solid #e1e5e9;
                    border-radius: 4px;
                    font-size: 12px;
                    box-sizing: border-box;
                  "
                />
              </div>
              <div>
                <label style="display: block; margin-bottom: 2px; font-size: 11px; color: #666;">🤯 (4)</label>
                <input 
                  type="number" 
                  id="rating-4" 
                  min="0"
                  style="
                    width: 100%;
                    padding: 6px;
                    border: 2px solid #e1e5e9;
                    border-radius: 4px;
                    font-size: 12px;
                    box-sizing: border-box;
                  "
                />
              </div>
            </div>
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

      // Get current restaurant data
      const restaurantData = await apiClient.getRestaurantById(restaurantId);

      if (restaurantData?.appearances) {
        const appearanceDatesTextarea = document.getElementById('appearance-dates');
        const soldoutDatesTextarea = document.getElementById('soldout-dates');

        if (appearanceDatesTextarea) {
          appearanceDatesTextarea.value = restaurantData.appearances.join('\n');
        }

        if (soldoutDatesTextarea) {
          // Handle both cases: soldOutDates exists and is an array, or it's undefined/null
          const soldOutDates = restaurantData.soldOutDates || [];
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

      // Collect rating data
      const ratingData = {
        totalRatings: parseInt(totalRatingsInput.value, 10) || 0,
        averageRating: parseFloat(averageRatingInput.value) || 0,
        ratingDistribution: {
          1: parseInt(rating1Input.value, 10) || 0,
          2: parseInt(rating2Input.value, 10) || 0,
          3: parseInt(rating3Input.value, 10) || 0,
          4: parseInt(rating4Input.value, 10) || 0,
        },
      };

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
      } catch (_error) {
        alert('Error saving changes. Please try again.');
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
      }
    });
  }

  // Save restaurant data via API
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

    // Update restaurant rating data if provided
    if (ratingData) {
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
