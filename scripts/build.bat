@echo off
REM Copyright (C) 2025 Matheus Piovezan Teixeira
REM This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

echo ================================
echo Building ts-ifc-api for Production
echo ================================
echo.

REM Build Node.js backend
echo [1/3] Building Node.js backend...
call pnpm --filter=@ts-ifc-api/backend-node build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js backend build failed!
    exit /b 1
)
echo ✓ Node.js backend built successfully
echo.

REM Build Frontend
echo [2/3] Building Frontend...
call pnpm --filter=@ts-ifc-api/frontend build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Frontend build failed!
    exit /b 1
)
echo ✓ Frontend built successfully
echo.

REM Build Documentation
echo [3/3] Building Documentation...
call pnpm --filter=@ts-ifc-api/docs build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Documentation build failed!
    exit /b 1
)
echo ✓ Documentation built successfully
echo.

REM Python doesn't need compilation, but we can verify dependencies
echo [INFO] Python backend uses interpreted code - no build required
echo [INFO] Ensure requirements are installed: cd backend\python ^&^& pip install -r requirements.txt
echo.

echo ================================
echo Build completed successfully!
echo ================================
echo.
echo Next steps:
echo - Run 'scripts\start.bat' to start all services
echo - Or run individual services with 'scripts\start-*.bat'
