import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
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

/** True when the current selection spans the page-title block as a whole
 * (Select-All, a NodeSelection on the title, a drag from the doc start). */
function selectionCoversTitle(state: import("@tiptap/pm/state").EditorState): boolean {
  const first = state.doc.firstChild;
  if (!first || first.type.name !== "pageTitle") return false;
  const { selection } = state;
  if (selection.empty) return false;
  return selection.from <= 1 && selection.to >= first.nodeSize - 1;
}

/** Delete everything the selection covers but re-create an EMPTY title
 * (with the emoji placeholder reset) so the page always keeps its header. */
function recreateEmptyTitle(editor: Editor): boolean {
  return editor.commands.command(({ tr, state }) => {
    const first = state.doc.firstChild;
    if (!first || first.type.name !== "pageTitle") return false;
    const end = Math.max(state.selection.to, first.nodeSize);
    tr.replaceWith(0, end, state.schema.nodes.pageTitle.create({ icon: null }));
    tr.setSelection(TextSelection.create(tr.doc, 1));
    tr.scrollIntoView();
    return true;
  });
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
        if ($from.parent.type.name === "pageTitle" && empty && $from.parentOffset === 0) {
          return true; // swallow
        }
        // Select-All + Backspace must never delete the page header itself.
        if (selectionCoversTitle(state)) return recreateEmptyTitle(editor);
        return false;
      },
      // Same guard for the forward-delete and group-delete variants.
      Delete: ({ editor }) => (selectionCoversTitle(editor.state) ? recreateEmptyTitle(editor) : false),
      "Mod-Backspace": ({ editor }) => (selectionCoversTitle(editor.state) ? recreateEmptyTitle(editor) : false),
      "Mod-Delete": ({ editor }) => (selectionCoversTitle(editor.state) ? recreateEmptyTitle(editor) : false),
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
