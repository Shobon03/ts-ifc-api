# 📋 Deploy Checklist

Use this checklist to ensure a successful deployment of **ts-ifc-api**.

---

## ✅ Pre-Deploy

### Environment
- [ ] Node.js >= 22.0.0 (LTS) installed
- [ ] pnpm >= 8.0.0 installed
- [ ] Python >= 3.13 installed
- [ ] Git installed

### Code
- [ ] Repository cloned: `git clone https://github.com/Shobon03/ts-ifc-api.git`
- [ ] On correct branch: `git checkout main`
- [ ] Code updated: `git pull origin main`

### Configuration
- [ ] `.env` file created from `.env.example`
- [ ] Environment variables configured:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3000`
  - [ ] `FLASK_PORT=5000`
  - [ ] `CORS_ORIGINS` configured
  - [ ] Plugin ports (8081, 8082)
  - [ ] `JOB_STORAGE_ROOT` defined

---

## 🔧 Setup

### Dependencies
- [ ] Node.js dependencies installed: `pnpm install`
- [ ] Python venv created: `cd backend/python && python -m venv venv`
- [ ] Python dependencies installed: `pip install -r requirements.txt`

**Or use the script:**
- [ ] Windows: `scripts\setup.bat`
- [ ] Linux/Mac: `./scripts/setup.sh`

---

## 🔨 Build

### Compilation
- [ ] Build executed successfully
  - Windows: `scripts\build.bat`
  - Linux/Mac: `./scripts/build.sh`
  - pnpm: `pnpm build`

### Build Verification
- [ ] `backend/node/dist/server.js` exists
- [ ] `frontend/dist/index.html` exists
- [ ] `documentation/.next/static/` exists
- [ ] No TypeScript errors
- [ ] No Vite build errors

---

## 🚀 Execution

### Local Test (Production Mode)
- [ ] Services start without errors:
  - Windows: `scripts\start.bat`
  - Linux/Mac: `./scripts/start.sh`
  - pnpm: `pnpm start`

### Health Checks
- [ ] Backend Node.js responds: `curl http://localhost:3000/health`
- [ ] Backend Python responds: `curl http://localhost:5000/health`
- [ ] Frontend accessible: http://localhost:3000
- [ ] API Docs accessible: http://localhost:3000/docs

### Features
- [ ] Web interface loads correctly
- [ ] WebSocket connects (check browser console)
- [ ] Plugin status indicators appear (even if disconnected)
- [ ] File upload works
- [ ] Conversion works (if plugins installed)
- [ ] File download works

---

## 🔌 Desktop Plugins (Optional)

If using Revit/Archicad conversions:

### Revit Plugin
- [ ] Plugin installed in Revit
- [ ] Revit running
- [ ] Plugin connected (status: green in interface)
- [ ] Python logs show: `Revit plugin connected`

### Archicad Plugin
- [ ] Plugin installed in Archicad
- [ ] Archicad running
- [ ] Plugin connected (status: green in interface)
- [ ] Python logs show: `Archicad plugin connected`

---

## 🏭 Production Deploy (PM2)

### PM2 Setup
- [ ] PM2 installed globally: `npm install -g pm2`
- [ ] `ecosystem.config.js` file configured
- [ ] Python path adjusted (Windows/Linux)

### PM2 Execution
- [ ] Services started: `pm2 start ecosystem.config.js`
- [ ] Status verified: `pm2 status`
- [ ] Logs verified: `pm2 logs`
- [ ] No errors in logs

### PM2 Persistence
- [ ] Startup configured: `pm2 startup`
- [ ] Configuration saved: `pm2 save`
- [ ] Tested after reboot

---

## 🔒 Security

### Production
- [ ] `NODE_ENV=production` configured
- [ ] `FLASK_DEBUG=False` configured
- [ ] CORS configured correctly (don't use `*` in production)
- [ ] Secrets/API keys in environment variables (not in code)
- [ ] `.env` in `.gitignore`

### Network
- [ ] Firewall configured
- [ ] Only necessary ports exposed
- [ ] HTTPS configured (if applicable)
- [ ] Reverse proxy configured (Nginx/Apache, if applicable)

---

## 📊 Monitoring

### Logs
- [ ] Logs being generated correctly
- [ ] Log rotation configured
- [ ] No recurring errors in logs

### Performance
- [ ] Acceptable CPU usage (`pm2 monit`)
- [ ] Acceptable memory usage (`pm2 monit`)
- [ ] Disk space available
- [ ] Job cleanup working

---

## 🧹 Post-Deploy

### Final Verification
- [ ] All features tested
- [ ] Documentation accessible
- [ ] API responding correctly
- [ ] WebSocket working
- [ ] Conversions working (if applicable)

### Documentation
- [ ] README.md updated
- [ ] BUILD.md reviewed
- [ ] Changelog updated (if applicable)
- [ ] Known issues documented

### Backup
- [ ] Backup of `.env` (in secure location)
- [ ] Backup of PM2 configuration
- [ ] Backup of important data

---

## 🆘 Troubleshooting

### Services won't start
```bash
# Check builds
ls backend/node/dist/server.js
ls frontend/dist/index.html

# Rebuild if necessary
pnpm build
```

### Ports in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Python venv not found
```bash
cd backend/python
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### PM2 doesn't persist after reboot
```bash
pm2 startup
pm2 save
```

---

## 📞 Support

- **Issues**: https://github.com/Shobon03/ts-ifc-api/issues
- **Documentation**: See BUILD.md and README.md
- **Logs**: `pm2 logs` for PM2, or console for development

---

**✅ Deploy complete when all items are checked!**
