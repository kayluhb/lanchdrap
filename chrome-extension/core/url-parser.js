// URL parser utility for LanchDrap extension
// Extracts date, delivery ID, and page type from URL
// Extracted from data-layer.js for better modularity

window.LanchDrapUrlParser = (() => {
  /**
   * Extract date, delivery ID, and page type from URL
   * @returns {Object} Object with date, deliveryId, and isDayPage properties
   */
  function extractDataFromUrl() {
    try {
      const path = window.location.pathname || '';
      const pathSegments = path.split('/').filter(Boolean);

      // Early return for invalid paths
      if (pathSegments.length === 0 || pathSegments[0] !== 'app') {
        return { date: null, deliveryId: null, isDayPage: false };
      }

      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      const isDeliveryPage = pathSegments.length === 3;
      const isDayPage = pathSegments.length === 2 || pathSegments.length === 1;
      const deliveryId = isDeliveryPage ? pathSegments[2] : null;

      // Handle /app/date/deliveryId format
      if (isDeliveryPage && datePattern.test(pathSegments[1])) {
        return { date: pathSegments[1], deliveryId, isDayPage };
      }

      // Handle /app/date format
      if (pathSegments.length === 2 && datePattern.test(pathSegments[1])) {
        return { date: pathSegments[1], deliveryId, isDayPage };
      }

      // Handle /app format (default to today)
      if (pathSegments.length === 1) {
        const today = new Date().toISOString().split('T')[0];
        return { date: today, deliveryId, isDayPage };
      }

      return { date: null, deliveryId, isDayPage };
    } catch {
      return { date: null, deliveryId: null, isDayPage: false };
    }
  }

  return {
    extractDataFromUrl,
  };
})();

