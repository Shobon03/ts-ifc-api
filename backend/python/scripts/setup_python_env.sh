#!/bin/bash
# Script para configurar ambiente Python

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR_NAME="venv-python"
VENV_DIR="$BACKEND_DIR/$VENV_DIR_NAME"

echo "🐍 Setting up Python environment..."

# Criar venv se não existir
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Ativar venv
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Instalar/atualizar dependências
if [ -f "$BACKEND_DIR/requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r "$BACKEND_DIR/requirements.txt"
fi

echo "✅ Python environment ready!"
echo "Virtual environment location: $VENV_DIR"
echo "To activate manually, run: source $VENV_DIR_NAME/bin/activate"