import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/readiness", () => {
  it("returns a ready status", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ready" });
  });
});
