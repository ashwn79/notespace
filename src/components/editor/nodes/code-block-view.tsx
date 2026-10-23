"use client";

import * as React from "react";
import { Check, Copy, WrapText, UnfoldVertical, FoldVertical } from "lucide-react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Code block node view — language picker, copy button, line numbers,
 * soft-wrap toggle and collapse. Highlighting itself is handled by
 * CodeBlockLowlight decorations on top of ProseMirror's content DOM.
 */

export const CODE_LANGUAGES = [
  { value: "plaintext", label: "Plain text" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "less", label: "Less" },
  { value: "xml", label: "HTML / XML" },
  { value: "markdown", label: "Markdown" },
  { value: "diff", label: "Diff" },
  { value: "lua", label: "Lua" },
  { value: "perl", label: "Perl" },
  { value: "r", label: "R" },
  { value: "objectivec", label: "Objective-C" },
  { value: "makefile", label: "Makefile" },
  { value: "arduino", label: "Arduino" },
] as const;

export function CodeBlockView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const language: string = node.attrs.language ?? "plaintext";
  const collapsed: boolean = Boolean(node.attrs.collapsed);
  const wrapped: boolean = Boolean(node.attrs.wrap);

  const [copied, setCopied] = React.useState(false);
  const [lines, setLines] = React.useState<number[]>([1]);
  const codeRef = React.useRef<HTMLDivElement>(null);

  // Line numbers — derived from the content DOM via MutationObserver so we
  // never re-render the editor for counting.
  React.useEffect(() => {
    const el = codeRef.current?.querySelector("code");
    if (!el) return;
    const update = () => {
      const text = el.textContent ?? "";
      const count = Math.max(text.split("\n").length, 1);
      setLines(Array.from({ length: count }, (_, i) => i + 1));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [collapsed]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const activeLabel = CODE_LANGUAGES.find((l) => l.value === language)?.label ?? "Plain text";

  return (
    <NodeViewWrapper className="code-block" data-collapsed={collapsed}>
      {/* Header — not part of the editable content */}
      <div
        contentEditable={false}
        className="flex items-center justify-between gap-2 border-b border-white/5 bg-white/[0.03] px-2.5 py-1.5 select-none"
      >
        <Select
          value={language}
          onValueChange={(value) => updateAttributes({ language: value })}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-[132px] border-transparent bg-transparent px-2 text-xs text-zinc-400 shadow-none hover:bg-white/5 hover:text-zinc-200 [&_svg]:opacity-60"
          >
            <SelectValue placeholder="Language">{activeLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {CODE_LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value} className="text-xs">
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title={wrapped ? "Disable soft wrap" : "Enable soft wrap"}
            onClick={() => updateAttributes({ wrap: !wrapped })}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200",
              wrapped && "bg-white/8 text-zinc-200",
            )}
          >
            <WrapText size={14} />
          </button>
          <button
            type="button"
            title={collapsed ? "Expand code" : "Collapse code"}
            onClick={() => updateAttributes({ collapsed: !collapsed })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            {collapsed ? <UnfoldVertical size={14} /> : <FoldVertical size={14} />}
          </button>
          <button
            type="button"
            title="Copy code"
            onClick={copy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            title="Delete block"
            onClick={deleteNode}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>

      {/* Editable code surface */}
      <div className="relative flex" ref={codeRef}>
        {!collapsed && (
          <div aria-hidden className="code-gutter-inline select-none">
            {lines.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        )}
        <pre className={cn("min-w-0 flex-1", wrapped && "wrap-lines")}>
          <NodeViewContent
            as="code"
            data-language={language}
            className={cn(wrapped && "wrap-lines")}
          />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
