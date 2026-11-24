import templateData from "./templates.json";
import type { JSONContent } from "@tiptap/react";

export interface Doc {
  live?: boolean;
  owner?: string;
  role?: "owner" | "viewer" | "editor" | "commenter";
  id: string;
  title: string;
  content: JSONContent;
  revision: number;
  updated: string;
  created: string;
  favorite: boolean;
  deleted: boolean;
  folder: string;
  settings: { [key: string]: any };
}
export const templates: Record<string, JSONContent[]> = templateData;
export function newDoc(template = "Blank document"): Doc {
  const time = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title:
      template === "Blank document"
        ? "Untitled document"
        : template === "Project proposal"
          ? "Workspace modernization proposal"
          : template,
    content: { type: "doc", content: structuredClone(templates[template]) },
    created: time,
    updated: time,
    revision: 0,
    favorite: false,
    deleted: false,
    folder: "",
    settings:
      template === "Project proposal"
        ? {
            header: "AKASHAVYOM LABS   /   PROJECT SERVICES",
            footer: "Workspace modernization proposal",
          }
        : JSON.parse(localStorage.getItem("titan.design") || "{}"),
  };
}
export async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Workspace": "editor" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Workspace service unavailable (" + res.status + ")",
    );
  }
  return res.json();
}
let opening: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open("akasha-documents", 1);
    request.onupgradeneeded = () => {
      const docs = request.result.createObjectStore("documents", {
        keyPath: "id",
      });
      const history = request.result.createObjectStore("history", {
        keyPath: ["id", "revision"],
      });
      for (const doc of JSON.parse(
        localStorage.getItem("avl.documents.v1") || "[]",
      ) as Doc[]) {
        docs.put(doc);
        for (const prior of JSON.parse(
          localStorage.getItem("history:" + doc.id) || "[]",
        ))
          history.put(prior);
      }
    };
    request.onerror = () => {
      opening = undefined;
      reject(request.error);
    };
    request.onsuccess = () => resolve(request.result);
  });
  return opening;
}
function records<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function localDocs(): Promise<Doc[]> {
  const db = await database();
  return records(db.transaction("documents").objectStore("documents").getAll());
}
export async function listDocs(account: string): Promise<Doc[]> {
  return account ? api("/documents") : localDocs();
}
export async function persist(doc: Doc, account: string): Promise<Doc> {
  if (account)
    return api(
      doc.revision ? "/documents/" + doc.id : "/documents",
      doc.revision ? "PATCH" : "POST",
      doc,
    );
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["documents", "history"], "readwrite"),
      docs = tx.objectStore("documents"),
      history = tx.objectStore("history");
    const next = {
      ...doc,
      updated: new Date().toISOString(),
      revision: doc.revision + 1,
    };
    const read = docs.get(doc.id);
    read.onsuccess = () => {
      const prior = read.result as Doc | undefined;
      if ((prior?.revision ?? 0) !== doc.revision) {
        reject(new Error("A newer revision exists"));
        tx.abort();
        return;
      }
      if (prior) {
        history.put(prior);
        if (prior.revision > 20) history.delete([doc.id, prior.revision - 20]);
      }
      docs.put(next);
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = tx.onerror = () =>
      reject(tx.error || new Error("Save interrupted"));
  });
}
export async function versions(doc: Doc, account: string): Promise<Doc[]> {
  if (account) return api("/documents/" + doc.id + "/versions");
  const db = await database();
  const history = await records(
    db
      .transaction("history")
      .objectStore("history")
      .getAll(
        IDBKeyRange.bound([doc.id, 0], [doc.id, Number.MAX_SAFE_INTEGER]),
      ),
  );
  return history.reverse();
}

