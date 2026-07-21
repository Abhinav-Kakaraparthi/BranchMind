import { describe, expect, it } from "vitest";

import type { ContextPackage } from "@/features/context/compiler";
import type { ProjectPlan } from "@/features/planning/schema";

import {
  buildTeamExecutionRequest,
  summarizeTeamExecution,
} from "./team-request";
import { teamExecutionRequestSchema } from "./team-schema";

const plan: ProjectPlan = {
  projectName: "BranchMind",
  summary: "Coordinate focused specialist agents.",
  workstreams: [
    {
      key: "api",
      name: "API foundation",
      objective: "Create the API contract.",
      deliverables: ["API route"],
      acceptanceCriteria: ["Route responds"],
      contextNeeds: ["Route conventions"],
      dependsOn: [],
    },
    {
      key: "ui",
      name: "Team interface",
      objective: "Build the team interface.",
      deliverables: ["Team panel"],
      acceptanceCriteria: ["Panel launches a team"],
      contextNeeds: ["API contract"],
      dependsOn: ["api"],
    },
  ],
};

function contextPackage(
  key: string,
  dependencies: ContextPackage["dependencies"] = [],
): ContextPackage {
  const workstream = plan.workstreams.find((item) => item.key === key)!;

  return {
    workstreamKey: key,
    project: {
      name: plan.projectName,
      summary: plan.summary,
    },
    assignment: {
      objective: workstream.objective,
      deliverables: workstream.deliverables,
      acceptanceCriteria: workstream.acceptanceCriteria,
      contextNeeds: workstream.contextNeeds,
    },
    dependencies,
    excludedWorkstreams: [],
    metrics: {
      estimatedFullContextTokens: 100,
      estimatedPackageTokens: 50,
      estimatedTokensAvoided: 50,
      estimatedSavingsPercent: 50,
    },
    fingerprint: key === "api" ? "abcdef0123456789" : "0123456789abcdef",
  };
}

describe("buildTeamExecutionRequest", () => {
  it("accepts matching dependencies and preserves focused packages", () => {
    const apiContext = contextPackage("api");
    const uiContext = contextPackage("ui", [
      {
        key: "api",
        name: "API foundation",
        objective: "Create the API contract.",
        deliverables: ["API route"],
      },
    ]);

    const request = buildTeamExecutionRequest(
      "acme/branchmind",
      plan,
      [apiContext, uiContext],
    );

    expect(request).toMatchObject({ concurrency: 3 });
    expect(request.executions).toEqual([
      expect.objectContaining({
        branchName: "agent/api",
        workstream: { key: "api", name: "API foundation" },
        contextPackage: expect.objectContaining({
          workstreamKey: "api",
          fingerprint: apiContext.fingerprint,
          dependencies: [],
        }),
      }),
      expect.objectContaining({
        branchName: "agent/ui",
        workstream: { key: "ui", name: "Team interface" },
        contextPackage: expect.objectContaining({
          workstreamKey: "ui",
          fingerprint: uiContext.fingerprint,
          dependencies: [expect.objectContaining({ key: "api" })],
        }),
      }),
    ]);
    expect(teamExecutionRequestSchema.parse(request)).toEqual(request);
  });

  it("rejects a dependency missing from the context package", () => {
    expect(() =>
      buildTeamExecutionRequest("acme/branchmind", plan, [
        contextPackage("api"),
        contextPackage("ui"),
      ]),
    ).toThrow(
      "focused context package for Team interface has dependencies that do not match the project plan. Regenerate the project plan",
    );
  });

  it("rejects an unexpected dependency in the context package", () => {
    expect(() =>
      buildTeamExecutionRequest("acme/branchmind", plan, [
        contextPackage("api", [
          {
            key: "ui",
            name: "Team interface",
            objective: "Build the team interface.",
            deliverables: ["Team panel"],
          },
        ]),
        contextPackage("ui", [
          {
            key: "api",
            name: "API foundation",
            objective: "Create the API contract.",
            deliverables: ["API route"],
          },
        ]),
      ]),
    ).toThrow(
      "focused context package for API foundation has dependencies that do not match the project plan. Regenerate the project plan",
    );
  });

  it("fails locally with an actionable error when a focused package is missing", () => {
    expect(() =>
      buildTeamExecutionRequest("acme/branchmind", plan, [
        contextPackage("api"),
      ]),
    ).toThrow("focused context package for Team interface is missing");
  });
});

describe("summarizeTeamExecution", () => {
  it("counts authoritative final agent statuses", () => {
    expect(
      summarizeTeamExecution({
        concurrency: 3,
        branches: [],
        agents: [
          { key: "api", status: "completed" },
          { key: "ui", status: "failed", error: "Quality gate failed" },
          { key: "docs", status: "blocked", error: "API failed" },
        ],
      }),
    ).toEqual({
      completed: 1,
      failed: 1,
      blocked: 1,
      maximumConcurrency: 3,
    });
  });
});
