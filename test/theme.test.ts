import assert from 'node:assert/strict';
import test from 'node:test';
import { generateClaude } from '../src/adapters/claude.js';
import { generateCodex } from '../src/adapters/codex.js';
import { generateGhostty } from '../src/adapters/ghostty.js';
import { herdrInternals } from '../src/adapters/herdr.js';
import { generateNeovim } from '../src/adapters/neovim.js';
import { parseConfig, parseThemeDocument } from '../src/schema.js';
import { generatedOutputs } from '../src/targets.js';
import { resolveTheme } from '../src/resolve.js';
import type { OneThemeConfig, ThemeDocument } from '../src/types.js';

const theme: ThemeDocument = {
  $schema: 'https://raw.githubusercontent.com/maxktz/one-theme/main/schemas/one-theme.schema.json',
  name: 'fixture',
  appearance: 'dark',
  colors: {
    bg: '#000000',
    panel: '#111111',
    elevated: '#222222',
    selection: '#333333',
    border: '#444444',
    focused: '#555555',
    fg: '#eeeeee',
    muted: '#777777',
    subtle: '#999999',
    blue: '#0000ff',
    green: '#00ff00',
    yellow: '#ffff00',
    red: '#ff0000',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    orange: '#ffaa00',
  },
  ui: {
    background: '@color.bg',
    panel: '@color.panel',
    elevated: '@color.elevated',
    selection: '@color.selection',
    border: '@color.border',
    borderFocused: '@color.focused',
    text: '@color.fg',
    textMuted: '@color.muted',
    textSubtle: '@color.subtle',
    file: '@color.subtle',
    directory: '@color.blue',
    ignored: '@color.muted',
    lineNumber: '@color.border',
    cursorLine: '@color.elevated',
    accent: '@color.blue',
    success: '@color.green',
    warning: '@color.yellow',
    error: '@color.red',
    info: '@color.cyan',
    hint: '@color.green',
    special: '@color.magenta',
    interrupted: '@color.orange',
    gitAdded: '@color.green',
    gitChanged: '@color.blue',
    gitDeleted: '@color.red',
    diffAdded: '@color.elevated',
    diffChanged: '@color.elevated',
    diffDeleted: '@color.elevated',
  },
  syntax: {
    keyword: '@color.magenta',
    property: '@color.green',
    punctuation: '@color.fg',
    bracket: '@color.fg',
    comment: { color: '@color.muted', italic: false },
  },
  terminal: {
    black: '@color.bg',
    red: '@color.red',
    green: '@color.green',
    yellow: '@color.yellow',
    blue: '@color.blue',
    magenta: '@color.magenta',
    cyan: '@color.cyan',
    white: '@color.fg',
    brightBlack: '@color.border',
    brightRed: '@color.red',
    brightGreen: '@color.green',
    brightYellow: '@color.yellow',
    brightBlue: '@color.blue',
    brightMagenta: '@color.magenta',
    brightCyan: '@color.cyan',
    brightWhite: '@color.fg',
  },
};

const config: OneThemeConfig = {
  activeTheme: 'fixture',
  apps: {
    neovim: { transparency: true },
    herdr: { transparency: true },
    ghostty: {},
    claude: {},
    codex: {},
  },
};

test('theme parser accepts the semantic schema', () => {
  const parsed = parseThemeDocument(JSON.stringify(theme));
  assert.equal(parsed.name, 'fixture');
  assert.equal(parsed.ui.background, '@color.bg');
  assert.equal(parsed.syntax.comment.color, '@color.muted');
});

test('theme parser rejects alpha hex colors', () => {
  const invalid = {
    ...theme,
    colors: {
      ...theme.colors,
      selection: '#0000ff33',
    },
  };
  assert.throws(() => parseThemeDocument(JSON.stringify(invalid)), /6-digit hex color/);
});

test('config parser accepts typed target settings', () => {
  const parsed = parseConfig(JSON.stringify(config));
  assert.equal(parsed.apps.neovim.transparency, true);
  assert.deepEqual(parsed.apps.ghostty, {});
});

test('resolveTheme resolves explicit color references', () => {
  const resolved = resolveTheme(theme);
  assert.equal(resolved.ui.text, '#eeeeee');
  assert.equal(resolved.syntax.keyword.color, '#ff00ff');
  assert.equal(resolved.terminal.brightWhite, '#eeeeee');
});

test('Neovim generator emits stable one-theme colorscheme', () => {
  const output = generateNeovim(resolveTheme(theme), config.apps.neovim);
  assert.match(output, /vim\.g\.colors_name = "one-theme"/);
  assert.match(output, /"@property"/);
  assert.match(output, /"@punctuation\.delimiter"/);
  assert.match(output, /"NeoTreeDirectoryName"/);
  assert.match(output, /"GitSignsAddNr"/);
  assert.match(output, /"GitSignsStagedChange"/);
  assert.match(output, /"bg"\] = "NONE"/);
  assert.match(output, /vim\.g\.terminal_color_15 = "#eeeeee"/);
});

test('Herdr maps one-theme themes to built-in Herdr themes', () => {
  assert.equal(herdrInternals.builtinThemeFor({ ...resolveTheme(theme), name: 'tokyonight' }), 'tokyo-night');
  assert.equal(herdrInternals.builtinThemeFor({ ...resolveTheme(theme), name: 'tokyo-night' }), 'tokyo-night');
  assert.equal(herdrInternals.builtinThemeFor(resolveTheme(theme)), 'terminal');
});

test('Ghostty generator emits a terminal theme', () => {
  const output = generateGhostty(resolveTheme(theme), config.apps.ghostty);
  assert.match(output, /background = #000000/);
  assert.match(output, /palette = 15=#eeeeee/);
});

test('Claude generator emits a custom semantic theme', () => {
  const output = generateClaude(resolveTheme(theme), config.apps.claude);
  const parsed = JSON.parse(output);
  assert.equal(parsed.name, 'one-theme');
  assert.equal(parsed.overrides.promptBorder, '#444444');
});

test('Codex generator emits a TextMate theme', () => {
  const output = generateCodex(resolveTheme(theme), config.apps.codex);
  assert.match(output, /<key>name<\/key><string>one-theme<\/string>/);
  assert.match(output, /<key>foreground<\/key><string>#eeeeee<\/string>/);
  assert.match(output, /<key>background<\/key><string>#000000<\/string>/);
  assert.match(output, /<key>scope<\/key><string>keyword, keyword\.control, storage, storage\.type, storage\.modifier<\/string>/);
  assert.match(output, /<key>foreground<\/key><string>#ff00ff<\/string>/);
});

test('generatedOutputs emits outputs for passed adapters', () => {
  const outputs = generatedOutputs(theme, {
    ...config,
  }, [{
    name: 'claude',
    label: 'Claude',
    defaultConfig: {},
    outputPath: () => '/tmp/one-theme.json',
    generate: generateClaude,
    detect: async () => true,
    currentTheme: async () => null,
    activate: async () => undefined,
    deactivate: async () => undefined,
  }]);
  assert.equal(outputs.length, 1);
});
