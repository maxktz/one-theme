import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { configRoot } from './paths.js';
import type { AppAdapter } from './types.js';

function isAdapter(value: unknown): value is AppAdapter {
  if (value === null || typeof value !== 'object') return false;
  const adapter = value as Partial<AppAdapter>;
  return typeof adapter.name === 'string'
    && typeof adapter.label === 'string'
    && typeof adapter.outputPath === 'function'
    && typeof adapter.generate === 'function'
    && typeof adapter.detect === 'function'
    && typeof adapter.currentTheme === 'function'
    && typeof adapter.activate === 'function'
    && typeof adapter.deactivate === 'function';
}

export async function loadPrivateAdapters(): Promise<AppAdapter[]> {
  const dir = path.join(configRoot(), 'adapters');
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const adapters: AppAdapter[] = [];
  for (const file of files.filter(item => item.endsWith('.mjs')).sort()) {
    const module = await import(pathToFileURL(path.join(dir, file)).href);
    const adapter = module.default ?? module.adapter;
    if (!isAdapter(adapter)) throw new Error(`invalid private adapter: ${path.join(dir, file)}`);
    adapters.push(adapter);
  }
  return adapters;
}
