import { NextResponse } from "next/server";
import { z } from "zod";

import { getTeamExecutionProgress } from "../../../../../../features/execution/execution-progress";

const teamRunIdSchema = z.string().uuid();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamRunId: string }> },
) {
  const { teamRunId } = await context.params;
  const parsed = teamRunIdSchema.safeParse(teamRunId);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid agent team run identifier.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    progress: getTeamExecutionProgress(parsed.data),
  });
}
