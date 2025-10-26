@echo off
REM Copyright (C) 2025 Matheus Piovezan Teixeira
REM This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

echo ================================
echo Starting Node.js Backend (Production)
echo ================================
echo.

if not exist "backend\node\dist\server.js" (
    echo ERROR: Backend not built! Run 'scripts\build.bat' first.
    exit /b 1
)

cd backend\node
echo Starting Node.js server on http://localhost:3000...
call node dist/server.js
