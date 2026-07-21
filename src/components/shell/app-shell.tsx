"use client";

import { MouseEvent } from "react";
import {
  ArrowsClockwiseIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  HouseIcon,
  PlusIcon,
  RobotIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react/ssr";

import { ProjectPlanner } from "@/features/planning/components/project-planner";
import {
  dispatchNavigation,
  resolveNavigationTarget,
  type NavigationControl,
  type NavigationTarget,
} from "@/features/planning/navigation";

const navigation: {
  label: string;
  icon: typeof HouseIcon;
  control: NavigationControl;
}[] = [
  { label: "Overview", icon: HouseIcon, control: "overview" },
  { label: "Workstreams", icon: GitBranchIcon, control: "workstreams" },
  { label: "Pull requests", icon: GitPullRequestIcon, control: "pull-requests" },
  { label: "Agents", icon: RobotIcon, control: "agents" },
];

export function AppShell() {
  function navigate(
    event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    intent: "navigate" | "new-project" | "start-project",
    target: NavigationTarget,
  ) {
    event.preventDefault();
    dispatchNavigation({ intent, target });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <GitBranchIcon size={19} weight="bold" />
          </div>
          <span>BranchMind</span>
        </div>

        <button
          className="new-project-button"
          onClick={(event) => navigate(event, "new-project", "project-intake")}
          type="button"
        >
          <PlusIcon size={16} weight="bold" />
          New project
        </button>

        <nav className="navigation" aria-label="Primary navigation">
          <p className="navigation-label">Workspace</p>
          {navigation.map(({ label, icon: Icon, control }) => {
            const target = resolveNavigationTarget(control);

            return (
              <a
                className={`navigation-item${control === "overview" ? " active" : ""}`}
                href={`#${target}`}
                key={label}
                onClick={(event) => navigate(event, "navigate", target)}
              >
                <Icon size={18} weight={control === "overview" ? "fill" : "regular"} />
                {label}
              </a>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="connection-status">
            <span className="status-dot" />
            GitHub connected
          </div>
          <div className="user">
            <div className="avatar">AK</div>
            <div>
              <strong>Abhinav</strong>
              <span>Project owner</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Engineering workspace</p>
            <h1>Good afternoon, Abhinav</h1>
          </div>

          <div className="system-status">
            <ArrowsClockwiseIcon size={16} />
            All systems ready
          </div>
        </header>

        <section className="hero" id="overview">
          <div className="hero-copy">
            <span className="hero-badge">
              <SquaresFourIcon size={15} weight="fill" />
              Autonomous orchestration
            </span>
            <h2>Turn one product goal into coordinated, reviewable work.</h2>
            <p>
              BranchMind decomposes requirements, creates focused agent
              workstreams, and brings verified changes back through pull
              requests.
            </p>
            <button
              className="primary-button"
              onClick={(event) => navigate(event, "start-project", "project-intake")}
              type="button"
            >
              <PlusIcon size={17} weight="bold" />
              Start a project
            </button>
          </div>

          <div className="workflow-preview" aria-label="Workflow preview">
            <div className="workflow-header">
              <div>
                <span className="preview-label">Project flow</span>
                <strong>From request to merge</strong>
              </div>
              <span className="live-indicator">Live</span>
            </div>

            <div className="workflow-list">
              <WorkflowStep label="Understand the goal" detail="Orchestrator" state="complete" />
              <WorkflowStep label="Create focused workstreams" detail="Specialist agents" state="active" />
              <WorkflowStep label="Review and integrate" detail="Quality gate" state="waiting" />
            </div>
          </div>
        </section>

        <ProjectPlanner />
      </main>
    </div>
  );
}

type WorkflowStepProps = {
  label: string;
  detail: string;
  state: "complete" | "active" | "waiting";
};

function WorkflowStep({ label, detail, state }: WorkflowStepProps) {
  return (
    <div className={`workflow-step ${state}`}>
      <span className="step-marker" />
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}
