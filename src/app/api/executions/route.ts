import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { executionRequestSchema } from "@/features/execution/schema";
import { executeWorkstream } from "@/features/execution/service";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST(request: Request) {
  try {
    const input = executionRequestSchema.parse(
      await request.json(),
    );
    const execution = await executeWorkstream(input);

    return NextResponse.json(
      { execution },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid agent execution request.",
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

    console.error("Specialist agent execution failed.", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Specialist agent execution failed.",
      },
      { status: 500 },
    );
  }
}
