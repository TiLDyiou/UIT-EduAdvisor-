import { describe, expect, it } from "vitest";

import { parseSseJsonStream } from "../lib/sse";

function streamFromString(s: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(s));
      controller.close();
    },
  });
}

describe("parseSseJsonStream", () => {
  it("parses meta and delta events", async () => {
    const raw =
      'event: meta\ndata: {"request_id":"r1","remaining_messages":5,"sources":[]}\n\n' +
      'event: delta\ndata: {"text":"Hi"}\n\n' +
      'event: done\ndata: {"policy_disclaimer_required":false}\n\n';
    const out: { event: string; data: unknown }[] = [];
    for await (const ev of parseSseJsonStream(streamFromString(raw))) {
      if ("raw" in ev && ev.raw) continue;
      out.push({ event: ev.event, data: ev.data });
    }
    expect(out.map((e) => e.event)).toEqual(["meta", "delta", "done"]);
    expect((out[1].data as { text: string }).text).toBe("Hi");
  });
});
