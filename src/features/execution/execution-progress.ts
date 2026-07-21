import {
  executionEventStore,
  type ExecutionEvent,
  type ExecutionEventStore,
} from "./execution-events";

export type WorkstreamProgress = ExecutionEvent;

export type TeamExecutionProgress = {
  teamRunId: string;
  completed: WorkstreamProgress[];
  failed: WorkstreamProgress[];
  blocked: WorkstreamProgress[];
  active: WorkstreamProgress[];
};

export function getTeamExecutionProgress(
  teamRunId: string,
  store: ExecutionEventStore = executionEventStore,
): TeamExecutionProgress {
  const latestByWorkstream = new Map<string, WorkstreamProgress>();

  for (const event of store.listByTeamRun(teamRunId)) {
    latestByWorkstream.set(event.workstreamKey, event);
  }

  const progress: TeamExecutionProgress = {
    teamRunId,
    completed: [],
    failed: [],
    blocked: [],
    active: [],
  };

  for (const event of latestByWorkstream.values()) {
    if (event.status === "completed") {
      progress.completed.push(event);
    } else if (event.status === "failed") {
      progress.failed.push(event);
    } else if (event.status === "blocked") {
      progress.blocked.push(event);
    } else {
      progress.active.push(event);
    }
  }

  return progress;
}
