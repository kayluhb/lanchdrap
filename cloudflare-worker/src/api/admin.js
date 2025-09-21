// Admin API endpoints for LanchDrap Worker

// Clear all data from KV store
export async function clearAllData(_request, env) {
  try {
    // Clear all data from KV store
    const keys = await env.LANCHDRAP_RATINGS.list();

    let deletedCount = 0;
    if (keys.keys.length > 0) {
      // Delete all keys in batches
      const batchSize = 10;
      for (let i = 0; i < keys.keys.length; i += batchSize) {
        const batch = keys.keys.slice(i, i + batchSize);
        const deletePromises = batch.map((key) => env.LANCHDRAP_RATINGS.delete(key.name));
        await Promise.all(deletePromises);
        deletedCount += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'All data cleared successfully',
        deletedKeys: deletedCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    // Error clearing data
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: 'Failed to clear data',
          details: error.message,
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

// Delete all restaurant name lookup records
export async function clearRestaurantNameRecords(_request, env) {
  try {
    // List all restaurant name keys
    const nameKeys = await env.LANCHDRAP_RATINGS.list({ prefix: 'restaurant_name:' });

    let deletedCount = 0;
    if (nameKeys.keys.length > 0) {
      // Delete all restaurant name keys in batches
      const batchSize = 10;
      for (let i = 0; i < nameKeys.keys.length; i += batchSize) {
        const batch = nameKeys.keys.slice(i, i + batchSize);
        const deletePromises = batch.map((key) => env.LANCHDRAP_RATINGS.delete(key.name));
        await Promise.all(deletePromises);
        deletedCount += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Restaurant name records cleared successfully',
        deletedKeys: deletedCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    // Error clearing restaurant name records
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: 'Failed to clear restaurant name records',
          details: error.message,
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
