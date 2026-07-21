import { describe, expect, it } from "vitest";

import { teamExecutionRequestSchema } from "./team-schema";

function execution(key: string, dependencies: string[] = []) {
  return {
    repository: "acme/product",
    baseBranch: "main",
    branchName: `agent/${key}`,
    workstream: {
      key,
      name: key,
    },
    contextPackage: {
      workstreamKey: key,
      project: {
        name: "Product",
        summary: "Agent team",
      },
      assignment: {
        objective: `Implement ${key}`,
        deliverables: ["Working code"],
        acceptanceCriteria: ["Tests pass"],
        contextNeeds: [],
      },
      dependencies: dependencies.map((dependency) => ({
        key: dependency,
        name: dependency,
        objective: `Implement ${dependency}`,
        deliverables: ["Dependency output"],
      })),
      excludedWorkstreams: [],
      fingerprint: "abcdef0123456789",
    },
  };
}

describe("teamExecutionRequestSchema", () => {
  it("accepts a dependency-complete team", () => {
    const team = teamExecutionRequestSchema.parse({
      executions: [
        execution("api"),
        execution("ui", ["api"]),
      ],
    });

    expect(team.concurrency).toBe(3);
  });

  it("rejects a missing dependency agent", () => {
    expect(() =>
      teamExecutionRequestSchema.parse({
        executions: [execution("ui", ["api"])],
      }),
    ).toThrow("missing team dependency");
  });

  it("rejects mixed repositories", () => {
    const second = execution("ui");
    second.repository = "other/product";

    expect(() =>
      teamExecutionRequestSchema.parse({
        executions: [execution("api"), second],
      }),
    ).toThrow("same repository");
  });
});
