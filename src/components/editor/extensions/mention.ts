import { Extension, Node, mergeAttributes, CommandProps } from "@tiptap/core";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { MentionDateAttrs } from "@/lib/editor/dates";
import { defaultDateAttrs, dateChipLabel } from "@/lib/editor/dates";
import { MentionChipView } from "../nodes/mention-chip";

/**
 * Generic inline mention system. One atom node renders three chip flavors:
 *
 * - `date`   → date / range / reminder chip (opens the Notion-style panel)
 * - `person` → avatar + name chip
 * - `page`   → page-link chip
 *
 * Chips are typographically neutral: they inherit font size / line height
 * and sit on the text baseline so inserting one never reflows a paragraph.
 */

export type MentionType = "date" | "person" | "page";

export interface MentionAttrs extends MentionDateAttrs {
  mentionType: MentionType;
  /** Person display name. */
  name: string;
  /** Page link title. */
  title: string;
  /** Page identifier ("current" = this document). */
  pageId: string;
  /** Open the date panel automatically on mount (fresh "Pick a date"). */
  openPanel: boolean;
}

export function mentionLabel(attrs: Partial<MentionAttrs>): string {
  switch (attrs.mentionType) {
    case "date":
      return dateChipLabel(attrs as MentionDateAttrs);
    case "person":
      return attrs.name || "Person";
    case "page":
      return attrs.title || "Untitled page";
    default:
      return "Mention";
  }
}

function boolAttr(value: unknown, fallback = false): boolean {
  return typeof value === "string" ? value === "true" : Boolean(value);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mention: {
      insertMention: (attrs: Partial<MentionAttrs>) => ReturnType;
    };
  }
}

export const Mention = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      mentionType: { default: "date" },
      date: { default: null },
      endDate: { default: null },
      includeTime: { default: false },
      startTime: { default: "" },
      endTime: { default: "" },
      format: { default: "relative" },
      reminder: { default: null },
      name: { default: "" },
      title: { default: "" },
      pageId: { default: "" },
      openPanel: {
        default: false,
        parseHTML: (element) => boolAttr(element.getAttribute("data-open-panel")),
        renderHTML: () => ({}), // transient — never serialized
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-mention]" }];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as MentionAttrs;
    const renderer: Record<string, string> = {
      "data-mention": attrs.mentionType,
      "data-mention-label": mentionLabel(attrs),
    };
    if (attrs.mentionType === "date") {
      renderer["data-date"] = attrs.date ?? "";
      if (attrs.endDate) renderer["data-end-date"] = attrs.endDate;
      renderer["data-include-time"] = String(attrs.includeTime);
      renderer["data-start-time"] = attrs.startTime ?? "";
      renderer["data-end-time"] = attrs.endTime ?? "";
      renderer["data-format"] = attrs.format;
      if (attrs.reminder) renderer["data-reminder"] = attrs.reminder;
    }
    if (attrs.mentionType === "person") renderer["data-name"] = attrs.name;
    if (attrs.mentionType === "page") {
      renderer["data-title"] = attrs.title;
      renderer["data-page-id"] = attrs.pageId;
    }
    return ["span", mergeAttributes(renderer), mentionLabel(attrs)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionChipView);
  },

  addCommands() {
    return {
      insertMention:
        (attrs) =>
        ({ chain }: CommandProps) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { ...defaultMentionAttrs(attrs.mentionType ?? "date"), ...attrs, openPanel: attrs.openPanel ?? false },
            })
            .run(),
    };
  },
});

export function defaultMentionAttrs(type: MentionType): Partial<MentionAttrs> {
  if (type === "date") return defaultDateAttrs();
  if (type === "person") return { name: "" };
  return { title: "", pageId: "" };
}

/* ------------------------------------------------------------------ */
/*  "@" trigger — bridges ProseMirror ↔ the React mention menu         */
/* ------------------------------------------------------------------ */

export interface MentionActionContext {
  /** The mention item that was picked from the menu. */
  apply: (editor: import("@tiptap/core").Editor, range: import("@tiptap/core").Range) => void;
}

type MentionSuggestionProps = SuggestionProps<MentionMenuItem>;

export interface MentionMenuItem {
  id: string;
  group: "People" | "Dates" | "Pages";
  label: string;
  /** Emoji shown before the label (optional). */
  emoji?: string;
  keywords: string[];
  hint?: string;
  apply: (editor: import("@tiptap/core").Editor, range: import("@tiptap/core").Range) => void;
}

interface MentionRenderer {
  onStart: (props: MentionSuggestionProps) => void;
  onUpdate: (props: MentionSuggestionProps) => void;
  onExit: () => void;
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

class MentionController {
  private renderer: MentionRenderer | null = null;

  attach(renderer: MentionRenderer) {
    this.renderer = renderer;
  }

  detach() {
    this.renderer = null;
  }

  start = (props: MentionSuggestionProps) => this.renderer?.onStart(props);
  update = (props: MentionSuggestionProps) => this.renderer?.onUpdate(props);
  exit = () => this.renderer?.onExit();
  keydown = (props: SuggestionKeyDownProps) => this.renderer?.onKeyDown(props) ?? false;
}

export const mentionController = new MentionController();

export const MentionTrigger = Extension.create({
  name: "mentionTrigger",

  addProseMirrorPlugins() {
    return [
      Suggestion<MentionMenuItem>({
        editor: this.editor,
        pluginKey: new PluginKey("mentionMenu"),
        char: "@",
        startOfLine: false,
        allowSpaces: true,
        allowedPrefixes: [" ", ""], // space or line start (not mid-word)
        items: () => [],
        command: ({ editor, range, props }) => {
          props.apply(editor, range);
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.spec.code || $from.parent.type.name === "codeBlock") return false;
          return true;
        },
        render: () => ({
          onStart: (props) => mentionController.start(props as MentionSuggestionProps),
          onUpdate: (props) => mentionController.update(props as MentionSuggestionProps),
          onExit: () => mentionController.exit(),
          onKeyDown: (props) => mentionController.keydown(props),
        }),
      }),
    ];
  },
});
