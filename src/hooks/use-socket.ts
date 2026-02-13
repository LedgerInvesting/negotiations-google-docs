import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UserInfo {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

interface RoomUser extends UserInfo {
  cursor?: { x: number; y: number };
  selection?: { from: number; to: number };
}

interface UseSocketOptions {
  roomId: string;
  userInfo: UserInfo;
  onDocumentUpdate?: (content: string) => void;
  onUserJoined?: (user: UserInfo) => void;
  onUserLeft?: (userId: string) => void;
  onCursorUpdate?: (data: { userId: string; cursor: { x: number; y: number } }) => void;
  onSelectionUpdate?: (data: { userId: string; userName: string; userColor: string; selection: { from: number; to: number } }) => void;
  onRoomState?: (data: { users: RoomUser[]; content: string | null }) => void;
}

export const useSocket = ({
  roomId,
  userInfo,
  onDocumentUpdate,
  onUserJoined,
  onUserLeft,
  onCursorUpdate,
  onSelectionUpdate,
  onRoomState,
}: UseSocketOptions) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<RoomUser[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Create socket connection
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('✅ Socket connected:', socketInstance.id);
      setIsConnected(true);
      
      // Join the room
      socketInstance.emit('join-room', { roomId, userInfo });
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Room state event - initial state when joining
    socketInstance.on('room-state', (data: { users: RoomUser[]; content: string | null }) => {
      console.log('📋 Received room state:', data);
      setOnlineUsers(data.users);
      if (onRoomState) {
        onRoomState(data);
      }
    });

    // User joined event
    socketInstance.on('user-joined', (user: UserInfo) => {
      console.log('👤 User joined:', user);
      setOnlineUsers((prev) => [...prev, user]);
      if (onUserJoined) {
        onUserJoined(user);
      }
    });

    // User left event
    socketInstance.on('user-left', ({ userId }: { userId: string }) => {
      console.log('👋 User left:', userId);
      setOnlineUsers((prev) => prev.filter((u) => u.id !== userId));
      if (onUserLeft) {
        onUserLeft(userId);
      }
    });

    // Document update event
    socketInstance.on('document-update', ({ content }: { content: string }) => {
      console.log('📝 Document update received');
      if (onDocumentUpdate) {
        onDocumentUpdate(content);
      }
    });

    // Cursor update event
    socketInstance.on('cursor-update', (data: { userId: string; cursor: { x: number; y: number } }) => {
      if (onCursorUpdate) {
        onCursorUpdate(data);
      }
    });

    // Selection update event
    socketInstance.on('selection-update', (data: { userId: string; userName: string; userColor: string; selection: { from: number; to: number } }) => {
      console.log('📍 Received selection update:', data);
      if (onSelectionUpdate) {
        onSelectionUpdate(data);
      }
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('🧹 Cleaning up socket connection');
        socketRef.current.emit('leave-room', { roomId });
        socketRef.current.disconnect();
      }
    };
  }, [roomId, userInfo.id]); // Only recreate if roomId or userId changes

  // Emit document update
  const emitDocumentUpdate = useCallback((content: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('document-update', { roomId, content });
    }
  }, [roomId, isConnected]);

  // Emit cursor update
  const emitCursorUpdate = useCallback((cursor: { x: number; y: number }) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('cursor-update', { roomId, cursor });
    }
  }, [roomId, isConnected]);

  // Emit selection update
  const emitSelectionUpdate = useCallback((selection: { from: number; to: number }) => {
    if (socketRef.current && isConnected) {
      console.log('🚀 Emitting selection update:', { roomId, selection, userName: userInfo.name, userColor: userInfo.color });
      socketRef.current.emit('selection-update', { roomId, selection, userName: userInfo.name, userColor: userInfo.color });
    } else {
      console.warn('⚠️ Cannot emit selection: socket not connected', { isConnected, hasSocket: !!socketRef.current });
    }
  }, [roomId, isConnected, userInfo.name, userInfo.color]);

  return {
    socket,
    isConnected,
    onlineUsers,
    emitDocumentUpdate,
    emitCursorUpdate,
    emitSelectionUpdate,
  };
};
