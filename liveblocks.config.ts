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
    ThreadMetadata: {
      resolved: boolean;
      // Suggestion-specific metadata
      suggestionId?: string;
      changeType?: string; // "insert" | "delete"
      status?: string; // "pending" | "accepted" | "rejected"
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
