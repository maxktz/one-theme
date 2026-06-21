import type { AppConfigBase, ColorValue, OneThemeConfig, SyntaxStyle, SyntaxValue, TerminalTheme, ThemeDocument, UiTheme } from './types.js';

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

function color(value: unknown, label: string): ColorValue {
  const text = string(value, label);
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(text) || /^@color\.[a-zA-Z0-9_.-]+$/.test(text)) {
    return text as ColorValue;
  }
  throw new Error(`${label} must be a hex color or @color reference`);
}

function colors(value: unknown, label: string): Record<string, `#${string}`> {
  const raw = object(value, label);
  const result: Record<string, `#${string}`> = {};
  for (const [key, item] of Object.entries(raw)) {
    const text = string(item, `${label}.${key}`);
    if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(text)) {
      throw new Error(`${label}.${key} must be a hex color`);
    }
    result[key] = text as `#${string}`;
  }
  return result;
}

function style(value: unknown, label: string): SyntaxValue {
  if (typeof value === 'string') return color(value, label);
  const raw = object(value, label);
  const result: SyntaxStyle = { color: color(raw.color, `${label}.color`) };
  if ('italic' in raw) result.italic = boolean(raw.italic, `${label}.italic`);
  if ('bold' in raw) result.bold = boolean(raw.bold, `${label}.bold`);
  if ('underline' in raw) result.underline = boolean(raw.underline, `${label}.underline`);
  return result;
}

function requiredColors<T extends object>(value: unknown, label: string, keys: readonly (keyof T)[]): T {
  const raw = object(value, label);
  const result: Record<string, ColorValue> = {};
  for (const key of keys) result[String(key)] = color(raw[String(key)], `${label}.${String(key)}`);
  return result as T;
}

const uiKeys = [
  'background', 'panel', 'elevated', 'selection', 'border', 'borderFocused',
  'text', 'textMuted', 'textSubtle', 'lineNumber', 'cursorLine', 'accent',
  'success', 'warning', 'error', 'info', 'hint', 'special', 'interrupted',
  'gitAdded', 'gitChanged', 'gitDeleted', 'diffAdded', 'diffChanged', 'diffDeleted',
] as const satisfies readonly (keyof UiTheme)[];

const terminalKeys = [
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue',
  'brightMagenta', 'brightCyan', 'brightWhite',
] as const satisfies readonly (keyof TerminalTheme)[];

export function parseThemeDocument(raw: string): ThemeDocument {
  const value = object(JSON.parse(raw), 'theme');
  const syntax = object(value.syntax, 'theme.syntax');
  const appearance = string(value.appearance, 'theme.appearance');
  if (appearance !== 'dark' && appearance !== 'light') throw new Error('theme.appearance must be "dark" or "light"');
  const document: ThemeDocument = {
    name: string(value.name, 'theme.name'),
    appearance,
    colors: colors(value.colors, 'theme.colors'),
    ui: requiredColors<UiTheme>(value.ui, 'theme.ui', uiKeys),
    syntax: Object.fromEntries(Object.entries(syntax).map(([key, item]) => [key, style(item, `theme.syntax.${key}`)])),
    terminal: requiredColors<TerminalTheme>(value.terminal, 'theme.terminal', terminalKeys),
  };
  if (typeof value.$schema === 'string') document.$schema = value.$schema;
  return document;
}

function appBase(value: unknown, label: string): AppConfigBase {
  const raw = object(value, label);
  const result: AppConfigBase = {};
  if (raw.previousTheme !== undefined) result.previousTheme = string(raw.previousTheme, `${label}.previousTheme`);
  return result;
}

export function parseConfig(raw: string): OneThemeConfig {
  const value = object(JSON.parse(raw), 'config');
  const apps = object(value.apps, 'config.apps');
  const neovimRaw = object(apps.neovim, 'config.apps.neovim');
  const herdrRaw = object(apps.herdr, 'config.apps.herdr');
  const config: OneThemeConfig = {
    activeTheme: string(value.activeTheme, 'config.activeTheme'),
    apps: {
      neovim: { ...appBase(apps.neovim, 'config.apps.neovim'), transparency: boolean(neovimRaw.transparency, 'config.apps.neovim.transparency') },
      herdr: { ...appBase(apps.herdr, 'config.apps.herdr'), transparency: boolean(herdrRaw.transparency, 'config.apps.herdr.transparency') },
      ghostty: appBase(apps.ghostty, 'config.apps.ghostty'),
      claude: appBase(apps.claude, 'config.apps.claude'),
    },
  };
  if (typeof value.$schema === 'string') config.$schema = value.$schema;
  return config;
}
