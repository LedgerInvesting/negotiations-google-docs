import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { AddMarkStep, RemoveMarkStep, ReplaceAroundStep, ReplaceStep, type Mapping } from "@tiptap/pm/transform";

export interface SuggestionModeOptions {
  isOwner: boolean;
  userId: string;
  onCreateSuggestion?: (data: {
    suggestionId: string;
    type: "insert" | "delete" | "replace" | "format";
    text: string;
    oldText?: string;
    newText?: string;
    description?: string;
    from: number;
    to: number;
  }) => Promise<string>; // Returns commentThreadId
  onPendingChange?: (isPending: boolean) => void;
}

function generateSuggestionId(): string {
  return `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface InsertChange {
  type: "insert";
  from: number;
  to: number;
  text: string;
}

interface DeleteChange {
  type: "delete";
  from: number;
  to: number;
  text: string;
}

interface ReplaceChange {
  type: "replace";
  /** Where we re-insert the deleted text (with delete mark) */
  from: number;
  /** Range of the newly inserted text that already exists in the doc */
  insertFrom: number;
  insertTo: number;
  oldText: string;
  newText: string;
}

/** Serialised representation of a single text node's marks (excluding suggestion marks). */
interface OldTextNode {
  text: string;
  marks: Array<{ type: string; attrs: Record<string, unknown> }>;
}

interface FormatChange {
  type: "format";
  from: number;
  to: number;
  text: string;
  description: string;
  oldNodes: OldTextNode[];
}

type DocChange = InsertChange | DeleteChange | ReplaceChange | FormatChange;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable label for a mark step (e.g. "Bold", "Font: Arial"). */
function describeFormatStep(isAdd: boolean, mark: { type: { name: string }; attrs: Record<string, unknown> }): string {
  const prefix = isAdd ? "" : "Remove ";
  switch (mark.type.name) {
    case "bold":
      return `${prefix}Bold`;
    case "italic":
      return `${prefix}Italic`;
    case "underline":
      return `${prefix}Underline`;
    case "strike":
      return `${prefix}Strikethrough`;
    case "code":
      return `${prefix}Code`;
    case "highlight": {
      const color = mark.attrs.color as string | undefined;
      return color ? `${prefix}Highlight (${color})` : `${prefix}Highlight`;
    }
    case "textStyle": {
      const parts: string[] = [];
      if (mark.attrs.fontFamily) parts.push(`Font: ${mark.attrs.fontFamily}`);
      if (mark.attrs.fontSize) parts.push(`Size: ${mark.attrs.fontSize}`);
      if (mark.attrs.color) parts.push(`Color: ${mark.attrs.color}`);
      if (parts.length === 0) return `${prefix}Text style`;
      return prefix + parts.join(", ");
    }
    default:
      return `${prefix}${mark.type.name}`;
  }
}

/** Capture the text nodes (with their marks, excluding suggestion marks) in a range of a document. */
function captureOldTextNodes(doc: ProseMirrorNode, from: number, to: number): OldTextNode[] {
  const nodes: OldTextNode[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText && node.text) {
      const start = Math.max(pos, from);
      const end = Math.min(pos + node.nodeSize, to);
      const sliceText = node.text.slice(start - pos, end - pos);
      const marks = node.marks
        .filter((m) => m.type.name !== "suggestionInsert" && m.type.name !== "suggestionDelete")
        .map((m) => ({ type: m.type.name, attrs: m.attrs as Record<string, unknown> }));
      if (sliceText.length > 0) {
        nodes.push({ text: sliceText, marks });
      }
    }
  });
  return nodes;
}

// ---------------------------------------------------------------------------
// Position mapping
// ---------------------------------------------------------------------------

function mapDocChange(change: DocChange, mapping: Mapping): DocChange {
  if (change.type === "insert") {
    return {
      ...change,
      from: mapping.map(change.from, 1),
      to: mapping.map(change.to, -1),
    };
  }

  if (change.type === "replace") {
    return {
      ...change,
      from: mapping.map(change.from, 1),
      insertFrom: mapping.map(change.insertFrom, 1),
      insertTo: mapping.map(change.insertTo, -1),
    };
  }

  if (change.type === "format") {
    return {
      ...change,
      from: mapping.map(change.from, 1),
      to: mapping.map(change.to, -1),
    };
  }

  // delete suggestions are represented as "insert deleted text at `from` with delete mark"
  const mappedPos = mapping.map(change.from, 1);
  return {
    ...change,
    from: mappedPos,
    to: mappedPos,
  };
}

// ---------------------------------------------------------------------------
// Merging adjacent / overlapping changes
// ---------------------------------------------------------------------------

function mergeDocChanges(changes: DocChange[]): DocChange[] {
  const merged: DocChange[] = [];

  for (const change of changes) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push(change);
      continue;
    }

    // Merge adjacent inserts (typing produces a stream of small insert steps)
    if (
      prev.type === "insert" &&
      change.type === "insert" &&
      prev.to === change.from
    ) {
      prev.to = change.to;
      prev.text += change.text;
      continue;
    }

    // If the user continues typing immediately after a replacement,
    // grow the replacement's inserted range/text rather than creating
    // a separate insert suggestion.
    if (
      prev.type === "replace" &&
      change.type === "insert" &&
      prev.insertTo === change.from
    ) {
      prev.insertTo = change.to;
      prev.newText += change.text;
      continue;
    }

    // Merge backspace-like deletes: after mapping, they typically converge on the same insertion point.
    // When that happens, prepend the newer deleted text (it was deleted closer to the start).
    if (prev.type === "delete" && change.type === "delete" && prev.from === change.from) {
      prev.text = change.text + prev.text;
      continue;
    }

    // Merge format changes on the same range (e.g. bold + italic applied in quick succession)
    if (
      prev.type === "format" &&
      change.type === "format" &&
      prev.from === change.from &&
      prev.to === change.to
    ) {
      // Keep the earliest old content, combine descriptions
      prev.description = `${prev.description}, ${change.description}`;
      continue;
    }

    merged.push(change);
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Extract changes from a transaction
// ---------------------------------------------------------------------------

function extractChangesFromTransaction(tr: Transaction): DocChange[] {
  const changes: DocChange[] = [];

  let docBeforeStep: ProseMirrorNode = tr.before;

  tr.steps.forEach((step, stepIndex) => {
    // ---------------------------------------------------------------
    // Formatting steps (AddMarkStep / RemoveMarkStep)
    // ---------------------------------------------------------------
    if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
      const result = step.apply(docBeforeStep);
      if (!result.doc) {
        console.warn("[SuggestionMode] Mark step apply failed, skipping", result.failed);
        return;
      }
      const docAfterStep = result.doc;

      // If the step didn't actually change the doc (mark already present / absent), skip.
      if (docBeforeStep.eq(docAfterStep)) {
        docBeforeStep = docAfterStep;
        return;
      }

      const stepFrom = step.from;
      const stepTo = step.to;
      const mark = step.mark;

      const text = docBeforeStep.textBetween(stepFrom, stepTo, "\n", "\n");
      if (text.length === 0) {
        docBeforeStep = docAfterStep;
        return;
      }

      // Map positions to the *final* document of this transaction.
      const mapFromAfterStepToEnd = tr.mapping.slice(stepIndex + 1);
      const mappedFrom = mapFromAfterStepToEnd.map(stepFrom, 1);
      const mappedTo = mapFromAfterStepToEnd.map(stepTo, -1);

      // Capture old text nodes with their original marks.
      const oldNodes = captureOldTextNodes(docBeforeStep, stepFrom, stepTo);

      const isAdd = step instanceof AddMarkStep;
      const description = describeFormatStep(isAdd, mark);

      changes.push({
        type: "format",
        from: mappedFrom,
        to: mappedTo,
        text,
        description,
        oldNodes,
      });

      docBeforeStep = docAfterStep;
      return;
    }

    // ---------------------------------------------------------------
    // Non-content steps we don't handle — keep baseline in sync.
    // ---------------------------------------------------------------
    if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) {
      const result = step.apply(docBeforeStep);
      if (result.doc) docBeforeStep = result.doc;
      return;
    }

    // ---------------------------------------------------------------
    // Content replacement steps (typing, pasting, deleting)
    // ---------------------------------------------------------------
    const result = step.apply(docBeforeStep);
    if (!result.doc) {
      console.warn("[SuggestionMode] Step apply failed, skipping", result.failed);
      return;
    }
    const docAfterStep = result.doc;

    const stepMap = step.getMap();

    // Map positions produced by this step into the *final* document of this transaction.
    const mapFromAfterStepToEnd = tr.mapping.slice(stepIndex + 1);

    stepMap.forEach((from, to, newFrom, newTo) => {
      const deletedText =
        to > from ? docBeforeStep.textBetween(from, to, "\n", "\n") : "";

      const insertedText =
        newTo > newFrom ? docAfterStep.textBetween(newFrom, newTo, "\n", "\n") : "";

      // Replacement: user replaced an existing range with new content.
      if (deletedText.length > 0 && insertedText.length > 0) {
        const mapFromBeforeStepToEnd = tr.mapping.slice(stepIndex);
        const deletePos = mapFromBeforeStepToEnd.map(from, 1);
        const insertFrom = mapFromAfterStepToEnd.map(newFrom, 1);
        const insertTo = mapFromAfterStepToEnd.map(newTo, -1);

        changes.push({
          type: "replace",
          from: deletePos,
          insertFrom,
          insertTo,
          oldText: deletedText,
          newText: insertedText,
        });
        return;
      }

      // Deletions
      if (deletedText.length > 0) {
        const mapFromBeforeStepToEnd = tr.mapping.slice(stepIndex);
        const deletePos = mapFromBeforeStepToEnd.map(from, 1);
        changes.push({
          type: "delete",
          from: deletePos,
          to: deletePos,
          text: deletedText,
        });
      }

      // Insertions
      if (insertedText.length > 0) {
        const insertFrom = mapFromAfterStepToEnd.map(newFrom, 1);
        const insertTo = mapFromAfterStepToEnd.map(newTo, -1);
        changes.push({
          type: "insert",
          from: insertFrom,
          to: insertTo,
          text: insertedText,
        });
      }
    });

    docBeforeStep = docAfterStep;
  });

  return changes;
}

// ---------------------------------------------------------------------------
// Create suggestion marks + threads for detected changes
// ---------------------------------------------------------------------------

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

  const schema = view.state.schema;

  // IMPORTANT: apply insert marks before inserting delete-suggestion text.
  // Inserting deleted text shifts document positions; marking first ensures marks stay attached.
  const replaceChanges = changes.filter((c) => c.type === "replace") as ReplaceChange[];
  const formatChanges = changes.filter((c) => c.type === "format") as FormatChange[];
  const insertChanges = changes.filter((c) => c.type === "insert") as InsertChange[];
  const deleteChanges = changes.filter((c) => c.type === "delete") as DeleteChange[];

  // ------- Replace changes -------
  replaceChanges.forEach((change) => {
    const suggestionId = generateSuggestionId();
    const timestamp = Date.now();
    const commentThreadId = `temp-${suggestionId}`;

    const insertMark = suggestionInsertType.create({
      suggestionId,
      userId,
      commentThreadId,
      timestamp,
    });
    const deleteMark = suggestionDeleteType.create({
      suggestionId,
      userId,
      commentThreadId,
      timestamp,
    });

    console.log('[SuggestionMode] Adding replace marks:', {
      suggestionId,
      from: change.from,
      insertFrom: change.insertFrom,
      insertTo: change.insertTo,
      oldText: change.oldText.substring(0, 50),
      newText: change.newText.substring(0, 50),
    });

    // 1) Mark the new text as an insertion suggestion.
    tr.addMark(change.insertFrom, change.insertTo, insertMark);

    // 2) Re-insert the old text at the same position, marked as deletion.
    const oldTextNode = schema.text(change.oldText, [deleteMark]);
    tr.insert(change.from, oldTextNode);

    // Create ONE thread for the replacement.
    if (onCreateSuggestion) {
      onCreateSuggestion({
        suggestionId,
        type: "replace",
        text: `${change.oldText} → ${change.newText}`,
        oldText: change.oldText,
        newText: change.newText,
        from: change.from,
        to: change.insertTo,
      })
        .then((threadId) => {
          console.log('[SuggestionMode] Thread created for replace:', threadId);
        })
        .catch((error: unknown) => {
          console.error("[SuggestionMode] Failed to create comment thread:", error);
        });
    }
  });

  // ------- Format changes -------
  formatChanges.forEach((change) => {
    const suggestionId = generateSuggestionId();
    const timestamp = Date.now();
    const commentThreadId = `temp-${suggestionId}`;

    const insertMark = suggestionInsertType.create({
      suggestionId,
      userId,
      commentThreadId,
      timestamp,
    });
    const deleteMark = suggestionDeleteType.create({
      suggestionId,
      userId,
      commentThreadId,
      timestamp,
    });

    console.log('[SuggestionMode] Adding format marks:', {
      suggestionId,
      from: change.from,
      to: change.to,
      text: change.text.substring(0, 50),
      description: change.description,
    });

    // 1) Mark the existing (newly formatted) text as an insertion suggestion.
    tr.addMark(change.from, change.to, insertMark);

    // 2) Insert old text nodes at change.from with their original marks + delete mark.
    //    We build the nodes in forward order and insert them all at once.
    const oldTextNodes = change.oldNodes.flatMap(({ text, marks }) => {
      const resolvedMarks = marks.flatMap((m) => {
        const markType = schema.marks[m.type];
        return markType ? [markType.create(m.attrs)] : [];
      });
      return [schema.text(text, [...resolvedMarks, deleteMark])];
    });

    if (oldTextNodes.length > 0) {
      tr.insert(change.from, oldTextNodes);
    }

    // Create ONE thread for the format change.
    if (onCreateSuggestion) {
      onCreateSuggestion({
        suggestionId,
        type: "format",
        text: change.text,
        description: change.description,
        from: change.from,
        to: change.to,
      })
        .then((threadId) => {
          console.log('[SuggestionMode] Thread created for format:', threadId);
        })
        .catch((error: unknown) => {
          console.error("[SuggestionMode] Failed to create comment thread:", error);
        });
    }
  });

  // ------- Insert changes -------
  insertChanges.forEach((change) => {
    const suggestionId = generateSuggestionId();
    const timestamp = Date.now();
    const commentThreadId = `temp-${suggestionId}`;
    
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

    if (onCreateSuggestion) {
      onCreateSuggestion({
        suggestionId,
        type: "insert",
        text: change.text,
        from: change.from,
        to: change.to,
      })
        .then((threadId) => {
          console.log('[SuggestionMode] Thread created for insert:', threadId);
        })
        .catch((error: unknown) => {
          console.error("[SuggestionMode] Failed to create comment thread:", error);
        });
    }
  });

  // ------- Delete changes -------
  deleteChanges.forEach((change) => {
    const suggestionId = generateSuggestionId();
    const timestamp = Date.now();
    const commentThreadId = `temp-${suggestionId}`;

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

    const textNode = schema.text(change.text, [mark]);
    tr.insert(change.from, textNode);

    if (onCreateSuggestion) {
      onCreateSuggestion({
        suggestionId,
        type: "delete",
        text: change.text,
        from: change.from,
        to: change.from,
      })
        .then((threadId) => {
          console.log('[SuggestionMode] Thread created for delete:', threadId);
        })
        .catch((error: unknown) => {
          console.error("[SuggestionMode] Failed to create comment thread:", error);
        });
    }
  });
  
  // Dispatch the transaction with suggestions
  console.log('[SuggestionMode] Dispatching transaction with suggestions');
  view.dispatch(tr);
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const SuggestionMode = Extension.create<SuggestionModeOptions>({
  name: "suggestionMode",

  addOptions() {
    return {
      isOwner: true,
      userId: "",
      onCreateSuggestion: undefined,
      onPendingChange: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { isOwner, userId, onCreateSuggestion, onPendingChange } = this.options;

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
              pendingChanges: [] as DocChange[],
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
                pendingChanges: [],
                isProcessing: false,
                viewRef: pluginState.viewRef,
              };
            }
            
            // If document changed by user, debounce and compare
            if (tr.docChanged && !pluginState.isProcessing) {
              const isStartingNewEdit = pluginState.debounceTimeout === null;
              const baselineDoc = isStartingNewEdit ? oldState.doc : pluginState.previousDoc;
              const mappedExistingChanges = isStartingNewEdit
                ? ([] as DocChange[])
                : pluginState.pendingChanges.map((c: DocChange) => mapDocChange(c, tr.mapping));

              const extractedChanges = extractChangesFromTransaction(tr);
              const pendingChanges = mergeDocChanges([
                ...mappedExistingChanges,
                ...extractedChanges,
              ]);
              
              console.log('[SuggestionMode] User edit detected:', {
                isStartingNewEdit,
                hasExistingTimeout: pluginState.debounceTimeout !== null,
                extractedChanges: extractedChanges.length,
                pendingChanges: pendingChanges.length,
              });
              
              // Notify that changes are pending
              if (isStartingNewEdit) {
                onPendingChange?.(true);
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
                const changes = currentPluginState.pendingChanges as DocChange[];
                
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
                pendingChanges,
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
