# Scripts de Automação

Scripts para facilitar o build, setup e execução do **ts-ifc-api**.

## 📁 Arquivos

### Setup
- `setup.bat` / `setup.sh` - Configuração inicial do ambiente (dependências Node.js e Python)

### Build
- `build.bat` / `build.sh` - Build completo para produção (Node + Frontend + Docs)

### Execução (Produção)
- `start.bat` / `start.sh` - Inicia todos os serviços (Node + Python)
- `start-backend.bat` / `start-backend.sh` - Inicia apenas o backend Node.js
- `start-python.bat` / `start-python.sh` - Inicia apenas o backend Python

### Verificação
- `health-check.bat` / `health-check.sh` - Verifica se todos os serviços estão rodando

## 🚀 Uso Rápido

### Windows

```bash
# 1. Setup inicial (apenas na primeira vez)
scripts\setup.bat

# 2. Build para produção
scripts\build.bat

# 3. Executar em produção
scripts\start.bat
```

### Linux/Mac

```bash
# Dar permissão de execução (apenas na primeira vez)
chmod +x scripts/*.sh

# 1. Setup inicial
./scripts/setup.sh

# 2. Build para produção
./scripts/build.sh

# 3. Executar em produção
./scripts/start.sh
```

## 📝 Notas

- **Desenvolvimento**: Use `pnpm dev` em vez dos scripts de produção
- **Python**: Não precisa de build, mas precisa de virtual environment configurado
- **Frontend**: É servido pelo backend Node.js em produção (não precisa de servidor separado)

Para mais detalhes, consulte [BUILD.md](../BUILD.md).
