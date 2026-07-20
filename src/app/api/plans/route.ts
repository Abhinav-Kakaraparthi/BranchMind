import { NextResponse } from "next/server";

import { compileContextPackages } from "@/features/context/compiler";
import { createProjectPlan } from "@/features/planning/service";
import { planRequestSchema } from "@/features/planning/schema";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = planRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid planning request.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const plan = await createProjectPlan(parsed.data);
    const contextPackages = compileContextPackages(plan);

    return NextResponse.json({
      plan,
      contextPackages,
    });
  } catch (error) {
    console.error("Failed to create project plan.", error);

    return NextResponse.json(
      { error: "BranchMind could not create the project plan." },
      { status: 500 },
    );
  }
}
