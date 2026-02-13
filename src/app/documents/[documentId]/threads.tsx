"use client";

import { useEditorStore } from "@/store/use-editor-store";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { MessageSquare, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";

interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export const Threads = () => {
  const { editor } = useEditorStore();
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Load comments from localStorage
  useEffect(() => {
    const savedComments = localStorage.getItem('document-comments');
    if (savedComments) {
      try {
        setComments(JSON.parse(savedComments));
      } catch (e) {
        console.error('Failed to load comments:', e);
      }
    }
  }, []);

  // Save comments to localStorage when they change
  useEffect(() => {
    if (comments.length > 0) {
      localStorage.setItem('document-comments', JSON.stringify(comments));
    }
  }, [comments]);

  useEffect(() => {
    if (!editor) return;

    // Listen for pending comment events from the extension
    const handlePendingComment = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commentId = customEvent.detail?.commentId;
      if (commentId) {
        console.log('🎯 Opening comment thread for:', commentId);
        setActiveCommentId(commentId);
        setCommentText("");
      }
    };

    // Listen for clicks on comment marks
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const commentMark = target.closest('[data-comment-id]');
      
      if (commentMark) {
        const commentId = commentMark.getAttribute('data-comment-id');
        const isPending = commentMark.getAttribute('data-pending') === 'true';
        
        if (isPending && commentId) {
          setActiveCommentId(commentId);
          setCommentText("");
        } else if (commentId) {
          // Show existing comment
          const existingComment = comments.find(c => c.id === commentId);
          if (existingComment) {
            // You could open a view-only modal here
            console.log('Viewing comment:', existingComment);
          }
        }
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('comment:pending', handlePendingComment);
    editorElement.addEventListener('click', handleClick);

    return () => {
      editorElement.removeEventListener('comment:pending', handlePendingComment);
      editorElement.removeEventListener('click', handleClick);
    };
  }, [editor, comments]);

  const handleAddComment = () => {
    if (!commentText.trim() || !activeCommentId) return;

    const authorName = user?.fullName || user?.firstName || "Anonymous";
    
    const newComment: Comment = {
      id: activeCommentId,
      text: commentText,
      author: authorName,
      timestamp: new Date().toISOString(),
    };

    setComments([...comments, newComment]);
    setCommentText("");
    setActiveCommentId(null);

    // Update the comment mark to be non-pending
    editor?.chain().focus().run();
  };

  const handleCancelComment = () => {
    if (activeCommentId) {
      // Remove the pending comment mark
      editor?.chain().focus().unsetComment().run();
    }
    setActiveCommentId(null);
    setCommentText("");
  };

  if (!activeCommentId && comments.length === 0) {
    return null;
  }

  return (
    <div className="absolute right-0 top-0 w-80 p-4 space-y-4">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelComment}
            >
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

      {/* Existing comments */}
      {comments.map((comment) => (
        <Card key={comment.id} className="p-4 shadow-md">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="font-semibold text-sm">{comment.author}</span>
              <span className="text-xs text-gray-500 ml-2">
                {new Date(comment.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
          <p className="text-sm">{comment.text}</p>
        </Card>
      ))}
    </div>
  );
};
