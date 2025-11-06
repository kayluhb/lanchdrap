document.addEventListener('DOMContentLoaded', () => {
  const orderHistoryDiv = document.getElementById('order-history');

  // Show loading skeleton
  function getOrderHistorySkeletonHTML(count = 3) {
    const items = Array.from({ length: count })
      .map(
        () => `
      <div class="order-skeleton">
        <div class="order-skeleton-header">
          <div class="skeleton-line skeleton-name"></div>
          <div class="skeleton-line skeleton-date"></div>
        </div>
        <div class="skeleton-line skeleton-items" style="margin-top:6px;"></div>
        <div class="skeleton-line skeleton-button" style="margin-top:10px;"></div>
      </div>`
      )
      .join('');
    return `<div class="order-history-skeleton">${items}</div>`;
  }

  orderHistoryDiv.innerHTML = getOrderHistorySkeletonHTML(4);

  // Load last 10 restaurants from user order history
  async function loadLast10Restaurants() {
    try {
      // Get user ID
      const userId = await lanchDrapUserIdManager.getUserId();

      if (!userId) {
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

      const restaurantSummary = await apiClient.getUserRestaurantSummary(userId);

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
        // API returned error, but we'll continue with local data
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

      // Filter out hidden restaurants
      const hiddenRestaurants = await chrome.storage.local.get(['hiddenRestaurants']);
      const hiddenList = hiddenRestaurants.hiddenRestaurants || [];

      const filteredRestaurants = restaurants.filter(
        (restaurant) => !hiddenList.includes(restaurant.restaurantId)
      );

      // Sort by last order date (oldest first) and take the first 10
      const sortedRestaurants = filteredRestaurants
        .sort((a, b) => new Date(a.lastOrderDate) - new Date(b.lastOrderDate))
        .slice(0, 10);

      await displayLast10Restaurants(sortedRestaurants);
    } catch {
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

    // Restaurant names are now available directly from the data

    // Get userId for rating checks
    const userId = await lanchDrapUserIdManager.getUserId();

    // Check rating status for each restaurant
    const restaurantsWithRatingStatus = await Promise.all(
      restaurants.map(async (restaurant) => {
        let hasRating = false;
        let ratingData = null;

        if (userId) {
          try {
            const params = new URLSearchParams();
            params.append('userId', userId);
            params.append('restaurantId', restaurant.restaurantId);
            params.append('orderDate', restaurant.lastOrderDate);

            const response = await fetch(
              `${LanchDrapConfig.getApiUrl(LanchDrapConfig.CONFIG.ENDPOINTS.RATINGS)}/order?${params.toString()}`
            );
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data && result.data.hasRating && result.data.rating) {
                hasRating = true;
                ratingData = result.data.rating;
              }
            }
          } catch (_e) {
            // Ignore errors
          }
        }

        return { ...restaurant, hasRating, ratingData };
      })
    );

    // Categorize restaurants
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const currentTime = today.getHours() * 60 + today.getMinutes();
    const cutoffTime = 12 * 60; // 12:00 PM

    const upcomingOrders = [];
    const needsRating = [];
    const ratedOrders = [];

    for (const restaurant of restaurantsWithRatingStatus) {
      const orderDateString = restaurant.lastOrderDate;
      const isUpcoming =
        orderDateString > todayString ||
        (orderDateString === todayString && currentTime < cutoffTime);

      if (isUpcoming) {
        upcomingOrders.push(restaurant);
      } else if (restaurant.hasRating) {
        ratedOrders.push(restaurant);
      } else {
        needsRating.push(restaurant);
      }
    }

    // Sort within categories
    // Upcoming: newest first
    upcomingOrders.sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));
    // Needs rating: oldest first
    needsRating.sort((a, b) => new Date(a.lastOrderDate) - new Date(b.lastOrderDate));
    // Rated: oldest first
    ratedOrders.sort((a, b) => new Date(a.lastOrderDate) - new Date(b.lastOrderDate));

    // Render function for a single restaurant
    const renderRestaurant = (restaurant) => {
      // Format the last order date, handling timezone issues
      let lastOrderDate;
      if (window.LanchDrapDOMUtils?.formatDateString) {
        lastOrderDate = window.LanchDrapDOMUtils.formatDateString(restaurant.lastOrderDate);
      } else {
        // Fallback: handle YYYY-MM-DD format properly to avoid timezone issues
        if (
          typeof restaurant.lastOrderDate === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(restaurant.lastOrderDate)
        ) {
          const [year, month, day] = restaurant.lastOrderDate.split('-');
          const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
          lastOrderDate = date.toLocaleDateString();
        } else {
          lastOrderDate = new Date(restaurant.lastOrderDate).toLocaleDateString();
        }
      }
      const _totalOrders = restaurant.totalOrders || 0;
      const recentOrders = restaurant.recentOrders || [];

      // Get the most recent order items for display
      const recentItems =
        recentOrders.length > 0 && recentOrders[0].items
          ? recentOrders[0].items.map((item) => item.label || 'Unknown Item').join(', ')
          : 'No items recorded';

      // Use restaurant name directly from the data; fallback to ID until lookup completes
      const restaurantName = restaurant.restaurantName || restaurant.restaurantId;

      // Check if the order date is in the past OR it's today but after 12:00 PM
      // Handle timezone issues by comparing date strings directly
      const orderDateString = restaurant.lastOrderDate; // Should be in YYYY-MM-DD format
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // Get YYYY-MM-DD format for today

      // Check if it's the same day
      const isSameDay = orderDateString === todayString;

      // Check if it's in the past (before today)
      const isPastDate = orderDateString < todayString;

      // Check if it's after 12:00 PM today
      const currentTime = today.getHours() * 60 + today.getMinutes();
      const cutoffTime = 12 * 60; // 12:00 PM in minutes

      // Can rate if: order is in the past OR (it's today AND after 12:00 PM)
      // Temporary override via config flag
      const forceRatings = !!window.LanchDrapConfig?.CONFIG?.SETTINGS?.TEMP_ENABLE_POPUP_RATINGS;
      const canRate = forceRatings || isPastDate || (isSameDay && currentTime >= cutoffTime);

      // Get rating emoji if rated
      let ratingEmoji = '';
      if (restaurant.hasRating && restaurant.ratingData) {
        const emojiMap = { 1: '🤮', 2: '😐', 3: '🤤', 4: '🤯' };
        ratingEmoji = emojiMap[restaurant.ratingData.rating] || '⭐';
      }

      return `
          <div class="restaurant-item" data-restaurant-id="${restaurant.restaurantId}" data-restaurant-name="${restaurantName}" data-order-date="${restaurant.lastOrderDate}">
            <button class="restaurant-item-trash" title="Delete this order">🗑️</button>
            <div class="restaurant-item-content">
              <div class="restaurant-header">
                <div class="restaurant-logo-container" style="background-color: ${restaurant.color || '#f0f0f0'};">
                  ${restaurant.logo ? `<img src="${restaurant.logo}" alt="${restaurantName}" class="restaurant-logo" />` : `<div class="restaurant-logo-placeholder">${restaurantName.charAt(0).toUpperCase()}</div>`}
                </div>
                <div class="restaurant-info">
                  <span class="restaurant-name">${restaurantName}</span>
                  <span class="last-order-date">${lastOrderDate}</span>
                </div>
                ${ratingEmoji ? `<a href="#" class="edit-rating-link" data-restaurant-id="${restaurant.restaurantId}" data-restaurant-name="${restaurantName}" data-order-date="${restaurant.lastOrderDate}" style="display:flex;align-items:center;gap:6px;margin-left:auto;margin-right:32px;text-decoration:none;font-size:13px;color:#1976d2;flex-shrink:0;align-self:flex-start;padding-top:2px;" title="Edit your rating"><span style="font-size:20px;line-height:1;">${ratingEmoji}</span><span style="white-space:nowrap;">Edit</span></a>` : ''}
              </div>
              <div class="restaurant-stats">
                <div class="stat-items">${recentItems}</div>
              </div>
              ${
                canRate && !restaurant.hasRating
                  ? `
                <div class="restaurant-actions">
                  <button class="rate-button" data-restaurant-id="${restaurant.restaurantId}" data-restaurant-name="${restaurantName}" data-order-date="${restaurant.lastOrderDate}">
                    ⭐ Rate
                  </button>
                </div>
              `
                  : ''
              }
            </div>
            <div class="restaurant-item-actions">
              <button class="delete-order-button" data-restaurant-id="${restaurant.restaurantId}" data-restaurant-name="${restaurantName}" data-order-date="${restaurant.lastOrderDate}">
                Remove
              </button>
            </div>
          </div>
        `;
    };

    // Build HTML with categorized sections
    const htmlSections = [];

    if (upcomingOrders.length > 0) {
      htmlSections.push(`
        <h3 class="order-section-header">📅 Upcoming Orders</h3>
        ${upcomingOrders.map(renderRestaurant).join('')}
      `);
    }

    if (needsRating.length > 0) {
      htmlSections.push(`
        <h3 class="order-section-header">⭐ Orders That Need Rating</h3>
        ${needsRating.map(renderRestaurant).join('')}
      `);
    }

    if (ratedOrders.length > 0) {
      htmlSections.push(`
        <h3 class="order-section-header">✅ Past Orders - Rated</h3>
        ${ratedOrders.map(renderRestaurant).join('')}
      `);
    }

    orderHistoryDiv.innerHTML = htmlSections.join('');

    // After initial render, resolve and replace any restaurant IDs with names
    try {
      // Prepare API client once
      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      // Helper: get cached name
      async function getCachedName(restaurantId) {
        try {
          const { restaurantNameCache } = await chrome.storage.local.get(['restaurantNameCache']);
          return restaurantNameCache ? restaurantNameCache[restaurantId] : undefined;
        } catch {
          return undefined;
        }
      }

      // Helper: set cached name
      async function setCachedName(restaurantId, name) {
        try {
          const { restaurantNameCache } = await chrome.storage.local.get(['restaurantNameCache']);
          const cache = restaurantNameCache || {};
          cache[restaurantId] = name;
          await chrome.storage.local.set({ restaurantNameCache: cache });
        } catch {}
      }

      // Helper: lookup name via API by ID
      async function fetchRestaurantNameById(restaurantId) {
        try {
          const endpoint = `${apiClient.getEndpoint('RESTAURANTS_GET_BY_ID')}/${restaurantId}`;
          const resp = await apiClient.request(endpoint);
          return resp?.name || resp?.restaurant?.name || resp?.data?.name || undefined;
        } catch {
          return undefined;
        }
      }

      const items = document.querySelectorAll('.restaurant-item');
      for (const el of items) {
        const id = el.getAttribute('data-restaurant-id');
        const nameSpan = el.querySelector('.restaurant-name');
        if (!id || !nameSpan) continue;

        // Skip if already a human-friendly name (heuristic: contains a space or non-alnum)
        const currentText = (nameSpan.textContent || '').trim();
        if (currentText && currentText !== id && /[^a-zA-Z0-9_-]/.test(currentText)) {
          continue;
        }

        let name = await getCachedName(id);
        if (!name) {
          name = await fetchRestaurantNameById(id);
          if (name) await setCachedName(id, name);
        }

        if (name) {
          nameSpan.textContent = name;
          el.setAttribute('data-restaurant-name', name);
          const rateBtn = el.querySelector('.rate-button');
          const deleteBtn = el.querySelector('.delete-order-button');
          if (rateBtn) rateBtn.setAttribute('data-restaurant-name', name);
          if (deleteBtn) deleteBtn.setAttribute('data-restaurant-name', name);
        }
      }
    } catch {}

    // Add event listeners for rate buttons
    addRateButtonListeners();

    // Add event listeners for delete functionality
    addDeleteButtonListeners();

    // Note: Rating badges are now populated inline during categorization
  }

  // Add event listeners for rate buttons and edit rating links
  function addRateButtonListeners() {
    // Handle rate buttons
    const rateButtons = document.querySelectorAll('.rate-button');
    for (const button of rateButtons) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const restaurantId = button.dataset.restaurantId;
        const restaurantName = button.dataset.restaurantName;
        const orderDate = button.dataset.orderDate;
        showRatingView(restaurantId, restaurantName, orderDate);

        // Scroll to top of popup after DOM update
        setTimeout(() => {
          // Try multiple scroll targets
          window.scrollTo({ top: 0, behavior: 'smooth' });

          // Also try scrolling the order history container
          const orderHistoryDiv = document.getElementById('order-history');
          if (orderHistoryDiv) {
            orderHistoryDiv.scrollTop = 0;
          }

          // Also try scrolling the main container
          const container = document.querySelector('.container');
          if (container) {
            container.scrollTop = 0;
          }
        }, 10);
      });
    }

    // Handle edit rating links
    const editRatingLinks = document.querySelectorAll('.edit-rating-link');
    for (const link of editRatingLinks) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const restaurantId = link.dataset.restaurantId;
        const restaurantName = link.dataset.restaurantName;
        const orderDate = link.dataset.orderDate;
        showRatingView(restaurantId, restaurantName, orderDate);

        // Scroll to top of popup after DOM update
        setTimeout(() => {
          // Try multiple scroll targets
          window.scrollTo({ top: 0, behavior: 'smooth' });

          // Also try scrolling the order history container
          const orderHistoryDiv = document.getElementById('order-history');
          if (orderHistoryDiv) {
            orderHistoryDiv.scrollTop = 0;
          }

          // Also try scrolling the main container
          const container = document.querySelector('.container');
          if (container) {
            container.scrollTop = 0;
          }
        }, 10);
      });
    }
  }

  // Add event listeners for delete functionality
  function addDeleteButtonListeners() {
    const trashButtons = document.querySelectorAll('.restaurant-item-trash');
    const deleteButtons = document.querySelectorAll('.delete-order-button');
    const restaurantItems = document.querySelectorAll('.restaurant-item');

    // Add click handlers for trash icons (reveal delete button)
    for (const trashButton of trashButtons) {
      trashButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const restaurantItem = trashButton.closest('.restaurant-item');
        if (restaurantItem) {
          restaurantItem.classList.toggle('swiped');
        }
      });
    }

    // Add click handlers for delete buttons
    for (const deleteButton of deleteButtons) {
      deleteButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const restaurantId = deleteButton.dataset.restaurantId;
        const restaurantName = deleteButton.dataset.restaurantName;
        const orderDate = deleteButton.dataset.orderDate;

        if (
          !confirm(
            `Are you sure you want to remove "${restaurantName}" from your order history? This action cannot be undone.`
          )
        ) {
          return;
        }

        // Show loading state
        deleteButton.disabled = true;
        deleteButton.textContent = 'Removing...';
        deleteButton.style.opacity = '0.6';

        try {
          // Get user identification
          const userId = await lanchDrapUserIdManager.getUserId();

          if (!userId) {
            alert('Unable to get user ID. Please try again.');
            return;
          }

          // Call API to delete the order
          const apiClient = new LanchDrapApiClient.ApiClient(
            LanchDrapConfig.CONFIG.API_BASE_URL,
            LanchDrapConfig.CONFIG.ENDPOINTS
          );

          await apiClient.deleteUserRestaurantHistory(userId, restaurantId, orderDate);

          // Reload the restaurant list to show updated data with fresh categorization
          loadLast10Restaurants();
        } catch (_error) {
          alert('Failed to remove order. Please try again.');
        } finally {
          // Reset button state
          deleteButton.disabled = false;
          deleteButton.textContent = 'Remove';
          deleteButton.style.opacity = '1';
        }
      });
    }

    // Add click handlers to close swipe when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.restaurant-item')) {
        for (const item of restaurantItems) {
          item.classList.remove('swiped');
        }
      }
    });
  }

  // Show rating view in popup
  function showRatingView(restaurantId, restaurantName, orderDate) {
    // Hide the main content
    const orderHistoryDiv = document.getElementById('order-history');

    // Store original content
    const originalContent = orderHistoryDiv.innerHTML;

    // Create rating view
    const ratingViewHTML = `
      <div class="rating-view">
        <div class="rating-header">
          <button class="back-button" id="back-to-history">← Back</button>
          <h3>Rate ${restaurantName}</h3>
        </div>
        
        <div class="rating-form">
          <div class="menu-selection">
          <div class="order-items-wrap">
            <div class="order-items" id="order-items">
              <div class="loading-order">Loading your order...</div>
            </div>
            <button class="edit-order-button" id="edit-order-button" style="display: none;white-space:nowrap;">Edit order</button>
            <div class="edit-order-section" id="edit-order-section" style="display: none;">
              <div class="menu-autocomplete">
                <input type="text" id="menu-search" placeholder="Search menu items..." autocomplete="off">
                <div class="menu-dropdown" id="menu-dropdown"></div>
              </div>
              <div class="selected-items" id="selected-items"></div>
              <button class="done-editing" id="done-editing">Done Editing</button>
            </div>
          </div>
          <div class="rating-options">
            <div class="rating-option" data-rating="1" title="Never Again">
              <span class="rating-emoji">🤮</span>
            </div>
            <div class="rating-option" data-rating="2" title="Meh">
              <span class="rating-emoji">😐</span>
            </div>
            <div class="rating-option" data-rating="3" title="Pretty Good">
              <span class="rating-emoji">🤤</span>
            </div>
            <div class="rating-option" data-rating="4" title="Life Changing">
              <span class="rating-emoji">🤯</span>
            </div>
          </div>
          
          <textarea class="rating-comment" placeholder="Add a comment about your order..."></textarea>
          
          <div class="rating-actions">
            <button class="hide-forever" id="hide-forever" disabled>Submit & Hide Forever</button>
            <button class="rating-submit" id="rating-submit" disabled>Submit</button>
          </div>
        </div>
      </div>
    `;

    orderHistoryDiv.innerHTML = ratingViewHTML;

    // Setup rating view functionality
    setupRatingView(restaurantId, restaurantName, orderDate, originalContent);
  }

  // Setup rating view functionality
  async function setupRatingView(restaurantId, restaurantName, orderDate, originalContent) {
    const backButton = document.getElementById('back-to-history');
    const ratingOptions = document.querySelectorAll('.rating-option');
    // Remove reference to rating display since we're using tooltips now
    const commentInput = document.querySelector('.rating-comment');
    const submitButton = document.getElementById('rating-submit');
    const hideForeverButton = document.getElementById('hide-forever');
    const menuSearch = document.getElementById('menu-search');
    const menuDropdown = document.getElementById('menu-dropdown');
    const selectedItems = document.getElementById('selected-items');

    let currentRating = 0;
    let selectedMenuItems = [];
    let menuItems = [];

    // Back button functionality
    backButton.addEventListener('click', () => {
      const orderHistoryDiv = document.getElementById('order-history');
      orderHistoryDiv.innerHTML = originalContent;
      addRateButtonListeners(); // Re-add listeners after restoring content
      addDeleteButtonListeners(); // Re-add delete listeners after restoring content
    });

    // Load restaurant details and user's last order
    try {
      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      // Get user ID for the request
      const userId = await lanchDrapUserIdManager.getUserId();

      // Make a single request to get restaurant data with user's order for the specific date
      const params = new URLSearchParams();
      params.append('userId', userId || '');
      params.append('orderDate', orderDate || '');
      const endpoint = `${apiClient.getEndpoint('RESTAURANTS_GET_BY_ID')}/${restaurantId}?${params.toString()}`;

      const restaurantData = await apiClient.request(endpoint);

      // Get the full restaurant menu for autocomplete from separate KV record
      try {
        const menuResponse = await apiClient.getRestaurantMenu(restaurantId);
        if (menuResponse?.success && menuResponse?.data?.items) {
          menuItems = menuResponse.data.items;
        }
      } catch (_e) {
        // If menu fetch fails, continue with empty array
        menuItems = [];
      }

      // Extract user's order for the specific date if available
      if (restaurantData?.userOrder?.items && restaurantData.userOrder.items.length > 0) {
        selectedMenuItems = restaurantData.userOrder.items.map((item) => {
          if (typeof item === 'string') {
            return LanchDrapModels.MenuItem.fromString(item);
          }
          // Use label field as that's what's stored in KV and returned by API
          const normalizedItem = {
            label: item.label || 'Unknown Item',
            quantity: item.quantity || 1,
            options: item.options || '',
            fullDescription: item.label || 'Unknown Item',
          };
          return LanchDrapModels.MenuItem.fromJSON(normalizedItem);
        });

        // Display the user's order items
        renderOrderItems(selectedMenuItems);

        // Show the edit button
        const editButton = document.getElementById('edit-order-button');
        if (editButton) {
          editButton.style.display = 'block';
        }
      } else {
        // No order found, show empty state
        renderOrderItems([]);
      }

      // Check for existing rating for this order
      await checkExistingRating(restaurantId, orderDate, userIdentification.userId);
    } catch (_error) {
      // Could not load restaurant data, continue with empty arrays
    }

    // Dedupe and sort menu items
    menuItems = [...new Set(menuItems)].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    // Function to check for existing rating
    async function checkExistingRating(restaurantId, orderDate, userId) {
      try {
        const params = new URLSearchParams();
        params.append('userId', userId);
        params.append('restaurantId', restaurantId);
        params.append('orderDate', orderDate);

        const response = await fetch(
          `${LanchDrapConfig.getApiUrl(LanchDrapConfig.CONFIG.ENDPOINTS.RATINGS)}/order?${params.toString()}`
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.hasRating) {
            // Show existing rating
            displayExistingRating(result.data.rating);
            return true;
          }
        }
      } catch (_error) {}
      return false;
    }

    // Function to display existing rating
    function displayExistingRating(rating) {
      // Update the rating display
      currentRating = rating.rating;
      updateRatingDisplay();

      // Update comment
      if (commentInput) {
        commentInput.value = rating.comment || '';
      }

      // Update submit button text
      if (submitButton) {
        submitButton.textContent = 'Update';
      }

      // Show a message that rating exists
      const ratingHeader = document.querySelector('.rating-header h3');
      if (ratingHeader) {
        ratingHeader.innerHTML = `Rate ${restaurantName} <span style="font-size: 0.8em; color: #666;">(Previously rated: ${getRatingEmoji(rating.rating)})</span>`;
      }
    }

    // Helper function to get rating emoji
    function getRatingEmoji(rating) {
      const emojis = { 1: '🤮', 2: '😐', 3: '🤤', 4: '🤯' };
      return emojis[rating] || '⭐';
    }

    // Order display functionality
    function renderOrderItems(items) {
      const orderItemsDiv = document.getElementById('order-items');
      if (!orderItemsDiv) return;

      if (items.length === 0) {
        orderItemsDiv.innerHTML = '<div class="no-order">No order found for this date</div>';
        return;
      }

      orderItemsDiv.innerHTML = items
        .map(
          (item) => `
        <div class="order-item">
          <span class="order-item-name">${item.label}</span>
        </div>
      `
        )
        .join('');
    }

    function showEditMode() {
      const orderItemsDiv = document.getElementById('order-items');
      const editSection = document.getElementById('edit-order-section');
      const editButton = document.getElementById('edit-order-button');

      if (orderItemsDiv) orderItemsDiv.style.display = 'none';
      if (editSection) editSection.style.display = 'block';
      if (editButton) editButton.style.display = 'none';

      // Render current items in edit mode
      renderSelectedItems();
    }

    async function hideEditMode() {
      const orderItemsDiv = document.getElementById('order-items');
      const editSection = document.getElementById('edit-order-section');
      const editButton = document.getElementById('edit-order-button');
      const doneEditingButton = document.getElementById('done-editing');

      // Show loading state
      if (doneEditingButton) {
        doneEditingButton.disabled = true;
        doneEditingButton.textContent = 'Saving...';
        doneEditingButton.style.opacity = '0.6';
        doneEditingButton.style.cursor = 'not-allowed';
      }

      try {
        // Save updated order information to the API
        if (selectedMenuItems.length > 0) {
          const apiClient = new LanchDrapApiClient.ApiClient(
            LanchDrapConfig.CONFIG.API_BASE_URL,
            LanchDrapConfig.CONFIG.ENDPOINTS
          );

          // Get user identification
          const userId = await lanchDrapUserIdManager.getUserId();

          // Update the user's order with the new items for the specific date
          // Convert MenuItem objects to the format expected by the backend
          const items = selectedMenuItems.map((item) => ({
            id: Date.now() + Math.random(), // Generate a unique ID
            itemId: `item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`, // Generate itemId
            label: item.label,
            description: item.fullDescription || item.label,
            price: 0, // Default price since we don't have pricing info in edit mode
            quantity: item.quantity,
            specialRequest: null,
          }));

          await apiClient.updateUserOrder(userId, restaurantId, orderDate, items);
        }

        // Update the UI
        if (orderItemsDiv) orderItemsDiv.style.display = 'block';
        if (editSection) editSection.style.display = 'none';
        if (editButton) editButton.style.display = 'block';

        // Update the order display with current items
        renderOrderItems(selectedMenuItems);
      } catch {
        // Still update the UI even if API call fails
        if (orderItemsDiv) orderItemsDiv.style.display = 'block';
        if (editSection) editSection.style.display = 'none';
        if (editButton) editButton.style.display = 'block';
        renderOrderItems(selectedMenuItems);
      } finally {
        // Reset button state
        if (doneEditingButton) {
          doneEditingButton.disabled = false;
          doneEditingButton.textContent = 'Done Editing';
          doneEditingButton.style.opacity = '1';
          doneEditingButton.style.cursor = 'pointer';
        }
      }
    }

    // Menu search functionality
    function filterMenuItems(searchTerm) {
      if (!searchTerm) {
        return menuItems;
      }
      return menuItems.filter((item) => item.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    function renderMenuDropdown(items) {
      menuDropdown.innerHTML = '';
      if (items.length === 0) {
        menuDropdown.style.display = 'none';
        return;
      }

      for (const item of items) {
        // Check if this item is already selected by comparing labels
        const isAlreadySelected = selectedMenuItems.some(
          (selected) => selected.label.toLowerCase() === item.toLowerCase()
        );
        if (isAlreadySelected) continue;

        const option = document.createElement('div');
        option.className = 'menu-option';
        option.textContent = item;
        option.addEventListener('click', () => {
          selectMenuItem(item);
          menuSearch.value = '';
          menuDropdown.style.display = 'none';
        });
        menuDropdown.appendChild(option);
      }

      menuDropdown.style.display = 'block';
    }

    function selectMenuItem(itemName) {
      // Create a MenuItem from the selected name
      const menuItem = LanchDrapModels.MenuItem.fromString(itemName);
      const alreadySelected = selectedMenuItems.some((selected) => selected.equals(menuItem));

      if (!alreadySelected) {
        selectedMenuItems.push(menuItem);
        renderSelectedItems();
      }
    }

    function removeMenuItem(itemName) {
      const menuItem = LanchDrapModels.MenuItem.fromString(itemName);
      selectedMenuItems = selectedMenuItems.filter((i) => !i.equals(menuItem));
      renderSelectedItems();
    }

    function renderSelectedItems() {
      selectedItems.innerHTML = '';
      for (const item of selectedMenuItems) {
        const tag = document.createElement('div');
        tag.className = 'selected-item';
        tag.innerHTML = `
          <span>${item.label}</span>
          <button class="remove-item" data-item="${item.label}">×</button>
        `;
        selectedItems.appendChild(tag);
      }

      // Add event listeners for remove buttons
      const removeButtons = selectedItems.querySelectorAll('.remove-item');
      for (const btn of removeButtons) {
        btn.addEventListener('click', (e) => {
          removeMenuItem(e.target.dataset.item);
        });
      }
    }

    // Menu search event listeners
    menuSearch.addEventListener('input', (e) => {
      const searchTerm = e.target.value;
      const filteredItems = filterMenuItems(searchTerm);
      renderMenuDropdown(filteredItems);
    });

    menuSearch.addEventListener('focus', () => {
      const value = (menuSearch.value || '').trim();
      if (value) {
        const filteredItems = filterMenuItems(value);
        renderMenuDropdown(filteredItems);
      } else {
        // Show a short list of suggestions when focusing with empty input
        renderMenuDropdown(menuItems.slice(0, 20));
      }
    });

    // Hide dropdown when clicking outside of the autocomplete
    document.addEventListener(
      'click',
      (e) => {
        if (!menuSearch.contains(e.target) && !menuDropdown.contains(e.target)) {
          menuDropdown.style.display = 'none';
        }
      },
      { once: false }
    );

    // Keyboard handling: Enter selects first suggestion, Escape closes
    menuSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const firstOption = menuDropdown.querySelector('.menu-option');
        if (firstOption) {
          e.preventDefault();
          firstOption.click();
        }
      } else if (e.key === 'Escape') {
        menuDropdown.style.display = 'none';
      }
    });

    // Rating options functionality
    for (const option of ratingOptions) {
      option.addEventListener('click', function () {
        const rating = parseInt(this.dataset.rating, 10);
        currentRating = rating;
        updateRatingDisplay();
        enableButtons();

        // Scroll to top of popup
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      option.addEventListener('mouseenter', function () {
        const rating = parseInt(this.dataset.rating, 10);
        highlightRatingOptions(rating);
      });

      option.addEventListener('mouseleave', () => {
        updateRatingDisplay();
      });
    }

    function updateRatingDisplay() {
      for (const option of ratingOptions) {
        const rating = parseInt(option.dataset.rating, 10);
        if (rating === currentRating) {
          option.classList.add('active');
          option.style.transform = 'scale(1.05)';
          option.style.backgroundColor = '#e3f2fd';
        } else {
          option.classList.remove('active');
          option.style.transform = 'scale(1)';
          option.style.backgroundColor = '';
        }
      }
    }

    function highlightRatingOptions(rating) {
      for (const option of ratingOptions) {
        const optionRating = parseInt(option.dataset.rating, 10);
        if (optionRating === rating) {
          option.style.transform = 'scale(1.1)';
          option.style.backgroundColor = '#e3f2fd';
        } else {
          option.style.transform = 'scale(1)';
          option.style.backgroundColor = '';
        }
      }
    }

    // Function to enable buttons when rating is selected
    function enableButtons() {
      if (currentRating > 0) {
        submitButton.disabled = false;
        hideForeverButton.disabled = false;
        submitButton.style.opacity = '1';
        hideForeverButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
        hideForeverButton.style.cursor = 'pointer';
      }
    }

    // Edit order functionality
    const editOrderButton = document.getElementById('edit-order-button');
    const doneEditingButton = document.getElementById('done-editing');

    if (editOrderButton) {
      editOrderButton.addEventListener('click', showEditMode);
    }

    if (doneEditingButton) {
      doneEditingButton.addEventListener('click', async () => {
        await hideEditMode();
      });
    }

    // Submit rating
    submitButton.addEventListener('click', async () => {
      if (currentRating === 0) {
        alert('Please select a rating first!');
        return;
      }

      // Get user identification
      const userId = await lanchDrapUserIdManager.getUserId();

      if (!userId) {
        alert('Unable to get user ID. Please try again.');
        return;
      }

      // Disable the button and show loading state
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
      submitButton.style.opacity = '0.6';
      submitButton.style.cursor = 'not-allowed';

      const comment = commentInput.value.trim();

      try {
        const ratingData = {
          userId: userId,
          restaurant: restaurantId,
          orderDate: orderDate,
          rating: currentRating,
          comment: comment,
          timestamp: new Date().toISOString(),
        };

        // Send to Cloudflare Worker
        const response = await fetch(
          LanchDrapConfig.getApiUrl(LanchDrapConfig.CONFIG.ENDPOINTS.RATINGS),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(ratingData),
          }
        );

        const responseData = await response.json();

        if (response.ok) {
          // Reload the popup with fresh data
          loadLast10Restaurants();
        } else if (response.status === 409) {
          // Rating already exists - reload to show updated state
          loadLast10Restaurants();
        } else {
          throw new Error(
            `Failed to submit rating: ${responseData.error?.message || 'Unknown error'}`
          );
        }
      } catch (_error) {
        // Re-enable the button on error
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
        submitButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
      }
    });

    // Hide forever functionality
    hideForeverButton.addEventListener('click', async () => {
      if (
        !confirm(
          `Are you sure you want to submit your rating and hide "${restaurantName}" forever? This action cannot be undone.`
        )
      ) {
        return;
      }

      // Disable the button and show loading state
      hideForeverButton.disabled = true;
      hideForeverButton.textContent = 'Submitting & Hiding...';
      hideForeverButton.style.opacity = '0.6';
      hideForeverButton.style.cursor = 'not-allowed';

      try {
        // Get user identification
        const userId = await lanchDrapUserIdManager.getUserId();

        if (!userId) {
          alert('Unable to get user ID. Please try again.');
          return;
        }

        // First submit the rating
        const comment = commentInput.value.trim();
        const ratingData = {
          userId: userId,
          restaurant: restaurantId,
          orderDate: orderDate,
          items:
            selectedMenuItems.length > 0
              ? selectedMenuItems.map((item) => ({
                  id: Date.now() + Math.random(), // Generate a unique ID
                  itemId: `item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`, // Generate itemId
                  label: item.label,
                  description: item.fullDescription || item.label,
                  price: 0, // Default price since we don't have pricing info in edit mode
                  quantity: item.quantity,
                  specialRequest: null,
                }))
              : [
                  {
                    id: Date.now() + Math.random(),
                    itemId: `item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                    label: 'Unknown Items',
                    description: 'Unknown Items',
                    price: 0,
                    quantity: 1,
                    specialRequest: null,
                  },
                ],
          rating: currentRating,
          comment: comment,
          timestamp: new Date().toISOString(),
        };

        const response = await fetch(
          LanchDrapConfig.getApiUrl(LanchDrapConfig.CONFIG.ENDPOINTS.RATINGS),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(ratingData),
          }
        );

        if (!response.ok && response.status !== 409) {
        }

        // Then store hidden restaurant in chrome storage
        const hiddenRestaurants = await chrome.storage.local.get(['hiddenRestaurants']);
        const hiddenList = hiddenRestaurants.hiddenRestaurants || [];

        if (!hiddenList.includes(restaurantId)) {
          hiddenList.push(restaurantId);
          await chrome.storage.local.set({ hiddenRestaurants: hiddenList });
        }

        // Reload the restaurant list to reflect the hidden restaurant
        loadLast10Restaurants();
      } catch (_error) {
        // Error hiding restaurant - silently continue

        // Re-enable the button on error
        hideForeverButton.disabled = false;
        hideForeverButton.textContent = 'Submit & Hide Forever';
        hideForeverButton.style.opacity = '1';
        hideForeverButton.style.cursor = 'pointer';
      }
    });
  }

  // Load data when popup opens
  loadLast10Restaurants();
});
