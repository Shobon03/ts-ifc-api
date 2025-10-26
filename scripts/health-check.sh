#!/bin/bash
# Copyright (C) 2025 Matheus Piovezan Teixeira
# This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

echo "================================"
echo "ts-ifc-api Health Check"
echo "================================"
echo ""

ERROR_COUNT=0

# Check Node.js Backend
echo "[1/2] Checking Node.js Backend (port 3000)..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✓ Node.js backend is running"
else
    echo "✗ Node.js backend is NOT running"
    ((ERROR_COUNT++))
fi
echo ""

# Check Python Backend
echo "[2/2] Checking Python Backend (port 5000)..."
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✓ Python backend is running"
else
    echo "✗ Python backend is NOT running"
    ((ERROR_COUNT++))
fi
echo ""

echo "================================"
if [ $ERROR_COUNT -eq 0 ]; then
    echo "All services are healthy! ✓"
    echo "================================"
    exit 0
else
    echo "$ERROR_COUNT service(s) are not running! ✗"
    echo "================================"
    echo ""
    echo "Troubleshooting:"
    echo "- Check if services are started: pnpm start or ./scripts/start.sh"
    echo "- Check logs for errors"
    echo "- Verify ports are not in use by other applications"
    exit 1
fi
