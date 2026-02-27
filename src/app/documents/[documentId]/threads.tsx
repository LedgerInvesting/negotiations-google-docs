"use client";

import { ClientSideSuspense, useThreads, useEditThreadMetadata } from "@liveblocks/react/suspense";
import { AnchoredThreads, FloatingComposer, FloatingThreads } from "@liveblocks/react-tiptap";
import { Thread } from "@liveblocks/react-ui";
import { Editor } from "@tiptap/react";
import { useSelf } from "@liveblocks/react/suspense";
import { acceptSuggestion, rejectSuggestion } from "@/lib/suggestion-helpers";
import { useEffect, useState, useCallback, useRef } from "react";
import { CheckIcon, XIcon } from "lucide-react";

export const Threads = ({ editor, onSnapshotSave }: { editor: Editor | null; onSnapshotSave?: () => void }) => {
  return (
    <ClientSideSuspense fallback={<></>}>
      <ThreadsList editor={editor} onSnapshotSave={onSnapshotSave} />
    </ClientSideSuspense>
  );
};

/**
 * Find the vertical position (top offset) of a suggestion mark in the editor
 * by looking for the DOM element with the matching suggestion ID.
 * The offset is relative to the threads panel container.
 */
function getSuggestionTopOffset(
  editor: Editor | null,
  suggestionId: string,
  containerEl: HTMLElement | null
): number | null {
  if (!editor || !containerEl) return null;

  // Find the suggestion mark element in the editor DOM
  const editorEl = editor.view.dom;
  const markEl =
    editorEl.querySelector(`[data-suggestion-id="${suggestionId}"]`);

  if (!markEl) return null;

  // Get the bounding rect of the suggestion mark and the container
  const markRect = markEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  // Return the top offset relative to the container
  return markRect.top - containerRect.top;
}

export function ThreadsList({ editor, onSnapshotSave }: { editor: Editor | null; onSnapshotSave?: () => void }) {
  const { threads } = useThreads({ query: { resolved: false } });
  const currentUser = useSelf();
  const isOwner = currentUser?.info?.isOwner === true;
  const editThreadMetadata = useEditThreadMetadata();
  const containerRef = useRef<HTMLDivElement>(null);

  // Track vertical positions for each suggestion thread
  const [threadPositions, setThreadPositions] = useState<
    Map<string, number>
  >(new Map());

  // Separate suggestion threads from regular comment threads
  const suggestionThreads = threads.filter(
    (t) => t.metadata?.suggestionId
  );
  const regularThreads = threads.filter(
    (t) => !t.metadata?.suggestionId
  );

  // Debug: log filtering results
  useEffect(() => {
    console.log('[Threads] Total:', threads.length, 'Suggestion:', suggestionThreads.length, 'Regular:', regularThreads.length);
    console.log('[Threads] currentUser.id:', currentUser?.id, 'isOwner:', isOwner);
    suggestionThreads.forEach(t => {
      console.log('[Threads] Suggestion thread:', t.id, 'metadata.userId:', t.metadata?.userId, 'match:', t.metadata?.userId === currentUser?.id);
    });
  }, [threads, suggestionThreads, regularThreads, currentUser, isOwner]);

  // Calculate positions for suggestion threads
  const updatePositions = useCallback(() => {
    if (!editor || suggestionThreads.length === 0) return;

    const newPositions = new Map<string, number>();

    suggestionThreads.forEach((thread) => {
      const suggestionId = thread.metadata?.suggestionId as string;
      if (!suggestionId) return;

      const top = getSuggestionTopOffset(
        editor,
        suggestionId,
        containerRef.current
      );
      if (top !== null) {
        newPositions.set(thread.id, top);
      }
    });

    setThreadPositions(newPositions);
  }, [editor, suggestionThreads]);

  // Update positions on editor changes, scroll, and window resize
  useEffect(() => {
    if (!editor) return;

    // Initial position calculation (with delay for DOM to settle)
    const initialTimer = setTimeout(updatePositions, 300);

    // Update on editor transactions (content changes, selection changes)
    const onTransaction = () => {
      requestAnimationFrame(updatePositions);
    };
    editor.on("transaction", onTransaction);

    // Update on scroll
    const scrollHandler = () => {
      requestAnimationFrame(updatePositions);
    };
    const scrollContainer = document.querySelector(
      ".size-full.overflow-x-auto"
    );
    scrollContainer?.addEventListener("scroll", scrollHandler);
    window.addEventListener("scroll", scrollHandler);
    window.addEventListener("resize", scrollHandler);

    return () => {
      clearTimeout(initialTimer);
      editor.off("transaction", onTransaction);
      scrollContainer?.removeEventListener("scroll", scrollHandler);
      window.removeEventListener("scroll", scrollHandler);
      window.removeEventListener("resize", scrollHandler);
    };
  }, [editor, updatePositions]);

  const handleAccept = (
    threadId: string,
    suggestionId: string,
    changeType: string
  ) => {
    if (!editor) return;
    console.log("[Threads] Accepting suggestion:", suggestionId, "type:", changeType);
    if (changeType === "nodeFormat" || changeType === "tableInsert" || changeType === "tableDelete") {
      editor.chain().acceptNodeSuggestion(suggestionId).run();
    } else {
      acceptSuggestion(editor, suggestionId);
    }
    editThreadMetadata({
      threadId,
      metadata: {
        status: "accepted",
      },
    });
    // Save a clean snapshot after accepting (document content changed)
    onSnapshotSave?.();
  };

  const handleReject = (
    threadId: string,
    suggestionId: string,
    changeType: string
  ) => {
    if (!editor) return;
    console.log("[Threads] Rejecting suggestion:", suggestionId, "type:", changeType);
    if (changeType === "nodeFormat" || changeType === "tableInsert" || changeType === "tableDelete") {
      editor.chain().rejectNodeSuggestion(suggestionId).run();
    } else {
      rejectSuggestion(editor, suggestionId);
    }
    editThreadMetadata({
      threadId,
      metadata: {
        status: "rejected",
      },
    });
    // Save a clean snapshot after rejecting (document content changed)
    onSnapshotSave?.();
  };

  // Sort suggestion threads by their vertical position
  const sortedSuggestionThreads = [...suggestionThreads].sort((a, b) => {
    const posA = threadPositions.get(a.id) ?? Infinity;
    const posB = threadPositions.get(b.id) ?? Infinity;
    return posA - posB;
  });

  return (
    <>
      {/* Regular comment threads (anchored to text) */}
      <div className="anchored-threads">
        <AnchoredThreads editor={editor} threads={regularThreads} />
      </div>

      {/* Suggestion threads positioned at the level of their marks */}
      {sortedSuggestionThreads.length > 0 && (
        <div
          ref={containerRef}
          className="suggestion-threads-panel"
        >
          {sortedSuggestionThreads.map((thread) => {
            const suggestionId = thread.metadata?.suggestionId as string;
            const changeType = thread.metadata?.changeType as string;
            const status = thread.metadata?.status as string;
            const topOffset = threadPositions.get(thread.id);

            if (status !== "pending") return null;

            return (
              <div
                key={thread.id}
                className="suggestion-thread-wrapper"
                style={
                  topOffset !== undefined
                    ? {
                        position: "absolute",
                        top: `${topOffset}px`,
                        left: 0,
                        right: 0,
                      }
                    : undefined
                }
              >
                {/* Label showing this is a suggestion */}
                <div className="suggestion-thread-label">
                  <span
                    className={`suggestion-badge ${
                      changeType === "insert"
                        ? "suggestion-badge-insert"
                        : changeType === "replace"
                          ? "suggestion-badge-replace"
                          : changeType === "format"
                            ? "suggestion-badge-format"
                            : changeType === "nodeFormat"
                              ? "suggestion-badge-nodeformat"
                              : changeType === "tableInsert"
                                ? "suggestion-badge-tableinsert"
                                : changeType === "tableDelete"
                                  ? "suggestion-badge-tabledelete"
                                  : "suggestion-badge-delete"
                    }`}
                  >
                    {changeType === "insert"
                      ? "+ Insertion"
                      : changeType === "replace"
                        ? "⇄ Replace"
                        : changeType === "format"
                          ? "Format"
                          : changeType === "nodeFormat"
                            ? "Block format"
                            : changeType === "tableInsert"
                              ? "⊞ Table"
                              : changeType === "tableDelete"
                                ? "⊟ Table"
                                : "− Deletion"}
                  </span>
                </div>

                {/* Full Liveblocks Thread component */}
                <Thread
                  thread={thread}
                  className="suggestion-thread"
                  showResolveAction={false}
                  showActions={false}
                />

                {/* Accept/Reject buttons for owners */}
                {isOwner && (
                  <div className="suggestion-actions-bar">
                    <button
                      className="suggestion-accept-btn"
                      onClick={() =>
                        handleAccept(thread.id, suggestionId, changeType)
                      }
                    >
                      <CheckIcon className="w-4 h-4 mr-1.5" />
                      Accept
                    </button>
                    <button
                      className="suggestion-reject-btn"
                      onClick={() =>
                        handleReject(thread.id, suggestionId, changeType)
                      }
                    >
                      <XIcon className="w-4 h-4 mr-1.5" />
                      Reject
                    </button>
                  </div>
                )}

                {/* Cancel button for the suggesting user */}
                {!isOwner && thread.metadata?.userId === currentUser?.id && (
                  <div className="suggestion-actions-bar">
                    <button
                      className="suggestion-cancel-btn"
                      onClick={() =>
                        handleReject(thread.id, suggestionId, changeType)
                      }
                    >
                      <XIcon className="w-4 h-4 mr-1.5" />
                      Cancel suggestion
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FloatingThreads
        editor={editor}
        threads={regularThreads}
        className="floating-threads"
      />
      <FloatingComposer editor={editor} className="floating-composer" />
    </>
  );
}
