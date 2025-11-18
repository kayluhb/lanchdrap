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
  function addSellOutIndicators(restaurantsData, expectedDate = null) {
    try {
      // Clear existing badges before adding new ones to ensure fresh data is displayed
      const existingBadges = document.querySelectorAll(
        '.ld-slots-badge, .ld-soldout-last-time-badge'
      );
      if (existingBadges.length > 0) {
        existingBadges.forEach((badge) => badge.remove());
      }

      // Find the restaurant grid container using a reliable class-based selector
      let restaurantGrid = document.querySelector('.mx-4.my-8');

      // Try fallback approach if selector doesn't work
      if (!restaurantGrid && window.LanchDrapDOMUtils?.getCachedRestaurantGrid) {
        restaurantGrid = window.LanchDrapDOMUtils.getCachedRestaurantGrid();
      }

      if (!restaurantGrid) {
        console.warn('LanchDrap: Restaurant grid container not found');
        return;
      }

      // Now find restaurant cards within the grid only
      const restaurantCards = restaurantGrid.querySelectorAll('a[href*="/app/"]');

      if (!restaurantCards || restaurantCards.length === 0) {
        console.warn('LanchDrap: No restaurant cards found in grid');
        return;
      }

      // Match by index since the order is the same
      const restaurantCardsArray = Array.from(restaurantCards);

      // Process each restaurant by matching index
      let badgesAdded = 0;
      for (let i = 0; i < restaurantsData.length; i++) {
        const restaurantData = restaurantsData[i];
        const restaurantCard = restaurantCardsArray[i];

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

        // Add or update slots available badge (top)
        if (
          restaurantData.numSlotsAvailable !== undefined &&
          restaurantData.numSlotsAvailable !== null
        ) {
          const existingSlotsBadge = cardDiv.querySelector('.ld-slots-badge');
          const slotsText =
            restaurantData.numSlotsAvailable === 1
              ? '1 slot left'
              : `${restaurantData.numSlotsAvailable} slots left`;
          
          if (existingSlotsBadge) {
            // Update existing badge with new data
            existingSlotsBadge.textContent = slotsText;
          } else {
            // Create new badge
            const slotsBadge = document.createElement('div');
            slotsBadge.className = 'ld-slots-badge';
            slotsBadge.textContent = slotsText;
            cardDiv.appendChild(slotsBadge);
            badgesAdded++;
          }
        } else {
          // Remove badge if no slots data
          const existingSlotsBadge = cardDiv.querySelector('.ld-slots-badge');
          if (existingSlotsBadge) {
            existingSlotsBadge.remove();
          }
        }

        // Add or update sold out last time badge (bottom)
        const soldOutLastTime = checkSoldOutLastTime(
          restaurantData.appearances,
          restaurantData.soldOutDates
        );
        const existingSoldOutBadge = cardDiv.querySelector('.ld-soldout-last-time-badge');
        if (soldOutLastTime) {
          if (!existingSoldOutBadge) {
            // Create new badge
            const soldOutBadge = document.createElement('div');
            soldOutBadge.className = 'ld-soldout-last-time-badge';
            soldOutBadge.textContent = 'Sold Out Last Time';
            cardDiv.appendChild(soldOutBadge);
            badgesAdded++;
          }
        } else {
          // Remove badge if restaurant is no longer sold out last time
          if (existingSoldOutBadge) {
            existingSoldOutBadge.remove();
          }
        }
      }
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
