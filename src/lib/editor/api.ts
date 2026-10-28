import type { DocumentData, UploadResult } from "./types";

/**
 * Thin client for the editor's backend endpoints.
 * All requests are relative-path only (sandbox gateway friendly).
 */

export async function fetchDocument(): Promise<DocumentData> {
  const res = await fetch("/api/document", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load document (${res.status})`);
  const json = (await res.json()) as { document: DocumentData };
  return json.document;
}

export async function saveDocument(payload: {
  title: string;
  content: unknown;
}): Promise<{ savedAt: string }> {
  const res = await fetch("/api/document", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to save document (${res.status})`);
  const json = (await res.json()) as { savedAt: string };
  return json;
}

export async function uploadFile(file: File, signal?: AbortSignal): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body, signal });
  if (!res.ok) {
    const message = await res.json().catch(() => null);
    throw new Error(
      (message as { error?: string } | null)?.error ?? `Upload failed (${res.status})`,
    );
  }
  return (await res.json()) as UploadResult;
}
