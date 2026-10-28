"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import type { SlashItem } from "../menus/slash-items";
import type { SlashActionHelpers } from "../extensions/slash-command";

import { useKeyboard } from "./use-keyboard";
import { useIsTouch } from "./use-is-touch";
import { useTouchBlockDrag } from "./use-touch-block-drag";
import { MobileToolbar } from "./mobile-toolbar";
import { BlockPicker } from "./block-picker";

/**
 * Mobile interaction layer — the two-state touch model.
 *
 *  EDITING (keyboard visible): native caret + native text selection, the
 *  toolbar rides the keyboard, long-press drag is disarmed.
 *
 *  NAVIGATION (keyboard hidden): the editor is blurred (no caret, no
 *  focused block — the document is a canvas), long-press lifts blocks.
 *
 *  PICKER (➕): the keyboard area is swapped for a same-height sheet, so
 *  the document never shifts; the toolbar stays glued above the sheet.
 */

/** Items whose native UI (file dialog / embed dialog) must not be fought
 * with by a re-focusing keyboard. */
const NO_REFOCUS_ITEMS = new Set(["image", "video", "audio", "file", "embed"]);

export function MobileLayer({
  editor,
  contentRef,
  scrollRef,
  helpers,
}: {
  editor: Editor;
  contentRef: React.RefObject<HTMLElement | null>;
  scrollRef: React.RefObject<HTMLElement | null>;
  helpers: SlashActionHelpers;
}) {
  const isTouch = useIsTouch();
  const keyboard = useKeyboard();

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerHeight, setPickerHeight] = React.useState(320);
  const [searchFocused, setSearchFocused] = React.useState(false);

  const kbRef = React.useRef(keyboard);
  const pickerOpenRef = React.useRef(pickerOpen);
  React.useEffect(() => {
    kbRef.current = keyboard;
  }, [keyboard]);
  React.useEffect(() => {
    pickerOpenRef.current = pickerOpen;
  }, [pickerOpen]);

  /* ---------------- keyboard hide → navigation mode ----------------
   * Event-driven (edge detection), never an effect fighting a focus —
   * the editor is blurred exactly when the keyboard goes away while it
   * still owned the DOM focus. Programmatic blurs / refocus flows don't
   * re-trigger it. */
  const prevVisibleRef = React.useRef(false);
  React.useEffect(() => {
    const visible = keyboard.isKeyboardVisible;
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (wasVisible && !visible && !pickerOpenRef.current && editor.isFocused) {
      editor.commands.blur();
    }
  }, [keyboard.isKeyboardVisible, editor]);

  /* ---------------- caret stays visible above the keyboard ----------------
   * On open (and on iOS where the layout does NOT auto-resize) lift the
   * scroll container so the caret clears the keyboard. */
  React.useEffect(() => {
    if (!keyboard.isKeyboardVisible) return;
    const id = window.setTimeout(() => {
      if (!editor.isFocused) return;
      try {
        const head = editor.state.selection.head;
        const coords = editor.view.coordsAtPos(head);
        const visibleBottom = window.innerHeight - kbRef.current.keyboardHeight;
        if (coords.bottom > visibleBottom - 8) {
          scrollRef.current?.scrollBy({
            top: coords.bottom - visibleBottom + 56,
            behavior: "smooth",
          });
        }
      } catch {
        /* view torn down mid-timeout */
      }
    }, 240);
    return () => window.clearTimeout(id);
  }, [keyboard.isKeyboardVisible, editor, scrollRef]);

  /* ---------------- block picker ---------------- */
  const openPicker = React.useCallback(() => {
    // Freeze the sheet at the footprint the keyboard occupies — zero drift
    // on BOTH models (on Android the lift is 0 while the layout shrink is
    // the real keyboard height; keyboardSpace covers the two).
    // The fallback only applies when no keyboard is measurable at all.
    const space = kbRef.current.keyboardSpace;
    setPickerHeight(space >= 120 ? space : 320);
    setSearchFocused(false);
    setPickerOpen(true);
    if (editor.isFocused) editor.commands.blur();
  }, [editor]);

  const closePicker = React.useCallback(
    (refocus: boolean) => {
      setPickerOpen(false);
      setSearchFocused(false);
      if (refocus) editor.commands.focus();
    },
    [editor],
  );

  const dismissToNavigation = React.useCallback(() => {
    setPickerOpen(false);
    setSearchFocused(false);
    editor.commands.blur();
  }, [editor]);

  // Tapping the document while the picker is open returns to editing —
  // the tap itself focuses the editor and reopens the keyboard. Taps that
  // ORIGINATE inside the sheet or the toolbar are picker UI, not "outside":
  // swallowing their pointerdown would unmount the pressed button before
  // the click completes (the browser then re-targets the click to the
  // container and the button's onClick never fires — picks & the ➕ toggle
  // would silently dead-end).
  React.useEffect(() => {
    if (!pickerOpen) return;
    const container = contentRef.current;
    if (!container) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".block-picker-sheet, .mobile-toolbar")) return;
      setPickerOpen(false);
    };
    container.addEventListener("pointerdown", onPointerDown);
    return () => container.removeEventListener("pointerdown", onPointerDown);
  }, [pickerOpen, contentRef]);

  /* ---------------- long-press block drag (navigation mode only) ---------------- */
  const { dragging } = useTouchBlockDrag({
    editor,
    containerRef: contentRef,
    scrollRef,
    enabled: isTouch && !keyboard.isKeyboardVisible && !pickerOpen,
  });
  // The drag overlay must never coexist with the toolbar.
  React.useEffect(() => {
    if (dragging) setPickerOpen(false);
  }, [dragging]);

  const handlePick = React.useCallback(
    (item: SlashItem) => {
      const refocus = !NO_REFOCUS_ITEMS.has(item.id);
      setPickerOpen(false);
      if (refocus) editor.commands.focus();
    },
    [editor],
  );

  const handleImage = React.useCallback(() => {
    if (editor.isFocused) editor.commands.blur();
    helpers.requestUpload("image");
  }, [editor, helpers]);

  if (!isTouch) return null;

  /* ---------------- swap-time positioning ----------------
   * While the picker replaces the keyboard the toolbar must NEVER move:
   *  - overlay model (iOS): sheet sits at the screen bottom, toolbar at
   *    `pickerHeight` == the lift it already had → stationary.
   *  - resizes-content (Android): the layout re-expands as the keyboard
   *    retreats; anchoring the sheet at `-layoutShrink` keeps it pinned to
   *    the SCREEN bottom (revealed as the keyboard slides away), and
   *    `pickerHeight − layoutShrink` keeps the toolbar stationary through
   *    the whole transition.
   * When the picker's own search field re-opens the keyboard, the sheet
   * and toolbar ride above it instead (native input-attachory feel). */
  const sheetBottom = searchFocused ? keyboard.keyboardHeight : -keyboard.layoutShrink;
  const toolbarBottom = pickerOpen
    ? searchFocused
      ? keyboard.keyboardHeight + pickerHeight
      : pickerHeight - keyboard.layoutShrink
    : keyboard.keyboardHeight;

  const toolbarVisible = keyboard.isKeyboardVisible || pickerOpen;

  return (
    <>
      <MobileToolbar
        editor={editor}
        visible={toolbarVisible && !dragging}
        bottom={toolbarBottom}
        pickerOpen={pickerOpen}
        onTogglePicker={() => (pickerOpen ? closePicker(true) : openPicker())}
        onDismiss={dismissToNavigation}
        onImage={handleImage}
      />
      <BlockPicker
        editor={editor}
        helpers={helpers}
        open={pickerOpen}
        height={pickerHeight}
        bottom={sheetBottom}
        onSearchFocusChange={setSearchFocused}
        onClose={() => closePicker(false)}
        onPick={handlePick}
      />
    </>
  );
}
