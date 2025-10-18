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

import { AlertCircle, ArrowRight, CheckSquare, FileText, Trash, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWebSocketContext } from '../lib/websocket-context';
import { JobStatus } from '../lib/websocket-types';
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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { jobs } = useWebSocketContext();

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

  // Monitorar o primeiro job (geração de IFC) para iniciar a segunda conversão
  useEffect(() => {
    if (currentJobIds.length === 0 || !ifcPath) return;

    const firstJobId = currentJobIds[0];
    const firstJob = jobs.get(firstJobId);

    if (!firstJob) return;

    // Se o primeiro job completou e temos um IFC path, iniciar a segunda conversão
    if (firstJob.status === JobStatus.COMPLETED && firstJob.result?.downloadUrl) {
      // Extrair o caminho do arquivo IFC do resultado
      const ifcFilePath = firstJob.result.downloadUrl;

      // Iniciar a segunda conversão para cada target
      conversionTargets.forEach(async (target) => {
        if (target) {
          await startSecondConversion(ifcFilePath, target);
        }
      });

      // Limpar ifcPath para não iniciar múltiplas vezes
      setIfcPath(null);
    }
  }, [jobs, currentJobIds, ifcPath, conversionTargets]);

  const startSecondConversion = async (ifcFilePath: string, target: ConversionTarget) => {
    try {
      const resultType = target === 'revit' ? 'rvt' : 'pln';

      const response = await fetch('http://localhost:3000/models/convert-from-ifc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: ifcFilePath,
          resultType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao iniciar segunda conversão');
      }

      const result = await response.json();

      // Adicionar o novo jobId à lista
      setCurrentJobIds((prev) => [...prev, result.jobId]);
    } catch (err) {
      setError(`Erro na segunda conversão: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Selecione um arquivo para converter.');
      return;
    }

    const extension = getFileExtension(selectedFile.name);

    if (extension === '.ifc' && conversionTargets.length === 0) {
      setError('Selecione pelo menos um formato de destino para conversão.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const jobIds: string[] = [];

      if (extension === '.rvt' || extension === '.pln') {
        // Passo 1: Converter para IFC via HTTP
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('type', 'ifc');

        const response = await fetch('http://localhost:3000/models/generate-ifc', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao iniciar conversão para IFC');
        }

        const result = await response.json();
        jobIds.push(result.jobId);

        // Se tiver targets de conversão, marcar que vamos aguardar o IFC
        if (conversionTargets.length > 0) {
          setIfcPath('pending'); // Marca que vamos aguardar o IFC
        }

      } else if (extension === '.ifc') {
        // Para arquivos IFC, fazer upload primeiro
        const formData = new FormData();
        formData.append('file', selectedFile);

        // TODO: Implementar endpoint de upload de IFC
        // Por enquanto, mostrar erro
        throw new Error('Upload direto de IFC ainda não implementado. Primeiro converta de RVT/PLN para IFC.');
      }

      setCurrentJobIds(jobIds);
      setError(null);
    } catch (err) {
      setError(`Erro ao processar arquivo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
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
              id={"file-upload"}
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
                  <div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-sm text-red-600 hover:underline cursor-pointer border border-red-600 rounded-md p-2 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all"
                    title="Remover arquivo"
                  >
                    <Trash className="inline h-5 w-5" />  
                  </button>
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
                      className={`flex flex-1 items-center justify-center gap-2 rounded-md border-2 px-4 py-3 font-semibold transition-all cursor-pointer ${
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
                      className={`flex flex-1 items-center justify-center gap-2 rounded-md border-2 px-4 py-3 font-semibold transition-all cursor-pointer ${
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
                isUploading ||
                (getFileExtension(selectedFile?.name || '') === '.ifc' &&
                  conversionTargets.length === 0)
              }
              className="flex-1 rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 cursor-pointer"
            >
              {isUploading ? 'Enviando...' : 'Converter Modelo'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
            >
              Limpar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {currentJobIds.map((jobId, index) => {
            // Verificar se todos os jobs foram completados
            const allJobsCompleted = currentJobIds.every(id => {
              const job = jobs.get(id);
              return job && job.status === JobStatus.COMPLETED;
            });

            // Apenas o último job em cadeia deve mostrar download quando tudo estiver completo
            // Ou qualquer job pode mostrar download se for o único (sem conversão em cadeia)
            const shouldShowDownload = allJobsCompleted || currentJobIds.length === 1;

            return (
              <ConversionProgress
                key={jobId}
                jobId={jobId}
                hideDownload={!shouldShowDownload}
              />
            );
          })}
          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          >
            Nova Conversão
          </button>
        </div>
      )}
    </div>
  );
}
