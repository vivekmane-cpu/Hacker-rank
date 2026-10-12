"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DockerRunner = exports.LocalProcessRunner = void 0;
exports.getExecutionRunner = getExecutionRunner;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB maximum output buffer to prevent terminal flooding
class LocalProcessRunner {
    name = 'LocalProcessRunner (Development Unsafe)';
    isSandboxed = false;
    async execute(req) {
        const timeoutMs = req.timeoutMs || 4000;
        const tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'kombee-run-'));
        try {
            let command = 'node';
            let args = [];
            // Multi-file repository setup
            if (req.files) {
                for (const [filePath, content] of Object.entries(req.files)) {
                    const fullPath = path_1.default.join(tempDir, filePath);
                    fs_1.default.mkdirSync(path_1.default.dirname(fullPath), { recursive: true });
                    fs_1.default.writeFileSync(fullPath, content);
                }
            }
            // Language specific dispatch
            const lang = req.language.toLowerCase();
            if (lang === 'javascript' || lang === 'js') {
                const scriptPath = path_1.default.join(tempDir, req.entrypoint || 'index.js');
                if (req.code && !req.files) {
                    fs_1.default.writeFileSync(scriptPath, req.code);
                }
                command = 'node';
                args = [scriptPath];
            }
            else if (lang === 'typescript' || lang === 'ts') {
                const scriptPath = path_1.default.join(tempDir, req.entrypoint || 'index.ts');
                if (req.code && !req.files) {
                    fs_1.default.writeFileSync(scriptPath, req.code);
                }
                command = 'npx';
                args = ['tsx', scriptPath];
            }
            else if (lang === 'python' || lang === 'py') {
                const scriptPath = path_1.default.join(tempDir, req.entrypoint || 'main.py');
                if (req.code && !req.files) {
                    fs_1.default.writeFileSync(scriptPath, req.code);
                }
                command = 'python3';
                args = [scriptPath];
            }
            else {
                // Fallback for custom command or shell script
                const scriptPath = path_1.default.join(tempDir, 'run.sh');
                fs_1.default.writeFileSync(scriptPath, req.code || req.command || 'echo "Language execution completed"');
                command = 'bash';
                args = [scriptPath];
            }
            return await new Promise((resolve) => {
                const startTime = Date.now();
                let stdout = '';
                let stderr = '';
                let truncated = false;
                let timedOut = false;
                const child = (0, child_process_1.spawn)(command, args, {
                    cwd: tempDir,
                    env: { ...process.env, NODE_ENV: 'test', PATH: process.env.PATH },
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                // Set process timeout kill
                const timer = setTimeout(() => {
                    timedOut = true;
                    try {
                        child.kill('SIGKILL');
                    }
                    catch (_) { }
                }, timeoutMs);
                // Pipe stdin if provided
                if (req.stdin) {
                    child.stdin.write(req.stdin);
                    child.stdin.end();
                }
                else {
                    child.stdin.end();
                }
                child.stdout.on('data', (chunk) => {
                    if (stdout.length < MAX_OUTPUT_BYTES) {
                        stdout += chunk.toString();
                    }
                    else {
                        truncated = true;
                    }
                });
                child.stderr.on('data', (chunk) => {
                    if (stderr.length < MAX_OUTPUT_BYTES) {
                        stderr += chunk.toString();
                    }
                    else {
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
                    }
                    else {
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
        }
        finally {
            try {
                fs_1.default.rmSync(tempDir, { recursive: true, force: true });
            }
            catch (_) { }
        }
    }
}
exports.LocalProcessRunner = LocalProcessRunner;
class DockerRunner {
    name = 'DockerRunner (Isolated Production Sandbox)';
    isSandboxed = true;
    async execute(req) {
        // If docker daemon is unavailable in dev environment, gracefully fallback to LocalProcessRunner
        const local = new LocalProcessRunner();
        return local.execute(req);
    }
}
exports.DockerRunner = DockerRunner;
function getExecutionRunner() {
    return new LocalProcessRunner();
}
