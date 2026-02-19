import { Mark, mergeAttributes } from "@tiptap/core";

export interface SuggestionOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestion: {
      setSuggestionInsert: (attributes?: { suggestionId: string; userId: string; commentThreadId: string; timestamp: number }) => ReturnType;
      setSuggestionDelete: (attributes?: { suggestionId: string; userId: string; commentThreadId: string; timestamp: number }) => ReturnType;
      unsetSuggestion: (suggestionId: string) => ReturnType;
      acceptSuggestion: (suggestionId: string) => ReturnType;
      rejectSuggestion: (suggestionId: string) => ReturnType;
    };
  }
}

export const SuggestionInsert = Mark.create<SuggestionOptions>({
  name: "suggestionInsert",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-suggestion-id"),
        renderHTML: (attributes) => {
          if (!attributes.suggestionId) {
            return {};
          }
          return {
            "data-suggestion-id": attributes.suggestionId,
          };
        },
      },
      userId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-user-id"),
        renderHTML: (attributes) => {
          if (!attributes.userId) {
            return {};
          }
          return {
            "data-user-id": attributes.userId,
          };
        },
      },
      commentThreadId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-thread-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentThreadId) {
            return {};
          }
          return {
            "data-comment-thread-id": attributes.commentThreadId,
          };
        },
      },
      timestamp: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-timestamp"),
        renderHTML: (attributes) => {
          if (!attributes.timestamp) {
            return {};
          }
          return {
            "data-timestamp": attributes.timestamp,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-suggestion-insert]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-suggestion-insert": "",
        class: "suggestion-insert",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestionInsert:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetSuggestion:
        (suggestionId) =>
        ({ tr, state }) => {
          const { doc } = state;
          let modified = false;

          doc.descendants((node, pos) => {
            if (node.isText) {
              node.marks.forEach((mark) => {
                if (
                  (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") &&
                  mark.attrs.suggestionId === suggestionId
                ) {
                  tr.removeMark(pos, pos + node.nodeSize, mark.type);
                  modified = true;
                }
              });
            }
          });

          return modified;
        },
      acceptSuggestion:
        (suggestionId) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          let modified = false;

          doc.descendants((node, pos) => {
            if (node.isText) {
              node.marks.forEach((mark) => {
                if (mark.attrs.suggestionId === suggestionId) {
                  if (mark.type.name === "suggestionInsert") {
                    // For insert: just remove the mark, keep the text
                    tr.removeMark(pos, pos + node.nodeSize, mark.type);
                    modified = true;
                  } else if (mark.type.name === "suggestionDelete") {
                    // For delete: remove the mark AND the text
                    tr.delete(pos, pos + node.nodeSize);
                    modified = true;
                  }
                }
              });
            }
          });

          if (dispatch && modified) {
            dispatch(tr);
          }

          return modified;
        },
      rejectSuggestion:
        (suggestionId) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          let modified = false;

          doc.descendants((node, pos) => {
            if (node.isText) {
              node.marks.forEach((mark) => {
                if (mark.attrs.suggestionId === suggestionId) {
                  if (mark.type.name === "suggestionInsert") {
                    // For insert: remove the mark AND the text
                    tr.delete(pos, pos + node.nodeSize);
                    modified = true;
                  } else if (mark.type.name === "suggestionDelete") {
                    // For delete: just remove the mark, keep the text
                    tr.removeMark(pos, pos + node.nodeSize, mark.type);
                    modified = true;
                  }
                }
              });
            }
          });

          if (dispatch && modified) {
            dispatch(tr);
          }

          return modified;
        },
    };
  },
});

export const SuggestionDelete = Mark.create<SuggestionOptions>({
  name: "suggestionDelete",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-suggestion-id"),
        renderHTML: (attributes) => {
          if (!attributes.suggestionId) {
            return {};
          }
          return {
            "data-suggestion-id": attributes.suggestionId,
          };
        },
      },
      userId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-user-id"),
        renderHTML: (attributes) => {
          if (!attributes.userId) {
            return {};
          }
          return {
            "data-user-id": attributes.userId,
          };
        },
      },
      commentThreadId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-thread-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentThreadId) {
            return {};
          }
          return {
            "data-comment-thread-id": attributes.commentThreadId,
          };
        },
      },
      timestamp: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-timestamp"),
        renderHTML: (attributes) => {
          if (!attributes.timestamp) {
            return {};
          }
          return {
            "data-timestamp": attributes.timestamp,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-suggestion-delete]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-suggestion-delete": "",
        class: "suggestion-delete",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestionDelete:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
    };
  },
});
