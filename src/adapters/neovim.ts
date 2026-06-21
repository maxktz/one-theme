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

function tokenOr(theme: ResolvedTheme, name: string, fallback: ResolvedSyntaxStyle): ResolvedSyntaxStyle {
  return theme.syntax[name] ?? fallback;
}

function background(theme: ResolvedTheme, config: NeovimAppConfig): string {
  return config.transparency ? 'NONE' : theme.ui.background;
}

function gitsignsHighlights(ui: ResolvedTheme['ui']): Record<string, Highlight> {
  const colors = {
    Add: { fg: ui.gitAdded, bg: ui.diffAdded },
    Change: { fg: ui.gitChanged, bg: ui.diffChanged },
    Delete: { fg: ui.gitDeleted, bg: ui.diffDeleted },
    Changedelete: { fg: ui.gitChanged, bg: ui.diffChanged },
    Topdelete: { fg: ui.gitDeleted, bg: ui.diffDeleted },
    Untracked: { fg: ui.gitAdded, bg: ui.diffAdded },
  };
  const suffixes = ['', 'Nr', 'Cul'];
  const result: Record<string, Highlight> = {};
  for (const [kind, color] of Object.entries(colors)) {
    for (const suffix of suffixes) {
      result[`GitSigns${kind}${suffix}`] = { fg: color.fg };
      result[`GitSignsStaged${kind}${suffix}`] = { fg: color.fg };
    }
    if (kind !== 'Delete') {
      result[`GitSigns${kind}Ln`] = { bg: color.bg };
      result[`GitSignsStaged${kind}Ln`] = { bg: color.bg };
    }
  }
  result.GitSignsAddPreview = { bg: ui.diffAdded };
  result.GitSignsDeletePreview = { bg: ui.diffDeleted };
  result.GitSignsAddInline = { fg: ui.success, bg: ui.diffAdded };
  result.GitSignsChangeInline = { fg: ui.warning, bg: ui.diffChanged };
  result.GitSignsDeleteInline = { fg: ui.error, bg: ui.diffDeleted };
  result.GitSignsAddLnInline = { fg: ui.success, bg: ui.diffAdded };
  result.GitSignsChangeLnInline = { fg: ui.warning, bg: ui.diffChanged };
  result.GitSignsDeleteLnInline = { fg: ui.error, bg: ui.diffDeleted };
  result.GitSignsDeleteVirtLn = { bg: ui.diffDeleted };
  result.GitSignsDeleteVirtLnInLine = { fg: ui.error, bg: ui.diffDeleted };
  result.GitSignsVirtLnum = { fg: ui.gitDeleted, bg: ui.diffDeleted };
  result.GitSignsCurrentLineBlame = { fg: ui.textMuted };
  return result;
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
  const punctuationToken = token(theme, 'punctuation', ui.text);
  const delimiter = style(tokenOr(theme, 'delimiter', punctuationToken));
  const bracket = style(token(theme, 'bracket', ui.text));
  const punctuationSpecial = style(token(theme, 'punctuationSpecial', ui.special));
  const attribute = style(token(theme, 'attribute', ui.special));
  const tag = style(token(theme, 'tag', ui.success));
  const label = style(token(theme, 'label', ui.info));
  return {
    ...gitsignsHighlights(ui),

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
    Delimiter: delimiter,
    Type: type,
    Special: style(token(theme, 'special', ui.special)),
    Directory: { fg: ui.directory },

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

    NeoTreeNormal: { fg: ui.file, bg: normalBg },
    NeoTreeNormalNC: { fg: ui.file, bg: normalBg },
    NeoTreeCursorLine: { bg: ui.elevated },
    NeoTreeDimText: { fg: ui.textMuted },
    NeoTreeDotfile: { fg: ui.textMuted },
    NeoTreeFileIcon: { fg: ui.file },
    NeoTreeFileName: { fg: ui.file },
    NeoTreeFileNameOpened: { fg: ui.text },
    NeoTreeDirectoryIcon: { fg: ui.directory },
    NeoTreeDirectoryName: { fg: ui.directory },
    NeoTreeRootName: { fg: ui.textSubtle, bold: false },
    NeoTreeIndentMarker: { fg: ui.border },
    NeoTreeGitAdded: { fg: ui.gitAdded },
    NeoTreeGitConflict: { fg: ui.warning },
    NeoTreeGitDeleted: { fg: ui.gitDeleted },
    NeoTreeGitIgnored: { fg: ui.ignored },
    NeoTreeGitModified: { fg: ui.gitChanged },
    NeoTreeGitRenamed: { fg: ui.gitChanged },
    NeoTreeGitStaged: { fg: ui.gitAdded },
    NeoTreeGitUnstaged: { fg: ui.gitChanged },
    NeoTreeGitUntracked: { fg: ui.gitAdded },
    NeoTreeWinSeparator: { fg: ui.border, bg: normalBg },
    NvimTreeNormal: { fg: ui.file, bg: normalBg },
    NvimTreeNormalNC: { fg: ui.file, bg: normalBg },
    NvimTreeFileIcon: { fg: ui.file },
    NvimTreeFolderIcon: { fg: ui.directory },
    NvimTreeFolderName: { fg: ui.directory },
    NvimTreeOpenedFolderName: { fg: ui.directory },
    NvimTreeEmptyFolderName: { fg: ui.directory },
    NvimTreeOpenedFile: { fg: ui.text },
    NvimTreeGitDeleted: { fg: ui.gitDeleted },
    NvimTreeGitDirty: { fg: ui.gitChanged },
    NvimTreeGitIgnored: { fg: ui.ignored },
    NvimTreeGitMerge: { fg: ui.warning },
    NvimTreeGitNew: { fg: ui.gitAdded },
    NvimTreeGitRenamed: { fg: ui.gitChanged },
    NvimTreeGitStaged: { fg: ui.gitAdded },
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
    '@punctuation.delimiter': delimiter,
    '@punctuation.bracket': bracket,
    '@punctuation.special': punctuationSpecial,
    '@tag': tag,
    '@tag.delimiter': bracket,
    '@tag.attribute': attribute,
    '@attribute': attribute,
    '@label': label,
    '@markup.link': style(token(theme, 'link', ui.info)),
    '@markup.link.url': style(token(theme, 'link', ui.info)),
    '@lsp.type.property': { link: '@property' },
    '@lsp.type.variable': { link: '@variable' },
    '@lsp.type.parameter': { link: '@variable.parameter' },
    '@lsp.type.function': { link: '@function' },
    '@lsp.type.method': { link: '@function.method' },
    '@lsp.type.class': { link: '@type' },
    '@lsp.type.interface': { link: '@type' },
    '@lsp.type.enum': { link: '@type' },
    '@lsp.type.enumMember': { link: '@constant' },
    '@lsp.type.decorator': { link: '@attribute' },
    '@lsp.type.modifier': { link: '@keyword' },
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
