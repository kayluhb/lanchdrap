// Rating utilities for Cloudflare Worker
// Centralized rating emoji mapping to avoid duplication

/**
 * Get emoji for a rating value
 * @param {number} rating - Rating value (1-4)
 * @returns {string} Emoji string
 */
export function getRatingEmoji(rating) {
  const emojis = { 1: '🤮', 2: '😐', 3: '🤤', 4: '🤯' };
  return emojis[rating] || '⭐';
}

