#!/usr/bin/env node
import process from 'node:process';
import { importNeovimTheme } from './adapters/neovim-import.js';
import { generateNeovim } from './adapters/neovim.js';
import { generateHerdr } from './adapters/herdr.js';
import { lineDifferences } from './diff.js';
import { atomicWrite, readIfExists } from './files.js';
import { herdrThemePath, normalizeName, nvimThemePath, themePath } from './paths.js';
import { run, runChecked } from './process.js';
import { resolveTheme } from './resolve.js';
import { listThemes, loadTheme, saveTheme } from './theme-store.js';
import type { ThemeDocument } from './types.js';

function usage(): never {
  console.error(`one-theme commands:
  one-theme import neovim <colorscheme> --name <name> [--refresh]
  one-theme apply <name> [--dry-run]
  one-theme diff <name>
  one-theme check <name>
  one-theme list`);
  process.exit(2);
}

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function importCommand(args: string[]): Promise<void> {
  if (args[0] !== 'neovim' || !args[1]) usage();
  const nameArg = flagValue(args, '--name');
  if (!nameArg) usage();
  const name = normalizeName(nameArg);
  const existing = await readIfExists(themePath(name));
  if (existing !== null && !args.includes('--refresh')) {
    throw new Error(`theme ${name} already exists; use --refresh to replace its pristine base`);
  }
  const imported = await importNeovimTheme(args[1], name);
  if (existing !== null) imported.overrides = (await loadTheme(name)).overrides;
  await saveTheme(imported);
  console.log(`${existing === null ? 'imported' : 'refreshed'} ${args[1]} as ${name}`);
  console.log(themePath(name));
}

function generatedOutputs(name: string, document: ThemeDocument) {
  const resolved = resolveTheme(document);
  return [
    { target: 'neovim', path: nvimThemePath(name), content: generateNeovim(name, resolved) },
    { target: 'herdr', path: herdrThemePath(name), content: generateHerdr(name, resolved) },
  ];
}

async function activateHerdr(name: string): Promise<void> {
  const binary = process.env.ONE_THEME_HERDR_BIN ?? 'hrd';
  await runChecked(binary, ['config', 'set-theme', `ot-${name}`]);
  const reload = await run(binary, ['server', 'reload-config']);
  if (reload.code !== 0) {
    console.warn(`Herdr theme was activated on disk, but live reload failed: ${reload.stderr.trim() || reload.stdout.trim()}`);
  }
}

async function applyCommand(args: string[]): Promise<void> {
  if (!args[0]) usage();
  const name = normalizeName(args[0]);
  const document = await loadTheme(name);
  const outputs = generatedOutputs(name, document);
  if (args.includes('--dry-run')) {
    for (const output of outputs) console.log(`would write ${output.target}: ${output.path}`);
    console.log(`would activate Herdr theme ot-${name}`);
    console.log(`Neovim activation remains manual: :colorscheme ot-${name}`);
    return;
  }
  for (const output of outputs) {
    await atomicWrite(output.path, output.content);
    console.log(`wrote ${output.target}: ${output.path}`);
  }
  await activateHerdr(name);
  console.log(`activated Herdr theme ot-${name}`);
  console.log(`activate Neovim manually with: :colorscheme ot-${name}`);
}

async function compareCommand(args: string[], check: boolean): Promise<void> {
  if (!args[0]) usage();
  const name = normalizeName(args[0]);
  const outputs = generatedOutputs(name, await loadTheme(name));
  let drift = false;
  for (const output of outputs) {
    const actual = await readIfExists(output.path);
    if (actual === output.content) {
      console.log(`${output.target}: current`);
      continue;
    }
    drift = true;
    console.log(`${output.target}: ${actual === null ? 'missing' : 'drifted'} (${output.path})`);
    if (!check && actual !== null) {
      for (const difference of lineDifferences(output.content, actual)) {
        console.log(`  line ${difference.line}`);
        console.log(`    expected: ${difference.expected}`);
        console.log(`    actual:   ${difference.actual}`);
      }
    }
  }
  if (check && drift) process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'import': await importCommand(args); break;
    case 'apply': await applyCommand(args); break;
    case 'diff': await compareCommand(args, false); break;
    case 'check': await compareCommand(args, true); break;
    case 'list': for (const name of await listThemes()) console.log(name); break;
    default: usage();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
