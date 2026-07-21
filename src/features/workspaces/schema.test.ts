import { describe, expect, it } from "vitest";

import { branchNameFor, workspaceRequestSchema } from "./schema";

describe("workspaceRequestSchema", () => {
  const validRequest = {
    repository: "Abhinav-Kakaraparthi/BranchMind",
    workstreams: [
      { key: "context-compiler", name: "Context Compiler" },
      { key: "github-orchestration", name: "GitHub Orchestration" },
    ],
  };

  it("accepts a valid request and defaults to main", () => {
    const request = workspaceRequestSchema.parse(validRequest);

    expect(request.baseBranch).toBe("main");
    expect(request.workstreams).toHaveLength(2);
  });

  it("rejects malformed repositories", () => {
    expect(() =>
      workspaceRequestSchema.parse({
        ...validRequest,
        repository: "https://github.com/owner/repository",
      }),
    ).toThrow();
  });

  it("rejects unsafe workstream keys", () => {
    expect(() =>
      workspaceRequestSchema.parse({
        ...validRequest,
        workstreams: [{ key: "feature; remove-item", name: "Unsafe" }],
      }),
    ).toThrow();
  });

  it("rejects duplicate workstream keys", () => {
    expect(() =>
      workspaceRequestSchema.parse({
        ...validRequest,
        workstreams: [
          { key: "api", name: "First API" },
          { key: "api", name: "Second API" },
        ],
      }),
    ).toThrow("Duplicate workstream key");
  });

  it("rejects unsafe base branches", () => {
    expect(() =>
      workspaceRequestSchema.parse({
        ...validRequest,
        baseBranch: "main; remove-item",
      }),
    ).toThrow();
  });
});

describe("branchNameFor", () => {
  it("creates a deterministic agent branch", () => {
    expect(branchNameFor("context-compiler")).toBe("agent/context-compiler");
  });

  it("rejects unsafe branch components", () => {
    expect(() => branchNameFor("../main")).toThrow("unsafe workstream key");
  });
});
