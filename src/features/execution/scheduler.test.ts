import { describe, expect, it, vi } from "vitest";

import { scheduleAgentTeam } from "./scheduler";

describe("scheduleAgentTeam", () => {
  it("runs independent agents with bounded concurrency", async () => {
    let active = 0;
    let maximumActive = 0;

    const execute = vi.fn(async (task: { key: string }) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return `${task.key}-complete`;
    });

    const team = await scheduleAgentTeam(
      [
        { key: "one", dependsOn: [] },
        { key: "two", dependsOn: [] },
        { key: "three", dependsOn: [] },
        { key: "four", dependsOn: [] },
      ],
      execute,
      { concurrency: 2 },
    );

    expect(maximumActive).toBe(2);
    expect(team.results.every(
      (result) => result.status === "completed",
    )).toBe(true);
  });

  it("waits for dependencies before starting downstream agents", async () => {
    const order: string[] = [];

    await scheduleAgentTeam(
      [
        { key: "foundation", dependsOn: [] },
        { key: "integration", dependsOn: ["foundation"] },
      ],
      async (task) => {
        order.push(`start:${task.key}`);
        await Promise.resolve();
        order.push(`end:${task.key}`);
        return task.key;
      },
    );

    expect(order).toEqual([
      "start:foundation",
      "end:foundation",
      "start:integration",
      "end:integration",
    ]);
  });

  it("blocks dependents while unrelated agents continue", async () => {
    const team = await scheduleAgentTeam(
      [
        { key: "failed-foundation", dependsOn: [] },
        { key: "dependent", dependsOn: ["failed-foundation"] },
        { key: "independent", dependsOn: [] },
      ],
      async (task) => {
        if (task.key === "failed-foundation") {
          throw new Error("Quality gate failed");
        }

        return task.key;
      },
    );

    expect(team.results).toEqual([
      {
        key: "failed-foundation",
        status: "failed",
        error: "Quality gate failed",
      },
      {
        key: "dependent",
        status: "blocked",
        error:
          "Dependency failed-foundation did not complete successfully.",
      },
      {
        key: "independent",
        status: "completed",
        value: "independent",
      },
    ]);
  });

  it("rejects unknown dependencies", async () => {
    await expect(
      scheduleAgentTeam(
        [{ key: "api", dependsOn: ["missing"] }],
        async () => "done",
      ),
    ).rejects.toThrow("unknown dependency");
  });

  it("unlocks a dependent before an unrelated slow agent finishes", async () => {
    const order: string[] = [];

    await scheduleAgentTeam(
      [
        { key: "foundation", dependsOn: [] },
        { key: "slow-independent", dependsOn: [] },
        { key: "integration", dependsOn: ["foundation"] },
      ],
      async (task) => {
        order.push(`start:${task.key}`);

        const delay =
          task.key === "slow-independent" ? 40 : 5;

        await new Promise((resolve) =>
          setTimeout(resolve, delay),
        );

        order.push(`end:${task.key}`);
        return task.key;
      },
      { concurrency: 2 },
    );

    expect(
      order.indexOf("start:integration"),
    ).toBeLessThan(
      order.indexOf("end:slow-independent"),
    );
  });

  it("rejects circular dependency graphs before execution", async () => {
    const execute = vi.fn();

    await expect(
      scheduleAgentTeam(
        [
          { key: "one", dependsOn: ["two"] },
          { key: "two", dependsOn: ["one"] },
        ],
        execute,
      ),
    ).rejects.toThrow("Circular team dependency");

    expect(execute).not.toHaveBeenCalled();
  });
});
