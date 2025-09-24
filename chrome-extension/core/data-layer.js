// Data Layer for LanchDrap Extension
// Central data management system that handles all data loading and caching

// Create global namespace for data layer
window.LanchDrapDataLayer = (() => {
  // Internal state
  const dataLayerState = {
    currentDate: null,
    isDayPage: false,
    isInitialized: false,
    data: {
      currentRestaurant: null,
      deliveries: [],
      delivery: null,
      restaurants: [],
    },
    loadingStates: {
      currentRestaurant: false,
      delivery: false,
      restaurants: false,
    },
    errorStates: {
      currentRestaurant: null,
      delivery: null,
      restaurants: null,
    },
    lastUpdated: {
      currentRestaurant: null,
      delivery: null,
      restaurants: null,
    },
  };

  // Event system for data layer changes
  const eventListeners = {
    dataChanged: [],
    dataLoading: [],
    dataError: [],
    dataCleared: [],
  };

  // Event emitter functions
  function emitEvent(eventType, eventData = {}) {
    if (eventListeners[eventType]) {
      for (const callback of eventListeners[eventType]) {
        try {
          callback(eventData);
        } catch {
          void 0;
        }
      }
    }
  }

  function on(eventType, callback) {
    if (eventListeners[eventType]) {
      eventListeners[eventType].push(callback);
    }
  }

  function off(eventType, callback) {
    if (eventListeners[eventType]) {
      const index = eventListeners[eventType].indexOf(callback);
      if (index > -1) {
        eventListeners[eventType].splice(index, 1);
      }
    }
  }

  function extractMenuFromDelivery(delivery) {
    try {
      if (!delivery.menu || !delivery.menu.sections || !delivery.menu.items) {
        console.log('LanchDrap: No menu data available in delivery');
        return [];
      }

      const sections = delivery.menu.sections;
      const items = delivery.menu.items;

      // Create a map of item IDs to items for quick lookup
      const itemMap = new Map();
      for (const item of items) {
        itemMap.set(item.id, item);
      }

      // Build menu items with section labels
      const menuItems = [];

      for (const section of sections) {
        if (section.items && Array.isArray(section.items)) {
          for (const itemId of section.items) {
            const item = itemMap.get(itemId);
            if (item) {
              menuItems.push({
                id: item.id,
                label: item.label,
                description: item.description || '',
                price: item.price || 0,
                basePrice: item.basePrice || 0,
                maxPrice: item.maxPrice || 0,
                section: section.label || 'Unknown',
                sectionSortOrder: section.sort_order || 0,
                isEntree: item.isEntree || false,
                isFavorite: item.isFavorite || false,
                isSpicy1: item.isSpicy1 || false,
                isSpicy2: item.isSpicy2 || false,
                isSpicy3: item.isSpicy3 || false,
                isGlutenFree: item.isGlutenFree || false,
                isVegetarian: item.isVegetarian || false,
                isNutAllergy: item.isNutAllergy || false,
                picture: item.picture || '',
                rating: item.rating || 0,
                reviews: item.reviews || 0,
              });
            }
          }
        }
      }

      return menuItems;
    } catch (error) {
      console.log('LanchDrap: Error extracting menu data from delivery:', error);
      return [];
    }
  }

  function combineDeliveryAndRestaurant(delivery) {
    // Determine if restaurant is sold out based on slots AND time
    const isSoldOut = delivery.numSlotsAvailable === 0 && isBeforeNoonOnDeliveryDay();

    return {
      ...delivery.restaurant,
      numSlotsAvailable: delivery.numSlotsAvailable,
      menu: extractMenuFromDelivery(delivery),
      status: isSoldOut ? 'soldout' : 'available',
    };
  }

  // Helper function to check if current time is before 12PM on the delivery day
  function isBeforeNoonOnDeliveryDay() {
    const currentDate = dataLayerState.currentDate;
    if (!currentDate) {
      return false; // If no date available, don't consider it sold out
    }

    const now = new Date();
    const deliveryDate = new Date(currentDate);

    // Set delivery date to 12:00 PM
    deliveryDate.setHours(12, 0, 0, 0);

    // Check if current time is before 12PM on the delivery day
    return now < deliveryDate;
  }

  function parseData({ data, deliveryId, isDayPage }) {
    const { delivery, lunchDay } = data;
    const { deliveries } = lunchDay;
    let actualDelivery = null;

    console.log('LanchDrap Data Layer: Populating from data:', data);

    if (isDayPage) {
      actualDelivery = delivery
        ? deliveries.find((deli) => deli.id === delivery?.id)
        : deliveries[0];
    } else {
      actualDelivery = deliveries.find((deli) => deli.id === deliveryId);
    }

    return {
      currentRestaurant: combineDeliveryAndRestaurant(actualDelivery),
      delivery,
      deliveries,
      restaurants: deliveries.map((deli) => combineDeliveryAndRestaurant(deli)),
    };
  }

  // Data layer initialization
  async function initialize() {
    if (dataLayerState.isInitialized) {
      return true;
    }

    try {
      // Extract current date from URL
      const { date, isDayPage, deliveryId } = extractDataFromUrl();
      console.log('LanchDrap: Extracted URL data:', { date, isDayPage, deliveryId });
      dataLayerState.currentDate = date;
      dataLayerState.isDayPage = isDayPage;

      // Load data from page on initial load
      const pageData = await extractFromPageData({ isDayPage, deliveryId });
      if (pageData) {
        dataLayerState.data = pageData;
      } else {
        console.log('LanchDrap: No page data available');
      }

      dataLayerState.isInitialized = true;
      console.log('LanchDrap: Data layer initialization complete', dataLayerState);

      // Emit initialization event
      emitEvent('dataChanged', {
        type: 'initialization',
        data: dataLayerState.data,
        date: dataLayerState.currentDate,
      });

      return true;
    } catch (error) {
      console.error('LanchDrap: Data layer initialization failed:', error);
      dataLayerState.isInitialized = true; // Mark as initialized even if failed to prevent infinite waiting
      return false;
    }
  }

  // Extract date from URL (helper function)
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

  // Populate data layer from page JSON data
  async function extractFromPageData({ deliveryId, isDayPage }) {
    try {
      const appElement = document.getElementById('app');
      if (!appElement || !appElement.dataset.page) {
        console.warn('LanchDrap: No app element or page data found');
        return null;
      }
      const pageData = JSON.parse(appElement.dataset.page);
      return parseData({ data: pageData.props, deliveryId, isDayPage });
    } catch (error) {
      console.error('LanchDrap: Error extracting page data:', error);
      return null;
    }
  }

  // Helper: read Inertia version and base headers from current page
  function getInertiaHeaders() {
    try {
      let version = null;
      if (typeof window !== 'undefined' && window.app?.dataset?.page) {
        try {
          const pageData = JSON.parse(window.app.dataset.page);
          version = pageData?.version || null;
        } catch (_e) {}
      }

      const headers = {
        Accept: 'application/json, text/html',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
      };
      if (version) headers['X-Inertia-Version'] = version;
      return headers;
    } catch (_error) {
      return {
        Accept: 'application/json, text/html',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
      };
    }
  }

  async function fetchData({ date }) {
    try {
      if (!date) return null;

      const origin = window.location.origin;
      const headers = getInertiaHeaders();

      let response = await fetch(`${origin}/app/${date}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      // Handle Inertia 409 responses (version mismatch) with location redirect
      if (response.status === 409) {
        const location = response.headers.get('X-Inertia-Location');
        if (location) {
          response = await fetch(location, {
            method: 'GET',
            headers,
            credentials: 'include',
          });
        }
      }

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  // Handle page changes - reload data when navigating between pages
  async function handlePageChange() {
    try {
      console.log(
        'LanchDrap Data Layer: handlePageChange called, current URL:',
        window.location.href
      );

      // Extract current date from URL
      const { date, isDayPage, deliveryId } = extractDataFromUrl();

      console.info('datalayerState', dataLayerState.currentDate, date);
      if (isDayPage || dataLayerState.currentDate !== date) {
        const apiData = await fetchData({ date });
        console.info('apiData', apiData);
        const pageData = parseData({ data: apiData.props, isDayPage, deliveryId });
        dataLayerState.data = pageData;
      } else {
        const delivery = dataLayerState.data.deliveries.find((deli) => deli.id === deliveryId);
        dataLayerState.data.currentRestaurant = combineDeliveryAndRestaurant(delivery);
      }
      // Load data from page on initial load
      dataLayerState.currentDate = date;
      // Emit data changed event
      emitEvent('dataChanged', {
        type: 'pageChange',
        data: dataLayerState.data,
        date: dataLayerState.currentDate,
      });
      console.log('LanchDrap Data Layer: Data layer updated:', dataLayerState);
    } catch (error) {
      console.error('LanchDrap Data Layer: Error in handlePageChange:', error);
    }
  }

  // Get current data
  function getData() {
    return dataLayerState.data;
  }

  // Get current date
  function getCurrentDate() {
    return dataLayerState.currentDate;
  }

  // Get isDayPage flag
  function getIsDayPage() {
    return dataLayerState.isDayPage;
  }

  // Return public API
  return {
    emitEvent,
    getCurrentDate,
    getData,
    getIsDayPage,
    handlePageChange,
    initialize,
    off,
    on,
  };
})();
