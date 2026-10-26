/**
 * Local workspace model for the @ mention framework — people & pages.
 *
 * A tiny reactive, localStorage-backed store. Mention pills subscribe to it,
 * which is what makes "rename a page → every mention updates automatically"
 * work: views resolve entities by id at render time, never from stale labels.
 *
 * Future providers (tasks, projects, databases, files…) can register their
 * own slices the same way without touching the mention core.
 */

export type PersonStatus = "online" | "away" | "offline";

export interface WorkspacePerson {
  id: string;
  name: string;
  email?: string;
  role?: string;
  status?: PersonStatus;
  /** Deterministic avatar hue (oklch hue number). */
  hue: number;
  usageCount: number;
  lastUsedAt: number;
}

export interface WorkspacePage {
  id: string;
  title: string;
  /** Emoji leading the page. */
  icon: string;
  /** Ancestor chain for the breadcrumb, e.g. ["Workspace", "Projects"]. */
  path: string[];
  aliases: string[];
  pinned?: boolean;
  favorite?: boolean;
  openedAt?: number;
  editedAt?: number;
  usageCount: number;
  excerpt?: string;
}

/* ------------------------------------------------------------------ seeds */

const SEED_PEOPLE: WorkspacePerson[] = [
  { id: "p-alice", name: "Alice Johnson", email: "alice@example.com", role: "Designer", status: "online", hue: 265, usageCount: 4, lastUsedAt: 0 },
  { id: "p-alina", name: "Alina Petrova", email: "alina@example.com", role: "Engineer", status: "online", hue: 200, usageCount: 1, lastUsedAt: 0 },
  { id: "p-alison", name: "Alison Reyes", email: "alison@example.com", role: "Product Manager", status: "away", hue: 320, usageCount: 2, lastUsedAt: 0 },
  { id: "p-bob", name: "Bob Smith", email: "bob@example.com", role: "Founder", status: "offline", hue: 30, usageCount: 3, lastUsedAt: 0 },
  { id: "p-john", name: "John Miller", email: "john@example.com", role: "Engineer", status: "online", hue: 150, usageCount: 2, lastUsedAt: 0 },
  { id: "p-jordan", name: "Jordan Lee", email: "jordan@example.com", role: "Data Scientist", status: "away", hue: 90, usageCount: 1, lastUsedAt: 0 },
  { id: "p-joseph", name: "Joseph Kim", email: "joseph@example.com", role: "Support Lead", status: "online", hue: 12, usageCount: 1, lastUsedAt: 0 },
  { id: "p-maya", name: "Maya Chen", email: "maya@example.com", role: "Marketing", status: "offline", hue: 280, usageCount: 0, lastUsedAt: 0 },
];

const DAY = 24 * 60 * 60 * 1000;

const SEED_PAGES: WorkspacePage[] = [
  {
    id: "pg-roadmap",
    title: "Project Roadmap",
    icon: "🚀",
    path: ["Workspace", "Projects"],
    aliases: ["roadmap", "milestones", "planning"],
    pinned: true,
    usageCount: 6,
    openedAt: Date.now() - 2 * DAY,
    editedAt: Date.now() - DAY,
    excerpt: "Milestones for the current cycle: editor polish, collaboration hooks, and the database blocks beta.",
  },
  {
    id: "pg-product-spec",
    title: "Product Spec",
    icon: "📄",
    path: ["Workspace", "Projects"],
    aliases: ["spec", "prd", "requirements"],
    favorite: true,
    usageCount: 4,
    openedAt: Date.now() - 5 * DAY,
    editedAt: Date.now() - 3 * DAY,
    excerpt: "The living specification for the editor: blocks, mentions, permissions, and the AI surface.",
  },
  {
    id: "pg-meeting-notes",
    title: "Meeting Notes",
    icon: "📝",
    path: ["Workspace", "Teams"],
    aliases: ["notes", "standup", "minutes"],
    usageCount: 3,
    openedAt: Date.now() - DAY,
    editedAt: Date.now() - 6 * 60 * 60 * 1000,
    excerpt: "Weekly sync notes — decisions, action items, and owners for every team.",
  },
  {
    id: "pg-dashboard",
    title: "Dashboard",
    icon: "📊",
    path: ["Workspace", "Analytics"],
    aliases: ["metrics", "kpi", "stats"],
    pinned: true,
    usageCount: 5,
    openedAt: Date.now() - 3 * 60 * 60 * 1000,
    excerpt: "Key metrics at a glance: activation, retention, and editor engagement funnels.",
  },
  {
    id: "pg-design-system",
    title: "Design System",
    icon: "🎨",
    path: ["Workspace", "Engineering"],
    aliases: ["ds", "components", "tokens"],
    favorite: true,
    usageCount: 2,
    openedAt: Date.now() - 8 * DAY,
    editedAt: Date.now() - 12 * DAY,
    excerpt: "Tokens, primitives, and motion rules that keep every surface consistent.",
  },
  {
    id: "pg-q3-planning",
    title: "Q3 Planning",
    icon: "🗓️",
    path: ["Workspace", "Projects"],
    aliases: ["quarterly", "okr", "goals"],
    usageCount: 1,
    editedAt: Date.now() - 20 * DAY,
    excerpt: "Objectives and key results for the quarter, with owners and check-in dates.",
  },
  {
    id: "pg-eng-wiki",
    title: "Engineering Wiki",
    icon: "📚",
    path: ["Workspace", "Teams"],
    aliases: ["wiki", "docs", "onboarding"],
    usageCount: 2,
    openedAt: Date.now() - 12 * DAY,
    excerpt: "How we build: architecture decisions, review standards, and onboarding guides.",
  },
];

/* ------------------------------------------------------------------ store */

export interface WorkspaceState {
  people: WorkspacePerson[];
  pages: WorkspacePage[];
}

const STORAGE_KEY = "aurora-workspace-v1";
const listeners = new Set<() => void>();

let state: WorkspaceState = { people: [], pages: [] };
let hydrated = false;

function seed(): WorkspaceState {
  return {
    people: SEED_PEOPLE.map((p) => ({ ...p })),
    pages: SEED_PAGES.map((p) => ({ ...p })),
  };
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — session-only workspace */
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceState;
      if (Array.isArray(parsed.people) && Array.isArray(parsed.pages)) {
        state = parsed;
        return;
      }
    }
  } catch {
    /* fall through to seeds */
  }
  state = seed();
  persist();
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export function subscribeWorkspace(listener: () => void): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWorkspaceSnapshot(): WorkspaceState {
  ensureHydrated();
  return state;
}

/* ------------------------------------------------------------------ people */

export function getPeople(): WorkspacePerson[] {
  return getWorkspaceSnapshot().people;
}

export function getPerson(id: string | null | undefined): WorkspacePerson | null {
  if (!id) return null;
  return getWorkspaceSnapshot().people.find((p) => p.id === id) ?? null;
}

export function addPerson(name: string, role?: string): WorkspacePerson {
  const person: WorkspacePerson = {
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    role: role?.trim() || undefined,
    hue: Math.floor(Math.random() * 360),
    usageCount: 0,
    lastUsedAt: 0,
  };
  const snap = getWorkspaceSnapshot();
  state = { ...snap, people: [...snap.people, person] };
  emit();
  return person;
}

export function recordPersonUsage(id: string) {
  const snap = getWorkspaceSnapshot();
  state = {
    ...snap,
    people: snap.people.map((p) =>
      p.id === id ? { ...p, usageCount: p.usageCount + 1, lastUsedAt: Date.now() } : p,
    ),
  };
  emit();
}

/* ------------------------------------------------------------------ pages */

export function getPages(): WorkspacePage[] {
  return getWorkspaceSnapshot().pages;
}

export function getPage(id: string | null | undefined): WorkspacePage | null {
  if (!id) return null;
  return getWorkspaceSnapshot().pages.find((p) => p.id === id) ?? null;
}

export function addPage(title: string, path: string[] = ["Workspace"]): WorkspacePage {
  const page: WorkspacePage = {
    id: `pg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim() || "Untitled",
    icon: "📄",
    path,
    aliases: [],
    usageCount: 0,
    editedAt: Date.now(),
  };
  const snap = getWorkspaceSnapshot();
  state = { ...snap, pages: [page, ...snap.pages] };
  emit();
  return page;
}

export function renamePage(id: string, title: string) {
  const snap = getWorkspaceSnapshot();
  state = {
    ...snap,
    pages: snap.pages.map((p) =>
      p.id === id ? { ...p, title: title.trim() || p.title, editedAt: Date.now() } : p,
    ),
  };
  emit();
}

export function recordPageOpen(id: string) {
  const snap = getWorkspaceSnapshot();
  state = {
    ...snap,
    pages: snap.pages.map((p) =>
      p.id === id ? { ...p, openedAt: Date.now(), usageCount: p.usageCount + 1 } : p,
    ),
  };
  emit();
}

/* ------------------------------------------------------------- time utils */

/** "2 hours ago" / "in 3 days" style relative time for meta rows. */
export function relativeTime(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return minutes > 0 ? `${minutes}m ago` : `in ${-minutes}m`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours}h ago` : `in ${-hours}h`;
  const days = Math.round(hours / 24);
  return days > 0 ? `${days}d ago` : `in ${-days}d`;
}
