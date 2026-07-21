import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/diagnostics/runtime", () => {
  it("returns the Node.js runtime diagnostic", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      runtime: "node",
    });
  });
});
