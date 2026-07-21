import { randomUUID } from "node:crypto";

import { provisionWorkspace } from "../workspaces/service";
import {
  executionEventStore,
  type ExecutionEventStore,
} from "./execution-events";
import {
  scheduleAgentTeam,
  type TeamEvent,
  type TeamTaskResult,
} from "./scheduler";
import {
  executeWorkstream,
  type ExecutionResult,
} from "./service";
import type { TeamExecutionRequest } from "./team-schema";

export type TeamExecutionResult = {
  teamRunId: string;
  repository: string;
  baseBranch: string;
  concurrency: number;
  branches: Array<{
    workstreamKey: string;
    branchName: string;
    status: "created" | "existing";
  }>;
  agents: TeamTaskResult<ExecutionResult>[];
  events: TeamEvent[];
};

export type TeamExecutionDependencies = {
  provisionWorkspace: typeof provisionWorkspace;
  executeWorkstream: typeof executeWorkstream;
  scheduleAgentTeam: typeof scheduleAgentTeam;
  eventStore: ExecutionEventStore;
  createTeamRunId: () => string;
  now: () => string;
};

const defaultDependencies: TeamExecutionDependencies = {
  provisionWorkspace,
  executeWorkstream,
  scheduleAgentTeam,
  eventStore: executionEventStore,
  createTeamRunId: randomUUID,
  now: () => new Date().toISOString(),
};

export async function executeAgentTeam(
  request: TeamExecutionRequest,
  dependencies: TeamExecutionDependencies = defaultDependencies,
): Promise<TeamExecutionResult> {
  const [first] = request.executions;
  const teamRunId = dependencies.createTeamRunId();

  const workspace = await dependencies.provisionWorkspace({
    repository: first.repository,
    baseBranch: first.baseBranch,
    workstreams: request.executions.map((execution) => ({
      key: execution.workstream.key,
      name: execution.workstream.name,
    })),
  });

  const executionsByKey = new Map(
    request.executions.map((execution) => [
      execution.workstream.key,
      execution,
    ]),
  );

  const team = await dependencies.scheduleAgentTeam(
    request.executions.map((execution) => ({
      key: execution.workstream.key,
      dependsOn:
        execution.contextPackage.dependencies.map(
          (dependency) => dependency.key,
        ),
    })),
    async (task) => {
      const execution = executionsByKey.get(task.key);

      if (!execution) {
        throw new Error(
          `Missing execution request for ${task.key}.`,
        );
      }

      return dependencies.executeWorkstream(
        execution,
        undefined,
        { teamRunId, store: dependencies.eventStore },
      );
    },
    {
      concurrency: request.concurrency,
      now: dependencies.now,
      onEvent: (event) => {
        const execution = executionsByKey.get(event.key);

        if (!execution) return;

        dependencies.eventStore.record(teamRunId, {
          stage: "scheduling",
          status: event.status,
          timestamp: event.timestamp,
          branchName: execution.branchName,
          workstreamKey: event.key,
        });
      },
    },
  );

  return {
    teamRunId,
    repository: first.repository,
    baseBranch: first.baseBranch,
    concurrency: request.concurrency,
    branches: workspace.branches.map((branch) => ({
      workstreamKey: branch.workstreamKey,
      branchName: branch.branchName,
      status: branch.status,
    })),
    agents: team.results,
    events: team.events,
  };
}
