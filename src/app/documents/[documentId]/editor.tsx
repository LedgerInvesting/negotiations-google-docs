"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";

import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";

import { Image } from "@tiptap/extension-image";
import ImageResize from "tiptap-extension-resize-image";

import { Underline } from "@tiptap/extension-underline";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextStyle } from "@tiptap/extension-text-style";

import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";

import { TextAlign } from "@tiptap/extension-text-align";

import { Link } from "@tiptap/extension-link";

import { useLiveblocksExtension } from "@liveblocks/react-tiptap";
import { useStorage, useSelf, useCreateThread } from "@liveblocks/react/suspense";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useEditorStore } from "@/store/use-editor-store";
import { updateSuggestionThreadId } from "@/lib/suggestion-validators";
import { cleanDocumentJSON } from "@/lib/clean-document";
import { FontSizeExtensions } from "@/extensions/font-size";
import { LineHeightExtension } from "@/extensions/line-height";
import { SuggestionInsert, SuggestionDelete } from "@/extensions/suggestion";
import { SuggestionMode } from "@/extensions/suggestion-mode";
import { NodeSuggestion } from "@/extensions/node-suggestion";
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
  const snapshotDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Save a clean snapshot of the current document (owner-only, strips suggestion marks)
  const saveCleanSnapshot = useCallback(() => {
    if (!editorRef.current) return;
    
    const docJSON = editorRef.current.getJSON();
    const cleanDoc = cleanDocumentJSON(docJSON);
    const contentString = JSON.stringify(cleanDoc);
    
    // Skip if document content hasn't changed since last snapshot
    if (contentString === lastSnapshotContentRef.current) {
      console.log('[Editor] Snapshot skipped (content unchanged)');
      return;
    }
    
    lastSnapshotContentRef.current = contentString;
    console.log('[Editor] Saving clean owner snapshot');
    
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
          console.log('[Editor] Snapshot skipped (duplicate on server)');
        } else {
          console.log('[Editor] Snapshot saved:', data.snapshot?.id);
        }
      })
      .catch((err) => {
        console.error('[Editor] Failed to save snapshot:', err);
      });
  }, [documentId]);
  
  // Debounced snapshot save for owner edits (3 second debounce)
  const debouncedSaveSnapshot = useCallback(() => {
    if (snapshotDebounceRef.current) {
      clearTimeout(snapshotDebounceRef.current);
    }
    snapshotDebounceRef.current = setTimeout(() => {
      saveCleanSnapshot();
      snapshotDebounceRef.current = null;
    }, 3000);
  }, [saveCleanSnapshot]);
  
  // Track pending thread operations with debounce
  const pendingThreadsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  // Callback to create comment threads for suggestions with debouncing
  const handleCreateSuggestion = useCallback(async (data: {
    suggestionId: string;
    type: "insert" | "delete" | "replace" | "format" | "nodeFormat" | "tableInsert" | "tableDelete";
    text: string;
    oldText?: string;
    newText?: string;
    description?: string;
    oldNodeData?: string;
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
          
          let label: string;
          if (data.type === "replace") {
            label = `Replace "${(data.oldText ?? "").substring(0, 50)}${(data.oldText ?? "").length > 50 ? "..." : ""}" with "${(data.newText ?? "").substring(0, 50)}${(data.newText ?? "").length > 50 ? "..." : ""}"`;
          } else if (data.type === "format") {
            const truncText = data.text.substring(0, 40) + (data.text.length > 40 ? "…" : "");
            label = `Format "${truncText}": ${data.description ?? "style change"}`;
          } else if (data.type === "nodeFormat") {
            label = `Block format: ${data.description ?? data.text}`;
          } else if (data.type === "tableInsert") {
            label = "Suggested table insertion";
          } else if (data.type === "tableDelete") {
            label = "Suggested table deletion";
          } else {
            label = `Suggested ${data.type === "insert" ? "insertion" : "deletion"}: "${data.text.substring(0, 50)}${data.text.length > 50 ? "..." : ""}"`;
          }

          const thread = await createThread({
            body: {
              version: 1,
              content: [
                {
                  type: "paragraph",
                  children: [
                    {
                      text: label,
                    },
                  ],
                },
              ],
            },
            metadata: {
              suggestionId: data.suggestionId,
              changeType: data.type,
              status: "pending",
              nodeRevertData: data.type === "nodeFormat" ? (data.oldNodeData ?? undefined) : undefined,
              userId: currentUser?.id,
            },
          });

          console.log('[Editor] Thread created successfully:', thread.id);

          // Update the suggestion's thread ID
          if (editorRef.current) {
            if (data.type === "nodeFormat" || data.type === "tableInsert" || data.type === "tableDelete") {
              editorRef.current.chain().updateNodeSuggestionThreadId(data.suggestionId, thread.id).run();
              console.log('[Editor] Node suggestion thread ID updated:', thread.id);
            } else {
              const updated = updateSuggestionThreadId(editorRef.current, data.suggestionId, thread.id);
              console.log('[Editor] Thread ID updated:', updated);
            }
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
        undoRedo: false,
      }),
      SuggestionInsert,
      SuggestionDelete,
      NodeSuggestion,
      SuggestionMode.configure({
        isOwner,
        userId: currentUser?.id || "",
        onCreateSuggestion: handleCreateSuggestion,
        onPendingChange: setIsSuggestionPending,
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
  }, [isOwner, currentUser?.id, leftMargin, rightMargin, handleCreateSuggestion]);

  // Owner-only: listen to editor transactions and save snapshots on local doc changes
  useEffect(() => {
    if (!editor || !isOwner) return;
    
    const handleTransaction = ({ transaction }: { transaction: { docChanged: boolean; getMeta: (key: string) => unknown } }) => {
      if (!transaction.docChanged) return;
      
      // Skip remote/suggestion system transactions — only snapshot owner's local edits
      const isRemote = transaction.getMeta('y-sync$') || transaction.getMeta('yjs-update');
      const isSuggestionSystem = transaction.getMeta('suggestionMode') || transaction.getMeta('suggestionThreadUpdate');
      if (isRemote || isSuggestionSystem) return;
      
      debouncedSaveSnapshot();
    };
    
    editor.on('transaction', handleTransaction);
    
    return () => {
      editor.off('transaction', handleTransaction);
      // Clear pending debounce on cleanup
      if (snapshotDebounceRef.current) {
        clearTimeout(snapshotDebounceRef.current);
        snapshotDebounceRef.current = null;
      }
    };
  }, [editor, isOwner, debouncedSaveSnapshot]);

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
      <div className="flex justify-center print:py-0 mx-auto print:w-full print:min-w-0">
        <div className="min-w-max w-[816px]">
          <Ruler />
          <div className="relative py-4 print:py-0">
            {/* Suggestion pending indicator - shown during 1.5s debounce */}
            {!isOwner && isSuggestionPending && (
              <div className="suggestion-pending-indicator">
                <span className="suggestion-pending-dot" />
                <span>Tracking changes…</span>
              </div>
            )}
            <EditorContent editor={editor} />
          </div>
        </div>
        <div className="threads-panel-right print:hidden">
          <Threads editor={editor} onSnapshotSave={isOwner ? saveCleanSnapshot : undefined} />
        </div>
      </div>
    </div>
  );
};
