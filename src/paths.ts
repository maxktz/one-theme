import os from 'node:os';
import path from 'node:path';

const home = os.homedir();

export function configRoot(): string {
  return process.env.ONE_THEME_CONFIG_HOME ?? path.join(home, '.config', 'one-theme');
}

export function themesDir(): string {
  return path.join(configRoot(), 'themes');
}

export function themePath(name: string): string {
  return path.join(themesDir(), `${normalizeName(name)}.json`);
}

export function nvimConfigDir(): string {
  return process.env.ONE_THEME_NVIM_CONFIG ?? path.join(home, '.config', 'nvim');
}

export function nvimThemePath(name: string): string {
  return path.join(nvimConfigDir(), 'colors', `ot-${normalizeName(name)}.lua`);
}

export function herdrConfigPath(): string {
  return process.env.ONE_THEME_HERDR_CONFIG ?? path.join(home, '.config', 'herdr', 'config.toml');
}

export function herdrThemePath(name: string): string {
  return path.join(path.dirname(herdrConfigPath()), 'themes', `ot-${normalizeName(name)}.toml`);
}

export function claudeConfigDir(): string {
  return process.env.ONE_THEME_CLAUDE_CONFIG ?? path.join(home, '.claude');
}

export function claudeSettingsPath(): string {
  return path.join(claudeConfigDir(), 'settings.json');
}

export function claudeThemePath(name: string): string {
  return path.join(claudeConfigDir(), 'themes', `ot-${normalizeName(name)}.json`);
}

export function normalizeName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[ _]+/g, '-');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
    throw new Error(`invalid theme name: ${JSON.stringify(name)}`);
  }
  return normalized;
}
