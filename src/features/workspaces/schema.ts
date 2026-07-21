import { z } from "zod";

const repositoryPattern =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;

const workstreamKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const branchComponentPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const baseBranchPattern = /^(?!\/)(?!.*(?:\.\.|\/\/|@\{|\\))[\w./-]+(?<![/.])$/;

export const workspaceWorkstreamSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(80)
    .regex(workstreamKeyPattern, "Workstream keys must be lowercase hyphenated values."),
  name: z.string().trim().min(1).max(120),
});

export const workspaceRequestSchema = z
  .object({
    repository: z
      .string()
      .trim()
      .regex(repositoryPattern, "Repository must use the owner/repository format."),
    baseBranch: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(baseBranchPattern, "Base branch contains unsafe characters.")
      .default("main"),
    workstreams: z.array(workspaceWorkstreamSchema).min(1).max(8),
  })
  .superRefine(({ workstreams }, context) => {
    const seen = new Set<string>();

    workstreams.forEach((workstream, index) => {
      if (seen.has(workstream.key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate workstream key: ${workstream.key}`,
          path: ["workstreams", index, "key"],
        });
      }

      seen.add(workstream.key);
    });
  });

export type WorkspaceRequest = z.infer<typeof workspaceRequestSchema>;
export type WorkspaceWorkstream = z.infer<typeof workspaceWorkstreamSchema>;

export function branchNameFor(workstreamKey: string): string {
  if (!branchComponentPattern.test(workstreamKey)) {
    throw new Error("Cannot create a branch from an unsafe workstream key.");
  }

  return `agent/${workstreamKey}`;
}
