// Rating widget utilities for LanchDrap extension
// Handles rating widget functionality and floating button

// Create global namespace for rating widget utilities
window.LanchDrapRatingWidget = (() => {
  let ratingWidget = null;
  let orderData = null;

  // Function to inject rating widget into the page
  async function injectRatingWidget() {
    console.log('LanchDrap: injectRatingWidget called', {
      ratingWidget: !!ratingWidget,
      orderData: orderData,
      restaurantName: orderData?.restaurant || 'Unknown Restaurant',
    });

    if (ratingWidget) {
      console.log('LanchDrap: Rating widget already exists, returning');
      return; // Already injected
    }

    const restaurantName = orderData?.restaurant || 'Unknown Restaurant';

    // Get restaurant menu items for selection
    let menuItems = [];
    try {
      if (typeof LanchDrapApiClient !== 'undefined' && typeof LanchDrapConfig !== 'undefined') {
        const apiClient = new LanchDrapApiClient.ApiClient(
          LanchDrapConfig.CONFIG.API_BASE_URL,
          LanchDrapConfig.CONFIG.ENDPOINTS
        );
        const restaurantData = await apiClient.searchRestaurantByName(restaurantName);
        menuItems = restaurantData.menu || [];
      }
    } catch (_error) {
      // Fallback to parsing menu from current page
      menuItems = window.LanchDrapOrderParser
        ? window.LanchDrapOrderParser.parseMenuFromPage()
        : [];
    }

    const widget = document.createElement('div');
    widget.id = 'lunchdrop-rating-widget';
    widget.innerHTML = `
          <div class="ld-rating-container">
              <div class="ld-rating-header">
                  <span class="ld-rating-title">Rate your order</span>
                  <button class="ld-rating-close" id="ld-rating-close">×</button>
              </div>
              <div class="ld-restaurant-name">
                  <span class="ld-restaurant-title">${restaurantName}</span>
              </div>
              <div class="ld-menu-selection">
                  <label class="ld-menu-label">What did you order?</label>
                  <div class="ld-menu-autocomplete">
                      <input type="text" id="ld-menu-search" placeholder="Search menu items..." autocomplete="off">
                      <div class="ld-menu-dropdown" id="ld-menu-dropdown"></div>
                  </div>
                  <div class="ld-selected-items" id="ld-selected-items"></div>
              </div>
              <div class="ld-rating-stars">
                  <span class="ld-star" data-rating="1">🤠</span>
                  <span class="ld-star" data-rating="2">🤠</span>
                  <span class="ld-star" data-rating="3">🤠</span>
                  <span class="ld-star" data-rating="4">🤠</span>
                  <span class="ld-star" data-rating="5">🤠</span>
              </div>
              <div class="ld-rating-display">
                  <span id="ld-current-rating">0</span>/5
              </div>
              <textarea class="ld-rating-comment" placeholder="Add a comment about your order..."></textarea>
              <button class="ld-rating-submit" id="ld-rating-submit">Submit Rating</button>
          </div>
      `;

    // Inject the CSS styles
    if (!document.getElementById('lanchdrap-extension-styles')) {
      const styleLink = document.createElement('link');
      styleLink.id = 'lanchdrap-extension-styles';
      styleLink.rel = 'stylesheet';
      styleLink.href = chrome.runtime.getURL('content-styles.css');
      document.head.appendChild(styleLink);
    }
    document.body.appendChild(widget);
    ratingWidget = widget;

    console.log('LanchDrap: Rating widget injected successfully', {
      widgetId: widget.id,
      restaurantName: restaurantName,
      menuItemsCount: menuItems.length,
      widgetElement: widget,
      widgetVisible: widget.offsetParent !== null,
      widgetStyle: window.getComputedStyle(widget).display,
    });

    // Add event listeners
    setupRatingWidgetEvents(menuItems);
  }

  function setupRatingWidgetEvents(menuItems = []) {
    const stars = ratingWidget.querySelectorAll('.ld-star');
    const ratingDisplay = ratingWidget.querySelector('#ld-current-rating');
    const commentInput = ratingWidget.querySelector('.ld-rating-comment');
    const submitButton = ratingWidget.querySelector('#ld-rating-submit');
    const closeButton = ratingWidget.querySelector('#ld-rating-close');
    const menuSearch = ratingWidget.querySelector('#ld-menu-search');
    const menuDropdown = ratingWidget.querySelector('#ld-menu-dropdown');
    const selectedItems = ratingWidget.querySelector('#ld-selected-items');

    let currentRating = 0;
    let selectedMenuItems = [];

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

      items.forEach((item) => {
        if (selectedMenuItems.includes(item)) return; // Skip already selected items

        const option = document.createElement('div');
        option.className = 'ld-menu-option';
        option.textContent = item;
        option.addEventListener('click', () => {
          selectMenuItem(item);
          menuSearch.value = '';
          menuDropdown.style.display = 'none';
        });
        menuDropdown.appendChild(option);
      });

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
      selectedMenuItems.forEach((item) => {
        const tag = document.createElement('div');
        tag.className = 'ld-selected-item';
        tag.innerHTML = `
          <span>${item}</span>
          <button class="ld-remove-item" data-item="${item}">×</button>
        `;
        selectedItems.appendChild(tag);
      });

      // Add event listeners for remove buttons
      selectedItems.querySelectorAll('.ld-remove-item').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          removeMenuItem(e.target.dataset.item);
        });
      });
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

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!menuSearch.contains(e.target) && !menuDropdown.contains(e.target)) {
        menuDropdown.style.display = 'none';
      }
    });

    stars.forEach((star) => {
      star.addEventListener('click', function () {
        const rating = parseInt(this.dataset.rating, 10);
        currentRating = rating;
        updateStarDisplay();
        ratingDisplay.textContent = rating;
      });

      star.addEventListener('mouseenter', function () {
        const rating = parseInt(this.dataset.rating, 10);
        highlightStars(rating);
      });

      star.addEventListener('mouseleave', () => {
        updateStarDisplay();
      });
    });

    function updateStarDisplay() {
      stars.forEach((star, index) => {
        if (index < currentRating) {
          star.classList.add('active');
          star.style.opacity = '1';
        } else {
          star.classList.remove('active');
          star.style.opacity = '0.5';
        }
      });
    }

    function highlightStars(rating) {
      stars.forEach((star, index) => {
        if (index < rating) {
          star.style.color = '#ffd700';
          star.style.opacity = '1';
        } else {
          star.style.color = '#ccc';
          star.style.opacity = '0.5';
        }
      });
    }

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
          orderId: orderData?.orderId || window.LanchDrapDOMUtils.generateOrderId(),
          restaurant: orderData?.restaurant || 'Unknown Restaurant',
          items:
            selectedMenuItems.length > 0
              ? selectedMenuItems
              : orderData?.items || ['Unknown Items'],
          rating: currentRating,
          comment: comment,
          timestamp: new Date().toISOString(),
          orderTotal: orderData?.total || '$0.00',
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
          alert('Rating submitted successfully!');
          hideRatingWidget();
        } else if (response.status === 409) {
          // Restaurant already rated today
          const errorData = await response.json();
          alert(errorData.error || 'You have already rated this restaurant today.');
          hideRatingWidget();
        } else {
          throw new Error('Failed to submit rating');
        }
      } catch (_error) {
        alert('Error submitting rating. Please try again.');

        // Re-enable the button on error
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Rating';
        submitButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
      }
    });

    closeButton.addEventListener('click', hideRatingWidget);
  }

  function hideRatingWidget() {
    if (ratingWidget) {
      ratingWidget.remove();
      ratingWidget = null;
    }
  }

  // Function to extract restaurant information from the current page
  function extractRestaurantInfoFromPage() {
    try {
      // Try to get restaurant name from the page title or restaurant name element
      let restaurantName = null;

      // Method 1: Look for restaurant name in common selectors
      const restaurantNameElement = document.querySelector('.text-3xl.font-bold');
      if (restaurantNameElement) {
        restaurantName = restaurantNameElement.textContent?.trim();
      }

      // Method 2: Look for restaurant name in page title
      if (!restaurantName) {
        const pageTitle = document.title;
        if (pageTitle && !pageTitle.includes('LunchDrop')) {
          restaurantName = pageTitle;
        }
      }

      // Method 3: Try to extract from URL if on a restaurant detail page
      if (!restaurantName) {
        const urlParts = window.location.pathname.split('/');
        if (urlParts.length >= 4 && urlParts[1] === 'app') {
          const restaurantId = urlParts[urlParts.length - 1];
          // Check if it's not a date
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(restaurantId)) {
            // Try to get name from localStorage
            const localKey = `restaurant_name:${restaurantId}`;
            const storedName = localStorage.getItem(localKey);
            if (storedName) {
              restaurantName = storedName;
            } else {
              restaurantName = restaurantId; // Use ID as fallback
            }
          }
        }
      }

      if (restaurantName) {
        const restaurantInfo = {
          restaurant: restaurantName,
          items: ['Manual rating - no order detected'],
          total: 'Unknown',
          orderId: window.LanchDrapDOMUtils.generateOrderId(),
        };
        return restaurantInfo;
      }
      return null;
    } catch (_error) {
      return null;
    }
  }

  // Function to detect LanchDrap's rating prompt
  function detectLunchDropRatingPrompt() {
    try {
      // Look for "How was [Restaurant Name]?" pattern
      const ratingPromptMatch = document.body.textContent.match(/How was (.+?)\?/i);

      if (ratingPromptMatch) {
        const restaurantName = ratingPromptMatch[1].trim();

        // Create order data from the detected restaurant name
        const detectedOrderData = {
          restaurant: restaurantName,
          items: ['Detected from LanchDrap prompt'],
          total: 'Unknown',
          orderId: window.LanchDrapDOMUtils.generateOrderId(),
        };

        // Store the detected order data
        orderData = detectedOrderData;

        // Check if utilities are loaded, if not, wait and try again
        if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
          // Store the prompt detection for later processing
          localStorage.setItem(
            'lanchdrap_pending_rating_prompt',
            JSON.stringify({
              restaurant: restaurantName,
              timestamp: new Date().toISOString(),
            })
          );
          return true;
        }

        // Show our rating widget - DISABLED FOR NOW
        // setTimeout(() => {
        //   console.log(
        //     'LanchDrap Rating Extension: Attempting to show rating widget for immediate prompt'
        //   );
        //   injectRatingWidget();
        // }, 1000);

        return true;
      }
      return false;
    } catch (_error) {
      return false;
    }
  }

  // Add a floating button to manually trigger the rating widget
  function addFloatingButton() {
    const button = document.createElement('div');
    button.id = 'lanchdrap-rating-trigger';
    button.innerHTML = '🍽️ Rate';
    button.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9999;
          background: #ff6b6b;
          color: white;
          padding: 12px 20px;
          border-radius: 25px;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(255, 107, 107, 0.3);
          transition: all 0.2s ease;
      `;

    button.addEventListener('mouseenter', function () {
      this.style.transform = 'scale(1.05)';
      this.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.4)';
    });

    button.addEventListener('mouseleave', function () {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 4px 16px rgba(255, 107, 107, 0.3)';
    });

    button.addEventListener('click', async () => {
      if (!ratingWidget) {
        // First try to detect LunchDrop rating prompt
        const hasPrompt = detectLunchDropRatingPrompt();

        if (hasPrompt) {
          await injectRatingWidget();
        } else {
          // Try to extract restaurant information from the current page
          const restaurantInfo = extractRestaurantInfoFromPage();

          if (restaurantInfo) {
            // Set the order data with extracted information
            orderData = restaurantInfo;
            await injectRatingWidget();
          } else {
            button.style.background = '#ffa500';
            button.innerHTML = '🍽️ No Restaurant';
            setTimeout(() => {
              button.style.background = '#ff6b6b';
              button.innerHTML = '🍽️ Rate';
            }, 2000);
          }
        }
      } else {
        hideRatingWidget();
      }
    });

    document.body.appendChild(button);
  }

  // Function to set order data (called from main content script)
  function setOrderData(data) {
    orderData = data;
  }

  // Function to get order data (called from main content script)
  function getOrderData() {
    return orderData;
  }

  // Return public API
  return {
    injectRatingWidget,
    hideRatingWidget,
    detectLunchDropRatingPrompt,
    addFloatingButton,
    setOrderData,
    getOrderData,
  };
})();
