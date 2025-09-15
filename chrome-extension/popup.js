document.addEventListener('DOMContentLoaded', () => {
  const orderHistoryDiv = document.getElementById('order-history');

  // Show loading message
  orderHistoryDiv.innerHTML = '<p class="no-orders">Loading your restaurant history...</p>';

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

        // Check if the order date has passed (more than 1 day ago)
        const orderDate = new Date(restaurant.lastOrderDate);
        const today = new Date();
        const daysSinceOrder = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));
        const canRate = daysSinceOrder >= 1;

        return `
          <div class="restaurant-item" data-restaurant-id="${restaurant.restaurantId}" data-restaurant-name="${restaurantName}">
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
        `;
      })
      .join('');

    orderHistoryDiv.innerHTML = `
      <h3>Recent Orders</h3>
      ${restaurantsHTML}
    `;

    // Add event listeners for rate buttons
    addRateButtonListeners();
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
      });
    }
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
            <button class="edit-order-button" id="edit-order-button" style="display: none;">Edit order</button>
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
            <div class="rating-option" data-rating="1">
              <span class="rating-emoji">🤮</span>
              <span class="rating-text">Never Again</span>
            </div>
            <div class="rating-option" data-rating="2">
              <span class="rating-emoji">😐</span>
              <span class="rating-text">Meh</span>
            </div>
            <div class="rating-option" data-rating="3">
              <span class="rating-emoji">🤤</span>
              <span class="rating-text">Pretty Good</span>
            </div>
            <div class="rating-option" data-rating="4">
              <span class="rating-emoji">🤯</span>
              <span class="rating-text">Life Changing</span>
            </div>
          </div>
          
          <textarea class="rating-comment" placeholder="Add a comment about your order..."></textarea>
          
          <div class="rating-actions">
            <button class="rating-submit" id="rating-submit">Submit Rating</button>
            <button class="hide-forever" id="hide-forever">🚫 Hide Forever</button>
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
    const ratingDisplay = document.getElementById('current-rating-text');
    const commentInput = document.querySelector('.rating-comment');
    const submitButton = document.getElementById('rating-submit');
    const hideForeverButton = document.getElementById('hide-forever');
    const menuSearch = document.getElementById('menu-search');
    const menuDropdown = document.getElementById('menu-dropdown');
    const selectedItems = document.getElementById('selected-items');

    let currentRating = 0;
    let selectedMenuItems = [];
    let menuItems = [];

    const ratingTexts = {
      1: 'Never Again 🤮',
      2: 'Meh 😐',
      3: 'Pretty Good 🤤',
      4: 'Life Changing 🤯',
    };

    // Back button functionality
    backButton.addEventListener('click', () => {
      const orderHistoryDiv = document.getElementById('order-history');
      orderHistoryDiv.innerHTML = originalContent;
      addRateButtonListeners(); // Re-add listeners after restoring content
    });

    // Load restaurant details and user's last order
    try {
      const apiClient = new LanchDrapApiClient.ApiClient(
        LanchDrapConfig.CONFIG.API_BASE_URL,
        LanchDrapConfig.CONFIG.ENDPOINTS
      );

      // Get user ID for the request
      const userIdentification = await lanchDrapUserIdManager.getUserIdentification();

      // Make a single request to get restaurant data with user's order for the specific date
      const params = new URLSearchParams();
      params.append('userId', userIdentification?.userId || '');
      params.append('orderDate', orderDate || '');
      const endpoint = `${apiClient.getEndpoint('RESTAURANTS_GET_BY_ID')}/${restaurantId}?${params.toString()}`;

      const restaurantData = await apiClient.request(endpoint);
      menuItems = restaurantData?.menu || [];

      // Extract user's order for the specific date if available
      if (restaurantData?.userOrder?.items && restaurantData.userOrder.items.length > 0) {
        selectedMenuItems = restaurantData.userOrder.items
          .map((item) => item.name || item.fullDescription || item)
          .filter(Boolean);

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

      // Update restaurant info section
    } catch (_error) {
      // Could not load restaurant data, continue with empty arrays
    }

    // Dedupe and sort menu items
    menuItems = [...new Set(menuItems)].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

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
          <span class="order-item-name">${item}</span>
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

    function hideEditMode() {
      const orderItemsDiv = document.getElementById('order-items');
      const editSection = document.getElementById('edit-order-section');
      const editButton = document.getElementById('edit-order-button');

      if (orderItemsDiv) orderItemsDiv.style.display = 'block';
      if (editSection) editSection.style.display = 'none';
      if (editButton) editButton.style.display = 'block';

      // Update the order display with current items
      renderOrderItems(selectedMenuItems);
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
        if (selectedMenuItems.includes(item)) continue;

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

    function selectMenuItem(item) {
      if (!selectedMenuItems.includes(item)) {
        selectedMenuItems.push(item);
        renderSelectedItems();
      }
    }

    function removeMenuItem(item) {
      selectedMenuItems = selectedMenuItems.filter((i) => i !== item);
      renderSelectedItems();
    }

    function renderSelectedItems() {
      selectedItems.innerHTML = '';
      for (const item of selectedMenuItems) {
        const tag = document.createElement('div');
        tag.className = 'selected-item';
        tag.innerHTML = `
          <span>${item}</span>
          <button class="remove-item" data-item="${item}">×</button>
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
      if (menuSearch.value) {
        const filteredItems = filterMenuItems(menuSearch.value);
        renderMenuDropdown(filteredItems);
      }
    });

    // Rating options functionality
    for (const option of ratingOptions) {
      option.addEventListener('click', function () {
        const rating = parseInt(this.dataset.rating, 10);
        currentRating = rating;
        updateRatingDisplay();
        ratingDisplay.textContent = ratingTexts[rating];
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

    // Edit order functionality
    const editOrderButton = document.getElementById('edit-order-button');
    const doneEditingButton = document.getElementById('done-editing');

    if (editOrderButton) {
      editOrderButton.addEventListener('click', showEditMode);
    }

    if (doneEditingButton) {
      doneEditingButton.addEventListener('click', hideEditMode);
    }

    // Submit rating
    submitButton.addEventListener('click', async () => {
      if (currentRating === 0) {
        alert('Please select a rating first!');
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
          orderId: `popup_${Date.now()}`,
          restaurant: restaurantName,
          items: selectedMenuItems.length > 0 ? selectedMenuItems : ['Unknown Items'],
          rating: currentRating,
          comment: comment,
          timestamp: new Date().toISOString(),
          orderTotal: 'Unknown',
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

        if (response.ok) {
          // Go back to history
          const orderHistoryDiv = document.getElementById('order-history');
          orderHistoryDiv.innerHTML = originalContent;
          addRateButtonListeners();
        } else if (response.status === 409) {
          const _errorData = await response.json();
          // Rating already exists - silently continue
        } else {
          throw new Error('Failed to submit rating');
        }
      } catch (_error) {
        // Error submitting rating - silently continue

        // Re-enable the button on error
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Rating';
        submitButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
      }
    });

    // Hide forever functionality
    hideForeverButton.addEventListener('click', async () => {
      if (
        !confirm(
          `Are you sure you want to hide "${restaurantName}" forever? This action cannot be undone.`
        )
      ) {
        return;
      }

      // Disable the button and show loading state
      hideForeverButton.disabled = true;
      hideForeverButton.textContent = 'Hiding...';
      hideForeverButton.style.opacity = '0.6';
      hideForeverButton.style.cursor = 'not-allowed';

      try {
        // Store hidden restaurant in chrome storage
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

        // Reload the restaurant list to reflect the hidden restaurant
        loadLast10Restaurants();
      } catch (_error) {
        // Error hiding restaurant - silently continue

        // Re-enable the button on error
        hideForeverButton.disabled = false;
        hideForeverButton.textContent = '🚫 Hide Forever';
        hideForeverButton.style.opacity = '1';
        hideForeverButton.style.cursor = 'pointer';
      }
    });
  }

  // Load data when popup opens
  loadLast10Restaurants();
});
