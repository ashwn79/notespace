import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ColumnsView } from "../nodes/columns-view";

/**
 * Notion-style column layout: `columns ( column+ )`, each column holding
 * any blocks. Column count is derived from the children; the node view
 * renders hover controls to add / remove columns.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (count?: number) => ReturnType;
    };
  }
}

export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-columns]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-columns": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnsView);
  },

  addCommands() {
    return {
      setColumns:
        (count = 2) =>
        ({ chain, state }) => {
          const columnsType = state.schema.nodes.columns;
          const columnType = state.schema.nodes.column;
          if (!columnsType || !columnType) return false;
          const columns = Array.from({ length: Math.max(2, Math.min(6, count)) }, () =>
            columnType.create(null, state.schema.nodes.paragraph.create()),
          );
          const block = columnsType.create(null, columns);
          return chain().focus().insertContent(block).run();
        },
    };
  },
});

export const Column = Node.create({
  name: "column",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-column]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-column": "" }), 0];
  },
});
