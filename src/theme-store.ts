import fs from 'node:fs/promises';
import { atomicWrite, readIfExists, stableJson } from './files.js';
import { normalizeName, themePath, themesDir } from './paths.js';
import { parseThemeDocument } from './schema.js';
import type { ThemeDocument } from './types.js';

export async function loadTheme(name: string): Promise<ThemeDocument> {
  const file = themePath(name);
  const content = await readIfExists(file);
  if (content === null) throw new Error(`theme not found: ${normalizeName(name)} (${file})`);
  return parseThemeDocument(content);
}

export async function saveTheme(document: ThemeDocument): Promise<void> {
  await atomicWrite(themePath(document.name), stableJson(document));
}

export async function listThemes(): Promise<string[]> {
  try {
    return (await fs.readdir(themesDir()))
      .filter(file => file.endsWith('.json'))
      .map(file => file.slice(0, -5))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
