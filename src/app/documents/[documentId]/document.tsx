"use client";

import { Room } from "./room";
import { Editor } from "./editor";
import { Navbar } from "./navbar";
import { Toolbar } from "./toolbar";
import { useDocument } from "@/hooks/use-documents";
import { FullscreenLoader } from "@/components/fullscreen-loader";

interface DocumentProps {
  documentId: number;
}

export const Document = ({ documentId }: DocumentProps) => {
  const { document, loading, error } = useDocument(documentId);

  if (loading) {
    return <FullscreenLoader label="Loading document..." />;
  }

  if (error || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">
          {error ? error.message : "Document not found"}
        </div>
      </div>
    );
  }

  return (
    <Room>
      <div className="min-h-screen bg-editor-bg">
        <div className="flex flex-col px-4 pt-2 gap-y-2 fixed top-0 left-0 right-0 z-10 bg-[#FAFBFD] print:hidden h-[112px]">
          <Navbar data={document} />
          <Toolbar />
        </div>
        <div className="pt-[114px] print:pt-0">
          <Editor 
            initialContent={document.content || document.initial_content} 
            documentId={documentId}
          />
        </div>
      </div>
    </Room>
  );
};
