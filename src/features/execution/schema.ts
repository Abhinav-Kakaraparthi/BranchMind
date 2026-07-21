import { z } from "zod";

const safeRefPattern =
  /^(?!\/)(?!.*(?:\.\.|\/\/|@\{|\\))[\w./-]+(?<![/.])$/;

const dependencySchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  objective: z.string().min(1).max(2000),
  deliverables: z.array(z.string().min(1).max(1000)).max(12),
});

export const executionRequestSchema = z.object({
  repository: z
    .string()
    .regex(
      /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/,
      "Repository must use owner/repository format.",
    ),
  baseBranch: z
    .string()
    .min(1)
    .max(200)
    .regex(safeRefPattern),
  branchName: z
    .string()
    .min(1)
    .max(200)
    .regex(/^agent\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  workstream: z.object({
    key: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1).max(120),
  }),
  contextPackage: z.object({
    workstreamKey: z.string().min(1).max(80),
    project: z.object({
      name: z.string().min(1).max(200),
      summary: z.string().min(1).max(4000),
    }),
    assignment: z.object({
      objective: z.string().min(1).max(4000),
      deliverables: z.array(z.string().min(1).max(1000)).max(12),
      acceptanceCriteria: z.array(z.string().min(1).max(1000)).max(12),
      contextNeeds: z.array(z.string().min(1).max(1000)).max(12),
    }),
    dependencies: z.array(dependencySchema).max(8),
    excludedWorkstreams: z.array(z.string().min(1).max(80)).max(8),
    fingerprint: z.string().regex(/^[a-f0-9]{16}$/),
  }),
}).superRefine((request, context) => {
  if (request.contextPackage.workstreamKey !== request.workstream.key) {
    context.addIssue({
      code: "custom",
      message: "Context package does not belong to the selected workstream.",
      path: ["contextPackage", "workstreamKey"],
    });
  }

  if (request.branchName !== `agent/${request.workstream.key}`) {
    context.addIssue({
      code: "custom",
      message: "Branch name does not match the selected workstream.",
      path: ["branchName"],
    });
  }
});

export type ExecutionRequest = z.infer<
  typeof executionRequestSchema
>;
