// Edit dialog for restaurant stats
// Handles editing appearance dates and sold out dates
// Extracted from stats-display.js for better modularity

window.LanchDrapEditDialog = (() => {
  /**
   * Open edit dialog for restaurant stats
   * @param {string} restaurantId - Restaurant identifier
   * @param {string} restaurantName - Restaurant name
   * @param {Object} options - Options object with callbacks
   * @returns {Promise<void>}
   */
  async function openEditDialog(restaurantId, restaurantName, options = {}) {
    const { onSave = null, onCancel = null, apiClient = null } = options;

    // Remove existing dialog if any
    const existingDialog = document.getElementById('lanchdrap-edit-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Create dialog overlay
    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'lanchdrap-edit-dialog';

    // Create dialog content
    const dialogContent = document.createElement('div');
    dialogContent.className = 'ld-edit-content';

    // Helper to create possessive form
    function createPossessive(name) {
      if (!name) return '';
      if (name.endsWith("'s") || name.endsWith("'S")) return name;
      if (name.endsWith('s') || name.endsWith('S')) return `${name}'`;
      return `${name}'s`;
    }

    dialogContent.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">
        Edit ${createPossessive(restaurantName || restaurantId)} Stats
      </h2>
      <p style="margin: 0; color: #666; font-size: 14px;">
        Edit appearance dates and sold out dates for this restaurant
      </p>
    </div>

    <form id="lanchdrap-edit-form">
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
          Appearance Dates (one per line, YYYY-MM-DD format)
        </label>
        <textarea 
          id="appearance-dates" 
          rows="6" 
          placeholder="2024-01-15&#10;2024-01-16&#10;2024-01-17"
        ></textarea>
        <div style="margin-top: 4px; font-size: 12px; color: #666;">
          Enter dates in YYYY-MM-DD format, one per line
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
          Sold Out Dates (one per line, YYYY-MM-DD format)
        </label>
        <textarea 
          id="soldout-dates" 
          rows="4" 
          placeholder="2024-01-15&#10;2024-01-20"
        ></textarea>
        <div style="margin-top: 4px; font-size: 12px; color: #666;">
          Enter dates when the restaurant was sold out
        </div>
      </div>

      <div class="ld-edit-actions">
        <button 
          type="button" 
          id="cancel-edit" 
          class="ld-btn ld-btn-secondary"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          id="save-edit" 
          class="ld-btn ld-btn-primary"
        >
          Save Changes
        </button>
      </div>
    </form>
    `;

    dialogOverlay.appendChild(dialogContent);
    document.body.appendChild(dialogOverlay);

    // Load current data
    await loadCurrentData(restaurantId, apiClient);

    // Setup event listeners
    setupDialogEventListeners(
      restaurantId,
      restaurantName,
      dialogOverlay,
      onSave,
      onCancel,
      apiClient
    );
  }

  /**
   * Load current restaurant data into the form
   * @param {string} restaurantId - Restaurant identifier
   * @param {Object} apiClient - API client instance
   * @returns {Promise<void>}
   */
  async function loadCurrentData(restaurantId, apiClient) {
    try {
      if (
        !apiClient ||
        typeof LanchDrapApiClient === 'undefined' ||
        typeof LanchDrapConfig === 'undefined'
      ) {
        return;
      }

      // Fetch restaurant by ID to prefill appearances/soldout
      let restaurantData = null;
      try {
        const endpoint = `${apiClient.getEndpoint('RESTAURANTS_GET_BY_ID')}/${restaurantId}`;
        restaurantData = await apiClient.request(endpoint);
      } catch (_e) {}

      // Fallback: try stats endpoint if direct lookup failed
      if (!restaurantData || (!restaurantData.appearances && !restaurantData.data?.appearances)) {
        try {
          const params = new URLSearchParams();
          params.append('restaurant', restaurantId);
          const statsEndpoint = `${apiClient.getEndpoint('RESTAURANTS_STATS')}?${params.toString()}`;
          const statsData = await apiClient.request(statsEndpoint);
          restaurantData = statsData?.data || statsData || restaurantData;
        } catch (_e) {}
      }

      const appearancesArray = restaurantData?.appearances || restaurantData?.data?.appearances;
      const soldOutArray = restaurantData?.soldOutDates || restaurantData?.data?.soldOutDates;

      if (appearancesArray) {
        const appearanceDatesTextarea = document.getElementById('appearance-dates');
        const soldoutDatesTextarea = document.getElementById('soldout-dates');

        if (appearanceDatesTextarea) {
          appearanceDatesTextarea.value = appearancesArray.join('\n');
        }

        if (soldoutDatesTextarea) {
          const soldOutDates = soldOutArray || [];
          soldoutDatesTextarea.value = soldOutDates.join('\n');
        }
      }
    } catch (_error) {}
  }

  /**
   * Setup dialog event listeners
   * @param {string} restaurantId - Restaurant identifier
   * @param {string} restaurantName - Restaurant name
   * @param {HTMLElement} dialogOverlay - Dialog overlay element
   * @param {Function} onSave - Save callback
   * @param {Function} onCancel - Cancel callback
   * @param {Object} apiClient - API client instance
   */
  function setupDialogEventListeners(
    restaurantId,
    _restaurantName,
    dialogOverlay,
    onSave,
    onCancel,
    apiClient
  ) {
    const form = document.getElementById('lanchdrap-edit-form');
    const cancelButton = document.getElementById('cancel-edit');
    const saveButton = document.getElementById('save-edit');

    // Cancel button
    cancelButton.addEventListener('click', () => {
      dialogOverlay.remove();
      if (onCancel) onCancel();
    });

    // Close on overlay click
    dialogOverlay.addEventListener('click', (e) => {
      if (e.target === dialogOverlay) {
        dialogOverlay.remove();
        if (onCancel) onCancel();
      }
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const appearanceDatesTextarea = document.getElementById('appearance-dates');
      const soldoutDatesTextarea = document.getElementById('soldout-dates');

      const appearanceDates = appearanceDatesTextarea.value
        .split('\n')
        .map((date) => date.trim())
        .filter((date) => date.length > 0);

      const soldoutDates = soldoutDatesTextarea.value
        .split('\n')
        .map((date) => date.trim())
        .filter((date) => date.length > 0);

      // Validate dates
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const invalidAppearanceDates = appearanceDates.filter((date) => !dateRegex.test(date));
      const invalidSoldoutDates = soldoutDates.filter((date) => !dateRegex.test(date));

      if (invalidAppearanceDates.length > 0 || invalidSoldoutDates.length > 0) {
        alert('Please enter dates in YYYY-MM-DD format');
        return;
      }

      // Disable save button and show loading
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';

      try {
        if (onSave) {
          await onSave(restaurantId, appearanceDates, soldoutDates);
        } else if (apiClient) {
          // Default save behavior
          await apiClient.updateRestaurantAppearances(restaurantId, appearanceDates, soldoutDates);
        }
        dialogOverlay.remove();
      } catch (error) {
        const message = error?.message || 'Unknown error';
        alert(`Error saving changes: ${message}`);
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
      }
    });
  }

  return {
    openEditDialog,
  };
})();
