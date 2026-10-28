import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlockMathView, InlineMathView } from "../nodes/math-views";

/**
 * LaTeX math — inline (`$…$`) and block (`$$…$$`) nodes rendered with KaTeX.
 * Double-click any math node to edit its source.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      insertMathInline: (latex?: string) => ReturnType;
      insertMathBlock: (latex?: string) => ReturnType;
    };
  }
}

const inlineLatexInputRule = new InputRule({
  find: /(?:^|\s)\$([^$\n]+)\$$/,
  handler: ({ state, range, match, chain }) => {
    const latex = match[1]?.trim();
    if (!latex) return;
    chain()
      .insertContentAt(
        { from: range.from, to: range.to },
        { type: "mathInline", attrs: { latex } },
      )
      .insertContentAt(state.selection.to, { type: "text", text: " " })
      .run();
  },
});

export const MathInline = Node.create({
  name: "mathInline",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-math-inline]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-inline": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView);
  },

  addInputRules() {
    return [inlineLatexInputRule];
  },

  addCommands() {
    return {
      insertMathInline:
        (latex = "") =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { latex } }).run(),
    };
  },
});

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-math-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-math-block": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockMathView);
  },

  addInputRules() {
    return [
      // Typing `$$` in an empty paragraph converts it into a math block.
      new InputRule({
        find: /^\$\$$/,
        handler: ({ state, chain }) => {
          const { $from } = state.selection;
          const paraFrom = $from.before();
          const paraTo = $from.after();
          chain()
            .command(({ tr }) => {
              tr.replaceWith(paraFrom, paraTo, state.schema.nodes.mathBlock.create({ latex: "" }));
              return true;
            })
            .run();
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertMathBlock:
        (latex = "") =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { latex } }).run(),
    };
  },
});
