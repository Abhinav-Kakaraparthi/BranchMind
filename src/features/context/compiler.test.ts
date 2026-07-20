import { describe, expect, it } from "vitest";

import type { ProjectPlan } from "@/features/planning/schema";

import { compileContextPackages } from "./compiler";

const plan: ProjectPlan = {
  projectName: "Commerce platform",
  summary: "A modular commerce application",
  workstreams: [
    {
      key: "foundation",
      name: "Foundation",
      objective: "Define shared contracts",
      deliverables: ["API contracts"],
      acceptanceCriteria: ["Contracts are documented"],
      contextNeeds: ["Product requirements"],
      dependsOn: [],
    },
    {
      key: "catalog",
      name: "Catalog",
      objective: "Build product discovery",
      deliverables: ["Catalog API"],
      acceptanceCriteria: ["Products can be searched"],
      contextNeeds: ["API contracts"],
      dependsOn: ["foundation"],
    },
    {
      key: "checkout",
      name: "Checkout",
      objective: "Build checkout",
      deliverables: ["Checkout API"],
      acceptanceCriteria: ["Orders can be submitted"],
      contextNeeds: ["API contracts"],
      dependsOn: ["foundation"],
    },
    {
      key: "analytics",
      name: "Analytics",
      objective: "Build reporting",
      deliverables: ["UNRELATED_ANALYTICS_SECRET"],
      acceptanceCriteria: ["Reports are available"],
      contextNeeds: ["Event contracts"],
      dependsOn: ["foundation"],
    },
  ],
};

describe("compileContextPackages", () => {
  it("creates one package per workstream", () => {
    expect(compileContextPackages(plan)).toHaveLength(4);
  });

  it("includes direct dependency contracts", () => {
    const packages = compileContextPackages(plan);
    const catalog = packages.find(
      (context) => context.workstreamKey === "catalog",
    );

    expect(catalog?.dependencies.map((item) => item.key)).toEqual([
      "foundation",
    ]);
  });

  it("excludes unrelated workstream content", () => {
    const packages = compileContextPackages(plan);
    const catalog = packages.find(
      (context) => context.workstreamKey === "catalog",
    );

    expect(JSON.stringify(catalog)).not.toContain(
      "UNRELATED_ANALYTICS_SECRET",
    );
    expect(catalog?.excludedWorkstreams).toContain("analytics");
  });

  it("reports positive context savings", () => {
    const packages = compileContextPackages(plan);
    const catalog = packages.find(
      (context) => context.workstreamKey === "catalog",
    );

    expect(catalog?.metrics.estimatedTokensAvoided).toBeGreaterThan(0);
    expect(catalog?.metrics.estimatedSavingsPercent).toBeGreaterThan(0);
  });

  it("creates stable fingerprints", () => {
    const first = compileContextPackages(plan);
    const second = compileContextPackages(plan);

    expect(first.map((item) => item.fingerprint)).toEqual(
      second.map((item) => item.fingerprint),
    );
  });
});
