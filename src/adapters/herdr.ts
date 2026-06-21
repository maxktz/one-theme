import fs from 'node:fs/promises';
import { atomicWrite, readIfExists } from '../files.js';
import { generatedTheme, herdrConfigPath } from '../paths.js';
import { run } from '../process.js';
import type { AppAdapter, AppConfigBase, ResolvedTheme } from '../types.js';

function builtinThemeFor(theme: ResolvedTheme): string {
  return theme.name.replace(/[-_ ]/g, '') === 'tokyonight' ? 'tokyo-night' : 'terminal';
}

async function detectHerdr(): Promise<boolean> {
  try {
    await fs.access(herdrConfigPath());
    return true;
  } catch {
    return false;
  }
}

function sectionRange(lines: string[], section: string): { start: number; end: number } | null {
  const header = new RegExp(`^\\s*\\[${section.replace('.', '\\.')}\\]\\s*$`);
  const start = lines.findIndex(line => header.test(line));
  if (start === -1) return null;
  const next = lines.findIndex((line, index) => index > start && /^\s*\[[^\]]+\]\s*$/.test(line));
  return { start, end: next === -1 ? lines.length : next };
}

function setTheme(content: string, theme: string): string {
  const lines = content.split('\n');
  const range = sectionRange(lines, 'theme');
  if (!range) {
    const prefix = content.endsWith('\n') || content.length === 0 ? content : `${content}\n`;
    return `${prefix}[theme]\nname = ${JSON.stringify(theme)}\n`;
  }
  for (let index = range.start + 1; index < range.end; index += 1) {
    if (/^\s*name\s*=/.test(lines[index] ?? '')) {
      lines[index] = `name = ${JSON.stringify(theme)}`;
      return lines.join('\n');
    }
  }
  lines.splice(range.start + 1, 0, `name = ${JSON.stringify(theme)}`);
  return lines.join('\n');
}

function removeThemeCustom(content: string): string {
  const lines = content.split('\n');
  const range = sectionRange(lines, 'theme.custom');
  if (!range) return content;
  lines.splice(range.start, range.end - range.start);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

async function writeTheme(theme: string): Promise<void> {
  const file = herdrConfigPath();
  const content = await readIfExists(file);
  const withoutCustom = removeThemeCustom(content ?? '');
  await atomicWrite(file, setTheme(withoutCustom, theme));
}

async function reloadHerdr(): Promise<string | undefined> {
  const binary = process.env.ONE_THEME_HERDR_BIN ?? 'herdr';
  let reload;
  try {
    reload = await run(binary, ['server', 'reload-config']);
  } catch {
    return `Herdr config updated; restart Herdr to apply it.`;
  }
  if (reload.code !== 0) {
    return `Herdr config updated; restart Herdr to apply it.`;
  }
  return undefined;
}

export const herdrTarget: AppAdapter<AppConfigBase> = {
  name: 'herdr',
  label: 'Herdr',
  defaultConfig: {},
  outputPath: herdrConfigPath,
  generate: () => '',
  writeGenerated: false,
  detect: detectHerdr,
  currentTheme: async () => generatedTheme(),
  activate: async (_config, theme) => {
    if (!theme) throw new Error('Herdr activation requires a resolved theme');
    const builtinTheme = builtinThemeFor(theme);
    await writeTheme(builtinTheme);
    const reloadNote = await reloadHerdr();
    return reloadNote ?? `Herdr has no reliable custom theme support; using ${builtinTheme}.`;
  },
  deactivate: async () => {
    await writeTheme('terminal');
    return reloadHerdr();
  },
};

export const herdrInternals = {
  builtinThemeFor,
};
