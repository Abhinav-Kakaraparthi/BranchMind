import { describe, expect, it, vi } from "vitest";

import {
  GitHubCliAdapter,
  GitHubCliError,
  type GitHubCommandRunner,
} from "./github-cli";

const baseSha = "a".repeat(40);

describe("GitHubCliAdapter", () => {
  it("resolves the configured base branch SHA", async () => {
    const run = vi.fn<GitHubCommandRunner>().mockResolvedValue({
      stdout: `${baseSha}\n`,
      stderr: "",
    });

    const adapter = new GitHubCliAdapter(run);

    await expect(
      adapter.resolveBaseSha("acme/product", "main"),
    ).resolves.toBe(baseSha);

    expect(run).toHaveBeenCalledWith([
      "api",
      "repos/acme/product/git/ref/heads/main",
      "--jq",
      ".object.sha",
    ]);
  });

  it("rejects an invalid SHA returned by GitHub", async () => {
    const run = vi.fn<GitHubCommandRunner>().mockResolvedValue({
      stdout: "not-a-sha",
      stderr: "",
    });

    await expect(
      new GitHubCliAdapter(run).resolveBaseSha("acme/product", "main"),
    ).rejects.toThrow("invalid base branch SHA");
  });

  it("reports an existing branch without creating it", async () => {
    const run = vi.fn<GitHubCommandRunner>().mockResolvedValue({
      stdout: "",
      stderr: "",
    });

    const result = await new GitHubCliAdapter(run).provisionBranch(
      "acme/product",
      "agent/context-compiler",
      baseSha,
    );

    expect(result.status).toBe("existing");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("creates a branch when GitHub reports it missing", async () => {
    const run = vi
      .fn<GitHubCommandRunner>()
      .mockRejectedValueOnce(new GitHubCliError("HTTP 404: Not Found"))
      .mockResolvedValueOnce({ stdout: "", stderr: "" });

    const result = await new GitHubCliAdapter(run).provisionBranch(
      "acme/product",
      "agent/context-compiler",
      baseSha,
    );

    expect(result).toEqual({
      branchName: "agent/context-compiler",
      status: "created",
    });

    expect(run).toHaveBeenLastCalledWith([
      "api",
      "--method",
      "POST",
      "repos/acme/product/git/refs",
      "-f",
      "ref=refs/heads/agent/context-compiler",
      "-f",
      `sha=${baseSha}`,
      "--silent",
    ]);
  });

  it("handles a concurrent branch creation as existing", async () => {
    const run = vi
      .fn<GitHubCommandRunner>()
      .mockRejectedValueOnce(new GitHubCliError("HTTP 404: Not Found"))
      .mockRejectedValueOnce(
        new GitHubCliError("HTTP 422: Reference already exists"),
      );

    await expect(
      new GitHubCliAdapter(run).provisionBranch(
        "acme/product",
        "agent/context-compiler",
        baseSha,
      ),
    ).resolves.toEqual({
      branchName: "agent/context-compiler",
      status: "existing",
    });
  });

  it("propagates authentication and permission failures", async () => {
    const run = vi
      .fn<GitHubCommandRunner>()
      .mockRejectedValue(new GitHubCliError("HTTP 403: Forbidden"));

    await expect(
      new GitHubCliAdapter(run).provisionBranch(
        "acme/product",
        "agent/context-compiler",
        baseSha,
      ),
    ).rejects.toThrow("HTTP 403");
  });
});
