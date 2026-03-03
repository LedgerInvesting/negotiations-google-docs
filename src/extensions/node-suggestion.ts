import { Extension } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const NODE_SUGGESTION_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "table",
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    nodeSuggestion: {
      acceptNodeSuggestion: (suggestionId: string) => ReturnType;
      rejectNodeSuggestion: (suggestionId: string, action?: "insert" | "delete") => ReturnType;
      updateNodeSuggestionThreadId: (suggestionId: string, threadId: string) => ReturnType;
    };
  }
}

export const NodeSuggestion = Extension.create({
  name: "nodeSuggestion",

  addGlobalAttributes() {
    return [
      {
        types: NODE_SUGGESTION_TYPES,
        attributes: {
          nodeSuggestionId: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-suggestion-id") && el.hasAttribute("data-node-suggestion")
              ? el.getAttribute("data-suggestion-id")
              : null,
            renderHTML: (attrs) => {
              if (!attrs.nodeSuggestionId) return {};
              return {
                "data-suggestion-id": attrs.nodeSuggestionId,
                "data-node-suggestion": "",
              };
            },
          },
          nodeSuggestionUserId: {
            default: null,
            parseHTML: (el) => el.hasAttribute("data-node-suggestion")
              ? (el.getAttribute("data-suggestion-user-id") ?? null)
              : null,
            renderHTML: (attrs) => {
              if (!attrs.nodeSuggestionUserId) return {};
              return { "data-suggestion-user-id": attrs.nodeSuggestionUserId };
            },
          },
          nodeSuggestionCommentThreadId: {
            default: null,
            parseHTML: (el) => el.hasAttribute("data-node-suggestion")
              ? (el.getAttribute("data-suggestion-comment-thread-id") ?? null)
              : null,
            renderHTML: (attrs) => {
              if (!attrs.nodeSuggestionCommentThreadId) return {};
              return { "data-suggestion-comment-thread-id": attrs.nodeSuggestionCommentThreadId };
            },
          },
          nodeSuggestionTimestamp: {
            default: null,
            parseHTML: (el) => {
              if (!el.hasAttribute("data-node-suggestion")) return null;
              const val = el.getAttribute("data-suggestion-timestamp");
              return val ? Number(val) : null;
            },
            renderHTML: (attrs) => {
              if (!attrs.nodeSuggestionTimestamp) return {};
              return { "data-suggestion-timestamp": String(attrs.nodeSuggestionTimestamp) };
            },
          },
          nodeSuggestionOldData: {
            default: null,
            parseHTML: (el) => el.hasAttribute("data-node-suggestion")
              ? (el.getAttribute("data-suggestion-old-data") ?? null)
              : null,
            renderHTML: (attrs) => {
              if (!attrs.nodeSuggestionOldData) return {};
              return { "data-suggestion-old-data": attrs.nodeSuggestionOldData };
            },
          },
          // "insert" = pending table/node insertion; "delete" = pending table/node deletion; null = format change
          nodeSuggestionAction: {
            default: null,
            parseHTML: (el) => el.hasAttribute("data-node-suggestion")
              ? (el.getAttribute("data-suggestion-action") ?? null)
              : null,
            renderHTML: (attrs) => {
              if (!attrs.nodeSuggestionAction) return {};
              return { "data-suggestion-action": attrs.nodeSuggestionAction };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      acceptNodeSuggestion:
        (suggestionId: string) =>
        ({ tr, state, dispatch }) => {
          console.log("[NodeSuggestion] Accepting node suggestion:", suggestionId);
          tr.setMeta("suggestionMode", true);
          tr.setMeta("addToHistory", true);

          let modified = false;
          const nodesToUpdate: Array<{ pos: number; node: ProseMirrorNode }> = [];

          state.doc.descendants((node, pos) => {
            if (node.attrs.nodeSuggestionId === suggestionId) {
              nodesToUpdate.push({ pos, node });
            }
          });

          // Process in reverse so deletions don't shift earlier positions
          nodesToUpdate.reverse().forEach(({ pos, node }) => {
            if (node.attrs.nodeSuggestionAction === "delete") {
              // Accepting a deletion → remove the node from the document
              tr.delete(pos, pos + node.nodeSize);
            } else {
              // Accepting an insert or format change → keep node, strip suggestion attrs
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { nodeSuggestionId, nodeSuggestionUserId, nodeSuggestionCommentThreadId,
                      nodeSuggestionTimestamp, nodeSuggestionOldData, nodeSuggestionAction, ...cleanAttrs } = node.attrs as Record<string, unknown>;
              tr.setNodeMarkup(pos, undefined, cleanAttrs);
            }
            modified = true;
          });

          if (dispatch && modified) {
            console.log("[NodeSuggestion] Dispatching accept for", nodesToUpdate.length, "nodes");
            dispatch(tr);
          }
          return modified;
        },

      rejectNodeSuggestion:
        (suggestionId: string, action?: "insert" | "delete") =>
        ({ tr, state, dispatch }) => {
          console.log("[NodeSuggestion] Rejecting node suggestion:", suggestionId, "action:", action ?? "(from attrs)");
          tr.setMeta("suggestionMode", true);
          tr.setMeta("addToHistory", true);

          let modified = false;
          const nodesToUpdate: Array<{ pos: number; node: ProseMirrorNode }> = [];

          state.doc.descendants((node, pos) => {
            if (node.attrs.nodeSuggestionId === suggestionId) {
              nodesToUpdate.push({ pos, node });
            }
          });

          console.log("[NodeSuggestion] Found", nodesToUpdate.length, "node(s) to reject");

          // Process in reverse so deletions don't shift earlier positions
          nodesToUpdate.reverse().forEach(({ pos, node }) => {
            // Use the explicitly-passed action as the authoritative source when provided,
            // falling back to the node attribute (which may be missing after a Yjs sync).
            const effectiveAction = action ?? node.attrs.nodeSuggestionAction;
            console.log("[NodeSuggestion] Node type:", node.type.name, "effectiveAction:", effectiveAction, "attrAction:", node.attrs.nodeSuggestionAction);

            if (effectiveAction === "insert") {
              // Rejecting an insertion → delete the node from the document
              console.log("[NodeSuggestion] Deleting node at pos", pos, "nodeSize", node.nodeSize);
              tr.delete(pos, pos + node.nodeSize);
              modified = true;
              return;
            }

            if (effectiveAction === "delete") {
              // Rejecting a deletion → keep the node, just strip suggestion attrs
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { nodeSuggestionId, nodeSuggestionUserId, nodeSuggestionCommentThreadId,
                      nodeSuggestionTimestamp, nodeSuggestionOldData, nodeSuggestionAction, ...cleanAttrs } = node.attrs as Record<string, unknown>;
              tr.setNodeMarkup(pos, undefined, cleanAttrs);
              modified = true;
              return;
            }

            // Format change: restore old type and attrs from nodeSuggestionOldData
            let oldData: { type: string; attrs: Record<string, unknown> } | null = null;
            try {
              oldData = JSON.parse(node.attrs.nodeSuggestionOldData ?? "null");
            } catch {
              console.warn("[NodeSuggestion] Failed to parse nodeSuggestionOldData");
            }

            if (oldData) {
              const oldType = state.schema.nodes[oldData.type];
              if (oldType) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { nodeSuggestionId, nodeSuggestionUserId, nodeSuggestionCommentThreadId,
                        nodeSuggestionTimestamp, nodeSuggestionOldData: _old, nodeSuggestionAction, ...oldCleanAttrs } = oldData.attrs;

                const listTypes = ["bulletList", "orderedList", "taskList"];
                const currentIsList = listTypes.includes(node.type.name);
                const oldIsList = listTypes.includes(oldData.type);

                if (currentIsList && !oldIsList) {
                  // List → inline container (e.g. bulletList → paragraph/heading).
                  // setNodeMarkup would leave listItem children inside the new block, which
                  // is invalid. Instead, extract inline content from each list item.
                  const newNodes: ProseMirrorNode[] = [];
                  node.forEach((listItem) => {
                    listItem.forEach((innerBlock) => {
                      newNodes.push(oldType.create(oldCleanAttrs, innerBlock.content));
                    });
                  });
                  if (newNodes.length > 0) {
                    tr.replaceWith(pos, pos + node.nodeSize,
                      newNodes.length === 1 ? newNodes[0] : Fragment.fromArray(newNodes));
                  }
                } else if (!currentIsList && oldIsList) {
                  // Inline container → list (e.g. paragraph → bulletList).
                  // Wrap the current inline content into a list item.
                  const listItemType = state.schema.nodes.listItem;
                  const innerParaType = state.schema.nodes.paragraph;
                  if (listItemType && innerParaType) {
                    const innerPara = innerParaType.create({}, node.content);
                    const listItem = listItemType.create({}, innerPara);
                    tr.replaceWith(pos, pos + node.nodeSize, oldType.create({}, listItem));
                  }
                } else {
                  // Same content-model category (both inline containers or both list types):
                  // setNodeMarkup is safe.
                  tr.setNodeMarkup(pos, oldType, oldCleanAttrs);
                }
                modified = true;
                return;
              }
            }

            // Fallback: clear suggestion attrs, keep current type
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { nodeSuggestionId, nodeSuggestionUserId, nodeSuggestionCommentThreadId,
                    nodeSuggestionTimestamp, nodeSuggestionOldData, nodeSuggestionAction, ...cleanAttrs } = node.attrs as Record<string, unknown>;
            tr.setNodeMarkup(pos, undefined, cleanAttrs);
            modified = true;
          });

          if (dispatch && modified) {
            console.log("[NodeSuggestion] Dispatching reject for", nodesToUpdate.length, "nodes");
            dispatch(tr);
          }
          return modified;
        },

      updateNodeSuggestionThreadId:
        (suggestionId: string, threadId: string) =>
        ({ tr, state, dispatch }) => {
          tr.setMeta("suggestionThreadUpdate", true);
          tr.setMeta("addToHistory", false);

          let modified = false;
          state.doc.descendants((node, pos) => {
            if (node.attrs.nodeSuggestionId === suggestionId) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                nodeSuggestionCommentThreadId: threadId,
              });
              modified = true;
            }
          });

          if (dispatch && modified) dispatch(tr);
          return modified;
        },
    };
  },
});
