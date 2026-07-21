import { z } from "zod";

export const contributorIdeaSnapshotSchema = z.object({
  ideaId: z.string().regex(/^idea-\d+$/),
  contributorId: z.string().regex(/^human-\d+$/),
  contributorName: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(4000),
  status: z.enum(["proposed", "accepted", "blended"]),
});

export const planRequestSchema = z.object({
  goal: z
    .string()
    .trim()
    .min(20, "Describe the product goal in at least 20 characters.")
    .max(4000, "Keep the product goal below 4,000 characters."),
  repository: z.string().trim().max(200).optional(),
  contributorIdeas: z.array(contributorIdeaSnapshotSchema).max(100).default([]),
});

export const workstreamSchema = z.object({
  key: z
    .string()
    .describe("Short lowercase identifier using hyphens, such as api-auth"),
  name: z.string().describe("Human-readable workstream name"),
  objective: z.string().describe("One precise outcome owned by this workstream"),
  deliverables: z
    .array(z.string())
    .min(1)
    .describe("Concrete artifacts this workstream must produce"),
  acceptanceCriteria: z
    .array(z.string())
    .min(1)
    .describe("Observable conditions required for completion"),
  contextNeeds: z
    .array(z.string())
    .describe("Project information this specialist needs"),
  dependsOn: z
    .array(z.string())
    .describe("Keys of workstreams that must finish first"),
});

export const projectPlanSchema = z.object({
  projectName: z.string(),
  summary: z.string(),
  workstreams: z.array(workstreamSchema).min(2).max(6),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;
export type ProjectPlan = z.infer<typeof projectPlanSchema>;
