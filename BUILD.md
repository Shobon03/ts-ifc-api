# Build & Deployment Guide

This guide describes how to build and run **ts-ifc-api** in production.

## 📋 Prerequisites

### Required Software

- **Node.js** >= 18.0.0 (LTS recommended: 20.x)
- **pnpm** >= 8.0.0
- **Python** >= 3.8 (3.13+ recommended)
- **Git**

### Desktop Plugins (Optional)

For complete conversion functionality:

- **Revit Plugin** - For Revit ↔ IFC conversions
- **Archicad Plugin** - For Archicad ↔ IFC conversions

---

## 🚀 Initial Setup

### Windows

```bash
# Clone repository
git clone https://github.com/Shobon03/ts-ifc-api.git
cd ts-ifc-api

# Run setup script
scripts\setup.bat

# OR manually:
pnpm install
cd backend\python
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
deactivate
cd ..\..
```

### Linux/Mac

```bash
# Clone repository
git clone https://github.com/Shobon03/ts-ifc-api.git
cd ts-ifc-api

# Grant execution permission to scripts
chmod +x scripts/*.sh

# Run setup script
./scripts/setup.sh

# OR manually:
pnpm install
cd backend/python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..
```

### Environment Configuration

Create a `.env` file in the project root:

```env
# Node.js Backend
NODE_ENV=production
PORT=3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Python Backend
FLASK_PORT=5000
FLASK_DEBUG=False

# WebSocket
NODE_WS_URL=ws://localhost:3000/ws/python-bridge

# Plugins
ARCHICAD_PLUGIN_WS_PORT=8081
REVIT_PLUGIN_WS_PORT=8082

# Storage
JOB_STORAGE_ROOT=./storage
JOB_TTL_MINUTES=180
JOB_CLEANUP_INTERVAL_SECONDS=60
```

---

## 🔨 Production Build

### Option 1: Using Scripts (Recommended)

**Windows:**

```bash
scripts\build.bat
```

**Linux/Mac:**

```bash
./scripts/build.sh
```

### Option 2: Using pnpm

```bash
# Full build (Node + Frontend + Docs)
pnpm build

# Individual builds
pnpm build:backend      # Node.js backend
pnpm build:frontend     # React frontend
pnpm build:documentation # Fumadocs documentation
```

### What the Build Does

1. **Node.js Backend** (`backend/node`)
   - Compiles TypeScript → JavaScript
   - Output: `backend/node/dist/`

2. **Frontend** (`frontend`)
   - Compiles React + Vite
   - Optimizes assets (minify, tree-shaking)
   - Output: `frontend/dist/`

3. **Documentation** (`documentation`)
   - Compiles Fumadocs (Next.js)
   - Output: `documentation/.next/`

4. **Python Backend** (`backend/python`)
   - ⚠️ Python doesn't require build (interpreted)
   - Ensure dependencies are installed

---

## ▶️ Running in Production

### Option 1: All Services (Recommended)

**Windows:**

```bash
scripts\start.bat
```

**Linux/Mac:**

```bash
./scripts/start.sh
```

**OR via pnpm:**

```bash
pnpm start
```

This starts:

- **Node.js Backend**: http://localhost:3000
- **Python Backend**: http://localhost:5000
- **Frontend**: Served by Node.js at http://localhost:3000

### Option 2: Individual Services

**Node.js Backend:**

```bash
# Windows
scripts\start-backend.bat

# Linux/Mac
./scripts/start-backend.sh

# OR
pnpm start:backend
```

**Python Backend:**

```bash
# Windows
scripts\start-python.bat

# Linux/Mac
./scripts/start-python.sh

# OR
pnpm start:python           # Windows
pnpm start:python:unix      # Linux/Mac
```

---

## 🧪 Development

For development with hot-reload:

```bash
# All services in dev mode
pnpm dev

# Individual services
pnpm dev:backend        # Node.js (port 3000)
pnpm dev:python         # Python (port 5000)
pnpm dev:frontend       # Vite dev server (port 3001)
pnpm dev:documentation  # Fumadocs (port 3002)
```

---

## 📂 Directory Structure After Build

```
ts-ifc-api/
├── backend/
│   ├── node/
│   │   └── dist/              # ✅ Compiled TypeScript
│   └── python/
│       ├── src/               # ✅ Python source code
│       └── venv/              # ✅ Python virtual environment
├── frontend/
│   └── dist/                  # ✅ Optimized React build
├── documentation/
│   └── .next/                 # ✅ Static documentation (Next.js)
├── scripts/                   # ✅ Automation scripts
└── storage/                   # Conversion files (created at runtime)
```

---

## 🔍 Verification

### Health Checks

**Node.js Backend:**

```bash
curl http://localhost:3000/health
```

**Python Backend:**

```bash
curl http://localhost:5000/health
```

**Expected response:**

```json
{
  "status": "ok",
  "nodeWebSocket": "connected",
  "pluginWebSockets": {
    "revit": "connected",
    "archicad": "connected"
  },
  "cleanupWorker": "alive",
  "version": "1.1.0"
}
```

---

## 🐛 Troubleshooting

### Error: "Backend not built"

```bash
# Run the build again
pnpm build
```

### Error: "Virtual environment not found"

```bash
# Windows
cd backend\python
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Linux/Mac
cd backend/python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Error: "Port already in use"

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Plugins won't connect

1. Check if Revit/Archicad are open
2. Verify plugins are installed and enabled
3. Check Python logs for connection messages
4. Confirm ports in `.env`: `REVIT_PLUGIN_WS_PORT` and `ARCHICAD_PLUGIN_WS_PORT`

---

## 📦 Deployment

### Production with PM2 (Node.js Process Manager)

```bash
# Install PM2
npm install -g pm2

# Build
pnpm build

# Create ecosystem.config.js file
```

**ecosystem.config.js:**

```javascript
module.exports = {
  apps: [
    {
      name: "ts-ifc-api-node",
      script: "backend/node/dist/server.js",
      cwd: "./backend/node",
      instances: 1,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "ts-ifc-api-python",
      script: "venv/Scripts/python",
      args: "src/server.py",
      cwd: "./backend/python",
      interpreter: "none",
      env: {
        FLASK_ENV: "production",
        FLASK_PORT: 5000,
      },
    },
  ],
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Configure to start on boot
pm2 startup
pm2 save
```

### Docker (Future)

> ⚠️ Dockerfile not yet implemented. Contributions are welcome!

---

## 📝 License

This project is licensed under **GPL-3.0-or-later**.

Copyright (C) 2025 Matheus Piovezan Teixeira
