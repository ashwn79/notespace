import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";

/** Unique plugin key — multiple suggestion plugins (/, @, :) must not collide. */
const EmojiMenuKey = new PluginKey("emojiMenu");

/**
 * ":" trigger — quick emoji insertion. The React menu (<EmojiMenu />) does
 * the filtering + keyboard navigation through emojiController.
 */

export interface EmojiActionProps {
  emoji: string;
}

type EmojiProps = SuggestionProps<EmojiActionProps>;

interface EmojiRenderer {
  onStart: (props: EmojiProps) => void;
  onUpdate: (props: EmojiProps) => void;
  onExit: () => void;
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

class EmojiController {
  private renderer: EmojiRenderer | null = null;

  attach(renderer: EmojiRenderer) {
    this.renderer = renderer;
  }

  detach() {
    this.renderer = null;
  }

  start = (props: EmojiProps) => this.renderer?.onStart(props);
  update = (props: EmojiProps) => this.renderer?.onUpdate(props);
  exit = () => this.renderer?.onExit();
  keydown = (props: SuggestionKeyDownProps) => this.renderer?.onKeyDown(props) ?? false;
}

export const emojiController = new EmojiController();

export const EmojiCommand = Extension.create({
  name: "emojiCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<EmojiActionProps>({
        editor: this.editor,
        pluginKey: EmojiMenuKey,
        char: ":",
        startOfLine: false,
        // Emoji names are single tokens — a space ends the query.
        allowSpaces: false,
        // ":" must open at a word boundary so times like 10:30 never trigger.
        allowedPrefixes: [" "],
        items: () => [],
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: EmojiActionProps }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(`${props.emoji} `)
            .run();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const parent = $from.parent;
          if (parent.type.spec.code || parent.type.name === "codeBlock") return false;
          return true;
        },
        render: () => ({
          onStart: (props) => emojiController.start(props as EmojiProps),
          onUpdate: (props) => emojiController.update(props as EmojiProps),
          onExit: () => emojiController.exit(),
          onKeyDown: (props) => emojiController.keydown(props),
        }),
      }),
    ];
  },
});
