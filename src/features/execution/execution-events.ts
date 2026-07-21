import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { z } from "zod";

export const executionEventStageSchema = z.enum([
  "scheduling",
  "preparing",
  "implementing",
  "validating",
  "committing",
  "opening_pull_request",
  "completed",
]);

export const executionEventStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "blocked",
]);

export const executionEventSchema = z.object({
  teamRunId: z.string().uuid(),
  stage: executionEventStageSchema,
  status: executionEventStatusSchema,
  timestamp: z.string().datetime(),
  branchName: z.string().min(1),
  workstreamKey: z.string().min(1),
});

export type ExecutionEvent = z.infer<typeof executionEventSchema>;
export type ExecutionEventInput = Omit<ExecutionEvent, "teamRunId">;

export interface ExecutionEventStore {
  record(teamRunId: string, event: ExecutionEventInput): ExecutionEvent;
  listByTeamRun(teamRunId: string): ExecutionEvent[];
}

export function createExecutionEventStore(): ExecutionEventStore {
  const eventsByTeamRun = new Map<string, ExecutionEvent[]>();

  return {
    record(teamRunId, event) {
      const recorded = executionEventSchema.parse({
        teamRunId,
        ...event,
      });
      const events = eventsByTeamRun.get(teamRunId) ?? [];

      events.push(recorded);
      eventsByTeamRun.set(teamRunId, events);

      return { ...recorded };
    },
    listByTeamRun(teamRunId) {
      return (eventsByTeamRun.get(teamRunId) ?? []).map((event) => ({
        ...event,
      }));
    },
  };
}

export function createFileExecutionEventStore(
  filePath: string,
): ExecutionEventStore {
  return {
    record(teamRunId, event) {
      const recorded = executionEventSchema.parse({
        teamRunId,
        ...event,
      });

      mkdirSync(dirname(filePath), { recursive: true });
      appendFileSync(filePath, `${JSON.stringify(recorded)}\n`, "utf8");

      return { ...recorded };
    },
    listByTeamRun(teamRunId) {
      if (!existsSync(filePath)) return [];

      return readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => executionEventSchema.parse(JSON.parse(line)))
        .filter((event) => event.teamRunId === teamRunId);
    },
  };
}

export const executionEventStore = createFileExecutionEventStore(
  join(process.cwd(), ".branchmind", "execution-events.jsonl"),
);
