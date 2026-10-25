import type { JSONContent } from "@tiptap/core";

/**
 * A rich sample document showcasing every block type.
 * Inserted via the "Demo" button in the header (replaces an empty document
 * or appends below existing content).
 */
export const DEMO_CONTENT: JSONContent = {
  type: "doc",
  content: [
    {
      type: "pageTitle",
      attrs: { icon: "✨" },
      content: [{ type: "text", text: "Welcome to Aurora" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "A " },
        { type: "text", marks: [{ type: "bold" }], text: "block-based" },
        { type: "text", text: " writing space with " },
        { type: "text", marks: [{ type: "italic" }], text: "beautiful" },
        { type: "text", text: " defaults. Hover any block for its " },
        { type: "text", marks: [{ type: "bold" }], text: "drag handle" },
        { type: "text", text: ", press " },
        { type: "text", marks: [{ type: "code" }], text: "/" },
        { type: "text", text: " for the command menu, or " },
        { type: "text", marks: [{ type: "code" }], text: "@" },
        { type: "text", text: " to mention people, dates and pages." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Kickoff with " },
        { type: "mention", attrs: { mentionType: "person", name: "Priya Sharma" } },
        { type: "text", text: " on " },
        {
          type: "mention",
          attrs: { mentionType: "date", date: "2026-12-24", format: "relative", includeTime: false, startTime: "", endTime: "", endDate: null, reminder: null },
        },
        { type: "text", text: " — click the date chip to open its panel." },
      ],
    },
    {
      type: "callout",
      attrs: { emoji: "💡", variant: "info" },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Try selecting this text — the " },
            { type: "text", marks: [{ type: "bold" }], text: "floating toolbar" },
            { type: "text", text: " appears with formatting, links, colors and highlights." },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Everything is a block" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Drag, duplicate, reorder and turn blocks into anything: " },
        { type: "text", marks: [{ type: "bold" }], text: "headings, lists, quotes, callouts, code, math" },
        { type: "text", text: " and more." },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Nested lists work naturally" }] },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Press Tab to indent, Shift+Tab to outdent" }] },
                  ],
                },
                {
                  type: "listItem",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Markdown shortcuts just work" }] }],
                },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Type “- ” for bullets, “1. ” for numbers" }] }],
        },
      ],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Write the launch notes" }] }],
        },
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Try the slash menu → insert a table" }] }],
        },
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Drop an image anywhere in the page" }] },
          ],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "“Writing is thinking made visible. The best tools disappear and let the ideas flow.”" },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Code, with syntax highlighting" }],
    },
    {
      type: "codeBlock",
      attrs: { language: "typescript" },
      content: [
        {
          type: "text",
          text: `interface Block {\n  id: string;\n  type: "paragraph" | "heading" | "code" | "table";\n  movable: true; // every block can be reordered\n}\n\nexport function reorder<T extends Block>(blocks: T[], from: number, to: number): T[] {\n  const next = [...blocks];\n  const [moved] = next.splice(from, 1);\n  next.splice(to, 0, moved);\n  return next;\n}`,
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Tables, editable in place" }],
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Feature" }] }] },
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Shortcut" }] }] },
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Status" }] }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Slash menu" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "code" }], text: "/" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Live" }] }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Search & replace" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "code" }], text: "⌘F" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Live" }] }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Collaboration" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "—" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Future-ready" }] }] },
          ],
        },
      ],
    },
    {
      type: "paragraph",
    },
    {
      type: "imageBlock",
      attrs: {
        src: "/uploads/demo-aurora.png",
        alt: "Abstract violet waves",
        width: 100,
        align: "center",
      },
      content: [{ type: "text", text: "Images support resize, alignment, captions and lightbox preview." }],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Math renders natively" }],
    },
    {
      type: "mathBlock",
      attrs: { latex: "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}" },
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Inline math works too: the famous identity " },
        { type: "mathInline", attrs: { latex: "e^{i\\pi} + 1 = 0" } },
        { type: "text", text: " — click any equation to edit its LaTeX." },
      ],
    },
    {
      type: "toggleBlock",
      attrs: { open: false },
      content: [
        {
          type: "toggleHeader",
          content: [{ type: "text", text: "Collapsible details (click the chevron)" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Toggles keep long documents tidy. Hide background notes, FAQs or spoilers without losing them." },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Everything inside stays fully editable and searchable." }],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Columns organize content side by side" }],
    },
    {
      type: "columns",
      content: [
        {
          type: "column",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Columns hold any blocks. Hover the layout for controls — add a column or remove one (its content is kept)." }],
            },
          ],
        },
        {
          type: "column",
          content: [
            {
              type: "callout",
              attrs: { emoji: "🚀", variant: "info" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Blocks stay fully interactive inside columns." }] }],
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "One more thing — " },
        { type: "text", marks: [{ type: "highlight", attrs: { color: "rgba(250, 204, 21, 0.38)" } }], text: "highlights" },
        { type: "text", text: ", " },
        { type: "text", marks: [{ type: "textStyle", attrs: { color: "#4ade80" } }], text: "text colors" },
        { type: "text", text: " and " },
        { type: "text", marks: [{ type: "link", attrs: { href: "https://example.com", target: "_blank", rel: "noopener noreferrer nofollow" } }], text: "links" },
        { type: "text", text: " all live side by side. Your work autosaves as you type." },
      ],
    },
    { type: "horizontalRule" },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "italic" }], text: "Now make it yours — the page is yours to write." },
      ],
    },
  ],
};
