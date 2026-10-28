# NoteSpace 📝

A modern, block-based rich text document workspace inspired by Notion. Built with **Next.js 16**, **React 19**, **TipTap / ProseMirror**, **Tailwind CSS**, and **Prisma SQLite**.

---

## ✨ Features

- **Block-Based Editing**: Guarded block editing with fixed page title node, drag-and-drop block handles, and turn-into menus.
- **Slash Commands (`/`)**: Quick insertion for headings, lists, quotes, callouts, tables, code blocks, dividers, and media.
- **Inline Mentions (`@`)**: Seamless mention chips for dates, pages, and collaborators with popover inspectors.
- **Rich Media & Attachments**: Optimistic media uploads with progress states, image resizing, and captioning.
- **Math & Code**: KaTeX formula support alongside syntax-highlighted code blocks with language selector.
- **Debounced Autosave**: Automatic background persistence into SQLite via Prisma Client with sync state indicators.
- **Keyboard Shortcuts & Clean UI**: Full keyboard navigation, dark mode support with tailored styling, and responsive layout.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI & Components**: [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), Radix UI primitives, Lucide Icons, Sonner
- **Editor Core**: [TipTap](https://tiptap.dev/) / ProseMirror
- **Database & ORM**: SQLite with [Prisma ORM](https://www.prisma.io/)
- **Typography & Styling**: Geist font family, custom prose styling

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/ashwn79/notespace.git
cd notespace
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment and database
Copy the environment template:
```bash
cp .env.example .env
```

Generate the Prisma client and initialize SQLite:
```bash
npm run db:push
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure

```text
notespace/
├── db/                    # Local SQLite database
├── prisma/
│   └── schema.prisma      # Prisma schema (Document persistence)
├── public/                # Static assets, branding, and uploads
├── src/
│   ├── app/               # Next.js App Router (pages and API routes)
│   │   ├── api/document/  # Document load/save endpoints
│   │   └── globals.css    # Design tokens and Tailwind directives
│   ├── components/
│   │   ├── brand/         # NoteSpace wordmark and branding
│   │   ├── editor/        # Block editor, extensions, menus, and nodes
│   │   └── ui/            # Reusable UI component primitives
│   ├── hooks/             # Utility React hooks
│   └── lib/               # Database client, editor helpers, and utilities
├── package.json
└── tsconfig.json
```

---

## 📜 Available Scripts

- `npm run dev` — Starts the Next.js development server at port 3000
- `npm run build` — Builds the application for production
- `npm run start` — Runs the production server
- `npm run lint` — Runs ESLint checks
- `npm run db:push` — Syncs the Prisma schema with the local SQLite database
- `npm run db:generate` — Regenerates the Prisma Client types

---

## 📄 License

MIT
