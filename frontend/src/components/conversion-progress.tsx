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

import { useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useConversionJob, useWebSocketContext } from '../lib/websocket-context';
import { JobStatus } from '../lib/websocket-types';

interface ConversionProgressProps {
  jobId: string | null;
  onDownload?: (url: string, fileName: string) => void;
}

export function ConversionProgress({
  jobId,
  onDownload,
}: ConversionProgressProps) {
  const job = useConversionJob(jobId);
  const { sendMessage, isConnected } = useWebSocketContext();

  // Inscrever no job quando o componente montar
  useEffect(() => {
    if (jobId && isConnected) {
      console.log('[ConversionProgress] Subscribing to job:', jobId);
      sendMessage({
        type: 'subscribe',
        jobId,
      });
    }
  }, [jobId, isConnected, sendMessage]);

  if (!jobId) {
    return null;
  }

  // Mostrar loading enquanto aguarda os primeiros dados do job
  if (!job) {
    return (
      <div className='w-full space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Loader2 className='h-6 w-6 text-blue-500 animate-spin' />
            <div>
              <h3 className='font-semibold text-gray-900'>Aguardando...</h3>
              <p className='text-sm text-gray-600'>Conectando ao job...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (job.status) {
      case JobStatus.COMPLETED:
        return <CheckCircle2 className='h-6 w-6 text-green-500' />;
      case JobStatus.ERROR:
        return <XCircle className='h-6 w-6 text-red-500' />;
      case JobStatus.CANCELLED:
        return <AlertCircle className='h-6 w-6 text-yellow-500' />;
      default:
        return <Loader2 className='h-6 w-6 text-blue-500 animate-spin' />;
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case JobStatus.COMPLETED:
        return 'bg-green-500';
      case JobStatus.ERROR:
        return 'bg-red-500';
      case JobStatus.CANCELLED:
        return 'bg-yellow-500';
      case JobStatus.UPLOADING:
        return 'bg-blue-500';
      case JobStatus.PROCESSING:
        return 'bg-purple-500';
      case JobStatus.DOWNLOADING:
        return 'bg-indigo-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case JobStatus.QUEUED:
        return 'Na fila';
      case JobStatus.UPLOADING:
        return 'Enviando arquivo';
      case JobStatus.PROCESSING:
        return 'Processando';
      case JobStatus.DOWNLOADING:
        return 'Preparando download';
      case JobStatus.COMPLETED:
        return 'Concluído';
      case JobStatus.ERROR:
        return 'Erro';
      case JobStatus.CANCELLED:
        return 'Cancelado';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <div className='w-full space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          {getStatusIcon()}
          <div>
            <h3 className='font-semibold text-gray-900'>{getStatusText()}</h3>
            {job.message && (
              <p className='text-sm text-gray-600'>{job.message}</p>
            )}
          </div>
        </div>
        <div className='text-right'>
          <span className='text-2xl font-bold text-gray-900'>
            {job.progress}%
          </span>
        </div>
      </div>

      <div className='relative h-3 w-full overflow-hidden rounded-full bg-gray-200'>
        <div
          className={`h-full transition-all duration-300 ease-out ${getStatusColor()}`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {job.details?.currentStep && (
        <div className='text-sm text-gray-600'>
          <span className='font-medium'>Etapa atual:</span>{' '}
          {job.details.currentStep}
        </div>
      )}

      {job.details?.plugin && (
        <div className='text-sm text-gray-600'>
          <span className='font-medium'>Plugin:</span>{' '}
          {job.details.plugin === 'revit' ? 'Revit' : 'Archicad'}
        </div>
      )}

      {job.error && (
        <div className='rounded-md bg-red-50 p-4'>
          <div className='flex'>
            <XCircle className='h-5 w-5 text-red-400' />
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-red-800'>
                Erro na conversão
              </h3>
              <div className='mt-2 text-sm text-red-700'>
                <p>{job.error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {job.status === JobStatus.COMPLETED && job.result && (
        <div className='rounded-md bg-green-50 p-4'>
          <div className='flex items-start'>
            <CheckCircle2 className='h-5 w-5 text-green-400' />
            <div className='ml-3 flex-1'>
              <h3 className='text-sm font-medium text-green-800'>
                Conversão concluída!
              </h3>
              <div className='mt-2 text-sm text-green-700'>
                <p>
                  Arquivo:{' '}
                  <span className='font-medium'>{job.result.fileName}</span>
                </p>
                <p>
                  Tamanho:{' '}
                  <span className='font-medium'>
                    {formatFileSize(job.result.fileSize)}
                  </span>
                </p>
              </div>
              <div className='mt-4'>
                <button
                  type='button'
                  onClick={() => {
                    const downloadUrl = job.result!.downloadUrl;
                    const fullUrl = downloadUrl.startsWith('http')
                      ? downloadUrl
                      : `${window.location.origin}${downloadUrl}`;

                    if (onDownload) {
                      onDownload(fullUrl, job.result!.fileName);
                    } else {
                      // Create a temporary link element to trigger download
                      const link = document.createElement('a');
                      link.href = fullUrl;
                      link.download = job.result!.fileName || 'download';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                  className='inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
                >
                  <Download className='h-4 w-4' />
                  Fazer download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {job.createdAt && (
        <div className='text-xs text-gray-500'>
          Iniciado em: {new Date(job.createdAt).toLocaleString('pt-BR')}
        </div>
      )}

      {job.completedAt && (
        <div className='text-xs text-gray-500'>
          Concluído em: {new Date(job.completedAt).toLocaleString('pt-BR')}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}
