import { describe, expect, it } from "vitest";

import { executionRequestSchema } from "./schema";

const request = {
  repository: "acme/product",
  baseBranch: "main",
  branchName: "agent/context-compiler",
  workstream: {
    key: "context-compiler",
    name: "Context Compiler",
  },
  contextPackage: {
    workstreamKey: "context-compiler",
    project: {
      name: "BranchMind",
      summary: "Focused agent orchestration",
    },
    assignment: {
      objective: "Compile focused context",
      deliverables: ["Compiler"],
      acceptanceCriteria: ["Context is reduced"],
      contextNeeds: ["Plan"],
    },
    dependencies: [],
    excludedWorkstreams: ["workspace-ui"],
    fingerprint: "abcdef0123456789",
  },
};

describe("executionRequestSchema", () => {
  it("accepts a matching branch and context package", () => {
    expect(executionRequestSchema.parse(request)).toEqual(request);
  });

  it("rejects mismatched context ownership", () => {
    expect(() =>
      executionRequestSchema.parse({
        ...request,
        contextPackage: {
          ...request.contextPackage,
          workstreamKey: "other-agent",
        },
      }),
    ).toThrow("does not belong");
  });

  it("rejects a branch owned by another workstream", () => {
    expect(() =>
      executionRequestSchema.parse({
        ...request,
        branchName: "agent/other-agent",
      }),
    ).toThrow("does not match");
  });
});
