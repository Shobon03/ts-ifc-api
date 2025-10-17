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
import type { ConversionRequest } from '../lib/websocket';
import { useWebSocketContext } from '../lib/websocket-context';
import { ConversionProgress } from './conversion-progress';
import { WebSocketStatus } from './websocket-status';

export function IFCConversionWebSocket() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversionOptions, setConversionOptions] = useState<
    ConversionRequest['options']
  >({
    outputFormat: 'ifc',
    quality: 'medium',
    includeGeometry: true,
    includeProperties: true,
  });

  const { isConnected, convertToIFC } = useWebSocketContext();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setActiveJobId(null); // Reset previous conversion
    }
  };

  const handleConversion = async () => {
    if (!file || !isConnected) return;

    setIsConverting(true);
    setError(null);

    try {
      const jobId = await convertToIFC(file, conversionOptions);
      setActiveJobId(jobId);
      console.log('Conversion started:', jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
      console.error('Conversion error:', err);
    } finally {
      setIsConverting(false);
    }
  };

  const isValidFile = (file: File) => {
    const validExtensions = ['.rvt', '.rfa', '.rte', '.rft', '.dwg', '.dxf'];
    const fileName = file.name.toLowerCase();
    return validExtensions.some((ext) => fileName.endsWith(ext));
  };

  const canConvert = file && isValidFile(file) && isConnected && !isConverting;

  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold text-gray-900 mb-2'>
          Conversão para IFC via WebSocket
        </h2>
        <p className='text-gray-600'>
          Converta arquivos Revit, AutoCAD e outros formatos para IFC em tempo
          real
        </p>
      </div>

      {/* WebSocket Status */}
      <div className='bg-white p-4 rounded-lg border shadow-sm'>
        <h3 className='font-semibold mb-2'>Status da Conexão WebSocket</h3>
        <WebSocketStatus showDetails={true} />
        {!isConnected && (
          <p className='text-sm text-amber-600 mt-2'>
            ⚠️ WebSocket desconectado. Aguarde a reconexão para realizar
            conversões.
          </p>
        )}
      </div>

      {/* File Selection */}
      <div className='bg-white p-6 rounded-lg border shadow-sm'>
        <h3 className='font-semibold mb-4'>Seleção de Arquivo</h3>

        <div className='space-y-4'>
          <div>
            <label
              htmlFor='file-input'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Selecionar arquivo para conversão
            </label>
            <input
              id='file-input'
              type='file'
              onChange={handleFileChange}
              accept='.rvt,.rfa,.rte,.rft,.dwg,.dxf'
              className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
              disabled={isConverting}
            />
            <p className='text-xs text-gray-500 mt-1'>
              Formatos suportados: .rvt, .rfa, .rte, .rft, .dwg, .dxf
            </p>
          </div>

          {file && (
            <div className='p-4 bg-gray-50 rounded-md'>
              <div className='text-sm space-y-1'>
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
                    ⚠️ Tipo de arquivo não suportado
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversion Options */}
      <div className='bg-white p-6 rounded-lg border shadow-sm'>
        <h3 className='font-semibold mb-4'>Opções de Conversão</h3>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Formato de Saída
            </label>
            <select
              value={conversionOptions.outputFormat}
              onChange={(e) =>
                setConversionOptions((prev) => ({
                  ...prev,
                  outputFormat: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              disabled={isConverting}
            >
              <option value='ifc'>IFC (.ifc)</option>
              <option value='ifc4'>IFC4 (.ifc)</option>
              <option value='step'>STEP (.stp)</option>
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Qualidade
            </label>
            <select
              value={conversionOptions.quality}
              onChange={(e) =>
                setConversionOptions((prev) => ({
                  ...prev,
                  quality: e.target.value as 'low' | 'medium' | 'high',
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              disabled={isConverting}
            >
              <option value='low'>Baixa (rápida)</option>
              <option value='medium'>Média (balanceada)</option>
              <option value='high'>Alta (detalhada)</option>
            </select>
          </div>

          <div className='flex items-center'>
            <input
              id='include-geometry'
              type='checkbox'
              checked={conversionOptions.includeGeometry}
              onChange={(e) =>
                setConversionOptions((prev) => ({
                  ...prev,
                  includeGeometry: e.target.checked,
                }))
              }
              className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
              disabled={isConverting}
            />
            <label
              htmlFor='include-geometry'
              className='ml-2 block text-sm text-gray-700'
            >
              Incluir geometria
            </label>
          </div>

          <div className='flex items-center'>
            <input
              id='include-properties'
              type='checkbox'
              checked={conversionOptions.includeProperties}
              onChange={(e) =>
                setConversionOptions((prev) => ({
                  ...prev,
                  includeProperties: e.target.checked,
                }))
              }
              className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
              disabled={isConverting}
            />
            <label
              htmlFor='include-properties'
              className='ml-2 block text-sm text-gray-700'
            >
              Incluir propriedades
            </label>
          </div>
        </div>
      </div>

      {/* Conversion Button */}
      <div className='bg-white p-6 rounded-lg border shadow-sm'>
        {error && (
          <div className='p-3 bg-red-50 border border-red-200 rounded-md mb-4'>
            <p className='text-red-700 text-sm'>{error}</p>
          </div>
        )}

        <button
          onClick={handleConversion}
          disabled={!canConvert}
          className={`w-full py-3 px-4 rounded-md font-semibold transition-colors ${
            canConvert
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isConverting ? (
            <span className='flex items-center justify-center gap-2'>
              <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
              Iniciando conversão...
            </span>
          ) : (
            'Converter para IFC via WebSocket'
          )}
        </button>
      </div>

      {/* Conversion Progress */}
      {activeJobId && (
        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <h3 className='font-semibold mb-4'>Progresso da Conversão</h3>
          <ConversionProgress jobId={activeJobId} showDetails={true} />
        </div>
      )}

      {/* Info Section */}
      <div className='bg-blue-50 p-6 rounded-lg border border-blue-200'>
        <h3 className='font-semibold text-blue-900 mb-3'>
          Sobre a Conversão via WebSocket
        </h3>
        <div className='text-sm text-blue-800 space-y-2'>
          <p>
            • <strong>Tempo real:</strong> Todo o processo acontece via
            WebSocket, permitindo acompanhar o progresso em tempo real
          </p>
          <p>
            • <strong>Eficiência:</strong> Os arquivos são enviados diretamente
            pelo WebSocket sem necessidade de upload separado
          </p>
          <p>
            • <strong>Flexibilidade:</strong> Diferentes opções de qualidade e
            formato de saída
          </p>
          <p>
            • <strong>Transparência:</strong> Acompanhe cada etapa do processo
            de conversão
          </p>
        </div>
      </div>
    </div>
  );
}
