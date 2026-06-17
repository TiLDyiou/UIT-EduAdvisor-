/**
 * Minimal Server-Sent Events parser for fetch() streams (text/event-stream).
 * Yields { event, data } where data is the parsed JSON object when possible.
 */
export type SseEvent =
  | { event: string; data: unknown }
  | { event: string; data: string; raw: true };

export async function* parseSseJsonStream(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<SseEvent, void, undefined> {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushBlock = (block: string): SseEvent | null => {
    const lines = block.split("\n");
    let ev = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        ev = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
    const raw = dataLines.join("\n");
    if (!raw) return null;
    try {
      return { event: ev, data: JSON.parse(raw) as unknown };
    } catch {
      return { event: ev, data: raw, raw: true };
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!block) continue;
        const parsed = flushBlock(block);
        if (parsed) yield parsed;
      }
    }
    const tail = buffer.trim();
    if (tail) {
      const parsed = flushBlock(tail);
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}
