import { describe, expect, it } from "vitest";

import { parseApiError } from "../lib/api";

describe("parseApiError", () => {
  it("extracts string detail", () => {
    expect(parseApiError({ detail: "invalid_credentials" })).toBe("invalid_credentials");
  });

  it("extracts nested detail.error", () => {
    expect(parseApiError({ detail: { error: "file_too_large" } })).toBe("file_too_large");
  });

  it("extracts first FastAPI validation error msg", () => {
    expect(
      parseApiError({ detail: [{ type: "missing", loc: ["body", "file"], msg: "Field required" }] }),
    ).toBe("Field required");
  });

  it("falls back when unknown shape", () => {
    expect(parseApiError({ something: 1 })).toBe("request_failed");
  });
});
