import {
  GitHubCliAdapter,
  type ProvisionBranchResult,
} from "./github-cli";
import {
  branchNameFor,
  type WorkspaceRequest,
} from "./schema";

export type WorkspaceBranch = ProvisionBranchResult & {
  workstreamKey: string;
  workstreamName: string;
};

export type ProvisionedWorkspace = {
  repository: string;
  baseBranch: string;
  baseSha: string;
  branches: WorkspaceBranch[];
};

export type WorkspaceGitHubAdapter = Pick<
  GitHubCliAdapter,
  "resolveBaseSha" | "provisionBranch"
>;

export async function provisionWorkspace(
  request: WorkspaceRequest,
  github: WorkspaceGitHubAdapter = new GitHubCliAdapter(),
): Promise<ProvisionedWorkspace> {
  const baseSha = await github.resolveBaseSha(
    request.repository,
    request.baseBranch,
  );

  const branches = await Promise.all(
    request.workstreams.map(async (workstream) => {
      const branchName = branchNameFor(workstream.key);
      const result = await github.provisionBranch(
        request.repository,
        branchName,
        baseSha,
      );

      return {
        workstreamKey: workstream.key,
        workstreamName: workstream.name,
        ...result,
      };
    }),
  );

  return {
    repository: request.repository,
    baseBranch: request.baseBranch,
    baseSha,
    branches,
  };
}
