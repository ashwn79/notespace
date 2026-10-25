import type { Editor } from "@tiptap/core";
import {
  Columns3,
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
  Music,
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
 * Items are intentionally subtitle-free (Notion-style compact menu);
 * `keywords` carry the matching surface instead.
 */

export interface SlashItem {
  id: string;
  title: string;
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
    keywords: ["paragraph", "plain", "text", "p"],
    category: "Basics",
    icon: Text,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  ...([1, 2, 3] as const).map((level) => ({
    id: `heading${level}`,
    title: `Heading ${level}`,
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
    keywords: ["unordered", "bullet", "list", "ul"],
    category: "Basics",
    icon: List,
    shortcut: "Mod-Shift-8",
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "numberedList",
    title: "Numbered list",
    keywords: ["ordered", "number", "list", "ol"],
    category: "Basics",
    icon: ListOrdered,
    shortcut: "Mod-Shift-7",
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "taskList",
    title: "To-do list",
    keywords: ["task", "todo", "checkbox", "check"],
    category: "Basics",
    icon: ListChecks,
    shortcut: "Mod-Shift-9",
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "toggleList",
    title: "Toggle list",
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
    id: "columns",
    title: "Columns",
    keywords: ["columns", "layout", "grid", "side by side", "two column"],
    category: "Basics",
    icon: Columns3,
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setColumns(2).run();
    },
  },
  {
    id: "quote",
    title: "Quote",
    keywords: ["blockquote", "citation", "quote"],
    category: "Basics",
    icon: Quote,
    shortcut: "Mod-Shift-B" as string,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "divider",
    title: "Divider",
    keywords: ["hr", "line", "separator", "divider"],
    category: "Basics",
    icon: Minus,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: "callout",
    title: "Callout",
    keywords: ["callout", "info", "note", "aside"],
    category: "Basics",
    icon: Smile,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).setCallout().run(),
  },
  {
    id: "codeBlock",
    title: "Code block",
    keywords: ["code", "snippet", "pre"],
    category: "Basics",
    icon: SquareCode,
    shortcut: "Mod-Shift-E" as string,
    action: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "table",
    title: "Table",
    keywords: ["table", "grid", "rows", "columns"],
    category: "Basics",
    icon: Table,
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "image",
    title: "Image",
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
    keywords: ["video", "movie", "mp4", "upload"],
    category: "Media",
    icon: Video,
    action: ({ editor, range, requestUpload }) => {
      editor.chain().focus().deleteRange(range).run();
      requestUpload("video");
    },
  },
  {
    id: "audio",
    title: "Audio",
    keywords: ["audio", "music", "mp3", "podcast", "sound"],
    category: "Media",
    icon: Music,
    action: ({ editor, range, requestUpload }) => {
      editor.chain().focus().deleteRange(range).run();
      requestUpload("audio");
    },
  },
  {
    id: "file",
    title: "File",
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
    keywords: ["math", "latex", "inline", "equation"],
    category: "Advanced",
    icon: Sigma,
    action: ({ editor, range, requestMath }) => {
      editor.chain().focus().deleteRange(range).run();
      requestMath(editor, true);
    },
  },
];

export const SLASH_CATEGORIES: SlashCategory[] = ["Basics", "Media", "Advanced", "Embeds"];

/**
 * Relevance score — lower is better. The menu's initial highlight is the
 * first item of the flattened list, so ranking decides which item the
 * keyboard "lands on" (typing `/video` must select **Video**, not Divider).
 */
function scoreItem(query: string, item: SlashItem): number {
  const q = query.toLowerCase();
  const title = item.title.toLowerCase();
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  if (item.keywords.some((k) => k === q)) return 2;
  if (item.keywords.some((k) => k.startsWith(q))) return 3;
  if (title.includes(q)) return 4;
  if (item.keywords.some((k) => k.includes(q))) return 5;
  if (fuzzyMatch(q, item.title)) return 6;
  if (item.keywords.some((k) => fuzzyMatch(q, k))) return 7;
  return 100;
}

/** Filter + rank items for the menu. Recents surface first on empty query. */
export function filterSlashItems(query: string): { category: string; items: SlashItem[] }[] {
  const q = query.replace(/^\//, "").trim().toLowerCase();
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

  const matched = SLASH_ITEMS.map((item) => ({ item, score: scoreItem(q, item) }))
    .filter((entry) => entry.score < 100)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);

  // Group the ranked results, preserving global relevance order.
  const groups = new Map<string, SlashItem[]>();
  for (const item of matched) {
    const bucket = groups.get(item.category) ?? [];
    bucket.push(item);
    groups.set(item.category, bucket);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}

export function flattenSlashItems(groups: { items: SlashItem[] }[]): SlashItem[] {
  return groups.flatMap((g) => g.items);
}
