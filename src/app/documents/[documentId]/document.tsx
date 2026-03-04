"use client";

import { Room } from "./room";
import { Editor } from "./editor";
import { Navbar } from "./navbar";
import { Toolbar } from "./toolbar";
import { Document as DocumentType } from "@/hooks/use-documents";
import { useEditorStore } from "@/store/use-editor-store";

interface DocumentProps {
  initialDocument: DocumentType;
}

export const Document = ({ initialDocument }: DocumentProps) => {
  const { viewMode } = useEditorStore();
  const showToolbar = viewMode !== "result";

  return (
    <Room>
      <div className="min-h-screen bg-editor-bg">
        <div className={`flex flex-col px-4 pt-2 gap-y-2 fixed top-0 left-0 right-0 z-10 bg-[#FAFBFD] print:hidden ${showToolbar ? "h-[112px]" : "h-[68px]"}`}>
          <Navbar data={initialDocument} />
          <Toolbar />
        </div>
        <div className={`${showToolbar ? "pt-[114px]" : "pt-[70px]"} print:pt-0`}>
          <Editor initialContent={initialDocument.initialContent ?? undefined} />
        </div>
      </div>
    </Room>
  );
};
