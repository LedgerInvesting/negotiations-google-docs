"use client";

import { useEditorStore } from "@/store/use-editor-store";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { MessageSquare, X, Reply } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { apiClient, type Comment as ApiComment } from "@/lib/api-client";
import { useSocket } from "@/hooks/use-socket";

interface CommentThread {
  id: string;
  dbId: number;
  text: string;
  author: string;
  timestamp: string;
  replies: CommentReply[];
}

interface CommentReply {
  id: string;
  dbId: number;
  text: string;
  author: string;
  timestamp: string;
  parentId: number;
}

interface ThreadsProps {
  documentId: number;
  roomId: string;
}

export const Threads = ({ documentId, roomId }: ThreadsProps) => {
  const { editor } = useEditorStore();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    threadId: string;
    dbId: number;
  } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Get socket connection
  const socketData = useSocket({
    roomId,
    userInfo: {
      id: user?.id || "anonymous",
      name: user?.fullName || user?.firstName || "Anonymous",
      avatar: user?.imageUrl || "",
      color: "#000000",
    },
  });

  // Organize comments into threads
  const organizeThreads = (comments: ApiComment[]): CommentThread[] => {
    const threadMap = new Map<string, CommentThread>();
    const replies: CommentReply[] = [];

    // First pass: create threads from parent comments
    comments.forEach((c) => {
      if (!c.parent_id) {
        threadMap.set(c.comment_id, {
          id: c.comment_id,
          dbId: c.id,
          text: c.text,
          author: c.author_name,
          timestamp: c.created_at,
          replies: [],
        });
      } else {
        replies.push({
          id: c.comment_id,
          dbId: c.id,
          text: c.text,
          author: c.author_name,
          timestamp: c.created_at,
          parentId: c.parent_id,
        });
      }
    });

    // Second pass: attach replies to their parent threads
    replies.forEach((reply) => {
      // Find the parent thread by dbId
      const parentThread = Array.from(threadMap.values()).find(
        (t) => t.dbId === reply.parentId,
      );
      if (parentThread) {
        parentThread.replies.push(reply);
      }
    });

    return Array.from(threadMap.values());
  };

  // Load comments from database on mount
  useEffect(() => {
    const loadComments = async () => {
      try {
        const token = await getToken();
        const { comments: dbComments } = await apiClient.getComments(
          token,
          documentId,
        );

        const organizedThreads = organizeThreads(dbComments);
        setThreads(organizedThreads);
      } catch (error) {
        console.error("Failed to load comments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadComments();
  }, [documentId, getToken]);

  // Listen for comment updates from other users via WebSocket
  useEffect(() => {
    if (!socketData.socket) return;

    const handleCommentCreated = ({ comment }: { comment: ApiComment }) => {
      console.log("📩 Received new comment from another user:", comment);

      setThreads((prevThreads) => {
        // Check if it's a reply or a new thread
        if (comment.parent_id) {
          // It's a reply
          const newThreads = prevThreads.map((thread) => {
            if (thread.dbId === comment.parent_id) {
              // Check if reply already exists
              if (thread.replies.some((r) => r.id === comment.comment_id)) {
                return thread;
              }
              return {
                ...thread,
                replies: [
                  ...thread.replies,
                  {
                    id: comment.comment_id,
                    dbId: comment.id,
                    text: comment.text,
                    author: comment.author_name,
                    timestamp: comment.created_at,
                    parentId: comment.parent_id,
                  },
                ],
              };
            }
            return thread;
          });
          return newThreads;
        } else {
          // It's a new thread
          // Check if thread already exists
          if (prevThreads.some((t) => t.id === comment.comment_id)) {
            return prevThreads;
          }
          return [
            ...prevThreads,
            {
              id: comment.comment_id,
              dbId: comment.id,
              text: comment.text,
              author: comment.author_name,
              timestamp: comment.created_at,
              replies: [],
            },
          ];
        }
      });
    };

    const handleCommentDeleted = ({ commentId }: { commentId: string }) => {
      console.log("🗑️ Comment deleted by another user:", commentId);
      setThreads((prevThreads) => {
        // Remove thread or reply
        return prevThreads
          .filter((t) => t.id !== commentId)
          .map((thread) => ({
            ...thread,
            replies: thread.replies.filter((r) => r.id !== commentId),
          }));
      });
    };

    socketData.socket.on("comment:created", handleCommentCreated);
    socketData.socket.on("comment:deleted", handleCommentDeleted);

    return () => {
      socketData.socket?.off("comment:created", handleCommentCreated);
      socketData.socket?.off("comment:deleted", handleCommentDeleted);
    };
  }, [socketData.socket]);

  useEffect(() => {
    if (!editor) return;

    // Listen for pending comment events from the extension
    const handlePendingComment = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commentId = customEvent.detail?.commentId;
      if (commentId) {
        console.log("🎯 Opening comment thread for:", commentId);
        setActiveCommentId(commentId);
        setCommentText("");
        setReplyingTo(null);
      }
    };

    // Listen for clicks on comment marks
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const commentMark = target.closest("[data-comment-id]");

      if (commentMark) {
        const commentId = commentMark.getAttribute("data-comment-id");
        const isPending = commentMark.getAttribute("data-pending") === "true";

        if (isPending && commentId) {
          setActiveCommentId(commentId);
          setCommentText("");
          setReplyingTo(null);
        } else if (commentId) {
          // Show existing thread
          const existingThread = threads.find((t) => t.id === commentId);
          if (existingThread) {
            console.log("Viewing thread:", existingThread);
            // Scroll to the thread in the sidebar
            const threadElement = document.getElementById(
              `thread-${commentId}`,
            );
            if (threadElement) {
              threadElement.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              });
            }
          }
        }
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("comment:pending", handlePendingComment);
    editorElement.addEventListener("click", handleClick);

    return () => {
      editorElement.removeEventListener(
        "comment:pending",
        handlePendingComment,
      );
      editorElement.removeEventListener("click", handleClick);
    };
  }, [editor, threads]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !activeCommentId) return;

    const authorName = user?.fullName || user?.firstName || "Anonymous";

    try {
      // Save to database
      const token = await getToken();
      const { comment: dbComment } = await apiClient.createComment(
        token,
        documentId,
        {
          commentId: activeCommentId,
          text: commentText,
          authorName,
        },
      );

      const newThread: CommentThread = {
        id: activeCommentId,
        dbId: dbComment.id,
        text: commentText,
        author: authorName,
        timestamp: new Date().toISOString(),
        replies: [],
      };

      // Add to local state
      setThreads([...threads, newThread]);

      // Broadcast to other users via WebSocket
      if (socketData.socket) {
        socketData.socket.emit("comment:create", {
          roomId,
          comment: dbComment,
        });
      }

      setCommentText("");
      setActiveCommentId(null);

      // Update the comment mark to remove pending status and broadcast
      if (editor) {
        // The mark exists, just remove pending flag by re-applying
        editor.chain().focus().run();

        // Force a content save to ensure marks are persisted and broadcast to all users
        setTimeout(() => {
          const content = editor.getHTML();
          // Trigger immediate save and broadcast
          (async () => {
            try {
              const token = await getToken();
              await apiClient.updateDocument(token, documentId, { content });
              console.log("💾 Comment marks saved to database");
            } catch (error) {
              console.error("Failed to save comment marks:", error);
            }
          })();
          // Broadcast to other users via WebSocket so they see the highlight
          if (socketData.socket) {
            socketData.socket.emit("document-update", {
              roomId,
              content,
            });
            console.log("📤 Comment highlights broadcast to other users");
          }
        }, 100);
      }

      console.log("✅ Comment saved and broadcast with highlights");
    } catch (error) {
      console.error("Failed to save comment:", error);
      alert("Failed to save comment. Please try again.");
    }
  };

  const handleAddReply = async () => {
    if (!replyText.trim() || !replyingTo) return;

    const authorName = user?.fullName || user?.firstName || "Anonymous";
    const replyId = `reply-${Date.now()}`;

    try {
      // Save to database
      const token = await getToken();
      const { comment: dbComment } = await apiClient.createComment(
        token,
        documentId,
        {
          commentId: replyId,
          text: replyText,
          authorName,
          parentId: replyingTo.dbId,
        },
      );

      const newReply: CommentReply = {
        id: replyId,
        dbId: dbComment.id,
        text: replyText,
        author: authorName,
        timestamp: new Date().toISOString(),
        parentId: replyingTo.dbId,
      };

      // Add to local state
      setThreads(
        threads.map((thread) => {
          if (thread.id === replyingTo.threadId) {
            return {
              ...thread,
              replies: [...thread.replies, newReply],
            };
          }
          return thread;
        }),
      );

      // Broadcast to other users via WebSocket
      if (socketData.socket) {
        socketData.socket.emit("comment:create", {
          roomId,
          comment: dbComment,
        });
      }

      setReplyText("");
      setReplyingTo(null);

      console.log("✅ Reply saved and broadcast");
    } catch (error) {
      console.error("Failed to save reply:", error);
      alert("Failed to save reply. Please try again.");
    }
  };

  const handleCancelComment = () => {
    if (activeCommentId) {
      // Remove the pending comment mark
      editor?.chain().focus().unsetComment().run();
    }
    setActiveCommentId(null);
    setCommentText("");
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText("");
  };

  if (isLoading) {
    return null;
  }

  if (!activeCommentId && threads.length === 0) {
    return null;
  }

  return (
    <div className="absolute right-0 top-0 w-80 p-4 space-y-4 max-h-screen overflow-y-auto">
      {/* Active comment input */}
      {activeCommentId && (
        <Card className="p-4 shadow-lg border-2 border-blue-500">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4" />
              <span className="font-semibold text-sm">Add Comment</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelComment}
              className="h-6 w-6 p-0"
            >
              <X className="size-4" />
            </Button>
          </div>
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[80px] mb-2 resize-none"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={handleCancelComment}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!commentText.trim()}
            >
              Comment
            </Button>
          </div>
        </Card>
      )}

      {/* Existing comment threads */}
      {threads.map((thread) => (
        <Card
          key={thread.id}
          id={`thread-${thread.id}`}
          className="p-4 shadow-md group"
        >
          {/* Main comment */}
          <div className="mb-2">
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="font-semibold text-sm">{thread.author}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {new Date(thread.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap mb-2">{thread.text}</p>
          </div>

          {thread.replies.map((reply) => (
            <div className="mb-2" key={reply.id}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <span className="font-semibold text-sm">{reply.author}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {new Date(reply.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap mb-2">{reply.text}</p>
            </div>
          ))}

          <div className="hidden group-hover:block">
            {/* Reply button */}
            {replyingTo?.threadId !== thread.id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setReplyingTo({ threadId: thread.id, dbId: thread.dbId })
                }
                className="h-7 px-2 text-xs"
              >
                <Reply className="size-3 mr-1" />
                Reply
              </Button>
            )}
          </div>

          {/* Reply input */}
          {replyingTo?.threadId === thread.id && (
            <div className="mt-3 ml-4 pl-3 border-l-2 border-blue-300">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="min-h-[60px] mb-2 resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelReply}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddReply}
                  disabled={!replyText.trim()}
                  className="h-7 text-xs"
                >
                  Reply
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
