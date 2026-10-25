import Heading from "@tiptap/extension-heading";
import Blockquote from "@tiptap/extension-blockquote";
import { InputRule } from "@tiptap/core";

/** The handler context shape of a TipTap input rule. */
type RuleContext = Parameters<InputRule["handler"]>[0];

/**
 * Markdown input-rule guards. Rules that would re-type or wrap the
 * *current block* must not fire inside the page title — `# ` should stay
 * literal text there, never convert the title into a heading.
 */

function guard(rules: InputRule[]): InputRule[] {
  return rules.map(
    (rule) =>
      new InputRule({
        find: rule.find,
        handler: (context: RuleContext) => {
          const parent = context.state.selection.$from.parent;
          if (parent.type.name === "pageTitle") return;
          rule.handler(context);
        },
      }),
  );
}

/** Heading with input rules disabled inside the page title. */
export const GuardedHeading = Heading.extend({
  addInputRules() {
    return guard(this.parent?.() ?? []);
  },
});

/** Blockquote (> ) guarded the same way. */
export const GuardedBlockquote = Blockquote.extend({
  addInputRules() {
    return guard(this.parent?.() ?? []);
  },
});
