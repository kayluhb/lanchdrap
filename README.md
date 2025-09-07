# LunchDrop Rating System

A Chrome extension and Cloudflare Worker that allows users to rate their lunch drop orders.

## Project Structure

```
lanchdrap/
├── chrome-extension/          # Chrome extension files
│   ├── manifest.json         # Extension manifest
│   ├── popup.html           # Extension popup interface
│   ├── popup.js             # Popup logic
│   ├── content.js            # Content script for lunchdrop.com
│   ├── background.js         # Background script
│   └── styles.css            # Extension styles
├── cloudflare-worker/         # Cloudflare Worker files
│   ├── wrangler.toml         # Worker configuration
│   ├── src/
│   │   └── index.js          # Worker main logic
│   └── package.json          # Dependencies
└── README.md                 # This file
```

## 🚀 **Setup Instructions**

### **Prerequisites**
- Node.js 18+ and pnpm
- Cloudflare account
- Chrome browser

### **1. Initial Setup**
```bash
# Clone and install dependencies
git clone <your-repo>
cd lanchdrap
pnpm install

# Install Wrangler CLI globally
pnpm add -g wrangler
```

### **2. Cloudflare Worker Setup**
```bash
cd cloudflare-worker

# Login to Cloudflare
wrangler login

# Create KV namespace for ratings
wrangler kv namespace create LANCHDRAP_RATINGS

# Update wrangler.toml with the namespace ID from the output above
# Replace "your-kv-namespace-id" with the actual ID

# Deploy the worker
wrangler deploy
```

### **3. Chrome Extension Setup**
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `chrome-extension` folder
4. The extension is pre-configured with the correct Worker URL
5. The extension will appear in your toolbar

### **4. Configuration**
- The extension is configured to use `https://lunchdrop-ratings.caleb-brown.workers.dev`
- No additional configuration needed - ready to use!

## Features
- Rate orders from 1-5 stars
- Add comments to ratings
- View rating history
- Integration with lunchdrop.com
- Track restaurant sellout status and frequency
- Monitor restaurant availability patterns
- Automatic sellout detection on lunchdrop.com
- Single office focused tracking and analytics
