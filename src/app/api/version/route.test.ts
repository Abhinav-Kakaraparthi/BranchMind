import { describe, expect, it } from "vitest";

import packageJson from "../../../../package.json";
import { GET } from "./route";

describe("GET /api/version", () => {
  it("returns the current version response", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      version: packageJson.version,
    });
  });
});
