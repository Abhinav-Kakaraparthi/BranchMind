import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type CommandResult = {
  stdout: string;
  stderr: string;
};

type WorktreeRequest = {
  branchName: string;
  baseBranch: string;
  dependencyBranches?: string[];
};

type QualityResult = {
  command: string;
  output: string;
};

let repositoryQueue = Promise.resolve();

async function withRepositoryLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const previous = repositoryQueue;
  let release!: () => void;

  repositoryQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await operation();
  } finally {
    release();
  }
}

export async function withAgentWorktree<T>(
  request: WorktreeRequest,
  operation: (workingDirectory: string) => Promise<T>,
): Promise<T> {
  assertSafeGitRef(request.branchName);
  assertSafeGitRef(request.baseBranch);

  const repositoryDirectory = process.cwd();
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "branchmind-worktree-"),
  );
  const workingDirectory = path.join(temporaryRoot, "repository");
  let worktreeCreated = false;

  try {
    await withRepositoryLock(async () => {
      await runGit(
        ["fetch", "origin", "--prune"],
        repositoryDirectory,
      );

      await runGit(
        [
          "worktree",
          "add",
          "--detach",
          workingDirectory,
          `origin/${request.branchName}`,
        ],
        repositoryDirectory,
      );
      worktreeCreated = true;
    });

    await runGit(
      ["merge", "--ff-only", `origin/${request.baseBranch}`],
      workingDirectory,
    );

    for (const dependencyBranch of request.dependencyBranches ?? []) {
      assertSafeGitRef(dependencyBranch);

      await runGit(
        [
          "merge",
          "--no-edit",
          `origin/${dependencyBranch}`,
        ],
        workingDirectory,
      );
    }

    await runNpm(
      ["ci", "--ignore-scripts"],
      workingDirectory,
    );

    return await operation(workingDirectory);
  } finally {
    if (worktreeCreated) {
      await withRepositoryLock(() =>
        runGit(
          ["worktree", "remove", "--force", workingDirectory],
          repositoryDirectory,
        ),
      ).catch(() => undefined);
    }

    await rm(temporaryRoot, {
      force: true,
      recursive: true,
    });
  }
}

export async function listChangedFiles(
  workingDirectory: string,
): Promise<string[]> {
  const result = await runGit(
    ["status", "--porcelain", "--untracked-files=all"],
    workingDirectory,
  );

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

export async function runQualityGates(
  workingDirectory: string,
): Promise<QualityResult[]> {
  const commands = ["test", "lint", "build"];
  const results: QualityResult[] = [];

  for (const command of commands) {
    const result = await runNpmScript(command, workingDirectory);
    results.push({
      command: `npm run ${command}`,
      output: `${result.stdout}\n${result.stderr}`.trim(),
    });
  }

  return results;
}

export async function commitAndPushAgentChanges(input: {
  workingDirectory: string;
  branchName: string;
  workstreamKey: string;
  workstreamName: string;
}): Promise<string> {
  assertSafeGitRef(input.branchName);

  await runGit(["add", "--all"], input.workingDirectory);

  await runGit(
    [
      "commit",
      "-m",
      `feat(${input.workstreamKey}): ${input.workstreamName}`,
    ],
    input.workingDirectory,
  );

  const commit = await runGit(
    ["rev-parse", "HEAD"],
    input.workingDirectory,
  );

  await runGit(
    [
      "push",
      "origin",
      `HEAD:refs/heads/${input.branchName}`,
    ],
    input.workingDirectory,
  );

  return commit.stdout.trim();
}

export function assertSafeGitRef(value: string): void {
  const safePattern =
    /^(?!\/)(?!.*(?:\.\.|\/\/|@\{|\\))[\w./-]+(?<![/.])$/;

  if (
    !value ||
    value.length > 200 ||
    !safePattern.test(value)
  ) {
    throw new Error(`Unsafe Git reference: ${value}`);
  }
}

export function runGit(
  arguments_: readonly string[],
  workingDirectory: string,
): Promise<CommandResult> {
  return runProcess({
    windowsCommand: "C:\\Program Files\\Git\\cmd\\git.exe",
    unixCommand: "/usr/bin/env",
    arguments_:
      process.platform === "win32"
        ? arguments_
        : ["git", ...arguments_],
    workingDirectory,
  });
}

function runNpmScript(
  script: string,
  workingDirectory: string,
): Promise<CommandResult> {
  return runNpm(
    ["run", script],
    workingDirectory,
    {
      NODE_ENV: script === "test" ? "test" : "production",
    },
  );
}

function runNpm(
  arguments_: readonly string[],
  workingDirectory: string,
  environment?: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  const npmExecutable = process.env.npm_execpath;

  if (!npmExecutable) {
    throw new Error(
      "npm_execpath is unavailable. Start BranchMind with npm run dev.",
    );
  }

  return runProcess({
    windowsCommand: process.execPath,
    unixCommand: process.execPath,
    arguments_: [npmExecutable, ...arguments_],
    workingDirectory,
    environment,
  });
}

function runProcess(input: {
  windowsCommand: string;
  unixCommand: string;
  arguments_: readonly string[];
  workingDirectory: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<CommandResult> {
  const command =
    process.platform === "win32"
      ? input.windowsCommand
      : input.unixCommand;

  return new Promise((resolve, reject) => {
    const child = spawn(command, input.arguments_, {
      cwd: input.workingDirectory,
      env: {
        ...process.env,
        ...input.environment,
        NO_COLOR: "1",
      },
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.once("error", () => {
      reject(
        new Error(`Could not start ${path.basename(command)}.`),
      );
    });

    child.once("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          sanitizeCommandError(
            `${path.basename(command)} exited with code ${
              code ?? "unknown"
            }.\n${stderr || stdout}`,
          ),
        ),
      );
    });
  });
}

function sanitizeCommandError(value: string): string {
  return value
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+)\b/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .trim()
    .slice(0, 2000);
}
