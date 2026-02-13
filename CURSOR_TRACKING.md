# Live Cursor Tracking Feature

## Overview
Added real-time cursor tracking so users can see where other collaborators are typing in the document. Each user's cursor is displayed with their unique color and name label.

## Implementation Details

### 1. Remote Cursor Component (`src/app/documents/[documentId]/remote-cursor.tsx`)
- Renders a colored cursor at the position of other users
- Shows user name in a label above the cursor
- Uses the ProseMirror editor's position system
- Automatically cleans up when users leave or positions change

### 2. WebSocket Updates
**Hook (`src/hooks/use-socket.ts`):**
- Added `onSelectionUpdate` callback to receive remote cursor positions
- Added `emitSelectionUpdate` function to broadcast local cursor position
- Tracks selection data: `{ from, to }` positions in the document

**Backend (`backend/src/websocket.ts`):**
- Added `selection-update` event handler
- Broadcasts cursor positions to other users in the room
- Includes user info (name, color) with each update

### 3. Room Context (`src/app/documents/[documentId]/room.tsx`)
- Maintains `remoteSelections` state array
- Updates selection when receiving remote updates
- Removes selections when users leave the room
- Provides `emitSelectionUpdate` function to child components

### 4. Editor Integration (`src/app/documents/[documentId]/editor.tsx`)
- Emits selection update on every cursor movement (via `onSelectionUpdate` event)
- Renders `RemoteCursor` components for each remote user
- Passes user info (name, color) and position to each cursor

## How It Works

### Cursor Position Flow
```
1. User moves cursor/selection in Editor
   ↓
2. Editor's onSelectionUpdate fires
   ↓
3. emitSelectionUpdate({ from, to }) called
   ↓
4. WebSocket sends to backend
   ↓
5. Backend broadcasts to other users in room
   ↓
6. Other users receive selection-update event
   ↓
7. Room context updates remoteSelections state
   ↓
8. RemoteCursor components re-render at new positions
```

### Visual Representation
```
┌─────────────────────────────────────────────┐
│  Document Editor                             │
│                                              │
│  This is some text that the user is typing  │
│                    ↑ [Alice]  ← User cursor │
│                    │ (colored line)          │
│                                              │
│  More content here [Bob] ← Another user     │
│                     ↑ (different color)     │
└─────────────────────────────────────────────┘
```

## Features

### ✅ Real-Time Updates
- Cursor positions update as users type or navigate
- No debouncing on selection updates for instant feedback
- Smooth position transitions

### ✅ Visual Indicators
- 2px wide colored vertical line at cursor position
- User name label above the cursor
- Each user gets a unique random color
- Label background matches cursor color

### ✅ Automatic Cleanup
- Cursors disappear when users leave the room
- Old cursor positions are removed when positions update
- No ghost cursors left behind

### ✅ Position Accuracy
- Uses ProseMirror's native position system
- Handles text nodes correctly
- Gracefully handles invalid positions (out of bounds)

## Testing

### Test 1: See Other User's Cursor
1. Open a document in two browser windows
2. Type or click around in one window
3. Watch the cursor appear in the other window with the user's name

### Test 2: Multiple Users
1. Open the same document in 3+ windows
2. Each window should show all other users' cursors
3. Each cursor should have a different color

### Test 3: Cursor Movement
1. With 2 windows open
2. Use arrow keys to move cursor in one window
3. The cursor should move in real-time in the other window

### Test 4: Cursor Cleanup
1. Open document in 2 windows
2. Close one window
3. The cursor should disappear from the remaining window

## Console Messages

When working correctly:
- `📍 Received selection update: { userId, userName, userColor, selection }`
- Selection updates fire on every cursor movement

## Performance Considerations

### Current Implementation
- **No debouncing** on selection updates for real-time feel
- Updates sent on every selection change
- Minimal overhead (just position data)

### Future Optimizations
If performance becomes an issue:
1. Add 50-100ms debounce to selection updates
2. Throttle updates instead of debounce
3. Send updates only when cursor moves significantly
4. Batch multiple selection updates

## Customization

### Change Cursor Appearance
Edit `src/app/documents/[documentId]/remote-cursor.tsx`:
```typescript
cursorEl.style.width = '2px';  // Cursor thickness
cursorEl.style.height = `${rect.height}px`;  // Cursor height
```

### Change Label Style
Modify the innerHTML template in `remote-cursor.tsx`:
```typescript
cursorEl.innerHTML = `
  <div style="
    background-color: ${color};
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
  ">${name}</div>
`;
```

### Change Update Frequency
Add debouncing in `src/app/documents/[documentId]/editor.tsx`:
```typescript
const debouncedEmitSelection = useDebounce((selection) => {
  emitSelectionUpdate(selection);
}, 100); // 100ms debounce

// Then in onSelectionUpdate:
debouncedEmitSelection({ from, to });
```

## Known Limitations

1. **Selection Ranges**: Currently shows only cursor position (from), not full selection range
2. **Position Calculation**: May not work perfectly for complex nested structures
3. **Scrolling**: Cursors are positioned relative to editor, not viewport
4. **Empty Documents**: Cursor might not render in completely empty documents

## Future Enhancements

- [ ] Show selection ranges (highlight selected text)
- [ ] Add cursor animation/blinking effect
- [ ] Show user avatar next to cursor
- [ ] Add hover tooltip with more user info
- [ ] Follow mode (scroll to follow another user's cursor)
- [ ] Cursor fade-out after inactivity
- [ ] Better handling of cursor in tables/lists/etc.
- [ ] Mobile touch cursor indicators

## Troubleshooting

### Issue: Cursors not appearing
- Check browser console for `📍 Received selection update` messages
- Verify backend is handling `selection-update` events
- Ensure ProseMirror editor is properly initialized

### Issue: Cursors in wrong position
- Check that document content is synchronized
- Verify position calculations in RemoteCursor component
- May need to handle document structure changes better

### Issue: Too many updates
- Add debouncing to `onSelectionUpdate` in editor
- Check for infinite loops in update handlers

### Issue: Cursors not cleaning up
- Verify `user-left` event is firing
- Check RemoteCursor component's cleanup useEffect
- Ensure DOM elements are being removed
