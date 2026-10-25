import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PageTitleView } from "../nodes/page-title-view";

/**
 * Page title — the mandatory first block of every page.
 * Larger than an H1, with a Notion-style emoji icon picker floating above.
 * The document title metadata is derived from this block's text on save.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageTitle: {
      /** Ensure the document starts with a page title block. */
      ensurePageTitle: () => ReturnType;
    };
  }
}

export const PageTitle = Node.create({
  name: "pageTitle",
  group: "block",
  content: "inline*",
  defining: true,
  code: false,

  addAttributes() {
    return {
      icon: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-icon"),
        renderHTML: (attributes) => (attributes.icon ? { "data-icon": String(attributes.icon) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-page-title]", priority: 500 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page-title": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageTitleView);
  },

  addKeyboardShortcuts() {
    return {
      // Enter from the title opens the body below instead of splitting the title.
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parent.type.name !== "pageTitle") return false;
        const titleEnd = $from.after(1);

        return editor
          .chain()
          .command(({ tr }) => {
            // Ensure there is a paragraph after the title.
            const nodeAfter = tr.doc.resolve(titleEnd).nodeAfter;
            if (!nodeAfter) {
              tr.insert(titleEnd, state.schema.nodes.paragraph.create());
            }
            return true;
          })
          .setTextSelection(titleEnd + 1)
          .run();
      },
      // The title block cannot be removed by Backspace at its start.
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        if ($from.parent.type.name !== "pageTitle") return false;
        if ($from.parentOffset === 0) return true; // swallow
        return false;
      },
    };
  },

  addCommands() {
    return {
      ensurePageTitle:
        () =>
        ({ tr, dispatch, state }) => {
          const first = state.doc.firstChild;
          if (first?.type.name === "pageTitle") return true;
          if (dispatch) {
            const title = state.schema.nodes.pageTitle.create();
            tr.insert(0, title);
          }
          return true;
        },
    };
  },
});
