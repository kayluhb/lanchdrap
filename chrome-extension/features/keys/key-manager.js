// Key visibility manager for LanchDrap extension
// Centralized management of key visibility and Konami code functionality

// Create global namespace for key manager
window.LanchDrapKeyManager = (() => {
  let keysVisible = false;
  let isInitialized = false;

  // Konami code sequence
  const konamiCode = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'KeyB',
    'KeyA',
    'Enter',
  ];
  let konamiSequence = [];

  // Initialize key visibility from localStorage
  function initializeKeyVisibility() {
    const stored = localStorage.getItem('lanchdrap_keys_visible');

    // Default to false (hidden) if no stored value exists
    keysVisible = stored === 'true';

    // If this is the first time, ensure keys start hidden
    if (stored === null) {
      keysVisible = false;
      localStorage.setItem('lanchdrap_keys_visible', 'false');
    }
  }

  // Toggle key visibility
  function toggleKeyVisibility() {
    keysVisible = !keysVisible;
    localStorage.setItem('lanchdrap_keys_visible', keysVisible.toString());

    // Update all existing key elements
    updateKeyVisibility();

    // Show feedback
    showKonamiFeedback();
  }

  // Update visibility of all key elements
  function updateKeyVisibility() {
    const keyElements = document.querySelectorAll('.ld-key-element');
    for (const element of keyElements) {
      const newDisplay = keysVisible ? 'inline' : 'none';
      element.style.display = newDisplay;
    }

    // Also update edit triggers cursor and title
    const editTriggers = document.querySelectorAll('.ld-edit-stats-trigger');
    for (const trigger of editTriggers) {
      trigger.style.cursor = keysVisible ? 'pointer' : 'default';
      trigger.title = keysVisible
        ? 'Click to edit restaurant stats'
        : 'Enable keys visibility to edit stats';
    }
  }

  // Show visual feedback for Konami code
  function showKonamiFeedback() {
    // Create or update feedback element
    let feedback = document.getElementById('lanchdrap-konami-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.id = 'lanchdrap-konami-feedback';
      feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 14px;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;
      document.body.appendChild(feedback);
    }

    feedback.textContent = keysVisible ? '🔑 Keys Visible' : '🔒 Keys Hidden';

    // Animate in
    setTimeout(() => {
      feedback.style.transform = 'translateX(0)';
    }, 10);

    // Animate out after 2 seconds
    setTimeout(() => {
      feedback.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }, 2000);
  }

  // Handle Konami code input
  function handleKonamiInput(event) {
    // Reset sequence if too much time has passed
    if (
      konamiSequence.length > 0 &&
      Date.now() - konamiSequence[konamiSequence.length - 1].timestamp > 3000
    ) {
      konamiSequence = [];
    }

    // Add current key to sequence
    konamiSequence.push({
      key: event.code,
      timestamp: Date.now(),
    });

    // Keep only the last 11 keys
    if (konamiSequence.length > konamiCode.length) {
      konamiSequence = konamiSequence.slice(-konamiCode.length);
    }

    // Check if sequence matches Konami code
    if (konamiSequence.length === konamiCode.length) {
      const sequenceKeys = konamiSequence.map((item) => item.key);
      if (sequenceKeys.every((key, index) => key === konamiCode[index])) {
        toggleKeyVisibility();
        konamiSequence = []; // Reset sequence
      }
    }
  }

  // Initialize Konami code detection
  function initializeKonamiCode() {
    if (isInitialized) return;

    initializeKeyVisibility();
    document.addEventListener('keydown', handleKonamiInput);
    isInitialized = true;
  }

  // Create a key element with proper styling and visibility
  function createKeyElement(keyText, title = 'Click to select key') {
    return `
      <span style="
        font-size: 12px;
        font-weight: 500;
        color: #4a4a4a;
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        cursor: pointer;
        user-select: all;
        display: ${keysVisible ? 'inline' : 'none'};
      " title="${title}" class="ld-key-element">${keyText}</span>
    `;
  }

  // Create an edit trigger with proper cursor and title
  function createEditTrigger(restaurantId, restaurantName) {
    return {
      cursor: keysVisible ? 'pointer' : 'default',
      title: keysVisible
        ? 'Click to edit restaurant stats'
        : 'Enable keys visibility to edit stats',
      dataRestaurantId: restaurantId,
      dataRestaurantName: restaurantName,
    };
  }

  // Check if keys are visible (for conditional logic)
  function areKeysVisible() {
    return keysVisible;
  }

  // Force update key visibility (useful after DOM changes)
  function forceUpdateKeyVisibility() {
    updateKeyVisibility();
  }

  // Return public API
  return {
    initializeKonamiCode,
    updateKeyVisibility,
    forceUpdateKeyVisibility,
    createKeyElement,
    createEditTrigger,
    areKeysVisible,
    toggleKeyVisibility,
  };
})();
