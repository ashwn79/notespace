import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLowlight, common } from "lowlight";
import { CodeBlockView } from "../nodes/code-block-view";

/**
 * Code block with lowlight syntax highlighting and a custom React node view
 * (language picker, copy, line numbers, wrap, collapse).
 */

const lowlight = createLowlight(common);

export const CodeBlock = CodeBlockLowlight.extend({
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
}).configure({
  lowlight,
  defaultLanguage: "plaintext",
  exitOnTripleEnter: false,
});
