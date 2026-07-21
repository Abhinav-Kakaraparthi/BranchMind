"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  GitBranchIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

type WorkspaceLaunchProps = {
  repository: string;
  workstream: {
    key: string;
    name: string;
  };
};

type LaunchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "created" | "existing"; branchName: string }
  | { status: "error"; message: string };

type WorkspaceResponse = {
  workspace?: {
    branches: Array<{
      branchName: string;
      status: "created" | "existing";
    }>;
  };
  error?: string;
};

export function WorkspaceLaunch({
  repository,
  workstream,
}: WorkspaceLaunchProps) {
  const [state, setState] = useState<LaunchState>({ status: "idle" });

  async function launchWorkspace() {
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository,
          baseBranch: "main",
          workstreams: [
            {
              key: workstream.key,
              name: workstream.name,
            },
          ],
        }),
      });

      const data = (await response.json()) as WorkspaceResponse;
      const branch = data.workspace?.branches[0];

      if (!response.ok || !branch) {
        throw new Error(
          data.error ?? "BranchMind could not provision the workspace.",
        );
      }

      setState({
        status: branch.status,
        branchName: branch.branchName,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "BranchMind could not provision the workspace.",
      });
    }
  }

  const completed =
    state.status === "created" || state.status === "existing";

  return (
    <div className={`workspace-launch ${completed ? "complete" : ""}`}>
      <div>
        <span className="workspace-launch-label">
          {completed ? (
            <CheckCircleIcon size={16} weight="fill" />
          ) : (
            <GitBranchIcon size={16} />
          )}
          Isolated GitHub workspace
        </span>

        {completed ? (
          <strong className="workspace-branch-name">
            {state.branchName}
          </strong>
        ) : (
          <p>Create a dedicated branch from main for this agent.</p>
        )}
      </div>

      <button
        disabled={state.status === "loading" || completed}
        onClick={launchWorkspace}
        type="button"
      >
        {state.status === "loading" ? (
          <>
            <SpinnerGapIcon className="spinner" size={17} />
            Provisioning
          </>
        ) : completed ? (
          state.status === "created" ? "Branch created" : "Branch ready"
        ) : state.status === "error" ? (
          "Retry provisioning"
        ) : (
          "Create isolated branch"
        )}
      </button>

      {state.status === "error" ? (
        <p className="workspace-launch-error" role="alert">
          <WarningCircleIcon size={16} weight="fill" />
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
