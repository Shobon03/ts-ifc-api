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

export function WebSocketDemo() {
  const [jobId, setJobId] = useState('');
  const [testJobId, setTestJobId] = useState('');
  const { conversionJobs, subscribeToJob, sendMessage, isConnected } =
    useWebSocketContext();

  const handleSubscribe = () => {
    if (jobId.trim() && isConnected) {
      const success = subscribeToJob(jobId.trim());
      if (success) {
        setTestJobId(jobId.trim());
        console.log(`Subscribed to job: ${jobId.trim()}`);
      }
    }
  };

  const handlePing = () => {
    if (isConnected) {
      sendMessage({ type: 'ping' });
      console.log('Ping sent');
    }
  };

  const handleSendCustomMessage = () => {
    if (isConnected) {
      sendMessage({
        type: 'custom',
        data: {
          timestamp: new Date().toISOString(),
          message: 'Hello from frontend!',
        },
      });
      console.log('Custom message sent');
    }
  };

  return (
    <div className='p-6 max-w-4xl mx-auto space-y-6'>
      <h1 className='text-2xl font-bold text-gray-900'>WebSocket Demo</h1>

      {/* Connection Status */}
      <div className='bg-white p-4 rounded-lg border shadow-sm'>
        <h2 className='text-lg font-semibold mb-3'>Connection Status</h2>
        <WebSocketStatus showDetails={true} />
      </div>

      {/* Controls */}
      <div className='bg-white p-4 rounded-lg border shadow-sm'>
        <h2 className='text-lg font-semibold mb-3'>Controls</h2>
        <div className='space-y-4'>
          {/* Subscribe to Job */}
          <div className='flex gap-2'>
            <input
              type='text'
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              placeholder='Enter Job ID to monitor'
              className='flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <button
              type='button'
              onClick={handleSubscribe}
              disabled={!isConnected || !jobId.trim()}
              className='px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
            >
              Subscribe
            </button>
          </div>

          {/* Test Buttons */}
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={handlePing}
              disabled={!isConnected}
              className='px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
            >
              Send Ping
            </button>
            <button
              type='button'
              onClick={handleSendCustomMessage}
              disabled={!isConnected}
              className='px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
            >
              Send Custom Message
            </button>
          </div>
        </div>
      </div>

      {/* Active Job Progress */}
      {testJobId && (
        <div className='bg-white p-4 rounded-lg border shadow-sm'>
          <h2 className='text-lg font-semibold mb-3'>Active Job Progress</h2>
          <ConversionProgress jobId={testJobId} showDetails={true} />
        </div>
      )}

      {/* All Conversion Jobs */}
      {conversionJobs.size > 0 && (
        <div className='bg-white p-4 rounded-lg border shadow-sm'>
          <h2 className='text-lg font-semibold mb-3'>All Conversion Jobs</h2>
          <div className='space-y-3'>
            {Array.from(conversionJobs.entries()).map(([jobId, progress]) => (
              <div key={jobId} className='border-l-4 border-blue-200 pl-4'>
                <div className='flex items-center justify-between mb-2'>
                  <span className='font-mono text-sm text-gray-600'>
                    {jobId}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      progress.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : progress.status === 'error'
                          ? 'bg-red-100 text-red-800'
                          : progress.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {progress.status}
                  </span>
                </div>
                <div className='text-sm text-gray-600'>
                  Progress: {Math.round(progress.progress)}%
                  {progress.message && (
                    <span className='ml-2'>• {progress.message}</span>
                  )}
                </div>
                {progress.error && (
                  <div className='text-sm text-red-600 mt-1'>
                    Error: {progress.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className='bg-blue-50 p-4 rounded-lg border border-blue-200'>
        <h2 className='text-lg font-semibold mb-3 text-blue-900'>Como usar</h2>
        <div className='text-sm text-blue-800 space-y-2'>
          <p>
            1. A conexão WebSocket é estabelecida automaticamente com a API em{' '}
            <code>ws://localhost:3000/models/ws/conversion</code>
          </p>
          <p>
            2. Digite um Job ID para monitorar o progresso de uma conversão
            específica
          </p>
          <p>3. Use "Send Ping" para testar a conexão (deve retornar "pong")</p>
          <p>
            4. O componente mostra automaticamente o progresso de todas as
            conversões ativas
          </p>
          <p>5. A conexão se reconecta automaticamente em caso de falha</p>
        </div>
      </div>
    </div>
  );
}
