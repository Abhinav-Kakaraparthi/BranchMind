"use client";

import { useMemo, useState } from "react";
import {
  CheckCircleIcon,
  GitBranchIcon,
  RobotIcon,
  StackIcon,
  TrendDownIcon,
} from "@phosphor-icons/react";

import type { ContextPackage } from "@/features/context/compiler";
import { TeamExecutionPanel } from "@/features/execution/team-execution-panel";
import type { ProjectPlan } from "@/features/planning/schema";
import { WorkspaceLaunch } from "@/features/workspaces/workspace-launch";
import { ContributionLedger } from "@/features/contributions/contribution-ledger";
import type { TeamExecutionResponse } from "@/features/execution/team-request";

type PlanResultsProps = {
  plan: ProjectPlan;
  contextPackages: ContextPackage[];
  repository: string;
};

export function PlanResults({
  plan,
  contextPackages,
  repository,
}: PlanResultsProps) {
  const [selectedKey, setSelectedKey] = useState(
    plan.workstreams[0].key,
  );
  const [team, setTeam] = useState<TeamExecutionResponse>();

  const selectedWorkstream =
    plan.workstreams.find((item) => item.key === selectedKey) ??
    plan.workstreams[0];

  const selectedContext = contextPackages.find(
    (item) => item.workstreamKey === selectedWorkstream.key,
  );

  const metrics = useMemo(() => {
    const totalAvoided = contextPackages.reduce(
      (total, item) => total + item.metrics.estimatedTokensAvoided,
      0,
    );
    const averageSavings = contextPackages.length
      ? Math.round(
          contextPackages.reduce(
            (total, item) =>
              total + item.metrics.estimatedSavingsPercent,
            0,
          ) / contextPackages.length,
        )
      : 0;

    return {
      totalAvoided,
      averageSavings,
    };
  }, [contextPackages]);

  return (
    <div className="plan-results" id="generated-workstreams">
      <div className="results-header">
        <div>
          <span className="section-label">Generated project system</span>
          <h2>{plan.projectName}</h2>
          <p>{plan.summary}</p>
        </div>
        <span className="validated-label">
          <CheckCircleIcon size={17} weight="fill" />
          Graph validated
        </span>
      </div>

      <div className="metrics-grid">
        <Metric
          icon={<StackIcon size={20} />}
          label="Workstreams"
          value={String(plan.workstreams.length)}
        />
        <Metric
          icon={<TrendDownIcon size={20} />}
          label="Average context savings"
          value={`${metrics.averageSavings}% estimated`}
        />
        <Metric
          icon={<RobotIcon size={20} />}
          label="Estimated tokens avoided"
          value={metrics.totalAvoided.toLocaleString()}
        />
      </div>

      <TeamExecutionPanel
        contextPackages={contextPackages}
        onTeamComplete={setTeam}
        plan={plan}
        repository={repository}
      />

      <div className="workstream-layout">
        <div className="workstream-list">
          <div className="panel-heading">
            <span>Specialist workstreams</span>
            <strong>{plan.workstreams.length} agents proposed</strong>
          </div>

          {plan.workstreams.map((workstream, index) => {
            const context = contextPackages.find(
              (item) => item.workstreamKey === workstream.key,
            );

            return (
              <button
                className={
                  selectedKey === workstream.key
                    ? "workstream-row selected"
                    : "workstream-row"
                }
                key={workstream.key}
                onClick={() => setSelectedKey(workstream.key)}
                type="button"
              >
                <span className="workstream-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="workstream-copy">
                  <strong>{workstream.name}</strong>
                  <small>{workstream.objective}</small>
                </span>
                <span className="savings-pill">
                  {context?.metrics.estimatedSavingsPercent ?? 0}% saved
                </span>
              </button>
            );
          })}
        </div>

        <article className="workstream-detail">
          <div className="detail-heading">
            <div>
              <span className="section-label">Focused assignment</span>
              <h3>{selectedWorkstream.name}</h3>
            </div>
            <RobotIcon size={25} />
          </div>

          <p className="objective">{selectedWorkstream.objective}</p>

          <DetailList
            items={selectedWorkstream.deliverables}
            title="Deliverables"
          />
          <DetailList
            items={selectedWorkstream.acceptanceCriteria}
            title="Acceptance criteria"
          />

          <div className="dependency-row">
            <strong>Dependencies</strong>
            <span>
              {selectedWorkstream.dependsOn.length
                ? selectedWorkstream.dependsOn.join(", ")
                : "None - ready for parallel execution"}
            </span>
          </div>

          {selectedContext ? (
            <div className="context-receipt">
              <div>
                <span>Context package</span>
                <strong>{selectedContext.fingerprint}</strong>
              </div>
              <div>
                <span>Full context</span>
                <strong>
                  {selectedContext.metrics.estimatedFullContextTokens}
                </strong>
              </div>
              <div>
                <span>Agent package</span>
                <strong>
                  {selectedContext.metrics.estimatedPackageTokens}
                </strong>
              </div>
              <div>
                <span>Proposed branch</span>
                <strong>
                  <GitBranchIcon size={14} />
                  agent/{selectedWorkstream.key}
                </strong>
              </div>
            </div>
          ) : null}

          <WorkspaceLaunch
            key={selectedWorkstream.key}
            repository={repository}
            contextPackage={selectedContext}
            workstream={{
              key: selectedWorkstream.key,
              name: selectedWorkstream.name,
            }}
          />

        </article>
      </div>

      <ContributionLedger plan={plan} repository={repository} team={team} />
    </div>
  );
}

type MetricProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function Metric({ icon, label, value }: MetricProps) {
  return (
    <div className="metric-card">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

type DetailListProps = {
  title: string;
  items: string[];
};

function DetailList({ title, items }: DetailListProps) {
  return (
    <div className="detail-list">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <CheckCircleIcon size={16} weight="fill" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
