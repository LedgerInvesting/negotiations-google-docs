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

import { useLiveblocksExtension } from "@liveblocks/react-tiptap";
import { useStorage, useSelf, useCreateThread } from "@liveblocks/react/suspense";
import { useParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { useEditorStore } from "@/store/use-editor-store";
import { updateSuggestionThreadId } from "@/lib/suggestion-validators";
import { cleanDocumentJSON } from "@/lib/clean-document";
import { FontSizeExtensions } from "@/extensions/font-size";
import { LineHeightExtension } from "@/extensions/line-height";
import { SuggestionInsert, SuggestionDelete } from "@/extensions/suggestion";
import { SuggestionMode } from "@/extensions/suggestion-mode";
import { Ruler } from "./ruler";
import { Threads } from "./threads";
import { LEFT_MARGIN_DEFAULT, RIGHT_MARGIN_DEFAULT } from "@/constants/margins";

interface EditorProps {
  initialContent?: string | undefined;
}

export const Editor = ({ initialContent }: EditorProps) => {
  const leftMargin = useStorage((root) => root.leftMargin) ?? LEFT_MARGIN_DEFAULT;
  const rightMargin = useStorage((root) => root.rightMargin) ?? RIGHT_MARGIN_DEFAULT;
  
  const currentUser = useSelf();
  const isOwner = currentUser?.info?.isOwner === true;
  const createThread = useCreateThread();

  console.log('[Editor] Current user:', currentUser?.id, 'Is owner:', isOwner);

  const liveblocks = useLiveblocksExtension({
    initialContent,
    offlineSupport_experimental: true,
  });
  
  const { setEditor } = useEditorStore();
  const params = useParams();
  const documentId = params.documentId as string;
  
  // Track whether suggestion changes are being debounced (pending processing)
  const [isSuggestionPending, setIsSuggestionPending] = useState(false);
  
  // Track the last saved snapshot content to avoid duplicate saves
  const lastSnapshotContentRef = useRef<string>("");
  
  // Save a clean snapshot of the document before suggestions are applied
  const handleSnapshotBeforeEdit = useCallback((docJSON: Record<string, unknown>) => {
    const cleanDoc = cleanDocumentJSON(docJSON);
    const contentString = JSON.stringify(cleanDoc);
    
    // Skip if document content hasn't changed since last snapshot
    if (contentString === lastSnapshotContentRef.current) {
      console.log('[Editor] Snapshot skipped (content unchanged)');
      return;
    }
    
    lastSnapshotContentRef.current = contentString;
    console.log('[Editor] Saving clean snapshot before edit');
    
    // Fire-and-forget POST to snapshots API
    fetch(`/api/documents/${documentId}/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: cleanDoc }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Snapshot API returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.skipped) {
          console.log('[Editor] Snapshot skipped (duplicate)');
        } else {
          console.log('[Editor] Snapshot saved:', data.snapshot?.id);
        }
      })
      .catch((err) => {
        console.error('[Editor] Failed to save snapshot:', err);
      });
  }, [documentId]);
  
  // Track pending thread operations with debounce
  const pendingThreadsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  // Callback to create comment threads for suggestions with debouncing
  const handleCreateSuggestion = useCallback(async (data: {
    suggestionId: string;
    type: "insert" | "delete";
    text: string;
    from: number;
    to: number;
  }) => {
    console.log('[Editor] Suggestion created:', data);
    
    // Clear any existing timeout for this suggestion
    const existingTimeout = pendingThreadsRef.current.get(data.suggestionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Schedule thread creation after user stops typing
    return new Promise<string>((resolve) => {
      const timeout = setTimeout(async () => {
        try {
          console.log('[Editor] Creating thread (debounced):', data.suggestionId);
          
          const thread = await createThread({
            body: {
              version: 1,
              content: [
                {
                  type: "paragraph",
                  children: [
                    {
                      text: `Suggested ${data.type === "insert" ? "insertion" : "deletion"}: "${data.text.substring(0, 50)}${data.text.length > 50 ? "..." : ""}"`,
                    },
                  ],
                },
              ],
            },
            metadata: {
              suggestionId: data.suggestionId,
              changeType: data.type,
              status: "pending",
            },
          });
          
          console.log('[Editor] Thread created successfully:', thread.id);
          
          // Update the suggestion's thread ID
          if (editorRef.current) {
            const updated = updateSuggestionThreadId(editorRef.current, data.suggestionId, thread.id);
            console.log('[Editor] Thread ID updated:', updated);
          }
          
          pendingThreadsRef.current.delete(data.suggestionId);
          resolve(thread.id);
        } catch (error) {
          console.error("[Editor] Failed to create thread:", error);
          pendingThreadsRef.current.delete(data.suggestionId);
          // Return temp ID on error
          resolve(`temp-${data.suggestionId}`);
        }
      }, 1500); // Wait 1.5s after last keystroke
      
      pendingThreadsRef.current.set(data.suggestionId, timeout);
    });
  }, [createThread]);

  const editor = useEditor({
    immediatelyRender: false,
    onCreate({ editor }) {
      console.log('[Editor] Editor created');
      setEditor(editor);
      editorRef.current = editor;
    },
    onDestroy() {
      console.log('[Editor] Editor destroyed');
      setEditor(null);
      editorRef.current = null;
      // Clear all pending thread operations
      pendingThreadsRef.current.forEach(timeout => clearTimeout(timeout));
      pendingThreadsRef.current.clear();
    },
    onUpdate({ editor }) {
      setEditor(editor);
    },
    onSelectionUpdate({ editor }) {
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
      liveblocks,
      StarterKit.configure({
        history: false,
      }),
      SuggestionInsert,
      SuggestionDelete,
      SuggestionMode.configure({
        isOwner,
        userId: currentUser?.id || "",
        onCreateSuggestion: handleCreateSuggestion,
        onPendingChange: setIsSuggestionPending,
        onSnapshotBeforeEdit: handleSnapshotBeforeEdit,
      }),
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
  }, [isOwner, currentUser?.id, leftMargin, rightMargin, handleCreateSuggestion, handleSnapshotBeforeEdit]);

  // Don't render editor until we have user data
  if (!currentUser) {
    return (
      <div className="size-full overflow-x-auto bg-editor-bg px-4 print:p-0 print:bg-white print:overflow-visible flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="size-full overflow-x-auto bg-editor-bg px-4 print:p-0 print:bg-white print:overflow-visible">
      <Ruler />
      <div className="min-w-max flex justify-center w-[816px] py-4 print:py-0 mx-auto print:w-full print:min-w-0 relative">
        {/* Suggestion pending indicator - shown during 1.5s debounce */}
        {!isOwner && isSuggestionPending && (
          <div className="suggestion-pending-indicator">
            <span className="suggestion-pending-dot" />
            <span>Tracking changes…</span>
          </div>
        )}
        <EditorContent editor={editor} />
        <Threads editor={editor} />
      </div>
    </div>
  );
};
