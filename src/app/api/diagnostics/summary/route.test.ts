import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/diagnostics/summary", () => {
  it("returns the public runtime and capabilities summary", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      runtime: "node",
      capabilities: [
        "planning",
        "isolated-workspaces",
        "parallel-agents",
        "pull-requests",
      ],
    });
  });
});
