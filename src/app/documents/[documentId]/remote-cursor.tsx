"use client";

import { useEffect, useState } from "react";

interface RemoteCursorProps {
  name: string;
  color: string;
  position: { from: number; to: number };
}

export const RemoteCursor = ({ name, color, position }: RemoteCursorProps) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    // Get the ProseMirror editor view
    const editorElement = document.querySelector('.ProseMirror') as HTMLElement;
    if (!editorElement) {
      console.log('⚠️ Editor element not found');
      return;
    }

    // Access the TipTap editor instance
    const tiptapEditor = (window as Window & { tiptapEditor?: { view: any } }).tiptapEditor;
    if (!tiptapEditor?.view) {
      console.log('⚠️ Editor view not found on window');
      return;
    }
    const editorView = tiptapEditor.view;

    try {
      // Get coordinates for the position
      const pos = Math.min(position.from, editorView.state.doc.content.size);
      const resolvedPos = editorView.coordsAtPos(pos);
      
      if (resolvedPos) {
        // Get the parent container (the one with relative positioning)
        const parentContainer = editorElement.closest('.min-w-max') as HTMLElement;
        if (parentContainer) {
          const containerRect = parentContainer.getBoundingClientRect();
          setCoords({
            top: resolvedPos.top - containerRect.top,
            left: resolvedPos.left - containerRect.left,
          });
          console.log('✅ Cursor positioned at:', { 
            viewport: { top: resolvedPos.top, left: resolvedPos.left },
            container: { top: containerRect.top, left: containerRect.left },
            final: { 
              top: resolvedPos.top - containerRect.top, 
              left: resolvedPos.left - containerRect.left 
            }
          });
        }
      }
    } catch (error) {
      console.error('❌ Error positioning cursor:', error);
    }
  }, [position, name]);

  if (!coords) {
    // Fallback: show notification badge
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: color,
          color: 'white',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '600',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        👤 {name} is editing (pos: {position.from})
      </div>
    );
  }

  return (
    <>
      {/* Notification badge */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: color,
          color: 'white',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '600',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        👤 {name}
      </div>
      
      {/* Actual cursor in document */}
      <div
        style={{
          position: 'absolute',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: '2px',
          height: '20px',
          backgroundColor: color,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-22px',
            left: '-2px',
            backgroundColor: color,
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            fontWeight: '500',
          }}
        >
          {name}
        </div>
      </div>
    </>
  );
};
