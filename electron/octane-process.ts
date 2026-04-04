/**
 * Spawns and manages the octaneGrpcSE child process in headless mode.
 * Used by the integrated Electron build where octaneGrpcSE runs inside
 * the app with no system tray.
 */

import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';

const READY_TIMEOUT_MS = 120_000; // GPU init can take 60s+
const KILL_GRACE_MS = 5_000;

export interface OctaneServerHandle {
  port: number;
  process: ChildProcess;
  kill: () => Promise<void>;
}

export interface SpawnOptions {
  exePath: string;
  port?: number;
  logLevel?: string;
  cwd?: string;
}

export function spawnOctaneServer(opts: SpawnOptions): Promise<OctaneServerHandle> {
  const port = opts.port ?? 51022;
  const args = ['--headless', `--port=${port}`];
  if (opts.logLevel) {
    args.push(`--log-level=${opts.logLevel}`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(opts.exePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: opts.cwd,
      windowsHide: true,
    });

    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error(`octaneGrpcSE did not become ready within ${READY_TIMEOUT_MS / 1000}s`));
      }
    }, READY_TIMEOUT_MS);

    // Parse stdout line-by-line for the GRPC_READY signal
    const rl = readline.createInterface({ input: child.stdout! });
    rl.on('line', (line: string) => {
      console.log(`[octaneGrpcSE] ${line}`);
      if (!settled && line.startsWith('GRPC_READY')) {
        settled = true;
        clearTimeout(timeout);
        const readyPort = parseInt(line.split(' ')[1], 10) || port;
        resolve({
          port: readyPort,
          process: child,
          kill: () => killChild(child),
        });
      }
    });

    // Log stderr
    const stderrRl = readline.createInterface({ input: child.stderr! });
    stderrRl.on('line', (line: string) => {
      console.error(`[octaneGrpcSE:err] ${line}`);
    });

    child.on('error', (err: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn octaneGrpcSE: ${err.message}`));
      }
    });

    child.on('exit', (code: number | null, signal: string | null) => {
      console.log(`[octaneGrpcSE] Process exited (code=${code}, signal=${signal})`);
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`octaneGrpcSE exited before ready (code=${code})`));
      }
    });
  });
}

function killChild(child: ChildProcess): Promise<void> {
  return new Promise(resolve => {
    if (!child.pid || child.killed) {
      resolve();
      return;
    }

    // Close stdin pipe — headless mode exits when stdin closes
    child.stdin?.end();

    const forceTimer = setTimeout(() => {
      if (!child.killed) {
        console.log('[octaneGrpcSE] Force-killing after grace period');
        child.kill('SIGKILL');
      }
    }, KILL_GRACE_MS);

    child.on('exit', () => {
      clearTimeout(forceTimer);
      resolve();
    });

    // If already exited by the time we set up the listener
    if (child.exitCode !== null) {
      clearTimeout(forceTimer);
      resolve();
    }
  });
}
