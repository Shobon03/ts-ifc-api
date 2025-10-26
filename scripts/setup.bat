@echo off
REM Copyright (C) 2025 Matheus Piovezan Teixeira
REM This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

echo ================================
echo Setting up ts-ifc-api Development Environment
echo ================================
echo.

REM Install Node.js dependencies
echo [1/3] Installing Node.js dependencies...
call pnpm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install Node.js dependencies!
    exit /b 1
)
echo ✓ Node.js dependencies installed
echo.

REM Setup Python virtual environment
echo [2/3] Setting up Python environment...
cd backend\python

if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to create virtual environment!
        cd ..\..
        exit /b 1
    )
)

echo Installing Python dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install Python dependencies!
    cd ..\..
    exit /b 1
)
call deactivate
cd ..\..
echo ✓ Python environment configured
echo.

REM Create .env file if it doesn't exist
echo [3/3] Checking environment configuration...
if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env from .env.example...
        copy .env.example .env
        echo ⚠ Please edit .env file with your configuration
    ) else (
        echo ⚠ No .env.example found - please create .env manually
    )
) else (
    echo ✓ .env file exists
)
echo.

echo ================================
echo Setup completed successfully!
echo ================================
echo.
echo Next steps:
echo - Development: Run 'pnpm dev' to start all services in dev mode
echo - Production: Run 'scripts\build.bat' then 'scripts\start.bat'
