@echo off
REM Copyright (C) 2025 Matheus Piovezan Teixeira
REM This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

echo ================================
echo ts-ifc-api Health Check
echo ================================
echo.

set ERROR_COUNT=0

REM Check Node.js Backend
echo [1/2] Checking Node.js Backend (port 3000)...
curl -s http://localhost:3000/health >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✓ Node.js backend is running
) else (
    echo ✗ Node.js backend is NOT running
    set /a ERROR_COUNT+=1
)
echo.

REM Check Python Backend
echo [2/2] Checking Python Backend (port 5000)...
curl -s http://localhost:5000/health >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✓ Python backend is running
) else (
    echo ✗ Python backend is NOT running
    set /a ERROR_COUNT+=1
)
echo.

echo ================================
if %ERROR_COUNT% equ 0 (
    echo All services are healthy! ✓
    echo ================================
    exit /b 0
) else (
    echo %ERROR_COUNT% service(s) are not running! ✗
    echo ================================
    echo.
    echo Troubleshooting:
    echo - Check if services are started: pnpm start or scripts\start.bat
    echo - Check logs for errors
    echo - Verify ports are not in use by other applications
    exit /b 1
)
