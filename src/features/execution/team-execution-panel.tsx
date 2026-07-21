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

import type { ContextPackage } from "@/features/context/compiler";
import type { ProjectPlan } from "@/features/planning/schema";
import {
  buildTeamExecutionRequest,
  summarizeTeamExecution,
  type TeamExecutionResponse,
} from "./team-request";

type TeamExecutionPanelProps = {
  repository: string;
  plan: ProjectPlan;
  contextPackages: ContextPackage[];
  onTeamComplete?: (team: TeamExecutionResponse) => void;
};

type TeamExecutionApiResponse = {
  team?: TeamExecutionResponse;
  error?: string;
};

export function TeamExecutionPanel({
  repository,
  plan,
  contextPackages,
  onTeamComplete,
}: TeamExecutionPanelProps) {
  const [team, setTeam] = useState<TeamExecutionResponse>();
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function runTeam() {
    if (isRunning) return;

    setError("");

    let request;

    try {
      request = buildTeamExecutionRequest(
        repository,
        plan,
        contextPackages,
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
      return;
    }

    setTeam(undefined);
    setIsRunning(true);

    try {
      const response = await fetch("/api/executions/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = (await response.json()) as TeamExecutionApiResponse;

      if (!response.ok || !data.team) {
        throw new Error(
          data.error ?? "BranchMind could not complete the agent team.",
        );
      }

      setTeam(data.team);
      onTeamComplete?.(data.team);
    } catch (teamError) {
      setError(errorMessage(teamError));
    } finally {
      setIsRunning(false);
    }
  }

  const summary = team ? summarizeTeamExecution(team) : undefined;
  const branchesByKey = new Map(
    team?.branches.map((branch) => [branch.workstreamKey, branch]),
  );

  return (
    <>
      <section
        className="team-execution-panel"
        id="agent-team"
        aria-labelledby="team-execution-title"
      >
      <div className="team-execution-heading">
        <div>
          <span className="section-label">Dependency-aware execution</span>
          <h3 id="team-execution-title">Launch the full specialist team</h3>
          <p>
            BranchMind sends each proposed agent its focused context package and
            lets the authoritative server scheduler preserve dependencies.
          </p>
        </div>
        <button
          className="team-execution-action"
          disabled={isRunning}
          onClick={runTeam}
          type="button"
        >
          {isRunning ? (
            <>
              <SpinnerGapIcon className="spinner" size={18} />
              Running agent team
            </>
          ) : (
            <>
              <RobotIcon size={18} />
              Run agent team
            </>
          )}
        </button>
      </div>

      {isRunning ? (
        <div className="team-launch-progress" role="status" aria-live="polite">
          <SpinnerGapIcon className="spinner" size={20} />
          <div>
            <strong>Team launch started</strong>
            <span>Specialist agents are executing in isolated worktrees.</span>
            <span>The browser is waiting for the authoritative server result.</span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="team-execution-error" role="alert">
          <WarningCircleIcon size={17} weight="fill" />
          {error}
        </p>
      ) : null}
      </section>

      <section
        className="team-execution-results"
        id="pull-request-results"
        aria-labelledby="pull-request-results-title"
        aria-live="polite"
      >
        <div className="pull-request-results-heading">
          <span className="section-label">Pull request results</span>
          <h4 id="pull-request-results-title">Execution results</h4>
        </div>
        {team && summary ? (
          <>
          <div className="team-summary" aria-label="Agent team summary">
            <SummaryMetric label="Completed" value={summary.completed} />
            <SummaryMetric label="Failed" value={summary.failed} />
            <SummaryMetric label="Blocked" value={summary.blocked} />
            <SummaryMetric
              label="Maximum concurrency"
              value={summary.maximumConcurrency}
            />
          </div>

          <div className="team-agent-list">
            {team.agents.map((agent) => {
              const workstream = plan.workstreams.find(
                (item) => item.key === agent.key,
              );
              const branch = branchesByKey.get(agent.key);
              const branchName = agent.value?.branchName ?? branch?.branchName;
              const changedFileCount = agent.value
                ? String(agent.value.changedFiles.length)
                : "Not available";
              const qualityGateResult = agent.status === "completed"
                ? `Passed (${agent.value?.qualityGates.length ?? 0} gates)`
                : agent.status === "blocked"
                  ? "Not run"
                  : "Not available";

              return (
                <article className="team-agent-row" key={agent.key}>
                  <div className="team-agent-title">
                    {agent.status === "completed" ? (
                      <CheckCircleIcon size={18} weight="fill" />
                    ) : (
                      <RobotIcon size={18} />
                    )}
                    <div>
                      <h4>{workstream?.name ?? agent.key}</h4>
                      <span className={`team-status ${agent.status}`}>
                        {agent.status}
                      </span>
                    </div>
                  </div>

                  <dl className="team-agent-details">
                    <div>
                      <dt>Branch</dt>
                      <dd>
                        {branchName ? <GitBranchIcon size={14} /> : null}
                        {branchName ?? "Not reported"}
                      </dd>
                    </div>
                    <div>
                      <dt>Changed files</dt>
                      <dd>{changedFileCount}</dd>
                    </div>
                    <div>
                      <dt>Quality gates</dt>
                      <dd>{qualityGateResult}</dd>
                    </div>
                  </dl>

                  {agent.value?.pullRequestUrl ? (
                    <a
                      className="team-pr-link"
                      href={agent.value.pullRequestUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View pull request
                      <ArrowSquareOutIcon size={16} />
                    </a>
                  ) : null}

                  {agent.status === "failed" || agent.status === "blocked" ? (
                    <p className="team-agent-reason">
                      {agent.error ?? "The server did not return a completion result."}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
          </>
        ) : (
          <p className="pull-request-results-empty">
            No pull request results are available until the agent team finishes.
          </p>
        )}
      </section>
    </>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "BranchMind could not complete the agent team.";
}
