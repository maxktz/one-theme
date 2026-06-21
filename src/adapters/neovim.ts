import fs from 'node:fs/promises';
import { atomicWrite, readIfExists } from '../files.js';
import { generatedTheme, nvimConfigDir, nvimThemePath } from '../paths.js';
import type { AppAdapter, NeovimAppConfig, ResolvedSyntaxStyle, ResolvedTheme } from '../types.js';

type HighlightValue = string | boolean | number | Highlight | undefined;
interface Highlight { [key: string]: HighlightValue }

function lua(value: HighlightValue): string {
  if (value === undefined) return 'nil';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  return `{ ${Object.entries(value).map(([key, item]) => `[${JSON.stringify(key)}] = ${lua(item)}`).join(', ')} }`;
}

function style(token: ResolvedSyntaxStyle): Highlight {
  const result: Highlight = { fg: token.color };
  if (token.italic !== undefined) result.italic = token.italic;
  if (token.bold !== undefined) result.bold = token.bold;
  if (token.underline !== undefined) result.underline = token.underline;
  return result;
}

function token(theme: ResolvedTheme, name: string, fallback: string): ResolvedSyntaxStyle {
  return theme.syntax[name] ?? { color: fallback };
}

function background(theme: ResolvedTheme, config: NeovimAppConfig): string {
  return config.transparency ? 'NONE' : theme.ui.background;
}

function highlights(theme: ResolvedTheme, config: NeovimAppConfig): Record<string, Highlight> {
  const ui = theme.ui;
  const normalBg = background(theme, config);
  const keyword = style(token(theme, 'keyword', ui.special));
  const type = style(token(theme, 'type', ui.info));
  const variable = style(token(theme, 'variable', ui.text));
  const parameter = style(token(theme, 'parameter', ui.warning));
  const property = style(token(theme, 'property', ui.success));
  const fn = style(token(theme, 'function', ui.accent));
  const string = style(token(theme, 'string', ui.success));
  const number = style(token(theme, 'number', ui.interrupted));
  const comment = style(token(theme, 'comment', ui.textMuted));
  const operator = style(token(theme, 'operator', ui.info));
  return {
    Normal: { fg: ui.text, bg: normalBg },
    NormalNC: { fg: ui.text, bg: normalBg },
    NormalFloat: { fg: ui.text, bg: ui.panel },
    FloatBorder: { fg: ui.borderFocused, bg: ui.panel },
    CursorLine: { bg: config.transparency ? 'NONE' : ui.cursorLine },
    CursorLineNr: { fg: ui.text, bold: false },
    LineNr: { fg: ui.lineNumber },
    SignColumn: { fg: ui.lineNumber, bg: normalBg },
    FoldColumn: { bg: normalBg },
    VertSplit: { fg: ui.border },
    WinSeparator: { fg: ui.border, bold: false },
    Visual: { bg: ui.selection },
    Search: { fg: theme.colors.black ?? ui.background, bg: ui.warning },
    IncSearch: { fg: theme.colors.black ?? ui.background, bg: ui.warning },
    Pmenu: { fg: ui.text, bg: ui.panel },
    PmenuSel: { fg: ui.text, bg: ui.selection },
    StatusLine: { fg: ui.textSubtle, bg: ui.elevated },
    StatusLineNC: { fg: ui.textMuted, bg: ui.panel },
    TabLineFill: { bg: normalBg },

    Comment: comment,
    Constant: style(token(theme, 'constant', ui.info)),
    String: string,
    Character: string,
    Number: number,
    Boolean: number,
    Float: number,
    Identifier: variable,
    Function: fn,
    Statement: keyword,
    Keyword: keyword,
    Conditional: keyword,
    Repeat: keyword,
    Operator: operator,
    Type: type,
    Special: style(token(theme, 'special', ui.special)),
    Directory: { fg: ui.accent },

    DiagnosticError: { fg: ui.error },
    DiagnosticWarn: { fg: ui.warning },
    DiagnosticInfo: { fg: ui.info },
    DiagnosticHint: { fg: ui.hint },
    DiagnosticVirtualTextError: { fg: ui.error },
    DiagnosticVirtualTextWarn: { fg: ui.warning },
    DiagnosticVirtualTextInfo: { fg: ui.info },
    DiagnosticVirtualTextHint: { fg: ui.hint },

    DiffAdd: { fg: ui.success, bg: ui.diffAdded },
    DiffChange: { fg: ui.warning, bg: ui.diffChanged },
    DiffDelete: { fg: ui.error, bg: ui.diffDeleted },
    Added: { fg: ui.success },
    Changed: { fg: ui.warning },
    Removed: { fg: ui.error },
    GitSignsAdd: { fg: ui.gitAdded },
    GitSignsChange: { fg: ui.gitChanged },
    GitSignsDelete: { fg: ui.gitDeleted },

    NeoTreeNormal: { fg: ui.textSubtle, bg: normalBg },
    NeoTreeNormalNC: { fg: ui.textSubtle, bg: normalBg },
    NeoTreeCursorLine: { bg: ui.elevated },
    NeoTreeWinSeparator: { fg: ui.border, bg: normalBg },
    NvimTreeNormal: { fg: ui.textSubtle, bg: normalBg },
    NvimTreeNormalNC: { fg: ui.textSubtle, bg: normalBg },
    NvimTreeWinSeparator: { fg: ui.border, bg: normalBg },

    MiniStatuslineModeNormal: { fg: theme.colors.black ?? ui.background, bg: ui.accent, bold: true },
    MiniStatuslineModeVisual: { fg: theme.colors.black ?? ui.background, bg: ui.special, bold: true },
    MiniStatuslineDevinfo: { fg: ui.textSubtle, bg: ui.elevated },
    MiniStatuslineFilename: { fg: ui.textSubtle, bg: ui.elevated },
    MiniStatuslineFileinfo: { fg: ui.textSubtle, bg: ui.elevated },
    MiniStatuslineGit: { fg: ui.textMuted, bg: ui.elevated },
    MiniStatuslineDiagnosticError: { fg: ui.error, bg: ui.elevated },
    MiniStatuslineDiagnosticWarn: { fg: ui.warning, bg: ui.elevated },
    MiniStatuslineDiagnosticInfo: { fg: ui.info, bg: ui.elevated },
    MiniStatuslineDiagnosticHint: { fg: ui.hint, bg: ui.elevated },

    '@comment': comment,
    '@constant': style(token(theme, 'constant', ui.info)),
    '@constant.builtin': style(token(theme, 'builtin', ui.error)),
    '@boolean': number,
    '@number': number,
    '@string': string,
    '@string.escape': style(token(theme, 'stringEscape', ui.special)),
    '@function': fn,
    '@function.call': fn,
    '@function.method': fn,
    '@function.method.call': fn,
    '@function.builtin': style(token(theme, 'builtin', ui.error)),
    '@constructor': style(token(theme, 'constructor', ui.special)),
    '@keyword': keyword,
    '@keyword.function': keyword,
    '@keyword.operator': operator,
    '@keyword.return': keyword,
    '@operator': operator,
    '@type': type,
    '@type.builtin': style(token(theme, 'typeBuiltin', ui.info)),
    '@variable': variable,
    '@variable.builtin': style(token(theme, 'builtin', ui.error)),
    '@variable.member': property,
    '@variable.parameter': parameter,
    '@property': property,
    '@field': property,
    '@punctuation.delimiter': operator,
    '@punctuation.bracket': { fg: ui.textSubtle },
    '@tag.attribute': property,
    '@lsp.type.property': { link: '@property' },
    '@lsp.type.variable': { link: '@variable' },
    '@lsp.type.parameter': { link: '@variable.parameter' },
    '@lsp.type.function': { link: '@function' },
    '@lsp.type.method': { link: '@function.method' },
    '@lsp.type.class': { link: '@type' },
    '@lsp.type.interface': { link: '@type' },
    '@lsp.type.enum': { link: '@type' },
  };
}

export function generateNeovim(theme: ResolvedTheme, config: NeovimAppConfig): string {
  const lines = [
    '-- Generated by one-theme. Edit the canonical theme JSON, not this file.',
    '',
    'if vim.g.colors_name then vim.cmd("highlight clear") end',
    'vim.o.termguicolors = true',
    'vim.g.colors_name = "one-theme"',
    '',
  ];
  for (const [group, attributes] of Object.entries(highlights(theme, config)).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`vim.api.nvim_set_hl(0, ${JSON.stringify(group)}, ${lua(attributes)})`);
  }
  lines.push('');
  const terminal = [
    theme.terminal.black, theme.terminal.red, theme.terminal.green, theme.terminal.yellow,
    theme.terminal.blue, theme.terminal.magenta, theme.terminal.cyan, theme.terminal.white,
    theme.terminal.brightBlack, theme.terminal.brightRed, theme.terminal.brightGreen, theme.terminal.brightYellow,
    theme.terminal.brightBlue, theme.terminal.brightMagenta, theme.terminal.brightCyan, theme.terminal.brightWhite,
  ];
  terminal.forEach((color, index) => lines.push(`vim.g.terminal_color_${index} = ${JSON.stringify(color)}`));
  lines.push('');
  return lines.join('\n');
}

async function detectNeovim(): Promise<boolean> {
  try {
    return (await fs.stat(nvimConfigDir())).isDirectory();
  } catch {
    return false;
  }
}

function initPath(): string {
  return `${nvimConfigDir()}/init.lua`;
}

function parseTheme(content: string): string | null {
  const luaCall = content.match(/vim\.cmd\.colorscheme\s*(?:\(?\s*)['"]([^'"]+)['"]\s*\)?/);
  if (luaCall) return luaCall[1]!;
  const command = content.match(/(?:^|\n)\s*colorscheme\s+([^\s"']+)/);
  return command?.[1] ?? null;
}

function setTheme(content: string, theme: string): string {
  const replacement = `vim.cmd.colorscheme '${theme}'`;
  const luaCall = /vim\.cmd\.colorscheme\s*(?:\(?\s*)['"][^'"]+['"]\s*\)?/;
  if (luaCall.test(content)) return content.replace(luaCall, replacement);
  const command = /((?:^|\n)\s*)colorscheme\s+[^\s"']+/;
  if (command.test(content)) return content.replace(command, `$1${replacement}`);
  const prefix = content.endsWith('\n') || content.length === 0 ? content : `${content}\n`;
  return `${prefix}${replacement}\n`;
}

async function currentTheme(): Promise<string | null> {
  const content = await readIfExists(initPath());
  return content === null ? null : parseTheme(content);
}

async function writeTheme(theme: string): Promise<void> {
  const file = initPath();
  const content = await readIfExists(file);
  await atomicWrite(file, setTheme(content ?? '', theme));
}

export const neovimTarget: AppAdapter<NeovimAppConfig> = {
  name: 'neovim',
  label: 'Neovim',
  defaultConfig: { transparency: true },
  outputPath: nvimThemePath,
  generate: generateNeovim,
  detect: detectNeovim,
  currentTheme,
  activate: async () => {
    await writeTheme(generatedTheme());
    return undefined;
  },
  deactivate: async config => {
    await writeTheme(config.previousTheme ?? 'default');
    return undefined;
  },
};
