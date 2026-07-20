import { describe, expect, it } from "vitest";

import { validatePlanGraph } from "./graph";
import type { ProjectPlan } from "./schema";

function createPlan(
  dependencies: Record<string, string[]>,
): ProjectPlan {
  return {
    projectName: "Test project",
    summary: "Test plan",
    workstreams: Object.entries(dependencies).map(([key, dependsOn]) => ({
      key,
      name: key,
      objective: `Complete ${key}`,
      deliverables: [`${key} implementation`],
      acceptanceCriteria: [`${key} works`],
      contextNeeds: [],
      dependsOn,
    })),
  };
}

describe("validatePlanGraph", () => {
  it("accepts a valid dependency graph", () => {
    const plan = createPlan({
      foundation: [],
      frontend: ["foundation"],
      integration: ["foundation", "frontend"],
    });

    expect(() => validatePlanGraph(plan)).not.toThrow();
  });

  it("rejects duplicate workstream keys", () => {
    const plan = createPlan({
      foundation: [],
      frontend: ["foundation"],
    });

    plan.workstreams.push({ ...plan.workstreams[0] });

    expect(() => validatePlanGraph(plan)).toThrow("duplicate");
  });

  it("rejects unknown dependencies", () => {
    const plan = createPlan({
      frontend: ["missing-api"],
      testing: [],
    });

    expect(() => validatePlanGraph(plan)).toThrow("unknown dependency");
  });

  it("rejects self dependencies", () => {
    const plan = createPlan({
      frontend: ["frontend"],
      testing: [],
    });

    expect(() => validatePlanGraph(plan)).toThrow("depend on itself");
  });

  it("rejects circular dependencies", () => {
    const plan = createPlan({
      frontend: ["backend"],
      backend: ["frontend"],
    });

    expect(() => validatePlanGraph(plan)).toThrow("circular dependency");
  });
});
