"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  CaseSensitive,
  Check,
  ChevronDown,
  Italic,
  Plus,
  Redo2,
  Search,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  SquareCode,
  X,
} from "lucide-react";
import { currentBlock } from "@/lib/editor/utils";
import type { SlashActionHelpers } from "../extensions/slash-command";
import { filterSlashItems, recordRecent, type SlashItem } from "../menus/slash-items";
import { TURN_INTO_OPTIONS, type TurnIntoOption } from "../menus/turn-into";
import { useIsMobile, useIsTouch, useVisualViewport } from "./use-mobile";
import { useTouchBlockDnd } from "./touch-dnd";

/**
 * MobileLayer — the native-app editing layer:
 *
 * · a sticky toolbar riding the keyboard's top edge (VisualViewport-driven)
 * · a block-picker sheet that replaces the keyboard 1:1 (same measured
 *   height → zero displacement) while the toolbar stays above it
 * · a text-formatting sheet (Aa)
 * · a navigation mode (keyboard hidden, document is a canvas) with
 *   long-press block drag & drop
 *
 * The two interaction modes never conflict: while the editor is focused
 * (Editing mode) no touch interception happens at all — the platform's
 * native text selection stays untouched.
 */

/** Height of the sticky toolbar row (sheet excluded). */
const ROW_H = 52;
/** Block types that hand off to a native picker — the keyboard won't return. */
const EXTERNAL_HANDOFF_IDS = new Set(["image", "video", "audio", "file", "embed"]);
/** Style options trimmed for the mobile sheet (H4–H6 stay desktop-only). */
const MOBILE_STYLE_IDS = new Set([
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "numberedList",
  "taskList",
  "toggle",
  "quote",
  "callout",
  "codeBlock",
]);

type PanelKind = "none" | "blocks" | "format";

export function MobileLayer({
  editor,
  helpers,
  contentRef,
  scrollRef,
}: {
  editor: Editor;
  helpers: SlashActionHelpers;
  contentRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();
  const { keyboardHeight, keyboardVisible, lastKeyboardHeight, animating } = useVisualViewport();
  const [panel, setPanel] = React.useState<PanelKind>("none");
  const [searchMode, setSearchMode] = React.useState(false);
  const [holdOpen, setHoldOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  /* ------------------------------------------- editor focus tracking */
  React.useEffect(() => {
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    return () => {
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
    };
  }, [editor]);

  /* ------------------------------------------------- navigation mode */
  // Keyboard hidden + editor unfocused + no sheet → the document is a
  // canvas: long-press lifts blocks, taps re-enter editing.
  const navMode = isTouch && !focused && !keyboardVisible && panel === "none";
  useTouchBlockDnd({ editor, contentRef, scrollRef, enabled: navMode });

  // Lock native text selection in navigation mode (real touch only) so the
  // platform's long-press menu never competes with block dragging. In
  // Editing mode this attribute is absent — selection gestures stay native.
  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (navMode) el.setAttribute("data-nav-mode", "true");
    else el.removeAttribute("data-nav-mode");
    return () => el.removeAttribute("data-nav-mode");
  }, [navMode, contentRef]);

  /* ------------------------------------------------------ geometry */
  const panelBase = Math.max(lastKeyboardHeight, 260);

  // "Hold open": after inserting from the sheet the keyboard re-opens and
  // grows beneath us — keep the row parked at the sheet position until the
  // keyboard's live height catches up, so nothing dips or flashes.
  React.useEffect(() => {
    if (!holdOpen) return;
    if (keyboardHeight >= panelBase * 0.85) {
      setHoldOpen(false);
      return;
    }
    const t = window.setTimeout(() => setHoldOpen(false), 750);
    return () => clearTimeout(t);
  }, [holdOpen, keyboardHeight, panelBase]);

  /* --------------------------- keep the caret clear of the keyboard */
  React.useEffect(() => {
    if (!keyboardVisible) return;
    const reveal = () => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const { selection } = editor.state;
      let coords;
      try {
        coords = editor.view.coordsAtPos(selection.head);
      } catch {
        return;
      }
      const visibleBottom = window.innerHeight - Math.max(keyboardHeight, 200) - ROW_H - 32;
      if (coords.bottom > visibleBottom) {
        scroller.scrollBy({ top: coords.bottom - visibleBottom, behavior: "smooth" });
      }
    };
    // Once mid-animation, once after the keyboard settles.
    const t1 = window.setTimeout(reveal, 90);
    const t2 = window.setTimeout(reveal, 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [keyboardVisible, keyboardHeight, editor, scrollRef]);

  /* ------------------------------------------------------ actions */
  const openSheet = (kind: "blocks" | "format") => {
    setSearchMode(false);
    setHoldOpen(false);
    if (editor.isFocused) editor.commands.blur();
    setPanel(kind);
  };

  /** Close the sheet — optionally return to editing (keyboard re-opens). */
  const closeSheet = (backToEditing: boolean) => {
    setPanel("none");
    setSearchMode(false);
    if (backToEditing) {
      setHoldOpen(true);
      editor.commands.focus();
    }
  };

  const insertFromPicker = (item: SlashItem) => {
    recordRecent(item.id);
    const { from, to } = editor.state.selection;
    const backToEditing = !EXTERNAL_HANDOFF_IDS.has(item.id);
    setPanel("none");
    setSearchMode(false);
    if (backToEditing) setHoldOpen(true);
    // The item's own command chain focuses the editor — the keyboard
    // re-opens under the parked toolbar with zero displacement.
    item.action({ editor, range: { from, to }, ...helpers });
  };

  const applyStyle = (option: TurnIntoOption) => {
    setPanel("none");
    setSearchMode(false);
    setHoldOpen(true);
    option.run(editor);
  };

  // Row actions run on the retained selection WITHOUT stealing focus, so
  // the keyboard never flickers while tapping toolbar buttons.
  const toggleMark = (mark: "bold" | "italic" | "strike" | "underline") => {
    editor.chain().toggleMark(mark).run();
  };
  const undo = () => editor.chain().undo().run();
  const redo = () => editor.chain().redo().run();
  const deleteBlock = () => {
    const info = currentBlock(editor);
    if (!info || info.node.type.name === "pageTitle") return;
    editor.chain().setNodeSelection(info.pos).deleteSelection().run();
  };
  const dismissKeyboard = () => {
    setPanel("none");
    setSearchMode(false);
    setHoldOpen(false);
    editor.commands.blur();
  };

  /* ------------------------------------------------------ rendering */
  const history = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            strike: e.isActive("strike"),
            underline: e.isActive("underline"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : {
            bold: false,
            italic: false,
            strike: false,
            underline: false,
            canUndo: false,
            canRedo: false,
          },
  });

  if (!isMobile) return null;

  const sheetOpen = panel !== "none";
  const attached = sheetOpen || keyboardVisible || holdOpen;

  // The row rides the keyboard's top edge. While a sheet replaces the
  // keyboard it parks at the sheet's top edge — the same px value, so the
  // keyboard → sheet handoff produces zero motion.
  let rowBottom: number;
  if (!attached) rowBottom = -(ROW_H + 24);
  else if (searchMode) rowBottom = keyboardHeight;
  else if (sheetOpen) rowBottom = panelBase;
  else if (holdOpen) rowBottom = Math.max(keyboardHeight, panelBase);
  else rowBottom = keyboardHeight;

  // Sheet geometry: fills the exact rect the keyboard occupied; while the
  // in-sheet search is focused it floats above row + keyboard so both the
  // field and the results stay visible.
  const sheetStyle: React.CSSProperties = searchMode
    ? {
        bottom: keyboardHeight + ROW_H,
        height: Math.min(316, Math.max(200, window.innerHeight - keyboardHeight - ROW_H - 120)),
      }
    : { bottom: 0, height: panelBase };

  // While the keyboard edge is actively moving, track it directly (short
  // transition); otherwise ease between parked positions.
  const live = animating && (keyboardVisible || searchMode);

  return (
    <>
      <div
        className="mobile-dock-row"
        data-attached={attached ? "true" : "false"}
        data-live={live ? "true" : "false"}
        style={{ bottom: rowBottom }}
        role="toolbar"
        aria-label="Text formatting"
        aria-hidden={!attached}
      >
        <DockBtn label="Add block" active={panel === "blocks"} onPress={() => openSheet("blocks")}>
          <Plus size={21} />
        </DockBtn>
        <DockBtn label="Text styles" active={panel === "format"} onPress={() => openSheet("format")}>
          <CaseSensitive size={21} />
        </DockBtn>
        <span className="mx-0.5 h-6 w-px shrink-0 bg-border/70" aria-hidden />
        <DockBtn label="Bold" active={history?.bold} onPress={() => toggleMark("bold")}>
          <Bold size={18} />
        </DockBtn>
        <DockBtn label="Italic" active={history?.italic} onPress={() => toggleMark("italic")}>
          <Italic size={18} />
        </DockBtn>
        <DockBtn label="Strikethrough" active={history?.strike} onPress={() => toggleMark("strike")}>
          <Strikethrough size={18} />
        </DockBtn>
        <span className="mx-0.5 h-6 w-px shrink-0 bg-border/70" aria-hidden />
        <DockBtn label="Undo" disabled={!history?.canUndo} onPress={undo}>
          <Undo2 size={19} />
        </DockBtn>
        <DockBtn label="Redo" disabled={!history?.canRedo} onPress={redo}>
          <Redo2 size={19} />
        </DockBtn>
        <DockBtn label="Delete block" onPress={deleteBlock}>
          <Trash2 size={18} />
        </DockBtn>
        <DockBtn label="Hide keyboard" onPress={dismissKeyboard}>
          <ChevronDown size={21} />
        </DockBtn>
      </div>

      {sheetOpen && (
        <div
          className="mobile-sheet"
          style={sheetStyle}
          role="dialog"
          aria-label={panel === "blocks" ? "Insert block" : "Text formatting"}
        >
          {panel === "blocks" ? (
            <BlockPicker onPick={insertFromPicker} onClose={closeSheet} onSearchFocusChange={setSearchMode} />
          ) : (
            <FormatSheet editor={editor} onApply={applyStyle} onClose={closeSheet} />
          )}
        </div>
      )}
    </>
  );
}

/* =============================================================== row */

function DockBtn({
  label,
  onPress,
  active,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // Keep the editor's focus/selection (and the keyboard) intact while
      // tapping toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className="mobile-dock-btn"
      data-active={active ? "true" : undefined}
    >
      {children}
    </button>
  );
}

/* ====================================================== block picker */

const CATEGORY_LABELS: Record<string, string> = {
  Basics: "Basic blocks",
  Media: "Media & files",
  Advanced: "Advanced",
  Embeds: "Embeds",
  Recent: "Recent",
};

function BlockPicker({
  onPick,
  onClose,
  onSearchFocusChange,
}: {
  onPick: (item: SlashItem) => void;
  onClose: (backToEditing: boolean) => void;
  onSearchFocusChange: (focused: boolean) => void;
}) {
  const [query, setQuery] = React.useState("");
  const groups = React.useMemo(() => filterSlashItems(query), [query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3.5 py-2.5">
        <Search size={15} className="shrink-0 text-muted-foreground/80" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => onSearchFocusChange(true)}
          onBlur={() => onSearchFocusChange(false)}
          placeholder="Search blocks…"
          enterKeyHint="search"
          className="h-9 flex-1 rounded-lg bg-muted/50 px-2.5 text-[13.5px] outline-none placeholder:text-muted-foreground/60"
          aria-label="Search blocks"
        />
        <button
          type="button"
          aria-label="Close block picker"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onClose(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted"
        >
          <X size={17} />
        </button>
      </div>

      <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        {groups.map((group) => (
          <section key={group.category} aria-label={group.category} className="mb-3 last:mb-1">
            <h3 className="px-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
              {CATEGORY_LABELS[group.category] ?? group.category}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick(item)}
                    className="mobile-block-item"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-foreground/80">
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 truncate text-[13px] font-medium">{item.title}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="px-2 py-10 text-center text-[13px] text-muted-foreground">
            No blocks match “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}

/* ======================================================= format sheet */

const FORMAT_MARKS = [
  { id: "bold", label: "Bold", icon: Bold },
  { id: "italic", label: "Italic", icon: Italic },
  { id: "underline", label: "Underline", icon: Underline },
  { id: "strike", label: "Strike", icon: Strikethrough },
  { id: "code", label: "Code", icon: SquareCode },
] as const;

function FormatSheet({
  editor,
  onApply,
  onClose,
}: {
  editor: Editor;
  onApply: (option: TurnIntoOption) => void;
  onClose: (backToEditing: boolean) => void;
}) {
  const styles = React.useMemo(
    () => TURN_INTO_OPTIONS.filter((option) => MOBILE_STYLE_IDS.has(option.id)),
    [],
  );

  const marks = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            code: e.isActive("code"),
          }
        : { bold: false, italic: false, underline: false, strike: false, code: false },
  });

  const activeStyleId = styles.find((option) => option.isActive(editor))?.id;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Text formatting
        </h3>
        <button
          type="button"
          aria-label="Close formatting panel"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onClose(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted"
        >
          <X size={17} />
        </button>
      </div>

      <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <section aria-label="Block style" className="mb-3">
          <h3 className="px-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
            Style
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {styles.map((option) => {
              const Icon = option.icon;
              const active = option.id === activeStyleId;
              return (
                <button
                  key={option.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onApply(option)}
                  className="mobile-block-item"
                  data-active={active ? "true" : undefined}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-foreground/80">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 truncate text-[13px] font-medium">{option.label}</span>
                  {active && <Check size={14} className="ml-auto shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-label="Inline formatting" className="mb-2">
          <h3 className="px-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
            Formatting
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {FORMAT_MARKS.map((mark) => {
              const Icon = mark.icon;
              const active = marks?.[mark.id] ?? false;
              return (
                <button
                  key={mark.id}
                  type="button"
                  aria-pressed={active}
                  onMouseDown={(e) => e.preventDefault()}
                  // Marks toggle live — the sheet stays open to combine them.
                  onClick={() => editor.chain().toggleMark(mark.id).run()}
                  className="mobile-mark-item"
                  data-active={active ? "true" : undefined}
                >
                  <Icon size={16} />
                  <span className="text-[12.5px] font-medium">{mark.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
