import { spawn } from "node:child_process";

export type GitHubCommandResult = {
  stdout: string;
  stderr: string;
};

export type GitHubCommandRunner = (
  arguments_: readonly string[],
) => Promise<GitHubCommandResult>;

export type ProvisionBranchResult = {
  branchName: string;
  status: "created" | "existing";
};

export class GitHubCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubCliError";
  }
}

export class GitHubCliAdapter {
  constructor(private readonly run: GitHubCommandRunner = runGitHubCli) {}

  async resolveBaseSha(repository: string, baseBranch: string): Promise<string> {
    const reference = encodeURIComponent(baseBranch);
    const { stdout } = await this.run([
      "api",
      `repos/${repository}/git/ref/heads/${reference}`,
      "--jq",
      ".object.sha",
    ]);

    const sha = stdout.trim();

    if (!/^[a-f0-9]{40}$/i.test(sha)) {
      throw new GitHubCliError("GitHub returned an invalid base branch SHA.");
    }

    return sha;
  }

  async provisionBranch(
    repository: string,
    branchName: string,
    baseSha: string,
  ): Promise<ProvisionBranchResult> {
    const reference = encodeURIComponent(branchName);

    try {
      await this.run([
        "api",
        `repos/${repository}/git/ref/heads/${reference}`,
        "--silent",
      ]);

      return { branchName, status: "existing" };
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }

    try {
      await this.run([
        "api",
        "--method",
        "POST",
        `repos/${repository}/git/refs`,
        "-f",
        `ref=refs/heads/${branchName}`,
        "-f",
        `sha=${baseSha}`,
        "--silent",
      ]);

      return { branchName, status: "created" };
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        return { branchName, status: "existing" };
      }

      throw error;
    }
  }
}

export function runGitHubCli(
  arguments_: readonly string[],
): Promise<GitHubCommandResult> {
  const executable =
    process.env.BRANCHMIND_GH_PATH ??
    (process.platform === "win32"
      ? "C:\\Program Files\\GitHub CLI\\gh.exe"
      : "gh");

  return new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      shell: false,
      windowsHide: true,
      env: process.env,
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

    child.on("error", () => {
      reject(
        new GitHubCliError(
          "GitHub CLI could not be started. Install gh and authenticate with gh auth login.",
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const safeDetail = sanitizeGitHubError(stderr);
      reject(
        new GitHubCliError(
          safeDetail
            ? `GitHub CLI request failed: ${safeDetail}`
            : "GitHub CLI request failed.",
        ),
      );
    });
  });
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(HTTP 404|not found)/i.test(error.message)
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(HTTP 422|reference already exists|already exists)/i.test(error.message)
  );
}

function sanitizeGitHubError(value: string): string {
  return value
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+)\b/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .trim()
    .slice(0, 500);
}
