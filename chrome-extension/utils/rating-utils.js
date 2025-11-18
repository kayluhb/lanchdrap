// Rating utilities for LanchDrap extension
// Centralized rating emoji mapping to avoid duplication

window.LanchDrapRatingUtils = (() => {
  /**
   * Get emoji for a rating value
   * @param {number} rating - Rating value (1-4)
   * @returns {string} Emoji string
   */
  function getRatingEmoji(rating) {
    const emojis = { 1: '🤮', 2: '😐', 3: '🤤', 4: '🤯' };
    return emojis[rating] || '⭐';
  }

  /**
   * Get all rating emojis as an array
   * @returns {Array<{rating: number, emoji: string}>} Array of rating objects
   */
  function getAllRatingEmojis() {
    return [
      { rating: 1, emoji: '🤮', title: 'Never Again' },
      { rating: 2, emoji: '😐', title: 'Meh' },
      { rating: 3, emoji: '🤤', title: 'Pretty Good' },
      { rating: 4, emoji: '🤯', title: 'Life Changing' },
    ];
  }

  return {
    getRatingEmoji,
    getAllRatingEmojis,
  };
})();

