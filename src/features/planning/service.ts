import { z } from "zod";

import { runCodex } from "@/lib/codex";

import { validatePlanGraph } from "./graph";
import { buildPlanningInput } from "./prompt";
import {
  projectPlanSchema,
  type PlanRequest,
  type ProjectPlan,
} from "./schema";

export async function createProjectPlan(
  request: PlanRequest,
): Promise<ProjectPlan> {
  const result = await runCodex({
    prompt: buildPlanningInput(request),
    outputSchema: z.toJSONSchema(projectPlanSchema),
    model: process.env.CODEX_PLANNING_MODEL ?? "gpt-5.6-terra",
    reasoningEffort: "low",
  });

  const plan = projectPlanSchema.parse(JSON.parse(result));
  validatePlanGraph(plan);

  return plan;
}
