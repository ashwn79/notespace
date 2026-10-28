import { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { Node as PMNode } from "@tiptap/pm/model";

/**
 * Block-operation utilities — the heart of the Notion-style editing model.
 * Everything operates on *top-level blocks* (direct children of the document).
 */

export interface BlockInfo {
  /** Index among the document's top-level children. */
  index: number;
  /** Document position *before* the node (usable for NodeSelection). */
  pos: number;
  /** First position inside the node. */
  contentStart: number;
  /** Position right after the node ends. */
  to: number;
  node: PMNode;
  dom: HTMLElement | null;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

/** Resolve the top-level block that contains (or is nearest to) `pos`. */
export function blockInfoFromPos(editor: Editor, pos: number): BlockInfo | null {
  const doc = editor.state.doc;
  const p = clamp(pos, 0, doc.content.size);
  const $pos = doc.resolve(p);

  /*
   * Find where the containing top-level block STARTS.
   * For a caret inside a block, that's `$pos.before(1)`. For a boundary
   * position (depth 0), prefer the block starting exactly at `p`, falling
   * back to the block ending there. (Using `childAfter(p - 1)` — the old
   * approach — attributes the caret to the *previous* block, which broke
   * hover targeting, Alt+↑/↓, duplicate and the drag anchor.)
   */
  let blockStart: number;
  if ($pos.depth === 0) {
    const after = doc.childAfter(p);
    const before = doc.childBefore(p);
    if (after.node && after.offset === p) blockStart = after.offset;
    else if (before.node) blockStart = before.offset;
    else if (after.node) blockStart = after.offset;
    else return null;
  } else {
    blockStart = $pos.before(1);
  }

  const child = doc.childAfter(blockStart);
  if (!child.node || child.offset !== blockStart) return null;

  return {
    index: child.index,
    pos: child.offset,
    contentStart: child.offset + 1,
    to: child.offset + child.node.nodeSize,
    node: child.node,
    dom: (editor.view.nodeDOM(child.offset) as HTMLElement) ?? null,
  };
}

/** The top-level block containing the current selection anchor. */
export function currentBlock(editor: Editor): BlockInfo | null {
  return blockInfoFromPos(editor, editor.state.selection.from);
}

/** All top-level blocks of the document. */
export function getTopLevelBlocks(editor: Editor): BlockInfo[] {
  const blocks: BlockInfo[] = [];
  editor.state.doc.forEach((node, offset, index) => {
    blocks.push({
      index,
      pos: offset,
      contentStart: offset + 1,
      to: offset + node.nodeSize,
      node,
      dom: (editor.view.nodeDOM(offset) as HTMLElement) ?? null,
    });
  });
  return blocks;
}

/**
 * Move the given top-level block indices so they sit before the block
 * currently at `targetIndex` (or at the end when `targetIndex` is past the end).
 * The page title (first block, when present) is immovable and nothing can
 * be dropped above it.
 */
export function moveBlocks(editor: Editor, fromIndices: number[], targetIndex: number): boolean {
  const blocks = getTopLevelBlocks(editor);
  const hasTitle = blocks[0]?.node.type.name === "pageTitle";

  // Refuse to move the page title itself.
  const moving = blocks.filter((b) => fromIndices.includes(b.index) && !(hasTitle && b.index === 0));
  if (!moving.length) return false;

  const min = Math.min(...moving.map((m) => m.index));
  const max = Math.max(...moving.map((m) => m.index));
  // Dropping within the moved range is a no-op.
  if (targetIndex >= min && targetIndex <= max + 1) return false;

  // Never land above the page title.
  const clampedTarget = hasTitle ? Math.max(1, targetIndex) : targetIndex;
  if (clampedTarget < 0 || clampedTarget > blocks.length) return false;

  const nodes = moving.map((m) => m.node);
  const removedBefore = moving
    .filter((m) => m.index < clampedTarget)
    .reduce((sum, m) => sum + m.node.nodeSize, 0);

  return editor
    .chain()
    .command(({ tr }) => {
      for (const m of [...moving].sort((a, b) => b.index - a.index)) {
        tr.delete(m.pos, m.to);
      }
      let insertPos: number;
      if (clampedTarget >= blocks.length) {
        insertPos = tr.doc.content.size;
      } else {
        insertPos = clamp(blocks[clampedTarget].pos - removedBefore, 0, tr.doc.content.size);
      }
      tr.insert(insertPos, nodes);
      tr.setSelection(NodeSelection.create(tr.doc, insertPos));
      tr.scrollIntoView();
      return true;
    })
    .run();
}

/** Move the block under the caret one slot up or down (Alt+↑ / Alt+↓). */
export function moveBlockByStep(editor: Editor, direction: -1 | 1): boolean {
  const info = currentBlock(editor);
  if (!info) return false;
  // The page title never moves.
  if (info.index === 0 && info.node.type.name === "pageTitle") return false;
  const targetIndex = direction === -1 ? info.index - 1 : info.index + 2;
  return moveBlocks(editor, [info.index], targetIndex);
}

// Dev-only debug handle for E2E verification of block operations.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __blockUtils?: unknown }).__blockUtils = {
    moveBlocks,
    moveBlockByStep,
    getTopLevelBlocks,
    blockInfoFromPos,
  };
}

/** Duplicate the current top-level block (including nested children). */
export function duplicateBlock(editor: Editor): boolean {
  const selection = editor.state.selection;
  let info: BlockInfo | null;
  if (selection instanceof NodeSelection) {
    const idx = getTopLevelBlocks(editor).find((b) => b.pos === selection.from) ?? null;
    info = idx;
    if (!info) return false;
  } else {
    info = currentBlock(editor);
  }
  if (!info) return false;

  return editor
    .chain()
    .command(({ tr }) => {
      tr.insert(info!.to, info!.node);
      const targetPos = Math.min(info!.to + 1, tr.doc.content.size);
      tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos), 1));
      return true;
    })
    .run();
}

/** Select a single top-level block (used by clicking the drag handle). */
export function selectBlock(editor: Editor, info: BlockInfo) {
  editor.view.dispatch(
    editor.state.tr
      .setSelection(NodeSelection.create(editor.state.doc, info.pos))
      .scrollIntoView(),
  );
}

/** Extend the current selection so it fully covers the given block (shift+click). */
export function extendSelectionToBlock(editor: Editor, info: BlockInfo) {
  const { state } = editor;
  const anchor = state.selection.anchor;
  const head = info.pos >= anchor ? info.to : info.pos;
  editor.view.dispatch(
    state.tr
      .setSelection(TextSelection.create(state.doc, anchor, head))
      .scrollIntoView(),
  );
}

/** Top-level blocks fully contained within the current text selection. */
export function fullySelectedBlocks(editor: Editor): BlockInfo[] {
  const selection = editor.state.selection;
  if (selection instanceof NodeSelection) {
    return getTopLevelBlocks(editor).filter((b) => b.pos === selection.from);
  }
  if (selection.empty) return [];
  const { from, to } = selection;
  return getTopLevelBlocks(editor).filter((b) => b.pos >= from && b.to <= to);
}

/** Simple subsequence fuzzy matcher for menus ("bt" matches "Bullet list"). */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return true;
  const t = text.toLowerCase();
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i += 1;
    if (i === q.length) return true;
  }
  return false;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/** Platform-aware shortcut label, e.g. ⌘B vs Ctrl+B. */
export function prettyShortcut(combo: string): string {
  if (!isMac) return combo.replace(/Mod/g, "Ctrl").replace(/Shift/g, "Shift");
  return combo
    .replace(/Mod/g, "⌘")
    .replace(/Shift/g, "⇧")
    .replace(/Alt/g, "⌥")
    .replace(/ArrowUp/g, "↑")
    .replace(/ArrowDown/g, "↓");
}
