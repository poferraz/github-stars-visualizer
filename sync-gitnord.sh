#!/bin/bash

# Exit on error
set -e

echo "🔄 Starting Sync to gitnord folder..."

# Define directories
SRC_DIR="$(pwd)"
DEST_DIR="${SRC_DIR}/gitnord"

# 1. Create destination folder if it doesn't exist
mkdir -p "$DEST_DIR"

# 2. Initialize Git in destination if not already initialized
if [ ! -d "$DEST_DIR/.git" ]; then
    echo "⚙️ Initializing separate Git repository in gitnord..."
    cd "$DEST_DIR"
    git init -b main
    cd "$SRC_DIR"
fi

# 3. Synchronize files (excluding build files, node_modules, git, and gitnord itself)
echo "📂 Copying clean project files to gitnord..."
rsync -av \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='gitnord' \
  --exclude='.DS_Store' \
  --exclude='sync-gitnord.sh' \
  --delete \
  "$SRC_DIR/" "$DEST_DIR/"

# 4. Write a custom README.md for the deployment repo in gitnord
echo "📝 Writing deployment README.md for the private repo..."
cat << 'EOF' > "$DEST_DIR/README_DEPLOY.md"
# 🌐 GitStars Map - Production Deployment Repo

This repository is a private mirror of the GitStars Map codebase, configured specifically for hosting and running the live website on Vercel, Netlify, or GitHub Pages.

## 🚀 How to deploy to Vercel

1. Create a new project on [Vercel](https://vercel.com).
2. Connect it to this private GitHub repository.
3. Configure the build settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Deploy! Any push to this repo will trigger an automatic production build and deployment.

## 🔄 Keeping in Sync

To sync files from the main project repo to this deployment repo, run the `./sync-gitnord.sh` script in the main repository root.
EOF

# 5. Commit changes in the gitnord repository
echo "💾 Committing changes in gitnord..."
cd "$DEST_DIR"
git add .
if git diff-index --quiet HEAD --; then
    echo "✅ No changes to commit in gitnord."
else
    git commit -m "sync: update website deployment files - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "✅ Sync complete! Files committed to gitnord repository."
    echo "👉 You can now navigate to gitnord/ and run 'git remote add origin <your-private-repo-url>' followed by 'git push -u origin main' to publish the live website."
fi
cd "$SRC_DIR"
