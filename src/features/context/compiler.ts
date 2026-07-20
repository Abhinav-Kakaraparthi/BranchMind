import { createHash } from "node:crypto";

import type { ProjectPlan } from "@/features/planning/schema";

export type DependencyContract = {
  key: string;
  name: string;
  objective: string;
  deliverables: string[];
};

export type ContextPackage = {
  workstreamKey: string;
  project: {
    name: string;
    summary: string;
  };
  assignment: {
    objective: string;
    deliverables: string[];
    acceptanceCriteria: string[];
    contextNeeds: string[];
  };
  dependencies: DependencyContract[];
  excludedWorkstreams: string[];
  metrics: {
    estimatedFullContextTokens: number;
    estimatedPackageTokens: number;
    estimatedTokensAvoided: number;
    estimatedSavingsPercent: number;
  };
  fingerprint: string;
};

export function compileContextPackages(
  plan: ProjectPlan,
): ContextPackage[] {
  const fullContextTokens = estimateTokens(JSON.stringify(plan));
  const workstreamsByKey = new Map(
    plan.workstreams.map((workstream) => [workstream.key, workstream]),
  );

  return plan.workstreams.map((workstream) => {
    const dependencies = workstream.dependsOn.map((dependencyKey) => {
      const dependency = workstreamsByKey.get(dependencyKey);

      if (!dependency) {
        throw new Error(
          `${workstream.key} references unavailable dependency ${dependencyKey}.`,
        );
      }

      return {
        key: dependency.key,
        name: dependency.name,
        objective: dependency.objective,
        deliverables: dependency.deliverables,
      };
    });

    const context = {
      workstreamKey: workstream.key,
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
      excludedWorkstreams: plan.workstreams
        .filter(
          (candidate) =>
            candidate.key !== workstream.key &&
            !workstream.dependsOn.includes(candidate.key),
        )
        .map((candidate) => candidate.key),
    };

    const packageTokens = estimateTokens(JSON.stringify(context));
    const avoidedTokens = Math.max(0, fullContextTokens - packageTokens);
    const savingsPercent =
      fullContextTokens === 0
        ? 0
        : Math.round((avoidedTokens / fullContextTokens) * 100);

    return {
      ...context,
      metrics: {
        estimatedFullContextTokens: fullContextTokens,
        estimatedPackageTokens: packageTokens,
        estimatedTokensAvoided: avoidedTokens,
        estimatedSavingsPercent: savingsPercent,
      },
      fingerprint: createFingerprint(context),
    };
  });
}

function estimateTokens(value: string): number {
  return Math.ceil(Buffer.byteLength(value, "utf8") / 4);
}

function createFingerprint(value: object): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}
