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

import { createContext, useContext, useEffect, useState } from 'react';
import { useWebSocket } from './websocket';
import {
  type ClientMessage,
  type ConversionJob,
  JobStatus,
  PluginStatus,
  type PluginType,
  type ServerMessage,
} from './websocket-types';
import { translateBackendMessage, translatePluginStatus } from './i18n/translator';

interface WebSocketContextType {
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  reconnectCount: number;
  jobs: Map<string, ConversionJob>;
  pluginStatuses: Map<PluginType, PluginStatus>;
  sendMessage: (message: ClientMessage) => boolean;
  getJob: (jobId: string) => ConversionJob | undefined;
  cancelJob: (jobId: string) => void;
  listJobs: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  wsUrl?: string;
}

export function WebSocketProvider({
  children,
  wsUrl = 'ws://localhost:3000/models/ws/conversion',
}: WebSocketProviderProps) {
  useEffect(() => {
    console.log('[WebSocketProvider] mounted');
    return () => {
      console.log('[WebSocketProvider] unmounted');
    };
  }, []);

  const [jobs, setJobs] = useState<Map<string, ConversionJob>>(new Map());
  const [pluginStatuses, setPluginStatuses] = useState<
    Map<PluginType, PluginStatus>
  >(new Map());

  const handleMessage = (message: ServerMessage) => {
    console.log('[WebSocketContext] Message received:', message.type, message);

    switch (message.type) {
      case 'connection_ack':
        console.log(
          '[WebSocketContext] Connection acknowledged:',
          message.message,
        );
        break;

      case 'job_created':
        setJobs((prev) => {
          const updated = new Map(prev);
          updated.set(message.jobId, {
            jobId: message.jobId,
            status: message.status,
            progress: 0,
            message: translateBackendMessage(message.message),
            createdAt: message.timestamp,
          });
          return updated;
        });
        break;

      case 'progress_update':
        setJobs((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(message.jobId);
          if (existing) {
            updated.set(message.jobId, {
              ...existing,
              status: message.status,
              progress: message.progress,
              message: translateBackendMessage(message.message),
              details: message.details,
            });
          }
          return updated;
        });
        break;

      case 'job_completed':
        setJobs((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(message.jobId);
          if (existing) {
            updated.set(message.jobId, {
              ...existing,
              status: JobStatus.COMPLETED,
              progress: 100,
              message: translateBackendMessage(message.message),
              result: message.result,
              completedAt: message.timestamp,
            });
          }
          return updated;
        });
        break;

      case 'job_error':
        setJobs((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(message.jobId);
          if (existing) {
            updated.set(message.jobId, {
              ...existing,
              status: JobStatus.ERROR,
              progress: message.progress,
              message: translateBackendMessage(message.message),
              error: message.error,
            });
          }
          return updated;
        });
        break;

      case 'job_cancelled':
        setJobs((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(message.jobId);
          if (existing) {
            updated.set(message.jobId, {
              ...existing,
              status: JobStatus.CANCELLED,
              message: translateBackendMessage(message.message),
            });
          }
          return updated;
        });
        break;

      case 'job_status':
        setJobs((prev) => {
          const updated = new Map(prev);
          updated.set(message.jobId, {
            jobId: message.jobId,
            status: message.status,
            progress: message.progress,
            message: translateBackendMessage(message.message),
            fileName: message.fileName,
            createdAt: message.createdAt,
            completedAt: message.completedAt,
            result: message.result,
          });
          return updated;
        });
        break;

      case 'jobs_list':
        setJobs((prev) => {
          const updated = new Map(prev);
          for (const job of message.jobs) {
            updated.set(job.jobId, {
              jobId: job.jobId,
              status: job.status,
              progress: job.progress,
              fileName: job.fileName,
              createdAt: job.createdAt,
              completedAt: job.completedAt,
            });
          }
          return updated;
        });
        break;

      case 'plugin_status':
        console.log(
          `[WebSocketContext] Plugin ${message.plugin} is ${message.status}`,
        );
        setPluginStatuses((prev) => {
          const updated = new Map(prev);
          updated.set(message.plugin, translatePluginStatus(message.status) as PluginStatus);
          return updated;
        });
        break;

      case 'error':
        console.error('[WebSocketContext] Server error:', message.error);
        break;

      // Handlers para tipos do backend Node.js
      case 'progress':
        // Mesmo que progress_update
        if ((message as any).jobId) {
          setJobs((prev) => {
            const updated = new Map(prev);
            const jobId = (message as any).jobId;
            const existing = updated.get(jobId);

            const rawMessage = (message as any).message || '';
            const jobData = {
              jobId,
              status: (message as any).status || JobStatus.PROCESSING,
              progress: (message as any).progress || 0,
              message: translateBackendMessage(rawMessage),
              details: (message as any).details,
              error: (message as any).error,
              result: (message as any).result,
            };

            if (existing) {
              updated.set(jobId, { ...existing, ...jobData });
            } else {
              updated.set(jobId, jobData as ConversionJob);
            }
            return updated;
          });
        }
        break;

      case 'status':
        // Status inicial do job
        if ((message as any).jobId) {
          setJobs((prev) => {
            const updated = new Map(prev);
            const jobId = (message as any).jobId;

            const rawMessage = (message as any).message || '';
            updated.set(jobId, {
              jobId,
              status: (message as any).status || JobStatus.QUEUED,
              progress: (message as any).progress || 0,
              message: translateBackendMessage(rawMessage),
              fileName: (message as any).fileName,
              createdAt: (message as any).startTime,
              completedAt: (message as any).endTime,
            });
            return updated;
          });
        }
        break;

      case 'subscribed':
        // Confirmação de inscrição no job
        console.log(
          '[WebSocketContext] Subscribed to job:',
          (message as any).jobId,
        );
        break;

      default:
        console.log('[WebSocketContext] Unknown message type:', message.type);
    }
  };

  const websocket = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onOpen: () =>
      console.log('[WebSocketContext] Connected to WebSocket server'),
    onClose: (event) =>
      console.log(
        '[WebSocketContext] Disconnected from WebSocket server:',
        event.code,
      ),
    onError: (event) =>
      console.error('[WebSocketContext] WebSocket error:', event),
    reconnectAttempts: 5,
    reconnectInterval: 3000,
  });

  const getJob = (jobId: string): ConversionJob | undefined => {
    return jobs.get(jobId);
  };

  const cancelJob = (jobId: string) => {
    websocket.sendMessage({
      type: 'cancel_job',
      jobId,
    });
  };

  const listJobs = () => {
    websocket.sendMessage({
      type: 'list_jobs',
    });
  };

  const contextValue: WebSocketContextType = {
    isConnected: websocket.isConnected,
    isReconnecting: websocket.isReconnecting,
    error: websocket.error,
    reconnectCount: websocket.reconnectCount,
    jobs,
    pluginStatuses,
    sendMessage: websocket.sendMessage,
    getJob,
    cancelJob,
    listJobs,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      'useWebSocketContext must be used within a WebSocketProvider',
    );
  }
  return context;
}

export function useConversionJob(jobId: string | null) {
  const { jobs, isConnected } = useWebSocketContext();

  if (!jobId) {
    return null;
  }

  return jobs.get(jobId) || null;
}

export function usePluginStatus(plugin: PluginType) {
  const { pluginStatuses } = useWebSocketContext();
  return pluginStatuses.get(plugin) || PluginStatus.DISCONNECTED;
}
