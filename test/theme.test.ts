import assert from 'node:assert/strict';
import test from 'node:test';
import { generateClaude } from '../src/adapters/claude.js';
import { generateGhostty } from '../src/adapters/ghostty.js';
import { generateHerdr } from '../src/adapters/herdr.js';
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
  },
};

test('theme parser accepts the semantic schema', () => {
  const parsed = parseThemeDocument(JSON.stringify(theme));
  assert.equal(parsed.name, 'fixture');
  assert.equal(parsed.ui.background, '@color.bg');
  assert.equal(parsed.syntax.comment.color, '@color.muted');
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
  assert.match(output, /"bg"\] = "NONE"/);
  assert.match(output, /vim\.g\.terminal_color_15 = "#eeeeee"/);
});

test('Herdr generator emits stable one-theme TOML', () => {
  const output = generateHerdr(resolveTheme(theme), config.apps.herdr);
  assert.match(output, /name = "one-theme"/);
  assert.match(output, /panel_bg = "reset"/);
  assert.match(output, /separator = "#444444"/);
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
