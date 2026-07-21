import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  executeProcess,
  resolveCodexInvocation,
} from "../../lib/codex";

type AgentRunRequest = {
  prompt: string;
  workingDirectory: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
};

export type AgentRunResult = {
  summary: string;
  diagnostics: string;
};

export async function runCodingAgent({
  prompt,
  workingDirectory,
  model = "gpt-5.6-terra",
  reasoningEffort = "medium",
}: AgentRunRequest): Promise<AgentRunResult> {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "branchmind-agent-"),
  );
  const outputPath = path.join(temporaryDirectory, "agent-summary.txt");

  try {
    const invocation = resolveCodexInvocation();
    const argumentsList = [
      ...invocation.prefixArguments,
      "exec",
      "--model",
      model,
      "--sandbox",
      "workspace-write",
      "--ephemeral",
      "--color",
      "never",
      "-c",
      `model_reasoning_effort="${reasoningEffort}"`,
      "--output-last-message",
      outputPath,
      "-",
    ];

    const diagnostics = await executeProcess(
      invocation.command,
      argumentsList,
      prompt,
      workingDirectory,
    );

    const summary = await readFile(outputPath, "utf8").catch(() => {
      throw new Error(
        "The coding agent completed without returning an execution summary.",
      );
    });

    return {
      summary: sanitizeAgentSummary(
        summary,
        workingDirectory,
      ),
      diagnostics,
    };
  } finally {
    await rm(temporaryDirectory, {
      force: true,
      recursive: true,
    });
  }
}

export function buildAgentPrompt(input: {
  repository: string;
  branchName: string;
  contextPackage: {
    workstreamKey: string;
    project: {
      name: string;
      summary: string;
    };
    assignment: {
      objective: string;
      deliverables: string[];
      acceptanceCriteria: string[];
      contextNeeds: string[];
    };
    dependencies: Array<{
      key: string;
      name: string;
      objective: string;
      deliverables: string[];
    }>;
    excludedWorkstreams: string[];
    fingerprint: string;
  };
}): string {
  return `You are the specialist implementation agent for one BranchMind workstream.

Repository: ${input.repository}
Isolated branch: ${input.branchName}
Context fingerprint: ${input.contextPackage.fingerprint}

Project:
${input.contextPackage.project.name}

Project summary:
${input.contextPackage.project.summary}

Your focused objective:
${input.contextPackage.assignment.objective}

Deliverables:
${formatList(input.contextPackage.assignment.deliverables)}

Acceptance criteria:
${formatList(input.contextPackage.assignment.acceptanceCriteria)}

Context needs:
${formatList(input.contextPackage.assignment.contextNeeds)}

Direct dependency contracts:
${formatDependencies(input.contextPackage.dependencies)}

Explicitly excluded workstreams:
${formatList(input.contextPackage.excludedWorkstreams)}

Execution rules:
- Read AGENTS.md and the relevant local framework documentation before editing.
- Work only inside the current isolated worktree.
- Implement the smallest coherent change that satisfies this focused assignment.
- Do not implement excluded workstreams.
- Do not run git commit, git push, gh, or create a pull request.
- Do not modify secrets, authentication files, or environment files.
- Keep every source file below 500 lines.
- Add or update focused tests for the behavior you implement.
- Preserve existing architecture and avoid unnecessary dependencies.
- Finish with a concise summary of files changed, tests added, and limitations.
`;
}

function formatList(items: string[]): string {
  return items.length
    ? items.map((item) => `- ${item}`).join("\n")
    : "- None";
}

function formatDependencies(
  dependencies: Array<{
    key: string;
    name: string;
    objective: string;
    deliverables: string[];
  }>,
): string {
  if (!dependencies.length) return "- None";

  return dependencies
    .map(
      (dependency) =>
        `- ${dependency.key} (${dependency.name}): ${dependency.objective}
  Expected outputs: ${dependency.deliverables.join("; ")}`,
    )
    .join("\n");
}
function sanitizeAgentSummary(
  summary: string,
  workingDirectory: string,
): string {
  const normalizedDirectory = workingDirectory.replaceAll(
    "\\",
    "/",
  );

  return summary
    .trim()
    .replaceAll(workingDirectory, "[isolated-worktree]")
    .replaceAll(normalizedDirectory, "[isolated-worktree]");
}
