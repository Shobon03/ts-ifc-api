@echo off
REM Copyright (C) 2025 Matheus Piovezan Teixeira
REM This file is part of ts-ifc-api, licensed under GPL-3.0-or-later

echo ================================
echo Starting ts-ifc-api Production Services
echo ================================
echo.

REM Check if builds exist
if not exist "backend\node\dist\server.js" (
    echo ERROR: Node.js backend not built! Run 'scripts\build.bat' first.
    exit /b 1
)

if not exist "frontend\dist\index.html" (
    echo ERROR: Frontend not built! Run 'scripts\build.bat' first.
    exit /b 1
)

echo Starting all services with concurrently...
echo.
echo Services will run on:
echo - Backend Node.js: http://localhost:3000
echo - Backend Python: http://localhost:5000
echo - Frontend: Served by Node.js at http://localhost:3000
echo.

REM Use concurrently to run all services
call pnpm concurrently --kill-others-on-fail ^
  --names "NODE,PYTHON" ^
  --prefix-colors "blue,green" ^
  "pnpm run start:backend" ^
  "pnpm run start:python"
