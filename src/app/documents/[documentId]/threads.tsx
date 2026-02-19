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

  // Debug: log threads
  useEffect(() => {
    console.log('All threads:', threads);
    console.log('Suggestion threads:', threads.filter(t => t.metadata?.suggestionId));
  }, [threads]);

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

        // Find the thread body to append buttons
        const threadBody = threadEl.querySelector('.lb-root');
        if (!threadBody) return;

        // Create button container
        const actionDiv = document.createElement('div');
        actionDiv.className = 'suggestion-actions flex gap-2 mt-2 pt-2 border-t px-3 pb-2';
        actionDiv.innerHTML = `
          <button class="accept-btn flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white h-9 px-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Accept
          </button>
          <button class="reject-btn flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 bg-white h-9 px-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            Reject
          </button>
        `;

        // Add event listeners
        const acceptBtn = actionDiv.querySelector('.accept-btn');
        const rejectBtn = actionDiv.querySelector('.reject-btn');

        if (acceptBtn) {
          acceptBtn.addEventListener('click', () => {
            acceptSuggestion(editor, suggestionId);
            editThreadMetadata({
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
          rejectBtn.addEventListener('click', () => {
            rejectSuggestion(editor, suggestionId);
            editThreadMetadata({
              threadId: thread.id,
              metadata: {
                ...thread.metadata,
                status: "rejected",
                resolved: true,
              },
            });
          });
        }

        // Append to thread body
        threadBody.appendChild(actionDiv);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [editor, isOwner, threads, editThreadMetadata]);

  // Separate suggestion threads from regular threads
  const suggestionThreads = threads.filter(t => t.metadata?.suggestionId);
  const regularThreads = threads.filter(t => !t.metadata?.suggestionId);

  return (
    <>
      <div className="anchored-threads">
        <AnchoredThreads editor={editor} threads={regularThreads} />
      </div>
      
      {/* Show suggestion threads in floating UI */}
      {suggestionThreads.length > 0 && (
        <div className="fixed right-8 top-24 w-80 max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 z-50">
          <div className="bg-white rounded-lg shadow-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">Pending Suggestions</h3>
            {suggestionThreads.map((thread) => {
              const suggestionId = thread.metadata?.suggestionId as string;
              const changeType = thread.metadata?.changeType as string;
              const status = thread.metadata?.status as string;
              
              if (status !== 'pending') return null;
              
              return (
                <div key={thread.id} className="mb-4 p-3 border rounded-md bg-gray-50">
                  <div className="text-xs text-gray-500 mb-1">
                    {changeType === 'insert' ? '+ Insertion' : '- Deletion'}
                  </div>
                  <div className="text-sm mb-2">
                    {(() => {
                      const firstComment = thread.comments[0];
                      const firstContent = firstComment?.body?.content?.[0];
                      const firstChild = firstContent?.children?.[0];
                      return (firstChild && 'text' in firstChild ? firstChild.text : 'Suggested change');
                    })()}
                  </div>
                  
                  {isOwner && (
                    <div className="flex gap-2 mt-2">
                      <button
                        className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                        onClick={() => {
                          if (editor) {
                            acceptSuggestion(editor, suggestionId);
                            editThreadMetadata({
                              threadId: thread.id,
                              metadata: {
                                ...thread.metadata,
                                status: "accepted",
                                resolved: true,
                              },
                            });
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Accept
                      </button>
                      <button
                        className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 bg-white h-8 px-3"
                        onClick={() => {
                          if (editor) {
                            rejectSuggestion(editor, suggestionId);
                            editThreadMetadata({
                              threadId: thread.id,
                              metadata: {
                                ...thread.metadata,
                                status: "rejected",
                                resolved: true,
                              },
                            });
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <FloatingThreads editor={editor} threads={regularThreads} className="floating-threads" />
      <FloatingComposer editor={editor} className="floating-composer" />
    </>
  );
}
