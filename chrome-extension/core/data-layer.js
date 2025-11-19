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

  // Use transformer utilities if available, fallback to local implementations
  function extractMenuFromDelivery(delivery) {
    if (window.LanchDrapDataTransformer?.extractMenuFromDelivery) {
      return window.LanchDrapDataTransformer.extractMenuFromDelivery(delivery);
    }
    // Fallback implementation (simplified)
    try {
      if (!delivery.menu || !delivery.menu.sections || !delivery.menu.items) {
        return [];
      }
      const sections = delivery.menu.sections;
      const items = delivery.menu.items;
      const itemMap = new Map();
      for (const item of items) {
        itemMap.set(item.id, item);
      }
      return sections.flatMap((section) => {
        if (!section.items || !Array.isArray(section.items)) return [];
        return section.items
          .map((itemId) => itemMap.get(itemId))
          .filter(Boolean)
          .map((item) => ({
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
          }));
      });
    } catch {
      return [];
    }
  }

  function combineDeliveryAndRestaurant(delivery) {
    if (window.LanchDrapDataTransformer?.combineDeliveryAndRestaurant) {
      return window.LanchDrapDataTransformer.combineDeliveryAndRestaurant(
        delivery,
        isBeforeNoonOnDeliveryDay
      );
    }
    // Fallback implementation
    const isSoldOut = delivery.numSlotsAvailable === 0 && isBeforeNoonOnDeliveryDay();
    return {
      ...delivery.restaurant,
      color: delivery.restaurant?.brandColor || delivery.restaurant?.color || null,
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

  // Normalize order items to ensure consistent field names and remove modifications
  function normalizeOrderItems(items) {
    if (window.LanchDrapDataTransformer?.normalizeOrderItems) {
      return window.LanchDrapDataTransformer.normalizeOrderItems(items);
    }
    // Fallback implementation
    if (!Array.isArray(items)) {
      return [];
    }
    return items.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity || 1,
      name: item.label || 'Unknown Item',
      description: item.description || '',
      fullDescription: item.label || 'Unknown Item',
      options: '',
      price: item.price || 0,
      specialRequest: item.specialRequest,
    }));
  }

  // Normalize delivery order data
  function normalizeDeliveryOrder(delivery) {
    if (window.LanchDrapDataTransformer?.normalizeDeliveryOrder) {
      return window.LanchDrapDataTransformer.normalizeDeliveryOrder(delivery);
    }
    // Fallback implementation
    if (!delivery?.order) {
      return delivery;
    }
    const { order, id } = delivery;
    const { id: orderId, items = [] } = order;
    return {
      ...delivery,
      order: {
        id: orderId || id,
        items: normalizeOrderItems(items),
      },
    };
  }

  function parseData({ data, deliveryId, isDayPage }) {
    if (!data?.lunchDay?.deliveries) {
      return {
        currentRestaurant: null,
        delivery: null,
        deliveries: [],
        restaurants: [],
      };
    }

    const { delivery, lunchDay } = data;
    const { deliveries } = lunchDay;

    let actualDelivery = null;
    if (isDayPage) {
      actualDelivery = delivery
        ? deliveries.find((deli) => deli.id === delivery.id)
        : deliveries[0];
    } else {
      actualDelivery = deliveries.find((deli) => deli.id === deliveryId);
    }

    // Normalize delivery order data
    const normalizedDelivery = normalizeDeliveryOrder(delivery);
    const normalizedDeliveries = deliveries.map(normalizeDeliveryOrder);

    return {
      currentRestaurant: combineDeliveryAndRestaurant(actualDelivery),
      delivery: normalizedDelivery,
      deliveries: normalizedDeliveries,
      restaurants: normalizedDeliveries.map((deli) => combineDeliveryAndRestaurant(deli)),
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
      dataLayerState.currentDate = date;
      dataLayerState.isDayPage = isDayPage;

      // Load data from page on initial load
      const pageData = await extractFromPageData({ isDayPage, deliveryId });
      if (pageData) {
        dataLayerState.data = pageData;
      }

      dataLayerState.isInitialized = true;

      // Emit initialization event
      emitEvent('dataChanged', {
        type: 'initialization',
        data: dataLayerState.data,
        date: dataLayerState.currentDate,
      });

      return true;
    } catch {
      dataLayerState.isInitialized = true; // Mark as initialized even if failed to prevent infinite waiting
      return false;
    }
  }

  // Extract date from URL (helper function) - uses utility if available
  function extractDataFromUrl() {
    if (window.LanchDrapUrlParser?.extractDataFromUrl) {
      return window.LanchDrapUrlParser.extractDataFromUrl();
    }
    // Fallback implementation
    try {
      const path = window.location.pathname || '';
      const pathSegments = path.split('/').filter(Boolean);
      if (pathSegments.length === 0 || pathSegments[0] !== 'app') {
        return { date: null, deliveryId: null, isDayPage: false };
      }
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      const isDeliveryPage = pathSegments.length === 3;
      const isDayPage = pathSegments.length === 2 || pathSegments.length === 1;
      const deliveryId = isDeliveryPage ? pathSegments[2] : null;
      if (isDeliveryPage && datePattern.test(pathSegments[1])) {
        return { date: pathSegments[1], deliveryId, isDayPage };
      }
      if (pathSegments.length === 2 && datePattern.test(pathSegments[1])) {
        return { date: pathSegments[1], deliveryId, isDayPage };
      }
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
        return null;
      }
      const pageData = JSON.parse(appElement.dataset.page);
      return parseData({ data: pageData.props, deliveryId, isDayPage });
    } catch {
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
      // Extract current date from URL
      const { date, isDayPage, deliveryId } = extractDataFromUrl();

      if (isDayPage || dataLayerState.currentDate !== date) {
        // Clear old data when date changes to prevent stale data
        if (dataLayerState.currentDate !== date) {
          dataLayerState.data = {
            currentRestaurant: null,
            deliveries: [],
            delivery: null,
            restaurants: [],
          };
        }

        const apiData = await fetchData({ date });

        // Only update if we got valid data
        if (apiData?.props) {
          const pageData = parseData({ data: apiData.props, isDayPage, deliveryId });
          // Update date first to ensure consistency
          dataLayerState.currentDate = date;
          dataLayerState.isDayPage = isDayPage;
          // Then update data - this ensures data is fully set before emitting event
          dataLayerState.data = pageData;
        } else {
          // Still update date even if API call failed
          dataLayerState.currentDate = date;
          dataLayerState.isDayPage = isDayPage;
        }
      } else {
        const delivery = dataLayerState.data.deliveries.find((deli) => deli.id === deliveryId);
        dataLayerState.data.currentRestaurant = combineDeliveryAndRestaurant(delivery);
        // Update date even when not fetching new data
        dataLayerState.currentDate = date;
        dataLayerState.isDayPage = isDayPage;
      }
      // Emit data changed event after data is fully updated
      emitEvent('dataChanged', {
        type: 'pageChange',
        data: dataLayerState.data,
        date: dataLayerState.currentDate,
      });
    } catch {
      // Error in handlePageChange
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
