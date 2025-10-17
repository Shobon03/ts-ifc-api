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

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientMessage,
  ConversionJob,
  JobStatus,
  PluginStatus,
  PluginType,
  ServerMessage,
  WebSocketMessage,
} from './websocket-types';

export type {
  WebSocketMessage,
  ServerMessage,
  ClientMessage,
  ConversionJob,
  JobStatus,
  PluginType,
  PluginStatus,
};

export interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: ServerMessage) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  reconnectCount: number;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
}: UseWebSocketOptions) {
  const [state, setState] = useState<WebSocketState>({
    socket: null,
    isConnected: false,
    isReconnecting: false,
    error: null,
    reconnectCount: 0,
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>(null);
  const reconnectCountRef = useRef(0);
  const urlRef = useRef(url);
  const messageHandlersRef = useRef<
    Map<string, (message: ServerMessage) => void>
  >(new Map());

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const connect = useCallback(() => {
    try {
      setState((prev) => ({
        ...prev,
        isReconnecting: prev.reconnectCount > 0,
        error: null,
      }));

      const socket = new WebSocket(urlRef.current);

      socket.onopen = (event) => {
        console.log('[WebSocket] Connected to server');
        setState((prev) => ({
          ...prev,
          socket,
          isConnected: true,
          isReconnecting: false,
          error: null,
        }));
        reconnectCountRef.current = 0;
        onOpen?.(event);
      };

      socket.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message.type, message);

          onMessage?.(message);

          const handler = messageHandlersRef.current.get(message.type);
          if (handler) {
            handler(message);
          }

          if ('jobId' in message && message.jobId) {
            const jobHandler = messageHandlersRef.current.get(
              `job:${message.jobId}`,
            );
            if (jobHandler) {
              jobHandler(message);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      socket.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        setState((prev) => ({
          ...prev,
          socket: null,
          isConnected: false,
        }));

        onClose?.(event);

        if (!event.wasClean && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          setState((prev) => ({
            ...prev,
            isReconnecting: true,
            reconnectCount: reconnectCountRef.current,
          }));

          console.log(
            `[WebSocket] Reconnecting... Attempt ${reconnectCountRef.current}/${reconnectAttempts}`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectCountRef.current >= reconnectAttempts) {
          setState((prev) => ({
            ...prev,
            error: 'Maximum reconnection attempts reached',
          }));
        }
      };

      socket.onerror = (event) => {
        console.error('[WebSocket] Connection error:', event);
        setState((prev) => ({
          ...prev,
          error: 'WebSocket connection error',
        }));
        onError?.(event);
      };

      setState((prev) => ({ ...prev, socket }));
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setState((prev) => ({
        ...prev,
        error: `Failed to create WebSocket connection: ${error}`,
      }));
    }
  }, [
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectAttempts,
    reconnectInterval,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectCountRef.current = reconnectAttempts;
    state.socket?.close();
  }, [state.socket, reconnectAttempts]);

  const sendMessage = useCallback(
    (message: ClientMessage): boolean => {
      if (state.socket?.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] Sending message:', message.type, message);
        state.socket.send(JSON.stringify(message));
        return true;
      }
      console.warn('[WebSocket] Cannot send message, socket not open');
      return false;
    },
    [state.socket],
  );

  const on = useCallback(
    (type: string, handler: (message: ServerMessage) => void) => {
      messageHandlersRef.current.set(type, handler);
    },
    [],
  );

  const onJob = useCallback(
    (jobId: string, handler: (message: ServerMessage) => void) => {
      messageHandlersRef.current.set(`job:${jobId}`, handler);
    },
    [],
  );

  const off = useCallback((type: string) => {
    messageHandlersRef.current.delete(type);
  }, []);

  const offJob = useCallback((jobId: string) => {
    messageHandlersRef.current.delete(`job:${jobId}`);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      state.socket?.close();
    };
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    on,
    onJob,
    off,
    offJob,
  };
}
