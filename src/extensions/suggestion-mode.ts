import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

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
}

function generateSuggestionId(): string {
  return `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const SuggestionMode = Extension.create<SuggestionModeOptions>({
  name: "suggestionMode",

  addOptions() {
    return {
      isOwner: true,
      userId: "",
      onCreateSuggestion: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { isOwner, userId, onCreateSuggestion } = this.options;

    // If user is owner, no need to intercept changes
    if (isOwner) {
      return [];
    }

    return [
      new Plugin({
        key: new PluginKey("suggestionMode"),
        
        appendTransaction(transactions, oldState, newState) {
          // Only process user transactions (not programmatic ones)
          const userTransaction = transactions.find((tr) => tr.docChanged && !tr.getMeta('suggestionMode'));
          
          if (!userTransaction) {
            return null;
          }

          const tr = newState.tr;
          tr.setMeta('suggestionMode', true); // Prevent infinite loop
          
          // Get the suggestion mark types
          const suggestionInsertType = newState.schema.marks.suggestionInsert;
          const suggestionDeleteType = newState.schema.marks.suggestionDelete;
          
          if (!suggestionInsertType || !suggestionDeleteType) {
            return null;
          }

          let modified = false;

          // Iterate through the changes in the transaction
          userTransaction.steps.forEach((step, index) => {
            const map = userTransaction.mapping.maps[index];
            
            map.forEach((oldStart, oldEnd, newStart, newEnd) => {
              const suggestionId = generateSuggestionId();
              const timestamp = Date.now();
              
              // Handle insertions (newEnd > newStart and oldEnd === oldStart)
              if (newEnd > newStart && oldEnd === oldStart) {
                const insertedText = newState.doc.textBetween(newStart, newEnd);
                const commentThreadId = `temp-${suggestionId}`; // Will be replaced asynchronously
                
                const suggestionMark = suggestionInsertType.create({
                  suggestionId,
                  userId,
                  commentThreadId,
                  timestamp,
                });
                
                tr.addMark(newStart, newEnd, suggestionMark);
                modified = true;
                
                // Asynchronously create comment thread
                if (onCreateSuggestion) {
                  onCreateSuggestion({
                    suggestionId,
                    type: "insert",
                    text: insertedText,
                    from: newStart,
                    to: newEnd,
                  }).catch((error: unknown) => {
                    console.error("Failed to create comment thread:", error);
                  });
                }
              }
              
              // Handle deletions (oldEnd > oldStart and newEnd === newStart)
              if (oldEnd > oldStart && newEnd === newStart) {
                // For deletions, we need to keep the text but mark it as deleted
                const deletedText = oldState.doc.textBetween(oldStart, oldEnd);
                const commentThreadId = `temp-${suggestionId}`; // Will be replaced asynchronously
                
                const suggestionMark = suggestionDeleteType.create({
                  suggestionId,
                  userId,
                  commentThreadId,
                  timestamp,
                });
                
                // Insert the deleted text back with deletion mark
                tr.insert(newStart, newState.schema.text(deletedText, [suggestionMark]));
                modified = true;
                
                // Asynchronously create comment thread
                if (onCreateSuggestion) {
                  onCreateSuggestion({
                    suggestionId,
                    type: "delete",
                    text: deletedText,
                    from: newStart,
                    to: newStart, // deletion point
                  }).catch((error: unknown) => {
                    console.error("Failed to create comment thread:", error);
                  });
                }
              }
            });
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
