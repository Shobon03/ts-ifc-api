#!/bin/bash
# Copyright (C) 2025 Matheus Piovezan Teixeira
# This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

set -e  # Exit on error

echo "================================"
echo "Starting Node.js Backend (Production)"
echo "================================"
echo ""

if [ ! -f "backend/node/dist/server.js" ]; then
    echo "ERROR: Backend not built! Run 'scripts/build.sh' first."
    exit 1
fi

cd backend/node
echo "Starting Node.js server on http://localhost:3000..."
node dist/server.js
