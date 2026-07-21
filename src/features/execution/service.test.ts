import { describe, expect, it, vi } from "vitest";

import { executionRequestSchema } from "./schema";
import { createExecutionEventStore } from "./execution-events";
import {
  executeWorkstream,
  type ExecutionDependencies,
} from "./service";

const request = executionRequestSchema.parse({
  repository: "acme/product",
  baseBranch: "main",
  branchName: "agent/health-endpoint",
  workstream: {
    key: "health-endpoint",
    name: "Health Endpoint",
  },
  contextPackage: {
    workstreamKey: "health-endpoint",
    project: {
      name: "Product",
      summary: "Developer platform",
    },
    assignment: {
      objective: "Add a health endpoint",
      deliverables: ["Health route"],
      acceptanceCriteria: ["Returns an observable healthy status"],
      contextNeeds: ["Existing route conventions"],
    },
    dependencies: [],
    excludedWorkstreams: ["dashboard-redesign"],
    fingerprint: "abcdef0123456789",
  },
});

function createDependencies(
  changedFiles: string[] = ["src/app/api/health/route.ts"],
): ExecutionDependencies {
  return {
    withWorktree: async (_request, operation) =>
      operation("C:\\isolated-worktree"),
    runAgent: vi.fn().mockResolvedValue({
      summary: "Added a focused health endpoint.",
      diagnostics: "CODEX",
    }),
    changedFiles: vi.fn().mockResolvedValue(changedFiles),
    qualityGates: vi.fn().mockResolvedValue([
      { command: "npm run test", output: "passed" },
      { command: "npm run lint", output: "passed" },
      { command: "npm run build", output: "passed" },
    ]),
    commitAndPush: vi.fn().mockResolvedValue("c".repeat(40)),
    openPullRequest: vi
      .fn()
      .mockResolvedValue("https://github.com/acme/product/pull/1"),
    verifyRepository: vi.fn().mockResolvedValue(undefined),
    now: () => "2026-07-21T06:00:00.000Z",
  };
}

describe("executeWorkstream", () => {
  it("executes, validates, commits, pushes, and opens a pull request", async () => {
    const dependencies = createDependencies();

    const execution = await executeWorkstream(
      request,
      dependencies,
    );

    expect(execution).toMatchObject({
      repository: "acme/product",
      workstreamKey: "health-endpoint",
      branchName: "agent/health-endpoint",
      changedFiles: ["src/app/api/health/route.ts"],
      commitSha: "c".repeat(40),
      pullRequestUrl: "https://github.com/acme/product/pull/1",
      qualityGates: [
        { command: "npm run test", passed: true },
        { command: "npm run lint", passed: true },
        { command: "npm run build", passed: true },
      ],
    });

    expect(execution.runId).toMatch(
      /^[0-9a-f-]{36}$/i,
    );

    expect(execution.events.map((event) => event.stage)).toEqual([
      "preparing",
      "implementing",
      "validating",
      "committing",
      "opening_pull_request",
      "completed",
    ]);

    expect(dependencies.runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(
          "Add a health endpoint",
        ),
        workingDirectory: "C:\\isolated-worktree",
      }),
    );

    expect(dependencies.commitAndPush).toHaveBeenCalledOnce();
    expect(dependencies.openPullRequest).toHaveBeenCalledOnce();
  });

  it("does not validate or commit when the agent changes nothing", async () => {
    const dependencies = createDependencies([]);

    await expect(
      executeWorkstream(request, dependencies),
    ).rejects.toThrow("without changing any files");

    expect(dependencies.qualityGates).not.toHaveBeenCalled();
    expect(dependencies.commitAndPush).not.toHaveBeenCalled();
    expect(dependencies.openPullRequest).not.toHaveBeenCalled();
  });

  it("records each specialist stage with its branch and workstream", async () => {
    const store = createExecutionEventStore();
    const teamRunId = "d2719d17-6bc7-4cca-b1a2-a7b92b7f4278";

    await executeWorkstream(request, createDependencies(), {
      teamRunId,
      store,
    });

    expect(store.listByTeamRun(teamRunId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          teamRunId,
          stage: "implementing",
          status: "completed",
          timestamp: "2026-07-21T06:00:00.000Z",
          branchName: "agent/health-endpoint",
          workstreamKey: "health-endpoint",
        }),
        expect.objectContaining({ stage: "completed" }),
      ]),
    );
  });

  it("does not run an agent for a different local repository", async () => {
    const dependencies = createDependencies();
    dependencies.verifyRepository = vi
      .fn()
      .mockRejectedValue(
        new Error("Connected to a different repository"),
      );

    await expect(
      executeWorkstream(request, dependencies),
    ).rejects.toThrow("different repository");

    expect(dependencies.runAgent).not.toHaveBeenCalled();
  });

  it("does not commit when a quality gate fails", async () => {
    const dependencies = createDependencies();
    dependencies.qualityGates = vi
      .fn()
      .mockRejectedValue(new Error("npm run test failed"));

    await expect(
      executeWorkstream(request, dependencies),
    ).rejects.toThrow("npm run test failed");

    expect(dependencies.commitAndPush).not.toHaveBeenCalled();
    expect(dependencies.openPullRequest).not.toHaveBeenCalled();
  });
});
