import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    runtime: "node",
    capabilities: [
      "planning",
      "isolated-workspaces",
      "parallel-agents",
      "pull-requests",
    ],
  });
}
