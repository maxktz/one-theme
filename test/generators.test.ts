import assert from 'node:assert/strict';
import test from 'node:test';
import { generateClaude } from '../src/adapters/claude.js';
import { generateCodex } from '../src/adapters/codex.js';
import { generateHerdr } from '../src/adapters/herdr.js';
import { generateNeovim } from '../src/adapters/neovim.js';
import { generatedOutputs } from '../src/targets.js';
import type { ThemeLayer } from '../src/types.js';

const herdrColors = {
  accent: '#111111', panel_bg: 'NONE', surface0: '#222222', active_space_bg: '#333333',
  surface1: '#444444', surface_dim: '#555555', separator: '#666666', overlay0: '#777777',
  overlay1: '#888888', text: '#999999', subtext0: '#aaaaaa', mauve: '#bbbbbb',
  green: '#00ff00', yellow: '#ffff00', red: '#ff0000', blue: '#0000ff',
  teal: '#00ffff', peach: '#ffaa00',
};

const theme: ThemeLayer = {
  palette: {},
  roles: {},
  targets: {
    neovim: {
      highlights: { Normal: { fg: '#999999' }, CursorLine: {} },
      terminalColors: { '0': '#000000' },
    },
    herdr: { colors: herdrColors },
    claude: {
      colors: {
        claude: '#0000ff',
        text: '#999999',
        userMessageBackground: '#222222',
      },
    },
    codex: {
      colors: {
        foreground: '#999999',
        background: '#000000',
        comment: '#777777',
        string: '#00ff00',
        keyword: '#bbbbbb',
        function: '#0000ff',
        variable: '#999999',
        type: '#00ffff',
        constant: '#ffaa00',
        operator: '#aaaaaa',
        heading: '#0000ff',
        link: '#0000ff',
        inserted: '#00ff00',
        deleted: '#ff0000',
        insertedBackground: '#222222',
        deletedBackground: '#333333',
      },
    },
  },
};

test('Neovim generator emits a standalone colorscheme', () => {
  const output = generateNeovim('test', theme);
  assert.match(output, /vim\.g\.colors_name = "ot-test"/);
  assert.match(output, /nvim_set_hl\(0, "Normal"/);
  assert.match(output, /vim\.g\.terminal_color_0 = "#000000"/);
});

test('Herdr generator emits a complete external theme and maps NONE to reset', () => {
  const output = generateHerdr('test', theme);
  assert.match(output, /name = "ot-test"/);
  assert.match(output, /panel_bg = "reset"/);
  assert.match(output, /separator = "#666666"/);
});

test('Claude generator emits a custom semantic theme', () => {
  const output = generateClaude('test', theme);
  const parsed = JSON.parse(output);
  assert.equal(parsed.name, 'ot-test');
  assert.equal(parsed.base, 'dark');
  assert.equal(parsed.overrides.claude, '#0000ff');
  assert.equal(parsed.overrides.userMessageBackground, '#222222');
});

test('Codex generator emits a TextMate theme with diff scopes', () => {
  const output = generateCodex('test', theme);
  assert.match(output, /<key>name<\/key><string>ot-test<\/string>/);
  assert.match(output, /<key>scope<\/key><string>markup\.inserted, diff\.inserted<\/string>/);
  assert.match(output, /<key>background<\/key><string>#222222<\/string>/);
  assert.match(output, /<key>scope<\/key><string>entity\.name\.type, support\.type<\/string>/);
});

test('generated outputs can backfill default color-mapped targets', () => {
  const outputs = generatedOutputs('test', {
    schemaVersion: 1,
    name: 'test',
    source: {
      type: 'neovim',
      colorscheme: 'test',
      runtimePath: '/tmp/test',
      revision: null,
      importedAt: '2026-01-01T00:00:00.000Z',
    },
    base: {
      palette: { blue: '#0000ff', fg: '#999999', bg_highlight: '#222222' },
      roles: { accent: 'blue', foreground: 'fg', elevated: 'bg_highlight' },
      targets: {
        neovim: { highlights: {}, terminalColors: {} },
        herdr: { colors: herdrColors },
      },
    },
    overrides: {
      palette: {},
      roles: {},
      targets: { neovim: { highlights: {} }, herdr: { colors: {} } },
    },
  }, [{
    name: 'claude',
    defaultColors: {
      claude: '@role.accent',
      text: '@role.foreground',
      userMessageBackground: '@role.elevated',
    },
    outputPath: name => `/tmp/${name}.json`,
    generate: generateClaude,
  }]);

  assert.equal(outputs.length, 1);
  assert.match(outputs[0]!.content, /"userMessageBackground": "#222222"/);
});
