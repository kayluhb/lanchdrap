// Content script for lunchdrop.com
(() => {
  // Start the main script immediately
      initializeContentScript();

  // Submit any pending data that was stored locally (reduced delay)
      setTimeout(() => {
        submitPendingData();
  }, 500);

  function initializeContentScript() {
    let orderData = null;
    let ratingWidget = null;

    // Cache for DOM queries to avoid repeated lookups
    const domCache = {
      restaurantGrid: null,
      restaurantCards: null,
      lastCacheTime: 0,
      cacheTimeout: 5000 // 5 seconds
    };

    // Helper function to get cached restaurant grid
    function getCachedRestaurantGrid() {
      const now = Date.now();
      if (domCache.restaurantGrid && (now - domCache.lastCacheTime) < domCache.cacheTimeout) {
        return domCache.restaurantGrid;
      }
      
      // Try to find the restaurant grid using optimized strategies
      let restaurantGrid = null;
      
      // Strategy 1: Look for the specific selector from the user's xpath
      restaurantGrid = document.querySelector('#app > div.flex.flex-col.justify-between.w-full.min-h-screen.v-cloak > div.flex-auto.basis-full.relative > div.max-w-6xl.mx-auto > div:nth-child(6) > div');
      
      // Strategy 2: Look for flex-wrap gap-3 (common pattern for restaurant grids)
      if (!restaurantGrid) {
        restaurantGrid = document.querySelector('div.flex.flex-wrap.gap-3');
      }
      
      // Strategy 3: Look for div containing restaurant links with specific URL pattern
      if (!restaurantGrid) {
        const restaurantLinks = document.querySelectorAll('a[href*="/app/"]');
        const validRestaurantLinks = Array.from(restaurantLinks).filter(link => {
          const href = link.getAttribute('href');
          return href && /\/app\/.*\/[a-zA-Z0-9]+/.test(href);
        });
        
        if (validRestaurantLinks.length > 0) {
          const potentialGrid = validRestaurantLinks[0].closest('div');
          const restaurantLinksInGrid = potentialGrid.querySelectorAll('a[href*="/app/"]');
          const validLinksInGrid = Array.from(restaurantLinksInGrid).filter(link => {
            const href = link.getAttribute('href');
            return href && /\/app\/.*\/[a-zA-Z0-9]+/.test(href);
          });
          
          const hasMultipleRestaurants = validLinksInGrid.length >= 3;
          const isNotDateNav = !potentialGrid.className.includes('day-container') && 
                              !potentialGrid.className.includes('snap-x') &&
                              !potentialGrid.className.includes('overflow-scroll');
          
          if (hasMultipleRestaurants && isNotDateNav) {
            restaurantGrid = potentialGrid;
          }
        }
      }
      
      // Strategy 4: Fallback to old selector
      if (!restaurantGrid) {
        restaurantGrid = document.querySelector('div.mx-4.my-8.sm\\:my-2');
      }
      
      // Cache the result
      domCache.restaurantGrid = restaurantGrid;
      domCache.lastCacheTime = now;
      
      return restaurantGrid;
    }

    // Helper function to clear DOM cache
    function clearDomCache() {
      domCache.restaurantGrid = null;
      domCache.restaurantCards = null;
      domCache.lastCacheTime = 0;
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'getOrderData') {
        sendResponse(orderData);
      }
    });

    function generateOrderId() {
      return 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }



    // Function to inject rating widget into the page
    async function injectRatingWidget() {
      if (ratingWidget) return; // Already injected

      const restaurantName = orderData?.restaurant || 'Unknown Restaurant';

      // Get restaurant menu items for selection
      let menuItems = [];
      try {
        if (typeof LanchDrapApiClient !== 'undefined' && typeof LanchDrapConfig !== 'undefined') {
          const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL, LanchDrapConfig.CONFIG.ENDPOINTS);
          const restaurantData = await apiClient.searchRestaurantByName(restaurantName);
          menuItems = restaurantData.menu || [];
        }
      } catch (error) {
        console.log('Could not fetch restaurant menu:', error);
        // Fallback to parsing menu from current page
        menuItems = parseMenuFromPage();
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
        return menuItems.filter(item => 
          item.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      function renderMenuDropdown(items) {
        menuDropdown.innerHTML = '';
        if (items.length === 0) {
          menuDropdown.style.display = 'none';
          return;
        }

        items.forEach(item => {
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
        selectedMenuItems = selectedMenuItems.filter(i => i !== item);
        renderSelectedItems();
      }

      function renderSelectedItems() {
        selectedItems.innerHTML = '';
        selectedMenuItems.forEach(item => {
          const tag = document.createElement('div');
          tag.className = 'ld-selected-item';
          tag.innerHTML = `
            <span>${item}</span>
            <button class="ld-remove-item" data-item="${item}">×</button>
          `;
          selectedItems.appendChild(tag);
        });

        // Add event listeners for remove buttons
        selectedItems.querySelectorAll('.ld-remove-item').forEach(btn => {
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
            items: selectedMenuItems.length > 0 ? selectedMenuItems : (orderData?.items || ['Unknown Items']),
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


    // Function to scrape restaurant availability from the main grid
    async function scrapeRestaurantAvailability() {
      try {
        // Quick checks to avoid unnecessary processing
        if (document.querySelector('input[type="password"]') || 
            document.body.textContent.includes('Sign in') ||
            document.body.textContent.includes('Phone Number or Email Address')) {
          return null;
        }

        // Check if we're on an individual restaurant page (not the main grid)
        const urlParts = window.location.pathname.split('/');
        if (urlParts.length >= 4 && urlParts[1] === 'app' && urlParts[3]) {
          return null;
        }

        // Extract date from URL for daily tracking
        const urlDate = extractDateFromUrl();
        if (!urlDate) {
          return null;
        }

        // Use cached restaurant grid
        const restaurantGrid = getCachedRestaurantGrid();
        if (!restaurantGrid) {
          return;
        }

        // Get restaurant cards that match the specific URL pattern
        const allAppLinks = restaurantGrid.querySelectorAll('a[href*="/app/"]');
        console.log('LanchDrap Rating Extension: Found', allAppLinks.length, 'app links in grid');
        
        // Debug: Log the first few hrefs to see the actual format
        if (allAppLinks.length > 0) {
          console.log('LanchDrap Rating Extension: Sample hrefs:', Array.from(allAppLinks).slice(0, 3).map(link => link.getAttribute('href')));
        }
        
        const restaurantCards = Array.from(allAppLinks).filter(link => {
          const href = link.getAttribute('href');
          // More flexible pattern - just check if it contains /app/ and has some identifier
          return href && /\/app\/.*\/[a-zA-Z0-9]+/.test(href);
        });
        
        console.log('LanchDrap Rating Extension: Filtered to', restaurantCards.length, 'restaurant cards');
          
        if (restaurantCards.length === 0) {
          // Try to find valid restaurant cards with a broader search
          const allPageAppLinks = document.querySelectorAll('a[href*="/app/"]');
          console.log('LanchDrap Rating Extension: Found', allPageAppLinks.length, 'app links on entire page');
          
          const validPageLinks = Array.from(allPageAppLinks).filter(link => {
            const href = link.getAttribute('href');
            return href && /\/app\/.*\/[a-zA-Z0-9]+/.test(href);
          });
          
          console.log('LanchDrap Rating Extension: Found', validPageLinks.length, 'valid page links');
          
          if (validPageLinks.length > 0) {
            // Use the first few valid restaurant links we can find
            const cards = validPageLinks.slice(0, 10); // Limit to first 10
            return await processRestaurantCards(cards, urlDate);
          }
          
          console.log('LanchDrap Rating Extension: No valid restaurant cards found anywhere');
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

        // Process cards in batches to avoid blocking the UI
        const batchSize = 5;
        const batches = [];
        for (let i = 0; i < restaurantCards.length; i += batchSize) {
          batches.push(restaurantCards.slice(i, i + batchSize));
        }

        for (const batch of batches) {
          const batchPromises = batch.map(async (card, batchIndex) => {
            const index = batches.indexOf(batch) * batchSize + batchIndex;
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

            return restaurantInfo;
          } catch (cardError) {
            console.error('Error processing restaurant card:', cardError);
            return null;
          }
          });
          
          // Wait for batch to complete
          const batchResults = await Promise.all(batchPromises);
          availabilityData.push(...batchResults.filter(result => result !== null));
          
          // Small delay between batches to avoid blocking UI
          if (batches.indexOf(batch) < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
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
        if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
          return;
        }

        const urlDate = extractDateFromUrl();
        if (!urlDate) {
          return;
        }

        // Don't send empty restaurant arrays to the API
        if (!availabilityData || availabilityData.length === 0) {
          console.log('LanchDrap Rating Extension: No restaurant data to track, skipping API call');
          return;
        }

        const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL, LanchDrapConfig.CONFIG.ENDPOINTS);
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

        console.log('LanchDrap Rating Extension: Sending tracking data for', trackingData.restaurants.length, 'restaurants');
        const result = await apiClient.trackRestaurantAppearances(trackingData);
        
        // Add sell out indicators to restaurant cards based on response
        // The API response has nested structure: result.data.data.restaurants
        const restaurants = result?.data?.data?.restaurants || result?.data?.restaurants;
        
        if (restaurants && Array.isArray(restaurants)) {
          addSellOutIndicators(restaurants);
        }
      } catch (error) {
        console.error('Error tracking restaurant appearances:', error);
      }
    }

    // Function to add sell out indicators to restaurant cards
    function addSellOutIndicators(restaurantsWithRates) {
      try {
        // Use cached restaurant grid if available, otherwise find all restaurant cards
        const restaurantGrid = getCachedRestaurantGrid();
        const restaurantCards = restaurantGrid ? 
          restaurantGrid.querySelectorAll('a[href*="/app/"]') : 
          document.querySelectorAll('a[href*="/app/"]');
        
        restaurantsWithRates.forEach(restaurant => {
          if (restaurant.sellOutRate > 0.8) { // 80% threshold
            // Find the card for this restaurant
            const restaurantCard = Array.from(restaurantCards).find(card => {
              const href = card.getAttribute('href');
              return href && href.includes(restaurant.id);
            });
            
            if (restaurantCard) {
              // Check if indicator already exists
              const existingIndicator = restaurantCard.querySelector('.ld-sellout-indicator');
              
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
                
                if (cardDiv) {
                  cardDiv.style.position = 'relative';
                  cardDiv.appendChild(indicator);
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
          return;
        }

        // Find the selected restaurant
        const selectedRestaurant = availabilityData.find(restaurant => restaurant.isSelected);
        if (!selectedRestaurant) {
          return;
        }

        // Check if stats are already displayed
        if (document.getElementById('lunchdrop-restaurant-stats')) {
          return;
        }

        const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL, LanchDrapConfig.CONFIG.ENDPOINTS);
        let stats = null;

        try {
          stats = await apiClient.getRestaurantById(selectedRestaurant.id, selectedRestaurant.name);
          
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
        let restaurantNameElement = document.querySelector('.text-3xl.font-bold');
        if (!restaurantNameElement) {
          restaurantNameElement = document.querySelector('#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)');
        }
        
        if (restaurantNameElement) {
          const insertionPoint = restaurantNameElement.parentNode || restaurantNameElement;
          insertionPoint.insertBefore(statsContainer, restaurantNameElement.nextSibling);
        }

      } catch (error) {
        console.error('Error displaying selected restaurant stats:', error);
      }
    }

    // Function to parse menu items from restaurant page
    function parseMenuFromPage() {
      try {
        // Look for menu sections with the structure provided by the user
        const menuSections = document.querySelectorAll('.my-16');
        const allMenuItems = [];
        
        menuSections.forEach(section => {
          // Find all menu item containers within this section
          const menuItems = section.querySelectorAll('.my-4.text-lg.cursor-pointer');
          
          menuItems.forEach(item => {
            // Extract the menu item name from the span with font-bold class
            const nameElement = item.querySelector('.flex.items-center.font-bold span');
            if (nameElement) {
              const menuItemName = nameElement.textContent.trim();
              if (menuItemName) {
                allMenuItems.push(menuItemName);
              }
            }
          });
        });
        
        return allMenuItems;
      } catch (error) {
        console.error('Error parsing menu from page:', error);
        return [];
      }
    }


    // Function to display restaurant tracking information on detail pages
    async function displayRestaurantTrackingInfo() {
      try {
        // Check if we're on a restaurant detail page by looking for the restaurant name
        // Try multiple selectors to find the restaurant name
        let restaurantNameElement = document.querySelector('.text-3xl.font-bold');
        if (!restaurantNameElement) {
          restaurantNameElement = document.querySelector('#app > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(7) > div > div > div:nth-child(1) > div:nth-child(1)');
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
        const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL, LanchDrapConfig.CONFIG.ENDPOINTS);

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
            stats = await apiClient.getRestaurantById(restaurantId, restaurantName);

            if (!stats) {
              return;
            }

            // Check if we need to update the restaurant name or menu in backend
            // Only update if we have a real name (not just an ID) and it's different from what's stored
            const needsNameUpdate = restaurantName !== restaurantId && 
                                   restaurantName.length > 3 && 
                                   stats.name !== restaurantName;
            
            // Parse menu items from the page
            const menuItems = parseMenuFromPage();
            const needsMenuUpdate = menuItems.length > 0;
            
            if (needsNameUpdate || needsMenuUpdate) {
              try {
                await apiClient.updateRestaurant(restaurantId, restaurantName, menuItems);
                console.log('LanchDrap Rating Extension: Updated restaurant data:', {
                  restaurantId,
                  restaurantName,
                  menuItems: menuItems
                });
              } catch (error) {
                // Silently handle the error for now since the endpoint may not be available
                console.warn('LanchDrap Rating Extension: Could not update restaurant data in backend (endpoint may not be available):', error.message);
              }
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
            
          }
        } else {
          return;
        }

        // Check if tracking info is already displayed
        if (document.getElementById('lunchdrop-restaurant-stats')) {
          return;
        }

        // Create tracking info display using shared component
        const trackingInfo = renderStatsComponent(stats, 'lunchdrop-restaurant-stats', 'Restaurant Stats');

        // Insert the tracking info near the restaurant name
        // Try to find a good insertion point near the restaurant name
        const insertionPoint = restaurantNameElement.parentNode || restaurantNameElement;
        insertionPoint.insertBefore(trackingInfo, restaurantNameElement.nextSibling);
      } catch (error) {
        console.error('Error displaying restaurant tracking info:', error);
      }
    }

    // Function to extract date from LanchDrap URL
    function extractDateFromUrl() {
      try {
        const url = window.location.href;
        
        const dateMatch = url.match(/\/app\/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          return dateMatch[1]; // Returns YYYY-MM-DD format
        }

        // If no date in URL but URL contains /app, treat as today
        if (url.includes('/app') && !url.includes('/app/')) {
          const today = new Date();
          return today.toISOString().split('T')[0]; // Returns YYYY-MM-DD format for today
        }

        return null;
      } catch (error) {
        console.error('Error extracting date from URL:', error);
        return null;
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
          // Store data locally for later submission
          storeAvailabilitySummaryLocally(availabilityData);
          return;
        }

        const urlDate = extractDateFromUrl();
        // Validate data before sending
        if (!availabilityData || availabilityData.length === 0) {
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
          return;
        }

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



    // Run detection on page load
    // detectLunchDropRatingPrompt(); // Disabled - not working on rating prompts yet
    
    // Check if we're on a restaurant detail page and display tracking info
    // Only call this on individual restaurant pages (URLs with restaurant IDs)
    if (window.location.pathname.match(/\/app\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9]+$/)) {
      setTimeout(() => {
        displayRestaurantTrackingInfo();
      }, 500);
    }

    // Check if we're on the main restaurant grid page
    if (
      window.location.pathname.includes('/app/') ||
      document.querySelector('div.mx-4.my-8.sm\\:my-2')
    ) {
      // Wait for page to load and then scrape availability (reduced delay)
      setTimeout(async () => {
        await scrapeRestaurantAvailability();
      }, 300);
    }

    // Also run when URL changes (for SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        clearDomCache(); // Clear cache when URL changes
        // detectLunchDropRatingPrompt(); // Disabled - not working on rating prompts yet

        // Check if we're on a restaurant detail page and display tracking info
        // Only call this on individual restaurant pages (URLs with restaurant IDs)
        if (url.match(/\/app\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9]+$/)) {
          setTimeout(() => {
            displayRestaurantTrackingInfo();
          }, 200);
        }

        // Check if we're on a restaurant grid page
        if (url.includes('/app/') || document.querySelector('div.mx-4.my-8.sm\\:my-2')) {
          setTimeout(async () => {
            await scrapeRestaurantAvailability();
          }, 200);
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

    // Add floating button for manual rating (lazy loaded after page is stable)
    setTimeout(() => {
      addFloatingButton();
    }, 2000);
  }

  // Function to submit pending data once utilities are loaded
  async function submitPendingData() {
    try {
      // Check if utilities are now loaded
      if (typeof LanchDrapApiClient === 'undefined' || typeof LanchDrapConfig === 'undefined') {
        return;
      }

      // const apiClient = new LanchDrapApiClient.ApiClient(LanchDrapConfig.CONFIG.API_BASE_URL);


      // Submit pending availability summaries
      const pendingSummaries = JSON.parse(
        localStorage.getItem('pendingAvailabilitySummaries') || '[]'
      );
      if (pendingSummaries.length > 0) {
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

