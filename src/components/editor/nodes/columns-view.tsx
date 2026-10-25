"use client";

import * as React from "react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Plus, X } from "lucide-react";

/**
 * Columns node view — CSS grid driven by the child count, with hover
 * controls: "+" adds a column (max 6), each column has an "×" that lifts
 * its blocks out of the layout (no content loss) and removes the column.
 *
 * The layout borders are shown only while the editor's selection lives
 * inside this columns node ("editing"). DOM `:focus-within` cannot be used
 * here — ProseMirror keeps DOM focus on the contenteditable root, so inner
 * wrappers never contain the focused element.
 */
export function ColumnsView({ node, editor, getPos }: NodeViewProps) {
  const count = node.childCount;
  const canAdd = count < 6;

  // "Editing" = the editor selection is inside this columns node and the
  // editor holds focus. Recomputed on every selection/transaction change.
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    const update = () => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (typeof pos !== "number") {
        setEditing(false);
        return;
      }
      const nodeAtPos = editor.state.doc.nodeAt(pos);
      if (!nodeAtPos) {
        setEditing(false);
        return;
      }
      const end = pos + nodeAtPos.nodeSize;
      const { from, to } = editor.state.selection;
      setEditing(editor.isFocused && from >= pos && to <= end);
    };
    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor, getPos, node]);

  const addColumn = () => {
    const pos = (typeof getPos === "function" ? getPos() : 0) as number;
    const columnType = editor.state.schema.nodes.column;
    if (!columnType || typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize - 1, {
        type: "column",
        content: [{ type: "paragraph" }],
      })
      .run();
  };

  const removeColumn = (index: number) => {
    const pos = (typeof getPos === "function" ? getPos() : 0) as number;
    if (typeof pos !== "number") return;
    const columnNode = node.child(index);

    // Compute position of the column node inside the columns node.
    let offset = pos + 1;
    for (let i = 0; i < index; i += 1) offset += node.child(i).nodeSize;

    const tr = editor.state.tr;
    if (count === 1) {
      // Last column — dissolve the whole layout, lifting its blocks.
      const blocks = columnNode.content.content;
      tr.replaceWith(pos, pos + node.nodeSize, blocks.length ? blocks : editor.state.schema.nodes.paragraph.create());
    } else {
      // Lift the column's blocks after the columns block, then remove it.
      const after = pos + node.nodeSize;
      const blocks = columnNode.content.content;
      const hasContent = blocks.some((block) => block.content.size > 0 || block.type.name !== "paragraph");
      if (hasContent) {
        tr.insert(after, blocks);
      }
      tr.delete(offset, offset + columnNode.nodeSize);
    }
    editor.view.dispatch(tr.scrollIntoView());
  };

  return (
    <NodeViewWrapper className="columns-block group/columns" data-editing={editing ? "true" : undefined}>
      <NodeViewContent
        className="columns-grid"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      />
      {canAdd && (
        <button
          type="button"
          contentEditable={false}
          aria-label="Add column"
          title="Add column"
          onClick={addColumn}
          className="column-add-btn"
        >
          <Plus size={13} />
        </button>
      )}
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          contentEditable={false}
          aria-label={`Remove column ${index + 1}`}
          title="Remove column (content is kept below)"
          onClick={() => removeColumn(index)}
          className="column-remove-btn"
          style={{ left: `calc(${((index + 0.5) / count) * 100}% - 10px)` }}
        >
          <X size={12} />
        </button>
      ))}
    </NodeViewWrapper>
  );
}
