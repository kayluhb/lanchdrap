// Restaurant context utilities for LanchDrap extension
// Centralized logic for extracting restaurant ID and name from current page

// Create global namespace for restaurant context utilities
window.LanchDrapRestaurantContext = (() => {
  // Function to extract restaurant ID from current page URL or selected card
  function getRestaurantIdFromUrl() {
    try {
      const urlParts = window.location.pathname.split('/');

      // Case 1: Individual restaurant detail page
      // Expected URL structure: /app/2025-09-08/eajz7qx8
      // We want the last part (restaurant ID), not the date
      if (urlParts.length >= 4 && urlParts[1] === 'app') {
        const potentialId = urlParts[urlParts.length - 1];

        // Validate that it's not a date (YYYY-MM-DD format)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(potentialId)) {
          return potentialId;
        }
      }

      // Case 2: Daily/grid page - look for selected restaurant card
      // Expected URL structure: /app/2025-09-08
      if (urlParts.length === 3 && urlParts[1] === 'app') {
        const selectedCard = getSelectedRestaurantCard();
        if (selectedCard) {
          const href = selectedCard.getAttribute('href');
          if (href) {
            const hrefParts = href.split('/');
            if (hrefParts.length > 2) {
              const restaurantId = hrefParts[hrefParts.length - 1];
              return restaurantId;
            }
          }
        }
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  // Function to get the visually selected restaurant card on grid pages
  function getSelectedRestaurantCard() {
    try {
      // Look for restaurant cards with the border-2 class (selected state)
      const selectedCards = document.querySelectorAll(
        'a[href*="/app/"] .border-2, a[href*="/app/"][class*="border-2"]'
      );

      if (selectedCards.length > 0) {
        // Return the parent link element
        const selectedCard = selectedCards[0];
        return selectedCard.closest('a[href*="/app/"]') || selectedCard;
      }

      // Fallback: look for cards with border-2 class in their div children
      const allRestaurantLinks = document.querySelectorAll('a[href*="/app/"]');
      for (const link of allRestaurantLinks) {
        const cardDiv = link.querySelector('div');
        if (cardDiv?.classList.contains('border-2')) {
          return link;
        }
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  // Function to extract restaurant name from current page elements
  function getRestaurantNameFromPage() {
    try {
      // Case 1: Individual restaurant detail page - look for page headings
      const titleSelectors = [
        '.text-3xl.font-bold',
        'h1',
        '.text-2xl.font-bold',
        '.text-xl.font-bold',
        '.font-bold',
        '[class*="restaurant"]',
        '.restaurant-name',
        '.order-restaurant',
      ];

      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement) {
          const titleText = titleElement.textContent?.trim();
          if (
            titleText &&
            !titleText.toLowerCase().includes('order') &&
            !titleText.toLowerCase().includes('confirmation') &&
            !titleText.toLowerCase().includes('placed') &&
            !titleText.toLowerCase().includes('successful') &&
            !titleText.toLowerCase().includes('thank you') &&
            titleText.length > 2 &&
            titleText.length < 100
          ) {
            return titleText;
          }
        }
      }

      // Case 2: Daily/grid page - look for restaurant name in selected card
      const selectedCard = getSelectedRestaurantCard();
      if (selectedCard) {
        // Try to find restaurant name in the selected card
        const nameSelectors = ['.font-bold', '.text-lg', '.text-base', 'span', 'div'];

        for (const selector of nameSelectors) {
          const nameElement = selectedCard.querySelector(selector);
          if (nameElement) {
            const nameText = nameElement.textContent?.trim();
            if (
              nameText &&
              !nameText.toLowerCase().includes('order') &&
              !nameText.toLowerCase().includes('placed') &&
              !nameText.toLowerCase().includes('sold out') &&
              !nameText.toLowerCase().includes('ordering closed') &&
              nameText.length > 2 &&
              nameText.length < 50
            ) {
              return nameText;
            }
          }
        }
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  // Function to get restaurant name from localStorage using restaurant ID
  function getRestaurantNameFromStorage(restaurantId) {
    try {
      if (!restaurantId) return null;

      const localKey = `restaurant_name:${restaurantId}`;
      const storedName = localStorage.getItem(localKey);

      if (storedName && storedName !== restaurantId) {
        return storedName;
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  // Function to store restaurant name in localStorage
  function storeRestaurantName(restaurantId, restaurantName) {
    try {
      if (!restaurantId || !restaurantName || restaurantName === restaurantId) {
        return;
      }

      const localKey = `restaurant_name:${restaurantId}`;
      localStorage.setItem(localKey, restaurantName);

      // Also store in chrome.storage.local for popup access
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [localKey]: restaurantName });
      }
    } catch (_error) {
      // Silently fail if storage is not available
    }
  }

  // Main function to get complete restaurant context from current page
  function getCurrentRestaurantContext() {
    try {
      const restaurantId = getRestaurantIdFromUrl();
      let restaurantName = getRestaurantNameFromPage();

      // If we found a restaurant name from the page, store it for future use
      if (restaurantName && restaurantId) {
        storeRestaurantName(restaurantId, restaurantName);
      }

      // If we didn't find a name from the page, try to get it from storage
      if (!restaurantName && restaurantId) {
        restaurantName = getRestaurantNameFromStorage(restaurantId);
      }

      return {
        id: restaurantId,
        name: restaurantName,
        hasValidId: !!restaurantId,
        hasValidName: !!(restaurantName && restaurantName !== restaurantId),
      };
    } catch (_error) {
      return {
        id: null,
        name: null,
        hasValidId: false,
        hasValidName: false,
      };
    }
  }

  // Function to check if we're on a restaurant detail page
  function isRestaurantDetailPage() {
    const restaurantId = getRestaurantIdFromUrl();
    return !!restaurantId;
  }

  // Function to check if we're on a restaurant grid page
  function isRestaurantGridPage() {
    try {
      const urlParts = window.location.pathname.split('/');
      // Grid pages have structure like /app/2025-09-08
      return (
        urlParts.length === 3 && urlParts[1] === 'app' && /^\d{4}-\d{2}-\d{2}$/.test(urlParts[2])
      );
    } catch (_error) {
      return false;
    }
  }

  // Return public API
  return {
    getRestaurantIdFromUrl,
    getRestaurantNameFromPage,
    getRestaurantNameFromStorage,
    storeRestaurantName,
    getCurrentRestaurantContext,
    getSelectedRestaurantCard,
    isRestaurantDetailPage,
    isRestaurantGridPage,
  };
})();
