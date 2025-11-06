// Restaurant data utilities for LanchDrap extension
// Handles restaurant availability data loading from JSON (no scraping)

// Create global namespace for restaurant data utilities
window.LanchDrapRestaurantScraper = (() => {
  // Use data layer instead of local state
  // restaurantAvailabilityData is now managed by the data layer

  // Function to track both restaurants and orders on daily pages
  // Note: This function is now deprecated as tracking is handled in the background service worker
  // Keeping for backward compatibility but the actual tracking happens via chrome.runtime.sendMessage
  async function trackRestaurantAppearances() {
    // This function is now a no-op as tracking is handled in the background service worker
    // The content script calls this but the actual API calls happen in background.js
    return;
  }

  // Helper function to check if a date is today
  function isToday(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  // Helper function to check if restaurant sold out last time
  function checkSoldOutLastTime(appearances, soldOutDates) {
    if (!appearances || !appearances.length || !soldOutDates || !soldOutDates.length) {
      return false;
    }

    // Filter out today's date from soldOutDates (we don't want to show badge for today)
    const filteredSoldOutDates = soldOutDates.filter((date) => !isToday(date));

    if (filteredSoldOutDates.length === 0) {
      return false;
    }

    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter appearances to only include past dates (not future, not today)
    const pastAppearances = appearances.filter((date) => {
      const appearanceDate = new Date(date);
      appearanceDate.setHours(0, 0, 0, 0);
      return appearanceDate < today;
    });

    if (pastAppearances.length === 0) {
      return false;
    }

    // Sort past appearances to get the most recent one
    const sortedPastAppearances = [...pastAppearances].sort((a, b) => new Date(b) - new Date(a));
    const mostRecentPastAppearance = sortedPastAppearances[0];

    // Check if most recent past appearance is in filtered soldOutDates
    return filteredSoldOutDates.includes(mostRecentPastAppearance);
  }

  // Function to add badges to restaurant cards (slots available and sold out last time)
  function addSellOutIndicators(restaurantsData) {
    try {
      console.log('LanchDrap: addSellOutIndicators called with data:', restaurantsData);

      // Check if indicators have already been added to prevent duplicate processing
      const existingBadges = document.querySelectorAll(
        '.ld-slots-badge, .ld-soldout-last-time-badge'
      );
      if (existingBadges.length > 0) {
        console.log('LanchDrap: Badges already exist, skipping');
        return;
      }

      // Find the restaurant grid container using a reliable class-based selector
      let restaurantGrid = document.querySelector('.mx-4.my-8');

      // Try fallback approach if selector doesn't work
      if (!restaurantGrid && window.LanchDrapDOMUtils?.getCachedRestaurantGrid) {
        restaurantGrid = window.LanchDrapDOMUtils.getCachedRestaurantGrid();
        console.log('LanchDrap: Found restaurant grid via cached approach');
      }

      if (!restaurantGrid) {
        console.warn('LanchDrap: Restaurant grid container not found');
        return;
      }

      console.log('LanchDrap: Found restaurant grid container');

      // Now find restaurant cards within the grid only
      const restaurantCards = restaurantGrid.querySelectorAll('a[href*="/app/"]');

      if (!restaurantCards || restaurantCards.length === 0) {
        console.warn('LanchDrap: No restaurant cards found in grid');
        return;
      }

      console.log(`LanchDrap: Found ${restaurantCards.length} restaurant cards in grid`);

      console.log(
        `LanchDrap: Processing ${restaurantsData.length} restaurants against ${restaurantCards.length} cards`
      );

      // Match by index since the order is the same
      const restaurantCardsArray = Array.from(restaurantCards);

      // Process each restaurant by matching index
      let badgesAdded = 0;
      for (let i = 0; i < restaurantsData.length; i++) {
        const restaurantData = restaurantsData[i];
        const restaurantCard = restaurantCardsArray[i];

        console.log(
          `LanchDrap: Processing restaurant ${i}: ${restaurantData.name}`,
          restaurantData
        );

        if (!restaurantCard) {
          console.warn(
            `LanchDrap: No card found at index ${i} for restaurant ${restaurantData.name}`
          );
          continue;
        }

        // Make sure the card has relative positioning
        const cardDiv = restaurantCard.querySelector('div');
        if (!cardDiv) {
          console.warn(`LanchDrap: No div found inside card for restaurant ${restaurantData.name}`);
          continue;
        }
        cardDiv.style.position = 'relative';

        // Add slots available badge (top)
        if (
          restaurantData.numSlotsAvailable !== undefined &&
          restaurantData.numSlotsAvailable !== null
        ) {
          const existingSlotsBadge = cardDiv.querySelector('.ld-slots-badge');
          if (!existingSlotsBadge) {
            const slotsBadge = document.createElement('div');
            slotsBadge.className = 'ld-slots-badge';
            const slotsText =
              restaurantData.numSlotsAvailable === 1
                ? '1 slot left'
                : `${restaurantData.numSlotsAvailable} slots left`;
            slotsBadge.textContent = slotsText;
            cardDiv.appendChild(slotsBadge);
            badgesAdded++;
            console.log(`LanchDrap: Added slots badge to ${restaurantData.name}: ${slotsText}`);
          }
        } else {
          console.log(`LanchDrap: No slots data for ${restaurantData.name}`);
        }

        // Add sold out last time badge (bottom)
        const soldOutLastTime = checkSoldOutLastTime(
          restaurantData.appearances,
          restaurantData.soldOutDates
        );
        console.log(
          `LanchDrap: Sold out last time check for ${restaurantData.name}:`,
          soldOutLastTime
        );
        if (soldOutLastTime) {
          const existingSoldOutBadge = cardDiv.querySelector('.ld-soldout-last-time-badge');
          if (!existingSoldOutBadge) {
            const soldOutBadge = document.createElement('div');
            soldOutBadge.className = 'ld-soldout-last-time-badge';
            soldOutBadge.textContent = 'Sold Out Last Time';
            cardDiv.appendChild(soldOutBadge);
            badgesAdded++;
            console.log(`LanchDrap: Added sold out badge to ${restaurantData.name}`);
          }
        }
      }

      console.log(`LanchDrap: Added ${badgesAdded} total badges`);
    } catch (error) {
      console.error('LanchDrap: Error adding indicators:', error);
    }
  }

  // Return public API
  return {
    addSellOutIndicators,
    trackRestaurantAppearances,
  };
})();
