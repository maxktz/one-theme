import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runChecked } from '../process.js';
import type { ImportedNeovimTheme, JsonValue, ThemeDocument } from '../types.js';

const exporter = String.raw`
local scheme = assert(vim.env.ONE_THEME_SCHEME)
local output = assert(vim.env.ONE_THEME_OUTPUT)
local palette = {}

local style = scheme:match('^tokyonight%-(.+)$')
if style then
  palette = require('tokyonight.colors').setup({ style = style })
end

vim.cmd.colorscheme(scheme)

local highlights = {}
for name, _ in pairs(vim.api.nvim_get_hl(0, {})) do
  local linked = vim.api.nvim_get_hl(0, { name = name, link = true })
  if linked.link then
    highlights[name] = { link = linked.link }
  else
    highlights[name] = vim.api.nvim_get_hl(0, { name = name, link = false })
  end
end

local terminal = {}
for index = 0, 15 do
  local value = vim.g['terminal_color_' .. index]
  if value then terminal[tostring(index)] = value end
end

vim.fn.writefile({ vim.json.encode({
  palette = palette,
  highlights = highlights,
  terminalColors = terminal,
}) }, output)
`;

function normalizeColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function highlightColor(
  highlights: Record<string, Record<string, JsonValue>>,
  groups: string[],
  attribute: 'fg' | 'bg',
): string | undefined {
  for (const group of groups) {
    const value = highlights[group]?.[attribute];
    if (typeof value === 'number') return normalizeColor(value);
    if (typeof value === 'string' && (value === 'NONE' || value.startsWith('#'))) return value;
  }
  return undefined;
}

export function deriveGenericPalette(
  highlights: Record<string, Record<string, JsonValue>>,
): Record<string, JsonValue> {
  const foreground = highlightColor(highlights, ['Normal'], 'fg');
  const background = highlightColor(highlights, ['Normal'], 'bg');
  if (!foreground || !background) {
    throw new Error('colorscheme must define Normal foreground and background colors');
  }

  const color = (groups: string[], fallback = foreground) =>
    highlightColor(highlights, groups, 'fg') ?? fallback;
  return {
    none: 'NONE',
    fg: foreground,
    bg: background,
    bg_highlight: highlightColor(highlights, ['CursorLine', 'Pmenu', 'StatusLine'], 'bg') ?? background,
    bg_visual: highlightColor(highlights, ['Visual', 'PmenuSel'], 'bg') ?? background,
    fg_gutter: color(['LineNr', 'WinSeparator', 'NonText']),
    fg_dark: color(['Comment', 'LineNr']),
    comment: color(['Comment', 'NonText']),
    dark5: color(['NonText', 'LineNr', 'Comment']),
    blue: color(['Function', 'Identifier', 'Directory']),
    green: color(['DiagnosticOk', 'String', 'Added']),
    warning: color(['DiagnosticWarn', 'WarningMsg']),
    error: color(['DiagnosticError', 'ErrorMsg']),
    info: color(['DiagnosticInfo', 'Directory', 'Function']),
    hint: color(['DiagnosticHint', 'Special']),
    orange: color(['Constant', 'Number', 'Special']),
    magenta: color(['Statement', 'Keyword', 'Type']),
  };
}

function normalizeHighlights(highlights: Record<string, Record<string, JsonValue>>): Record<string, Record<string, JsonValue>> {
  return Object.fromEntries(Object.entries(highlights).map(([name, attributes]) => {
    const normalized: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(attributes)) {
      normalized[key] = typeof value === 'number' && ['fg', 'bg', 'sp'].includes(key)
        ? normalizeColor(value)
        : value;
    }
    return [name, normalized];
  }));
}

async function discoverRuntime(colorscheme: string, tempDir: string): Promise<string> {
  const output = path.join(tempDir, 'runtime.json');
  const discovery = String.raw`
local output = assert(vim.env.ONE_THEME_OUTPUT)
local scheme = assert(vim.env.ONE_THEME_SCHEME)
local files = vim.api.nvim_get_runtime_file('colors/' .. scheme .. '.*', true)
vim.fn.writefile({ vim.json.encode(files) }, output)
`;
  const script = path.join(tempDir, 'discover.lua');
  await fs.writeFile(script, discovery, 'utf8');
  await runChecked(process.env.ONE_THEME_NVIM_BIN ?? 'nvim', ['--headless', '-c', `luafile ${script}`, '-c', 'qa'], {
    env: { ...process.env, ONE_THEME_OUTPUT: output, ONE_THEME_SCHEME: colorscheme },
  });
  const files = JSON.parse(await fs.readFile(output, 'utf8')) as string[];
  const colorFile = files[0];
  if (!colorFile) throw new Error(`Neovim could not locate colorscheme ${colorscheme}`);
  return path.dirname(path.dirname(colorFile));
}

async function revisionFor(runtimePath: string): Promise<string | null> {
  try {
    return (await runChecked('git', ['-C', runtimePath, 'rev-parse', 'HEAD'])).stdout.trim() || null;
  } catch {
    return null;
  }
}

export function defaultRoles(palette: Record<string, JsonValue>): Record<string, string> {
  const candidates: Record<string, string[]> = {
    background: ['none', 'bg'],
    elevated: ['bg_highlight', 'bg'],
    selection: ['bg_visual', 'bg_highlight'],
    separator: ['fg_gutter', 'border'],
    accent: ['blue', 'accent'],
    foreground: ['fg', 'text'],
    secondary: ['fg_dark', 'fg'],
    muted: ['comment', 'fg_dark'],
    mutedStrong: ['dark5', 'comment'],
    success: ['green'],
    warning: ['warning', 'yellow'],
    error: ['error', 'red1', 'red'],
    info: ['info', 'blue2', 'blue'],
    hint: ['hint', 'teal'],
    interrupted: ['orange', 'peach'],
    special: ['magenta', 'purple'],
  };
  return Object.fromEntries(Object.entries(candidates).map(([role, keys]) => {
    const key = keys.find(candidate => candidate in palette);
    if (!key) throw new Error(`imported palette cannot satisfy semantic role ${role}`);
    return [role, key];
  }));
}

export async function importNeovimTheme(colorscheme: string, name: string): Promise<ThemeDocument> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'one-theme-import-'));
  try {
    const runtimePath = await discoverRuntime(colorscheme, tempDir);
    const script = path.join(tempDir, 'export.lua');
    const output = path.join(tempDir, 'theme.json');
    await fs.writeFile(script, exporter, 'utf8');
    await runChecked(process.env.ONE_THEME_NVIM_BIN ?? 'nvim', [
      '--headless', '-u', 'NONE', '--cmd', `set runtimepath+=${runtimePath.replace(/ /g, '\\ ')}`,
      '-c', `luafile ${script}`, '-c', 'qa',
    ], { env: { ...process.env, ONE_THEME_OUTPUT: output, ONE_THEME_SCHEME: colorscheme } });
    const imported = JSON.parse(await fs.readFile(output, 'utf8')) as ImportedNeovimTheme;
    const palette = Object.keys(imported.palette).length > 0
      ? imported.palette as Record<string, JsonValue>
      : deriveGenericPalette(imported.highlights);
    const roles = defaultRoles(palette);
    return {
      schemaVersion: 1,
      name,
      source: {
        type: 'neovim',
        colorscheme,
        runtimePath,
        revision: await revisionFor(runtimePath),
        importedAt: new Date().toISOString(),
      },
      base: {
        palette,
        roles,
        targets: {
          neovim: {
            highlights: normalizeHighlights(imported.highlights),
            terminalColors: imported.terminalColors,
          },
          herdr: {
            colors: {
              accent: '@role.accent',
              panel_bg: '@role.background',
              surface0: '@role.elevated',
              active_space_bg: '@role.elevated',
              surface1: '@role.selection',
              surface_dim: '@role.elevated',
              separator: '@role.separator',
              overlay0: '@role.muted',
              overlay1: '@role.mutedStrong',
              text: '@role.foreground',
              subtext0: '@role.secondary',
              mauve: '@role.special',
              green: '@role.success',
              yellow: '@role.warning',
              red: '@role.error',
              blue: '@role.info',
              teal: '@role.hint',
              peach: '@role.interrupted',
            },
          },
        },
      },
      overrides: {
        palette: {},
        roles: {},
        targets: {
          neovim: { highlights: {} },
          herdr: { colors: {} },
        },
      },
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
