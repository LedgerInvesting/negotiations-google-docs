# Real-Time Collaboration Fix

## Problem
The real-time collaboration features were not working. Users couldn't see:
- Other users online
- Live cursor positions
- Real-time document changes
- Had to refresh the page to see changes

## Root Cause
The backend had a fully functional WebSocket server implementation, but the frontend was missing:
1. The `socket.io-client` package
2. WebSocket connection logic
3. Integration with the editor for real-time updates

## Solution Implemented

### 1. Installed Dependencies
```bash
npm install socket.io-client --legacy-peer-deps
```

### 2. Created WebSocket Hook (`src/hooks/use-socket.ts`)
- Manages WebSocket connection lifecycle
- Handles room joining/leaving
- Emits and receives document updates
- Tracks online users
- Manages cursor positions

### 3. Updated Room Component (`src/app/documents/[documentId]/room.tsx`)
- Creates React context for WebSocket state
- Connects to WebSocket server on mount
- Provides user information (ID, name, avatar, color)
- Exposes room state to child components

### 4. Updated Editor Component (`src/app/documents/[documentId]/editor.tsx`)
- Broadcasts local changes to other users via WebSocket (debounced 300ms)
- Receives and applies remote changes from other users
- Preserves cursor position when applying remote updates
- Prevents infinite update loops with `isRemoteUpdate` flag

### 5. Implemented Avatars Component (`src/app/documents/[documentId]/avatars.tsx`)
- Displays online users with their avatars
- Shows up to 3 avatars with overflow indicator
- Displays connection status with animated indicator
- Shows total number of online users

### 6. Updated Document Component (`src/app/documents/[documentId]/document.tsx`)
- Passes unique `roomId` to Room component
- Wires up document update handler between Room and Editor

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Document                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                Room (WebSocket Context)               │  │
│  │  - Connects to WebSocket server                      │  │
│  │  - Manages online users state                        │  │
│  │  - Provides emit functions                           │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │              Editor                             │  │  │
│  │  │  - Broadcasts changes via emitDocumentUpdate   │  │  │
│  │  │  - Receives updates via onDocumentUpdate       │  │  │
│  │  │  - Auto-saves to database (debounced 1000ms)   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │              Navbar                             │  │  │
│  │  │  ┌──────────────────────────────────────────┐  │  │  │
│  │  │  │        Avatars                           │  │  │  │
│  │  │  │  - Shows online users from Room context │  │  │  │
│  │  │  └──────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓ WebSocket (socket.io)
┌─────────────────────────────────────────────────────────────┐
│                  Backend WebSocket Server                    │
│  - Manages rooms and users                                   │
│  - Broadcasts document updates                               │
│  - Tracks cursor positions                                   │
│  - Notifies user join/leave events                          │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### Connection Flow
1. User opens a document
2. `Room` component creates WebSocket connection
3. Emits `join-room` event with room ID and user info
4. Backend adds user to room and sends current room state
5. Other users in the room receive `user-joined` event

### Document Update Flow
1. User types in the editor
2. Editor's `onUpdate` triggers (debounced 300ms for WebSocket, 1000ms for DB)
3. Editor calls `emitDocumentUpdate` from Room context
4. Backend receives `document-update` event
5. Backend broadcasts to all other users in the room
6. Other users' editors receive update and apply changes
7. Cursor position is preserved during update

### Disconnection Flow
1. User closes tab or navigates away
2. `useSocket` cleanup runs
3. Emits `leave-room` event
4. Backend removes user from room
5. Other users receive `user-left` event
6. Avatars component updates to remove the user

## Testing Instructions

### Test 1: Basic Connection
1. Open the app in your browser: http://localhost:3000
2. Open a document
3. Check browser console for: `✅ Socket connected: [socket-id]`
4. You should see "1 online" in the navbar

### Test 2: Multiple Users
1. Open the same document in two different browser windows (or use incognito)
2. You should see "2 online" in both windows
3. Both users' avatars should appear in the navbar

### Test 3: Real-Time Editing
1. With two windows open on the same document
2. Type in one window
3. The changes should appear in the other window within ~500ms
4. No refresh needed!

### Test 4: Persistence
1. Make changes in one window
2. Wait for "💾 Content saved to database" in console
3. Refresh the page
4. Changes should persist

## Console Messages

When working correctly, you should see:
- `✅ Socket connected: [id]` - Connection established
- `📋 Received room state: {...}` - Initial room state loaded
- `👤 User joined: {...}` - Another user joined
- `📤 Broadcasting update to other users` - Sending your changes
- `📥 Received update from another user` - Receiving changes
- `💾 Content saved to database` - Auto-save completed
- `👋 User left: [userId]` - User disconnected

## Configuration

### WebSocket URL
Set in `src/hooks/use-socket.ts`:
```typescript
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

### Update Debounce Times
In `src/app/documents/[documentId]/editor.tsx`:
- WebSocket broadcast: 300ms (faster for real-time feel)
- Database save: 1000ms (slower to reduce DB load)

## Troubleshooting

### Issue: Socket not connecting
- Check backend is running: `ps aux | grep tsx`
- Check backend logs for WebSocket server initialization
- Verify CORS settings in `backend/src/index.ts`

### Issue: Updates not appearing
- Check browser console for `📤 Broadcasting` and `📥 Received` messages
- Verify both users are in the same room (same document ID)
- Check for JavaScript errors in console

### Issue: Too many updates
- Increase debounce time in editor
- Check for infinite update loops (should be prevented by `isRemoteUpdate` flag)

### Issue: Connection drops
- Check network stability
- Verify reconnection settings in `useSocket` (currently 5 attempts)
- Check backend logs for errors

## Performance Considerations

1. **Debouncing**: Updates are debounced to prevent flooding the WebSocket
2. **Selection Preservation**: User's cursor position is preserved during remote updates
3. **Update Prevention**: Local updates don't trigger remote update events (via `isRemoteUpdate` flag)
4. **Efficient Broadcasting**: Backend uses Socket.IO's room-based broadcasting

## Future Enhancements

Potential improvements:
- [ ] Show live cursor positions of other users
- [ ] Implement operational transformation for better conflict resolution
- [ ] Add user presence indicators (typing, idle, etc.)
- [ ] Show selection ranges of other users
- [ ] Add commenting and annotations
- [ ] Implement version history with real-time updates
- [ ] Add reconnection UI feedback
- [ ] Optimize for large documents (pagination, virtual scrolling)
