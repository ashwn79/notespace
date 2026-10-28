import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { TextSelection } from "@tiptap/pm/state";

/**
 * Multi-block selection highlight.
 * When a text selection fully spans 2+ top-level blocks, those blocks get a
 * Notion-style tinted background via node decorations.
 */

const blockSelectionKey = new PluginKey("blockSelectionHighlight");

export const BlockSelectionHighlight = Extension.create({
  name: "blockSelectionHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockSelectionKey,
        props: {
          decorations(state) {
            const { selection } = state;
            if (!(selection instanceof TextSelection) || selection.empty) {
              return DecorationSet.empty;
            }
            const { from, to } = selection;
            if (to - from < 2) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            state.doc.forEach((node, offset) => {
              const nodeEnd = offset + node.nodeSize;
              if (offset >= from && nodeEnd <= to) {
                decorations.push(
                  Decoration.node(offset, nodeEnd, { class: "block-selected" }),
                );
              }
            });
            if (decorations.length < 2) return DecorationSet.empty;
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
