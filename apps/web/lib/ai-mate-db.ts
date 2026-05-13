const DB_NAME = "uit_eduadvisor_ai_mate";
const DB_VERSION = 1;
const STORE = "messages";

export type AiMateLocalRole = "user" | "assistant";

export type AiMateLocalMessage = {
  id: string;
  thread_id: string;
  role: AiMateLocalRole;
  content: string;
  created_at: string;
  sources?: { document_id: number; document_title: string; tag: string; chunk_index: number }[];
  disclaimer_required?: boolean;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("by_thread_created", ["thread_id", "created_at"]);
      }
    };
  });
}

export async function aiMateDbAppend(msg: AiMateLocalMessage): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(msg);
  });
  db.close();
}

export async function aiMateDbListThread(threadId: string): Promise<AiMateLocalMessage[]> {
  const db = await openDb();
  const rows = await new Promise<AiMateLocalMessage[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const idx = store.index("by_thread_created");
    const out: AiMateLocalMessage[] = [];
    const range = IDBKeyRange.bound([threadId, ""], [threadId, "\uffff"]);
    const cur = idx.openCursor(range);
    cur.onerror = () => reject(cur.error);
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) {
        resolve(out);
        return;
      }
      out.push(c.value as AiMateLocalMessage);
      c.continue();
    };
  });
  db.close();
  rows.sort((a: AiMateLocalMessage, b: AiMateLocalMessage) =>
    a.created_at.localeCompare(b.created_at),
  );
  return rows;
}

export async function aiMateDbDeleteThread(threadId: string): Promise<void> {
  const db = await openDb();
  const ids = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const idx = store.index("by_thread_created");
    const keys: string[] = [];
    const range = IDBKeyRange.bound([threadId, ""], [threadId, "\uffff"]);
    const cur = idx.openCursor(range);
    cur.onerror = () => reject(cur.error);
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) {
        resolve(keys);
        return;
      }
      keys.push((c.value as AiMateLocalMessage).id);
      c.continue();
    };
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    for (const id of ids) {
      store.delete(id);
    }
  });
  db.close();
}

export async function aiMateDbClearOlderThanDays(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const db = await openDb();
  let removed = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    const cur = store.openCursor();
    cur.onerror = () => reject(cur.error);
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) {
        resolve();
        return;
      }
      const row = c.value as AiMateLocalMessage;
      if (row.created_at < cutoff) {
        c.delete();
        removed += 1;
      }
      c.continue();
    };
  });
  db.close();
  return removed;
}

export async function aiMateDbClearAll(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).clear();
  });
  db.close();
}
