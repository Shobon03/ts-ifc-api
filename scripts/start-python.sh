#!/bin/bash
# Copyright (C) 2025 Matheus Piovezan Teixeira
# This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

set -e  # Exit on error

echo "================================"
echo "Starting Python Backend (Production)"
echo "================================"
echo ""

cd backend/python

# Check if virtual environment exists
if [ ! -f "venv/bin/activate" ]; then
    echo "ERROR: Virtual environment not found!"
    echo "Please create it first: python3 -m venv venv"
    echo "Then install dependencies: source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Starting Python server on http://localhost:5000..."
python src/server.py
