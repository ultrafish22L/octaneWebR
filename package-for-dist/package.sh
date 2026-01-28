#!/bin/bash
# octaneWebR Distribution Packager
# Interactive menu to choose packaging method

clear
echo "╔═══════════════════════════════════════════════════╗"
echo "║      octaneWebR Distribution Packager             ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  Choose your distribution method:                 ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "1️⃣  Production Build (Static Files)"
echo "   📦 Size: ~5-10 MB"
echo "   👥 Best for: Web hosting, quick sharing"
echo "   ⚙️  Requirements: Python or Node.js"
echo ""
echo "2️⃣  Electron Desktop App"
echo "   📦 Size: ~100-150 MB per platform"
echo "   👥 Best for: End users, desktop feel"
echo "   ⚙️  Requirements: None for end users"
echo ""
echo "3️⃣  Docker Container"
echo "   📦 Size: ~60-150 MB"
echo "   👥 Best for: Cloud, enterprise, DevOps"
echo "   ⚙️  Requirements: Docker"
echo ""
echo "4️⃣  View Documentation"
echo "   📖 Read DISTRIBUTION-GUIDE.md"
echo ""
echo "5️⃣  Exit"
echo ""
read -p "Enter your choice (1-5): " choice
echo ""

case $choice in
  1)
    echo "🚀 Building Production Package..."
    echo ""
    if [ -f "package-production.sh" ]; then
      ./package-production.sh
    else
      echo "❌ Error: package-production.sh not found"
      exit 1
    fi
    ;;
  2)
    echo "🚀 Setting up Electron Packaging..."
    echo ""
    if [ -f "package-electron.sh" ]; then
      ./package-electron.sh
      echo ""
      echo "✅ Electron setup complete!"
      echo ""
      echo "📋 Next steps:"
      echo "   • Read ELECTRON-PACKAGING.md for detailed instructions"
      echo "   • Run build commands:"
      echo "     - npm run electron:build:win    (Windows)"
      echo "     - npm run electron:build:mac    (macOS)"
      echo "     - npm run electron:build:linux  (Linux)"
      echo ""
    else
      echo "❌ Error: package-electron.sh not found"
      exit 1
    fi
    ;;
  3)
    echo "🚀 Building Docker Container..."
    echo ""
    if [ -f "Dockerfile" ]; then
      echo "Building Docker image (this may take a few minutes)..."
      docker-compose build
      
      if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Docker image built successfully!"
        echo ""
        echo "📋 Next steps:"
        echo ""
        echo "Test locally:"
        echo "  docker-compose up -d"
        echo "  Open http://localhost:43930"
        echo ""
        echo "Create TAR archive for distribution:"
        echo "  docker save octanewebr:latest | gzip > octanewebr-docker.tar.gz"
        echo ""
        echo "Push to Docker Hub:"
        echo "  docker tag octanewebr:latest yourusername/octanewebr:latest"
        echo "  docker push yourusername/octanewebr:latest"
        echo ""
        echo "📖 Read DOCKER-PACKAGING.md for complete guide"
        echo ""
      else
        echo "❌ Error: Docker build failed"
        echo "   Ensure Docker is installed and running"
        exit 1
      fi
    else
      echo "❌ Error: Dockerfile not found"
      exit 1
    fi
    ;;
  4)
    echo "📖 Opening Documentation..."
    echo ""
    if [ -f "DISTRIBUTION-GUIDE.md" ]; then
      if command -v less &> /dev/null; then
        less DISTRIBUTION-GUIDE.md
      elif command -v more &> /dev/null; then
        more DISTRIBUTION-GUIDE.md
      else
        cat DISTRIBUTION-GUIDE.md
      fi
    else
      echo "❌ Error: DISTRIBUTION-GUIDE.md not found"
      exit 1
    fi
    ;;
  5)
    echo "👋 Exiting..."
    exit 0
    ;;
  *)
    echo "❌ Invalid choice. Please run the script again and choose 1-5."
    exit 1
    ;;
esac
