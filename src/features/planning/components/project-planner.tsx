"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { GitBranchIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";

import type { ContextPackage } from "@/features/context/compiler";
import type { ProjectPlan } from "@/features/planning/schema";
import {
  dispatchPlanningState,
  navigationEventName,
  projectIntakeId,
  scrollToNavigationTarget,
  type NavigationRequest,
} from "@/features/planning/navigation";

import { PlanResults } from "./plan-results";
import { ContributorIdeaBoard } from "@/features/contributions/idea-board";
import { createPlanningRequest } from "@/features/contributions/idea-snapshot";
import { useContributionLedger } from "@/features/contributions/use-contribution-ledger";

type PlanningResponse = {
  plan: ProjectPlan;
  contextPackages: ContextPackage[];
};

export function ProjectPlanner() {
  const [repository, setRepository] = useState(
    "Abhinav-Kakaraparthi/BranchMind",
  );
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<PlanningResponse>();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const productGoalRef = useRef<HTMLTextAreaElement>(null);
  const { ledger } = useContributionLedger(repository);

  useEffect(() => {
    function handleNavigation(event: Event) {
      const request = (event as CustomEvent<NavigationRequest>).detail;

      if (!request) return;

      if (request.intent === "new-project") {
        setResult(undefined);
        setError("");
      }

      scrollToNavigationTarget(request.target);

      if (request.intent === "new-project" || request.intent === "start-project") {
        productGoalRef.current?.focus({ preventScroll: true });
      }
    }

    window.addEventListener(navigationEventName, handleNavigation);
    return () => window.removeEventListener(navigationEventName, handleNavigation);
  }, []);

  useEffect(() => {
    dispatchPlanningState({ hasPlan: Boolean(result), hasTeamResults: false });
  }, [result]);

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!repository.trim()) {
      setError("Enter a GitHub repository using the owner/repository format.");
      return;
    }

    if (goal.trim().length < 20) {
      setError("Describe the product goal in at least 20 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createPlanningRequest(repository, goal, ledger)),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "BranchMind could not create the project plan.",
        );
      }

      setResult(data);
    } catch (planningError) {
      setError(
        planningError instanceof Error
          ? planningError.message
          : "BranchMind could not create the project plan.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="planner" id="project-intake">
      <div className="planner-heading">
        <div>
          <span className="section-label">Project intake</span>
          <h2>Describe the outcome. BranchMind organizes the work.</h2>
        </div>
        <span className="model-label">GPT-5.6 Terra</span>
      </div>

      <div className="planner-form">
        <label>
          GitHub repository
          <span className="input-shell">
            <GitBranchIcon size={18} />
            <input
              aria-label="GitHub repository"
              onChange={(event) => setRepository(event.target.value)}
              placeholder="owner/repository"
              value={repository}
            />
          </span>
        </label>

        <ContributorIdeaBoard repository={repository} />

        <form onSubmit={submitPlan}>
        <label>
          Product goal
          <textarea
            aria-label="Product goal"
            id="product-goal"
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Describe what you want to build, the audience, and the result that must work."
            ref={productGoalRef}
            rows={5}
            value={goal}
          />
        </label>

        <div className="planner-actions">
          <p>
            Codex creates validated workstreams and focused context packages.
          </p>
          <button disabled={isLoading} type="submit">
            {isLoading ? (
              <>
                <SpinnerGapIcon className="spinner" size={18} />
                Planning with GPT-5.6
              </>
            ) : (
              "Generate workstreams"
            )}
          </button>
        </div>

        {error ? (
          <p className="planner-error" role="alert">
            <WarningCircleIcon size={17} weight="fill" />
            {error}
          </p>
        ) : null}
        </form>
      </div>

      {result ? (
        <PlanResults
          contextPackages={result.contextPackages}
          plan={result.plan}
          repository={repository.trim()}
        />
      ) : (
        <EmptyPlanningSections />
      )}
    </section>
  );
}

const emptySections = [
  {
    id: "generated-workstreams",
    title: "No generated workstreams yet",
    description: "Create a project plan to generate workstreams from your product goal.",
  },
  {
    id: "agent-team",
    title: "No agent team yet",
    description: "Create a project plan before BranchMind can assemble a team to execute it.",
  },
  {
    id: "pull-request-results",
    title: "No pull request results yet",
    description: "Create a project plan before there are execution results to review.",
  },
] as const;

function EmptyPlanningSections() {
  return (
    <div className="empty-navigation-sections">
      {emptySections.map(({ id, title, description }) => (
        <section className="empty-navigation-section" id={id} key={id}>
          <div>
            <span className="section-label">{id.replaceAll("-", " ")}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <a href={`#${projectIntakeId}`}>Go to project intake</a>
        </section>
      ))}
    </div>
  );
}
