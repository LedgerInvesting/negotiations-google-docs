// WebSocket event broadcasting utilities
// This will be used by the WebSocket server

type DocumentEventType = 'created' | 'updated' | 'deleted';

interface DocumentEvent {
  type: DocumentEventType;
  data: unknown;
}

export function broadcastDocumentUpdate(type: DocumentEventType, data: unknown) {
  // Access global WebSocket server (set by server.js)
  const wsServer = (global as { wsServer?: { clients?: Set<{ readyState: number; send: (data: string) => void }> } }).wsServer;
  
  if (!wsServer) {
    console.warn('[WS] WebSocket server not initialized');
    return;
  }

  const event: DocumentEvent = { type, data };
  
  // Broadcast to all connected clients
  wsServer.clients?.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(JSON.stringify(event));
      } catch (error) {
        console.error('[WS] Error sending message:', error);
      }
    }
  });
}
