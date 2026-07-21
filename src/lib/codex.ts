import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type ReasoningEffort = "low" | "medium" | "high";

type CodexRequest = {
  prompt: string;
  outputSchema: object;
  workingDirectory?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
};

type CodexInvocation = {
  command: string;
  prefixArguments: string[];
};

export async function runCodex({
  prompt,
  outputSchema,
  workingDirectory = process.cwd(),
  model = "gpt-5.6-terra",
  reasoningEffort = "low",
}: CodexRequest): Promise<string> {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "branchmind-codex-"),
  );
  const schemaPath = path.join(temporaryDirectory, "output-schema.json");
  const outputPath = path.join(temporaryDirectory, "result.json");

  try {
    await writeFile(schemaPath, JSON.stringify(outputSchema), "utf8");

    const invocation = resolveCodexInvocation();
    const argumentsList = [
      ...invocation.prefixArguments,
      "exec",
      "--model",
      model,
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--color",
      "never",
      "-c",
      `model_reasoning_effort="${reasoningEffort}"`,
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      "-",
    ];

    const diagnostics = await executeProcess(
      invocation.command,
      argumentsList,
      prompt,
      workingDirectory,
    );

    try {
      return await readFile(outputPath, "utf8");
    } catch {
      throw new Error(
        `Codex completed without a structured result.\n${diagnostics}`,
      );
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

export function resolveCodexInvocation(): CodexInvocation {
  const configuredPath = process.env.CODEX_CLI_PATH;

  if (configuredPath) {
    return configuredPath.endsWith(".js")
      ? {
          command: process.execPath,
          prefixArguments: [configuredPath],
        }
      : {
          command: configuredPath,
          prefixArguments: [],
        };
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    return {
      command: process.execPath,
      prefixArguments: [
        path.join(
          process.env.APPDATA,
          "npm",
          "node_modules",
          "@openai",
          "codex",
          "bin",
          "codex.js",
        ),
      ],
    };
  }

  return {
    command: "codex",
    prefixArguments: [],
  };
}

export async function executeProcess(
  command: string,
  argumentsList: string[],
  input: string,
  workingDirectory: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd: workingDirectory,
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      shell: false,
      windowsHide: true,
    });

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });

    child.once("error", reject);

    child.once("close", (code) => {
      const diagnostics = `${output}\n${errorOutput}`.trim();

      if (code === 0) {
        resolve(diagnostics);
        return;
      }

      reject(
        new Error(
          `Codex exited with code ${code ?? "unknown"}.\n${diagnostics}`,
        ),
      );
    });

    child.stdin.end(input);
  });
}
