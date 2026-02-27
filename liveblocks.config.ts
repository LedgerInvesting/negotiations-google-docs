import { createClient } from "@liveblocks/client";

// Create the Liveblocks client (not used directly - auth is handled by the API route)
// This file primarily exists to declare custom types for Liveblocks
const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

// Declare custom types for Liveblocks
declare global {
  interface Liveblocks {
    // Custom thread metadata for suggestions and comments
    // Note: "resolved" is a built-in Liveblocks thread property, NOT metadata
    ThreadMetadata: {
      // Suggestion-specific metadata (all optional so regular threads work too)
      suggestionId?: string;
      changeType?: string; // "insert" | "delete" | "replace" | "format" | "nodeFormat"
      status?: string; // "pending" | "accepted" | "rejected"
      nodeRevertData?: string; // JSON { type, attrs } — fallback for block suggestion rejection
      userId?: string; // Liveblocks user ID of the user who created the suggestion
    };
    // Room storage types
    Storage: {
      leftMargin: number;
      rightMargin: number;
    };
    // User info from auth endpoint
    UserMeta: {
      id: string;
      info: {
        name: string;
        avatar: string;
        color: string;
        isOwner?: boolean;
      };
    };
  }
}

export default client;
