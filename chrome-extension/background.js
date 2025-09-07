// Background service worker for LunchDrop Rating Extension

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open welcome page
    chrome.tabs.create({
      url: 'https://github.com/yourusername/lanchdrap#readme',
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((_tab) => {});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.ratingHistory) {
    // You could sync with server here if needed
    // syncRatingsToServer();
  }
});

// Optional: Sync ratings to server periodically
function syncRatingsToServer() {
  chrome.storage.local.get(['ratingHistory', 'lastSync'], (result) => {
    const { ratingHistory, lastSync } = result;
    const now = Date.now();

    // Only sync if we haven't synced in the last hour
    if (!lastSync || now - lastSync > 3600000) {
      if (ratingHistory && ratingHistory.length > 0) {
        // Send ratings to server
        fetch(LunchDropConfig.getApiUrl(LunchDropConfig.CONFIG.ENDPOINTS.SYNC), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ratings: ratingHistory }),
        })
          .then((response) => {
            if (response.ok) {
              chrome.storage.local.set({ lastSync: now });
            }
          })
          .catch((_error) => {});
      }
    }
  });
}

// Set up periodic sync (every 6 hours)
setInterval(syncRatingsToServer, 21600000);

// Handle context menu (optional)
chrome.runtime.onInstalled.addListener(() => {
  // Check if contextMenus API is available
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: 'rateLunchDrop',
      title: 'Rate this LunchDrop order',
      contexts: ['page'],
      documentUrlPatterns: ['https://lunchdrop.com/*', 'https://*.lunchdrop.com/*'],
    });
  }
});

// Only add the listener if contextMenus API is available
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'rateLunchDrop') {
      // Send message to content script to show rating widget
      chrome.tabs.sendMessage(tab.id, { action: 'showRatingWidget' });
    }
  });
}
