#!/bin/bash

# Script to package the Chrome extension for Chrome Web Store submission
# This creates a ZIP file with the correct structure

set -e

# Get the project root directory (parent of bin directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

EXTENSION_DIR="$PROJECT_ROOT/chrome-extension"
OUTPUT_FILE="$PROJECT_ROOT/lanchdrap-extension.zip"
TEMP_DIR=$(mktemp -d)

echo "📦 Packaging Chrome extension for Chrome Web Store..."

# Check if extension directory exists
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "❌ Error: $EXTENSION_DIR directory not found"
    exit 1
fi

# Copy extension files to temp directory
echo "📋 Copying extension files..."
cp -r "$EXTENSION_DIR"/* "$TEMP_DIR/"

# Remove unwanted files
echo "🧹 Cleaning up unwanted files..."
find "$TEMP_DIR" -name ".DS_Store" -delete
find "$TEMP_DIR" -name "__MACOSX" -type d -exec rm -rf {} + 2>/dev/null || true
find "$TEMP_DIR" -name "*.map" -delete 2>/dev/null || true
find "$TEMP_DIR" -name "README.md" -delete 2>/dev/null || true

# Create ZIP file from temp directory
echo "📦 Creating ZIP file..."
cd "$TEMP_DIR"
zip -r "$OUTPUT_FILE" . -q
cd "$PROJECT_ROOT"

# Clean up temp directory
rm -rf "$TEMP_DIR"

# Verify ZIP file was created
if [ -f "$OUTPUT_FILE" ]; then
    SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo "✅ Success! Extension packaged: $OUTPUT_FILE ($SIZE)"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Go to https://chrome.google.com/webstore/devconsole"
    echo "   2. Click 'New Item'"
    echo "   3. Upload $OUTPUT_FILE"
    echo "   4. Fill out the store listing form"
    echo "   5. Submit for review"
    echo ""
    echo "📖 See PUBLISHING_GUIDE.md for detailed instructions"
else
    echo "❌ Error: Failed to create ZIP file"
    exit 1
fi

