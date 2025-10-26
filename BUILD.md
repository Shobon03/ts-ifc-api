# Build & Deployment Guide

Este guia descreve como fazer o build e executar o **ts-ifc-api** em produção.

## 📋 Pré-requisitos

### Software Necessário
- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Python** >= 3.8
- **Git**

### Plugins Desktop (Opcionais)
Para funcionalidade completa de conversão:
- **Revit Plugin** - Para conversões Revit ↔ IFC
- **Archicad Plugin** - Para conversões Archicad ↔ IFC

---

## 🚀 Setup Inicial

### Windows

```bash
# Clonar repositório
git clone https://github.com/Shobon03/ts-ifc-api.git
cd ts-ifc-api

# Executar script de setup
scripts\setup.bat

# OU manualmente:
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
# Clonar repositório
git clone https://github.com/Shobon03/ts-ifc-api.git
cd ts-ifc-api

# Dar permissão de execução aos scripts
chmod +x scripts/*.sh

# Executar script de setup
./scripts/setup.sh

# OU manualmente:
pnpm install
cd backend/python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..
```

### Configuração de Ambiente

Crie um arquivo `.env` na raiz do projeto:

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

## 🔨 Build para Produção

### Opção 1: Usando Scripts (Recomendado)

**Windows:**
```bash
scripts\build.bat
```

**Linux/Mac:**
```bash
./scripts/build.sh
```

### Opção 2: Usando pnpm

```bash
# Build completo (Node + Frontend + Docs)
pnpm build

# Build individual
pnpm build:backend      # Node.js backend
pnpm build:frontend     # React frontend
pnpm build:documentation # VitePress docs
```

### O que o Build Faz

1. **Node.js Backend** (`backend/node`)
   - Compila TypeScript → JavaScript
   - Saída: `backend/node/dist/`

2. **Frontend** (`frontend`)
   - Compila React + Vite
   - Otimiza assets (minify, tree-shaking)
   - Saída: `frontend/dist/`

3. **Documentation** (`documentation`)
   - Compila VitePress
   - Saída: `documentation/.vitepress/dist/`

4. **Python Backend** (`backend/python`)
   - ⚠️ Python não precisa de build (interpretado)
   - Certifique-se de que as dependências estão instaladas

---

## ▶️ Execução em Produção

### Opção 1: Todos os Serviços (Recomendado)

**Windows:**
```bash
scripts\start.bat
```

**Linux/Mac:**
```bash
./scripts/start.sh
```

**OU via pnpm:**
```bash
pnpm start
```

Isso inicia:
- **Node.js Backend**: http://localhost:3000
- **Python Backend**: http://localhost:5000
- **Frontend**: Servido pelo Node.js em http://localhost:3000

### Opção 2: Serviços Individuais

**Node.js Backend:**
```bash
# Windows
scripts\start-backend.bat

# Linux/Mac
./scripts/start-backend.sh

# OU
pnpm start:backend
```

**Python Backend:**
```bash
# Windows
scripts\start-python.bat

# Linux/Mac
./scripts/start-python.sh

# OU
pnpm start:python           # Windows
pnpm start:python:unix      # Linux/Mac
```

---

## 🧪 Desenvolvimento

Para desenvolvimento com hot-reload:

```bash
# Todos os serviços em modo dev
pnpm dev

# Serviços individuais
pnpm dev:backend        # Node.js (porta 3000)
pnpm dev:python         # Python (porta 5000)
pnpm dev:frontend       # Vite dev server (porta 3001)
pnpm dev:documentation  # VitePress (porta 5173)
```

---

## 📂 Estrutura de Diretórios Após Build

```
ts-ifc-api/
├── backend/
│   ├── node/
│   │   └── dist/              # ✅ Compilado TypeScript
│   └── python/
│       ├── src/               # ✅ Código fonte Python
│       └── venv/              # ✅ Ambiente virtual Python
├── frontend/
│   └── dist/                  # ✅ Build otimizado React
├── documentation/
│   └── .vitepress/dist/       # ✅ Documentação estática
├── scripts/                   # ✅ Scripts de automação
└── storage/                   # Arquivos de conversão (criado em runtime)
```

---

## 🔍 Verificação

### Health Checks

**Backend Node.js:**
```bash
curl http://localhost:3000/health
```

**Backend Python:**
```bash
curl http://localhost:5000/health
```

**Resposta esperada:**
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

### Erro: "Backend not built"
```bash
# Execute o build novamente
pnpm build
```

### Erro: "Virtual environment not found"
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

### Erro: "Port already in use"
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Plugins não conectam
1. Verifique se Revit/Archicad estão abertos
2. Verifique se os plugins estão instalados e habilitados
3. Verifique os logs do Python para mensagens de conexão
4. Confirme as portas no `.env`: `REVIT_PLUGIN_WS_PORT` e `ARCHICAD_PLUGIN_WS_PORT`

---

## 📦 Deploy

### Produção com PM2 (Node.js Process Manager)

```bash
# Instalar PM2
npm install -g pm2

# Build
pnpm build

# Criar arquivo ecosystem.config.js
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'ts-ifc-api-node',
      script: 'backend/node/dist/server.js',
      cwd: './backend/node',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'ts-ifc-api-python',
      script: 'venv/Scripts/python',
      args: 'src/server.py',
      cwd: './backend/python',
      interpreter: 'none',
      env: {
        FLASK_ENV: 'production',
        FLASK_PORT: 5000
      }
    }
  ]
};
```

```bash
# Iniciar com PM2
pm2 start ecosystem.config.js

# Configurar para iniciar no boot
pm2 startup
pm2 save
```

### Docker (Futuro)

> ⚠️ Dockerfile ainda não implementado. Contribuições são bem-vindas!

---

## 📝 Licença

Este projeto está licenciado sob **GPL-3.0-or-later**.

Copyright (C) 2025 Matheus Piovezan Teixeira
