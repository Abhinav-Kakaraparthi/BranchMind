"use client";

import { FormEvent, useState } from "react";
import {
  GitBranchIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import type { ContextPackage } from "@/features/context/compiler";
import type { ProjectPlan } from "@/features/planning/schema";

import { PlanResults } from "./plan-results";

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
        body: JSON.stringify({
          repository: repository.trim(),
          goal: goal.trim(),
        }),
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
    <section className="planner" id="planner">
      <div className="planner-heading">
        <div>
          <span className="section-label">Project intake</span>
          <h2>Describe the outcome. BranchMind organizes the work.</h2>
        </div>
        <span className="model-label">GPT-5.6 Terra</span>
      </div>

      <form className="planner-form" onSubmit={submitPlan}>
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

        <label>
          Product goal
          <textarea
            aria-label="Product goal"
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Describe what you want to build, the audience, and the result that must work."
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

      {result ? (
        <PlanResults
          contextPackages={result.contextPackages}
          plan={result.plan}
        />
      ) : null}
    </section>
  );
}
