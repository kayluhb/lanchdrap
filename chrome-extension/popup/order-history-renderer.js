// Order history renderer - handles rendering of restaurant order history
// Extracted from popup.js for better modularity

window.LanchDrapOrderHistoryRenderer = (() => {
  /**
   * Render order history for restaurants
   * @param {HTMLElement} container - Container element to render into
   * @param {Array<Object>} restaurants - Array of restaurant objects with order history
   * @param {Object} options - Rendering options
   * @returns {Promise<void>}
   */
  async function renderOrderHistory(container, restaurants, options = {}) {
    const {
      userId = null,
      onRateClick = null,
      onDeleteClick = null,
      onEditRatingClick = null,
    } = options;

  if (!restaurants || restaurants.length === 0) {
    container.innerHTML = `
      <div class="no-data-message">
        <h3>No restaurant history found</h3>
        <p>You haven't ordered from any restaurants yet, or your order history is not available.</p>
      </div>
    `;
    return;
  }

  // Categorize restaurants
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const currentTime = today.getHours() * 60 + today.getMinutes();
  const cutoffTime = 12 * 60; // 12:00 PM

  const upcomingOrders = [];
  const needsRating = [];
  const ratedOrders = [];

  for (const restaurant of restaurants) {
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
  upcomingOrders.sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));
  needsRating.sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));
  ratedOrders.sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));

  // Render function for a single restaurant
  const renderRestaurant = (restaurant) => {
    // Format the last order date
    let lastOrderDate;
    if (window.LanchDrapDateFormatter?.formatDateString) {
      lastOrderDate = window.LanchDrapDateFormatter.formatDateString(restaurant.lastOrderDate);
    } else if (window.LanchDrapDOMUtils?.formatDateString) {
      lastOrderDate = window.LanchDrapDOMUtils.formatDateString(restaurant.lastOrderDate);
    } else {
      // Fallback
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

    const recentOrders = restaurant.recentOrders || [];
    const recentItems =
      recentOrders.length > 0 && recentOrders[0].items
        ? recentOrders[0].items.map((item) => item.label || 'Unknown Item').join(', ')
        : 'No items recorded';

    const restaurantName = restaurant.restaurantName || restaurant.restaurantId;

    // Check if order can be rated
    const orderDateString = restaurant.lastOrderDate;
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const isSameDay = orderDateString === todayString;
    const isPastDate = orderDateString < todayString;
    const currentTime = today.getHours() * 60 + today.getMinutes();
    const cutoffTime = 12 * 60;
    const forceRatings = !!window.LanchDrapConfig?.CONFIG?.SETTINGS?.TEMP_ENABLE_POPUP_RATINGS;
    const canRate = forceRatings || isPastDate || (isSameDay && currentTime >= cutoffTime);

    // Get rating emoji if rated
    let ratingEmoji = '';
    if (restaurant.hasRating && restaurant.ratingData) {
      ratingEmoji = window.LanchDrapRatingUtils?.getRatingEmoji?.(restaurant.ratingData.rating) || '⭐';
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

  container.innerHTML = htmlSections.join('');

  // Attach event listeners if callbacks provided
  if (onRateClick) {
    const rateButtons = container.querySelectorAll('.rate-button');
    rateButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        onRateClick({
          restaurantId: button.dataset.restaurantId,
          restaurantName: button.dataset.restaurantName,
          orderDate: button.dataset.orderDate,
        });
      });
    });
  }

  if (onDeleteClick) {
    const deleteButtons = container.querySelectorAll('.delete-order-button');
    deleteButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDeleteClick({
          restaurantId: button.dataset.restaurantId,
          restaurantName: button.dataset.restaurantName,
          orderDate: button.dataset.orderDate,
        });
      });
    });
  }

  if (onEditRatingClick) {
    const editLinks = container.querySelectorAll('.edit-rating-link');
    editLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        onEditRatingClick({
          restaurantId: link.dataset.restaurantId,
          restaurantName: link.dataset.restaurantName,
          orderDate: link.dataset.orderDate,
        });
      });
    });
  }

  // Handle trash button clicks (reveal delete button)
  const trashButtons = container.querySelectorAll('.restaurant-item-trash');
  trashButtons.forEach((trashButton) => {
    trashButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const restaurantItem = trashButton.closest('.restaurant-item');
      if (restaurantItem) {
        restaurantItem.classList.toggle('swiped');
      }
    });
  });

  // Close swipe when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.restaurant-item')) {
      const restaurantItems = container.querySelectorAll('.restaurant-item');
      restaurantItems.forEach((item) => {
        item.classList.remove('swiped');
      });
    }
  });
  }

  return {
    renderOrderHistory,
  };
})();

