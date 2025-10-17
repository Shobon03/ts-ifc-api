/*
 * Copyright (C) 2025 Matheus Piovezan Teixeira
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useWebSocketContext } from '../lib/websocket-context';
import { ConversionProgress } from './conversion-progress';
import { PluginStatusBar } from './plugin-status-indicator';

const ALLOWED_EXTENSIONS = ['.rvt', '.pln'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function IFCGeneration() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendMessage, isConnected } = useWebSocketContext();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setError(null);
      return;
    }

    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError(
        `Formato de arquivo inválido. Apenas arquivos ${ALLOWED_EXTENSIONS.join(', ')} são permitidos.`
      );
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Arquivo muito grande. O tamanho máximo é de 100MB.');
      setSelectedFile(null);
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];

    if (file) {
      const fakeEvent = {
        target: { files: [file] },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(fakeEvent);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Selecione um arquivo para converter.');
      return;
    }

    if (!isConnected) {
      setError('WebSocket não está conectado. Aguarde a conexão.');
      return;
    }

    try {
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      if (fileExtension === '.pln') {
        const base64Data = await convertFileToBase64(selectedFile);

        sendMessage({
          type: 'convert_archicad_to_ifc',
          file: base64Data,
          fileName: selectedFile.name,
          jobId,
        });
      } else if (fileExtension === '.rvt') {
        // Para Revit, primeiro fazemos upload via HTTP e depois enviamos mensagem WebSocket
        // Por enquanto, vamos apenas criar o job
        setError('Conversão de Revit para IFC ainda não implementada via WebSocket.');
        return;
      }

      setCurrentJobId(jobId);
      setError(null);
    } catch (err) {
      setError(`Erro ao processar arquivo: ${err}`);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setError(null);
    setCurrentJobId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Geração de IFC</h1>
        <p className="text-gray-600">
          Converta arquivos Revit (.rvt) ou Archicad (.pln) para o formato IFC padrão.
        </p>
      </div>

      <PluginStatusBar />

      {!currentJobId ? (
        <div className="space-y-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center transition-colors hover:border-gray-400 hover:bg-gray-100"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".rvt,.pln"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-4">
                <Upload className="h-12 w-12 text-gray-400" />
                <div>
                  <p className="text-lg font-semibold text-gray-700">
                    Clique para selecionar ou arraste um arquivo
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Formatos aceitos: .rvt, .pln (máx. 100MB)
                  </p>
                </div>
              </div>
            </label>
          </div>

          {selectedFile && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <FileText className="h-10 w-10 text-blue-500" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Erro</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile || !isConnected}
              className="flex-1 rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {isConnected ? 'Converter para IFC' : 'Aguardando conexão...'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Limpar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <ConversionProgress jobId={currentJobId} />
          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Nova Conversão
          </button>
        </div>
      )}
    </div>
  );
}
