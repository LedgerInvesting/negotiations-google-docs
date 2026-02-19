"use client";

import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon } from "lucide-react";
import { useEditor } from "@tiptap/react";
import { acceptSuggestion, rejectSuggestion } from "@/lib/suggestion-helpers";
import { useSelf } from "@liveblocks/react";

interface SuggestionCommentProps {
  suggestionId: string;
  changeType: "insert" | "delete";
  onAccept?: () => void;
  onReject?: () => void;
}

export function SuggestionComment({
  suggestionId,
  changeType,
  onAccept,
  onReject,
}: SuggestionCommentProps) {
  const currentUser = useSelf();
  const isOwner = Boolean(currentUser?.info?.isOwner ?? false);

  if (!isOwner) {
    return null;
  }

  return (
    <div className="flex gap-2 mt-2 border-t pt-2">
      <Button
        size="sm"
        variant="default"
        className="flex-1 bg-green-600 hover:bg-green-700"
        onClick={onAccept}
      >
        <CheckIcon className="size-4 mr-1" />
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
        onClick={onReject}
      >
        <XIcon className="size-4 mr-1" />
        Reject
      </Button>
    </div>
  );
}
