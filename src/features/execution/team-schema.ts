import { z } from "zod";

import { executionRequestSchema } from "./schema";

export const teamExecutionRequestSchema = z
  .object({
    concurrency: z.number().int().min(1).max(3).default(3),
    executions: z.array(executionRequestSchema).min(1).max(6),
  })
  .superRefine(({ executions }, context) => {
    const keys = new Set<string>();
    const repositories = new Set(
      executions.map((execution) =>
        execution.repository.toLowerCase(),
      ),
    );
    const baseBranches = new Set(
      executions.map((execution) => execution.baseBranch),
    );

    executions.forEach((execution, index) => {
      const key = execution.workstream.key;

      if (keys.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate team workstream: ${key}`,
          path: ["executions", index, "workstream", "key"],
        });
      }

      keys.add(key);
    });

    executions.forEach((execution, index) => {
      execution.contextPackage.dependencies.forEach(
        (dependency) => {
          if (!keys.has(dependency.key)) {
            context.addIssue({
              code: "custom",
              message:
                `${execution.workstream.key} requires missing ` +
                `team dependency ${dependency.key}.`,
              path: [
                "executions",
                index,
                "contextPackage",
                "dependencies",
              ],
            });
          }
        },
      );
    });

    if (repositories.size > 1) {
      context.addIssue({
        code: "custom",
        message: "Every team agent must target the same repository.",
        path: ["executions"],
      });
    }

    if (baseBranches.size > 1) {
      context.addIssue({
        code: "custom",
        message: "Every team agent must share the same base branch.",
        path: ["executions"],
      });
    }
  });

export type TeamExecutionRequest = z.infer<
  typeof teamExecutionRequestSchema
>;
