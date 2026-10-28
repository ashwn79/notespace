import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { InputRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLowlight, common } from "lowlight";
import { CodeBlockView } from "../nodes/code-block-view";

/**
 * Code block with lowlight syntax highlighting and a custom React node view
 * (language picker, copy, line numbers, wrap, collapse).
 *
 * NOTE: `wrap` and `collapsed` are declared schema attributes — without them
 * updateAttributes() silently drops the values and the header controls die.
 */

const lowlight = createLowlight(common);

export const CodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      wrap: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-wrap") === "true",
        renderHTML: (attributes) => (attributes.wrap ? { "data-wrap": "true" } : {}),
      },
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-collapsed") === "true",
        renderHTML: (attributes) => (attributes.collapsed ? { "data-collapsed": "true" } : {}),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      // Mod+Enter escapes the code block and starts a paragraph below.
      "Mod-Enter": () => this.editor.commands.exitCode(),
    };
  },

  // The default ``` input rule would convert a page title into a code
  // block — keep it disabled inside the title.
  addInputRules() {
    const rules = this.parent?.() ?? [];
    return rules.map(
      (rule) =>
        new InputRule({
          find: rule.find,
          handler: (context) => {
            const { state } = context;
            const parent = state.selection.$from.parent;
            if (parent.type.name === "pageTitle") return;
            rule.handler(context);
          },
        }),
    );
  },
}).configure({
  lowlight,
  defaultLanguage: "plaintext",
  exitOnTripleEnter: false,
});
