// Background service worker for LanchDrap Rating Extension

// Import API client and config for tracking
let LanchDrapApiClient, LanchDrapConfig;

// Load API client and config dynamically
async function loadDependencies() {
  try {
    // Get the config from storage or use default
    const result = await chrome.storage.local.get(['lanchdrapConfig']);
    if (result.lanchdrapConfig) {
      LanchDrapConfig = result.lanchdrapConfig;
    } else {
      // Fallback config
      LanchDrapConfig = {
        CONFIG: {
          API_BASE_URL: 'https://lunchdrop-ratings.caleb-brown.workers.dev',
          ENDPOINTS: {
            RESTAURANTS_APPEARANCES_TRACK: '/api/restaurants/appearances/track',
          },
        },
      };
    }

    // Create a simple API client for the service worker
    LanchDrapApiClient = {
      async trackRestaurantAppearances(trackingData) {
        const response = await fetch(
          `${LanchDrapConfig.CONFIG.API_BASE_URL}${LanchDrapConfig.CONFIG.ENDPOINTS.RESTAURANTS_APPEARANCES_TRACK}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(trackingData),
          }
        );

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        return await response.json();
      },
    };
  } catch (error) {
    console.error('LanchDrap: Failed to load dependencies in service worker:', error);
  }
}

// Initialize dependencies on startup
loadDependencies();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open welcome page
    chrome.tabs.create({
      url: 'https://github.com/kayluhb/lanchdrap#readme',
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((_tab) => {});

// Background tracking function
async function trackRestaurantAppearancesInBackground(trackingData, date) {
  try {
    if (!LanchDrapApiClient || !LanchDrapConfig) {
      await loadDependencies();
    }

    if (!LanchDrapApiClient) {
      console.error('LanchDrap: API client not available in service worker');
      return { success: false, error: 'API client not available' };
    }

    if (!date) {
      console.error('LanchDrap: No date available for tracking');
      return { success: false, error: 'No date provided' };
    }

    // Extract restaurants and orders from data
    const restaurants = trackingData?.restaurants || [];
    const orders = trackingData?.delivery?.orders || [];

    // Don't send empty data to the API
    if ((!restaurants || restaurants.length === 0) && (!orders || orders.length === 0)) {
      return { success: true, message: 'No data to track' };
    }

    const dataToSend = {
      date: date,
    };

    // Add restaurants if available
    if (restaurants && restaurants.length > 0) {
      dataToSend.restaurants = restaurants;
    }

    // Add orders if available
    if (orders && orders.length > 0) {
      dataToSend.orders = orders;
    }

    const result = await LanchDrapApiClient.trackRestaurantAppearances(dataToSend);
    return { success: true, result };
  } catch (error) {
    console.error('LanchDrap: Error in background tracking:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabInfo') {
    // Get information about the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          title: tabs[0].title,
          id: tabs[0].id,
        });
      }
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'openRatingPage') {
    // Open a new tab with rating interface
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html'),
    });
  }

  if (request.action === 'trackRestaurantAppearances') {
    console.log('LanchDrap: Background received tracking request:', {
      data: request.data,
      date: request.date,
    });
    // Handle tracking in background
    trackRestaurantAppearancesInBackground(request.data, request.date)
      .then((result) => {
        console.log('LanchDrap: Background tracking completed:', result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error('LanchDrap: Background tracking error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.ratingHistory) {
    // Rating history changed - no server sync needed
  }
});

// Handle context menu (optional)
chrome.runtime.onInstalled.addListener(() => {
  // Check if contextMenus API is available
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: 'rateLanchDrap',
      title: 'Rate this LanchDrap order',
      contexts: ['page'],
      documentUrlPatterns: ['https://lunchdrop.com/*', 'https://*.lunchdrop.com/*'],
    });
  }
});

// Only add the listener if contextMenus API is available
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'rateLanchDrap') {
      // Send message to content script to show rating widget
      chrome.tabs.sendMessage(tab.id, { action: 'showRatingWidget' });
    }
  });
}
