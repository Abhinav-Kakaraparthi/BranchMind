import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import {
  createExecutionEventStore,
  createFileExecutionEventStore,
  executionEventSchema,
} from "./execution-events";

const teamRunId = "d2719d17-6bc7-4cca-b1a2-a7b92b7f4278";
const event = {
  stage: "implementing" as const,
  status: "running" as const,
  timestamp: "2026-07-21T06:00:00.000Z",
  branchName: "agent/execution-event-model",
  workstreamKey: "execution-event-model",
};

describe("execution event store", () => {
  it("persists complete events and queries them by agent-team run", () => {
    const store = createExecutionEventStore();

    store.record(teamRunId, event);
    store.record("dc3893f4-7ca9-4d80-bd9e-20be16365be2", {
      ...event,
      workstreamKey: "other-workstream",
    });

    expect(store.listByTeamRun(teamRunId)).toEqual([
      { teamRunId, ...event },
    ]);
  });

  it("requires the team run, stage, status, timestamp, branch, and workstream", () => {
    const completeEvent = { teamRunId, ...event };

    for (const requiredField of [
      "teamRunId",
      "stage",
      "status",
      "timestamp",
      "branchName",
      "workstreamKey",
    ]) {
      const incompleteEvent = { ...completeEvent };
      delete incompleteEvent[
        requiredField as keyof typeof incompleteEvent
      ];

      expect(executionEventSchema.safeParse(incompleteEvent).success).toBe(
        false,
      );
    }

    expect(
      executionEventSchema.safeParse({
        ...completeEvent,
        timestamp: "not-a-timestamp",
      }).success,
    ).toBe(false);
  });

  it("retains events after a new file-store instance is created", () => {
    const directory = mkdtempSync(join(tmpdir(), "branchmind-events-"));
    const filePath = join(directory, "events.jsonl");

    try {
      createFileExecutionEventStore(filePath).record(teamRunId, event);

      expect(
        createFileExecutionEventStore(filePath).listByTeamRun(teamRunId),
      ).toEqual([{ teamRunId, ...event }]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
