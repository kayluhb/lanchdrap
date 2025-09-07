// Content script for lunchdrop.com
(() => {
  // Utilities are loaded via manifest, check availability
  console.log('LanchDrap Rating Extension: Checking utility availability...');
  console.log('LanchDrapApiClient available:', typeof LanchDrapApiClient !== 'undefined');
  console.log('LanchDrapConfig available:', typeof LanchDrapConfig !== 'undefined');
  console.log('lanchDrapUserIdManager available:', typeof lanchDrapUserIdManager !== 'undefined');
  console.log('Window object keys:', Object.keys(window).filter(key => key.includes('LanchDrap')));
  console.log('Available globals:', {
    LanchDrapApiClient: typeof LanchDrapApiClient,
    LanchDrapConfig: typeof LanchDrapConfig,
    lanchDrapUserIdManager: typeof lanchDrapUserIdManager
  });

  // Start the main script
      initializeContentScript();

      // Submit any pending data that was stored locally
      setTimeout(() => {
        submitPendingData();
      }, 2000);

  function initializeContentScript() {
    let orderData = null;
    let ratingWidget = null;

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'getOrderData') {
        sendResponse(orderData);
      }
    });

    // Function to extract order data from the page
    function extractOrderData() {
      try {
        // Common selectors for order information on food delivery sites
        const selectors = {
          restaurant: [
            '[data-testid="restaurant-name"]',
            '.restaurant-name',
            'h1',
            '[class*="restaurant"]',
            '[class*="vendor"]',
            // Specific LunchDrop selector for restaurant name on detail page (XPath style)
            '//*[@id="app"]/div[1]/div[2]/div[2]/div[7]/div/div/div[1]/div[1]',
            // CSS equivalent for detail page
            '#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)',
            // Specific LunchDrop selector for restaurant name on daily page (XPath style)
            '//*[@id="app"]/div[1]/div[2]/div[2]/div[6]/div/div/div/div[1]',
            // CSS equivalent for daily page
            '#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(6) > div > div > div > div:nth-child(1)',
          ],
          items: [
            '[data-testid="menu-item"]',
            '.menu-item',
            '.item-name',
            '[class*="item"]',
            '[class*="product"]',
          ],
          total: [
            '[data-testid="total"]',
            '.total',
            '.order-total',
            '[class*="total"]',
            '[class*="amount"]',
          ],
          orderId: ['[data-testid="order-id"]', '.order-id', '[class*="order"]', '[class*="id"]'],
        };

        const restaurantElement = findElement(selectors.restaurant);
        const restaurant = restaurantElement?.textContent?.trim() || 'Unknown Restaurant';

        // Log which selector found the restaurant name for debugging
        if (restaurantElement) {
          console.log('LanchDrap Rating Extension: Found restaurant name:', restaurant);
        } else {
          console.log('LanchDrap Rating Extension: Could not find restaurant name element');
        }
        const items = Array.from(findElements(selectors.items))
          .map((item) => item.textContent?.trim())
          .filter(Boolean);
        const total = findElement(selectors.total)?.textContent?.trim() || '$0.00';
        const orderId = findElement(selectors.orderId)?.textContent?.trim() || generateOrderId();

        orderData = {
          restaurant,
          items: items.length > 0 ? items : ['Unknown Items'],
          total: total,
          orderId: orderId,
        };

        console.log('LanchDrap Rating Extension: Order data extracted:', orderData);
        return orderData;
      } catch (error) {
        console.error('LanchDrap Rating Extension: Error extracting order data:', error);
        return null;
      }
    }

    function findElement(selectors) {
      for (const selector of selectors) {
        // Handle both CSS selectors and XPath-style selectors
        let element = null;

        if (selector.startsWith('//') || selector.startsWith('*[@')) {
          // XPath-style selector - convert to CSS selector or use document.evaluate
          try {
            // Try to convert common XPath patterns to CSS selectors
            const cssSelector = convertXPathToCSS(selector);
            element = document.querySelector(cssSelector);
          } catch (error) {
            console.log('Could not convert XPath to CSS, trying direct evaluation:', error);
            // Fallback: try to find by text content or other means
            element = findElementByText(selector);
          }
        } else {
          // Regular CSS selector
          element = document.querySelector(selector);
        }

        if (element) return element;
      }
      return null;
    }

    function findElements(selectors) {
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) return elements;
      }
      return [];
    }

    function generateOrderId() {
      return 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Helper function to convert XPath-style selectors to CSS selectors
    function convertXPathToCSS(xpath) {
      // Handle the specific XPath pattern: //*[@id="app"]/div[1]/div[2]/div[2]/div[6]/div/div/div/div[1]
      if (xpath.includes('[@id="app"]')) {
        // Convert to CSS selector
        return '#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(6) > div > div > div > div:nth-child(1)';
      }

      // Handle other common XPath patterns
      return xpath
        .replace(/\/\//g, '') // Remove // at the beginning
        .replace(/\[@id="([^"]+)"\]/g, '#$1') // Convert [@id="value"] to #value
        .replace(/\[@class="([^"]+)"\]/g, '.$1') // Convert [@class="value"] to .value
        .replace(/\[(\d+)\]/g, ':nth-child($1)') // Convert [1] to :nth-child(1)
        .replace(/\//g, ' > '); // Convert / to > for CSS descendant selectors
    }

    // Helper function to find elements by text content or other fallback methods
    function findElementByText(selector) {
      // For the specific restaurant name element, try to find it by looking for common patterns
      if (selector.includes('app') && selector.includes('div[6]')) {
        // Try to find the restaurant name by looking for text that looks like a restaurant name
        const appElement = document.getElementById('app');
        if (appElement) {
          // Look for div elements that might contain restaurant names
          const divs = appElement.querySelectorAll('div');
          for (const div of divs) {
            const text = div.textContent?.trim();
            if (
              text &&
              text.length > 0 &&
              text.length < 100 &&
              !text.includes('$') &&
              !text.includes('Order') &&
              !text.includes('Total') &&
              !text.includes('Checkout')
            ) {
              // This might be a restaurant name
              return div;
            }
          }
        }
      }
      return null;
    }

    // Function to check if user has already rated this specific order
    async function hasUserRatedOrder(restaurantName, orderItems) {
      try {
        // Check if utilities are loaded
        if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
          console.log('Extension utilities not loaded yet, skipping rating check');
          return false;
        }

        const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL);
        const userIdentification = await lanchDrapUserIdManager.getUserIdentification();

        // Get user's ratings for this restaurant
        // Ratings endpoint removed - can't fetch ratings anymore
        const ratings = null;

        // Check if user has rated this specific order (same restaurant + same items)
        if (ratings && ratings.ratings && ratings.ratings.length > 0) {
          for (const rating of ratings.ratings) {
            // Compare items arrays (order doesn't matter)
            const ratingItems = rating.items || [];
            const currentItems = orderItems || [];

            // Check if the items match (same length and same items)
            if (ratingItems.length === currentItems.length) {
              const itemsMatch = ratingItems.every((item) =>
                currentItems.some(
                  (currentItem) => currentItem.toLowerCase().trim() === item.toLowerCase().trim()
                )
              );

              if (itemsMatch) {
                console.log(
                  'LanchDrap Rating Extension: User has already rated this specific order'
                );
                return true;
              }
            }
          }
        }

        return false;
      } catch (error) {
        console.error('Error checking if user has rated order:', error);
        return false; // Default to allowing rating if check fails
      }
    }

    // Function to create widget showing restaurant was already rated today
    function createAlreadyRatedWidget(existingRating) {
      if (ratingWidget) {
        ratingWidget.remove();
      }

      ratingWidget = document.createElement('div');
      ratingWidget.id = 'lunchdrop-rating-widget';
      ratingWidget.innerHTML = `
            <div class="ld-rating-container">
                <div class="ld-rating-header">
                    <span class="ld-rating-title">Already Rated Today</span>
                    <button class="ld-rating-close" id="ld-rating-close">×</button>
                </div>
                <div class="ld-restaurant-name">
                    <span class="ld-restaurant-title">${existingRating.restaurant}</span>
                </div>
                <div class="ld-already-rated-content">
                    <div class="ld-rating-display">
                        <span class="ld-rating-stars-display">
                            ${'🤠'.repeat(existingRating.rating)}${'⚪'.repeat(5 - existingRating.rating)}
                        </span>
                        <span class="ld-rating-value">${existingRating.rating}/5</span>
                    </div>
                    ${existingRating.comment ? `<div class="ld-rating-comment-display">"${existingRating.comment}"</div>` : ''}
                    <div class="ld-rating-timestamp">Rated on ${new Date(existingRating.timestamp).toLocaleDateString()}</div>
                </div>
            </div>
        `;

      // Inject the CSS styles
      if (!document.getElementById('lunchdrop-extension-styles')) {
        const style = document.createElement('style');
        style.id = 'lunchdrop-extension-styles';
        style.textContent = `
          #lunchdrop-rating-widget {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: white;
            border: 2px solid #007bff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .ld-rating-container {
            padding: 16px;
          }
          .ld-rating-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
          }
          .ld-rating-title {
            font-weight: 600;
            color: #333;
            font-size: 16px;
          }
          .ld-rating-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .ld-rating-close:hover {
            color: #333;
          }
          .ld-restaurant-name {
            margin-bottom: 12px;
          }
          .ld-restaurant-title {
            font-weight: 500;
            color: #555;
            font-size: 14px;
          }
          .ld-already-rated-content {
            text-align: center;
          }
          .ld-rating-display {
            margin-bottom: 12px;
          }
          .ld-rating-stars-display {
            font-size: 24px;
            color: #ffc107;
            margin-right: 8px;
          }
          .ld-rating-value {
            font-size: 18px;
            font-weight: 600;
            color: #333;
          }
          .ld-rating-comment-display {
            background: #f8f9fa;
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 8px;
            font-style: italic;
            color: #666;
            font-size: 14px;
          }
          .ld-rating-timestamp {
            font-size: 12px;
            color: #999;
          }
        `;
        document.head.appendChild(style);
      }

      // Add to page
      document.body.appendChild(ratingWidget);

      // Setup close button
      const closeButton = ratingWidget.querySelector('#ld-rating-close');
      closeButton.addEventListener('click', () => {
        ratingWidget.remove();
        ratingWidget = null;
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        if (ratingWidget) {
          ratingWidget.remove();
          ratingWidget = null;
        }
      }, 5000);
    }

    // Function to inject rating widget into the page
    async function injectRatingWidget() {
      if (ratingWidget) return; // Already injected

      const restaurantName = orderData?.restaurant || 'Unknown Restaurant';
      const orderItems = orderData?.items || ['Unknown Items'];

      // Daily rating check endpoint removed - no longer checking if restaurant was rated today

      // Check if user has already rated this specific order
      const alreadyRated = await hasUserRatedOrder(restaurantName, orderItems);
      if (alreadyRated) {
        console.log(
          'LanchDrap Rating Extension: Not showing rating widget - user has already rated this specific order'
        );
        return;
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
      if (!document.getElementById('lunchdrop-extension-styles')) {
        const styleLink = document.createElement('link');
        styleLink.id = 'lunchdrop-extension-styles';
        styleLink.rel = 'stylesheet';
        styleLink.href = chrome.runtime.getURL('content-styles.css');
        document.head.appendChild(styleLink);
      }
      document.body.appendChild(widget);
      ratingWidget = widget;

      // Add event listeners
      setupRatingWidgetEvents();
    }

    function setupRatingWidgetEvents() {
      const stars = ratingWidget.querySelectorAll('.ld-star');
      const ratingDisplay = ratingWidget.querySelector('#ld-current-rating');
      const commentInput = ratingWidget.querySelector('.ld-rating-comment');
      const submitButton = ratingWidget.querySelector('#ld-rating-submit');
      const closeButton = ratingWidget.querySelector('#ld-rating-close');

      let currentRating = 0;

      stars.forEach((star) => {
        star.addEventListener('click', function () {
          const rating = parseInt(this.dataset.rating);
          currentRating = rating;
          updateStarDisplay();
          ratingDisplay.textContent = rating;
        });

        star.addEventListener('mouseenter', function () {
          const rating = parseInt(this.dataset.rating);
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
            orderId: orderData?.orderId || generateOrderId(),
            restaurant: orderData?.restaurant || 'Unknown Restaurant',
            items: orderData?.items || ['Unknown Items'],
            rating: currentRating,
            comment: comment,
            timestamp: new Date().toISOString(),
            orderTotal: orderData?.total || '$0.00',
          };

          // Send to Cloudflare Worker
          const response = await fetch(
            'https://lunchdrop-ratings.caleb-brown.workers.dev/api/ratings',
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
        } catch (error) {
          console.error('Error submitting rating:', error);
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

    // Function to detect when user is on an order page
    function detectOrderPage() {
      // Look for common indicators of an order page
      const orderIndicators = ['order', 'checkout', 'confirmation', 'receipt', 'summary'];

      const url = window.location.href.toLowerCase();
      const pageText = document.body.textContent.toLowerCase();

      const isOrderPage = orderIndicators.some(
        (indicator) => url.includes(indicator) || pageText.includes(indicator)
      );

      // Order page detection removed - rating is now completely manual via button click only
    }

    // Function to detect LanchDrap's rating prompt
    function detectLunchDropRatingPrompt() {
      try {
        // Look for "How was [Restaurant Name]?" pattern
        const ratingPromptMatch = document.body.textContent.match(/How was (.+?)\?/i);

        if (ratingPromptMatch) {
          const restaurantName = ratingPromptMatch[1].trim();
          console.log(
            'LanchDrap Rating Extension: Detected LanchDrap rating prompt for:',
            restaurantName
          );

          // Create order data from the detected restaurant name
          const detectedOrderData = {
            restaurant: restaurantName,
            items: ['Detected from LanchDrap prompt'],
            total: 'Unknown',
            orderId: generateOrderId(),
          };

          // Store the detected order data
          orderData = detectedOrderData;

          // Check if utilities are loaded, if not, wait and try again
          if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
            console.log(
              'LanchDrap Rating Extension: Utilities not loaded, will check for rating later'
            );
            // Store the prompt detection for later processing
            localStorage.setItem(
              'lunchdrop_pending_rating_prompt',
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
      } catch (error) {
        console.error('Error detecting LanchDrap rating prompt:', error);
        return false;
      }
    }

    // Function to detect sellout status
    function detectSelloutStatus() {
      const selloutIndicators = [
        'sold out',
        'soldout',
        'out of stock',
        'unavailable',
        'not available',
        'temporarily unavailable',
        'currently unavailable',
        'no longer available',
        'limited availability',
        'limited menu',
        'reduced menu',
      ];

      const pageText = document.body.textContent.toLowerCase();
      let detectedStatus = 'available';
      let reason = null;

      // Check for sold out indicators
      if (selloutIndicators.some((indicator) => pageText.includes(indicator))) {
        detectedStatus = 'soldout';
        reason = 'Detected sellout indicators on page';
      }
      // Check for limited availability
      else if (pageText.includes('limited') || pageText.includes('reduced')) {
        detectedStatus = 'limited';
        reason = 'Detected limited availability indicators';
      }

      // If we detected a change in status, report it - DISABLED FOR NOW
      // if (detectedStatus !== 'available') {
      //   reportSelloutStatus(detectedStatus, reason);
      // }
    }

    // Function to scrape restaurant availability from the main grid
    async function scrapeRestaurantAvailability() {
      try {
        // Check if we're on a sign-in page
        if (document.querySelector('input[type="password"]') || 
            document.body.textContent.includes('Sign in') ||
            document.body.textContent.includes('Phone Number or Email Address')) {
          console.log('LanchDrap Rating Extension: Detected sign-in page, skipping restaurant scraping');
          return null;
        }

        // Check if we're on an individual restaurant page (not the main grid)
        const urlParts = window.location.pathname.split('/');
        if (urlParts.length >= 4 && urlParts[1] === 'app' && urlParts[3]) {
          console.log('LanchDrap Rating Extension: Detected individual restaurant page, skipping grid scraping');
          return null;
        }

        // Extract date from URL for daily tracking
        const urlDate = extractDateFromUrl();
        if (!urlDate) {
          console.log('LanchDrap Rating Extension: Could not extract date from URL');
          return null;
        }

        // Look for the main restaurant grid element using multiple strategies
        let restaurantGrid = null;
        
        // Strategy 1: Look for the specific selector from the user's xpath
        restaurantGrid = document.querySelector('#app > div.flex.flex-col.justify-between.w-full.min-h-screen.v-cloak > div.flex-auto.basis-full.relative > div.max-w-6xl.mx-auto > div:nth-child(6) > div');
        
        // Strategy 2: Look for flex-wrap gap-3 (common pattern for restaurant grids)
        if (!restaurantGrid) {
          restaurantGrid = document.querySelector('div.flex.flex-wrap.gap-3');
        }
        
        // Strategy 3: Look for div containing restaurant links with specific URL pattern
        if (!restaurantGrid) {
          // Look for links that match the restaurant URL pattern: /app/YYYY-MM-DD/restaurant-id
          const restaurantLinks = document.querySelectorAll('a[href*="/app/"]');
          const validRestaurantLinks = Array.from(restaurantLinks).filter(link => {
            const href = link.getAttribute('href');
            // Check if href matches pattern: /app/YYYY-MM-DD/restaurant-id
            return href && /^\/app\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9]+$/.test(href);
          });
          
          if (validRestaurantLinks.length > 0) {
            // Find the common parent container of these valid restaurant links
            const potentialGrid = validRestaurantLinks[0].closest('div');
            
            // Validate that this is actually a restaurant grid by checking:
            // 1. It contains multiple valid restaurant links
            // 2. It doesn't have classes that indicate it's a date navigation
            const restaurantLinksInGrid = potentialGrid.querySelectorAll('a[href*="/app/"]');
            const validLinksInGrid = Array.from(restaurantLinksInGrid).filter(link => {
              const href = link.getAttribute('href');
              return href && /^\/app\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9]+$/.test(href);
            });
            
            const hasMultipleRestaurants = validLinksInGrid.length >= 3; // Should have multiple restaurants
            const isNotDateNav = !potentialGrid.className.includes('day-container') && 
                                !potentialGrid.className.includes('snap-x') &&
                                !potentialGrid.className.includes('overflow-scroll');
            
            if (hasMultipleRestaurants && isNotDateNav) {
              restaurantGrid = potentialGrid;
              console.log('LanchDrap Rating Extension: Found restaurant grid using validated restaurant URL pattern strategy');
              console.log('LanchDrap Rating Extension: Found', validLinksInGrid.length, 'valid restaurant links');
            } else {
              console.log('LanchDrap Rating Extension: Rejected potential grid - not enough valid restaurants or appears to be date navigation');
              console.log('LanchDrap Rating Extension: Valid restaurant links found:', validLinksInGrid.length);
            }
          }
        }
        
        // Strategy 4: Fallback to old selector
        if (!restaurantGrid) {
          restaurantGrid = document.querySelector('div.mx-4.my-8.sm\\:my-2');
        }
        
        if (!restaurantGrid) {
          console.log('LanchDrap Rating Extension: Could not find restaurant grid with any strategy');
          console.log('LanchDrap Rating Extension: Available divs with flex classes:', document.querySelectorAll('div[class*="flex"]').length);
          console.log('LanchDrap Rating Extension: Available app links:', document.querySelectorAll('a[href*="/app/"]').length);
          
          // Debug: Show what elements we found that might be confused for restaurant grids
          const allAppLinks = document.querySelectorAll('a[href*="/app/"]');
          if (allAppLinks.length > 0) {
            const parentDiv = allAppLinks[0].closest('div');
            console.log('LanchDrap Rating Extension: First app link parent classes:', parentDiv?.className);
            console.log('LanchDrap Rating Extension: Restaurant links in parent:', parentDiv?.querySelectorAll('a[href*="/app/"]').length);
          }
          
          return;
        }

        console.log('LanchDrap Rating Extension: Found restaurant grid:', restaurantGrid);
        console.log('LanchDrap Rating Extension: Grid classes:', restaurantGrid.className);
        console.log('LanchDrap Rating Extension: Restaurant links in grid:', restaurantGrid.querySelectorAll('a[href*="/app/"]').length);

        // Get restaurant cards that match the specific URL pattern
        const allAppLinks = restaurantGrid.querySelectorAll('a[href*="/app/"]');
        const restaurantCards = Array.from(allAppLinks).filter(link => {
          const href = link.getAttribute('href');
          // Check if href matches pattern: /app/YYYY-MM-DD/restaurant-id
          return href && /^\/app\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9]+$/.test(href);
        });
        if (restaurantCards.length === 0) {
          console.log('LanchDrap Rating Extension: No restaurant cards found in grid');
          console.log('LanchDrap Rating Extension: Grid element:', restaurantGrid);
          console.log('LanchDrap Rating Extension: Grid children:', restaurantGrid.children.length);
          console.log('LanchDrap Rating Extension: All app links on page:', document.querySelectorAll('a[href*="/app/"]').length);
          
          // Try to find valid restaurant cards with a broader search
          const allPageAppLinks = document.querySelectorAll('a[href*="/app/"]');
          const validPageLinks = Array.from(allPageAppLinks).filter(link => {
            const href = link.getAttribute('href');
            return href && /^\/app\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9]+$/.test(href);
          });
          
          if (validPageLinks.length > 0) {
            console.log('LanchDrap Rating Extension: Found valid restaurant links elsewhere, using those instead');
            // Use the first few valid restaurant links we can find
            const cards = validPageLinks.slice(0, 10); // Limit to first 10
            return await processRestaurantCards(cards, urlDate);
          }
          
          // No cards found anywhere, but continue with other functionality
          console.log('LanchDrap Rating Extension: No restaurant cards found, but continuing with other functionality');
          return null;
        }

        return await processRestaurantCards(restaurantCards, urlDate);
      } catch (error) {
        console.error('Error tracking restaurant appearances:', error);
      }
    }

    // Function to process restaurant cards and extract data
    async function processRestaurantCards(restaurantCards, urlDate) {
      try {
        const availabilityData = [];
        const now = new Date();

        for (let index = 0; index < restaurantCards.length; index++) {
          const card = restaurantCards[index];
          try {
            // Extract restaurant information
            const href = card.getAttribute('href');
            const timeSlot = card
              .querySelector('.text-base.font-bold.text-center')
              ?.textContent?.trim();
            const statusElement = card.querySelector('.text-sm.text-center');
            const statusText = statusElement?.textContent?.trim();

            // Determine availability status based on visual indicators
            let status = 'available';
            let reason = null;

            // Check for "SOLD OUT" text inside the restaurant card
            const cardText = card.textContent || '';
            const soldOutRegex = /sold\s+out!?/i;
            if (soldOutRegex.test(cardText)) {
              status = 'soldout';
              reason = 'Restaurant is sold out';
              console.log('LanchDrap Rating Extension: Detected SOLD OUT in card text');
            }
            // Check for "Ordering Closed" text
            else if (statusText && statusText.includes('Ordering Closed')) {
              status = 'soldout';
              reason = 'Ordering closed for this time slot';
            }
            // Check for "Order Placed" (available)
            else if (statusText && statusText.includes('Order Placed')) {
              status = 'available';
              reason = 'Orders currently being accepted';
            }

            // Check visual indicators (opacity and border color)
            const cardDiv = card.querySelector('div.relative.h-full.rounded-md');
            let isSelected = false;
            let color = null;
            if (cardDiv) {
              const opacity = window.getComputedStyle(cardDiv).opacity;
              color = window.getComputedStyle(cardDiv).borderColor;

              // Check if this is the selected restaurant (has 'border-2' class)
              // Selected restaurants have the 'border-2' class
              if (cardDiv.classList.contains('border-2')) {
                isSelected = true;
                console.log('LanchDrap Rating Extension: Found selected restaurant with border-2 class and color:', color);
              }

              // Reduced opacity often indicates closed/unavailable
              if (opacity && parseFloat(opacity) < 1) {
                if (status === 'available') {
                  status = 'limited';
                  reason = 'Reduced opacity suggests limited availability';
                }
              }
            }

            // Extract restaurant ID from href (primary method)
            let restaurantId = 'unknown';
            let restaurantName = null;
            
            // Extract restaurant ID from href
            if (href) {
              const hrefParts = href.split('/');
              if (hrefParts.length > 2) {
                restaurantId = hrefParts[hrefParts.length - 1];
              }
            }
            
            // Fallback: try to extract from image URL hash if no href ID
            if (restaurantId === 'unknown') {
            const img = card.querySelector('img');
            if (img && img.src) {
                // Extract restaurant hash from the image URL
              // URL format: https://lunchdrop.s3.amazonaws.com/restaurant-logos/[hash].png
              const urlParts = img.src.split('/');
              if (urlParts.length > 0) {
                const filename = urlParts[urlParts.length - 1];
                if (filename.includes('.')) {
                  const hash = filename.split('.')[0];
                    restaurantId = hash;
                  }
                }
              }
            }
            
            // Try to get restaurant name from local storage or use identifier
            restaurantName = await getRestaurantName(restaurantId);
            if (!restaurantName || restaurantName === restaurantId) {
              // Use the ID as the name only if we don't have a better name
              restaurantName = restaurantId;
            }

            // Parse time slot
            let timeSlotData = null;
            if (timeSlot) {
              const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})(am|pm)/);
              if (timeMatch) {
                const [_, startHour, startMin, endHour, endMin, period] = timeMatch;
                timeSlotData = {
                  start: `${startHour}:${startMin}${period}`,
                  end: `${endHour}:${endMin}${period}`,
                  full: timeSlot,
                };
              }
            }

            const restaurantInfo = {
              index,
              id: restaurantId,
              name: restaurantName,
              restaurant: restaurantName, // Keep for backward compatibility
              status,
              reason,
              timeSlot: timeSlotData,
              href,
              urlDate: urlDate,
              timestamp: now.toISOString(),
              isSelected,
              color, // Add the color to the main object
              visualIndicators: {
                opacity: window.getComputedStyle(card).opacity,
                borderColor: window.getComputedStyle(
                  card.querySelector('div.relative.h-full.rounded-md')
                )?.borderColor,
                hasOrderPlaced: statusText?.includes('Order Placed') || false,
                hasOrderingClosed: statusText?.includes('Ordering Closed') || false,
                hasSoldOutInCard: /sold\s+out!?/i.test(cardText),
              },
            };

            availabilityData.push(restaurantInfo);

            // Report individual restaurant status - DISABLED FOR NOW
            // if (status !== 'available') {
            //   reportSelloutStatus(status, reason, restaurantName, timeSlotData);
            // }
          } catch (cardError) {
            console.error('Error processing restaurant card:', cardError);
          }
        }

        // Store the scraped data
        storeAvailabilityData(availabilityData);

        // Report overall availability summary
        reportAvailabilitySummary(availabilityData);

        // Track restaurant appearances
        await trackRestaurantAppearances(availabilityData);

        // Display stats for selected restaurant on daily pages
        await displaySelectedRestaurantStats(availabilityData);

        console.log('LanchDrap Rating Extension: Scraped availability data:', availabilityData);
        return availabilityData;
      } catch (error) {
        console.error('LanchDrap Rating Extension: Error processing restaurant cards:', error);
        return null;
      }
    }

    // Function to store availability data locally
    function storeAvailabilityData(availabilityData) {
      try {
        const storageKey = `availability:${new Date().toISOString().split('T')[0]}`;
        const existingData = localStorage.getItem(storageKey);
        let dailyData = existingData ? JSON.parse(existingData) : [];

        // Add timestamp to each record
        const timestampedData = availabilityData.map((item) => ({
          ...item,
          scrapedAt: new Date().toISOString(),
        }));

        dailyData.push(...timestampedData);

        // Keep only last 100 records per day
        if (dailyData.length > 100) {
          dailyData = dailyData.slice(-100);
        }

        localStorage.setItem(storageKey, JSON.stringify(dailyData));
      } catch (error) {
        console.error('Error storing availability data:', error);
      }
    }

    // Function to get restaurant name from local storage or API
    async function getRestaurantName(restaurantIdentifier) {
      try {
        // First check local storage
        const localKey = `restaurant_name:${restaurantIdentifier}`;
        const localName = localStorage.getItem(localKey);
        if (localName) {
          return localName;
        }

        // API endpoint removed - can't fetch restaurant names from API anymore
        // Restaurant names will be learned through the update-name endpoint

        return null;
      } catch (error) {
        console.error('Error getting restaurant name:', error);
        return null;
      }
    }


    // Function to track restaurant appearances on daily pages
    async function trackRestaurantAppearances(availabilityData) {
      try {
        console.log('LanchDrap Rating Extension: trackRestaurantAppearances called with data:', availabilityData);
        
        if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
          console.log('Extension utilities not loaded yet, skipping appearance tracking');
          return;
        }

        const urlDate = extractDateFromUrl();
        console.log('LanchDrap Rating Extension: URL date for tracking:', urlDate);
        
        if (!urlDate) {
          console.log('Could not extract date from URL for appearance tracking');
          return;
        }

        const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL);
        const timeSlot = availabilityData[0]?.timeSlot?.full || 'unknown';

        const trackingData = {
          restaurants: availabilityData.map(restaurant => ({
            id: restaurant.id,
            name: restaurant.name,
            status: restaurant.status,
            href: restaurant.href,
            color: restaurant.color,
            isSelected: restaurant.isSelected,
          })),
          date: urlDate,
          timeSlot: timeSlot,
        };

        console.log('LanchDrap Rating Extension: Sending tracking data:', trackingData);
        console.log('LanchDrap Rating Extension: Restaurant names being tracked:', trackingData.restaurants.map(r => r.name));
        const result = await apiClient.trackRestaurantAppearances(trackingData);
        console.log('LanchDrap Rating Extension: Tracking result:', result);
        console.log('LanchDrap Rating Extension: Result structure check:', {
          hasResult: !!result,
          hasData: !!(result && result.data),
          hasRestaurants: !!(result && result.data && result.data.restaurants),
          restaurantsLength: result?.data?.restaurants?.length
        });
        
        // Add sell out indicators to restaurant cards based on response
        // The API response has nested structure: result.data.data.restaurants
        const restaurants = result?.data?.data?.restaurants || result?.data?.restaurants;
        
        if (restaurants && Array.isArray(restaurants)) {
          console.log('LanchDrap Rating Extension: Received sell out rates:', restaurants);
          addSellOutIndicators(restaurants);
        } else {
          console.log('LanchDrap Rating Extension: ❌ No sell out rates in response, result structure:', {
            result: result,
            data: result?.data,
            nestedData: result?.data?.data,
            restaurants: restaurants
          });
        }
        
        console.log('LanchDrap Rating Extension: Tracked restaurant appearances for', urlDate);
      } catch (error) {
        console.error('Error tracking restaurant appearances:', error);
      }
    }

    // Function to add sell out indicators to restaurant cards
    function addSellOutIndicators(restaurantsWithRates) {
      try {
        // Find all restaurant cards on the page
        const restaurantCards = document.querySelectorAll('a[href*="/app/"]');
        console.log(`LanchDrap Rating Extension: Found ${restaurantCards.length} restaurant cards on page`);
        
        restaurantsWithRates.forEach(restaurant => {
          console.log(`LanchDrap Rating Extension: Checking ${restaurant.name} - sellOutRate: ${restaurant.sellOutRate} (type: ${typeof restaurant.sellOutRate})`);
          console.log(`LanchDrap Rating Extension: Comparison ${restaurant.sellOutRate} > 0.8 = ${restaurant.sellOutRate > 0.8}`);
          
          if (restaurant.sellOutRate > 0.8) { // 80% threshold
            console.log(`LanchDrap Rating Extension: ${restaurant.name} meets threshold, looking for card...`);
            
            // Find the card for this restaurant
            const restaurantCard = Array.from(restaurantCards).find(card => {
              const href = card.getAttribute('href');
              console.log(`LanchDrap Rating Extension: Checking card href: ${href} for restaurant ID: ${restaurant.id}`);
              return href && href.includes(restaurant.id);
            });
            
            console.log(`LanchDrap Rating Extension: Found card for ${restaurant.name}:`, restaurantCard);
            
            if (restaurantCard) {
              // Check if indicator already exists
              const existingIndicator = restaurantCard.querySelector('.ld-sellout-indicator');
              console.log(`LanchDrap Rating Extension: Existing indicator for ${restaurant.name}:`, existingIndicator);
              
              if (!existingIndicator) {
                // Create the indicator element
                const indicator = document.createElement('div');
                indicator.className = 'ld-sellout-indicator';
                indicator.style.cssText = `
                  position: absolute;
                  bottom: 8px;
                  left: 50%;
                  transform: translateX(-50%);
                  background: linear-gradient(135deg, #ff6b6b, #ee5a52);
                  color: white;
                  padding: 4px 8px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 600;
                  z-index: 10;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  white-space: nowrap;
                `;
                indicator.textContent = 'Likely to Sell Out';
                
                // Make sure the card has relative positioning
                const cardDiv = restaurantCard.querySelector('div');
                console.log(`LanchDrap Rating Extension: Card div for ${restaurant.name}:`, cardDiv);
                
                if (cardDiv) {
                  cardDiv.style.position = 'relative';
                  cardDiv.appendChild(indicator);
                  
                  console.log(`LanchDrap Rating Extension: ✅ Successfully added sell out indicator to ${restaurant.name} (${(restaurant.sellOutRate * 100).toFixed(1)}% sell out rate)`);
                  console.log(`LanchDrap Rating Extension: Indicator element:`, indicator);
                } else {
                  console.log(`LanchDrap Rating Extension: ❌ Could not find card div for ${restaurant.name}`);
                }
              }
            }
          }
        });
      } catch (error) {
        console.error('Error adding sell out indicators:', error);
      }
    }

    // Helper function to format date strings properly (avoid timezone issues)
    function formatDateString(dateString) {
      if (!dateString) return 'Unknown';
      
      // If it's already in YYYY-MM-DD format, treat it as local date
      if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString();
      }
      
      // Otherwise, use the date as-is
      return new Date(dateString).toLocaleDateString();
    }

    // Shared function to render stats component
    function renderStatsComponent(stats, containerId, title) {
      // Add API error indicator if applicable
      const apiErrorIndicator = stats.apiError ? 
        '<div class="ld-api-error">⚠️ API temporarily unavailable - showing cached data</div>' : '';
      
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
              ">${stats.lastAppearance ? formatDateString(stats.lastAppearance) : 'Never'}</span>
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
              ">${stats.soldOutRate ? (stats.soldOutRate * 100).toFixed(1) + '%' : '0%'}</span>
            </div>
          </div>
        </div>
      `;

      // Create container
      const container = document.createElement('div');
      container.id = containerId;
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
          console.log('Extension utilities not loaded yet, skipping selected restaurant stats');
          return;
        }

        // Find the selected restaurant
        const selectedRestaurant = availabilityData.find(restaurant => restaurant.isSelected);
        if (!selectedRestaurant) {
          console.log('LanchDrap Rating Extension: No selected restaurant found');
          return;
        }

        console.log('LanchDrap Rating Extension: Found selected restaurant:', selectedRestaurant);

        // Check if stats are already displayed
        if (document.getElementById('lunchdrop-restaurant-stats')) {
          return;
        }

        const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL);
        let stats = null;

        try {
          stats = await apiClient.getRestaurantById(selectedRestaurant.id, selectedRestaurant.name);
          console.log('LanchDrap Rating Extension: Received stats for selected restaurant:', stats);
          
          // Use the color from the selected restaurant if the API doesn't have it yet
          if (!stats.color && selectedRestaurant.color) {
            stats.color = selectedRestaurant.color;
          }
        } catch (apiError) {
          console.error('LanchDrap Rating Extension: API error fetching selected restaurant stats:', apiError);
          
          // Create fallback stats when API is unavailable
          stats = {
            name: selectedRestaurant.name,
            id: selectedRestaurant.id,
            color: selectedRestaurant.color, // Include the color in fallback stats
            timeRange: 'all',
            totalDays: 0,
            totalAppearances: 0,
            appearancesInRange: 0,
            appearanceRate: 0,
            lastAppearance: null,
            firstSeen: null,
            lastUpdated: new Date().toISOString(),
            apiError: true,
            errorMessage: 'API temporarily unavailable'
          };
        }

        // Create stats display using shared component
        const statsContainer = renderStatsComponent(stats, 'lunchdrop-restaurant-stats', 'Selected Restaurant Stats');

        // Insert the stats after the restaurant title element
        const restaurantNameElement = document.querySelector('#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)');
        if (restaurantNameElement) {
          restaurantNameElement.parentNode.insertBefore(statsContainer, restaurantNameElement.nextSibling);
          console.log('LanchDrap Rating Extension: Displayed selected restaurant stats for', stats.name || stats.id);
        } else {
          console.log('LanchDrap Rating Extension: Could not find restaurant title element to insert stats');
        }

      } catch (error) {
        console.error('Error displaying selected restaurant stats:', error);
      }
    }

    // Function to display restaurant tracking information on detail pages
    async function displayRestaurantTrackingInfo() {
      try {
        // Check if we're on a restaurant detail page
        const restaurantNameElement = document.querySelector('#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)');
        if (!restaurantNameElement) {
          return; // Not on a detail page
        }

        const restaurantName = restaurantNameElement.textContent?.trim();
        if (!restaurantName) {
          return;
        }

        // Check if utilities are loaded
        if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
          console.log('Extension utilities not loaded yet, skipping tracking info display');
          return;
        }

        // Create API client instance
        const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL);

        // Store the restaurant name for future use (extract identifier from URL)
        const urlParts = window.location.pathname.split('/');
        let restaurantId = null;
        let stats = null;
        
        console.log('LanchDrap Rating Extension: Current URL:', window.location.pathname);
        console.log('LanchDrap Rating Extension: URL parts:', urlParts);
        
        // Expected URL structure: /app/2025-09-08/eajz7qx8
        // We want the last part (restaurant ID), not the date
        if (urlParts.length >= 4 && urlParts[1] === 'app') {
          restaurantId = urlParts[urlParts.length - 1];
          console.log('LanchDrap Rating Extension: Extracted restaurant ID:', restaurantId);
          
          // Validate that it's not a date (YYYY-MM-DD format)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (dateRegex.test(restaurantId)) {
            console.log('LanchDrap Rating Extension: Extracted ID is a date, not a restaurant ID. Skipping stats display.');
            return;
          }
          
          const localKey = `restaurant_name:${restaurantId}`;
          localStorage.setItem(localKey, restaurantName);
          console.log('LanchDrap Rating Extension: Stored restaurant name:', restaurantName, 'for ID:', restaurantId);
          
          // Use the restaurant ID for stats query instead of name
          console.log('LanchDrap Rating Extension: Fetching stats for restaurant ID:', restaurantId);
          console.log('LanchDrap Rating Extension: Restaurant name type:', typeof restaurantName, 'Length:', restaurantName?.length);
          
          try {
            stats = await apiClient.getRestaurantById(restaurantId, restaurantName);

            console.log('LanchDrap Rating Extension: Received stats:', stats);
            console.log('LanchDrap Rating Extension: Stats name field:', stats?.name);

            if (!stats) {
              console.log('LanchDrap Rating Extension: No stats received');
              return;
            }

            // Check if we need to update the restaurant name in backend
            // Only update if we have a real name (not just an ID) and it's different from what's stored
            if (restaurantName !== restaurantId && 
                restaurantName.length > 3 && 
                stats.name !== restaurantName) {
              try {
                const updateResult = await apiClient.updateRestaurantName(restaurantId, restaurantName);
                console.log('LanchDrap Rating Extension: Updated restaurant name in backend:', updateResult);
              } catch (error) {
                // Silently handle the error for now since the endpoint may not be available
                console.warn('LanchDrap Rating Extension: Could not update restaurant name in backend (endpoint may not be available):', error.message);
              }
            } else if (stats.name === restaurantName) {
              console.log('LanchDrap Rating Extension: Restaurant name is already up to date, skipping update');
            }
          } catch (apiError) {
            console.error('LanchDrap Rating Extension: API error fetching stats:', apiError);
            
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
              errorMessage: 'API temporarily unavailable'
            };
            
            console.log('LanchDrap Rating Extension: Using fallback stats due to API error');
          }
        } else {
          console.log('LanchDrap Rating Extension: Could not extract restaurant ID from URL - URL structure not recognized');
          return;
        }

        // Check if tracking info is already displayed
        if (document.getElementById('lunchdrop-restaurant-stats')) {
          return;
        }

        // Create tracking info display using shared component
        const trackingInfo = renderStatsComponent(stats, 'lunchdrop-restaurant-stats', 'Restaurant Stats');

        // Insert the tracking info near the restaurant name
        restaurantNameElement.parentNode.insertBefore(trackingInfo, restaurantNameElement.nextSibling);

        console.log('LanchDrap Rating Extension: Displayed tracking info for', restaurantName);
      } catch (error) {
        console.error('Error displaying restaurant tracking info:', error);
      }
    }

    // Function to extract date from LanchDrap URL
    function extractDateFromUrl() {
      try {
        const url = window.location.href;
        console.log('LanchDrap Rating Extension: Extracting date from URL:', url);
        
        const dateMatch = url.match(/\/app\/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const extractedDate = dateMatch[1];
          console.log('LanchDrap Rating Extension: Extracted date from URL:', extractedDate);
          return extractedDate; // Returns YYYY-MM-DD format
        }

        // If no date in URL but URL contains /app, treat as today
        if (url.includes('/app') && !url.includes('/app/')) {
          const today = new Date();
          const todayString = today.toISOString().split('T')[0];
          console.log('LanchDrap Rating Extension: No date in URL, using today:', todayString);
          return todayString; // Returns YYYY-MM-DD format for today
        }

        console.log('LanchDrap Rating Extension: No date found in URL');
        return null;
      } catch (error) {
        console.error('Error extracting date from URL:', error);
        return null;
      }
    }

    // Function to check if a date is in the past or today
    function isDateInPast(dateString) {
      try {
        const urlDate = new Date(dateString);
        const today = new Date();

        // Set time to start of day for both dates to compare only dates
        urlDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        // Allow today's date and past dates (urlDate <= today)
        return urlDate <= today;
      } catch (error) {
        console.error('Error checking if date is in past:', error);
        return false; // Default to false if we can't determine
      }
    }

    // Function to extract city from LanchDrap URL (for single office use)
    function extractCityFromUrl() {
      // Since this is single office use, we can hardcode or extract from URL
      try {
        const url = window.location.href;
        const cityMatch = url.match(/https:\/\/([^.]+)\.lunchdrop\.com/);
        if (cityMatch) {
          return cityMatch[1]; // Returns city name (e.g., "austin")
        }
        return 'office'; // Default to 'office' for single office use
      } catch (error) {
        console.error('Error extracting city from URL:', error);
        return 'office';
      }
    }

    // Function to report availability summary
    function reportAvailabilitySummary(availabilityData) {
      try {
        // Check if utilities are loaded
        if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
          console.log('Extension utilities not loaded yet, skipping availability summary');
          // Store data locally for later submission
          storeAvailabilitySummaryLocally(availabilityData);
          return;
        }

        const urlDate = extractDateFromUrl();
        // Validate data before sending
        if (!availabilityData || availabilityData.length === 0) {
          console.log('LanchDrap Rating Extension: No availability data to send');
          return;
        }

        const summary = {
          totalRestaurants: availabilityData.length,
          available: availabilityData.filter((r) => r.status === 'available').length,
          soldout: availabilityData.filter((r) => r.status === 'soldout').length,
          limited: availabilityData.filter((r) => r.status === 'limited').length,
          urlDate: urlDate,
          timestamp: new Date().toISOString(),
          timeSlot: availabilityData[0]?.timeSlot?.full || 'Unknown',
          city: extractCityFromUrl(),
        };

        // Validate required fields
        if (!summary.totalRestaurants || !summary.timestamp) {
          console.error('LanchDrap Rating Extension: Invalid summary data:', summary);
          return;
        }

        console.log('LanchDrap Rating Extension: Sending availability summary:', summary);

        // Availability summary endpoint removed - no longer sending summaries
      } catch (error) {
        console.error('Error creating availability summary:', error);
      }
    }

    // Function to store availability summary locally when utilities aren't loaded
    function storeAvailabilitySummaryLocally(availabilityData) {
      try {
        const urlDate = extractDateFromUrl();
        const summary = {
          totalRestaurants: availabilityData.length,
          available: availabilityData.filter((r) => r.status === 'available').length,
          soldout: availabilityData.filter((r) => r.status === 'soldout').length,
          limited: availabilityData.filter((r) => r.status === 'limited').length,
          urlDate: urlDate,
          timestamp: new Date().toISOString(),
          timeSlot: availabilityData[0]?.timeSlot?.full || 'Unknown',
          city: extractCityFromUrl(),
          pendingSubmission: true,
        };

        // Store in localStorage for later submission
        const pendingSummaries = JSON.parse(
          localStorage.getItem('pendingAvailabilitySummaries') || '[]'
        );
        pendingSummaries.push(summary);
        localStorage.setItem('pendingAvailabilitySummaries', JSON.stringify(pendingSummaries));
      } catch (error) {
        console.error('Error storing availability summary locally:', error);
      }
    }

    // Function to report sellout status to the worker
    async function reportSelloutStatus(status, reason, restaurantName = null, timeSlot = null) {
      try {
        // Check if utilities are loaded
        if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
          console.log('Extension utilities not loaded yet, skipping sellout status report');
          // Store data locally for later submission
          storeSelloutStatusLocally(status, reason, restaurantName, timeSlot);
          return;
        }

        const restaurant = restaurantName || orderData?.restaurant || 'Unknown Restaurant';

        const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL);
        const response = await apiClient.reportSelloutStatus({
          restaurant,
          status,
          reason,
          timestamp: new Date().toISOString(),
          timeSlot,
          source: 'page_scraping',
        });

        if (response.ok) {
          console.log(`LanchDrap Rating Extension: Reported ${status} status for ${restaurant}`);
        } else {
          console.error('Failed to report sellout status');
        }
      } catch (error) {
        console.error('Error reporting sellout status:', error);
      }
    }

    // Function to store sellout status locally when utilities aren't loaded
    function storeSelloutStatusLocally(status, reason, restaurantName = null, timeSlot = null) {
      try {
        const restaurant = restaurantName || orderData?.restaurant || 'Unknown Restaurant';
        const selloutData = {
          restaurant,
          status,
          reason,
          timestamp: new Date().toISOString(),
          timeSlot,
          source: 'page_scraping',
          pendingSubmission: true,
        };

        // Store in localStorage for later submission
        const pendingSellouts = JSON.parse(localStorage.getItem('pendingSelloutReports') || '[]');
        pendingSellouts.push(selloutData);
        localStorage.setItem('pendingSelloutReports', JSON.stringify(pendingSellouts));
      } catch (error) {
        console.error('Error storing sellout status locally:', error);
      }
    }

    // Run detection on page load
    detectOrderPage();
    // detectLunchDropRatingPrompt(); // Disabled - not working on rating prompts yet
    // detectSelloutStatus(); // Disabled - not reporting sellout status yet
    
    // Check if we're on a restaurant detail page and display tracking info
    // Only call this on individual restaurant pages (URLs with restaurant IDs)
    if (window.location.pathname.match(/\/app\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9]+$/)) {
      setTimeout(() => {
        displayRestaurantTrackingInfo();
      }, 2000);
    }

    // Check if we're on the main restaurant grid page
    console.log('LanchDrap Rating Extension: Checking if we should scrape availability...');
    console.log('LanchDrap Rating Extension: Current pathname:', window.location.pathname);
    console.log('LanchDrap Rating Extension: Pathname includes /app/:', window.location.pathname.includes('/app/'));
    console.log('LanchDrap Rating Extension: Found grid selector:', !!document.querySelector('div.mx-4.my-8.sm\\:my-2'));
    
    if (
      window.location.pathname.includes('/app/') ||
      document.querySelector('div.mx-4.my-8.sm\\:my-2')
    ) {
      console.log('LanchDrap Rating Extension: ✅ Should scrape availability, scheduling...');
      // Wait for page to load and then scrape availability
      setTimeout(async () => {
        console.log('LanchDrap Rating Extension: Executing scrapeRestaurantAvailability...');
        await scrapeRestaurantAvailability();
      }, 1000);
    } else {
      console.log('LanchDrap Rating Extension: ❌ Not on restaurant grid page, skipping scraping');
    }

    // Also run when URL changes (for SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        detectOrderPage();
        // detectLunchDropRatingPrompt(); // Disabled - not working on rating prompts yet
        // detectSelloutStatus(); // Disabled - not reporting sellout status yet

        // Check if we're on a restaurant detail page and display tracking info
        // Only call this on individual restaurant pages (URLs with restaurant IDs)
        if (url.match(/\/app\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9]+$/)) {
          setTimeout(() => {
            displayRestaurantTrackingInfo();
          }, 500);
        }

        // Check if we're on a restaurant grid page
        if (url.includes('/app/') || document.querySelector('div.mx-4.my-8.sm\\:my-2')) {
          setTimeout(async () => {
            await scrapeRestaurantAvailability();
          }, 500);
        }
      }
    }).observe(document, { subtree: true, childList: true });

    // Removed periodic polling - extension now only responds to URL changes and page loads

    // Add a floating button to manually trigger the rating widget
    function addFloatingButton() {
      const button = document.createElement('div');
      button.id = 'lunchdrop-rating-trigger';
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
          // Only show rating widget if there's a LunchDrop rating prompt on the page
          if (detectLunchDropRatingPrompt()) {
            // Don't call extractOrderData() - use the restaurant name from the prompt detection
            await injectRatingWidget();
            console.log('LanchDrap Rating Extension: Rating widget opened via button click (prompt detected)');
            console.log('LanchDrap Rating Extension: Rating for restaurant:', orderData?.restaurant);
          } else {
            console.log('LanchDrap Rating Extension: No LunchDrop rating prompt found, rating widget not shown');
            // Optionally show a brief message to the user
            button.style.background = '#ffa500';
            button.innerHTML = '🍽️ No Prompt';
            setTimeout(() => {
              button.style.background = '#ff6b6b';
              button.innerHTML = '🍽️ Rate';
            }, 2000);
          }
        } else {
          hideRatingWidget();
        }
      });

      document.body.appendChild(button);
    }

    // Add floating button for manual rating (no automatic prompt detection)
    setTimeout(() => {
      console.log('LanchDrap Rating Extension: Adding floating rating button for manual use');
      addFloatingButton();
    }, 3000);
  }

  // Function to submit pending data once utilities are loaded
  async function submitPendingData() {
    try {
      // Check if utilities are now loaded
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        return;
      }

      const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL);

      // Submit pending sellout reports
      const pendingSellouts = JSON.parse(localStorage.getItem('pendingSelloutReports') || '[]');
      if (pendingSellouts.length > 0) {
        console.log(
          `LanchDrap Rating Extension: Submitting ${pendingSellouts.length} pending sellout reports`
        );
        for (const selloutData of pendingSellouts) {
          try {
            await apiClient.reportSelloutStatus(selloutData);
          } catch (error) {
            console.error('Error submitting pending sellout report:', error);
          }
        }
        localStorage.removeItem('pendingSelloutReports');
      }

      // Submit pending availability summaries
      const pendingSummaries = JSON.parse(
        localStorage.getItem('pendingAvailabilitySummaries') || '[]'
      );
      if (pendingSummaries.length > 0) {
        console.log(
          `LanchDrap Rating Extension: Submitting ${pendingSummaries.length} pending availability summaries`
        );
        // Availability summary endpoint removed - no longer submitting summaries
        localStorage.removeItem('pendingAvailabilitySummaries');
      }

      // Check for pending rating prompts - DISABLED FOR NOW
      // const pendingPrompt = localStorage.getItem('lunchdrop_pending_rating_prompt');
      // if (pendingPrompt) {
      //   // Rating prompt processing disabled - not working on rating prompts yet
      //   localStorage.removeItem('lunchdrop_pending_rating_prompt');
      // }
    } catch (error) {
      console.error('Error submitting pending data:', error);
    }
  }

  // End of initializeContentScript function
})();

