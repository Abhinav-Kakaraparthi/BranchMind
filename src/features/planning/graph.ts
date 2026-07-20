import type { ProjectPlan } from "./schema";

export function validatePlanGraph(plan: ProjectPlan): void {
  const keys = plan.workstreams.map((workstream) => workstream.key);
  const uniqueKeys = new Set(keys);

  if (uniqueKeys.size !== keys.length) {
    throw new Error("The project plan contains duplicate workstream keys.");
  }

  for (const workstream of plan.workstreams) {
    if (!/^[a-z][a-z0-9-]*$/.test(workstream.key)) {
      throw new Error(`Invalid workstream key: ${workstream.key}`);
    }

    if (workstream.dependsOn.includes(workstream.key)) {
      throw new Error(`${workstream.key} cannot depend on itself.`);
    }

    for (const dependency of workstream.dependsOn) {
      if (!uniqueKeys.has(dependency)) {
        throw new Error(
          `${workstream.key} references unknown dependency ${dependency}.`,
        );
      }
    }
  }

  assertAcyclic(plan);
}

function assertAcyclic(plan: ProjectPlan): void {
  const dependencies = new Map(
    plan.workstreams.map((workstream) => [
      workstream.key,
      workstream.dependsOn,
    ]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(key: string): void {
    if (visiting.has(key)) {
      throw new Error("The project plan contains a circular dependency.");
    }

    if (visited.has(key)) {
      return;
    }

    visiting.add(key);

    for (const dependency of dependencies.get(key) ?? []) {
      visit(dependency);
    }

    visiting.delete(key);
    visited.add(key);
  }

  for (const key of dependencies.keys()) {
    visit(key);
  }
}
