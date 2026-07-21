import { provisionWorkspace } from "../workspaces/service";
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

export async function executeAgentTeam(
  request: TeamExecutionRequest,
): Promise<TeamExecutionResult> {
  const [first] = request.executions;

  const workspace = await provisionWorkspace({
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

  const team = await scheduleAgentTeam(
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

      return executeWorkstream(execution);
    },
    {
      concurrency: request.concurrency,
    },
  );

  return {
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
