import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT_DIRECTORY = fileURLToPath(new URL("..", import.meta.url));
const COMPOSE_FILE = fileURLToPath(
  new URL("../docker-compose.test.yml", import.meta.url),
);
const COMPOSE_PROJECT = `tech-challenge-quality-${process.pid}`;
const COMPOSE_ARGUMENTS = [
  "compose",
  "--project-name",
  COMPOSE_PROJECT,
  "--file",
  COMPOSE_FILE,
];
const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/challenge_test?schema=public";
const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 };
const [command, ...commandArguments] = process.argv.slice(2);

if (!command) throw new Error("A command is required");

let activeProcess;
let receivedSignal;

function run(executable, arguments_, environment = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: ROOT_DIRECTORY,
      env: environment,
      stdio: "inherit",
    });
    activeProcess = child;
    child.once("error", reject);
    child.once("close", (code) => {
      if (activeProcess === child) activeProcess = undefined;
      resolve(code ?? 1);
    });
  });
}

function handleSignal(signal) {
  receivedSignal = signal;
  activeProcess?.kill(signal);
}

process.once("SIGINT", () => handleSignal("SIGINT"));
process.once("SIGTERM", () => handleSignal("SIGTERM"));

async function runInContinuousIntegration() {
  return run(command, commandArguments);
}

async function runLocally() {
  let exitCode = 1;
  try {
    const startupExitCode = await run("docker", [
      ...COMPOSE_ARGUMENTS,
      "up",
      "--wait",
      "--wait-timeout",
      "120",
    ]);
    if (startupExitCode !== 0 || receivedSignal) return startupExitCode;
    const environment = {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL_TEST: TEST_DATABASE_URL,
      KAFKA_BROKERS: "localhost:9093",
      E2E_TRANSACTIONS_PORT: "3091",
      E2E_WEB_PORT: "5191",
      NEXT_PUBLIC_API_URL: "http://localhost:3091",
      DASHBOARD_ORIGIN: "http://localhost:5191",
    };
    exitCode = await run(command, commandArguments, environment);
    return exitCode;
  } finally {
    const cleanupExitCode = await run("docker", [
      ...COMPOSE_ARGUMENTS,
      "down",
      "--volumes",
      "--remove-orphans",
    ]).catch(() => 1);
    if (exitCode === 0 && cleanupExitCode !== 0)
      process.exitCode = cleanupExitCode;
  }
}

const exitCode =
  process.env.CI === "true"
    ? await runInContinuousIntegration()
    : await runLocally();
process.exitCode = receivedSignal
  ? SIGNAL_EXIT_CODES[receivedSignal]
  : (process.exitCode ?? exitCode);
