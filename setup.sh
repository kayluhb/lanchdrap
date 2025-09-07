#!/bin/bash

# LunchDrop Rating System Setup Script

echo "🍽️  Setting up LunchDrop Rating System..."
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first."
    echo "   Install with: npm install -g pnpm"
    echo "   Or visit: https://pnpm.io/installation"
    exit 1
fi

echo "✅ pnpm found: $(pnpm --version)"

# Install Wrangler CLI globally
echo "📦 Installing Wrangler CLI..."
pnpm add -g wrangler

if [ $? -eq 0 ]; then
    echo "✅ Wrangler CLI installed successfully"
else
    echo "❌ Failed to install Wrangler CLI"
    exit 1
fi

# Create necessary directories
echo "📁 Creating project structure..."
mkdir -p chrome-extension/icons
mkdir -p cloudflare-worker/src

echo "✅ Project structure created"

# Install Cloudflare Worker dependencies
echo "📦 Installing Cloudflare Worker dependencies..."
cd cloudflare-worker
pnpm install
cd ..

echo "✅ Dependencies installed"

# Create placeholder icon files
echo "🎨 Creating placeholder icon files..."
echo "PNG" > chrome-extension/icons/icon16.png
echo "PNG" > chrome-extension/icons/icon48.png
echo "PNG" > chrome-extension/icons/icon128.png

echo "✅ Placeholder icons created (replace with actual PNG files)"

# Display next steps
echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. 📱 Chrome Extension Setup:"
echo "   - Open Chrome and go to chrome://extensions/"
echo "   - Enable 'Developer mode'"
echo "   - Click 'Load unpacked' and select the 'chrome-extension' folder"
echo "   - Replace placeholder icons in chrome-extension/icons/ with actual PNG files"
echo ""
echo "2. ☁️  Cloudflare Worker Setup:"
echo "   - Run: wrangler login"
echo "   - Create KV namespace: wrangler kv:namespace create 'RATINGS_KV'"
echo "   - Update wrangler.toml with your KV namespace IDs"
echo "   - Deploy: wrangler deploy"
echo ""
echo "3. 🔗 Update URLs:"
echo "   - In popup.js and content.js, replace 'your-worker.your-subdomain.workers.dev'"
echo "   - With your actual Cloudflare Worker URL"
echo ""
echo "4. 🧪 Test:"
echo "   - Visit lunchdrop.com or similar food delivery site"
echo "   - Click the extension icon to open the popup"
echo "   - Or use the floating rating button on the page"
echo ""
echo "📚 For detailed instructions, see the README files in each directory."
echo ""
echo "Happy rating! 🍕⭐"
