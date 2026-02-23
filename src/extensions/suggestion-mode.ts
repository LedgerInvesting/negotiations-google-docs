import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

export interface SuggestionModeOptions {
  isOwner: boolean;
  userId: string;
  onCreateSuggestion?: (data: {
    suggestionId: string;
    type: "insert" | "delete";
    text: string;
    from: number;
    to: number;
  }) => Promise<string>; // Returns commentThreadId
  onPendingChange?: (isPending: boolean) => void;
  onSnapshotBeforeEdit?: (docJSON: Record<string, unknown>) => void;
}

function generateSuggestionId(): string {
  return `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface DocChange {
  type: "insert" | "delete";
  from: number;
  to: number;
  text: string;
}

/**
 * Extract clean text from document, excluding current user's suggestions
 */
function getCleanText(doc: ProseMirrorNode, userId: string): string {
  let text = "";
  doc.descendants((node) => {
    if (node.isText) {
      // Check if this text has a suggestion mark from the current user
      const hasSuggestionFromUser = node.marks.some(
        mark => 
          (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") &&
          mark.attrs.userId === userId
      );
      
      // Only include text that doesn't have a suggestion from this user
      if (!hasSuggestionFromUser) {
        text += node.text || "";
      }
    }
  });
  return text;
}

/**
 * Convert text position to document position, accounting for document structure
 */
function textPosToDocPos(doc: ProseMirrorNode, textPos: number, userId: string): number {
  let currentTextPos = 0;
  let docPos = 1; // Start at 1 to account for document node
  
  let found = false;
  doc.descendants((node, pos) => {
    if (found) return false;
    
    if (node.isText) {
      const hasSuggestionFromUser = node.marks.some(
        mark => 
          (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") &&
          mark.attrs.userId === userId
      );
      
      if (!hasSuggestionFromUser) {
        const nodeLength = node.text?.length || 0;
        if (currentTextPos + nodeLength >= textPos) {
          docPos = pos + (textPos - currentTextPos);
          found = true;
          return false;
        }
        currentTextPos += nodeLength;
      }
    }
  });
  
  return found ? docPos : doc.content.size;
}

/**
 * Compare two document states and return the differences
 * Uses a simple but effective prefix/suffix matching algorithm
 */
function compareDocuments(oldDoc: ProseMirrorNode, newDoc: ProseMirrorNode, userId: string): DocChange[] {
  const changes: DocChange[] = [];
  
  const oldText = getCleanText(oldDoc, userId);
  const newText = getCleanText(newDoc, userId);
  
  console.log('[SuggestionMode] Comparing documents:', {
    oldTextLength: oldText.length,
    newTextLength: newText.length,
    oldTextPreview: oldText.substring(0, 100),
    newTextPreview: newText.substring(0, 100),
  });
  
  // Find common prefix
  let prefixLen = 0;
  while (
    prefixLen < oldText.length &&
    prefixLen < newText.length &&
    oldText[prefixLen] === newText[prefixLen]
  ) {
    prefixLen++;
  }
  
  // Find common suffix
  let suffixLen = 0;
  while (
    suffixLen < oldText.length - prefixLen &&
    suffixLen < newText.length - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  
  const oldMiddle = oldText.substring(prefixLen, oldText.length - suffixLen);
  const newMiddle = newText.substring(prefixLen, newText.length - suffixLen);
  
  console.log('[SuggestionMode] Change detection:', {
    prefixLen,
    suffixLen,
    oldMiddle: oldMiddle.length > 0 ? `"${oldMiddle}"` : '(empty)',
    newMiddle: newMiddle.length > 0 ? `"${newMiddle}"` : '(empty)',
  });
  
  // No changes detected
  if (oldMiddle.length === 0 && newMiddle.length === 0) {
    console.log('[SuggestionMode] No changes detected');
    return changes;
  }
  
  // Convert text position to document position
  const changePos = textPosToDocPos(newDoc, prefixLen, userId);
  
  // Determine what changed
  if (oldMiddle.length > 0 && newMiddle.length === 0) {
    // Deletion only
    console.log('[SuggestionMode] Deletion detected:', oldMiddle);
    changes.push({
      type: "delete",
      from: changePos,
      to: changePos,
      text: oldMiddle,
    });
  } else if (oldMiddle.length === 0 && newMiddle.length > 0) {
    // Insertion only
    console.log('[SuggestionMode] Insertion detected:', newMiddle);
    changes.push({
      type: "insert",
      from: changePos,
      to: changePos + newMiddle.length,
      text: newMiddle,
    });
  } else if (oldMiddle.length > 0 && newMiddle.length > 0) {
    // Both deletion and insertion (replacement)
    console.log('[SuggestionMode] Replacement detected:', { old: oldMiddle, new: newMiddle });
    changes.push({
      type: "delete",
      from: changePos,
      to: changePos,
      text: oldMiddle,
    });
    changes.push({
      type: "insert",
      from: changePos,
      to: changePos + newMiddle.length,
      text: newMiddle,
    });
  }
  
  return changes;
}

/**
 * Create suggestions for detected changes
 */
function createSuggestionsForChanges(
  view: EditorView,
  changes: DocChange[],
  userId: string,
  onCreateSuggestion?: SuggestionModeOptions['onCreateSuggestion']
): void {
  const tr = view.state.tr;
  tr.setMeta('suggestionMode', true);
  tr.setMeta('addToHistory', false);
  
  const suggestionInsertType = view.state.schema.marks.suggestionInsert;
  const suggestionDeleteType = view.state.schema.marks.suggestionDelete;
  
  if (!suggestionInsertType || !suggestionDeleteType) {
    console.error('[SuggestionMode] Suggestion mark types not found');
    return;
  }
  
  console.log('[SuggestionMode] Creating suggestions for', changes.length, 'changes');
  
  changes.forEach((change) => {
    const suggestionId = generateSuggestionId();
    const timestamp = Date.now();
    const commentThreadId = `temp-${suggestionId}`;
    
    if (change.type === "insert") {
      // Add insert suggestion mark
      const mark = suggestionInsertType.create({
        suggestionId,
        userId,
        commentThreadId,
        timestamp,
      });
      
      console.log('[SuggestionMode] Adding insert mark:', {
        suggestionId,
        from: change.from,
        to: change.to,
        text: change.text.substring(0, 50),
      });
      
      tr.addMark(change.from, change.to, mark);
      
      // Create thread asynchronously
      if (onCreateSuggestion) {
        onCreateSuggestion({
          suggestionId,
          type: "insert",
          text: change.text,
          from: change.from,
          to: change.to,
        }).then((threadId) => {
          console.log('[SuggestionMode] Thread created for insert:', threadId);
        }).catch((error: unknown) => {
          console.error("[SuggestionMode] Failed to create comment thread:", error);
        });
      }
    } else if (change.type === "delete") {
      // Insert the deleted text back with delete suggestion mark
      const mark = suggestionDeleteType.create({
        suggestionId,
        userId,
        commentThreadId,
        timestamp,
      });
      
      console.log('[SuggestionMode] Adding delete mark:', {
        suggestionId,
        position: change.from,
        text: change.text.substring(0, 50),
      });
      
      const textNode = view.state.schema.text(change.text, [mark]);
      tr.insert(change.from, textNode);
      
      // Create thread asynchronously
      if (onCreateSuggestion) {
        onCreateSuggestion({
          suggestionId,
          type: "delete",
          text: change.text,
          from: change.from,
          to: change.from,
        }).then((threadId) => {
          console.log('[SuggestionMode] Thread created for delete:', threadId);
        }).catch((error: unknown) => {
          console.error("[SuggestionMode] Failed to create comment thread:", error);
        });
      }
    }
  });
  
  // Dispatch the transaction with suggestions
  console.log('[SuggestionMode] Dispatching transaction with suggestions');
  view.dispatch(tr);
}

export const SuggestionMode = Extension.create<SuggestionModeOptions>({
  name: "suggestionMode",

  addOptions() {
    return {
      isOwner: true,
      userId: "",
      onCreateSuggestion: undefined,
      onPendingChange: undefined,
      onSnapshotBeforeEdit: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { isOwner, userId, onCreateSuggestion, onPendingChange, onSnapshotBeforeEdit } = this.options;

    // If user is owner, no need to track changes
    if (isOwner) {
      console.log('[SuggestionMode] User is owner, suggestion tracking disabled');
      return [];
    }

    console.log('[SuggestionMode] Initializing suggestion tracking for non-owner user:', userId);

    // Create plugin key for state management
    const pluginKey = new PluginKey("suggestionMode");

    return [
      new Plugin({
        key: pluginKey,
        
        state: {
          init(_, state) {
            console.log('[SuggestionMode] Plugin state initialized');
            return {
              previousDoc: state.doc,
              debounceTimeout: null as NodeJS.Timeout | null,
              isProcessing: false,
              viewRef: null as EditorView | null,
            };
          },
          
          apply(tr, pluginState, oldState, newState) {
            // Check if this is a remote transaction or a suggestion mark transaction
            const isRemote = tr.getMeta('y-sync$') || tr.getMeta('yjs-update');
            const isSuggestionUpdate = tr.getMeta('suggestionMode');
            const isSuggestionThreadUpdate = tr.getMeta('suggestionThreadUpdate');
            
            if (isRemote) {
              console.log('[SuggestionMode] Remote transaction detected, ignoring');
              return pluginState;
            }
            
            if (isSuggestionUpdate || isSuggestionThreadUpdate) {
              console.log('[SuggestionMode] Suggestion system transaction, updating baseline');
              // If there was a pending debounce, signal that it's resolved
              if (pluginState.debounceTimeout) {
                onPendingChange?.(false);
              }
              return {
                previousDoc: newState.doc,
                debounceTimeout: null,
                isProcessing: false,
                viewRef: pluginState.viewRef,
              };
            }
            
            // If document changed by user, debounce and compare
            if (tr.docChanged && !pluginState.isProcessing) {
              const isStartingNewEdit = pluginState.debounceTimeout === null;
              const baselineDoc = isStartingNewEdit ? oldState.doc : pluginState.previousDoc;
              
              console.log('[SuggestionMode] User edit detected:', {
                isStartingNewEdit,
                hasExistingTimeout: pluginState.debounceTimeout !== null,
              });
              
              // Notify that changes are pending and capture snapshot
              if (isStartingNewEdit) {
                onPendingChange?.(true);
                // Capture the clean document state before the edit
                onSnapshotBeforeEdit?.(oldState.doc.toJSON() as Record<string, unknown>);
              }
              
              // Clear existing timeout
              if (pluginState.debounceTimeout) {
                clearTimeout(pluginState.debounceTimeout);
              }
              
              // Set new timeout to compare and create suggestions
              const timeout = setTimeout(() => {
                // Notify that pending changes are being processed
                onPendingChange?.(false);
                
                console.log('[SuggestionMode] Debounce timer fired, starting comparison');
                
                const view = pluginState.viewRef;
                if (!view) {
                  console.error('[SuggestionMode] No view reference available');
                  return;
                }
                
                const currentState = view.state;
                const currentPluginState = pluginKey.getState(currentState);
                
                if (!currentPluginState) {
                  console.error('[SuggestionMode] Plugin state not found');
                  return;
                }
                
                // Compare documents
                const changes = compareDocuments(
                  currentPluginState.previousDoc,
                  currentState.doc,
                  userId
                );
                
                if (changes.length === 0) {
                  console.log('[SuggestionMode] No changes to convert to suggestions');
                  // Update baseline even if no changes
                  const tr = view.state.tr;
                  tr.setMeta('suggestionMode', true);
                  view.dispatch(tr);
                  return;
                }
                
                console.log('[SuggestionMode] Creating suggestions for detected changes');
                createSuggestionsForChanges(view, changes, userId, onCreateSuggestion);
                
              }, 1500); // 1.5 second debounce
              
              return {
                previousDoc: baselineDoc,
                debounceTimeout: timeout,
                isProcessing: false,
                viewRef: pluginState.viewRef,
              };
            }
            
            return pluginState;
          },
        },
        
        view(editorView) {
          console.log('[SuggestionMode] Plugin view initialized');
          
          // Store view reference in plugin state
          const state = pluginKey.getState(editorView.state);
          if (state) {
            state.viewRef = editorView;
          }
          
          return {
            update(view) {
              const state = pluginKey.getState(view.state);
              if (state) {
                state.viewRef = view;
              }
            },
            destroy() {
              console.log('[SuggestionMode] Plugin view destroyed');
              const state = pluginKey.getState(editorView.state);
              if (state) {
                if (state.debounceTimeout) {
                  clearTimeout(state.debounceTimeout);
                }
                state.viewRef = null;
              }
            },
          };
        },
      }),
    ];
  },
});
