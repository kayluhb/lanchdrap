// Date formatting utilities for LanchDrap extension
// Centralized date formatting to avoid duplication

window.LanchDrapDateFormatter = (() => {
  /**
   * Format a date string to a human-readable format
   * @param {string} dateString - Date string in YYYY-MM-DD format
   * @returns {string} Formatted date string or 'Never' if invalid
   */
  function formatDateString(dateString) {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  }

  /**
   * Format a date to YYYY-MM-DD key format
   * @param {Date|string} date - Date object or date string
   * @returns {string} Date in YYYY-MM-DD format
   */
  function formatDateKey(date) {
    if (typeof date === 'string') {
      return new Date(date).toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  }

  /**
   * Get today's date in YYYY-MM-DD format
   * @returns {string} Today's date
   */
  function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Check if a date string is today
   * @param {string} dateString - Date string in YYYY-MM-DD format
   * @returns {boolean} True if the date is today
   */
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

  return {
    formatDateString,
    formatDateKey,
    getTodayDateString,
    isToday,
  };
})();

