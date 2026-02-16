"use client";

import { ReactNode, createContext, useContext, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useUser } from "@clerk/nextjs";

export interface RoomUser {
  id: string;
  name: string;
  avatar: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { from: number; to: number };
}

interface RemoteSelection {
  userId: string;
  userName: string;
  userColor: string;
  selection: { from: number; to: number };
}

interface RoomContextType {
  isConnected: boolean;
  onlineUsers: RoomUser[];
  remoteSelections: RemoteSelection[];
  emitDocumentUpdate: (content: string) => void;
  emitCursorUpdate: (cursor: { x: number; y: number }) => void;
  emitSelectionUpdate: (selection: { from: number; to: number }) => void;
}

const RoomContext = createContext<RoomContextType | null>(null);

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a Room provider");
  }
  return context;
};

interface RoomProps {
  children: ReactNode;
  roomId: string;
  onDocumentUpdate?: (content: string) => void;
}

export const Room = ({ children, roomId, onDocumentUpdate }: RoomProps) => {
  const { user } = useUser();
  const [remoteSelections, setRemoteSelections] = useState<RemoteSelection[]>([]);

  // Generate a random color for the user's cursor
  const userColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;

  const socketData = useSocket({
    roomId,
    userInfo: {
      id: user?.id || "anonymous",
      name: user?.fullName || user?.firstName || "Anonymous",
      avatar: user?.imageUrl || "",
      color: userColor,
    },
    onDocumentUpdate,
    onSelectionUpdate: (data) => {
      // Update or add the remote selection
      setRemoteSelections((prev) => {
        const filtered = prev.filter((s) => s.userId !== data.userId);
        return [...filtered, data];
      });
    },
    onUserLeft: (userId) => {
      // Remove the user's selection when they leave
      setRemoteSelections((prev) => prev.filter((s) => s.userId !== userId));
    },
  });

  const contextValue: RoomContextType = {
    isConnected: socketData.isConnected,
    onlineUsers: socketData.onlineUsers,
    remoteSelections,
    emitDocumentUpdate: socketData.emitDocumentUpdate,
    emitCursorUpdate: socketData.emitCursorUpdate,
    emitSelectionUpdate: socketData.emitSelectionUpdate,
  };

  return (
    <RoomContext.Provider value={contextValue}>
      {children}
    </RoomContext.Provider>
  );
};
