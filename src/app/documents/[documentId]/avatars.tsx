"use client";

import { RoomUser, useRoom } from "./room";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const Avatars = () => {
  const { onlineUsers, isConnected } = useRoom();

  const uniqueOnlineUsers = Object.values(
    onlineUsers.reduce(
      (mem, user) => ({
        ...mem,
        [user.id]: user,
      }),
      {} as Record<string, RoomUser>,
    ),
  );

  if (!isConnected || onlineUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {uniqueOnlineUsers.slice(0, 3).map((user, index) => (
          <Avatar
            key={user.id}
            className="h-8 w-8 border-2 border-white -ml-2 first:ml-0"
            style={{ zIndex: onlineUsers.length - index }}
          >
            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback
              className="text-xs font-semibold"
              style={{ backgroundColor: user.color }}
            >
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        ))}
        {uniqueOnlineUsers.length > 3 && (
          <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white -ml-2 flex items-center justify-center text-xs font-semibold">
            +{uniqueOnlineUsers.length - 3}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        <span>{uniqueOnlineUsers.length} online</span>
      </div>
    </div>
  );
};
