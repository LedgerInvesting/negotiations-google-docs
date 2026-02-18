"use client";

import { useEffect, useRef, useState } from 'react';

export type DocumentEventType = 'created' | 'updated' | 'deleted';

export interface DocumentEvent {
  type: DocumentEventType;
  data: any;
}

export function useWebSocket(onMessage?: (event: DocumentEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
        
        ws.onopen = () => {
          console.log('[WS] Connected');
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as DocumentEvent;
            onMessage?.(message);
          } catch (error) {
            console.error('[WS] Failed to parse message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[WS] Error:', error);
        };

        ws.onclose = () => {
          console.log('[WS] Disconnected');
          setIsConnected(false);
          
          // Reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WS] Reconnecting...');
            connect();
          }, 3000);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('[WS] Connection error:', error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [onMessage]);

  return { isConnected };
}
