"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";

import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";

import Image from "@tiptap/extension-image";
import ImageResize from "tiptap-extension-resize-image";

import Underline from "@tiptap/extension-underline";
import FontFamily from "@tiptap/extension-font-family";
import TextStyle from "@tiptap/extension-text-style";

import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";

import TextAlign from "@tiptap/extension-text-align";

import Link from "@tiptap/extension-link";

import { useLiveblocksExtension } from "@liveblocks/react-tiptap";
import { useStorage, useSelf, useCreateThread } from "@liveblocks/react/suspense";
import { useCallback } from "react";

import { useEditorStore } from "@/store/use-editor-store";
import { FontSizeExtensions } from "@/extensions/font-size";
import { LineHeightExtension } from "@/extensions/line-height";
import { SuggestionInsert, SuggestionDelete } from "@/extensions/suggestion";
import { SuggestionMode } from "@/extensions/suggestion-mode";
import { Ruler } from "./ruler";
import { Threads } from "./threads";
import { LEFT_MARGIN_DEFAULT, RIGHT_MARGIN_DEFAULT } from "@/constants/margins";

interface EditorProps {
  initialContent?: string | undefined;
}

export const Editor = ({ initialContent }: EditorProps) => {
  const leftMargin = useStorage((root) => root.leftMargin) ?? LEFT_MARGIN_DEFAULT;
  const rightMargin = useStorage((root) => root.rightMargin) ?? RIGHT_MARGIN_DEFAULT;
  
  const currentUser = useSelf();
  const isOwner = currentUser?.info?.isOwner === true;
  const createThread = useCreateThread();

  // Debug log to see what we're getting
  console.log('Current user:', currentUser);
  console.log('Is owner:', isOwner);

  const liveblocks = useLiveblocksExtension({
    initialContent,
    offlineSupport_experimental: true,
  });
  const { setEditor } = useEditorStore();

  // Callback to create comment threads for suggestions
  const handleCreateSuggestion = useCallback(async (data: {
    suggestionId: string;
    type: "insert" | "delete";
    text: string;
    from: number;
    to: number;
  }) => {
    try {
      console.log('Creating thread for suggestion:', data);
      
      // Create thread anchored to the document position
      const thread = await createThread({
        body: {
          version: 1,
          content: [
            {
              type: "paragraph",
              children: [
                {
                  text: `Suggested ${data.type === "insert" ? "insertion" : "deletion"}: "${data.text.substring(0, 50)}${data.text.length > 50 ? "..." : ""}"`,
                },
              ],
            },
          ],
        },
        metadata: {
          suggestionId: data.suggestionId,
          changeType: data.type,
          status: "pending",
          resolved: false,
        },
      });
      
      console.log('Thread created successfully:', thread.id);
      return thread.id;
    } catch (error) {
      console.error("Failed to create thread:", error);
      return `temp-${data.suggestionId}`;
    }
  }, [createThread]);

  const editor = useEditor({
    immediatelyRender: false,
    onCreate({ editor }) {
      setEditor(editor);
    },
    onDestroy() {
      setEditor(null);
    },
    onUpdate({ editor }) {
      setEditor(editor);
    },
    onSelectionUpdate({ editor }) {
      setEditor(editor);
    },
    onTransaction({ editor }) {
      setEditor(editor);
    },
    onFocus({ editor }) {
      setEditor(editor);
    },
    onBlur({ editor }) {
      setEditor(editor);
    },
    onContentError({ editor }) {
      setEditor(editor);
    },
    editorProps: {
      attributes: {
        style: `padding-left: ${leftMargin}px; padding-right: ${rightMargin}px;`,
        class:
          "focus:outline-none print:boder-0 border bg-white border-editor-border flex flex-col min-h-[1054px] w-[816px] pt-10 pr-14 pb-10 cursor-text",
      },
    },
    extensions: [
      liveblocks,
      StarterKit.configure({
        history: false,
      }),
      SuggestionInsert,
      SuggestionDelete,
      SuggestionMode.configure({
        isOwner,
        userId: currentUser?.id || "",
        onCreateSuggestion: handleCreateSuggestion,
      }),
      Table,
      TableCell,
      TableHeader,
      TableRow,
      TaskList,
      Image,
      ImageResize,
      Underline,
      FontFamily,
      TextStyle,
      Color,
      LineHeightExtension.configure({
        types: ["heading", "paragraph"],
        defaultLineHeight: "1.5",
      }),
      FontSizeExtensions,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TaskItem.configure({ nested: true }),
    ],
  }, [isOwner, currentUser?.id, leftMargin, rightMargin, handleCreateSuggestion]);

  // Don't render editor until we have user data
  if (!currentUser) {
    return (
      <div className="size-full overflow-x-auto bg-editor-bg px-4 print:p-0 print:bg-white print:overflow-visible flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="size-full overflow-x-auto bg-editor-bg px-4 print:p-0 print:bg-white print:overflow-visible">
      <Ruler />
      <div className="min-w-max flex justify-center w-[816px] py-4 print:py-0 mx-auto print:w-full print:min-w-0">
        <EditorContent editor={editor} />
        <Threads editor={editor} />
      </div>
    </div>
  );
};
