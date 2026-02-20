"use client";

import { ClientSideSuspense, useThreads, useEditThreadMetadata } from "@liveblocks/react/suspense";
import { AnchoredThreads, FloatingComposer, FloatingThreads } from "@liveblocks/react-tiptap";
import { Editor } from "@tiptap/react";
import { useSelf } from "@liveblocks/react/suspense";
import { acceptSuggestion, rejectSuggestion } from "@/lib/suggestion-helpers";
import { useEffect } from "react";

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

  // Inject suggestion action buttons into thread UI
  useEffect(() => {
    if (!editor || !isOwner) return;

    const interval = setInterval(() => {
      // Find all thread elements
      const threadElements = document.querySelectorAll('[data-thread-id]');
      
      threadElements.forEach((threadEl) => {
        const threadId = threadEl.getAttribute('data-thread-id');
        if (!threadId) return;

        // Find the matching thread data
        const thread = threads.find((t) => t.id === threadId);
        if (!thread) return;

        const suggestionId = thread.metadata?.suggestionId as string | undefined;
        const status = thread.metadata?.status as string | undefined;

        // Only add buttons for pending suggestions
        if (!suggestionId || status !== "pending") return;

        // Check if buttons already exist
        if (threadEl.querySelector('.suggestion-actions')) return;

        // Find the composer (where users type replies) - we want to put buttons above it
        const threadComposer = threadEl.querySelector('.lb-tiptap-composer');
        if (!threadComposer) return;

        // Create button container
        const actionDiv = document.createElement('div');
        actionDiv.className = 'suggestion-actions flex gap-2 px-3 py-2 border-t border-b bg-gray-50';
        actionDiv.innerHTML = `
          <button class="accept-btn flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white h-9 px-3 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Accept ${thread.metadata?.changeType === 'insert' ? 'Insertion' : 'Deletion'}
          </button>
          <button class="reject-btn flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 bg-white h-9 px-3 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Reject ${thread.metadata?.changeType === 'insert' ? 'Insertion' : 'Deletion'}
          </button>
        `;

        // Add event listeners
        const acceptBtn = actionDiv.querySelector('.accept-btn');
        const rejectBtn = actionDiv.querySelector('.reject-btn');

        if (acceptBtn) {
          acceptBtn.addEventListener('click', async () => {
            console.log('[Threads] Accepting suggestion:', suggestionId);
            acceptSuggestion(editor, suggestionId);
            await editThreadMetadata({
              threadId: thread.id,
              metadata: {
                ...thread.metadata,
                status: "accepted",
                resolved: true,
              },
            });
          });
        }

        if (rejectBtn) {
          rejectBtn.addEventListener('click', async () => {
            console.log('[Threads] Rejecting suggestion:', suggestionId);
            rejectSuggestion(editor, suggestionId);
            await editThreadMetadata({
              threadId: thread.id,
              metadata: {
                ...thread.metadata,
                status: "rejected",
                resolved: true,
              },
            });
          });
        }

        // Insert buttons above the composer (before it in DOM)
        threadComposer.parentNode?.insertBefore(actionDiv, threadComposer);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [editor, isOwner, threads, editThreadMetadata]);

  // Show ALL threads together (both suggestions and regular comments)
  return (
    <>
      <div className="anchored-threads">
        <AnchoredThreads editor={editor} threads={threads} />
      </div>
      
      <FloatingThreads editor={editor} threads={threads} className="floating-threads" />
      <FloatingComposer editor={editor} className="floating-composer" />
    </>
  );
}
