"use client";

import { useState } from "react";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  GitBranchIcon,
  RobotIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import type { ContextPackage } from "../context/compiler";

type WorkspaceLaunchProps = {
  repository: string;
  contextPackage?: ContextPackage;
  workstream: {
    key: string;
    name: string;
  };
};

type ExecutionResult = {
  runId: string;
  branchName: string;
  changedFiles: string[];
  commitSha: string;
  pullRequestUrl: string;
  agentSummary: string;
  qualityGates: Array<{
    command: string;
    passed: true;
  }>;
};

type LaunchState =
  | { status: "idle" }
  | { status: "provisioning" }
  | {
      status: "ready";
      branchName: string;
      branchStatus: "created" | "existing";
    }
  | {
      status: "executing";
      branchName: string;
    }
  | {
      status: "completed";
      execution: ExecutionResult;
    }
  | {
      status: "error";
      message: string;
      branchName?: string;
    };

type WorkspaceResponse = {
  workspace?: {
    branches: Array<{
      branchName: string;
      status: "created" | "existing";
    }>;
  };
  error?: string;
};

type ExecutionResponse = {
  execution?: ExecutionResult;
  error?: string;
};

export function WorkspaceLaunch({
  repository,
  contextPackage,
  workstream,
}: WorkspaceLaunchProps) {
  const [state, setState] = useState<LaunchState>({
    status: "idle",
  });

  async function provisionWorkspace() {
    setState({ status: "provisioning" });

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
        status: "ready",
        branchName: branch.branchName,
        branchStatus: branch.status,
      });
    } catch (error) {
      setState({
        status: "error",
        message: errorMessage(error),
      });
    }
  }

  async function executeAgent(branchName: string) {
    if (!contextPackage) {
      setState({
        status: "error",
        branchName,
        message: "The focused context package is unavailable.",
      });
      return;
    }

    setState({
      status: "executing",
      branchName,
    });

    try {
      const response = await fetch("/api/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository,
          baseBranch: "main",
          branchName,
          workstream: {
            key: workstream.key,
            name: workstream.name,
          },
          contextPackage,
        }),
      });

      const data = (await response.json()) as ExecutionResponse;

      if (!response.ok || !data.execution) {
        throw new Error(
          data.error ?? "The specialist agent could not complete its work.",
        );
      }

      setState({
        status: "completed",
        execution: data.execution,
      });
    } catch (error) {
      setState({
        status: "error",
        branchName,
        message: errorMessage(error),
      });
    }
  }

  const branchName =
    state.status === "ready" ||
    state.status === "executing" ||
    state.status === "error"
      ? state.branchName
      : state.status === "completed"
        ? state.execution.branchName
        : undefined;

  return (
    <div
      className={
        state.status === "completed"
          ? "workspace-launch complete"
          : "workspace-launch"
      }
    >
      <div className="workspace-launch-copy">
        <span className="workspace-launch-label">
          {state.status === "completed" ? (
            <CheckCircleIcon size={16} weight="fill" />
          ) : state.status === "executing" ? (
            <RobotIcon size={16} />
          ) : (
            <GitBranchIcon size={16} />
          )}
          {state.status === "executing"
            ? "Specialist agent running"
            : state.status === "completed"
              ? "Implementation ready for review"
              : "Isolated GitHub workspace"}
        </span>

        {branchName ? (
          <strong className="workspace-branch-name">
            {branchName}
          </strong>
        ) : (
          <p>Create a dedicated branch from main for this agent.</p>
        )}

        {state.status === "executing" ? (
          <p>
            Codex is implementing the focused assignment, then BranchMind
            will run tests, commit, push, and open a pull request.
          </p>
        ) : null}

        {state.status === "completed" ? (
          <div className="execution-evidence">
            <span>
              {state.execution.changedFiles.length} files changed
            </span>
            <span>
              {state.execution.qualityGates.length} quality gates passed
            </span>
            <span>
              Commit {state.execution.commitSha.slice(0, 7)}
            </span>
          </div>
        ) : null}
      </div>

      {state.status === "completed" ? (
        <a
          className="workspace-action"
          href={state.execution.pullRequestUrl}
          rel="noreferrer"
          target="_blank"
        >
          View pull request
          <ArrowSquareOutIcon size={16} />
        </a>
      ) : state.status === "ready" ? (
        <button
          className="workspace-action"
          onClick={() => executeAgent(state.branchName)}
          type="button"
        >
          <RobotIcon size={17} />
          Run specialist agent
        </button>
      ) : state.status === "error" && state.branchName ? (
        <button
          className="workspace-action"
          onClick={() => executeAgent(state.branchName!)}
          type="button"
        >
          Retry agent
        </button>
      ) : (
        <button
          className="workspace-action"
          disabled={
            state.status === "provisioning" ||
            state.status === "executing"
          }
          onClick={provisionWorkspace}
          type="button"
        >
          {state.status === "provisioning" ? (
            <>
              <SpinnerGapIcon className="spinner" size={17} />
              Creating branch
            </>
          ) : state.status === "executing" ? (
            <>
              <SpinnerGapIcon className="spinner" size={17} />
              Agent working
            </>
          ) : (
            "Create isolated branch"
          )}
        </button>
      )}

      {state.status === "error" ? (
        <p className="workspace-launch-error" role="alert">
          <WarningCircleIcon size={16} weight="fill" />
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "BranchMind could not complete this operation.";
}
