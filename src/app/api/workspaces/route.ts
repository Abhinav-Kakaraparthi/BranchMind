import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { GitHubCliError } from "@/features/workspaces/github-cli";
import { workspaceRequestSchema } from "@/features/workspaces/schema";
import { provisionWorkspace } from "@/features/workspaces/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = workspaceRequestSchema.parse(await request.json());
    const workspace = await provisionWorkspace(input);

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid workspace request.",
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

    console.error("Failed to provision GitHub workspace.", error);

    return NextResponse.json(
      {
        error:
          error instanceof GitHubCliError
            ? error.message
            : "GitHub workspace provisioning failed.",
      },
      { status: 500 },
    );
  }
}
