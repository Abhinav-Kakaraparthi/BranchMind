import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { executeAgentTeam } from "@/features/execution/team-service";
import { teamExecutionRequestSchema } from "@/features/execution/team-schema";

export const runtime = "nodejs";
export const maxDuration = 1800;

export async function POST(request: Request) {
  try {
    const input = teamExecutionRequestSchema.parse(
      await request.json(),
    );
    const team = await executeAgentTeam(input);

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid agent team request.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must contain valid JSON." },
        { status: 400 },
      );
    }

    console.error("Agent team execution failed.", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Agent team execution failed.",
      },
      { status: 500 },
    );
  }
}
