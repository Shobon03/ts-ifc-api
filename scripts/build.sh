#!/bin/bash
# Copyright (C) 2025 Matheus Piovezan Teixeira
# This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

set -e  # Exit on error

echo "================================"
echo "Building ts-ifc-api for Production"
echo "================================"
echo ""

# Build Node.js backend
echo "[1/3] Building Node.js backend..."
pnpm --filter=@ts-ifc-api/backend-node build
echo "✓ Node.js backend built successfully"
echo ""

# Build Frontend
echo "[2/3] Building Frontend..."
pnpm --filter=@ts-ifc-api/frontend build
echo "✓ Frontend built successfully"
echo ""

# Build Documentation
echo "[3/3] Building Documentation..."
pnpm --filter=@ts-ifc-api/docs build
echo "✓ Documentation built successfully"
echo ""

# Python doesn't need compilation, but we can verify dependencies
echo "[INFO] Python backend uses interpreted code - no build required"
echo "[INFO] Ensure requirements are installed: cd backend/python && pip install -r requirements.txt"
echo ""

echo "================================"
echo "Build completed successfully!"
echo "================================"
echo ""
echo "Next steps:"
echo "- Run 'scripts/start.sh' to start all services"
echo "- Or run individual services with 'scripts/start-*.sh'"
