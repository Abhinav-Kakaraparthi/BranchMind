import { describe, expect, it } from "vitest";

import { createExecutionEventStore } from "./execution-events";
import { getTeamExecutionProgress } from "./execution-progress";

const teamRunId = "d2719d17-6bc7-4cca-b1a2-a7b92b7f4278";

describe("getTeamExecutionProgress", () => {
  it("groups each workstream by its latest persisted execution event", () => {
    const store = createExecutionEventStore();
    const timestamp = "2026-07-21T06:00:00.000Z";

    for (const [workstreamKey, status] of [
      ["completed-work", "completed"],
      ["failed-work", "failed"],
      ["blocked-work", "blocked"],
      ["active-work", "queued"],
    ] as const) {
      store.record(teamRunId, {
        stage: "scheduling",
        status,
        timestamp,
        branchName: `agent/${workstreamKey}`,
        workstreamKey,
      });
    }

    store.record(teamRunId, {
      stage: "implementing",
      status: "running",
      timestamp: "2026-07-21T06:01:00.000Z",
      branchName: "agent/active-work",
      workstreamKey: "active-work",
    });

    const progress = getTeamExecutionProgress(teamRunId, store);

    expect(progress.completed.map((event) => event.workstreamKey)).toEqual([
      "completed-work",
    ]);
    expect(progress.failed.map((event) => event.workstreamKey)).toEqual([
      "failed-work",
    ]);
    expect(progress.blocked.map((event) => event.workstreamKey)).toEqual([
      "blocked-work",
    ]);
    expect(progress.active).toEqual([
      expect.objectContaining({
        workstreamKey: "active-work",
        status: "running",
        stage: "implementing",
      }),
    ]);
  });
});
