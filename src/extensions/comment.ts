/* eslint-disable @typescript-eslint/no-explicit-any */
import { Mark } from "@tiptap/core";

export interface CommentOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Set a comment mark
       */
      setComment: (commentId: string) => ReturnType;
      /**
       * Toggle a comment mark
       */
      toggleComment: (commentId: string) => ReturnType;
      /**
       * Unset a comment mark
       */
      unsetComment: () => ReturnType;
      /**
       * Add a pending comment (for selection)
       */
      addPendingComment: () => ReturnType;
    };
  }
}

export const Comment = Mark.create<CommentOptions>({
  name: "comment",
  
  priority: 1000, // High priority to parse before other extensions

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },


  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentId) {
            return {};
          }

          return {
            "data-comment-id": attributes.commentId,
          };
        },
      },
      pending: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-pending") === "true",
        renderHTML: (attributes) => {
          if (!attributes.pending) {
            return {};
          }

          return {
            "data-pending": "true",
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          const element = node as HTMLElement;
          const commentId = element.getAttribute("data-comment-id");
          const pending = element.getAttribute("data-pending") === "true";

          if (!commentId) return false;

          return {
            commentId,
            pending,
          };
        },
      },
      {
        tag: "span.comment-mark",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          const element = node as HTMLElement;
          const commentId = element.getAttribute("data-comment-id");
          const pending = element.getAttribute("data-pending") === "true";

          if (!commentId) return false;

          return {
            commentId,
            pending,
          };
        },
      },
    ];
  },

  renderHTML({ mark }) {
    const attrs: Record<string, string> = {
      class: "comment-mark",
      style:
        "background-color: rgba(255, 212, 0, 0.3); cursor: pointer; border-bottom: 2px solid rgba(255, 212, 0, 0.8); padding: 2px 0;",
    };

    if (mark.attrs.commentId) {
      attrs["data-comment-id"] = mark.attrs.commentId;
    }

    if (mark.attrs.pending) {
      attrs["data-pending"] = "true";
    }

    return ["span", attrs, 0] as any;
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId });
        },
      toggleComment:
        (commentId: string) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { commentId });
        },
      unsetComment:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      addPendingComment:
        () =>
        ({ commands, state, view }) => {
          const { from, to } = state.selection;

          // Check if there's a selection
          if (from === to) {
            return false;
          }

          // Generate a temporary ID for the pending comment
          const tempId = `pending-${Date.now()}`;

          // Apply the mark with pending flag
          const result = commands.setMark(this.name, {
            commentId: tempId,
            pending: true,
          });

          // Dispatch a custom event to notify the UI
          if (result) {
            setTimeout(() => {
              const event = new CustomEvent("comment:pending", {
                detail: { commentId: tempId },
              });
              view.dom.dispatchEvent(event);
            }, 100);
          }

          return result;
        },
      updateCommentMark:
        (oldCommentId: string, newCommentId: string) =>
        ({ state, tr }: any) => {
          const { doc } = state;

          // Find and update all marks with the old commentId
          doc.descendants((node: any, pos: any) => {
            if (node.marks) {
              node.marks.forEach((mark: any) => {
                if (
                  mark.type.name === "comment" &&
                  mark.attrs.commentId === oldCommentId
                ) {
                  // Update the mark attributes
                  const newMark = mark.type.create({
                    commentId: newCommentId,
                    pending: false,
                  });

                  tr.removeMark(pos, pos + node.nodeSize, mark.type);
                  tr.addMark(pos, pos + node.nodeSize, newMark);
                }
              });
            }
          });

          return true;
        },
    };
  },
});
