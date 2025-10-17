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
import { Upload, FileText, AlertCircle, ArrowRight, CheckSquare } from 'lucide-react';
import { useWebSocketContext } from '../lib/websocket-context';
import { ConversionProgress } from './conversion-progress';
import { PluginStatusBar } from './plugin-status-indicator';

const ALLOWED_EXTENSIONS = ['.rvt', '.pln', '.ifc'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

type ConversionTarget = 'revit' | 'archicad' | null;

export function ModelTransformation() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentJobIds, setCurrentJobIds] = useState<string[]>([]);
  const [conversionTargets, setConversionTargets] = useState<ConversionTarget[]>([]);
  const [ifcPath, setIfcPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendMessage, isConnected } = useWebSocketContext();

  const getFileExtension = (fileName: string): string => {
    return fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setError(null);
      setConversionTargets([]);
      return;
    }

    const extension = getFileExtension(file.name);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError(
        `Formato de arquivo inválido. Apenas arquivos ${ALLOWED_EXTENSIONS.join(', ')} são permitidos.`
      );
      setSelectedFile(null);
      setConversionTargets([]);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Arquivo muito grande. O tamanho máximo é de 100MB.');
      setSelectedFile(null);
      setConversionTargets([]);
      return;
    }

    setError(null);
    setSelectedFile(file);

    if (extension === '.ifc') {
      setConversionTargets([]);
    } else if (extension === '.rvt') {
      setConversionTargets(['archicad']);
    } else if (extension === '.pln') {
      setConversionTargets(['revit']);
    }
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

  const toggleConversionTarget = (target: ConversionTarget) => {
    if (!target) return;

    setConversionTargets((prev) => {
      if (prev.includes(target)) {
        return prev.filter((t) => t !== target);
      }
      return [...prev, target];
    });
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

    const extension = getFileExtension(selectedFile.name);

    if (extension === '.ifc' && conversionTargets.length === 0) {
      setError('Selecione pelo menos um formato de destino para conversão.');
      return;
    }

    try {
      const jobIds: string[] = [];

      if (extension === '.rvt') {
        // RVT -> IFC -> PLN
        const ifcJobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        setError('Conversão de Revit para IFC e Archicad ainda não implementada via WebSocket.');
        return;

      } else if (extension === '.pln') {
        // PLN -> IFC
        const ifcJobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const base64Data = await convertFileToBase64(selectedFile);

        sendMessage({
          type: 'convert_archicad_to_ifc',
          file: base64Data,
          fileName: selectedFile.name,
          jobId: ifcJobId,
        });

        jobIds.push(ifcJobId);

        // Se o usuário quer converter para Revit, aguardaremos o IFC ser gerado
        if (conversionTargets.includes('revit')) {
          // TODO: Implementar conversão IFC -> RVT após primeira conversão completar
          setError('Conversão para Revit será implementada quando o IFC estiver pronto.');
        }

      } else if (extension === '.ifc') {
        // IFC -> RVT e/ou PLN
        // Para arquivos IFC, precisamos do caminho no servidor
        // Por enquanto, vamos assumir que o arquivo já foi enviado
        const serverIfcPath = `/uploads/${selectedFile.name}`;

        for (const target of conversionTargets) {
          const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

          if (target === 'revit') {
            sendMessage({
              type: 'convert_ifc_to_revit',
              ifcPath: serverIfcPath,
              jobId,
            });
            jobIds.push(jobId);
          } else if (target === 'archicad') {
            sendMessage({
              type: 'convert_ifc_to_archicad',
              ifcPath: serverIfcPath,
              jobId,
            });
            jobIds.push(jobId);
          }
        }
      }

      setCurrentJobIds(jobIds);
      setError(null);
    } catch (err) {
      setError(`Erro ao processar arquivo: ${err}`);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setError(null);
    setCurrentJobIds([]);
    setConversionTargets([]);
    setIfcPath(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getConversionDescription = (): string => {
    if (!selectedFile) return '';

    const extension = getFileExtension(selectedFile.name);
    const sourceFormat = extension.substring(1).toUpperCase();

    if (extension === '.ifc') {
      if (conversionTargets.length === 0) {
        return 'Selecione o formato de destino';
      }
      const targets = conversionTargets.map((t) => (t === 'revit' ? 'Revit' : 'Archicad')).join(' e ');
      return `IFC → ${targets}`;
    } else if (extension === '.rvt') {
      return 'Revit → IFC → Archicad';
    } else if (extension === '.pln') {
      return conversionTargets.includes('revit')
        ? 'Archicad → IFC → Revit'
        : 'Archicad → IFC';
    }

    return '';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Transformação de Modelo</h1>
        <p className="text-gray-600">
          Converta arquivos entre os formatos Revit (.rvt), Archicad (.pln) e IFC (.ifc).
        </p>
      </div>

      <PluginStatusBar />

      {currentJobIds.length === 0 ? (
        <div className="space-y-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center transition-colors hover:border-gray-400 hover:bg-gray-100"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".rvt,.pln,.ifc"
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
                    Formatos aceitos: .rvt, .pln, .ifc (máx. 100MB)
                  </p>
                </div>
              </div>
            </label>
          </div>

          {selectedFile && (
            <>
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

              {getFileExtension(selectedFile.name) === '.ifc' && (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900">Selecione o formato de destino:</h3>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => toggleConversionTarget('revit')}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-md border-2 px-4 py-3 font-semibold transition-all ${
                        conversionTargets.includes('revit')
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {conversionTargets.includes('revit') && (
                        <CheckSquare className="h-5 w-5" />
                      )}
                      Revit (.rvt)
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleConversionTarget('archicad')}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-md border-2 px-4 py-3 font-semibold transition-all ${
                        conversionTargets.includes('archicad')
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {conversionTargets.includes('archicad') && (
                        <CheckSquare className="h-5 w-5" />
                      )}
                      Archicad (.pln)
                    </button>
                  </div>
                </div>
              )}

              {getConversionDescription() && (
                <div className="flex items-center justify-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <ArrowRight className="h-5 w-5 text-blue-600" />
                  <p className="font-semibold text-blue-900">{getConversionDescription()}</p>
                </div>
              )}
            </>
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
              disabled={
                !selectedFile ||
                !isConnected ||
                (getFileExtension(selectedFile?.name || '') === '.ifc' &&
                  conversionTargets.length === 0)
              }
              className="flex-1 rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {isConnected ? 'Converter Modelo' : 'Aguardando conexão...'}
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
          {currentJobIds.map((jobId) => (
            <ConversionProgress key={jobId} jobId={jobId} />
          ))}
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
