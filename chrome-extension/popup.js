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

    const restaurantsHTML = restaurants
      .map((restaurant) => {
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
            ? recentOrders[0].items
                .map((item) => item.name || item.fullDescription || 'Unknown Item')
                .join(', ')
            : 'No items recorded';

        // Use restaurant name directly from the data
        const restaurantName = restaurant.restaurantName || restaurant.restaurantId;

        // Check if the order date is in the past OR it's today but after 12:30 PM
        // Handle timezone issues by comparing date strings directly
        const orderDateString = restaurant.lastOrderDate; // Should be in YYYY-MM-DD format
        const today = new Date();
        const todayString = today.toISOString().split('T')[0]; // Get YYYY-MM-DD format for today

        // Check if it's the same day
        const isSameDay = orderDateString === todayString;

        // Check if it's in the past (before today)
        const isPastDate = orderDateString < todayString;

        // Check if it's after 12:30 PM today
        const currentTime = today.getHours() * 60 + today.getMinutes();
        const cutoffTime = 12 * 60 + 30; // 12:30 PM in minutes

        // Can rate if: order is in the past OR (it's today AND after 12:30 PM)
        // Temporary override via config flag
        const forceRatings = !!window.LanchDrapConfig?.CONFIG?.SETTINGS?.TEMP_ENABLE_POPUP_RATINGS;
        const canRate = forceRatings || isPastDate || (isSameDay && currentTime >= cutoffTime);

        return `
          <div class="restaurant-item" data-restaurant-id="${restaurant.restaurantId}" data-restaurant-name="${restaurantName}" data-order-date="${restaurant.lastOrderDate}">
            <button class="restaurant-item-trash" title="Delete this order">🗑️</button>
            <div class="restaurant-item-content">
              <div class="restaurant-header">
                <span class="restaurant-name">${restaurantName}</span>
                <span class="last-order-date">${lastOrderDate}</span>
                <span class="order-rated-badge" data-restaurant-id="${restaurant.restaurantId}" data-order-date="${restaurant.lastOrderDate}" style="display:none;">Rated ⭐</span>
              </div>
              <div class="restaurant-stats">
                <div class="stat-items">${recentItems}</div>
              </div>
              ${
                canRate
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
      })
      .join('');

    orderHistoryDiv.innerHTML = `
      <h3>Recent Orders</h3>
      ${restaurantsHTML}
    `;

    // Add event listeners for rate buttons
    addRateButtonListeners();

    // Add event listeners for delete functionality
    addDeleteButtonListeners();

    // Populate rating badges next to orders if they are already rated
    populateOrderRatingBadges();
  }

  // Add event listeners for rate buttons
  function addRateButtonListeners() {
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
  }

  // Populate rating badges next to orders if they have been rated already
  async function populateOrderRatingBadges() {
    try {
      const userId = await lanchDrapUserIdManager.getUserId();
      if (!userId) return;

      const items = document.querySelectorAll('.restaurant-item');
      for (const item of items) {
        const restaurantId = item.getAttribute('data-restaurant-id');
        const orderDate = item.getAttribute('data-order-date');
        const badge = item.querySelector('.order-rated-badge');
        if (!restaurantId || !orderDate || !badge) continue;

        const params = new URLSearchParams();
        params.append('userId', userIdentification.userId);
        params.append('restaurantId', restaurantId);
        params.append('orderDate', orderDate);

        try {
          const response = await fetch(
            `${LanchDrapConfig.getApiUrl(LanchDrapConfig.CONFIG.ENDPOINTS.RATINGS)}/order?${params.toString()}`
          );
          if (!response.ok) continue;
          const result = await response.json();
          if (result.success && result.data && result.data.hasRating && result.data.rating) {
            const ratingVal = result.data.rating.rating;
            const emojiMap = { 1: '🤮', 2: '😐', 3: '🤤', 4: '🤯' };
            const emoji = emojiMap[ratingVal] || '⭐';
            badge.textContent = emoji;
            badge.style.display = 'inline';
            badge.title = 'You rated this order';
            badge.style.marginLeft = '4px';
          }
        } catch (_e) {
          // ignore network/parse errors for badges
        }
      }
    } catch (_e) {}
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
        restaurantItem.classList.toggle('swiped');
      });
    }

    // Add click handlers for delete buttons
    for (const deleteButton of deleteButtons) {
      deleteButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const restaurantItem = deleteButton.closest('.restaurant-item');
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

          // Remove the item from the UI
          restaurantItem.remove();

          // Check if there are any remaining items
          const remainingItems = document.querySelectorAll('.restaurant-item');
          if (remainingItems.length === 0) {
            // Reload the restaurant list to show updated data
            loadLast10Restaurants();
          }
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
          
          <!-- Rating Overview Loading Skeleton -->
          <div class="rating-overview-skeleton" id="rating-overview-skeleton" style="
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 12px;
            margin: 10px 0;
            animation: pulse 1.5s ease-in-out infinite;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="
                background: #e9ecef;
                height: 16px;
                width: 120px;
                border-radius: 4px;
                animation: shimmer 1.5s ease-in-out infinite;
              "></div>
              <div style="
                background: #e9ecef;
                height: 14px;
                width: 60px;
                border-radius: 4px;
                animation: shimmer 1.5s ease-in-out infinite;
              "></div>
            </div>
            <div style="
              background: #e9ecef;
              height: 12px;
              width: 200px;
              border-radius: 4px;
              animation: shimmer 1.5s ease-in-out infinite;
            "></div>
          </div>
          
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

      // Get the full restaurant menu for autocomplete
      // Support both array menus and date-keyed object menus
      const allMenuItems = new Set();
      // Prefer top-level menu, then nested restaurant.menu
      const rawMenu = Array.isArray(restaurantData?.menu)
        ? restaurantData.menu
        : restaurantData?.restaurant?.menu;
      if (Array.isArray(rawMenu)) {
        for (const entry of rawMenu) {
          if (typeof entry === 'string') {
            allMenuItems.add(entry);
          } else if (entry && typeof entry === 'object' && entry.name) {
            allMenuItems.add(entry.name);
          }
        }
      } else if (rawMenu && typeof rawMenu === 'object') {
        for (const dateKey of Object.keys(rawMenu)) {
          const dateMenuItems = Array.isArray(rawMenu[dateKey]) ? rawMenu[dateKey] : [];
          for (const item of dateMenuItems) {
            if (typeof item === 'string') {
              allMenuItems.add(item);
            } else if (item?.name) {
              allMenuItems.add(item.name);
            }
          }
        }
      }
      menuItems = Array.from(allMenuItems);

      // Fallback: if no menu found, try searching by restaurant name
      if ((!menuItems || menuItems.length === 0) && restaurantName) {
        try {
          const searchResult = await apiClient.searchRestaurantByName(restaurantName);
          if (Array.isArray(searchResult?.menu)) {
            menuItems = [...new Set(searchResult.menu)];
          }
        } catch (_e) {
          // ignore fallback errors
        }
      }

      // Extract user's order for the specific date if available
      if (restaurantData?.userOrder?.items && restaurantData.userOrder.items.length > 0) {
        selectedMenuItems = restaurantData.userOrder.items.map((item) => {
          if (typeof item === 'string') {
            return LanchDrapModels.MenuItem.fromString(item);
          }
          return LanchDrapModels.MenuItem.fromJSON(item);
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

      // Load restaurant rating statistics
      await loadRestaurantRatingStats(restaurantId);

      // Update restaurant info section
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

    // Function to load restaurant rating statistics
    async function loadRestaurantRatingStats(restaurantId) {
      try {
        const response = await fetch(
          `${LanchDrapConfig.getApiUrl(LanchDrapConfig.CONFIG.ENDPOINTS.RATINGS)}/stats?restaurant=${encodeURIComponent(restaurantId)}`
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            displayRestaurantRatingStats(result.data);
          } else {
            // Hide skeleton even if API returns unsuccessful response
            hideRatingOverviewSkeleton();
          }
        } else {
          // Hide skeleton on HTTP error
          hideRatingOverviewSkeleton();
        }
      } catch (_error) {
        // Hide skeleton on network error
        hideRatingOverviewSkeleton();
      }
    }

    // Helper function to hide the rating overview skeleton
    function hideRatingOverviewSkeleton() {
      const skeleton = document.getElementById('rating-overview-skeleton');
      if (skeleton) {
        skeleton.style.display = 'none';
      }
    }

    // Function to display restaurant rating statistics
    function displayRestaurantRatingStats(stats) {
      // Hide the loading skeleton
      hideRatingOverviewSkeleton();

      // Find or create rating stats section
      let statsSection = document.querySelector('.restaurant-rating-stats');
      if (!statsSection) {
        statsSection = document.createElement('div');
        statsSection.className = 'restaurant-rating-stats';
        statsSection.style.cssText = `
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 12px;
          margin: 10px 0;
          font-size: 0.9em;
        `;

        // Insert after the rating comment
        const ratingComment = document.querySelector('.rating-comment');
        if (ratingComment) {
          ratingComment.insertAdjacentElement('afterend', statsSection);
        }
      }

      if (stats.totalRatings > 0) {
        const averageEmoji = getRatingEmoji(Math.round(stats.averageRating));
        const distribution = stats.ratingDistribution
          .map((dist) => `${getRatingEmoji(dist.stars)} ${dist.count}`)
          .join(' • ');

        statsSection.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong>Restaurant Rating: ${averageEmoji} ${stats.averageRating.toFixed(1)}</strong>
            <span style="color: #666;">${stats.totalRatings} rating${stats.totalRatings !== 1 ? 's' : ''}</span>
          </div>
          <div style="color: #666; font-size: 0.85em;">
            ${distribution}
          </div>
        `;
      } else {
        statsSection.innerHTML = `
          <div style="color: #666; text-align: center;">
            No ratings yet - be the first to rate this restaurant!
          </div>
        `;
      }
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
          <span class="order-item-name">${item.name}</span>
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
          const items = selectedMenuItems.map((item) => item.toJSON());

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
        // Check if this item is already selected by comparing names
        const isAlreadySelected = selectedMenuItems.some(
          (selected) => selected.name.toLowerCase() === item.toLowerCase()
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
          <span>${item.name}</span>
          <button class="remove-item" data-item="${item.name}">×</button>
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
          items:
            selectedMenuItems.length > 0
              ? selectedMenuItems.map((item) => item.toJSON())
              : [
                  {
                    name: 'Unknown Items',
                    quantity: 1,
                    options: '',
                    fullDescription: 'Unknown Items',
                  },
                ],
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
          // Go back to history
          const orderHistoryDiv = document.getElementById('order-history');
          orderHistoryDiv.innerHTML = originalContent;
          addRateButtonListeners();
          addDeleteButtonListeners();
        } else if (response.status === 409) {
          // Rating already exists - silently continue
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
              ? selectedMenuItems.map((item) => item.toJSON())
              : [
                  {
                    name: 'Unknown Items',
                    quantity: 1,
                    options: '',
                    fullDescription: 'Unknown Items',
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

        // Go back to history and refresh
        const orderHistoryDiv = document.getElementById('order-history');
        orderHistoryDiv.innerHTML = originalContent;
        addRateButtonListeners();
        addDeleteButtonListeners();

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
