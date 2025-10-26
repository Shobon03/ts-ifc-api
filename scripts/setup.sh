#!/bin/bash
# Copyright (C) 2025 Matheus Piovezan Teixeira
# This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

set -e  # Exit on error

echo "================================"
echo "Setting up ts-ifc-api Development Environment"
echo "================================"
echo ""

# Install Node.js dependencies
echo "[1/3] Installing Node.js dependencies..."
pnpm install
echo "✓ Node.js dependencies installed"
echo ""

# Setup Python virtual environment
echo "[2/3] Setting up Python environment..."
cd backend/python

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..
echo "✓ Python environment configured"
echo ""

# Create .env file if it doesn't exist
echo "[3/3] Checking environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "Creating .env from .env.example..."
        cp .env.example .env
        echo "⚠ Please edit .env file with your configuration"
    else
        echo "⚠ No .env.example found - please create .env manually"
    fi
else
    echo "✓ .env file exists"
fi
echo ""

echo "================================"
echo "Setup completed successfully!"
echo "================================"
echo ""
echo "Next steps:"
echo "- Development: Run 'pnpm dev' to start all services in dev mode"
echo "- Production: Run 'scripts/build.sh' then 'scripts/start.sh'"
