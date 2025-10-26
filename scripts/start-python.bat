@echo off
REM Copyright (C) 2025 Matheus Piovezan Teixeira
REM This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

echo ================================
echo Starting Python Backend (Production)
echo ================================
echo.

cd backend\python

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Please create it first: python -m venv venv
    echo Then install dependencies: venv\Scripts\activate ^&^& pip install -r requirements.txt
    exit /b 1
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Starting Python server on http://localhost:5000...
python src/server.py
