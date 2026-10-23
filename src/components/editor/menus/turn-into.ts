import type { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import {
  CaseSensitive,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  SquareCode,
  Text,
  ListCollapse,
  Info,
  type LucideIcon,
} from "lucide-react";

/**
 * "Turn into…" — converts the current top-level block to another block type.
 * Shared between the drag-handle menu and the right-click context menu.
 */

/**
 * Wrap-style commands (wrapIn / toggleList) need a text cursor inside the
 * block — a NodeSelection (set by the drag handle) has an empty blockRange
 * and would silently no-op. Normalize first, then run.
 */
function runConversion(editor: Editor, run: (editor: Editor) => void) {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection) {
    // Drop the caret just inside the selected node, then find the nearest
    // valid text position (handles atom nodes like images gracefully).
    const $pos = editor.state.doc.resolve(selection.from + 1);
    editor.commands.setTextSelection(TextSelection.near($pos, 1));
  }
  run(editor);
}

export interface TurnIntoOption {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

export const TURN_INTO_OPTIONS: TurnIntoOption[] = [
  {
    id: "paragraph",
    label: "Text",
    icon: Text,
    isActive: (e) => e.isActive("paragraph") && !e.isActive("toggleHeader"),
    run: (e) => runConversion(e, (ed) => ed.chain().focus().setParagraph().run()),
  },
  ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
    id: `heading${level}`,
    label: `Heading ${level}`,
    icon: [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6][level - 1],
    isActive: (e: Editor) => e.isActive("heading", { level }),
    run: (e: Editor) => runConversion(e, (ed) => ed.chain().focus().setNode("heading", { level }).run()),
  })),
  {
    id: "bulletList",
    label: "Bulleted list",
    icon: List,
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => runConversion(e, (ed) => ed.chain().focus().toggleBulletList().run()),
  },
  {
    id: "numberedList",
    label: "Numbered list",
    icon: ListOrdered,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => runConversion(e, (ed) => ed.chain().focus().toggleOrderedList().run()),
  },
  {
    id: "taskList",
    label: "To-do list",
    icon: ListChecks,
    isActive: (e) => e.isActive("taskList"),
    run: (e) => runConversion(e, (ed) => ed.chain().focus().toggleTaskList().run()),
  },
  {
    id: "toggle",
    label: "Toggle list",
    icon: ListCollapse,
    isActive: (e) => e.isActive("toggleBlock"),
    run: (e) => runConversion(e, (ed) => ed.chain().focus().setToggleBlock().run()),
  },
  {
    id: "quote",
    label: "Quote",
    icon: Quote,
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => runConversion(e, (ed) => ed.chain().focus().toggleBlockquote().run()),
  },
  {
    id: "callout",
    label: "Callout",
    icon: Info,
    isActive: (e) => e.isActive("callout"),
    run: (e) => runConversion(e, (ed) => ed.chain().focus().setCallout().run()),
  },
  {
    id: "codeBlock",
    label: "Code block",
    icon: SquareCode,
    isActive: (e) => e.isActive("codeBlock"),
    run: (e) => runConversion(e, (ed) => ed.chain().focus().toggleCodeBlock().run()),
  },
];

export const ACTIVE_TURN_INTO_FALLBACK = { label: "Block type", icon: CaseSensitive };
