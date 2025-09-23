// DOM utilities for LanchDrap extension
// Handles DOM caching, element finding, and common DOM operations

// Create global namespace for DOM utilities
window.LanchDrapDOMUtils = (() => {
  // Function to check if we're on a login page
  function isLoginPage() {
    return (
      document.querySelector('input[type="password"]') ||
      document.body.textContent.includes('Sign in') ||
      document.body.textContent.includes('Phone Number or Email Address')
    );
  }

  // Return public API
  return {
    isLoginPage,
  };
})();
