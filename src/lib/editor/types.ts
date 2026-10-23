/**
 * Shared type definitions for the editor.
 * Kept framework-agnostic so extensions, node views and menus all speak
 * the same language without circular imports.
 */

/** Shape returned by the /api/document endpoints. */
export interface DocumentData {
  id: string;
  title: string;
  content: unknown;
  updatedAt: string;
}

/** Autosave lifecycle. */
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

/** Result of a successful upload. */
export interface UploadResult {
  url: string;
  name: string;
  size: number;
  type: string;
}

/** Alignment options shared by image / embed blocks. */
export type MediaAlign = "left" | "center" | "full";

/** Callout visual variants. */
export type CalloutVariant = "info" | "success" | "warning" | "danger";

/** A category bucket in the slash menu. */
export type SlashCategory = "Basics" | "Media" | "Advanced" | "Embeds";

/** Identifier of a "turn into" target. */
export type TurnIntoTarget =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "codeBlock"
  | "callout"
  | "toggle";

/** Search & replace panel state (UI side). */
export interface SearchPanelState {
  open: boolean;
  term: string;
  replacement: string;
  caseSensitive: boolean;
  matchCount: number;
  activeIndex: number;
}
