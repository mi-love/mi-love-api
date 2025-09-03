#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# The root directory of your project
PROJECT_ROOT=$(git rev-parse --show-toplevel)
# The directory where the final build output will be copied
DESTINATION_DIR="$PROJECT_ROOT"
# Files/directories to exclude from the temporary build directory (space-separated)
EXCLUDE_ITEMS="node_modules dist .git"

echo "🚀 Starting zero-downtime deployment script..."

# --- 1. Create a temporary directory ---
TEMP_DIR=$(mktemp -d)
echo "✅ Created temporary directory: $TEMP_DIR"

# --- Cleanup function to remove temp directory on exit ---
cleanup() {
  echo "🧹 Cleaning up temporary directory..."
  rm -rf "$TEMP_DIR"
  echo "✅ Cleanup complete."
}
trap cleanup EXIT

# --- 2. Copy project files to the temporary directory ---
echo "🚚 Copying project files to the temporary directory..."
# Using rsync to easily exclude files and directories
EXCLUDE_STRING=""
for item in $EXCLUDE_ITEMS; do
  EXCLUDE_STRING+="--exclude=$item "
done

rsync -av --progress "$PROJECT_ROOT/" "$TEMP_DIR/" $EXCLUDE_STRING
echo "✅ Project files copied successfully."

# --- 3. Build the application in the temporary directory ---
cd "$TEMP_DIR"
echo "🛠️  Building the application in $TEMP_DIR..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install --only=production --silent

# Run the build script (assuming 'npm run build')
echo "⚙️ Running build script..."
npm run build

echo "✅ Build completed successfully."

# --- 4. Copy the build output back to the original project directory ---
echo "🚚 Copying build files to the destination..."
# Copy the 'dist' folder and 'node_modules' to the project root
rsync -av "$TEMP_DIR/dist/" "$DESTINATION_DIR/dist/"
rsync -av "$TEMP_DIR/node_modules/" "$DESTINATION_DIR/node_modules/"
echo "✅ Build files copied to $DESTINATION_DIR."

echo "🎉 Deployment successful!"
exit 0
