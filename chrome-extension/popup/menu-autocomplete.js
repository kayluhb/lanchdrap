// Menu autocomplete component - handles menu item search and selection
// Extracted from popup.js for better modularity

window.LanchDrapMenuAutocomplete = (() => {
  /**
   * Initialize menu autocomplete
   * @param {HTMLElement} searchInput - Search input element
   * @param {HTMLElement} dropdown - Dropdown container element
   * @param {HTMLElement} selectedItemsContainer - Container for selected items
   * @param {Array<string>} menuItems - Array of menu item names
   * @param {Array<Object>} initialSelectedItems - Initially selected items
   * @param {Function} onSelectionChange - Callback when selection changes
   * @returns {Object} Control object with methods to get/set selected items
   */
  function initMenuAutocomplete(
    searchInput,
    dropdown,
    selectedItemsContainer,
    menuItems,
    initialSelectedItems = [],
    onSelectionChange = null
  ) {
    let selectedMenuItems = [...initialSelectedItems];

    // Filter menu items based on search term
    function filterMenuItems(searchTerm) {
      if (!searchTerm) {
        return menuItems;
      }
      return menuItems.filter((item) => item.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Render dropdown with filtered items
    function renderMenuDropdown(items) {
      dropdown.innerHTML = '';
      if (items.length === 0) {
        dropdown.style.display = 'none';
        return;
      }

      for (const item of items) {
        // Check if this item is already selected
        const isAlreadySelected = selectedMenuItems.some(
          (selected) =>
            selected.label?.toLowerCase() === item.toLowerCase() ||
            selected.toLowerCase() === item.toLowerCase()
        );
        if (isAlreadySelected) continue;

        const option = document.createElement('div');
        option.className = 'menu-option';
        option.textContent = item;
        option.addEventListener('click', () => {
          selectMenuItem(item);
          searchInput.value = '';
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(option);
      }

      dropdown.style.display = 'block';
    }

    // Select a menu item
    function selectMenuItem(itemName) {
      // Create a MenuItem if MenuItem class is available
      let menuItem;
      if (window.LanchDrapModels?.MenuItem) {
        menuItem = window.LanchDrapModels.MenuItem.fromString(itemName);
        const alreadySelected = selectedMenuItems.some((selected) => {
          if (selected.equals?.(menuItem)) return true;
          if (selected.label?.toLowerCase() === itemName.toLowerCase()) return true;
          return false;
        });

        if (!alreadySelected) {
          selectedMenuItems.push(menuItem);
          renderSelectedItems();
          if (onSelectionChange) onSelectionChange(selectedMenuItems);
        }
      } else {
        // Fallback: use simple object
        const alreadySelected = selectedMenuItems.some(
          (selected) => (selected.label || selected).toLowerCase() === itemName.toLowerCase()
        );

        if (!alreadySelected) {
          selectedMenuItems.push({ label: itemName, quantity: 1 });
          renderSelectedItems();
          if (onSelectionChange) onSelectionChange(selectedMenuItems);
        }
      }
    }

    // Remove a menu item
    function removeMenuItem(itemName) {
      if (window.LanchDrapModels?.MenuItem) {
        const menuItem = window.LanchDrapModels.MenuItem.fromString(itemName);
        selectedMenuItems = selectedMenuItems.filter((i) => {
          if (i.equals && !i.equals(menuItem)) return true;
          if (i.label?.toLowerCase() !== itemName.toLowerCase()) return true;
          return false;
        });
      } else {
        selectedMenuItems = selectedMenuItems.filter(
          (i) => (i.label || i).toLowerCase() !== itemName.toLowerCase()
        );
      }
      renderSelectedItems();
      if (onSelectionChange) onSelectionChange(selectedMenuItems);
    }

    // Render selected items
    function renderSelectedItems() {
      selectedItemsContainer.innerHTML = '';
      for (const item of selectedMenuItems) {
        const tag = document.createElement('div');
        tag.className = 'selected-item';
        const label = item.label || item;
        tag.innerHTML = `
          <span>${label}</span>
          <button class="remove-item" data-item="${label}">×</button>
        `;
        selectedItemsContainer.appendChild(tag);
      }

      // Add event listeners for remove buttons
      const removeButtons = selectedItemsContainer.querySelectorAll('.remove-item');
      for (const btn of removeButtons) {
        btn.addEventListener('click', (e) => {
          removeMenuItem(e.target.dataset.item);
        });
      }
    }

    // Menu search event listeners
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value;
      const filteredItems = filterMenuItems(searchTerm);
      renderMenuDropdown(filteredItems);
    });

    searchInput.addEventListener('focus', () => {
      const value = (searchInput.value || '').trim();
      if (value) {
        const filteredItems = filterMenuItems(value);
        renderMenuDropdown(filteredItems);
      } else {
        // Show a short list of suggestions when focusing with empty input
        renderMenuDropdown(menuItems.slice(0, 20));
      }
    });

    // Hide dropdown when clicking outside
    document.addEventListener(
      'click',
      (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      },
      { once: false }
    );

    // Keyboard handling: Enter selects first suggestion, Escape closes
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const firstOption = dropdown.querySelector('.menu-option');
        if (firstOption) {
          e.preventDefault();
          firstOption.click();
        }
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      }
    });

    // Initial render
    renderSelectedItems();

    // Return control object
    return {
      getSelectedItems: () => selectedMenuItems,
      setSelectedItems: (items) => {
        selectedMenuItems = [...items];
        renderSelectedItems();
        if (onSelectionChange) onSelectionChange(selectedMenuItems);
      },
      clearSelection: () => {
        selectedMenuItems = [];
        renderSelectedItems();
        if (onSelectionChange) onSelectionChange(selectedMenuItems);
      },
    };
  }

  return {
    initMenuAutocomplete,
  };
})();
