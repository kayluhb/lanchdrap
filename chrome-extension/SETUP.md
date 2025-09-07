# Chrome Extension Setup Guide

## 🔧 **Configuration Required**

Before using the extension, you need to update the API endpoint in `config.js`:

1. **Open `config.js`**
2. **Update the API_BASE_URL** with your actual Cloudflare Worker URL:

```javascript
const CONFIG = {
  // Update this with your actual Cloudflare Worker URL
  API_BASE_URL: 'https://lunchdrop-ratings.caleb-brown.workers.dev',
  // ... rest of config
};
```

## 📋 **What to Update**

The URL is now set to `https://lunchdrop-ratings.caleb-brown.workers.dev`.

## 🚀 **Deployment Steps**

1. **Create Cloudflare KV namespace:**
   ```bash
   cd cloudflare-worker
   wrangler kv namespace create LANCHDRAP_RATINGS
   ```

2. **Deploy your Cloudflare Worker** (see main README.md)
3. **The config.js file is already configured** with the correct URL
4. **Load the extension** in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chrome-extension` folder

## ✅ **Features Now Available**

- **User Identification**: Unique user IDs for tracking
- **Rating Submission**: Submit ratings with user tracking
- **Server Sync**: Rating history syncs with Cloudflare Worker
- **Restaurant Statistics**: View restaurant rating stats
- **Availability Tracking**: Monitor restaurant sellout status
- **Error Handling**: Robust error handling with retries

## 🔍 **API Endpoints Used**

The extension now uses these Cloudflare Worker APIs:
- `POST /api/ratings` - Submit ratings
- `GET /api/ratings` - Get rating history
- `GET /api/ratings/stats` - Get restaurant statistics
- `POST /api/restaurants/sellout` - Report sellout status
- `POST /api/restaurants/availability-summary` - Submit availability data

## 🐛 **Troubleshooting**

If you see errors:
1. Check that the API_BASE_URL is correct
2. Verify your Cloudflare Worker is deployed and running
3. Check browser console for detailed error messages
4. Ensure CORS is properly configured on your worker
