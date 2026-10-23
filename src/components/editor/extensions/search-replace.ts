import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as PMNode } from "@tiptap/pm/model";

/**
 * Find & replace engine.
 *
 * Matches live in plugin state and are rendered as ProseMirror decorations,
 * so highlighting never touches the document content itself.
 */

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchState {
  term: string;
  caseSensitive: boolean;
  activeIndex: number;
  matches: SearchMatch[];
}

export const SearchReplaceKey = new PluginKey<SearchState>("searchReplace");

interface SearchMeta extends Partial<SearchState> {
  refreshOnly?: boolean;
}

function findMatches(doc: PMNode, term: string, caseSensitive: boolean): SearchMatch[] {
  const matches: SearchMatch[] = [];
  if (!term) return matches;
  const needle = caseSensitive ? term : term.toLowerCase();

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = caseSensitive ? node.text : node.text.toLowerCase();
    let idx = hay.indexOf(needle);
    while (idx !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + needle.length });
      idx = hay.indexOf(needle, idx + needle.length);
    }
  });
  return matches;
}

function activeToIndex(state: SearchState, prevIndex: number, nextLen: number): number {
  if (nextLen === 0) return -1;
  if (prevIndex < 0) return 0;
  return Math.min(prevIndex, nextLen - 1);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (term: string, caseSensitive?: boolean) => ReturnType;
      gotoMatch: (direction: 1 | -1) => ReturnType;
      replaceActiveMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
    };
  }
}

export const SearchReplace = Extension.create({
  name: "searchReplace",

  addCommands() {
    return {
      setSearchTerm:
        (term, caseSensitive = false) =>
        ({ editor }) => {
          editor.view.dispatch(
            editor.view.state.tr.setMeta(SearchReplaceKey, {
              term,
              caseSensitive,
              activeIndex: term ? 0 : -1,
            } satisfies SearchMeta),
          );
          return true;
        },

      gotoMatch:
        (direction) =>
        ({ editor }) => {
          const s = SearchReplaceKey.getState(editor.state);
          if (!s || s.matches.length === 0) return false;
          const next = (s.activeIndex + direction + s.matches.length) % s.matches.length;
          const match = s.matches[next];
          editor.view.dispatch(
            editor.state.tr
              .setMeta(SearchReplaceKey, { activeIndex: next } satisfies SearchMeta)
              .setSelection(TextSelection.create(editor.state.doc, match.from, match.to))
              .scrollIntoView(),
          );
          return true;
        },

      replaceActiveMatch:
        (replacement) =>
        ({ editor, chain }) => {
          const s = SearchReplaceKey.getState(editor.state);
          if (!s || s.activeIndex < 0 || !s.matches[s.activeIndex]) return false;
          const { from, to } = s.matches[s.activeIndex];
          return chain()
            .insertContentAt({ from, to }, replacement)
            .command(({ tr }) => {
              tr.setMeta(SearchReplaceKey, { refreshOnly: true } satisfies SearchMeta);
              return true;
            })
            .run();
        },

      replaceAllMatches:
        (replacement) =>
        ({ editor, state, dispatch }) => {
          const s = SearchReplaceKey.getState(state);
          if (!s || s.matches.length === 0) return false;
          const tr = state.tr;
          for (const match of [...s.matches].sort((a, b) => b.from - a.from)) {
            tr.insertText(replacement, match.from, match.to);
          }
          tr.setMeta(SearchReplaceKey, { refreshOnly: true } satisfies SearchMeta);
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: SearchReplaceKey,
        state: {
          init: (): SearchState => ({ term: "", caseSensitive: false, activeIndex: -1, matches: [] }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(SearchReplaceKey) as SearchMeta | undefined;
            let next = prev;
            if (meta) next = { ...prev, ...meta, matches: meta.refreshOnly ? prev.matches : findMatches(tr.doc, meta.term ?? prev.term, meta.caseSensitive ?? prev.caseSensitive) };

            const term = next.term;
            if (!term) {
              if (next.matches.length || next.activeIndex !== -1) {
                return { ...next, matches: [], activeIndex: -1 };
              }
              return next;
            }
            if (meta?.refreshOnly) {
              const matches = findMatches(tr.doc, next.term, next.caseSensitive);
              return { ...next, matches, activeIndex: activeToIndex(next, next.activeIndex, matches.length) };
            }
            if (meta || tr.docChanged) {
              const matches = findMatches(tr.doc, next.term, next.caseSensitive);
              return { ...next, matches, activeIndex: activeToIndex(next, next.activeIndex, matches.length) };
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            const s = SearchReplaceKey.getState(state);
            if (!s || s.matches.length === 0) return DecorationSet.empty;
            const decorations = s.matches.map((m, i) =>
              Decoration.inline(m.from, m.to, {
                class: i === s.activeIndex ? "search-match-active" : "search-match",
              }),
            );
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
