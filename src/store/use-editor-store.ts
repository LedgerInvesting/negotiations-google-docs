import { create } from "zustand";
import { type Editor } from "@tiptap/react";

export type ViewMode = "suggestion" | "result";

interface EditorState {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
  viewMode: "suggestion",
  setViewMode: (viewMode) => set({ viewMode }),
}));
