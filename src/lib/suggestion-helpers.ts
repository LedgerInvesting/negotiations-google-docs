import { Editor } from "@tiptap/react";

export interface SuggestionData {
  suggestionId: string;
  userId: string;
  commentThreadId: string;
  timestamp: number;
  changeType: "insert" | "delete";
  status: "pending" | "accepted" | "rejected";
}

/**
 * Generate a unique suggestion ID
 */
export function generateSuggestionId(): string {
  return `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a suggestion for inserted text
 */
export function createInsertSuggestion(
  editor: Editor,
  userId: string,
  commentThreadId: string
): string {
  const suggestionId = generateSuggestionId();
  const timestamp = Date.now();

  editor
    .chain()
    .focus()
    .setSuggestionInsert({
      suggestionId,
      userId,
      commentThreadId,
      timestamp,
    })
    .run();

  return suggestionId;
}

/**
 * Create a suggestion for deleted text
 */
export function createDeleteSuggestion(
  editor: Editor,
  userId: string,
  commentThreadId: string
): string {
  const suggestionId = generateSuggestionId();
  const timestamp = Date.now();

  editor
    .chain()
    .focus()
    .setSuggestionDelete({
      suggestionId,
      userId,
      commentThreadId,
      timestamp,
    })
    .run();

  return suggestionId;
}

/**
 * Accept a suggestion
 */
export function acceptSuggestion(editor: Editor, suggestionId: string): void {
  editor.chain().focus().acceptSuggestion(suggestionId).run();
}

/**
 * Reject a suggestion
 */
export function rejectSuggestion(editor: Editor, suggestionId: string): void {
  editor.chain().focus().rejectSuggestion(suggestionId).run();
}

/**
 * Get all pending suggestions from the document
 */
export function getPendingSuggestions(editor: Editor): SuggestionData[] {
  const suggestions: SuggestionData[] = [];
  const { doc } = editor.state;

  doc.descendants((node) => {
    if (node.isText) {
      node.marks.forEach((mark) => {
        if (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") {
          suggestions.push({
            suggestionId: mark.attrs.suggestionId,
            userId: mark.attrs.userId,
            commentThreadId: mark.attrs.commentThreadId,
            timestamp: mark.attrs.timestamp,
            changeType: mark.type.name === "suggestionInsert" ? "insert" : "delete",
            status: "pending",
          });
        }
      });
    }
  });

  // Remove duplicates based on suggestionId
  const uniqueSuggestions = Array.from(
    new Map(suggestions.map((s) => [s.suggestionId, s])).values()
  );

  return uniqueSuggestions;
}
