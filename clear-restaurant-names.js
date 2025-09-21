#!/usr/bin/env node

// Script to clear restaurant name lookup records from KV store
// Usage: node clear-restaurant-names.js

const API_BASE_URL = 'https://lunchdrop-ratings.caleb-brown.workers.dev';

async function clearRestaurantNameRecords() {
  try {
    console.log('🗑️  Clearing restaurant name lookup records...');

    const response = await fetch(`${API_BASE_URL}/api/admin/clear-restaurant-names`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Success!');
      console.log(`📊 Deleted ${result.deletedKeys} restaurant name records`);
      console.log(`⏰ Completed at: ${result.timestamp}`);
    } else {
      console.error('❌ Failed to clear restaurant name records');
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Run the cleanup
clearRestaurantNameRecords();
