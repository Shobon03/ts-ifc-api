# ts-ifc-api

<p align="center">
<strong>BIM Interoperability API for Revit, Archicad and IFC</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-development">Development</a> •
  <a href="#-production">Production</a> •
  <a href="#-documentation">Documentation</a>
</p>

---

## 🎯 Goals

This project provides a complete **BIM interoperability layer** for architectural software, enabling seamless conversion between:
- **Revit** (.rvt) ↔ IFC
- **Archicad** (.pln) ↔ IFC
- **Revit** ↔ **Archicad** (via IFC)

### Key Components
- **REST API** (Node.js + TypeScript)
- **WebSocket Bridge** (Python + Flask)
- **Desktop Plugins** (Revit C# + Archicad C#)
- **Web Interface** (React + TypeScript)
- **Documentation** (VitePress)

---

## ✨ Features

- ✅ **Real-time conversion progress** via WebSocket
- ✅ **Multi-format support**: RVT, PLN, IFC
- ✅ **Plugin status monitoring**
- ✅ **Job management** with automatic cleanup
- ✅ **File download** after conversion
- ✅ **RESTful API** with Swagger documentation
- ✅ **Cross-platform** (Windows, Linux, macOS)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Python** >= 3.8

### Installation

**Windows:**
```bash
git clone https://github.com/Shobon03/ts-ifc-api.git
cd ts-ifc-api
scripts\setup.bat
```

**Linux/Mac:**
```bash
git clone https://github.com/Shobon03/ts-ifc-api.git
cd ts-ifc-api
chmod +x scripts/*.sh
./scripts/setup.sh
```

**Or manually:**
```bash
pnpm install
cd backend/python
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## 💻 Development

Start all services in development mode with hot-reload:

```bash
pnpm dev
```

Or start services individually:

```bash
pnpm dev:backend        # Node.js API (port 3000)
pnpm dev:python         # Python bridge (port 5000)
pnpm dev:frontend       # React app (port 3001)
pnpm dev:documentation  # VitePress docs (port 5173)
```

### Ports After Initialization

| Service | URL | Description |
|---------|-----|-------------|
| **Backend API** | http://localhost:3000 | Node.js REST API + WebSocket |
| **Python Bridge** | http://localhost:5000 | Plugin communication bridge |
| **Frontend** | http://localhost:3001 | React web interface |
| **Documentation** | http://localhost:5173 | VitePress documentation |
| **Swagger API Docs** | http://localhost:3000/docs | Interactive API reference |

---

## 🏭 Production

### Build

**Windows:**
```bash
scripts\build.bat
```

**Linux/Mac:**
```bash
./scripts/build.sh
```

**Or with pnpm:**
```bash
pnpm build
```

### Run

**Windows:**
```bash
scripts\start.bat
```

**Linux/Mac:**
```bash
./scripts/start.sh
```

**Or with pnpm:**
```bash
pnpm start
```

### Production with PM2

```bash
# Install PM2
npm install -g pm2

# Build
pnpm build

# Start with PM2
pm2 start ecosystem.config.js

# Configure to start on boot
pm2 startup
pm2 save
```

For detailed build and deployment instructions, see **[BUILD.md](BUILD.md)**.

## License

This project is licensed under GPL-3.0 - see [LICENSE](LICENSE) for more details.

## About

This project is a part of my final thesis for my undergraduate Computer Science degree.