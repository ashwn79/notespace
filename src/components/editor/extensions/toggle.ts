import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ToggleView } from "../nodes/toggle-view";

/**
 * Toggle block — collapsible container with a header line.
 *
 * Schema: `toggleBlock ( toggleHeader block+ )`. The header is its own node
 * type, which lets us (a) style it, (b) hide everything *after* it via the
 * sibling CSS selector when the toggle is closed, and (c) give Enter/Backspace
 * smart behavior inside the header.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggleBlock: {
      setToggleBlock: () => ReturnType;
      toggleOpenState: () => ReturnType;
    };
  }
}

export const ToggleBlock = Node.create({
  name: "toggleBlock",
  group: "block",
  content: "toggleHeader block+",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-open") !== "false",
        renderHTML: (attributes) => ({ "data-open": String(Boolean(attributes.open)) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-toggle]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-toggle": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },

  addCommands() {
    return {
      setToggleBlock:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name, {}),
      toggleOpenState:
        () =>
        ({ editor }) => {
          const { state } = editor;
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const parent = $from.node(depth);
            if (parent.type.name === "toggleBlock") {
              const pos = $from.before(depth);
              return editor.commands.command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, { ...parent.attrs, open: !parent.attrs.open });
                return true;
              });
            }
          }
          return false;
        },
    };
  },
});

export const ToggleHeader = Node.create({
  name: "toggleHeader",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-header]", priority: 200 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-header": "" }), 0];
  },

  addKeyboardShortcuts() {
    const isHeader = (editor: { state: { selection: { $from: { parent: { type: { name: string } } } } } }) =>
      editor.state.selection.$from.parent.type.name === "toggleHeader";

    return {
      Enter: ({ editor }) => {
        if (!isHeader(editor)) return false;
        const { state } = editor;
        const { $from } = state.selection;
        const toggleDepth = $from.depth - 1;
        const togglePos = $from.before(toggleDepth);
        const toggleNode = state.doc.resolve(togglePos).nodeAfter;
        if (!toggleNode || toggleNode.type.name !== "toggleBlock") return false;
        const firstChild = toggleNode.firstChild;
        if (!firstChild) return false;
        const headerEnd = togglePos + 1 + firstChild.nodeSize;

        return editor
          .chain()
          .command(({ tr }) => {
            tr.setNodeMarkup(togglePos, undefined, { ...toggleNode.attrs, open: true });
            const paragraph = state.schema.nodes.paragraph.create();
            tr.insert(headerEnd, paragraph);
            tr.setSelection(TextSelection.near(tr.doc.resolve(headerEnd + 1), 1));
            tr.scrollIntoView();
            return true;
          })
          .run();
      },

      Backspace: ({ editor }) => {
        if (!isHeader(editor)) return false;
        const { state, selection } = editor;
        const { $from, empty } = selection;
        if (!empty || $from.parentOffset !== 0) return false;
        if ($from.parent.content.size > 0) return false;

        // Unwrap the whole toggle into plain blocks.
        const toggleDepth = $from.depth - 1;
        const togglePos = $from.before(toggleDepth);
        const toggleNode = state.doc.resolve(togglePos).nodeAfter;
        if (!toggleNode || toggleNode.type.name !== "toggleBlock") return false;

        return editor.commands.command(({ tr }) => {
          const schema = state.schema;
          const blocks = [];
          toggleNode.forEach((child) => {
            if (child.type.name === "toggleHeader") {
              blocks.push(schema.nodes.paragraph.create(child.attrs, child.content, child.marks));
            } else {
              blocks.push(child);
            }
          });
          tr.replaceWith(togglePos, togglePos + toggleNode.nodeSize, blocks);
          tr.scrollIntoView();
          return true;
        });
      },
    };
  },
});
