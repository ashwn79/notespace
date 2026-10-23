import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder, TrailingNode } from "@tiptap/extensions";
import { BackgroundColor, Color, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import type { Editor } from "@tiptap/core";

import { Callout } from "../extensions/callout";
import { ToggleBlock, ToggleHeader } from "../extensions/toggle";
import { MathBlock, MathInline } from "../extensions/math";
import { Embed, FileBlock, VideoBlock } from "../extensions/media";
import { ImageBlock } from "../extensions/image-block";
import { CodeBlock } from "../extensions/code-block";
import { SearchReplace } from "../extensions/search-replace";
import { BlockSelectionHighlight } from "../extensions/block-selection";
import { EditorKeyboard, TaskInputRule } from "../extensions/keyboard";
import { SlashCommand } from "../extensions/slash-command";

/**
 * The extension kit. Every capability of the editor is an extension —
 * this is the single place where the document schema is composed,
 * which keeps the architecture modular and future-plugin friendly.
 */

export function buildExtensions(options: {
  getActionContext: Parameters<typeof SlashCommand.configure>[0]["getActionContext"];
}) {
  return [
    // Core text document
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: false, // replaced by CodeBlockLowlight below
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
      dropcursor: { color: "#a78bfa", width: 2 },
      undoRedo: { depth: 300, newGroupDelay: 400 },
      trailingNode: false, // custom TrailingNode below
    }),

    // Text styling
    TextStyle,
    Color,
    BackgroundColor,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TextAlign.configure({ types: ["heading", "paragraph"] }),

    // Lists
    TaskList,
    TaskItem.configure({ nested: true }),

    // Blocks
    CodeBlock,
    ImageBlock,
    VideoBlock,
    FileBlock,
    Embed,
    Callout,
    ToggleBlock,
    ToggleHeader,
    MathInline,
    MathBlock,

    // Tables
    Table.configure({ resizable: true, lastColumnResizable: false }),
    TableRow,
    TableHeader,
    TableCell,

    // Behavior / UX
    SearchReplace,
    BlockSelectionHighlight,
    EditorKeyboard,
    TaskInputRule,
    SlashCommand.configure({ getActionContext: options.getActionContext }),
    TrailingNode.configure({ node: "paragraph", notAfter: ["paragraph"] }),

    // Placeholders ("Type '/' for commands…")
    Placeholder.configure({
      includeChildren: true,
      placeholder: ({ node, editor: ed, pos }) => {
        if (node.type.name === "heading") {
          return `Heading ${node.attrs.level}`;
        }
        if (node.type.name === "toggleHeader") {
          return "Toggle title";
        }
        const isEmptyDoc =
          ed.isEmpty &&
          node.type.name === "paragraph" &&
          stateIsEmptyAtStart(ed, pos);
        return isEmptyDoc ? "Type '/' for commands, or just start writing…" : "";
      },
    }),

    CharacterCount.configure({ limit: null }),
  ];
}

function stateIsEmptyAtStart(editor: Editor, pos: number): boolean {
  // Only the very first paragraph of an empty document gets the hint.
  return pos <= 1;
}
