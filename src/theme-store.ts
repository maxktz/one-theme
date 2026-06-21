import fs from 'node:fs/promises';
import { atomicWrite, readIfExists, stableJson } from './files.js';
import { configPath, normalizeName, themePath, themesDir } from './paths.js';
import { parseConfig, parseThemeDocument } from './schema.js';
import type { OneThemeConfig, ThemeDocument } from './types.js';

export const schemaUrl = 'https://raw.githubusercontent.com/maxktz/one-theme/main/schemas/one-theme.schema.json';
export const configSchemaUrl = 'https://raw.githubusercontent.com/maxktz/one-theme/main/schemas/one-theme.config.schema.json';

export const defaultConfig: OneThemeConfig = {
  $schema: configSchemaUrl,
  activeTheme: 'tokyonight',
  apps: {
    neovim: { transparency: true },
    herdr: { transparency: true },
    ghostty: {},
    claude: {},
  },
};

export async function loadTheme(name: string): Promise<ThemeDocument> {
  const file = themePath(name);
  const content = await readIfExists(file);
  if (content === null) throw new Error(`theme not found: ${normalizeName(name)} (${file})`);
  return parseThemeDocument(content);
}

export async function saveTheme(document: ThemeDocument): Promise<void> {
  await atomicWrite(themePath(document.name), stableJson(document));
}

export async function loadConfig(): Promise<OneThemeConfig> {
  const content = await readIfExists(configPath());
  if (content === null) return defaultConfig;
  return parseConfig(content);
}

export async function saveConfig(config: OneThemeConfig): Promise<void> {
  await atomicWrite(configPath(), stableJson(config));
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
