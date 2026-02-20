import { Mark, mergeAttributes } from "@tiptap/core";
import type { MarkType } from "@tiptap/pm/model";

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
      cleanupInvalidSuggestions: () => ReturnType;
      validateSuggestions: () => ReturnType;
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
          console.log('[Suggestion] Accepting suggestion:', suggestionId);
          const { doc } = state;
          
          // Mark transaction to prevent suggestion mode from processing it
          tr.setMeta('suggestionMode', true);
          tr.setMeta('addToHistory', true);
          
          // Collect all positions to modify (process in reverse order to maintain positions)
          const operations: Array<{
            pos: number;
            nodeSize: number;
            type: 'removeInsertMark' | 'deleteText';
            markType: MarkType;
          }> = [];

          doc.descendants((node, pos) => {
            if (node.isText) {
              node.marks.forEach((mark) => {
                if (mark.attrs.suggestionId === suggestionId) {
                  if (mark.type.name === "suggestionInsert") {
                    // For insert: remove the mark, keep the text
                    operations.push({
                      pos,
                      nodeSize: node.nodeSize,
                      type: 'removeInsertMark',
                      markType: mark.type,
                    });
                  } else if (mark.type.name === "suggestionDelete") {
                    // For delete: remove the text (accept the deletion)
                    operations.push({
                      pos,
                      nodeSize: node.nodeSize,
                      type: 'deleteText',
                      markType: mark.type,
                    });
                  }
                }
              });
            }
          });

          // Process in reverse order to maintain positions
          operations.reverse().forEach((op) => {
            if (op.type === 'removeInsertMark') {
              tr.removeMark(op.pos, op.pos + op.nodeSize, op.markType);
            } else if (op.type === 'deleteText') {
              tr.delete(op.pos, op.pos + op.nodeSize);
            }
          });

          const modified = operations.length > 0;
          
          if (dispatch && modified) {
            console.log('[Suggestion] Dispatching accept transaction with', operations.length, 'operations');
            dispatch(tr);
          }

          return modified;
        },
      rejectSuggestion:
        (suggestionId) =>
        ({ tr, state, dispatch }) => {
          console.log('[Suggestion] Rejecting suggestion:', suggestionId);
          const { doc } = state;
          
          // Mark transaction to prevent suggestion mode from processing it
          tr.setMeta('suggestionMode', true);
          tr.setMeta('addToHistory', true);
          
          // Collect all positions to modify (process in reverse order to maintain positions)
          const operations: Array<{
            pos: number;
            nodeSize: number;
            type: 'deleteText' | 'removeDeleteMark';
            markType: MarkType;
          }> = [];

          doc.descendants((node, pos) => {
            if (node.isText) {
              node.marks.forEach((mark) => {
                if (mark.attrs.suggestionId === suggestionId) {
                  if (mark.type.name === "suggestionInsert") {
                    // For insert: remove the text (reject the insertion)
                    operations.push({
                      pos,
                      nodeSize: node.nodeSize,
                      type: 'deleteText',
                      markType: mark.type,
                    });
                  } else if (mark.type.name === "suggestionDelete") {
                    // For delete: remove the mark, keep the text (reject the deletion)
                    operations.push({
                      pos,
                      nodeSize: node.nodeSize,
                      type: 'removeDeleteMark',
                      markType: mark.type,
                    });
                  }
                }
              });
            }
          });

          // Process in reverse order to maintain positions
          operations.reverse().forEach((op) => {
            if (op.type === 'deleteText') {
              tr.delete(op.pos, op.pos + op.nodeSize);
            } else if (op.type === 'removeDeleteMark') {
              tr.removeMark(op.pos, op.pos + op.nodeSize, op.markType);
            }
          });

          const modified = operations.length > 0;
          
          if (dispatch && modified) {
            console.log('[Suggestion] Dispatching reject transaction with', operations.length, 'operations');
            dispatch(tr);
          }

          return modified;
        },
      cleanupInvalidSuggestions:
        () =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          const processedSuggestions = new Set<string>();
          const marksToRemove: Array<{
            from: number;
            to: number;
            type: MarkType;
          }> = [];

          // Find all suggestions with NO thread ID at all (not even temp)
          // We DON'T remove suggestions with temp IDs as they're waiting for thread creation
          doc.descendants((node, pos) => {
            if (node.isText) {
              node.marks.forEach((mark) => {
                if (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") {
                  const threadId = mark.attrs.commentThreadId;
                  const suggestionId = mark.attrs.suggestionId;
                  
                  // Only remove if NO thread ID at all (not null, not undefined, completely missing)
                  if (!processedSuggestions.has(suggestionId) && !threadId) {
                    marksToRemove.push({
                      from: pos,
                      to: pos + node.nodeSize,
                      type: mark.type,
                    });
                    processedSuggestions.add(suggestionId);
                  }
                }
              });
            }
          });

          // Remove invalid marks in reverse order
          marksToRemove.reverse().forEach((item) => {
            tr.removeMark(item.from, item.to, item.type);
          });

          if (dispatch && marksToRemove.length > 0) {
            dispatch(tr);
          }

          return marksToRemove.length > 0;
        },
      validateSuggestions:
        () =>
        ({ state }) => {
          const { doc } = state;
          const suggestions = new Set<string>();
          let invalidCount = 0;

          // Helper function to validate thread ID
          const isValidThreadId = (threadId: string | null | undefined): boolean => {
            if (!threadId) return false;
            if (threadId.startsWith("temp-")) return false;
            return true;
          };

          doc.descendants((node) => {
            if (node.isText) {
              node.marks.forEach((mark) => {
                if (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") {
                  const suggestionId = mark.attrs.suggestionId;
                  const threadId = mark.attrs.commentThreadId;
                  
                  if (!suggestions.has(suggestionId)) {
                    suggestions.add(suggestionId);
                    if (!isValidThreadId(threadId)) {
                      invalidCount++;
                    }
                  }
                }
              });
            }
          });

          // Return true if all suggestions are valid
          return invalidCount === 0;
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
