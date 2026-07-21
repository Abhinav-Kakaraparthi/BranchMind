import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/diagnostics/capabilities", () => {
  it("returns the supported BranchMind capabilities", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      capabilities: [
        "planning",
        "isolated-workspaces",
        "parallel-agents",
        "pull-requests",
      ],
    });
  });
});
