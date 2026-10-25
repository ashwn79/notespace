import type { JSONContent } from "@tiptap/core";

/** Extract the document title from the page title block (first child). */
export function deriveTitleFromDoc(doc: unknown): string {
  const root = doc as { type?: string; content?: JSONContent[] } | null;
  const first = root?.content?.[0];
  if (!first || first.type !== "pageTitle") return "";
  return collectText(first).slice(0, 300).trim();
}

function collectText(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(collectText).join("");
}
