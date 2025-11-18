// Order history normalizer utility
// Handles normalization of order history data structures (old vs new formats)
// Extracted to avoid duplication across multiple files

/**
 * Normalize order history structure to consistent array format
 * Handles both old and new data structures
 * @param {Object} historyData - Order history data object
 * @returns {Array<Object>} Normalized array of orders sorted by date (newest first)
 */
export function normalizeOrderHistory(historyData) {
  if (!historyData) {
    return [];
  }

  let orders = [];
  
  if (historyData.orders && Array.isArray(historyData.orders)) {
    // Old structure - already in array format
    orders = historyData.orders.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (
    historyData.orders &&
    typeof historyData.orders === 'object' &&
    !Array.isArray(historyData.orders)
  ) {
    // Handle malformed data where orders is an object but should be the root structure
    orders = Object.keys(historyData.orders)
      .map((date) => ({
        date,
        items: historyData.orders[date].items || [],
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } else {
    // New structure - convert date-keyed structure to array format
    orders = Object.keys(historyData)
      .filter((key) => key !== 'orders') // Exclude 'orders' key if it exists
      .map((date) => ({
        date,
        items: historyData[date].items || [],
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  
  return orders;
}

