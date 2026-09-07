import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { readE2eEnvironment } from './e2e-environment';

const ROOT_DIRECTORY = fileURLToPath(new URL('../../../..', import.meta.url));
const STARTUP_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const READY_CONTEXT = 'TransactionCreatedConsumer';
const READY_OUTCOME = '"outcome":"connected"';

function waitForReady(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve, reject) => {
    let startupOutput = '';
    const timeout = setTimeout(
      () => reject(new Error('Anti-fraud startup timed out')),
      STARTUP_TIMEOUT_MS,
    );
    const inspectOutput = (chunk: Buffer) => {
      const output = chunk.toString();
      process.stdout.write(output);
      startupOutput = `${startupOutput}${output}`.slice(-4_096);
      if (!startupOutput.includes(READY_CONTEXT) || !startupOutput.includes(READY_OUTCOME)) return;
      clearTimeout(timeout);
      resolve();
    };
    child.stdout.on('data', inspectOutput);
    child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Anti-fraud exited before readiness with code ${code ?? 'unknown'}`));
    });
  });
}

function signalProcess(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): void {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    child.kill(signal);
    return;
  }
  process.kill(-child.pid, signal);
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once('exit', () => resolve()));
}

function waitForExitBeforeTimeout(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<boolean> {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const handleExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      child.removeListener('exit', handleExit);
      resolve(false);
    }, timeoutMs);
    child.once('exit', handleExit);
  });
}

async function stopProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  signalProcess(child, 'SIGTERM');
  const exited = await waitForExitBeforeTimeout(child, SHUTDOWN_TIMEOUT_MS);
  if (exited) return;
  signalProcess(child, 'SIGKILL');
  await waitForExit(child);
}

export default async function startAntiFraud(): Promise<() => Promise<void>> {
  const environment = readE2eEnvironment();
  const child = spawn('pnpm', ['--filter', '@tech-challenge/anti-fraud', 'exec', 'nest', 'start'], {
    cwd: ROOT_DIRECTORY,
    detached: process.platform !== 'win32',
    env: { ...process.env, ...environment.backend },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdin.end();
  try {
    await waitForReady(child);
  } catch (error) {
    await stopProcess(child);
    throw error;
  }
  return async () => stopProcess(child);
}
