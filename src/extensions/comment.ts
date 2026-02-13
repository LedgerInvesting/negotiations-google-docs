import { Mark, mergeAttributes } from "@tiptap/core";

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
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "comment-mark",
        style: "background-color: rgba(255, 212, 0, 0.3); cursor: pointer;",
      }),
      0,
    ];
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
            console.log("No text selected for comment");
            return false;
          }

          // Generate a temporary ID for the pending comment
          const tempId = `pending-${Date.now()}`;
          
          // Apply the mark with pending flag
          const result = commands.setMark(this.name, { commentId: tempId, pending: true });
          
          // Dispatch a custom event to notify the UI
          if (result) {
            setTimeout(() => {
              const event = new CustomEvent('comment:pending', { detail: { commentId: tempId } });
              view.dom.dispatchEvent(event);
            }, 100);
          }
          
          return result;
        },
    };
  },
});
