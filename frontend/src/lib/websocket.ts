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

// Shared WebSocket instance across hook mounts (keeps connection during remounts/HMR)
let sharedSocket: WebSocket | null = null;

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
}: UseWebSocketOptions) {
  console.log('[useWebSocket] hook instantiated');
  const [state, setState] = useState<WebSocketState>({
    socket: null,
    isConnected: false,
    isReconnecting: false,
    error: null,
    reconnectCount: 0,
  });

  // Shared socket across hook instances - keeps connection alive across remounts/HMR
  // Note: module-level sharedSocket is defined below
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>(null);
  const reconnectCountRef = useRef(0);
  const urlRef = useRef(url);
  const messageHandlersRef = useRef<
    Map<string, (message: ServerMessage) => void>
  >(new Map());
  // Keep a per-hook ref that mirrors the shared socket
  const socketRef = useRef<WebSocket | null>(sharedSocket);
  const isMountedRef = useRef(true);
  const isConnectingRef = useRef(false);

  // Store handlers in refs to avoid recreating connect function
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const reconnectAttemptsRef = useRef(reconnectAttempts);
  const reconnectIntervalRef = useRef(reconnectInterval);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
    reconnectAttemptsRef.current = reconnectAttempts;
    reconnectIntervalRef.current = reconnectInterval;
  }, [onMessage, onOpen, onClose, onError, reconnectAttempts, reconnectInterval]);

  const connect = useCallback(() => {
    // Don't connect if component is unmounted, already connecting, or socket already open
    if (!isMountedRef.current || isConnectingRef.current) {
      console.log('[WebSocket] Skipping connect - already connecting or unmounted');
      return;
    }

    // if there's a shared socket, use it
    if (!socketRef.current && sharedSocket) {
      socketRef.current = sharedSocket;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN ||
        socketRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Skipping connect - socket already open/connecting');
      return;
    }

    isConnectingRef.current = true;

    try {
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close existing socket if any
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        isReconnecting: reconnectCountRef.current > 0,
        error: null,
      }));

      console.log(`[WebSocket] Connecting to ${urlRef.current}...`);
  const socket = new WebSocket(urlRef.current);
  socketRef.current = socket;
  // store globally so other mounts reuse the same socket
  sharedSocket = socket;

      socket.onopen = (event) => {
        isConnectingRef.current = false;
        if (!isMountedRef.current) return;

        console.log('[WebSocket] Connected to server');
        setState((prev) => ({
          ...prev,
          socket,
          isConnected: true,
          isReconnecting: false,
          error: null,
          reconnectCount: 0,
        }));
        reconnectCountRef.current = 0;
        onOpenRef.current?.(event);
      };

      socket.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const message: ServerMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message.type, message);

          onMessageRef.current?.(message);

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
        isConnectingRef.current = false;
        // mirror to shared socket
        if (sharedSocket === socketRef.current) {
          sharedSocket = null;
        }
        if (!isMountedRef.current) return;

        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        socketRef.current = null;

        setState((prev) => ({
          ...prev,
          socket: null,
          isConnected: false,
        }));

        onCloseRef.current?.(event);

        // Don't reconnect if it was a clean close or component unmounted
        if (event.code === 1000 || !isMountedRef.current) {
          return;
        }

        // Always try to reconnect if we haven't exceeded max attempts
        if (reconnectCountRef.current < reconnectAttemptsRef.current) {
          reconnectCountRef.current++;
          setState((prev) => ({
            ...prev,
            isReconnecting: true,
            reconnectCount: reconnectCountRef.current,
          }));

          console.log(
            `[WebSocket] Reconnecting... Attempt ${reconnectCountRef.current}/${reconnectAttemptsRef.current}`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, reconnectIntervalRef.current);
        } else {
          console.error('[WebSocket] Maximum reconnection attempts reached');
          setState((prev) => ({
            ...prev,
            error: 'Maximum reconnection attempts reached',
            isReconnecting: false,
          }));
        }
      };

      socket.onerror = (event) => {
        isConnectingRef.current = false;
        if (!isMountedRef.current) return;

        console.error('[WebSocket] Connection error:', event);
        setState((prev) => ({
          ...prev,
          error: 'WebSocket connection error',
        }));
        onErrorRef.current?.(event);
      };

      setState((prev) => ({ ...prev, socket }));
    } catch (error) {
      isConnectingRef.current = false;
      if (!isMountedRef.current) return;

      console.error('[WebSocket] Failed to create connection:', error);
      setState((prev) => ({
        ...prev,
        error: `Failed to create WebSocket connection: ${error}`,
      }));

      // Try to reconnect if we haven't exceeded max attempts
      if (reconnectCountRef.current < reconnectAttemptsRef.current) {
        reconnectCountRef.current++;
        setState((prev) => ({
          ...prev,
          isReconnecting: true,
          reconnectCount: reconnectCountRef.current,
        }));

        console.log(
          `[WebSocket] Reconnecting after error... Attempt ${reconnectCountRef.current}/${reconnectAttemptsRef.current}`,
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connect();
          }
        }, reconnectIntervalRef.current);
      }
    }
  }, []); // No dependencies - uses refs only

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectCountRef.current = reconnectAttempts;
    // close the shared socket only if this hook owns it
    if (state.socket) {
      try {
        state.socket.close();
      } finally {
        if (sharedSocket === state.socket) sharedSocket = null;
      }
    }
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

  // Initialize connection once on mount
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Prevent further reconnection attempts on this hook instance when it unmounts
      reconnectCountRef.current = reconnectAttempts;

      // Do not close the socket here. Leave it alive so that other
      // instances of the hook or StrictMode remounts can reuse it.
      // The connection will be closed explicitly via disconnect() or when leaving the page.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

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
