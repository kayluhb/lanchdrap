// Main content script for LanchDrap extension
// Only waits for data layer initialization

// Global state
let isInitialized = false;
let lastUrl = window.location.href;

// Initialize the extension
async function initializeExtension() {
  if (isInitialized) return;

  // Initialize data layer if not already done
  try {
    if (window.LanchDrapDataLayer) {
      // Initialize the data layer
      await window.LanchDrapDataLayer.initialize();
      console.log('LanchDrap: Data layer initialized');
    } else {
      console.warn('LanchDrap: Data layer not available');
    }
  } catch (error) {
    console.warn('LanchDrap: Data layer initialization failed:', error);
  }

  isInitialized = true;
}

// Main function to handle page changes
async function handlePageChange() {
  try {
    const currentUrl = window.location.href;
    const urlChanged = currentUrl !== lastUrl;

    // Update last URL
    lastUrl = currentUrl;

    // Initialize if not already done
    await initializeExtension();

    // Only call data layer handlePageChange if URL actually changed
    // (data layer handles initial load automatically)
    if (urlChanged && window.LanchDrapDataLayer?.handlePageChange) {
      await window.LanchDrapDataLayer.handlePageChange();
    }
  } catch (error) {
    console.error('🚀 LanchDrap: Error in handlePageChange:', error);
  }
}

// Set up event listeners for page navigation
function setupEventListeners() {
  // Handle initial page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      handlePageChange();
    });
  } else {
    handlePageChange();
  }

  // Listen for browser back/forward navigation
  window.addEventListener('popstate', () => {
    handlePageChange();
  });

  // Intercept programmatic navigation (pushState/replaceState)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = (...args) => {
    originalPushState.apply(history, args);
    // Small delay to allow DOM to update
    setTimeout(() => {
      handlePageChange();
    }, 100);
  };

  history.replaceState = (...args) => {
    originalReplaceState.apply(history, args);
    // Small delay to allow DOM to update
    setTimeout(() => {
      handlePageChange();
    }, 100);
  };

  // Listen for DOM changes that might indicate page content updates
  // This is useful for SPAs that update content without changing the URL
  const observer = new MutationObserver((mutations) => {
    let shouldHandleChange = false;

    for (const mutation of mutations) {
      // Check if the app element or its data attributes changed
      if (
        mutation.type === 'attributes' &&
        (mutation.attributeName === 'data-page' || mutation.target.id === 'app')
      ) {
        shouldHandleChange = true;
        break;
      }

      // Check if child nodes were added to the app element or its descendants
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if this is the app element or a descendant of it
        const isAppElement = mutation.target.id === 'app';
        const isAppDescendant = mutation.target.closest('#app') !== null;

        if (isAppElement || isAppDescendant) {
          shouldHandleChange = true;
          break;
        }
      }

      // Also trigger on any significant content changes within the app
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any added node contains meaningful content
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this looks like a page content change
            const hasSignificantContent =
              node.querySelector &&
              (node.querySelector('[data-page]') ||
                node.querySelector('.restaurant') ||
                node.querySelector('.delivery') ||
                node.textContent?.trim().length > 50);

            if (hasSignificantContent) {
              shouldHandleChange = true;
              break;
            }
          }
        }
      }
    }

    if (shouldHandleChange) {
      // Debounce to avoid multiple rapid calls
      clearTimeout(window.lanchdrapChangeTimeout);
      window.lanchdrapChangeTimeout = setTimeout(() => {
        handlePageChange();
      }, 200);
    }
  });

  // Start observing the app element for changes
  const appElement = document.getElementById('app');
  if (appElement) {
    observer.observe(appElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['data-page'],
    });
  } else {
    // If app element doesn't exist yet, wait for it
    const checkForApp = setInterval(() => {
      const app = document.getElementById('app');
      if (app) {
        observer.observe(app, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['data-page'],
        });
        clearInterval(checkForApp);
      }
    }, 100);
  }
}

// Initialize when the script loads
setupEventListeners();
