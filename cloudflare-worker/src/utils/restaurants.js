// Restaurant utility functions
// Shared logic for restaurant data management

// Update restaurant appearance counts
export async function updateRestaurantAppearanceCounts(env, restaurants, _date) {
  try {
    const restaurantListKey = 'restaurants:list';
    let restaurantList = [];

    const existingList = await env.LANCHDRAP_RATINGS.get(restaurantListKey);
    if (existingList) {
      restaurantList = JSON.parse(existingList);
    }

    restaurants.forEach(restaurantInfo => {
      const restaurantId = restaurantInfo.id || restaurantInfo.name || restaurantInfo.restaurant;
      const restaurantName = restaurantInfo.name || restaurantInfo.restaurant || restaurantId;
      const existingIndex = restaurantList.findIndex(r => r.id === restaurantId || r.name === restaurantName);

      if (existingIndex === -1) {
        // Add new restaurant
        const newRestaurant = {
          id: restaurantId,
          name: restaurantName,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          lastAppearance: new Date().toISOString(),
          appearanceCount: 1,
          totalRatings: 0,
          averageRating: 0,
          selloutCount: 0,
          lastSellout: null,
          availabilityStatus: restaurantInfo.status || 'available',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        restaurantList.push(newRestaurant);
      } else {
        // Update existing restaurant
        const restaurant = restaurantList[existingIndex];
        restaurant.appearanceCount = (restaurant.appearanceCount || 0) + 1;
        restaurant.lastSeen = new Date().toISOString();
        restaurant.lastAppearance = new Date().toISOString();
        restaurant.updatedAt = new Date().toISOString();
        restaurant.availabilityStatus = restaurantInfo.status || restaurant.availabilityStatus || 'available';
        
        // Preserve existing name if it's more descriptive than the ID
        if (restaurant.name && restaurant.name !== restaurantId && restaurantName === restaurantId) {
          // Keep the existing name
        } else if (restaurantName && restaurantName !== restaurantId && restaurantName.length > 3) {
          // Update with better name
          restaurant.name = restaurantName;
        }
      }
    });

    // Save the updated list
    await env.LANCHDRAP_RATINGS.put(restaurantListKey, JSON.stringify(restaurantList));
    
    return {
      success: true,
      updatedCount: restaurants.length,
      totalRestaurants: restaurantList.length
    };
  } catch (error) {
    console.error('Error updating restaurant appearance counts:', error);
    throw error;
  }
}

// Find restaurant by ID or name
export function findRestaurant(restaurantList, identifier) {
  return restaurantList.find(r => r.id === identifier || r.name === identifier);
}

// Validate restaurant data
export function validateRestaurantData(restaurantData) {
  const errors = [];
  
  if (!restaurantData.id && !restaurantData.name) {
    errors.push('Restaurant must have either an ID or name');
  }
  
  if (restaurantData.rating && (restaurantData.rating < 1 || restaurantData.rating > 5)) {
    errors.push('Rating must be between 1 and 5');
  }
  
  if (restaurantData.status && !['available', 'soldout', 'limited'].includes(restaurantData.status)) {
    errors.push('Status must be one of: available, soldout, limited');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Calculate restaurant statistics
export function calculateRestaurantStats(restaurant, ratings = []) {
  const restaurantRatings = ratings.filter(r => r.restaurant === restaurant.name || r.restaurant === restaurant.id);
  
  return {
    totalRatings: restaurantRatings.length,
    averageRating: restaurantRatings.length > 0 
      ? restaurantRatings.reduce((sum, r) => sum + r.rating, 0) / restaurantRatings.length 
      : 0,
    ratingDistribution: [1, 2, 3, 4, 5].map(star => ({
      stars: star,
      count: restaurantRatings.filter(r => r.rating === star).length
    })),
    lastRating: restaurantRatings.length > 0 
      ? restaurantRatings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
      : null
  };
}
