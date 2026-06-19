import { spawn } from 'node:child_process';

export interface RunResult { stdout: string; stderr: string; code: number }

export function run(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; cwd?: string } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

export async function runChecked(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; cwd?: string } = {}): Promise<RunResult> {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.code})\n${result.stderr || result.stdout}`);
  }
  return result;
}
