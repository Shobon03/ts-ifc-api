# 📋 Deploy Checklist

Use este checklist para garantir um deploy bem-sucedido do **ts-ifc-api**.

---

## ✅ Pré-Deploy

### Ambiente
- [ ] Node.js >= 18.0.0 instalado
- [ ] pnpm >= 8.0.0 instalado
- [ ] Python >= 3.8 instalado
- [ ] Git instalado

### Código
- [ ] Repositório clonado: `git clone https://github.com/Shobon03/ts-ifc-api.git`
- [ ] Na branch correta: `git checkout main`
- [ ] Código atualizado: `git pull origin main`

### Configuração
- [ ] Arquivo `.env` criado a partir de `.env.example`
- [ ] Variáveis de ambiente configuradas:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3000`
  - [ ] `FLASK_PORT=5000`
  - [ ] `CORS_ORIGINS` configurado
  - [ ] Portas dos plugins (8081, 8082)
  - [ ] `JOB_STORAGE_ROOT` definido

---

## 🔧 Setup

### Dependências
- [ ] Node.js dependencies instaladas: `pnpm install`
- [ ] Python venv criado: `cd backend/python && python -m venv venv`
- [ ] Python dependencies instaladas: `pip install -r requirements.txt`

**Ou use o script:**
- [ ] Windows: `scripts\setup.bat`
- [ ] Linux/Mac: `./scripts/setup.sh`

---

## 🔨 Build

### Compilação
- [ ] Build executado com sucesso
  - Windows: `scripts\build.bat`
  - Linux/Mac: `./scripts/build.sh`
  - pnpm: `pnpm build`

### Verificação do Build
- [ ] `backend/node/dist/server.js` existe
- [ ] `frontend/dist/index.html` existe
- [ ] `documentation/.vitepress/dist/index.html` existe
- [ ] Sem erros de TypeScript
- [ ] Sem erros de build do Vite

---

## 🚀 Execução

### Teste Local (Produção)
- [ ] Serviços iniciam sem erro:
  - Windows: `scripts\start.bat`
  - Linux/Mac: `./scripts/start.sh`
  - pnpm: `pnpm start`

### Health Checks
- [ ] Backend Node.js responde: `curl http://localhost:3000/health`
- [ ] Backend Python responde: `curl http://localhost:5000/health`
- [ ] Frontend acessível: http://localhost:3000
- [ ] API Docs acessível: http://localhost:3000/docs

### Funcionalidades
- [ ] Interface web carrega corretamente
- [ ] WebSocket conecta (console do navegador)
- [ ] Status dos plugins aparece (mesmo se desconectado)
- [ ] Upload de arquivo funciona
- [ ] Conversão funciona (se plugins instalados)
- [ ] Download de arquivo funciona

---

## 🔌 Plugins Desktop (Opcional)

Se estiver usando conversões Revit/Archicad:

### Revit Plugin
- [ ] Plugin instalado no Revit
- [ ] Revit aberto
- [ ] Plugin conectado (status: verde na interface)
- [ ] Logs Python mostram: `Revit plugin connected`

### Archicad Plugin
- [ ] Plugin instalado no Archicad
- [ ] Archicad aberto
- [ ] Plugin conectado (status: verde na interface)
- [ ] Logs Python mostram: `Archicad plugin connected`

---

## 🏭 Deploy Produção (PM2)

### PM2 Setup
- [ ] PM2 instalado globalmente: `npm install -g pm2`
- [ ] Arquivo `ecosystem.config.js` configurado
- [ ] Caminho do Python ajustado (Windows/Linux)

### PM2 Execução
- [ ] Serviços iniciados: `pm2 start ecosystem.config.js`
- [ ] Status verificado: `pm2 status`
- [ ] Logs verificados: `pm2 logs`
- [ ] Sem erros nos logs

### PM2 Persistência
- [ ] Startup configurado: `pm2 startup`
- [ ] Configuração salva: `pm2 save`
- [ ] Testado após reboot

---

## 🔒 Segurança

### Produção
- [ ] `NODE_ENV=production` configurado
- [ ] `FLASK_DEBUG=False` configurado
- [ ] CORS configurado corretamente (não usar `*` em produção)
- [ ] Secrets/API keys em variáveis de ambiente (não no código)
- [ ] `.env` no `.gitignore`

### Rede
- [ ] Firewall configurado
- [ ] Apenas portas necessárias expostas
- [ ] HTTPS configurado (se aplicável)
- [ ] Reverse proxy configurado (Nginx/Apache, se aplicável)

---

## �� Monitoramento

### Logs
- [ ] Logs sendo gerados corretamente
- [ ] Rotação de logs configurada
- [ ] Logs sem erros recorrentes

### Performance
- [ ] Uso de CPU aceitável (`pm2 monit`)
- [ ] Uso de memória aceitável (`pm2 monit`)
- [ ] Disco com espaço disponível
- [ ] Cleanup de jobs funcionando

---

## 🧹 Pós-Deploy

### Verificação Final
- [ ] Todas as funcionalidades testadas
- [ ] Documentação acessível
- [ ] API respondendo corretamente
- [ ] WebSocket funcionando
- [ ] Conversões funcionando (se aplicável)

### Documentação
- [ ] README.md atualizado
- [ ] BUILD.md revisado
- [ ] Changelog atualizado (se aplicável)
- [ ] Issues conhecidas documentadas

### Backup
- [ ] Backup do `.env` (em local seguro)
- [ ] Backup da configuração PM2
- [ ] Backup de dados importantes

---

## 🆘 Troubleshooting

### Serviços não iniciam
```bash
# Verificar builds
ls backend/node/dist/server.js
ls frontend/dist/index.html

# Rebuildar se necessário
pnpm build
```

### Portas em uso
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Python venv não encontrado
```bash
cd backend/python
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### PM2 não persiste após reboot
```bash
pm2 startup
pm2 save
```

---

## 📞 Suporte

- **Issues**: https://github.com/Shobon03/ts-ifc-api/issues
- **Documentação**: Veja BUILD.md e README.md
- **Logs**: `pm2 logs` para PM2, ou console para desenvolvimento

---

**✅ Deploy completo quando todos os itens estiverem marcados!**
