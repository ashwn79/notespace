import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Document persistence API.
 *
 * The editor operates on a single "default" document slot. The shape is
 * intentionally future-proof: adding `slug` / `ownerId` columns later turns
 * this into a multi-document workspace without changing the client contract.
 */

const DEFAULT_DOC_ID = "default";

const DOCUMENT_SELECT = {
  id: true,
  title: true,
  content: true,
  updatedAt: true,
} as const;

type DocRow = { id: string; title: string; content: string; updatedAt: Date };

function serialize(doc: DocRow) {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(doc.content);
  } catch {
    parsed = null;
  }
  return {
    id: doc.id,
    title: doc.title,
    content: parsed,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const existing = await db.document.findUnique({
      where: { id: DEFAULT_DOC_ID },
      select: DOCUMENT_SELECT,
    });
    if (existing) {
      return NextResponse.json({ document: serialize(existing) });
    }

    const created = await db.document.create({
      data: { id: DEFAULT_DOC_ID, title: "", content: JSON.stringify(emptyDocument()) },
      select: DOCUMENT_SELECT,
    });
    return NextResponse.json({ document: serialize(created) });
  } catch (error) {
    console.error("[api/document] GET failed", error);
    return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { title?: unknown; content?: unknown };

    const title = typeof body.title === "string" ? body.title.slice(0, 500) : "";
    if (body.content === undefined || body.content === null) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    if (typeof body.content !== "object") {
      return NextResponse.json({ error: "content must be a JSON document" }, { status: 400 });
    }

    const content = JSON.stringify(body.content);

    const saved = await db.document.upsert({
      where: { id: DEFAULT_DOC_ID },
      update: { title, content },
      create: { id: DEFAULT_DOC_ID, title, content },
      select: DOCUMENT_SELECT,
    });

    return NextResponse.json({ document: serialize(saved), savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[api/document] PUT failed", error);
    return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
  }
}

function emptyDocument() {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}
