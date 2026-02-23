"use client";

import { ClientSideSuspense, useThreads, useEditThreadMetadata } from "@liveblocks/react/suspense";
import { AnchoredThreads, FloatingComposer, FloatingThreads } from "@liveblocks/react-tiptap";
import { Thread } from "@liveblocks/react-ui";
import { Editor } from "@tiptap/react";
import { useSelf } from "@liveblocks/react/suspense";
import { acceptSuggestion, rejectSuggestion } from "@/lib/suggestion-helpers";
import { useEffect } from "react";
import { CheckIcon, XIcon } from "lucide-react";

export const Threads = ({ editor }: { editor: Editor | null }) => {
  return (
    <ClientSideSuspense fallback={<></>}>
      <ThreadsList editor={editor} />
    </ClientSideSuspense>
  );
};

export function ThreadsList({ editor }: { editor: Editor | null }) {
  const { threads } = useThreads({ query: { resolved: false } });
  const currentUser = useSelf();
  const isOwner = currentUser?.info?.isOwner === true;
  const editThreadMetadata = useEditThreadMetadata();

  // Debug: log threads
  useEffect(() => {
    console.log('[Threads] All threads:', threads.length);
    threads.forEach(t => {
      console.log('[Threads] Thread:', t.id, 'metadata:', t.metadata);
    });
  }, [threads]);

  // Separate suggestion threads from regular comment threads
  const suggestionThreads = threads.filter(t => t.metadata?.suggestionId);
  const regularThreads = threads.filter(t => !t.metadata?.suggestionId);

  const handleAccept = (threadId: string, suggestionId: string, metadata: Record<string, unknown>) => {
    if (!editor) return;
    console.log('[Threads] Accepting suggestion:', suggestionId);
    acceptSuggestion(editor, suggestionId);
    editThreadMetadata({
      threadId,
      metadata: {
        ...metadata,
        status: "accepted",
        resolved: true,
      },
    });
  };

  const handleReject = (threadId: string, suggestionId: string, metadata: Record<string, unknown>) => {
    if (!editor) return;
    console.log('[Threads] Rejecting suggestion:', suggestionId);
    rejectSuggestion(editor, suggestionId);
    editThreadMetadata({
      threadId,
      metadata: {
        ...metadata,
        status: "rejected",
        resolved: true,
      },
    });
  };

  return (
    <>
      {/* Regular comment threads (anchored to text) */}
      <div className="anchored-threads">
        <AnchoredThreads editor={editor} threads={regularThreads} />
      </div>

      {/* Suggestion threads rendered with full Liveblocks Thread component */}
      {suggestionThreads.length > 0 && (
        <div className="suggestion-threads-panel">
          {suggestionThreads.map((thread) => {
            const suggestionId = thread.metadata?.suggestionId as string;
            const changeType = thread.metadata?.changeType as string;
            const status = thread.metadata?.status as string;

            if (status !== "pending") return null;

            return (
              <div key={thread.id} className="suggestion-thread-wrapper">
                {/* Label showing this is a suggestion */}
                <div className="suggestion-thread-label">
                  <span className={`suggestion-badge ${changeType === 'insert' ? 'suggestion-badge-insert' : 'suggestion-badge-delete'}`}>
                    {changeType === 'insert' ? '+ Insertion' : '− Deletion'}
                  </span>
                </div>

                {/* Full Liveblocks Thread component - supports commenting, replying */}
                <Thread thread={thread} className="suggestion-thread" />

                {/* Accept/Reject buttons for owners */}
                {isOwner && (
                  <div className="suggestion-actions-bar">
                    <button
                      className="suggestion-accept-btn"
                      onClick={() => handleAccept(thread.id, suggestionId, thread.metadata as Record<string, unknown>)}
                    >
                      <CheckIcon className="w-4 h-4 mr-1.5" />
                      Accept
                    </button>
                    <button
                      className="suggestion-reject-btn"
                      onClick={() => handleReject(thread.id, suggestionId, thread.metadata as Record<string, unknown>)}
                    >
                      <XIcon className="w-4 h-4 mr-1.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FloatingThreads editor={editor} threads={regularThreads} className="floating-threads" />
      <FloatingComposer editor={editor} className="floating-composer" />
    </>
  );
}
