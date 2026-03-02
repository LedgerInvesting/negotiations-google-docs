"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

// icons
import { BsFilePdf } from "react-icons/bs";
import {
  BoldIcon,
  ChevronDownIcon,
  CheckIcon,
  FileIcon,
  FileJsonIcon,
  FilePenIcon,
  FilePlusIcon,
  FileTextIcon,
  GitPullRequestDraftIcon,
  GlobeIcon,
  ItalicIcon,
  PrinterIcon,
  Redo2Icon,
  RemoveFormattingIcon,
  ScanEyeIcon,
  StrikethroughIcon,
  TextIcon,
  // TrashIcon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";

import { RenameDialog } from "@/components/rename-dialog";
// import { RemoveDialog } from "@/components/remove-dialog";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Avatars } from "./avatars";

import { DocumentInput } from "./document-input";
import { useEditorStore } from "@/store/use-editor-store";
import { useSelf } from "@liveblocks/react";
import type { ViewMode } from "@/store/use-editor-store";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Inbox } from "./inbox";
import { Document } from "@/hooks/use-documents";
import { useCreateDocument } from "@/hooks/use-documents";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface NavbarProps {
  data: Document;
}

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: "suggestion",
    label: "Suggestion Mode",
    icon: <GitPullRequestDraftIcon className="size-4" />,
    description: "Show tracked changes",
  },
  {
    value: "result",
    label: "Result Mode",
    icon: <ScanEyeIcon className="size-4" />,
    description: "Show final result",
  },
];

export const Navbar = ({ data }: NavbarProps) => {
  const router = useRouter();
  const { editor, viewMode, setViewMode } = useEditorStore();
  const currentUser = useSelf();
  const isOwner = currentUser?.info?.isOwner === true;
  const { create } = useCreateDocument();

  const onNewDocument = async () => {
    try {
      const id = await create({
        title: "Untitled Document",
        initialContent: "",
      });
      toast.success("Document created");
      router.push(`/documents/${id}`);
    } catch {
      toast.error("Something went wrong");
    }
  };

  const insertTable = ({ rows, cols }: { rows: number; cols: number }) => {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run();
  };

  const onDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const onSaveJson = () => {
    if (!editor) return;

    const content = editor.getJSON();
    const blob = new Blob([JSON.stringify(content)], {
      type: "application/json",
    });
    onDownload(blob, `${data.title}.json`);
  };

  const onSaveHTML = () => {
    if (!editor) return;

    const content = editor.getHTML();
    const blob = new Blob([content], {
      type: "text/html",
    });
    onDownload(blob, `${data.title}.html`);
  };

  const onSaveText = () => {
    if (!editor) return;

    const content = editor.getText();
    const blob = new Blob([content], {
      type: "text/plain",
    });
    onDownload(blob, `${data.title}.txt`);
  };

  return (
    <nav className="flex items-center justify-between">
      <div className="flex gap-2 items-center">
        <Link href="/">
          <Image src={"/logo.svg"} alt="logo" width={36} height={36} />
        </Link>
        <div className="flex flex-col">
          <DocumentInput title={data.title} id={data.id} />
          <div className="flex">
            <Menubar className="border-none bg-transparent shadow-none h-auto p-0">
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-normal py-0.5 px-[7px] rounded-sm hover:bg-muted h-auto">
                  File
                </MenubarTrigger>
                <MenubarContent className="print:hidden">
                  <MenubarSub>
                    <MenubarSubTrigger>
                      <FileIcon className="size-4 mr-2" /> Save
                    </MenubarSubTrigger>
                    <MenubarSubContent>
                      <MenubarItem onClick={onSaveJson}>
                        <FileJsonIcon className="size-4 mr-2" />
                        JSON
                      </MenubarItem>
                      <MenubarItem onClick={onSaveHTML}>
                        <GlobeIcon className="size-4 mr-2" />
                        HTML
                      </MenubarItem>
                      <MenubarItem onClick={() => window.print()}>
                        <BsFilePdf className="size-4 mr-2" />
                        PDF
                      </MenubarItem>
                      <MenubarItem onClick={onSaveText}>
                        <FileTextIcon className="size-4 mr-2" />
                        Text
                      </MenubarItem>
                    </MenubarSubContent>
                  </MenubarSub>
                  <MenubarItem onClick={onNewDocument}>
                    <FilePlusIcon className="mr-2 size-4" />
                    New Document
                  </MenubarItem>
                  <MenubarSeparator />
                  <RenameDialog documentId={data.id} initialTitle={data.title}>
                    <MenubarItem
                      onClick={(e) => e.stopPropagation()}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <FilePenIcon className="mr-2 size-4" />
                      Rename
                    </MenubarItem>
                  </RenameDialog>
                  {/* <RemoveDialog documentId={data._id}>
                    <MenubarItem
                      onClick={(e) => e.stopPropagation()}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <TrashIcon className="mr-2 size-4" />
                      Remove
                    </MenubarItem>
                  </RemoveDialog> */}
                  <MenubarSeparator />
                  <MenubarItem onClick={() => window.print()}>
                    <PrinterIcon className="mr-2 size-4" />
                    Print <MenubarShortcut>&#x2318; + P</MenubarShortcut>
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-normal py-0.5 px-[7px] rounded-sm hover:bg-muted h-auto">
                  Edit
                </MenubarTrigger>
                <MenubarContent>
                  {isOwner && (
                    <MenubarItem onClick={() => editor?.chain().focus().undo().run()}>
                      <Undo2Icon className="mr-2 size-4" />
                      Undo <MenubarShortcut>&#x2318; + Z</MenubarShortcut>
                    </MenubarItem>
                  )}
                  {isOwner && (
                    <MenubarItem onClick={() => editor?.chain().focus().redo().run()}>
                      <Redo2Icon className="mr-2 size-4" />
                      Redo <MenubarShortcut>&#x2318; + Y</MenubarShortcut>
                    </MenubarItem>
                  )}
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-normal py-0.5 px-[7px] rounded-sm hover:bg-muted h-auto">
                  Insert
                </MenubarTrigger>
                <MenubarContent>
                  <MenubarSub>
                    <MenubarSubTrigger>Table</MenubarSubTrigger>
                    <MenubarSubContent>
                      <MenubarItem onClick={() => insertTable({ rows: 1, cols: 1 })}>
                        1 x 1
                      </MenubarItem>
                      <MenubarItem onClick={() => insertTable({ rows: 2, cols: 2 })}>
                        2 x 2
                      </MenubarItem>
                      <MenubarItem onClick={() => insertTable({ rows: 4, cols: 4 })}>
                        4 x 4
                      </MenubarItem>
                      <MenubarItem onClick={() => insertTable({ rows: 4, cols: 6 })}>
                        4 x 6
                      </MenubarItem>
                    </MenubarSubContent>
                  </MenubarSub>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-normal py-0.5 px-[7px] rounded-sm hover:bg-muted h-auto">
                  Format
                </MenubarTrigger>
                <MenubarContent>
                  <MenubarSub>
                    <MenubarSubTrigger>
                      <TextIcon className="size-4 mr-2" />
                      Text
                    </MenubarSubTrigger>
                    <MenubarSubContent>
                      <MenubarItem onClick={() => editor?.chain().focus().toggleBold().run()}>
                        <BoldIcon className="size-4 mr-2" />
                        Bold
                      </MenubarItem>
                      <MenubarItem onClick={() => editor?.chain().focus().toggleItalic().run()}>
                        <ItalicIcon className="size-4 mr-2" />
                        Italic
                      </MenubarItem>
                      <MenubarItem onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                        <UnderlineIcon className="size-4 mr-2" />
                        Underline
                      </MenubarItem>
                      <MenubarItem onClick={() => editor?.chain().focus().toggleStrike().run()}>
                        <StrikethroughIcon className="size-4 mr-2" />
                        Strikethrough
                      </MenubarItem>
                    </MenubarSubContent>
                  </MenubarSub>
                  {isOwner && (
                    <MenubarItem onClick={() => editor?.chain().focus().unsetAllMarks().run()}>
                      <RemoveFormattingIcon className="size-4 mr-2" />
                      Clear formatting
                    </MenubarItem>
                  )}
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </div>
        </div>
      </div>
      <div className="flex gap-3 items-center pl-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
              {VIEW_MODE_OPTIONS.find((o) => o.value === viewMode)?.icon}
              <span>{VIEW_MODE_OPTIONS.find((o) => o.value === viewMode)?.label}</span>
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {VIEW_MODE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setViewMode(option.value)}
                className="flex items-start gap-2 py-2"
              >
                <span className="mt-0.5 shrink-0">{option.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
                {viewMode === option.value && (
                  <CheckIcon className="size-4 shrink-0 mt-0.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Avatars />
        <Inbox />
        <OrganizationSwitcher
          afterCreateOrganizationUrl="/"
          afterLeaveOrganizationUrl="/"
          afterSelectOrganizationUrl="/"
          afterSelectPersonalUrl="/"
        />
        <UserButton />
      </div>
    </nav>
  );
};
