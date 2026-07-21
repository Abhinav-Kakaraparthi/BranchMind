import type { ContextPackage } from "@/features/context/compiler";
import type { ProjectPlan } from "@/features/planning/schema";

import type { TeamExecutionRequest } from "./team-schema";

export const TEAM_MAX_CONCURRENCY = 3;

export type TeamAgentResult = {
  key: string;
  status: "completed" | "failed" | "blocked";
  value?: {
    branchName: string;
    changedFiles: string[];
    pullRequestUrl: string;
    qualityGates: Array<{
      command: string;
      passed: true;
    }>;
  };
  error?: string;
};

export type TeamExecutionResponse = {
  concurrency: number;
  branches: Array<{
    workstreamKey: string;
    branchName: string;
    status: "created" | "existing";
  }>;
  agents: TeamAgentResult[];
};

export type TeamExecutionSummary = {
  completed: number;
  failed: number;
  blocked: number;
  maximumConcurrency: number;
};

export function buildTeamExecutionRequest(
  repository: string,
  plan: ProjectPlan,
  contextPackages: ContextPackage[],
): TeamExecutionRequest {
  const contextByWorkstream = new Map(
    contextPackages.map((contextPackage) => [
      contextPackage.workstreamKey,
      contextPackage,
    ]),
  );

  return {
    concurrency: TEAM_MAX_CONCURRENCY,
    executions: plan.workstreams.map((workstream) => {
      const contextPackage = contextByWorkstream.get(workstream.key);

      if (!contextPackage) {
        throw new Error(
          `Cannot run the agent team: the focused context package for ${workstream.name} is missing. Regenerate the project plan and try again.`,
        );
      }

      const plannedDependencyKeys = uniqueSortedKeys(workstream.dependsOn);
      const contextDependencyKeys = uniqueSortedKeys(
        contextPackage.dependencies.map((dependency) => dependency.key),
      );

      if (
        plannedDependencyKeys.length !== contextDependencyKeys.length ||
        plannedDependencyKeys.some(
          (key, index) => key !== contextDependencyKeys[index],
        )
      ) {
        throw new Error(
          `Cannot run the agent team: the focused context package for ${workstream.name} has dependencies that do not match the project plan. Regenerate the project plan and try again.`,
        );
      }

      return {
        repository,
        baseBranch: "main",
        branchName: `agent/${workstream.key}`,
        workstream: {
          key: workstream.key,
          name: workstream.name,
        },
        contextPackage: toExecutionContextPackage(contextPackage),
      };
    }),
  };
}

export function summarizeTeamExecution(
  team: TeamExecutionResponse,
): TeamExecutionSummary {
  return {
    completed: team.agents.filter((agent) => agent.status === "completed")
      .length,
    failed: team.agents.filter((agent) => agent.status === "failed").length,
    blocked: team.agents.filter((agent) => agent.status === "blocked").length,
    maximumConcurrency: team.concurrency,
  };
}

function uniqueSortedKeys(keys: string[]): string[] {
  return [...new Set(keys)].sort();
}

function toExecutionContextPackage(contextPackage: ContextPackage) {
  return {
    workstreamKey: contextPackage.workstreamKey,
    project: contextPackage.project,
    assignment: contextPackage.assignment,
    dependencies: contextPackage.dependencies,
    excludedWorkstreams: contextPackage.excludedWorkstreams,
    fingerprint: contextPackage.fingerprint,
  };
}
