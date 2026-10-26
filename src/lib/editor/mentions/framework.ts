import type { ComponentType, ReactNode } from "react";
import type { Editor, Range } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";

/**
 * Generic mention framework — the contract every @ entity type implements.
 *
 * A provider registers itself once (see `registerMentionProvider`) and the
 * menu + search pipeline treat it uniformly: trigger, category, search
 * provider, insert behavior, open behavior and empty states all flow
 * through this interface, so new entity types (tasks, projects, databases,
 * AI prompts, files, labels…) never require touching the mention core.
 */

export type MentionCategoryId = "dates" | "people" | "pages" | "more";

/** Everything an insert/open action may need. */
export interface MentionInsertContext {
  editor: Editor;
  /** The `@query` range that should be replaced. */
  range: Range;
}

/** Sub-menus the host menu can open on behalf of a provider. */
export type MentionPanelKind = "date" | "datetime" | "relative" | "invite";

export interface MentionMenuItem {
  id: string;
  title: string;
  subtitle: string;
  categoryId: MentionCategoryId;
  keywords: string[];
  /** Keyboard shortcut hint, if applicable. */
  shortcut?: string;
  /** Standard leading icon. */
  icon?: LucideIcon | ComponentType<{ size?: number; className?: string }>;
  /** Custom leading visual (avatars, page emoji…). Takes precedence over icon. */
  renderLeading?: () => ReactNode;
  /** Enter / Tab — the default insert action. */
  run: (ctx: MentionInsertContext) => void;
  /** Mod+Enter — open the item (preview/viewer) without inserting. */
  open?: (ctx: MentionInsertContext) => void;
  /** Ask the menu to open one of its built-in sub-panels instead of running. */
  panel?: MentionPanelKind;
  /** Computed ranking score (higher first, then alphabetical). */
  score?: number;
}

export interface MentionEmptyState {
  message: string;
  actionLabel: string;
  /** Usually points at a panel (e.g. invite person). */
  panel?: MentionPanelKind;
  action?: (ctx: MentionInsertContext) => void;
}

export interface MentionProvider {
  /** Stable id, one per category chip. */
  id: MentionCategoryId;
  /** Header shown above the group ("Dates", "People", "Pages", "More"). */
  label: string;
  /** Category ordering in the menu. */
  order: number;
  /** Rendered when this category matched nothing but wants to offer an action. */
  emptyState?: MentionEmptyState;
  search(ctx: { editor: Editor; query: string }): MentionMenuItem[];
}

/* ------------------------------------------------------------------ store */

const providers: MentionProvider[] = [];

export function registerMentionProvider(provider: MentionProvider) {
  const existing = providers.findIndex((p) => p.id === provider.id);
  if (existing >= 0) providers[existing] = provider;
  else providers.push(provider);
  providers.sort((a, b) => a.order - b.order);
}

export function getMentionProviders(): MentionProvider[] {
  return providers;
}

export interface MentionGroup {
  provider: MentionProvider;
  items: MentionMenuItem[];
}

/** Run every provider's search and group the results by category. */
export function searchMentions(
  query: string,
  editor: Editor | null,
): MentionGroup[] {
  const groups: MentionGroup[] = [];
  for (const provider of getMentionProviders()) {
    try {
      const items = provider.search({ query, editor: editor as Editor });
      if (items.length) groups.push({ provider, items });
    } catch {
      /* A broken provider must never take the menu down. */
    }
  }
  return groups;
}

export function flattenMentionGroups(groups: MentionGroup[]): MentionMenuItem[] {
  return groups.flatMap((g) => g.items);
}

/* ---------------------------------------------------------------- scoring */

const RECENT_WINDOW = 3 * 24 * 60 * 60 * 1000;

/**
 * Shared ranking used by all providers:
 * 1. exact match → 2. prefix / word-prefix → 3. aliases → 4. fuzzy →
 * 5. keywords, then boosted by recency, favorites/pins and usage.
 */
export function scoreCandidate(
  query: string,
  fields: {
    title: string;
    aliases?: string[];
    keywords?: string[];
    lastUsedAt?: number;
    favorite?: boolean;
    pinned?: boolean;
    usageCount?: number;
  },
): number | null {
  const q = query.trim().toLowerCase();
  const title = fields.title.toLowerCase();
  const words = title.split(/\s+/);

  let base: number | null = null;
  if (!q) {
    base = 0;
  } else if (title === q) {
    base = 1000;
  } else if (title.startsWith(q)) {
    base = 900;
  } else if (words.some((w) => w.startsWith(q))) {
    base = 800;
  } else {
    const aliasHit = (fields.aliases ?? []).findIndex((a) => {
      const al = a.toLowerCase();
      return al === q || al.startsWith(q);
    });
    if (aliasHit >= 0) base = 750 - aliasHit;
    else if (subsequence(q, title) !== null) base = 600 - (subsequence(q, title) ?? 0);
    else {
      const kw = (fields.keywords ?? []).findIndex((k) => {
        const kl = k.toLowerCase();
        return kl.startsWith(q) || subsequence(q, kl) !== null;
      });
      if (kw >= 0) base = 500 - kw * 10;
    }
  }

  if (base === null) return null;
  if (!q) return base;

  let score = base;
  if (fields.lastUsedAt && Date.now() - fields.lastUsedAt < RECENT_WINDOW) score += 60;
  if (fields.favorite) score += 40;
  if (fields.pinned) score += 40;
  score += Math.min(40, (fields.usageCount ?? 0) * 2);
  return score;
}

/** Returns the span of the first subsequence match, or null. */
function subsequence(query: string, text: string): number | null {
  if (!query) return 0;
  let i = 0;
  let start = -1;
  for (let j = 0; j < text.length && i < query.length; j++) {
    if (text[j] === query[i]) {
      if (start < 0) start = j;
      i++;
    }
  }
  if (i < query.length) return null;
  return text.length - (start < 0 ? 0 : start);
}
