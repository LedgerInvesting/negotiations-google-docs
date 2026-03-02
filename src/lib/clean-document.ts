/**
 * Utility to produce a clean ProseMirror document JSON
 * by stripping all suggestion marks and their associated content.
 *
 * Rules for cleaning:
 * - suggestionInsert marks → remove the entire text node (proposed additions, not yet canonical)
 * - suggestionDelete marks → keep the text, remove only the mark (proposed deletions of canonical text)
 *
 * The result represents the "canonical" document state — what the document
 * looked like before any suggestions were applied.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DocNode {
  type: string;
  content?: DocNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
  attrs?: Record<string, any>;
}

/**
 * Recursively clean a ProseMirror doc JSON node, stripping suggestion marks.
 */
function cleanNode(node: DocNode): DocNode | null {
  // Text nodes: check for suggestion marks
  if (node.type === "text" && node.marks) {
    const hasSuggestionInsert = node.marks.some(
      (m) => m.type === "suggestionInsert"
    );

    // If this text was a suggested insertion, remove it entirely (not canonical)
    if (hasSuggestionInsert) {
      return null;
    }

    // If this text was a suggested deletion, keep the text but strip the mark
    const cleanedMarks = node.marks.filter(
      (m) => m.type !== "suggestionDelete"
    );

    return {
      ...node,
      marks: cleanedMarks.length > 0 ? cleanedMarks : undefined,
    };
  }

  // Block nodes with pending node suggestions
  if (node.attrs?.nodeSuggestionId != null) {
    // A pending insertion is not canonical — remove it from the clean snapshot
    if (node.attrs.nodeSuggestionAction === "insert") {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nodeSuggestionId, nodeSuggestionUserId, nodeSuggestionCommentThreadId,
            nodeSuggestionTimestamp, nodeSuggestionOldData, nodeSuggestionAction, ...cleanAttrs } = node.attrs as Record<string, any>;
    const cleanedContent = node.content
      ?.map(cleanNode)
      .filter((c): c is DocNode => c !== null);
    return {
      ...node,
      attrs: cleanAttrs,
      content: cleanedContent?.length ? cleanedContent : undefined,
    };
  }

  // Non-text nodes with content: recurse into children
  if (node.content) {
    const cleanedContent = node.content
      .map(cleanNode)
      .filter((child): child is DocNode => child !== null);

    return {
      ...node,
      content: cleanedContent.length > 0 ? cleanedContent : undefined,
    };
  }

  // Leaf nodes without marks or content: keep as-is
  return node;
}

/**
 * Clean a ProseMirror document JSON object, removing all suggestion marks
 * and returning the canonical document state.
 *
 * @param docJSON - The ProseMirror document as a JSON object (from doc.toJSON())
 * @returns A new JSON object representing the clean document
 */
export function cleanDocumentJSON(docJSON: Record<string, any>): Record<string, any> {
  const cleaned = cleanNode(docJSON as DocNode);
  return (cleaned ?? { type: "doc", content: [] }) as Record<string, any>;
}

/**
 * Utility to produce a "result" ProseMirror document JSON
 * by accepting all pending suggestions.
 *
 * Rules for result:
 * - suggestionInsert marks → remove mark, keep text (insertion accepted)
 * - suggestionDelete marks → remove the entire text node (deletion accepted)
 * - nodeSuggestionAction="insert" → keep node, strip suggestion attrs (insertion accepted)
 * - nodeSuggestionAction="delete" → remove node entirely (deletion accepted)
 * - other nodeSuggestionId → strip suggestion attrs, keep node (format change accepted)
 */
function resultNode(node: DocNode): DocNode | null {
  // Text nodes: check for suggestion marks
  if (node.type === "text" && node.marks) {
    const hasSuggestionDelete = node.marks.some(
      (m) => m.type === "suggestionDelete"
    );

    // If this text was a suggested deletion, remove it entirely (accept deletion)
    if (hasSuggestionDelete) {
      return null;
    }

    // If this text was a suggested insertion, keep the text but strip the mark
    const cleanedMarks = node.marks.filter(
      (m) => m.type !== "suggestionInsert"
    );

    return {
      ...node,
      marks: cleanedMarks.length > 0 ? cleanedMarks : undefined,
    };
  }

  // Block nodes with pending node suggestions
  if (node.attrs?.nodeSuggestionId != null) {
    // A pending deletion is accepted — remove the node entirely
    if (node.attrs.nodeSuggestionAction === "delete") {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nodeSuggestionId, nodeSuggestionUserId, nodeSuggestionCommentThreadId,
            nodeSuggestionTimestamp, nodeSuggestionOldData, nodeSuggestionAction, ...cleanAttrs } = node.attrs as Record<string, any>;
    const cleanedContent = node.content
      ?.map(resultNode)
      .filter((c): c is DocNode => c !== null);
    return {
      ...node,
      attrs: cleanAttrs,
      content: cleanedContent?.length ? cleanedContent : undefined,
    };
  }

  // Non-text nodes with content: recurse into children
  if (node.content) {
    const cleanedContent = node.content
      .map(resultNode)
      .filter((child): child is DocNode => child !== null);

    return {
      ...node,
      content: cleanedContent.length > 0 ? cleanedContent : undefined,
    };
  }

  // Leaf nodes without marks or content: keep as-is
  return node;
}

/**
 * Produce a ProseMirror document JSON that represents the result of accepting
 * all pending suggestions (what the document would look like if all suggestions
 * were approved).
 *
 * @param docJSON - The ProseMirror document as a JSON object (from doc.toJSON())
 * @returns A new JSON object representing the document with all suggestions accepted
 */
export function resultDocumentJSON(docJSON: Record<string, any>): Record<string, any> {
  const result = resultNode(docJSON as DocNode);
  return (result ?? { type: "doc", content: [] }) as Record<string, any>;
}
