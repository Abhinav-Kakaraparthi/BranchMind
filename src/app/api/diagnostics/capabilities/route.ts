import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    capabilities: [
      "planning",
      "isolated-workspaces",
      "parallel-agents",
      "pull-requests",
    ],
  });
}
