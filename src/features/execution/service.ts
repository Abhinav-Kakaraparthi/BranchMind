import { randomUUID } from "node:crypto";

import {
  buildAgentPrompt,
  runCodingAgent,
  type AgentRunResult,
} from "./codex-agent";
import {
  commitAndPushAgentChanges,
  listChangedFiles,
  runGit,
  runQualityGates,
  withAgentWorktree,
} from "./git-worktree";
import type { ExecutionRequest } from "./schema";
import { runGitHubCli } from "../workspaces/github-cli";

export type ExecutionStage =
  | "preparing"
  | "implementing"
  | "validating"
  | "committing"
  | "opening_pull_request"
  | "completed";

export type ExecutionEvent = {
  stage: ExecutionStage;
  status: "completed";
  timestamp: string;
};

export type ExecutionResult = {
  runId: string;
  repository: string;
  workstreamKey: string;
  branchName: string;
  changedFiles: string[];
  commitSha: string;
  pullRequestUrl: string;
  agentSummary: string;
  qualityGates: Array<{
    command: string;
    passed: true;
  }>;
  events: ExecutionEvent[];
};

type WorktreeRunner = <T>(
  request: {
    branchName: string;
    baseBranch: string;
    dependencyBranches?: string[];
  },
  operation: (workingDirectory: string) => Promise<T>,
) => Promise<T>;

export type ExecutionDependencies = {
  withWorktree: WorktreeRunner;
  runAgent: typeof runCodingAgent;
  changedFiles: typeof listChangedFiles;
  qualityGates: typeof runQualityGates;
  commitAndPush: typeof commitAndPushAgentChanges;
  openPullRequest: typeof createOrFindPullRequest;
  verifyRepository: typeof verifyLocalRepository;
  now: () => string;
};

const defaultDependencies: ExecutionDependencies = {
  withWorktree: withAgentWorktree,
  runAgent: runCodingAgent,
  changedFiles: listChangedFiles,
  qualityGates: runQualityGates,
  commitAndPush: commitAndPushAgentChanges,
  openPullRequest: createOrFindPullRequest,
  verifyRepository: verifyLocalRepository,
  now: () => new Date().toISOString(),
};

export async function executeWorkstream(
  request: ExecutionRequest,
  dependencies: ExecutionDependencies = defaultDependencies,
): Promise<ExecutionResult> {
  await dependencies.verifyRepository(request.repository);

  const runId = randomUUID();
  const events: ExecutionEvent[] = [];

  function record(stage: ExecutionStage) {
    events.push({
      stage,
      status: "completed",
      timestamp: dependencies.now(),
    });
  }

  record("preparing");

  return dependencies.withWorktree(
    {
      branchName: request.branchName,
      baseBranch: request.baseBranch,
      dependencyBranches:
        request.contextPackage.dependencies.map(
          (dependency) => `agent/${dependency.key}`,
        ),
    },
    async (workingDirectory) => {
      record("implementing");

      const agent = await dependencies.runAgent({
        prompt: buildAgentPrompt({
          repository: request.repository,
          branchName: request.branchName,
          contextPackage: request.contextPackage,
        }),
        workingDirectory,
        reasoningEffort: "medium",
      });

      const changedFiles =
        await dependencies.changedFiles(workingDirectory);

      if (!changedFiles.length) {
        throw new Error(
          "The specialist agent completed without changing any files.",
        );
      }

      record("validating");
      const qualityResults =
        await dependencies.qualityGates(workingDirectory);

      record("committing");
      const commitSha = await dependencies.commitAndPush({
        workingDirectory,
        branchName: request.branchName,
        workstreamKey: request.workstream.key,
        workstreamName: request.workstream.name,
      });

      record("opening_pull_request");
      const pullRequestUrl = await dependencies.openPullRequest({
        repository: request.repository,
        baseBranch: request.baseBranch,
        branchName: request.branchName,
        workstreamName: request.workstream.name,
        contextFingerprint: request.contextPackage.fingerprint,
        changedFiles,
        agent,
        qualityCommands: qualityResults.map(
          (result) => result.command,
        ),
      });

      record("completed");

      return {
        runId,
        repository: request.repository,
        workstreamKey: request.workstream.key,
        branchName: request.branchName,
        changedFiles,
        commitSha,
        pullRequestUrl,
        agentSummary: agent.summary,
        qualityGates: qualityResults.map((result) => ({
          command: result.command,
          passed: true as const,
        })),
        events,
      };
    },
  );
}

async function verifyLocalRepository(
  repository: string,
): Promise<void> {
  const remote = await runGit(
    ["remote", "get-url", "origin"],
    process.cwd(),
  );

  const normalized = normalizeGitHubRepository(remote.stdout);

  if (normalized.toLowerCase() !== repository.toLowerCase()) {
    throw new Error(
      `The running BranchMind workspace is connected to ${normalized}, not ${repository}.`,
    );
  }
}

function normalizeGitHubRepository(remote: string): string {
  const value = remote.trim().replace(/\.git$/, "");
  const httpsMatch =
    /^https:\/\/github\.com\/([^/]+\/[^/]+)$/i.exec(value);
  const sshMatch =
    /^git@github\.com:([^/]+\/[^/]+)$/i.exec(value);

  const match = httpsMatch ?? sshMatch;

  if (!match) {
    throw new Error(
      "The local origin is not a supported GitHub repository.",
    );
  }

  return match[1];
}

async function createOrFindPullRequest(input: {
  repository: string;
  baseBranch: string;
  branchName: string;
  workstreamName: string;
  contextFingerprint: string;
  changedFiles: string[];
  agent: AgentRunResult;
  qualityCommands: string[];
}): Promise<string> {
  try {
    const existing = await runGitHubCli([
      "pr",
      "view",
      input.branchName,
      "--repo",
      input.repository,
      "--json",
      "url",
      "--jq",
      ".url",
    ]);

    const url = existing.stdout.trim();
    if (url) return url;
  } catch {
    // No pull request exists for this branch yet.
  }

  const body = `## BranchMind specialist execution

**Workstream:** ${input.workstreamName}
**Context fingerprint:** \`${input.contextFingerprint}\`

### Changed files

${input.changedFiles.map((file) => `- \`${file}\``).join("\n")}

### Authoritative BranchMind quality gates

${input.qualityCommands.map((command) => `- [x] \`${command}\``).join("\n")}

### Specialist agent notes (before orchestration gates)

${input.agent.summary.slice(0, 4000)}

---
Created by BranchMind from a focused specialist context package.`;

  const created = await runGitHubCli([
    "pr",
    "create",
    "--repo",
    input.repository,
    "--base",
    input.baseBranch,
    "--head",
    input.branchName,
    "--title",
    `feat: ${input.workstreamName}`,
    "--body",
    body,
  ]);

  const url = created.stdout
    .trim()
    .split(/\r?\n/)
    .find((line) => /^https:\/\/github\.com\//.test(line));

  if (!url) {
    throw new Error(
      "GitHub CLI created the pull request without returning its URL.",
    );
  }

  return url;
}
