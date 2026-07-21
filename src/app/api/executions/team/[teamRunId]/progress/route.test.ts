import { describe, expect, it, vi } from "vitest";

import { createExecutionEventStore } from "../../../../../../features/execution/execution-events";
import { getTeamExecutionProgress } from "../../../../../../features/execution/execution-progress";

import { GET } from "./route";

const teamRunId = "d2719d17-6bc7-4cca-b1a2-a7b92b7f4278";

describe("GET /api/executions/team/[teamRunId]/progress", () => {
  it("returns the completed, failed, blocked, and active workstream contract", async () => {
    const store = createExecutionEventStore();
    const progress = getTeamExecutionProgress(teamRunId, store);
    const getProgress = vi
      .spyOn(
        await import("../../../../../../features/execution/execution-progress"),
        "getTeamExecutionProgress",
      )
      .mockReturnValue({
        ...progress,
        completed: [event("completed-work", "completed")],
        failed: [event("failed-work", "failed")],
        blocked: [event("blocked-work", "blocked")],
        active: [event("active-work", "running")],
      });

    try {
      const response = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ teamRunId }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        progress: {
          teamRunId,
          completed: [event("completed-work", "completed")],
          failed: [event("failed-work", "failed")],
          blocked: [event("blocked-work", "blocked")],
          active: [event("active-work", "running")],
        },
      });
    } finally {
      getProgress.mockRestore();
    }
  });

  it("rejects an invalid team run identifier", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ teamRunId: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid agent team run identifier.",
    });
  });
});

function event(
  workstreamKey: string,
  status: "completed" | "failed" | "blocked" | "running",
) {
  return {
    teamRunId,
    stage: "scheduling" as const,
    status,
    timestamp: "2026-07-21T06:00:00.000Z",
    branchName: `agent/${workstreamKey}`,
    workstreamKey,
  };
}
