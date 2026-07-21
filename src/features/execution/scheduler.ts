export type TeamStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export type TeamTask = {
  key: string;
  dependsOn: string[];
};

export type TeamTaskResult<T> = {
  key: string;
  status: Exclude<TeamStatus, "queued" | "running">;
  value?: T;
  error?: string;
};

export type TeamEvent = {
  key: string;
  status: TeamStatus;
  timestamp: string;
};

type SchedulerOptions = {
  concurrency?: number;
  now?: () => string;
  onEvent?: (event: TeamEvent) => void;
};

export async function scheduleAgentTeam<T>(
  tasks: TeamTask[],
  execute: (task: TeamTask) => Promise<T>,
  options: SchedulerOptions = {},
): Promise<{
  results: TeamTaskResult<T>[];
  events: TeamEvent[];
}> {
  const concurrency = options.concurrency ?? 3;

  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 8
  ) {
    throw new Error(
      "Concurrency must be an integer between 1 and 8.",
    );
  }

  validateTasks(tasks);

  const now = options.now ?? (() => new Date().toISOString());
  const events: TeamEvent[] = [];
  const pending = new Map(
    tasks.map((task) => [task.key, task]),
  );
  const active = new Map<
    string,
    Promise<TeamTaskResult<T>>
  >();
  const results = new Map<string, TeamTaskResult<T>>();

  function record(key: string, status: TeamStatus) {
    const event = {
      key,
      status,
      timestamp: now(),
    };

    events.push(event);
    options.onEvent?.(event);
  }

  function start(task: TeamTask) {
    pending.delete(task.key);
    record(task.key, "running");

    const promise = execute(task)
      .then((value) => {
        record(task.key, "completed");

        return {
          key: task.key,
          status: "completed" as const,
          value,
        };
      })
      .catch((error: unknown) => {
        record(task.key, "failed");

        return {
          key: task.key,
          status: "failed" as const,
          error:
            error instanceof Error
              ? error.message
              : "Agent execution failed.",
        };
      });

    active.set(task.key, promise);
  }

  tasks.forEach((task) => record(task.key, "queued"));

  while (pending.size || active.size) {
    for (const task of [...pending.values()]) {
      const failedDependency = task.dependsOn.find(
        (dependency) => {
          const result = results.get(dependency);

          return (
            result?.status === "failed" ||
            result?.status === "blocked"
          );
        },
      );

      if (failedDependency) {
        pending.delete(task.key);

        results.set(task.key, {
          key: task.key,
          status: "blocked",
          error:
            `Dependency ${failedDependency} ` +
            "did not complete successfully.",
        });

        record(task.key, "blocked");
      }
    }

    while (active.size < concurrency) {
      const ready = [...pending.values()].find((task) =>
        task.dependsOn.every(
          (dependency) =>
            results.get(dependency)?.status === "completed",
        ),
      );

      if (!ready) break;
      start(ready);
    }

    if (!active.size) {
      for (const task of pending.values()) {
        results.set(task.key, {
          key: task.key,
          status: "blocked",
          error: "No executable dependency path remains.",
        });

        record(task.key, "blocked");
      }

      pending.clear();
      break;
    }

    const completed = await Promise.race(active.values());
    active.delete(completed.key);
    results.set(completed.key, completed);
  }

  return {
    results: tasks.map((task) => {
      const result = results.get(task.key);

      if (!result) {
        throw new Error(
          `Missing scheduler result for ${task.key}.`,
        );
      }

      return result;
    }),
    events,
  };
}

function validateTasks(tasks: TeamTask[]) {
  const tasksByKey = new Map<string, TeamTask>();

  for (const task of tasks) {
    if (tasksByKey.has(task.key)) {
      throw new Error(`Duplicate team task: ${task.key}`);
    }

    tasksByKey.set(task.key, task);
  }

  for (const task of tasks) {
    for (const dependency of task.dependsOn) {
      if (!tasksByKey.has(dependency)) {
        throw new Error(
          `${task.key} references unknown dependency ${dependency}.`,
        );
      }

      if (dependency === task.key) {
        throw new Error(`${task.key} cannot depend on itself.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(key: string) {
    if (visiting.has(key)) {
      throw new Error(
        `Circular team dependency detected at ${key}.`,
      );
    }

    if (visited.has(key)) return;

    visiting.add(key);

    for (const dependency of tasksByKey.get(key)?.dependsOn ?? []) {
      visit(dependency);
    }

    visiting.delete(key);
    visited.add(key);
  }

  tasks.forEach((task) => visit(task.key));
}
