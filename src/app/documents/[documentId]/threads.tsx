"use client";

import {
  ClientSideSuspense,
  useThreads,
  useEditThreadMetadata,
  useMarkThreadAsResolved,
} from "@liveblocks/react/suspense";
import {
  AnchoredThreads,
  FloatingComposer,
  FloatingThreads,
} from "@liveblocks/react-tiptap";
import { Thread } from "@liveblocks/react-ui";
import { Editor } from "@tiptap/react";
import { useSelf } from "@liveblocks/react/suspense";
import { acceptSuggestion, rejectSuggestion } from "@/lib/suggestion-helpers";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { CheckIcon, XIcon } from "lucide-react";

export const Threads = ({
  editor,
  onSnapshotSave,
}: {
  editor: Editor | null;
  onSnapshotSave?: () => void;
}) => {
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
  containerEl: HTMLElement | null,
): number | null {
  if (!editor || !containerEl) return null;

  // Find the suggestion mark element in the editor DOM
  const editorEl = editor.view.dom;
  const markEl = editorEl.querySelector(
    `[data-suggestion-id="${suggestionId}"]`,
  );

  if (!markEl) return null;

  // Get the bounding rect of the suggestion mark and the container
  const markRect = markEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  // Return the top offset relative to the container
  return markRect.top - containerRect.top;
}

export function ThreadsList({
  editor,
  onSnapshotSave,
}: {
  editor: Editor | null;
  onSnapshotSave?: () => void;
}) {
  // Fetch ALL threads (no resolved filter) — Liveblocks may auto-resolve "orphaned" threads
  // that lack a liveblocksCommentMark anchor. Our suggestion threads are created via createThread
  // directly (no anchor mark), so relying on resolved:false would hide them after a reconnect.
  // We manage visibility ourselves using the custom `status` metadata field instead.
  const { threads } = useThreads();
  const currentUser = useSelf();
  const isOwner = currentUser?.info?.isOwner === true;
  const editThreadMetadata = useEditThreadMetadata();
  const markThreadAsResolved = useMarkThreadAsResolved();
  const containerRef = useRef<HTMLDivElement>(null);

  // Track vertical positions for each suggestion thread
  const [threadPositions, setThreadPositions] = useState<Map<string, number>>(
    new Map(),
  );

  // Separate suggestion threads from regular comment threads.
  // Memoized so their references only change when `threads` actually changes —
  // prevents an infinite loop where a new array reference each render would
  // cascade through updatePositions → setThreadPositions → re-render → repeat.
  const suggestionThreads = useMemo(
    () => threads.filter((t) => t.metadata?.suggestionId && !t.resolved),
    [threads],
  );
  const regularThreads = useMemo(
    () => threads.filter((t) => !t.metadata?.suggestionId && !t.resolved),
    [threads],
  );

  // One-time mount diagnostic: log thread counts to trace the reload disappearance bug
  const mountLoggedRef = useRef(false);
  useEffect(() => {
    if (mountLoggedRef.current) return;
    mountLoggedRef.current = true;
    const pending = suggestionThreads.filter(
      (t) => t.metadata?.status === "pending",
    );
    console.log(
      "[Threads] Mount — total:",
      threads.length,
      "suggestion:",
      suggestionThreads.length,
      "pending:",
      pending.length,
    );
    if (pending.length > 0) {
      pending.forEach((t) =>
        console.log(
          "  Pending thread:",
          t.id,
          "suggestionId:",
          t.metadata?.suggestionId,
          "resolved:",
          t.resolved,
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time editor-ready diagnostic: log suggestion marks in the DOM
  const editorLoggedRef = useRef(false);
  useEffect(() => {
    if (!editor || editorLoggedRef.current) return;
    editorLoggedRef.current = true;
    const marks = editor.view.dom.querySelectorAll("[data-suggestion-id]");
    marks.forEach((el) =>
      console.log(
        "  Mark:",
        el.getAttribute("data-suggestion-id"),
        "threadId:",
        el.getAttribute("data-comment-thread-id"),
      ),
    );
  }, [editor]);

  // Once threads are loaded (guaranteed by ClientSideSuspense) and the editor is ready,
  // scan the document for suggestion marks whose suggestionId has no matching thread.
  // Any such mark is orphaned — reject it to revert the suggestion content.
  // Runs once per mount; `threads` is the authoritative source of truth.
  const orphanCleanupRanRef = useRef(false);
  useEffect(() => {
    if (!editor || orphanCleanupRanRef.current) return;
    orphanCleanupRanRef.current = true;

    // Build the set of suggestionIds that are covered by a Liveblocks thread.
    const threadSuggestionIds = new Set(
      threads.flatMap((t) =>
        t.metadata?.suggestionId ? [t.metadata.suggestionId] : [],
      ),
    );

    const toReject: Array<{
      suggestionId: string;
      kind: "text" | "node";
      action?: "insert" | "delete";
      userId?: string; // original suggester, from mark attrs
    }> = [];
    const seen = new Set<string>();

    editor.state.doc.descendants((node) => {
      // Text-level suggestion marks
      if (node.isText) {
        node.marks.forEach((mark) => {
          if (
            mark.type.name !== "suggestionInsert" &&
            mark.type.name !== "suggestionDelete"
          )
            return;
          const { suggestionId, userId } = mark.attrs;
          if (!suggestionId || seen.has(suggestionId)) return;
          if (!threadSuggestionIds.has(suggestionId)) {
            seen.add(suggestionId);
            toReject.push({ suggestionId, kind: "text", userId: userId ?? undefined });
          }
        });
      }
      // Node-level suggestion attrs
      const nid = node.attrs?.nodeSuggestionId;
      if (nid && !seen.has(nid)) {
        if (!threadSuggestionIds.has(nid)) {
          seen.add(nid);
          toReject.push({
            suggestionId: nid,
            kind: "node",
            action: node.attrs?.nodeSuggestionAction ?? undefined,
            userId: node.attrs?.nodeSuggestionUserId ?? undefined,
          });
        }
      }
    });

    if (toReject.length === 0) {
      console.log("[Threads] No orphaned suggestions found");
      return;
    }

    console.log(
      "[Threads] Reverting",
      toReject.length,
      "orphaned suggestion(s):",
      toReject.map((r) => `${r.suggestionId} (owner: ${r.userId ?? "unknown"})`),
    );

    toReject.forEach(({ suggestionId, kind, action }) => {
      if (kind === "text") {
        editor.chain().rejectSuggestion(suggestionId).run();
      } else {
        editor.chain().rejectNodeSuggestion(suggestionId, action).run();
      }
    });
  }, [editor, threads]);

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
        containerRef.current,
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
      ".size-full.overflow-x-auto",
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
    changeType: string,
  ) => {
    if (!editor) return;
    if (
      changeType === "nodeFormat" ||
      changeType === "tableInsert" ||
      changeType === "tableDelete"
    ) {
      editor.chain().acceptNodeSuggestion(suggestionId).run();
    } else {
      acceptSuggestion(editor, suggestionId);
    }
    editThreadMetadata({ threadId, metadata: { status: "accepted" } });
    markThreadAsResolved(threadId);
    // Save a clean snapshot after accepting (document content changed)
    onSnapshotSave?.();
  };

  const handleReject = (
    threadId: string,
    suggestionId: string,
    changeType: string,
  ) => {
    if (!editor) return;
    if (changeType === "tableInsert") {
      editor.chain().rejectNodeSuggestion(suggestionId, "insert").run();
    } else if (changeType === "tableDelete") {
      editor.chain().rejectNodeSuggestion(suggestionId, "delete").run();
    } else if (changeType === "nodeFormat") {
      editor.chain().rejectNodeSuggestion(suggestionId).run();
    } else {
      rejectSuggestion(editor, suggestionId);
    }
    editThreadMetadata({ threadId, metadata: { status: "rejected" } });
    markThreadAsResolved(threadId);
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
        <div ref={containerRef} className="suggestion-threads-panel">
          {sortedSuggestionThreads.map((thread) => {
            const suggestionId = thread.metadata?.suggestionId as string;
            const changeType = thread.metadata?.changeType as string;
            const topOffset = threadPositions.get(thread.id);

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
