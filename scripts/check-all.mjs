import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const javaBackendDir = join(repoRoot, "java-backend");
const pythonQuantDir = join(repoRoot, "python-quant");
const pythonCommand = process.env.PYTHON ?? "python";

const steps = [
  {
    name: "Repository formatting",
    command: isWindows ? "cmd.exe" : "npm",
    args: isWindows
      ? ["/d", "/s", "/c", "npm.cmd run format:check"]
      : ["run", "format:check"],
    cwd: repoRoot,
  },
  {
    name: "Frontend lint, typecheck, and build",
    command: isWindows ? "cmd.exe" : "npm",
    args: isWindows
      ? ["/d", "/s", "/c", "npm.cmd run check"]
      : ["run", "check"],
    cwd: repoRoot,
  },
  {
    name: "Docker Compose config",
    command: "docker",
    args: ["compose", "config"],
    cwd: repoRoot,
  },
  {
    name: "Ubuntu deployment Compose config",
    command: "docker",
    args: [
      "compose",
      "--env-file",
      "deploy/ubuntu/.env.example",
      "-f",
      "deploy/ubuntu/docker-compose.yml",
      "config",
    ],
    cwd: repoRoot,
  },
  {
    name: "Java backend compile",
    command: isWindows ? "cmd.exe" : "./mvnw",
    args: isWindows
      ? ["/d", "/s", "/c", "mvnw.cmd -B -ntp -DskipTests compile"]
      : ["-B", "-ntp", "-DskipTests", "compile"],
    cwd: javaBackendDir,
  },
  {
    name: "Python quant compile",
    command: pythonCommand,
    args: ["-m", "compileall", "-q", "src"],
    cwd: pythonQuantDir,
  },
  {
    name: "Python quant FastAPI import",
    command: pythonCommand,
    args: [
      "-c",
      "import src.main as main; assert getattr(main, 'app', None) is not None; print(type(main.app).__name__)",
    ],
    cwd: pythonQuantDir,
  },
];

for (const step of steps) {
  console.log(`\n==> ${step.name}`);
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll checks passed.");
