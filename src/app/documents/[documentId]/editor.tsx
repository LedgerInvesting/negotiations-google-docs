"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";

import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";

import Image from "@tiptap/extension-image";
import ImageResize from "tiptap-extension-resize-image";

import Underline from "@tiptap/extension-underline";
import FontFamily from "@tiptap/extension-font-family";
import TextStyle from "@tiptap/extension-text-style";

import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";

import TextAlign from "@tiptap/extension-text-align";

import Link from "@tiptap/extension-link";

import { useEditorStore } from "@/store/use-editor-store";
import { FontSizeExtensions } from "@/extensions/font-size";
import { LineHeightExtension } from "@/extensions/line-height";
import { Ruler } from "./ruler";
import { Threads } from "./threads";
import { LEFT_MARGIN_DEFAULT, RIGHT_MARGIN_DEFAULT } from "@/constants/margins";
import { useDebounce } from "@/hooks/use-debounce";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@clerk/nextjs";
import { useRef, useEffect, useCallback } from "react";
import { useRoom } from "./room";
import { RemoteCursor } from "./remote-cursor";

interface EditorProps {
  initialContent?: string | undefined;
  documentId: number;
  onRegisterUpdateHandler?: (handler: (content: string) => void) => void;
}

export const Editor = ({ initialContent, documentId, onRegisterUpdateHandler }: EditorProps) => {
  const { getToken } = useAuth();
  const isInitialContentSet = useRef(false);
  const isRemoteUpdate = useRef(false);
  const leftMargin = LEFT_MARGIN_DEFAULT;
  const rightMargin = RIGHT_MARGIN_DEFAULT;

  const { setEditor } = useEditorStore();
  const { emitDocumentUpdate, emitSelectionUpdate, remoteSelections } = useRoom();

  const debouncedSaveContent = useDebounce(async (content: string) => {
    try {
      const token = await getToken();
      await apiClient.updateDocument(token, documentId, { content });
      console.log('💾 Content saved to database');
    } catch (error) {
      console.error('Failed to save content:', error);
    }
  }, 1000);

  const debouncedEmitUpdate = useDebounce((content: string) => {
    if (!isRemoteUpdate.current) {
      emitDocumentUpdate(content);
      console.log('📤 Broadcasting update to other users');
    }
  }, 300);

  const editor = useEditor({
    immediatelyRender: false,
    onCreate({ editor }) {
      setEditor(editor);
      // Expose editor to window for cursor positioning
      (window as Window & { tiptapEditor?: typeof editor }).tiptapEditor = editor;
      // Set initial content if available
      if (initialContent && !isInitialContentSet.current) {
        editor.commands.setContent(initialContent);
        isInitialContentSet.current = true;
      }
    },
    onDestroy() {
      setEditor(null);
      // Clean up window reference
      delete (window as Window & { tiptapEditor?: typeof editor }).tiptapEditor;
    },
    onUpdate({ editor }) {
      setEditor(editor);
      // Auto-save content changes
      const content = editor.getHTML();
      debouncedSaveContent(content);
      // Broadcast to other users via WebSocket
      debouncedEmitUpdate(content);
    },
    onSelectionUpdate({ editor }) {
      setEditor(editor);
      // Emit selection position to other users
      if (!isRemoteUpdate.current) {
        const { from, to } = editor.state.selection;
        console.log('📍 Sending selection update:', { from, to });
        emitSelectionUpdate({ from, to });
      }
    },
    onTransaction({ editor }) {
      setEditor(editor);
    },
    onFocus({ editor }) {
      setEditor(editor);
    },
    onBlur({ editor }) {
      setEditor(editor);
    },
    onContentError({ editor }) {
      setEditor(editor);
    },
    editorProps: {
      attributes: {
        style: `padding-left: ${leftMargin}px; padding-right: ${rightMargin}px;`,
        class:
          "focus:outline-none print:boder-0 border bg-white border-editor-border flex flex-col min-h-[1054px] w-[816px] pt-10 pr-14 pb-10 cursor-text",
      },
    },
    extensions: [
      StarterKit,
      Table,
      TableCell,
      TableHeader,
      TableRow,
      TaskList,
      Image,
      ImageResize,
      Underline,
      FontFamily,
      TextStyle,
      Color,
      LineHeightExtension.configure({
        types: ["heading", "paragraph"],
        defaultLineHeight: "1.5",
      }),
      FontSizeExtensions,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TaskItem.configure({ nested: true }),
    ],
  });

  // Handle incoming document updates from other users
  const handleRemoteUpdate = useCallback((content: string) => {
    if (editor && !editor.isDestroyed) {
      isRemoteUpdate.current = true;
      
      // Save current selection
      const { from, to } = editor.state.selection;
      
      // Update content
      editor.commands.setContent(content, false);
      
      // Restore selection if possible
      try {
        editor.commands.setTextSelection({ from, to });
      } catch {
        // Selection might be invalid after content update
        console.log('Could not restore selection');
      }
      
      isRemoteUpdate.current = false;
      console.log('📥 Received update from another user');
    }
  }, [editor]);

  // Register the update handler with the parent
  useEffect(() => {
    if (onRegisterUpdateHandler) {
      onRegisterUpdateHandler(handleRemoteUpdate);
    }
  }, [handleRemoteUpdate, onRegisterUpdateHandler]);

  return (
    <div className="size-full overflow-x-auto bg-editor-bg px-4 print:p-0 print:bg-white print:overflow-visible">
      <Ruler />
      <div className="min-w-max flex justify-center w-[816px] py-4 print:py-0 mx-auto print:w-full print:min-w-0 relative">
        <EditorContent editor={editor} />
        <Threads />
        {/* Render remote cursors */}
        {remoteSelections.map((selection) => (
          <RemoteCursor
            key={selection.userId}
            name={selection.userName}
            color={selection.userColor}
            position={selection.selection}
          />
        ))}
      </div>
    </div>
  );
};
