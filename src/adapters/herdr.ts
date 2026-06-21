import fs from 'node:fs/promises';
import { atomicWrite, readIfExists } from '../files.js';
import { generatedTheme, herdrConfigPath } from '../paths.js';
import { run } from '../process.js';
import type { AppAdapter, HerdrAppConfig, ResolvedTheme } from '../types.js';

const stockColors = [
  'accent', 'panel_bg', 'surface0', 'surface1', 'surface_dim', 'overlay0',
  'overlay1', 'text', 'subtext0', 'mauve', 'green', 'yellow', 'red', 'blue',
  'teal', 'peach',
] as const;

const startMarker = '# one-theme:start';
const endMarker = '# one-theme:end';

function herdrBackground(theme: ResolvedTheme, config: HerdrAppConfig): string {
  return config.transparency ? 'reset' : theme.ui.background;
}

function stockThemeColors(theme: ResolvedTheme, config: HerdrAppConfig): Record<(typeof stockColors)[number], string> {
  return {
    accent: theme.ui.accent,
    panel_bg: herdrBackground(theme, config),
    surface0: theme.ui.elevated,
    surface1: theme.ui.selection,
    surface_dim: theme.ui.border,
    overlay0: theme.terminal.brightBlack,
    overlay1: theme.ui.textSubtle,
    text: theme.ui.text,
    subtext0: theme.ui.textSubtle,
    mauve: theme.ui.special,
    green: theme.ui.success,
    yellow: theme.ui.warning,
    red: theme.ui.error,
    blue: theme.ui.info,
    teal: theme.ui.hint,
    peach: theme.ui.interrupted,
  };
}

export function generateHerdrCustomBlock(theme: ResolvedTheme, config: HerdrAppConfig, existingKeys = new Set<string>()): string {
  const resolved = stockThemeColors(theme, config);
  const lines = [startMarker];
  for (const key of stockColors) {
    if (!existingKeys.has(key)) lines.push(`${key} = ${JSON.stringify(resolved[key])}`);
  }
  lines.push(endMarker);
  return lines.join('\n');
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

function markerRange(lines: string[]): { start: number; end: number } | null {
  const start = lines.findIndex(line => line.trim().startsWith(startMarker));
  if (start === -1) return null;
  const end = lines.findIndex((line, index) => index > start && line.trim().startsWith(endMarker));
  return end === -1 ? null : { start, end };
}

function parseTheme(content: string): string | null {
  const lines = content.split('\n');
  const range = sectionRange(lines, 'theme');
  if (!range) return null;
  for (let index = range.start + 1; index < range.end; index += 1) {
    const match = lines[index]?.match(/^\s*name\s*=\s*"([^"]+)"/);
    if (match) return match[1]!;
  }
  return null;
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

function unmanagedThemeCustomKeys(lines: string[]): Set<string> {
  const keys = new Set<string>();
  const range = sectionRange(lines, 'theme.custom');
  const managed = markerRange(lines);
  if (!range) return keys;
  for (let index = range.start + 1; index < range.end; index += 1) {
    if (managed && index >= managed.start && index <= managed.end) continue;
    const match = lines[index]?.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
    if (match) keys.add(match[1]!);
  }
  return keys;
}

function upsertManagedCustomBlock(content: string, theme: ResolvedTheme, config: HerdrAppConfig): string {
  const lines = content.split('\n');
  const existingKeys = unmanagedThemeCustomKeys(lines);
  const block = generateHerdrCustomBlock(theme, config, existingKeys).split('\n');
  const managed = markerRange(lines);
  if (managed) {
    lines.splice(managed.start, managed.end - managed.start + 1, ...block);
    return lines.join('\n');
  }

  const custom = sectionRange(lines, 'theme.custom');
  if (custom) {
    lines.splice(custom.start + 1, 0, ...block);
    return lines.join('\n');
  }

  const prefix = content.endsWith('\n') || content.length === 0 ? content : `${content}\n`;
  return `${prefix}\n[theme.custom]\n${block.join('\n')}\n`;
}

function removeManagedCustomBlock(content: string): string {
  const lines = content.split('\n');
  const managed = markerRange(lines);
  if (!managed) return content;
  lines.splice(managed.start, managed.end - managed.start + 1);
  return lines.join('\n');
}

async function currentStockTheme(): Promise<string | null> {
  const content = await readIfExists(herdrConfigPath());
  if (content === null) return null;
  return markerRange(content.split('\n')) ? generatedTheme() : null;
}

async function reloadHerdr(binary: string): Promise<string | undefined> {
  let reload;
  try {
    reload = await run(binary, ['server', 'reload-config']);
  } catch {
    return `Herdr config was updated, but live reload was skipped because ${binary} was not found.`;
  }
  if (reload.code !== 0) {
    return `Herdr config was updated, but live reload failed: ${reload.stderr.trim() || reload.stdout.trim()}`;
  }
  return undefined;
}

export const herdrTarget: AppAdapter<HerdrAppConfig> = {
  name: 'herdr',
  label: 'Herdr',
  defaultConfig: { transparency: true },
  outputPath: herdrConfigPath,
  generate: generateHerdrCustomBlock,
  writeGenerated: false,
  detect: detectHerdr,
  currentTheme: currentStockTheme,
  activate: async (config, theme) => {
    if (!theme) throw new Error('Herdr activation requires a resolved theme');
    const file = herdrConfigPath();
    const content = await readIfExists(file);
    await atomicWrite(file, upsertManagedCustomBlock(content ?? '', theme, config));
    return reloadHerdr(process.env.ONE_THEME_HERDR_BIN ?? 'herdr');
  },
  deactivate: async () => {
    const file = herdrConfigPath();
    const content = await readIfExists(file);
    if (content !== null) await atomicWrite(file, removeManagedCustomBlock(content));
    return reloadHerdr(process.env.ONE_THEME_HERDR_BIN ?? 'herdr');
  },
};
