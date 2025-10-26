#!/bin/bash
# Copyright (C) 2025 Matheus Piovezan Teixeira
# This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

set -e  # Exit on error

echo "================================"
echo "Starting ts-ifc-api Production Services"
echo "================================"
echo ""

# Check if builds exist
if [ ! -f "backend/node/dist/server.js" ]; then
    echo "ERROR: Node.js backend not built! Run 'scripts/build.sh' first."
    exit 1
fi

if [ ! -f "frontend/dist/index.html" ]; then
    echo "ERROR: Frontend not built! Run 'scripts/build.sh' first."
    exit 1
fi

echo "Starting all services with concurrently..."
echo ""
echo "Services will run on:"
echo "- Backend Node.js: http://localhost:3000"
echo "- Backend Python: http://localhost:5000"
echo "- Frontend: Served by Node.js at http://localhost:3000"
echo ""

# Use concurrently to run all services
pnpm concurrently --kill-others-on-fail \
  --names "NODE,PYTHON" \
  --prefix-colors "blue,green" \
  "pnpm run start:backend" \
  "pnpm run start:python"
