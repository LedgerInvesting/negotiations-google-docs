"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

export type DocumentEventType = 'created' | 'updated' | 'deleted';

export interface DocumentEvent {
  type: DocumentEventType;
  data: Record<string, unknown>;
}

export function useWebSocket(onMessage?: (event: DocumentEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  
  // Store the callback in a ref to avoid reconnecting when it changes
  const onMessageRef = useRef(onMessage);
  
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Don't attempt to connect if we're not in a browser
    if (typeof window === 'undefined') return;
    
    // Stop trying after max attempts
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('[WS] Max reconnection attempts reached. Stopping.');
      return;
    }

    try {
      // Build WebSocket URL: use NEXT_PUBLIC_WS_URL if set, otherwise derive from current page URL
      let wsUrl = process.env.NEXT_PUBLIC_WS_URL;
      if (!wsUrl) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}`;
      }
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as DocumentEvent;
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };

      ws.onerror = () => {
        console.warn('[WS] Connection error (this is normal if WebSocket server is not running)');
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected');
        setIsConnected(false);
        
        // Only attempt reconnection if it wasn't a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.warn('[WS] Failed to create WebSocket connection:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connect]);

  return { isConnected };
}
