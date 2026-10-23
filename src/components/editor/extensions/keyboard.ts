import { Extension, InputRule } from "@tiptap/core";
import { duplicateBlock, moveBlockByStep } from "@/lib/editor/utils";

/**
 * Productivity keyboard layer:
 * - Alt+↑ / Alt+↓  move the current block
 * - Mod+Shift+7/8/9 ordered / bullet / task lists
 * - Mod+Shift+E toggles a code block
 * - `[ ] ` / `[x] ` markdown task list input rule
 */
export const EditorKeyboard = Extension.create({
  name: "editorKeyboard",

  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp": () => moveBlockByStep(this.editor, -1),
      "Alt-ArrowDown": () => moveBlockByStep(this.editor, 1),

      "Mod-Shift-7": () => this.editor.commands.toggleOrderedList(),
      "Mod-Shift-8": () => this.editor.commands.toggleBulletList(),
      "Mod-Shift-9": () => this.editor.commands.toggleTaskList(),
      "Mod-Shift-E": () => this.editor.commands.toggleCodeBlock(),
      "Mod-d": () => duplicateBlock(this.editor),
    };
  },
});

/** Markdown shortcut: `- [ ] ` / `[x] ` → task list item. */
export const TaskInputRule = Extension.create({
  name: "taskInputRule",
  addInputRules() {
    return [
      new InputRule({
        find: /(?:^|\s)\[([ xX])\]\s$/,
        handler: ({ state, range, match, chain }) => {
          const checked = match[1]?.toLowerCase() === "x";
          const schema = state.schema;
          if (!schema.nodes.taskList || !schema.nodes.taskItem) return;

          const { $from } = state.selection;
          const inBulletList = $from.depth >= 2 && $from.node(-2)?.type.name === "bulletList";

          if (inBulletList) {
            // Convert the current bullet item into a task item, keeping content.
            chain()
              .command(({ tr }) => {
                const itemFrom = $from.before(-1);
                const itemTo = $from.after(-1);
                const listItem = $from.node(-1);
                const paragraph = schema.nodes.paragraph.create(null, listItem.content);
                tr.replaceWith(itemFrom, itemTo, schema.nodes.taskItem.create({ checked }, paragraph));
                return true;
              })
              .run();
            return;
          }

          chain()
            .deleteRange({ from: range.from, to: range.to })
            .toggleTaskList()
            .command(({ tr }) => {
              if (!checked) return true;
              const pos = state.selection.$from;
              for (let depth = pos.depth; depth > 0; depth -= 1) {
                const node = pos.node(depth);
                if (node.type.name === "taskItem") {
                  tr.setNodeMarkup(pos.before(depth), undefined, { checked: true });
                  break;
                }
              }
              return true;
            })
            .run();
        },
      }),
    ];
  },
});
