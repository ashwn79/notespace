import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Media upload endpoint — writes files to /public/uploads and returns
 * their permanent URL. 50 MB limit, executable extensions rejected.
 */

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024;

const BLOCKED_EXTENSIONS = [".exe", ".bat", ".cmd", ".com", ".scr", ".msi", ".sh", ".apk", ".dll"];

function sanitizeName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()\[\]]+/g, "_").slice(0, 120);
  return base || "file";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds the 50 MB limit" }, { status: 413 });
    }

    const clean = sanitizeName(file.name || "file");
    if (BLOCKED_EXTENSIONS.some((ext) => clean.toLowerCase().endsWith(ext))) {
      return NextResponse.json({ error: "This file type is not allowed" }, { status: 415 });
    }

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });

    const unique = `${randomUUID()}-${clean}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, unique), bytes);

    return NextResponse.json({
      url: `/uploads/${unique}`,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
    });
  } catch (error) {
    console.error("[api/upload] POST failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
