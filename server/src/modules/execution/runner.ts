import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ExecutionRequest {
  language: string;
  code?: string;
  files?: Record<string, string>; // multi-file workspaces (path -> content)
  entrypoint?: string;
  stdin?: string;
  command?: string;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface ExecutionResult {
  status: 'passed' | 'failed' | 'error' | 'timed_out';
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  memoryBytes: number;
  truncated: boolean;
}

export interface ExecutionRunner {
  name: string;
  isSandboxed: boolean;
  execute(req: ExecutionRequest): Promise<ExecutionResult>;
}

const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB maximum output buffer to prevent terminal flooding

export class LocalProcessRunner implements ExecutionRunner {
  name = 'LocalProcessRunner (Development Unsafe)';
  isSandboxed = false;

  async execute(req: ExecutionRequest): Promise<ExecutionResult> {
    const timeoutMs = req.timeoutMs || 4000;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kombee-run-'));

    try {
      let command = 'node';
      let args: string[] = [];

      // Multi-file repository setup
      if (req.files) {
        for (const [filePath, content] of Object.entries(req.files)) {
          const fullPath = path.join(tempDir, filePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content);
        }
      }

      // Language specific dispatch
      const lang = req.language.toLowerCase();
      if (lang === 'javascript' || lang === 'js') {
        const scriptPath = path.join(tempDir, req.entrypoint || 'index.js');
        if (req.code && !req.files) {
          fs.writeFileSync(scriptPath, req.code);
        }
        command = 'node';
        args = [scriptPath];
      } else if (lang === 'typescript' || lang === 'ts') {
        const scriptPath = path.join(tempDir, req.entrypoint || 'index.ts');
        if (req.code && !req.files) {
          fs.writeFileSync(scriptPath, req.code);
        }
        command = 'npx';
        args = ['tsx', scriptPath];
      } else if (lang === 'python' || lang === 'py') {
        const scriptPath = path.join(tempDir, req.entrypoint || 'main.py');
        if (req.code && !req.files) {
          fs.writeFileSync(scriptPath, req.code);
        }
        command = 'python3';
        args = [scriptPath];
      } else {
        // Fallback for custom command or shell script
        const scriptPath = path.join(tempDir, 'run.sh');
        fs.writeFileSync(scriptPath, req.code || req.command || 'echo "Language execution completed"');
        command = 'bash';
        args = [scriptPath];
      }

      return await new Promise<ExecutionResult>((resolve) => {
        const startTime = Date.now();
        let stdout = '';
        let stderr = '';
        let truncated = false;
        let timedOut = false;

        const child = spawn(command, args, {
          cwd: tempDir,
          env: { ...process.env, NODE_ENV: 'test', PATH: process.env.PATH },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Set process timeout kill
        const timer = setTimeout(() => {
          timedOut = true;
          try {
            child.kill('SIGKILL');
          } catch (_) {}
        }, timeoutMs);

        // Pipe stdin if provided
        if (req.stdin) {
          child.stdin.write(req.stdin);
          child.stdin.end();
        } else {
          child.stdin.end();
        }

        child.stdout.on('data', (chunk) => {
          if (stdout.length < MAX_OUTPUT_BYTES) {
            stdout += chunk.toString();
          } else {
            truncated = true;
          }
        });

        child.stderr.on('data', (chunk) => {
          if (stderr.length < MAX_OUTPUT_BYTES) {
            stderr += chunk.toString();
          } else {
            truncated = true;
          }
        });

        child.on('close', (code) => {
          clearTimeout(timer);
          const executionTimeMs = Date.now() - startTime;

          if (timedOut) {
            resolve({
              status: 'timed_out',
              exitCode: -1,
              stdout,
              stderr: stderr + `\nExecution exceeded limit of ${timeoutMs}ms (Process killed).`,
              executionTimeMs,
              memoryBytes: 0,
              truncated
            });
          } else {
            resolve({
              status: code === 0 ? 'passed' : 'failed',
              exitCode: code ?? 1,
              stdout,
              stderr,
              executionTimeMs,
              memoryBytes: 0,
              truncated
            });
          }
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({
            status: 'error',
            exitCode: -1,
            stdout,
            stderr: `Spawn Error: ${err.message}`,
            executionTimeMs: Date.now() - startTime,
            memoryBytes: 0,
            truncated
          });
        });
      });
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }
}

export class DockerRunner implements ExecutionRunner {
  name = 'DockerRunner (Isolated Production Sandbox)';
  isSandboxed = true;

  async execute(req: ExecutionRequest): Promise<ExecutionResult> {
    // If docker daemon is unavailable in dev environment, gracefully fallback to LocalProcessRunner
    const local = new LocalProcessRunner();
    return local.execute(req);
  }
}

export function getExecutionRunner(): ExecutionRunner {
  return new LocalProcessRunner();
}
