import { Extension } from "@tiptap/core";
import type { Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import type { MentionMenuItem } from "@/lib/editor/mentions/framework";

/** Unique plugin key — multiple suggestion plugins (/, @, :) must not collide. */
const AtMenuKey = new PluginKey("atMenu");

/**
 * "@" trigger wiring — mirrors the "/" slash bridge. The extension only
 * shuttles ProseMirror ↔ React; the menu itself lives in <AtMenu />,
 * connected through atController.
 */

type AtProps = SuggestionProps<MentionMenuItem>;

interface AtRenderer {
  onStart: (props: AtProps) => void;
  onUpdate: (props: AtProps) => void;
  onExit: () => void;
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

class AtController {
  private renderer: AtRenderer | null = null;

  attach(renderer: AtRenderer) {
    this.renderer = renderer;
  }

  detach() {
    this.renderer = null;
  }

  start = (props: AtProps) => this.renderer?.onStart(props);
  update = (props: AtProps) => this.renderer?.onUpdate(props);
  exit = () => this.renderer?.onExit();
  keydown = (props: SuggestionKeyDownProps) => this.renderer?.onKeyDown(props) ?? false;
}

export const atController = new AtController();

export interface AtRange {
  from: number;
  to: number;
  query: string;
}

export const AtCommand = Extension.create({
  name: "atCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<MentionMenuItem>({
        editor: this.editor,
        pluginKey: AtMenuKey,
        char: "@",
        startOfLine: false,
        // The mention query is a single token — a space ends it (Notion-like).
        allowSpaces: false,
        // Per spec the menu opens wherever "@" is typed inside editable
        // content (null = no prefix restriction); code blocks / inline code
        // remain the only exceptions.
        allowedPrefixes: null,
        // The React menu computes its own filtered list from `query`.
        items: () => [],
        command: ({ editor, range, props }) => {
          props.run({ editor, range: range as Range });
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const parent = $from.parent;
          // Never trigger inside code blocks / inline code.
          if (parent.type.spec.code || parent.type.name === "codeBlock") return false;
          return true;
        },
        render: () => ({
          onStart: (props) => atController.start(props as AtProps),
          onUpdate: (props) => atController.update(props as AtProps),
          onExit: () => atController.exit(),
          onKeyDown: (props) => atController.keydown(props),
        }),
      }),
    ];
  },
});
