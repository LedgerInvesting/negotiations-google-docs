import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';

interface UserInfo {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

interface RoomUser extends UserInfo {
  cursor?: { x: number; y: number };
}

interface DocumentRooms {
  [roomId: string]: {
    users: Map<string, RoomUser>;
    content: string | null;
  };
}

const rooms: DocumentRooms = {};

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Join a document room
    socket.on('join-room', async ({ roomId, userInfo }: { roomId: string; userInfo: UserInfo }) => {
      try {
        // Initialize room if it doesn't exist
        if (!rooms[roomId]) {
          rooms[roomId] = {
            users: new Map(),
            content: null,
          };
        }

        // Add user to room
        rooms[roomId].users.set(socket.id, userInfo);
        socket.join(roomId);

        // Send current room state to the new user
        socket.emit('room-state', {
          users: Array.from(rooms[roomId].users.values()),
          content: rooms[roomId].content,
        });

        // Notify others in the room
        socket.to(roomId).emit('user-joined', userInfo);

        console.log(`User ${userInfo.name} joined room ${roomId}`);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle document updates
    socket.on('document-update', ({ roomId, content }: { roomId: string; content: string }) => {
      if (rooms[roomId]) {
        rooms[roomId].content = content;
        // Broadcast to all other users in the room
        socket.to(roomId).emit('document-update', { content });
      }
    });

    // Handle cursor position updates
    socket.on('cursor-update', ({ roomId, cursor }: { roomId: string; cursor: { x: number; y: number } }) => {
      if (rooms[roomId] && rooms[roomId].users.has(socket.id)) {
        const user = rooms[roomId].users.get(socket.id)!;
        user.cursor = cursor;
        
        // Broadcast cursor position to others
        socket.to(roomId).emit('cursor-update', {
          userId: user.id,
          cursor,
        });
      }
    });

    // Handle selection updates (cursor position)
    socket.on('selection-update', ({ roomId, selection, userName, userColor }: { 
      roomId: string; 
      selection: { from: number; to: number };
      userName: string;
      userColor: string;
    }) => {
      if (rooms[roomId] && rooms[roomId].users.has(socket.id)) {
        const user = rooms[roomId].users.get(socket.id)!;
        
        // Broadcast selection position to others with user info
        socket.to(roomId).emit('selection-update', {
          userId: user.id,
          userName,
          userColor,
          selection,
        });
      }
    });

    // Handle awareness updates (selection, focus, etc.)
    socket.on('awareness-update', ({ roomId, awareness }: { roomId: string; awareness: unknown }) => {
      socket.to(roomId).emit('awareness-update', {
        socketId: socket.id,
        awareness,
      });
    });

    // Handle comment creation
    socket.on('comment:create', ({ roomId, comment }: { 
      roomId: string; 
      comment: {
        id: string;
        text: string;
        author: string;
        timestamp: string;
      }
    }) => {
      // Broadcast new comment to all users in the room
      io.in(roomId).emit('comment:created', { comment });
      console.log(`Comment created in room ${roomId}:`, comment.id);
    });

    // Handle comment deletion
    socket.on('comment:delete', ({ roomId, commentId }: { roomId: string; commentId: string }) => {
      // Broadcast comment deletion to all users in the room
      io.in(roomId).emit('comment:deleted', { commentId });
      console.log(`Comment deleted in room ${roomId}:`, commentId);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      // Remove user from all rooms
      for (const [roomId, room] of Object.entries(rooms)) {
        if (room.users.has(socket.id)) {
          const user = room.users.get(socket.id);
          room.users.delete(socket.id);

          // Notify others
          socket.to(roomId).emit('user-left', { userId: user?.id });

          // Clean up empty rooms
          if (room.users.size === 0) {
            delete rooms[roomId];
          }
        }
      }
    });

    // Handle leave room
    socket.on('leave-room', ({ roomId }: { roomId: string }) => {
      if (rooms[roomId] && rooms[roomId].users.has(socket.id)) {
        const user = rooms[roomId].users.get(socket.id);
        rooms[roomId].users.delete(socket.id);
        socket.leave(roomId);

        // Notify others
        socket.to(roomId).emit('user-left', { userId: user?.id });

        // Clean up empty rooms
        if (rooms[roomId].users.size === 0) {
          delete rooms[roomId];
        }
      }
    });
  });

  return io;
}
