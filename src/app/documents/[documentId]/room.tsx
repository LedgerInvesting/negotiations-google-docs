"use client";

import { ReactNode } from "react";
import { FullscreenLoader } from "@/components/fullscreen-loader";

interface RoomProps {
  children: ReactNode;
}

export const Room = ({ children }: RoomProps) => {
  // Room component simplified - real-time collaboration will be handled via WebSockets
  // For now, just render children without Liveblocks
  return <>{children}</>;
};
