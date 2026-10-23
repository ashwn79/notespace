import type { Editor } from "@tiptap/core";
import {
  Code2,
  FileText,
  Globe,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  Smile,
  SquareCode,
  Table,
  Text,
  Video,
  ListCollapse,
  type LucideIcon,
} from "lucide-react";
import type { SlashActionContext } from "../extensions/slash-command";
import { fuzzyMatch } from "@/lib/editor/utils";
import type { SlashCategory } from "@/lib/editor/types";

/**
 * Slash command registry. Adding a new block = adding one entry here.
 * The `action` receives everything it needs (editor, delete range, host helpers).
 */

export interface SlashItem {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  category: SlashCategory;
  icon: LucideIcon;
  shortcut?: string;
  action: (ctx: SlashActionContext) => void;
}

const RECENTS_KEY = "aurora-slash-recents";

export function recordRecent(id: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [id, ...list.filter((x) => x !== id)].slice(0, 8);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — ignore */
  }
}

function getRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "text",
    title: "Text",
    description: "Just start writing with plain text.",
    keywords: ["paragraph", "plain", "text", "p"],
    category: "Basics",
    icon: Text,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  ...([1, 2, 3] as const).map((level) => ({
    id: `heading${level}`,
    title: `Heading ${level}`,
    description:
      level === 1 ? "Big section heading." : level === 2 ? "Medium section heading." : "Small section heading.",
    keywords: ["h" + level, "title", "heading"],
    category: "Basics" as SlashCategory,
    icon: ([Heading1, Heading2, Heading3] as const)[level - 1],
    shortcut: `Mod-Alt-${level}`,
    action: ({ editor, range }: SlashActionContext) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level }).run(),
  })),
  {
    id: "bulletList",
    title: "Bulleted list",
    description: "Create a simple bulleted list.",
    keywords: ["unordered", "bullet", "list", "ul"],
    category: "Basics",
    icon: List,
    shortcut: "Mod-Shift-8",
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "numberedList",
    title: "Numbered list",
    description: "Create a list with numbering.",
    keywords: ["ordered", "number", "list", "ol"],
    category: "Basics",
    icon: ListOrdered,
    shortcut: "Mod-Shift-7",
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "taskList",
    title: "To-do list",
    description: "Track tasks with checkboxes.",
    keywords: ["task", "todo", "checkbox", "check"],
    category: "Basics",
    icon: ListChecks,
    shortcut: "Mod-Shift-9",
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "toggleList",
    title: "Toggle list",
    description: "Hide and show content inside a collapsible block.",
    keywords: ["toggle", "collapse", "details", "fold"],
    category: "Basics",
    icon: ListCollapse,
    action: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "toggleBlock",
          attrs: { open: true },
          content: [
            { type: "toggleHeader", content: [{ type: "text", text: "Toggle title" }] },
            { type: "paragraph" },
          ],
        })
        .run(),
  },
  {
    id: "quote",
    title: "Quote",
    description: "Capture a quote or citation.",
    keywords: ["blockquote", "citation", "quote"],
    category: "Basics",
    icon: Quote,
    shortcut: "Mod-Shift-B" as string,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "divider",
    title: "Divider",
    description: "Visually divide sections with a line.",
    keywords: ["hr", "line", "separator", "divider"],
    category: "Basics",
    icon: Minus,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: "callout",
    title: "Callout",
    description: "Make writing stand out in a tinted box.",
    keywords: ["callout", "info", "note", "aside"],
    category: "Basics",
    icon: Smile,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).setCallout().run(),
  },
  {
    id: "codeBlock",
    title: "Code block",
    description: "Capture a code snippet with syntax highlighting.",
    keywords: ["code", "snippet", "pre"],
    category: "Basics",
    icon: SquareCode,
    shortcut: "Mod-Shift-E" as string,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "table",
    title: "Table",
    description: "Insert a 3×3 editable table.",
    keywords: ["table", "grid", "rows", "columns"],
    category: "Basics",
    icon: Table,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "image",
    title: "Image",
    description: "Upload an image from your device.",
    keywords: ["image", "photo", "picture", "upload"],
    category: "Media",
    icon: ImageIcon,
    action: ({ editor, range, requestUpload }) => {
      editor.chain().focus().deleteRange(range).run();
      requestUpload("image");
    },
  },
  {
    id: "video",
    title: "Video",
    description: "Upload a video file.",
    keywords: ["video", "movie", "mp4", "upload"],
    category: "Media",
    icon: Video,
    action: ({ editor, range, requestUpload }) => {
      editor.chain().focus().deleteRange(range).run();
      requestUpload("video");
    },
  },
  {
    id: "file",
    title: "File",
    description: "Attach any file with a download link.",
    keywords: ["file", "attachment", "upload", "pdf"],
    category: "Media",
    icon: FileText,
    action: ({ editor, range, requestUpload }) => {
      editor.chain().focus().deleteRange(range).run();
      requestUpload("file");
    },
  },
  {
    id: "embed",
    title: "Embed",
    description: "Embed a YouTube, Vimeo or Loom link.",
    keywords: ["embed", "iframe", "youtube", "vimeo", "loom"],
    category: "Embeds",
    icon: Globe,
    action: ({ editor, range, requestEmbed }) => {
      editor.chain().focus().deleteRange(range).run();
      requestEmbed();
    },
  },
  {
    id: "mathBlock",
    title: "Math block",
    description: "Render a LaTeX equation block.",
    keywords: ["math", "latex", "equation", "katex", "formula"],
    category: "Advanced",
    icon: Sigma,
    action: ({ editor, range, requestMath }) => {
      editor.chain().focus().deleteRange(range).run();
      requestMath(editor, false);
    },
  },
  {
    id: "mathInline",
    title: "Inline math",
    description: "Render LaTeX inside a sentence, e.g. $E=mc^2$.",
    keywords: ["math", "latex", "inline", "equation"],
    category: "Advanced",
    icon: Sigma,
    action: ({ editor, range, requestMath }) => {
      editor.chain().focus().deleteRange(range).run();
      requestMath(editor, true);
    },
  },
  {
    id: "emoji",
    title: "Emoji",
    description: "Pick an emoji from the palette.",
    keywords: ["emoji", "smiley", "icon", "reaction"],
    category: "Advanced",
    icon: Smile,
    action: ({ editor, range, requestEmoji }) => {
      editor.chain().focus().deleteRange(range).run();
      requestEmoji(editor);
    },
  },
];

export const SLASH_CATEGORIES: SlashCategory[] = ["Basics", "Media", "Advanced", "Embeds"];

/** Filter + rank items for the menu. Recents surface first on empty query. */
export function filterSlashItems(query: string): { category: string; items: SlashItem[] }[] {
  const q = query.replace(/^\//, "").trim();
  const recents = getRecents();

  if (!q) {
    const groups: { category: string; items: SlashItem[] }[] = [];
    const recentItems = recents
      .map((id) => SLASH_ITEMS.find((item) => item.id === id))
      .filter((item): item is SlashItem => Boolean(item))
      .slice(0, 6);
    if (recentItems.length) groups.push({ category: "Recent", items: recentItems });
    for (const category of SLASH_CATEGORIES) {
      groups.push({ category, items: SLASH_ITEMS.filter((item) => item.category === category) });
    }
    return groups;
  }

  const matched = SLASH_ITEMS.filter(
    (item) =>
      fuzzyMatch(q, item.title) ||
      fuzzyMatch(q, item.description) ||
      item.keywords.some((k) => fuzzyMatch(q, k) || k.startsWith(q.toLowerCase())),
  );

  const groups: { category: string; items: SlashItem[] }[] = [];
  for (const category of SLASH_CATEGORIES) {
    const items = matched.filter((item) => item.category === category);
    if (items.length) groups.push({ category, items });
  }
  return groups;
}

export function flattenSlashItems(groups: { items: SlashItem[] }[]): SlashItem[] {
  return groups.flatMap((g) => g.items);
}
