// Restaurant context utilities for LanchDrap extension
// Centralized logic for extracting restaurant ID and name from current page

// Create global namespace for restaurant context utilities
window.LanchDrapRestaurantContext = (() => {
  // Function to extract restaurant ID from current page data
  async function getRestaurantIdFromPage() {
    try {
      // Get the actual restaurant ID from page data
      if (window.LanchDrapUserIdManager?.LanchDrapUserIdManager) {
        const userIdManager = new window.LanchDrapUserIdManager.LanchDrapUserIdManager();
        const restaurantId = userIdManager.getLunchdropRestaurantId();
        if (restaurantId) {
          console.log('LanchDrap: Found restaurant ID from page data:', restaurantId);
          return restaurantId;
        }
      }

      console.log('LanchDrap: No restaurant ID found in page data');
      // Fallback: try to infer via delivery link + API (works on confirmation pages)
      try {
        const urlDate = window.LanchDrapDOMUtils?.extractDateFromUrl
          ? window.LanchDrapDOMUtils.extractDateFromUrl()
          : null;
        if (urlDate) {
          // Find any link pointing to /app/:date/:deliveryId
          const deliveryLink = Array.from(
            document.querySelectorAll('a[href*="/app/" ] , a[href*="/app/"]')
          )
            .map((a) => a.getAttribute('href'))
            .filter((href) => typeof href === 'string' && href.includes(`/app/${urlDate}/`))[0];

          if (deliveryLink) {
            const parts = deliveryLink.split('/').filter(Boolean);
            const deliveryId = parts[parts.length - 1];
            if (deliveryId && window.LanchDrapRestaurantScraper?.scrapeRestaurantAvailability) {
              // Prefer API to avoid stale initial render
              const availability =
                await window.LanchDrapRestaurantScraper.scrapeRestaurantAvailability({
                  prefer: 'api',
                });
              if (Array.isArray(availability) && availability.length > 0) {
                const match = availability.find((r) => r.href && r.href.endsWith(`/${deliveryId}`));
                if (match?.id) {
                  console.log('LanchDrap: Inferred restaurant ID via delivery link:', match.id);
                  return match.id;
                }
              }
            }
          }
        }
      } catch (_e) {}

      return null;
    } catch (_error) {
      console.log('LanchDrap: Error in getRestaurantIdFromPage:', _error);
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
      // First, try to get restaurant name from page data
      if (window.LanchDrapUserIdManager?.LanchDrapUserIdManager) {
        const userIdManager = new window.LanchDrapUserIdManager.LanchDrapUserIdManager();
        const restaurantId = userIdManager.getLunchdropRestaurantId();
        if (restaurantId && typeof window !== 'undefined' && window.app) {
          const appElement = window.app;
          if (appElement?.dataset?.page) {
            try {
              const pageData = JSON.parse(appElement.dataset.page);
              if (pageData.props?.delivery?.restaurant?.name) {
                console.log(
                  'LanchDrap: Found restaurant name in page data:',
                  pageData.props.delivery.restaurant.name
                );
                return pageData.props.delivery.restaurant.name;
              }
            } catch (error) {
              console.log('LanchDrap: Error parsing page data for restaurant name:', error);
            }
          }
        }
      }

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

  // Function to extract restaurant logo from current page data
  function getRestaurantLogoFromPage() {
    try {
      // Try to get restaurant logo from page data
      if (window.LanchDrapUserIdManager?.LanchDrapUserIdManager) {
        const userIdManager = new window.LanchDrapUserIdManager.LanchDrapUserIdManager();
        const restaurantId = userIdManager.getLunchdropRestaurantId();
        if (restaurantId && typeof window !== 'undefined' && window.app) {
          const appElement = window.app;
          if (appElement?.dataset?.page) {
            try {
              const pageData = JSON.parse(appElement.dataset.page);
              if (pageData.props?.delivery?.restaurant?.logo) {
                console.log(
                  'LanchDrap: Found restaurant logo in page data:',
                  pageData.props.delivery.restaurant.logo
                );
                return pageData.props.delivery.restaurant.logo;
              }
            } catch (error) {
              console.log('LanchDrap: Error parsing page data for restaurant logo:', error);
            }
          }
        }
      }

      return null;
    } catch (_error) {
      console.log('LanchDrap: Error in getRestaurantLogoFromPage:', _error);
      return null;
    }
  }

  // Main function to get complete restaurant context from current page
  async function getCurrentRestaurantContext() {
    try {
      const restaurantId = await getRestaurantIdFromPage();
      const restaurantName = getRestaurantNameFromPage();
      const restaurantLogo = getRestaurantLogoFromPage();

      return {
        id: restaurantId,
        name: restaurantName,
        logo: restaurantLogo,
        hasValidId: !!restaurantId,
        hasValidName: !!(restaurantName && restaurantName !== restaurantId),
      };
    } catch (_error) {
      console.log('LanchDrap: Error in getCurrentRestaurantContext:', _error);
      return {
        id: null,
        name: null,
        logo: null,
        hasValidId: false,
        hasValidName: false,
      };
    }
  }

  // Function to check if we're on a restaurant detail page
  async function isRestaurantDetailPage() {
    const restaurantId = await getRestaurantIdFromPage();
    return !!restaurantId;
  }

  // Function to check if we're on a restaurant grid page
  function isRestaurantGridPage() {
    try {
      // Check if we have deliveries data (indicates we're on a grid page)
      if (typeof window !== 'undefined' && window.app) {
        const appElement = window.app;
        if (appElement?.dataset?.page) {
          try {
            const pageData = JSON.parse(appElement.dataset.page);
            return !!pageData.props?.lunchDay?.deliveries;
          } catch (error) {
            console.log('LanchDrap: Error parsing page data for grid page check:', error);
          }
        }
      }
      return false;
    } catch (_error) {
      return false;
    }
  }

  // Return public API
  return {
    getRestaurantIdFromPage,
    getRestaurantNameFromPage,
    getRestaurantLogoFromPage,
    getCurrentRestaurantContext,
    getSelectedRestaurantCard,
    isRestaurantDetailPage,
    isRestaurantGridPage,
  };
})();
