import { describe, expect, it, vi } from "vitest";

import type { WorkspaceGitHubAdapter } from "./service";
import { provisionWorkspace } from "./service";

const baseSha = "b".repeat(40);

const request = {
  repository: "acme/product",
  baseBranch: "main",
  workstreams: [
    { key: "context-compiler", name: "Context Compiler" },
    { key: "github-orchestration", name: "GitHub Orchestration" },
  ],
};

describe("provisionWorkspace", () => {
  it("creates one isolated branch for every workstream", async () => {
    const github: WorkspaceGitHubAdapter = {
      resolveBaseSha: vi.fn().mockResolvedValue(baseSha),
      provisionBranch: vi
        .fn()
        .mockResolvedValueOnce({
          branchName: "agent/context-compiler",
          status: "created",
        })
        .mockResolvedValueOnce({
          branchName: "agent/github-orchestration",
          status: "existing",
        }),
    };

    const workspace = await provisionWorkspace(request, github);

    expect(workspace).toEqual({
      repository: "acme/product",
      baseBranch: "main",
      baseSha,
      branches: [
        {
          workstreamKey: "context-compiler",
          workstreamName: "Context Compiler",
          branchName: "agent/context-compiler",
          status: "created",
        },
        {
          workstreamKey: "github-orchestration",
          workstreamName: "GitHub Orchestration",
          branchName: "agent/github-orchestration",
          status: "existing",
        },
      ],
    });

    expect(github.resolveBaseSha).toHaveBeenCalledOnce();
    expect(github.provisionBranch).toHaveBeenCalledTimes(2);
  });

  it("does not create branches when the base branch cannot be resolved", async () => {
    const github: WorkspaceGitHubAdapter = {
      resolveBaseSha: vi.fn().mockRejectedValue(new Error("Base branch missing")),
      provisionBranch: vi.fn(),
    };

    await expect(provisionWorkspace(request, github)).rejects.toThrow(
      "Base branch missing",
    );

    expect(github.provisionBranch).not.toHaveBeenCalled();
  });

  it("propagates branch provisioning failures", async () => {
    const github: WorkspaceGitHubAdapter = {
      resolveBaseSha: vi.fn().mockResolvedValue(baseSha),
      provisionBranch: vi.fn().mockRejectedValue(new Error("Forbidden")),
    };

    await expect(provisionWorkspace(request, github)).rejects.toThrow(
      "Forbidden",
    );
  });
});
