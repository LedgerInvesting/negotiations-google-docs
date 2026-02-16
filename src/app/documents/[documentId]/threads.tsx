"use client";

import { useEditorStore } from "@/store/use-editor-store";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { MessageSquare, X, Reply, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { apiClient, type Comment as ApiComment } from "@/lib/api-client";
import { useSocket } from "@/hooks/use-socket";

interface CommentThread {
  id: string;
  dbId: number;
  text: string;
  author: string;
  authorId: string;
  timestamp: string;
  replies: CommentReply[];
}

interface CommentReply {
  id: string;
  dbId: number;
  text: string;
  author: string;
  authorId: string;
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
  const [commentPositions, setCommentPositions] = useState<
    Record<string, number>
  >({});

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
          authorId: c.author_id,
          timestamp: c.created_at,
          replies: [],
        });
      } else {
        replies.push({
          id: c.comment_id,
          dbId: c.id,
          text: c.text,
          author: c.author_name,
          authorId: c.author_id,
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
                    authorId: comment.author_id,
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
              authorId: comment.author_id,
              timestamp: comment.created_at,
              replies: [],
            },
          ];
        }
      });
    };

    const handleCommentDeleted = ({ commentId }: { commentId: string }) => {
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

  // Calculate positions of comment marks in the editor
  useEffect(() => {
    if (!editor) return;

    const calculatePositions = () => {
      const positions: Record<string, number> = {};
      const editorElement = editor.view.dom;
      const editorRect = editorElement.getBoundingClientRect();

      // Find all comment marks in the document
      const commentMarks = editorElement.querySelectorAll("[data-comment-id]");

      commentMarks.forEach((mark) => {
        const commentId = mark.getAttribute("data-comment-id");
        if (commentId) {
          const markRect = mark.getBoundingClientRect();
          // Calculate position relative to the editor's parent container
          const relativeTop = markRect.top - editorRect.top;
          positions[commentId] = relativeTop;
        }
      });

      setCommentPositions(positions);
    };

    // Calculate positions initially
    calculatePositions();

    // Recalculate on editor updates
    const handleUpdate = () => {
      calculatePositions();
    };

    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);

    // Recalculate on scroll and resize
    window.addEventListener("scroll", calculatePositions, true);
    window.addEventListener("resize", calculatePositions);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
      window.removeEventListener("scroll", calculatePositions, true);
      window.removeEventListener("resize", calculatePositions);
    };
  }, [editor, threads, activeCommentId]);

  useEffect(() => {
    if (!editor) return;

    // Listen for pending comment events from the extension
    const handlePendingComment = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commentId = customEvent.detail?.commentId;
      if (commentId) {
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
          // Show existing thread and start a reply
          const existingThread = threads.find((t) => t.id === commentId);
          if (existingThread) {
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

            // Automatically start a reply
            setReplyingTo({
              threadId: existingThread.id,
              dbId: existingThread.dbId,
            });
            setReplyText("");

            // Focus the reply textarea after a short delay to ensure it's rendered
            setTimeout(() => {
              const replyTextarea = document.querySelector(
                `#thread-${commentId} textarea`,
              ) as HTMLTextAreaElement;
              if (replyTextarea) {
                replyTextarea.focus();
              }
            }, 100);
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
        id: dbComment.comment_id, // Use the real DB comment_id
        dbId: dbComment.id,
        text: commentText,
        author: authorName,
        authorId: user?.id || "anonymous",
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

      // Update the mark with the real comment_id from the database
      if (
        editor &&
        activeCommentId &&
        dbComment.comment_id !== activeCommentId
      ) {
        // Find and update all marks with the pending commentId
        const { tr, doc } = editor.state;
        let updated = false;

        doc.descendants((node, pos) => {
          if (node.marks) {
            node.marks.forEach((mark) => {
              if (
                mark.type.name === "comment" &&
                mark.attrs.commentId === activeCommentId
              ) {
                // Remove old mark
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
                // Add new mark with real DB ID and pending = false
                tr.addMark(
                  pos,
                  pos + node.nodeSize,
                  mark.type.create({
                    commentId: dbComment.comment_id,
                    pending: false,
                  }),
                );
                updated = true;
              }
            });
          }
        });

        if (updated) {
          editor.view.dispatch(tr);

          // Force immediate save after updating the mark
          setTimeout(async () => {
            const content = editor.getHTML();

            try {
              const token = await getToken();
              await apiClient.updateDocument(token, documentId, { content });
            } catch (error) {
              console.error("Failed to save content:", error);
            }

            if (socketData.socket) {
              socketData.socket.emit("document-update", {
                roomId,
                content,
              });
            }
          }, 100);
        }
      }

      setActiveCommentId(null);
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
        id: dbComment.comment_id, // Use the real DB comment_id
        dbId: dbComment.id,
        text: replyText,
        author: authorName,
        authorId: user?.id || "anonymous",
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

  const handleCommentClick = (commentId: string) => {
    if (!editor) return;

    // Find the position of the comment mark in the document
    const { doc } = editor.state;
    let markPosition: { from: number; to: number } | null = null;

    doc.descendants((node, pos) => {
      if (markPosition) return false; // Stop if we already found it

      if (node.marks) {
        node.marks.forEach((mark) => {
          if (
            mark.type.name === "comment" &&
            mark.attrs.commentId === commentId
          ) {
            markPosition = {
              from: pos,
              to: pos + node.nodeSize,
            };
          }
        });
      }
    });

    // If found, move cursor to that position and scroll into view
    if (markPosition) {
      editor.commands.setTextSelection(markPosition);
      editor.commands.focus();

      // Scroll the mark into view
      const markElement = editor.view.dom.querySelector(
        `[data-comment-id="${commentId}"]`,
      );
      if (markElement) {
        markElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      const token = await getToken();
      await apiClient.deleteComment(token, commentId);

      // Remove from local state
      setThreads((prevThreads) =>
        prevThreads.filter((t) => t.id !== commentId),
      );

      // Remove the comment mark from the editor
      if (editor) {
        const { tr, doc } = editor.state;
        let updated = false;

        doc.descendants((node, pos) => {
          if (node.marks) {
            node.marks.forEach((mark) => {
              if (
                mark.type.name === "comment" &&
                mark.attrs.commentId === commentId
              ) {
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
                updated = true;
              }
            });
          }
        });

        if (updated) {
          editor.view.dispatch(tr);

          // Force immediate save and broadcast
          setTimeout(async () => {
            const content = editor.getHTML();
            try {
              const token = await getToken();
              await apiClient.updateDocument(token, documentId, { content });
            } catch (error) {
              console.error("Failed to save content:", error);
            }

            if (socketData.socket) {
              socketData.socket.emit("document-update", {
                roomId,
                content,
              });
            }
          }, 100);
        }
      }

      // Broadcast deletion to other users
      if (socketData.socket) {
        socketData.socket.emit("comment:delete", {
          roomId,
          commentId,
        });
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
      alert("Failed to delete comment. Please try again.");
    }
  };

  if (isLoading) {
    return null;
  }

  if (!activeCommentId && threads.length === 0) {
    return null;
  }

  // Calculate final positions with overlap handling
  const getThreadPosition = (threadId: string): number => {
    const basePosition = commentPositions[threadId] || 0;

    // Check for overlaps with previous threads and adjust if needed
    let adjustedPosition = basePosition;
    const minSpacing = 16; // minimum gap between comments

    // Get all threads before this one
    const allThreadIds = [
      ...(activeCommentId ? [activeCommentId] : []),
      ...threads.map((t) => t.id),
    ];
    const currentIndex = allThreadIds.indexOf(threadId);

    for (let i = 0; i < currentIndex; i++) {
      const prevThreadId = allThreadIds[i];
      const prevPosition = commentPositions[prevThreadId] || 0;
      const prevElement = document.getElementById(`thread-${prevThreadId}`);
      const prevHeight = prevElement?.offsetHeight || 200; // estimate if not found

      const prevBottom = prevPosition + prevHeight + minSpacing;
      if (adjustedPosition < prevBottom) {
        adjustedPosition = prevBottom;
      }
    }

    return adjustedPosition;
  };

  return (
    <div className="w-80 flex-shrink-0 relative" style={{ minHeight: "100vh" }}>
      {/* Active comment input */}
      {activeCommentId && (
        <Card
          className="p-4 shadow-lg border-2 border-blue-500 absolute left-0 w-full"
          style={{ top: `${getThreadPosition(activeCommentId)}px` }}
        >
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
            onKeyDown={(e) =>
              e.key.toUpperCase() === "ENTER" && handleAddReply()
            }
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
          className="p-4 shadow-md group absolute left-0 w-full hover:shadow-lg transition-shadow"
          style={{ top: `${getThreadPosition(thread.id)}px` }}
        >
          {/* Main comment */}
          <div
            className="mb-2 cursor-pointer hover:bg-gray-50"
            onClick={() => handleCommentClick(thread.id)}
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1">
                <span className="font-semibold text-sm">{thread.author}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {new Date(thread.timestamp).toLocaleString()}
                </span>
              </div>
              {thread.authorId === user?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteComment(thread.id)}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete comment"
                >
                  <Trash2 className="size-3 text-red-500" />
                </Button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap mb-2">
              {thread.text}
            </p>
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
                onClick={(e) => {
                  e.stopPropagation();
                  setReplyingTo({ threadId: thread.id, dbId: thread.dbId });
                }}
                className="h-7 px-2 text-xs"
              >
                <Reply className="size-3 mr-1" />
                Reply
              </Button>
            )}
          </div>

          {/* Reply input */}
          {replyingTo?.threadId === thread.id && (
            <div className="mt-3">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) =>
                  e.key.toUpperCase() === "ENTER" && handleAddReply()
                }
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
