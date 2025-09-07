// Restaurant API routes
// Following modern API patterns with proper error handling and validation

import { createApiResponse, createErrorResponse } from '../utils/response.js';

// Track restaurant appearances with proper KV structure
async function trackRestaurantAppearances(env, restaurants, date) {
  try {
    const updatedRestaurants = [];
    
    // Process each restaurant
    for (const restaurantInfo of restaurants) {
      const restaurantId = restaurantInfo.id || restaurantInfo.name || restaurantInfo.restaurant;
      const restaurantName = restaurantInfo.name || restaurantInfo.restaurant || restaurantId;
      
      if (!restaurantId) continue;
      
      // Get existing restaurant data from KV
      const restaurantKey = `restaurant:${restaurantId}`;
      const existingData = await env.LANCHDRAP_RATINGS.get(restaurantKey);
      
      let restaurantData;
      if (existingData) {
        restaurantData = JSON.parse(existingData);
      } else {
        // Create new restaurant record
        restaurantData = {
          id: restaurantId,
          name: restaurantName !== restaurantId ? restaurantName : null, // Don't store ID as name
          appearances: [],
          soldOutDates: [],
          color: restaurantInfo.color || null, // Store the color
          firstSeen: date,
          lastSeen: date,
          createdAt: new Date().toISOString()
        };
      }
      
      // Add date to appearances if not already present
      if (!restaurantData.appearances.includes(date)) {
        restaurantData.appearances.push(date);
        restaurantData.appearances.sort(); // Keep dates sorted
        restaurantData.lastSeen = date;
        restaurantData.updatedAt = new Date().toISOString();
        
        // Update first seen if this is earlier
        if (date < restaurantData.firstSeen) {
          restaurantData.firstSeen = date;
        }
      }
      
      // Initialize soldOutDates array if it doesn't exist (for existing records)
      if (!restaurantData.soldOutDates) {
        restaurantData.soldOutDates = [];
      }
      
      // Initialize color if it doesn't exist (for existing records)
      if (!restaurantData.color && restaurantInfo.color) {
        restaurantData.color = restaurantInfo.color;
      }
      
      // Track sold out status if restaurant is sold out
      if (restaurantInfo.status === 'soldout' && !restaurantData.soldOutDates.includes(date)) {
        restaurantData.soldOutDates.push(date);
        restaurantData.soldOutDates.sort(); // Keep dates sorted
        restaurantData.updatedAt = new Date().toISOString();
      }
        
        // Update restaurant name if we have a better one and it's different
        if (restaurantName && restaurantName !== restaurantId && restaurantName.length > 3 && restaurantData.name !== restaurantName) {
          restaurantData.name = restaurantName;
        } else if (restaurantName === restaurantId && restaurantData.name === restaurantId) {
          // If both the incoming name and stored name are the ID, set stored name to null
          restaurantData.name = null;
        }
        
        // Update color if provided and different
        if (restaurantInfo.color && restaurantData.color !== restaurantInfo.color) {
          restaurantData.color = restaurantInfo.color;
          restaurantData.updatedAt = new Date().toISOString();
        }
        
        // Save to KV
        await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(restaurantData));
        
        // Calculate sell out rate for response
        const totalAppearances = restaurantData.appearances.length;
        const totalSoldOuts = restaurantData.soldOutDates.length;
        const sellOutRate = totalAppearances > 0 ? (totalSoldOuts / totalAppearances) : 0;
        
        // Debug logging
        console.log(`Restaurant ${restaurantData.id}: ${totalSoldOuts}/${totalAppearances} = ${sellOutRate}`);
        
        updatedRestaurants.push({
          ...restaurantData,
          sellOutRate: parseFloat(sellOutRate.toFixed(3)) // Ensure it's a float with 3 decimal places
        });
    }
    
    return {
      success: true,
      updatedCount: restaurants.length,
      totalRestaurants: updatedRestaurants.length,
      updatedRestaurants: updatedRestaurants
    };
  } catch (error) {
    console.error('Error tracking restaurant appearances:', error);
    throw error;
  }
}

// Track restaurant appearances
export async function trackAppearances(request, env) {
  try {
    const trackingData = await request.json();
    const { restaurants, date } = trackingData;
    
    
    if (!restaurants || !Array.isArray(restaurants) || !date) {
      return createErrorResponse('Invalid tracking data: restaurants array and date are required', 400);
    }

    if (restaurants.length === 0) {
      return createErrorResponse('Restaurants array cannot be empty', 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return createErrorResponse('Date must be in YYYY-MM-DD format', 400);
    }

    const result = await trackRestaurantAppearances(env, restaurants, date);
    
    return createApiResponse({
      success: true,
      message: `Tracked ${restaurants.length} restaurant appearances for ${date}`,
      data: {
        date,
        totalRestaurants: restaurants.length,
        updatedRestaurants: result.totalRestaurants,
        restaurants: result.updatedRestaurants.map(r => ({
          id: r.id,
          name: r.name,
          sellOutRate: r.sellOutRate
        }))
      }
    }, 200);
  } catch (error) {
    console.error('Error tracking restaurant appearances:', error);
    return createErrorResponse('Failed to track restaurant appearances', 500, { error: error.message });
  }
}

// Get restaurant appearances
export async function getAppearances(request, env) {
  try {
    const url = new URL(request.url);
    const restaurant = url.searchParams.get('restaurant');
    const timeRange = url.searchParams.get('timeRange') || 'all';
    
    if (!restaurant) {
      return createErrorResponse('Restaurant parameter is required', 400);
    }

    // Get restaurant data from KV
    const restaurantKey = `restaurant:${restaurant}`;
    const restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);
    
    if (!restaurantData) {
      // Return empty stats for unknown restaurant
      return new Response(JSON.stringify({
        restaurant: restaurant,
        restaurantId: restaurant,
        timeRange,
        totalDays: 0,
        totalAppearances: 0,
        appearancesInRange: 0,
        appearanceRate: 0,
        lastAppearance: null,
        firstSeen: null,
        lastUpdated: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const data = JSON.parse(restaurantData);
    const appearances = data.appearances || [];
    const soldOutDates = data.soldOutDates || [];
    
    // Calculate stats
    const totalAppearances = appearances.length;
    const totalSoldOuts = soldOutDates.length;
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);
    
    // Calculate appearance rate (appearances per week)
    const appearanceRate = totalAppearances > 0 ? (totalAppearances / 7).toFixed(2) : 0;
    
    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    const soldOutRate = totalAppearances > 0 ? (totalSoldOuts / totalAppearances).toFixed(3) : 0;
    
    return new Response(JSON.stringify({
      appearanceRate: parseFloat(appearanceRate),
      appearances: appearances,
      appearancesInRange: totalAppearances,
      firstSeen,
      lastAppearance,
      lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
      restaurant: data.name || restaurant,
      restaurantId: data.id || restaurant,
      soldOutRate,
      timeRange,
      totalAppearances,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error getting restaurant appearances:', error);
    return createErrorResponse('Failed to get restaurant appearances', 500, { error: error.message });
  }
}

// Update restaurant name
export async function updateName(request, env) {
  try {
    const { restaurantId, restaurantName } = await request.json();
    
    if (!restaurantId || !restaurantName) {
      return createErrorResponse('Restaurant ID and name are required', 400);
    }

    if (restaurantName.length < 2) {
      return createErrorResponse('Restaurant name must be at least 2 characters long', 400);
    }

    // Get existing restaurant data from KV
    const restaurantKey = `restaurant:${restaurantId}`;
    const existingData = await env.LANCHDRAP_RATINGS.get(restaurantKey);
    
    let restaurantData;
    if (existingData) {
      restaurantData = JSON.parse(existingData);
    } else {
      // Create new restaurant record if it doesn't exist
      restaurantData = {
        id: restaurantId,
        name: restaurantName,
        appearances: [],
        firstSeen: null,
        lastSeen: null,
        createdAt: new Date().toISOString()
      };
    }
    
    // Check if the name is actually different
    const oldName = restaurantData.name;
    if (oldName === restaurantName) {
      // Name is the same, no need to update
      return createApiResponse({
        success: true,
        message: `Restaurant name is already "${restaurantName}" - no update needed`,
        data: {
          restaurantId,
          name: restaurantName,
          unchanged: true,
          timestamp: new Date().toISOString()
        }
      }, 200);
    }
    
    // Update the restaurant name
    restaurantData.name = restaurantName;
    restaurantData.updatedAt = new Date().toISOString();
    
    // COMMENTED OUT: Save to KV - not implementing this yet
    // await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(restaurantData));
    
    return createApiResponse({
      success: true,
      message: `Updated restaurant name from "${oldName}" to "${restaurantName}"`,
      data: {
        restaurantId,
        oldName,
        newName: restaurantName,
        updatedAt: restaurantData.updatedAt
      }
    }, 200);
  } catch (error) {
    console.error('Error updating restaurant name:', error);
    return createErrorResponse('Failed to update restaurant name', 500, { error: error.message });
  }
}

// Get all restaurants
export async function getAllRestaurants(request, env) {
  try {
    // List all restaurant keys from KV
    const list = await env.LANCHDRAP_RATINGS.list({ prefix: 'restaurant:' });
    const restaurants = [];
    
    for (const key of list.keys) {
      const restaurantData = await env.LANCHDRAP_RATINGS.get(key.name);
      if (restaurantData) {
        const data = JSON.parse(restaurantData);
        restaurants.push({
          id: data.id,
          name: data.name,
          appearances: data.appearances || [],
          totalAppearances: (data.appearances || []).length,
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      }
    }
    
    // Sort by total appearances (descending)
    restaurants.sort((a, b) => b.totalAppearances - a.totalAppearances);
    
    return createApiResponse({
      restaurants,
      total: restaurants.length,
      lastUpdated: new Date().toISOString()
    }, 200);
  } catch (error) {
    console.error('Error getting restaurants:', error);
    return createErrorResponse('Failed to get restaurants', 500, { error: error.message });
  }
}

// Get restaurant by ID
export async function getRestaurantById(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const restaurantId = pathParts[pathParts.length - 1]; // Get ID from URL path
    
    if (!restaurantId) {
      return createErrorResponse('Restaurant ID is required', 400);
    }

    // Check if a name is provided in query params for potential update
    const providedName = url.searchParams.get('name');

    // Get restaurant data from KV
    const restaurantKey = `restaurant:${restaurantId}`;
    const restaurantData = await env.LANCHDRAP_RATINGS.get(restaurantKey);
    
    if (!restaurantData) {
      return createErrorResponse('Restaurant not found', 404);
    }

    const data = JSON.parse(restaurantData);
    const appearances = data.appearances || [];
    const soldOutDates = data.soldOutDates || [];
    
    // Update name if provided and different from stored name
    let nameUpdated = false;
    if (providedName && providedName !== restaurantId && providedName !== data.name) {
      // Only update if the provided name is better (not just the ID) and different
      data.name = providedName;
      data.updatedAt = new Date().toISOString();
      
      // Save updated data to KV
      await env.LANCHDRAP_RATINGS.put(restaurantKey, JSON.stringify(data));
      nameUpdated = true;
    }
    
    // Calculate stats
    const totalAppearances = appearances.length;
    const totalSoldOuts = soldOutDates.length;
    const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : null;
    const firstSeen = data.firstSeen || (appearances.length > 0 ? appearances[0] : null);
    
    // Calculate appearance rate (appearances per week)
    const appearanceRate = totalAppearances > 0 ? (totalAppearances / 7).toFixed(2) : 0;
    
    // Calculate sold out rate (decimal 0-1, extension will convert to percentage)
    const soldOutRate = totalAppearances > 0 ? (totalSoldOuts / totalAppearances).toFixed(3) : 0;
    
    return new Response(JSON.stringify({
      name: data.name || restaurantId, // Use ID as fallback if no name
      id: data.id || restaurantId,
      color: data.color || null, // Include the color
      timeRange: 'all',
      totalDays: 7, // Assuming we track for 7 days
      totalAppearances,
      appearancesInRange: totalAppearances, // For now, all appearances are in range
      appearanceRate: parseFloat(appearanceRate),
      totalSoldOuts,
      soldOutRate: parseFloat(soldOutRate),
      lastAppearance,
      firstSeen,
      lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString(),
      appearances: appearances, // Include the actual appearance dates
      // Add timezone info to help with date display
      timezone: 'America/Chicago', // LunchDrop appears to be in Central Time
      nameUpdated: nameUpdated // Indicate if name was updated during this request
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error getting restaurant by ID:', error);
    return createErrorResponse('Failed to get restaurant', 500, { error: error.message });
  }
}

// Submit availability summary
export async function submitAvailabilitySummary(request, _env) {
  try {
    const _summaryData = await request.json();
    
    // COMMENTED OUT: No longer storing availability summary data
    // const summaryKey = `availability_summary:${Date.now()}`;
    // await env.LANCHDRAP_RATINGS.put(summaryKey, JSON.stringify(summaryData));
    
    // Just acknowledge receipt, don't store the data
    return createApiResponse({
      received: true,
      timestamp: new Date().toISOString()
    }, 200);
  } catch (error) {
    console.error('Error submitting availability summary:', error);
    return createErrorResponse('Failed to submit availability summary', 500, { error: error.message });
  }
}
