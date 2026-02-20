import { Editor } from "@tiptap/react";

export interface InvalidSuggestion {
  suggestionId: string;
  type: "insert" | "delete";
  hasThreadId: boolean;
  threadId: string | null;
  position: number;
  text: string;
}

/**
 * Validate that a suggestion has a valid thread ID
 * Thread IDs can be:
 * - Actual Liveblocks thread IDs
 * - Suggestion IDs (start with "suggestion-")
 * Thread IDs should NOT be:
 * - null/undefined
 * - Empty strings
 * - Temporary placeholders (start with "temp-")
 */
export function isValidThreadId(threadId: string | null | undefined): boolean {
  if (!threadId) return false;
  if (threadId.startsWith("temp-")) return false;
  // Suggestion IDs themselves are valid (suggestion-{timestamp}-{random})
  if (threadId.startsWith("suggestion-")) return true;
  // Any other non-empty, non-temp string is considered valid
  return true;
}

/**
 * Find all suggestions in the document that don't have valid thread IDs
 */
export function findInvalidSuggestions(editor: Editor): InvalidSuggestion[] {
  const invalidSuggestions: InvalidSuggestion[] = [];
  const { doc } = editor.state;

  doc.descendants((node, pos) => {
    if (node.isText) {
      node.marks.forEach((mark) => {
        if (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") {
          const threadId = mark.attrs.commentThreadId;
          const hasValidThreadId = isValidThreadId(threadId);
          
          if (!hasValidThreadId) {
            invalidSuggestions.push({
              suggestionId: mark.attrs.suggestionId,
              type: mark.type.name === "suggestionInsert" ? "insert" : "delete",
              hasThreadId: !!threadId,
              threadId: threadId || null,
              position: pos,
              text: node.text || "",
            });
          }
        }
      });
    }
  });

  // Remove duplicates based on suggestionId
  const uniqueInvalid = Array.from(
    new Map(invalidSuggestions.map((s) => [s.suggestionId, s])).values()
  );

  return uniqueInvalid;
}

/**
 * Clean up all suggestions without valid thread IDs
 * - For insert suggestions: remove the mark, keep the text
 * - For delete suggestions: remove the mark AND restore the text (reject the deletion)
 */
export function cleanupInvalidSuggestions(editor: Editor): number {
  const { doc } = editor.state;
  const tr = editor.state.tr;
  let cleanedCount = 0;
  const processedSuggestions = new Set<string>();

  // Track positions that need to be cleaned
  const marksToRemove: Array<{
    from: number;
    to: number;
    type: "insert" | "delete";
    suggestionId: string;
  }> = [];

  doc.descendants((node, pos) => {
    if (node.isText) {
      node.marks.forEach((mark) => {
        if (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") {
          const threadId = mark.attrs.commentThreadId;
          const suggestionId = mark.attrs.suggestionId;
          
          // Skip if already processed
          if (processedSuggestions.has(suggestionId)) {
            return;
          }
          
          if (!isValidThreadId(threadId)) {
            marksToRemove.push({
              from: pos,
              to: pos + node.nodeSize,
              type: mark.type.name === "suggestionInsert" ? "insert" : "delete",
              suggestionId,
            });
            processedSuggestions.add(suggestionId);
          }
        }
      });
    }
  });

  // Process all marks to remove
  // We need to process in reverse order to maintain correct positions
  marksToRemove.reverse().forEach((item) => {
    const suggestionInsertType = editor.state.schema.marks.suggestionInsert;
    const suggestionDeleteType = editor.state.schema.marks.suggestionDelete;

    if (item.type === "insert") {
      // For insert suggestions: just remove the mark, keep the text
      tr.removeMark(item.from, item.to, suggestionInsertType);
      cleanedCount++;
    } else if (item.type === "delete") {
      // For delete suggestions: remove the mark (this restores the text)
      tr.removeMark(item.from, item.to, suggestionDeleteType);
      cleanedCount++;
    }
  });

  // Apply the transaction if we made changes
  if (cleanedCount > 0) {
    editor.view.dispatch(tr);
  }

  return cleanedCount;
}

/**
 * Update a suggestion's thread ID
 */
export function updateSuggestionThreadId(
  editor: Editor,
  suggestionId: string,
  newThreadId: string
): boolean {
  const { doc } = editor.state;
  const tr = editor.state.tr;
  let updated = false;

  // Mark this transaction as a system update to prevent interference
  tr.setMeta('suggestionThreadUpdate', true);
  tr.setMeta('addToHistory', false);

  doc.descendants((node, pos) => {
    if (node.isText) {
      node.marks.forEach((mark) => {
        if (
          (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") &&
          mark.attrs.suggestionId === suggestionId
        ) {
          // Create new mark with all existing attributes plus updated thread ID
          const newMark = mark.type.create({
            suggestionId: mark.attrs.suggestionId,
            userId: mark.attrs.userId,
            commentThreadId: newThreadId,
            timestamp: mark.attrs.timestamp,
          });
          
          tr.removeMark(pos, pos + node.nodeSize, mark.type);
          tr.addMark(pos, pos + node.nodeSize, newMark);
          updated = true;
        }
      });
    }
  });

  if (updated) {
    editor.view.dispatch(tr);
  }

  return updated;
}

/**
 * Get statistics about suggestions in the document
 */
export function getSuggestionStats(editor: Editor): {
  total: number;
  valid: number;
  invalid: number;
  withTempIds: number;
  withoutThreadIds: number;
} {
  const { doc } = editor.state;
  const suggestions = new Set<string>();
  const validSuggestions = new Set<string>();
  const tempIdSuggestions = new Set<string>();
  const noThreadIdSuggestions = new Set<string>();

  doc.descendants((node) => {
    if (node.isText) {
      node.marks.forEach((mark) => {
        if (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") {
          const suggestionId = mark.attrs.suggestionId;
          const threadId = mark.attrs.commentThreadId;
          
          suggestions.add(suggestionId);
          
          if (isValidThreadId(threadId)) {
            validSuggestions.add(suggestionId);
          } else if (threadId && threadId.startsWith("temp-")) {
            tempIdSuggestions.add(suggestionId);
          } else if (!threadId) {
            noThreadIdSuggestions.add(suggestionId);
          }
        }
      });
    }
  });

  return {
    total: suggestions.size,
    valid: validSuggestions.size,
    invalid: suggestions.size - validSuggestions.size,
    withTempIds: tempIdSuggestions.size,
    withoutThreadIds: noThreadIdSuggestions.size,
  };
}
