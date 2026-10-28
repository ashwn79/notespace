import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { SlashItem } from "../menus/slash-items";

/**
 * "/" trigger wiring. The extension only bridges ProseMirror ↔ React:
 * the actual menu lives in <SlashMenu />, connected through slashController.
 */

export interface SlashActionContext {
  editor: Editor;
  range: Range;
  requestUpload: (kind: "image" | "video" | "audio" | "file") => void;
  requestEmoji: (editor: Editor) => void;
  requestEmbed: () => void;
  requestMath: (editor: Editor, inline: boolean) => void;
}

/** Host-provided helpers (everything except editor & range). */
export type SlashActionHelpers = Omit<SlashActionContext, "editor" | "range">;

type SlashProps = SuggestionProps<SlashItem>;

interface SlashRenderer {
  onStart: (props: SlashProps) => void;
  onUpdate: (props: SlashProps) => void;
  onExit: () => void;
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

class SlashController {
  private renderer: SlashRenderer | null = null;

  attach(renderer: SlashRenderer) {
    this.renderer = renderer;
  }

  detach() {
    this.renderer = null;
  }

  start = (props: SlashProps) => this.renderer?.onStart(props);
  update = (props: SlashProps) => this.renderer?.onUpdate(props);
  exit = () => this.renderer?.onExit();
  keydown = (props: SuggestionKeyDownProps) => this.renderer?.onKeyDown(props) ?? false;
}

export const slashController = new SlashController();

export const SlashCommand = Extension.create<{ getActionContext: () => SlashActionHelpers }>({
  name: "slashCommand",

  addOptions() {
    return {
      getActionContext: () => {
        throw new Error("SlashCommand requires getActionContext");
      },
    };
  },

  addProseMirrorPlugins() {
    const getActionContext = () => this.options.getActionContext();

    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        pluginKey: new PluginKey("slashMenu"),
        char: "/",
        startOfLine: false,
        allowSpaces: true,
        // The React menu computes its own filtered list from `query`;
        // the plugin itself needs no items.
        items: () => [],
        command: ({ editor, range, props }) => {
          props.action({ editor, range, ...getActionContext() });
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const parent = $from.parent;
          // Never trigger inside code blocks / inline code.
          if (parent.type.spec.code || parent.type.name === "codeBlock") return false;
          // Not right after another slash menu insertion.
          return true;
        },
        render: () => ({
          onStart: (props) => slashController.start(props as SlashProps),
          onUpdate: (props) => slashController.update(props as SlashProps),
          onExit: () => slashController.exit(),
          onKeyDown: (props) => slashController.keydown(props),
        }),
      }),
    ];
  },
});
