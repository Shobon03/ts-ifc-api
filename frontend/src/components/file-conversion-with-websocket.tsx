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

import { useState } from 'react';
import { useWebSocketContext } from '../lib/websocket-context';
import { ConversionProgress } from './conversion-progress';
import { WebSocketStatus } from './websocket-status';

interface ConversionResponse {
  jobId: string;
  message: string;
  websocketUrl: string;
}

export function FileConversionWithWebSocket() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const { isConnected, subscribeToJob } = useWebSocketContext();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setActiveJobId(null);
      setDownloadStarted(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !isConnected) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Enviar para a API de conversão IFC
      const response = await fetch(
        'http://localhost:3000/models/ifc/conversion',
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result: ConversionResponse = await response.json();

      // Subscrever ao job via WebSocket para monitoramento
      setActiveJobId(result.jobId);
      subscribeToJob(result.jobId);

      console.log('IFC Conversion started:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const isValidFile = (file: File) => {
    const validExtensions = ['.rvt', '.rfa', '.rte', '.rft'];
    const fileName = file.name.toLowerCase();
    return validExtensions.some((ext) => fileName.endsWith(ext));
  };

  const canUpload = file && isValidFile(file) && isConnected && !isUploading;

  const handleConversionCompleted = (
    result: { downloadUrl?: string; fileName?: string } | null,
  ) => {
    if (result && !downloadStarted) {
      setDownloadStarted(true);
      console.log('IFC Conversion completed:', result);
    }
  };

  return (
    <div className='max-w-2xl mx-auto p-6 space-y-6'>
      <div className='text-center'>
        <h2 className='text-2xl font-bold text-gray-900 mb-2'>
          Conversão de Arquivos com WebSocket
        </h2>
        <p className='text-gray-600'>
          Envie um arquivo Revit (.rvt, .rfa, .rte, .rft) e acompanhe o
          progresso em tempo real
        </p>
      </div>

      {/* WebSocket Status */}
      <div className='bg-white p-4 rounded-lg border shadow-sm'>
        <h3 className='font-semibold mb-2'>Status da Conexão</h3>
        <WebSocketStatus showDetails={true} />
        {!isConnected && (
          <p className='text-sm text-amber-600 mt-2'>
            ⚠️ WebSocket desconectado. A conversão pode ser iniciada, mas o
            progresso não será exibido em tempo real.
          </p>
        )}
      </div>

      {/* File Upload */}
      <div className='bg-white p-6 rounded-lg border shadow-sm'>
        <h3 className='font-semibold mb-4'>Upload de Arquivo</h3>

        <div className='space-y-4'>
          <div>
            <label
              htmlFor='file-input'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Selecionar arquivo Revit
            </label>
            <input
              id='file-input'
              type='file'
              onChange={handleFileChange}
              accept='.rvt,.rfa,.rte,.rft'
              className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
              disabled={isUploading}
            />
          </div>

          {file && (
            <div className='p-3 bg-gray-50 rounded-md'>
              <div className='text-sm'>
                <p>
                  <strong>Arquivo:</strong> {file.name}
                </p>
                <p>
                  <strong>Tamanho:</strong>{' '}
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <p>
                  <strong>Tipo:</strong>{' '}
                  {file.type || 'application/octet-stream'}
                </p>
                {!isValidFile(file) && (
                  <p className='text-red-600 mt-2'>
                    ⚠️ Tipo de arquivo não suportado. Selecione um arquivo .rvt,
                    .rfa, .rte ou .rft
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
              <p className='text-red-700 text-sm'>{error}</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!canUpload}
            className={`w-full py-3 px-4 rounded-md font-semibold transition-colors ${
              canUpload
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isUploading ? (
              <span className='flex items-center justify-center gap-2'>
                <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                Enviando...
              </span>
            ) : (
              'Iniciar Conversão'
            )}
          </button>
        </div>
      </div>

      {/* Conversion Progress */}
      {activeJobId && (
        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <h3 className='font-semibold mb-4'>Progresso da Conversão</h3>
          <ConversionProgress
            jobId={activeJobId}
            showDetails={true}
            autoDownload={true}
            onCompleted={handleConversionCompleted}
          />
        </div>
      )}

      {/* Instructions */}
      <div className='bg-blue-50 p-4 rounded-lg border border-blue-200'>
        <h3 className='font-semibold text-blue-900 mb-2'>Como usar:</h3>
        <ol className='text-sm text-blue-800 space-y-1 list-decimal list-inside'>
          <li>
            Certifique-se de que a conexão WebSocket está ativa (status verde)
          </li>
          <li>Selecione um arquivo Revit (.rvt, .rfa, .rte, .rft)</li>
          <li>Clique em "Iniciar Conversão" para enviar o arquivo</li>
          <li>Acompanhe o progresso em tempo real através do WebSocket</li>
          <li>O resultado da conversão será exibido quando completada</li>
        </ol>
      </div>
    </div>
  );
}
